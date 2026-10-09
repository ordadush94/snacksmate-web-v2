import type {
  ActivityId,
  AppearanceVariation,
  ApproximateAge,
  BrandAccentId,
  CompositionId,
  DiversityHistoryEntry,
  PopulationId,
  ResearchVisualPlan,
  SettingFamily,
  SettingId,
  SubjectCount,
  SubjectPresentation,
  SupportingPaletteId,
} from "./types";

const PALETTES: readonly SupportingPaletteId[] = [
  "muted-blue",
  "warm-sand",
  "soft-peach",
  "muted-coral",
  "soft-lavender",
  "warm-neutral",
  "sage",
  "light-terracotta",
];

const BRAND_ACCENTS: readonly BrandAccentId[] = [
  "clothing-accent",
  "accessory",
  "architectural",
  "equipment-accent",
];

const APPEARANCES: readonly Exclude<AppearanceVariation, "none">[] = ["light", "medium", "deep", "olive"];

const VILPA_FOCUSES = [
  { id: "stairs", prop: "brisk stair climbing", pattern: /stair/i },
  { id: "carry", prop: "carrying a few everyday items", pattern: /carry|carrying|\bload\b/i },
  { id: "uphill", prop: "fast uphill walking", pattern: /uphill|incline|\bhill\b/i },
] as const;

const RESISTANCE_PROPS = ["a bodyweight squat", "a resistance band", "light dumbbells"] as const;

const HOME_PATTERN = /\b(at home|home-based|home based|in the home|household|home exercise)\b/i;
const WORKPLACE_PATTERN = /\b(workplace|office|at work|worksite|desk-based|desk based)\b/i;
const OUTDOOR_PATTERN = /\b(outdoor|outdoors|park|sidewalk|neighbourhood|neighborhood|walking path)\b/i;
const CAMPUS_PATTERN = /\b(university|college|campus|students?)\b/i;
const GYM_PATTERN = /\b(gym|fitness cent(?:er|re))\b/i;
const LAB_PATTERN = /\b(laboratory|cycle ergometer|ergometer|in the lab|each participant performed)\b/i;
const TREADMILL_PATTERN = /\btreadmill\b/i;

export type SubjectChoice = {
  subjectCount: SubjectCount;
  subjectPresentation: SubjectPresentation;
};

export type SexConstraint = "male" | "female" | "mixed" | "unspecified";

export type DiversityConstraints = {
  subjects: readonly SubjectChoice[];
  presentationLocked: boolean;
  settings: readonly SettingId[];
  settingLocked: boolean;
  palettes: readonly SupportingPaletteId[];
  approximateAge: ApproximateAge;
};

export function stableIndex(value: string, count: number): number {
  const text = String(value ?? "study");
  let hash = 2166136261;
  for (const char of text) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return count > 0 ? (hash >>> 0) % count : 0;
}

export function pickStable<T>(seed: string, salt: string, options: readonly T[]): T {
  if (options.length === 0) {
    throw new Error(`No eligible visual option for ${salt}.`);
  }
  const choice = options[stableIndex(`${seed}:${salt}`, options.length)];
  if (choice === undefined) throw new Error(`No eligible visual option for ${salt}.`);
  return choice;
}

export function settingFamily(setting: SettingId): SettingFamily {
  if (setting === "home" || setting === "home-exercise-corner") return "home";
  if (setting === "office" || setting === "workplace-corridor") return "office";
  if (setting === "staircase") return "stairs";
  if (setting === "outdoor-urban" || setting === "park") return "outdoors";
  if (setting === "gym") return "gym";
  return "other";
}

export function detectSexConstraint(text: string): SexConstraint {
  const male = /\b(men|male|males)\b/i.test(text);
  const female = /\b(women|woman|female|females)\b/i.test(text);
  if (male && female) return "mixed";
  if (male) return "male";
  if (female) return "female";
  return "unspecified";
}

export function compositionsFor(count: SubjectCount): readonly CompositionId[] {
  if (count === "none") return ["equipment-focus", "wide-environmental", "activity-focus"];
  if (count === "two") return ["two-person", "wide-environmental", "asymmetrical", "medium-activity"];
  if (count === "group") return ["wide-environmental", "medium-activity", "slightly-elevated", "asymmetrical"];
  return [
    "medium-activity",
    "side-profile",
    "three-quarter",
    "slightly-elevated",
    "activity-focus",
    "asymmetrical",
    "equipment-focus",
    "movement-no-face",
  ];
}

