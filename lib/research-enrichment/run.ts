import { isRejectedEditorialStatus } from "../research-editorial/status";
import {
  abstractIsInsufficient,
  assertRunnableEnrichmentDraft,
  buildEnrichmentUpdate,
  buildInsufficientAbstractPlan,
  hasEnrichableGap,
  populatedFieldNames,
  type EnrichmentPlan,
  type EnrichmentSource,
  type ResearchDraftSnapshot,
} from "./apply";
import type { EnrichmentPromptInput } from "./prompt";
import { EnrichmentValidationError, parseEnrichmentOutput } from "./schema";

export type EnrichmentSummary = {
  dryRun: boolean;
  model: string;
  eligibleDrafts: number;
  inspected: number;
  aiCalls: number;
  enriched: number;
  proposedUpdates: number;
  skipped: number;
  failed: number;
  insufficientAbstracts: string[];
};

export type PubmedEnrichmentRecord = EnrichmentSource & {
  pmid: string;
  authors: string[];
  journal?: string;
  year?: number;
  publishedAt?: string;
  doi?: string;
};

export async function runResearchEnrichment(input: {
  dryRun: boolean;
  model: string;
  eligibleCount: number;
  drafts: ResearchDraftSnapshot[];
  fetchRecords: (pmids: string[]) => Promise<{
    records: PubmedEnrichmentRecord[];
    errors: { pmid?: string; message: string }[];
  }>;
  complete: (study: EnrichmentPromptInput) => Promise<unknown>;
  writeDraft: (id: string, fields: Record<string, unknown>) => Promise<void>;
  now?: () => string;
}): Promise<EnrichmentSummary> {
  const summary: EnrichmentSummary = {
    dryRun: input.dryRun,
    model: input.model,
    eligibleDrafts: input.eligibleCount,
    inspected: 0,
    aiCalls: 0,
    enriched: 0,
    proposedUpdates: 0,
    skipped: 0,
    failed: 0,
    insufficientAbstracts: [],
  };
  const now = input.now ?? (() => new Date().toISOString());

  console.log(
    `Eligible drafts not yet enriched: ${summary.eligibleDrafts}. Estimated AI calls for the current draft set: up to ${summary.eligibleDrafts} (one per draft; an insufficient abstract does not call the model).`,
  );
  console.log(
    input.dryRun
      ? "Mode: dry-run. Abstracts will be read and the model will be called. Sanity will not be modified."
      : "Mode: update existing drafts only. Nothing will be published.",
  );

  if (input.drafts.length === 0) {
    printSummary(summary);
    return summary;
  }

  const runnable: ResearchDraftSnapshot[] = [];
  for (const draft of input.drafts) {
    if (isRejectedEditorialStatus(draft.editorialStatus)) {
      summary.skipped += 1;
      console.log(
        `PMID ${draft.pmid}: skipped. Editorial status is rejected. The draft was not changed.`,
      );
      continue;
    }
    try {
      assertRunnableEnrichmentDraft(draft);
    } catch (error) {
      summary.failed += 1;
      console.error(
        `PMID ${draft.pmid}: ${errorMessage(error)} The document was not changed.`,
      );
      continue;
    }
    runnable.push(draft);
  }

  if (runnable.length === 0) {
    printSummary(summary);
    return summary;
  }

  const fetched = await input.fetchRecords(runnable.map((draft) => draft.pmid));
  const records = new Map(fetched.records.map((record) => [record.pmid, record]));
  for (const error of fetched.errors) {
    console.error(
      `PubMed record error${error.pmid ? ` for PMID ${error.pmid}` : ""}: ${error.message}`,
    );
  }

  for (const draft of runnable) {
    summary.inspected += 1;
    const record = records.get(draft.pmid);
    if (!record) {
      summary.failed += 1;
      console.error(`PMID ${draft.pmid}: PubMed did not return a record. The draft was not changed.`);
      continue;
    }

    try {
      await enrichOne({
        draft,
        record,
        dryRun: input.dryRun,
        model: input.model,
        enrichedAt: now(),
        complete: input.complete,
        writeDraft: input.writeDraft,
        summary,
      });
    } catch (error) {
      summary.failed += 1;
      console.error(`PMID ${draft.pmid}: ${errorMessage(error)} The draft was not changed.`);
    }
  }

  printSummary(summary);
  return summary;
}

