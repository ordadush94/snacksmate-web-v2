import type {
  AppearanceVariation,
  BrandAccentId,
  CompositionId,
  SettingId,
  SupportingPaletteId,
} from "./types";

/**
 * Fixed Snacksmate Research illustration style.
 * Scene, people, setting, and supporting colors change. This style does not.
 */
export const RESEARCH_IMAGE_STYLE = {
  name: "Snacksmate Research",
  medium: "modern editorial illustration",
  tone: "clean, friendly, and professional, with a physical-activity tone suitable for a scientific research hub",
  rendering: "soft contemporary rendering, uncluttered composition, and moderate depth",
  brand: "mint and teal are a small brand accent, not the color of the whole scene",
  prompt: [
    "Modern editorial illustration for the Snacksmate Research hub.",
    "Clean, friendly, and professional. The tone is physical activity and health, restrained rather than childish.",
    "Soft contemporary rendering, moderate depth, and an uncluttered composition.",
    "Keep the same illustration style in every image.",
    "Do not switch to stock photography, photorealism, cartoon or comic style, or medical illustration.",
    "Mint and teal are the brand anchor. Use them only as the one requested accent.",
  ].join("\n"),
} as const;

export type ResearchImageStyle = typeof RESEARCH_IMAGE_STYLE;

export const SETTING_PROSE: Record<SettingId, string> = {
  home: "an ordinary home interior",
  "home-exercise-corner": "a small home exercise corner with open floor and little furniture",
  office: "a calm workplace with a desk and a chair",
  "workplace-corridor": "a workplace corridor or landing",
  staircase: "a simple staircase",
  "outdoor-urban": "a quiet urban sidewalk or stepped street",
  park: "a park path",
  gym: "a simple gym with one piece of equipment",
  campus: "a university campus path, stair, or quiet room",
  studio: "a neutral studio-like room without domestic clutter",
};

export const COMPOSITION_PROSE: Record<CompositionId, string> = {
  "wide-environmental": "a wide environmental scene, with the activity readable inside the place",
  "medium-activity": "a medium activity shot",
  "side-profile": "a calm side profile",
  "three-quarter": "a three-quarter view, with the subject slightly off center",
  "slightly-elevated": "a slightly elevated eye-level view, not a dramatic overhead shot",
  "activity-focus": "the activity fills more of the frame and the room stays secondary",
  asymmetrical: "an asymmetrical editorial composition with open space on one side",
  "two-person": "two people interacting during the activity",
  "equipment-focus": "the equipment is the main subject and any person is secondary",
  "movement-no-face": "the movement is clear and the face is turned away or left outside the frame",
};

export const PALETTE_PROSE: Record<SupportingPaletteId, string> = {
  "muted-blue": "muted blue, slate, and warm gray",
  "warm-sand": "warm sand, cream, and soft ochre",
  "soft-peach": "soft peach and warm ivory",
  "muted-coral": "muted coral, clay, and warm gray",
  "soft-lavender": "soft lavender-gray and cool stone",
  "warm-neutral": "oat, taupe, and soft brown",
  sage: "muted gray-green sage, distinct from brand mint",
  "light-terracotta": "light terracotta, warm clay, and cream",
};

export const BRAND_ACCENT_PROSE: Record<BrandAccentId, string> = {
  "clothing-accent": "one small mint or teal clothing accent, such as a collar, stripe, or sock, on clothing that is otherwise not mint",
  accessory: "one small teal water bottle or towel",
  architectural: "one subtle teal architectural detail, such as a rail or a door edge",
  "equipment-accent": "a thin teal edge on a single piece of equipment",
};

export const APPEARANCE_PROSE: Record<AppearanceVariation, string> = {
  light: "light skin tone",
  medium: "medium skin tone",
  deep: "deep skin tone",
  olive: "olive skin tone",
  none: "no person is visible",
};

export const RESEARCH_IMAGE_HARD_CONSTRAINTS = [
  "No text.",
  "No words.",
  "No letters.",
  "No numbers.",
  "No labels.",
  "No titles.",
  "No captions.",
  "No logos.",
  "No watermarks.",
  "No user interface.",
  "No charts.",
  "No graphs.",
  "No before-and-after bodies.",
  "No arrows that imply a health change.",
  "No green or red outcome indicators.",
  "No medical charts.",
  "No fake biomarkers.",
  "Do not depict a measured result, a health change, or a statistical finding.",
  "Do not infer ethnicity, religion, socioeconomic status, or a disease appearance from the study.",
].join("\n");
