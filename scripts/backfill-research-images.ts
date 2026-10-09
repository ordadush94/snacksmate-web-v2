import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { parseResearchImageArgs } from "../lib/research-images/args";
import { resolveResearchAiModel } from "../lib/research-enrichment/config";
import { createSanityWriteClient } from "../lib/research-discovery/sanity";
import { backfillHasFailures, formatResearchImageReport } from "../lib/research-images/report";
import { runResearchImageBackfill } from "../lib/research-images/run";
import {
  loadResearchImageDocuments,
  patchResearchImage,
  uploadResearchImage,
} from "../lib/research-images/sanity";

loadLocalEnv(".env.local");
loadLocalEnv(".env");

async function main() {
  const args = parseResearchImageArgs(process.argv.slice(2));
  const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID?.trim();
  const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET?.trim();
  const token = process.env.SANITY_WRITE_TOKEN?.trim();
  if (!projectId || !dataset || !token) {
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

  const result = await runResearchImageBackfill({
    dryRun: args.dryRun,
    scope: args.scope,
    maxImages: args.maxImages,
    confirm: args.confirm,
    model: process.env.RESEARCH_IMAGE_MODEL,
    qaModel: resolveResearchAiModel(process.env.RESEARCH_AI_MODEL),
    apiKey: process.env.OPENAI_API_KEY?.trim(),
    loadDocuments: () => loadResearchImageDocuments(client),
    uploadImage: (bytes, filename) => uploadResearchImage(client, bytes, filename),
    patchDocument: (id, fields) => patchResearchImage(client, id, fields),
  });

  console.log(formatResearchImageReport(result));
  if (!result.dryRun && backfillHasFailures(result)) process.exitCode = 1;
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
  const message = error instanceof Error ? error.message : "Research image backfill failed.";
  console.error(message);
  process.exit(1);
});
