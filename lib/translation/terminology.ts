/**
 * Contextual Hebrew for "exercise snack".
 *
 * Preferred public terms:
 *   exercise snack → חטיף תנועה
 *   exercise snacks → חטיפי תנועה
 *
 * The older public terms stay in this file only so quality checks and the
 * one-off Sanity migration can recognize them. They are not preferred output.
 */

export const EXERCISE_SNACK_HEBREW_EXAMPLES = [
  { english: "exercise snack", hebrew: "חטיף תנועה" },
  { english: "exercise snacks", hebrew: "חטיפי תנועה" },
  { english: "a two-minute exercise snack", hebrew: "חטיף תנועה של שתי דקות" },
  { english: "exercise snacks throughout the day", hebrew: "חטיפי תנועה לאורך היום" },
  { english: "exercise-snacking intervention", hebrew: "התערבות המבוססת על חטיפי תנועה" },
  { english: "cycling exercise snack", hebrew: "חטיף תנועה ברכיבה" },
  { english: "participants performed exercise snacks", hebrew: "המשתתפים ביצעו חטיפי תנועה" },
  { english: "exercise snack protocol", hebrew: "פרוטוקול של חטיף תנועה" },
  { english: "exercise snack protocols", hebrew: "פרוטוקולים של חטיפי תנועה" },
  { english: "short exercise snacks", hebrew: "חטיפי תנועה קצרים" },
  { english: "stair-climbing exercise snacks", hebrew: "חטיפי תנועה המבוססים על עלייה במדרגות" },
] as const;

/** Outdated public Hebrew. Flag these in new reader-facing copy. */
export const OUTDATED_PUBLIC_HEBREW_TERMS = [
  "נשנושי הכושר",
  "נשנוש הכושר",
  "נשנושי כושר",
  "נשנוש כושר",
] as const;

/** Forms the migration and the model must not produce. */
export const AWKWARD_EXERCISE_SNACK_HEBREW = [
  "חטיפי תנועה כושר",
  "התערבות חטיף תנועה",
  "חטיף תנועהים",
  "חטיפי תנועה של פעילות",
  "ביצוע של חטיף תנועהים",
] as const;

export type ContextualReplacement = {
  from: string;
  to: string;
  reason: string;
};

/**
 * Reviewed phrases only. These are not a stem replacement for נשנוש.
 * Longer phrases come first. Tai chi stays a separate study arm.
 */
