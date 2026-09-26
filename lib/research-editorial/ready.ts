export const READY_EDITORIAL_WARNINGS = {
  title: "Add a study title before marking this Ready to Publish.",
  excerpt: "Add a short summary before marking this Ready to Publish.",
  topic: "Choose a research topic before marking this Ready to Publish.",
  mainFindings: "Add main findings before marking this Ready to Publish.",
  publishedAt: "Add a published date before marking this Ready to Publish.",
  sourceLink: "Add a DOI or original study link before marking this Ready to Publish.",
} as const;

type ReadyDocument = {
  editorialStatus?: unknown;
  doi?: unknown;
  studyUrl?: unknown;
};

export function isReadyEditorialStatus(status: unknown): boolean {
  return status === "ready";
}

export function isMissingReadyValue(value: unknown): boolean {
  if (value == null) return true;
  if (typeof value === "string") return value.trim().length === 0;
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

/** Studio warning only. Returning true allows the draft to be saved. */
export function readyFieldWarning(
  document: ReadyDocument | undefined,
  value: unknown,
  message: string,
): true | string {
  if (!isReadyEditorialStatus(document?.editorialStatus)) return true;
  return isMissingReadyValue(value) ? message : true;
}

/** Warn when a Ready draft has neither a DOI nor an original study URL. */
export function readySourceLinkWarning(document: ReadyDocument | undefined): true | string {
  if (!isReadyEditorialStatus(document?.editorialStatus)) return true;
  if (!isMissingReadyValue(document?.doi) || !isMissingReadyValue(document?.studyUrl)) return true;
  return READY_EDITORIAL_WARNINGS.sourceLink;
}
