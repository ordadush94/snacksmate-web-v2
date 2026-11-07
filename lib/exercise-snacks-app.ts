import type { Metadata } from "next";
import { articlePath } from "@/content/articles";
import { researchItemPath, researchPath } from "@/content/research";
import type { StoreLinks } from "@/content/types";
import { absoluteUrl, APPLE_APP_ID } from "@/lib/site";

export const EXERCISE_SNACKS_APP_PATH = "/en/exercise-snacks-app/";

export const EXERCISE_SNACKS_APP_TITLE =
  "Exercise Snacks App: 2–5 Minute Workouts, No Equipment | Snacksmate";

export const EXERCISE_SNACKS_APP_DESCRIPTION =
  "Snacksmate is an exercise snacks app for busy days. Short, no-equipment workouts you can do at home, at work, or on a break. Free on iOS and Android.";

export const EXERCISE_SNACKS_APP_H1 = "The exercise snacks app for busy days";

export const EXERCISE_SNACKS_APP_CRUMB = "Exercise snacks app";

/** Store listings without campaign tags, for structured data. */
export const STORE_LISTING_URLS = {
  appStore: `https://apps.apple.com/app/id${APPLE_APP_ID}`,
  playStore:
    "https://play.google.com/store/apps/details?id=com.company.exercisesnacksapp",
} as const;

export const PRODUCT_ARTICLE_SLUGS = {
  preferences: "exercise-preferences",
  custom: "custom-exercise-snacks",
  effort: "workout-effort-rating",
} as const;

export const RESEARCH_FINDING_TOPICS = [
  "sedentary-behavior",
  "glucose",
  "cardiorespiratory-fitness",
] as const;

export type ResearchFindingTopic = (typeof RESEARCH_FINDING_TOPICS)[number];

export type StorePlacement = "top" | "bottom";

export type ArticleRef = {
  slug: string;
  title: string;
};

export type StudyRef = {
  topic?: string;
  slug: string;
  title: string;
};

export type AppStep = {
  title: string;
  body: string;
  links: { href: string; label: string }[];
};

export type ResearchFinding = {
  topic: ResearchFindingTopic;
  href: string;
  title: string;
  text: string;
};

const FINDING_TITLE_MATCHERS: Record<ResearchFindingTopic, RegExp> = {
  // "Sedentary adults" describes who was studied. Sitting breaks are the
  // intervention the section is about.
  "sedentary-behavior":
    /\bsitting\b|\bsedentary (?:behavior|behaviour|work)\b|\binterrupt(?:ing)? sedentary\b/i,
  glucose: /\b(glucose|glycaem|glycemi|insulin)\b/i,
  "cardiorespiratory-fitness":
    /\b(cardiorespiratory|aerobic(?: fitness)?|physical capacity|vo2)\b/i,
};

/**
 * Published research is usually tagged "exercise-snacks", so sitting, glucose,
 * and fitness are told apart from the study title. An explicit topic still wins.
 */
export function researchFindingTopic(study: {
  topic?: string;
  title?: string;
}): ResearchFindingTopic | null {
  if (
    study.topic &&
    RESEARCH_FINDING_TOPICS.includes(study.topic as ResearchFindingTopic)
  ) {
    return study.topic as ResearchFindingTopic;
  }
  const title = study.title ?? "";
  for (const topic of RESEARCH_FINDING_TOPICS) {
    if (FINDING_TITLE_MATCHERS[topic].test(title)) return topic;
  }
  return null;
}

const RESEARCH_FINDING_COPY: Record<ResearchFindingTopic, string> = {
  "sedentary-behavior":
    "Breaking up long periods of sitting is a recurring subject in the studies we summarize.",
  glucose:
    "Other summaries look at blood glucose after a brief bout of activity, set against uninterrupted sitting.",
  "cardiorespiratory-fitness":
    "Cardiorespiratory fitness and short bouts of movement are in the library too.",
};

