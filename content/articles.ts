import type { Locale } from "./types";

const TOPIC_LABELS: Record<string, Record<Locale, string>> = {
  "exercise-snacks": { en: "Exercise Snacks", he: "נשנושי כושר" },
  research: { en: "Research", he: "מחקר" },
  fitness: { en: "Fitness", he: "כושר" },
  health: { en: "Health", he: "בריאות" },
  vilpa: { en: "VILPA", he: "VILPA" },
  snacksmate: { en: "Snacksmate", he: "Snacksmate" },
};

export const articlesCopy = {
  en: {
    navLabel: "Articles",
    pageTitle: "Exercise Snacks, Research & Active Living",
    pageDescription:
      "Practical guides from Snacksmate on exercise snacks, movement, and fitting activity into a real day.",
    empty:
      "New practical guides and explainers about exercise snacks are on the way.",
    emptyAction: "Explore the research",
    readArticle: "Read article",
    publishedLabel: "Published",
    updatedLabel: "Updated",
    referencesHeading: "References",
    backToArticles: "Back to all articles",
    homeLabel: "Home",
    breadcrumbLabel: "Breadcrumb",
    relatedHeading: "More from Snacksmate",
    relatedResearchHeading: "Related research",
    appCta: "Try a few minutes in Snacksmate",
    metaTitle: "Snacksmate Articles – Exercise Snacks, Research & Active Living",
    metaDescription:
      "Articles from Snacksmate on exercise snacks, movement research, and active living — short ways to move more through a busy day.",
  },
  he: {
    navLabel: "כתבות",
    pageTitle: "נשנושי כושר, מחקרים ואורח חיים פעיל",
    pageDescription:
      "מדריכים והסברים של Snacksmate על נשנושי כושר, תנועה וכושר ביום-יום.",
    empty: "כתבות ומדריכים חדשים על נשנושי כושר יעלו כאן בקרוב.",
    emptyAction: "למחקרים",
    readArticle: "לקריאה",
    publishedLabel: "פורסם",
    updatedLabel: "עודכן",
    referencesHeading: "מקורות",
    backToArticles: "חזרה לכל הכתבות",
    homeLabel: "בית",
    breadcrumbLabel: "נתיב ניווט",
    relatedHeading: "כתבות נוספות",
    relatedResearchHeading: "מחקרים קשורים",
    appCta: "כמה דקות עם Snacksmate",
    metaTitle: "כתבות Snacksmate – נשנושי כושר, מחקרים ואורח חיים פעיל",
    metaDescription:
      "כתבות Snacksmate על נשנושי כושר, מחקרי תנועה ואורח חיים פעיל — דרכים קצרות להוסיף תנועה ליום העמוס.",
  },
} as const;

export function getArticlesCopy(locale: Locale) {
  return articlesCopy[locale];
}

export function topicLabel(topic: string | undefined, locale: Locale) {
  if (!topic) return undefined;
  return TOPIC_LABELS[topic]?.[locale] ?? topic;
}

export function formatArticleDate(value: string, locale: Locale) {
  return new Date(value).toLocaleDateString(locale === "he" ? "he-IL" : "en-GB", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function articlesPath(locale: Locale) {
  return `/${locale}/articles/`;
}

export function articlePath(locale: Locale, slug: string) {
  return `/${locale}/articles/${slug}/`;
}
