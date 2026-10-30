import { draftIdForPmid } from "../research-discovery/normalize";

/** The only studies this recovery may touch. */
export const RECOVERY_PMIDS = ["42925061", "42923131", "42948631"] as const;

export type RecoveryDraftRef = {
  pmid: string;
  draftId: string;
  title: string;
};

export type RecoveryCandidate = {
  pmid?: string | null;
  _id?: string | null;
  language?: string | null;
  title?: string | null;
};

/**
 * Select existing English drafts for the fixed recovery list.
 * Published ids, Hebrew ids, and every other PMID are ignored.
 * A missing English draft is omitted so the caller cannot create one.
 */
export function selectRecoveryDrafts(rows: readonly RecoveryCandidate[]): RecoveryDraftRef[] {
  return RECOVERY_PMIDS.flatMap((pmid) => {
    const draftId = draftIdForPmid(pmid);
    const row = rows.find(
      (item) => item._id === draftId && item.pmid === pmid && item.language === "en",
    );
    if (!row) return [];
    const title = row.title?.trim();
    return [{ pmid, draftId, title: title || pmid }];
  });
}
