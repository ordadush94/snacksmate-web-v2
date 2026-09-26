import assert from "node:assert/strict";
import test from "node:test";

import { RESEARCH_IDENTIFIERS_QUERY } from "../research-discovery/sanity";
import { ELIGIBLE_DRAFTS_QUERY } from "../research-enrichment/sanity";
import {
  publishedResearchParamsQuery,
  publishedResearchSitemapQuery,
  researchByLanguageAndSlugQuery,
  researchByLanguageQuery,
  researchTranslationQuery,
} from "../../sanity/lib/queries";
import { researchType } from "../../sanity/schemaTypes/research";
import { structure } from "../../sanity/structure";
import { editorialBackfillPatch } from "./backfill";
import {
  RESEARCH_EDITORIAL_DESK,
  RESEARCH_EDITORIAL_FILTERS,
  matchesResearchEditorialList,
  type EditorialListDocument,
  type ResearchEditorialListId,
} from "./lists";
import {
  READY_EDITORIAL_WARNINGS,
  readyFieldWarning,
  readySourceLinkWarning,
} from "./ready";
import {
  aiEnrichmentStatusLabel,
  editorialPreviewTone,
  editorialStatusAfterEnrichment,
  editorialStatusLabel,
  researchPreviewSubtitle,
} from "./status";

const INTERNAL_FIELDS = [
  "editorialStatus",
  "editorialReviewNote",
  "reviewedStudyDetails",
  "reviewedMainFindings",
  "reviewedInterpretation",
  "reviewedLimitations",
  "reviewedLinks",
  "reviewedAt",
  "reviewedBy",
  "aiEnrichedAt",
  "aiModel",
  "aiEnrichmentStatus",
  "aiEnrichmentNote",
  "automationNote",
  "importSource",
  "importedAt",
  "sourceQueries",
];

test("editorial filters select the intended research documents", () => {
  const documents: EditorialListDocument[] = [
    {
      _id: "research-pubmed-1",
      _originalId: "drafts.research-pubmed-1",
      _type: "research",
      editorialStatus: "needs_review",
    },
    {
      _id: "research-pubmed-2",
      _originalId: "drafts.research-pubmed-2",
      _type: "research",
      editorialStatus: "ready",
    },
    {
      _id: "research-published",
      _originalId: "research-published",
      _type: "research",
      editorialStatus: "published",
    },
    {
      _id: "research-live",
      _originalId: "research-live",
      _type: "research",
      editorialStatus: "needs_review",
    },
    { _id: "drafts.article-1", _originalId: "drafts.article-1", _type: "article", editorialStatus: "needs_review" },
  ];

  const ids = (list: ResearchEditorialListId) =>
    documents.filter((document) => matchesResearchEditorialList(document, list)).map((document) => document._id);

  assert.deepEqual(ids("needsReview"), ["research-pubmed-1", "research-live"]);
  assert.deepEqual(ids("readyToPublish"), ["research-pubmed-2"]);
  assert.deepEqual(ids("published"), ["research-published", "research-live"]);

  assert.equal(
    matchesResearchEditorialList(
      {
        _id: "research-pubmed-2",
        _originalId: "drafts.research-pubmed-2",
        _type: "research",
        editorialStatus: "ready",
      },
      "needsReview",
    ),
    false,
  );

  for (const filter of Object.values(RESEARCH_EDITORIAL_FILTERS)) {
    assert.equal(filter.includes('path("drafts.**")'), false, filter);
  }
  assert.equal(
    RESEARCH_EDITORIAL_FILTERS.needsReview,
    '_type == "research" && editorialStatus == "needs_review"',
  );
  assert.equal(
    RESEARCH_EDITORIAL_FILTERS.readyToPublish,
    '_type == "research" && editorialStatus == "ready"',
  );
  assert.equal(
    RESEARCH_EDITORIAL_FILTERS.published,
    '_type == "research" && _originalId == _id',
  );
});

