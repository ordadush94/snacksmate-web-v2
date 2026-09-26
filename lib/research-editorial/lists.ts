import type { EditorialStatus } from "./status";

/**
 * Desk filters for Research.
 * Needs Review also includes drafts with no editorialStatus so existing
 * AI-enriched drafts show up before anyone stores the field.
 * Published documents with an empty status stay in Published and All Research.
 */
export const RESEARCH_EDITORIAL_FILTERS = {
  needsReview:
    '_type == "research" && (editorialStatus == "needs_review" || (!defined(editorialStatus) && _id in path("drafts.**")))',
  readyToPublish: '_type == "research" && editorialStatus == "ready_to_publish"',
  published: '_type == "research" && !(_id in path("drafts.**"))',
  rejected: '_type == "research" && editorialStatus == "rejected"',
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
    kind: "list",
    id: "rejected",
    title: "Rejected",
    filter: RESEARCH_EDITORIAL_FILTERS.rejected,
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
  editorialStatus?: string | null;
};

export function matchesResearchEditorialList(
  document: EditorialListDocument,
  list: ResearchEditorialListId,
): boolean {
  if (document._type !== "research") return false;
  const status = storedStatus(document.editorialStatus);
  const isDraft = document._id.startsWith("drafts.");

  switch (list) {
    case "needsReview":
      return status === "needs_review" || (status === undefined && isDraft);
    case "readyToPublish":
      return status === "ready_to_publish";
    case "published":
      return !isDraft;
    case "rejected":
      return status === "rejected";
    default:
      return false;
  }
}

function storedStatus(status: string | null | undefined): EditorialStatus | string | undefined {
  if (typeof status !== "string") return undefined;
  return status;
}
