import {
  FORBIDDEN_HEBREW_LITERALS,
  missingGlossaryTerms,
  PRESERVED_ACRONYMS,
} from "./glossary";
import { collectUrls, plainText, translatableSpans } from "./segments";
import type { EnglishDocument, HebrewDraft } from "./types";

export const SEO_TITLE_MIN = 45;
export const SEO_TITLE_MAX = 60;
export const SEO_DESCRIPTION_MIN = 140;
export const SEO_DESCRIPTION_MAX = 160;

const OBSERVATIONAL_DESIGNS = new Set([
  "cohort-study",
  "cross-sectional-study",
  "observational-study",
]);

const ASSOCIATIVE_ENGLISH =
  /\b(associated|association|correlated|correlation)\b/i;

const CAUSAL_HEBREW = [
  /הפח(?:י|ת)/,
  /גרמ(?:ה|ו)?\s+ל/,
  /הוביל(?:ה|ו)?\s+ל/,
  /מנע(?:ה|ו)?/,
];

const OVERCLAIM_HEBREW = [/הוכח/, /מוכח/, /בוודאות/, /ללא ספק/, /מרפא/];

const ADVICE_HEBREW = [
  /מומלץ להתחיל/,
  /כדאי לכם/,
  /עליכם לבצע/,
  /התחילו לבצע/,
];

const SNACKSMATE_TESTED = [
  /Snacksmate נבדק/,
  /נבדק(?:ה)? ב[־-]Snacksmate/,
  /האפליקציה הוכח/,
];

const DOI_PATTERN_SOURCE = "\\b10\\.\\d{4,9}\\/\\S+";
const URL_PATTERN_SOURCE = "https?:\\/\\/[^\\s)]+";

export function textLength(value: string): number {
  return [...value].length;
}

export function seoLengthWarnings(seoTitle: string, seoDescription: string): string[] {
  const warnings: string[] = [];
  const titleLength = textLength(seoTitle);
  const descriptionLength = textLength(seoDescription);
  if (titleLength < SEO_TITLE_MIN || titleLength > SEO_TITLE_MAX) {
    warnings.push(
      `SEO title is ${titleLength} characters. The target is ${SEO_TITLE_MIN}–${SEO_TITLE_MAX}.`,
    );
  }
  if (descriptionLength < SEO_DESCRIPTION_MIN || descriptionLength > SEO_DESCRIPTION_MAX) {
    warnings.push(
      `SEO description is ${descriptionLength} characters. The target is ${SEO_DESCRIPTION_MIN}–${SEO_DESCRIPTION_MAX}.`,
    );
  }
  return warnings;
}

export function suspiciousLiteralWarnings(hebrew: string): string[] {
  return FORBIDDEN_HEBREW_LITERALS.filter((item) => hebrew.includes(item.pattern)).map(
    (item) => `Suspicious literal "${item.pattern}". ${item.reason}`,
  );
}

export function glossaryWarnings(sourceText: string, hebrew: string): string[] {
  return missingGlossaryTerms(sourceText, hebrew).map(
    (match) =>
      `Glossary term "${match.id}" is missing. Expected one of: ${match.hebrew.join(" / ")}.`,
  );
}

export function acronymWarnings(sourceText: string, hebrew: string): string[] {
  return PRESERVED_ACRONYMS.filter(
    (rule) => rule.source.test(sourceText) && !rule.accept.test(hebrew),
  ).map((rule) => `Acronym ${rule.id} from the English source is missing in the Hebrew text.`);
}

export function associationWarnings(input: {
  sourceText: string;
  hebrew: string;
  studyDesign?: string | null;
}): string[] {
  const observational = OBSERVATIONAL_DESIGNS.has(input.studyDesign?.trim() ?? "");
  const associative = ASSOCIATIVE_ENGLISH.test(input.sourceText);
  if (!observational && !associative) return [];
  if (!CAUSAL_HEBREW.some((pattern) => pattern.test(input.hebrew))) return [];
  return [
    observational
      ? "Causal Hebrew was introduced into an observational study. Keep association language, for example נמצא קשר."
      : "The English uses association language, but the Hebrew states a causal effect. Use נמצא קשר / נמצא קשור ל־.",
  ];
}

