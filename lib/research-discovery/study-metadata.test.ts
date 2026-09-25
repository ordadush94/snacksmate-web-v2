import assert from "node:assert/strict";
import test from "node:test";

import { decodeXmlEntities } from "./pubmed";
import { inferStudyDesignFromTitle } from "./study-metadata";

test("decodes numeric entities that appear in PubMed titles", () => {
  assert.equal(decodeXmlEntities("75&#x202f;min"), "75\u202fmin");
  assert.equal(decodeXmlEntities("Snacktivity&#x2122;"), "Snacktivity\u2122");
});

test("infers a study design only from explicit title wording", () => {
  assert.equal(
    inferStudyDesignFromTitle("A randomised crossover study of exercise snacks"),
    "crossover-study",
  );
  assert.equal(
    inferStudyDesignFromTitle("Exercise snacks: a systematic review and meta-analysis"),
    "meta-analysis",
  );
  assert.equal(inferStudyDesignFromTitle("Exercise snacks are feasible"), undefined);
});
