import assert from "node:assert/strict";
import test from "node:test";

import { assessRelevance } from "./relevance";

test("rejects a correction or erratum instead of drafting it", () => {
  const byType = assessRelevance({
    title: "Correction: Effects of weekly exercise snacks on fitness",
    abstract: "This notice corrects the original trial of exercise snacks.",
    publicationTypes: ["Published Erratum"],
    commentCorrections: [{ refType: "ErratumFor", pmid: "42529115" }],
  });
  assert.equal(byType.disposition, "reject");
  assert.equal(byType.reason, "correction/erratum");
  assert.deepEqual(byType.correctedPmids, ["42529115"]);

  const byTitle = assessRelevance({
    title: "Correction to 'Exercise Snacks in Alzheimer's Disease'.",
    abstract: "",
  });
  assert.equal(byTitle.disposition, "reject");
  assert.equal(byTitle.reason, "correction/erratum");

  const authorCorrection = assessRelevance({
    title: "Author Correction: Exercise snacking and glucose",
    abstract: "Exercise snacks were mistyped in the original table.",
  });
  assert.equal(authorCorrection.disposition, "reject");
  assert.equal(authorCorrection.reason, "correction/erratum");
});

test("classifies a study protocol as a review candidate", () => {
  const byTitle = assessRelevance({
    title: "Effects of exercise snacks on mental health: a randomized controlled trial study protocol",
    abstract: "This protocol describes a future trial of exercise snacks.",
    publicationTypes: ["Journal Article"],
  });
  assert.equal(byTitle.disposition, "review_candidate");
  assert.equal(byTitle.reason, "study protocol");

  const byType = assessRelevance({
    title: "Exercise Snacks in Adults Living With Obesity: Protocol for a Randomized Feasibility Trial",
    abstract: "",
    publicationTypes: ["Journal Article", "Clinical Trial Protocol"],
  });
  assert.equal(byType.disposition, "review_candidate");
  assert.equal(byType.reason, "study protocol");
});

test("auto-drafts a title that contains Exercise Snacks", () => {
  const decision = assessRelevance({
    title: "Exercise Snacks Improve Cognitive Processing Efficiency",
    abstract: "",
  });
  assert.equal(decision.disposition, "auto_draft");
  assert.equal(decision.reason, "core phrase in title");
  assert.ok(decision.rules.includes("exercise-snacks"));
});

test("auto-drafts a title that contains VILPA", () => {
  const decision = assessRelevance({
    title: "Vigorous intermittent lifestyle physical activity (VILPA) and mortality risk",
    abstract: "",
  });
  assert.equal(decision.disposition, "auto_draft");
  assert.equal(decision.reason, "core phrase in title");
  assert.ok(decision.rules.includes("vilpa-phrase"));
  assert.ok(decision.rules.includes("vilpa"));
});

test("holds an abstract-only exercise snacks mention for review", () => {
  const decision = assessRelevance({
    title: "Fragmented versus traditional resistance training",
    abstract:
      "Fragmented resistance training, derived from 'exercise snacking,' may offer a flexible alternative to traditional sessions.",
  });
  assert.equal(decision.disposition, "review_candidate");
  assert.equal(decision.reason, "core phrase found only in abstract");
});

test("keeps a systematic review of exercise snacks eligible to auto-draft", () => {
  const systematic = assessRelevance({
    title: "Effects of exercise snacks on cardiorespiratory fitness: a systematic review and meta-analysis",
    abstract: "This systematic review evaluated exercise snacks.",
    publicationTypes: ["Journal Article", "Systematic Review", "Meta-Analysis"],
  });
  assert.equal(systematic.disposition, "auto_draft");
  assert.equal(systematic.reason, "core phrase in title");

  const scoping = assessRelevance({
    title: "Exercise snacking for chronic conditions: an evidence map and scoping review",
    abstract: "",
    publicationTypes: ["Journal Article", "Review"],
  });
  assert.equal(scoping.disposition, "auto_draft");

  const umbrella = assessRelevance({
    title: "Exercise Snacks and Postprandial Glucose: An Umbrella Review",
    abstract: "",
    publicationTypes: ["Journal Article", "Review"],
  });
  assert.equal(umbrella.disposition, "auto_draft");
});

