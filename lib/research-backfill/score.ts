import type { CitationSource } from "../research-discovery/crossref";
import type { RelevanceDecision } from "../research-discovery/relevance";
import { inferStudyDesign, inferStudyDesignFromTitle } from "../research-discovery/study-metadata";

/**
 * Tune historical backfill ranking here.
 * Every component is 0–100. The priority score is their weighted sum.
 * Relevance is mandatory and the largest share. Citation impact is log-scaled
 * citations per year, so raw citation counts and publication age cannot
 * outweigh a clear relevance or study-design difference.
 */
export const PRIORITY_WEIGHTS = {
  relevance: 0.55,
  design: 0.22,
  citation: 0.09,
  sampleSize: 0.06,
  recency: 0.08,
} as const;

export const RELEVANCE_SCORES = {
  title: 100,
  relatedConfirmed: 82,
  abstractCentral: 70,
} as const;

export const DESIGN_SCORES = {
  "umbrella-review": 94,
  "systematic-review-meta-analysis": 90,
  "meta-analysis": 90,
  "systematic-review": 88,
  "randomized-crossover": 92,
  "randomized-controlled-trial": 90,
  "controlled-trial": 80,
  "crossover-study": 78,
  "prospective-cohort": 76,
  "cohort-study": 68,
  "observational-study": 62,
  other: 36,
} as const;

/** Citations per year that map to a full citation component. */
export const CITATION_REFERENCE_PER_YEAR = 20;

/** Points removed from the 0–100 recency component for each year before the window end. */
export const RECENCY_DECAY_PER_YEAR = 7;

export const SAMPLE_SIZE_REFERENCE = 10_000;
export const LARGE_COHORT_SAMPLE = 1_000;
export const LARGE_COHORT_BONUS = 8;

export type EvidenceDesign = {
  id: keyof typeof DESIGN_SCORES | "other";
  label: string;
  designScore: number;
};

export function relevanceScoreFor(decision: RelevanceDecision): number | null {
  if (decision.disposition !== "auto_draft") return null;
  if (decision.reason === "core phrase in title") return RELEVANCE_SCORES.title;
  if (
    decision.reason ===
    "related concept identified as VILPA or exercise snacks in the abstract"
  ) {
    return RELEVANCE_SCORES.relatedConfirmed;
  }
  if (decision.reason === "core phrase is central in the abstract") {
    return RELEVANCE_SCORES.abstractCentral;
  }
  return RELEVANCE_SCORES.abstractCentral;
}

export function classifyEvidenceDesign(input: {
  title?: string | null;
  abstract?: string | null;
  publicationTypes?: readonly string[] | null;
}): EvidenceDesign {
  const title = input.title ?? "";
  const abstract = input.abstract ?? "";
  const publicationTypes = input.publicationTypes ?? [];
  const types = new Set(
    publicationTypes.map((type) => type.trim().toLowerCase()).filter(Boolean),
  );
  const fromTitle = inferStudyDesignFromTitle(title);
  const fromTypes = inferStudyDesign(publicationTypes);

  if (/\bumbrella\s+reviews?\b/i.test(title) || types.has("umbrella review")) {
    return design("umbrella-review", "umbrella review");
  }

  const systematic =
    fromTitle === "systematic-review" ||
    fromTypes === "systematic-review" ||
    types.has("systematic review") ||
    /\bsystematic\s+reviews?\b/i.test(title);
  const meta =
    fromTitle === "meta-analysis" ||
    fromTypes === "meta-analysis" ||
    types.has("meta-analysis") ||
    /\bmeta-analys[ie]s\b/i.test(title);

  if (systematic && meta) {
    return design("systematic-review-meta-analysis", "systematic review and meta-analysis");
  }

  const randomized =
    /\brandomi[sz]ed\b/i.test(title) || types.has("randomized controlled trial");
  const crossover =
    fromTitle === "crossover-study" ||
    /\bcross-?over\b/i.test(title) ||
    types.has("crossover study");

  if (crossover && randomized) {
    return design("randomized-crossover", "randomized crossover trial");
  }
  if (meta) return design("meta-analysis", "meta-analysis");
  if (systematic) return design("systematic-review", "systematic review");

  // PubMed often tags a qualitative paper with the parent trial's publication type.
  // The paper's own title is the design signal in that case.
  if (/\bqualitative\s+(?:study|studies|research)\b/i.test(title)) {
    return { id: "other", label: "qualitative study", designScore: DESIGN_SCORES.other };
  }

  if (
    fromTitle === "randomized-controlled-trial" ||
    fromTypes === "randomized-controlled-trial" ||
    types.has("randomized controlled trial")
  ) {
    return design("randomized-controlled-trial", "randomized controlled trial");
  }

  if (
    fromTypes === "controlled-trial" ||
    types.has("controlled clinical trial") ||
    /\bcontrolled\s+(?:intervention|trial)\b/i.test(title)
  ) {
    return design("controlled-trial", "controlled intervention study");
  }

  if (crossover) return design("crossover-study", "crossover study");

  if (
    /\bprospective\s+cohort\b/i.test(title) ||
    /\bprospective\s+cohort\s+stud(?:y|ies)\b/i.test(abstract)
  ) {
    return design("prospective-cohort", "prospective cohort study");
  }

  if (/\bcohort\s+stud(?:y|ies)\b/i.test(title) || types.has("cohort study")) {
    return design("cohort-study", "cohort study");
  }

  if (
    fromTypes === "observational-study" ||
    types.has("observational study") ||
    /\bobservational\s+stud(?:y|ies)\b/i.test(title)
  ) {
    return design("observational-study", "observational study");
  }

  return design("other", "study");
}

