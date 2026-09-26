import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { editorialBackfillPatch } from "../lib/research-editorial/backfill";
import { patchResearchDraft } from "../lib/research-enrichment/sanity";
import { createSanityWriteClient } from "../lib/research-discovery/sanity";

/**
 * Optional manual backfill. Dry-run unless --write is passed.
 * Sets editorialStatus to needs_review on AI-enriched PubMed drafts whose
 * editorial status is empty. Never publishes. Never overwrites a stored status.
 * Never patches a published document id.
 *
 * This script is not run by tests, builds, or GitHub workflows.
 */

loadLocalEnv(".env.local");
loadLocalEnv(".env");

const CANDIDATES_QUERY = `*[
  _type == "research" &&
  _id in path("drafts.**") &&
  !defined(editorialStatus) &&
  defined(aiEnrichmentStatus)
]{
  _id,
  editorialStatus,
  aiEnrichmentStatus
}`;

function parseArgs(argv: string[]) {
  let write = false;
  for (const arg of argv) {
    if (arg === "--write") {
      write = true;
      continue;
    }
    if (arg === "--dry-run") continue;
    throw new Error(`Unknown argument: ${arg}. Pass --write to update drafts. The default is dry-run.`);
  }
  return { write };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const token = process.env.SANITY_WRITE_TOKEN?.trim();
  const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID?.trim();
  const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET?.trim();
  if (!token || !projectId || !dataset) {
    throw new Error(
      "SANITY_WRITE_TOKEN, NEXT_PUBLIC_SANITY_PROJECT_ID, and NEXT_PUBLIC_SANITY_DATASET must be set. Dry-run still only reads.",
    );
  }

  const client = createSanityWriteClient({
    projectId,
    dataset,
    apiVersion: process.env.NEXT_PUBLIC_SANITY_API_VERSION?.trim() || "2026-09-22",
    token,
  });
  const rows = await client.fetch<unknown>(CANDIDATES_QUERY);
  const candidates = Array.isArray(rows) ? rows : [];
  let eligible = 0;
  let updated = 0;
  let skipped = 0;

  console.log(
    args.write
      ? "Mode: write. Empty editorial statuses on eligible drafts will be set to needs_review. Nothing will be published."
      : "Mode: dry-run. No Sanity documents will be modified.",
  );

  for (const row of candidates) {
    if (!row || typeof row !== "object") {
      skipped += 1;
      continue;
    }
    const record = row as {
      _id?: unknown;
      editorialStatus?: unknown;
      aiEnrichmentStatus?: unknown;
    };
    if (typeof record._id !== "string") {
      skipped += 1;
      continue;
    }
    const patch = editorialBackfillPatch({
      _id: record._id,
      editorialStatus: typeof record.editorialStatus === "string" ? record.editorialStatus : null,
      aiEnrichmentStatus:
        typeof record.aiEnrichmentStatus === "string" ? record.aiEnrichmentStatus : null,
    });
    if (!patch) {
      skipped += 1;
      console.log(`Skipping ${record._id}. It is not an empty AI-enriched PubMed draft.`);
      continue;
    }

    eligible += 1;
    if (!args.write) {
      console.log(`Would set ${record._id} editorialStatus to needs_review.`);
      continue;
    }

    await patchResearchDraft(client, record._id, patch);
    updated += 1;
    console.log(`Set ${record._id} editorialStatus to needs_review.`);
  }

  console.log("");
  console.log("Editorial status backfill summary");
  console.log(`  Mode: ${args.write ? "write" : "dry-run"}`);
  console.log(`  Candidates read: ${candidates.length}`);
  console.log(`  Eligible: ${eligible}`);
  console.log(`  Updated: ${updated}`);
  console.log(`  Skipped: ${skipped}`);
  console.log("  Published documents were not modified.");
}

function loadLocalEnv(filename: string) {
  const path = resolve(process.cwd(), filename);
  if (!existsSync(path)) return;

  const text = readFileSync(path, "utf8");
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator <= 0) continue;
    const key = trimmed.slice(0, separator).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;
    if (process.env[key] !== undefined) continue;
    let value = trimmed.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Editorial status backfill failed.";
  console.error(message);
  process.exit(1);
});
