import assert from "node:assert/strict";
import test from "node:test";

import { normalizeDoi, normalizeTitle, slugifyTitle } from "./normalize";

test("normalizes DOI URLs, labels, case, and trailing punctuation", () => {
  assert.equal(normalizeDoi("https://doi.org/10.1000/XYZ.12"), "10.1000/xyz.12");
  assert.equal(normalizeDoi("http://dx.doi.org/10.1000/XYZ"), "10.1000/xyz");
  assert.equal(normalizeDoi("doi:10.1000/AbC."), "10.1000/abc");
  assert.equal(normalizeDoi(" 10.1000/abc "), "10.1000/abc");
  assert.equal(normalizeDoi("not-a-doi"), null);
  assert.equal(normalizeDoi(""), null);
});

test("normalizes titles for exact fallback matching", () => {
  assert.equal(
    normalizeTitle("  Exercise Snacks: A Review! "),
    normalizeTitle("exercise snacks a review"),
  );
  assert.notEqual(
    normalizeTitle("Exercise snacks and glucose"),
    normalizeTitle("Exercise snacks and fitness"),
  );
  assert.equal(normalizeTitle(""), "");
});

test("builds a deterministic URL-safe slug", () => {
  assert.equal(
    slugifyTitle("Exercise Snacks Improve VO2max"),
    "exercise-snacks-improve-vo2max",
  );
  assert.equal(slugifyTitle("***"), "study");
  assert.ok(slugifyTitle("A".repeat(200)).length <= 96);
});
