import { matchLinkedTranslation } from "../research-backfill/existing";
import { RESEARCH_DISCOVERY_QUERIES } from "./config";
import { createCrossrefClient } from "./crossref";
import { buildResearchDraft, type ResearchDraft } from "./draft";
import { normalizeDoi } from "./normalize";
import { createPubmedClient, PubmedUnavailableError, type PubmedRecord } from "./pubmed";
import { assessRelevance, type RelevanceDecision } from "./relevance";
import {
  createResearchDraft,
  createSanityWriteClient,
  duplicateOf,
  loadResearchIdentities,
} from "./sanity";
import type { ResearchIdentity } from "./dedupe";
import { mapResearchTopic } from "./topics";

/** Scheduled discovery writes at most this many new English drafts. */
export const SCHEDULED_RESEARCH_CREATE_LIMIT = 10;

export type DiscoveryDraftRef = {
  pmid: string;
  draftId: string;
  title: string;
};

export type DiscoverySummary = {
  dryRun: boolean;
  lookbackDays: number;
  queriesRun: number;
  pubmedRecordsFound: number;
  duplicatesSkipped: number;
  rejected: number;
  reviewCandidates: number;
  autoDraftCandidates: number;
  /** Unpublished drafts actually created. Always empty during dry-run. */
  createdDrafts: DiscoveryDraftRef[];
  /** Dry-run only: auto-draft studies inside the create limit. Nothing is written. */
  wouldCreate: DiscoveryDraftRef[];
  /** Eligible auto-draft studies past maxCreates. Nothing was written for these. */
  withheldByLimit: DiscoveryDraftRef[];
  errors: number;
};

export type DiscoverySanityClient = {
  fetch: (query: string) => Promise<unknown>;
  create: (document: ResearchDraft) => Promise<unknown>;
};

export type DiscoveryConfig = {
  dryRun: boolean;
  lookbackDays: number;
  email: string;
  apiKey?: string;
  /**
   * Stop after this many new English drafts.
   * The scheduled pipeline passes SCHEDULED_RESEARCH_CREATE_LIMIT.
   * Omit it for an uncapped manual write.
   */
  maxCreates?: number;
  sanity: {
    projectId: string;
    dataset: string;
    apiVersion: string;
    token: string;
  };
  sanityClient?: DiscoverySanityClient;
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
};

export async function runResearchDiscovery(
  config: DiscoveryConfig,
): Promise<DiscoverySummary> {
  const summary: DiscoverySummary = {
    dryRun: config.dryRun,
    lookbackDays: config.lookbackDays,
    queriesRun: 0,
    pubmedRecordsFound: 0,
    duplicatesSkipped: 0,
    rejected: 0,
    reviewCandidates: 0,
    autoDraftCandidates: 0,
    createdDrafts: [],
    wouldCreate: [],
    withheldByLimit: [],
    errors: 0,
  };

  if (
    config.maxCreates !== undefined &&
    (!Number.isInteger(config.maxCreates) || config.maxCreates < 1)
  ) {
    throw new Error(
      `maxCreates must be a positive integer. Received: ${String(config.maxCreates)}`,
    );
  }

  const pubmed = createPubmedClient({
    email: config.email,
    apiKey: config.apiKey,
    lookbackDays: config.lookbackDays,
    fetchImpl: config.fetchImpl,
    sleep: config.sleep,
    now: config.now,
  });
  const crossref = createCrossrefClient({ email: config.email });
  const queriesByPmid = new Map<string, Set<string>>();

  for (const term of RESEARCH_DISCOVERY_QUERIES) {
    const ids = await pubmed.searchQuery(term);
    summary.queriesRun += 1;
    for (const id of ids) {
      const queries = queriesByPmid.get(id) ?? new Set<string>();
      queries.add(term);
      queriesByPmid.set(id, queries);
    }
    console.log(`Query: ${term} — ${ids.length} PMID${ids.length === 1 ? "" : "s"}`);
  }

  summary.pubmedRecordsFound = queriesByPmid.size;
  const fetched = await pubmed.fetchRecords([...queriesByPmid.keys()]);
  summary.errors += fetched.errors.length;
  for (const error of fetched.errors) {
    console.error(`Record error: ${error.message}`);
  }

  const sanity = config.sanityClient ?? createSanityWriteClient(config.sanity);
  const existing = await loadResearchIdentities(sanity);
  const importedAt = new Date().toISOString();

  for (const record of fetched.records) {
    try {
      await processRecord({
        record,
        queries: [...(queriesByPmid.get(record.pmid) ?? [])],
        crossref,
        existing,
        importedAt,
        dryRun: config.dryRun,
        maxCreates: config.maxCreates,
        sanity,
        summary,
      });
    } catch (error) {
      if (isUnauthorized(error)) throw error;
      summary.errors += 1;
      const message = error instanceof Error ? error.message : "unknown error";
      console.error(`Record error: PMID ${record.pmid} — ${message}`);
    }
  }

  printSummary(summary);
  return summary;
}