export function diversityConstraints(input: {
  activity: ActivityId;
  population: PopulationId;
  corpus: string;
}): DiversityConstraints {
  const sex = detectSexConstraint(input.corpus);
  const lab = LAB_PATTERN.test(input.corpus);
  const populationSpecific =
    input.population === "older-adult" || input.population === "young-adult" || sex === "male" || sex === "female";
  const subjects: SubjectChoice[] = [];

  if (sex === "male") {
    subjects.push({ subjectCount: "one", subjectPresentation: "male" });
    if (!lab) subjects.push({ subjectCount: "group", subjectPresentation: "male" });
  } else if (sex === "female") {
    subjects.push({ subjectCount: "one", subjectPresentation: "female" });
    if (!lab) subjects.push({ subjectCount: "group", subjectPresentation: "female" });
  } else {
    subjects.push(
      { subjectCount: "one", subjectPresentation: "male" },
      { subjectCount: "one", subjectPresentation: "female" },
      { subjectCount: "one", subjectPresentation: "gender-neutral" },
    );
    if (!lab) {
      subjects.push(
        { subjectCount: "two", subjectPresentation: "mixed-pair" },
        { subjectCount: "group", subjectPresentation: "small-group" },
      );
      if (!populationSpecific) subjects.push({ subjectCount: "none", subjectPresentation: "none" });
    }
  }

  const settings = eligibleSettings(input.activity, input.corpus);
  const families = new Set(settings.map(settingFamily));
  return {
    subjects,
    presentationLocked: new Set(subjects.map((choice) => choice.subjectPresentation)).size === 1,
    settings,
    settingLocked: families.size <= 1,
    palettes: PALETTES,
    approximateAge: ageFor(input.population),
  };
}

/**
 * Choose one reproducible visual plan for a study.
 * The same seed and the same recent-image history return the same plan.
 */
export function buildResearchVisualPlan(input: {
  seed: string;
  activity: ActivityId;
  population: PopulationId;
  corpus: string;
  history?: readonly DiversityHistoryEntry[];
}): ResearchVisualPlan {
  const constraints = diversityConstraints(input);
  const subject = pickStable(input.seed, "subject", constraints.subjects);
  const setting = pickStable(input.seed, "setting", constraints.settings);
  const baseline: ResearchVisualPlan = {
    activity: input.activity,
    setting,
    subjectCount: subject.subjectCount,
    subjectPresentation: subject.subjectPresentation,
    approximateAge: constraints.approximateAge,
    composition: pickStable(input.seed, "composition", compositionsFor(subject.subjectCount)),
    supportingPalette: pickStable(input.seed, "palette", constraints.palettes),
    keyProps: keyPropsFor(input.activity, setting, input.seed, input.corpus),
    brandAccent: pickStable(input.seed, "accent", BRAND_ACCENTS),
    appearanceVariation:
      subject.subjectCount === "none" ? "none" : pickStable(input.seed, "appearance", APPEARANCES),
    rationale: baselineRationale(input.activity, subject, setting, constraints.approximateAge),
  };
  return applyRecentImageHistory(baseline, input.history ?? [], constraints, input.seed, input.corpus);
}

/**
 * Nudge a stable baseline away from the last few generated images.
 * Scientific constraints stay in place when the study requires them.
 */
