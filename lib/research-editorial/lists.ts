/**
 * Desk filters for Research.
 * Editorial lists use editorialStatus. Studio evaluates these in the drafts
 * perspective, which rewrites draft ids, so these filters do not use
 * `_id in path("drafts.**")`.
 * Published matches the published document itself: in the drafts perspective
 * `_originalId` equals `_id` only when there is no draft overlay.
 */
export const RESEARCH_EDITORIAL_FILTERS = {
  needsReview: '_type == "research" && editorialStatus == "needs_review"',
  readyToPublish: '_type == "research" && editorialStatus == "ready"',
  published: '_type == "research" && _originalId == _id',
} as const;

export type ResearchEditorialListId = keyof typeof RESEARCH_EDITORIAL_FILTERS;

export const RESEARCH_EDITORIAL_DESK = [
  {
    kind: "list",
    id: "needsReview",
    title: "Needs Review",
    filter: RESEARCH_EDITORIAL_FILTERS.needsReview,
  },
  {
    kind: "list",
    id: "readyToPublish",
    title: "Ready to Publish",
    filter: RESEARCH_EDITORIAL_FILTERS.readyToPublish,
  },
  {
    kind: "list",
    id: "published",
    title: "Published",
    filter: RESEARCH_EDITORIAL_FILTERS.published,
  },
  {
    kind: "documentType",
    id: "all",
    title: "All Research",
    schemaType: "research",
  },
] as const;

export type EditorialListDocument = {
  _id: string;
  _type: string;
  /** Present in the Studio drafts perspective. Equals `_id` for a published document. */
  _originalId?: string | null;
  editorialStatus?: string | null;
};

export function matchesResearchEditorialList(
  document: EditorialListDocument,
  list: ResearchEditorialListId,
): boolean {
  if (document._type !== "research") return false;
  const status = storedStatus(document.editorialStatus);

  switch (list) {
    case "needsReview":
      return status === "needs_review";
    case "readyToPublish":
      return status === "ready";
    case "published":
      return isPublishedDocument(document);
    default:
      return false;
  }
}

function isPublishedDocument(document: EditorialListDocument): boolean {
  return typeof document._originalId === "string" && document._originalId === document._id;
}

function storedStatus(status: string | null | undefined): string | undefined {
  if (typeof status !== "string") return undefined;
  const value = status.trim();
  return value.length > 0 ? value : undefined;
}
