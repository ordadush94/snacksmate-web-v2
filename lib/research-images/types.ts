import type { RegenerationMode, ResearchImageScope } from "./config";

/**
 * A Research document as read for image backfill.
 * `mainImage` is the existing Sanity image field. Alt text lives on that object.
 */
export type ResearchImageAsset = {
  _ref?: string | null;
  _id?: string | null;
  _type?: string | null;
};

export type ResearchMainImage = {
  _type?: string;
  alt?: string | null;
  hotspot?: unknown;
  crop?: unknown;
  asset?: ResearchImageAsset | null;
};

export type ResearchImageDocument = {
  _id: string;
  language?: string | null;
  title?: string | null;
  seoTitle?: string | null;
  excerpt?: string | null;
  topic?: string | null;
  studyDesign?: string | null;
  population?: string | null;
  intervention?: unknown;
  outcomes?: string[] | null;
  mainFindings?: unknown;
  practicalInterpretation?: unknown;
  pmid?: string | null;
  doi?: string | null;
  translationSourceId?: string | null;
  translationSlug?: string | null;
  mainImage?: ResearchMainImage | null;
  /** Internal provenance. Absent on manually uploaded images. */
  imageAutomation?: ResearchImageAutomation | null;
};

/**
 * Stored only after this automation uploads an image.
 * A later manual replacement will not match `assetRef`, so it cannot be overwritten.
 */
export type ResearchImageAutomation = {
  _type?: string;
  source: string;
  assetRef: string;
  studyKey: string;
  generatedAt: string;
  activity: ActivityId;
  setting: SettingId;
  subjectCount: SubjectCount;
  subjectPresentation: SubjectPresentation;
  approximateAge: ApproximateAge;
  composition: CompositionId;
  supportingPalette: SupportingPaletteId;
  brandAccent: BrandAccentId;
  keyProps: string[];
  appearanceVariation: AppearanceVariation;
};

export type ActivityId =
  | "stair-climbing"
  | "cycling"
  | "resistance"
  | "walking"
  | "sedentary-interruption"
  | "vilpa"
  | "exercise-snack"
  | "general-activity";

export type PopulationId = "older-adult" | "young-adult" | "adult" | "unspecified";

export type SettingId =
  | "home"
  | "home-exercise-corner"
  | "office"
  | "workplace-corridor"
  | "staircase"
  | "outdoor-urban"
  | "park"
  | "gym"
  | "campus"
  | "studio";

export type SettingFamily = "home" | "office" | "stairs" | "outdoors" | "gym" | "other";

export type SubjectCount = "none" | "one" | "two" | "group";

export type SubjectPresentation =
  | "male"
  | "female"
  | "gender-neutral"
  | "mixed-pair"
  | "small-group"
  | "none";

export type ApproximateAge = "older" | "young-adult" | "adult";

export type CompositionId =
  | "wide-environmental"
  | "medium-activity"
  | "side-profile"
  | "three-quarter"
  | "slightly-elevated"
  | "activity-focus"
  | "asymmetrical"
  | "two-person"
  | "equipment-focus"
  | "movement-no-face";

export type SupportingPaletteId =
  | "muted-blue"
  | "warm-sand"
  | "soft-peach"
  | "muted-coral"
  | "soft-lavender"
  | "warm-neutral"
  | "sage"
  | "light-terracotta";

export type BrandAccentId = "clothing-accent" | "accessory" | "architectural" | "equipment-accent";

export type AppearanceVariation = "light" | "medium" | "deep" | "olive" | "none";

/**
 * Internal visual decision for one Research image.
 * This is not a public Sanity field. The stored copy used for repetition
 * checks lives on the internal `imageAutomation` record.
 */
export type ResearchVisualPlan = {
  activity: ActivityId;
  setting: SettingId;
  subjectCount: SubjectCount;
  subjectPresentation: SubjectPresentation;
  approximateAge: ApproximateAge;
  composition: CompositionId;
  supportingPalette: SupportingPaletteId;
  keyProps: string[];
  brandAccent: BrandAccentId;
  appearanceVariation: AppearanceVariation;
  rationale: string;
};

