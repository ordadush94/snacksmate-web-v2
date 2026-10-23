import { hasContent, type ResearchDraftSnapshot } from "../research-enrichment/apply";
import type { EnrichmentSummary } from "../research-enrichment/run";
import type { DiscoveryDraftRef, DiscoverySummary } from "../research-discovery/run";
import type { TranslationRunSummary } from "../translation/run";
import type { EnglishDocument } from "../translation/types";

export type ResearchImageStepStatus =
  | "not_run"
  | "not_eligible"
  | "skipped_existing"
  | "generated"
  | "failed";

export type ResearchImageAttachment = {
  pmid: string;
  draftId: string;
  status: ResearchImageStepStatus;
  assetRef: string | null;
  error: string;
  generationAttempted: boolean;
  generated: boolean;
  generationFailed: boolean;
  uploadsAttempted: number;
  uploadsCompleted: number;
  englishAttached: boolean;
  englishAltCreated: boolean;
};

export type AutomationStudyReport = {
  pmid: string;
  title: string;
  englishDraftId: string;
  aiEnrichmentStatus: string;
  hebrewDraftId?: string;
  translationStatus?: string;
  translationReviewWarnings: string[];
  note: string;
  imageStatus: ResearchImageStepStatus;
  sanityAssetAttached: boolean;
  assetRef: string | null;
  englishAltCreated: boolean;
  hebrewImageReused: boolean;
  hebrewAltCreated: boolean;
  imageFailure: string;
};

export type ResearchAutomationReport = {
  dryRun: boolean;
  discovered: number;
  rejected: number;
  reviewCandidates: number;
  eligible: number;
  existing: number;
  englishDraftsCreated: number;
  enrichmentAttempted: number;
  enrichedSuccessfully: number;
  enrichmentFailed: number;
  imageEligible: number;
  imageGenerationAttempted: number;
  imageGenerated: number;
  imageGenerationFailed: number;
  sanityImageUploadsAttempted: number;
  sanityImageUploadsCompleted: number;
  englishImageAttached: number;
  englishAltCreated: number;
  hebrewDraftsCreated: number;
  hebrewImageAssetReused: number;
  hebrewAltCreated: number;
  translationFailed: number;
  published: 0;
  withheldByLimit: number;
  /**
   * Report label for a manual GitHub Actions full-automation run.
   * It does not change discovery, enrichment, translation, or publishing.
   */
  manualFullAutomation?: boolean;
  /** Create cap printed for a manual full-automation run. */
  maxCreates?: number;
  studies: AutomationStudyReport[];
};

export type TranslationSource = {
  document: EnglishDocument;
  aiEnrichmentStatus: string;
  assetRef: string | null;
};

/**
 * Hebrew localization runs only after enrichment stored a usable summary.
 * failed and unfinished enrichment never translate.
 * needs_review may translate when the excerpt exists; review notes stay on the draft.
 */
export function canTranslateEnrichedResearch(draft: {
  aiEnrichmentStatus?: string | null;
  excerpt?: unknown;
}): { translate: boolean; reason: string } {
  const status = draft.aiEnrichmentStatus?.trim() ?? "";
  if (status === "failed") {
    return {
      translate: false,
      reason: "aiEnrichmentStatus is failed. The English draft was kept and was not translated.",
    };
  }
  if (status !== "completed" && status !== "needs_review") {
    return {
      translate: false,
      reason: status
        ? `aiEnrichmentStatus is ${status}. Hebrew translation waits until enrichment finishes. The English draft was kept.`
        : "Enrichment did not finish. The English draft was kept and was not translated.",
    };
  }
  if (!hasContent(draft.excerpt)) {
    return {
      translate: false,
      reason: `aiEnrichmentStatus is ${status}, but the excerpt required for translation is empty. The English draft was kept.`,
    };
  }
  if (status === "needs_review") {
    return {
      translate: true,
      reason:
        "aiEnrichmentStatus is needs_review and the summary fields exist. Translation review notes are preserved.",
    };
  }
  return { translate: true, reason: "aiEnrichmentStatus is completed." };
}

