import type { SanityClient } from "@sanity/client";

import { RESEARCH_DISCOVERY_QUERIES, DEFAULT_RESEARCH_LOOKBACK_DAYS } from "../research-discovery/config";
import { createCrossrefClient, enrichFromCrossref } from "../research-discovery/crossref";
import { normalizeDoi } from "../research-discovery/normalize";
import { createPubmedClient, type PubmedRecord } from "../research-discovery/pubmed";
import { assessRelevance } from "../research-discovery/relevance";
import { createSanityWriteClient, loadResearchIdentities } from "../research-discovery/sanity";
import { rankResearchCandidates, type RankableStudy } from "./rank";

const WRITE_DISABLED =
  "Research backfill writing is not implemented. This phase is dry-run only and makes zero Sanity mutations.";

export type SanityReadClient = {
  fetch: SanityClient["fetch"];
};

export type BackfillRunConfig = {
  from: string;
  to: string;
  limit: number;
  dryRun: boolean;
  email: string;
  apiKey?: string;
  sanity?: {
    projectId: string;
    dataset: string;
    apiVersion: string;
    token: string;
  };
  sanityClient?: SanityReadClient;
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
};

export type BackfillRunResult = BackfillRanking & {
  dryRun: true;
  sanityWrites: 0;
  from: string;
  to: string;
  queries: readonly string[];
  pubmedRecordsFound: number;
  queriesTruncated: number;
  errors: number;
  currentYear: number;
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
 * Historical ranking only. Dry-run is required. This function never creates,
 * patches, deletes, or publishes Sanity documents.
 */
export async function runResearchBackfill(config: BackfillRunConfig): Promise<BackfillRunResult> {
  if (config.dryRun !== true) {
    throw new Error(WRITE_DISABLED);
  }

  const sanityClient = resolveReadClient(config);
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

  for (const record of fetched.records) {
    try {
      studies.push(await toRankableStudy(record, crossref));
    } catch (error) {
      errors += 1;
      const message = error instanceof Error ? error.message : "unknown error";
      console.error(`Record error: PMID ${record.pmid} — ${message}`);
    }
  }

  const ranking = rankResearchCandidates({
    studies,
    existing,
    limit: config.limit,
    currentYear,
  });

  return {
    ...ranking,
    dryRun: true,
    sanityWrites: 0,
    from: config.from,
    to: config.to,
    queries: RESEARCH_DISCOVERY_QUERIES,
    pubmedRecordsFound: queriesByPmid.size,
    queriesTruncated,
    errors,
    currentYear,
  };
}

async function toRankableStudy(
  record: PubmedRecord,
  crossref: ReturnType<typeof createCrossrefClient>,
): Promise<RankableStudy> {
  const decision = assessRelevance({
    title: record.title,
    abstract: record.abstract,
    abstractSections: record.abstractSections,
    publicationTypes: record.publicationTypes,
    commentCorrections: record.commentCorrections,
  });

  const doi = normalizeDoi(record.doi);
  if (decision.disposition !== "auto_draft" || !doi) {
    return studyFromRecord(record, doi, null, null);
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

  return studyFromRecord(
    { ...record, year: enriched.year ?? record.year },
    normalizeDoi(enriched.doi) ?? doi,
    citationCount,
    metadata?.citationSource ?? null,
  );
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

function resolveReadClient(config: BackfillRunConfig): SanityReadClient {
  if (config.sanityClient) return config.sanityClient;
  if (!config.sanity) {
    throw new Error(
      "Sanity configuration is required. Dry-run still reads drafts and published research, and it does not write.",
    );
  }
  return createResearchReadClient(config.sanity);
}
