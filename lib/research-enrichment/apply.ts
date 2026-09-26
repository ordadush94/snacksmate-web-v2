import { draftIdForPmid } from "../research-discovery/normalize";
import type { Confidence, EnrichmentOutput, Evidence } from "./schema";

const DRAFT_ID_PATTERN = /^drafts\.research-pubmed-\d{1,9}$/;
const REVIEW_DESIGNS = new Set([
  "systematic-review",
  "meta-analysis",
  "narrative-review",
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
  journal?: string | null;
  doi?: string | null;
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

export type EnrichmentPlan = {
  draftId: string;
  pmid: string;
  set: Record<string, unknown>;
  wouldSet: PlannedField[];
  unchanged: string[];
  leftEmpty: EmptyField[];
  status: "completed" | "needs_review";
  abstractInsufficient: boolean;
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

export function assertDraftDocumentId(id: string): void {
  if (!DRAFT_ID_PATTERN.test(id)) {
    throw new Error(
      `Refusing to update "${id}". Enrichment only updates drafts.research-pubmed-{PMID} and never publishes.`,
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
}): EnrichmentPlan {
  const draftId = enrichmentDraftId(input.draft.pmid);
  if (input.draft._id !== draftId) {
    throw new Error(
      `Draft ${input.draft._id} does not match ${draftId}. Enrichment will not create a second document.`,
    );
  }

  const unchanged = new Set<string>(["title", "journal", "doi"]);
  const wouldSet: PlannedField[] = [];
  const leftEmpty: EmptyField[] = [];
  const set: Record<string, unknown> = {};
  let needsReview =
    input.extraction.needsReview || input.extraction.abstractSufficient === false;

  const proposedDesign = acceptStudyDesign(input.extraction.studyDesign);
  if (hasContent(input.draft.studyDesign)) {
    unchanged.add("studyDesign");
  } else if (proposedDesign) {
    assign(set, wouldSet, "studyDesign", proposedDesign, proposedDesign);
  } else {
    leftEmpty.push({ field: "studyDesign", reason: "not confident enough to map a design" });
  }

  const effectiveDesign = hasContent(input.draft.studyDesign)
    ? input.draft.studyDesign
    : proposedDesign;
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
    maxLength: 60,
    abstract: input.source.abstract,
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
    set,
    wouldSet,
    leftEmpty,
    unchanged,
    onDrop: (reason) => {
      if (reason.includes("wording") || reason.includes("copied") || reason.includes("advice")) {
        needsReview = true;
      }
    },
  });

  const limitations = acceptedLimitations(input.extraction.limitations, input.source.abstract);
  if (hasContent(input.draft.limitations)) {
    unchanged.add("limitations");
  } else if (limitations) {
    assign(
      set,
      wouldSet,
      "limitations",
      toPortableText("limitations", limitations),
      limitations,
    );
  } else {
    leftEmpty.push({
      field: "limitations",
      reason: "no author-stated or conservative design limitation",
    });
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
    set,
    wouldSet,
    leftEmpty,
    unchanged,
    onDrop: () => {
      needsReview = true;
    },
  });

  if (!hasContent(input.draft.excerpt) && !("excerpt" in set)) needsReview = true;
  if (!hasContent(input.draft.mainFindings) && !("mainFindings" in set)) needsReview = true;
  if (input.extraction.reviewNote?.trim()) needsReview = true;

  const status = needsReview ? "needs_review" : "completed";
  const note = buildNote({
    model: input.model,
    status,
    wouldSet,
    unchanged: [...unchanged],
    leftEmpty,
    reviewNote: input.extraction.reviewNote,
    abstractSufficient: input.extraction.abstractSufficient,
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

  const note = [
    `Model: ${input.model}`,
    "Status: needs_review",
    "The PubMed abstract was missing or too short to enrich this draft.",
    "No public fields were changed.",
  ].join("\n");

  return {
    draftId,
    pmid: input.draft.pmid,
    set: {
      aiEnrichedAt: input.enrichedAt,
      aiModel: input.model,
      aiEnrichmentStatus: "needs_review",
      aiEnrichmentNote: note,
    },
    wouldSet: [],
    unchanged: ["title", "journal", "doi"],
    leftEmpty: [
      {
        field: "excerpt",
        reason: "PubMed abstract was missing or too short",
      },
    ],
    status: "needs_review",
    abstractInsufficient: true,
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
        type.includes("umbrella review"),
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
  set: Record<string, unknown>;
  wouldSet: PlannedField[];
  leftEmpty: EmptyField[];
  unchanged: Set<string>;
  onDrop?: (reason: string) => void;
}) {
  if (hasContent(input.current)) {
    input.unchanged.add(input.field);
    return;
  }

  const decision = acceptProse(input);
  if (!decision.text) {
    input.leftEmpty.push({ field: input.field, reason: decision.reason ?? "not stated" });
    input.onDrop?.(decision.reason ?? "not stated");
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

function acceptStudyDesign(
  field: EnrichmentOutput["studyDesign"],
): string | null {
  if (!field.value) return null;
  if (!confidenceMeets(field.confidence, "medium")) return null;
  if (field.evidence === "none") return null;
  return field.value;
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

function buildNote(input: {
  model: string;
  status: "completed" | "needs_review";
  wouldSet: PlannedField[];
  unchanged: string[];
  leftEmpty: EmptyField[];
  reviewNote: string | null;
  abstractSufficient: boolean;
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