export function projectDiscoveryReport(summary: DiscoverySummary): ResearchAutomationReport {
  const studies = summary.wouldCreate.map((draft) =>
    studyShell(draft, {
      note: "Dry-run. This study would be created, enriched, illustrated, and then considered for Hebrew translation. Nothing was written.",
    }),
  );
  for (const draft of summary.withheldByLimit) {
    studies.push(
      studyShell(draft, {
        note: "Dry-run. Past the scheduled create limit. Nothing was written.",
      }),
    );
  }

  return {
    dryRun: true,
    discovered: summary.pubmedRecordsFound,
    rejected: summary.rejected,
    reviewCandidates: summary.reviewCandidates,
    eligible: summary.wouldCreate.length + summary.withheldByLimit.length,
    existing: summary.duplicatesSkipped,
    ...emptyImageCounters(),
    englishDraftsCreated: 0,
    enrichedSuccessfully: 0,
    enrichmentFailed: 0,
    hebrewDraftsCreated: 0,
    translationFailed: 0,
    published: 0,
    withheldByLimit: summary.withheldByLimit.length,
    studies,
  };
}

/**
 * Enrich, illustrate, and translate only the English drafts this run just created.
 * Image generation runs after enrichment and before Hebrew localization.
 * A failed later stage does not delete the English draft and does not stop the batch.
 */
export async function automateCreatedResearchDrafts(input: {
  created: readonly DiscoveryDraftRef[];
  loadDrafts: (pmids: string[]) => Promise<ResearchDraftSnapshot[]>;
  enrich: (drafts: ResearchDraftSnapshot[]) => Promise<EnrichmentSummary>;
  reloadDrafts: (pmids: string[]) => Promise<ResearchDraftSnapshot[]>;
  /**
   * Creates one Research cover for each enriched draft that does not already
   * have mainImage. Implementations must not publish and must not scan the
   * historical library.
   */
  attachImages?: (
    studies: readonly { pmid: string; draftId: string }[],
  ) => Promise<readonly ResearchImageAttachment[]>;
  loadTranslationSource: (draftId: string) => Promise<EnglishDocument>;
  translate: (sources: readonly TranslationSource[]) => Promise<TranslationRunSummary>;
}): Promise<
  Pick<
    ResearchAutomationReport,
    | "enrichmentAttempted"
    | "enrichedSuccessfully"
    | "enrichmentFailed"
    | "imageEligible"
    | "imageGenerationAttempted"
    | "imageGenerated"
    | "imageGenerationFailed"
    | "sanityImageUploadsAttempted"
    | "sanityImageUploadsCompleted"
    | "englishImageAttached"
    | "englishAltCreated"
    | "hebrewDraftsCreated"
    | "hebrewImageAssetReused"
    | "hebrewAltCreated"
    | "translationFailed"
    | "studies"
  >
