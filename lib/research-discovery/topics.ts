import { RESEARCH_TOPIC_OPTIONS } from "@/sanity/schemaTypes/research";

export type ResearchTopic = (typeof RESEARCH_TOPIC_OPTIONS)[number]["value"];

type TopicRule = {
  topic: ResearchTopic;
  label: string;
  pattern: RegExp;
};

/**
 * First match wins. Keep the more specific research concepts above broader ones.
 */
export const TOPIC_RULES: readonly TopicRule[] = [
  {
    topic: "vilpa",
    label: "VILPA",
    pattern:
      /\b(?:vilpa|vigorous\s+intermittent\s+lifestyle\s+physical\s+activity)\b/i,
  },
  {
    topic: "exercise-snacks",
    label: "Exercise Snacks",
    pattern: /\bexercise[\s-]+snack(?:s|ing)?\b/i,
  },
  {
    topic: "sedentary-behavior",
    label: "Sedentary Behavior",
    pattern:
      /\bsedentary\s+(?:behavior|behaviour|interruption|interruptions|breaks?)\b/i,
  },
  {
    topic: "glucose",
    label: "Glucose",
    pattern: /\b(?:glucose|glycemic|glycaemic)\b/i,
  },
  {
    topic: "cardiorespiratory-fitness",
    label: "Cardiorespiratory Fitness",
    pattern: /\b(?:cardiorespiratory|vo2(?:max|peak)?)\b/i,
  },
];

export function mapResearchTopic(
  title: string | null | undefined,
  abstract: string | null | undefined,
): ResearchTopic {
  const haystack = [title, abstract]
    .map((part) => part?.trim() ?? "")
    .filter(Boolean)
    .join("\n");

  const match = TOPIC_RULES.find((rule) => rule.pattern.test(haystack));
  return match?.topic ?? "other";
}
