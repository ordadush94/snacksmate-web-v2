import { portableTextSpans, researchSourceSpans } from "./segments";
import type {
  ArticleTranslation,
  EnglishDocument,
  HebrewTranslation,
  ResearchTranslation,
  SpanTranslation,
} from "./types";

export class TranslationValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TranslationValidationError";
  }
}

const HEBREW_LETTER = /[\u0590-\u05FF]/;
const EMPTY_NOTE = /^(none|no issues|n\/a|אין|אין הערות)\.?$/i;

const spanItemSchema = {
  type: "object",
  additionalProperties: false,
  required: ["id", "text"],
  properties: {
    id: { type: "string" },
    text: {
      type: "string",
      description: "Hebrew for this span only. Preserve leading and trailing spaces.",
    },
  },
} as const;

function spanArraySchema(description: string) {
  return {
    type: "array",
    description,
    items: spanItemSchema,
  };
}

export const ARTICLE_TRANSLATION_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["title", "excerpt", "seoTitle", "seoDescription", "body", "imageAlt", "reviewNotes"],
  properties: {
    title: {
      type: "string",
      description:
        "Natural Hebrew article title. Do not mirror the English sentence when Hebrew syntax would differ.",
    },
    excerpt: {
      type: "string",
      description: "Hebrew excerpt of about 160 to 300 characters. Preserve facts and uncertainty.",
    },
    seoTitle: {
      type: "string",
      description:
        "Natural Hebrew search title of about 45 to 60 characters. Do not translate the English SEO title literally and do not stuff keywords.",
    },
    seoDescription: {
      type: "string",
      description:
        "Natural Hebrew search description of about 140 to 160 characters. No clickbait and no keyword stuffing.",
    },
    body: spanArraySchema(
      "One item for every source body span id. Translate reader-facing words. Keep paper titles, journals, author names, DOIs, and URLs exactly as written.",
    ),
    imageAlt: {
      type: "string",
      description: "Hebrew image alt text, or an empty string when the source has no alt text.",
    },
    reviewNotes: {
      type: "array",
      items: { type: "string" },
      description:
        "Internal notes for a human editor. Empty array when the localization is straightforward.",
    },
  },
} as const;

export const RESEARCH_TRANSLATION_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "excerpt",
    "seoTitle",
    "seoDescription",
    "population",
    "duration",
    "comparator",
    "outcomes",
    "intervention",
    "mainFindings",
    "practicalInterpretation",
    "limitations",
    "snacksmateRelevance",
    "imageAlt",
    "reviewNotes",
  ],
  properties: {
    excerpt: {
      type: "string",
      description: "Hebrew summary of about 160 to 300 characters. Do not strengthen the finding.",
    },
    seoTitle: {
      type: "string",
      description:
        "Reader-facing Hebrew title of about 45 to 60 characters for a general audience. This is not the scientific paper title. Do not overstate the finding.",
    },
    seoDescription: {
      type: "string",
      description:
        "Hebrew search description of about 140 to 160 characters. Include נשנושי כושר only when it fits naturally.",
    },
    population: {
      type: "string",
      description: "Hebrew population. Empty string when the English population is empty.",
    },
    duration: {
      type: "string",
      description: "Hebrew duration. Keep every number. Empty string when the English duration is empty.",
    },
    comparator: {
      type: "string",
      description: "Hebrew comparator. Empty string when the English comparator is empty.",
    },
    outcomes: spanArraySchema(
      "Hebrew outcome names in the same ids as the source. Keep acronyms from the glossary.",
    ),
    intervention: spanArraySchema("Hebrew intervention spans. Keep protocol numbers and units."),
    mainFindings: spanArraySchema(
      "Hebrew findings. Preserve direction, significance, and association versus causation.",
    ),
    practicalInterpretation: spanArraySchema(
      "Cautious Hebrew interpretation. Not health advice and not a claim that Snacksmate was tested.",
    ),
    limitations: spanArraySchema(
      "Hebrew limitations without an editorial label prefix. Preserve uncertainty.",
    ),
    snacksmateRelevance: spanArraySchema(
      "Hebrew Snacksmate relevance spans. Empty array when the source field is empty.",
    ),
    imageAlt: {
      type: "string",
      description: "Hebrew image alt text, or an empty string when the source has no alt text.",
    },
    reviewNotes: {
      type: "array",
      items: { type: "string" },
      description:
        "Internal notes only when a person should look: unclear Hebrew terminology, ambiguous English, an acronym, a phrase left in English, or a scientific nuance that may have been lost. Empty array when straightforward.",
    },
  },
} as const;

const RESEARCH_REPAIR_FIELDS = [
  "excerpt",
  "seoTitle",
  "seoDescription",
  "population",
  "duration",
  "comparator",
  "outcomes",
  "intervention",
  "mainFindings",
  "practicalInterpretation",
  "limitations",
  "snacksmateRelevance",
  "imageAlt",
] as const;

const ARTICLE_REPAIR_FIELDS = ["title", "excerpt", "seoTitle", "seoDescription", "body", "imageAlt"] as const;

