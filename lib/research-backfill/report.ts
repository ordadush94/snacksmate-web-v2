import { RESEARCH_DISCOVERY_QUERIES } from "../research-discovery/config";
import type { BackfillCandidate } from "./rank";
import { PRIORITY_WEIGHTS, publicationAgeYears } from "./score";

export type BackfillReportInput = {
  from: string;
  to: string;
  queries: readonly string[];
  pubmedRecordsFound: number;
  queriesTruncated: number;
  errors: number;
  rejectedIrrelevant: number;
  heldForReview: number;
  passedRelevance: number;
  alreadyInSanity: number;
  eligibleNew: number;
  ranked: readonly BackfillCandidate[];
  eligible: readonly BackfillCandidate[];
  skipped: readonly BackfillCandidate[];
  sanityWrites: 0;
  currentYear: number;
};

export function formatBackfillReport(result: BackfillReportInput): string {
  const lines: string[] = [
    "Research backfill — dry-run",
    `Search period: ${result.from} through ${result.to} (PubMed publication date)`,
    "Queries: the shared RESEARCH_DISCOVERY_QUERIES list",
    ...result.queries.map((query) => `  - ${query}`),
    "Sanity mutations: 0",
    "Published: nothing",
    "",
    "Counts",
    `  PubMed records found: ${result.pubmedRecordsFound}`,
    `  Rejected as irrelevant: ${result.rejectedIrrelevant}`,
    `  Held for review (did not pass the relevance gate): ${result.heldForReview}`,
    `  Passed relevance: ${result.passedRelevance}`,
    `  Already in Sanity: ${result.alreadyInSanity}`,
    `  Eligible new studies: ${result.eligibleNew}`,
    `  Ranked in this run: ${result.ranked.length}`,
    "  Tables below are that ranked set, split by whether Sanity already has the study.",
    `  Queries truncated: ${result.queriesTruncated}`,
    `  Errors: ${result.errors}`,
    "",
    "ELIGIBLE NEW STUDIES",
    result.eligible.length === 0 ? "None." : formatTable(result.eligible),
    "",
    "ALREADY IN SANITY — SKIPPED",
    result.skipped.length === 0 ? "None." : formatTable(result.skipped),
    "",
    "Why the top 10 ranked highly",
  ];

  const top = result.ranked.slice(0, 10);
  if (top.length === 0) {
    lines.push("None.");
  } else {
    for (const candidate of top) {
      lines.push(`${candidate.rank}. ${candidate.title}`);
      lines.push(`   ${candidate.reason}`);
      lines.push(
        `   relevance ${formatScore(candidate.relevanceScore)} · design ${formatScore(candidate.designScore)} (${candidate.designLabel}) · citation ${formatScore(candidate.citationScore)} · citations/year ${formatRate(candidate.citationsPerYear)} · sample signal ${formatScore(candidate.sampleSizeSignal)} · recency ${formatScore(candidate.recencyScore)} · priority ${formatScore(candidate.priorityScore)}`,
      );
      lines.push(
        candidate.citationCount == null
          ? "   Citation count: missing."
          : `   Citation count source: ${candidate.citationSource ?? "unspecified"}.`,
      );
      if (candidate.existing) {
        const pair =
          candidate.studyDocumentIds.length > 1
            ? ` Translation pair counted once: ${candidate.studyDocumentIds.join(", ")}.`
            : "";
        lines.push(
          `   Matched ${candidate.matchedDocumentId} by ${candidate.matchReason}.${pair}`,
        );
      }
    }
  }

  const weights = PRIORITY_WEIGHTS;
  lines.push(
    "",
    "Ranking formula",
    `  priority = relevance×${weights.relevance} + design×${weights.design} + citation×${weights.citation} + sample×${weights.sampleSize} + recency×${weights.recency}`,
    "  Each component is 0–100. A study must pass assessRelevance as auto_draft before it is scored.",
    "  Citation score is log(1 + citations per year) / log(1 + 20 citations per year), capped at 100.",
    `  Citations per year use age = (window end year − publication year) + 1. For ${result.currentYear}, a paper from that year has age ${publicationAgeYears(result.currentYear, result.currentYear)}.`,
    "  A missing citation count scores 0 and stays blank. It does not drop the study.",
    "  Sample size is used only when PubMed already extracted one unambiguous value. It is never invented.",
    "  Recency is a small tie-break. It does not outweigh study design.",
    "",
    `Shared discovery queries in this run: ${RESEARCH_DISCOVERY_QUERIES.length}.`,
  );

  return lines.join("\n");
}

function formatTable(candidates: readonly BackfillCandidate[]): string {
  const header = [
    "Rank",
    "Study title",
    "Year",
    "Study design",
    "Sample size",
    "Raw citations",
    "Citations/year",
    "Priority score",
    "Existing?",
    "Action",
    "PMID",
    "DOI",
    "Matched document",
  ];
  const rows = candidates.map((candidate) => [
    String(candidate.rank),
    candidate.title,
    candidate.year == null ? "—" : String(candidate.year),
    candidate.designLabel,
    candidate.sampleSize == null ? "—" : String(candidate.sampleSize),
    candidate.citationCount == null ? "—" : String(candidate.citationCount),
    formatRate(candidate.citationsPerYear),
    formatScore(candidate.priorityScore),
    candidate.existing ? "yes" : "no",
    candidate.action,
    candidate.pmid,
    candidate.doi ?? "—",
    candidate.matchedDocumentId ?? "—",
  ]);
  return renderTable(header, rows);
}

function renderTable(header: string[], rows: string[][]): string {
  const widths = header.map((cell, index) =>
    Math.min(72, Math.max(cell.length, ...rows.map((row) => row[index]?.length ?? 0))),
  );
  const render = (row: string[]) =>
    row.map((cell, index) => truncate(cell, widths[index]).padEnd(widths[index])).join("  ");
  return [render(header), widths.map((width) => "-".repeat(width)).join("  "), ...rows.map(render)].join(
    "\n",
  );
}

function truncate(value: string, width: number): string {
  if (value.length <= width) return value;
  if (width <= 1) return value.slice(0, width);
  return `${value.slice(0, width - 1)}…`;
}

function formatScore(value: number): string {
  return value.toFixed(2);
}

function formatRate(value: number | null): string {
  return value == null ? "—" : value.toFixed(2);
}
