import { normalizeDoi, normalizeTitle } from "./normalize";

export type ResearchIdentity = {
  id: string;
  pmid?: string | null;
  doi?: string | null;
  title?: string | null;
  slug?: string | null;
};

export type DuplicateMatch = {
  id: string;
  reason: "pmid" | "doi" | "title" | "slug";
};

export function findDuplicate(
  candidate: ResearchIdentity,
  existing: readonly ResearchIdentity[],
): DuplicateMatch | null {
  const pmid = candidate.pmid?.trim();
  if (pmid) {
    const match = existing.find((item) => item.pmid?.trim() === pmid);
    if (match) return { id: match.id, reason: "pmid" };
  }

  const doi = normalizeDoi(candidate.doi);
  if (doi) {
    const match = existing.find((item) => normalizeDoi(item.doi) === doi);
    if (match) return { id: match.id, reason: "doi" };
  }

  const title = normalizeTitle(candidate.title);
  if (title) {
    const match = existing.find((item) => normalizeTitle(item.title) === title);
    if (match) return { id: match.id, reason: "title" };
  }

  const slug = candidate.slug?.trim();
  if (slug) {
    const match = existing.find((item) => item.slug?.trim() === slug);
    if (match) return { id: match.id, reason: "slug" };
  }

  return null;
}
