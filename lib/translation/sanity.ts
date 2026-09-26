import type { SanityClient } from "@sanity/client";

import { assertHebrewDraftId, publishedSourceId } from "./document";
import type {
  BibliographicReference,
  EnglishDocument,
  EnglishLink,
  HebrewDraft,
  HebrewLink,
  SanityImage,
  TranslationContentType,
} from "./types";

const DOCUMENT_FIELDS = `{
  _id,
  _type,
  title,
  "slug": slug.current,
  language,
  excerpt,
  body,
  topic,
  author,
  summaryAuthor,
  publishedAt,
  updatedAt,
  mainImage,
  seoTitle,
  seoDescription,
  translationSlug,
  studyAuthors,
  journal,
  year,
  studyPublishedAt,
  doi,
  studyUrl,
  pmid,
  studyDesign,
  population,
  sampleSize,
  intervention,
  duration,
  comparator,
  outcomes,
  mainFindings,
  practicalInterpretation,
  limitations,
  snacksmateRelevance,
  references,
  editorialStatus
}`;

export const PUBLISHED_ENGLISH_BY_ID_QUERY = `*[
  _type == $type &&
  _id == $id &&
  !(_id in path("drafts.**"))
][0] ${DOCUMENT_FIELDS}`;

export const PUBLISHED_ENGLISH_INDEX_QUERY = `*[
  _type == $type &&
  language == "en" &&
  !(_id in path("drafts.**")) &&
  defined(slug.current) &&
  editorialStatus != "rejected" &&
  ($type != "research" || defined(publishedAt))
] | order(publishedAt desc) {
  _id,
  _type,
  "slug": slug.current,
  translationSlug
}`;

export const DRAFT_EXISTS_QUERY = `*[
  _type == $type &&
  _id == $id
][0]{ _id, language }`;

export const HEBREW_LINKS_QUERY = `*[
  _type == $type &&
  language == "he"
]{
  _id,
  translationSourceId,
  translationSlug,
  "slug": slug.current
}`;

export async function loadPublishedEnglishDocument(
  client: SanityClient,
  type: TranslationContentType,
  id: string,
): Promise<EnglishDocument> {
  const publishedId = publishedSourceId(id);
  const row = await client.fetch<unknown>(PUBLISHED_ENGLISH_BY_ID_QUERY, {
    type,
    id: publishedId,
  });
  if (row) return normalizeEnglishDocument(row, type);

  const draft = await client.fetch<unknown>(DRAFT_EXISTS_QUERY, {
    type,
    id: `drafts.${publishedId}`,
  });
  if (isRecord(draft) && typeof draft._id === "string") {
    throw new Error(
      `Refusing to translate unpublished draft ${draft._id}. Hebrew localization starts from a published English document.`,
    );
  }
  throw new Error(`No published ${type} document found for id ${publishedId}.`);
}

export async function loadPublishedEnglishIndex(
  client: SanityClient,
  type: TranslationContentType,
): Promise<EnglishLink[]> {
  const rows = await client.fetch<unknown>(PUBLISHED_ENGLISH_INDEX_QUERY, { type });
  if (!Array.isArray(rows)) return [];
  return rows.flatMap((row) => {
    const link = normalizeLink(row, type);
    return link ? [link] : [];
  });
}

export async function loadEnglishDocumentsByIds(
  client: SanityClient,
  type: TranslationContentType,
  ids: readonly string[],
): Promise<EnglishDocument[]> {
  const documents: EnglishDocument[] = [];
  for (const id of ids) {
    documents.push(await loadPublishedEnglishDocument(client, type, id));
  }
  return documents;
}

export async function loadHebrewLinks(
  client: SanityClient,
  type: TranslationContentType,
): Promise<HebrewLink[]> {
  const rows = await client.fetch<unknown>(HEBREW_LINKS_QUERY, { type });
  if (!Array.isArray(rows)) return [];
  return rows.flatMap((row) => {
    if (!isRecord(row) || typeof row._id !== "string") return [];
    return [
      {
        _id: row._id,
        translationSourceId: optionalString(row.translationSourceId),
        translationSlug: optionalString(row.translationSlug),
        slug: optionalString(row.slug),
      },
    ];
  });
}

