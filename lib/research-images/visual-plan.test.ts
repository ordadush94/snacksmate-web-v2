import assert from "node:assert/strict";
import test from "node:test";

import { buildResearchImageAlt } from "./alt";
import { buildImagePrompt, buildResearchVisualBrief } from "./brief";
import { RESEARCH_IMAGE_HARD_CONSTRAINTS, RESEARCH_IMAGE_STYLE } from "./style";
import type { DiversityHistoryEntry, ResearchImageDocument } from "./types";
import {
  applyRecentImageHistory,
  buildResearchVisualPlan,
  diversityConstraints,
  settingFamily,
} from "./visual-plan";

test("population age is respected and a sex-specific source keeps that presentation", () => {
  const older = buildResearchVisualBrief(
    research({
      _id: "older-men-stairs",
      title: "Stair climbing in older men",
      population: "Older men",
      intervention: "Each participant performed short stair-climbing bouts.",
      topic: "older-adults",
      excerpt: "Older men climbed stairs.",
    }),
  );
  assert.equal(older.population, "older-adult");
  assert.equal(older.activity, "stair-climbing");
  assert.equal(older.plan.approximateAge, "older");
  assert.equal(older.plan.subjectPresentation, "male");
  assert.equal(older.plan.subjectCount, "one");
  assert.equal(
    buildResearchImageAlt(older, "en"),
    "Illustration of an older man climbing stairs during a brief bout of physical activity.",
  );
  assert.equal(
    buildResearchImageAlt(older, "he"),
    "איור של גבר מבוגר העולה במדרגות במהלך פעילות גופנית קצרה.",
  );

  const women = buildResearchVisualPlan({
    seed: "pmid-women",
    activity: "cycling",
    population: "adult",
    corpus: "Women performed brief stationary cycling.",
  });
  assert.equal(women.subjectPresentation, "female");
  assert.notEqual(women.subjectCount, "none");

  const young = buildResearchVisualBrief(
    research({
      _id: "young-walk",
      title: "Walking breaks for university students",
      population: "University students",
      intervention: "Students took short walking breaks.",
      topic: "physical-activity",
      excerpt: "Young adults walked between classes.",
    }),
  );
  assert.equal(young.population, "young-adult");
  assert.equal(young.plan.approximateAge, "young-adult");
  assert.equal(young.activity, "walking");
});

test("an unspecified population does not always default to a woman or to one person", () => {
  const presentations = new Set<string>();
  const counts = new Set<string>();
  for (let index = 0; index < 48; index += 1) {
    const plan = buildResearchVisualPlan({
      seed: `pmid-${index}`,
      activity: "cycling",
      population: "adult",
      corpus: "Adults performed brief stationary cycling.",
    });
    presentations.add(plan.subjectPresentation);
    counts.add(plan.subjectCount);
  }
  assert.ok(presentations.size > 1);
  assert.equal([...presentations].every((presentation) => presentation === "female"), false);
  assert.equal(counts.has("none"), true);
});

test("recent home settings and repeated presentation are avoided when the study allows it", () => {
  const constraints = diversityConstraints({
    activity: "cycling",
    population: "adult",
    corpus: "Adults performed brief stationary cycling.",
  });
  const baseline = buildResearchVisualPlan({
    seed: "pmid-baseline",
    activity: "cycling",
    population: "adult",
    corpus: "Adults performed brief stationary cycling.",
  });
  const repeated = applyRecentImageHistory(
    {
      ...baseline,
      setting: "home",
      subjectCount: "one",
      subjectPresentation: "female",
      appearanceVariation: "medium",
    },
    [entry({ studyKey: "recent-a" }), entry({ studyKey: "recent-b" })],
    constraints,
    "pmid-baseline",
    "Adults performed brief stationary cycling.",
  );
  assert.notEqual(settingFamily(repeated.setting), "home");
  assert.notEqual(repeated.subjectPresentation, "female");

  const crowded = applyRecentImageHistory(
    { ...baseline, setting: "home", subjectPresentation: "male", subjectCount: "one" },
    [
      entry({ studyKey: "1", setting: "home", subjectPresentation: "male" }),
      entry({ studyKey: "2", setting: "gym", subjectPresentation: "gender-neutral" }),
      entry({ studyKey: "3", setting: "home-exercise-corner", subjectPresentation: "male" }),
      entry({ studyKey: "4", setting: "studio", subjectPresentation: "gender-neutral" }),
      entry({ studyKey: "5", setting: "home", subjectPresentation: "mixed-pair", subjectCount: "two" }),
    ],
    constraints,
    "pmid-crowded",
    "Adults performed brief stationary cycling.",
  );
  assert.notEqual(settingFamily(crowded.setting), "home");
});

