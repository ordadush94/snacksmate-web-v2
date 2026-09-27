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

const VAGUE_SEO_TITLE_LENGTH = 12;

const OBSERVATIONAL_DESIGNS = new Set([
  "cohort-study",
  "cross-sectional-study",
  "observational-study",
]);

const INTERVENTION_DESIGNS = new Set([
  "crossover-study",
  "randomized-controlled-trial",
  "controlled-trial",
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
  if (titleLength > SEO_TITLE_MAX) {
    warnings.push(
      `SEO title is ${titleLength} characters, which is longer than ${SEO_TITLE_MAX}. ${SEO_TITLE_MIN}–${SEO_TITLE_MAX} is a target, not a minimum.`,
    );
  } else if (titleLength > 0 && titleLength < VAGUE_SEO_TITLE_LENGTH) {
    warnings.push("SEO title is too vague to describe the study.");
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

const ASSOCIATION_HEBREW = /נמצא קשר|נמצא קשור|נקשר/;

export function associationWarnings(input: {
  sourceText: string;
  hebrew: string;
  studyDesign?: string | null;
}): string[] {
  const design = input.studyDesign?.trim() ?? "";
  const observational = OBSERVATIONAL_DESIGNS.has(design);
  const associative = ASSOCIATIVE_ENGLISH.test(input.sourceText);
  const intervention = INTERVENTION_DESIGNS.has(design);
  const warnings: string[] = [];
  if ((observational || associative) && CAUSAL_HEBREW.some((pattern) => pattern.test(input.hebrew))) {
    warnings.push(
      observational
        ? "Causal Hebrew was introduced into an observational study. Keep association language, for example נמצא קשר."
        : "The English uses association language, but the Hebrew states a causal effect. Use נמצא קשר / נמצא קשור ל־.",
    );
  } else if ((observational || associative) && !ASSOCIATION_HEBREW.test(input.hebrew)) {
    warnings.push(
      "Observational or associative findings need association language such as נמצא קשר or נקשר ל־.",
    );
  }
  if (intervention && !associative && ASSOCIATION_HEBREW.test(input.hebrew)) {
    warnings.push(
      "This randomized, crossover, or controlled intervention uses association wording. In the excerpt, main findings, practical interpretation, and SEO description, use a direct comparison such as לאחר מצב B נמדד ערך גבוה יותר של מדד A לעומת מצב A. Do not write נמצא קשר or נקשר ל־.",
    );
  }
  return warnings;
}

export function participantWordingWarnings(hebrew: string): string[] {
  if (!/בעל(?:י|ת)? התנהגות יושבנית/.test(hebrew)) return [];
  return [
    "Participant description uses בעלי התנהגות יושבנית. Prefer בעל אורח חיים יושבני or בעלי אורח חיים יושבני. Keep התנהגות יושבנית for the behavior itself.",
  ];
}

export function awkwardPhrasingWarnings(hebrew: string): string[] {
  const warnings: string[] = [];
  if (/פעילות אקוטית|מפגשים אקוטיים/.test(hebrew)) {
    warnings.push(
      "Acute-session wording sounds translated. Prefer plain Hebrew such as מפגשי פעילות חד־פעמיים, and state the days between sessions.",
    );
  }
  if (/שטיפה/.test(hebrew)) {
    warnings.push("Washout was rendered as שטיפה. State the number of days between sessions.");
  }
  return warnings;
}

export function acuteResponseWarnings(sourceText: string, hebrew: string): string[] {
  if (!/\bacute\b/i.test(sourceText) || !/חריפ/.test(hebrew)) return [];
  return [
    "Acute was rendered with חריפ, which can sound like disease severity. For an immediate physiological or metabolic response, prefer מיידיות. Use אקוטיות only when the technical term is needed.",
  ];
}

const UP_ENGLISH = /\b(?:increas(?:e|ed|es|ing)|higher|greater|rose|risen)\b/i;
const DOWN_ENGLISH = /\b(?:decreas(?:e|ed|es|ing)|lower|less|fell|fallen)\b/i;
const COMPARISON_ENGLISH =
  /\b(?:compared\s+with|compared\s+to|versus|vs\.?)\b|\b(?:higher|lower|greater|less)\s+than\b/i;
const NON_SIG_ENGLISH =
  /\b(?:not\s+significantly\s+different|not\s+statistically\s+significant|no\s+significant\s+difference|not\s+significantly\s+(?:higher|lower|greater|less))\b/i;
const SIG_ENGLISH = /(?<!\bnot\s)\bsignificantly\s+(?:higher|lower|greater|less)\b/i;
const ABOVE_ENGLISH = /\babove\b/i;
const BELOW_ENGLISH = /\bbelow\b/i;

const UP_HEBREW = /עלייה|עליית|עלה|עלו|גבוה/;
const DOWN_HEBREW = /ירידה|ירידת|ירד|ירדו|נמוך|פחות|מתחת/;
const COMPARISON_HEBREW = /לעומת|מאשר/;
const NON_SIG_HEBREW =
  /לא נמצא הבדל מובהק|לא נבדל|ללא הבדל|אינו מובהק|אינה מובהק|לא היה מובהק|לא היו מובהק|לא מובהק/;
const ABOVE_HEBREW = /מעל/;
const BELOW_HEBREW = /מתחת/;
const GENERIC_HEBREW_CHANGE = /(?<![\u05D0-\u05EA])השתנ(?:תה|ה|ו)(?![\u05D0-\u05EA])/;
const HEBREW_DIRECTION = /עלייה|ירידה|עלה|עלו|ירד|ירדו|גבוה|נמוך|יותר|פחות|מעל|מתחת/;

function hasAffirmativeSignificance(hebrew: string): boolean {
  const negation =
    /לא נמצא הבדל מובהק(?:\s+סטטיסטית)?|לא נבדל[והתם]?(?:\s+באופן\s+מובהק)?|ללא הבדל(?:\s+מובהק(?:\s+סטטיסטית)?)?|אינ[וה]\s+מובהק|לא היה מובהק|לא היו מובהק|לא מובהק/g;
  return /מובהק/.test(hebrew.replace(negation, ""));
}

export function collapsedDirectionWarnings(sourceText: string, hebrew: string): string[] {
  if (!sourceText.trim() || !hebrew.trim()) return [];
  const warnings: string[] = [];
  const upward = UP_ENGLISH.test(sourceText);
  const downward = DOWN_ENGLISH.test(sourceText);
  if (upward && !UP_HEBREW.test(hebrew)) {
    warnings.push(
      "Hebrew dropped an increase, rise, or higher result. Keep the upward direction, for example ערך גבוה יותר.",
    );
  }
  if (downward && !DOWN_HEBREW.test(hebrew)) {
    warnings.push(
      "Hebrew dropped a decrease, fall, or lower result. Keep the downward direction, for example ערך נמוך יותר.",
    );
  }
  if (COMPARISON_ENGLISH.test(sourceText) && !COMPARISON_HEBREW.test(hebrew)) {
    warnings.push(
      "Hebrew dropped the comparison target. Name the other side with לעומת or מאשר, for example ערך גבוה יותר של מדד A לעומת מצב A.",
    );
  }
  if (NON_SIG_ENGLISH.test(sourceText) && !NON_SIG_HEBREW.test(hebrew)) {
    warnings.push(
      "Hebrew dropped a non-significant result. Keep it explicit, for example לא נמצא הבדל מובהק סטטיסטית בין התנאים.",
    );
  }
  if (SIG_ENGLISH.test(sourceText) && !hasAffirmativeSignificance(hebrew)) {
    warnings.push(
      "Hebrew dropped statistical significance. Keep that the difference was significant.",
    );
  }
  if (ABOVE_ENGLISH.test(sourceText) && !ABOVE_HEBREW.test(hebrew)) {
    warnings.push("Hebrew dropped a result that was above a reference level. Keep מעל.");
  }
  if (BELOW_ENGLISH.test(sourceText) && !BELOW_HEBREW.test(hebrew)) {
    warnings.push("Hebrew dropped a result that was below a reference level. Keep מתחת.");
  }
  if (upward || downward) {
    const vague = hebrew.split(/[.!?]/).filter((sentence) => {
      return GENERIC_HEBREW_CHANGE.test(sentence) && !HEBREW_DIRECTION.test(sentence);
    });
    if (vague.length > 0) {
      warnings.push(
        "A directional English finding was collapsed into השתנה or השתנו. Keep increase, decrease, higher, or lower. Do not add a magnitude or a p-value.",
      );
    }
  }
  return warnings;
}

const MIXED_SIMPLE_DURATION = /(?:^|[^\d])[123]\s*דק(?:ה|ות)/;

export function mixedDurationStyleWarnings(hebrew: string): string[] {
  if (!MIXED_SIMPLE_DURATION.test(hebrew)) return [];
  return [
    "Simple durations mix digits with Hebrew prose. Write דקה, שתי דקות, שלוש דקות. Keep digits for scientific quantities such as sample size, watts, seconds, heart rate, and doses.",
  ];
}

const BETWEEN_PERSON = /בין[־\-‑\s]?אישי|השוואה בין[־\-‑\s]?(?:ה)?(?:נבדקים|משתתפים|אנשים)/;

export function betweenPersonWarnings(input: {
  sourceText: string;
  hebrew: string;
  studyDesign?: string | null;
}): string[] {
  const crossover = input.studyDesign?.trim() === "crossover-study";
  const within = /\bwithin[-\s](?:participant|subject|person)s?\b/i.test(input.sourceText);
  if (!crossover && !within) return [];
  if (!BETWEEN_PERSON.test(input.hebrew)) return [];
  return [
    "A within-participant crossover comparison was translated as a between-person comparison. Use השוואה בתוך אותם משתתפים. Do not write בין־אישית.",
  ];
}

export function untestedLongTermWarnings(sourceText: string, hebrew: string): string[] {
  const acuteUntested =
    /\bacute\b/i.test(sourceText) &&
    /\bdid not establish\b/i.test(sourceText) &&
    /\blong(?:er)?-term\b/i.test(sourceText);
  if (!acuteUntested) return [];
  if (!/לא הראה באופן ברור/.test(hebrew) || !/לטווח ארוך/.test(hebrew)) return [];
  return [
    "Long-term benefit was not tested. Write המחקר לא בחן יתרונות בריאותיים לטווח ארוך. Do not write לא הראה באופן ברור for an outcome the study did not measure.",
  ];
}

export function seoComparisonWarnings(sourceText: string, seoDescription: string): string[] {
  const comparison =
    /\b(?:greater|higher|increased|more)\b/i.test(sourceText) &&
    /\b(?:compared with|than|versus)\b/i.test(sourceText);
  if (!comparison || !seoDescription.trim()) return [];
  const claimsHigher = /גבוה יותר|נמוך יותר|עלייה|ירידה/.test(seoDescription);
  if (claimsHigher && !/לעומת|מאשר/.test(seoDescription)) {
    return [
      "SEO description states a higher result without saying higher than what. Include the comparison, for example ערך גבוה יותר של מדד A לעומת מצב A.",
    ];
  }
  return [];
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
  const hits = extractNumberHits(sourceText);
  const translatedNumbers = new Set(extractNumbers(hebrew));
  const wordValues = hebrewSmallIntegers(hebrew);
  const seen = new Set<string>();
  const missing: string[] = [];
  for (const hit of hits) {
    if (seen.has(hit.raw)) continue;
    seen.add(hit.raw);
    if (translatedNumbers.has(hit.raw)) continue;
    const occurrences = hits.filter((item) => item.raw === hit.raw);
    const wordEligible = occurrences.every((item) =>
      isSmallIntegerWordEligible(sourceText, item.index, item.raw),
    );
    if (wordEligible && wordValues.has(hit.raw)) continue;
    if (quantityImpliedByUnit(sourceText, hebrew, hit.raw, occurrences)) continue;
    missing.push(hit.raw);
  }
  if (missing.length === 0) return [];
  return [`${field} is missing source number${missing.length === 1 ? "" : "s"}: ${missing.join(", ")}.`];
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
    ...participantWordingWarnings(hebrew),
    ...awkwardPhrasingWarnings(hebrew),
    ...acuteResponseWarnings(sourceText, hebrew),
    ...betweenPersonWarnings({
      sourceText,
      hebrew,
      studyDesign: input.source._type === "research" ? input.source.studyDesign : null,
    }),
    ...untestedLongTermWarnings(sourceText, hebrew),
    ...seoComparisonWarnings(sourceText, input.draft.seoDescription),
    ...collapsedDirectionWarnings(
      input.source._type === "research" ? plainText(input.source.mainFindings) : sourceText,
      input.source._type === "research"
        ? translatableSpans(input.source)
            .filter((span) => span.field === "mainFindings")
            .map((span) => input.translations.get(span.id) ?? "")
            .join("\n")
        : hebrew,
    ),
    ...mixedDurationStyleWarnings(hebrew),
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

function extractNumberHits(text: string): Array<{ raw: string; index: number }> {
  const hits: Array<{ raw: string; index: number }> = [];
  const pattern = /\d+(?:\.\d+)?/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    hits.push({ raw: match[0], index: match.index });
  }
  return hits;
}

/**
 * Integers 1–10 may be written as Hebrew cardinals, including both genders
 * and the construct form. A digit still has to appear when any occurrence
 * is a sample size, percentage, year, unit, dose, effect size, confidence
 * interval, or p-value. Minute counts are the ordinary prose exception.
 */
const SMALL_INTEGER_FORMS: ReadonlyArray<readonly [string, string]> = [
  ["1", "אחת"],
  ["1", "אחד"],
  ["2", "שתיים"],
  ["2", "שניים"],
  ["2", "שתי"],
  ["2", "שני"],
  ["3", "שלושה"],
  ["3", "שלושת"],
  ["3", "שלוש"],
  ["4", "ארבעה"],
  ["4", "ארבעת"],
  ["4", "ארבע"],
  ["5", "חמישה"],
  ["5", "חמשת"],
  ["5", "חמש"],
  ["6", "שישה"],
  ["6", "ששת"],
  ["6", "שש"],
  ["7", "שבעה"],
  ["7", "שבעת"],
  ["7", "שבע"],
  ["8", "שמונה"],
  ["8", "שמונת"],
  ["9", "תשעה"],
  ["9", "תשעת"],
  ["9", "תשע"],
  ["10", "עשרה"],
  ["10", "עשרת"],
  ["10", "עשר"],
];

const MEASUREMENT_UNIT =
  /^\s*-?\s*(?:watts?|kcal|kJ|mmHg|mmol|bpm|mcg|µg|μg|kg|mg|ml|mL|cm|mm|km|Hz|IUs?|METs?|reps?|sets?|seconds?|secs?|sec|hours?|hrs?|hr|days?|weeks?|months?|years?|yr|mol|ng|g|m|s|W|L)\b/i;

function hebrewSmallIntegers(text: string): Set<string> {
  const forms = [...SMALL_INTEGER_FORMS].sort((left, right) => right[1].length - left[1].length);
  const byForm = new Map(forms.map(([value, form]) => [form, value]));
  const pattern = new RegExp(
    `(?<![\\u05D0-\\u05EA])(?:[והבלכמש][־-]?)?(${forms.map(([, form]) => form).join("|")})(?![\\u05D0-\\u05EA])`,
    "g",
  );
  const found = new Set<string>();
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    const value = byForm.get(match[1] ?? "");
    if (value) found.add(value);
  }
  return found;
}

function isSmallIntegerWordEligible(text: string, index: number, raw: string): boolean {
  if (!/^(?:[1-9]|10)$/.test(raw)) return false;
  const before = text.slice(Math.max(0, index - 48), index);
  const after = text.slice(index + raw.length, index + raw.length + 48);
  if (/^(?:\s*|-\s*)(?:minutes?|min)\b/i.test(after)) return true;
  if (/^\s*%/.test(after) || /^\s*percent(?:age)?\b/i.test(after)) return false;
  if (/(?:\bp[\s-]*values?\b[^0-9]{0,12}|\bp\s*(?:=|<|≤|>)\s*)$/i.test(before)) return false;
  if (/\b(?:CIs?|confidence\s+intervals?)\b/i.test(before)) return false;
  if (/\byears?\b/i.test(before.slice(-16)) || /^\s*-?\s*years?\b/i.test(after)) return false;
  if (/(?:\b[nN]\s*=\s*|\bsample\s+size\s*(?:of\s*)?|\bsample\s+of\s*)$/i.test(before)) return false;
  if (
    /^\s*(?:sedentary\s+|male\s+|female\s+|healthy\s+|young\s+|older\s+|college\s+)*(?:participants?|students?|men|women|males?|females?|subjects?|adults?|volunteers?|patients?|people)\b/i.test(
      after,
    )
  ) {
    return false;
  }
  if (/\b(?:doses?|dosages?)\s*(?:of\s*)?$/i.test(before)) return false;
  if (/\b(?:heart\s+rates?|pulse|bpm|beats?)\b/i.test(before.slice(-40))) return false;
  if (/^(?:\s*|-\s*)(?:bpm|beats?)\b/i.test(after)) return false;
  if (
    /(?:\b(?:Cohen(?:'s)?\s+)?d\s*=\s*|\b(?:OR|HR|RR|SMD|AOR|β|beta)\s*=\s*|\beffect\s+sizes?\s*(?:of\s*)?|\bodds\s+ratios?\s*(?:of\s*)?|\bhazard\s+ratios?\s*(?:of\s*)?)$/i.test(
      before,
    )
  ) {
    return false;
  }
  const unit = timeUnitAt(text, index, raw);
  if (unit === "minute" || unit === "hour" || unit === "week") return true;
  if (MEASUREMENT_UNIT.test(after)) return false;
  if (/^(?:-\s*)?(?:,|\band\b|\bor\b)/i.test(after) && listedStrictUnit(after)) return false;
  return true;
}

const IMPLIED_TIME_QUANTITY: Record<string, Record<string, readonly string[]>> = {
  "1": {
    minute: ["דקה"],
    hour: ["שעה"],
    day: ["יום"],
    week: ["שבוע"],
    second: ["שנייה", "שניה"],
  },
  "2": {
    hour: ["שעתיים"],
    day: ["יומיים"],
    week: ["שבועיים"],
  },
};

function quantityImpliedByUnit(
  sourceText: string,
  hebrew: string,
  raw: string,
  occurrences: ReadonlyArray<{ index: number; raw: string }>,
): boolean {
  const formsByUnit = IMPLIED_TIME_QUANTITY[raw];
  if (!formsByUnit || occurrences.length === 0) return false;
  return occurrences.every((item) => {
    if (!isSmallIntegerWordEligible(sourceText, item.index, item.raw) && !isNarrativeTimeUnit(sourceText, item.index, item.raw)) {
      return false;
    }
    const unit = timeUnitAt(sourceText, item.index, item.raw);
    const forms = unit ? formsByUnit[unit] : undefined;
    if (!forms) return false;
    return forms.some((form) => hasHebrewWord(hebrew, form));
  });
}

function isNarrativeTimeUnit(text: string, index: number, raw: string): boolean {
  if (isStrictQuantityContext(text, index, raw)) return false;
  return timeUnitAt(text, index, raw) !== null;
}

function isStrictQuantityContext(text: string, index: number, raw: string): boolean {
  const before = text.slice(Math.max(0, index - 48), index);
  const after = text.slice(index + raw.length, index + raw.length + 48);
  if (/^\s*%/.test(after) || /^\s*percent(?:age)?\b/i.test(after)) return true;
  if (/(?:\bp[\s-]*values?\b[^0-9]{0,12}|\bp\s*(?:=|<|≤|>)\s*)$/i.test(before)) return true;
  if (/\b(?:CIs?|confidence\s+intervals?)\b/i.test(before)) return true;
  if (/\byears?\b/i.test(before.slice(-16)) || /^\s*-?\s*years?\b/i.test(after)) return true;
  if (/(?:\b[nN]\s*=\s*|\bsample\s+size\s*(?:of\s*)?|\bsample\s+of\s*)$/i.test(before)) return true;
  if (/\b(?:doses?|dosages?)\s*(?:of\s*)?$/i.test(before)) return true;
  if (/\b(?:heart\s+rates?|pulse|bpm|beats?)\b/i.test(before.slice(-40))) return true;
  if (/^(?:\s*|-\s*)(?:bpm|beats?|watts?|W)\b/i.test(after)) return true;
  if (
    /(?:\b(?:Cohen(?:'s)?\s+)?d\s*=\s*|\b(?:OR|HR|RR|SMD|AOR|β|beta)\s*=\s*|\beffect\s+sizes?\s*(?:of\s*)?|\bodds\s+ratios?\s*(?:of\s*)?|\bhazard\s+ratios?\s*(?:of\s*)?)$/i.test(
      before,
    )
  ) {
    return true;
  }
  return false;
}

function listedStrictUnit(after: string): boolean {
  return /\b(?:mg|mcg|µg|μg|watts?|bpm|beats?)\b/i.test(after);
}

function timeUnitAt(text: string, index: number, raw: string): "minute" | "hour" | "day" | "week" | "second" | null {
  const after = text.slice(index + raw.length, index + raw.length + 56);
  const direct = directTimeUnit(after);
  if (direct) return direct;
  if (!/^(?:-\s*)?(?:,|\band\b|\bor\b)/i.test(after)) return null;
  const listed = after.match(/\b(?:minutes?|min|hours?|hrs?|seconds?|secs?|sec|days?|weeks?)\b/i);
  return listed ? directTimeUnit(listed[0]) : null;
}

function directTimeUnit(after: string): "minute" | "hour" | "day" | "week" | "second" | null {
  if (/^\s*(?:-\s*)?(?:minutes?|min)\b/i.test(after)) return "minute";
  if (/^\s*(?:-\s*)?(?:hours?|hrs?)\b/i.test(after)) return "hour";
  if (/^\s*(?:-\s*)?(?:seconds?|secs?|sec)\b/i.test(after)) return "second";
  if (/^\s*(?:-\s*)?(?:days?)\b/i.test(after)) return "day";
  if (/^\s*(?:-\s*)?(?:weeks?)\b/i.test(after)) return "week";
  return null;
}

function hasHebrewWord(text: string, word: string): boolean {
  const pattern = new RegExp(
    `(?<![\\u05D0-\\u05EA])(?:[והבלכמש][־-]?)?${word}(?![\\u05D0-\\u05EA])`,
  );
  return pattern.test(text);
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}
