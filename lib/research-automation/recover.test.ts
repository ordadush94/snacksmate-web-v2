import assert from "node:assert/strict";
import test from "node:test";

import { RECOVERY_PMIDS, selectRecoveryDrafts } from "./recover";

test("recovery selects only the three existing English draft ids", () => {
  const selected = selectRecoveryDrafts([
    {
      pmid: "42925061",
      _id: "drafts.research-pubmed-42925061",
      language: "en",
      title: "Exercise snacks and smartphones",
    },
    {
      pmid: "42923131",
      _id: "drafts.research-pubmed-42923131",
      language: "en",
      title: "  Psychological impacts  ",
    },
    {
      pmid: "42948631",
      _id: "research-pubmed-42948631",
      language: "en",
      title: "Published id is ignored",
    },
    {
      pmid: "42948631",
      _id: "drafts.research-he-research-pubmed-42948631",
      language: "he",
      title: "Hebrew id is ignored",
    },
    {
      pmid: "11111111",
      _id: "drafts.research-pubmed-11111111",
      language: "en",
      title: "Another study is ignored",
    },
  ]);

  assert.deepEqual(
    selected,
    [
      {
        pmid: "42925061",
        draftId: "drafts.research-pubmed-42925061",
        title: "Exercise snacks and smartphones",
      },
      {
        pmid: "42923131",
        draftId: "drafts.research-pubmed-42923131",
        title: "Psychological impacts",
      },
    ],
  );
  assert.deepEqual(RECOVERY_PMIDS, ["42925061", "42923131", "42948631"]);
});
