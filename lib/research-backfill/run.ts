import type { SanityClient } from "@sanity/client";

import { RESEARCH_DISCOVERY_QUERIES, DEFAULT_RESEARCH_LOOKBACK_DAYS } from "../research-discovery/config";
import {
  createCrossrefClient,
  enrichFromCrossref,
  type CrossrefMetadata,
} from "../research-discovery/crossref";
import { buildResearchDraft, type ResearchDraft } from "../research-discovery/draft";
import { normalizeDoi } from "../research-discovery/normalize";
import { createPubmedClient, type PubmedRecord } from "../research-discovery/pubmed";
import { assessRelevance } from "../research-discovery/relevance";
import { createResearchDraft, createSanityWriteClient, loadResearchIdentities } from "../research-discovery/sanity";
import { mapResearchTopic } from "../research-discovery/topics";
import { MAX_BACKFILL_WRITE_LIMIT } from "./args";
import { matchExistingStudy, matchLinkedTranslation } from "./existing";
import { rankResearchCandidates, type BackfillRanking, type RankableStudy } from "./rank";
import type { BackfillCreatedDraft } from "./report";

export type SanityReadClient = {
  fetch: (query: string, params?: Record<string, unknown>) => Promise<unknown>;
};

export type SanityBackfillClient = SanityReadClient & {
  create?: (document: ResearchDraft) => Promise<unknown>;
};

export type BackfillRunConfig = {
  from: string;
  to: string;
  limit: number;
  dryRun: boolean;
  /** Separate stage after drafts exist. A failure must not delete those drafts. */
  enrich?: boolean;
  enrichAfterWrite?: (pmids: string[]) => Promise<void>;
  email: string;
  apiKey?: string;
  sanity?: {
    projectId: string;
    dataset: string;
    apiVersion: string;
    token: string;
  };
  sanityClient?: SanityBackfillClient;
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
  importedAt?: string;
};

type BackfillRunBase = BackfillRanking & {
  from: string;
  to: string;
  queries: readonly string[];
  pubmedRecordsFound: number;
  queriesTruncated: number;
  errors: number;
  currentYear: number;
  published: 0;
};

export type BackfillDryRunResult = BackfillRunBase & {
  dryRun: true;
  sanityWrites: 0;
};

export type BackfillWriteResult = BackfillRunBase & {
  dryRun: false;
  sanityWrites: number;
  requested: number;
  created: BackfillCreatedDraft[];
  skippedExistingBeforeRun: number;
  skippedExistingAtWrite: number;
  failed: number;
  rankedEligible: number;
  enrichment: "not_requested" | "completed" | "failed";
  /** Set when Sanity rejects the token. Drafts already created are kept. */
  writeAborted: boolean;
};

export type BackfillRunResult = BackfillDryRunResult | BackfillWriteResult;

type DraftSource = {
  record: PubmedRecord;
  crossref: CrossrefMetadata | null;
  crossrefStatus: "enriched" | "no-doi" | "failed";
  relevanceRules: string[];
  sourceQueries: string[];
};

export function createResearchReadClient(input: {
  projectId: string;
  dataset: string;
  apiVersion: string;
  token: string;
}): SanityReadClient {
  const client = createSanityWriteClient(input);
  return {
    fetch: client.fetch.bind(client),
  };
}

/**
 * Historical backfill. Ranking and the relevance gate match the dry-run.
 * Dry-run performs no Sanity mutations. --write creates unpublished English
 * drafts through the discovery document builder and never publishes them.
 */
