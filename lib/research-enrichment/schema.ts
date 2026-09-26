export const STUDY_DESIGN_VALUES = [
  "randomized-controlled-trial",
  "controlled-trial",
  "crossover-study",
  "cohort-study",
  "cross-sectional-study",
  "systematic-review",
  "meta-analysis",
  "narrative-review",
  "scoping-review",
  "umbrella-review",
  "evidence-map",
  "observational-study",
  "pilot-study",
  "feasibility-study",
  "other",
] as const;

export type StudyDesignValue = (typeof STUDY_DESIGN_VALUES)[number];

export const CONFIDENCE_VALUES = ["high", "medium", "low"] as const;
export type Confidence = (typeof CONFIDENCE_VALUES)[number];

export const EVIDENCE_VALUES = [
  "abstract",
  "metadata",
  "abstract_and_metadata",
  "design_inference",
  "none",
] as const;
export type Evidence = (typeof EVIDENCE_VALUES)[number];

export const SAMPLE_MEANINGS = ["participants", "included_studies", "unclear"] as const;
export type SampleMeaning = (typeof SAMPLE_MEANINGS)[number];

export type TextAssessment = {
  value: string | null;
  confidence: Confidence;
  evidence: Evidence;
};

export type EnrichmentOutput = {
  excerpt: TextAssessment;
  studyDesign: {
    value: StudyDesignValue | null;
    confidence: Confidence;
    evidence: Evidence;
  };
  population: TextAssessment;
  sampleSize: {
    value: number | null;
    meaning: SampleMeaning | null;
    confidence: Confidence;
    evidence: Evidence;
  };
  intervention: TextAssessment;
  duration: TextAssessment;
  comparator: TextAssessment;
  outcomes: {
    value: string[] | null;
    confidence: Confidence;
    evidence: Evidence;
  };
  mainFindings: TextAssessment;
  limitations: {
    authorStated: string | null;
    designLevel: string | null;
    confidence: Confidence;
    evidence: Evidence;
  };
  practicalInterpretation: TextAssessment;
  needsReview: boolean;
  reviewNote: string | null;
  abstractSufficient: boolean;
};

export class EnrichmentValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EnrichmentValidationError";
  }
}

const confidenceSchema = {
  type: "string",
  enum: [...CONFIDENCE_VALUES],
  description:
    "high only when the abstract or metadata states the fact directly. medium for a cautious paraphrase of stated information. low when the detail is absent or unclear.",
};

const evidenceSchema = {
  type: "string",
  enum: [...EVIDENCE_VALUES],
  description:
    "Where the value came from. Use none when the value is null. Use design_inference only for study design or a conservative design-level limitation.",
};

function textAssessmentSchema(description: string) {
  return {
    type: "object",
    description,
    additionalProperties: false,
    required: ["value", "confidence", "evidence"],
    properties: {
      value: {
        anyOf: [{ type: "string" }, { type: "null" }],
      },
      confidence: confidenceSchema,
      evidence: evidenceSchema,
    },
  };
}

