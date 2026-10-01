import { TRANSLATION_CONTENT_TYPES, type TranslationContentType } from "./types";

export const DEFAULT_BULK_LIMIT = 5;
export const MAX_BULK_LIMIT = 25;

export type TranslationArgs = {
  type: TranslationContentType;
  id?: string;
  missing: boolean;
  /** Research-only. Localize drafts.research-pubmed-{PMID} without a published English document. */
  fromDraft: boolean;
  dryRun: boolean;
  limit: number;
};

export function parseTranslationArgs(argv: string[]): TranslationArgs {
  let dryRun = false;
  let missing = false;
  let write = false;
  let fromDraft = false;
  let type: string | undefined;
  let id: string | undefined;
  let limit: string | undefined;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--dry-run") {
      dryRun = true;
      continue;
    }
    if (arg === "--missing") {
      missing = true;
      continue;
    }
    if (arg === "--write") {
      write = true;
      continue;
    }
    if (arg === "--from-draft") {
      fromDraft = true;
      continue;
    }
    if (arg === "--type") {
      type = requiredValue(argv, index, "--type");
      index += 1;
      continue;
    }
    if (arg.startsWith("--type=")) {
      type = arg.slice("--type=".length);
      continue;
    }
    if (arg === "--id") {
      id = requiredValue(argv, index, "--id");
      index += 1;
      continue;
    }
    if (arg.startsWith("--id=")) {
      id = arg.slice("--id=".length);
      continue;
    }
    if (arg === "--limit") {
      limit = requiredValue(argv, index, "--limit");
      index += 1;
      continue;
    }
    if (arg.startsWith("--limit=")) {
      limit = arg.slice("--limit=".length);
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  if (!type || !isContentType(type)) {
    throw new Error("--type=article or --type=research is required.");
  }
  if (fromDraft && type !== "research") {
    throw new Error("--from-draft is only for --type=research. Articles still require a published English document.");
  }
  if (fromDraft && missing) {
    throw new Error("Pass either --from-draft or --missing, not both.");
  }
  if (id && missing) {
    throw new Error("Pass either --id or --missing, not both.");
  }
  if (fromDraft && !id) {
    throw new Error("--from-draft requires --id=drafts.research-pubmed-{PMID}.");
  }
  if (!id && !missing) {
    throw new Error("Pass --id for one published document, or --missing for published documents without Hebrew.");
  }
  if (write && !missing) {
    throw new Error("--write is only for --missing. A single --id creates a draft unless --dry-run is set.");
  }
  if (limit !== undefined && !missing) {
    throw new Error("--limit is only valid with --missing.");
  }

  const bulkDryRun = missing && !write;
  return {
    type,
    ...(id ? { id } : {}),
    missing,
    fromDraft,
    dryRun: dryRun || bulkDryRun,
    limit: missing ? resolveBulkLimit(limit) : 1,
  };
}

export function resolveBulkLimit(value: string | undefined): number {
  if (value === undefined || value.trim() === "") return DEFAULT_BULK_LIMIT;
  if (!/^\d+$/.test(value.trim())) {
    throw new Error(`Bulk limit must be an integer from 1 to ${MAX_BULK_LIMIT}.`);
  }
  const parsed = Number(value.trim());
  if (parsed < 1 || parsed > MAX_BULK_LIMIT) {
    throw new Error(
      `Bulk limit must be an integer from 1 to ${MAX_BULK_LIMIT}. Larger batches are refused so Hebrew localization cannot walk the library in one run.`,
    );
  }
  return parsed;
}

function isContentType(value: string): value is TranslationContentType {
  return (TRANSLATION_CONTENT_TYPES as readonly string[]).includes(value);
}

function requiredValue(argv: string[], index: number, flag: string): string {
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) throw new Error(`${flag} requires a value.`);
  return value;
}