test("studio research desk exposes the editorial lists and keeps the document type", () => {
  assert.deepEqual(
    RESEARCH_EDITORIAL_DESK.map((item) => item.title),
    ["Needs Review", "Ready to Publish", "Published", "All Research"],
  );
  const all = RESEARCH_EDITORIAL_DESK.find((item) => item.kind === "documentType");
  assert.equal(all?.schemaType, "research");

  const root = (
    structure(mockStructureBuilder() as never, {} as never) as unknown as { spec: Spec }
  ).spec;
  assert.equal(root.title, "Content");
  assert.equal(root.items?.[0]?.title, "Articles");
  assert.equal(root.items?.[0]?.schemaType, "article");
  assert.equal(root.items?.[1]?.title, "Research");

  const research = root.items?.[1]?.child;
  assert.equal(research?.title, "Research");
  assert.deepEqual(
    research?.items?.map((item) => item.title),
    ["Needs Review", "Ready to Publish", "Published", "All Research"],
  );
  assert.equal(research?.items?.[0]?.child?.filter, RESEARCH_EDITORIAL_FILTERS.needsReview);
  assert.equal(research?.items?.[1]?.child?.filter, RESEARCH_EDITORIAL_FILTERS.readyToPublish);
  assert.equal(research?.items?.[2]?.child?.filter, RESEARCH_EDITORIAL_FILTERS.published);
  assert.equal(research?.items?.[0]?.child?.schemaType, "research");
  assert.equal(research?.items?.[3]?.schemaType, "research");
  assert.equal(research?.items?.[3]?.type, "documentTypeListItem");
  assert.equal(research?.items?.[3]?.title, "All Research");
});

test("research preview identifies editorial and AI status without hiding the study", () => {
  assert.equal(editorialStatusLabel(undefined, "drafts.research-pubmed-1"), "Needs Review");
  assert.equal(editorialStatusLabel(undefined, "research-published"), "");
  assert.equal(editorialStatusLabel("ready"), "Ready to Publish");
  assert.equal(editorialStatusLabel("published"), "Published");
  assert.equal(aiEnrichmentStatusLabel("needs_review"), "AI needs review");
  assert.equal(aiEnrichmentStatusLabel("completed"), "AI completed");
  assert.equal(editorialPreviewTone(undefined, "drafts.research-pubmed-1"), "needs_review");
  assert.equal(editorialPreviewTone(undefined, "research-published"), "neutral");
  assert.equal(editorialPreviewTone("ready"), "ready");
  assert.equal(editorialPreviewTone("published"), "neutral");

  const subtitle = researchPreviewSubtitle({
    editorialStatus: "needs_review",
    aiEnrichmentStatus: "completed",
    documentId: "drafts.research-pubmed-1",
    details: ["English", "Exercise Snacks"],
  });
  assert.equal(subtitle, "English · Exercise Snacks · Needs Review · AI completed");

  const prepare = researchType.preview?.prepare;
  assert.equal(typeof prepare, "function");
  if (!prepare) return;

  const image = { _type: "image" };
  const selected = (overrides: Record<string, unknown>) =>
    ({
    title: "Stair snacks",
    id: "drafts.research-pubmed-1",
    language: "en",
    topic: "exercise-snacks",
    editorialStatus: undefined,
    aiEnrichmentStatus: undefined,
    media: image,
      ...overrides,
    }) as Parameters<typeof prepare>[0];

  const empty = prepare(
    selected({ editorialStatus: undefined, aiEnrichmentStatus: "needs_review" }),
  );
  assert.equal(String(empty.subtitle), "English · Exercise Snacks · Needs Review · AI needs review");
  assert.notEqual(empty.media, image);

  const ready = prepare(selected({ editorialStatus: "ready", aiEnrichmentStatus: "completed" }));
  assert.equal(String(ready.subtitle), "English · Exercise Snacks · Ready to Publish · AI completed");
  assert.notEqual(ready.media, image);

  const published = prepare(
    selected({
      id: "research-published",
      editorialStatus: "published",
      aiEnrichmentStatus: "completed",
    }),
  );
  assert.equal(String(published.subtitle), "English · Exercise Snacks · Published · AI completed");
  assert.equal(published.media, image);

  const publishedWithoutStatus = prepare(
    selected({
      id: "research-published",
      editorialStatus: undefined,
      aiEnrichmentStatus: undefined,
    }),
  );
  assert.equal(String(publishedWithoutStatus.subtitle).includes("Needs Review"), false);
  assert.equal(publishedWithoutStatus.media, image);
});

