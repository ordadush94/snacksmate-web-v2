import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmodSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { formatUpdateDraftRunSummary } from "./create-update-drafts";
import { updateDrafts } from "./update-drafts";

const workflow = readFileSync(
  new URL("../.github/workflows/create-update-drafts.yml", import.meta.url),
  "utf8",
);
const creator = readFileSync(new URL("./create-update-drafts.ts", import.meta.url), "utf8");

test("the run summary always reports that nothing was published", () => {
  const text = formatUpdateDraftRunSummary({
    expectedUpdates: updateDrafts.length,
    englishDraftsCreated: 4,
    hebrewDraftsCreated: 3,
    skippedExisting: 2,
    failed: 1,
  });
  assert.equal(
    text,
    [
      `Expected updates: ${updateDrafts.length}`,
      "English drafts created: 4",
      "Hebrew drafts created: 3",
      "Skipped existing: 2",
      "Failed: 1",
      "Published: 0",
    ].join("\n"),
  );
});

test("prepared drafts stay unpublished article drafts", () => {
  assert.equal(updateDrafts.length, 10);
  assert.equal(updateDrafts.filter((document) => document.language === "en").length, 5);
  assert.equal(updateDrafts.filter((document) => document.language === "he").length, 5);
  for (const document of updateDrafts) {
    assert.equal(document._id.startsWith("drafts.article-update-"), true);
    assert.equal(document._id.replace(/^drafts\./, "").includes("drafts."), false);
  }
});

test("the creator only writes drafts and still skips duplicates", () => {
  assert.match(creator, /function collision\(/);
  assert.match(creator, /row\._id === document\._id \|\| row\._id === logicalId/);
  assert.match(creator, /row\.slug === document\.slug\.current/);
  assert.match(creator, /row\.translationSlug === document\.translationSlug/);
  assert.match(creator, /row\.title === document\.title/);
  assert.match(creator, /summary\.skippedExisting \+= 1/);
  assert.match(creator, /!document\._id\.startsWith\("drafts\.article-update-"\)/);
  assert.match(creator, /client\.create</);
  assert.match(creator, /if \(!createdId\.startsWith\("drafts\."\)\)/);
  assert.equal(creator.includes(".publish("), false);
  assert.equal(creator.includes("createOrReplace("), false);
  assert.equal(creator.includes(".mutate("), false);
  assert.equal(creator.includes(".patch("), false);
  assert.equal(creator.includes(".delete("), false);
  const dryRunReturn = creator.indexOf("Dry-run only. Nothing was written. Nothing was published.");
  const createCall = creator.indexOf("await createDraft(client, document)");
  assert.ok(dryRunReturn >= 0 && createCall > dryRunReturn);
});

test("dry-run without a token prints the summary and performs no write", () => {
  const result = runCreator([]);
  assert.equal(result.status, 0);
  assert.match(result.stdout, /Nothing was written\. Nothing was published\./);
  assert.match(result.stdout, /SANITY_WRITE_TOKEN is not set/);
  assert.equal(result.stdout.includes("--write"), false);
  assertSummary(result.stdout, {
    expected: String(updateDrafts.length),
    english: "0",
    hebrew: "0",
    skipped: "0",
    failed: "0",
  });
});

test("write without a token exits before any Sanity mutation", () => {
  const result = runCreator(["--write"]);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Refusing --write without SANITY_WRITE_TOKEN/);
  assert.match(result.stdout, /Nothing was written\. Nothing was published\./);
  assertSummary(result.stdout, {
    expected: String(updateDrafts.length),
    english: "0",
    hebrew: "0",
    skipped: "0",
    failed: "1",
  });
});

test("the workflow is manual, dry-run by default, and confirms a write", () => {
  assert.match(workflow, /name: Create Update Drafts\n/);
  assert.match(workflow, /workflow_dispatch:/);
  assert.equal(workflow.includes("schedule:"), false);
  assert.equal(workflow.includes("push:"), false);
  assert.equal(workflow.includes("pull_request:"), false);
  assert.match(workflow, /dry_run:[\s\S]*?type: boolean[\s\S]*?default: true/);
  assert.match(
    workflow,
    /dry_run:[\s\S]*?description: Preview the Update drafts without writing to Sanity/,
  );
  assert.match(workflow, /confirm_write:[\s\S]*?type: string[\s\S]*?default: ""/);
  assert.match(workflow, /description: Type CREATE UPDATE DRAFTS to allow writing/);
  assert.match(workflow, /node-version: 22/);
  assert.match(workflow, /cache: npm/);
  assert.match(workflow, /npm ci/);
  assert.match(workflow, /actions\/checkout@v4/);
  assert.match(workflow, /NEXT_PUBLIC_SANITY_PROJECT_ID: 8wc8eouj/);
  assert.match(workflow, /NEXT_PUBLIC_SANITY_DATASET: production/);
  assert.match(workflow, /SANITY_WRITE_TOKEN: \$\{\{ secrets\.SANITY_WRITE_TOKEN \}\}/);
  assert.match(workflow, /npx tsx scripts\/create-update-drafts\.ts --write/);
  assert.match(workflow, /npx tsx scripts\/create-update-drafts\.ts\n/);
  assert.match(workflow, /CREATE UPDATE DRAFTS/);
  assert.match(workflow, /before any Sanity mutation/);
  assert.equal(workflow.includes(".publish("), false);
  assert.equal(workflow.includes("createOrReplace"), false);
  assert.equal(/echo[^\n]*SANITY_WRITE_TOKEN/.test(workflow), false);
  const script = runScript(workflow);
  const writeBranch = branch(script, 'if [ "$DRY_RUN" = "false" ]; then', "else");
  const dryRunBranch = branch(script, "\nelse\n", "\nfi\n");
  assert.match(writeBranch, /npx tsx scripts\/create-update-drafts\.ts --write/);
  assert.equal(dryRunBranch.includes("--write"), false);
  assert.match(dryRunBranch, /npx tsx scripts\/create-update-drafts\.ts/);
  const confirmExit = writeBranch.indexOf("exit 1");
  const writeCommand = writeBranch.indexOf("npx tsx scripts/create-update-drafts.ts --write");
  assert.ok(confirmExit >= 0 && writeCommand > confirmExit);
});

