import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import type { SanityClient } from "@sanity/client";

import { isEnrichmentDraftId } from "../research-enrichment/apply";
import { ELIGIBLE_DRAFTS_QUERY } from "../research-enrichment/sanity";
import { researchHreflangLanguages } from "../research-seo";
import {
  articleByLanguageAndSlugQuery,
  researchByLanguageAndSlugQuery,
  researchByLanguageQuery,
  researchTranslationQuery,
} from "../../sanity/lib/queries";
import { parseTranslationArgs } from "./args";
import {
  assertHebrewDraftId,
  buildHebrewDraft,
  hebrewDraftId,
  matchingHebrewLink,
  readingDirection,
  sharedTranslationSlug,
} from "./document";
import {
  FORBIDDEN_HEBREW_LITERALS,
  glossaryMatches,
  HEBREW_SCIENTIFIC_GLOSSARY,
  missingGlossaryTerms,
} from "./glossary";
import { buildTranslationRequest, requestHebrewLocalization } from "./openai";
import { buildTranslationInstructions } from "./prompt";
import {
  associationWarnings,
  awkwardPhrasingWarnings,
  mainFindingDirectionWarnings,
  numberWarnings,
  participantWordingWarnings,
  preservationWarnings,
  seoLengthWarnings,
  suspiciousLiteralWarnings,
  textLength,
} from "./quality";
import { runHebrewTranslation } from "./run";
import { createHebrewDraft, HEBREW_LINKS_QUERY, PUBLISHED_ENGLISH_BY_ID_QUERY } from "./sanity";
import { parseTranslation, TranslationValidationError } from "./schema";
import { portableTextSpans, translatableSpans } from "./segments";
import type { EnglishArticle, EnglishResearch, HebrewDraft, ResearchTranslation } from "./types";

const MODEL = "gpt-5.6-luna";
const TRANSLATED_AT = "2026-09-26T20:00:00.000Z";

test("glossary is the only terminology source and matches longer phrases first", () => {
  const promptSource = readFileSync(new URL("./prompt.ts", import.meta.url), "utf8");
  const instructions = buildTranslationInstructions("research");

  assert.doesNotMatch(promptSource, /Do not translate the acronym/);
  for (const entry of HEBREW_SCIENTIFIC_GLOSSARY) {
    for (const hebrew of entry.hebrew) {
      assert.equal(instructions.includes(hebrew), true, hebrew);
    }
  }
  for (const item of FORBIDDEN_HEBREW_LITERALS) {
    assert.equal(instructions.includes(item.pattern), true, item.pattern);
  }

  assert.deepEqual(
    glossaryMatches("exercise snacks").map((match) => match.id),
    ["exercise-snacks"],
  );
  assert.deepEqual(
    glossaryMatches("an exercise snack").map((match) => match.id),
    ["exercise-snack"],
  );
  assert.deepEqual(
    missingGlossaryTerms("exercise snacks", "נשנושי כושר"),
    [],
  );
  assert.equal(
    missingGlossaryTerms("exercise snacks", "נשנוש כושר").some((match) => match.id === "exercise-snacks"),
    true,
  );
  assert.equal(
    missingGlossaryTerms("was associated with lower risk", "נמצא קשר וסיכון נמוך יותר").length,
    0,
  );
  assert.match(instructions, /בעלי אורח חיים יושבני/);
  assert.match(instructions, /45–60 characters is a target, not a minimum/);
  assert.match(instructions, /מפגשי פעילות חד־פעמיים/);
  assert.match(instructions, /לאחר שתי דקות נמצא חמצון שומנים גבוה יותר לעומת דקה אחת/);
});

test("suspicious literal Hebrew is flagged", () => {
  const warnings = suspiciousLiteralWarnings(
    "נשנוש תרגיל, סקירת מטריית, פעילות חיים נמרצת, ישיבה התנהגותית",
  );
  assert.equal(warnings.length, FORBIDDEN_HEBREW_LITERALS.length);
});

