import assert from "node:assert/strict";
import test from "node:test";

import { assessRelevance } from "./relevance";

test("accepts strong exercise-snack and VILPA phrases", () => {
  const snacks = assessRelevance("Exercise snacking improves fitness", "");
  assert.equal(snacks.accept, true);
  assert.ok(snacks.rules.includes("exercise-snacks"));

  const vilpa = assessRelevance(
    "Stair climbing",
    "This cohort measured vigorous intermittent lifestyle physical activity.",
  );
  assert.equal(vilpa.accept, true);
  assert.ok(vilpa.rules.includes("vilpa-phrase"));

  const acronym = assessRelevance("Daily activity", "VILPA was assessed by accelerometer.");
  assert.equal(acronym.accept, true);
  assert.ok(acronym.rules.includes("vilpa"));
});

test("rejects uncertain records instead of creating weak drafts", () => {
  const scattered = assessRelevance(
    "Exercise after high-fat snacks in mice",
    "Participants ate snacks and then completed exercise.",
  );
  assert.equal(scattered.accept, false);
  assert.match(scattered.reason, /^rejected:/);

  const partialAcronym = assessRelevance("Vilpax device validation", "");
  assert.equal(partialAcronym.accept, false);

  const empty = assessRelevance("  ", "");
  assert.equal(empty.accept, false);

  const foodSnack = assessRelevance(
    "Pre-Exercise Snacking and hunger during a fast",
    "Participants ate a snack before exercise.",
  );
  assert.equal(foodSnack.accept, false);
});