export async function runResearchBackfill(config: BackfillRunConfig): Promise<BackfillRunResult> {
  if (config.dryRun !== true && config.limit > MAX_BACKFILL_WRITE_LIMIT) {
    throw new Error(
      `Refusing to write ${config.limit} drafts. The maximum is ${MAX_BACKFILL_WRITE_LIMIT}. Nothing was written or published.`,
    );
  }

  const sanityClient = resolveClient(config);
  if (config.dryRun !== true && typeof sanityClient.create !== "function") {
    throw new Error(
      "A Sanity client with create is required for --write. Nothing was written or published.",
    );
  }
  const currentYear = Number(config.to.slice(0, 4));
  const pubmed = createPubmedClient({
    email: config.email,
    apiKey: config.apiKey,
    // Date-window search does not use the recent-discovery lookback.
    lookbackDays: DEFAULT_RESEARCH_LOOKBACK_DAYS,
    fetchImpl: config.fetchImpl,
    sleep: config.sleep,
    now: config.now,
  });
  const crossref = createCrossrefClient({
    email: config.email,
    fetchImpl: config.fetchImpl,
    sleep: config.sleep,
  });

  const queriesByPmid = new Map<string, Set<string>>();
  let queriesTruncated = 0;

  for (const term of RESEARCH_DISCOVERY_QUERIES) {
    const search = await pubmed.searchPublishedBetween(term, {
      from: config.from,
      to: config.to,
    });
    if (search.truncated) queriesTruncated += 1;
    for (const id of search.ids) {
      const queries = queriesByPmid.get(id) ?? new Set<string>();
      queries.add(term);
      queriesByPmid.set(id, queries);
    }
    console.log(
      `Query: ${term} — ${search.ids.length} PMID${search.ids.length === 1 ? "" : "s"}` +
        (search.truncated ? ` (truncated from ${search.total})` : ""),
    );
  }

  const fetched = await pubmed.fetchRecords([...queriesByPmid.keys()]);
  let errors = fetched.errors.length;
  for (const error of fetched.errors) {
    console.error(`Record error: ${error.message}`);
  }

  const existing = await loadResearchIdentities(sanityClient);
  const studies: RankableStudy[] = [];
  const sources = new Map<string, DraftSource>();

  for (const record of fetched.records) {
    try {
      const prepared = await prepareStudy(record, crossref, queriesByPmid.get(record.pmid));
      studies.push(prepared.study);
      if (prepared.source) sources.set(record.pmid, prepared.source);
    } catch (error) {
      errors += 1;
      const message = error instanceof Error ? error.message : "unknown error";
      console.error(`Record error: PMID ${record.pmid} — ${message}`);
    }
  }

  // Score the full auto_draft set. The cutoff below is only the dry-run display.
  // Scoring and the relevance gate are the phase 1 functions, unchanged.
  const rankedAll = rankResearchCandidates({
    studies,
    existing,
    limit: Number.POSITIVE_INFINITY,
    currentYear,
  });
  const ranking = applyRankCutoff(rankedAll, config.limit);
  const base = {
    ...ranking,
    from: config.from,
    to: config.to,
    queries: RESEARCH_DISCOVERY_QUERIES,
    pubmedRecordsFound: queriesByPmid.size,
    queriesTruncated,
    errors,
    currentYear,
    published: 0 as const,
  };

  if (config.dryRun) {
    return {
      ...base,
      dryRun: true,
      sanityWrites: 0,
    };
  }

  const write = await writeEligibleDrafts({
    client: sanityClient,
    eligible: rankedAll.eligible,
    sources,
    limit: config.limit,
    importedAt: config.importedAt ?? new Date().toISOString(),
  });

  let enrichment: BackfillWriteResult["enrichment"] = "not_requested";
  if (config.enrich) {
    enrichment = await runEnrichmentStage(config.enrichAfterWrite, write.created);
  }

  return {
    ...base,
    dryRun: false,
    sanityWrites: write.created.length,
    requested: config.limit,
    created: write.created,
    skippedExistingBeforeRun: rankedAll.alreadyInSanity,
    skippedExistingAtWrite: write.skippedExistingAtWrite,
    failed: write.failed,
    rankedEligible: rankedAll.eligibleNew,
    enrichment,
    writeAborted: write.writeAborted,
  };
}