> {
  const studies: AutomationStudyReport[] = input.created.map((draft) => studyShell(draft));
  const result = {
    ...emptyImageCounters(),
    enrichedSuccessfully: 0,
    enrichmentFailed: 0,
    hebrewDraftsCreated: 0,
    translationFailed: 0,
    studies,
  };
  if (input.created.length === 0) return result;
  result.enrichmentAttempted = input.created.length;

  const pmids = input.created.map((draft) => draft.pmid);
  let drafts: ResearchDraftSnapshot[];
  try {
    drafts = await input.loadDrafts(pmids);
  } catch (error) {
    failEnrichment(result, messageOf(error));
    return result;
  }

  const byPmid = new Map(drafts.map((draft) => [draft.pmid, draft]));
  const missing = input.created.filter((draft) => !byPmid.has(draft.pmid));
  for (const draft of missing) {
    mark(result, draft.pmid, {
      aiEnrichmentStatus: "failed",
      imageStatus: "not_eligible",
      note: "The new English draft could not be read for enrichment. It was not deleted.",
    });
    result.enrichmentFailed += 1;
  }

  const present = input.created.flatMap((draft) => {
    const loaded = byPmid.get(draft.pmid);
    return loaded ? [loaded] : [];
  });
  if (present.length === 0) return result;

  let enrichment: EnrichmentSummary;
  try {
    enrichment = await input.enrich(present);
  } catch (error) {
    for (const draft of present) {
      mark(result, draft.pmid, {
        aiEnrichmentStatus: "failed",
        imageStatus: "not_eligible",
        note: `Enrichment failed. The English draft was kept. ${messageOf(error)}`,
      });
      result.enrichmentFailed += 1;
    }
    return result;
  }

  let reloaded: ResearchDraftSnapshot[];
  try {
    reloaded = await input.reloadDrafts(pmids);
  } catch (error) {
    for (const draft of present) {
      mark(result, draft.pmid, {
        aiEnrichmentStatus: "failed",
        imageStatus: "not_eligible",
        note: `Enrichment result could not be read. The English draft was kept. ${messageOf(error)}`,
      });
      result.enrichmentFailed += 1;
    }
    return result;
  }

  const reloadedByPmid = new Map(reloaded.map((draft) => [draft.pmid, draft]));
  const ready: { pmid: string; draftId: string; status: string; reason: string }[] = [];

  for (const created of input.created) {
    if (missing.some((draft) => draft.pmid === created.pmid)) {
      mark(result, created.pmid, { imageStatus: "not_eligible" });
      continue;
    }
    const outcome = enrichment.pmidResults.find((item) => item.pmid === created.pmid);
    const draft = reloadedByPmid.get(created.pmid);
    const status =
      draft?.aiEnrichmentStatus?.trim() ||
      (outcome?.outcome === "failed" ? "failed" : "");
    if (outcome?.outcome === "failed" || status === "failed") {
      result.enrichmentFailed += 1;
      mark(result, created.pmid, {
        aiEnrichmentStatus: status || "failed",
        imageStatus: "not_eligible",
        note: "Enrichment failed. The English draft was kept and was not translated.",
      });
      continue;
    }

    const decision = canTranslateEnrichedResearch({
      aiEnrichmentStatus: status,
      excerpt: draft?.excerpt,
    });
    if (!decision.translate) {
      if (outcome?.outcome === "enriched") result.enrichedSuccessfully += 1;
      else result.enrichmentFailed += 1;
      mark(result, created.pmid, {
        aiEnrichmentStatus: status || "not_finished",
        imageStatus: "not_eligible",
        note: decision.reason,
      });
      continue;
    }

    result.enrichedSuccessfully += 1;
    result.imageEligible += 1;
    ready.push({
      pmid: created.pmid,
      draftId: created.draftId,
      status,
      reason: decision.reason,
    });
    mark(result, created.pmid, {
      aiEnrichmentStatus: status,
      note: decision.reason,
    });
  }

  if (ready.length > 0) {
    await attachImagesForReadyStudies(result, ready, input.attachImages);
  }

  const sources: TranslationSource[] = [];
  for (const created of ready) {
    try {
      const document = await input.loadTranslationSource(created.draftId);
      const assetRef = imageAssetRef(document);
      sources.push({ document, aiEnrichmentStatus: created.status, assetRef });
      mark(result, created.pmid, {
        assetRef,
        sanityAssetAttached: Boolean(assetRef),
      });
    } catch (error) {
      result.translationFailed += 1;
      mark(result, created.pmid, {
        note: `The English draft was kept. Hebrew translation did not start. ${messageOf(error)}`,
      });
    }
  }

  if (sources.length === 0) return result;

  let translation: TranslationRunSummary;
  try {
    translation = await input.translate(sources);
  } catch (error) {
    for (const source of sources) {
      result.translationFailed += 1;
      mark(result, pmidFromDraftId(source.document._id), {
        note: `Hebrew translation failed. The English draft was kept. ${messageOf(error)}`,
      });
    }
    return result;
  }

  for (const item of translation.items) {
    const study = result.studies.find((entry) => entry.englishDraftId === item.sourceId);
    if (!study) continue;
    if (item.outcome === "created") {
      result.hebrewDraftsCreated += 1;
      study.hebrewDraftId = item.draftId;
      study.translationStatus = item.translationStatus;
      study.translationReviewWarnings = warningLines(item.reviewNote);
      const source = sources.find((entry) => entry.document._id === item.sourceId);
      const sameAsset = Boolean(
        source?.assetRef && item.imageAssetRef && source.assetRef === item.imageAssetRef,
      );
      study.hebrewImageReused = sameAsset;
      study.hebrewAltCreated = Boolean(sameAsset && item.imageAlt?.trim());
      if (sameAsset) result.hebrewImageAssetReused += 1;
      if (study.hebrewAltCreated) result.hebrewAltCreated += 1;
      continue;
    }
    if (item.outcome === "failed") {
      result.translationFailed += 1;
      study.note = `Hebrew translation failed. The English draft was kept. ${item.message ?? ""}`.trim();
      continue;
    }
    if (item.outcome === "skipped") {
      study.note = `${study.note} Duplicate Hebrew translation was skipped.`.trim();
    }
  }

  return result;
}

