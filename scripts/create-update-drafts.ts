/**
 * Creates the first five Snacksmate Updates as unpublished bilingual article drafts.
 *
 * Dry-run is the default. It validates the documents and, when SANITY_WRITE_TOKEN
 * is set, reports collisions. It does not write.
 *
 *   npx tsx scripts/create-update-drafts.ts
 *   npx tsx scripts/create-update-drafts.ts --write
 *
 * --write uses client.create on ids that already start with drafts.
 * It never publishes, never calls createOrReplace, and skips an existing match.
 */

import { createClient, type SanityClient } from "@sanity/client";

import {
  formatUpdateDraftReport,
  updateDrafts,
  validateUpdateDrafts,
  type UpdateDraft,
} from "./update-drafts";

const PROJECT_ID = "8wc8eouj";
const DATASET = "production";
const API_VERSION = "2026-09-22";

const EXISTING_ARTICLES_QUERY = `*[_type == "article"]{
  _id,
  title,
  "slug": slug.current,
  language,
  translationSlug
}`;

type ExistingArticle = {
  _id: string;
  title?: string;
  slug?: string;
  language?: string;
  translationSlug?: string;
};

type CreatedDocument = {
  _id?: string;
};

function publishedId(id: string): string {
  return id.replace(/^drafts\./, "");
}

function collision(document: UpdateDraft, existing: readonly ExistingArticle[]): string | null {
  const logicalId = publishedId(document._id);
  for (const row of existing) {
    if (row._id === document._id || row._id === logicalId) return `id ${row._id}`;
    if (row.language === document.language && row.slug === document.slug.current) {
      return `slug ${row.slug} on ${row._id}`;
    }
    if (
      row.language === document.language &&
      row.translationSlug &&
      row.translationSlug === document.translationSlug
    ) {
      return `translationSlug ${row.translationSlug} on ${row._id}`;
    }
    if (row.language === document.language && row.title === document.title) {
      return `title on ${row._id}`;
    }
  }
  return null;
}

function isConflict(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && "statusCode" in error && error.statusCode === 409);
}

function assertDraftOnly(document: UpdateDraft): void {
  if (document._type !== "article") {
    throw new Error(`Refusing to write ${document._id}: only article drafts are allowed.`);
  }
  if (!document._id.startsWith("drafts.article-update-")) {
    throw new Error(`Refusing to write ${document._id}: id must be an unpublished article-update draft.`);
  }
  if (publishedId(document._id).startsWith("drafts.")) {
    throw new Error(`Refusing to write ${document._id}: nested drafts prefix.`);
  }
}

async function loadExisting(client: SanityClient): Promise<ExistingArticle[]> {
  const rows = await client.fetch<unknown>(EXISTING_ARTICLES_QUERY);
  if (!Array.isArray(rows)) return [];
  return rows.filter((row): row is ExistingArticle => {
    return Boolean(row && typeof row === "object" && "_id" in row && typeof row._id === "string");
  });
}

async function createDraft(client: SanityClient, document: UpdateDraft): Promise<void> {
  assertDraftOnly(document);
  const created = await client.create<CreatedDocument>(document);
  const createdId = created._id ?? "";
  if (!createdId.startsWith("drafts.")) {
    throw new Error(
      `Create returned "${createdId || "no id"}" for ${document._id}. Stopping. Nothing further will be written.`,
    );
  }
  const published = await client.fetch<ExistingArticle | null>(
    `*[_id == $id][0]{_id}`,
    { id: publishedId(document._id) },
  );
  if (published?._id) {
    throw new Error(
      `Published document ${published._id} exists after creating ${document._id}. Stopping. Do not publish.`,
    );
  }
}

async function main(): Promise<void> {
  const write = process.argv.includes("--write");
  const unexpected = process.argv.slice(2).filter((arg) => arg !== "--write");
  if (unexpected.length > 0) {
    throw new Error(`Unknown argument: ${unexpected.join(", ")}. Pass --write to create drafts. The default is dry-run.`);
  }

  console.log(formatUpdateDraftReport());
  const validation = validateUpdateDrafts();
  if (validation.errors.length > 0) {
    throw new Error("Draft validation failed. Nothing was written.");
  }

  const token = process.env.SANITY_WRITE_TOKEN?.trim();
  if (!token) {
    console.log("");
    console.log("SANITY_WRITE_TOKEN is not set. Draft collision checks and creation were not run.");
    console.log("Nothing was written. Nothing was published.");
    if (write) {
      throw new Error("Refusing --write without SANITY_WRITE_TOKEN.");
    }
    return;
  }

  const client = createClient({
    projectId: PROJECT_ID,
    dataset: DATASET,
    apiVersion: API_VERSION,
    token,
    useCdn: false,
    perspective: "raw",
  });

  const existing = await loadExisting(client);
  const pending: UpdateDraft[] = [];
  console.log("");
  console.log(`Existing article documents visible to this token: ${existing.length}`);
  for (const document of updateDrafts) {
    const match = collision(document, existing);
    if (match) {
      console.log(`Skip ${document._id}: ${match}`);
      continue;
    }
    pending.push(document);
    console.log(`${write ? "Create" : "Would create"} ${document._id}`);
  }

  if (!write) {
    console.log("");
    console.log("Dry-run only. Nothing was written. Nothing was published.");
    return;
  }

  for (const document of pending) {
    try {
      await createDraft(client, document);
      console.log(`Created draft ${document._id}`);
    } catch (error) {
      if (isConflict(error)) {
        console.log(`Skip ${document._id}: create conflict`);
        continue;
      }
      throw error;
    }
  }
  console.log("Done. No document was published.");
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});
