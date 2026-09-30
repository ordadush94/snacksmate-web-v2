export const DEFAULT_BACKFILL_FROM = "2019-01-01";
export const DEFAULT_BACKFILL_LIMIT = 10;
/** Dry-run previews may rank a wider list than a write is allowed to create. */
export const MAX_BACKFILL_DRY_RUN_LIMIT = 100;
export const MAX_BACKFILL_WRITE_LIMIT = 25;

export type BackfillArgs = {
  dryRun: boolean;
  /** Create unpublished English drafts. Never publishes. */
  write: boolean;
  /** After a write, run the existing enrichment runner as a separate stage. */
  enrich: boolean;
  from: string;
  to: string;
  limit: number;
};

export function parseBackfillArgs(argv: string[], today: string | Date = currentIsoDate()): BackfillArgs {
  let from = DEFAULT_BACKFILL_FROM;
  let to = today instanceof Date ? today.toISOString().slice(0, 10) : today;
  let limit = String(DEFAULT_BACKFILL_LIMIT);
  let write = false;
  let dryRunFlag = false;
  let enrich = false;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--dry-run") {
      dryRunFlag = true;
      continue;
    }
    if (arg === "--write") {
      write = true;
      continue;
    }
    if (arg === "--no-dry-run") {
      throw new Error("Writing requires --write. Refusing --no-dry-run.");
    }
    if (arg === "--enrich") {
      enrich = true;
      continue;
    }
    if (arg === "--from") {
      from = readValue(argv, index, "--from");
      index += 1;
      continue;
    }
    if (arg.startsWith("--from=")) {
      from = arg.slice("--from=".length);
      continue;
    }
    if (arg === "--to") {
      to = readValue(argv, index, "--to");
      index += 1;
      continue;
    }
    if (arg.startsWith("--to=")) {
      to = arg.slice("--to=".length);
      continue;
    }
    if (arg === "--limit") {
      limit = readValue(argv, index, "--limit");
      index += 1;
      continue;
    }
    if (arg.startsWith("--limit=")) {
      limit = arg.slice("--limit=".length);
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  if (write && dryRunFlag) {
    throw new Error("Pass either --dry-run or --write, not both.");
  }
  if (enrich && !write) {
    throw new Error("--enrich runs only after --write creates drafts. A dry-run does not enrich.");
  }

  const fromDate = assertIsoDate(from, "--from");
  const toDate = assertIsoDate(to, "--to");
  if (fromDate > toDate) {
    throw new Error(`--from must be on or before --to. Received ${fromDate} > ${toDate}.`);
  }

  return {
    dryRun: !write,
    write,
    enrich,
    from: fromDate,
    to: toDate,
    limit: resolveBackfillLimit(limit, write),
  };
}

export function resolveBackfillLimit(value: string, write = false): number {
  const max = write ? MAX_BACKFILL_WRITE_LIMIT : MAX_BACKFILL_DRY_RUN_LIMIT;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > max) {
    const writeNote = write ? " when using --write" : "";
    throw new Error(`--limit must be an integer from 1 to ${max}${writeNote}. Received: ${value}`);
  }
  return parsed;
}

export function currentIsoDate(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

function readValue(argv: string[], index: number, flag: string): string {
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`${flag} requires a value.`);
  }
  return value;
}

function assertIsoDate(value: string, label: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`${label} must be YYYY-MM-DD. Received: ${value}`);
  }
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new Error(`${label} is not a real calendar date. Received: ${value}`);
  }
  return value;
}
