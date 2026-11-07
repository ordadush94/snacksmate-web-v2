import assert from "node:assert/strict";
import test from "node:test";
import { enContent } from "@/content/en";
import {
  EXERCISE_SNACKS_APP_FAQS,
  EXERCISE_SNACKS_APP_PATH,
  PRODUCT_ARTICLE_SLUGS,
  STORE_LISTING_URLS,
  exerciseSnacksAppCampaign,
  exerciseSnacksAppFaqJsonLd,
  exerciseSnacksAppMetadata,
  exerciseSnacksAppSoftwareJsonLd,
  exerciseSnacksAppSteps,
  exerciseSnacksAppStoreLinks,
  exerciseSnacksAppTopicLink,
  pickResearchFindings,
} from "./exercise-snacks-app";

test("the English home title stays on the brand", () => {
  assert.equal(enContent.meta.title, "Snacksmate App");
  assert.equal(enContent.meta.ogTitle, "Snacksmate App");
  assert.doesNotMatch(enContent.meta.title, /exercise snacks/i);
  assert.doesNotMatch(enContent.meta.description, /exercise snacks/i);
  assert.doesNotMatch(enContent.meta.ogDescription, /exercise snacks/i);
  assert.equal(enContent.concept.appLink?.label, "exercise snacks app");
  assert.equal(enContent.concept.appLink?.href, EXERCISE_SNACKS_APP_PATH);
});

test("metadata is English only and canonicalizes to itself", () => {
  const metadata = exerciseSnacksAppMetadata();
  const canonical = "https://www.snacksmate.com/en/exercise-snacks-app/";
  assert.equal(metadata.alternates?.canonical, canonical);
  assert.deepEqual(metadata.alternates?.languages, {
    en: canonical,
    "x-default": canonical,
  });
  assert.equal(
    metadata.title,
    "Exercise Snacks App: 2–5 Minute Workouts, No Equipment | Snacksmate",
  );
});

test("store links keep the landing source and medium, and split top from bottom", () => {
  for (const placement of ["top", "bottom"] as const) {
    const links = exerciseSnacksAppStoreLinks(placement);
    const campaign = exerciseSnacksAppCampaign(placement);
    const apple = new URL(links.appStoreHref);
    assert.equal(apple.searchParams.get("ct"), campaign);
    assert.equal(apple.searchParams.get("mt"), "8");
    assert.match(apple.pathname, /6755204941$/);

    const play = new URL(links.playStoreHref);
    assert.equal(
      play.searchParams.get("id"),
      "com.company.exercisesnacksapp",
    );
    assert.equal(
      play.searchParams.get("referrer"),
      `utm_source=landing&utm_medium=website&utm_campaign=${campaign}`,
    );
  }
});

test("structured data repeats the visible FAQ and both store listings", () => {
  const faq = exerciseSnacksAppFaqJsonLd();
  assert.equal(faq["@type"], "FAQPage");
  assert.deepEqual(
    faq.mainEntity.map((item) => item.name),
    EXERCISE_SNACKS_APP_FAQS.map((item) => item.question),
  );
  assert.deepEqual(
    faq.mainEntity.map((item) => item.acceptedAnswer.text),
    EXERCISE_SNACKS_APP_FAQS.map((item) => item.answer),
  );

  const app = exerciseSnacksAppSoftwareJsonLd();
  assert.equal(app["@type"], "SoftwareApplication");
  assert.equal(app.offers.price, "0");
  assert.deepEqual(app.downloadUrl, [
    STORE_LISTING_URLS.appStore,
    STORE_LISTING_URLS.playStore,
  ]);
  assert.equal(app.downloadUrl.some((url) => url.includes("utm_")), false);
  assert.equal(app.downloadUrl.some((url) => url.includes("ct=")), false);
});

test("unpublished product articles stay off the page", () => {
  const steps = exerciseSnacksAppSteps([]);
  assert.deepEqual(
    steps.map((step) => step.title),
    ["Pick a snack", "Do it in 2-5 minutes", "Build the habit"],
  );
  assert.equal(steps.every((step) => step.links.length === 0), true);

  const published = exerciseSnacksAppSteps([
    { slug: PRODUCT_ARTICLE_SLUGS.preferences, title: "Exercise preferences" },
    { slug: PRODUCT_ARTICLE_SLUGS.custom, title: "  Custom snacks  " },
    { slug: PRODUCT_ARTICLE_SLUGS.effort, title: "Rate the effort" },
    { slug: "unrelated", title: "Something else" },
  ]);
  assert.equal(published[0]?.links.length, 2);
  assert.equal(published[0]?.links[0]?.href, "/en/articles/exercise-preferences/");
  assert.equal(published[0]?.links[1]?.label, "Custom snacks");
  assert.equal(published.at(-1)?.title, "Rate the effort");
  assert.equal(
    published.at(-1)?.links[0]?.href,
    "/en/articles/workout-effort-rating/",
  );
});

test("research findings pick the newest sitting, glucose, and fitness summaries", () => {
  const findings = pickResearchFindings([
    {
      topic: "exercise-snacks",
      slug: "newer-glucose",
      title: "Newer glucose study",
    },
    {
      topic: "exercise-snacks",
      slug: "sitting-and-glucose",
      title: "Breaking up prolonged sitting and glucose",
    },
    {
      topic: "exercise-snacks",
      slug: "older-glucose",
      title: "Older glucose study",
    },
    {
      topic: "exercise-snacks",
      slug: "fitness",
      title: "Stair climbing and cardiorespiratory fitness",
    },
    {
      topic: "exercise-snacks",
      slug: "sedentary-population",
      title: "Resistance snacks in sedentary young women",
    },
    {
      topic: "vilpa",
      slug: "vilpa",
      title: "Vigorous intermittent lifestyle physical activity",
    },
    {
      topic: "cardiorespiratory-fitness",
      slug: " ",
      title: "Missing slug",
    },
  ]);
  assert.deepEqual(
    findings.map((finding) => [finding.topic, finding.href]),
    [
      ["sedentary-behavior", "/en/research/sitting-and-glucose/"],
      ["glucose", "/en/research/newer-glucose/"],
      ["cardiorespiratory-fitness", "/en/research/fitness/"],
    ],
  );
});

test("topic links stay on sitting, glucose, and fitness", () => {
  assert.equal(
    exerciseSnacksAppTopicLink({
      topic: "exercise-snacks",
      title: "What is an exercise snack?",
    }),
    null,
  );
  assert.equal(exerciseSnacksAppTopicLink(undefined), null);
  assert.equal(
    exerciseSnacksAppTopicLink({
      topic: "vilpa",
      title: "Vigorous intermittent lifestyle physical activity and cancer",
    }),
    null,
  );
  assert.equal(
    exerciseSnacksAppTopicLink({
      topic: "exercise-snacks",
      title: "Strength in sedentary young women",
    }),
    null,
  );
  assert.deepEqual(
    exerciseSnacksAppTopicLink({
      topic: "exercise-snacks",
      title: "Acute effects on postprandial glucose",
    }),
    {
      href: EXERCISE_SNACKS_APP_PATH,
      label: "Short movement breaks in Snacksmate",
    },
  );
});
