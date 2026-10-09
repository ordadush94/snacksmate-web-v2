import type {
  DiversityPeopleCounts,
  DiversitySettingCounts,
  PlannedStudy,
  ResearchImageAudit,
  ResearchImageAuditRow,
  SettingId,
  SubjectCount,
  SubjectPresentation,
} from "./types";
import { settingFamily } from "./visual-plan";

const EMPTY_PEOPLE: DiversityPeopleCounts = {
  femalePresenting: 0,
  malePresenting: 0,
  genderNeutral: 0,
  mixedOrGroup: 0,
  noPerson: 0,
  notRecorded: 0,
};

const EMPTY_SETTINGS: DiversitySettingCounts = {
  home: 0,
  office: 0,
  stairs: 0,
  outdoors: 0,
  gym: 0,
  other: 0,
  notRecorded: 0,
};

/**
 * Summarize recorded plans and the plans the new system would use.
 * Recorded attributes come from stored provenance. Pixels are not classified.
 */
export function buildResearchImageAudit(studies: readonly PlannedStudy[]): ResearchImageAudit {
  const rows: ResearchImageAuditRow[] = studies.map((study) => ({
    key: study.key,
    pmid: study.pmid,
    englishTitle: study.englishTitle,
    existingImage: study.existingImage,
    provenance: study.provenance,
    regenerationEligible: study.regenerationEligible,
    recordedPlan: study.recordedPlan,
    proposedPlan: study.brief.plan,
  }));
  const recordedPeople = { ...EMPTY_PEOPLE };
  const recordedSettings = { ...EMPTY_SETTINGS };
  const proposedPeople = { ...EMPTY_PEOPLE };
  const proposedSettings = { ...EMPTY_SETTINGS };

  for (const row of rows) {
    if (row.recordedPlan) {
      addPerson(recordedPeople, row.recordedPlan.subjectPresentation, row.recordedPlan.subjectCount);
      addSetting(recordedSettings, row.recordedPlan.setting);
    } else if (row.existingImage) {
      recordedPeople.notRecorded += 1;
      recordedSettings.notRecorded += 1;
    }
    addPerson(proposedPeople, row.proposedPlan.subjectPresentation, row.proposedPlan.subjectCount);
    addSetting(proposedSettings, row.proposedPlan.setting);
  }

  return {
    rows,
    recordedPeople,
    recordedSettings,
    proposedPeople,
    proposedSettings,
    automated: rows.filter((row) => row.provenance === "research-image-automation").length,
    unknown: rows.filter((row) => row.provenance === "unknown").length,
    missing: rows.filter((row) => row.provenance === "missing").length,
  };
}

export function formatResearchImageAudit(audit: ResearchImageAudit): string {
  const lines = [
    "Visual audit",
    "Existing images were not classified from pixels.",
    "Recorded attributes appear only when an image still matches Research image-automation provenance.",
    `Automated provenance: ${audit.automated}`,
    `Unknown or manual provenance: ${audit.unknown}`,
    `Missing image: ${audit.missing}`,
    "Recorded people:",
    formatPeople(audit.recordedPeople),
    "Recorded settings:",
    formatSettings(audit.recordedSettings),
    "Proposed people:",
    formatPeople(audit.proposedPeople),
    "Proposed settings:",
    formatSettings(audit.proposedSettings),
  ];

  for (const row of audit.rows) {
    lines.push(
      "---",
      `PMID: ${row.pmid ?? "none"}`,
      `Research id: ${row.key}`,
      `English title: ${row.englishTitle || "none"}`,
      `Existing image: ${row.existingImage ? "yes" : "no"}`,
      `Provenance: ${row.provenance}`,
      `Regeneration eligible: ${row.regenerationEligible ? "yes" : "no"}`,
      `Recorded activity: ${row.recordedPlan?.activity ?? "not recorded"}`,
      `Recorded subject presentation: ${row.recordedPlan?.subjectPresentation ?? "not recorded"}`,
      `Recorded approximate age: ${row.recordedPlan?.approximateAge ?? "not recorded"}`,
      `Recorded setting: ${row.recordedPlan?.setting ?? "not recorded"}`,
      `Recorded composition: ${row.recordedPlan?.composition ?? "not recorded"}`,
      `Recorded supporting palette: ${row.recordedPlan?.supportingPalette ?? "not recorded"}`,
      `Proposed activity: ${row.proposedPlan.activity}`,
      `Proposed subject count: ${row.proposedPlan.subjectCount}`,
      `Proposed subject presentation: ${row.proposedPlan.subjectPresentation}`,
      `Proposed approximate age: ${row.proposedPlan.approximateAge}`,
      `Proposed setting: ${row.proposedPlan.setting}`,
      `Proposed composition: ${row.proposedPlan.composition}`,
      `Proposed supporting palette: ${row.proposedPlan.supportingPalette}`,
      `Proposed brand accent: ${row.proposedPlan.brandAccent}`,
      `Proposed key prop: ${row.proposedPlan.keyProps.join(", ") || "none"}`,
      `Rationale: ${row.proposedPlan.rationale}`,
    );
  }
  return lines.join("\n");
}

function addPerson(
  counts: DiversityPeopleCounts,
  presentation: SubjectPresentation,
  count: SubjectCount,
): void {
  if (count === "none" || presentation === "none") {
    counts.noPerson += 1;
    return;
  }
  if (count === "two" || count === "group" || presentation === "mixed-pair" || presentation === "small-group") {
    counts.mixedOrGroup += 1;
    return;
  }
  if (presentation === "female") counts.femalePresenting += 1;
  else if (presentation === "male") counts.malePresenting += 1;
  else counts.genderNeutral += 1;
}

function addSetting(counts: DiversitySettingCounts, setting: SettingId): void {
  const family = settingFamily(setting);
  if (family === "home") counts.home += 1;
  else if (family === "office") counts.office += 1;
  else if (family === "stairs") counts.stairs += 1;
  else if (family === "outdoors") counts.outdoors += 1;
  else if (family === "gym") counts.gym += 1;
  else counts.other += 1;
}

function formatPeople(counts: DiversityPeopleCounts): string {
  return [
    `female-presenting: ${counts.femalePresenting}`,
    `male-presenting: ${counts.malePresenting}`,
    `gender-neutral: ${counts.genderNeutral}`,
    `mixed/group: ${counts.mixedOrGroup}`,
    `no-person: ${counts.noPerson}`,
    `not recorded: ${counts.notRecorded}`,
  ].join("\n");
}

function formatSettings(counts: DiversitySettingCounts): string {
  return [
    `home: ${counts.home}`,
    `office: ${counts.office}`,
    `stairs: ${counts.stairs}`,
    `outdoors: ${counts.outdoors}`,
    `gym: ${counts.gym}`,
    `other: ${counts.other}`,
    `not recorded: ${counts.notRecorded}`,
  ].join("\n");
}
