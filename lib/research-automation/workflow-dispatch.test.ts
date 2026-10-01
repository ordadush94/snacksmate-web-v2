import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmodSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

const workflow = readFileSync(
  new URL("../../.github/workflows/research-discovery.yml", import.meta.url),
  "utf8",
);
const automationScript = readFileSync(
  new URL("../../scripts/automate-research.ts", import.meta.url),
  "utf8",
);

test("manual full automation defaults off and discovery inputs stay in place", () => {
  assert.match(workflow, /cron: "0 8 \* \* 1,4"/);
  assert.equal(workflow.match(/cron:/g)?.length, 1);
  assert.match(workflow, /dry_run:[\s\S]*?type: boolean[\s\S]*?default: true/);
  assert.match(workflow, /lookback_days:[\s\S]*?default: "14"/);
  assert.match(
    workflow,
    /run_full_automation:[\s\S]*?type: boolean[\s\S]*?required: false[\s\S]*?default: false/,
  );
  assert.match(workflow, /max_creates:[\s\S]*?type: number[\s\S]*?required: false[\s\S]*?default: 1\n/);
  assert.match(workflow, /confirm_automation:[\s\S]*?type: string[\s\S]*?default: ""/);
  assert.match(workflow, /research:discover -- --dry-run/);
  assert.match(workflow, /npm run research:discover\n/);
  assert.equal(workflow.includes(".publish("), false);
  assert.equal(workflow.includes("createOrReplace"), false);
  assert.equal(/echo[^\n]*(SANITY_WRITE_TOKEN|OPENAI_API_KEY|NCBI_API_KEY)/.test(workflow), false);
});

test("full manual mode calls the existing automation runner after the gates", () => {
  const script = runScript(workflow);
  const schedule = branch(script, 'if [ "$GITHUB_EVENT_NAME" = "schedule" ]', 'elif [ "$RUN_FULL_AUTOMATION" = "true" ]');
  const manual = branch(script, 'elif [ "$RUN_FULL_AUTOMATION" = "true" ]', 'elif [ "$WRITE_DRAFTS" = "true" ]');
  const discoveryWrite = branch(script, 'elif [ "$WRITE_DRAFTS" = "true" ]', "else");
  const discoveryDryRun = branch(script, "\nelse\n", "\nfi\n");

  assert.match(schedule, /npm run research:automate -- --max-creates=10/);
  assert.equal(schedule.includes("RESEARCH_AUTOMATION_MODE"), false);
  assert.equal(manual.includes("research:discover"), false);
  assert.equal(manual.includes("--dry-run"), false);
  assert.equal(manual.includes(".publish("), false);
  assert.match(
    manual,
    /RESEARCH_AUTOMATION_MODE=manual npm run research:automate -- --max-creates="\$MAX_CREATES"/,
  );
  const confirmExit = manual.indexOf("exit 1");
  const maxExit = manual.lastIndexOf("exit 1");
  const automate = manual.indexOf("npm run research:automate");
  assert.ok(confirmExit >= 0 && maxExit > confirmExit && automate > maxExit);
  assert.match(manual, /Invalid confirmation/);
  assert.match(manual, /exactly: RUN AUTOMATION/);
  assert.match(manual, /before any Sanity write/);
  assert.match(manual, /Invalid max_creates/);
  assert.match(discoveryWrite, /npm run research:discover\n/);
  assert.equal(discoveryWrite.includes("research:automate"), false);
  assert.match(discoveryDryRun, /npm run research:discover -- --dry-run/);
  assert.equal(discoveryDryRun.includes("research:automate"), false);

  const calls = script.match(/npm run research:automate[^\n]*/g);
  assert.deepEqual(calls, [
    "npm run research:automate -- --max-creates=10",
    'npm run research:automate -- --max-creates="$MAX_CREATES"',
  ]);
});

test("the automation runner only relabels the manual report", () => {
  const pipeline = automationScript.indexOf("await runResearchDiscovery(");
  const enrich = automationScript.indexOf("runResearchEnrichment({");
  const translate = automationScript.indexOf("requestHebrewLocalization({");
  const label = automationScript.indexOf('process.env.RESEARCH_AUTOMATION_MODE === "manual"');
  assert.ok(pipeline >= 0 && enrich > pipeline && translate > enrich && label > translate);
  assert.equal(automationScript.split('RESEARCH_AUTOMATION_MODE === "manual"').length - 1, 1);
  assert.match(automationScript, /report\.manualFullAutomation = true/);
  assert.match(automationScript, /report\.maxCreates = args\.maxCreates/);
  assert.equal(automationScript.includes(".publish("), false);
  assert.equal(automationScript.includes("createOrReplace"), false);
});