test("a missing or inexact confirmation exits before the creator", () => {
  for (const confirmation of ["", "create update drafts", "CREATE UPDATE DRAFTS ", " CREATE UPDATE DRAFTS", "CREATE  UPDATE DRAFTS"]) {
    const result = runWorkflow({ DRY_RUN: "false", CONFIRM_WRITE: confirmation });
    assert.equal(result.status, 1, JSON.stringify(confirmation));
    assert.equal(result.calls, "", JSON.stringify(confirmation));
    assert.match(result.stdout, /exactly: CREATE UPDATE DRAFTS/);
    assert.match(result.stdout, /before any Sanity mutation/);
    assertSummary(result.stdout, {
      expected: "0",
      english: "0",
      hebrew: "0",
      skipped: "0",
      failed: "0",
    });
  }
});

test("only an explicit false dry-run can reach the write command", () => {
  for (const dryRun of ["", "true", "True", "0", "yes"]) {
    const result = runWorkflow({ DRY_RUN: dryRun, CONFIRM_WRITE: "CREATE UPDATE DRAFTS" });
    assert.equal(result.status, 0, JSON.stringify(dryRun));
    assert.equal(result.calls, "tsx scripts/create-update-drafts.ts\n", JSON.stringify(dryRun));
  }
});

test("dry-run does not pass --write even when the confirmation phrase is present", () => {
  const result = runWorkflow({ DRY_RUN: "true", CONFIRM_WRITE: "CREATE UPDATE DRAFTS" });
  assert.equal(result.status, 0);
  assert.equal(result.calls, "tsx scripts/create-update-drafts.ts\n");
  assert.match(result.stdout, /Mode: dry-run/);
});

test("an exact confirmation is the only path that passes --write", () => {
  const result = runWorkflow({ DRY_RUN: "false", CONFIRM_WRITE: "CREATE UPDATE DRAFTS" });
  assert.equal(result.status, 0);
  assert.equal(result.calls, "tsx scripts/create-update-drafts.ts --write\n");
  assert.match(result.stdout, /Mode: write/);
  assert.equal(result.stdout.includes("Refusing to write"), false);
});

function assertSummary(
  stdout: string,
  counts: { expected: string; english: string; hebrew: string; skipped: string; failed: string },
): void {
  const summary = [
    `Expected updates: ${counts.expected}`,
    `English drafts created: ${counts.english}`,
    `Hebrew drafts created: ${counts.hebrew}`,
    `Skipped existing: ${counts.skipped}`,
    `Failed: ${counts.failed}`,
    "Published: 0",
  ].join("\n");
  assert.equal(stdout.trimEnd().endsWith(summary), true, stdout);
}

function runCreator(args: string[]) {
  const env = { ...process.env };
  delete env.SANITY_WRITE_TOKEN;
  return spawnSync("npx", ["tsx", "scripts/create-update-drafts.ts", ...args], {
    cwd: new URL("..", import.meta.url),
    env,
    encoding: "utf8",
  });
}

function branch(script: string, start: string, end: string): string {
  const from = script.indexOf(start);
  const to = script.indexOf(end, from + start.length);
  assert.ok(from >= 0 && to > from, `${start} .. ${end}`);
  return script.slice(from, to);
}

function runScript(source: string): string {
  const marker = "run: |\n";
  const start = source.indexOf(marker);
  assert.ok(start >= 0);
  const body = source.slice(start + marker.length).replace(/\s*$/, "");
  const lines = body.split("\n");
  const indent = lines.find((line) => line.trim())?.match(/^( *)/)?.[1].length ?? 0;
  return `${lines.map((line) => (line.startsWith(" ".repeat(indent)) ? line.slice(indent) : line)).join("\n")}\n`;
}

function runWorkflow(env: Record<string, string>) {
  const directory = mkdtempSync(join(tmpdir(), "update-drafts-workflow-"));
  const log = join(directory, "npx.log");
  const npx = join(directory, "npx");
  writeFileSync(npx, `#!/bin/sh\nprintf '%s\\n' "$*" >> ${JSON.stringify(log)}\n`);
  chmodSync(npx, 0o755);
  const script = join(directory, "run.sh");
  writeFileSync(script, runScript(workflow));
  const result = spawnSync("bash", ["-eo", "pipefail", script], {
    env: {
      ...process.env,
      PATH: `${directory}:/usr/bin:/bin`,
      ...env,
    },
    encoding: "utf8",
  });
  return {
    status: result.status,
    stdout: result.stdout,
    stderr: result.stderr,
    calls: readLog(log),
  };
}

function readLog(log: string): string {
  try {
    return readFileSync(log, "utf8");
  } catch {
    return "";
  }
}