export type DiversityHistoryEntry = {
  studyKey: string;
  generatedAt: string;
  activity: ActivityId;
  setting: SettingId;
  subjectCount: SubjectCount;
  subjectPresentation: SubjectPresentation;
  approximateAge: ApproximateAge;
  composition: CompositionId;
  supportingPalette: SupportingPaletteId;
  appearanceVariation: AppearanceVariation;
};

export type VisualBrief = {
  activity: ActivityId;
  population: PopulationId;
  setting: string;
  scene: string;
  concerns: string[];
  metabolic: boolean;
  variant: string;
  plan: ResearchVisualPlan;
};

export type ImagePatchKind = "image" | "alt";

export type ImagePatchPlan = {
  id: string;
  language: "en" | "he";
  publication: "published" | "draft";
  kind: ImagePatchKind;
  alt: string;
};

export type StudyAction =
  | "skip_existing_image"
  | "reuse_existing_asset"
  | "generate_image"
  | "regenerate_image"
  | "withheld_by_max_images";

export type ImageProvenance = "missing" | "research-image-automation" | "unknown";

export type PlannedStudy = {
  key: string;
  pmid: string | null;
  englishTitle: string;
  action: StudyAction;
  existingImage: boolean;
  assetReused: boolean;
  reason: string;
  canonicalAssetRef: string | null;
  hotspot?: unknown;
  crop?: unknown;
  brief: VisualBrief;
  prompt: string;
  documents: ResearchImageDocument[];
  patches: ImagePatchPlan[];
  provenance: ImageProvenance;
  regenerationEligible: boolean;
  recordedPlan: DiversityHistoryEntry | null;
};

export type ImageGenerationRequest = {
  prompt: string;
  model: string;
  size: string;
};

export type ImageReview = {
  hasVisibleText: boolean;
  activityMatches: boolean;
  reason: string;
};

export type ImageReviewRequest = {
  bytes: Buffer;
  brief: VisualBrief;
  model: string;
};

export type StudyPatchResult = ImagePatchPlan & {
  status: "planned" | "patched" | "failed" | "not_applied";
  error?: string;
};

export type StudyRunResult = {
  key: string;
  pmid: string | null;
  englishTitle: string;
  action: StudyAction;
  existingImage: boolean;
  assetReused: boolean;
  imageGeneration: "skipped" | "planned" | "withheld" | "generated" | "failed";
  reason: string;
  assetRef: string | null;
  provenance: ImageProvenance;
  regenerationEligible: boolean;
  recordedPlan: DiversityHistoryEntry | null;
  proposedPlan: ResearchVisualPlan;
  error?: string;
  documents: {
    id: string;
    language: string;
    publication: "published" | "draft" | "other";
  }[];
  patches: StudyPatchResult[];
};

export type DiversityPeopleCounts = {
  femalePresenting: number;
  malePresenting: number;
  genderNeutral: number;
  mixedOrGroup: number;
  noPerson: number;
  notRecorded: number;
};

export type DiversitySettingCounts = {
  home: number;
  office: number;
  stairs: number;
  outdoors: number;
  gym: number;
  other: number;
  notRecorded: number;
};

export type ResearchImageAuditRow = {
  key: string;
  pmid: string | null;
  englishTitle: string;
  existingImage: boolean;
  provenance: ImageProvenance;
  regenerationEligible: boolean;
  recordedPlan: DiversityHistoryEntry | null;
  proposedPlan: ResearchVisualPlan;
};

export type ResearchImageAudit = {
  rows: ResearchImageAuditRow[];
  recordedPeople: DiversityPeopleCounts;
  recordedSettings: DiversitySettingCounts;
  proposedPeople: DiversityPeopleCounts;
  proposedSettings: DiversitySettingCounts;
  automated: number;
  unknown: number;
  missing: number;
};

export type ResearchImageBackfillResult = {
  dryRun: boolean;
  scope: ResearchImageScope;
  regenerationMode: RegenerationMode;
  maxImages: number | "ALL";
  model: string;
  imageSize: string;
  studies: StudyRunResult[];
  audit: ResearchImageAudit;
  imageApiCalls: number;
  sanityMutations: number;
};