test("wrong confirmation exits before any automation command", () => {
  for (const confirmation of ["", "run automation", "RUN AUTOMATION ", " RUN AUTOMATION", "RUN  AUTOMATION"]) {
    const result = runDispatch({
      GITHUB_EVENT_NAME: "workflow_dispatch",
      RUN_FULL_AUTOMATION: "true",
      WRITE_DRAFTS: "true",
      MAX_CREATES: "1",
      CONFIRM_AUTOMATION: confirmation,
    });
    assert.equal(result.status, 1, confirmation);
    assert.equal(result.calls, "", confirmation);
    assert.match(result.stdout, /Invalid confirmation/);
    assert.match(result.stdout, /RUN AUTOMATION/);
    assert.match(result.stdout, /before any Sanity write/);
  }
});

test("max_creates outside 1-10 exits before any automation command", () => {
  for (const maxCreates of ["0", "-1", "11", "100", "1.5", "08", "01", "", "ten", "1 0"]) {
    const result = runDispatch({
      GITHUB_EVENT_NAME: "workflow_dispatch",
      RUN_FULL_AUTOMATION: "true",
      WRITE_DRAFTS: "false",
      MAX_CREATES: maxCreates,
      CONFIRM_AUTOMATION: "RUN AUTOMATION",
    });
    assert.equal(result.status, 1, maxCreates);
    assert.equal(result.calls, "", maxCreates);
    assert.match(result.stdout, /Invalid max_creates/);
    assert.match(result.stdout, /before any Sanity write/);
  }
});

test("the first smoke-test inputs run one automated draft and ignore discovery dry-run", () => {
  const result = runDispatch({
    GITHUB_EVENT_NAME: "workflow_dispatch",
    RUN_FULL_AUTOMATION: "true",
    WRITE_DRAFTS: "false",
    MAX_CREATES: "1",
    CONFIRM_AUTOMATION: "RUN AUTOMATION",
  });
  assert.equal(result.status, 0);
  assert.equal(result.calls, "mode=manual args=run research:automate -- --max-creates=1\n");
  assert.match(result.stdout, /Mode: manual full automation/);
  assert.match(result.stdout, /Max creates: 1/);
  assert.equal(result.calls.includes("research:discover"), false);
  assert.equal(result.stdout.includes(".publish("), false);
});

test("max_creates 10 is the top of the allowed manual range", () => {
  const result = runDispatch({
    GITHUB_EVENT_NAME: "workflow_dispatch",
    RUN_FULL_AUTOMATION: "true",
    WRITE_DRAFTS: "false",
    MAX_CREATES: "10",
    CONFIRM_AUTOMATION: "RUN AUTOMATION",
  });
  assert.equal(result.status, 0);
  assert.equal(result.calls, "mode=manual args=run research:automate -- --max-creates=10\n");
});

test("unchecked full automation keeps the existing discovery paths", () => {
  const dryRun = runDispatch({
    GITHUB_EVENT_NAME: "workflow_dispatch",
    RUN_FULL_AUTOMATION: "false",
    WRITE_DRAFTS: "false",
    MAX_CREATES: "1",
    CONFIRM_AUTOMATION: "RUN AUTOMATION",
  });
  assert.equal(dryRun.status, 0);
  assert.equal(dryRun.calls, "mode= args=run research:discover -- --dry-run\n");

  const write = runDispatch({
    GITHUB_EVENT_NAME: "workflow_dispatch",
    RUN_FULL_AUTOMATION: "false",
    WRITE_DRAFTS: "true",
    MAX_CREATES: "11",
    CONFIRM_AUTOMATION: "",
  });
  assert.equal(write.status, 0);
  assert.equal(write.calls, "mode= args=run research:discover\n");
  assert.equal(write.calls.includes("--dry-run"), false);
  assert.equal(write.calls.includes("research:automate"), false);
});

test("the Monday and Thursday schedule still uses the capped automation runner", () => {
  const result = runDispatch({
    GITHUB_EVENT_NAME: "schedule",
    RUN_FULL_AUTOMATION: "",
    WRITE_DRAFTS: "",
    MAX_CREATES: "",
    CONFIRM_AUTOMATION: "",
  });
  assert.equal(result.status, 0);
  assert.equal(result.calls, "mode= args=run research:automate -- --max-creates=10\n");
  assert.equal(result.stdout.includes("Mode: manual full automation"), false);
});

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

function runDispatch(env: Record<string, string>) {
  const directory = mkdtempSync(join(tmpdir(), "research-dispatch-"));
  const log = join(directory, "npm.log");
  const npm = join(directory, "npm");
  writeFileSync(
    npm,
    `#!/bin/sh\nprintf '%s\\n' "mode=\${RESEARCH_AUTOMATION_MODE-} args=$*" >> ${JSON.stringify(log)}\n`,
  );
  chmodSync(npm, 0o755);
  const script = join(directory, "run.sh");
  writeFileSync(script, runScript(workflow));
  const result = spawnSync("bash", ["-eo", "pipefail", script], {
    env: {
      ...process.env,
      PATH: `${directory}:/usr/bin:/bin`,
      RESEARCH_AUTOMATION_MODE: "",
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
