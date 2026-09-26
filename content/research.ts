import type { Locale } from "./types";

const TOPIC_LABELS: Record<string, Record<Locale, string>> = {
  "exercise-snacks": { en: "Exercise Snacks", he: "נשנושי כושר" },
  vilpa: { en: "VILPA", he: "VILPA" },
  "cardiorespiratory-fitness": {
    en: "Cardiorespiratory Fitness",
    he: "כושר לב-ריאה",
  },
  glucose: { en: "Glucose", he: "גלוקוז" },
  "cardiometabolic-health": {
    en: "Cardiometabolic Health",
    he: "בריאות קרדיומטבולית",
  },
  "sedentary-behavior": { en: "Sedentary Behavior", he: "התנהגות יושבנית" },
  "older-adults": { en: "Older Adults", he: "מבוגרים" },
  "workplace-activity": { en: "Workplace Activity", he: "פעילות במקום העבודה" },
  "physical-activity": { en: "Physical Activity", he: "פעילות גופנית" },
  other: { en: "Other", he: "אחר" },
};

const STUDY_DESIGN_LABELS: Record<string, Record<Locale, string>> = {
  "randomized-controlled-trial": {
    en: "Randomized Controlled Trial",
    he: "ניסוי מבוקר אקראי",
  },
  "controlled-trial": { en: "Controlled Trial", he: "ניסוי מבוקר" },
  "crossover-study": { en: "Crossover Study", he: "מחקר הצלבה" },
  "cohort-study": { en: "Cohort Study", he: "מחקר עוקבה" },
  "cross-sectional-study": {
    en: "Cross-sectional Study",
    he: "מחקר חתך",
  },
  "systematic-review": { en: "Systematic Review", he: "סקירה שיטתית" },
  "meta-analysis": { en: "Meta-analysis", he: "מטה-אנליזה" },
  "narrative-review": { en: "Narrative Review", he: "סקירה נרטיבית" },
  "scoping-review": { en: "Scoping Review", he: "סקירת היקף" },
  "umbrella-review": { en: "Umbrella Review", he: "סקירת מטרייה" },
  "evidence-map": { en: "Evidence Map", he: "מפת ראיות" },
  "observational-study": { en: "Observational Study", he: "מחקר תצפיתי" },
  "pilot-study": { en: "Pilot Study", he: "מחקר פיילוט" },
  "feasibility-study": { en: "Feasibility Study", he: "מחקר היתכנות" },
  other: { en: "Other", he: "אחר" },
};

