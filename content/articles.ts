import type { Locale } from "./types";

const TOPIC_LABELS: Record<string, Record<Locale, string>> = {
  "product-update": { en: "Product Update", he: "עדכון מוצר" },
  "new-feature": { en: "New Feature", he: "פיצ'ר חדש" },
  release: { en: "Release", he: "גרסה חדשה" },
  partnership: { en: "Partnership", he: "שיתוף פעולה" },
  "research-collaboration": {
    en: "Research Collaboration",
    he: "שיתוף פעולה מחקרי",
  },
  "company-news": { en: "Company News", he: "חדשות Snacksmate" },
  "exercise-snacks": { en: "Exercise Snacks", he: "נשנושי כושר" },
  research: { en: "Research", he: "מחקר" },
  fitness: { en: "Fitness", he: "כושר" },
  health: { en: "Health", he: "בריאות" },
  vilpa: { en: "VILPA", he: "VILPA" },
  snacksmate: { en: "Snacksmate", he: "Snacksmate" },
};

export const articlesCopy = {
  en: {
    navLabel: "Updates",
    pageTitle: "Latest from Snacksmate",
    pageDescription:
      "New features, product updates, partnerships and what we're building.",
    emptyTitle: "Updates are on the way.",
    emptyBody: "Follow the latest developments from Snacksmate.",
    readArticle: "Read update",
    publishedLabel: "Published",
    updatedLabel: "Updated",
    referencesHeading: "References",
    backToArticles: "Back to Updates",
    homeLabel: "Home",
    breadcrumbLabel: "Breadcrumb",
    relatedHeading: "More updates",
    relatedResearchHeading: "Related research",
    appCta: "Try a few minutes in Snacksmate",
    metaTitle: "Snacksmate Updates – New Features, Product News & Partnerships",
    metaDescription:
      "New features, product updates, partnerships, and what Snacksmate is building.",
  },
  he: {
    navLabel: "עדכונים",
    pageTitle: "מה חדש ב־Snacksmate",
    pageDescription:
      "פיצ'רים חדשים, עדכוני מוצר, שיתופי פעולה ומה שאנחנו בונים.",
    emptyTitle: "עדכונים חדשים יעלו בקרוב.",
    emptyBody: "כאן תוכלו לעקוב אחרי ההתפתחויות האחרונות ב־Snacksmate.",
    readArticle: "לקריאת העדכון",
    publishedLabel: "פורסם",
    updatedLabel: "עודכן",
    referencesHeading: "מקורות",
    backToArticles: "חזרה לעדכונים",
    homeLabel: "בית",
    breadcrumbLabel: "נתיב ניווט",
    relatedHeading: "עדכונים נוספים",
    relatedResearchHeading: "מחקרים קשורים",
    appCta: "כמה דקות עם Snacksmate",
    metaTitle: "עדכוני Snacksmate – פיצ'רים חדשים, חדשות ושיתופי פעולה",
    metaDescription:
      "פיצ'רים חדשים, עדכוני מוצר, שיתופי פעולה ומה ש־Snacksmate בונה.",
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