test("article portable text keeps structure and bibliographic strings", () => {
  const source = articleFixture();
  const draft = buildHebrewDraft({
    source,
    translation: articleTranslation(),
    model: MODEL,
    translatedAt: TRANSLATED_AT,
  });
  const body = draft.body as Array<Record<string, unknown>>;
  const original = source.body as Array<Record<string, unknown>>;

  assert.equal(body.length, 1);
  assert.equal(body[0]._key, "b1");
  assert.equal(body[0]._type, "block");
  assert.equal(body[0].style, "h2");
  assert.equal(body[0].listItem, "bullet");
  assert.equal(body[0].level, 1);
  assert.deepEqual(body[0].markDefs, original[0].markDefs);
  const children = body[0].children as Array<Record<string, unknown>>;
  assert.deepEqual(
    children.map((child) => child._key),
    ["s1", "s2", "s3"],
  );
  assert.deepEqual(children[1].marks, ["strong", "link1"]);
  assert.equal(children[2].text?.toString().includes("The Lancet"), true);
  assert.equal(children[2].text?.toString().includes("10.1000/example"), true);
  assert.deepEqual(draft.references, source.references);
  assert.equal(draft.translationReviewNote, undefined);
});

test("research preserves numbers, DOI, journal, title, and sample size", () => {
  const source = researchFixture();
  const draft = buildHebrewDraft({
    source,
    translation: researchTranslation(),
    model: MODEL,
    translatedAt: TRANSLATED_AT,
  });

  assert.equal(draft.title, source.title);
  assert.equal(draft.journal, "Frontiers in physiology");
  assert.equal(draft.doi, "10.3389/fphys.2026.1929244");
  assert.equal(draft.sampleSize, 20);
  assert.equal(draft.studyUrl, source.studyUrl);
  assert.equal(draft.studyDesign, "crossover-study");
  assert.equal(draft.topic, "exercise-snacks");
  assert.deepEqual(draft.studyAuthors, source.studyAuthors);
  assert.equal(draft.pmid, "42798426");
  assert.equal(String(plain(draft.intervention)).includes("180"), true);
  assert.equal(String(plain(draft.intervention)).includes("30"), true);
  assert.equal(draft.excerpt.includes("20"), true);
  assert.equal(draft.translationSlug, source.slug);
  assert.match(draft.translationReviewNote ?? "", /language switch/);
  assert.doesNotMatch(
    draft.translationReviewNote ?? "",
    /missing source number|SEO title|פעילות אקוטית|בעלי התנהגות יושבנית/,
  );
  assert.equal(translatableSpans(source).some((span) => span.id === "title"), false);
  assert.equal(portableTextSpans(source.limitations, "limitations")[0].text.startsWith("Design-level"), false);
  assert.equal(String(plain(draft.limitations)).includes("Design-level limitation"), false);

  const tampered = { ...draft, doi: "10.9999/translated", journal: "חזיתות בפיזיולוגיה", sampleSize: 21 };
  const warnings = preservationWarnings(source, tampered);
  assert.equal(warnings.some((warning) => warning.includes("DOI")), true);
  assert.equal(warnings.some((warning) => warning.includes("Journal")), true);
  assert.equal(warnings.some((warning) => warning.includes("Sample size")), true);
});

test("observational association wording is not turned into causation", () => {
  const sourceText = "Walking was associated with lower risk.";
  const causal = associationWarnings({
    sourceText,
    hebrew: "ההליכה הפחיתה את הסיכון.",
    studyDesign: "cohort-study",
  });
  assert.equal(causal.length, 1);
  const cautious = associationWarnings({
    sourceText,
    hebrew: "נמצא קשר בין ההליכה לבין סיכון נמוך יותר.",
    studyDesign: "observational-study",
  });
  assert.deepEqual(cautious, []);
  const trial = associationWarnings({
    sourceText: "The trial reduced postprandial glucose.",
    hebrew: "הניסוי הפחית את גלוקוז לאחר הארוחה.",
    studyDesign: "randomized-controlled-trial",
  });
  assert.deepEqual(trial, []);
});