export const CONTEXTUAL_REPLACEMENTS: readonly ContextualReplacement[] = [
  {
    from: "נשנושי פעילות גופנית באמצעות",
    to: "חטיפי תנועה באמצעות",
    reason: "Exercise snacks performed through aerobic, resistance, or balance activity. Avoid חטיפי תנועה של פעילות.",
  },
  {
    from: "נשנוש קצר לכל הגוף, נשנוש כוח או נשנוש אינטרוולים קצר",
    to: "חטיף תנועה קצר לכל הגוף, חטיף תנועה לכוח, או חטיף תנועה קצר של אינטרוולים",
    reason: "Named Snacksmate sessions: full-body, strength, and interval.",
  },
  {
    from: "יעד שבועי של נשנושים",
    to: "יעד שבועי של חטיפי תנועה",
    reason: "The weekly count is a count of exercise snacks.",
  },
  {
    from: "והנשנושים שצברתם",
    to: "וחטיפי התנועה שצברתם",
    reason: "Snacks earned are completed exercise snacks.",
  },
  {
    from: "סופר נשנושים",
    to: "סופר חטיפי תנועה",
    reason: "The weekly goal counts exercise snacks.",
  },
  {
    from: "נשנושים קטנים. השפעה גדולה.",
    to: "חטיפי תנועה קטנים. השפעה גדולה.",
    reason: "Product slogan for the movement unit.",
  },
  {
    from: "אילו תנועות נכנסות לנשנוש",
    to: "אילו תנועות נכנסות לחטיף התנועה",
    reason: "Movements that go into one custom exercise snack.",
  },
  {
    from: "הנשנוש צריך לזוז יחד איתם",
    to: "חטיף התנועה צריך לזוז יחד איתם",
    reason: "The exercise snack should adapt with ability, space, and time.",
  },
  {
    from: "בונים נשנוש משלכם",
    to: "בונים חטיף תנועה משלכם",
    reason: "Building a custom exercise snack.",
  },
  {
    from: "בלי לוותר על הנשנוש",
    to: "בלי לוותר על חטיף התנועה",
    reason: "Keeping the exercise snack while changing an exercise.",
  },
  {
    from: "הנשנוש שמופיע",
    to: "חטיף התנועה שמופיע",
    reason: "The exercise snack shown on screen.",
  },
  {
    from: "כשהנשנוש נגמר",
    to: "כשחטיף התנועה נגמר",
    reason: "When the exercise snack ends.",
  },
  {
    from: "שהנשנוש בקושי עלה",
    to: "שחטיף התנועה בקושי עלה",
    reason: "Very easy means the session barely rose above the rest of the day. The comparison stays.",
  },
  {
    from: "הנשנוש היה המפגש",
    to: "חטיף התנועה היה המפגש",
    reason: "The exercise snack is the session being rated.",
  },
  {
    from: "אם הנשנוש היה שווה",
    to: "אם חטיף התנועה היה שווה",
    reason: "Whether that exercise snack was worth doing.",
  },
  {
    from: "הנשנוש הראשון שלכם מחכה.",
    to: "חטיף התנועה הראשון שלכם מחכה.",
    reason: "The first Snacksmate session.",
  },
  {
    from: "בחרו נשנוש של כמה דקות",
    to: "בחרו חטיף תנועה של כמה דקות",
    reason: "Choosing one short exercise snack.",
  },
  {
    from: "כל נשנוש שהושלם",
    to: "כל חטיף תנועה שהושלם",
    reason: "Each completed exercise snack.",
  },
  {
    from: "כל נשנוש נספר",
    to: "כל חטיף תנועה נספר",
    reason: "Each exercise snack counts.",
  },
  {
    from: "בוחרים נשנוש",
    to: "בוחרים חטיף תנועה",
    reason: "Choosing one Snacksmate session.",
  },
  {
    from: "נשנוש קטן נותן בוסט גדול",
    to: "חטיף תנועה קטן נותן בוסט גדול",
    reason: "One short exercise snack.",
  },
  {
    from: "נשנושי העלייה במדרגות",
    to: "חטיפי התנועה בעלייה במדרגות",
    reason: "The stair-climbing exercise snacks in that study.",
  },
  {
    from: "נשנושי ספרינטים",
    to: "חטיפי תנועה בספרינטים",
    reason: "Sprint snacks are sprint-based exercise snacks.",
  },
  {
    from: "נשנושי טאי צ'י",
    to: "מקטעי טאי צ'י קצרים",
    reason: "Tai chi snacking is a separate study arm, not the exercise-snack arm.",
  },
];

/**
 * Longer and more specific phrases first.
 * Indefinite נשנוש/נשנושי כושר and definite נשנוש/נשנושי הכושר are the same
 * length as חטיף/חטיפי תנועה and חטיף/חטיפי התנועה, so a direct swap keeps
 * SEO and excerpt lengths. Two grammar fixes are explicit:
 * daily-experience agreement, and plural protocols.
 */
const EXACT_REPLACEMENTS: readonly ContextualReplacement[] = [
  {
    from: "חוויית נשנושי הכושר היומי",
    to: "חוויית חטיפי התנועה היומית",
    reason: "Definite plural with agreement that followed כושר.",
  },
  {
    from: "פרוטוקולים של נשנוש כושר",
    to: "פרוטוקולים של חטיפי תנועה",
    reason: "Plural protocols.",
  },
  {
    from: "פרוטוקול של נשנוש כושר",
    to: "פרוטוקול של חטיף תנועה",
    reason: "Singular protocol.",
  },
  {
    from: "נשנושי הכושר",
    to: "חטיפי התנועה",
    reason: "Definite plural of the outdated public term.",
  },
  {
    from: "נשנוש הכושר",
    to: "חטיף התנועה",
    reason: "Definite singular of the outdated public term.",
  },
  {
    from: "נשנושי כושר",
    to: "חטיפי תנועה",
    reason: "Plural of the outdated public term.",
  },
  {
    from: "נשנוש כושר",
    to: "חטיף תנועה",
    reason: "Singular of the outdated public term.",
  },
];

