import { RESEARCH_DISCOVERY_QUERIES } from "./config";
import { createCrossrefClient } from "./crossref";
import { buildResearchDraft } from "./draft";
import { normalizeDoi } from "./normalize";
import { createPubmedClient, PubmedUnavailableError, type PubmedRecord } from "./pubmed";
import { assessRelevance } from "./relevance";
import {
  createResearchDraft,
  createSanityWriteClient,
  duplicateOf,
  loadResearchIdentities,
} from "./sanity";
import type { ResearchIdentity } from "./dedupe";
import { mapResearchTopic } from "./topics";

export type DiscoverySummary = {
  dryRun: boolean;
  lookbackDays: number;
  queriesRun: number;
  pubmedRecordsFound: number;
  duplicatesSkipped: number;
  rejectedAsIrrelevant: number;
  draftsCreated: number;
  errors: number;
};

export type DiscoveryConfig = {
  dryRun: boolean;
  lookbackDays: number;
  email: string;
  apiKey?: string;
  sanity: {
    projectId: string;
    dataset: string;
    apiVersion: string;
    token: string;
  };
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
    rejectedAsIrrelevant: 0,
    draftsCreated: 0,
    errors: 0,
  };

  const pubmed = createPubmedClient({
    email: config.email,
    apiKey: config.apiKey,
    lookbackDays: config.lookbackDays,
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

  const sanity = createSanityWriteClient(config.sanity);
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
  sanity: ReturnType<typeof createSanityWriteClient>;
  summary: DiscoverySummary;
}) {
  const relevance = assessRelevance(input.record.title, input.record.abstract);
  console.log(`PMID ${input.record.pmid}: ${relevance.reason}`);
  if (!relevance.accept) {
    input.summary.rejectedAsIrrelevant += 1;
    return;
  }

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

  const duplicate = duplicateOf(draft, input.existing);
  if (duplicate) {
    input.summary.duplicatesSkipped += 1;
    console.log(
      `Duplicate skipped: PMID ${draft.pmid} matches ${duplicate.id} by ${duplicate.reason}`,
    );
    return;
  }

  if (input.dryRun) {
    input.summary.draftsCreated += 1;
    console.log(
      `Would create ${draft._id} — ${draft.title} [${draft.topic}]`,
    );
    input.existing.push(identityFromDraft(draft));
    return;
  }

  const result = await createResearchDraft(input.sanity, draft);
  if (result === "duplicate") {
    input.summary.duplicatesSkipped += 1;
    console.log(`Duplicate skipped: ${draft._id} already exists`);
    return;
  }

  input.summary.draftsCreated += 1;
  console.log(`Draft created: ${draft._id} — ${draft.title}`);
  input.existing.push(identityFromDraft(draft));
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
  console.log(`  PubMed records found: ${summary.pubmedRecordsFound}`);
  console.log(`  Duplicates skipped: ${summary.duplicatesSkipped}`);
  console.log(`  Rejected as irrelevant: ${summary.rejectedAsIrrelevant}`);
  console.log(
    `  ${summary.dryRun ? "Drafts that would be created" : "New drafts created"}: ${summary.draftsCreated}`,
  );
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
