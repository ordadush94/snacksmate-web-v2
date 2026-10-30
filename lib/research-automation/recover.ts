import { draftIdForPmid } from "../research-discovery/normalize";
import { publishedDocumentId } from "../research-images/group";
import { hebrewDraftId } from "../translation/document";
import { canTranslateEnrichedResearch } from "./run";

/**
 * Explicit recovery targets after PMID 42948631 completed.
 * 42948631 is intentionally absent.
 */
export const RECOVERY_PMIDS = ["42925061", "42923131"] as const;

export type RecoveryDraftRef = {
  pmid: string;
  draftId: string;
  title: string;
};

export type RecoveryCandidate = {
  pmid?: string | null;
  _id?: string | null;
  language?: string | null;
  title?: string | null;
};

export type SanityDocumentState = "draft" | "published" | "draft overlay";

export type RecoveryDocument = {
  _id: string;
  pmid: string;
  language: string;
  title: string;
  aiEnrichmentStatus: string;
  editorialStatus: string;
  translationStatus: string;
  publishedAt: string;
  excerpt: unknown;
  asset: string;
  alt: string;
};

export type RecoveryStudy = {
  pmid: string;
  documents: readonly RecoveryDocument[];
};

export type RecoveryPlan = {
  pmid: string;
  englishDraftId: string | null;
  title: string;
  documentState: SanityDocumentState | "missing";
  publishedAtField: "present" | "absent";
  publishedCounterpart: "exists" | "missing";
  enrich: "skip" | "run";
  image: "skip_existing" | "attempt_once" | "not_eligible";
  hebrew: "skip_existing" | "create" | "blocked";
  hebrewDraftId: string | null;
  reason: string;
};

export type CoverAttachment = {
  ok: boolean;
  error: string;
};

export type RecoveryEffects = {
  enrich: (plan: RecoveryPlan) => Promise<void>;
  /** One cover attempt. Existing images are not passed here. */
  attachCover: (plan: RecoveryPlan) => Promise<CoverAttachment>;
  createHebrew: (plan: RecoveryPlan) => Promise<"created" | "skipped">;
};

export type RecoveryStudyResult = RecoveryPlan & {
  enrichment: "skip" | "would_run" | "completed" | "failed";
  imageResult: "skip_existing" | "would_attempt_once" | "attached" | "failed" | "not_eligible";
  hebrewResult: "skip_existing" | "would_create" | "created" | "failed" | "blocked";
  imageError: string;
};

export type RecoveryExecution = {
  dryRun: boolean;
  openAiCalls: number;
  imageGenerationAttempts: number;
  imageQaCalls: number;
  sanityWrites: number;
  assetsUploaded: number;
  hebrewDraftsCreated: number;
  published: 0;
  requiredFailures: number;
  studies: RecoveryStudyResult[];
};

/**
 * Missing args and --dry-run are dry runs.
 * Live recovery requires an explicit --write.
 */
