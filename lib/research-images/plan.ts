import { buildResearchImageAlt } from "./alt";
import { buildImagePrompt, buildResearchVisualBrief, plainText } from "./brief";
import type { ResearchImageScope } from "./config";
import {
  groupResearchDocuments,
  normalizePmid,
  publicationState,
  publishedDocumentId,
} from "./group";
import type {
  ImagePatchPlan,
  PlannedStudy,
  ResearchImageDocument,
  StudyAction,
  VisualBrief,
} from "./types";

const RICHNESS_FIELDS = [
  "title",
  "seoTitle",
  "excerpt",
  "topic",
  "studyDesign",
  "population",
  "intervention",
  "outcomes",
  "mainFindings",
  "practicalInterpretation",
] as const;

export function planResearchImages(
  documents: readonly ResearchImageDocument[],
  options: { scope: ResearchImageScope; maxImages: number | "ALL" },
): PlannedStudy[] {
  const planned = groupResearchDocuments(documents)
    .map((group) => planStudy(group.documents, options.scope))
    .filter((study): study is PlannedStudy => study !== null);
  return applyImageCap(planned, options.maxImages);
}

export function chooseBriefSource(documents: readonly ResearchImageDocument[]): ResearchImageDocument {
  const english = documents.filter((doc) => doc.language === "en");
  const pool = english.length > 0 ? english : [...documents];
  const source = pool.slice().sort(compareSource)[0];
  if (!source) throw new Error("A Research study needs at least one document.");
  return source;
}

export function imageAssetRef(document: ResearchImageDocument): string | null {
  const asset = document.mainImage?.asset;
  if (!asset) return null;
  const ref = (asset._ref || asset._id || "").trim();
  return ref.startsWith("image-") ? ref : null;
}

export function hasAltText(document: ResearchImageDocument): boolean {
  return Boolean(document.mainImage?.alt?.trim());
}

function planStudy(
  documents: readonly ResearchImageDocument[],
  scope: ResearchImageScope,
): PlannedStudy | null {
  const targets = documents.filter((doc) => isPatchTarget(doc, scope));
  if (targets.length === 0) return null;
  const source = chooseBriefSource(documents);
  const brief = buildResearchVisualBrief(source, studyKey(documents));
  const canonical = canonicalImageDocument(documents);
  const canonicalRef = canonical ? imageAssetRef(canonical) : null;
  const missingAsset = targets.filter((doc) => !imageAssetRef(doc));
  const action = studyAction(canonicalRef, missingAsset.length);
  const patches =
    action === "generate_image" || action === "reuse_existing_asset" || action === "skip_existing_image"
      ? patchesFor(targets, brief, documents)
      : [];

  return {
    key: studyKey(documents),
    pmid: studyPmid(documents),
    englishTitle: englishTitle(documents, source),
    action,
    existingImage: Boolean(canonicalRef),
    assetReused: action === "reuse_existing_asset",
    reason: canonicalRef ? "existing image" : "missing image",
    canonicalAssetRef: canonicalRef,
    hotspot: canonical?.mainImage?.hotspot,
    crop: canonical?.mainImage?.crop,
    brief,
    prompt: buildImagePrompt(brief),
    documents: [...documents],
    patches,
  };
}

function patchesFor(
  targets: readonly ResearchImageDocument[],
  brief: VisualBrief,
  documents: readonly ResearchImageDocument[],
): ImagePatchPlan[] {
  const title = englishTitle(documents, chooseBriefSource(documents));
  const patches: ImagePatchPlan[] = [];
  for (const doc of targets) {
    const publication = publicationState(doc._id);
    if (publication === "other") continue;
    const language = doc.language === "he" ? "he" : "en";
    const alt = buildResearchImageAlt(brief, language);
    if (alt === title) continue;
    const ref = imageAssetRef(doc);
    if (ref && hasAltText(doc)) continue;
    patches.push({
      id: doc._id,
      language,
      publication,
      kind: ref ? "alt" : "image",
      alt,
    });
  }
  return patches;
}

function studyAction(canonicalRef: string | null, missingAssets: number): StudyAction {
  if (!canonicalRef) return "generate_image";
  if (missingAssets > 0) return "reuse_existing_asset";
  return "skip_existing_image";
}

function applyImageCap(studies: PlannedStudy[], maxImages: number | "ALL"): PlannedStudy[] {
  let remaining = maxImages === "ALL" ? Number.POSITIVE_INFINITY : maxImages;
  return studies.map((study) => {
    if (study.action !== "generate_image") return study;
    if (study.patches.length === 0) return study;
    if (remaining > 0) {
      remaining -= 1;
      return study;
    }
    return {
      ...study,
      action: "withheld_by_max_images",
      reason: "max images",
      patches: [],
    };
  });
}

function isPatchTarget(document: ResearchImageDocument, scope: ResearchImageScope): boolean {
  const state = publicationState(document._id);
  if (state === "other") return false;
  if (scope === "published_missing") return state === "published";
  if (scope === "drafts_missing") return state === "draft";
  return true;
}

function canonicalImageDocument(
  documents: readonly ResearchImageDocument[],
): ResearchImageDocument | null {
  const withImage = documents.filter((doc) => imageAssetRef(doc));
  if (withImage.length === 0) return null;
  return withImage.slice().sort((a, b) => imageRank(a) - imageRank(b) || a._id.localeCompare(b._id))[0];
}

function imageRank(document: ResearchImageDocument): number {
  const language = document.language === "he" ? 2 : document.language === "en" ? 0 : 1;
  const draft = publicationState(document._id) === "published" ? 0 : 1;
  return language * 2 + draft;
}

export function studyKey(documents: readonly ResearchImageDocument[]): string {
  const pmid = studyPmid(documents);
  if (pmid) return `pmid-${pmid}`;
  const bases = [
    ...new Set(documents.map((doc) => publishedDocumentId(doc._id)).filter((id) => id.length > 0)),
  ].sort();
  return bases[0] || "study";
}

export function studyPmid(documents: readonly ResearchImageDocument[]): string | null {
  for (const doc of documents) {
    const pmid = normalizePmid(doc.pmid);
    if (pmid) return pmid;
  }
  return null;
}

export function englishTitle(
  documents: readonly ResearchImageDocument[],
  source: ResearchImageDocument,
): string {
  if (source.language === "en" && source.title?.trim()) return source.title.trim();
  const english = documents.find((doc) => doc.language === "en" && doc.title?.trim());
  return english?.title?.trim() || source.title?.trim() || "";
}

function compareSource(a: ResearchImageDocument, b: ResearchImageDocument): number {
  const richness = sourceRichness(b) - sourceRichness(a);
  if (richness !== 0) return richness;
  const publication =
    Number(publicationState(a._id) !== "published") - Number(publicationState(b._id) !== "published");
  if (publication !== 0) return publication;
  return a._id.localeCompare(b._id);
}

function sourceRichness(document: ResearchImageDocument): number {
  return RICHNESS_FIELDS.reduce((score, field) => {
    const value = document[field];
    if (typeof value === "string") return score + (value.trim() ? 1 : 0);
    if (Array.isArray(value)) return score + (plainText(value) ? 1 : 0);
    return score;
  }, 0);
}