async function processRecord(input: {
  record: PubmedRecord;
  queries: string[];
  crossref: ReturnType<typeof createCrossrefClient>;
  existing: ResearchIdentity[];
  importedAt: string;
  dryRun: boolean;
  maxCreates?: number;
  sanity: DiscoverySanityClient;
  summary: DiscoverySummary;
}) {
  const relevance = assessRelevance({
    title: input.record.title,
    abstract: input.record.abstract,
    abstractSections: input.record.abstractSections,
    publicationTypes: input.record.publicationTypes,
    commentCorrections: input.record.commentCorrections,
  });

  if (relevance.disposition === "reject") {
    input.summary.rejected += 1;
    logClassification("REJECT", input.record.pmid, input.record.title, relevance);
    return;
  }

  if (relevance.disposition === "review_candidate") {
    input.summary.reviewCandidates += 1;
    logClassification("REVIEW", input.record.pmid, input.record.title, relevance);
    return;
  }

  logClassification("AUTO_DRAFT", input.record.pmid, input.record.title, relevance);

  const doi = normalizeDoi(input.record.doi);
  let crossrefMetadata = null;
  let crossrefStatus: "enriched" | "no-doi" | "failed" = "no-doi";
  if (doi) {
    crossrefMetadata = await input.crossref.lookup(doi);
    crossrefStatus = crossrefMetadata ? "enriched" : "failed";
  }

  const draft = buildResearchDraft({
    record: input.record,
    crossref: crossrefMetadata,
    crossrefStatus,
    topic: mapResearchTopic(input.record.title, input.record.abstract),
    relevanceRules: relevance.rules,
    sourceQueries: input.queries,
    importedAt: input.importedAt,
  });

  if (!draft) {
    input.summary.errors += 1;
    console.error(`Record error: PMID ${input.record.pmid} — missing title or identifier`);
    return;
  }

  const duplicate = duplicateOf(draft, input.existing) ?? linkedDuplicate(draft, input.existing);
  if (duplicate) {
    input.summary.duplicatesSkipped += 1;
    console.log(
      `Duplicate skipped: PMID ${draft.pmid} matches ${duplicate.id} by ${duplicate.reason}`,
    );
    return;
  }

  const ref = { pmid: draft.pmid, draftId: draft._id, title: draft.title };
  const accepted = input.dryRun
    ? input.summary.autoDraftCandidates
    : input.summary.createdDrafts.length;
  const withinLimit = input.maxCreates === undefined || accepted < input.maxCreates;
  if (!withinLimit) {
    input.summary.withheldByLimit.push(ref);
    console.log(
      `Deferred over create limit (${input.maxCreates}): ${draft._id} — ${draft.title}`,
    );
    return;
  }

  if (input.dryRun) {
    input.summary.autoDraftCandidates += 1;
    input.summary.wouldCreate.push(ref);
    console.log(
      `Would create ${draft._id} — ${draft.title} [${draft.topic}]`,
    );
    input.existing.push(identityFromDraft(draft));
    return;
  }

  // Review candidates and rejections return above. Only AUTO_DRAFT reaches Sanity.
  const fresh = await loadResearchIdentities(input.sanity);
  const freshDuplicate = duplicateOf(draft, fresh) ?? linkedDuplicate(draft, fresh);
  if (freshDuplicate) {
    input.summary.duplicatesSkipped += 1;
    console.log(
      `Duplicate skipped: PMID ${draft.pmid} matches ${freshDuplicate.id} by ${freshDuplicate.reason}`,
    );
    input.existing.push({
      id: freshDuplicate.id,
      pmid: draft.pmid,
      doi: draft.doi,
      title: draft.title,
      slug: draft.slug.current,
    });
    return;
  }

  const result = await createResearchDraft(input.sanity, draft);
  if (result === "duplicate") {
    input.summary.duplicatesSkipped += 1;
    console.log(`Duplicate skipped: ${draft._id} already exists`);
    return;
  }

  input.summary.autoDraftCandidates += 1;
  input.summary.createdDrafts.push(ref);
  console.log(`Draft created: ${draft._id} — ${draft.title}`);
  input.existing.push(identityFromDraft(draft));
}