async function enrichOne(input: {
  draft: ResearchDraftSnapshot;
  record: PubmedEnrichmentRecord;
  dryRun: boolean;
  model: string;
  enrichedAt: string;
  complete: (study: EnrichmentPromptInput) => Promise<unknown>;
  writeDraft: (id: string, fields: Record<string, unknown>) => Promise<void>;
  summary: EnrichmentSummary;
}) {
  if (abstractIsInsufficient(input.record.abstract)) {
    input.summary.insufficientAbstracts.push(input.draft.pmid);
    const plan = buildInsufficientAbstractPlan({
      draft: input.draft,
      model: input.model,
      enrichedAt: input.enrichedAt,
    });
    input.summary.proposedUpdates += 1;
    printPlan(plan, input.dryRun);
    await commitPlan(plan, input.dryRun, input.writeDraft, input.summary);
    return;
  }

  if (!hasEnrichableGap(input.draft)) {
    input.summary.skipped += 1;
    console.log(`PMID ${input.draft.pmid}: skipped. Public fields are already populated.`);
    return;
  }

  input.summary.aiCalls += 1;
  let raw: unknown;
  try {
    raw = await input.complete(promptFor(input.draft, input.record));
  } catch (error) {
    input.summary.failed += 1;
    console.error(
      `PMID ${input.draft.pmid}: AI call failed. ${errorMessage(error)} The draft was not changed.`,
    );
    return;
  }

  let extraction;
  try {
    extraction = parseEnrichmentOutput(raw);
  } catch (error) {
    if (!(error instanceof EnrichmentValidationError)) throw error;
    input.summary.failed += 1;
    console.error(
      `PMID ${input.draft.pmid}: AI response failed validation. ${error.message} The draft was not changed.`,
    );
    return;
  }

  const plan = buildEnrichmentUpdate({
    draft: input.draft,
    extraction,
    source: input.record,
    model: input.model,
    enrichedAt: input.enrichedAt,
  });
  if (plan.abstractInsufficient) {
    input.summary.insufficientAbstracts.push(input.draft.pmid);
  }
  input.summary.proposedUpdates += 1;
  printPlan(plan, input.dryRun);
  await commitPlan(plan, input.dryRun, input.writeDraft, input.summary);
}

function promptFor(
  draft: ResearchDraftSnapshot,
  record: PubmedEnrichmentRecord,
): EnrichmentPromptInput {
  return {
    title: record.title || draft.title || "",
    abstract: record.abstract,
    publicationTypes: record.publicationTypes,
    authors: record.authors,
    ...(record.journal ? { journal: record.journal } : {}),
    ...(record.year ? { publicationYear: record.year } : {}),
    ...(record.publishedAt ? { publicationDate: record.publishedAt } : {}),
    ...(record.doi ? { doi: record.doi } : {}),
    existing: {
      ...(draft.studyDesign ? { studyDesign: draft.studyDesign } : {}),
      ...(typeof draft.sampleSize === "number" ? { sampleSize: draft.sampleSize } : {}),
      ...(draft.duration ? { duration: draft.duration } : {}),
      ...(draft.comparator ? { comparator: draft.comparator } : {}),
      ...(draft.outcomes && draft.outcomes.length > 0 ? { outcomes: draft.outcomes } : {}),
      populatedFields: populatedFieldNames(draft),
    },
  };
}

async function commitPlan(
  plan: EnrichmentPlan,
  dryRun: boolean,
  writeDraft: (id: string, fields: Record<string, unknown>) => Promise<void>,
  summary: EnrichmentSummary,
) {
  if (dryRun) return;

  try {
    await writeDraft(plan.draftId, plan.set);
    summary.enriched += 1;
  } catch (error) {
    summary.failed += 1;
    console.error(
      `PMID ${plan.pmid}: Sanity draft update failed. ${errorMessage(error)} The draft was not marked completed.`,
    );
  }
}

function printPlan(plan: EnrichmentPlan, dryRun: boolean) {
  console.log("");
  console.log(`PMID ${plan.pmid}`);
  console.log("Would set:");
  if (plan.wouldSet.length === 0) {
    console.log("  (no public fields)");
  } else {
    for (const field of plan.wouldSet) {
      console.log(`  ${field.field}: ${field.preview}`);
    }
  }
  console.log("Would leave unchanged:");
  for (const field of plan.unchanged) {
    console.log(`  ${field}`);
  }
  if (plan.leftEmpty.length > 0) {
    console.log("Would leave empty:");
    for (const field of plan.leftEmpty) {
      console.log(`  ${field.field}: ${field.reason}`);
    }
  }
  console.log(`Internal status: ${plan.status}`);
  console.log(
    plan.editorialStatusSet
      ? "Editorial status: needs_review (was empty)."
      : "Editorial status: left unchanged.",
  );
  if (dryRun) console.log("Sanity was not modified.");
}

function printSummary(summary: EnrichmentSummary) {
  console.log("");
  console.log("Research enrichment summary");
  console.log(`  Mode: ${summary.dryRun ? "dry-run" : "update drafts"}`);
  console.log(`  Model: ${summary.model}`);
  console.log(`  Eligible drafts: ${summary.eligibleDrafts}`);
  console.log(`  Drafts inspected: ${summary.inspected}`);
  console.log(`  AI calls made: ${summary.aiCalls}`);
  console.log(`  Drafts enriched: ${summary.enriched}`);
  console.log(`  Proposed updates: ${summary.proposedUpdates}`);
  console.log(`  Skipped: ${summary.skipped}`);
  console.log(`  Failed: ${summary.failed}`);
  console.log(
    `  Insufficient abstracts: ${
      summary.insufficientAbstracts.length > 0
        ? summary.insufficientAbstracts.join(", ")
        : "none"
    }`,
  );
  console.log(
    `  Estimated AI calls for the current draft set: up to ${summary.eligibleDrafts}`,
  );
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "unknown error";
}