export const EXERCISE_SNACKS_APP_INTRO = [
  "An exercise snack is a short burst of movement you can finish in a few minutes, with no gym and no equipment.",
  "Snacksmate lines those breaks up so they are easy to do on a busy day: pick one, do it, and come back tomorrow.",
  "The download is free on iOS and Android.",
] as const;

export const EXERCISE_SNACKS_APP_DEFINITION =
  "An exercise snack is a brief bout of activity, usually 2-5 minutes, dropped into a day that is already full. It can be light or hard. The short break is the whole session.";

export const WHY_APP_LEAD =
  "The hard part of a short break is remembering, choosing, and noticing that the minutes added up.";

export const WHY_APP_SECTIONS = [
  {
    title: "Reminders",
    body: "A plan you have to remember is the first thing a busy day drops. Snacksmate sends a gentle reminder, so the cue arrives even when you did not think of it.",
  },
  {
    title: "Variety",
    body: "The app keeps a set of short snacks and matches them to your activity level, goals, and exercise preferences. You can also share snacks with friends, family, or coworkers when a little accountability helps.",
  },
  {
    title: "Tracking",
    body: "Weekly goals and activity points keep each finished snack on the record. A few minutes stay visible after the day moves on.",
  },
  {
    title: "On your own",
    body: "You can stand up and move without an app. Snacksmate holds the reminder, a clear idea of what to do for those minutes, and a record that the snacks are adding up. The movement itself is still 2-5 minutes.",
  },
] as const;

export const RESEARCH_SECTION_LEAD =
  "Most of the writing on short activity breaks comes from hospitals and universities. Snacksmate reads some of those studies and explains them in plain language. Each summary is Snacksmate’s reading of a paper, written for a general reader.";

export const EXERCISE_SNACKS_APP_FAQS = [
  {
    question: "Is it free?",
    answer: "Yes. Snacksmate is free to download on iOS and Android.",
  },
  {
    question: "Do I need equipment?",
    answer:
      "No. A snack needs a little floor space you already have, at home, at work, or on a break.",
  },
  {
    question: "How long is a snack?",
    answer: "Most snacks take 2-5 minutes.",
  },
  {
    question: "Does it work on iPhone and Android?",
    answer:
      "Yes. Snacksmate is on the App Store for iPhone and on Google Play for Android.",
  },
] as const;

export const RESEARCH_HUB_APP_LINK = {
  before: "These summaries explain the studies. Short sessions live in ",
  label: "the Snacksmate app",
  after: ".",
  href: EXERCISE_SNACKS_APP_PATH,
};

const TOPIC_APP_LINKS: Record<ResearchFindingTopic, string> = {
  "sedentary-behavior": "Sitting breaks, as a short Snacksmate session",
  glucose: "Short movement breaks in Snacksmate",
  "cardiorespiratory-fitness": "A few minutes of movement with Snacksmate",
};

export function exerciseSnacksAppCanonicalUrl() {
  return absoluteUrl(EXERCISE_SNACKS_APP_PATH);
}

export function exerciseSnacksAppCampaign(placement: StorePlacement) {
  return placement === "top" ? "en_snacks_app_top" : "en_snacks_app_bottom";
}

export function exerciseSnacksAppStoreLinks(placement: StorePlacement): StoreLinks {
  const campaign = exerciseSnacksAppCampaign(placement);
  const referrer = `utm_source=landing&utm_medium=website&utm_campaign=${campaign}`;
  return {
    appStoreLabel: "App Store",
    playStoreLabel: "Google Play",
    appStoreAria: "Download Snacksmate on the App Store",
    playStoreAria: "Get Snacksmate on Google Play",
    appStoreHref: `${STORE_LISTING_URLS.appStore}?mt=8&ct=${campaign}`,
    playStoreHref: `${STORE_LISTING_URLS.playStore}&referrer=${encodeURIComponent(referrer)}`,
  };
}

function publishedArticle(articles: ArticleRef[], slug: string) {
  const article = articles.find((item) => item.slug === slug && item.title.trim());
  if (!article) return undefined;
  return {
    href: articlePath("en", article.slug),
    label: article.title.trim(),
  };
}