export const RESEARCH_ENRICHMENT_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
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
    "practicalInterpretation",
    "needsReview",
    "reviewNote",
    "abstractSufficient",
  ],
  properties: {
    excerpt: textAssessmentSchema(
      "Original plain-language summary of about 160 to 300 characters. Do not copy an abstract sentence.",
    ),
    studyDesign: {
      type: "object",
      description:
        "Use umbrella-review, scoping-review, or evidence-map when that design is clearly identified, even if the title also says meta-analysis. Those labels are more specific than meta-analysis, systematic-review, narrative-review, or other. Do not use other for a clearly identified scoping review, umbrella review, or evidence map.",
      additionalProperties: false,
      required: ["value", "confidence", "evidence"],
      properties: {
        value: {
          anyOf: [{ type: "string", enum: [...STUDY_DESIGN_VALUES] }, { type: "null" }],
        },
        confidence: confidenceSchema,
        evidence: evidenceSchema,
      },
    },
    population: textAssessmentSchema(
      "Only demographics and setting stated in the abstract. Null when unclear.",
    ),
    sampleSize: {
      type: "object",
      additionalProperties: false,
      required: ["value", "meaning", "confidence", "evidence"],
      properties: {
        value: {
          anyOf: [{ type: "integer" }, { type: "null" }],
          description: "A single participant count. Null when it is not explicit.",
        },
        meaning: {
          anyOf: [{ type: "string", enum: [...SAMPLE_MEANINGS] }, { type: "null" }],
          description:
            "participants only for one enrolled or pooled participant count. included_studies when the number counts papers. unclear when the number could be either.",
        },
        confidence: confidenceSchema,
        evidence: evidenceSchema,
      },
    },
    intervention: textAssessmentSchema(
      "Original summary of activity type, bout duration, intensity, rest, and protocol details that are explicitly stated. Include a session or bout count only when that exact number is written in the source. Do not calculate totals.",
    ),
    duration: textAssessmentSchema(
      "Trial or program duration in one concise phrase of at most 160 characters, such as 6 weeks, single acute session, or a review summary of stated timings. Null when timing is not stated. Do not invent duration.",
    ),
    comparator: textAssessmentSchema(
      "The control or comparison condition, only when the abstract states it. If the abstract only says control group, the value is Control group. Do not describe control behavior that the abstract does not state.",
    ),
    outcomes: {
      type: "object",
      additionalProperties: false,
      required: ["value", "confidence", "evidence"],
      properties: {
        value: {
          anyOf: [
            { type: "array", items: { type: "string" } },
            { type: "null" },
          ],
          description: "Short names of the major outcomes. Null when none are clear.",
        },
        confidence: confidenceSchema,
        evidence: evidenceSchema,
      },
    },
    mainFindings: textAssessmentSchema(
      "Findings supported by the abstract, with direction of effect preserved. Use association language for observational designs.",
    ),
    limitations: {
      type: "object",
      additionalProperties: false,
      required: ["authorStated", "designLevel", "confidence", "evidence"],
      properties: {
        authorStated: {
          anyOf: [{ type: "string" }, { type: "null" }],
          description: "Limitations the abstract itself mentions. Null when it mentions none.",
        },
        designLevel: {
          anyOf: [{ type: "string" }, { type: "null" }],
          description:
            "Only a conservative limitation that is obvious from the design, such as a small pilot sample or a cross-sectional design that cannot establish causality. For a cohort or other clearly observational study, Observational design cannot establish causality. is acceptable even when the abstract lists none. Null otherwise. Do not add speculative limitations.",
        },
        confidence: confidenceSchema,
        evidence: evidenceSchema,
      },
    },
    practicalInterpretation: textAssessmentSchema(
      "Snacksmate plain-language interpretation. This is not the authors' conclusion. Do not give medical advice. If the effect was not statistically clear, the evidence is insufficient, or the results neither support nor refute an effect, do not say may improve, may affect, or may provide benefits. Say the evidence is insufficient or the study did not establish a clear effect. If between-group differences were not significant, do not imply one intervention was superior.",
    ),
    needsReview: {
      type: "boolean",
      description: "True when a human should check the draft before anyone relies on the summary.",
    },
    reviewNote: {
      anyOf: [{ type: "string" }, { type: "null" }],
      description: "Short internal reason a human should look, or null.",
    },
    abstractSufficient: {
      type: "boolean",
      description: "False when the abstract is missing, too thin, or too unclear to support the fields.",
    },
  },
} as const;

export function parseEnrichmentOutput(input: unknown): EnrichmentOutput {
  let value = input;
  if (typeof input === "string") {
    try {
      value = JSON.parse(input) as unknown;
    } catch {
      throw new EnrichmentValidationError("AI response was not valid JSON.");
    }
  }

  const record = asRecord(value);
  if (!record) {
    throw new EnrichmentValidationError("AI response must be a JSON object.");
  }

  return {
    excerpt: textAssessment(record.excerpt, "excerpt"),
    studyDesign: {
      value: studyDesignValue(nested(record.studyDesign, "studyDesign").value),
      confidence: confidenceValue(nested(record.studyDesign, "studyDesign").confidence, "studyDesign"),
      evidence: evidenceValue(nested(record.studyDesign, "studyDesign").evidence, "studyDesign"),
    },
    population: textAssessment(record.population, "population"),
    sampleSize: sampleSizeAssessment(record.sampleSize),
    intervention: textAssessment(record.intervention, "intervention"),
    duration: textAssessment(record.duration, "duration"),
    comparator: textAssessment(record.comparator, "comparator"),
    outcomes: outcomesAssessment(record.outcomes),
    mainFindings: textAssessment(record.mainFindings, "mainFindings"),
    limitations: limitationsAssessment(record.limitations),
    practicalInterpretation: textAssessment(
      record.practicalInterpretation,
      "practicalInterpretation",
    ),
    needsReview: booleanValue(record.needsReview, "needsReview"),
    reviewNote: nullableString(record.reviewNote, "reviewNote"),
    abstractSufficient: booleanValue(record.abstractSufficient, "abstractSufficient"),
  };
}

