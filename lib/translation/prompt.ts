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
    "- Never strengthen a claim.",
    "- If studyDesign is randomized-controlled-trial, controlled-trial, or crossover-study, describe the intervention contrast directly in the excerpt, mainFindings, practicalInterpretation, and seoDescription. Do not write נקשר, נקשרו, נקשרה, נקשר ל־, נמצא קשר, or נמצא קשור. Greater fat oxidation after two minutes than after one minute is לאחר שתי דקות נמצא חמצון שומנים גבוה יותר לעומת דקה אחת.",
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
    "- When the English comparison has a direction, name both sides. שתי דקות הובילו לחמצון שומנים גבוה יותר לעומת דקה אחת. Do not stop at גבוה יותר without לעומת or מאשר. Stay concise, and do not add a claim the English does not support.",
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
    "Hebrew reader-facing title: נשנוש כושר של שתי דקות וחמצון שומנים",
    "That title is shorter than 45 characters and is still acceptable. Keep may as עשוי or ייתכן when the title needs the caution. Do not add may if it makes the title a promise, and do not add it only to lengthen the title.",
    "seoDescription for that comparison. Do not copy it onto a different study, and do not overstate a long-term health effect:",
    "ניסוי מוצלב אקראי בקרב 20 סטודנטים גברים בעלי אורח חיים יושבני מצא כי שתי דקות רכיבה הובילו לחמצון שומנים גבוה יותר לעומת דקה אחת.",
    "The comparison direction has to name both sides: שתי דקות הובילו לחמצון שומנים גבוה יותר לעומת דקה אחת. Do not write only שתי דקות הובילו לחמצון שומנים גבוה יותר. Keep the description concise, near 140–160 characters, using only details the English already states.",
    "In the excerpt, main findings, practical interpretation, and SEO description, use that same direct comparison. Do not write נקשרו or נמצא קשר for this crossover result.",
    "Comparator: a within-participant or crossover comparison means the same people completed each protocol. Write השוואה בתוך אותם משתתפים. Never write בין־אישית, which means a comparison between different people.",
    "When the English is a within-participant comparison of 1-, 2-, and 3-minute exercise-snack protocols, write: השוואה בתוך אותם משתתפים בין פרוטוקולים של נשנוש כושר שנמשכו דקה, שתי דקות ושלוש דקות.",
    "Do not copy that sentence onto a study with a different design or different durations.",
    "Duration: describe one-time sessions in ordinary Hebrew. Do not write מפגשים חד־פעמיים של פעילות אקוטית, and do not translate washout as שטיפה.",
    "When the English is single acute sessions with a 7-day washout and 30 minutes of post-exercise monitoring, write: מפגשי פעילות חד־פעמיים, עם 7 ימים בין המפגשים ומעקב של 30 דקות לאחר הפעילות.",
    "Keep the days between sessions and the minutes of monitoring that the English states. Do not copy these numbers into a study with different timing.",
    "Main findings: keep every directional contrast the English states.",
    "- Which condition was higher or lower, and whether that was during exercise or during recovery.",
    "- A comparison that was not statistically significant, including the conditions that were compared.",
    "- A measure that stayed above rest, and after which protocols.",
    "- A recovery shift in fat oxidation and glucose oxidation keeps its direction: greater fat oxidation and lower glucose oxidation. Do not reduce it to חמצון השומנים והגלוקוז השתנו. Do not add gram amounts, rates, or p-values.",
    "When the practical interpretation says an acute study did not establish longer-term health benefits, write המחקר לא בחן יתרונות בריאותיים לטווח ארוך.",
    "Do not add p-values, gram amounts, or other results that are not in the English field.",
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