test("SEO titles are warned only when vague or longer than 60", () => {
  assert.deepEqual(seoLengthWarnings(hebrewChars(50), hebrewChars(150)), []);
  assert.deepEqual(
    seoLengthWarnings("נשנוש כושר של שתי דקות וחמצון שומנים", hebrewChars(150)),
    [],
  );
  assert.deepEqual(seoLengthWarnings(hebrewChars(44), hebrewChars(150)), []);
  const longTitle = seoLengthWarnings(hebrewChars(61), hebrewChars(150));
  assert.equal(longTitle.length, 1);
  assert.match(longTitle[0], /longer than 60/);
  const description = seoLengthWarnings(hebrewChars(50), hebrewChars(161));
  assert.equal(description.length, 1);
  assert.match(description[0], /SEO description/);
  const vague = seoLengthWarnings("מחקר", hebrewChars(150));
  assert.equal(vague.length, 1);
  assert.match(vague[0], /too vague/);
  assert.equal(textLength(hebrewChars(50)), 50);
});

test("Hebrew words for 1–10 preserve ordinary counts and do not replace strict numbers", () => {
  assert.deepEqual(numberWarnings("1 minute", "דקה אחת", "duration"), []);
  assert.deepEqual(numberWarnings("2 minutes", "שתי דקות", "duration"), []);
  assert.deepEqual(numberWarnings("3 minutes", "שלוש דקות", "duration"), []);
  assert.deepEqual(numberWarnings("2 minutes", "שני דקות", "duration"), []);
  assert.deepEqual(numberWarnings("1-, 2-, and 3-minute", "דקה אחת, שתי דקות ושלוש דקות", "comparator"), []);
  assert.deepEqual(
    numberWarnings(
      "lasting 1, 2, or 3 minutes, with 10 seconds and 30 W",
      "דקה אחת, שתי דקות או שלוש דקות, עם 10 שניות ו־30 ואט",
      "intervention",
    ),
    [],
  );

  const seconds = numberWarnings("every 10 seconds", "כל עשר שניות", "intervention");
  assert.equal(seconds.length, 1);
  assert.match(seconds[0], /10/);
  const watts = numberWarnings("30 W", "שלושים ואט", "intervention");
  assert.match(watts[0], /30/);
  const washout = numberWarnings("a 7-day washout", "שבעה ימים בין המפגשים", "duration");
  assert.match(washout[0], /7/);
  const sample = numberWarnings("In 20 students", "בקרב עשרים סטודנטים", "excerpt");
  assert.match(sample[0], /20/);
  const smallSample = numberWarnings("n = 8", "שמונה משתתפים", "excerpt");
  assert.match(smallSample[0], /\b8\b/);
  const participants = numberWarnings("2 men", "שני גברים", "population");
  assert.match(participants[0], /\b2\b/);
  const percent = numberWarnings("fat oxidation rose 5%", "עלייה של חמישה אחוזים", "findings");
  assert.match(percent[0], /5/);
  const year = numberWarnings("published in 2026", "פורסם בשנת אלפיים", "excerpt");
  assert.match(year[0], /2026/);
  const dose = numberWarnings("a 2 mg dose", "מנה של שני מיליגרם", "intervention");
  assert.match(dose[0], /\b2\b/);
  const effect = numberWarnings("HR = 2", "יחס סיכונים של שתיים", "findings");
  assert.match(effect[0], /\b2\b/);
  const interval = numberWarnings("95% CI 1 to 4", "רווח בר-סמך מאחת עד ארבע", "findings");
  assert.match(interval[0], /95/);
  assert.match(interval[0], /\b1\b/);
  const probability = numberWarnings("p = 0.05", "ערך p של חמש מאיות", "findings");
  assert.match(probability[0], /0\.05/);
  assert.deepEqual(numberWarnings("10 seconds and 2 minutes", "10 שניות ושתי דקות", "intervention"), []);
  assert.equal(numberWarnings("2 minutes and 2 mg", "שתי דקות ושני מיליגרם", "intervention").some((warning) => warning.includes("2")), true);
});