export const researchCopy = {
  en: {
    navLabel: "Research",
    pageTitle: "The Exercise-Snack Evidence, in Plain Language",
    pageDescription:
      "Snacksmate reads scientific studies on exercise snacks and explains them in plain language.",
    empty:
      "We’re building a growing library of research on exercise snacks, VILPA, and short bouts of activity.",
    emptyAction: "What is an exercise snack?",
    noMatches: "No research summaries match these filters.",
    readResearch: "Read summary",
    searchLabel: "Search research",
    searchPlaceholder: "Search research",
    topicLabel: "Topic",
    studyDesignLabel: "Study design",
    yearLabel: "Year",
    allTopics: "All topics",
    allStudyDesigns: "All study designs",
    allYears: "All years",
    clearFilters: "Clear filters",
    summaryCount: (count: number) =>
      count === 1 ? "1 research summary" : `${count} research summaries`,
    studyTitleLabel: "Study title",
    publishedLabel: "Summary published",
    updatedLabel: "Updated",
    summaryByLabel: "Summary by",
    studyOverviewHeading: "Study overview",
    studyAuthorsLabel: "Study authors",
    populationLabel: "Population",
    sampleSizeLabel: "Sample size",
    durationLabel: "Duration",
    comparatorLabel: "Comparator",
    outcomesLabel: "Outcomes",
    interventionHeading: "Intervention",
    mainFindingsHeading: "Main findings",
    interpretationHeading: "What this may mean in practice",
    interpretationNote:
      "Snacksmate's reading of the evidence — not a quotation from the original paper.",
    limitationsHeading: "Limitations",
    snacksmateRelevanceHeading: "Snacksmate relevance",
    referencesHeading: "References",
    originalStudyHeading: "Original study",
    viewOriginalStudy: "View original study",
    doiLabel: "DOI",
    journalLabel: "Journal",
    sampleSizeShort: (n: number) => `n = ${n}`,
    backToResearch: "Back to all research",
    homeLabel: "Home",
    breadcrumbLabel: "Breadcrumb",
    relatedHeading: "Related research",
    closingHeading: "What can you take from this?",
    closingNote:
      "The notes above are Snacksmate’s reading of this study, not personal advice.",
    relatedArticleLabel: "Related article",
    appCta: "Try a few minutes in Snacksmate",
    metaTitle: "Snacksmate Research – Exercise Snacks, VILPA & Movement Science",
    metaDescription:
      "Structured summaries of scientific studies on exercise snacks, VILPA, cardiorespiratory fitness, and everyday movement.",
  },
  he: {
    navLabel: "מחקרים",
    pageTitle: "המחקר על נשנושי כושר — בשפה פשוטה",
    pageDescription:
      "Snacksmate קוראת מחקרים מדעיים על נשנושי כושר ומסבירה אותם בשפה פשוטה.",
    empty:
      "אנחנו בונים ספריית מחקר מתרחבת על נשנושי כושר, VILPA ופעילות קצרה לאורך היום.",
    emptyAction: "מהו נשנוש כושר?",
    noMatches: "אין סיכומי מחקרים שתואמים לסינון הזה.",
    readResearch: "לקריאת הסיכום",
    searchLabel: "חיפוש מחקרים",
    searchPlaceholder: "חיפוש מחקרים",
    topicLabel: "נושא",
    studyDesignLabel: "סוג מחקר",
    yearLabel: "שנה",
    allTopics: "כל הנושאים",
    allStudyDesigns: "כל סוגי המחקרים",
    allYears: "כל השנים",
    clearFilters: "ניקוי סינון",
    summaryCount: (count: number) =>
      count === 1 ? "סיכום מחקר אחד" : `${count} סיכומי מחקרים`,
    studyTitleLabel: "כותרת המחקר",
    publishedLabel: "הסיכום פורסם",
    updatedLabel: "עודכן",
    summaryByLabel: "סיכום מאת",
    studyOverviewHeading: "סקירת המחקר",
    studyAuthorsLabel: "מחברי המחקר",
    populationLabel: "אוכלוסייה",
    sampleSizeLabel: "גודל מדגם",
    durationLabel: "משך",
    comparatorLabel: "השוואה",
    outcomesLabel: "מדדים",
    interventionHeading: "התערבות",
    mainFindingsHeading: "ממצאים עיקריים",
    interpretationHeading: "מה המשמעות האפשרית בפועל",
    interpretationNote:
      "כך Snacksmate מפרשת את הממצאים — זה אינו ציטוט מהמאמר המקורי.",
    limitationsHeading: "מגבלות",
    snacksmateRelevanceHeading: "הרלוונטיות ל-Snacksmate",
    referencesHeading: "מקורות",
    originalStudyHeading: "המחקר המקורי",
    viewOriginalStudy: "למחקר המקורי",
    doiLabel: "DOI",
    journalLabel: "כתב עת",
    sampleSizeShort: (n: number) => `n = ${n}`,
    backToResearch: "חזרה לכל המחקרים",
    homeLabel: "בית",
    breadcrumbLabel: "נתיב ניווט",
    relatedHeading: "מחקרים קשורים",
    closingHeading: "מה אפשר לקחת מהמחקר?",
    closingNote:
      "ההערות למעלה הן הקריאה של Snacksmate את המחקר, לא עצה אישית.",
    relatedArticleLabel: "כתבה קשורה",
    appCta: "כמה דקות עם Snacksmate",
    metaTitle: "מחקרים של Snacksmate – נשנושי כושר, VILPA ומדע התנועה",
    metaDescription:
      "סיכומים מובנים של מחקרים מדעיים על נשנושי כושר, VILPA, כושר לב-ריאה ותנועה בחיי היומיום.",
  },
} as const;

export function getResearchCopy(locale: Locale) {
  return researchCopy[locale];
}

export function researchTopicLabel(topic: string | undefined, locale: Locale) {
  if (!topic) return undefined;
  return TOPIC_LABELS[topic]?.[locale] ?? topic;
}

export function studyDesignLabel(
  studyDesign: string | undefined,
  locale: Locale,
) {
  if (!studyDesign) return undefined;
  return STUDY_DESIGN_LABELS[studyDesign]?.[locale] ?? studyDesign;
}

export function researchPath(locale: Locale) {
  return `/${locale}/research/`;
}

export function researchItemPath(locale: Locale, slug: string) {
  return `/${locale}/research/${slug}/`;
}
