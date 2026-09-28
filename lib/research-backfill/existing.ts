import { findDuplicate, type ResearchIdentity } from "../research-discovery/dedupe";
import { normalizeDoi, normalizeTitle } from "../research-discovery/normalize";

export type ExistingStudyMatch = {
  existing: true;
  action: "skip";
  matchedDocumentId: string;
  matchReason: "pmid" | "doi" | "title";
  studyDocumentIds: string[];
  languages: string[];
};

/**
 * English and Hebrew research documents for one paper are a translation pair.
 * Dedup treats the pair as one underlying study.
 */
export function matchExistingStudy(
  candidate: {
    pmid?: string | null;
    doi?: string | null;
    title?: string | null;
  },
  existing: readonly ResearchIdentity[],
): ExistingStudyMatch | null {
  const direct = findDuplicate(
    {
      id: "candidate",
      pmid: candidate.pmid,
      doi: candidate.doi,
      title: candidate.title,
    },
    existing,
  );
  if (!direct || direct.reason === "slug") return null;

  const group = studyGroup(direct.id, existing);
  const studyDocumentIds = [
    direct.id,
    ...group.map((item) => item.id).filter((id) => id !== direct.id),
  ];
  const languages: string[] = [];
  for (const id of studyDocumentIds) {
    const language = group.find((item) => item.id === id)?.language?.trim();
    if (language && !languages.includes(language)) languages.push(language);
  }

  return {
    existing: true,
    action: "skip",
    matchedDocumentId: direct.id,
    matchReason: direct.reason,
    studyDocumentIds,
    languages,
  };
}

export function publishedDocumentId(id: string | null | undefined): string {
  const value = id?.trim() ?? "";
  return value.startsWith("drafts.") ? value.slice("drafts.".length) : value;
}

function studyGroup(seedId: string, existing: readonly ResearchIdentity[]): ResearchIdentity[] {
  const seed = existing.find((item) => item.id === seedId);
  if (!seed) return [];

  const grouped: ResearchIdentity[] = [];
  const seen = new Set<string>();
  const queue = [seed];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || seen.has(current.id)) continue;
    seen.add(current.id);
    grouped.push(current);
    for (const other of existing) {
      if (seen.has(other.id)) continue;
      if (sameUnderlyingStudy(current, other)) queue.push(other);
    }
  }

  return grouped;
}

function sameUnderlyingStudy(left: ResearchIdentity, right: ResearchIdentity): boolean {
  if (sameText(left.pmid, right.pmid)) return true;

  const leftDoi = normalizeDoi(left.doi);
  const rightDoi = normalizeDoi(right.doi);
  if (leftDoi && leftDoi === rightDoi) return true;

  const leftTitle = normalizeTitle(left.title);
  const rightTitle = normalizeTitle(right.title);
  if (leftTitle && leftTitle === rightTitle) return true;

  const leftId = publishedDocumentId(left.id);
  const rightId = publishedDocumentId(right.id);
  const leftSource = publishedDocumentId(left.translationSourceId);
  const rightSource = publishedDocumentId(right.translationSourceId);
  if (leftSource && (leftSource === rightId || leftSource === rightSource)) return true;
  if (rightSource && rightSource === leftId) return true;

  const leftTranslationSlug = left.translationSlug?.trim();
  const rightTranslationSlug = right.translationSlug?.trim();
  const leftSlug = left.slug?.trim();
  const rightSlug = right.slug?.trim();
  if (
    leftTranslationSlug &&
    (leftTranslationSlug === rightTranslationSlug || leftTranslationSlug === rightSlug)
  ) {
    return true;
  }
  if (rightTranslationSlug && rightTranslationSlug === leftSlug) return true;

  return false;
}

function sameText(left: string | null | undefined, right: string | null | undefined): boolean {
  const a = left?.trim();
  const b = right?.trim();
  return Boolean(a && b && a === b);
}
