import { assembleHebrewDraft } from "./document";
import { glossaryMatches } from "./glossary";
import { buildRefinementInput, buildRefinementInstructions } from "./prompt";
import { parseFieldRepair, repairJsonSchema } from "./schema";
import { translatableSpans } from "./segments";
import type { EnglishDocument, HebrewTranslation, SpanTranslation } from "./types";

export const MAX_REFINEMENT_ATTEMPTS = 1;

export type RefinementReport = {
  triggered: boolean;
  warningsBefore: string[];
  repairedFields: string[];
  warningsAfter: string[];
  resolvedWarnings: string[];
};

export type FieldRepairRequest = {
  source: EnglishDocument;
  fields: string[];
  warnings: string[];
  instructions: string;
  input: string;
  schema: Record<string, unknown>;
  schemaName: string;
};

const FIELD_ORDER = [
  "title",
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
  "body",
  "imageAlt",
] as const;

const INFORMATIONAL_WARNING =
  /translationSlug|language switch|Research title changed|Journal name was translated|DOI was translated|Sample size changed|Original study URL changed|Study design enum changed|A URL changed or broke/i;

const DIRECTION_WARNING =
  /comparison target|collapsed into|upward direction|downward direction|non-significant result|statistical significance|above a reference|below a reference/;

export function fixableQualityWarnings(warnings: readonly string[]): string[] {
  return warnings.filter((warning) => !INFORMATIONAL_WARNING.test(warning));
}

export async function refineTranslationOnce(input: {
  source: EnglishDocument;
  translation: HebrewTranslation;
  model: string;
  translatedAt: string;
  repair: (request: FieldRepairRequest) => Promise<unknown>;
}): Promise<{ translation: HebrewTranslation; report: RefinementReport }> {
  const before = qualityWarnings(input);
  const fixable = fixableQualityWarnings(before);
  const fields = fieldsForWarnings(fixable, input.source, input.translation);
  if (fixable.length === 0 || fields.length === 0) {
    return {
      translation: input.translation,
      report: {
        triggered: false,
        warningsBefore: before,
        repairedFields: [],
        warningsAfter: before,
        resolvedWarnings: [],
      },
    };
  }

  const request = fieldRepairRequest(input.source, input.translation, fields, fixable);
  const payload = await input.repair(request);
  const repaired = parseFieldRepair(input.source, fields, payload);
  const translation = applyFieldRepair(input.translation, repaired);
  const after = qualityWarnings({ ...input, translation });
  return {
    translation,
    report: {
      triggered: true,
      warningsBefore: before,
      repairedFields: fields,
      warningsAfter: after,
      resolvedWarnings: fixable.filter((warning) => !after.includes(warning)),
    },
  };
}

function qualityWarnings(input: {
  source: EnglishDocument;
  translation: HebrewTranslation;
  model: string;
  translatedAt: string;
}): string[] {
  return assembleHebrewDraft(input).qualityWarnings;
}

function fieldRepairRequest(
  source: EnglishDocument,
  translation: HebrewTranslation,
  fields: readonly string[],
  warnings: readonly string[],
): FieldRepairRequest {
  return {
    source,
    fields: [...fields],
    warnings: [...warnings],
    instructions: buildRefinementInstructions(),
    input: buildRefinementInput({
      originalEnglish: Object.fromEntries(fields.map((field) => [field, englishField(source, field)])),
      currentHebrew: Object.fromEntries(fields.map((field) => [field, hebrewField(translation, field)])),
      warnings,
    }),
    schema: repairJsonSchema(source, fields),
    schemaName: "hebrew_field_repair",
  };
}

export function fieldsForWarnings(
  warnings: readonly string[],
  source: EnglishDocument,
  translation: HebrewTranslation,
): string[] {
  const found = new Set<string>();
  for (const warning of warnings) {
    for (const field of fieldsForWarning(warning, source, translation)) found.add(field);
  }
  return FIELD_ORDER.filter((field) => found.has(field));
}

function fieldsForWarning(
  warning: string,
  source: EnglishDocument,
  translation: HebrewTranslation,
): string[] {
  const fields = new Set<string>();
  const missingNumber = warning.match(/^([A-Za-z0-9._-]+) is missing source number/);
  if (missingNumber?.[1]) fields.add(parentField(missingNumber[1]));
  const protectedPhrase = warning.match(/in ([A-Za-z0-9._-]+)\.$/);
  if (protectedPhrase?.[1]) fields.add(parentField(protectedPhrase[1]));
  if (/^SEO title\b/.test(warning)) fields.add("seoTitle");
  if (/^SEO description\b/.test(warning) || /SEO description states/.test(warning)) {
    fields.add("seoDescription");
  }
  if (/^Practical interpretation\b/.test(warning)) fields.add("practicalInterpretation");
  if (DIRECTION_WARNING.test(warning)) {
    if (translation.kind === "research") fields.add("mainFindings");
    else for (const field of ["excerpt", "seoDescription", "body"]) fields.add(field);
  }
  if (/Observational or associative findings need association language/.test(warning)) {
    for (const span of translatableSpans(source)) {
      if (/\b(?:associated|association|correlated|correlation)\b/i.test(span.text)) fields.add(span.field);
    }
  }
  if (/Glossary term "([^"]+)"/.test(warning)) {
    for (const field of glossaryFields(warning, source, translation)) fields.add(field);
  }
  const invented = warning.match(/not in the English source: ([0-9., ]+)\./);
  if (invented?.[1]) {
    for (const raw of invented[1].split(",").map((item) => item.trim()).filter(Boolean)) {
      for (const entry of fieldEntries(translation)) {
        if (new RegExp(`(?<!\\d)${raw.replace(".", "\\.")}(?!\\d)`).test(entry.text)) fields.add(entry.field);
      }
    }
  }
  for (const entry of fieldEntries(translation)) {
    if (warningPattern(warning)?.test(entry.text)) fields.add(entry.field);
  }
  return [...fields].filter((field) => isRepairableField(translation, field));
}