export function parseRecoveryArgs(argv: readonly string[]): { dryRun: boolean } {
  let write = false;
  let dry = false;
  for (const arg of argv) {
    if (arg === "--dry-run") {
      dry = true;
      continue;
    }
    if (arg === "--write") {
      write = true;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }
  if (write && dry) {
    throw new Error("Pass either --dry-run or --write, not both.");
  }
  return { dryRun: !write };
}

/**
 * A drafts.* id is a draft even when publishedAt is populated.
 * A published counterpart is a different document whose id has no drafts. prefix.
 */
export function classifyResearchDocument(input: {
  id: string;
  publishedAt: string;
  publishedCounterpartExists: boolean;
}): {
  documentState: SanityDocumentState;
  publishedAtField: "present" | "absent";
  publishedCounterpart: "exists" | "missing";
} {
  const publishedAtField = input.publishedAt.trim() ? "present" : "absent";
  const publishedCounterpart = input.publishedCounterpartExists ? "exists" : "missing";
  if (input.id.startsWith("drafts.")) {
    return {
      documentState: input.publishedCounterpartExists ? "draft overlay" : "draft",
      publishedAtField,
      publishedCounterpart,
    };
  }
  return {
    documentState: "published",
    publishedAtField,
    publishedCounterpart,
  };
}

export function selectRecoveryDrafts(rows: readonly RecoveryCandidate[]): RecoveryDraftRef[] {
  return RECOVERY_PMIDS.flatMap((pmid) => {
    const draftId = draftIdForPmid(pmid);
    const row = rows.find(
      (item) => item._id === draftId && item.pmid === pmid && item.language === "en",
    );
    if (!row) return [];
    const title = row.title?.trim();
    return [{ pmid, draftId, title: title || pmid }];
  });
}

export function planResearchRecovery(studies: readonly RecoveryStudy[]): RecoveryPlan[] {
  return RECOVERY_PMIDS.map((pmid) => planOne(pmid, studies.find((study) => study.pmid === pmid)?.documents ?? []));
}

/**
 * Dry-run reads the plan and does not call enrichment, image generation,
 * image QA, Sanity writes, asset upload, or Hebrew creation.
 * Live recovery calls each effect at most once per study.
 */
export async function executeResearchRecovery(input: {
  dryRun: boolean;
  studies: readonly RecoveryStudy[];
  effects: RecoveryEffects;
}): Promise<RecoveryExecution> {
  const plans = planResearchRecovery(input.studies);
  const result: RecoveryExecution = {
    dryRun: input.dryRun,
    openAiCalls: 0,
    imageGenerationAttempts: 0,
    imageQaCalls: 0,
    sanityWrites: 0,
    assetsUploaded: 0,
    hebrewDraftsCreated: 0,
    published: 0,
    requiredFailures: 0,
    studies: [],
  };

  for (const plan of plans) {
    if (input.dryRun) {
      result.studies.push(dryStudy(plan));
      continue;
    }
    result.studies.push(await runLiveStudy(plan, input.effects, result));
  }

  return result;
}

export function recoveryExitCode(result: RecoveryExecution): 0 | 1 {
  if (result.dryRun) return 0;
  return result.requiredFailures > 0 ? 1 : 0;
}

export function formatRecoveryReport(result: RecoveryExecution): string {
  const lines = [
    `Recovery dry_run: ${result.dryRun ? "true" : "false"}`,
    `Recovery targets: ${RECOVERY_PMIDS.join(", ")}`,
    "PMID 42948631 touched: no",
    result.dryRun ? "Recovery dry-run plan" : "Recovery live result",
    "PubMed discovery is not run. English drafts are not created.",
    `OpenAI calls: ${result.openAiCalls}`,
    `Image generation attempts: ${result.imageGenerationAttempts}`,
    `Image QA calls: ${result.imageQaCalls}`,
    `Sanity writes: ${result.sanityWrites}`,
    `Assets uploaded: ${result.assetsUploaded}`,
    `Hebrew drafts created: ${result.hebrewDraftsCreated}`,
    "Published: 0",
    "",
  ];

  for (const study of result.studies) {
    lines.push(
      `PMID ${study.pmid}`,
      `English draft: ${study.englishDraftId ?? "missing"}`,
      `document state: ${study.documentState}`,
      `publishedAt field: ${study.publishedAtField}`,
      `published counterpart: ${study.publishedCounterpart}`,
      `enrichment result: ${study.enrichment}`,
      `image result: ${study.imageResult}${study.imageError ? ` (${study.imageError})` : ""}`,
      `image QA result: ${imageQaLabel(study.imageResult)}`,
      `Hebrew result: ${study.hebrewResult}`,
      `Hebrew draft id: ${study.hebrewDraftId ?? "missing"}`,
      `Note: ${study.reason}`,
      "",
    );
  }

  return lines.join("\n").trimEnd();
}

function imageQaLabel(imageResult: RecoveryStudyResult["imageResult"]): string {
  if (imageResult === "attached") return "passed";
  if (imageResult === "failed") return "failed";
  return "not_run";
}

function planOne(pmid: string, documents: readonly RecoveryDocument[]): RecoveryPlan {
  const englishId = draftIdForPmid(pmid);
  const english = documents.find((document) => document._id === englishId && document.language === "en");
  const publishedId = publishedDocumentId(englishId);
  const publishedCounterpartExists = documents.some((document) => document._id === publishedId);
  const hebrewId = hebrewDraftId("research", englishId);
  const hebrew = documents.find((document) => document._id === hebrewId && document.language === "he");

  if (!english) {
    return {
      pmid,
      englishDraftId: null,
      title: "",
      documentState: "missing",
      publishedAtField: "absent",
      publishedCounterpart: publishedCounterpartExists ? "exists" : "missing",
      enrich: "skip",
      image: "not_eligible",
      hebrew: "blocked",
      hebrewDraftId: hebrew?._id ?? null,
      reason: `English draft ${englishId} was not found. It was not created.`,
    };
  }

  const classification = classifyResearchDocument({
    id: english._id,
    publishedAt: english.publishedAt,
    publishedCounterpartExists,
  });
  const translation = canTranslateEnrichedResearch(english);
  const enrich = hebrew || translation.translate ? "skip" : "run";
  const image = english.asset.trim() || hebrew ? "skip_existing" : "attempt_once";
  let hebrewAction: RecoveryPlan["hebrew"] = "blocked";
  let reason = translation.reason;
  if (hebrew) {
    hebrewAction = "skip_existing";
    reason = "Hebrew draft already exists. It was not created again, and the English cover was not regenerated.";
  } else if (translation.translate || enrich === "run") {
    hebrewAction = "create";
    if (!translation.translate) {
      reason = "Enrichment runs first. One image attempt follows only when mainImage is missing. Hebrew localization still runs if enrichment succeeds.";
    } else if (!english.asset.trim()) {
      reason = `${translation.reason} mainImage is absent. One image attempt runs, and Hebrew is still created if that attempt fails.`;
    } else {
      reason = `${translation.reason} The existing image is preserved and is not regenerated.`;
    }
  }

  return {
    pmid,
    englishDraftId: english._id,
    title: english.title.trim() || pmid,
    ...classification,
    enrich,
    image,
    hebrew: hebrewAction,
    hebrewDraftId: hebrew?._id ?? (hebrewAction === "create" ? hebrewId : null),
    reason,
  };
}

function dryStudy(plan: RecoveryPlan): RecoveryStudyResult {
  return {
    ...plan,
    enrichment: plan.enrich === "run" ? "would_run" : "skip",
    imageResult: plan.image === "attempt_once" ? "would_attempt_once" : plan.image,
    hebrewResult:
      plan.hebrew === "create" ? "would_create" : plan.hebrew === "skip_existing" ? "skip_existing" : "blocked",
    imageError: "",
  };
}

async function runLiveStudy(
  plan: RecoveryPlan,
  effects: RecoveryEffects,
  result: RecoveryExecution,
): Promise<RecoveryStudyResult> {
  const study: RecoveryStudyResult = {
    ...plan,
    enrichment: plan.enrich === "run" ? "failed" : "skip",
    imageResult: plan.image === "attempt_once" ? "failed" : plan.image,
    hebrewResult: plan.hebrew === "create" ? "failed" : plan.hebrew === "skip_existing" ? "skip_existing" : "blocked",
    imageError: "",
  };

  if (!plan.englishDraftId || plan.hebrew === "blocked" && plan.enrich !== "run") {
    if (!plan.englishDraftId) result.requiredFailures += 1;
    return study;
  }

  if (plan.enrich === "run") {
    try {
      await effects.enrich(plan);
      result.openAiCalls += 1;
      result.sanityWrites += 1;
      study.enrichment = "completed";
    } catch (error) {
      study.enrichment = "failed";
      study.imageResult = "not_eligible";
      study.hebrewResult = "blocked";
      study.reason = error instanceof Error ? error.message : "Enrichment failed.";
      result.requiredFailures += 1;
      return study;
    }
  }

  if (plan.image === "attempt_once") {
    result.imageGenerationAttempts += 1;
    result.imageQaCalls += 1;
    try {
      const attachment = await effects.attachCover(plan);
      if (attachment.ok) {
        result.assetsUploaded += 1;
        result.sanityWrites += 1;
        study.imageResult = "attached";
      } else {
        study.imageResult = "failed";
        study.imageError = attachment.error || "Image QA failed. The English draft was kept without mainImage.";
      }
    } catch (error) {
      study.imageResult = "failed";
      study.imageError = error instanceof Error ? error.message : "Image generation failed.";
    }
  }

  if (plan.hebrew === "skip_existing") return study;
  if (plan.hebrew !== "create") return study;

  try {
    const outcome = await effects.createHebrew(plan);
    if (outcome === "created") {
      result.hebrewDraftsCreated += 1;
      result.openAiCalls += 1;
      result.sanityWrites += 1;
      study.hebrewResult = "created";
    } else {
      study.hebrewResult = "skip_existing";
    }
  } catch (error) {
    study.hebrewResult = "failed";
    study.reason = error instanceof Error ? error.message : "Hebrew localization failed.";
    result.requiredFailures += 1;
  }

  return study;
}
