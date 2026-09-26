import { isEnrichmentDraftId } from "../research-enrichment/apply";
import { editorialStatusAfterEnrichment } from "./status";

export type EditorialBackfillCandidate = {
  _id: string;
  editorialStatus?: string | null;
  aiEnrichmentStatus?: string | null;
};

/**
 * Optional stored status for an AI-enriched PubMed draft that has no editorial
 * status yet. Returns null unless every safety check passes.
 * This never targets a published id and never replaces a stored status.
 */
export function editorialBackfillPatch(
  document: EditorialBackfillCandidate,
): { editorialStatus: "needs_review" } | null {
  if (!isEnrichmentDraftId(document._id)) return null;
  if (editorialStatusAfterEnrichment(document.editorialStatus) !== "needs_review") return null;
  if (!document.aiEnrichmentStatus?.trim()) return null;
  return { editorialStatus: "needs_review" };
}