test("intervention contrasts are not forced into association wording", () => {
  const crossover = associationWarnings({
    sourceText: "Two minutes increased fat oxidation compared with one minute.",
    hebrew: "שתי דקות נקשרו לחמצון שומנים גבוה יותר.",
    studyDesign: "crossover-study",
  });
  assert.equal(crossover.length, 1);
  assert.match(crossover[0], /נמצא קשר/);
  assert.deepEqual(
    associationWarnings({
      sourceText: "Two minutes increased fat oxidation compared with one minute.",
      hebrew: "לאחר שתי דקות נמצא חמצון שומנים גבוה יותר לעומת דקה אחת.",
      studyDesign: "crossover-study",
    }),
    [],
  );
  assert.deepEqual(
    associationWarnings({
      sourceText: "A randomized crossover study found greater fat oxidation with 2 minutes.",
      hebrew:
        "ניסוי מוצלב אקראי מצא כי שתי דקות רכיבה הובילו לחמצון שומנים גבוה יותר לעומת דקה אחת.",
      studyDesign: "crossover-study",
    }),
    [],
  );
  const missingAssociation = associationWarnings({
    sourceText: "Walking was associated with lower risk.",
    hebrew: "ההליכה הופיעה יחד עם סיכון נמוך יותר.",
    studyDesign: "cohort-study",
  });
  assert.equal(missingAssociation.length, 1);
  assert.match(missingAssociation[0], /נמצא קשר/);
  assert.equal(participantWordingWarnings("בעלי התנהגות יושבנית").length, 1);
  assert.deepEqual(participantWordingWarnings("בעלי אורח חיים יושבני"), []);
  assert.deepEqual(participantWordingWarnings("התנהגות יושבנית"), []);
  assert.equal(awkwardPhrasingWarnings("מפגשים חד־פעמיים של פעילות אקוטית").length, 1);
  assert.deepEqual(
    awkwardPhrasingWarnings("מפגשי פעילות חד־פעמיים, עם 7 ימים בין המפגשים ומעקב של 30 דקות לאחר הפעילות"),
    [],
  );
  const sourceFindings =
    "During exercise, 2 minutes increased total fat oxidation compared with 1 minute, while results were not significantly different from 3 minutes. Energy expenditure remained above resting levels throughout recovery after the 2- and 3-minute protocols; recovery fat and glucose oxidation also shifted.";
  const kept =
    "במהלך המאמץ נמצא חמצון שומנים גבוה יותר לאחר שתי דקות לעומת דקה אחת, ללא הבדל מובהק לעומת שלוש דקות. ההוצאה האנרגטית נשארה מעל רמת המנוחה. בהתאוששות חל שינוי בחמצון שומנים ובחמצון גלוקוז.";
  assert.deepEqual(mainFindingDirectionWarnings(sourceFindings, kept), []);
  const dropped = mainFindingDirectionWarnings(sourceFindings, "נמצאה תגובה מטבולית.");
  assert.equal(dropped.length >= 4, true);
});

test("Hebrew drafts link on translationSlug and do not duplicate", async () => {
  const source = researchFixture();
  source.translationSlug = "two-minute-exercise-snack";
  assert.equal(sharedTranslationSlug(source), "two-minute-exercise-snack");
  const draft = buildHebrewDraft({
    source,
    translation: researchTranslation(),
    model: MODEL,
    translatedAt: TRANSLATED_AT,
  });
  assert.equal(draft.translationSlug, "two-minute-exercise-snack");
  assert.equal(draft.translationSourceId, "research-pubmed-42798426");
  assert.equal(draft.language, "he");
  assert.equal(readingDirection(draft.language), "rtl");
  assert.equal(draft._id, "drafts.research-he-research-pubmed-42798426");

  const existing = {
    _id: draft._id,
    translationSourceId: draft.translationSourceId,
    translationSlug: draft.translationSlug,
    slug: draft.slug.current,
  };
  assert.equal(matchingHebrewLink(source, [existing])?._id, draft._id);
  assert.equal(
    matchingHebrewLink(source, [{ _id: "drafts.other", translationSlug: "two-minute-exercise-snack" }])?._id,
    "drafts.other",
  );

  let translated = 0;
  let writes = 0;
  const skipped = await runHebrewTranslation({
    dryRun: false,
    model: MODEL,
    sources: [source],
    existing: [existing],
    translate: async () => {
      translated += 1;
      return researchTranslation();
    },
    writeDraft: async () => {
      writes += 1;
    },
    log: () => undefined,
  });
  assert.equal(translated, 0);
  assert.equal(writes, 0);
  assert.equal(skipped.skipped, 1);
});

