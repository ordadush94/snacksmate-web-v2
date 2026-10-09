import type { ResearchImageScope } from "./config";

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

export type VisualBrief = {
  activity: ActivityId;
  population: PopulationId;
  setting: string;
  scene: string;
  concerns: string[];
  metabolic: boolean;
  variant: string;
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
  | "withheld_by_max_images";

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
  error?: string;
  documents: {
    id: string;
    language: string;
    publication: "published" | "draft" | "other";
  }[];
  patches: StudyPatchResult[];
};

export type ResearchImageBackfillResult = {
  dryRun: boolean;
  scope: ResearchImageScope;
  maxImages: number | "ALL";
  model: string;
  imageSize: string;
  studies: StudyRunResult[];
  imageApiCalls: number;
  sanityMutations: number;
};
