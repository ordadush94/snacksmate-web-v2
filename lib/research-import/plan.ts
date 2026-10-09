import { matchExistingStudy, matchLinkedTranslation } from "../research-backfill/existing";
import type { ResearchIdentity } from "../research-discovery/dedupe";
import { draftIdForPmid } from "../research-discovery/normalize";
import type { RelevanceDecision } from "../research-discovery/relevance";

export type SelectedDraftRef = {
  pmid: string;
  title: string;
  draftId: string;
  slug: string;
  doi?: string;
};

export type SelectedImportAction = "create" | "resume" | "skip";

export type SelectedImportPlanItem = {
  pmid: string;
  title: string;
  draftId: string;
  action: SelectedImportAction;
  reason: string;
};

/**
 * Decide what to do with one selected study.
 * create: no Sanity document yet.
 * resume: an unpublished English draft exists and Hebrew does not.
 * skip: a correction, or the study is already in Sanity with Hebrew, or only a published copy exists.
 * A published document is not turned into a new draft and is not patched.
 */
export function planSelectedStudy(input: {
  draft: SelectedDraftRef;
  existing: readonly ResearchIdentity[];
  relevance: Pick<RelevanceDecision, "disposition" | "reason">;
}): SelectedImportPlanItem {
  const base = {
    pmid: input.draft.pmid,
    title: input.draft.title,
    draftId: input.draft.draftId,
  };

  if (input.relevance.disposition === "reject") {
    return { ...base, action: "skip", reason: input.relevance.reason };
  }

  if (input.draft.draftId !== draftIdForPmid(input.draft.pmid)) {
    return {
      ...base,
      action: "skip",
      reason: "Refusing a draft id that is not drafts.research-pubmed-{PMID}.",
    };
  }

  const match = matchExistingStudy(
    { pmid: input.draft.pmid, doi: input.draft.doi, title: input.draft.title },
    input.existing,
  );
  const linked = matchLinkedTranslation(
    { draftId: input.draft.draftId, slug: input.draft.slug },
    input.existing,
  );
  const ids = match?.studyDocumentIds ?? [];
  const hasHebrew =
    Boolean(linked) ||
    match?.languages.includes("he") === true ||
    ids.some((id) => id.includes("research-he-"));
  const hasEnglishDraft = ids.includes(input.draft.draftId);
  const hasPublishedEnglish = ids.includes(publishedId(input.draft.draftId));

  if (hasHebrew) {
    return {
      ...base,
      action: "skip",
      reason: `Already in Sanity${match ? ` (${match.matchedDocumentId})` : ""}.`,
    };
  }

  if (hasPublishedEnglish && !hasEnglishDraft) {
    return {
      ...base,
      action: "skip",
      reason: `Published English document ${publishedId(input.draft.draftId)} already exists. This import does not create a draft over it.`,
    };
  }

  if (hasEnglishDraft) {
    return {
      ...base,
      action: "resume",
      reason: "Unpublished English draft exists. Enrichment and Hebrew localization can continue. Nothing is published.",
    };
  }

  if (match) {
    return {
      ...base,
      action: "skip",
      reason: `Already in Sanity (${match.matchedDocumentId}) by ${match.matchReason}.`,
    };
  }

  return {
    ...base,
    action: "create",
    reason: "No matching research document. An unpublished English draft can be created.",
  };
}

function publishedId(id: string): string {
  return id.replace(/^drafts\./, "");
}
