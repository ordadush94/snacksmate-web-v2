import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmodSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

const workflow = readFileSync(
  new URL("../.github/workflows/hebrew-terminology-migration.yml", import.meta.url),
  "utf8",
);
const script = readFileSync(new URL("./migrate-hebrew-movement-snacks-terminology.ts", import.meta.url), "utf8");

test("the terminology workflow is manual, dry-run by default, and confirms a write", () => {
  assert.match(workflow, /name: Hebrew Terminology Migration\n/);
  assert.match(workflow, /workflow_dispatch:/);
  assert.equal(workflow.includes("schedule:"), false);
  assert.equal(workflow.includes("push:"), false);
  assert.equal(workflow.includes("pull_request:"), false);
  assert.match(workflow, /mode:[\s\S]*?type: choice[\s\S]*?-\s+dry-run[\s\S]*?-\s+write[\s\S]*?default: dry-run/);
  assert.match(
    workflow,
    /confirm_write:[\s\S]*?description: Type MIGRATE HEBREW TERMINOLOGY to allow production writes\.[\s\S]*?type: string[\s\S]*?default: ""/,
  );
  assert.match(workflow, /node-version: 22/);
  assert.match(workflow, /cache: npm/);
  assert.match(workflow, /npm ci/);
  assert.match(workflow, /actions\/checkout@v4/);
  assert.match(workflow, /NEXT_PUBLIC_SANITY_PROJECT_ID: 8wc8eouj/);
  assert.match(workflow, /NEXT_PUBLIC_SANITY_DATASET: production/);
  assert.match(workflow, /SANITY_WRITE_TOKEN: \$\{\{ secrets\.SANITY_WRITE_TOKEN \}\}/);
  assert.match(workflow, /npm run terminology:migrate -- --write/);
  assert.match(workflow, /npm run terminology:migrate\n/);
  assert.match(workflow, /MIGRATE HEBREW TERMINOLOGY/);
  assert.match(workflow, /before any Sanity mutation/);
  assert.equal(workflow.includes(".publish("), false);
  assert.equal(workflow.includes("schedule:"), false);
  assert.equal(/echo[^\n]*SANITY_WRITE_TOKEN/.test(workflow), false);
  const run = runScript(workflow);
  const writeBranch = branch(run, 'if [ "$MODE" = "write" ]; then', "elif");
  const dryRunBranch = branch(run, 'elif [ "$MODE" = "dry-run" ]; then', "else");
  assert.match(writeBranch, /npm run terminology:migrate -- --write/);
  assert.equal(dryRunBranch.includes("--write"), false);
  assert.match(dryRunBranch, /npm run terminology:migrate/);
  const confirmExit = writeBranch.indexOf("exit 1");
  const writeCommand = writeBranch.indexOf("npm run terminology:migrate -- --write");
  assert.ok(confirmExit >= 0 && writeCommand > confirmExit);
});

test("the migration script patches in place and never publishes", () => {
  assert.equal(script.includes(".publish("), false);
  assert.match(script, /perspective: "raw"/);
  assert.match(script, /client\.patch\(plan\.id\)\.set\(plan\.patch\)\.commit\(\{ autoGenerateArrayKeys: false \}\)/);
  const writeGuard = script.indexOf("if (!write)");
  const patchCall = script.indexOf("await writePatches");
  assert.ok(writeGuard >= 0 && patchCall > writeGuard);
});

test("a missing or inexact confirmation exits before the migration", () => {
  for (const confirmation of [
    "",
    "migrate hebrew terminology",
    "MIGRATE HEBREW TERMINOLOGY ",
    " MIGRATE HEBREW TERMINOLOGY",
    "MIGRATE  HEBREW TERMINOLOGY",
  ]) {
    const result = runWorkflow({ MODE: "write", CONFIRM_WRITE: confirmation });
    assert.equal(result.status, 1, JSON.stringify(confirmation));
    assert.equal(result.calls, "", JSON.stringify(confirmation));
    assert.match(result.stdout, /exactly: MIGRATE HEBREW TERMINOLOGY/);
    assert.match(result.stdout, /before any Sanity mutation/);
    assert.match(result.stdout, /Sanity writes: 0/);
    assert.match(result.stdout, /Published by script: 0/);
    assert.equal(result.stdout.includes("test-token-do-not-print"), false);
  }
});

test("dry-run does not pass --write even when the confirmation phrase is present", () => {
  const result = runWorkflow({ MODE: "dry-run", CONFIRM_WRITE: "MIGRATE HEBREW TERMINOLOGY" });
  assert.equal(result.status, 0);
  assert.equal(result.calls, "run terminology:migrate\n");
  assert.match(result.stdout, /Mode: dry-run/);
  assert.equal(result.stdout.includes("test-token-do-not-print"), false);
});

test("an exact confirmation is the only path that passes --write", () => {
  const result = runWorkflow({ MODE: "write", CONFIRM_WRITE: "MIGRATE HEBREW TERMINOLOGY" });
  assert.equal(result.status, 0);
  assert.equal(result.calls, "run terminology:migrate -- --write\n");
  assert.match(result.stdout, /Mode: write/);
  assert.equal(result.stdout.includes("Refusing to write"), false);
  assert.equal(result.stdout.includes("test-token-do-not-print"), false);
});

test("a missing token exits before any migration command", () => {
  const result = runWorkflow({ MODE: "dry-run", CONFIRM_WRITE: "", SANITY_WRITE_TOKEN: "" });
  assert.equal(result.status, 1);
  assert.equal(result.calls, "");
  assert.match(result.stdout, /The Sanity write secret is not set/);
  assert.match(result.stdout, /Sanity writes: 0/);
});

function branch(script: string, start: string, end: string): string {
  const from = script.indexOf(start);
  const to = script.indexOf(end, from + start.length);
  assert.ok(from >= 0 && to > from, `${start} .. ${end}`);
  return script.slice(from, to);
}

function runScript(source: string): string {
  const marker = "run: |\n";
  const start = source.lastIndexOf(marker);
  assert.ok(start >= 0);
  const body = source.slice(start + marker.length).replace(/\s*$/, "");
  const lines = body.split("\n");
  const indent = lines.find((line) => line.trim())?.match(/^( *)/)?.[1].length ?? 0;
  return `${lines.map((line) => (line.startsWith(" ".repeat(indent)) ? line.slice(indent) : line)).join("\n")}\n`;
}

function runWorkflow(env: Record<string, string>) {
  const directory = mkdtempSync(join(tmpdir(), "terminology-workflow-"));
  const log = join(directory, "npm.log");
  const npm = join(directory, "npm");
  writeFileSync(npm, `#!/bin/sh\nprintf '%s\\n' "$*" >> ${JSON.stringify(log)}\n`);
  chmodSync(npm, 0o755);
  const file = join(directory, "run.sh");
  writeFileSync(file, runScript(workflow));
  const result = spawnSync("bash", ["-eo", "pipefail", file], {
    env: {
      ...process.env,
      PATH: `${directory}:/usr/bin:/bin`,
      SANITY_WRITE_TOKEN: "test-token-do-not-print",
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
