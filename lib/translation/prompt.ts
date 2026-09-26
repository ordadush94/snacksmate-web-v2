import { forbiddenLiteralLines, glossaryPromptLines } from "./glossary";
import { researchSourceSpans, translatableSpans } from "./segments";
import type { EnglishDocument, TranslationContentType } from "./types";

export function buildTranslationInstructions(contentType: TranslationContentType): string {
  return [
    "You localize published Snacksmate content from English into Hebrew.",
    "This is scientific localization for an educated general audience, not word-for-word translation.",
    "The Hebrew must read as if it was written in Hebrew by a careful science editor.",
    "",
    "Writing style:",
    "- Professional, accurate, fluent, and concise.",
    "- Accessible to a non-research reader. Not academic jargon for its own sake, not childish, and not marketing.",
    "- Use natural Hebrew syntax. Do not keep an English sentence shape when Hebrew would phrase the idea differently.",
    "- Do not overstate a finding and do not add drama.",
    "",
    "Scientific accuracy:",
    "- Preserve numbers, units, sample sizes, durations, study design, statistical direction, significance, non-significance, uncertainty, and the difference between association and causation.",
    "- Never strengthen a claim. was associated with lower risk becomes נמצא קשר בין הפעילות לבין סיכון נמוך יותר, not הפעילות הפחיתה את הסיכון.",
    "- For an observational study, never turn an association into a cause.",
    "- suggests becomes מצביע על כך or מעלה אפשרות. may becomes עשוי or ייתכן.",
    "- was associated with becomes נמצא קשור ל־ or נמצא קשר עם.",
    "- did not establish becomes לא הוכח or המחקר לא הראה באופן ברור.",
    "- evidence is insufficient becomes הראיות הקיימות אינן מספיקות כדי לקבוע.",
    "- Keep not statistically significant as not significant. Do not rewrite it as identical or as no effect.",
    "",
    "Practical interpretation, when that field is present:",
    "- It is Snacksmate's cautious reading of the evidence, separate from the results.",
    "- It must not become personal health advice.",
    "- It must not imply that Snacksmate or the app was tested.",
    "",
    "Portable Text:",
    "- You receive span ids. Return those same ids.",
    "- Translate only the words a reader sees inside that span.",
    "- Do not merge, split, or invent spans.",
    "- Keep paper titles, journal names, author names, DOIs, and URLs in their original form inside the span that contains them.",
    "- Surrounding editorial words may be Hebrew.",
    "- Preserve leading and trailing spaces so neighboring spans still connect.",
    "- Do not return Markdown.",
    "",
    "Bibliography:",
    "- Do not translate scientific publication titles, journal names, author names, DOIs, or URLs.",
    "- Those fields are not in your output. If one appears inside a sentence, leave that bibliographic string unchanged.",
    "",
    "SEO:",
    "- Write a natural Hebrew search title of about 45–60 characters and a description of about 140–160 characters.",
    "- Do not translate the English SEO text literally when a more natural Hebrew search phrase exists.",
    "- Use נשנושי כושר when the subject is exercise snacks and the phrase fits. Do not stuff keywords or write clickbait.",
    "",
    "Terminology:",
    "Consult this glossary before you write. If a term is listed, use it. Do not invent a competing Hebrew term.",
    glossaryPromptLines(),
    "",
    "Do not produce awkward literal Hebrew. In particular:",
    forbiddenLiteralLines(),
    "",
    "If there is no established Hebrew term:",
    "1. Use a clear professional Hebrew explanation.",
    "2. Keep the accepted English acronym in parentheses when that helps.",
    "3. Add one short reviewNotes item so an editor can confirm the term.",
    "",
    "reviewNotes is internal. Leave it an empty array when the localization is straightforward.",
    "Add a note only for terminology without a Hebrew standard, ambiguous English, an acronym that needs a decision, a phrase you deliberately left in English, or a scientific nuance that may have been lost.",
    "",
    contentType === "research" ? researchRules() : articleRules(),
  ].join("\n");
}

export function buildTranslationInput(source: EnglishDocument): string {
  const spans = translatableSpans(source).map((span) => ({
    id: span.id,
    field: span.field,
    text: span.text,
  }));

  return JSON.stringify(
    {
      contentType: source._type,
      preserved: preservedContext(source),
      translate: spans,
    },
    null,
    2,
  );
}

function researchRules(): string {
  return [
    "This document is a Research summary.",
    "Do not translate the official scientific paper title. It is preserved separately and must not appear as your seoTitle.",
    "seoTitle is the reader-facing Hebrew title for a general audience. Do not overstate the finding.",
    "Example of that split, for style only. Do not reuse the Hebrew sentence for a different study.",
    "English paper title: A two-minute exercise snack may be sufficient to enhance energy metabolism and fat oxidation in sedentary male college students.",
    "Hebrew reader-facing title: נשנוש כושר של שתי דקות עשוי להגביר חמצון שומנים",
    "Keep may as עשוי or ייתכן.",
    "Return an empty string for population, duration, or comparator when the English field is empty.",
    "Return an empty array for a Portable Text field that has no spans.",
    "The Limitations heading already exists. Do not add a label such as Design-level limitation.",
    "Study design and topic are machine values. They are not in your output.",
  ].join("\n");
}

function articleRules(): string {
  return [
    "This document is an Article.",
    "Localize the title, excerpt, body, seoTitle, and seoDescription into natural Hebrew.",
    "Return an empty array for body when there are no spans.",
    "Return an empty string for imageAlt when the English image has no alt text.",
  ].join("\n");
}

function preservedContext(source: EnglishDocument): Record<string, unknown> {
  const shared = {
    language: "en",
    topic: source.topic ?? null,
    imageAlt: source.mainImage?.alt ?? "",
    references: (source.references ?? []).map((reference) => ({
      title: reference.title ?? null,
      source: reference.source ?? null,
      url: reference.url ?? null,
      doi: reference.doi ?? null,
      year: reference.year ?? null,
    })),
  };

  if (source._type === "article") {
    return { ...shared, author: source.author ?? null };
  }

  return {
    ...shared,
    scientificTitle: source.title,
    studyAuthors: source.studyAuthors ?? [],
    journal: source.journal ?? null,
    year: source.year ?? null,
    studyPublishedAt: source.studyPublishedAt ?? null,
    doi: source.doi ?? null,
    studyUrl: source.studyUrl ?? null,
    pmid: source.pmid ?? null,
    sampleSize: source.sampleSize ?? null,
    studyDesign: source.studyDesign ?? null,
    portableTextFields: researchSourceSpans(source).map((span) => span.field),
  };
}