function textAssessment(value: unknown, label: string): TextAssessment {
  const record = nested(value, label);
  return {
    value: nullableString(record.value, `${label}.value`),
    confidence: confidenceValue(record.confidence, label),
    evidence: evidenceValue(record.evidence, label),
  };
}

function sampleSizeAssessment(value: unknown): EnrichmentOutput["sampleSize"] {
  const record = nested(value, "sampleSize");
  return {
    value: integerOrNull(record.value, "sampleSize.value"),
    meaning: meaningValue(record.meaning),
    confidence: confidenceValue(record.confidence, "sampleSize"),
    evidence: evidenceValue(record.evidence, "sampleSize"),
  };
}

function outcomesAssessment(value: unknown): EnrichmentOutput["outcomes"] {
  const record = nested(value, "outcomes");
  return {
    value: stringArrayOrNull(record.value, "outcomes.value"),
    confidence: confidenceValue(record.confidence, "outcomes"),
    evidence: evidenceValue(record.evidence, "outcomes"),
  };
}

function limitationsAssessment(value: unknown): EnrichmentOutput["limitations"] {
  const record = nested(value, "limitations");
  return {
    authorStated: nullableString(record.authorStated, "limitations.authorStated"),
    designLevel: nullableString(record.designLevel, "limitations.designLevel"),
    confidence: confidenceValue(record.confidence, "limitations"),
    evidence: evidenceValue(record.evidence, "limitations"),
  };
}

function nested(value: unknown, label: string): Record<string, unknown> {
  const record = asRecord(value);
  if (!record) throw new EnrichmentValidationError(`${label} must be an object.`);
  return record;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function nullableString(value: unknown, label: string): string | null {
  if (value === null) return null;
  if (typeof value !== "string") {
    throw new EnrichmentValidationError(`${label} must be a string or null.`);
  }
  return value;
}

function confidenceValue(value: unknown, label: string): Confidence {
  if (!isOneOf(value, CONFIDENCE_VALUES)) {
    throw new EnrichmentValidationError(`${label}.confidence is invalid.`);
  }
  return value;
}

function evidenceValue(value: unknown, label: string): Evidence {
  if (!isOneOf(value, EVIDENCE_VALUES)) {
    throw new EnrichmentValidationError(`${label}.evidence is invalid.`);
  }
  return value;
}

function studyDesignValue(value: unknown): StudyDesignValue | null {
  if (value === null) return null;
  if (!isOneOf(value, STUDY_DESIGN_VALUES)) {
    throw new EnrichmentValidationError("studyDesign.value is not a supported design.");
  }
  return value;
}

function meaningValue(value: unknown): SampleMeaning | null {
  if (value === null) return null;
  if (!isOneOf(value, SAMPLE_MEANINGS)) {
    throw new EnrichmentValidationError("sampleSize.meaning is invalid.");
  }
  return value;
}

function integerOrNull(value: unknown, label: string): number | null {
  if (value === null) return null;
  if (typeof value !== "number" || !Number.isInteger(value)) {
    throw new EnrichmentValidationError(`${label} must be an integer or null.`);
  }
  return value;
}

function stringArrayOrNull(value: unknown, label: string): string[] | null {
  if (value === null) return null;
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new EnrichmentValidationError(`${label} must be an array of strings or null.`);
  }
  return value;
}

function booleanValue(value: unknown, label: string): boolean {
  if (typeof value !== "boolean") {
    throw new EnrichmentValidationError(`${label} must be a boolean.`);
  }
  return value;
}

function isOneOf<T extends string>(value: unknown, allowed: readonly T[]): value is T {
  return typeof value === "string" && (allowed as readonly string[]).includes(value);
}
