import { buildHebrewDraft, formatTranslationReport, matchingHebrewLink } from "./document";
import { type FieldRepairRequest, type RefinementReport, refineTranslationOnce } from "./refine";
import { TranslationValidationError } from "./schema";
import type { EnglishDocument, HebrewDraft, HebrewLink, HebrewTranslation } from "./types";

export type TranslationItemResult = {
  sourceId: string;
  outcome: "created" | "dry-run" | "skipped" | "failed";
  draftId?: string;
  translationStatus?: "needs_review";
  reviewNote?: string;
  message?: string;
};

export type TranslationRunSummary = {
  created: number;
  skipped: number;
  failed: number;
  dryRun: number;
  reports: string[];
  items: TranslationItemResult[];
};

export async function runHebrewTranslation(input: {
  dryRun: boolean;
  model: string;
  sources: readonly EnglishDocument[];
  existing: readonly HebrewLink[];
  translate: (source: EnglishDocument) => Promise<HebrewTranslation>;
  repair?: (request: FieldRepairRequest) => Promise<unknown>;
  writeDraft: (draft: HebrewDraft) => Promise<void>;
  /** Final duplicate check immediately before a Hebrew draft is created. */
  alreadyTranslated?: (source: EnglishDocument) => Promise<boolean>;
  now?: () => string;
  log?: (message: string) => void;
}): Promise<TranslationRunSummary> {
  const log = input.log ?? console.log;
  const now = input.now ?? (() => new Date().toISOString());
  const summary: TranslationRunSummary = {
    created: 0,
    skipped: 0,
    failed: 0,
    dryRun: 0,
    reports: [],
    items: [],
  };

  for (const source of input.sources) {
    const existing = matchingHebrewLink(source, input.existing);
    if (existing) {
      summary.skipped += 1;
      summary.items.push({
        sourceId: source._id,
        outcome: "skipped",
        draftId: existing._id,
        message: "Hebrew translation already exists.",
      });
      log(
        `Skipped ${source._id}. Hebrew translation already exists (${existing._id}). No duplicate was created.`,
      );
      continue;
    }

    try {
      const translatedAt = now();
      let translation = await input.translate(source);
      let refinement: RefinementReport = {
        triggered: false,
        warningsBefore: [],
        repairedFields: [],
        modelCallCompleted: false,
        fieldsReturned: [],
        warningsAfter: [],
        resolvedWarnings: [],
      };
      if (input.repair) {
        const repaired = await refineTranslationOnce({
          source,
          translation,
          model: input.model,
          translatedAt,
          repair: input.repair,
        });
        translation = repaired.translation;
        refinement = repaired.report;
      }
      const draft = buildHebrewDraft({
        source,
        translation,
        model: input.model,
        translatedAt,
      });
      const report = formatTranslationReport(source, draft, input.repair ? refinement : undefined);
      summary.reports.push(report);
      log(report);
      if (input.dryRun) {
        summary.dryRun += 1;
        summary.items.push(itemFromDraft(source._id, "dry-run", draft));
        log("Dry run: Sanity was not modified. Nothing was published.");
        continue;
      }
      if (input.alreadyTranslated && (await input.alreadyTranslated(source))) {
        summary.skipped += 1;
        summary.items.push({
          sourceId: source._id,
          outcome: "skipped",
          message: "Hebrew translation already exists.",
        });
        log(
          `Skipped ${source._id}. A Hebrew translation was found immediately before create. No duplicate was created.`,
        );
        continue;
      }
      await input.writeDraft(draft);
      summary.created += 1;
      summary.items.push(itemFromDraft(source._id, "created", draft));
      log(`Created unpublished Hebrew draft ${draft._id}. Nothing was published.`);
    } catch (error) {
      summary.failed += 1;
      const message =
        error instanceof TranslationValidationError || error instanceof Error
          ? error.message
          : "Hebrew localization failed.";
      summary.items.push({ sourceId: source._id, outcome: "failed", message });
      log(`Failed ${source._id}. ${message}`);
    }
  }

  return summary;
}

function itemFromDraft(
  sourceId: string,
  outcome: "created" | "dry-run",
  draft: HebrewDraft,
): TranslationItemResult {
  return {
    sourceId,
    outcome,
    draftId: draft._id,
    translationStatus: draft.translationStatus,
    reviewNote: draft.translationReviewNote,
  };
}
