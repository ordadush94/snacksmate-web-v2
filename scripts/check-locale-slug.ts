import { createClient } from "@sanity/client";

import {
  localeSlugDocumentIds,
  localeSlugMatchFilter,
  localeSlugUniquenessQuery,
} from "../sanity/lib/uniqueSlug";

const PROJECT_ID = "8wc8eouj";
const DATASET = "production";
const API_VERSION = "2025-02-19";
const HEBREW_DRAFT_ID = "drafts.research-he-research-pubmed-42798426";

const MATCHES_QUERY = `*[${localeSlugMatchFilter}]{
  _id,
  language,
  "slug": slug.current
}`;

const DEFAULT_STUDIO_MATCHES_QUERY = `*[
  _type == $type &&
  !sanity::versionOf($publishedId) &&
  slug.current == $slug
]{
  _id,
  language,
  "slug": slug.current
}`;

type SlugRow = {
  _id: string;
  _type?: string;
  language?: string;
  slug?: string;
};

async function main() {
  const token = process.env.SANITY_WRITE_TOKEN?.trim();
  const client = createClient({
    projectId: PROJECT_ID,
    dataset: DATASET,
    apiVersion: API_VERSION,
    useCdn: false,
    perspective: "raw",
    token: token || undefined,
  });

  const draft = await client.fetch<SlugRow | null>(
    `*[_id == $id][0]{_id, _type, language, "slug": slug.current}`,
    { id: HEBREW_DRAFT_ID },
  );
  const english = await client.fetch<SlugRow | null>(
    `*[_id == "research-pubmed-42798426"][0]{_id, _type, language, "slug": slug.current}`,
  );

  const slug = draft?.slug || english?.slug;
  if (!slug) {
    throw new Error("Could not read the shared research slug from production.");
  }

  const type = draft?._type || english?._type || "research";
  const language = draft?.language || "he";
  const documentId = draft?._id || HEBREW_DRAFT_ID;
  const { publishedId, draftId } = localeSlugDocumentIds(documentId);
  const params = { type, language, slug, publishedId, draftId };

  const [matches, isUnique, defaultMatches] = await Promise.all([
    client.fetch<SlugRow[]>(MATCHES_QUERY, params),
    client.fetch<boolean>(localeSlugUniquenessQuery, params),
    client.fetch<SlugRow[]>(DEFAULT_STUDIO_MATCHES_QUERY, {
      type,
      publishedId,
      slug,
    }),
  ]);

  const report = {
    authenticated: Boolean(token),
    hebrewDraftVisible: Boolean(draft?._id),
    currentType: type,
    currentLanguage: language,
    proposedSlug: slug,
    currentPublishedId: publishedId,
    currentDraftId: draftId,
    matchingDocumentIds: matches.map((document) => document._id),
    matchingDocuments: matches,
    isUnique,
    defaultStudioMatchingDocumentIds: defaultMatches.map((document) => document._id),
    defaultStudioMatchingDocuments: defaultMatches,
    englishSource: english,
    hebrewDraft: draft,
  };

  console.log(JSON.stringify(report, null, 2));
  if (token && !draft?._id) {
    console.error("Authenticated query did not return the Hebrew draft.");
    process.exitCode = 1;
  }
  if (matches.length !== 0 || isUnique !== true) {
    console.error("Locale slug query did not treat the Hebrew draft as unique.");
    process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});
