export const EDITORIAL_STATUSES = [
  "needs_review",
  "reviewed",
  "ready_to_publish",
  "published_manually",
  "rejected",
] as const;

export type EditorialStatus = (typeof EDITORIAL_STATUSES)[number];

export const HUMAN_EDITORIAL_STATUSES = [
  "reviewed",
  "ready_to_publish",
  "published_manually",
  "rejected",
] as const satisfies readonly EditorialStatus[];

export const EDITORIAL_STATUS_OPTIONS: { title: string; value: EditorialStatus }[] = [
  { title: "Needs review", value: "needs_review" },
  { title: "Reviewed", value: "reviewed" },
  { title: "Ready to publish", value: "ready_to_publish" },
  { title: "Published manually", value: "published_manually" },
  { title: "Rejected", value: "rejected" },
];

const EDITORIAL_STATUS_LABELS: Record<EditorialStatus, string> = {
  needs_review: "Needs review",
  reviewed: "Reviewed",
  ready_to_publish: "Ready to publish",
  published_manually: "Published manually",
  rejected: "Rejected",
};

const AI_ENRICHMENT_STATUS_LABELS: Record<string, string> = {
  pending: "AI pending",
  completed: "AI completed",
  failed: "AI failed",
  needs_review: "AI needs review",
};

export type EditorialPreviewTone = "needs_review" | "ready_to_publish" | "rejected" | "neutral";

export function isDraftDocumentId(id?: string | null): boolean {
  return typeof id === "string" && id.startsWith("drafts.");
}

export function editorialStatusLabel(status?: string | null, documentId?: string | null): string {
  const value = status?.trim();
  if (!value) {
    if (documentId && !isDraftDocumentId(documentId)) return "";
    return EDITORIAL_STATUS_LABELS.needs_review;
  }
  if (isEditorialStatus(value)) return EDITORIAL_STATUS_LABELS[value];
  return value;
}

export function aiEnrichmentStatusLabel(status?: string | null): string | undefined {
  const value = status?.trim();
  if (!value) return undefined;
  return AI_ENRICHMENT_STATUS_LABELS[value] ?? value;
}

export function editorialPreviewTone(
  status?: string | null,
  documentId?: string | null,
): EditorialPreviewTone {
  const value = status?.trim();
  if (value === "ready_to_publish") return "ready_to_publish";
  if (value === "rejected") return "rejected";
  if (value === "needs_review") return "needs_review";
  if (!value && (!documentId || isDraftDocumentId(documentId))) return "needs_review";
  return "neutral";
}

export function researchPreviewSubtitle(input: {
  editorialStatus?: string | null;
  aiEnrichmentStatus?: string | null;
  documentId?: string | null;
  details: Array<string | number | null | undefined>;
}): string {
  return [
    editorialStatusLabel(input.editorialStatus, input.documentId),
    aiEnrichmentStatusLabel(input.aiEnrichmentStatus),
    ...input.details,
  ]
    .filter((part) => part !== undefined && part !== null && String(part).trim() !== "")
    .join(" · ");
}

/**
 * Successful enrichment may set needs_review only when the editor has not
 * stored a status. Any non-empty value, including needs_review, is kept.
 */
export function editorialStatusAfterEnrichment(
  current: string | null | undefined,
): "needs_review" | undefined {
  if (typeof current === "string" && current.trim().length > 0) return undefined;
  return "needs_review";
}

export function isRejectedEditorialStatus(status: string | null | undefined): boolean {
  return status?.trim() === "rejected";
}

export function editorialStatusNote(statusWasSet: boolean): string {
  return statusWasSet
    ? "Editorial status set to needs_review because it was empty."
    : "Editorial status was left unchanged.";
}

export function isEditorialStatus(value: string): value is EditorialStatus {
  return (EDITORIAL_STATUSES as readonly string[]).includes(value);
}
