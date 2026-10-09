import type {
  ActivityId,
  AppearanceVariation,
  ApproximateAge,
  BrandAccentId,
  CompositionId,
  DiversityHistoryEntry,
  ResearchImageAutomation,
  ResearchImageDocument,
  ResearchVisualPlan,
  SettingId,
  SubjectCount,
  SubjectPresentation,
  SupportingPaletteId,
} from "./types";

/** The only source value that authorizes a later replacement. */
export const RESEARCH_IMAGE_AUTOMATION_SOURCE = "research-image-automation";

const ACTIVITIES = new Set<ActivityId>([
  "stair-climbing",
  "cycling",
  "resistance",
  "walking",
  "sedentary-interruption",
  "vilpa",
  "exercise-snack",
  "general-activity",
]);

const SETTINGS = new Set<SettingId>([
  "home",
  "home-exercise-corner",
  "office",
  "workplace-corridor",
  "staircase",
  "outdoor-urban",
  "park",
  "gym",
  "campus",
  "studio",
]);

const COUNTS = new Set<SubjectCount>(["none", "one", "two", "group"]);

const PRESENTATIONS = new Set<SubjectPresentation>([
  "male",
  "female",
  "gender-neutral",
  "mixed-pair",
  "small-group",
  "none",
]);

const AGES = new Set<ApproximateAge>(["older", "young-adult", "adult"]);

const COMPOSITIONS = new Set<CompositionId>([
  "wide-environmental",
  "medium-activity",
  "side-profile",
  "three-quarter",
  "slightly-elevated",
  "activity-focus",
  "asymmetrical",
  "two-person",
  "equipment-focus",
  "movement-no-face",
]);

const PALETTES = new Set<SupportingPaletteId>([
  "muted-blue",
  "warm-sand",
  "soft-peach",
  "muted-coral",
  "soft-lavender",
  "warm-neutral",
  "sage",
  "light-terracotta",
]);

const ACCENTS = new Set<BrandAccentId>([
  "clothing-accent",
  "accessory",
  "architectural",
  "equipment-accent",
]);

const APPEARANCES = new Set<AppearanceVariation>(["light", "medium", "deep", "olive", "none"]);

export function imageAutomationFromPlan(input: {
  plan: ResearchVisualPlan;
  assetRef: string;
  studyKey: string;
  generatedAt: string;
}): ResearchImageAutomation {
  return {
    _type: "researchImageAutomation",
    source: RESEARCH_IMAGE_AUTOMATION_SOURCE,
    assetRef: input.assetRef,
    studyKey: input.studyKey,
    generatedAt: input.generatedAt,
    activity: input.plan.activity,
    setting: input.plan.setting,
    subjectCount: input.plan.subjectCount,
    subjectPresentation: input.plan.subjectPresentation,
    approximateAge: input.plan.approximateAge,
    composition: input.plan.composition,
    supportingPalette: input.plan.supportingPalette,
    brandAccent: input.plan.brandAccent,
    keyProps: [...input.plan.keyProps],
    appearanceVariation: input.plan.appearanceVariation,
  };
}

/**
 * A record counts only when every stored choice is valid and it still points
 * at the image currently on the document. Filename guesses are not provenance.
 */
export function parseImageAutomation(value: unknown): ResearchImageAutomation | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  if (row.source !== RESEARCH_IMAGE_AUTOMATION_SOURCE) return null;
  if (typeof row.assetRef !== "string" || !row.assetRef.startsWith("image-")) return null;
  if (typeof row.studyKey !== "string" || !row.studyKey.trim()) return null;
  if (typeof row.generatedAt !== "string" || !row.generatedAt.trim()) return null;
  if (!isMember(ACTIVITIES, row.activity)) return null;
  if (!isMember(SETTINGS, row.setting)) return null;
  if (!isMember(COUNTS, row.subjectCount)) return null;
  if (!isMember(PRESENTATIONS, row.subjectPresentation)) return null;
  if (!isMember(AGES, row.approximateAge)) return null;
  if (!isMember(COMPOSITIONS, row.composition)) return null;
  if (!isMember(PALETTES, row.supportingPalette)) return null;
  if (!isMember(ACCENTS, row.brandAccent)) return null;
  if (!isMember(APPEARANCES, row.appearanceVariation)) return null;
  if (!Array.isArray(row.keyProps) || row.keyProps.some((prop) => typeof prop !== "string")) return null;
  return {
    _type: typeof row._type === "string" ? row._type : "researchImageAutomation",
    source: RESEARCH_IMAGE_AUTOMATION_SOURCE,
    assetRef: row.assetRef,
    studyKey: row.studyKey.trim(),
    generatedAt: row.generatedAt,
    activity: row.activity,
    setting: row.setting,
    subjectCount: row.subjectCount,
    subjectPresentation: row.subjectPresentation,
    approximateAge: row.approximateAge,
    composition: row.composition,
    supportingPalette: row.supportingPalette,
    brandAccent: row.brandAccent,
    keyProps: row.keyProps,
    appearanceVariation: row.appearanceVariation,
  };
}

export function matchingAutomation(
  document: ResearchImageDocument,
  assetRef: string | null,
): ResearchImageAutomation | null {
  if (!assetRef) return null;
  const record = parseImageAutomation(document.imageAutomation);
  if (!record || record.assetRef !== assetRef) return null;
  return record;
}

export function historyFromDocuments(
  documents: readonly ResearchImageDocument[],
  assetRefFor: (document: ResearchImageDocument) => string | null,
): DiversityHistoryEntry[] {
  const byStudy = new Map<string, DiversityHistoryEntry>();
  for (const document of documents) {
    const record = matchingAutomation(document, assetRefFor(document));
    if (!record) continue;
    const entry = historyEntryFromAutomation(record);
    const existing = byStudy.get(entry.studyKey);
    if (!existing || entry.generatedAt > existing.generatedAt) byStudy.set(entry.studyKey, entry);
  }
  return [...byStudy.values()]
    .sort((a, b) => b.generatedAt.localeCompare(a.generatedAt) || a.studyKey.localeCompare(b.studyKey))
    .slice(0, 12);
}

export function historyEntryFromPlan(
  plan: ResearchVisualPlan,
  studyKey: string,
  generatedAt = "",
): DiversityHistoryEntry {
  return {
    studyKey,
    generatedAt,
    activity: plan.activity,
    setting: plan.setting,
    subjectCount: plan.subjectCount,
    subjectPresentation: plan.subjectPresentation,
    approximateAge: plan.approximateAge,
    composition: plan.composition,
    supportingPalette: plan.supportingPalette,
    appearanceVariation: plan.appearanceVariation,
  };
}

export function historyEntryFromAutomation(record: ResearchImageAutomation): DiversityHistoryEntry {
  return {
    studyKey: record.studyKey,
    generatedAt: record.generatedAt,
    activity: record.activity,
    setting: record.setting,
    subjectCount: record.subjectCount,
    subjectPresentation: record.subjectPresentation,
    approximateAge: record.approximateAge,
    composition: record.composition,
    supportingPalette: record.supportingPalette,
    appearanceVariation: record.appearanceVariation,
  };
}

function isMember<T extends string>(set: Set<T>, value: unknown): value is T {
  return typeof value === "string" && set.has(value as T);
}
