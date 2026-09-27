import assert from "node:assert/strict";
import test from "node:test";

import type { SlugValidationContext } from "@sanity/types";
import { evaluate, parse } from "groq-js";

import { articleType } from "../schemaTypes/article";
import { researchType } from "../schemaTypes/research";
import { isUniqueSlugForLanguage, localeSlugUniquenessQuery } from "./uniqueSlug";

const ENGLISH_RESEARCH_SLUG =
  "a-two-minute-exercise-snack-may-be-sufficient-to-enhance-energy-metabolism-and-fat-oxidation-in";
const EXAMPLE_SLUG = "two-minute-exercise-snack";
const PUBLISHED_ARTICLE_SLUG = "what-are-exercise-snacks";

type StudioDocument = {
  _id: string;
  _type: "article" | "research";
  language: "en" | "he";
  slug: { _type: "slug"; current: string };
};

type FetchCall = {
  apiVersion: string;
  perspective?: string;
  query: string;
  params: Record<string, unknown>;
  tag?: string;
};

const publishedEnglishResearch: StudioDocument = {
  _id: "research-pubmed-42798426",
  _type: "research",
  language: "en",
  slug: { _type: "slug", current: ENGLISH_RESEARCH_SLUG },
};

const hebrewResearchDraft: StudioDocument = {
  _id: "drafts.research-he-research-pubmed-42798426",
  _type: "research",
  language: "he",
  slug: { _type: "slug", current: ENGLISH_RESEARCH_SLUG },
};

const publishedHebrewArticle: StudioDocument = {
  _id: "eeecffd8-4745-42b5-a9e8-f744d8dae6cd",
  _type: "article",
  language: "he",
  slug: { _type: "slug", current: PUBLISHED_ARTICLE_SLUG },
};

function document(
  id: string,
  type: StudioDocument["_type"],
  language: StudioDocument["language"],
  slug: string,
): StudioDocument {
  return {
    _id: id,
    _type: type,
    language,
    slug: { _type: "slug", current: slug },
  };
}

function studioContext(dataset: readonly StudioDocument[], calls: FetchCall[] = []) {
  const getClient = ({ apiVersion }: { apiVersion: string }) => {
    const client = {
      withConfig(config: { perspective?: string }) {
        return {
          async fetch(
            query: string,
            params: Record<string, unknown>,
            options?: { tag?: string },
          ) {
            calls.push({
              apiVersion,
              perspective: config.perspective,
              query,
              params,
              tag: options?.tag,
            });
            const value = await evaluate(parse(query), { dataset: [...dataset], params });
            return value.get();
          },
        };
      },
    };
    return client;
  };

  return {
    calls,
    context: {
      getClient,
    } as unknown as SlugValidationContext,
  };
}

async function slugIsUnique(
  dataset: readonly StudioDocument[],
  current: Pick<StudioDocument, "_id" | "_type" | "language"> & { slug?: string },
  slug = current.slug ?? "",
) {
  const { context } = studioContext(dataset);
  return isUniqueSlugForLanguage(slug, {
    ...context,
    document: {
      _id: current._id,
      _type: current._type,
      language: current.language,
    },
  } as SlugValidationContext);
}

function slugField(type: { fields: readonly { name: string; options?: { isUnique?: unknown } }[] }) {
  const field = type.fields.find((item) => item.name === "slug");
  assert.ok(field, "slug field");
  return field;
}

test("Article and Research share one locale-aware slug check", () => {
  assert.equal(slugField(articleType).options?.isUnique, isUniqueSlugForLanguage);
  assert.equal(slugField(researchType).options?.isUnique, isUniqueSlugForLanguage);
  assert.match(localeSlugUniquenessQuery, /_type == \$type/);
  assert.match(localeSlugUniquenessQuery, /language == \$language/);
  assert.match(localeSlugUniquenessQuery, /slug\.current == \$slug/);
  assert.match(localeSlugUniquenessQuery, /!sanity::versionOf\(\$publishedId\)/);
});

test("the published English research and its Hebrew translation can share a slug", async () => {
  const dataset = [publishedEnglishResearch, hebrewResearchDraft];

  assert.equal(
    await slugIsUnique(dataset, hebrewResearchDraft, ENGLISH_RESEARCH_SLUG),
    true,
  );
  assert.equal(
    await slugIsUnique(dataset, publishedEnglishResearch, ENGLISH_RESEARCH_SLUG),
    true,
  );
  assert.equal(
    await slugIsUnique(
      [
        document("research-en", "research", "en", EXAMPLE_SLUG),
        document("drafts.research-he", "research", "he", EXAMPLE_SLUG),
      ],
      document("drafts.research-he", "research", "he", EXAMPLE_SLUG),
    ),
    true,
  );
});