test("Hebrew documents are RTL drafts and are never published", async () => {
  const source = researchFixture();
  const draft = buildHebrewDraft({
    source,
    translation: researchTranslation(),
    model: MODEL,
    translatedAt: TRANSLATED_AT,
  });
  assert.equal(draft.language, "he");
  assert.equal(readingDirection("he"), "rtl");
  assert.equal(draft.translationStatus, "needs_review");
  assert.equal(draft.editorialStatus, "needs_review");
  assert.equal(draft._id.startsWith("drafts."), true);
  assert.equal(isEnrichmentDraftId(draft._id), false);
  assert.equal("importSource" in draft, false);
  assert.equal("canonicalUrl" in draft, false);
  assert.match(ELIGIBLE_DRAFTS_QUERY, /importSource == "pubmed"/);
  assert.equal(hebrewDraftId("research", "drafts.research-pubmed-42798426"), draft._id);
  assert.throws(() => assertHebrewDraftId("research-pubmed-42798426"));

  const calls: string[] = [];
  const client = {
    create: async (document: HebrewDraft) => {
      calls.push(`create:${document._id}`);
    },
  };
  await createHebrewDraft(client as unknown as SanityClient, draft);
  assert.deepEqual(calls, [`create:${draft._id}`]);
  await assert.rejects(() =>
    createHebrewDraft(client as unknown as SanityClient, {
      ...draft,
      _id: "research-he-research-pubmed-42798426",
    }),
  );

  let writes = 0;
  const summary = await runHebrewTranslation({
    dryRun: true,
    model: MODEL,
    sources: [source],
    existing: [],
    translate: async () => researchTranslation(),
    writeDraft: async () => {
      writes += 1;
    },
    now: () => TRANSLATED_AT,
    log: () => undefined,
  });
  assert.equal(writes, 0);
  assert.equal(summary.created, 0);
  assert.equal(summary.dryRun, 1);
  assert.match(summary.reports[0], /Nothing was published|Published: no/);
  assert.match(summary.reports[0], /Hebrew seoTitle/);
  assert.match(summary.reports[0], /practical interpretation/);

  const writer = readFileSync(new URL("./sanity.ts", import.meta.url), "utf8");
  assert.equal(writer.includes(".publish("), false);
  assert.equal(writer.includes("createOrReplace"), false);
  assert.equal(HEBREW_LINKS_QUERY.includes('path("drafts.**")'), false);
  assert.equal(PUBLISHED_ENGLISH_BY_ID_QUERY.includes('path("drafts.**")'), true);
  for (const query of [researchByLanguageQuery, researchByLanguageAndSlugQuery, articleByLanguageAndSlugQuery]) {
    assert.equal(query.includes("translationReviewNote"), false);
    assert.equal(query.includes("translationSourceId"), false);
    assert.equal(query.includes("translationStatus"), false);
  }
});

test("strict structured output rejects a broken translation before a draft exists", () => {
  const source = researchFixture();
  assert.throws(
    () =>
      parseTranslation(source, {
        ...researchPayload(),
        mainFindings: [],
      }),
    TranslationValidationError,
  );
  assert.throws(
    () =>
      parseTranslation(source, {
        ...researchPayload(),
        seoTitle: source.title,
      }),
    TranslationValidationError,
  );

  const request = buildTranslationRequest({
    model: MODEL,
    contentType: "research",
    instructions: "instructions",
    input: "{}",
  });
  const text = request.text as { format: { type: string; name: string; strict: boolean } };
  assert.equal(request.store, false);
  assert.equal(text.format.type, "json_schema");
  assert.equal(text.format.strict, true);
  assert.equal(text.format.name, "hebrew_research_localization");
  assert.deepEqual(request.reasoning, { effort: "none" });
});