export function applyRecentImageHistory(
  plan: ResearchVisualPlan,
  history: readonly DiversityHistoryEntry[],
  constraints: DiversityConstraints,
  seed: string,
  corpus = "",
): ResearchVisualPlan {
  const recent = history.slice(0, 12);
  const last2 = recent.slice(0, 2);
  const last5 = recent.slice(0, 5);
  const next: ResearchVisualPlan = { ...plan, keyProps: [...plan.keyProps] };
  const notes: string[] = [];

  if (last2.length === 2 && last2[0]?.subjectPresentation === last2[1]?.subjectPresentation) {
    const repeated = last2[0]?.subjectPresentation;
    if (repeated && next.subjectPresentation === repeated) {
      const alternatives = constraints.subjects.filter((choice) => choice.subjectPresentation !== repeated);
      if (!constraints.presentationLocked && alternatives.length > 0) {
        const choice = pickStable(seed, "history-subject", alternatives);
        next.subjectCount = choice.subjectCount;
        next.subjectPresentation = choice.subjectPresentation;
        next.appearanceVariation = next.subjectCount === "none" ? "none" : next.appearanceVariation === "none"
          ? pickStable(seed, "appearance", APPEARANCES)
          : next.appearanceVariation;
        next.composition = pickStable(seed, "history-composition", compositionsFor(next.subjectCount));
        notes.push(`Subject presentation changes because the previous two images used ${repeated}.`);
      } else if (constraints.presentationLocked) {
        notes.push(`Subject presentation stays ${repeated} because the study population requires it.`);
      }
    }
  }

  const repeatedFamily = sharedFamily(last2);
  if (repeatedFamily && settingFamily(next.setting) === repeatedFamily) {
    const moved = moveSetting(next, constraints, seed, "history-setting", repeatedFamily, corpus);
    if (moved) notes.push(`Setting changes because the previous two images used ${repeatedFamily}.`);
    else if (constraints.settingLocked) {
      notes.push(`Setting stays in ${repeatedFamily} because the study context requires it.`);
    }
  }

  const crowdedFamily = crowdedSettingFamily(last5);
  if (crowdedFamily && settingFamily(next.setting) === crowdedFamily) {
    const moved = moveSetting(next, constraints, seed, "history-setting-cap", crowdedFamily, corpus);
    if (moved) {
      notes.push(`Setting changes because three of the last five images used ${crowdedFamily}.`);
    }
  }

  const paletteCount = last5.filter((entry) => entry.supportingPalette === next.supportingPalette).length;
  if (paletteCount >= 3) {
    const alternatives = constraints.palettes.filter((palette) => palette !== next.supportingPalette);
    if (alternatives.length > 0) {
      next.supportingPalette = pickStable(seed, "history-palette", alternatives);
      notes.push("Supporting palette changes because it appeared in three of the last five images.");
    }
  }

  if (
    next.appearanceVariation !== "none" &&
    last2.length === 2 &&
    last2[0]?.appearanceVariation === last2[1]?.appearanceVariation &&
    next.appearanceVariation === last2[0]?.appearanceVariation
  ) {
    const alternatives = APPEARANCES.filter((appearance) => appearance !== next.appearanceVariation);
    if (alternatives.length > 0) {
      next.appearanceVariation = pickStable(seed, "history-appearance", alternatives);
      notes.push("Appearance changes because the previous two images matched. It is not taken from the study.");
    }
  }

  if (recent.some((entry) => comboOf(entry) === comboOf(next))) {
    const compositions = compositionsFor(next.subjectCount).filter((composition) => composition !== next.composition);
    if (compositions.length > 0) {
      next.composition = pickStable(seed, "history-composition-combo", compositions);
    }
    const palettes = constraints.palettes.filter((palette) => palette !== next.supportingPalette);
    if (palettes.length > 0) {
      next.supportingPalette = pickStable(seed, "history-palette-combo", palettes);
    }
    notes.push("Composition and supporting palette change so this combination is not repeated.");
  }

  if (!compositionsFor(next.subjectCount).includes(next.composition)) {
    next.composition = pickStable(seed, "composition-repair", compositionsFor(next.subjectCount));
  }
  if (next.subjectCount === "none") next.appearanceVariation = "none";
  if (next.subjectCount !== "none" && next.appearanceVariation === "none") {
    next.appearanceVariation = pickStable(seed, "appearance-repair", APPEARANCES);
  }
  next.rationale = [plan.rationale, ...notes].filter(Boolean).join(" ");
  return next;
}

export function sceneForPlan(plan: ResearchVisualPlan): string {
  switch (plan.activity) {
    case "cycling":
      return "a brief stationary cycling session on a stationary bike or cycle ergometer";
    case "stair-climbing":
      return "a brief bout of stair climbing on a staircase";
    case "resistance":
      return `a short resistance exercise: ${plan.keyProps[0] ?? "one simple movement"}`;
    case "walking":
      return "a short bout of walking";
    case "sedentary-interruption":
      return "getting up from a workstation to interrupt sitting";
    case "vilpa":
      return `a brief burst of vigorous everyday activity: ${plan.keyProps[0] ?? "brisk everyday movement"}`;
    case "exercise-snack":
      return "a short exercise snack, a brief bout of simple movement";
    default:
      return "a short bout of everyday physical activity";
  }
}

function moveSetting(
  plan: ResearchVisualPlan,
  constraints: DiversityConstraints,
  seed: string,
  salt: string,
  family: SettingFamily,
  corpus: string,
): boolean {
  if (constraints.settingLocked) return false;
  const alternatives = constraints.settings.filter((setting) => settingFamily(setting) !== family);
  if (alternatives.length === 0) return false;
  plan.setting = pickStable(seed, salt, alternatives);
  plan.keyProps = keyPropsFor(plan.activity, plan.setting, seed, corpus);
  return true;
}

function sharedFamily(entries: readonly DiversityHistoryEntry[]): SettingFamily | null {
  if (entries.length < 2) return null;
  const first = entries[0];
  const second = entries[1];
  if (!first || !second) return null;
  const family = settingFamily(first.setting);
  return family === settingFamily(second.setting) ? family : null;
}

function crowdedSettingFamily(entries: readonly DiversityHistoryEntry[]): SettingFamily | null {
  const counts = new Map<SettingFamily, number>();
  for (const entry of entries) {
    const family = settingFamily(entry.setting);
    counts.set(family, (counts.get(family) ?? 0) + 1);
  }
  let crowded: SettingFamily | null = null;
  for (const [family, count] of counts) {
    if (count >= 3) crowded = family;
  }
  return crowded;
}