/** Steps use public site claims. Unpublished product articles are omitted. */
export function exerciseSnacksAppSteps(articles: ArticleRef[]): AppStep[] {
  const preferences = publishedArticle(articles, PRODUCT_ARTICLE_SLUGS.preferences);
  const custom = publishedArticle(articles, PRODUCT_ARTICLE_SLUGS.custom);
  const effort = publishedArticle(articles, PRODUCT_ARTICLE_SLUGS.effort);
  const steps: AppStep[] = [
    {
      title: "Pick a snack",
      body: "Choose a short session matched to your level and your exercise preferences. Snacksmate suggests what to do, so the break starts without a plan.",
      links: [preferences, custom].filter((link) => link !== undefined),
    },
    {
      title: "Do it in 2-5 minutes",
      body: "At home, at work, or on a break. No equipment, and no hour to clear.",
      links: [],
    },
    {
      title: "Build the habit",
      body: "Weekly goals, gentle reminders, and activity points keep each finished snack on the record.",
      links: [],
    },
  ];
  if (effort) {
    steps.push({
      title: "Rate the effort",
      body: "When the snack ends, mark how hard it felt.",
      links: [effort],
    });
  }
  return steps;
}

/**
 * One summary each for sitting, glucose, and fitness. `studies` should be
 * newest first, matching the research index query.
 */
export function pickResearchFindings(studies: StudyRef[]): ResearchFinding[] {
  const used = new Set<string>();
  return RESEARCH_FINDING_TOPICS.flatMap((topic) => {
    const match = studies.find((study) => {
      const slug = study.slug.trim();
      if (!slug || !study.title.trim() || used.has(slug)) return false;
      return researchFindingTopic(study) === topic;
    });
    if (!match) return [];
    const slug = match.slug.trim();
    used.add(slug);
    return [
      {
        topic,
        href: researchItemPath("en", slug),
        title: match.title.trim(),
        text: RESEARCH_FINDING_COPY[topic],
      },
    ];
  });
}

export function exerciseSnacksAppTopicLink(study?: {
  topic?: string;
  title?: string;
}) {
  if (!study) return null;
  const topic = researchFindingTopic(study);
  if (!topic) return null;
  return {
    href: EXERCISE_SNACKS_APP_PATH,
    label: TOPIC_APP_LINKS[topic],
  };
}

export function exerciseSnacksAppMetadata(): Metadata {
  const canonical = exerciseSnacksAppCanonicalUrl();
  return {
    title: EXERCISE_SNACKS_APP_TITLE,
    description: EXERCISE_SNACKS_APP_DESCRIPTION,
    robots: { index: true, follow: true },
    alternates: {
      canonical,
      languages: {
        en: canonical,
        "x-default": canonical,
      },
    },
    openGraph: {
      title: EXERCISE_SNACKS_APP_TITLE,
      description: EXERCISE_SNACKS_APP_DESCRIPTION,
      type: "website",
      url: canonical,
      images: [{ url: "/app-icon.png" }],
    },
    twitter: {
      card: "summary",
      title: EXERCISE_SNACKS_APP_TITLE,
      description: EXERCISE_SNACKS_APP_DESCRIPTION,
      images: ["/app-icon.png"],
    },
  };
}

export function exerciseSnacksAppFaqJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: EXERCISE_SNACKS_APP_FAQS.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.answer,
      },
    })),
  };
}

export function exerciseSnacksAppSoftwareJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Snacksmate",
    applicationCategory: "HealthApplication",
    operatingSystem: "iOS, Android",
    description: EXERCISE_SNACKS_APP_DESCRIPTION,
    inLanguage: "en",
    url: exerciseSnacksAppCanonicalUrl(),
    downloadUrl: [STORE_LISTING_URLS.appStore, STORE_LISTING_URLS.playStore],
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
    },
    featureList: [
      "2-5 minute workouts",
      "No equipment",
      "Reminders",
      "Weekly goals",
    ],
  };
}

export function exerciseSnacksAppResearchHubPath() {
  return researchPath("en");
}
