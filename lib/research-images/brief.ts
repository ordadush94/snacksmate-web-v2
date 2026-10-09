import type { ActivityId, PopulationId, ResearchImageDocument, VisualBrief } from "./types";

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

const ACTIVITY_SCENE: Record<ActivityId, string> = {
  "stair-climbing": "moving briskly up a short flight of stairs",
  cycling: "performing a brief stationary cycling session on a simple exercise bike",
  resistance: "performing one simple resistance movement, such as a slow bodyweight squat",
  walking: "taking a short walk along a quiet path",
  "sedentary-interruption": "standing up from a desk chair to begin a short movement break",
  vilpa: "doing a brief burst of vigorous everyday movement, such as climbing a few stairs or carrying a small bag",
  "exercise-snack": "performing a short, simple bout of exercise in an ordinary room",
  "general-activity": "doing a short bout of everyday physical activity",
};

const ACTIVITY_SETTING: Record<ActivityId, string> = {
  "stair-climbing": "a bright, uncluttered indoor stairwell",
  cycling: "a bright, uncluttered indoor room",
  resistance: "a calm home or studio with an open floor",
  walking: "a simple outdoor path or a bright indoor corridor",
  "sedentary-interruption": "a calm office with a desk and chair",
  vilpa: "an ordinary indoor everyday setting",
  "exercise-snack": "a simple indoor room with plenty of open space",
  "general-activity": "a neutral, uncluttered indoor setting",
};

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

const VARIANTS = [
  "Composition: three-quarter view, with the person slightly left of center.",
  "Composition: a calm side view, with open space around the person.",
  "Composition: eye-level view, with the person right of center.",
  "Composition: a little foreground space, with the person near the middle of the frame.",
];

const STYLE = [
  "Modern editorial illustration for a scientific physical-activity evidence hub.",
  "Clean, friendly, professional, and restrained rather than childish.",
  "Soft mint and teal accents (#24dc9d, #0f9f72, #c8f5e9) on a neutral fog or off-white background (#f3faf7).",
  "Clear human subject, moderate visual depth, uncluttered composition.",
  "Inclusive, neutral representation. Do not infer race, ethnicity, or socioeconomic status.",
  "Suitable for both English and Hebrew pages. Do not include any writing system.",
].join(" ");

/**
 * Turn one Research document into a visual brief.
 * The brief names the activity and setting. It does not carry statistical findings.
 */
export function buildResearchVisualBrief(
  document: ResearchImageDocument,
  variantKey = document._id,
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

  const corpus = [intervention, title, excerpt, rest].filter(Boolean).join("\n");
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

  return {
    activity,
    population,
    setting: ACTIVITY_SETTING[activity],
    scene: `${populationPhrase(population)} ${ACTIVITY_SCENE[activity]}`,
    concerns: [...concerns],
    metabolic,
    variant: VARIANTS[stableIndex(variantKey, VARIANTS.length)],
  };
}

export function buildImagePrompt(brief: VisualBrief): string {
  const lines = [
    "Create one landscape editorial cover illustration.",
    `Scene: ${brief.scene}.`,
    `Setting: ${brief.setting}.`,
    personDirection(brief.population),
    brief.variant,
    `Study context, which must not appear as written text: ${brief.concerns.join(", ")}.`,
    STYLE,
    "Show the activity itself. Do not illustrate a measured result or a change in health.",
    "Do not create before-and-after imagery.",
    brief.metabolic
      ? "A metabolic context is not a device or a chart. Do not show glucose meters, insulin, medical devices, or disease stereotypes."
      : "Do not show medical devices or disease stereotypes.",
    "Mandatory: no text, no titles, no words, no letters, no numbers, no captions, no charts, no graphs, no data labels, no logos, no app interface, no watermarks, no DOI, and no scientific paper title.",
  ];
  return lines.join("\n");
}

export function populationPhrase(population: PopulationId): string {
  if (population === "older-adult") return "An older adult";
  if (population === "young-adult") return "A young adult";
  return "An adult";
}

function personDirection(population: PopulationId): string {
  if (population === "older-adult") {
    return "The person is an older adult: capable and age-appropriate, not a frailty stereotype.";
  }
  if (population === "young-adult") {
    return "The person is a young adult in an ordinary setting.";
  }
  return "The person is an adult. Do not signal a specific ethnicity or social class.";
}

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

function stableIndex(value: string, count: number): number {
  const text = String(value ?? "study");
  let hash = 0;
  for (const char of text) hash = (hash * 33 + char.charCodeAt(0)) >>> 0;
  return count > 0 ? hash % count : 0;
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