function comboOf(entry: {
  subjectPresentation: SubjectPresentation;
  setting: SettingId;
  activity: ActivityId;
  composition: CompositionId;
  supportingPalette: SupportingPaletteId;
}): string {
  return [
    entry.subjectPresentation,
    entry.setting,
    entry.activity,
    entry.composition,
    entry.supportingPalette,
  ].join("|");
}

function ageFor(population: PopulationId): ApproximateAge {
  if (population === "older-adult") return "older";
  if (population === "young-adult") return "young-adult";
  return "adult";
}

function baselineRationale(
  activity: ActivityId,
  subject: SubjectChoice,
  setting: SettingId,
  age: ApproximateAge,
): string {
  return [
    `Activity ${activity} follows the study.`,
    `Age ${age} follows the described population.`,
    `Subject ${subject.subjectPresentation} (${subject.subjectCount}) is a stable choice among eligible options.`,
    `Setting ${setting} fits that activity.`,
    "Mint stays a brand accent. The supporting palette carries the rest of the image.",
    "Appearance variation is for the library only and is not inferred from the study.",
  ].join(" ");
}

function eligibleSettings(activity: ActivityId, corpus: string): SettingId[] {
  const home = HOME_PATTERN.test(corpus);
  const workplace = WORKPLACE_PATTERN.test(corpus);
  const outdoor = OUTDOOR_PATTERN.test(corpus);
  const campus = CAMPUS_PATTERN.test(corpus);
  const gym = GYM_PATTERN.test(corpus);
  const lab = LAB_PATTERN.test(corpus);
  const treadmill = TREADMILL_PATTERN.test(corpus);
  let settings: SettingId[] = [];

  if (activity === "stair-climbing") {
    settings = ["staircase"];
    if (workplace) settings.push("workplace-corridor");
    if (outdoor) settings.push("outdoor-urban");
    if (campus) settings.push("campus");
  } else if (activity === "walking") {
    if (treadmill) settings = ["gym", "home-exercise-corner"];
    else if (home && !outdoor) settings = ["home", "home-exercise-corner"];
    else {
      settings = ["park", "outdoor-urban"];
      if (workplace) settings.push("workplace-corridor");
      if (campus) settings.push("campus");
      if (home) settings.push("home");
    }
  } else if (activity === "cycling" || activity === "resistance") {
    if (lab) settings = ["gym", "studio"];
    else if (home && !workplace) settings = ["home", "home-exercise-corner"];
    else if (workplace && !home) settings = ["office", "gym", "studio"];
    else if (gym) settings = ["gym", "studio"];
    else {
      settings = ["home", "home-exercise-corner", "gym", "studio"];
      if (campus) settings.push("campus");
    }
  } else if (activity === "sedentary-interruption") {
    if (home && !workplace) settings = ["home"];
    else if (workplace && !home) settings = ["office", "workplace-corridor"];
    else if (home && workplace) settings = ["home", "office", "workplace-corridor"];
    else settings = ["office", "workplace-corridor"];
    if (campus && !home) settings.push("campus");
  } else if (activity === "vilpa") {
    if (/stair/i.test(corpus)) {
      settings = ["staircase"];
      if (outdoor) settings.push("outdoor-urban");
    } else {
      settings = ["staircase", "outdoor-urban", "park", "workplace-corridor"];
    }
  } else if (activity === "exercise-snack") {
    if (home && !workplace) settings = ["home", "home-exercise-corner"];
    else if (workplace && !home) settings = ["office", "workplace-corridor", "gym"];
    else {
      settings = ["home", "home-exercise-corner", "office", "gym", "studio"];
      if (campus) settings.push("campus");
    }
  } else {
    settings = ["studio", "park", "office", "gym", "outdoor-urban", "campus"];
    if (home) settings.unshift("home");
  }

  return [...new Set(settings)];
}

function keyPropsFor(activity: ActivityId, setting: SettingId, seed: string, corpus: string): string[] {
  if (activity === "stair-climbing") return ["staircase"];
  if (activity === "cycling") {
    return [setting === "gym" || setting === "studio" ? "cycle ergometer" : "stationary bike"];
  }
  if (activity === "resistance") return [pickStable(seed, "prop", RESISTANCE_PROPS)];
  if (activity === "walking") return [setting === "park" ? "walking path" : "paved path"];
  if (activity === "sedentary-interruption") return ["desk chair"];
  if (activity === "vilpa") return [vilpaProp(corpus, seed)];
  if (activity === "exercise-snack") return ["open floor"];
  return ["open space"];
}

function vilpaProp(corpus: string, seed: string): string {
  const mentioned = VILPA_FOCUSES.filter((focus) => focus.pattern.test(corpus));
  const pool = mentioned.length > 0 ? mentioned : VILPA_FOCUSES;
  return pickStable(seed, "vilpa", pool).prop;
}
