import { translationQualityWarnings } from "./quality";
import {
  spanMap,
  translateOutcomes,
  translatePortableText,
} from "./segments";
import type {
  BibliographicReference,
  EnglishDocument,
  EnglishLink,
  HebrewDraft,
  HebrewLink,
  HebrewTranslation,
  SanityImage,
} from "./types";

const DRAFT_ID_PATTERN = /^drafts\.(article|research)-he-[A-Za-z0-9._-]+$/;

export function publishedSourceId(id: string): string {
  const trimmed = id.trim().replace(/^drafts\./, "");
  if (!trimmed) throw new Error("A Sanity document id is required.");
  return trimmed;
}

export function sharedTranslationSlug(source: Pick<EnglishLink, "slug" | "translationSlug">): string {
  const explicit = source.translationSlug?.trim();
  if (explicit) return explicit;
  const slug = source.slug.trim();
  if (!slug) throw new Error("Published English document is missing a slug.");
  return slug;
}

export function hebrewDraftId(type: "article" | "research", sourceId: string): string {
  const published = publishedSourceId(sourceId).replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
  if (!published) throw new Error("Cannot build a Hebrew draft id without a source id.");
  const id = `drafts.${type}-he-${published}`;
  assertHebrewDraftId(id);
  return id;
}

export function assertHebrewDraftId(id: string): void {
  if (!DRAFT_ID_PATTERN.test(id)) {
    throw new Error(
      `Refusing to create "${id}". Hebrew localization only creates drafts.article-he-* or drafts.research-he-* and never publishes.`,
    );
  }
}

export function readingDirection(language: string): "rtl" | "ltr" {
  return language === "he" ? "rtl" : "ltr";
}

export function matchingHebrewLink(
  source: Pick<EnglishLink, "_id" | "slug" | "translationSlug">,
  existing: readonly HebrewLink[],
): HebrewLink | null {
  const sourceId = publishedSourceId(source._id);
  const shared = sharedTranslationSlug(source);
  return (
    existing.find((link) => {
      if (link.translationSourceId?.trim() === sourceId) return true;
      if (shared && link.translationSlug?.trim() === shared) return true;
      if (source.slug && link.slug?.trim() === source.slug) return true;
      if (shared && link.slug?.trim() === shared) return true;
      return false;
    }) ?? null
  );
}

export function linkingReviewNotes(source: Pick<EnglishLink, "translationSlug">): string[] {
  if (source.translationSlug?.trim()) return [];
  return [
    "The English document has no translationSlug. The Hebrew draft uses the English slug as the shared key, which the language switch can match.",
  ];
}

export function assembleHebrewDraft(input: {
  source: EnglishDocument;
  translation: HebrewTranslation;
  model: string;
  translatedAt: string;
}): { draft: HebrewDraft; qualityWarnings: string[] } {
  if (input.translation.kind !== input.source._type) {
    throw new Error(`Refusing to apply a ${input.translation.kind} translation to ${input.source._type}.`);
  }

  const translations = translationLookup(input.translation);
  const draft = input.source._type === "research"
    ? researchDraft(input.source, input.translation, translations, input.model, input.translatedAt)
    : articleDraft(input.source, input.translation, translations, input.model, input.translatedAt);

  if (draft._id === input.source._id || publishedSourceId(draft._id) === publishedSourceId(input.source._id)) {
    throw new Error("Refusing to overwrite the English document.");
  }
  assertHebrewDraftId(draft._id);
  if ("canonicalUrl" in draft) {
    throw new Error("Refusing to set canonicalUrl. The site derives canonical URLs.");
  }

  return {
    draft,
    qualityWarnings: translationQualityWarnings({
      source: input.source,
      draft,
      translations,
    }),
  };
}

export function buildHebrewDraft(input: {
  source: EnglishDocument;
  translation: HebrewTranslation;
  model: string;
  translatedAt: string;
}): HebrewDraft {
  const { draft, qualityWarnings } = assembleHebrewDraft(input);
  const notes = unique([
    ...input.translation.reviewNotes,
    ...qualityWarnings,
    ...linkingReviewNotes(input.source),
  ]);
  if (notes.length > 0) draft.translationReviewNote = notes.join("\n");
  return draft;
}

