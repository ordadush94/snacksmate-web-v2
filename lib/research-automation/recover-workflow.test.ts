import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmodSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

const workflow = readFileSync(
  new URL("../../.github/workflows/recover-research-drafts.yml", import.meta.url),
  "utf8",
);

test("the recovery workflow is a separate manual job and does not run discovery", () => {
  assert.match(workflow, /^name: Recover Research Drafts\n/);
  assert.match(workflow, /workflow_dispatch:/);
  assert.equal(workflow.includes("schedule:"), false);
  assert.equal(workflow.includes("cron:"), false);
  const jobs = workflow.split(/^jobs:\n/m)[1] ?? "";
  assert.deepEqual(jobs.match(/^  [a-z0-9-]+:/gm), ["  recover:"]);
  assert.match(jobs, /name: Research Recovery/);
  assert.match(workflow, /dry_run:[\s\S]*?description: Preview the recovery without OpenAI calls or Sanity writes[\s\S]*?type: boolean[\s\S]*?default: true/);
  assert.match(
    workflow,
    /confirm_write:[\s\S]*?description: Type RECOVER RESEARCH DRAFTS to allow the live recovery[\s\S]*?type: string[\s\S]*?required: false[\s\S]*?default: ""/,
  );
  assert.equal(workflow.includes("research:discover"), false);
  assert.equal(workflow.includes("research:automate"), false);
  assert.equal(workflow.includes("research:import"), false);
  assert.match(workflow, /npm run research:recover -- --dry-run\n/);
  assert.match(workflow, /npm run research:recover -- --write\n/);
  assert.equal(workflow.includes(".publish("), false);
  assert.equal(workflow.includes("createOrReplace"), false);
  assert.match(workflow, /NEXT_PUBLIC_SANITY_PROJECT_ID: 8wc8eouj/);
  assert.match(workflow, /NEXT_PUBLIC_SANITY_DATASET: production/);
  assert.match(workflow, /SANITY_WRITE_TOKEN: \$\{\{ secrets\.SANITY_WRITE_TOKEN \}\}/);
  assert.match(workflow, /OPENAI_API_KEY: \$\{\{ secrets\.OPENAI_API_KEY \}\}/);
  assert.match(workflow, /RECOVER_CONFIRM: RECOVER RESEARCH DRAFTS/);
  assert.match(workflow, /PMID 42948631 touched: no/);
  assert.equal(workflow.includes('echo "$SANITY_WRITE_TOKEN"'), false);
  assert.equal(workflow.includes('echo "$OPENAI_API_KEY"'), false);
  assert.equal(workflow.includes("echo $SANITY_WRITE_TOKEN"), false);
  assert.equal(workflow.includes("echo $OPENAI_API_KEY"), false);
});

test("dry_run previews recovery and never calls another research command", () => {
  const result = runRecovery({ DRY_RUN: "true", CONFIRM_WRITE: "" });
  assert.equal(result.status, 0);
  assert.equal(result.calls, "run research:recover -- --dry-run\n");
  assert.match(result.stdout, /Recovery dry_run: true/);
  assert.match(result.stdout, /Recovery targets: 42925061, 42923131/);
  assert.match(result.stdout, /PMID 42948631 touched: no/);
  assert.match(result.stdout, /No OpenAI calls and no Sanity writes/);
  assert.match(result.stdout, /Published: 0/);
  assert.equal(result.calls.includes("--write"), false);
  assert.equal(result.calls.includes("research:discover"), false);
});

test("a live run without the exact confirmation exits before npm", () => {
  for (const confirmation of ["", "recover research drafts", "RECOVER RESEARCH DRAFTS ", " RECOVER RESEARCH DRAFTS", "RUN AUTOMATION"]) {
    const result = runRecovery({ DRY_RUN: "false", CONFIRM_WRITE: confirmation });
    assert.equal(result.status, 1, JSON.stringify(confirmation));
    assert.equal(result.calls, "", JSON.stringify(confirmation));
    assert.match(result.stdout, /Invalid confirmation/);
    assert.match(result.stdout, /before any OpenAI call or Sanity write/);
    assert.match(result.stdout, /PMID 42948631 touched: no/);
    assert.match(result.stdout, /Published: 0/);
  }
});

test("the exact confirmation is the only path to research:recover --write", () => {
  const result = runRecovery({ DRY_RUN: "false", CONFIRM_WRITE: "RECOVER RESEARCH DRAFTS" });
  assert.equal(result.status, 0);
  assert.equal(result.calls, "run research:recover -- --write\n");
  assert.match(result.stdout, /Recovery dry_run: false/);
  assert.equal(result.calls.includes("--dry-run"), false);
  assert.equal(result.calls.includes("research:discover"), false);
  assert.equal(result.calls.includes("research:automate"), false);
});

test("missing secrets fail before any recovery command", () => {
  const missingToken = runRecovery({ DRY_RUN: "false", CONFIRM_WRITE: "RECOVER RESEARCH DRAFTS", SANITY_WRITE_TOKEN: "" });
  assert.equal(missingToken.status, 1);
  assert.equal(missingToken.calls, "");
  assert.match(missingToken.stdout, /SANITY_WRITE_TOKEN is missing/);
  assert.equal(missingToken.stdout.includes("test-openai-key"), false);

  const missingKey = runRecovery({ DRY_RUN: "true", CONFIRM_WRITE: "", OPENAI_API_KEY: "" });
  assert.equal(missingKey.status, 1);
  assert.equal(missingKey.calls, "");
  assert.match(missingKey.stdout, /OPENAI_API_KEY is missing/);
  assert.equal(missingKey.stdout.includes("test-sanity-token"), false);
});

test("an unexpected dry_run value does not write", () => {
  const result = runRecovery({ DRY_RUN: "", CONFIRM_WRITE: "RECOVER RESEARCH DRAFTS" });
  assert.equal(result.status, 1);
  assert.equal(result.calls, "");
  assert.match(result.stdout, /Invalid dry_run/);
  assert.match(result.stdout, /before any OpenAI call or Sanity write/);
});

function runRecovery(env: Record<string, string>) {
  const directory = mkdtempSync(join(tmpdir(), "research-recover-workflow-"));
  const log = join(directory, "npm.log");
  const npm = join(directory, "npm");
  writeFileSync(npm, `#!/bin/sh\nprintf '%s\\n' "$*" >> ${JSON.stringify(log)}\n`);
  chmodSync(npm, 0o755);
  const script = join(directory, "run.sh");
  writeFileSync(script, runScript(workflow));
  const result = spawnSync("bash", ["-eo", "pipefail", script], {
    env: {
      ...process.env,
      PATH: `${directory}:/usr/bin:/bin`,
      SANITY_WRITE_TOKEN: "test-sanity-token",
      OPENAI_API_KEY: "test-openai-key",
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

function runScript(source: string): string {
  const marker = "run: |\n";
  const start = source.lastIndexOf(marker);
  assert.ok(start >= 0);
  const body = source.slice(start + marker.length).replace(/\s*$/, "");
  const lines = body.split("\n");
  const indent = lines.find((line) => line.trim())?.match(/^( *)/)?.[1].length ?? 0;
  return `${lines.map((line) => (line.startsWith(" ".repeat(indent)) ? line.slice(indent) : line)).join("\n")}\n`;
}

function readLog(log: string): string {
  try {
    return readFileSync(log, "utf8");
  } catch {
    return "";
  }
}
