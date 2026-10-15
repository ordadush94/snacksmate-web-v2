import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { FORBIDDEN_HEBREW_LITERALS } from "./glossary";
import { suspiciousLiteralWarnings } from "./quality";
import {
  formatDraftDiscoveryReport,
  formatTerminologyMigrationReport,
  planTerminologyMigration,
  STATIC_CONTEXTUAL_REWRITES,
} from "./terminology-migration";
import {
  AWKWARD_EXERCISE_SNACK_HEBREW,
  CONTEXTUAL_REPLACEMENTS,
  EXERCISE_SNACK_HEBREW_EXAMPLES,
  OUTDATED_PUBLIC_HEBREW_TERMS,
  bareProductUnitSnackWarnings,
  migrateHebrewExerciseSnackText,
} from "./terminology";

const EXAMPLES = new Map(EXERCISE_SNACK_HEBREW_EXAMPLES.map((example) => [example.english, example.hebrew]));

test("contextual Hebrew keeps number, duration, and the activity", () => {
  assert.equal(EXAMPLES.get("exercise snack"), "חטיף תנועה");
  assert.equal(EXAMPLES.get("exercise snacks"), "חטיפי תנועה");
  assert.equal(EXAMPLES.get("a two-minute exercise snack"), "חטיף תנועה של שתי דקות");
  assert.equal(EXAMPLES.get("exercise snacks throughout the day"), "חטיפי תנועה לאורך היום");
  assert.equal(EXAMPLES.get("exercise-snacking intervention"), "התערבות המבוססת על חטיפי תנועה");
  assert.equal(EXAMPLES.get("cycling exercise snack"), "חטיף תנועה ברכיבה");
  assert.equal(EXAMPLES.get("participants performed exercise snacks"), "המשתתפים ביצעו חטיפי תנועה");
  assert.equal(EXAMPLES.get("exercise snack protocols"), "פרוטוקולים של חטיפי תנועה");
  assert.equal(EXAMPLES.get("stair-climbing exercise snacks"), "חטיפי תנועה המבוססים על עלייה במדרגות");
});

test("existing Hebrew migrates without stacking or breaking plurals", () => {
  assert.equal(migrateHebrewExerciseSnackText("נשנוש כושר של שתי דקות"), "חטיף תנועה של שתי דקות");
  assert.equal(migrateHebrewExerciseSnackText("נשנושי כושר לאורך היום"), "חטיפי תנועה לאורך היום");
  assert.equal(
    migrateHebrewExerciseSnackText("פרוטוקולים של נשנוש כושר שנמשכו דקה"),
    "פרוטוקולים של חטיפי תנועה שנמשכו דקה",
  );
  assert.equal(
    migrateHebrewExerciseSnackText("פרוטוקול של נשנוש כושר"),
    "פרוטוקול של חטיף תנועה",
  );
  assert.equal(migrateHebrewExerciseSnackText("נשנוש כושר ברכיבה"), "חטיף תנועה ברכיבה");
  assert.equal(
    migrateHebrewExerciseSnackText("המשתתפים ביצעו נשנושי כושר"),
    "המשתתפים ביצעו חטיפי תנועה",
  );
  assert.equal(
    migrateHebrewExerciseSnackText("חוויית נשנושי הכושר היומי"),
    "חוויית חטיפי התנועה היומית",
  );
  assert.equal(migrateHebrewExerciseSnackText("נשנוש הכושר הבא"), "חטיף התנועה הבא");
  assert.equal(
    migrateHebrewExerciseSnackText("נשנושי כושר, נשנושי טאי צ'י"),
    "חטיפי תנועה, מקטעי טאי צ'י קצרים",
  );
  assert.equal(migrateHebrewExerciseSnackText("איור של אדם עולה במדרגות"), "איור של אדם עולה במדרגות");

  const migrated = migrateHebrewExerciseSnackText("נשנושי כושר קצרים ונשנוש כושר אחד");
  for (const awkward of AWKWARD_EXERCISE_SNACK_HEBREW) {
    assert.equal(migrated.includes(awkward), false, awkward);
  }
  for (const outdated of OUTDATED_PUBLIC_HEBREW_TERMS) {
    assert.equal(migrated.includes(outdated), false, outdated);
  }
});