export function repairJsonSchema(
  source: EnglishDocument,
  fields: readonly string[],
): Record<string, unknown> {
  const repairable = new Set<string>(
    source._type === "article" ? ARTICLE_REPAIR_FIELDS : RESEARCH_REPAIR_FIELDS,
  );
  const properties: Record<string, unknown> = {};
  const schema = source._type === "article" ? ARTICLE_TRANSLATION_JSON_SCHEMA : RESEARCH_TRANSLATION_JSON_SCHEMA;
  const sourceProperties = schema.properties as Record<string, unknown>;
  for (const field of fields) {
    if (!repairable.has(field) || !sourceProperties[field]) {
      throw new TranslationValidationError(`Refusing to repair immutable or unknown field ${field}.`);
    }
    properties[field] = sourceProperties[field];
  }
  return {
    type: "object",
    additionalProperties: false,
    required: [...fields],
    properties,
  };
}

export function parseFieldRepair(
  source: EnglishDocument,
  fields: readonly string[],
  input: unknown,
): Partial<HebrewTranslation> {
  const record = parseJson(input);
  const unexpected = Object.keys(record).filter((key) => !fields.includes(key));
  if (unexpected.length > 0) {
    throw new TranslationValidationError(
      `Repair returned fields that were not requested: ${unexpected.join(", ")}.`,
    );
  }
  for (const field of fields) {
    if (!(field in record)) {
      throw new TranslationValidationError(`Repair omitted ${field}.`);
    }
  }
  const repaired: Record<string, unknown> = {};
  for (const field of fields) {
    repaired[field] = parseRepairField(source, field, record[field]);
  }
  return repaired as Partial<HebrewTranslation>;
}

function parseRepairField(source: EnglishDocument, field: string, value: unknown): unknown {
  if (source._type === "article") {
    if (field === "title" || field === "excerpt" || field === "seoTitle" || field === "seoDescription") {
      return requiredHebrewString(value, field);
    }
    if (field === "body") {
      return parseSpans(value, "body", portableTextSpans(source.body, "body").map((span) => span.id));
    }
    if (field === "imageAlt") return parseImageAlt(value, source);
  }
  if (source._type === "research") {
    if (field === "excerpt" || field === "seoDescription") return requiredHebrewString(value, field);
    if (field === "seoTitle") {
      const seoTitle = requiredHebrewString(value, field);
      if (seoTitle.trim() === source.title.trim()) {
        throw new TranslationValidationError(
          "seoTitle repeated the English scientific title. Write a Hebrew reader-facing title instead.",
        );
      }
      return seoTitle;
    }
    if (field === "population") return optionalLocalizedString(value, field, source.population);
    if (field === "duration") return optionalLocalizedString(value, field, source.duration);
    if (field === "comparator") return optionalLocalizedString(value, field, source.comparator);
    if (field === "imageAlt") return parseImageAlt(value, source);
    const spanFields = [
      "outcomes",
      "intervention",
      "mainFindings",
      "practicalInterpretation",
      "limitations",
      "snacksmateRelevance",
    ] as const;
    if ((spanFields as readonly string[]).includes(field)) {
      const spans = researchSourceSpans(source).filter((span) => span.field === field);
      return parseSpans(value, field, spans.map((span) => span.id));
    }
  }
  throw new TranslationValidationError(`Refusing to repair immutable or unknown field ${field}.`);
}

export function parseTranslation(source: EnglishDocument, input: unknown): ArticleTranslation | ResearchTranslation {
  const value = parseJson(input);
  if (source._type === "article") return parseArticleTranslation(source, value);
  return parseResearchTranslation(source, value);
}

function parseArticleTranslation(source: EnglishDocument, record: Record<string, unknown>): ArticleTranslation {
  if (source._type !== "article") {
    throw new TranslationValidationError("Article parser received a research document.");
  }
  const title = requiredHebrewString(record.title, "title");
  const excerpt = requiredHebrewString(record.excerpt, "excerpt");
  const seoTitle = requiredHebrewString(record.seoTitle, "seoTitle");
  const seoDescription = requiredHebrewString(record.seoDescription, "seoDescription");
  const body = parseSpans(record.body, "body", portableTextSpans(source.body, "body").map((span) => span.id));
  return {
    kind: "article",
    title,
    excerpt,
    seoTitle,
    seoDescription,
    body,
    imageAlt: parseImageAlt(record.imageAlt, source),
    reviewNotes: parseReviewNotes(record.reviewNotes),
  };
}