function glossaryFields(warning: string, source: EnglishDocument, translation: HebrewTranslation): string[] {
  const id = warning.match(/Glossary term "([^"]+)"/)?.[1];
  const expected = warning.match(/Expected one of: ([^.]+)\./)?.[1]?.split(" / ").map((item) => item.trim()) ?? [];
  if (!id) return [];
  const fields = new Set<string>();
  for (const span of translatableSpans(source)) {
    if (!glossaryMatches(span.text).some((match) => match.id === id)) continue;
    const hebrew = fieldText(translation, span.field);
    if (expected.some((term) => hebrew.includes(term))) continue;
    fields.add(span.field);
  }
  return [...fields];
}

function warningPattern(warning: string): RegExp | null {
  const literal = warning.match(/Suspicious literal "([^"]+)"/);
  if (literal?.[1]) return new RegExp(escapeRegExp(literal[1]));
  if (/Participant description uses/.test(warning)) return /בעל(?:י|ת)? התנהגות יושבנית/;
  if (/Acute-session wording|Washout was rendered/.test(warning)) return /פעילות אקוטית|מפגשים אקוטיים|שטיפה/;
  if (/Acute was rendered/.test(warning)) return /חריפ/;
  if (/within-participant crossover comparison/.test(warning)) return /בין[־\-‑\s]?אישי|השוואה בין/;
  if (/Long-term benefit was not tested/.test(warning)) return /לא הראה באופן ברור/;
  if (/Simple durations mix/.test(warning)) return /(?:^|[^\d])[123]\s*דק(?:ה|ות)/;
  if (/association wording|Causal Hebrew/.test(warning)) {
    return /נמצא קשר|נמצא קשור|נקשר|הפח(?:י|ת)|גרמ(?:ה|ו)?\s+ל|הוביל(?:ה|ו)?\s+ל|מנע(?:ה|ו)?/;
  }
  if (/Cautious English was turned/.test(warning)) return /הוכח|מוכח|בוודאות|ללא ספק|מרפא/;
  if (/reads as health advice|implies Snacksmate itself was tested/.test(warning)) {
    return /מומלץ להתחיל|כדאי לכם|עליכם לבצע|התחילו לבצע|Snacksmate נבדק/;
  }
  return null;
}

function isRepairableField(translation: HebrewTranslation, field: string): boolean {
  const allowed = translation.kind === "article"
    ? ["title", "excerpt", "seoTitle", "seoDescription", "body", "imageAlt"]
    : [
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
      ];
  return allowed.includes(field);
}

function parentField(id: string): string {
  return id.split(".")[0] ?? id;
}

function fieldEntries(translation: HebrewTranslation): Array<{ field: string; text: string }> {
  return FIELD_ORDER.flatMap((field) => {
    if (!isRepairableField(translation, field)) return [];
    const text = fieldText(translation, field);
    return text ? [{ field, text }] : [];
  });
}

function fieldText(translation: HebrewTranslation, field: string): string {
  const value = (translation as unknown as Record<string, unknown>)[field];
  if (typeof value === "string") return value;
  if (!Array.isArray(value)) return "";
  return value
    .map((item) =>
      item && typeof item === "object" && "text" in item && typeof item.text === "string" ? item.text : "",
    )
    .join("\n");
}

function englishField(source: EnglishDocument, field: string): unknown {
  const spans = translatableSpans(source).filter((span) => span.field === field);
  if (spans.length === 1 && spans[0]?.id === field) return spans[0].text;
  if (spans.length > 0) return spans.map((span) => ({ id: span.id, text: span.text }));
  return "";
}

function hebrewField(translation: HebrewTranslation, field: string): unknown {
  const value = (translation as unknown as Record<string, unknown>)[field];
  if (typeof value === "string" || value == null) return value ?? "";
  if (Array.isArray(value)) {
    return value.flatMap((item) => {
      if (!item || typeof item !== "object" || !("id" in item) || !("text" in item)) return [];
      const span = item as SpanTranslation;
      return [{ id: span.id, text: span.text }];
    });
  }
  return "";
}

function applyFieldRepair(
  translation: HebrewTranslation,
  repaired: Partial<HebrewTranslation>,
): HebrewTranslation {
  if (translation.kind === "research") {
    return { ...translation, ...repaired, kind: "research", reviewNotes: translation.reviewNotes };
  }
  return { ...translation, ...repaired, kind: "article", reviewNotes: translation.reviewNotes };
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