test("new public Hebrew flags the old terminology unless a historical fixture allows it", () => {
  const outdated = suspiciousLiteralWarnings("הטקסט החדש אומר נשנושי כושר.");
  assert.equal(outdated.some((warning) => warning.includes("נשנושי כושר")), true);
  assert.equal(
    suspiciousLiteralWarnings("הטקסט ההיסטורי אומר נשנושי כושר.", {
      allowHistoricalTerminology: true,
    }).some((warning) => warning.includes("נשנושי כושר")),
    false,
  );
  const awkward = suspiciousLiteralWarnings("התערבות חטיף תנועה וגם חטיף תנועהים.", {
    allowHistoricalTerminology: true,
  });
  assert.equal(awkward.length, 2);
  for (const term of ["נשנוש כושר", "נשנושי כושר", "נשנושי הכושר", "חטיפי תנועה כושר", "התערבות חטיף תנועה", "חטיף תנועהים"]) {
    assert.equal(
      FORBIDDEN_HEBREW_LITERALS.some((item) => item.pattern === term),
      true,
      term,
    );
  }
});

test("the Sanity plan patches reader-facing Hebrew and leaves identity fields alone", () => {
  const href = "/he/research/a-two-minute-exercise-snack/";
  const documents = [
    {
      _id: "research-he-1",
      _type: "research",
      language: "he",
      title: "A two-minute exercise snack may be sufficient",
      slug: { current: "a-two-minute-exercise-snack" },
      translationSlug: "a-two-minute-exercise-snack",
      doi: "10.1000/example",
      pmid: "1",
      seoTitle: "נשנוש כושר של שתי דקות",
      excerpt: "השוואה של נשנושי כושר ברכיבה.",
      comparator: "פרוטוקולים של נשנוש כושר",
      outcomes: ["חמצון שומנים", "נשנוש כושר"],
      intervention: [
        {
          _key: "b1",
          _type: "block",
          style: "normal",
          markDefs: [{ _key: "link1", _type: "link", href }],
          children: [
            { _key: "s1", _type: "span", marks: ["link1"], text: "נשנושי כושר על אופניים" },
            { _key: "s2", _type: "span", marks: [], text: " בלי שינוי." },
          ],
        },
      ],
      mainImage: {
        _type: "image",
        alt: "איור של אדם המבצע נשנוש כושר קצר על אופני כושר",
        asset: { _type: "reference", _ref: "image-keep" },
      },
    },
    {
      _id: "drafts.article-he-1",
      _type: "article",
      language: "he",
      title: "יצירת נשנוש כושר בהתאמה אישית",
      slug: { current: "custom-exercise-snacks" },
      translationSlug: "custom-exercise-snacks",
      excerpt: "בנו נשנוש כושר קצר.",
      body: [
        {
          _key: "b1",
          _type: "block",
          style: "h2",
          listItem: "bullet",
          level: 1,
          markDefs: [],
          children: [{ _key: "s1", _type: "span", marks: ["strong"], text: "נשנוש כושר אישי" }],
        },
      ],
    },
    {
      _id: "research-en-1",
      _type: "research",
      language: "en",
      title: "Exercise snacks",
      excerpt: "Participants performed exercise snacks.",
    },
  ];

  const plan = planTerminologyMigration(documents);
  assert.equal(plan.documentsScanned, 2);
  assert.equal(plan.publishedScanned, 1);
  assert.equal(plan.draftsScanned, 1);
  assert.equal(plan.researchAffected, 1);
  assert.equal(plan.articlesAffected, 1);
  assert.equal(plan.publishedAffected, 1);
  assert.equal(plan.draftsAffected, 1);
  assert.equal(plan.outdatedAfter, 0);

  const research = plan.plans.find((item) => item.id === "research-he-1");
  assert.ok(research);
  assert.equal(research.publication, "published");
  assert.equal(research.patch.seoTitle, "חטיף תנועה של שתי דקות");
  assert.equal(research.patch.excerpt, "השוואה של חטיפי תנועה ברכיבה.");
  assert.equal(research.patch.comparator, "פרוטוקולים של חטיפי תנועה");
  assert.deepEqual(research.patch.outcomes, ["חמצון שומנים", "חטיף תנועה"]);
  assert.equal(research.patch["mainImage.alt"], "איור של אדם המבצע חטיף תנועה קצר על אופני כושר");
  const intervention = research.patch.intervention as Array<Record<string, unknown>>;
  const block = intervention[0];
  assert.equal(block._key, "b1");
  assert.deepEqual(block.markDefs, [{ _key: "link1", _type: "link", href }]);
  const children = block.children as Array<Record<string, unknown>>;
  assert.equal(children[0]._key, "s1");
  assert.deepEqual(children[0].marks, ["link1"]);
  assert.equal(children[0].text, "חטיפי תנועה על אופניים");
  assert.equal(children[1].text, " בלי שינוי.");
  assert.equal("title" in research.patch, false);
  assert.equal("slug" in research.patch, false);
  assert.equal("translationSlug" in research.patch, false);
  assert.equal("doi" in research.patch, false);
  const image = documents[0]?.mainImage;
  assert.ok(image);
  assert.equal(image.asset._ref, "image-keep");
  assert.equal(JSON.stringify(research.patch).includes("image-keep"), false);

  const article = plan.plans.find((item) => item.id === "drafts.article-he-1");
  assert.ok(article);
  assert.equal(article.publication, "draft");
  assert.equal(article.patch.title, "יצירת חטיף תנועה בהתאמה אישית");
  const body = article.patch.body as Array<Record<string, unknown>>;
  assert.equal(body[0].style, "h2");
  assert.equal(body[0].listItem, "bullet");
  const articleChildren = body[0].children as Array<Record<string, unknown>>;
  assert.deepEqual(articleChildren[0].marks, ["strong"]);
  assert.equal(articleChildren[0].text, "חטיף תנועה אישי");
});