test("scientific context overrides diversity rotation", () => {
  const history = Array.from({ length: 5 }, (_, index) =>
    entry({ studyKey: `home-${index}`, setting: "home", activity: "resistance" }),
  );
  const home = buildResearchVisualPlan({
    seed: "pmid-home-resistance",
    activity: "resistance",
    population: "older-adult",
    corpus: "Older adults performed bodyweight resistance exercise at home.",
    history,
  });
  assert.equal(settingFamily(home.setting), "home");
  assert.equal(home.approximateAge, "older");

  const stairs = buildResearchVisualPlan({
    seed: "pmid-stairs",
    activity: "stair-climbing",
    population: "adult",
    corpus: "Participants climbed stairs.",
    history,
  });
  assert.equal(stairs.setting, "staircase");
  assert.equal(stairs.activity, "stair-climbing");

  const men = buildResearchVisualPlan({
    seed: "pmid-men",
    activity: "cycling",
    population: "adult",
    corpus: "Healthy men performed brief stationary cycling on a cycle ergometer in the laboratory.",
    history: [entry({ subjectPresentation: "female" }), entry({ studyKey: "female-2", subjectPresentation: "female" })],
  });
  assert.equal(men.subjectPresentation, "male");
  assert.equal(men.subjectCount, "one");
  assert.notEqual(settingFamily(men.setting), "home");
});

test("the same study id keeps the same baseline plan and palettes still vary", () => {
  const input = {
    seed: "pmid-42",
    activity: "walking" as const,
    population: "adult" as const,
    corpus: "Adults took a short walk outdoors.",
  };
  assert.deepEqual(buildResearchVisualPlan(input), buildResearchVisualPlan(input));

  const withHistory = [entry({ studyKey: "other", setting: "park", activity: "walking" })];
  assert.deepEqual(
    buildResearchVisualPlan({ ...input, history: withHistory }),
    buildResearchVisualPlan({ ...input, history: withHistory }),
  );

  const palettes = new Set<string>();
  const families = new Set<string>();
  for (let index = 0; index < 24; index += 1) {
    const plan = buildResearchVisualPlan({
      seed: `palette-${index}`,
      activity: "cycling",
      population: "adult",
      corpus: "Adults performed brief stationary cycling.",
    });
    palettes.add(plan.supportingPalette);
    families.add(settingFamily(plan.setting));
    assert.notEqual(plan.supportingPalette, "mint");
    assert.ok(plan.brandAccent);
  }
  assert.ok(palettes.size >= 3);
  assert.ok(families.size > 1);
});

test("every prompt keeps the fixed style, a mint accent, and text-free constraints", () => {
  const activities = ["cycling", "stair-climbing", "walking", "resistance", "vilpa"] as const;
  for (const activity of activities) {
    const brief = buildResearchVisualBrief(
      research({
        _id: `prompt-${activity}`,
        title: `${activity} study for adults`,
        intervention:
          activity === "vilpa"
            ? "Participants used vigorous intermittent lifestyle physical activity."
            : `Participants performed ${activity}.`,
        population: "Adults",
        topic: activity === "vilpa" ? "vilpa" : "physical-activity",
        excerpt: "The study describes the activity, not a result.",
        mainFindings: "",
        practicalInterpretation: "",
      }),
      `prompt-${activity}`,
    );
    const prompt = buildImagePrompt(brief);
    assert.match(prompt, /A\. FIXED STYLE/);
    assert.match(prompt, /B\. STUDY-SPECIFIC SUBJECT/);
    assert.match(prompt, /C\. DIVERSITY PLAN/);
    assert.match(prompt, /D\. HARD CONSTRAINTS/);
    assert.match(prompt, /Snacksmate Research/);
    assert.equal(prompt.includes(RESEARCH_IMAGE_STYLE.prompt), true);
    assert.equal(prompt.includes(RESEARCH_IMAGE_HARD_CONSTRAINTS), true);
    assert.match(prompt, /mint or teal/i);
    assert.match(prompt, /must not also be the shirt, the floor, the furniture, the wall, and the exercise mat/);
    assert.equal(prompt.includes("reduced mortality"), false);
    assert.equal(prompt.includes("fat loss"), false);
    assert.equal(prompt.includes("cancer"), false);
    assert.equal(/\b12\b/.test(prompt), false);
  }
});

function research(overrides: Partial<ResearchImageDocument> = {}): ResearchImageDocument {
  return {
    _id: "research-fixture",
    language: "en",
    title: "Brief stair-climbing exercise snacks for inactive adults",
    seoTitle: "Stair-climbing exercise snacks",
    excerpt: "Participants climbed stairs in short bouts during the day.",
    topic: "exercise-snacks",
    studyDesign: "randomized-controlled-trial",
    population: "Inactive adults",
    intervention: "Participants completed short stair-climbing bouts.",
    outcomes: ["fitness"],
    mainFindings: [{ _type: "block", children: [{ _type: "span", text: "Stair climbing was the activity." }] }],
    practicalInterpretation: "The study concerns short stair-climbing bouts.",
    ...overrides,
  };
}

function entry(overrides: Partial<DiversityHistoryEntry> = {}): DiversityHistoryEntry {
  return {
    studyKey: "pmid-history",
    generatedAt: "2026-01-01T00:00:00.000Z",
    activity: "cycling",
    setting: "home",
    subjectCount: "one",
    subjectPresentation: "female",
    approximateAge: "adult",
    composition: "medium-activity",
    supportingPalette: "warm-sand",
    appearanceVariation: "medium",
    ...overrides,
  };
}