export function combineAutomationReport(
  discovery: DiscoverySummary,
  automation: Pick<
    ResearchAutomationReport,
    | "enrichmentAttempted"
    | "enrichedSuccessfully"
    | "enrichmentFailed"
    | "imageEligible"
    | "imageGenerationAttempted"
    | "imageGenerated"
    | "imageGenerationFailed"
    | "sanityImageUploadsAttempted"
    | "sanityImageUploadsCompleted"
    | "englishImageAttached"
    | "englishAltCreated"
    | "hebrewDraftsCreated"
    | "hebrewImageAssetReused"
    | "hebrewAltCreated"
    | "translationFailed"
    | "studies"
  >,
): ResearchAutomationReport {
  return {
    dryRun: false,
    discovered: discovery.pubmedRecordsFound,
    rejected: discovery.rejected,
    reviewCandidates: discovery.reviewCandidates,
    eligible: discovery.createdDrafts.length + discovery.withheldByLimit.length,
    existing: discovery.duplicatesSkipped,
    englishDraftsCreated: discovery.createdDrafts.length,
    enrichmentAttempted: automation.enrichmentAttempted,
    enrichedSuccessfully: automation.enrichedSuccessfully,
    enrichmentFailed: automation.enrichmentFailed,
    imageEligible: automation.imageEligible,
    imageGenerationAttempted: automation.imageGenerationAttempted,
    imageGenerated: automation.imageGenerated,
    imageGenerationFailed: automation.imageGenerationFailed,
    sanityImageUploadsAttempted: automation.sanityImageUploadsAttempted,
    sanityImageUploadsCompleted: automation.sanityImageUploadsCompleted,
    englishImageAttached: automation.englishImageAttached,
    englishAltCreated: automation.englishAltCreated,
    hebrewDraftsCreated: automation.hebrewDraftsCreated,
    hebrewImageAssetReused: automation.hebrewImageAssetReused,
    hebrewAltCreated: automation.hebrewAltCreated,
    translationFailed: automation.translationFailed,
    published: 0,
    withheldByLimit: discovery.withheldByLimit.length,
    studies: [
      ...automation.studies,
      ...discovery.withheldByLimit.map((draft) =>
        studyShell(draft, {
          note: "Past the scheduled create limit. No draft was created.",
        }),
      ),
    ],
  };
}

