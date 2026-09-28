export const DEFAULT_BACKFILL_FROM = "2019-01-01";
export const DEFAULT_BACKFILL_LIMIT = 30;
export const MAX_BACKFILL_LIMIT = 100;

const WRITE_DISABLED =
  "Research backfill writing is not implemented. This phase is dry-run only and makes zero Sanity mutations.";

export type BackfillArgs = {
  dryRun: true;
  from: string;
  to: string;
  limit: number;
};

export function parseBackfillArgs(argv: string[], today: string | Date = currentIsoDate()): BackfillArgs {
  let from = DEFAULT_BACKFILL_FROM;
  let to = today instanceof Date ? today.toISOString().slice(0, 10) : today;
  let limit = String(DEFAULT_BACKFILL_LIMIT);

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--dry-run") continue;
    if (arg === "--write" || arg === "--no-dry-run") {
      throw new Error(WRITE_DISABLED);
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

  const fromDate = assertIsoDate(from, "--from");
  const toDate = assertIsoDate(to, "--to");
  if (fromDate > toDate) {
    throw new Error(`--from must be on or before --to. Received ${fromDate} > ${toDate}.`);
  }

  return {
    dryRun: true,
    from: fromDate,
    to: toDate,
    limit: resolveBackfillLimit(limit),
  };
}

export function resolveBackfillLimit(value: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > MAX_BACKFILL_LIMIT) {
    throw new Error(
      `--limit must be an integer from 1 to ${MAX_BACKFILL_LIMIT}. Received: ${value}`,
    );
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