function linkedDuplicate(
  draft: ResearchDraft,
  existing: readonly ResearchIdentity[],
): { id: string; reason: "translation" } | null {
  const linked = matchLinkedTranslation(
    { draftId: draft._id, slug: draft.slug.current },
    existing,
  );
  if (!linked) return null;
  return { id: linked.matchedDocumentId, reason: "translation" };
}

function logClassification(
  label: "AUTO_DRAFT" | "REVIEW" | "REJECT",
  pmid: string,
  title: string,
  decision: RelevanceDecision,
) {
  console.log(`${label} — PMID ${pmid}`);
  console.log(`Reason: ${decision.reason}`);
  console.log(`Title: ${title}`);
  for (const correctedPmid of decision.correctedPmids) {
    console.log(`Corrects PMID ${correctedPmid}`);
  }
}

function identityFromDraft(draft: {
  _id: string;
  pmid: string;
  doi?: string;
  title: string;
  slug: { current: string };
}): ResearchIdentity {
  return {
    id: draft._id,
    pmid: draft.pmid,
    doi: draft.doi,
    title: draft.title,
    slug: draft.slug.current,
  };
}

function printSummary(summary: DiscoverySummary) {
  console.log("");
  console.log("Research discovery summary");
  console.log(`  Mode: ${summary.dryRun ? "dry-run" : "create drafts"}`);
  console.log(`  Lookback days: ${summary.lookbackDays}`);
  console.log(`  Queries run: ${summary.queriesRun}`);
  console.log(`  Records found: ${summary.pubmedRecordsFound}`);
  console.log(`  Auto-draft candidates: ${summary.autoDraftCandidates}`);
  console.log(`  English drafts created: ${summary.createdDrafts.length}`);
  console.log(`  Deferred over create limit: ${summary.withheldByLimit.length}`);
  console.log(`  Review candidates: ${summary.reviewCandidates}`);
  console.log(`  Rejected: ${summary.rejected}`);
  console.log(`  Duplicates: ${summary.duplicatesSkipped}`);
  console.log(`  Errors: ${summary.errors}`);
}

function isUnauthorized(error: unknown): boolean {
  if (!error || typeof error !== "object" || !("statusCode" in error)) return false;
  return error.statusCode === 401 || error.statusCode === 403;
}

export function assertDiscoveryConfig(config: {
  email: string | undefined;
  token: string | undefined;
  projectId: string | undefined;
  dataset: string | undefined;
}): asserts config is {
  email: string;
  token: string;
  projectId: string;
  dataset: string;
} {
  if (!config.email?.trim() || !config.email.includes("@")) {
    throw new Error(
      "NCBI_CONTACT_EMAIL must be set to a contact email for NCBI E-utilities. It is not hardcoded.",
    );
  }
  if (!config.token?.trim()) {
    throw new Error(
      "SANITY_WRITE_TOKEN must be set. Dry-run still reads drafts and published research to detect duplicates, and it does not write.",
    );
  }
  if (!config.projectId?.trim() || !config.dataset?.trim()) {
    throw new Error(
      "NEXT_PUBLIC_SANITY_PROJECT_ID and NEXT_PUBLIC_SANITY_DATASET must be set.",
    );
  }
}

export { PubmedUnavailableError };
