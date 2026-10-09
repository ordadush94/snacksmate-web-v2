import { formatResearchImageAudit } from "./audit";
import type { ResearchImageBackfillResult, StudyRunResult } from "./types";

export function formatImageCostBanner(result: Pick<
  ResearchImageBackfillResult,
  "studies" | "maxImages" | "model" | "imageSize" | "regenerationMode"
>): string {
  const generate = result.studies.filter(
    (study) => study.action === "generate_image" || study.action === "regenerate_image",
  ).length;
  const withheld = result.studies.filter((study) => study.action === "withheld_by_max_images").length;
  const reused = result.studies.filter((study) => study.action === "reuse_existing_asset").length;
  const missing = result.studies.filter((study) => !study.existingImage).length;
  const existing = result.studies.filter((study) => study.existingImage).length;
  const eligibleRegen = result.studies.filter(
    (study) => study.provenance === "research-image-automation",
  ).length;
  return [
    `Regeneration mode: ${result.regenerationMode}`,
    `Logical studies: ${result.studies.length}`,
    `Missing images: ${missing}`,
    `Existing images: ${existing}`,
    `Images eligible for regeneration: ${eligibleRegen}`,
    `Images to generate: ${generate}`,
    `Image model: ${result.model}`,
    `Estimated API calls: ${generate}`,
    `Eligible logical studies: ${generate + withheld + reused}`,
    `Existing images reused: ${reused}`,
    `Requested max: ${result.maxImages === "ALL" ? "ALL" : String(result.maxImages)}`,
    `Image size: ${result.imageSize}`,
    `Image QA checks: ${generate}`,
  ].join("\n");
}

export function formatResearchImageReport(result: ResearchImageBackfillResult): string {
  const studies = result.studies;
  const already = studies.filter((study) => study.action === "skip_existing_image").length;
  const reuse = studies.filter((study) => study.action === "reuse_existing_asset").length;
  const withheld = studies.filter((study) => study.action === "withheld_by_max_images").length;
  const generate = studies.filter((study) => study.action === "generate_image").length;
  const regenerate = studies.filter((study) => study.action === "regenerate_image").length;
  const plannedPatches = studies.flatMap((study) => study.patches);
  const publishedPlanned = countPublication(studies, "published");
  const draftPlanned = countPublication(studies, "draft");
  const lines = [
    `Logical Research studies: ${studies.length}`,
    `Regeneration mode: ${result.regenerationMode}`,
    `Already have image: ${already}`,
    `Would reuse existing image: ${reuse}`,
    `Missing image: ${studies.filter((study) => !study.existingImage).length}`,
    `Images eligible for regeneration: ${studies.filter((study) => study.provenance === "research-image-automation").length}`,
    `Images that would be generated: ${generate + regenerate}`,
    `Published documents that would be patched: ${publishedPlanned}`,
    `Draft documents that would be patched: ${draftPlanned}`,
    `Estimated image API calls: ${result.dryRun ? generate + regenerate : result.imageApiCalls}`,
    `Sanity mutations: ${result.dryRun ? 0 : result.sanityMutations}`,
  ];
  if (!result.dryRun) {
    lines.push(
      `Images generated: ${studies.filter((study) => study.imageGeneration === "generated").length}`,
      `Images regenerated: ${regenerate}`,
      `Image generation failures: ${studies.filter((study) => study.imageGeneration === "failed").length}`,
      `Document patch failures: ${plannedPatches.filter((patch) => patch.status === "failed").length}`,
    );
  }
  if (withheld > 0) lines.push(`Withheld by max images: ${withheld}`);
  lines.push("");

  for (const study of studies) {
    lines.push(
      "---",
      `PMID: ${study.pmid ?? "none"}`,
      `English title: ${study.englishTitle || "none"}`,
      `Document ids: ${formatDocuments(study)}`,
      `Existing image: ${study.existingImage ? "yes" : "no"}`,
      `Action: ${study.action}`,
      `Image generation: ${study.imageGeneration}`,
      `Reason: ${study.reason}`,
      `Asset reused: ${study.assetReused ? "yes" : "no"}`,
    );
    if (study.assetRef) lines.push(`Asset: ${study.assetRef}`);
    if (study.error) lines.push(`Error: ${study.error}`);
    if (study.patches.length > 0) {
      lines.push(
        `Patches: ${study.patches
          .map((patch) => `${patch.id} (${patch.publication}, ${patch.language}, ${patch.kind}, ${patch.status})`)
          .join("; ")}`,
      );
    }
  }
  lines.push("", formatResearchImageAudit(result.audit));
  return lines.join("\n");
}

export function backfillHasFailures(result: ResearchImageBackfillResult): boolean {
  return result.studies.some(
    (study) =>
      study.imageGeneration === "failed" || study.patches.some((patch) => patch.status === "failed"),
  );
}

function countPublication(studies: readonly StudyRunResult[], publication: "published" | "draft"): number {
  return studies.reduce(
    (total, study) =>
      total + study.patches.filter((patch) => patch.publication === publication && patch.status !== "not_applied").length,
    0,
  );
}

function formatDocuments(study: StudyRunResult): string {
  if (study.documents.length === 0) return "none";
  return study.documents
    .map((doc) => `${doc.id} (${doc.publication}, ${doc.language})`)
    .join("; ");
}
