/**
 * Single Hebrew scientific glossary for Snacksmate localization.
 *
 * Prompts, quality checks, and review notes all read this list.
 * Add a term here instead of writing it into a prompt or a component.
 */
export type GlossaryEntry = {
  id: string;
  /** English forms. Longer phrases are matched before shorter ones. */
  sources: readonly string[];
  /** Accepted Hebrew renderings. Any one of them satisfies a quality check. */
  hebrew: readonly string[];
  /** Usage note printed with the entry. Keep terminology rules here. */
  usage?: string;
};

export const HEBREW_SCIENTIFIC_GLOSSARY: readonly GlossaryEntry[] = [
  {
    id: "exercise-snacking",
    sources: ["exercise snacking", "exercise-snacking"],
    hebrew: ["נשנושי כושר", "ביצוע נשנושי כושר"],
    usage: "Use נשנושי כושר or ביצוע נשנושי כושר according to grammar.",
  },
  {
    id: "exercise-snacks",
    sources: ["exercise snacks", "exercise-snacks"],
    hebrew: ["נשנושי כושר"],
  },
  {
    id: "exercise-snack",
    sources: ["exercise snack", "exercise-snack"],
    hebrew: ["נשנוש כושר"],
  },
  {
    id: "vilpa-phrase",
    sources: ["vigorous intermittent lifestyle physical activity"],
    hebrew: ["פעילות גופנית עצימה לסירוגין כחלק מחיי היום־יום (VILPA)"],
  },
  {
    id: "vilpa",
    sources: ["VILPA"],
    hebrew: ["VILPA"],
    usage: "Do not translate the acronym.",
  },
  {
    id: "cardiorespiratory-fitness",
    sources: ["cardiorespiratory fitness"],
    hebrew: ["כושר לב־ריאה"],
  },
  {
    id: "sedentary-behavior",
    sources: ["sedentary behavior"],
    hebrew: ["התנהגות יושבנית"],
    usage:
      "When sedentary describes participants, write בעל אורח חיים יושבני or בעלי אורח חיים יושבני. Keep התנהגות יושבנית when sedentary behavior is the outcome or the exposure. Do not write בעלי התנהגות יושבנית for participants. Never write ישיבה התנהגותית.",
  },
  {
    id: "physically-inactive",
    sources: ["physically inactive"],
    hebrew: ["לא פעיל גופנית", "בעל רמת פעילות גופנית נמוכה"],
    usage: "Choose the alternative that fits the sentence.",
  },
  {
    id: "postprandial-glucose",
    sources: ["postprandial glucose"],
    hebrew: ["גלוקוז לאחר הארוחה"],
  },
  {
    id: "postprandial-response",
    sources: ["postprandial response"],
    hebrew: ["תגובה לאחר הארוחה"],
  },
  {
    id: "blood-flow-restriction",
    sources: ["blood flow restriction"],
    hebrew: ["הגבלת זרימת דם (BFR)"],
  },
  {
    id: "fat-oxidation",
    sources: ["fat oxidation"],
    hebrew: ["חמצון שומנים"],
  },
  {
    id: "energy-expenditure",
    sources: ["energy expenditure"],
    hebrew: ["הוצאה אנרגטית"],
  },
  {
    id: "randomized-controlled-trial",
    sources: ["randomized controlled trial"],
    hebrew: ["ניסוי אקראי מבוקר"],
  },
  {
    id: "crossover-study",
    sources: ["crossover study"],
    hebrew: ["מחקר מוצלב", "ניסוי מוצלב"],
    usage:
      "מחקר מוצלב and ניסוי מוצלב are both acceptable. ניסוי מוצלב אקראי is valid professional Hebrew.",
  },
  {
    id: "cohort-study",
    sources: ["cohort study"],
    hebrew: ["מחקר עוקבה"],
  },
  {
    id: "cross-sectional-study",
    sources: ["cross-sectional study"],
    hebrew: ["מחקר חתך"],
  },
  {
    id: "observational-study",
    sources: ["observational study"],
    hebrew: ["מחקר תצפיתי"],
  },
  {
    id: "systematic-review",
    sources: ["systematic review"],
    hebrew: ["סקירה שיטתית"],
  },
  {
    id: "meta-analysis",
    sources: ["meta-analysis"],
    hebrew: ["מטא-אנליזה"],
  },
  {
    id: "umbrella-review",
    sources: ["umbrella review"],
    hebrew: ["סקירת-על"],
    usage: "Never write מטריית or סקירת מטרייה.",
  },
  {
    id: "scoping-review",
    sources: ["scoping review"],
    hebrew: ["סקירת היקף"],
  },
  {
    id: "evidence-map",
    sources: ["evidence map"],
    hebrew: ["מיפוי הראיות"],
  },
  {
    id: "pilot-study",
    sources: ["pilot study"],
    hebrew: ["מחקר פיילוט", "מחקר חלוץ"],
    usage: "Choose מחקר פיילוט or מחקר חלוץ according to the sentence.",
  },
  {
    id: "feasibility-study",
    sources: ["feasibility study"],
    hebrew: ["מחקר היתכנות"],
  },
  {
    id: "statistically-significant",
    sources: ["statistically significant"],
    hebrew: ["מובהק סטטיסטית"],
  },
  {
    id: "confidence-interval",
    sources: ["confidence interval"],
    hebrew: ["רווח בר-סמך"],
  },
  {
    id: "association",
    sources: ["association", "associated"],
    hebrew: ["קשר"],
    usage:
      "Use this for an observational association. Do not translate it as a causal effect, and do not write הפחית, גרם, or השפעה סיבתית in its place. In a randomized or crossover intervention, describe the observed contrast instead of נמצא קשר or נקשר ל־.",
  },
  {
    id: "risk",
    sources: ["risk"],
    hebrew: ["סיכון"],
  },
  {
    id: "outcome",
    sources: ["outcome", "outcomes"],
    hebrew: ["תוצא", "מדד תוצאה", "מדדים"],
    usage: "Use תוצא or מדד תוצאה according to context. מדדים is acceptable for a list of outcomes.",
  },
  {
    id: "auc",
    sources: ["AUC"],
    hebrew: ["שטח מתחת לעקומה (AUC)"],
    usage: "Keep the acronym AUC.",
  },
  {
    id: "vo2peak",
    sources: ["VO2peak", "VO2 peak"],
    hebrew: ["VO₂peak"],
    usage:
      "Keep VO₂peak. Add צריכת חמצן מרבית or צריכת חמצן שיאית only when a short explanation helps a general reader.",
  },
];

