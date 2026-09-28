import type { CitationSource } from "../research-discovery/crossref";
import { findDuplicate, type ResearchIdentity } from "../research-discovery/dedupe";
import { assessRelevance, type RelevanceLink } from "../research-discovery/relevance";
import { matchExistingStudy } from "./existing";
import {
  citationMetrics,
  citationSourceOf,
  classifyEvidenceDesign,
  combinePriority,
  rankingReason,
  recencyScore,
  relevanceScoreFor,
  sampleSizeSignal,
} from "./score";

export type RankableStudy = {
  pmid: string;
  doi?: string | null;
  title: string;
  abstract?: string | null;
  abstractSections?: readonly { label?: string; text: string }[] | null;
  publicationTypes?: readonly string[] | null;
  commentCorrections?: readonly RelevanceLink[] | null;
  year?: number | null;
  sampleSize?: number | null;
  citationCount?: number | null;
  citationSource?: CitationSource | null;
};

export type BackfillCandidate = {
  rank: number;
  title: string;
  year: number | null;
  studyDesign: string;
  designLabel: string;
  sampleSize: number | null;
  citationCount: number | null;
  citationSource: CitationSource | null;
  citationsPerYear: number | null;
  relevanceScore: number;
  designScore: number;
  citationScore: number;
  sampleSizeSignal: number;
  recencyScore: number;
  priorityScore: number;
  existing: boolean;
  action: "eligible" | "skip";
  pmid: string;
  doi: string | null;
  reason: string;
  matchedDocumentId: string | null;
  matchReason: "pmid" | "doi" | "title" | null;
  studyDocumentIds: string[];
};

export type BackfillRanking = {
  rejectedIrrelevant: number;
  heldForReview: number;
  passedRelevance: number;
  alreadyInSanity: number;
  eligibleNew: number;
  ranked: BackfillCandidate[];
  eligible: BackfillCandidate[];
  skipped: BackfillCandidate[];
};

type ScoredStudy = {
  study: RankableStudy;
  relevanceScore: number;
  designScore: number;
  designId: string;
  designLabel: string;
  citationCount: number | null;
  citationSource: CitationSource | null;
  citationsPerYear: number | null;
  citationScore: number;
  sampleSize: number | null;
  sampleSizeSignal: number;
  recencyScore: number;
  priorityScore: number;
  year: number | null;
  doi: string | null;
};

