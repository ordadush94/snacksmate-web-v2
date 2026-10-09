import {
  APPEARANCE_PROSE,
  BRAND_ACCENT_PROSE,
  COMPOSITION_PROSE,
  PALETTE_PROSE,
  RESEARCH_IMAGE_HARD_CONSTRAINTS,
  RESEARCH_IMAGE_STYLE,
  SETTING_PROSE,
} from "./style";
import type { ResearchVisualPlan } from "./types";

/**
 * The image model receives four separate layers.
 * It does not invent the style, the study scene, or the diversity choices.
 */
export function buildResearchImagePrompt(input: {
  plan: ResearchVisualPlan;
  scene: string;
  concerns: string[];
  metabolic: boolean;
}): string {
  const plan = input.plan;
  const lines = [
    "A. FIXED STYLE",
    RESEARCH_IMAGE_STYLE.prompt,
    "",
    "B. STUDY-SPECIFIC SUBJECT",
    `Activity: ${plan.activity}.`,
    `Scene: ${input.scene}.`,
    `Setting: ${SETTING_PROSE[plan.setting]}.`,
    "Show the activity itself. The image represents the topic and the intervention, not a measured result.",
    "Do not illustrate a measured result or a change in health.",
    `Study context, which must not appear as written text: ${input.concerns.join(", ")}.`,
    "",
    "C. DIVERSITY PLAN",
    `Subject count: ${plan.subjectCount}.`,
    subjectDirection(plan),
    `Approximate age: ${plan.approximateAge}.`,
    `Composition: ${COMPOSITION_PROSE[plan.composition]}.`,
    `Supporting palette: ${PALETTE_PROSE[plan.supportingPalette]}. Use this palette for clothing, furniture, walls, and the floor.`,
    `Brand accent: ${BRAND_ACCENT_PROSE[plan.brandAccent]}.`,
    "Keep approximately one or two subtle mint or teal cues. Mint and teal must not also be the shirt, the floor, the furniture, the wall, and the exercise mat.",
    `Key prop: ${plan.keyProps.join(", ")}.`,
    "Do not add a decorative plant, a pale cabinet, and a mint wall as a default set.",
    "Keep the frame wide and landscape. Keep the activity readable if the card is cropped. Do not use an extreme camera angle.",
    appearanceDirection(plan),
    "",
    "D. HARD CONSTRAINTS",
    RESEARCH_IMAGE_HARD_CONSTRAINTS,
    input.metabolic
      ? "A metabolic context is not a device or a chart. Do not show glucose meters, insulin, medical devices, or disease stereotypes."
      : "Do not show medical devices or disease stereotypes.",
  ];
  return lines.join("\n");
}

function subjectDirection(plan: ResearchVisualPlan): string {
  if (plan.subjectCount === "none" || plan.subjectPresentation === "none") {
    return "No person is visible. Show the activity through the place and the key prop.";
  }
  const age =
    plan.approximateAge === "older"
      ? "older "
      : plan.approximateAge === "young-adult"
        ? "young "
        : "";
  if (plan.subjectCount === "group") {
    if (plan.subjectPresentation === "male") {
      return `Draw a small group of ${age}male-presenting adults. Do not draw a single woman as the subject.`;
    }
    if (plan.subjectPresentation === "female") {
      return `Draw a small group of ${age}female-presenting adults. Do not draw a single man as the subject.`;
    }
    return `Draw a small mixed group of ${age}adults.`;
  }
  if (plan.subjectCount === "two" || plan.subjectPresentation === "mixed-pair") {
    return `Draw two ${age}adults together, one male-presenting and one female-presenting.`;
  }
  if (plan.subjectPresentation === "male") {
    return `Draw one ${age}male-presenting adult. Do not draw a female-presenting subject.`;
  }
  if (plan.subjectPresentation === "female") {
    return `Draw one ${age}female-presenting adult. Do not draw a male-presenting subject.`;
  }
  return `Draw one ${age}adult with a gender-neutral presentation.`;
}

function appearanceDirection(plan: ResearchVisualPlan): string {
  if (plan.appearanceVariation === "none" || plan.subjectCount === "none") {
    return "No skin tone is specified because no person is visible.";
  }
  return `Appearance variation, chosen only to vary the library and not from the study: ${APPEARANCE_PROSE[plan.appearanceVariation]}.`;
}
