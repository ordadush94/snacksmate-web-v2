/**
 * Image generation stays configurable and server-side.
 * gpt-image-2.5-flare is the current fast, high-quality generation model.
 * Sunburst remains available by setting RESEARCH_IMAGE_MODEL when editing precision matters more.
 */
export const DEFAULT_RESEARCH_IMAGE_MODEL = "gpt-image-2.5-flare";

/** Exact phrase required before any image generation or Sanity mutation. */
export const CONFIRM_RESEARCH_IMAGES = "GENERATE RESEARCH IMAGES";

export const RESEARCH_IMAGE_SCOPES = ["all_missing", "published_missing", "drafts_missing"] as const;

export type ResearchImageScope = (typeof RESEARCH_IMAGE_SCOPES)[number];

export const MAX_RESEARCH_IMAGES = 50;

/**
 * Research cards request 960×540 and the detail hero is 1400×788.
 * Both are 16:9. 2048×1152 is the closest flexible GPT Image size:
 * exact 16:9, edges divisible by 16, and wide enough for the hero.
 */
export const RESEARCH_IMAGE_LANDSCAPE_SIZE = "2048x1152";

/** Closest fixed landscape size on gpt-image-1 and gpt-image-1.5. */
export const RESEARCH_IMAGE_FIXED_LANDSCAPE_SIZE = "1536x1024";

/** Closest dall-e-3 landscape size to 16:9. */
export const RESEARCH_IMAGE_DALLE3_LANDSCAPE_SIZE = "1792x1024";

export function resolveResearchImageModel(value: string | undefined): string {
  const model = value?.trim() || DEFAULT_RESEARCH_IMAGE_MODEL;
  if (!/^[A-Za-z0-9._-]+$/.test(model)) {
    throw new Error("RESEARCH_IMAGE_MODEL must be a single model id.");
  }
  return model;
}

export function resolveResearchImageScope(value: string | undefined): ResearchImageScope {
  const scope = (value?.trim() || "all_missing") as ResearchImageScope;
  if (!RESEARCH_IMAGE_SCOPES.includes(scope)) {
    throw new Error(
      "scope must be all_missing, published_missing, or drafts_missing.",
    );
  }
  return scope;
}

export function resolveMaxImages(value: number | "ALL" | string | undefined): number | "ALL" {
  if (value === "ALL") return "ALL";
  const token = value === undefined ? "10" : String(value).trim();
  if (token === "ALL") return "ALL";
  if (!/^[1-9]\d?$/.test(token)) {
    throw new Error("max_images must be an integer from 1 to 50, or ALL.");
  }
  const parsed = Number(token);
  if (parsed < 1 || parsed > MAX_RESEARCH_IMAGES) {
    throw new Error("max_images must be an integer from 1 to 50, or ALL.");
  }
  return parsed;
}

export function researchImageSize(model: string): string {
  const id = model.trim().toLowerCase();
  if (id.startsWith("dall-e-2")) return "1024x1024";
  if (id.startsWith("dall-e-3")) return RESEARCH_IMAGE_DALLE3_LANDSCAPE_SIZE;
  if (id === "gpt-image-1" || id.startsWith("gpt-image-1.") || id.startsWith("gpt-image-1-")) {
    return RESEARCH_IMAGE_FIXED_LANDSCAPE_SIZE;
  }
  return RESEARCH_IMAGE_LANDSCAPE_SIZE;
}

export function assertServerSideImageCredentials(): void {
  if (process.env.NEXT_PUBLIC_OPENAI_API_KEY?.trim()) {
    throw new Error(
      "Remove NEXT_PUBLIC_OPENAI_API_KEY. The OpenAI key must stay server-side as OPENAI_API_KEY.",
    );
  }
}
