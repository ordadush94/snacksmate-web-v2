import type { SlugIsUniqueValidator } from "@sanity/types";
import { getPublishedId } from "sanity";

/** Matches the Studio client API version used by Sanity's own slug check. */
const SLUG_VALIDATION_API_VERSION = "2025-02-19";

/**
 * A slug is unique among documents of the same type and language.
 * English and Hebrew can share a slug because public routes include the locale.
 * `sanity::versionOf` excludes the document being edited, including its draft,
 * published document, and release versions.
 */
export const localeSlugUniquenessQuery = `!defined(*[
  _type == $type &&
  language == $language &&
  slug.current == $slug &&
  !sanity::versionOf($publishedId)
][0]._id)`;

function documentLanguage(document: { language?: unknown } | undefined): string | undefined {
  const language = document?.language;
  if (typeof language !== "string") return undefined;
  const trimmed = language.trim();
  return trimmed || undefined;
}

export const isUniqueSlugForLanguage: SlugIsUniqueValidator = async (slug, context) => {
  const { document, getClient } = context;
  const type = document?._type;
  const id = document?._id;
  const language = documentLanguage(document);

  if (!slug || !type || !id || !language) return true;

  const isUnique = await getClient({ apiVersion: SLUG_VALIDATION_API_VERSION })
    .withConfig({ perspective: "raw" })
    .fetch<boolean>(
      localeSlugUniquenessQuery,
      {
        type,
        language,
        slug,
        publishedId: getPublishedId(id),
      },
      { tag: "validation.slug-is-unique-per-language" },
    );

  return isUnique === true;
};
