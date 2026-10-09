import {
  assertServerSideImageCredentials,
  CONFIRM_RESEARCH_IMAGES,
  researchImageSize,
  resolveMaxImages,
  resolveResearchImageModel,
  resolveResearchImageScope,
} from "./config";
import {
  assertImageBytes,
  assertImageReview,
  requestResearchCoverImage,
  reviewResearchCoverImage,
} from "./generate";
import { planResearchImages } from "./plan";
import { publicationState } from "./group";
import { fieldsForImagePatch, researchImageFilename } from "./sanity";
import type {
  ImageGenerationRequest,
  ImageReview,
  ImageReviewRequest,
  PlannedStudy,
  ResearchImageBackfillResult,
  ResearchImageDocument,
  StudyPatchResult,
  StudyRunResult,
} from "./types";
import { formatImageCostBanner } from "./report";

/**
 * Retroactive Research image backfill.
 *
 * The same helpers can later sit in this order:
 * PubMed discovery → English draft → AI enrichment → image generation →
 * English alt → Hebrew localization → the same Sanity asset → Hebrew alt →
 * needs_review → manual publish.
 *
 * This runner does not publish, does not create Research documents, and is not
 * wired to the Monday/Thursday schedule.
 */
export async function runResearchImageBackfill(input: {
  dryRun: boolean;
  scope: string;
  maxImages: number | "ALL" | string;
  confirm?: string;
  model?: string;
  qaModel?: string;
  apiKey?: string;
  loadDocuments: () => Promise<ResearchImageDocument[]>;
  uploadImage?: (bytes: Buffer, filename: string) => Promise<string>;
  patchDocument?: (id: string, fields: Record<string, unknown>) => Promise<void>;
  generateImage?: (request: ImageGenerationRequest) => Promise<Buffer>;
  reviewImage?: (request: ImageReviewRequest) => Promise<ImageReview>;
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
}): Promise<ResearchImageBackfillResult> {
  assertServerSideImageCredentials();
  const scope = resolveResearchImageScope(input.scope);
  const maxImages = resolveMaxImages(input.maxImages);
  const model = resolveResearchImageModel(input.model);
  const imageSize = researchImageSize(model);
  if (!input.dryRun && input.confirm !== CONFIRM_RESEARCH_IMAGES) {
    throw new Error(
      "Refusing to write. confirm_write must be exactly GENERATE RESEARCH IMAGES. Nothing was generated or written.",
    );
  }
  if (!input.dryRun && (!input.uploadImage || !input.patchDocument)) {
    throw new Error("Refusing to write without Sanity upload and patch operations.");
  }

  const documents = await input.loadDocuments();
  const plans = planResearchImages(documents, { scope, maxImages });
  const qaModel = input.qaModel?.trim() || "gpt-5.6-luna";
  let imageApiCalls = 0;
  let sanityMutations = 0;

  if (input.dryRun) {
    return {
      dryRun: true,
      scope,
      maxImages,
      model,
      imageSize,
      studies: plans.map((plan) => describePlan(plan, "planned")),
      imageApiCalls: 0,
      sanityMutations: 0,
    };
  }

  const banner = formatImageCostBanner({
    studies: plans.map((plan) => describePlan(plan, "planned")),
    maxImages,
    model,
    imageSize,
  });
  console.log(banner);

  const generations = plans.filter((plan) => plan.action === "generate_image").length;
  if (generations > 0 && !input.generateImage && !input.apiKey?.trim()) {
    throw new Error("OPENAI_API_KEY must be set before image generation. Nothing was written.");
  }

  const uploadImage = input.uploadImage;
  const patchDocument = input.patchDocument;
  if (!uploadImage || !patchDocument) {
    throw new Error("Refusing to write without Sanity upload and patch operations.");
  }

  const generateImage =
    input.generateImage ??
    ((request: ImageGenerationRequest) => {
      const apiKey = input.apiKey?.trim();
      if (!apiKey) {
        throw new Error("OPENAI_API_KEY must be set before image generation. Nothing was written.");
      }
      return requestResearchCoverImage({
        apiKey,
        model: request.model,
        prompt: request.prompt,
        size: request.size,
        fetchImpl: input.fetchImpl,
        sleep: input.sleep,
      });
    });
  const reviewImage =
    input.reviewImage ??
    ((request: ImageReviewRequest) => {
      const apiKey = input.apiKey?.trim();
      if (!apiKey) {
        throw new Error("OPENAI_API_KEY must be set before image QA. Nothing was written.");
      }
      return reviewResearchCoverImage({
        apiKey,
        model: request.model,
        brief: request.brief,
        bytes: request.bytes,
        fetchImpl: input.fetchImpl,
        sleep: input.sleep,
      });
    });

  const studies: StudyRunResult[] = [];
  for (const plan of plans) {
    if (plan.action === "withheld_by_max_images" || plan.patches.length === 0) {
      studies.push(describePlan(plan, plan.action === "withheld_by_max_images" ? "withheld" : "skipped"));
      continue;
    }

    let assetRef = plan.canonicalAssetRef;
    if (plan.action === "generate_image") {
      try {
        imageApiCalls += 1;
        const bytes = await generateImage({
          prompt: plan.prompt,
          model,
          size: imageSize,
        });
        assertImageBytes(bytes);
        const review = await reviewImage({ bytes, brief: plan.brief, model: qaModel });
        assertImageReview(review);
        assetRef = await uploadImage(bytes, researchImageFilename(plan.key));
      } catch (error) {
        const message = errorMessage(error);
        console.error(`Study ${plan.key} failed before a Research document was changed. ${message}`);
        studies.push({
          ...describePlan(plan, "failed"),
          imageGeneration: "failed",
          assetRef: null,
          error: message,
          patches: plan.patches.map((patch) => ({ ...patch, status: "not_applied" })),
        });
        continue;
      }
    }

    const patches: StudyPatchResult[] = [];
    for (const patch of plan.patches) {
      try {
        if (patch.kind === "image" && !assetRef) {
          throw new Error("No Sanity image asset was available for this document.");
        }
        const fields = fieldsForImagePatch(patch, {
          ref: assetRef ?? "",
          hotspot: plan.hotspot,
          crop: plan.crop,
        });
        await patchDocument(patch.id, fields);
        sanityMutations += 1;
        patches.push({ ...patch, status: "patched" });
      } catch (error) {
        const message = errorMessage(error);
        console.error(`Study ${plan.key} document ${patch.id} was not changed. ${message}`);
        patches.push({ ...patch, status: "failed", error: message });
      }
    }

    studies.push({
      ...describePlan(plan, plan.action === "generate_image" ? "generated" : "skipped"),
      assetRef,
      patches,
      imageGeneration: plan.action === "generate_image" ? "generated" : "skipped",
    });
  }

  return {
    dryRun: false,
    scope,
    maxImages,
    model,
    imageSize,
    studies,
    imageApiCalls,
    sanityMutations,
  };
}

function describePlan(
  plan: PlannedStudy,
  imageGeneration: StudyRunResult["imageGeneration"],
): StudyRunResult {
  const generation = plan.action === "withheld_by_max_images" ? "withheld" : imageGeneration;
  return {
    key: plan.key,
    pmid: plan.pmid,
    englishTitle: plan.englishTitle,
    action: plan.action,
    existingImage: plan.existingImage,
    assetReused: plan.assetReused,
    imageGeneration: plan.action === "generate_image" ? generation : plan.action === "withheld_by_max_images" ? "withheld" : "skipped",
    reason: plan.reason,
    assetRef: plan.canonicalAssetRef,
    documents: plan.documents.map((doc) => ({
      id: doc._id,
      language: doc.language?.trim() || "unknown",
      publication: publicationState(doc._id),
    })),
    patches: plan.patches.map((patch) => ({ ...patch, status: "planned" as const })),
  };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Research image backfill failed.";
}