export async function createHebrewDraft(client: SanityClient, draft: HebrewDraft): Promise<void> {
  assertHebrewDraftId(draft._id);
  if (draft.language !== "he") {
    throw new Error("Hebrew localization only creates language=he documents.");
  }
  if (draft.translationStatus !== "needs_review") {
    throw new Error("New Hebrew translations must stay needs_review until a person reviews them.");
  }
  // A drafts.* id stays unpublished. This client never calls publish.
  await client.create(draft);
}

function normalizeEnglishDocument(value: unknown, type: TranslationContentType): EnglishDocument {
  if (!isRecord(value)) throw new Error("Sanity returned an unreadable document.");
  if (value._type !== type) {
    throw new Error(`Document ${String(value._id)} is not a ${type}.`);
  }
  if (value.language !== "en") {
    throw new Error(
      `Refusing to translate ${String(value._id)}. Only published English documents are localized.`,
    );
  }
  const editorialStatus = optionalString(value.editorialStatus);
  if (type === "research" && editorialStatus === "rejected") {
    throw new Error(`Refusing to translate rejected research document ${String(value._id)}.`);
  }
  if (type === "research" && !optionalString(value.publishedAt)) {
    throw new Error(`Refusing to translate research ${String(value._id)} without a published date.`);
  }

  const base = {
    _id: requiredString(value._id, "_id"),
    language: "en" as const,
    title: requiredString(value.title, "title"),
    slug: requiredString(value.slug, "slug"),
    excerpt: requiredString(value.excerpt, "excerpt"),
    translationSlug: optionalString(value.translationSlug),
    topic: optionalString(value.topic),
    publishedAt: optionalString(value.publishedAt),
    updatedAt: optionalString(value.updatedAt),
    seoTitle: optionalString(value.seoTitle),
    seoDescription: optionalString(value.seoDescription),
    mainImage: normalizeImage(value.mainImage),
    references: normalizeReferences(value.references),
  };

  if (type === "article") {
    return {
      ...base,
      _type: "article",
      body: value.body,
      author: optionalString(value.author),
    };
  }

  return {
    ...base,
    _type: "research",
    summaryAuthor: optionalString(value.summaryAuthor),
    studyAuthors: optionalStringArray(value.studyAuthors),
    journal: optionalString(value.journal),
    year: optionalNumber(value.year),
    studyPublishedAt: optionalString(value.studyPublishedAt),
    doi: optionalString(value.doi),
    studyUrl: optionalString(value.studyUrl),
    pmid: optionalString(value.pmid),
    studyDesign: optionalString(value.studyDesign),
    population: optionalString(value.population),
    sampleSize: optionalNumber(value.sampleSize),
    intervention: value.intervention,
    duration: optionalString(value.duration),
    comparator: optionalString(value.comparator),
    outcomes: optionalStringArray(value.outcomes),
    mainFindings: value.mainFindings,
    practicalInterpretation: value.practicalInterpretation,
    limitations: value.limitations,
    snacksmateRelevance: value.snacksmateRelevance,
    editorialStatus,
  };
}

function normalizeLink(value: unknown, type: TranslationContentType): EnglishLink | null {
  if (!isRecord(value) || typeof value._id !== "string") return null;
  const slug = optionalString(value.slug);
  if (!slug) return null;
  return {
    _id: value._id,
    _type: type,
    slug,
    translationSlug: optionalString(value.translationSlug),
  };
}

function normalizeImage(value: unknown): SanityImage | null {
  if (!isRecord(value)) return null;
  return value as SanityImage;
}

function normalizeReferences(value: unknown): BibliographicReference[] | null {
  if (!Array.isArray(value)) return null;
  return value.flatMap((item) => {
    if (!isRecord(item)) return [];
    return [
      {
        ...(typeof item._key === "string" ? { _key: item._key } : {}),
        ...(typeof item._type === "string" ? { _type: item._type } : {}),
        title: optionalString(item.title),
        source: optionalString(item.source),
        url: optionalString(item.url),
        doi: optionalString(item.doi),
        year: optionalNumber(item.year),
      },
    ];
  });
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`Published English document is missing ${field}.`);
  }
  return value;
}

function optionalString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function optionalNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function optionalStringArray(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  const items = value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
  return items.length > 0 ? items : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