export function formatTranslationReport(
  source: EnglishDocument,
  draft: HebrewDraft,
  refinement?: {
    triggered: boolean;
    warningsBefore: readonly string[];
    repairedFields: readonly string[];
    warningsAfter: readonly string[];
    resolvedWarnings: readonly string[];
  },
): string {
  const lines = [
    "Hebrew localization",
    `Type: ${draft._type}`,
    `Source: ${publishedSourceId(source._id)}`,
    `Draft id: ${draft._id}`,
    `Language: ${draft.language}`,
    `Direction: ${readingDirection(draft.language)}`,
    `translationSlug: ${draft.translationSlug}`,
    `translationStatus: ${draft.translationStatus}`,
    "Published: no",
    "",
  ];

  if (draft._type === "research") {
    lines.push(
      `Hebrew seoTitle (${[...draft.seoTitle].length} characters): ${draft.seoTitle}`,
      `Hebrew excerpt (${[...draft.excerpt].length} characters): ${draft.excerpt}`,
      `population: ${draft.population ?? ""}`,
      `intervention: ${plain(draft.intervention)}`,
      `duration: ${draft.duration ?? ""}`,
      `comparator: ${draft.comparator ?? ""}`,
      `outcomes: ${(draft.outcomes ?? []).join(", ")}`,
      `main findings: ${plain(draft.mainFindings)}`,
      `practical interpretation: ${plain(draft.practicalInterpretation)}`,
      `limitations: ${plain(draft.limitations)}`,
      `seoDescription (${[...draft.seoDescription].length} characters): ${draft.seoDescription}`,
      "",
      `Preserved English title: ${draft.title}`,
      `Preserved journal: ${draft.journal ?? ""}`,
      `Preserved DOI: ${draft.doi ?? ""}`,
      `Sample size: ${draft.sampleSize ?? ""}`,
    );
  } else {
    lines.push(
      `Hebrew title: ${draft.title}`,
      `Hebrew excerpt: ${draft.excerpt}`,
      `seoTitle (${[...draft.seoTitle].length} characters): ${draft.seoTitle}`,
      `seoDescription (${[...draft.seoDescription].length} characters): ${draft.seoDescription}`,
      `body: ${plain(draft.body)}`,
    );
  }

  if (refinement) {
    lines.push(
      "",
      `Refinement triggered: ${refinement.triggered ? "yes" : "no"}`,
      "Warnings before refinement:",
      ...noteLines(refinement.warningsBefore),
      `Fields repaired: ${refinement.repairedFields.join(", ") || "none"}`,
      "Warnings resolved:",
      ...noteLines(refinement.resolvedWarnings),
      "Warnings after refinement:",
      ...noteLines(refinement.warningsAfter),
    );
  }

  lines.push("", "Translation review notes:");
  if (draft.translationReviewNote?.trim()) {
    for (const note of draft.translationReviewNote.split("\n")) lines.push(`- ${note}`);
  } else {
    lines.push("- none");
  }
  return lines.join("\n");
}

function articleDraft(
  source: EnglishDocument,
  translation: HebrewTranslation,
  translations: ReadonlyMap<string, string>,
  model: string,
  translatedAt: string,
): HebrewDraft {
  if (source._type !== "article" || translation.kind !== "article") {
    throw new Error("Article draft builder received research content.");
  }
  return {
    ...identity(source, model, translatedAt),
    title: translation.title,
    excerpt: translation.excerpt,
    seoTitle: translation.seoTitle,
    seoDescription: translation.seoDescription,
    ...optionalString("topic", source.topic),
    ...optionalString("author", source.author),
    ...optionalString("publishedAt", source.publishedAt),
    ...optionalString("updatedAt", source.updatedAt),
    ...optionalImage(source.mainImage, translation.imageAlt),
    ...optionalValue("body", translatePortableText(source.body, "body", translations)),
    ...optionalReferences(source.references),
  };
}

