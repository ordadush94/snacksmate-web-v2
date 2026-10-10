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

/**
 * Longer and more specific phrases first.
 * Indefinite נשנוש/נשנושי כושר and definite נשנוש/נשנושי הכושר are the same
 * length as חטיף/חטיפי תנועה and חטיף/חטיפי התנועה, so a direct swap keeps
 * SEO and excerpt lengths. Two grammar fixes are explicit:
 * daily-experience agreement, and plural protocols.
 */
const REPLACEMENTS: readonly { from: string; to: string }[] = [
  { from: "חוויית נשנושי הכושר היומי", to: "חוויית חטיפי התנועה היומית" },
  { from: "פרוטוקולים של נשנוש כושר", to: "פרוטוקולים של חטיפי תנועה" },
  { from: "פרוטוקול של נשנוש כושר", to: "פרוטוקול של חטיף תנועה" },
  { from: "נשנושי הכושר", to: "חטיפי התנועה" },
  { from: "נשנוש הכושר", to: "חטיף התנועה" },
  { from: "נשנושי כושר", to: "חטיפי תנועה" },
  { from: "נשנוש כושר", to: "חטיף תנועה" },
];

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