test("translation request keeps the API key out of the body", async () => {
  const source = articleFixture();
  source.body = [];
  const secret = "sk-test-secret-value";
  let body = "";
  const result = await requestHebrewLocalization({
    apiKey: secret,
    model: MODEL,
    source,
    sleep: async () => undefined,
    fetchImpl: async (_url, init) => {
      body = String(init?.body ?? "");
      const headers = new Headers(init?.headers);
      assert.equal(headers.get("authorization"), `Bearer ${secret}`);
      return Response.json({
        status: "completed",
        output: [
          {
            type: "message",
            content: [
              {
                type: "output_text",
                text: JSON.stringify({
                  title: "כותרת בעברית טבעית לקוראים",
                  excerpt: "תקציר בעברית על נשנושי כושר בלי להגזים בממצאים ובלי עצות בריאות.",
                  seoTitle: hebrewChars(50),
                  seoDescription: hebrewChars(150),
                  body: [],
                  imageAlt: "",
                  reviewNotes: [],
                }),
              },
            ],
          },
        ],
      });
    },
  });
  assert.equal(body.includes(secret), false);
  assert.equal(result.kind, "article");
});

test("an English research page finds Hebrew by translationSlug when its own translationSlug is empty", () => {
  const englishSlug =
    "a-two-minute-exercise-snack-may-be-sufficient-to-enhance-energy-metabolism-and-fat-oxidation-in";
  const page = readFileSync(
    new URL("../../app/[lang]/research/[slug]/page.tsx", import.meta.url),
    "utf8",
  );

  assert.match(researchTranslationQuery, /translationSlug == \$slug/);
  assert.match(researchTranslationQuery, /slug\.current == \$translationSlug/);
  assert.equal(page.includes("research.translationSlug?.trim() || slug"), true);
  assert.equal(page.includes("translationKey"), false);

  const languages = researchHreflangLanguages(
    { slug: englishSlug, language: "en" },
    { slug: englishSlug, language: "he", translationSlug: englishSlug },
  );
  assert.equal(
    languages.he,
    `https://www.snacksmate.com/he/research/${englishSlug}/`,
  );
  assert.equal(
    languages.en,
    `https://www.snacksmate.com/en/research/${englishSlug}/`,
  );
});

test("bulk translation defaults to dry-run and a single id can target one document", () => {
  const bulk = parseTranslationArgs(["--missing", "--type=research"]);
  assert.equal(bulk.dryRun, true);
  assert.equal(bulk.limit, 5);
  const explicit = parseTranslationArgs(["--missing", "--type=article", "--dry-run"]);
  assert.equal(explicit.dryRun, true);
  const write = parseTranslationArgs(["--missing", "--type=research", "--write", "--limit=2"]);
  assert.equal(write.dryRun, false);
  assert.equal(write.limit, 2);
  const single = parseTranslationArgs(["--type=research", "--id=research-pubmed-42798426", "--dry-run"]);
  assert.equal(single.dryRun, true);
  assert.equal(single.id, "research-pubmed-42798426");
  assert.throws(() => parseTranslationArgs(["--missing", "--type=research", "--limit=100"]));
  assert.throws(() => parseTranslationArgs(["--type=research"]));
});

function articleFixture(): EnglishArticle {
  return {
    _id: "article-exercise",
    _type: "article",
    language: "en",
    title: "What is an exercise snack?",
    slug: "what-is-an-exercise-snack",
    translationSlug: "what-is-an-exercise-snack",
    excerpt:
      "A short explanation of exercise snacks for readers who want the idea without a methods section or a sales pitch.",
    seoTitle: "Exercise snacks, explained",
    seoDescription: "A plain-language explanation of exercise snacks and what the term means.",
    author: "Snacksmate",
    publishedAt: "2026-09-26T15:51:00.000Z",
    topic: "exercise-snacks",
    body: [
      {
        _key: "b1",
        _type: "block",
        style: "h2",
        listItem: "bullet",
        level: 1,
        markDefs: [{ _key: "link1", _type: "link", href: "https://doi.org/10.1000/example" }],
        children: [
          { _type: "span", _key: "s1", text: "Read the ", marks: [] },
          { _type: "span", _key: "s2", text: "trial", marks: ["strong", "link1"] },
          {
            _type: "span",
            _key: "s3",
            text: " in The Lancet. DOI 10.1000/example. Exercise snacks and metabolic health.",
            marks: ["em"],
          },
        ],
      },
    ],
    references: [
      {
        _key: "ref1",
        _type: "articleReference",
        title: "Exercise snacks and metabolic health",
        source: "The Lancet",
        url: "https://doi.org/10.1000/example",
        doi: "10.1000/example",
        year: 2024,
      },
    ],
  };
}

