export const TRANSLATION_CONTENT_TYPES = ["article", "research"] as const;
export type TranslationContentType = (typeof TRANSLATION_CONTENT_TYPES)[number];

export type SanityImage = {
  _type?: string;
  alt?: string;
  asset?: { _ref?: string; _type?: string };
  hotspot?: unknown;
  crop?: unknown;
};

export type BibliographicReference = {
  _key?: string;
  _type?: string;
  title?: string | null;
  source?: string | null;
  url?: string | null;
  doi?: string | null;
  year?: number | null;
};

export type EnglishLink = {
  _id: string;
  _type: TranslationContentType;
  slug: string;
  translationSlug?: string | null;
};

export type EnglishArticle = EnglishLink & {
  _type: "article";
  language: "en";
  title: string;
  excerpt: string;
  body?: unknown;
  topic?: string | null;
  author?: string | null;
  publishedAt?: string | null;
  updatedAt?: string | null;
  mainImage?: SanityImage | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
  references?: BibliographicReference[] | null;
};

export type EnglishResearch = EnglishLink & {
  _type: "research";
  language: "en";
  title: string;
  excerpt: string;
  topic?: string | null;
  summaryAuthor?: string | null;
  publishedAt?: string | null;
  updatedAt?: string | null;
  mainImage?: SanityImage | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
  studyAuthors?: string[] | null;
  journal?: string | null;
  year?: number | null;
  studyPublishedAt?: string | null;
  doi?: string | null;
  studyUrl?: string | null;
  pmid?: string | null;
  studyDesign?: string | null;
  population?: string | null;
  sampleSize?: number | null;
  intervention?: unknown;
  duration?: string | null;
  comparator?: string | null;
  outcomes?: string[] | null;
  mainFindings?: unknown;
  practicalInterpretation?: unknown;
  limitations?: unknown;
  snacksmateRelevance?: unknown;
  references?: BibliographicReference[] | null;
  editorialStatus?: string | null;
};

export type EnglishDocument = EnglishArticle | EnglishResearch;

export type SpanTranslation = {
  id: string;
  text: string;
};

export type ArticleTranslation = {
  kind: "article";
  title: string;
  excerpt: string;
  seoTitle: string;
  seoDescription: string;
  body: SpanTranslation[];
  imageAlt: string | null;
  reviewNotes: string[];
};

export type ResearchTranslation = {
  kind: "research";
  excerpt: string;
  seoTitle: string;
  seoDescription: string;
  population: string | null;
  duration: string | null;
  comparator: string | null;
  outcomes: SpanTranslation[];
  intervention: SpanTranslation[];
  mainFindings: SpanTranslation[];
  practicalInterpretation: SpanTranslation[];
  limitations: SpanTranslation[];
  snacksmateRelevance: SpanTranslation[];
  imageAlt: string | null;
  reviewNotes: string[];
};

export type HebrewTranslation = ArticleTranslation | ResearchTranslation;

export type HebrewLink = {
  _id: string;
  translationSourceId?: string | null;
  translationSlug?: string | null;
  slug?: string | null;
};

export type HebrewDraft = {
  _id: string;
  _type: TranslationContentType;
  language: "he";
  title: string;
  slug: { _type: "slug"; current: string };
  translationSlug: string;
  translationSourceId: string;
  translatedAt: string;
  translationModel: string;
  translationStatus: "needs_review";
  translationReviewNote?: string;
  excerpt: string;
  seoTitle: string;
  seoDescription: string;
  publishedAt?: string;
  updatedAt?: string;
  topic?: string;
  author?: string;
  summaryAuthor?: string;
  mainImage?: SanityImage;
  body?: unknown;
  references?: BibliographicReference[];
  editorialStatus?: "needs_review";
  studyAuthors?: string[];
  journal?: string;
  year?: number;
  studyPublishedAt?: string;
  doi?: string;
  studyUrl?: string;
  pmid?: string;
  studyDesign?: string;
  population?: string;
  sampleSize?: number;
  intervention?: unknown;
  duration?: string;
  comparator?: string;
  outcomes?: string[];
  mainFindings?: unknown;
  practicalInterpretation?: unknown;
  limitations?: unknown;
  snacksmateRelevance?: unknown;
};