test("public English keeps exercise snack and Hebrew site copy drops the old term", () => {
  const english = readFileSync(new URL("../../content/en.ts", import.meta.url), "utf8");
  const hebrew = readFileSync(new URL("../../content/he.ts", import.meta.url), "utf8");
  const research = readFileSync(new URL("../../content/research.ts", import.meta.url), "utf8");
  assert.match(english, /exercise snacks/);
  assert.equal(english.includes("חטיפי תנועה"), false);
  for (const term of OUTDATED_PUBLIC_HEBREW_TERMS) {
    assert.equal(hebrew.includes(term), false, term);
    assert.equal(research.includes(term), false, term);
  }
  assert.equal(hebrew.includes("חטיפי תנועה (Exercise Snacks)"), true);
  assert.equal(research.includes("חטיפי תנועה (Exercise Snacks)"), true);
  assert.equal(hebrew.includes("נשנוש"), false);
  assert.equal(hebrew.includes("בוחרים חטיף תנועה"), true);
  assert.equal(hebrew.includes("כל חטיף תנועה נספר"), true);
  assert.equal(hebrew.includes("חטיפי תנועה קטנים. השפעה גדולה."), true);
  assert.equal(hebrew.includes("חטיף התנועה הראשון שלכם מחכה."), true);
});