function parseResearchTranslation(
  source: EnglishDocument,
  record: Record<string, unknown>,
): ResearchTranslation {
  if (source._type !== "research") {
    throw new TranslationValidationError("Research parser received an article document.");
  }
  const seoTitle = requiredHebrewString(record.seoTitle, "seoTitle");
  if (seoTitle.trim() === source.title.trim()) {
    throw new TranslationValidationError(
      "seoTitle repeated the English scientific title. Write a Hebrew reader-facing title instead.",
    );
  }
  const spans = researchSourceSpans(source);
  const ids = (field: string) => spans.filter((span) => span.field === field).map((span) => span.id);

  return {
    kind: "research",
    excerpt: requiredHebrewString(record.excerpt, "excerpt"),
    seoTitle,
    seoDescription: requiredHebrewString(record.seoDescription, "seoDescription"),
    population: optionalLocalizedString(record.population, "population", source.population),
    duration: optionalLocalizedString(record.duration, "duration", source.duration),
    comparator: optionalLocalizedString(record.comparator, "comparator", source.comparator),
    outcomes: parseSpans(record.outcomes, "outcomes", ids("outcomes")),
    intervention: parseSpans(record.intervention, "intervention", ids("intervention")),
    mainFindings: parseSpans(record.mainFindings, "mainFindings", ids("mainFindings")),
    practicalInterpretation: parseSpans(
      record.practicalInterpretation,
      "practicalInterpretation",
      ids("practicalInterpretation"),
    ),
    limitations: parseSpans(record.limitations, "limitations", ids("limitations")),
    snacksmateRelevance: parseSpans(
      record.snacksmateRelevance,
      "snacksmateRelevance",
      ids("snacksmateRelevance"),
    ),
    imageAlt: parseImageAlt(record.imageAlt, source),
    reviewNotes: parseReviewNotes(record.reviewNotes),
  };
}

function parseJson(input: unknown): Record<string, unknown> {
  let value = input;
  if (typeof input === "string") {
    try {
      value = JSON.parse(input) as unknown;
    } catch {
      throw new TranslationValidationError("AI response was not valid JSON.");
    }
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TranslationValidationError("AI response must be a JSON object.");
  }
  return value as Record<string, unknown>;
}

function parseSpans(value: unknown, field: string, expectedIds: readonly string[]): SpanTranslation[] {
  if (!Array.isArray(value)) {
    throw new TranslationValidationError(`${field} must be an array.`);
  }
  const seen = new Set<string>();
  const parsed: SpanTranslation[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      throw new TranslationValidationError(`${field} items must be objects with id and text.`);
    }
    const record = item as Record<string, unknown>;
    if (typeof record.id !== "string" || typeof record.text !== "string") {
      throw new TranslationValidationError(`${field} items must have string id and text.`);
    }
    if (!record.text.trim()) {
      throw new TranslationValidationError(`${field} span ${record.id} is empty.`);
    }
    if (seen.has(record.id)) {
      throw new TranslationValidationError(`${field} repeats span ${record.id}.`);
    }
    seen.add(record.id);
    parsed.push({ id: record.id, text: record.text });
  }

  for (const id of expectedIds) {
    if (!seen.has(id)) {
      throw new TranslationValidationError(`${field} is missing span ${id}.`);
    }
  }
  for (const id of seen) {
    if (!expectedIds.includes(id)) {
      throw new TranslationValidationError(`${field} returned unknown span ${id}.`);
    }
  }
  return parsed;
}

function requiredHebrewString(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new TranslationValidationError(`${field} must be a non-empty Hebrew string.`);
  }
  const text = value.trim();
  if (!HEBREW_LETTER.test(text)) {
    throw new TranslationValidationError(`${field} must be written in Hebrew.`);
  }
  return text;
}

function optionalLocalizedString(
  value: unknown,
  field: string,
  source: string | null | undefined,
): string | null {
  if (typeof value !== "string") {
    throw new TranslationValidationError(`${field} must be a string.`);
  }
  const text = value.trim();
  const sourceHasText = Boolean(source?.trim());
  if (!sourceHasText) {
    if (text) {
      throw new TranslationValidationError(`${field} was empty in English and must stay empty.`);
    }
    return null;
  }
  if (!text || !HEBREW_LETTER.test(text)) {
    throw new TranslationValidationError(`${field} must be written in Hebrew.`);
  }
  return text;
}

function parseImageAlt(value: unknown, source: EnglishDocument): string | null {
  if (typeof value !== "string") {
    throw new TranslationValidationError("imageAlt must be a string.");
  }
  const text = value.trim();
  const required = Boolean(source.mainImage?.alt?.trim());
  if (!required) {
    if (text) {
      throw new TranslationValidationError("imageAlt was empty in English and must stay empty.");
    }
    return null;
  }
  if (!text || !HEBREW_LETTER.test(text)) {
    throw new TranslationValidationError("imageAlt must be written in Hebrew.");
  }
  return text;
}

function parseReviewNotes(value: unknown): string[] {
  if (!Array.isArray(value)) {
    throw new TranslationValidationError("reviewNotes must be an array.");
  }
  if (value.length > 20) {
    throw new TranslationValidationError("reviewNotes has too many items.");
  }
  return value.flatMap((item) => {
    if (typeof item !== "string") {
      throw new TranslationValidationError("reviewNotes must contain strings.");
    }
    const text = item.trim();
    if (!text || EMPTY_NOTE.test(text)) return [];
    return [text.slice(0, 500)];
  });
}