function articleTranslation() {
  return {
    kind: "article" as const,
    title: "מהו נשנוש כושר?",
    excerpt:
      "הסבר קצר על נשנושי כושר לקוראים שרוצים את הרעיון בלי פרק שיטות ובלי שפת שיווק.",
    seoTitle: hebrewChars(50),
    seoDescription: hebrewChars(150),
    body: [
      { id: "body.0.children.0", text: "קראו את " },
      { id: "body.0.children.1", text: "הניסוי" },
      {
        id: "body.0.children.2",
        text: " ב-The Lancet. DOI 10.1000/example. Exercise snacks and metabolic health על נשנושי כושר.",
      },
    ],
    imageAlt: null,
    reviewNotes: [],
  };
}

function researchFixture(): EnglishResearch {
  return {
    _id: "research-pubmed-42798426",
    _type: "research",
    language: "en",
    title:
      "A two-minute exercise snack may be sufficient to enhance energy metabolism and fat oxidation in sedentary male college students.",
    slug: "a-two-minute-exercise-snack-may-be-sufficient-to-enhance-energy-metabolism-and-fat-oxidation-in",
    translationSlug: null,
    excerpt:
      "In 20 sedentary male college students, randomized crossover testing compared 1-, 2-, and 3-minute cycling exercise snacks. Two minutes produced more fat oxidation than one minute and effects broadly similar to three minutes.",
    seoTitle: "Two-Minute Exercise Snacks and Fat Oxidation",
    seoDescription:
      "A randomized crossover study in 20 sedentary male college students compared 1-, 2-, and 3-minute cycling snacks, finding greater fat oxidation with 2 minutes.",
    topic: "exercise-snacks",
    publishedAt: "2026-09-26T15:51:00.000Z",
    studyAuthors: ["Zhihao Gao", "Yanbai Han"],
    journal: "Frontiers in physiology",
    year: 2026,
    studyPublishedAt: "2026-09-11",
    doi: "10.3389/fphys.2026.1929244",
    studyUrl: "https://doi.org/10.3389/fphys.2026.1929244",
    pmid: "42798426",
    studyDesign: "crossover-study",
    population: "Twenty sedentary male college students",
    sampleSize: 20,
    duration:
      "Single acute sessions with a 7-day washout and 30 minutes of post-exercise recovery monitoring",
    comparator: "Within-participant comparison of 1-, 2-, and 3-minute exercise-snack protocols",
    outcomes: ["energy expenditure", "fat oxidation", "glucose oxidation", "physiological indices"],
    intervention: blocks(
      "intervention1",
      "Cycle-ergometer exercise snacks lasting 1, 2, or 3 minutes. Exercise used incremental loading of 30 W every 10 seconds to 180 W; the 1-minute protocol ended on reaching 180 W, while the longer protocols maintained 180 W until completion.",
    ),
    mainFindings: blocks(
      "mainFindings1",
      "All protocols produced acute metabolic responses. During exercise, 2 minutes increased total fat oxidation compared with 1 minute, while results were not significantly different from 3 minutes. Energy expenditure remained above resting levels throughout recovery after the 2- and 3-minute protocols; recovery fat and glucose oxidation also shifted.",
    ),
    practicalInterpretation: blocks(
      "practicalInterpretation1",
      "In these sedentary male college students, a 2-minute cycling snack produced greater exercise-period fat oxidation than 1 minute and broadly similar responses to 3 minutes. The study did not establish longer-term health benefits.",
    ),
    limitations: blocks(
      "limitations1",
      "Design-level limitation: The study used a small sample of sedentary male college students and assessed acute responses in a randomized crossover design, so longer-term effects and applicability to other populations are uncertain.",
    ),
    editorialStatus: "published",
  };
}

