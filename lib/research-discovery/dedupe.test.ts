import assert from "node:assert/strict";
import test from "node:test";

import { findDuplicate, type ResearchIdentity } from "./dedupe";

const existing: ResearchIdentity[] = [
  {
    id: "drafts.research-pubmed-111",
    pmid: "111",
    doi: "https://doi.org/10.1000/AAA",
    title: "Exercise Snacks Improve Fitness",
    slug: "exercise-snacks-improve-fitness",
  },
  {
    id: "research-manual-1",
    doi: "10.2000/bbb",
    title: "A Manual Summary",
    slug: "a-manual-summary",
  },
];

test("matches an existing document by PMID before other keys", () => {
  const match = findDuplicate(
    {
      id: "new",
      pmid: "111",
      doi: "10.9999/different",
      title: "Different title",
      slug: "different-title",
    },
    existing,
  );
  assert.deepEqual(match, { id: "drafts.research-pubmed-111", reason: "pmid" });
});

test("matches a normalized DOI when PMID differs", () => {
  const match = findDuplicate(
    {
      id: "new",
      pmid: "222",
      doi: "DOI:10.2000/BBB.",
      title: "Another title",
      slug: "another-title",
    },
    existing,
  );
  assert.deepEqual(match, { id: "research-manual-1", reason: "doi" });
});

test("matches an exact normalized title as a fallback", () => {
  const match = findDuplicate(
    {
      id: "new",
      title: "exercise snacks improve fitness",
      slug: "unused-slug",
    },
    existing,
  );
  assert.deepEqual(match, { id: "drafts.research-pubmed-111", reason: "title" });
});

test("matches an existing slug when identifiers and title differ", () => {
  const match = findDuplicate(
    {
      id: "new",
      title: "Completely different",
      slug: "a-manual-summary",
    },
    existing,
  );
  assert.deepEqual(match, { id: "research-manual-1", reason: "slug" });
});

test("does not treat empty identifiers as duplicates", () => {
  const match = findDuplicate(
    { id: "new", title: "Brand new study", slug: "brand-new-study" },
    existing,
  );
  assert.equal(match, null);
});