test("editorial fields stay on the internal review group", () => {
  const fields = fieldMap(researchType.fields as unknown as readonly FieldDef[]);
  assert.equal(fields.editorialStatus?.group, "editorial");
  assert.equal(fields.editorialReviewNote?.group, "editorial");
  assert.equal(fields.reviewedAt?.group, "editorial");
  assert.equal(fields.reviewedBy?.group, "editorial");
  assert.equal(fields.aiEnrichmentStatus?.group, "editorial");
  assert.equal(fields.aiEnrichmentNote?.group, "editorial");
  assert.equal(fields.aiEnrichedAt?.group, "editorial");
  assert.equal(fields.aiModel?.group, "editorial");
  assert.equal(fields.importSource?.group, "editorial");
  assert.equal(fields.importedAt?.group, "editorial");
  assert.equal(fields.sourceQueries?.group, "editorial");
  assert.equal(fields.automationNote?.group, "editorial");
  assert.equal(fields.title?.group, "basic");
  assert.equal(fields.editorialChecklist, undefined);

  for (const name of [
    "reviewedStudyDetails",
    "reviewedMainFindings",
    "reviewedInterpretation",
    "reviewedLimitations",
    "reviewedLinks",
  ]) {
    assert.equal(fields[name]?.group, "editorial", name);
    assert.equal(fields[name]?.validation, undefined, name);
  }

  const groups = researchType.groups ?? [];
  assert.ok(groups.some((group) => group.name === "editorial" && group.title === "Editorial"));
  assert.equal(groups.some((group) => group.name === "automation"), false);
  assert.equal(researchType.preview?.select?.editorialStatus, "editorialStatus");
  assert.equal(researchType.preview?.select?.aiEnrichmentStatus, "aiEnrichmentStatus");
  assert.equal(researchType.preview?.select?.id, "_id");
  assert.equal(typeof researchType.validation, "function");
});

test("public research queries ignore editorial fields and drafts stay unpublished", () => {
  const queries = [
    researchByLanguageQuery,
    researchByLanguageAndSlugQuery,
    publishedResearchParamsQuery,
    publishedResearchSitemapQuery,
    researchTranslationQuery,
  ];
  for (const query of queries) {
    assert.match(query, /!\(_id in path\("drafts\.\*\*"\)\)/);
    for (const field of INTERNAL_FIELDS) {
      assert.equal(query.includes(field), false, field);
    }
  }
});

test("discovery still recognizes every research document, including rejected drafts", () => {
  assert.match(RESEARCH_IDENTIFIERS_QUERY, /\*\[_type == "research"\]/);
  assert.equal(RESEARCH_IDENTIFIERS_QUERY.includes("editorialStatus"), false);
  assert.equal(RESEARCH_IDENTIFIERS_QUERY.includes("rejected"), false);
  assert.match(ELIGIBLE_DRAFTS_QUERY, /editorialStatus != "rejected"/);
  assert.match(ELIGIBLE_DRAFTS_QUERY, /_id in path\("drafts\.\*\*"\)/);
});