function researchTranslation(): ResearchTranslation {
  return {
    kind: "research",
    excerpt:
      "בקרב 20 סטודנטים יושבניים, בדיקה מוצלבת אקראית השוותה נשנושי כושר של 1, 2 ו־3 דקות על אופניים. שתי דקות לוו ביותר חמצון שומנים מאשר דקה אחת, והתגובה הייתה דומה בקירוב לשלוש דקות.",
    seoTitle: "נשנוש כושר של שתי דקות עשוי להגביר חמצון שומנים",
    seoDescription: sizedSeoDescription(
      "מחקר מוצלב ב־20 סטודנטים השווה נשנושי כושר של 1, 2 ו־3 דקות ומצא יותר חמצון שומנים ב־2 דקות, בלי להסיק מעבר למדגם.",
    ),
    population: "עשרים סטודנטים גברים בעלי אורח חיים יושבני",
    duration: "מפגשי פעילות חד־פעמיים, עם 7 ימים בין המפגשים ומעקב של 30 דקות לאחר הפעילות",
    comparator: "השוואה בתוך הנבדק בין פרוטוקולי נשנוש כושר של 1, 2 ו־3 דקות",
    outcomes: [
      { id: "outcomes.0", text: "הוצאה אנרגטית" },
      { id: "outcomes.1", text: "חמצון שומנים" },
      { id: "outcomes.2", text: "חמצון גלוקוז" },
      { id: "outcomes.3", text: "מדדים פיזיולוגיים" },
    ],
    intervention: [
      {
        id: "intervention.0.children.0",
        text: "נשנושי כושר על ארגומטר אופניים למשך 1, 2 או 3 דקות. העומס עלה ב־30 ואט כל 10 שניות עד 180 ואט. פרוטוקול ה־1 דקה הסתיים בהגעה ל־180 ואט, והפרוטוקולים הארוכים שמרו על 180 ואט עד הסיום.",
      },
    ],
    mainFindings: [
      {
        id: "mainFindings.0.children.0",
        text: "כל הפרוטוקולים עוררו תגובה מטבולית. במהלך המאמץ, 2 דקות העלו את סך חמצון שומנים לעומת 1 דקה, והתוצאות לא נבדלו באופן מובהק מ־3 דקות. הוצאה אנרגטית נשארה מעל רמת המנוחה לאורך ההתאוששות אחרי פרוטוקולי 2 ו־3 הדקות. בהתאוששות חל שינוי בחמצון שומנים ובחמצון גלוקוז.",
      },
    ],
    practicalInterpretation: [
      {
        id: "practicalInterpretation.0.children.0",
        text: "אצל הסטודנטים האלה, נשנוש רכיבה של 2 דקות לווה בחמצון שומנים גבוה יותר בזמן המאמץ מאשר 1 דקה, ובתגובה דומה בקירוב ל־3 דקות. המחקר לא הראה באופן ברור תועלת בריאותית לטווח ארוך.",
      },
    ],
    limitations: [
      {
        id: "limitations.0.children.0",
        text: "המדגם קטן וכלל סטודנטים יושבניים בלבד, והמדידה הייתה חדה במחקר מוצלב, ולכן התוצאה לטווח ארוך וההתאמה לאוכלוסיות אחרות אינן ודאיות.",
      },
    ],
    snacksmateRelevance: [],
    imageAlt: null,
    reviewNotes: [],
  };
}

function researchPayload(): Record<string, unknown> {
  const translation = researchTranslation();
  return {
    excerpt: translation.excerpt,
    seoTitle: translation.seoTitle,
    seoDescription: translation.seoDescription,
    population: translation.population,
    duration: translation.duration,
    comparator: translation.comparator,
    outcomes: translation.outcomes,
    intervention: translation.intervention,
    mainFindings: translation.mainFindings,
    practicalInterpretation: translation.practicalInterpretation,
    limitations: translation.limitations,
    snacksmateRelevance: [],
    imageAlt: "",
    reviewNotes: [],
  };
}

function blocks(key: string, text: string) {
  return [
    {
      _key: key,
      _type: "block",
      style: "normal",
      markDefs: [],
      children: [{ _key: `${key}s`, _type: "span", text, marks: [] }],
    },
  ];
}

function plain(value: unknown): string {
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

function hebrewChars(length: number): string {
  return "ע".repeat(length);
}

function sizedSeoDescription(seed: string): string {
  let value = seed;
  while (textLength(value) < 140) value += " מידע";
  if (textLength(value) > 160) {
    throw new Error(`SEO description fixture is ${textLength(value)} characters.`);
  }
  return value;
}
