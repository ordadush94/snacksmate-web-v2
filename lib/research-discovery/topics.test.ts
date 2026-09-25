import assert from "node:assert/strict";
import test from "node:test";

import { mapResearchTopic } from "./topics";

test("maps discovery concepts onto research topics", () => {
  assert.equal(
    mapResearchTopic("Vigorous intermittent lifestyle physical activity", ""),
    "vilpa",
  );
  assert.equal(mapResearchTopic("Exercise snacking at work", ""), "exercise-snacks");
  assert.equal(
    mapResearchTopic("Sedentary behaviour breaks", ""),
    "sedentary-behavior",
  );
  assert.equal(mapResearchTopic("Postprandial glycemic response", ""), "glucose");
  assert.equal(mapResearchTopic("Changes in VO2max", ""), "cardiorespiratory-fitness");
  assert.equal(mapResearchTopic("Unrelated laboratory methods", ""), "other");
});

test("prefers VILPA when several topic phrases are present", () => {
  assert.equal(
    mapResearchTopic("VILPA, exercise snacks, and glucose", ""),
    "vilpa",
  );
});
