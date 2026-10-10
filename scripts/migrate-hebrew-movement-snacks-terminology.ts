/**
 * One-off Hebrew terminology migration for Snacksmate Research and Updates.
 *
 * Default: dry-run. Nothing is written.
 *
 *   npx tsx scripts/migrate-hebrew-movement-snacks-terminology.ts
 *   npx tsx scripts/migrate-hebrew-movement-snacks-terminology.ts --dry-run
 *   npx tsx scripts/migrate-hebrew-movement-snacks-terminology.ts --write
 *
 * --write patches allowlisted reader-facing fields on existing Hebrew
 * documents. Published documents stay published. Drafts stay drafts.
 * It does not create documents and it does not publish.
 */

import { createClient, type SanityClient } from "@sanity/client";
import { pathToFileURL } from "node:url";

import {
  formatTerminologyMigrationReport,
  planTerminologyMigration,
  type TerminologyDocumentPlan,
} from "../lib/translation/terminology-migration";

const PROJECT_ID = "8wc8eouj";
const DATASET = "production";
const API_VERSION = "2026-09-22";

const HEBREW_CONTENT_QUERY = `*[_type in ["research", "article"] && language == "he"]`;

export function parseTerminologyMigrationArgs(argv: readonly string[]): { write: boolean } {
  const write = argv.includes("--write");
  const dryRun = argv.includes("--dry-run");
  if (write && dryRun) {
    throw new Error("Pass either --dry-run or --write, not both.");
  }
  const unknown = argv.filter((arg) => arg !== "--write" && arg !== "--dry-run");
  if (unknown.length > 0) {
    throw new Error(`Unknown argument: ${unknown.join(", ")}`);
  }
  return { write };
}

async function main(): Promise<void> {
  const { write } = parseTerminologyMigrationArgs(process.argv.slice(2));
  const token = process.env.SANITY_WRITE_TOKEN?.trim();
  if (write && !token) {
    throw new Error("Refusing --write without SANITY_WRITE_TOKEN. Dry-run does not need it.");
  }

  const client = token
    ? createClient({
        projectId: PROJECT_ID,
        dataset: DATASET,
        apiVersion: API_VERSION,
        token,
        useCdn: false,
        perspective: "raw",
      })
    : null;

  const documents = client ? await client.fetch<unknown[]>(HEBREW_CONTENT_QUERY) : await fetchPublishedHebrew();
  const plan = planTerminologyMigration(documents);
  console.log(formatTerminologyMigrationReport(plan, write ? "write" : "dry-run"));
  console.log("");
  if (client) {
    console.log("Read perspective: raw (published documents and drafts).");
  } else {
    console.log("Read perspective: published.");
    console.log("SANITY_WRITE_TOKEN is not set, so Hebrew drafts were not read.");
    const hidden = await unpublishedOverlayCandidates();
    if (hidden.length > 0) {
      console.log(
        "These published ids are missing from the unauthenticated drafts perspective and may have draft overlays:",
      );
      for (const id of hidden) console.log(`- ${id}`);
    }
  }
  console.log("Published by this script: 0");

  if (!write) {
    console.log("Dry-run only. No Sanity document was changed.");
    return;
  }

  await writePatches(client!, plan.plans);
}

async function fetchPublishedHebrew(): Promise<unknown[]> {
  const response = await fetch(queryUrl("published"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query: HEBREW_CONTENT_QUERY }),
  });
  if (!response.ok) {
    throw new Error(`Sanity query failed with HTTP ${response.status}.`);
  }
  const body = (await response.json()) as { result?: unknown };
  if (!Array.isArray(body.result)) throw new Error("Sanity query did not return documents.");
  return body.result;
}

async function unpublishedOverlayCandidates(): Promise<string[]> {
  const [published, drafts] = await Promise.all([
    fetchIds("published"),
    fetchIds("drafts"),
  ]);
  const visibleInDrafts = new Set(drafts);
  return published.filter((id) => !visibleInDrafts.has(id));
}

async function fetchIds(perspective: "published" | "drafts"): Promise<string[]> {
  const response = await fetch(queryUrl(perspective), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query: `*[_type in ["research", "article"] && language == "he"]{ _id }`,
    }),
  });
  if (!response.ok) return [];
  const body = (await response.json()) as { result?: Array<{ _id?: string }> };
  if (!Array.isArray(body.result)) return [];
  return body.result.flatMap((row) => (typeof row._id === "string" ? [row._id] : []));
}

function queryUrl(perspective: "published" | "drafts"): string {
  const url = new URL(`https://${PROJECT_ID}.api.sanity.io/v${API_VERSION}/data/query/${DATASET}`);
  url.searchParams.set("perspective", perspective);
  return url.toString();
}

async function writePatches(client: SanityClient, plans: readonly TerminologyDocumentPlan[]): Promise<void> {
  let patched = 0;
  for (const plan of plans) {
    if (Object.keys(plan.patch).length === 0) continue;
    await client.patch(plan.id).set(plan.patch).commit({ autoGenerateArrayKeys: false });
    patched += 1;
    console.log(`Patched ${plan.id} (${plan.publication}).`);
  }
  console.log(`Documents patched: ${patched}`);
  console.log("Published by this script: 0");
}

const invokedDirectly =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (invokedDirectly) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