export function formatResearchAutomationReport(report: ResearchAutomationReport): string {
  const lines = ["Research Automation", ""];

  if (report.manualFullAutomation) {
    lines.push(
      "Mode: manual full automation",
      `Max creates: ${report.maxCreates ?? ""}`,
      `Eligible: ${report.eligible}`,
      `Existing: ${report.existing}`,
      ...automationCounterLines(report),
      `Deferred: ${report.withheldByLimit}`,
      "Published: 0",
    );
  } else {
    lines.push(
      `Discovered: ${report.discovered}`,
      `Rejected: ${report.rejected}`,
      `Review candidates: ${report.reviewCandidates}`,
      `Eligible: ${report.eligible}`,
      `Existing: ${report.existing}`,
      ...automationCounterLines(report),
      "Published: 0",
    );

    if (report.dryRun) {
      lines.push(
        `Would create English drafts: ${report.studies.filter((study) => study.note.startsWith("Dry-run. This study")).length}`,
        `Would enrich: ${report.studies.filter((study) => study.note.startsWith("Dry-run. This study")).length}`,
        `Would create Hebrew drafts: ${report.studies.filter((study) => study.note.startsWith("Dry-run. This study")).length}`,
        "Dry-run does not call the enrichment, image, or translation models and does not write.",
      );
    }
    if (report.withheldByLimit > 0) {
      lines.push(`Deferred over create limit: ${report.withheldByLimit}`);
    }
  }

  for (const study of report.studies) {
    lines.push(
      "",
      `PMID: ${study.pmid}`,
      `Title: ${study.title}`,
      `English draft id: ${study.englishDraftId}`,
      `AI enrichment status: ${study.aiEnrichmentStatus}`,
      `Image status: ${study.imageStatus}`,
      `Sanity asset attached: ${study.sanityAssetAttached ? "yes" : "no"}`,
      `Hebrew draft id: ${study.hebrewDraftId ?? "(not created)"}`,
      `Translation status: ${study.translationStatus ?? "(not created)"}`,
      `Same image reused: ${study.hebrewImageReused ? "yes" : "no"}`,
      `Hebrew ALT created: ${study.hebrewAltCreated ? "yes" : "no"}`,
      `Image failure: ${study.imageFailure || "none"}`,
      "Translation review warnings:",
      ...(study.translationReviewWarnings.length > 0
        ? study.translationReviewWarnings.map((warning) => `- ${warning}`)
        : ["- none"]),
      `Note: ${study.note}`,
    );
  }

  return lines.join("\n");
}

function failEnrichment(
  result: { enrichmentFailed: number; studies: AutomationStudyReport[] },
  message: string,
) {
  for (const study of result.studies) {
    study.aiEnrichmentStatus = "failed";
    study.imageStatus = "not_eligible";
    study.note = `Enrichment failed. The English draft was kept. ${message}`;
    result.enrichmentFailed += 1;
  }
}

function automationCounterLines(report: ResearchAutomationReport): string[] {
  return [
    `Research created: ${report.englishDraftsCreated}`,
    `English drafts created: ${report.englishDraftsCreated}`,
    `Enrichment attempted: ${report.enrichmentAttempted}`,
    `Enriched successfully: ${report.enrichedSuccessfully}`,
    `Enrichment completed: ${report.enrichedSuccessfully}`,
    `Enrichment failed: ${report.enrichmentFailed}`,
    `Image eligible: ${report.imageEligible}`,
    `Image generation attempted: ${report.imageGenerationAttempted}`,
    `Image generated: ${report.imageGenerated}`,
    `Image generation failed: ${report.imageGenerationFailed}`,
    `Sanity image uploads attempted: ${report.sanityImageUploadsAttempted}`,
    `Sanity image uploads completed: ${report.sanityImageUploadsCompleted}`,
    `English image attached: ${report.englishImageAttached}`,
    `English ALT created: ${report.englishAltCreated}`,
    `Hebrew drafts created: ${report.hebrewDraftsCreated}`,
    `Image asset reused in Hebrew: ${report.hebrewImageAssetReused}`,
    `Hebrew ALT created: ${report.hebrewAltCreated}`,
    `Translation failed: ${report.translationFailed}`,
  ];
}

function emptyImageCounters() {
  return {
    enrichmentAttempted: 0,
    imageEligible: 0,
    imageGenerationAttempted: 0,
    imageGenerated: 0,
    imageGenerationFailed: 0,
    sanityImageUploadsAttempted: 0,
    sanityImageUploadsCompleted: 0,
    englishImageAttached: 0,
    englishAltCreated: 0,
    hebrewImageAssetReused: 0,
    hebrewAltCreated: 0,
  };
}

