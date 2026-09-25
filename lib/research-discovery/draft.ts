import type { CrossrefMetadata } from "./crossref";
import { enrichFromCrossref } from "./crossref";
import {
  draftIdForDoi,
  draftIdForPmid,
  normalizeDoi,
  slugifyTitle,
} from "./normalize";
import type { PubmedRecord } from "./pubmed";
import type { ResearchTopic } from "./topics";

export type ResearchDraft = {
  _id: string;
  _type: "research";
  title: string;
  slug: { _type: "slug"; current: string };
  language: "en";
  topic: ResearchTopic;
  studyAuthors?: string[];
  journal?: string;
  year?: number;
  studyPublishedAt?: string;
  doi?: string;
  studyUrl?: string;
  pmid: string;
  importSource: "pubmed";
  importedAt: string;
  sourceQueries: string[];
  studyDesign?: PubmedRecord["studyDesign"];
  sampleSize?: number;
  automationNote: string;
};

export function buildResearchDraft(input: {
  record: PubmedRecord;
  crossref: CrossrefMetadata | null;
  crossrefStatus: "enriched" | "no-doi" | "failed";
  topic: ResearchTopic;
  relevanceRules: string[];
  sourceQueries: string[];
  importedAt: string;
}): ResearchDraft | null {
  const enriched = enrichFromCrossref(
    {
      title: input.record.title,
      journal: input.record.journal,
      authors: input.record.authors,
      year: input.record.year,
      publishedAt: input.record.publishedAt,
      doi: normalizeDoi(input.record.doi) ?? undefined,
    },
    input.crossref
      ? { ...input.crossref, doi: normalizeDoi(input.crossref.doi) ?? undefined }
      : null,
  );

  const title = enriched.title?.trim();
  if (!title) return null;

  const doi = normalizeDoi(enriched.doi) ?? undefined;
  const pmid = input.record.pmid.trim();
  const id = pmid ? draftIdForPmid(pmid) : doi ? draftIdForDoi(doi) : null;
  if (!id || !pmid) return null;

  const studyUrl = doi
    ? `https://doi.org/${doi}`
    : `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`;

  return {
    _id: id,
    _type: "research",
    title,
    slug: { _type: "slug", current: slugifyTitle(title) },
    language: "en",
    topic: input.topic,
    ...(enriched.authors.length > 0 ? { studyAuthors: enriched.authors } : {}),
    ...(enriched.journal ? { journal: enriched.journal } : {}),
    ...(enriched.year ? { year: enriched.year } : {}),
    ...(enriched.publishedAt ? { studyPublishedAt: enriched.publishedAt } : {}),
    ...(doi ? { doi } : {}),
    studyUrl,
    pmid,
    importSource: "pubmed",
    importedAt: input.importedAt,
    sourceQueries: [...input.sourceQueries].sort(),
    ...(input.record.studyDesign ? { studyDesign: input.record.studyDesign } : {}),
    ...(input.record.sampleSize ? { sampleSize: input.record.sampleSize } : {}),
    automationNote: automationNote(input.relevanceRules, input.crossrefStatus),
  };
}

function automationNote(
  relevanceRules: string[],
  crossrefStatus: "enriched" | "no-doi" | "failed",
): string {
  const crossref =
    crossrefStatus === "enriched"
      ? "Crossref was used only where PubMed metadata was missing."
      : crossrefStatus === "failed"
        ? "Crossref enrichment failed, so PubMed metadata was kept."
        : "No DOI was available for Crossref enrichment.";

  return [
    "Sanity draft created by PubMed discovery.",
    `Relevance: ${relevanceRules.join(", ") || "unspecified"}.`,
    crossref,
    "The abstract was not stored.",
    "Population, intervention, outcomes, limitations, and interpretation were left blank for editorial review.",
    "Do not publish until a human completes the summary.",
  ].join(" ");
}