const REPLACEMENTS: readonly ContextualReplacement[] = [...CONTEXTUAL_REPLACEMENTS, ...EXACT_REPLACEMENTS];

const FOOD_SNACK_CONTEXT = /אוכל|מזון|אכל|לאכול|רעב|קלור|מתוק|מלוח/;
const BARE_SNACK = /נשנוש(?:ים|י)?/g;

export function contextualExerciseSnackLines(): string {
  return EXERCISE_SNACK_HEBREW_EXAMPLES.map((example) => `- ${example.english} → ${example.hebrew}`).join(
    "\n",
  );
}

export function migrateHebrewExerciseSnackText(text: string): string {
  let next = text;
  for (const rule of REPLACEMENTS) {
    if (!next.includes(rule.from)) continue;
    next = next.replaceAll(rule.from, rule.to);
  }
  return next;
}

export function countTerm(text: string, term: string): number {
  if (!term) return 0;
  let count = 0;
  let index = 0;
  while ((index = text.indexOf(term, index)) !== -1) {
    count += 1;
    index += term.length;
  }
  return count;
}

export function countOutdatedPublicTerminology(text: string): number {
  return OUTDATED_PUBLIC_HEBREW_TERMS.reduce((sum, term) => sum + countTerm(text, term), 0);
}

export type BareSnackClass = "product" | "food" | "tai-chi";

export type ClassifiedBareSnack = {
  kind: BareSnackClass;
  window: string;
};

/**
 * Bare נשנוש tokens that are not the exact נשנוש כושר compounds.
 * Tai chi and food stay out of the product-unit count.
 */
export function classifyBareSnacks(hebrew: string): ClassifiedBareSnack[] {
  let stripped = hebrew;
  for (const term of OUTDATED_PUBLIC_HEBREW_TERMS) {
    stripped = stripped.replaceAll(term, " ".repeat(term.length));
  }
  const found: ClassifiedBareSnack[] = [];
  for (const match of stripped.matchAll(BARE_SNACK)) {
    const index = match.index ?? 0;
    const token = match[0];
    const after = hebrew.slice(index + token.length, index + token.length + 16);
    const window = hebrew.slice(Math.max(0, index - 24), index + token.length + 24).trim();
    if (token === "נשנושי" && /טאי\s+צ['׳]י/.test(after)) {
      found.push({ kind: "tai-chi", window });
      continue;
    }
    if (FOOD_SNACK_CONTEXT.test(window)) {
      found.push({ kind: "food", window });
      continue;
    }
    found.push({ kind: "product", window });
  }
  return found;
}

export function countBareProductUnitSnacks(text: string): number {
  return classifyBareSnacks(text).filter((item) => item.kind === "product").length;
}

export function contextualRulesUsed(before: string): readonly ContextualReplacement[] {
  return CONTEXTUAL_REPLACEMENTS.filter((rule) => before.includes(rule.from));
}

/**
 * Review warning, not a blocker. Food context is left alone. The exact
 * נשנוש כושר forms are already flagged separately.
 */
export function bareProductUnitSnackWarnings(hebrew: string): string[] {
  const found = classifyBareSnacks(hebrew);
  const product = found.filter((item) => item.kind === "product").map((item) => item.window);
  const taiChi = found.filter((item) => item.kind === "tai-chi");
  const warnings: string[] = [];
  if (product.length > 0) {
    warnings.push(
      `Review warning: bare נשנוש may name the Snacksmate activity unit (${product.join(" | ")}). Use חטיף תנועה or חטיפי תנועה for that unit. Leave נשנוש when it means food or a quotation.`,
    );
  }
  if (taiChi.length > 0) {
    warnings.push(
      "Review warning: נשנושי טאי צ'י names a separate tai chi arm. Prefer מקטעי טאי צ'י קצרים, not חטיפי תנועה.",
    );
  }
  return warnings;
}

export function migrationProblems(text: string): string[] {
  const problems: string[] = [];
  for (const term of OUTDATED_PUBLIC_HEBREW_TERMS) {
    if (text.includes(term)) problems.push(`Still contains outdated term "${term}".`);
  }
  for (const term of AWKWARD_EXERCISE_SNACK_HEBREW) {
    if (text.includes(term)) problems.push(`Awkward terminology "${term}".`);
  }
  return problems;
}
