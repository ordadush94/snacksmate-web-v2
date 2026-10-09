import { assertAltText } from "./alt";
import { assertAssetRef } from "./generate";
import type { ImagePatchPlan } from "./types";

export const RESEARCH_IMAGE_PATCH_KEYS = ["mainImage", "mainImage.alt"] as const;

const MAIN_IMAGE_KEYS = new Set(["_type", "asset", "alt", "hotspot", "crop"]);

/**
 * The only Research fields a backfill may write.
 * Alt text is the existing string inside `mainImage`, not a second field.
 */
export function assertAllowlistedImagePatch(fields: Record<string, unknown>): void {
  const keys = Object.keys(fields);
  if (keys.length === 0) throw new Error("Refusing an empty Research patch.");
  for (const key of keys) {
    if (key !== "mainImage" && key !== "mainImage.alt") {
      throw new Error(
        `Refusing to patch Research field "${key}". Only mainImage and its alt text may change.`,
      );
    }
  }
  if ("mainImage" in fields) assertMainImageValue(fields.mainImage);
  if ("mainImage.alt" in fields && typeof fields["mainImage.alt"] !== "string") {
    throw new Error("mainImage alt text must be a string.");
  }
}

export function materializeImagePatch(
  patch: ImagePatchPlan,
  asset: { ref: string; hotspot?: unknown; crop?: unknown },
): Record<string, unknown> {
  assertAltText(patch.alt, patch.language);
  if (patch.kind === "alt") {
    return { "mainImage.alt": patch.alt };
  }
  assertAssetRef(asset.ref);
  const mainImage: Record<string, unknown> = {
    _type: "image",
    asset: { _type: "reference", _ref: asset.ref },
    alt: patch.alt,
  };
  if (isPlainObject(asset.hotspot)) mainImage.hotspot = asset.hotspot;
  if (isPlainObject(asset.crop)) mainImage.crop = asset.crop;
  return { mainImage };
}

function assertMainImageValue(value: unknown): void {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("mainImage must be an image object.");
  }
  const image = value as Record<string, unknown>;
  for (const key of Object.keys(image)) {
    if (!MAIN_IMAGE_KEYS.has(key)) {
      throw new Error(`Refusing to store "${key}" inside mainImage.`);
    }
  }
  if (image._type !== "image") throw new Error("mainImage _type must be image.");
  if (typeof image.alt !== "string" || !image.alt.trim()) {
    throw new Error("mainImage alt text is empty.");
  }
  const asset = image.asset;
  if (!asset || typeof asset !== "object" || Array.isArray(asset)) {
    throw new Error("mainImage is missing its Sanity asset.");
  }
  const ref = (asset as { _ref?: unknown })._ref;
  if (typeof ref !== "string") throw new Error("mainImage asset reference is missing.");
  assertAssetRef(ref);
  const assetKeys = Object.keys(asset as Record<string, unknown>);
  for (const key of assetKeys) {
    if (key !== "_type" && key !== "_ref") {
      throw new Error(`Refusing to store "${key}" on the mainImage asset reference.`);
    }
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