function studyShell(
  draft: { pmid: string; title: string; draftId: string },
  extra: Partial<AutomationStudyReport> = {},
): AutomationStudyReport {
  return {
    pmid: draft.pmid,
    title: draft.title,
    englishDraftId: draft.draftId,
    aiEnrichmentStatus: "not_run",
    translationReviewWarnings: [],
    note: "",
    imageStatus: "not_run",
    sanityAssetAttached: false,
    assetRef: null,
    englishAltCreated: false,
    hebrewImageReused: false,
    hebrewAltCreated: false,
    imageFailure: "",
    ...extra,
  };
}

async function attachImagesForReadyStudies(
  result: {
    imageGenerationAttempted: number;
    imageGenerated: number;
    imageGenerationFailed: number;
    sanityImageUploadsAttempted: number;
    sanityImageUploadsCompleted: number;
    englishImageAttached: number;
    englishAltCreated: number;
    studies: AutomationStudyReport[];
  },
  ready: readonly { pmid: string; draftId: string }[],
  attachImages:
    | ((
        studies: readonly { pmid: string; draftId: string }[],
      ) => Promise<readonly ResearchImageAttachment[]>)
    | undefined,
) {
  if (!attachImages) {
    for (const study of ready) {
      mark(result, study.pmid, {
        imageStatus: "not_run",
        imageFailure: "Image generation was not run.",
      });
    }
    return;
  }

  let attachments: readonly ResearchImageAttachment[];
  try {
    attachments = await attachImages(ready.map(({ pmid, draftId }) => ({ pmid, draftId })));
  } catch (error) {
    const message = messageOf(error);
    for (const study of ready) {
      mark(result, study.pmid, { imageStatus: "failed", imageFailure: message });
      result.imageGenerationAttempted += 1;
      result.imageGenerationFailed += 1;
    }
    return;
  }

  const byPmid = new Map(attachments.map((item) => [item.pmid, item]));
  for (const study of ready) {
    const attachment = byPmid.get(study.pmid);
    if (!attachment) {
      mark(result, study.pmid, {
        imageStatus: "failed",
        imageFailure: "Image generation did not report this study.",
      });
      result.imageGenerationAttempted += 1;
      result.imageGenerationFailed += 1;
      continue;
    }
    applyImageAttachment(result, attachment);
  }
}

function applyImageAttachment(
  result: {
    imageGenerationAttempted: number;
    imageGenerated: number;
    imageGenerationFailed: number;
    sanityImageUploadsAttempted: number;
    sanityImageUploadsCompleted: number;
    englishImageAttached: number;
    englishAltCreated: number;
    studies: AutomationStudyReport[];
  },
  attachment: ResearchImageAttachment,
) {
  mark(result, attachment.pmid, {
    imageStatus: attachment.status,
    assetRef: attachment.assetRef,
    imageFailure: attachment.error,
    englishAltCreated: attachment.englishAltCreated,
    sanityAssetAttached: Boolean(attachment.assetRef) && attachment.status !== "failed",
  });
  if (attachment.generationAttempted) result.imageGenerationAttempted += 1;
  if (attachment.generated) result.imageGenerated += 1;
  if (attachment.generationFailed) result.imageGenerationFailed += 1;
  result.sanityImageUploadsAttempted += attachment.uploadsAttempted;
  result.sanityImageUploadsCompleted += attachment.uploadsCompleted;
  if (attachment.englishAttached) result.englishImageAttached += 1;
  if (attachment.englishAltCreated) result.englishAltCreated += 1;
}

function imageAssetRef(document: EnglishDocument): string | null {
  const ref = document.mainImage?.asset?._ref?.trim() || "";
  return ref || null;
}

function mark(
  result: { studies: AutomationStudyReport[] },
  pmid: string,
  update: Partial<AutomationStudyReport>,
) {
  const study = result.studies.find((entry) => entry.pmid === pmid);
  if (!study) return;
  Object.assign(study, update);
}

function warningLines(note: string | undefined): string[] {
  if (!note?.trim()) return [];
  return note
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function pmidFromDraftId(id: string): string {
  const match = id.match(/drafts\.research-pubmed-(\d{1,9})$/);
  return match?.[1] ?? "";
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : "unknown error";
}
