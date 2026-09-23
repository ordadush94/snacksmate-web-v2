import { groq } from "next-sanity";

export const articlesByLanguageQuery = groq`
  *[_type == "article" && language == $language && defined(slug.current) && !(_id in path("drafts.**"))] | order(publishedAt desc) {
    _id,
    title,
    "slug": slug.current,
    language,
    excerpt,
    topic,
    author,
    publishedAt,
    updatedAt,
    mainImage,
    seoTitle,
    seoDescription,
    canonicalUrl
  }
`;

export const articleByLanguageAndSlugQuery = groq`
  *[_type == "article" && language == $language && slug.current == $slug && !(_id in path("drafts.**"))][0] {
    _id,
    title,
    "slug": slug.current,
    language,
    excerpt,
    topic,
    author,
    publishedAt,
    updatedAt,
    mainImage,
    seoTitle,
    seoDescription,
    canonicalUrl,
    translationSlug,
    body,
    references[] {
      _key,
      title,
      source,
      url,
      doi,
      year
    }
  }
`;

export const publishedArticleParamsQuery = groq`
  *[_type == "article" && defined(slug.current) && defined(language) && !(_id in path("drafts.**"))] {
    "slug": slug.current,
    language
  }
`;

export const publishedArticlesSitemapQuery = groq`
  *[_type == "article" && defined(slug.current) && defined(language) && !(_id in path("drafts.**"))] {
    "slug": slug.current,
    language,
    publishedAt,
    updatedAt,
    canonicalUrl,
    translationSlug
  }
`;

export const articleTranslationQuery = groq`
  *[
    _type == "article" &&
    language == $language &&
    defined(slug.current) &&
    !(_id in path("drafts.**")) &&
    (
      slug.current == $translationSlug ||
      translationSlug == $translationSlug ||
      translationSlug == $slug
    )
  ] | order(select(
    slug.current == $translationSlug => 0,
    translationSlug == $translationSlug => 1,
    2
  ) asc)[0] {
    "slug": slug.current,
    language,
    canonicalUrl,
    translationSlug
  }
`;