test("reviewed product-unit phrases migrate, and a food snack does not", () => {
  assert.equal(migrateHebrewExerciseSnackText("בוחרים נשנוש"), "בוחרים חטיף תנועה");
  assert.equal(migrateHebrewExerciseSnackText("כל נשנוש נספר"), "כל חטיף תנועה נספר");
  assert.equal(migrateHebrewExerciseSnackText("נשנושי ספרינטים"), "חטיפי תנועה בספרינטים");
  assert.equal(migrateHebrewExerciseSnackText("נשנושי העלייה במדרגות"), "חטיפי התנועה בעלייה במדרגות");
  assert.equal(migrateHebrewExerciseSnackText("נשנושי טאי צ'י"), "מקטעי טאי צ'י קצרים");
  assert.equal(
    migrateHebrewExerciseSnackText(
      "נשנושי פעילות גופנית באמצעות פעילות אירובית, תרגילי התנגדות או תרגילי שיווי משקל",
    ),
    "חטיפי תנועה באמצעות פעילות אירובית, תרגילי התנגדות או תרגילי שיווי משקל",
  );
  assert.equal(
    migrateHebrewExerciseSnackText("קל מאוד אומר שהנשנוש בקושי עלה מעל שאר היום."),
    "קל מאוד אומר שחטיף התנועה בקושי עלה מעל שאר היום.",
  );
  const activity = migrateHebrewExerciseSnackText(
    "נשנושי פעילות גופנית באמצעות פעילות אירובית, תרגילי התנגדות או תרגילי שיווי משקל",
  );
  assert.equal(activity.includes("חטיפי תנועה של פעילות"), false);

  const food = "אכלתי נשנוש מתוק בצהריים.";
  assert.equal(migrateHebrewExerciseSnackText(food), food);
  assert.deepEqual(bareProductUnitSnackWarnings(food), []);
  assert.equal(bareProductUnitSnackWarnings("בוחרים נשנוש").length, 1);
  assert.equal(
    bareProductUnitSnackWarnings("נשנושי טאי צ'י").some((warning) => warning.includes("מקטעי טאי צ'י קצרים")),
    true,
  );
});

test("contextual phrases patch reader-facing fields and leave review notes", () => {
  const href = "https://doi.org/10.1000/example";
  const documents = [
    {
      _id: "article-food",
      _type: "article",
      language: "he",
      excerpt: "אכלתי נשנוש מתוק בצהריים.",
    },
    {
      _id: "research-he-research-pubmed-34157675",
      _type: "research",
      language: "he",
      translationReviewNote: "Previous wording kept נשנושי טאי צ'י.",
      intervention: [
        {
          _key: "b1",
          _type: "block",
          style: "normal",
          markDefs: [],
          children: [{ _key: "s1", _type: "span", marks: [], text: "נשנושי טאי צ'י לצד נשנושי כושר" }],
        },
      ],
    },
    {
      _id: "research-he-research-pubmed-30847639",
      _type: "research",
      language: "he",
      intervention: [
        {
          _key: "b1",
          _type: "block",
          style: "normal",
          markDefs: [{ _key: "link1", _type: "link", href }],
          children: [{ _key: "s1", _type: "span", marks: ["link1"], text: "נשנושי ספרינטים" }],
        },
      ],
    },
  ];

  const plan = planTerminologyMigration(documents);
  assert.equal(plan.documentsScanned, 3);
  assert.equal(plan.articlesAffected, 0);
  assert.equal(plan.researchAffected, 2);
  assert.equal(plan.readerFacingExactAfter, 0);
  assert.equal(plan.bareProductUnitAfter, 0);
  assert.equal(plan.readerFacingRemainder.length, 1);
  assert.match(plan.readerFacingRemainder[0] ?? "", /food meaning, left unchanged/);
  assert.match(plan.readerFacingRemainder[0] ?? "", /אכלתי נשנוש מתוק/);
  assert.equal(plan.plans.some((item) => item.id === "article-food"), false);

  const taiChi = plan.plans.find((item) => item.id === "research-he-research-pubmed-34157675");
  assert.ok(taiChi);
  assert.equal("translationReviewNote" in taiChi.patch, false);
  assert.equal(
    taiChi.skipped.some((skip) => skip.field === "translationReviewNote" && skip.text.includes("נשנושי טאי צ'י")),
    true,
  );
  const taiBlock = (taiChi.patch.intervention as Array<Record<string, unknown>>)[0];
  assert.equal(taiBlock._key, "b1");
  assert.equal(taiBlock.style, "normal");
  const taiChildren = taiBlock.children as Array<Record<string, unknown>>;
  assert.equal(taiChildren[0]._key, "s1");
  assert.deepEqual(taiChildren[0].marks, []);
  assert.equal(taiChildren[0].text, "מקטעי טאי צ'י קצרים לצד חטיפי תנועה");

  const sprint = plan.plans.find((item) => item.id === "research-he-research-pubmed-30847639");
  assert.ok(sprint);
  const sprintBlock = (sprint.patch.intervention as Array<Record<string, unknown>>)[0];
  assert.deepEqual(sprintBlock.markDefs, [{ _key: "link1", _type: "link", href }]);
  const sprintChildren = sprintBlock.children as Array<Record<string, unknown>>;
  assert.deepEqual(sprintChildren[0].marks, ["link1"]);
  assert.equal(sprintChildren[0].text, "חטיפי תנועה בספרינטים");
});