async function prepareStudy(
  record: PubmedRecord,
  crossref: ReturnType<typeof createCrossrefClient>,
  queries: Set<string> | undefined,
): Promise<{ study: RankableStudy; source: DraftSource | null }> {
  const decision = assessRelevance({
    title: record.title,
    abstract: record.abstract,
    abstractSections: record.abstractSections,
    publicationTypes: record.publicationTypes,
    commentCorrections: record.commentCorrections,
  });

  const doi = normalizeDoi(record.doi);
  const sourceQueries = [...(queries ?? [])];
  if (decision.disposition !== "auto_draft" || !doi) {
    const source =
      decision.disposition === "auto_draft"
        ? {
            record,
            crossref: null,
            crossrefStatus: "no-doi" as const,
            relevanceRules: decision.rules,
            sourceQueries,
          }
        : null;
    return {
      study: studyFromRecord(record, doi, null, null),
      source,
    };
  }

  const metadata = await crossref.lookup(doi);
  const enriched = enrichFromCrossref(
    {
      title: record.title,
      journal: record.journal,
      authors: record.authors,
      year: record.year,
      publishedAt: record.publishedAt,
      doi: doi ?? undefined,
    },
    metadata,
  );
  const citationCount = metadata && metadata.citationCount !== undefined ? metadata.citationCount : null;

  return {
    study: studyFromRecord(
      { ...record, year: enriched.year ?? record.year },
      normalizeDoi(enriched.doi) ?? doi,
      citationCount,
      metadata?.citationSource ?? null,
    ),
    source: {
      record,
      crossref: metadata,
      crossrefStatus: metadata ? "enriched" : "failed",
      relevanceRules: decision.rules,
      sourceQueries,
    },
  };
}

function studyFromRecord(
  record: PubmedRecord,
  doi: string | null,
  citationCount: number | null,
  citationSource: RankableStudy["citationSource"],
): RankableStudy {
  return {
    pmid: record.pmid,
    doi,
    title: record.title,
    abstract: record.abstract,
    abstractSections: record.abstractSections,
    publicationTypes: record.publicationTypes,
    commentCorrections: record.commentCorrections,
    year: record.year ?? null,
    sampleSize: record.sampleSize ?? null,
    citationCount,
    citationSource,
  };
}

/**
 * Dry-run reports the same top-N window as phase 1. Counts of every passing
 * and already-imported study stay on the full ranking.
 */
function applyRankCutoff(ranking: BackfillRanking, limit: number): BackfillRanking {
  const ranked = ranking.ranked.slice(0, limit);
  return {
    ...ranking,
    ranked,
    eligible: ranked.filter((candidate) => candidate.action === "eligible"),
    skipped: ranked.filter((candidate) => candidate.action === "skip"),
  };
}

