const DOI_URL_PREFIX = /^https?:\/\/(?:dx\.)?doi\.org\//i;
const DOI_LABEL_PREFIX = /^doi:\s*/i;
const DOI_PATTERN = /^10\.\d{4,9}\/\S+$/;

export function normalizeDoi(value: string | null | undefined): string | null {
  if (!value) return null;

  let doi = value.trim();
  if (!doi) return null;

  try {
    doi = decodeURIComponent(doi);
  } catch {
    // Keep the raw value when it is not valid percent-encoding.
  }

  doi = doi.replace(DOI_URL_PREFIX, "").replace(DOI_LABEL_PREFIX, "").trim();
  doi = doi.replace(/[.\s,;]+$/, "");
  doi = doi.toLowerCase();

  if (!DOI_PATTERN.test(doi)) return null;
  return doi;
}

export function normalizeTitle(value: string | null | undefined): string {
  if (!value) return "";

  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function slugifyTitle(value: string): string {
  const slug = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 96)
    .replace(/-+$/g, "");

  return slug || "study";
}

export function draftIdForPmid(pmid: string): string {
  return `drafts.research-pubmed-${pmid.trim()}`;
}

export function draftIdForDoi(doi: string): string {
  const safe = doi.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
  return `drafts.research-doi-${safe}`;
}
