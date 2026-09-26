import type { SanityClient } from "@sanity/client";

import { assertDraftDocumentId, enrichmentDraftId, type ResearchDraftSnapshot } from "./apply";

export const ELIGIBLE_DRAFTS_QUERY = `*[
  _type == "research" &&
  _id in path("drafts.**") &&
  importSource == "pubmed" &&
  defined(pmid) &&
  editorialStatus != "rejected" &&
  (
    !defined(aiEnrichmentStatus) ||
    aiEnrichmentStatus == "pending" ||
    aiEnrichmentStatus == "failed"
  )
] | order(importedAt asc) {
  _id,
  pmid,
  title,
  excerpt,
  studyDesign,
  population,
  sampleSize,
  intervention,
  duration,
  comparator,
  outcomes,
  mainFindings,
  limitations,
  practicalInterpretation,
  journal,
  doi,
  importSource,
  editorialStatus
}`;

export async function loadEligibleResearchDrafts(
  client: SanityClient,
): Promise<ResearchDraftSnapshot[]> {
  const rows = await client.fetch<unknown>(ELIGIBLE_DRAFTS_QUERY);
  const list = Array.isArray(rows) ? rows : [];
  const drafts: ResearchDraftSnapshot[] = [];

  for (const row of list) {
    const draft = toSnapshot(row);
    if (draft) drafts.push(draft);
  }

  return drafts;
}

export async function patchResearchDraft(
  client: SanityClient,
  id: string,
  fields: Record<string, unknown>,
): Promise<void> {
  assertDraftDocumentId(id);
  // Draft ids only. commit() here updates the draft and does not publish.
  await client.patch(id).set(fields).commit();
}

function toSnapshot(value: unknown): ResearchDraftSnapshot | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  if (row.importSource !== "pubmed") return null;
  if (typeof row.pmid !== "string" || typeof row._id !== "string") return null;

  let draftId: string;
  try {
    draftId = enrichmentDraftId(row.pmid);
  } catch (error) {
    const message = error instanceof Error ? error.message : "invalid draft id";
    console.warn(message);
    return null;
  }

  if (row._id !== draftId) {
    console.warn(
      `Skipping ${row._id}. Enrichment only updates ${draftId} and does not create another document.`,
    );
    return null;
  }

  return {
    _id: row._id,
    pmid: row.pmid.trim(),
    title: optionalString(row.title),
    excerpt: optionalString(row.excerpt),
    studyDesign: optionalString(row.studyDesign),
    population: optionalString(row.population),
    sampleSize: optionalNumber(row.sampleSize),
    intervention: row.intervention,
    duration: optionalString(row.duration),
    comparator: optionalString(row.comparator),
    outcomes: optionalStringArray(row.outcomes),
    mainFindings: row.mainFindings,
    limitations: row.limitations,
    practicalInterpretation: row.practicalInterpretation,
    journal: optionalString(row.journal),
    doi: optionalString(row.doi),
    editorialStatus: optionalString(row.editorialStatus),
  };
}

function optionalString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function optionalNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function optionalStringArray(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  return value.filter((item): item is string => typeof item === "string");
}