async function writeEligibleDrafts(input: {
  client: SanityBackfillClient;
  eligible: BackfillRanking["eligible"];
  sources: Map<string, DraftSource>;
  limit: number;
  importedAt: string;
}): Promise<{
  created: BackfillCreatedDraft[];
  skippedExistingAtWrite: number;
  failed: number;
  writeAborted: boolean;
}> {
  if (typeof input.client.create !== "function") {
    throw new Error("A Sanity client with create is required for --write. Nothing was written or published.");
  }

  const created: BackfillCreatedDraft[] = [];
  let skippedExistingAtWrite = 0;
  let failed = 0;
  let writeAborted = false;

  for (const candidate of input.eligible) {
    if (created.length >= input.limit) break;
    const source = input.sources.get(candidate.pmid);
    if (!source) {
      failed += 1;
      console.error(`Draft failed: PMID ${candidate.pmid} — missing source record. Nothing was published.`);
      continue;
    }

    try {
      const draft = buildResearchDraft({
        record: source.record,
        crossref: source.crossref,
        crossrefStatus: source.crossrefStatus,
        topic: mapResearchTopic(source.record.title, source.record.abstract),
        relevanceRules: source.relevanceRules,
        sourceQueries: source.sourceQueries,
        importedAt: input.importedAt,
      });
      if (!draft) {
        failed += 1;
        console.error(`Draft failed: PMID ${candidate.pmid} — missing title or identifier. Nothing was published.`);
        continue;
      }

      const document = {
        ...draft,
        editorialStatus: "needs_review" as const,
        automationNote: withBackfillProvenance(draft.automationNote, {
          rank: candidate.rank,
          priorityScore: candidate.priorityScore,
          importedAt: input.importedAt,
        }),
      };

      // Mandatory second check. The dataset may have changed since ranking.
      const identities = await loadResearchIdentities(input.client);
      const duplicate =
        matchExistingStudy(
          { pmid: document.pmid, doi: document.doi, title: document.title },
          identities,
        ) ??
        matchLinkedTranslation(
          { draftId: document._id, slug: document.slug.current },
          identities,
        );
      if (duplicate) {
        skippedExistingAtWrite += 1;
        console.log(
          `skip_existing_at_write: PMID ${document.pmid} matches ${duplicate.matchedDocumentId}`,
        );
        continue;
      }

      const result = await createResearchDraft(input.client as SanityClient, document);
      if (result === "duplicate") {
        skippedExistingAtWrite += 1;
        console.log(`skip_existing_at_write: ${document._id} already exists`);
        continue;
      }

      created.push({
        rank: candidate.rank,
        priorityScore: candidate.priorityScore,
        title: document.title,
        pmid: document.pmid,
        doi: document.doi ?? null,
        draftId: document._id,
      });
      console.log(`Draft created: ${document._id} — ${document.title}`);
    } catch (error) {
      if (isUnauthorized(error)) {
        writeAborted = true;
        failed += 1;
        console.error(
          "Sanity authorization failed. Stopping. Drafts already created in this run were kept and nothing was published.",
        );
        break;
      }
      failed += 1;
      const message = error instanceof Error ? error.message : "unknown error";
      console.error(`Draft failed: PMID ${candidate.pmid} — ${message}. Nothing was published.`);
    }
  }

  return { created, skippedExistingAtWrite, failed, writeAborted };
}

function withBackfillProvenance(
  note: string,
  input: { rank: number; priorityScore: number; importedAt: string },
): string {
  return [
    note,
    `Historical backfill rank ${input.rank}.`,
    `Internal priority score ${input.priorityScore.toFixed(2)} orders this import and is not a measure of scientific quality.`,
    `Backfill imported at ${input.importedAt}.`,
  ].join(" ");
}

async function runEnrichmentStage(
  enrichAfterWrite: ((pmids: string[]) => Promise<void>) | undefined,
  created: readonly BackfillCreatedDraft[],
): Promise<BackfillWriteResult["enrichment"]> {
  if (created.length === 0) {
    console.log("AI enrichment skipped. No new drafts were created. Nothing was published.");
    return "completed";
  }
  if (!enrichAfterWrite) {
    console.error("AI enrichment runner was not provided. Created source drafts were kept.");
    return "failed";
  }
  try {
    await enrichAfterWrite(created.map((draft) => draft.pmid));
    console.log("AI enrichment finished. Drafts were not published.");
    return "completed";
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    console.error(`AI enrichment failed. Successfully created source drafts were kept. ${message}`);
    return "failed";
  }
}

function resolveClient(config: BackfillRunConfig): SanityBackfillClient {
  if (config.sanityClient) return config.sanityClient;
  if (!config.sanity) {
    throw new Error(
      "Sanity configuration is required. Dry-run still reads drafts and published research, and it does not write.",
    );
  }
  const client = createSanityWriteClient(config.sanity);
  if (config.dryRun) {
    return { fetch: client.fetch.bind(client) };
  }
  return {
    fetch: client.fetch.bind(client),
    create: (document) => client.create(document),
  };
}

function isUnauthorized(error: unknown): boolean {
  if (!error || typeof error !== "object" || !("statusCode" in error)) return false;
  return error.statusCode === 401 || error.statusCode === 403;
}
