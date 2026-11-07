import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import test from "node:test";

import { hebrewArticleCopyPatches } from "./revise-hebrew-article-copy";
import { blockText, updateDrafts } from "./update-drafts";

const source = readFileSync(new URL("./revise-hebrew-article-copy.ts", import.meta.url), "utf8");
const workflow = readFileSync(
  new URL("../.github/workflows/revise-hebrew-articles.yml", import.meta.url),
  "utf8",
);

test("Hebrew article patches cover the five published updates and only copy fields", () => {
  const patches = hebrewArticleCopyPatches();
  assert.deepEqual(
    patches.map((patch) => patch.id),
    [
      "article-update-snacksmate-2-0-he",
      "article-update-custom-exercise-snacks-he",
      "article-update-exercise-preferences-he",
      "article-update-workout-effort-rating-he",
      "article-update-snacksmate-research-hub-he",
    ],
  );
  for (const patch of patches) {
    assert.deepEqual(Object.keys(patch.set), ["title", "excerpt", "seoTitle", "seoDescription", "body"]);
    const sourceDocument = updateDrafts.find((document) => document._id === `drafts.${patch.id}`);
    assert.ok(sourceDocument);
    assert.equal(patch.set.title, sourceDocument.title);
    assert.equal(blockText(patch.set.body), blockText(sourceDocument.body));
  }
});

test("the revise workflow is manual, dry-run by default, and confirms a write", () => {
  assert.match(workflow, /workflow_dispatch:/);
  assert.equal(workflow.includes("schedule:"), false);
  assert.equal(workflow.includes("push:"), false);
  assert.equal(workflow.includes("pull_request:"), false);
  assert.match(workflow, /default: dry-run/);
  assert.match(workflow, /REVISE HEBREW ARTICLES/);
  assert.match(workflow, /npm run articles:revise-hebrew -- --write/);
  assert.match(workflow, /npm run articles:revise-hebrew\n/);
  assert.equal(workflow.includes(".publish("), false);
  assert.equal(/echo[^\n]*SANITY_WRITE_TOKEN/.test(workflow), false);
});

test("the reviser patches existing Hebrew articles and does not publish", () => {
  assert.equal(source.includes(".publish("), false);
  assert.equal(source.includes("createOrReplace("), false);
  assert.equal(source.includes(".create("), false);
  assert.equal(source.includes(".delete("), false);
  assert.match(source, /Refusing to patch \$\{id\}: expected a Hebrew article/);
  assert.match(source, /Published by script: 0/);
});

test("dry-run without a token does not write", () => {
  const result = spawnSync("npx", ["tsx", "scripts/revise-hebrew-article-copy.ts"], {
    cwd: new URL("..", import.meta.url),
    encoding: "utf8",
    env: (() => {
      const env = { ...process.env };
      delete env.SANITY_WRITE_TOKEN;
      return env;
    })(),
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Dry-run only\. No Sanity document was changed\./);
  assert.match(result.stdout, /Published by script: 0/);
  assert.match(result.stdout, /Will update article-update-snacksmate-2-0-he/);
  assert.match(result.stdout, /body: \d+ blocks -> \d+ blocks/);
  assert.match(result.stdout, /excerpt: changed/);
  assert.match(result.stdout, /seoTitle: changed/);
  assert.match(result.stdout, /seoDescription: changed/);
});
