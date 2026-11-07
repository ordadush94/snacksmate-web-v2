/**
 * Replace the Hebrew copy on the five published Snacksmate Updates.
 *
 * The wording lives in scripts/update-drafts.ts. Dry-run is the default.
 *
 *   npx tsx scripts/revise-hebrew-article-copy.ts
 *   npx tsx scripts/revise-hebrew-article-copy.ts --write
 *
 * --write patches every reader-facing string: title, excerpt, seoTitle,
 * seoDescription, and the full Portable Text body (every block, including
 * headings and links). It patches the published Hebrew article, and the
 * draft overlay when one exists, so Studio does not keep the old wording.
 * It does not create documents and it does not publish. Image alt,
 * references, and canonical URL stay untouched because these articles have
 * none. The English translationReviewNote is internal and is not rewritten.
 */

import { createClient, type SanityClient } from "@sanity/client";
import { pathToFileURL } from "node:url";

import { blockText, updateDrafts, validateUpdateDrafts, type UpdateDraft } from "./update-drafts";

const PROJECT_ID = "8wc8eouj";
const DATASET = "production";
const API_VERSION = "2026-09-22";

export type HebrewArticleCopyPatch = {
  id: string;
  set: {
    title: string;
    excerpt: string;
    seoTitle: string;
    seoDescription: string;
    body: UpdateDraft["body"];
  };
};

export function hebrewArticleCopyPatches(
  documents: readonly UpdateDraft[] = updateDrafts,
): HebrewArticleCopyPatch[] {
  const validation = validateUpdateDrafts(documents);
  if (validation.errors.length > 0) {
    throw new Error(`Refusing to patch from invalid drafts.\n${validation.errors.join("\n")}`);
  }
  return documents
    .filter((document) => document.language === "he")
    .map((document) => {
      const id = document._id.replace(/^drafts\./, "");
      if (!/^article-update-[a-z0-9-]+-he$/.test(id)) {
        throw new Error(`Refusing to patch unexpected id ${document._id}.`);
      }
      return {
        id,
        set: {
          title: document.title,
          excerpt: document.excerpt,
          seoTitle: document.seoTitle,
          seoDescription: document.seoDescription,
          body: document.body,
        },
      };
    });
}

type ExistingArticle = {
  _id?: string;
  _type?: string;
  language?: string;
  title?: string;
  excerpt?: string;
  seoTitle?: string;
  seoDescription?: string;
  body?: UpdateDraft["body"];
};

function parseArgs(argv: readonly string[]): { write: boolean } {
  const write = argv.includes("--write");
  const dryRun = argv.includes("--dry-run");
  if (write && dryRun) throw new Error("Pass either --dry-run or --write, not both.");
  const unknown = argv.filter((arg) => arg !== "--write" && arg !== "--dry-run");
  if (unknown.length > 0) throw new Error(`Unknown argument: ${unknown.join(", ")}`);
  return { write };
}

function copyChanged(current: ExistingArticle, patch: HebrewArticleCopyPatch): boolean {
  return (
    current.title !== patch.set.title ||
    current.excerpt !== patch.set.excerpt ||
    current.seoTitle !== patch.set.seoTitle ||
    current.seoDescription !== patch.set.seoDescription ||
    blockText(current.body ?? []) !== blockText(patch.set.body)
  );
}

