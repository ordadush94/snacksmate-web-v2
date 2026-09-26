import { draftIdForPmid } from "../research-discovery/normalize";
import {
  editorialStatusAfterEnrichment,
  editorialStatusNote,
  isRejectedEditorialStatus,
} from "../research-editorial/status";
import type { Confidence, EnrichmentOutput, Evidence, StudyDesignValue } from "./schema";

const DRAFT_ID_PATTERN = /^drafts\.research-pubmed-\d{1,9}$/;
const REVIEW_DESIGNS = new Set([
  "systematic-review",
  "meta-analysis",
  "narrative-review",
  "scoping-review",
  "umbrella-review",
  "evidence-map",
]);
const PRIMARY_DESIGNS = new Set([
  "randomized-controlled-trial",
  "controlled-trial",
  "crossover-study",
  "pilot-study",
  "feasibility-study",
]);
const OBSERVATIONAL_DESIGNS = new Set([
  "observational-study",
  "cohort-study",
  "cross-sectional-study",
]);
const TRIAL_DESIGNS = new Set([
  "randomized-controlled-trial",
  "controlled-trial",
  "crossover-study",
]);

const CAUSAL_WORDING =
  /\b(?<!not\s)(?<!no\s)(proves?|proven|causes?|caused|causation|cures?)\b/i;
const NO_EFFECT_WORDING = /\bno effect\b/i;
const MEDICAL_ADVICE =
  /\b(you should|patients should|everyone should|doctors should|we recommend that (?:people|patients|adults))\b/i;
const CAUTIOUS_FRAMING =
  /\b(observational|association|associated|associates|suggests?|suggested|possibility|may indicate)\b/i;
const OBSERVATIONAL_LABEL = /\b(observational|association|associated|associates)\b/i;
const VILPA_PATTERN = /\b(vilpa|vigorous intermittent lifestyle physical activity)\b/i;
const CONSERVATIVE_DESIGN_LIMITATION =
  /\b(pilot|small sample|feasibility|cross-sectional|cannot establish causality|cannot infer causality|does not establish causality|does not prove causality|observational design|observational study)\b/i;

const SUPPORTED_FACT: readonly Evidence[] = ["abstract", "abstract_and_metadata"];

/** Review summaries need room for more than one stated timing. */
const DURATION_MAX_LENGTH = 160;

/**
 * Coarse labels a clearly identified umbrella review, scoping review, or
 * evidence map may replace. A de novo meta-analysis inside an umbrella
 * review is not the more specific study classification.
 */
const COARSE_STUDY_DESIGNS = new Set([
  "other",
  "narrative-review",
  "systematic-review",
  "meta-analysis",
]);

const HUMAN_LOCKED_STATUSES = new Set(["reviewed", "ready_to_publish", "published_manually"]);

const SCIENTIFIC_FIELDS = new Set([
  "excerpt",
  "studyDesign",
  "population",
  "sampleSize",
  "intervention",
  "duration",
  "comparator",
  "outcomes",
  "mainFindings",
  "limitations",
]);

const AUDIT_FIELDS = [
  "studyDesign",
  "duration",
  "comparator",
  "limitations",
  "practicalInterpretation",
  "automationNote",
] as const;

const STALE_DISCOVERY_BLANK_FIELDS =
  "Population, intervention, outcomes, limitations, and interpretation were left blank for editorial review.";

const OBSERVATIONAL_CAUSALITY_LIMITATION = "Observational design cannot establish causality.";