export function uncertaintyWarnings(sourceText: string, hebrew: string): string[] {
  const cautious =
    /\b(may|might|suggests?|associated|did not establish|not significantly|insufficient|uncertain)\b/i.test(
      sourceText,
    );
  if (!cautious) return [];
  if (!OVERCLAIM_HEBREW.some((pattern) => pattern.test(hebrew))) return [];
  return ["Cautious English was turned into confident Hebrew. Preserve the uncertainty."];
}

export function practicalInterpretationWarnings(hebrew: string): string[] {
  const warnings: string[] = [];
  if (ADVICE_HEBREW.some((pattern) => pattern.test(hebrew))) {
    warnings.push(
      "Practical interpretation reads as health advice. Keep it as a cautious reading of the evidence.",
    );
  }
  if (SNACKSMATE_TESTED.some((pattern) => pattern.test(hebrew))) {
    warnings.push("Practical interpretation implies Snacksmate itself was tested.");
  }
  return warnings;
}

export function numberWarnings(sourceText: string, hebrew: string, field: string): string[] {
  const sourceNumbers = extractNumbers(sourceText);
  const translatedNumbers = new Set(extractNumbers(hebrew));
  const missing = sourceNumbers.filter((number) => !translatedNumbers.has(number));
  if (missing.length === 0) return [];
  return [`${field} is missing source number${missing.length === 1 ? "" : "s"}: ${unique(missing).join(", ")}.`];
}

export function inventedNumberWarnings(sourceText: string, hebrew: string): string[] {
  const allowed = new Set(extractNumbers(sourceText));
  const invented = extractNumbers(hebrew).filter((number) => !allowed.has(number));
  if (invented.length === 0) return [];
  return [`Hebrew text introduces number${invented.length === 1 ? "" : "s"} that are not in the English source: ${unique(invented).join(", ")}.`];
}

export function preservationWarnings(source: EnglishDocument, draft: HebrewDraft): string[] {
  const warnings: string[] = [];
  if (source._type === "research") {
    if ((draft.title ?? "") !== source.title) {
      warnings.push("Research title changed. The scientific paper title must be copied in English.");
    }
    if ((draft.journal ?? null) !== (source.journal?.trim() || null)) {
      warnings.push("Journal name was translated or changed. Keep the original journal name.");
    }
    if ((draft.doi ?? null) !== (source.doi?.trim() || null)) {
      warnings.push("DOI was translated or changed. Copy the DOI exactly.");
    }
    if ((draft.sampleSize ?? null) !== (source.sampleSize ?? null)) {
      warnings.push("Sample size changed. Copy the English sample size.");
    }
    if ((draft.studyUrl ?? null) !== (source.studyUrl?.trim() || null)) {
      warnings.push("Original study URL changed.");
    }
    if ((draft.studyDesign ?? null) !== (source.studyDesign?.trim() || null)) {
      warnings.push("Study design enum changed. Keep the machine value.");
    }
  }

  const sourceUrls = collectUrls(preservationSnapshot(source)).sort();
  const draftUrls = collectUrls(draft).sort();
  if (sourceUrls.join("\n") !== draftUrls.join("\n")) {
    warnings.push("A URL changed or broke. Links must be copied exactly.");
  }

  return warnings;
}