async function main(): Promise<void> {
  const { write } = parseArgs(process.argv.slice(2));
  const patches = hebrewArticleCopyPatches();
  const token = process.env.SANITY_WRITE_TOKEN?.trim();
  if (write && !token) {
    throw new Error("Refusing --write without SANITY_WRITE_TOKEN. Dry-run does not need it.");
  }

  console.log(`Hebrew article copy patches: ${patches.length}`);
  for (const patch of patches) {
    console.log(`- ${patch.id}: ${patch.set.title}`);
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

  const existing = client ? await loadWithToken(client, patches) : await loadPublished(patches);
  let changed = 0;
  for (const patch of patches) {
    const current = existing.get(patch.id);
    if (!current) {
      console.log(`Missing ${patch.id}. Nothing will be created.`);
      continue;
    }
    if (!copyChanged(current, patch)) {
      console.log(`Unchanged ${patch.id}.`);
      continue;
    }
    changed += 1;
    console.log(`Will update ${patch.id}.`);
    for (const line of fieldDiff(current, patch)) console.log(line);
  }
  console.log(`Documents that differ: ${changed}`);
  console.log("Published by script: 0");

  if (!write) {
    console.log("Dry-run only. No Sanity document was changed.");
    return;
  }

  let patched = 0;
  for (const patch of patches) {
    const targets = [patch.id, `drafts.${patch.id}`];
    for (const id of targets) {
      const current = existing.get(id);
      if (!current) continue;
      assertHebrewArticle(current, id);
      if (!copyChanged(current, patch)) continue;
      await client!.patch(id).set(patch.set).commit({ autoGenerateArrayKeys: false });
      patched += 1;
      console.log(`Patched ${id}.`);
    }
  }
  console.log(`Documents patched: ${patched}`);
  console.log("Published by script: 0");
}

function fieldDiff(current: ExistingArticle, patch: HebrewArticleCopyPatch): string[] {
  const lines: string[] = [];
  const fields = ["title", "excerpt", "seoTitle", "seoDescription"] as const;
  for (const field of fields) {
    if ((current[field] ?? "") !== patch.set[field]) lines.push(`  ${field}: changed`);
  }
  const currentBlocks = current.body ?? [];
  const nextBlocks = patch.set.body;
  if (blockText(currentBlocks) === blockText(nextBlocks)) return lines;
  lines.push(`  body: ${currentBlocks.length} blocks -> ${nextBlocks.length} blocks`);
  const count = Math.max(currentBlocks.length, nextBlocks.length);
  for (let index = 0; index < count; index += 1) {
    const before = blockText(currentBlocks.slice(index, index + 1));
    const after = blockText(nextBlocks.slice(index, index + 1));
    if (before !== after) lines.push(`    [${index}] changed`);
  }
  return lines;
}

function assertHebrewArticle(document: ExistingArticle, id: string): void {
  if (document._type !== "article" || document.language !== "he") {
    throw new Error(`Refusing to patch ${id}: expected a Hebrew article.`);
  }
}

async function loadWithToken(
  client: SanityClient,
  patches: readonly HebrewArticleCopyPatch[],
): Promise<Map<string, ExistingArticle>> {
  const ids = patches.flatMap((patch) => [patch.id, `drafts.${patch.id}`]);
  const rows = await client.fetch<ExistingArticle[]>(
    `*[_id in $ids]{ _id, _type, language, title, excerpt, seoTitle, seoDescription, body }`,
    { ids },
  );
  return new Map(rows.filter((row) => typeof row._id === "string").map((row) => [row._id as string, row]));
}

async function loadPublished(
  patches: readonly HebrewArticleCopyPatch[],
): Promise<Map<string, ExistingArticle>> {
  const ids = patches.map((patch) => patch.id);
  const response = await fetch(
    `https://${PROJECT_ID}.api.sanity.io/v${API_VERSION}/data/query/${DATASET}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: `*[_id in $ids]{ _id, _type, language, title, excerpt, seoTitle, seoDescription, body }`,
        params: { ids },
      }),
    },
  );
  if (!response.ok) throw new Error(`Sanity query failed with HTTP ${response.status}.`);
  const body = (await response.json()) as { result?: ExistingArticle[] };
  if (!Array.isArray(body.result)) throw new Error("Sanity query did not return documents.");
  return new Map(body.result.filter((row) => typeof row._id === "string").map((row) => [row._id as string, row]));
}

const invokedDirectly =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (invokedDirectly) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