test("ready status warns without blocking a save", () => {
  const ready = {
    editorialStatus: "ready",
    title: "",
    excerpt: " ",
    topic: undefined,
    mainFindings: [],
    publishedAt: null,
    doi: "",
    studyUrl: "  ",
  };
  assert.equal(readyFieldWarning(ready, ready.title, READY_EDITORIAL_WARNINGS.title), READY_EDITORIAL_WARNINGS.title);
  assert.equal(
    readyFieldWarning(ready, ready.excerpt, READY_EDITORIAL_WARNINGS.excerpt),
    READY_EDITORIAL_WARNINGS.excerpt,
  );
  assert.equal(readyFieldWarning(ready, ready.topic, READY_EDITORIAL_WARNINGS.topic), READY_EDITORIAL_WARNINGS.topic);
  assert.equal(
    readyFieldWarning(ready, ready.mainFindings, READY_EDITORIAL_WARNINGS.mainFindings),
    READY_EDITORIAL_WARNINGS.mainFindings,
  );
  assert.equal(
    readyFieldWarning(ready, ready.publishedAt, READY_EDITORIAL_WARNINGS.publishedAt),
    READY_EDITORIAL_WARNINGS.publishedAt,
  );
  assert.equal(readySourceLinkWarning(ready), READY_EDITORIAL_WARNINGS.sourceLink);

  const complete = {
    editorialStatus: "ready",
    title: "Stair snacks",
    doi: "10.1000/example",
    studyUrl: "",
  };
  assert.equal(readyFieldWarning(complete, complete.title, READY_EDITORIAL_WARNINGS.title), true);
  assert.equal(readySourceLinkWarning(complete), true);
  assert.equal(
    readyFieldWarning({ editorialStatus: "needs_review" }, "", READY_EDITORIAL_WARNINGS.title),
    true,
  );
  assert.equal(readySourceLinkWarning({ editorialStatus: "needs_review" }), true);
});

test("optional backfill only fills empty status on AI-enriched PubMed drafts", () => {
  assert.deepEqual(
    editorialBackfillPatch({
      _id: "drafts.research-pubmed-42",
      aiEnrichmentStatus: "completed",
    }),
    { editorialStatus: "needs_review" },
  );
  assert.equal(
    editorialBackfillPatch({
      _id: "drafts.research-pubmed-42",
      editorialStatus: "reviewed",
      aiEnrichmentStatus: "needs_review",
    }),
    null,
  );
  assert.equal(
    editorialBackfillPatch({
      _id: "drafts.research-pubmed-42",
      editorialStatus: "rejected",
      aiEnrichmentStatus: "completed",
    }),
    null,
  );
  assert.equal(
    editorialBackfillPatch({
      _id: "research-pubmed-42",
      aiEnrichmentStatus: "completed",
    }),
    null,
  );
  assert.equal(
    editorialBackfillPatch({
      _id: "drafts.research-pubmed-42",
    }),
    null,
  );
  assert.equal(editorialStatusAfterEnrichment("ready_to_publish"), undefined);
  assert.equal(editorialStatusAfterEnrichment(undefined), "needs_review");
});

type FieldDef = {
  name?: string;
  group?: string | string[];
  validation?: unknown;
  fields?: FieldDef[];
};

function fieldMap(fields: readonly FieldDef[]): Record<string, FieldDef> {
  const entries: [string, FieldDef][] = [];
  for (const field of fields) {
    if (field.name) entries.push([field.name, field]);
  }
  return Object.fromEntries(entries);
}

type Spec = {
  type: string;
  title?: string;
  schemaType?: string;
  filter?: string;
  items?: Spec[];
  child?: Spec;
};

function mockStructureBuilder() {
  const builder = (type: string) => {
    const spec: Spec = { type };
    const api = {
      spec,
      title(value: string) {
        spec.title = value;
        return api;
      },
      icon() {
        return api;
      },
      schemaType(value: string) {
        spec.schemaType = value;
        return api;
      },
      filter(value: string) {
        spec.filter = value;
        return api;
      },
      items(value: Array<{ spec: Spec }>) {
        spec.items = value.map((item) => item.spec);
        return api;
      },
      child(value: { spec: Spec }) {
        spec.child = value.spec;
        return api;
      },
    };
    return api;
  };

  return {
    list: () => builder("list"),
    listItem: () => builder("listItem"),
    documentList: () => builder("documentList"),
    documentTypeListItem: (schemaType: string) => builder("documentTypeListItem").schemaType(schemaType),
  };
}