export function protectedPhraseWarnings(
  source: EnglishDocument,
  translations: ReadonlyMap<string, string>,
): string[] {
  const phrases = protectedPhrases(source);
  if (phrases.length === 0) return [];
  const warnings: string[] = [];
  for (const span of translatableSpans(source)) {
    const hebrew = translations.get(span.id);
    if (hebrew === undefined) continue;
    for (const phrase of phrases) {
      if (span.text.includes(phrase) && !hebrew.includes(phrase)) {
        warnings.push(`"${phrase}" must stay in its original form in ${span.id}.`);
      }
    }
    const sourceDois = span.text.match(new RegExp(DOI_PATTERN_SOURCE, "g")) ?? [];
    for (const doi of sourceDois) {
      if (!hebrew.includes(doi)) warnings.push(`DOI ${doi} changed in ${span.id}.`);
    }
    const sourceUrls = span.text.match(new RegExp(URL_PATTERN_SOURCE, "g")) ?? [];
    for (const url of sourceUrls) {
      if (!hebrew.includes(url)) warnings.push(`URL ${url} changed in ${span.id}.`);
    }
  }
  return warnings;
}

export function translationQualityWarnings(input: {
  source: EnglishDocument;
  draft: HebrewDraft;
  translations: ReadonlyMap<string, string>;
}): string[] {
  const sourceText = translatableSpans(input.source)
    .map((span) => span.text)
    .join("\n");
  const hebrewParts = [...input.translations.values()];
  const hebrew = [
    input.draft.excerpt,
    input.draft.seoTitle,
    input.draft.seoDescription,
    input.draft.title,
    ...hebrewParts,
  ].join("\n");
  const practical =
    input.source._type === "research" ? plainText(input.draft.practicalInterpretation) : "";

  const perFieldNumbers = translatableSpans(input.source).flatMap((span) => {
    const translated = input.translations.get(span.id);
    if (translated === undefined) return [];
    return numberWarnings(span.text, translated, span.id);
  });

  return unique([
    ...suspiciousLiteralWarnings(hebrew),
    ...glossaryWarnings(sourceText, hebrew),
    ...acronymWarnings(sourceText, hebrew),
    ...associationWarnings({
      sourceText,
      hebrew,
      studyDesign: input.source._type === "research" ? input.source.studyDesign : null,
    }),
    ...uncertaintyWarnings(sourceText, hebrew),
    ...practicalInterpretationWarnings(practical),
    ...perFieldNumbers,
    ...inventedNumberWarnings(
      [
        sourceText,
        input.source._type === "research" ? input.source.doi : "",
        input.source._type === "research" ? input.source.pmid : "",
        input.source._type === "research" ? input.source.studyUrl : "",
        input.source._type === "research" && input.source.sampleSize != null
          ? String(input.source.sampleSize)
          : "",
        input.source._type === "research" && input.source.year != null
          ? String(input.source.year)
          : "",
      ].join("\n"),
      hebrew,
    ),
    ...seoLengthWarnings(input.draft.seoTitle, input.draft.seoDescription),
    ...preservationWarnings(input.source, input.draft),
    ...protectedPhraseWarnings(input.source, input.translations),
  ]);
}

function preservationSnapshot(source: EnglishDocument): unknown {
  if (source._type === "article") {
    return { body: source.body, references: source.references, mainImage: source.mainImage };
  }
  return {
    intervention: source.intervention,
    mainFindings: source.mainFindings,
    practicalInterpretation: source.practicalInterpretation,
    limitations: source.limitations,
    snacksmateRelevance: source.snacksmateRelevance,
    references: source.references,
    studyUrl: source.studyUrl,
    mainImage: source.mainImage,
  };
}

function protectedPhrases(source: EnglishDocument): string[] {
  const phrases: Array<string | null | undefined> = [];
  if (source._type === "research") {
    phrases.push(source.journal, source.doi, source.studyUrl, source.pmid);
    for (const author of source.studyAuthors ?? []) phrases.push(author);
  }
  for (const reference of source.references ?? []) {
    phrases.push(reference.title, reference.source, reference.doi, reference.url);
  }
  return unique(
    phrases.filter((phrase): phrase is string => typeof phrase === "string" && phrase.trim().length >= 4),
  ).map((phrase) => phrase.trim());
}

function extractNumbers(text: string): string[] {
  return text.match(/\d+(?:\.\d+)?/g) ?? [];
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}
