import { buildResearchImagePrompt } from "./prompt";
import type { ActivityId, DiversityHistoryEntry, PopulationId, ResearchImageDocument, VisualBrief } from "./types";
import { buildResearchVisualPlan, sceneForPlan } from "./visual-plan";
import { COMPOSITION_PROSE, SETTING_PROSE } from "./style";

const ACTIVITY_RULES: readonly { id: ActivityId; pattern: RegExp }[] = [
  {
    id: "stair-climbing",
    pattern: /\b(stair(?:s|case)?|stair[-\s]?climbing|climbing stairs)\b/i,
  },
  {
    id: "cycling",
    pattern: /\b(cycling|bicycle|bike|cycle ergometer|stationary cycl(?:e|ing)|ergometer)\b/i,
  },
  {
    id: "resistance",
    pattern: /\b(resistance(?:\s+exercise|\s+training)?|strength training|body-?weight|push-?ups?|squats?|weight training)\b/i,
  },
  {
    id: "walking",
    pattern: /\b(walking|ambulation|brisk walk)\b/i,
  },
  {
    id: "sedentary-interruption",
    pattern:
      /\b(sedentary interruption|sedentary breaks?|breaking up (?:prolonged )?sitting|sit(?:ting)? breaks?|prolonged sitting|interrupt(?:ing|ion of)? (?:prolonged )?sitting)\b/i,
  },
  {
    id: "vilpa",
    pattern: /\b(vilpa|vigorous intermittent lifestyle physical activity)\b/i,
  },
  {
    id: "exercise-snack",
    pattern: /\bexercise[\s-]*snack(?:s|ing)?\b/i,
  },
];

const CONCERN_LABEL: Record<ActivityId, string> = {
  "stair-climbing": "stair climbing",
  cycling: "cycling",
  resistance: "resistance exercise",
  walking: "walking",
  "sedentary-interruption": "sedentary interruption",
  vilpa: "VILPA",
  "exercise-snack": "exercise snacks",
  "general-activity": "physical activity",
};

/**
 * Turn one Research document into a visual brief.
 * The study chooses the activity. The diversity planner chooses the scene.
 */
export function buildResearchVisualBrief(
  document: ResearchImageDocument,
  variantKey = document._id,
  history: readonly DiversityHistoryEntry[] = [],
): VisualBrief {
  const intervention = plainText(document.intervention);
  const title = document.title?.trim() ?? "";
  const excerpt = document.excerpt?.trim() ?? "";
  const populationText = document.population?.trim() ?? "";
  const rest = [
    document.seoTitle,
    document.topic,
    document.studyDesign,
    populationText,
    plainText(document.outcomes),
    plainText(document.mainFindings),
    plainText(document.practicalInterpretation),
  ]
    .filter((part): part is string => Boolean(part?.trim()))
    .join("\n");

  let activity = detectActivity([intervention, title, excerpt, rest]);
  const topic = document.topic?.trim();
  if (activity === "general-activity") {
    if (topic === "vilpa") activity = "vilpa";
    else if (topic === "sedentary-behavior") activity = "sedentary-interruption";
    else if (topic === "exercise-snacks") activity = "exercise-snack";
  }

  let population = detectPopulation(populationText || `${title}\n${excerpt}\n${rest}`);
  if (population === "unspecified" && topic === "older-adults") population = "older-adult";
  if (population === "unspecified" && /\b(adults?|participants?|men|women|people)\b/i.test(populationText)) {
    population = "adult";
  }

  const corpus = [intervention, title, excerpt, populationText, rest].filter(Boolean).join("\n");
  const metabolic = /\b(glucose|glycemic|glycaemic|insulin|diabetes|metabolic)\b/i.test(corpus);
  const concerns = new Set<string>([CONCERN_LABEL[activity]]);
  if (/\b(vilpa|vigorous intermittent lifestyle physical activity)\b/i.test(corpus) || topic === "vilpa") {
    concerns.add("VILPA");
  }
  if (/\bexercise[\s-]*snack(?:s|ing)?\b/i.test(corpus) || topic === "exercise-snacks") {
    concerns.add("exercise snacks");
  }
  if (population === "older-adult") concerns.add("older adults");
  if (population === "young-adult") concerns.add("young adults");
  if (metabolic) concerns.add("metabolic response");

  const plan = buildResearchVisualPlan({
    seed: variantKey,
    activity,
    population,
    corpus,
    history,
  });

  return {
    activity,
    population,
    setting: SETTING_PROSE[plan.setting],
    scene: sceneForPlan(plan),
    concerns: [...concerns],
    metabolic,
    variant: COMPOSITION_PROSE[plan.composition],
    plan,
  };
}

export function buildImagePrompt(brief: VisualBrief): string {
  return buildResearchImagePrompt({
    plan: brief.plan,
    scene: brief.scene,
    concerns: brief.concerns,
    metabolic: brief.metabolic,
  });
}

export { buildResearchImagePrompt } from "./prompt";
export { buildResearchVisualPlan } from "./visual-plan";

function detectActivity(parts: readonly string[]): ActivityId {
  for (const part of parts) {
    if (!part.trim()) continue;
    const match = ACTIVITY_RULES.find((rule) => rule.pattern.test(part));
    if (match) return match.id;
  }
  return "general-activity";
}

function detectPopulation(text: string): PopulationId {
  if (/\b(older adults?|elderly|older people|older men|older women)\b/i.test(text)) {
    return "older-adult";
  }
  if (/\b(college students?|university students?|young adults?)\b/i.test(text)) {
    return "young-adult";
  }
  return "unspecified";
}

export function plainText(value: unknown): string {
  if (typeof value === "string") return value.replace(/\s+/g, " ").trim();
  if (!Array.isArray(value)) return "";
  return value
    .map((block) => {
      if (typeof block === "string") return block;
      if (!block || typeof block !== "object") return "";
      if ("text" in block && typeof block.text === "string") return block.text;
      if (!("children" in block) || !Array.isArray(block.children)) return "";
      return block.children
        .map((child: unknown) => {
          if (!child || typeof child !== "object" || !("text" in child)) return "";
          return typeof child.text === "string" ? child.text : "";
        })
        .join("");
    })
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}