export const FORBIDDEN_HEBREW_LITERALS = [
  {
    id: "exercise-snack-literal",
    pattern: "נשנוש תרגיל",
    reason: "Use נשנוש כושר.",
  },
  {
    id: "umbrella-literal",
    pattern: "מטריית",
    reason: "Use סקירת-על for an umbrella review.",
  },
  {
    id: "vilpa-literal",
    pattern: "פעילות חיים נמרצת",
    reason: "Use פעילות גופנית עצימה לסירוגין כחלק מחיי היום־יום (VILPA).",
  },
  {
    id: "sedentary-literal",
    pattern: "ישיבה התנהגותית",
    reason: "Use התנהגות יושבנית for the behavior, or בעל אורח חיים יושבני for a participant.",
  },
] as const;

export type AcronymRule = {
  id: string;
  source: RegExp;
  accept: RegExp;
};

/** Acronyms that must survive localization when they appear in the source. */
export const PRESERVED_ACRONYMS: readonly AcronymRule[] = [
  { id: "VILPA", source: /\bVILPA\b/, accept: /VILPA/ },
  { id: "AUC", source: /\bAUC\b/, accept: /AUC/ },
  { id: "BFR", source: /\bBFR\b/, accept: /BFR/ },
  {
    id: "VO2peak",
    source: /VO₂peak|\bVO2\s*peak\b/i,
    accept: /VO₂peak|\bVO2\s*peak\b/i,
  },
];

export function glossaryPromptLines(): string {
  return HEBREW_SCIENTIFIC_GLOSSARY.map((entry) => {
    const line = `- ${entry.sources.join(" / ")} → ${entry.hebrew.join(" / ")}`;
    return entry.usage ? `${line}. ${entry.usage}` : line;
  }).join("\n");
}

export function forbiddenLiteralLines(): string {
  return FORBIDDEN_HEBREW_LITERALS.map(
    (item) => `- Never write "${item.pattern}". ${item.reason}`,
  ).join("\n");
}

export type GlossaryMatch = {
  id: string;
  hebrew: readonly string[];
};

/**
 * Terms the Hebrew text must contain because their English form appears in the source.
 * Longer entries win, so "exercise snacks" does not also require the singular term.
 */
export function glossaryMatches(sourceText: string): GlossaryMatch[] {
  const entries = [...HEBREW_SCIENTIFIC_GLOSSARY].sort((left, right) => {
    return longest(right.sources) - longest(left.sources);
  });
  let remaining = sourceText;
  const matches: GlossaryMatch[] = [];

  for (const entry of entries) {
    let matched = false;
    for (const source of entry.sources) {
      const pattern = new RegExp(`\\b${escapeRegExp(source)}\\b`, "gi");
      const next = remaining.replace(pattern, " ");
      if (next === remaining) continue;
      matched = true;
      remaining = next;
    }
    if (matched) matches.push({ id: entry.id, hebrew: entry.hebrew });
  }

  return matches;
}

export function missingGlossaryTerms(sourceText: string, translatedText: string): GlossaryMatch[] {
  return glossaryMatches(sourceText).filter(
    (match) => !match.hebrew.some((hebrew) => translatedText.includes(hebrew)),
  );
}

function longest(values: readonly string[]): number {
  return values.reduce((max, value) => Math.max(max, value.length), 0);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