test("static Hebrew sources use the reviewed replacements", () => {
  const root = fileURLToPath(new URL("../../", import.meta.url));
  const drafts = readFileSync(join(root, "scripts/update-drafts.ts"), "utf8");
  assert.match(drafts, /exercise snacks/);
  assert.equal(drafts.includes("נשנוש"), false);
  for (const item of STATIC_CONTEXTUAL_REWRITES) {
    const source = readFileSync(join(root, item.file), "utf8");
    assert.equal(source.includes(item.from), false, `${item.file} still has ${item.from}`);
    const rule = CONTEXTUAL_REPLACEMENTS.find((entry) => entry.from === item.from);
    assert.ok(rule);
    assert.equal(source.includes(rule.to), true, `${item.file} missing ${rule.to}`);
  }
});

test("the dry-run summary names published and draft scans, and lists hidden draft changes", () => {
  const documents = [
    {
      _id: "research-he-hidden",
      _type: "research",
      language: "he",
      excerpt: "נשנוש כושר קצר",
      translationReviewNote: "Old note: נשנוש כושר",
    },
    {
      _id: "drafts.research-he-hidden",
      _type: "research",
      language: "he",
      excerpt: "נשנושי ספרינטים",
    },
  ];
  const plan = planTerminologyMigration(documents);
  const report = formatTerminologyMigrationReport(plan, "dry-run");
  assert.match(report, /Published documents scanned: 1/);
  assert.match(report, /Draft documents scanned: 1/);
  assert.match(report, /Published documents affected: 1/);
  assert.match(report, /Draft documents affected: 1/);
  assert.match(report, /Reader-facing old terminology after: 0/);
  assert.match(report, /Bare product-unit נשנוש after: 0/);
  assert.match(report, /Internal-only old terminology remaining: 1/);
  assert.match(report, /Blocked: 0/);
  assert.match(report, /Sanity writes: 0/);
  assert.match(report, /Published by script: 0/);
  assert.equal(report.includes(".publish("), false);

  const discovery = formatDraftDiscoveryReport(documents, plan, ["research-he-hidden"]);
  assert.match(discovery, /Document id: drafts.research-he-hidden/);
  assert.match(discovery, /Visibility: hidden from the unauthenticated drafts perspective/);
  assert.match(discovery, /Field: excerpt/);
  assert.match(discovery, /Before: נשנושי ספרינטים/);
  assert.match(discovery, /After: חטיפי תנועה בספרינטים/);
  assert.equal(discovery.includes("translationReviewNote"), false);
});
