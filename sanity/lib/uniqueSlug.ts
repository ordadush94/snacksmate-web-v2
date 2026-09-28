import type { SanityDocument, SlugIsUniqueValidator } from "@sanity/types";

/** Matches the Studio client API version used by Sanity's own slug check. */
const SLUG_VALIDATION_API_VERSION = "2025-02-19";

/**
 * A slug is unique among documents of the same type and language.
 * English and Hebrew can share a slug because public routes include the locale.
 * The current document is excluded in both its published id and drafts.* id.
 *
 * Studio calls this callback instead of the default per-type slug check.
 * Do not add a second slug uniqueness rule on the field.
 */
export const localeSlugMatchFilter = `_type == $type &&
  language == $language &&
  slug.current == $slug &&
  !(_id in [$publishedId, $draftId])`;

export const localeSlugUniquenessQuery = `count(*[${localeSlugMatchFilter}]) == 0`;

export function localeSlugDocumentIds(documentId: string): {
  publishedId: string;
  draftId: string;
} {
  const publishedId = documentId.replace(/^drafts\./, "");
  return {
    publishedId,
    draftId: `drafts.${publishedId}`,
  };
}

function documentLanguage(document: SanityDocument | undefined): string | undefined {
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

  const { publishedId, draftId } = localeSlugDocumentIds(id);
  const isUnique = await getClient({ apiVersion: SLUG_VALIDATION_API_VERSION })
    .withConfig({ perspective: "raw" })
    .fetch<boolean>(
      localeSlugUniquenessQuery,
      {
        type,
        language,
        slug,
        publishedId,
        draftId,
      },
      { tag: "validation.slug-is-unique-per-language" },
    );

  return isUnique === true;
};
