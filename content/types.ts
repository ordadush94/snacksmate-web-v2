export type Locale = "en" | "he";

export const locales = ["en", "he"] as const;

export function isLocale(value: string): value is Locale {
  return value === "en" || value === "he";
}

export type StoreLinks = {
  appStoreLabel: string;
  playStoreLabel: string;
  appStoreAria: string;
  playStoreAria: string;
  appStoreHref: string;
  playStoreHref: string;
};

export type ProblemItem = {
  title: string;
  body: string;
};

export type StepItem = {
  title: string;
  body: string;
};

export type BenefitItem = {
  title: string;
  body: string;
};

export type LandingContent = {
  locale: Locale;
  dir: "ltr" | "rtl";
  meta: {
    title: string;
    description: string;
    ogTitle: string;
    ogDescription: string;
  };
  languageSwitcherAria: string;
  hero: {
    heading: string;
    lede: string;
    conceptCta: string;
  };
  problem: {
    kicker: string;
    heading: string;
    lead: string;
    items: ProblemItem[];
  };
  concept: {
    kicker: string;
    heading: string;
    lead: string;
    chips: string[];
    highlight: string;
  };
  effects: {
    kicker: string;
    heading: string;
    lead: string;
    items: string[];
  };
  howItWorks: {
    kicker: string;
    heading: string;
    lead: string;
    steps: StepItem[];
  };
  benefits: {
    kicker: string;
    heading: string;
    lead: string;
    items: BenefitItem[];
  };
  trust: {
    quote: string;
    body: string;
  };
  download: {
    heading: string;
    lead: string;
  };
  footer: {
    copyright: string;
    privacyLabel: string;
    termsLabel: string;
  };
  store: StoreLinks;
};
