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
    "- In ordinary prose, write simple durations as words and keep them consistent: דקה, שתי דקות, שלוש דקות. Do not mix those with 2 דקות or 3 דקות. Keep digits for scientific quantities such as sample size, watts, seconds, heart rate, doses, and durations of 30 minutes or more.",
    "- Never strengthen a claim.",
    "- If studyDesign is randomized-controlled-trial, controlled-trial, or crossover-study, describe the intervention contrast directly in the excerpt, mainFindings, practicalInterpretation, and seoDescription. Do not write נקשר, נקשרו, נקשרה, נקשר ל־, נמצא קשר, or נמצא קשור. Outcome A was higher after condition B than condition A becomes לאחר מצב B נמדד ערך גבוה יותר של מדד A לעומת מצב A.",
    "- Association wording is mandatory only for observational and cohort studies, and for English that says associated or association. was associated with lower risk becomes נמצא קשר בין הפעילות לבין סיכון נמוך יותר, not הפעילות הפחיתה את הסיכון.",
    "- Do not translate an immediate physiological or metabolic response as חריפות. That sounds like disease severity. Prefer מיידיות. acute metabolic responses becomes תגובות מטבוליות מיידיות. acute effects becomes השפעות מיידיות. acute crossover study becomes מחקר מוצלב שבחן תגובות מיידיות. Use אקוטיות only when the technical term is appropriate. Do not change the scientific meaning.",
    "- suggests becomes מצביע על כך or מעלה אפשרות. may becomes עשוי or ייתכן.",
    "- did not establish, for a result the study actually tested, becomes לא הוכח or המחקר לא הראה באופן ברור. When an acute study says it did not establish longer-term health benefits, the long-term outcome was not measured. Write המחקר לא בחן יתרונות בריאותיים לטווח ארוך. Do not imply that long-term benefit was tested and came out unclear.",
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
    "- seoTitle: 45–60 characters is a target, not a minimum. A shorter title is fine when it is clear, accurate, natural, and not clickbait. Do not pad a title to reach 45. Avoid a vague title and a title longer than 60 characters.",
    "- seoDescription stays about 140–160 characters.",
    "- When the English comparison has a direction, name both sides. לאחר מצב B נמדד ערך גבוה יותר של מדד A לעומת מצב A. Do not stop at גבוה יותר without לעומת or מאשר. Stay concise, and do not add a claim the English does not support.",
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
    "A clear title may be shorter than 45 characters. Keep may as עשוי or ייתכן when the title needs the caution. Do not add may if it makes the title a promise, and do not add it only to lengthen the title.",
    "Keep seoDescription near 140–160 characters, using only details the English already states.",
    "These examples teach the rule. Do not copy them onto a study whose English says something else.",
    "Observational association. Do not turn it into a causal effect.",
    "English: Walking was associated with lower risk.",
    "Hebrew: נמצא קשר בין ההליכה לבין סיכון נמוך יותר.",
    "Intervention contrast. Name both sides, and keep increase or decrease.",
    "English: Outcome A was higher after condition B than condition A.",
    "Hebrew: לאחר מצב B נמדד ערך גבוה יותר של מדד A לעומת מצב A.",
    "English: Outcome A was lower after condition B than condition A.",
    "Hebrew: לאחר מצב B נמדד ערך נמוך יותר של מדד A לעומת מצב A.",
    "Statistical non-significance:",
    "English: The difference between conditions was not statistically significant.",
    "Hebrew: לא נמצא הבדל מובהק סטטיסטית בין התנאים.",
    "Within-participant crossover. The same people completed each condition. Write השוואה בתוך אותם משתתפים. Never write בין־אישית.",
    "English: Participants completed each condition in a crossover design.",
    "Hebrew: אותם משתתפים השלימו כל אחד מתנאי המחקר במסגרת מחקר מוצלב.",
    "Acute result versus a long-term outcome the study did not measure:",
    "English: The acute study did not establish longer-term health benefits.",
    "Hebrew: המחקר לא בחן יתרונות בריאותיים לטווח ארוך.",
    "In the excerpt, main findings, practical interpretation, and SEO description, describe a randomized, controlled, or crossover contrast directly. Do not write נקשרו or נמצא קשר for that contrast.",
    "Duration: describe one-time sessions in ordinary Hebrew. Do not write מפגשים חד־פעמיים של פעילות אקוטית, and do not translate washout as שטיפה. Prefer מפגשי פעילות חד־פעמיים, and state the days between sessions and the minutes of monitoring that the English gives.",
    "Main findings: keep every directional contrast the English states.",
    "- Which condition was higher or lower.",
    "- The comparison target, with לעומת or מאשר.",
    "- Whether a difference was statistically significant or not significant.",
    "- A result that was above or below a stated reference, using מעל or מתחת.",
    "- Do not collapse increase, decrease, higher, or lower into השתנה or השתנו. Do not invent a magnitude, a p-value, or a direction the English does not support.",
    "Do not add results that are not in the English field.",
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