/**
 * Years available to accumulate citations.
 * The current publication year counts as 1 so a new paper is not divided by ~0,
 * and an older paper is divided by its age rather than rewarded for raw citations.
 */
export function publicationAgeYears(
  year: number | null | undefined,
  currentYear: number,
): number {
  if (year == null || !Number.isInteger(year) || year > currentYear || year < 1900) return 1;
  return currentYear - year + 1;
}

export function citationMetrics(input: {
  citationCount: number | null | undefined;
  year?: number | null;
  currentYear: number;
}): {
  citationCount: number | null;
  citationsPerYear: number | null;
  citationScore: number;
} {
  const count = input.citationCount;
  if (count == null || !Number.isFinite(count) || count < 0) {
    return { citationCount: null, citationsPerYear: null, citationScore: 0 };
  }

  const citationsPerYear = count / publicationAgeYears(input.year, input.currentYear);
  return {
    citationCount: Math.round(count),
    citationsPerYear: round2(citationsPerYear),
    citationScore: clamp(
      round2(
        (Math.log1p(citationsPerYear) / Math.log1p(CITATION_REFERENCE_PER_YEAR)) * 100,
      ),
    ),
  };
}

export function sampleSizeSignal(
  sampleSize: number | null | undefined,
  designId: string,
): number {
  if (sampleSize == null || !Number.isFinite(sampleSize) || sampleSize < 1) return 0;
  const base = (Math.log1p(sampleSize) / Math.log1p(SAMPLE_SIZE_REFERENCE)) * 100;
  const observational =
    designId === "prospective-cohort" ||
    designId === "cohort-study" ||
    designId === "observational-study";
  const bonus = observational && sampleSize >= LARGE_COHORT_SAMPLE ? LARGE_COHORT_BONUS : 0;
  return clamp(round2(base + bonus));
}

export function recencyScore(
  year: number | null | undefined,
  currentYear: number,
): number {
  if (year == null || !Number.isInteger(year) || year > currentYear || year < 1900) return 40;
  return clamp(round2(100 - (currentYear - year) * RECENCY_DECAY_PER_YEAR));
}

export function combinePriority(parts: {
  relevanceScore: number;
  designScore: number;
  citationScore: number;
  sampleSizeSignal: number;
  recencyScore: number;
}): number {
  const weights = PRIORITY_WEIGHTS;
  return round2(
    parts.relevanceScore * weights.relevance +
      parts.designScore * weights.design +
      parts.citationScore * weights.citation +
      parts.sampleSizeSignal * weights.sampleSize +
      parts.recencyScore * weights.recency,
  );
}

export function rankingReason(input: {
  relevanceScore: number;
  designLabel: string;
  year: number | null;
  citationCount: number | null;
  existing: boolean;
}): string {
  const relevance = input.relevanceScore >= 95 ? "Highly relevant" : "Relevant";
  const year = input.year ?? "year unknown";
  const citations =
    input.citationCount == null
      ? "citation count unavailable"
      : `${input.citationCount} citation${input.citationCount === 1 ? "" : "s"}`;
  const presence = input.existing ? "already in Sanity" : "not currently in Sanity";
  return `${relevance} ${input.designLabel}; ${year}; ${citations}; ${presence}.`;
}

export function citationSourceOf(
  citationCount: number | null,
  source: CitationSource | null | undefined,
): CitationSource | null {
  if (citationCount == null) return null;
  return source ?? null;
}

function design(id: EvidenceDesign["id"], label: string): EvidenceDesign {
  return { id, label, designScore: DESIGN_SCORES[id] };
}

function clamp(value: number): number {
  return Math.min(100, Math.max(0, value));
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