test("two Hebrew research documents cannot share a slug", async () => {
  const otherHebrew = document(
    "drafts.research-he-other",
    "research",
    "he",
    ENGLISH_RESEARCH_SLUG,
  );
  const dataset = [publishedEnglishResearch, hebrewResearchDraft, otherHebrew];

  assert.equal(await slugIsUnique(dataset, hebrewResearchDraft, ENGLISH_RESEARCH_SLUG), false);
  assert.equal(await slugIsUnique(dataset, otherHebrew, ENGLISH_RESEARCH_SLUG), false);
  assert.equal(
    await slugIsUnique(
      [
        document("research-he-a", "research", "he", EXAMPLE_SLUG),
        document("drafts.research-he-b", "research", "he", EXAMPLE_SLUG),
      ],
      document("drafts.research-he-b", "research", "he", EXAMPLE_SLUG),
    ),
    false,
  );
});

test("Article slugs follow the same language rule", async () => {
  const englishArticle = document(
    "article-en-exercise-snacks",
    "article",
    "en",
    PUBLISHED_ARTICLE_SLUG,
  );
  const shared = [publishedHebrewArticle, englishArticle];

  assert.equal(await slugIsUnique(shared, englishArticle, PUBLISHED_ARTICLE_SLUG), true);
  assert.equal(await slugIsUnique(shared, publishedHebrewArticle, PUBLISHED_ARTICLE_SLUG), true);

  const secondHebrew = document(
    "drafts.article-he-duplicate",
    "article",
    "he",
    PUBLISHED_ARTICLE_SLUG,
  );
  assert.equal(
    await slugIsUnique([publishedHebrewArticle, secondHebrew], secondHebrew, PUBLISHED_ARTICLE_SLUG),
    false,
  );
  assert.equal(
    await slugIsUnique(
      [
        document("article-en", "article", "en", EXAMPLE_SLUG),
        document("drafts.article-he", "article", "he", EXAMPLE_SLUG),
      ],
      document("drafts.article-he", "article", "he", EXAMPLE_SLUG),
    ),
    true,
  );
  assert.equal(
    await slugIsUnique(
      [
        document("article-he-a", "article", "he", EXAMPLE_SLUG),
        document("article-he-b", "article", "he", EXAMPLE_SLUG),
      ],
      document("article-he-b", "article", "he", EXAMPLE_SLUG),
    ),
    false,
  );
});

test("editing a document ignores its draft, published, and release versions", async () => {
  const publishedId = "research-he-research-pubmed-42798426";
  const dataset = [
    publishedEnglishResearch,
    document(publishedId, "research", "he", ENGLISH_RESEARCH_SLUG),
    document(`drafts.${publishedId}`, "research", "he", ENGLISH_RESEARCH_SLUG),
    document(`versions.summer-review.${publishedId}`, "research", "he", ENGLISH_RESEARCH_SLUG),
  ];

  for (const id of [publishedId, `drafts.${publishedId}`, `versions.summer-review.${publishedId}`]) {
    assert.equal(
      await slugIsUnique(
        dataset,
        { _id: id, _type: "research", language: "he" },
        ENGLISH_RESEARCH_SLUG,
      ),
      true,
      id,
    );
  }
});

test("the same slug is allowed on a different document type", async () => {
  const dataset = [
    document("research-en", "research", "en", EXAMPLE_SLUG),
    document("article-en", "article", "en", EXAMPLE_SLUG),
  ];
  assert.equal(
    await slugIsUnique(dataset, document("article-en", "article", "en", EXAMPLE_SLUG)),
    true,
  );
});

test("the uniqueness query reads language, type, and the published document id", async () => {
  const calls: FetchCall[] = [];
  const { context } = studioContext([publishedEnglishResearch, hebrewResearchDraft], calls);

  const unique = await isUniqueSlugForLanguage(ENGLISH_RESEARCH_SLUG, {
    ...context,
    document: hebrewResearchDraft,
  } as SlugValidationContext);

  assert.equal(unique, true);
  assert.equal(calls.length, 1);
  const call = calls[0];
  assert.ok(call);
  assert.equal(call.apiVersion, "2025-02-19");
  assert.equal(call.perspective, "raw");
  assert.equal(call.query, localeSlugUniquenessQuery);
  assert.equal(call.tag, "validation.slug-is-unique-per-language");
  assert.deepEqual(call.params, {
    type: "research",
    language: "he",
    slug: ENGLISH_RESEARCH_SLUG,
    publishedId: "research-he-research-pubmed-42798426",
  });
});

test("a document without a language or id is not rejected before those fields exist", async () => {
  const calls: FetchCall[] = [];
  const { context } = studioContext([publishedEnglishResearch], calls);

  assert.equal(
    await isUniqueSlugForLanguage(EXAMPLE_SLUG, {
      ...context,
      document: { _id: "drafts.new", _type: "research", language: "  " },
    } as SlugValidationContext),
    true,
  );
  assert.equal(
    await isUniqueSlugForLanguage(EXAMPLE_SLUG, {
      ...context,
      document: { _type: "article", language: "he" },
    } as SlugValidationContext),
    true,
  );
  assert.equal(calls.length, 0);
});
