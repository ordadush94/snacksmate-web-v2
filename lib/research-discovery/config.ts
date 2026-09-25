/**
 * Research discovery queries.
 *
 * Edit this list to change what PubMed is asked for.
 * Ingestion logic reads the list; it does not hardcode these phrases.
 *
 * Terms are PubMed query syntax. Quoted strings are phrase searches.
 */
export const RESEARCH_DISCOVERY_QUERIES = [
  '"exercise snacks"',
  '"exercise snacking"',
  '"activity snacks"',
  '"physical activity snacks"',
  '"exercise snack"',
  '"brief exercise bouts"',
  '"short bouts of exercise"',
  '"vigorous intermittent lifestyle physical activity"',
  "VILPA",
  '"intermittent vigorous physical activity"',
] as const;

export const DEFAULT_RESEARCH_LOOKBACK_DAYS = 14;

const MIN_LOOKBACK_DAYS = 1;
const MAX_LOOKBACK_DAYS = 3650;

export function resolveLookbackDays(value: string | undefined): number {
  if (value === undefined || value.trim() === "") {
    return DEFAULT_RESEARCH_LOOKBACK_DAYS;
  }

  const parsed = Number(value);
  if (
    !Number.isInteger(parsed) ||
    parsed < MIN_LOOKBACK_DAYS ||
    parsed > MAX_LOOKBACK_DAYS
  ) {
    throw new Error(
      `RESEARCH_LOOKBACK_DAYS must be an integer from ${MIN_LOOKBACK_DAYS} to ${MAX_LOOKBACK_DAYS}. Received: ${value}`,
    );
  }

  return parsed;
}