test("does not auto-draft an unrelated paper that only mentions exercise snacks", () => {
  const decision = assessRelevance({
    title: "Caffeine intake and cycling economy in trained adults",
    abstract:
      "Caffeine improved cycling economy. The discussion briefly mentions exercise snacks as an unrelated strategy used in other studies.",
    publicationTypes: ["Journal Article"],
  });
  assert.notEqual(decision.disposition, "auto_draft");
  assert.equal(decision.disposition, "review_candidate");
  assert.equal(decision.reason, "core phrase found only in abstract");
});

test("auto-drafts a related title only when the abstract identifies VILPA or exercise snacks", () => {
  const confirmed = assessRelevance({
    title: "Association of Brief Bouts of Vigorous Physical Activity and Frailty",
    abstract: "These bouts were classified as vigorous intermittent lifestyle physical activity.",
  });
  assert.equal(confirmed.disposition, "auto_draft");
  assert.equal(
    confirmed.reason,
    "related concept identified as VILPA or exercise snacks in the abstract",
  );

  const unconfirmed = assessRelevance({
    title: "Short bouts of exercise and classroom mood",
    abstract: "Children walked for five minutes between lessons.",
  });
  assert.equal(unconfirmed.disposition, "review_candidate");
  assert.equal(
    unconfirmed.reason,
    "related concept without VILPA or exercise-snack evidence in the abstract",
  );
});

test("holds commentary, letters, and news for review", () => {
  const editorial = assessRelevance({
    title: 'Integrating exercise into daily life: the potential of "exercise snacks"',
    abstract: "",
    publicationTypes: ["Editorial"],
  });
  assert.equal(editorial.disposition, "review_candidate");
  assert.equal(editorial.reason, "commentary/perspective");

  const letter = assessRelevance({
    title: "Current limitations of exercise snacks studies: A road map for the future",
    abstract: "",
    publicationTypes: ["Letter"],
  });
  assert.equal(letter.disposition, "review_candidate");
  assert.equal(letter.reason, "commentary/perspective");

  const perspective = assessRelevance({
    title: "A perspective on exercise snacks in primary care",
    abstract: "",
  });
  assert.equal(perspective.disposition, "review_candidate");
  assert.equal(perspective.reason, "commentary/perspective");

  const news = assessRelevance({
    title: "Exercise snacks reach the clinic",
    abstract: "",
    publicationTypes: ["News"],
  });
  assert.equal(news.disposition, "review_candidate");
  assert.equal(news.reason, "news item");
});

test("auto-drafts an abstract-only paper when the aim is the core concept", () => {
  const decision = assessRelevance({
    title: "Stair climbing breaks and postprandial glucose",
    abstract: "Objective: To test whether exercise snacks improve postprandial glucose.",
    abstractSections: [
      {
        label: "Objective",
        text: "To test whether exercise snacks improve postprandial glucose.",
      },
    ],
  });
  assert.equal(decision.disposition, "auto_draft");
  assert.equal(decision.reason, "core phrase is central in the abstract");
});

test("rejects uncertain records and food-snack wording", () => {
  const scattered = assessRelevance({
    title: "Exercise after high-fat snacks in mice",
    abstract: "Participants ate snacks and then completed exercise.",
  });
  assert.equal(scattered.disposition, "reject");
  assert.equal(scattered.reason, "no core Snacksmate concept in title or abstract");

  const partialAcronym = assessRelevance({ title: "Vilpax device validation", abstract: "" });
  assert.equal(partialAcronym.disposition, "reject");

  const empty = assessRelevance({ title: "  ", abstract: "" });
  assert.equal(empty.disposition, "reject");
  assert.equal(empty.reason, "title and abstract are empty");

  const foodSnack = assessRelevance({
    title: "Pre-Exercise Snacking and hunger during a fast",
    abstract: "Participants ate a snack before exercise.",
  });
  assert.equal(foodSnack.disposition, "reject");

  const republished = assessRelevance({
    title: "Exercise snacks and fitness after correction of the analysis",
    abstract: "",
    publicationTypes: ["Corrected and Republished Article", "Journal Article"],
  });
  assert.equal(republished.disposition, "auto_draft");
});
