import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { planSelectedStudy } from "./plan";
import { assertSelectedResearchPmids, SELECTED_RESEARCH_PMIDS } from "./selection";

test("the named study list is 18 unique PubMed ids", () => {
  assert.equal(SELECTED_RESEARCH_PMIDS.length, 18);
  assertSelectedResearchPmids(SELECTED_RESEARCH_PMIDS);
  const pmids: readonly string[] = SELECTED_RESEARCH_PMIDS;
  assert.equal(pmids.includes("41474631"), true);
  assert.equal(pmids.includes("42808292"), false);
  assert.equal(pmids.includes("42558375"), true);
});

test("a new study is created and an existing bilingual study is skipped", () => {
  const created = planSelectedStudy({
    draft: draft("39587826", "Stair climbing exercise snacks on campus"),
    existing: [],
    relevance: { disposition: "auto_draft", reason: "core phrase in title" },
  });
  assert.equal(created.action, "create");

  const skipped = planSelectedStudy({
    draft: draft(
      "42502209",
      "Exercise snacks are feasible for adults living with type 2 diabetes",
    ),
    existing: [
      {
        id: "research-pubmed-42502209",
        pmid: "42502209",
        language: "en",
        title: "Exercise snacks are feasible for adults living with type 2 diabetes",
      },
      {
        id: "research-he-research-pubmed-42502209",
        pmid: "42502209",
        language: "he",
        translationSourceId: "research-pubmed-42502209",
      },
    ],
    relevance: { disposition: "auto_draft", reason: "core phrase in title" },
  });
  assert.equal(skipped.action, "skip");
  assert.match(skipped.reason, /Already in Sanity/);
});

test("an English draft without Hebrew is resumed and a published document is not overwritten", () => {
  const resumed = planSelectedStudy({
    draft: draft("30649897", "Stair climbing exercise snacks and fitness"),
    existing: [
      {
        id: "drafts.research-pubmed-30649897",
        pmid: "30649897",
        language: "en",
        slug: "stair-climbing-exercise-snacks-and-fitness",
      },
    ],
    relevance: { disposition: "auto_draft", reason: "core phrase in title" },
  });
  assert.equal(resumed.action, "resume");

  const published = planSelectedStudy({
    draft: draft("30649897", "Stair climbing exercise snacks and fitness"),
    existing: [
      {
        id: "research-pubmed-30649897",
        pmid: "30649897",
        language: "en",
      },
    ],
    relevance: { disposition: "auto_draft", reason: "core phrase in title" },
  });
  assert.equal(published.action, "skip");
  assert.match(published.reason, /Published English document/);
});

test("corrections are not imported", () => {
  const correction = planSelectedStudy({
    draft: draft("42808292", "Correction to Exercise Snacks Improve Cognitive Processing"),
    existing: [],
    relevance: { disposition: "reject", reason: "correction/erratum" },
  });
  assert.equal(correction.action, "skip");
  assert.equal(correction.reason, "correction/erratum");
});

test("the importer never publishes", () => {
  const source = readFileSync(new URL("../../scripts/import-selected-research.ts", import.meta.url), "utf8");
  assert.equal(source.includes(".publish("), false);
  assert.equal(source.includes("createOrReplace"), false);
  assert.match(source, /IMPORT_CONFIRM/);
  assert.match(source, /CREATE DRAFTS/);
  assert.match(source, /automateCreatedResearchDrafts/);
  assert.match(source, /createResearchDraft/);
});

function draft(pmid: string, title: string) {
  return {
    pmid,
    title,
    draftId: `drafts.research-pubmed-${pmid}`,
    slug: title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
  };
}