export function rankResearchCandidates(input: {
  studies: readonly RankableStudy[];
  existing: readonly ResearchIdentity[];
  limit: number;
  currentYear: number;
}): BackfillRanking {
  let rejectedIrrelevant = 0;
  let heldForReview = 0;
  const scored: ScoredStudy[] = [];

  for (const study of input.studies) {
    const decision = assessRelevance({
      title: study.title,
      abstract: study.abstract,
      abstractSections: study.abstractSections,
      publicationTypes: study.publicationTypes,
      commentCorrections: study.commentCorrections,
    });
    const relevanceScore = relevanceScoreFor(decision);
    if (decision.disposition === "reject") {
      rejectedIrrelevant += 1;
      continue;
    }
    if (relevanceScore == null) {
      heldForReview += 1;
      continue;
    }

    const evidence = classifyEvidenceDesign({
      title: study.title,
      abstract: study.abstract,
      publicationTypes: study.publicationTypes,
    });
    const citation = citationMetrics({
      citationCount: study.citationCount,
      year: study.year,
      currentYear: input.currentYear,
    });
    const sampleSize =
      study.sampleSize != null && Number.isFinite(study.sampleSize) && study.sampleSize >= 1
        ? Math.round(study.sampleSize)
        : null;
    const sampleSignal = sampleSizeSignal(sampleSize, evidence.id);
    const recency = recencyScore(study.year, input.currentYear);
    const year = study.year != null && Number.isInteger(study.year) ? study.year : null;
    const parts = {
      relevanceScore,
      designScore: evidence.designScore,
      citationScore: citation.citationScore,
      sampleSizeSignal: sampleSignal,
      recencyScore: recency,
    };

    scored.push({
      study,
      ...parts,
      designId: evidence.id,
      designLabel: evidence.label,
      citationCount: citation.citationCount,
      citationSource: citationSourceOf(citation.citationCount, study.citationSource),
      citationsPerYear: citation.citationsPerYear,
      sampleSize,
      priorityScore: combinePriority(parts),
      year,
      doi: study.doi?.trim() || null,
    });
  }

  const unique = collapseDuplicateStudies(scored);
  const matched: BackfillCandidate[] = unique.map((item) => {
    const existingMatch = matchExistingStudy(
      {
        pmid: item.study.pmid,
        doi: item.doi,
        title: item.study.title,
      },
      input.existing,
    );
    const existing = existingMatch !== null;
    return {
      rank: 0,
      title: item.study.title,
      year: item.year,
      studyDesign: item.designId,
      designLabel: item.designLabel,
      sampleSize: item.sampleSize,
      citationCount: item.citationCount,
      citationSource: item.citationSource,
      citationsPerYear: item.citationsPerYear,
      relevanceScore: item.relevanceScore,
      designScore: item.designScore,
      citationScore: item.citationScore,
      sampleSizeSignal: item.sampleSizeSignal,
      recencyScore: item.recencyScore,
      priorityScore: item.priorityScore,
      existing,
      action: existing ? "skip" : "eligible",
      pmid: item.study.pmid,
      doi: item.doi,
      reason: rankingReason({
        relevanceScore: item.relevanceScore,
        designLabel: item.designLabel,
        year: item.year,
        citationCount: item.citationCount,
        existing,
      }),
      matchedDocumentId: existingMatch?.matchedDocumentId ?? null,
      matchReason: existingMatch?.matchReason ?? null,
      studyDocumentIds: existingMatch?.studyDocumentIds ?? [],
    };
  });

  matched.sort(compareCandidates);
  const ranked = matched.slice(0, input.limit).map((candidate, index) => ({
    ...candidate,
    rank: index + 1,
  }));

  return {
    rejectedIrrelevant,
    heldForReview,
    passedRelevance: unique.length,
    alreadyInSanity: matched.filter((candidate) => candidate.existing).length,
    eligibleNew: matched.filter((candidate) => !candidate.existing).length,
    ranked,
    eligible: ranked.filter((candidate) => candidate.action === "eligible"),
    skipped: ranked.filter((candidate) => candidate.action === "skip"),
  };
}

function collapseDuplicateStudies(studies: ScoredStudy[]): ScoredStudy[] {
  const sorted = [...studies].sort((left, right) => compareScored(left, right));
  const kept: ScoredStudy[] = [];
  for (const study of sorted) {
    const duplicate = findDuplicate(
      {
        id: study.study.pmid,
        pmid: study.study.pmid,
        doi: study.doi,
        title: study.study.title,
      },
      kept.map((item) => ({
        id: item.study.pmid,
        pmid: item.study.pmid,
        doi: item.doi,
        title: item.study.title,
      })),
    );
    if (duplicate) continue;
    kept.push(study);
  }
  return kept;
}

function compareCandidates(left: BackfillCandidate, right: BackfillCandidate): number {
  return (
    right.priorityScore - left.priorityScore ||
    right.relevanceScore - left.relevanceScore ||
    right.designScore - left.designScore ||
    (right.year ?? 0) - (left.year ?? 0) ||
    left.title.localeCompare(right.title)
  );
}

function compareScored(left: ScoredStudy, right: ScoredStudy): number {
  return (
    right.priorityScore - left.priorityScore ||
    right.relevanceScore - left.relevanceScore ||
    right.designScore - left.designScore ||
    (right.year ?? 0) - (left.year ?? 0) ||
    left.study.title.localeCompare(right.study.title)
  );
}
