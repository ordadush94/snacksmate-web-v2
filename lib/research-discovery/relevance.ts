export type RelevanceDecision = {
  accept: boolean;
  rules: string[];
  reason: string;
};

type RelevanceRule = {
  id: string;
  label: string;
  pattern: RegExp;
};

/**
 * Conservative phrase rules. A record is accepted only when the title or
 * abstract contains one of these concepts. Uncertain records are skipped.
 */
export const RELEVANCE_RULES: readonly RelevanceRule[] = [
  {
    id: "exercise-snacks",
    label: "exercise snacks / exercise snacking",
    pattern: /\bexercise[\s-]+snack(?:s|ing)?\b/i,
  },
  {
    id: "activity-snacks",
    label: "activity snacks",
    pattern: /\b(?:physical\s+)?activity[\s-]+snacks?\b/i,
  },
  {
    id: "brief-exercise-bouts",
    label: "brief exercise bouts",
    pattern: /\bbrief\s+exercise\s+bouts?\b/i,
  },
  {
    id: "short-exercise-bouts",
    label: "short exercise bouts",
    pattern: /\bshort\s+exercise\s+bouts?\b/i,
  },
  {
    id: "short-bouts-of-exercise",
    label: "short bouts of exercise",
    pattern: /\bshort\s+bouts?\s+of\s+exercise\b/i,
  },
  {
    id: "vilpa-phrase",
    label: "vigorous intermittent lifestyle physical activity",
    pattern: /\bvigorous\s+intermittent\s+lifestyle\s+physical\s+activity\b/i,
  },
  {
    id: "vilpa",
    label: "VILPA",
    pattern: /\bvilpa\b/i,
  },
  {
    id: "intermittent-vigorous",
    label: "intermittent vigorous physical activity",
    pattern: /\bintermittent\s+vigorous\s+physical\s+activity\b/i,
  },
];

function withoutFoodSnackContext(value: string): string {
  return value.replace(/\b(?:pre|post)[\s-]*exercise[\s-]+snack(?:s|ing)?\b/gi, " ");
}

export function assessRelevance(
  title: string | null | undefined,
  abstract: string | null | undefined,
): RelevanceDecision {
  const haystack = [title, abstract]
    .map((part) => withoutFoodSnackContext(part ?? "").trim())
    .filter(Boolean)
    .join("\n");

  if (!haystack) {
    return {
      accept: false,
      rules: [],
      reason: "rejected: title and abstract are empty",
    };
  }

  const matched = RELEVANCE_RULES.filter((rule) => rule.pattern.test(haystack));
  if (matched.length === 0) {
    return {
      accept: false,
      rules: [],
      reason: "rejected: no strong relevance phrase in title or abstract",
    };
  }

  const labels = matched.map((rule) => rule.label);
  return {
    accept: true,
    rules: matched.map((rule) => rule.id),
    reason: `accepted: matched ${labels.join("; ")}`,
  };
}