function researchDraft(
  source: EnglishDocument,
  translation: HebrewTranslation,
  translations: ReadonlyMap<string, string>,
  model: string,
  translatedAt: string,
): HebrewDraft {
  if (source._type !== "research" || translation.kind !== "research") {
    throw new Error("Research draft builder received article content.");
  }
  return {
    ...identity(source, model, translatedAt),
    title: source.title,
    excerpt: translation.excerpt,
    seoTitle: translation.seoTitle,
    seoDescription: translation.seoDescription,
    editorialStatus: "needs_review",
    ...optionalString("topic", source.topic),
    ...optionalString("summaryAuthor", source.summaryAuthor),
    ...optionalString("publishedAt", source.publishedAt),
    ...optionalString("updatedAt", source.updatedAt),
    ...optionalImage(source.mainImage, translation.imageAlt),
    ...optionalStringArray("studyAuthors", source.studyAuthors),
    ...optionalString("journal", source.journal),
    ...optionalNumber("year", source.year),
    ...optionalString("studyPublishedAt", source.studyPublishedAt),
    ...optionalString("doi", source.doi),
    ...optionalString("studyUrl", source.studyUrl),
    ...optionalString("pmid", source.pmid),
    ...optionalString("studyDesign", source.studyDesign),
    ...optionalString("population", translation.population),
    ...optionalNumber("sampleSize", source.sampleSize),
    ...optionalValue("intervention", translatePortableText(source.intervention, "intervention", translations)),
    ...optionalString("duration", translation.duration),
    ...optionalString("comparator", translation.comparator),
    ...optionalStringArray("outcomes", translateOutcomes(source.outcomes, translations)),
    ...optionalValue("mainFindings", translatePortableText(source.mainFindings, "mainFindings", translations)),
    ...optionalValue(
      "practicalInterpretation",
      translatePortableText(source.practicalInterpretation, "practicalInterpretation", translations),
    ),
    ...optionalValue("limitations", translatePortableText(source.limitations, "limitations", translations)),
    ...optionalValue(
      "snacksmateRelevance",
      translatePortableText(source.snacksmateRelevance, "snacksmateRelevance", translations),
    ),
    ...optionalReferences(source.references),
  };
}

function identity(source: EnglishDocument, model: string, translatedAt: string): Pick<
  HebrewDraft,
  | "_id"
  | "_type"
  | "language"
  | "slug"
  | "translationSlug"
  | "translationSourceId"
  | "translatedAt"
  | "translationModel"
  | "translationStatus"
> {
  return {
    _id: hebrewDraftId(source._type, source._id),
    _type: source._type,
    language: "he",
    slug: { _type: "slug", current: source.slug },
    translationSlug: sharedTranslationSlug(source),
    translationSourceId: publishedSourceId(source._id),
    translatedAt,
    translationModel: model,
    translationStatus: "needs_review",
  };
}

function translationLookup(translation: HebrewTranslation): Map<string, string> {
  if (translation.kind === "article") {
    return spanMap([
      { id: "title", text: translation.title },
      { id: "excerpt", text: translation.excerpt },
      { id: "seoTitle", text: translation.seoTitle },
      { id: "seoDescription", text: translation.seoDescription },
      ...translation.body,
    ]);
  }
  return spanMap([
    { id: "excerpt", text: translation.excerpt },
    { id: "seoTitle", text: translation.seoTitle },
    { id: "seoDescription", text: translation.seoDescription },
    ...(translation.population ? [{ id: "population", text: translation.population }] : []),
    ...(translation.duration ? [{ id: "duration", text: translation.duration }] : []),
    ...(translation.comparator ? [{ id: "comparator", text: translation.comparator }] : []),
    ...translation.outcomes,
    ...translation.intervention,
    ...translation.mainFindings,
    ...translation.practicalInterpretation,
    ...translation.limitations,
    ...translation.snacksmateRelevance,
  ]);
}

function optionalString(key: string, value: string | null | undefined): Record<string, string> {
  const text = value?.trim();
  return text ? { [key]: text } : {};
}

function optionalNumber(key: string, value: number | null | undefined): Record<string, number> {
  return typeof value === "number" && Number.isFinite(value) ? { [key]: value } : {};
}

function optionalStringArray(
  key: string,
  value: readonly string[] | null | undefined,
): Record<string, string[]> {
  if (!value?.length) return {};
  return { [key]: [...value] };
}

function optionalValue(key: string, value: unknown): Record<string, unknown> {
  if (value == null) return {};
  if (Array.isArray(value) && value.length === 0) return {};
  return { [key]: value };
}

function optionalImage(
  image: SanityImage | null | undefined,
  alt: string | null,
): Record<string, SanityImage> {
  if (!image) return {};
  const copy = structuredClone(image);
  if (alt) copy.alt = alt;
  return { mainImage: copy };
}

function optionalReferences(
  references: readonly BibliographicReference[] | null | undefined,
): Record<string, BibliographicReference[]> {
  if (!references?.length) return {};
  return { references: structuredClone(references) as BibliographicReference[] };
}

function plain(value: unknown): string {
  if (typeof value === "string") return value;
  if (!Array.isArray(value)) return "";
  return value
    .flatMap((block) => {
      if (!block || typeof block !== "object" || !("children" in block)) return [];
      const children = block.children;
      if (!Array.isArray(children)) return [];
      return children.map((child) =>
        child && typeof child === "object" && "text" in child && typeof child.text === "string"
          ? child.text
          : "",
      );
    })
    .join("");
}

function noteLines(notes: readonly string[]): string[] {
  if (notes.length === 0) return ["- none"];
  return notes.map((note) => `- ${note}`);
}

function unique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}
