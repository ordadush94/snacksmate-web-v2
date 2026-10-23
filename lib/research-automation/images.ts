import { CONFIRM_RESEARCH_IMAGES } from "../research-images/config";
import { runResearchImageBackfill } from "../research-images/run";
import type {
  ImageGenerationRequest,
  ImageReview,
  ImageReviewRequest,
  ResearchImageDocument,
  StudyRunResult,
} from "../research-images/types";
import type { ResearchImageAttachment } from "./run";

/**
 * Generate at most one cover for each Research draft this automation run just
 * created. The caller passes those drafts only, so the scheduled run does not
 * scan the rest of the Research library.
 *
 * Hebrew is not patched here. The English document is reloaded afterward, and
 * Hebrew localization copies that same Sanity asset.
 */
export async function attachResearchCoverImages(input: {
  documents: readonly ResearchImageDocument[];
  apiKey?: string;
  model?: string;
  qaModel?: string;
  uploadImage: (bytes: Buffer, filename: string) => Promise<string>;
  patchDocument: (id: string, fields: Record<string, unknown>) => Promise<void>;
  generateImage?: (request: ImageGenerationRequest) => Promise<Buffer>;
  reviewImage?: (request: ImageReviewRequest) => Promise<ImageReview>;
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  now?: () => Date;
}): Promise<ResearchImageAttachment[]> {
  if (input.documents.length === 0) return [];

  const result = await runResearchImageBackfill({
    dryRun: false,
    scope: "drafts_missing",
    maxImages: "ALL",
    regenerationMode: "missing_only",
    confirm: CONFIRM_RESEARCH_IMAGES,
    model: input.model,
    qaModel: input.qaModel,
    apiKey: input.apiKey,
    loadDocuments: async () => [...input.documents],
    uploadImage: input.uploadImage,
    patchDocument: input.patchDocument,
    generateImage: input.generateImage,
    reviewImage: input.reviewImage,
    fetchImpl: input.fetchImpl,
    sleep: input.sleep,
    now: input.now,
  });

  return input.documents.map((document) => attachmentFor(document, result.studies));
}

function attachmentFor(
  document: ResearchImageDocument,
  studies: readonly StudyRunResult[],
): ResearchImageAttachment {
  const pmid = document.pmid?.trim() || pmidFromDraftId(document._id);
  const study = studies.find(
    (item) => item.pmid === pmid || item.documents.some((entry) => entry.id === document._id),
  );
  if (!study) {
    return failedAttachment(document, pmid, "Image planning did not return this Research draft.");
  }

  const ownPatch = study.patches.find((patch) => patch.id === document._id);
  const generated = study.imageGeneration === "generated";
  const generationFailed = study.imageGeneration === "failed";
  const patchFailed = ownPatch?.status === "failed";
  const attached = ownPatch?.status === "patched" && ownPatch.kind === "image";
  const altCreated = Boolean(ownPatch?.status === "patched" && ownPatch.alt.trim());
  const skippedExisting =
    study.action === "skip_existing_image" || study.action === "reuse_existing_asset";

  if (generationFailed || patchFailed) {
    return {
      pmid,
      draftId: document._id,
      status: "failed",
      assetRef: study.assetRef,
      error: ownPatch?.error || study.error || "Research image generation failed.",
      generationAttempted: study.action === "generate_image" || generated || generationFailed,
      generated,
      generationFailed: true,
      uploadsAttempted: study.assetRef ? 1 : 0,
      uploadsCompleted: study.assetRef ? 1 : 0,
      englishAttached: false,
      englishAltCreated: false,
    };
  }

  if (skippedExisting && !generated) {
    return {
      pmid,
      draftId: document._id,
      status: "skipped_existing",
      assetRef: study.assetRef,
      error: "",
      generationAttempted: false,
      generated: false,
      generationFailed: false,
      uploadsAttempted: 0,
      uploadsCompleted: 0,
      englishAttached: false,
      englishAltCreated: altCreated,
    };
  }

  if (generated && attached) {
    return {
      pmid,
      draftId: document._id,
      status: "generated",
      assetRef: study.assetRef,
      error: "",
      generationAttempted: true,
      generated: true,
      generationFailed: false,
      uploadsAttempted: 1,
      uploadsCompleted: study.assetRef ? 1 : 0,
      englishAttached: true,
      englishAltCreated: altCreated,
    };
  }

  return failedAttachment(
    document,
    pmid,
    study.error || study.reason || "Research image generation did not attach an image.",
  );
}

function failedAttachment(
  document: ResearchImageDocument,
  pmid: string,
  error: string,
): ResearchImageAttachment {
  return {
    pmid,
    draftId: document._id,
    status: "failed",
    assetRef: null,
    error,
    generationAttempted: true,
    generated: false,
    generationFailed: true,
    uploadsAttempted: 0,
    uploadsCompleted: 0,
    englishAttached: false,
    englishAltCreated: false,
  };
}

function pmidFromDraftId(id: string): string {
  const match = id.match(/(\d{1,9})$/);
  return match?.[1] ?? "";
}
