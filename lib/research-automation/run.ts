import { hasContent, type ResearchDraftSnapshot } from "../research-enrichment/apply";
import type { EnrichmentSummary } from "../research-enrichment/run";
import type { DiscoveryDraftRef, DiscoverySummary } from "../research-discovery/run";
import type { TranslationRunSummary } from "../translation/run";
import type { EnglishDocument } from "../translation/types";

export type AutomationStudyReport = {
  pmid: string;
  title: string;
  englishDraftId: string;
  aiEnrichmentStatus: string;
  hebrewDraftId?: string;
  translationStatus?: string;
  translationReviewWarnings: string[];
  note: string;
};

export type ResearchAutomationReport = {
  dryRun: boolean;
  discovered: number;
  rejected: number;
  reviewCandidates: number;
  eligible: number;
  existing: number;
  englishDraftsCreated: number;
  enrichedSuccessfully: number;
  enrichmentFailed: number;
  hebrewDraftsCreated: number;
  translationFailed: number;
  published: 0;
  withheldByLimit: number;
  studies: AutomationStudyReport[];
};

export type TranslationSource = {
  document: EnglishDocument;
  aiEnrichmentStatus: string;
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
  const studies = summary.wouldCreate.map((draft) => ({
    pmid: draft.pmid,
    title: draft.title,
    englishDraftId: draft.draftId,
    aiEnrichmentStatus: "not_run",
    translationReviewWarnings: [],
    note: "Dry-run. This study would be created, enriched, and then considered for Hebrew translation. Nothing was written.",
  }));
  for (const draft of summary.withheldByLimit) {
    studies.push({
      pmid: draft.pmid,
      title: draft.title,
      englishDraftId: draft.draftId,
      aiEnrichmentStatus: "not_run",
      translationReviewWarnings: [],
      note: "Dry-run. Past the scheduled create limit. Nothing was written.",
    });
  }

  return {
    dryRun: true,
    discovered: summary.pubmedRecordsFound,
    rejected: summary.rejected,
    reviewCandidates: summary.reviewCandidates,
    eligible: summary.wouldCreate.length + summary.withheldByLimit.length,
    existing: summary.duplicatesSkipped,
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
 * Enrich and translate only the English drafts this run just created.
 * A failed later stage does not delete the English draft and does not stop the batch.
 */
export async function automateCreatedResearchDrafts(input: {
  created: readonly DiscoveryDraftRef[];
  loadDrafts: (pmids: string[]) => Promise<ResearchDraftSnapshot[]>;
  enrich: (drafts: ResearchDraftSnapshot[]) => Promise<EnrichmentSummary>;
  reloadDrafts: (pmids: string[]) => Promise<ResearchDraftSnapshot[]>;
  loadTranslationSource: (draftId: string) => Promise<EnglishDocument>;
  translate: (sources: readonly TranslationSource[]) => Promise<TranslationRunSummary>;
}): Promise<
  Pick<
    ResearchAutomationReport,
    | "enrichedSuccessfully"
    | "enrichmentFailed"
    | "hebrewDraftsCreated"
    | "translationFailed"
    | "studies"
  >
> {
  const studies: AutomationStudyReport[] = input.created.map((draft) => ({
    pmid: draft.pmid,
    title: draft.title,
    englishDraftId: draft.draftId,
    aiEnrichmentStatus: "not_run",
    translationReviewWarnings: [],
    note: "",
  }));
  const result = {
    enrichedSuccessfully: 0,
    enrichmentFailed: 0,
    hebrewDraftsCreated: 0,
    translationFailed: 0,
    studies,
  };
  if (input.created.length === 0) return result;

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
        note: `Enrichment result could not be read. The English draft was kept. ${messageOf(error)}`,
      });
      result.enrichmentFailed += 1;
    }
    return result;
  }

  const reloadedByPmid = new Map(reloaded.map((draft) => [draft.pmid, draft]));
  const sources: TranslationSource[] = [];

  for (const created of input.created) {
    if (missing.some((draft) => draft.pmid === created.pmid)) continue;
    const outcome = enrichment.pmidResults.find((item) => item.pmid === created.pmid);
    const draft = reloadedByPmid.get(created.pmid);
    const status =
      draft?.aiEnrichmentStatus?.trim() ||
      (outcome?.outcome === "failed" ? "failed" : "");
    if (outcome?.outcome === "failed" || status === "failed") {
      result.enrichmentFailed += 1;
      mark(result, created.pmid, {
        aiEnrichmentStatus: status || "failed",
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
        note: decision.reason,
      });
      continue;
    }

    result.enrichedSuccessfully += 1;
    try {
      const document = await input.loadTranslationSource(created.draftId);
      sources.push({ document, aiEnrichmentStatus: status });
      mark(result, created.pmid, {
        aiEnrichmentStatus: status,
        note: decision.reason,
      });
    } catch (error) {
      result.translationFailed += 1;
      mark(result, created.pmid, {
        aiEnrichmentStatus: status,
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
    | "enrichedSuccessfully"
    | "enrichmentFailed"
    | "hebrewDraftsCreated"
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
    enrichedSuccessfully: automation.enrichedSuccessfully,
    enrichmentFailed: automation.enrichmentFailed,
    hebrewDraftsCreated: automation.hebrewDraftsCreated,
    translationFailed: automation.translationFailed,
    published: 0,
    withheldByLimit: discovery.withheldByLimit.length,
    studies: [
      ...automation.studies,
      ...discovery.withheldByLimit.map((draft) => ({
        pmid: draft.pmid,
        title: draft.title,
        englishDraftId: draft.draftId,
        aiEnrichmentStatus: "not_run",
        translationReviewWarnings: [],
        note: "Past the scheduled create limit. No draft was created.",
      })),
    ],
  };
}

export function formatResearchAutomationReport(report: ResearchAutomationReport): string {
  const lines = [
    "Research Automation",
    "",
    `Discovered: ${report.discovered}`,
    `Rejected: ${report.rejected}`,
    `Review candidates: ${report.reviewCandidates}`,
    `Eligible: ${report.eligible}`,
    `Existing: ${report.existing}`,
    `English drafts created: ${report.englishDraftsCreated}`,
    `Enriched successfully: ${report.enrichedSuccessfully}`,
    `Enrichment failed: ${report.enrichmentFailed}`,
    `Hebrew drafts created: ${report.hebrewDraftsCreated}`,
    `Translation failed: ${report.translationFailed}`,
    "Published: 0",
  ];

  if (report.dryRun) {
    lines.push(
      `Would create English drafts: ${report.studies.filter((study) => study.note.startsWith("Dry-run. This study")).length}`,
      `Would enrich: ${report.studies.filter((study) => study.note.startsWith("Dry-run. This study")).length}`,
      `Would create Hebrew drafts: ${report.studies.filter((study) => study.note.startsWith("Dry-run. This study")).length}`,
      "Dry-run does not call the enrichment or translation models and does not write.",
    );
  }
  if (report.withheldByLimit > 0) {
    lines.push(`Deferred over create limit: ${report.withheldByLimit}`);
  }

  for (const study of report.studies) {
    lines.push(
      "",
      `PMID: ${study.pmid}`,
      `Title: ${study.title}`,
      `English draft id: ${study.englishDraftId}`,
      `AI enrichment status: ${study.aiEnrichmentStatus}`,
      `Hebrew draft id: ${study.hebrewDraftId ?? "(not created)"}`,
      `Translation status: ${study.translationStatus ?? "(not created)"}`,
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
    study.note = `Enrichment failed. The English draft was kept. ${message}`;
    result.enrichmentFailed += 1;
  }
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
