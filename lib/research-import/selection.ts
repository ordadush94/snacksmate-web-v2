/**
 * Studies a person asked to add as unpublished Snacksmate research drafts.
 * PMIDs are the PubMed records for those titles. Corrections are not included.
 */
export const SELECTED_RESEARCH_PMIDS = [
  "39587826",
  "41474631",
  "41755895",
  "34157675",
  "41464286",
  "37498576",
  "41950555",
  "30649897",
  "41356824",
  "41965833",
  "40966620",
  "39654268",
  "30847639",
  "42200178",
  "42502209",
  "41586003",
  "41612409",
  "42558375",
] as const;

export const SELECTED_RESEARCH_SOURCE_QUERY = "manual-selection";

export function assertSelectedResearchPmids(pmids: readonly string[]): void {
  if (pmids.length !== SELECTED_RESEARCH_PMIDS.length) {
    throw new Error(
      `The named study list must contain ${SELECTED_RESEARCH_PMIDS.length} PMIDs. Received ${pmids.length}.`,
    );
  }
  const seen = new Set<string>();
  for (const pmid of pmids) {
    if (!/^\d{1,9}$/.test(pmid)) {
      throw new Error(`Invalid PMID "${pmid}". Nothing was written or published.`);
    }
    if (seen.has(pmid)) {
      throw new Error(`Duplicate PMID ${pmid}. Nothing was written or published.`);
    }
    seen.add(pmid);
  }
}
