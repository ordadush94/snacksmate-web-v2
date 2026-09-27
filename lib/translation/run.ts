import { buildHebrewDraft, formatTranslationReport, matchingHebrewLink } from "./document";
import { type FieldRepairRequest, type RefinementReport, refineTranslationOnce } from "./refine";
import { TranslationValidationError } from "./schema";
import type { EnglishDocument, HebrewDraft, HebrewLink, HebrewTranslation } from "./types";

export type TranslationRunSummary = {
  created: number;
  skipped: number;
  failed: number;
  dryRun: number;
  reports: string[];
};

export async function runHebrewTranslation(input: {
  dryRun: boolean;
  model: string;
  sources: readonly EnglishDocument[];
  existing: readonly HebrewLink[];
  translate: (source: EnglishDocument) => Promise<HebrewTranslation>;
  repair?: (request: FieldRepairRequest) => Promise<unknown>;
  writeDraft: (draft: HebrewDraft) => Promise<void>;
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
  };

  for (const source of input.sources) {
    const existing = matchingHebrewLink(source, input.existing);
    if (existing) {
      summary.skipped += 1;
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
        log("Dry run: Sanity was not modified. Nothing was published.");
        continue;
      }
      await input.writeDraft(draft);
      summary.created += 1;
      log(`Created unpublished Hebrew draft ${draft._id}. Nothing was published.`);
    } catch (error) {
      summary.failed += 1;
      const message =
        error instanceof TranslationValidationError || error instanceof Error
          ? error.message
          : "Hebrew localization failed.";
      log(`Failed ${source._id}. ${message}`);
    }
  }

  return summary;
}