const CONTROL_INFERENCE =
  /\b(without|did not|didn't|does not|no exercise|no intervention|remained seated|remained sedentary|inactive control|sham|placebo)\b/i;

const UNESTABLISHED_EFFECT =
  /\b(?:no statistically clear(?:\s+pooled)?\s+effect|neither supported nor refuted|did not establish (?:a |an )?(?:clear |significant )?effect|evidence (?:is|was|remains) insufficient(?!\s+to\s+demonstrate)|insufficient to determine whether|underpowered|too imprecise to establish|statistically unstable|no significant pooled effect)\b/i;

const NO_BETWEEN_GROUP_DIFFERENCE =
  /\b(?:no significant between[-\s](?:group|intervention)|between-group differences? were not significant|no significant differences? (?:were |was )?observed between)\b/i;

const BENEFIT_CLAIM =
  /\b(?:may|might|could)\s+(?:improve|affect|provide benefits|offer additional|benefit|enhance)\b/i;

const SUPERIORITY_CLAIM =
  /\b(?:additional (?:performance )?benefits?|offers additional|more effective|superior)\b/i;

const NEGATED_CLAUSE =
  /\b(?:did not|does not|do not|cannot|can't|no evidence|not establish|was not|were not|is not|are not)\b/i;

export type EditorialChecklistSnapshot = {
  reviewedMetadata?: boolean | null;
  reviewedScientificSummary?: boolean | null;
  reviewedPracticalInterpretation?: boolean | null;
  reviewedLinks?: boolean | null;
};

export type ResearchDraftSnapshot = {
  _id: string;
  pmid: string;
  title?: string | null;
  excerpt?: string | null;
  studyDesign?: string | null;
  population?: string | null;
  sampleSize?: number | null;
  intervention?: unknown;
  duration?: string | null;
  comparator?: string | null;
  outcomes?: string[] | null;
  mainFindings?: unknown;
  limitations?: unknown;
  practicalInterpretation?: unknown;
  seoTitle?: string | null;
  seoDescription?: string | null;
  language?: string | null;
  journal?: string | null;
  doi?: string | null;
  editorialStatus?: string | null;
  automationNote?: string | null;
  editorialChecklist?: EditorialChecklistSnapshot | null;
};

export type EnrichmentSource = {
  title: string;
  abstract: string;
  publicationTypes: string[];
};

export type PlannedField = {
  field: string;
  preview: string;
};

export type EmptyField = {
  field: string;
  reason: string;
};

export type FieldComparison = {
  field: string;
  before: string;
  after: string;
};

export type EnrichmentPlan = {
  draftId: string;
  pmid: string;
  set: Record<string, unknown>;
  wouldSet: PlannedField[];
  unchanged: string[];
  leftEmpty: EmptyField[];
  status: "completed" | "needs_review";
  abstractInsufficient: boolean;
  editorialStatusSet: boolean;
  /** Present only for an explicit --force run. Dry-run reporting uses this. */
  comparisons: FieldComparison[];
  studyTitle: string;
  seoTitle: SeoFieldReport;
  seoDescription: SeoFieldReport;
};

export type SeoFieldReport = {
  current: string;
  proposed: string;
  characters: number;
};

type PortableTextBlock = {
  _type: "block";
  _key: string;
  style: "normal";
  markDefs: [];
  children: {
    _type: "span";
    _key: string;
    text: string;
    marks: [];
  }[];
};

export function enrichmentDraftId(pmid: string): string {
  const trimmed = pmid.trim();
  if (!/^\d{1,9}$/.test(trimmed)) {
    throw new Error(`Refusing to build a draft id for an invalid PMID: ${pmid}`);
  }
  const id = draftIdForPmid(trimmed);
  assertDraftDocumentId(id);
  return id;
}

export function isEnrichmentDraftId(id: string): boolean {
  return DRAFT_ID_PATTERN.test(id);
}

export function assertDraftDocumentId(id: string): void {
  if (!isEnrichmentDraftId(id)) {
    throw new Error(
      `Refusing to update "${id}". Enrichment only updates drafts.research-pubmed-{PMID} and never publishes.`,
    );
  }
}

export function assertRunnableEnrichmentDraft(draft: { _id: string; pmid: string }): void {
  assertDraftDocumentId(draft._id);
  const expected = enrichmentDraftId(draft.pmid);
  if (draft._id !== expected) {
    throw new Error(
      `Draft ${draft._id} does not match ${expected}. Enrichment will not create or publish a document.`,
    );
  }
}

export function abstractIsInsufficient(abstract: string | undefined): boolean {
  const text = abstract?.replace(/\s+/g, " ").trim() ?? "";
  if (text.length < 100) return true;
  if (/^no abstract available\.?$/i.test(text)) return true;
  return false;
}

export function buildEnrichmentUpdate(input: {
  draft: ResearchDraftSnapshot;
  extraction: EnrichmentOutput;
  source: EnrichmentSource;
  model: string;
  enrichedAt: string;
  /**
   * Reprocess automation-written fields on a draft that already ran.
   * Never overrides a human-reviewed field. Callers must pass this only
   * for an explicit test run, never from a scheduled workflow.
   */
  force?: boolean;
}): EnrichmentPlan {
  const draftId = enrichmentDraftId(input.draft.pmid);
  if (input.draft._id !== draftId) {
    throw new Error(
      `Draft ${input.draft._id} does not match ${draftId}. Enrichment will not create a second document.`,
    );
  }
  if (isRejectedEditorialStatus(input.draft.editorialStatus)) {
    throw new Error(
      `Refusing to enrich PMID ${input.draft.pmid}. Editorial status is rejected.`,
    );
  }

  const unchanged = new Set<string>(["title", "journal", "doi", "canonicalUrl"]);
  const wouldSet: PlannedField[] = [];
  const leftEmpty: EmptyField[] = [];
  const set: Record<string, unknown> = {};
  let needsReview =
    input.extraction.needsReview || input.extraction.abstractSufficient === false;

  const chosenDesign = decideStudyDesign({
    current: input.draft.studyDesign,
    field: input.extraction.studyDesign,
    source: input.source,
    humanLocked: isHumanReviewedField(input.draft, "studyDesign"),
  });
  if (hasContent(input.draft.studyDesign) && chosenDesign === input.draft.studyDesign?.trim()) {
    unchanged.add("studyDesign");
  } else if (chosenDesign) {
    assign(set, wouldSet, "studyDesign", chosenDesign, chosenDesign);
  } else {
    leftEmpty.push({ field: "studyDesign", reason: "not confident enough to map a design" });
  }

  const effectiveDesign = chosenDesign;
  const observational = isObservationalContext({
    studyDesign: effectiveDesign,
    publicationTypes: input.source.publicationTypes,
    title: input.source.title,
    abstract: input.source.abstract,
  });
  const vilpa = VILPA_PATTERN.test(`${input.source.title}\n${input.source.abstract}`);
  const review = isReviewSource({
    studyDesign: effectiveDesign,
    publicationTypes: input.source.publicationTypes,
  });

  considerText({
    field: "excerpt",
    current: input.draft.excerpt,
    value: input.extraction.excerpt.value,
    confidence: input.extraction.excerpt.confidence,
    evidence: input.extraction.excerpt.evidence,
    allowedEvidence: SUPPORTED_FACT,
    minConfidence: "medium",
    maxLength: 320,
    minLength: 140,
    abstract: input.source.abstract,
    set,
    wouldSet,
    leftEmpty,
    unchanged,
    onDrop: (reason) => {
      if (reason.includes("copied") || reason.includes("length")) needsReview = true;
    },
  });

  considerText({
    field: "population",
    current: input.draft.population,
    value: input.extraction.population.value,
    confidence: input.extraction.population.confidence,
    evidence: input.extraction.population.evidence,
    allowedEvidence: SUPPORTED_FACT,
    minConfidence: "high",
    maxLength: 300,
    abstract: input.source.abstract,
    set,
    wouldSet,
    leftEmpty,
    unchanged,
  });

  const sample = acceptedSampleSize({
    proposed: input.extraction.sampleSize.value,
    meaning: input.extraction.sampleSize.meaning,
    confidence: input.extraction.sampleSize.confidence,
    evidence: input.extraction.sampleSize.evidence,
  });
  if (hasContent(input.draft.sampleSize)) {
    unchanged.add("sampleSize");
  } else if (sample !== null) {
    assign(set, wouldSet, "sampleSize", sample, String(sample));
  } else {
    leftEmpty.push({
      field: "sampleSize",
      reason: review
        ? "review article without one explicit participant sample size"
        : "not explicitly stated",
    });
  }

  considerText({
    field: "intervention",
    current: input.draft.intervention,
    value: input.extraction.intervention.value,
    confidence: input.extraction.intervention.confidence,
    evidence: input.extraction.intervention.evidence,
    allowedEvidence: SUPPORTED_FACT,
    minConfidence: "medium",
    maxLength: 900,
    abstract: input.source.abstract,
    portableText: true,
    set,
    wouldSet,
    leftEmpty,
    unchanged,
    onDrop: (reason) => {
      if (reason.includes("copied")) needsReview = true;
    },
  });

  considerText({
    field: "duration",
    current: input.draft.duration,
    value: input.extraction.duration.value,
    confidence: input.extraction.duration.confidence,
    evidence: input.extraction.duration.evidence,
    allowedEvidence: SUPPORTED_FACT,
    minConfidence: "high",
    maxLength: DURATION_MAX_LENGTH,
    abstract: input.source.abstract,
    force: input.force === true,
    draft: input.draft,
    set,
    wouldSet,
    leftEmpty,
    unchanged,
  });

  considerText({
    field: "comparator",
    current: input.draft.comparator,
    value: input.extraction.comparator.value,
    confidence: input.extraction.comparator.confidence,
    evidence: input.extraction.comparator.evidence,
    allowedEvidence: SUPPORTED_FACT,
    minConfidence: "high",
    maxLength: 240,
    abstract: input.source.abstract,
    force: input.force === true,
    draft: input.draft,
    set,
    wouldSet,
    leftEmpty,
    unchanged,
  });

  const outcomes = acceptedOutcomes(input.extraction.outcomes);
  if (hasContent(input.draft.outcomes)) {
    unchanged.add("outcomes");
  } else if (outcomes) {
    assign(set, wouldSet, "outcomes", outcomes, outcomes.join(", "));
  } else {
    leftEmpty.push({ field: "outcomes", reason: "no clear major outcomes" });
  }

  considerText({
    field: "mainFindings",
    current: input.draft.mainFindings,
    value: input.extraction.mainFindings.value,
    confidence: input.extraction.mainFindings.confidence,
    evidence: input.extraction.mainFindings.evidence,
    allowedEvidence: SUPPORTED_FACT,
    minConfidence: "medium",
    maxLength: 1200,
    abstract: input.source.abstract,
    portableText: true,
    prose: "mainFindings",
    observational,
    vilpa,
    evidenceText: `${input.source.abstract}\n${input.extraction.mainFindings.value ?? ""}`,
    force: input.force === true,
    draft: input.draft,
    set,
    wouldSet,
    leftEmpty,
    unchanged,
    onDrop: (reason) => {
      if (
        reason.includes("wording") ||
        reason.includes("copied") ||
        reason.includes("advice") ||
        reason.includes("benefit") ||
        reason.includes("superiority")
      ) {
        needsReview = true;
      }
    },
  });

  const limitations = mergeLimitations({
    current: fieldText(input.draft.limitations),
    accepted: acceptedLimitations(input.extraction.limitations, input.source.abstract),
    observational: shouldStateObservationalLimitation({
      studyDesign: effectiveDesign,
      publicationTypes: input.source.publicationTypes,
      title: input.source.title,
      abstract: input.source.abstract,
    }),
    replaceExisting: hasContent(input.draft.limitations)
      ? !blocksRevision(input.draft, "limitations", input.force === true)
      : true,
  });
  if (hasContent(input.draft.limitations) && limitations === fieldText(input.draft.limitations)) {
    unchanged.add("limitations");
  } else if (limitations) {
    assign(
      set,
      wouldSet,
      "limitations",
      toPortableText("limitations", limitations),
      limitations,
    );
  } else if (!hasContent(input.draft.limitations)) {
    leftEmpty.push({
      field: "limitations",
      reason: "no author-stated or conservative design limitation",
    });
  } else {
    unchanged.add("limitations");
  }

  considerText({
    field: "practicalInterpretation",
    current: input.draft.practicalInterpretation,
    value: input.extraction.practicalInterpretation.value,
    confidence: input.extraction.practicalInterpretation.confidence,
    evidence: input.extraction.practicalInterpretation.evidence,
    allowedEvidence: SUPPORTED_FACT,
    minConfidence: "medium",
    maxLength: 900,
    abstract: input.source.abstract,
    portableText: true,
    prose: "practicalInterpretation",
    observational,
    vilpa,
    evidenceText: `${input.source.abstract}\n${input.extraction.mainFindings.value ?? ""}`,
    force: input.force === true,
    draft: input.draft,
    set,
    wouldSet,
    leftEmpty,
    unchanged,
    onDrop: () => {
      needsReview = true;
    },
  });

  const seoEvidence = `${input.source.abstract}\n${input.extraction.mainFindings.value ?? ""}`;
  const excerptForSeo = [
    fieldText("excerpt" in set ? set.excerpt : input.draft.excerpt),
    input.extraction.excerpt.value ?? "",
  ]
    .filter(Boolean)
    .join("\n");
  for (const field of ["seoTitle", "seoDescription"] as const) {
    const proposal = field === "seoTitle" ? input.extraction.seoTitle : input.extraction.seoDescription;
    considerSeo({
      field,
      current: input.draft[field],
      value: proposal.value,
      confidence: proposal.confidence,
      evidence: proposal.evidence,
      draft: input.draft,
      abstract: input.source.abstract,
      excerpt: excerptForSeo,
      sourceText: `${input.source.title}\n${input.source.abstract}`,
      observational,
      uncertain: evidenceIsUncertain(seoEvidence),
      evidenceText: seoEvidence,
      set,
      wouldSet,
      leftEmpty,
      unchanged,
      onReview: () => {
        needsReview = true;
      },
    });
  }

  const automationNote = reviseAutomationNote({
    current: input.draft.automationNote,
    filled: wouldSet
      .map((field) => field.field)
      .filter((field) => field !== "seoTitle" && field !== "seoDescription"),
    stillEmpty: leftEmpty.map((field) => field.field),
    humanLocked: isDocumentHumanReviewed(input.draft),
  });
  if (automationNote) {
    set.automationNote = automationNote;
  } else if (hasContent(input.draft.automationNote)) {
    unchanged.add("automationNote");
  }

  if (!hasContent(input.draft.excerpt) && !("excerpt" in set)) needsReview = true;
  if (!hasContent(input.draft.mainFindings) && !("mainFindings" in set)) needsReview = true;
  if (input.extraction.reviewNote?.trim()) needsReview = true;

  const status = needsReview ? "needs_review" : "completed";
  const editorialStatusSet = assignEditorialStatusIfEmpty(set, input.draft.editorialStatus);
  const note = buildNote({
    model: input.model,
    status,
    wouldSet,
    unchanged: [...unchanged],
    leftEmpty,
    reviewNote: input.extraction.reviewNote,
    abstractSufficient: input.extraction.abstractSufficient,
    editorialStatusSet,
  });

  set.aiEnrichedAt = input.enrichedAt;
  set.aiModel = input.model;
  set.aiEnrichmentStatus = status;
  set.aiEnrichmentNote = note;

  return {
    draftId,
    pmid: input.draft.pmid,
    set,
    wouldSet,
    unchanged: [...unchanged],
    leftEmpty,
    status,
    abstractInsufficient: input.extraction.abstractSufficient === false,
    editorialStatusSet,
    comparisons: input.force ? auditComparisons(input.draft, set) : [],
    studyTitle: input.draft.title?.trim() || input.source.title,
    seoTitle: seoFieldReport(input.draft, set, "seoTitle"),
    seoDescription: seoFieldReport(input.draft, set, "seoDescription"),
  };
}

export function buildInsufficientAbstractPlan(input: {
  draft: ResearchDraftSnapshot;
  model: string;
  enrichedAt: string;
}): EnrichmentPlan {
  const draftId = enrichmentDraftId(input.draft.pmid);
  if (input.draft._id !== draftId) {
    throw new Error(
      `Draft ${input.draft._id} does not match ${draftId}. Enrichment will not create a second document.`,
    );
  }
  if (isRejectedEditorialStatus(input.draft.editorialStatus)) {
    throw new Error(
      `Refusing to enrich PMID ${input.draft.pmid}. Editorial status is rejected.`,
    );
  }

  const set: Record<string, unknown> = {
    aiEnrichedAt: input.enrichedAt,
    aiModel: input.model,
    aiEnrichmentStatus: "needs_review",
  };
  const editorialStatusSet = assignEditorialStatusIfEmpty(set, input.draft.editorialStatus);
  const note = [
    `Model: ${input.model}`,
    "Status: needs_review",
    "The PubMed abstract was missing or too short to enrich this draft.",
    "No public fields were changed.",
    editorialStatusNote(editorialStatusSet),
  ].join("\n");
  set.aiEnrichmentNote = note;

  return {
    draftId,
    pmid: input.draft.pmid,
    set,
    wouldSet: [],
    unchanged: ["title", "journal", "doi", "canonicalUrl"],
    leftEmpty: [
      {
        field: "excerpt",
        reason: "PubMed abstract was missing or too short",
      },
    ],
    status: "needs_review",
    abstractInsufficient: true,
    editorialStatusSet,
    comparisons: [],
    studyTitle: input.draft.title?.trim() || "",
    seoTitle: seoFieldReport(input.draft, set, "seoTitle"),
    seoDescription: seoFieldReport(input.draft, set, "seoDescription"),
  };
}

export function hasEnrichableGap(draft: ResearchDraftSnapshot): boolean {
  return [
    draft.excerpt,
    draft.studyDesign,
    draft.population,
    draft.sampleSize,
    draft.intervention,
    draft.duration,
    draft.comparator,
    draft.outcomes,
    draft.mainFindings,
    draft.limitations,
    draft.practicalInterpretation,
    draft.seoTitle,
    draft.seoDescription,
  ].some((value) => !hasContent(value));
}

export function populatedFieldNames(draft: ResearchDraftSnapshot): string[] {
  const fields: [string, unknown][] = [
    ["excerpt", draft.excerpt],
    ["studyDesign", draft.studyDesign],
    ["population", draft.population],
    ["sampleSize", draft.sampleSize],
    ["intervention", draft.intervention],
    ["duration", draft.duration],
    ["comparator", draft.comparator],
    ["outcomes", draft.outcomes],
    ["mainFindings", draft.mainFindings],
    ["limitations", draft.limitations],
    ["practicalInterpretation", draft.practicalInterpretation],
    ["seoTitle", draft.seoTitle],
    ["seoDescription", draft.seoDescription],
  ];
  return fields.filter(([, value]) => hasContent(value)).map(([name]) => name);
}

export function isReviewSource(input: {
  studyDesign?: string | null;
  publicationTypes: readonly string[];
}): boolean {
  const types = input.publicationTypes.map((type) => type.trim().toLowerCase());
  if (
    types.some(
      (type) =>
        type === "systematic review" ||
        type === "meta-analysis" ||
        type.includes("scoping review") ||
        type.includes("umbrella review") ||
        type.includes("evidence map"),
    )
  ) {
    return true;
  }

  const design = input.studyDesign?.trim().toLowerCase() ?? "";
  if (REVIEW_DESIGNS.has(design)) return true;
  if (PRIMARY_DESIGNS.has(design)) return false;
  return types.some((type) => type === "review" || type.includes("review"));
}

export function acceptedSampleSize(input: {
  proposed: number | null;
  meaning: EnrichmentOutput["sampleSize"]["meaning"];
  confidence: Confidence;
  evidence: Evidence;
}): number | null {
  if (input.proposed === null) return null;
  if (!Number.isInteger(input.proposed) || input.proposed < 1 || input.proposed > 1_000_000) {
    return null;
  }
  if (input.confidence !== "high") return null;
  if (input.meaning !== "participants") return null;
  if (!SUPPORTED_FACT.includes(input.evidence)) return null;
  return input.proposed;
}

export function isObservationalContext(input: {
  studyDesign?: string | null;
  publicationTypes: readonly string[];
  title: string;
  abstract: string;
}): boolean {
  const design = input.studyDesign?.trim() ?? "";
  if (TRIAL_DESIGNS.has(design)) return false;
  if (OBSERVATIONAL_DESIGNS.has(design)) return true;

  const types = input.publicationTypes.map((type) => type.trim().toLowerCase());
  if (
    types.some(
      (type) =>
        type.includes("observational") ||
        type === "cohort study" ||
        type.includes("cross-sectional"),
    )
  ) {
    return true;
  }

  const text = `${input.title}\n${input.abstract}`;
  if (VILPA_PATTERN.test(text)) return true;
  return /\b(prospective cohort|cross-sectional study|observational study)\b/i.test(text);
}

export function copiesAbstractSentence(text: string, abstract: string): boolean {
  const normalizedText = normalizeSpace(text).toLowerCase();
  const normalizedAbstract = normalizeSpace(abstract).toLowerCase();
  if (normalizedText.length >= 80 && normalizedAbstract.includes(normalizedText)) return true;

  const sentences = normalizeSpace(abstract).split(/(?<=[.!?])\s+/);
  return sentences.some((sentence) => {
    const normalized = sentence.trim().toLowerCase();
    return normalized.length >= 80 && normalizedText.includes(normalized);
  });
}

function considerText(input: {
  field: string;
  current: unknown;
  value: string | null;
  confidence: Confidence;
  evidence: Evidence;
  allowedEvidence: readonly Evidence[];
  minConfidence: Confidence;
  maxLength: number;
  minLength?: number;
  abstract: string;
  portableText?: boolean;
  prose?: "mainFindings" | "practicalInterpretation";
  observational?: boolean;
  vilpa?: boolean;
  evidenceText?: string;
  force?: boolean;
  draft?: ResearchDraftSnapshot;
  set: Record<string, unknown>;
  wouldSet: PlannedField[];
  leftEmpty: EmptyField[];
  unchanged: Set<string>;
  onDrop?: (reason: string) => void;
}) {
  const revising = hasContent(input.current);
  if (revising && input.draft && blocksRevision(input.draft, input.field, input.force === true)) {
    input.unchanged.add(input.field);
    return;
  }
  if (revising && input.force !== true) {
    input.unchanged.add(input.field);
    return;
  }

  let value = input.value;
  if (input.field === "comparator" && value?.trim()) {
    const supported = supportedComparator(value, input.abstract);
    if (!supported) {
      if (revising) {
        input.unchanged.add(input.field);
        return;
      }
      input.leftEmpty.push({ field: input.field, reason: "comparator was not explicit" });
      return;
    }
    value = supported;
  }
  if (input.field === "intervention" && value?.trim()) {
    const cleaned = omitInferredSessionCounts(value, input.abstract);
    if (!cleaned) {
      if (revising) {
        input.unchanged.add(input.field);
        return;
      }
      input.leftEmpty.push({
        field: input.field,
        reason: "session or bout count was not explicit in the abstract",
      });
      return;
    }
    value = cleaned;
  }

  const decision = acceptProse({ ...input, value });
  if (!decision.text) {
    if (revising) {
      input.unchanged.add(input.field);
      input.onDrop?.(decision.reason ?? "not stated");
      return;
    }
    input.leftEmpty.push({ field: input.field, reason: decision.reason ?? "not stated" });
    input.onDrop?.(decision.reason ?? "not stated");
    return;
  }

  if (revising && fieldText(input.current) === decision.text) {
    input.unchanged.add(input.field);
    return;
  }

  const stored = input.portableText ? toPortableText(input.field, decision.text) : decision.text;
  assign(input.set, input.wouldSet, input.field, stored, decision.text);
}

function acceptProse(input: {
  value: string | null;
  confidence: Confidence;
  evidence: Evidence;
  allowedEvidence: readonly Evidence[];
  minConfidence: Confidence;
  maxLength: number;
  minLength?: number;
  abstract: string;
  prose?: "mainFindings" | "practicalInterpretation";
  observational?: boolean;
  vilpa?: boolean;
  evidenceText?: string;
}): { text: string | null; reason?: string } {
  const text = input.value?.replace(/\s+/g, " ").trim() ?? "";
  if (!text) return { text: null, reason: "not stated" };
  if (!confidenceMeets(input.confidence, input.minConfidence)) {
    return { text: null, reason: "low confidence" };
  }
  if (!input.allowedEvidence.includes(input.evidence)) {
    return { text: null, reason: "not supported by the abstract or metadata" };
  }
  if (input.minLength !== undefined && text.length < input.minLength) {
    return { text: null, reason: `length ${text.length} is outside the excerpt target` };
  }
  if (text.length > input.maxLength) {
    return { text: null, reason: `length ${text.length} is too long` };
  }
  if (copiesAbstractSentence(text, input.abstract)) {
    return { text: null, reason: "copied an abstract sentence" };
  }
  if (input.prose) {
    const issues = proseIssues(text, {
      field: input.prose,
      observational: input.observational === true,
      vilpa: input.vilpa === true,
    });
    if (input.prose === "practicalInterpretation" && input.evidenceText) {
      issues.push(...practicalInterpretationIssues(text, input.evidenceText));
    }
    if (issues.length > 0) return { text: null, reason: issues.join("; ") };
  }
  return { text };
}

export function proseIssues(
  text: string,
  options: {
    field: "mainFindings" | "practicalInterpretation";
    observational: boolean;
    vilpa: boolean;
  },
): string[] {
  const issues: string[] = [];
  if (CAUSAL_WORDING.test(text)) issues.push("causal wording");
  if (NO_EFFECT_WORDING.test(text)) issues.push("no-effect wording");
  if (MEDICAL_ADVICE.test(text)) issues.push("medical advice");
  if (options.observational && !CAUTIOUS_FRAMING.test(text)) {
    issues.push("missing cautious observational wording");
  }
  if (
    options.field === "practicalInterpretation" &&
    options.vilpa &&
    !OBSERVATIONAL_LABEL.test(text)
  ) {
    issues.push("missing explicit observational or association wording");
  }
  return issues;
}

const SEO_TITLE_MIN = 30;
const SEO_TITLE_MAX = 70;
const SEO_DESCRIPTION_MIN = 120;
const SEO_DESCRIPTION_MAX = 180;
const SEO_EVIDENCE: readonly Evidence[] = ["abstract", "metadata", "abstract_and_metadata"];
const SEO_LOCKED_STATUSES = new Set([
  "reviewed",
  "ready_to_publish",
  "published_manually",
  "ready",
  "published",
]);
const SEO_PLACEHOLDERS = new Set([
  "n/a",
  "na",
  "tbd",
  "todo",
  "none",
  "null",
  "untitled",
  "-",
  "--",
  "...",
]);
const SEO_CERTAINTY = /\b(proves?|proven|guarantees?|guaranteed|cures?|cured)\b/i;
const SEO_PROMPT_LANGUAGE =
  /\b(as an ai|system prompt|json schema|as a language model|ignore previous instructions)\b/i;
const SEO_HYPE =
  /\b(breakthrough|miracle|game[- ]changer|shocking|amazing|incredible|revolutionary|life[- ]changing|you won't believe)\b|!{2,}/i;
const NULL_OR_UNCERTAIN =
  /\b(?:null results?|no significant\b|not significant\b|not statistically significant|not statistically clear|no association\b|not associated\b|no clear (?:effect|difference|benefit)|remains uncertain|did not establish|neither support(?:ed)? nor refut(?:e|ed))\b/i;
const UNCERTAINTY_LANGUAGE =
  /\b(?:insufficient|uncertain|unclear|did not|no significant|not significant|no clear|no association|not associated|remains uncertain|did not establish)\b/i;
const FIRM_BENEFIT =
  /\b(?:improves?|improved|reduces?|reduced|lowers?|lowered|prevents?|prevented|benefits?)\b/i;
const SEO_STOPWORDS = new Set([
  "about",
  "after",
  "among",
  "from",
  "have",
  "into",
  "study",
  "their",
  "there",
  "these",
  "this",
  "those",
  "using",
  "were",
  "with",
  "which",
  "while",
  "would",
  "that",
  "than",
  "then",
  "them",
  "they",
]);

/**
 * PubMed imports are English. Missing language is treated as English.
 * Hebrew and any other language wait for a separate translation pass.
 */
export function isEnglishResearchLanguage(language: string | null | undefined): boolean {
  const value = language?.trim() ?? "";
  if (!value) return true;
  return /^(en|en-[a-z]{2}|english)$/i.test(value);
}

export function seoIsHumanReviewed(status: string | null | undefined): boolean {
  return SEO_LOCKED_STATUSES.has(status?.trim() ?? "");
}

/** A real editor value, as opposed to a blank or a placeholder token. */
export function isMeaningfulSeoValue(value: unknown): boolean {
  if (typeof value !== "string") return false;
  const text = value.replace(/\s+/g, " ").trim();
  if (text.length < 3) return false;
  return !SEO_PLACEHOLDERS.has(text.toLowerCase());
}

export function evidenceIsUncertain(evidenceText: string): boolean {
  return UNESTABLISHED_EFFECT.test(evidenceText) || NULL_OR_UNCERTAIN.test(evidenceText);
}

export function seoMetadataIssues(input: {
  field: "seoTitle" | "seoDescription";
  value: string;
  abstract: string;
  excerpt: string;
  sourceText: string;
  observational: boolean;
  uncertain: boolean;
  evidenceText: string;
}): string[] {
  const text = input.value.replace(/\s+/g, " ").trim();
  const issues: string[] = [];
  const min = input.field === "seoTitle" ? SEO_TITLE_MIN : SEO_DESCRIPTION_MIN;
  const max = input.field === "seoTitle" ? SEO_TITLE_MAX : SEO_DESCRIPTION_MAX;
  if (text.length > max) issues.push(`length ${text.length} is too long`);
  else if (text.length < min) issues.push(`length ${text.length} is outside the SEO target`);
  if (SEO_CERTAINTY.test(text) || CAUSAL_WORDING.test(text)) issues.push("unsupported certainty");
  if (SEO_PROMPT_LANGUAGE.test(text)) issues.push("prompt or system language");
  if (SEO_HYPE.test(text)) issues.push("hype");
  if (MEDICAL_ADVICE.test(text)) issues.push("medical advice");
  if (repeatsKeyword(text, input.field === "seoTitle" ? 3 : 4)) issues.push("keyword stuffing");
  if (/\bSnacksmate\b/i.test(text) && !/\bSnacksmate\b/i.test(input.sourceText)) {
    issues.push("Snacksmate was not in the source");
  }
  if (copiesAbstractSentence(text, input.abstract)) issues.push("copied an abstract sentence");
  if (repeatsExcerpt(text, input.excerpt)) issues.push("copied the excerpt");
  if (input.field === "seoDescription" && input.observational && !CAUTIOUS_FRAMING.test(text)) {
    issues.push("missing cautious observational wording");
  }
  if (input.field === "seoDescription" && input.uncertain) {
    const firm = text
      .split(/(?<=[.!?])\s+/)
      .some((sentence) => positiveClaim(sentence, FIRM_BENEFIT));
    if (firm || !UNCERTAINTY_LANGUAGE.test(text)) {
      issues.push("uncertain or null finding stated too firmly");
    }
    issues.push(...practicalInterpretationIssues(text, input.evidenceText));
  }
  return issues;
}

/**
 * Fill an empty SEO field from the structured response.
 * A meaningful value already on the draft is kept, including under --force.
 * Enrichment does not store per-field provenance, so force cannot safely
 * tell an AI value from a later human edit. Human-reviewed drafts are not
 * given new SEO text. canonicalUrl is never written.
 */
function considerSeo(input: {
  field: "seoTitle" | "seoDescription";
  current: unknown;
  value: string | null;
  confidence: Confidence;
  evidence: Evidence;
  draft: ResearchDraftSnapshot;
  abstract: string;
  excerpt: string;
  sourceText: string;
  observational: boolean;
  uncertain: boolean;
  evidenceText: string;
  set: Record<string, unknown>;
  wouldSet: PlannedField[];
  leftEmpty: EmptyField[];
  unchanged: Set<string>;
  onReview: () => void;
}) {
  if (isMeaningfulSeoValue(input.current)) {
    input.unchanged.add(input.field);
    return;
  }
  if (seoIsHumanReviewed(input.draft.editorialStatus)) {
    input.leftEmpty.push({ field: input.field, reason: "human-reviewed SEO was left empty" });
    return;
  }
  if (!isEnglishResearchLanguage(input.draft.language)) {
    input.leftEmpty.push({
      field: input.field,
      reason: "non-English SEO metadata is not generated automatically",
    });
    return;
  }

  const text = input.value?.replace(/\s+/g, " ").trim() ?? "";
  if (!text) {
    input.leftEmpty.push({ field: input.field, reason: "not stated" });
    return;
  }
  if (!confidenceMeets(input.confidence, "medium")) {
    input.leftEmpty.push({ field: input.field, reason: "low confidence" });
    return;
  }
  if (!SEO_EVIDENCE.includes(input.evidence)) {
    input.leftEmpty.push({
      field: input.field,
      reason: "not supported by the abstract or metadata",
    });
    return;
  }

  const issues = seoMetadataIssues({
    field: input.field,
    value: text,
    abstract: input.abstract,
    excerpt: input.excerpt,
    sourceText: input.sourceText,
    observational: input.observational,
    uncertain: input.uncertain,
    evidenceText: input.evidenceText,
  });
  if (issues.length > 0) {
    input.leftEmpty.push({ field: input.field, reason: issues.join("; ") });
    input.onReview();
    return;
  }

  assign(input.set, input.wouldSet, input.field, text, text);
}

function repeatsKeyword(text: string, limit: number): boolean {
  const counts = new Map<string, number>();
  for (const word of text.toLowerCase().match(/[a-z]{4,}/g) ?? []) {
    if (SEO_STOPWORDS.has(word)) continue;
    const count = (counts.get(word) ?? 0) + 1;
    counts.set(word, count);
    if (count >= limit) return true;
  }
  return false;
}

function repeatsExcerpt(text: string, excerpt: string): boolean {
  const candidate = normalizeSpace(text).toLowerCase();
  const summary = normalizeSpace(excerpt).toLowerCase();
  if (!candidate || !summary) return false;
  if (candidate === summary) return true;
  if (candidate.length >= 80 && summary.includes(candidate)) return true;
  if (summary.length >= 80 && candidate.includes(summary)) return true;
  return false;
}

function seoFieldReport(
  draft: ResearchDraftSnapshot,
  set: Record<string, unknown>,
  field: "seoTitle" | "seoDescription",
): SeoFieldReport {
  const current = typeof draft[field] === "string" ? draft[field].replace(/\s+/g, " ").trim() : "";
  const written = typeof set[field] === "string" ? set[field].replace(/\s+/g, " ").trim() : "";
  const proposed = written || current;
  return { current, proposed, characters: proposed.length };
}

const IDENTIFIED_REVIEW_DESIGNS: { pattern: RegExp; value: StudyDesignValue }[] = [
  { pattern: /\bumbrella reviews?\b/i, value: "umbrella-review" },
  { pattern: /\bscoping reviews?\b/i, value: "scoping-review" },
  { pattern: /\bevidence maps?\b/i, value: "evidence-map" },
];

export function resolveStudyDesign(
  field: EnrichmentOutput["studyDesign"],
  source: EnrichmentSource,
): string | null {
  const accepted = acceptStudyDesign(field);
  const identified = clearlyIdentifiedReviewDesign(source);
  if (identified && (accepted === null || accepted === "other")) return identified;
  return accepted;
}

export function clearlyIdentifiedReviewDesign(source: EnrichmentSource): StudyDesignValue | null {
  return matchReviewDesign(`${source.title}\n${source.publicationTypes.join("\n")}`);
}

function matchReviewDesign(text: string): StudyDesignValue | null {
  for (const design of IDENTIFIED_REVIEW_DESIGNS) {
    if (design.pattern.test(text)) return design.value;
  }
  return null;
}

function acceptStudyDesign(field: EnrichmentOutput["studyDesign"]): string | null {
  if (!field.value) return null;
  if (!confidenceMeets(field.confidence, "medium")) return null;
  if (field.evidence === "none") return null;
  return field.value;
}

/**
 * Study-design precedence.
 *
 * An empty design is filled by the existing medium-or-better rule.
 * A clearly named umbrella review, scoping review, or evidence map
 * still replaces a model value of null or "other".
 *
 * A stored design is replaced only when all of the following hold:
 * - The field is not human-reviewed.
 * - The stored value is incomplete ("other") or a coarser review label
 *   (narrative-review, systematic-review, or meta-analysis).
 * - The title, publication type, or an abstract sentence that identifies
 *   this paper ("this/our/the present ... review") names a more specific
 *   review: umbrella-review, then scoping-review, then evidence-map.
 * - That explicit phrase is the high-confidence evidence. A model value
 *   is not required when the phrase is already in the title or publication
 *   type. Replacing "other" with any other design still requires the
 *   model's confidence to be high and the same source support.
 *
 * Specific primary designs (trials, crossover, cohort, cross-sectional,
 * observational, pilot, feasibility) and an already specific review
 * design are left as they are.
 */
export function decideStudyDesign(input: {
  current?: string | null;
  field: EnrichmentOutput["studyDesign"];
  source: EnrichmentSource;
  humanLocked: boolean;
}): string | null {
  const proposed = resolveStudyDesign(input.field, input.source);
  const current = input.current?.trim() || null;
  if (!current) return proposed;
  if (input.humanLocked) return current;

  const identified = specificReviewFromSource(input.source);
  if (identified && COARSE_STUDY_DESIGNS.has(current) && identified !== current) {
    return identified;
  }

  if (
    current === "other" &&
    proposed &&
    proposed !== "other" &&
    input.field.confidence === "high" &&
    sourceSupportsDesign(proposed, input.source)
  ) {
    return proposed;
  }

  return current;
}

function specificReviewFromSource(source: EnrichmentSource): StudyDesignValue | null {
  return (
    clearlyIdentifiedReviewDesign(source) ??
    matchReviewDesign(selfIdentifiedReviewPhrase(source.abstract) ?? "")
  );
}

function selfIdentifiedReviewPhrase(abstract: string): string | null {
  const match = abstract.match(
    /\b(?:this|our|the present)\s+(umbrella reviews?|scoping reviews?|evidence maps?)\b/i,
  );
  return match?.[0] ?? null;
}

function sourceSupportsDesign(design: string, source: EnrichmentSource): boolean {
  const title = source.title;
  const types = source.publicationTypes.join("\n");
  const blob = `${title}\n${types}\n${source.abstract}`;
  switch (design) {
    case "umbrella-review":
    case "scoping-review":
    case "evidence-map":
      return specificReviewFromSource(source) === design;
    case "meta-analysis":
      return /\bmeta-analysis\b/i.test(`${title}\n${types}`);
    case "systematic-review":
      return /\bsystematic reviews?\b/i.test(blob);
    case "narrative-review":
      return /\bnarrative reviews?\b/i.test(blob);
    case "randomized-controlled-trial":
      return /\brandomi[sz]ed controlled trials?\b/i.test(blob);
    case "controlled-trial":
      return /\bcontrolled trials?\b/i.test(blob);
    case "crossover-study":
      return /\bcross-?over\b/i.test(blob);
    case "cohort-study":
      return /\bcohort\b/i.test(blob);
    case "cross-sectional-study":
      return /\bcross-sectional\b/i.test(blob);
    case "observational-study":
      return /\bobservational\b/i.test(blob);
    case "pilot-study":
      return /\bpilot\b/i.test(blob);
    case "feasibility-study":
      return /\bfeasibility\b/i.test(blob);
    default:
      return false;
  }
}

/**
 * Keep a comparison only when the abstract states it.
 * A bare control group stays "Control group" instead of an inferred protocol.
 */
export function supportedComparator(value: string, abstract: string): string | null {
  const text = value.replace(/\s+/g, " ").trim();
  if (!text) return null;
  if (!CONTROL_INFERENCE.test(text)) return text;
  if (inferenceIsStated(text, abstract)) return text;
  if (/\bcontrols?\b/i.test(abstract)) return "Control group";
  return null;
}

function inferenceIsStated(comparator: string, abstract: string): boolean {
  const claims = comparator.match(CONTROL_INFERENCE);
  if (!claims) return true;
  const normalizedAbstract = abstract.replace(/\s+/g, " ");
  return claims.every((claim) => new RegExp(escapeRegExp(claim), "i").test(normalizedAbstract));
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Reject practical wording that outruns the result.
 * Unestablished or imprecise effects must not sound like a likely benefit.
 * A missing between-group difference must not sound like superiority.
 * A negated sentence, such as "did not establish that it was superior", stays.
 */
export function practicalInterpretationIssues(text: string, evidenceText: string): string[] {
  const issues: string[] = [];
  const unestablished = UNESTABLISHED_EFFECT.test(evidenceText);
  const noBetweenGroup = NO_BETWEEN_GROUP_DIFFERENCE.test(evidenceText);
  for (const sentence of text.split(/(?<=[.!?])\s+/)) {
    if (unestablished && positiveClaim(sentence, BENEFIT_CLAIM)) {
      issues.push("implies a benefit the results did not establish");
    }
    if (noBetweenGroup && positiveClaim(sentence, SUPERIORITY_CLAIM)) {
      issues.push("implies superiority without a between-group difference");
    }
  }
  return [...new Set(issues)];
}

function positiveClaim(sentence: string, pattern: RegExp): boolean {
  return sentence.split(/\bbut\b/i).some((clause) => pattern.test(clause) && !NEGATED_CLAUSE.test(clause));
}

export function shouldStateObservationalLimitation(input: {
  studyDesign?: string | null;
  publicationTypes: readonly string[];
  title: string;
  abstract: string;
}): boolean {
  const design = input.studyDesign?.trim() ?? "";
  if (TRIAL_DESIGNS.has(design) || REVIEW_DESIGNS.has(design)) return false;
  if (
    isReviewSource({
      studyDesign: design,
      publicationTypes: input.publicationTypes,
    })
  ) {
    return false;
  }
  return isObservationalContext(input);
}

export function mergeLimitations(input: {
  current: string;
  accepted: string | null;
  observational: boolean;
  replaceExisting: boolean;
}): string | null {
  const current = input.current.trim();
  if (current && !input.replaceExisting) return current;
  const base = input.accepted ?? (current || null);
  if (!input.observational) return base;
  return withObservationalCausalityLimitation(base);
}

function withObservationalCausalityLimitation(text: string | null): string | null {
  if (text && /\bcausality\b/i.test(text)) return text;
  const line = `Design-level limitation: ${OBSERVATIONAL_CAUSALITY_LIMITATION}`;
  if (!text) return line;
  return `${text}\n\n${line}`;
}

export function reviseAutomationNote(input: {
  current?: string | null;
  filled: string[];
  stillEmpty: string[];
  humanLocked: boolean;
}): string | null {
  if (input.humanLocked) return null;
  const original = input.current?.replace(/\s+/g, " ").trim() ?? "";
  const discovery = /Sanity draft created by PubMed discovery\./.test(original);
  const stale = original.includes(STALE_DISCOVERY_BLANK_FIELDS);
  if (original && !discovery && !stale) return null;

  const kept = original
    .split(/(?<=\.)\s+/)
    .filter(
      (sentence) =>
        sentence !== STALE_DISCOVERY_BLANK_FIELDS &&
        !sentence.startsWith("Enrichment later filled study fields the abstract supported") &&
        !sentence.startsWith("Still empty:"),
    )
    .join(" ")
    .trim();
  const filled = input.filled.filter((field) => field !== "automationNote");
  const clause = [
    "Enrichment later filled study fields the abstract supported",
    filled.length > 0 ? `(${filled.join(", ")})` : "(no additional public fields)",
    ".",
    "Still empty:",
    input.stillEmpty.length > 0 ? `${input.stillEmpty.join(", ")}.` : "none.",
  ].join(" ");
  const next = `${kept} ${clause}`.replace(/\s+/g, " ").trim();
  if (!next || next === original) return null;
  return next;
}

function isDocumentHumanReviewed(draft: ResearchDraftSnapshot): boolean {
  return HUMAN_LOCKED_STATUSES.has(draft.editorialStatus?.trim() ?? "");
}

function isHumanReviewedField(draft: ResearchDraftSnapshot, field: string): boolean {
  if (isDocumentHumanReviewed(draft)) return true;
  const checklist = draft.editorialChecklist;
  if (!checklist) return false;
  if (field === "practicalInterpretation" && checklist.reviewedPracticalInterpretation === true) {
    return true;
  }
  return checklist.reviewedScientificSummary === true && SCIENTIFIC_FIELDS.has(field);
}

function blocksRevision(draft: ResearchDraftSnapshot, field: string, force: boolean): boolean {
  if (isHumanReviewedField(draft, field)) return true;
  return !force;
}

function auditComparisons(
  draft: ResearchDraftSnapshot,
  set: Record<string, unknown>,
): FieldComparison[] {
  return AUDIT_FIELDS.map((field) => ({
    field,
    before: previewStored(draft[field]),
    after: previewStored(field in set ? set[field] : draft[field]),
  }));
}

function previewStored(value: unknown): string {
  if (typeof value === "number") return String(value);
  const text = fieldText(value);
  return text || "(empty)";
}

function fieldText(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (Array.isArray(value)) return portableTextText(value).trim();
  return "";
}

const SESSION_COUNT_MODIFIER =
  "(?:supervised|total|exercise|training|intervention|planned|completed|additional|brief|daily|weekly|scheduled)";

export function omitInferredSessionCounts(text: string, abstract: string): string | null {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) return null;
  const sessionCountClaim = new RegExp(
    `\\b(\\d+)\\s+(?:${SESSION_COUNT_MODIFIER}\\s+){0,3}(sessions?|bouts?)(?:\\s+per\\s+week|\\s+a\\s+week|\\s+each\\s+week)?(?:\\s+in\\s+\\d+\\s+weeks?)?\\b|\\b(\\d+)\\s+times\\s+(?:per|a|each)\\s+week\\b`,
    "gi",
  );

  const cleaned = normalized.replace(sessionCountClaim, (claim, sessions, _unit, times) => {
    const count = typeof sessions === "string" && sessions ? sessions : times;
    if (typeof count !== "string") return claim;
    return sessionCountIsExplicit(count, abstract) ? claim : "";
  });

  const tidy = tidyOmittedSessionText(cleaned);
  return tidy.length > 0 ? tidy : null;
}

function sessionCountIsExplicit(count: string, abstract: string): boolean {
  const normalized = abstract.replace(/\s+/g, " ");
  const statedCount = `\\b${count}\\s+(?:${SESSION_COUNT_MODIFIER}\\s+){0,3}`;
  return (
    new RegExp(`${statedCount}sessions?\\b`, "i").test(normalized) ||
    new RegExp(`${statedCount}bouts?\\b`, "i").test(normalized) ||
    new RegExp(`\\b${count}\\s+times\\s+(?:per|a|each)\\s+week\\b`, "i").test(normalized)
  );
}

function tidyOmittedSessionText(text: string): string {
  const tidy = text
    .replace(/\s{2,}/g, " ")
    .replace(/\b(?:total(?:ing|ling)?|for a total of)\b\s*(?=[,.]|$)/gi, "")
    .replace(/\s+,/g, ",")
    .replace(/,\s*,+/g, ",")
    .replace(/,\s*([.]|$)/g, "$1")
    .replace(/\s+([,.])/g, "$1")
    .replace(/\s{2,}/g, " ")
    .replace(/^[\s,]+|[\s,]+$/g, "")
    .trim();
  return /[A-Za-z]/.test(tidy) ? tidy : "";
}

function acceptedOutcomes(field: EnrichmentOutput["outcomes"]): string[] | null {
  if (!field.value || !confidenceMeets(field.confidence, "high")) return null;
  if (!SUPPORTED_FACT.includes(field.evidence)) return null;

  const cleaned: string[] = [];
  for (const value of field.value) {
    const text = value.replace(/\s+/g, " ").trim();
    if (!text || text.length > 80) continue;
    if (cleaned.some((existing) => existing.toLowerCase() === text.toLowerCase())) continue;
    cleaned.push(text);
    if (cleaned.length === 8) break;
  }
  return cleaned.length > 0 ? cleaned : null;
}

function acceptedLimitations(
  field: EnrichmentOutput["limitations"],
  abstract: string,
): string | null {
  if (!confidenceMeets(field.confidence, "medium")) return null;

  const parts: string[] = [];
  const author = field.authorStated?.replace(/\s+/g, " ").trim() ?? "";
  const design = field.designLevel?.replace(/\s+/g, " ").trim() ?? "";
  const authorEvidence =
    field.evidence === "abstract" ||
    field.evidence === "abstract_and_metadata" ||
    field.evidence === "metadata";

  if (author && authorEvidence && author.length <= 600 && !copiesAbstractSentence(author, abstract)) {
    parts.push(`Author-stated limitations: ${author}`);
  }
  if (
    design &&
    design.length <= 600 &&
    CONSERVATIVE_DESIGN_LIMITATION.test(design) &&
    !copiesAbstractSentence(design, abstract) &&
    (field.evidence === "design_inference" ||
      field.evidence === "abstract" ||
      field.evidence === "abstract_and_metadata")
  ) {
    parts.push(`Design-level limitation: ${design}`);
  }

  return parts.length > 0 ? parts.join("\n\n") : null;
}

function confidenceMeets(actual: Confidence, minimum: Confidence): boolean {
  const rank: Record<Confidence, number> = { low: 0, medium: 1, high: 2 };
  return rank[actual] >= rank[minimum];
}

function assign(
  set: Record<string, unknown>,
  wouldSet: PlannedField[],
  field: string,
  value: unknown,
  preview: string,
) {
  set[field] = value;
  wouldSet.push({ field, preview: truncate(preview) });
}

function assignEditorialStatusIfEmpty(
  set: Record<string, unknown>,
  current: string | null | undefined,
): boolean {
  const next = editorialStatusAfterEnrichment(current);
  if (!next) return false;
  set.editorialStatus = next;
  return true;
}

function buildNote(input: {
  model: string;
  status: "completed" | "needs_review";
  wouldSet: PlannedField[];
  unchanged: string[];
  leftEmpty: EmptyField[];
  reviewNote: string | null;
  abstractSufficient: boolean;
  editorialStatusSet: boolean;
}): string {
  const filled = input.wouldSet.map((field) => field.field);
  const lines = [
    `Model: ${input.model}`,
    `Status: ${input.status}`,
    filled.length > 0
      ? `Filled empty fields: ${filled.join(", ")}.`
      : "No empty public fields were filled.",
    `Left unchanged: ${input.unchanged.join(", ")}.`,
  ];

  if (input.leftEmpty.length > 0) {
    lines.push(
      `Left empty: ${input.leftEmpty
        .map((field) => `${field.field} (${field.reason})`)
        .join("; ")}.`,
    );
  }
  if (!input.abstractSufficient) {
    lines.push("The model marked the abstract as insufficient.");
  }
  if (input.reviewNote?.trim()) {
    lines.push(`Review note: ${truncate(input.reviewNote.trim(), 400)}`);
  }
  if (input.wouldSet.some((field) => field.field === "seoTitle" || field.field === "seoDescription")) {
    lines.push("SEO metadata generated.");
  }
  lines.push(editorialStatusNote(input.editorialStatusSet));
  lines.push("Public fields already filled by an editor were not overwritten.");
  return lines.join("\n");
}

function toPortableText(field: string, text: string): PortableTextBlock[] {
  const paragraphs = text
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  return paragraphs.map((paragraph, index) => ({
    _type: "block",
    _key: `${field}${index + 1}`,
    style: "normal",
    markDefs: [],
    children: [
      {
        _type: "span",
        _key: `${field}${index + 1}s`,
        text: paragraph,
        marks: [],
      },
    ],
  }));
}

export function hasContent(value: unknown): boolean {
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) {
    if (value.length === 0) return false;
    if (value.every((item) => typeof item === "string")) {
      return value.some((item) => item.trim().length > 0);
    }
    return portableTextText(value).trim().length > 0;
  }
  return false;
}

function portableTextText(value: unknown[]): string {
  return value
    .map((block) => {
      if (!block || typeof block !== "object") return "";
      const children = "children" in block ? block.children : undefined;
      if (!Array.isArray(children)) return "";
      return children
        .map((child) => {
          if (!child || typeof child !== "object" || !("text" in child)) return "";
          return typeof child.text === "string" ? child.text : "";
        })
        .join("");
    })
    .join(" ");
}

function normalizeSpace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function truncate(value: string, max = 500): string {
  const text = value.replace(/\s+/g, " ").trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trim()}…`;
}
