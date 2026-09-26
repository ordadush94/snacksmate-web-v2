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
  aiEnrichmentStatusLabel,
  editorialPreviewTone,
  editorialStatusAfterEnrichment,
  editorialStatusLabel,
  researchPreviewSubtitle,
} from "./status";

const INTERNAL_FIELDS = [
  "editorialStatus",
  "editorialReviewNote",
  "editorialChecklist",
  "reviewedAt",
  "reviewedBy",
  "reviewedMetadata",
  "reviewedScientificSummary",
  "reviewedPracticalInterpretation",
  "reviewedLinks",
  "aiEnrichedAt",
  "aiModel",
  "aiEnrichmentStatus",
  "aiEnrichmentNote",
];

test("editorial filters select the intended research documents", () => {
  const documents: EditorialListDocument[] = [
    { _id: "drafts.research-pubmed-1", _type: "research", editorialStatus: "needs_review" },
    { _id: "drafts.research-pubmed-2", _type: "research" },
    { _id: "drafts.research-pubmed-3", _type: "research", editorialStatus: "ready_to_publish" },
    { _id: "drafts.research-pubmed-4", _type: "research", editorialStatus: "rejected" },
    { _id: "drafts.research-pubmed-5", _type: "research", editorialStatus: "reviewed" },
    { _id: "drafts.research-pubmed-6", _type: "research", editorialStatus: "published_manually" },
    { _id: "research-pubmed-1", _type: "research", editorialStatus: "needs_review" },
    { _id: "research-published", _type: "research" },
    { _id: "research-ready", _type: "research", editorialStatus: "ready_to_publish" },
    { _id: "research-rejected", _type: "research", editorialStatus: "rejected" },
    { _id: "drafts.article-1", _type: "article", editorialStatus: "needs_review" },
  ];

  const ids = (list: ResearchEditorialListId) =>
    documents.filter((document) => matchesResearchEditorialList(document, list)).map((document) => document._id);

  assert.deepEqual(ids("needsReview"), [
    "drafts.research-pubmed-1",
    "drafts.research-pubmed-2",
    "research-pubmed-1",
  ]);
  assert.deepEqual(ids("readyToPublish"), ["drafts.research-pubmed-3", "research-ready"]);
  assert.deepEqual(ids("published"), [
    "research-pubmed-1",
    "research-published",
    "research-ready",
    "research-rejected",
  ]);
  assert.deepEqual(ids("rejected"), ["drafts.research-pubmed-4", "research-rejected"]);

  assert.equal(
    matchesResearchEditorialList(
      { _id: "drafts.research-pubmed-5", _type: "research", editorialStatus: "reviewed" },
      "needsReview",
    ),
    false,
  );
  assert.equal(
    matchesResearchEditorialList(
      { _id: "research-published", _type: "research" },
      "needsReview",
    ),
    false,
  );

  assert.equal(
    RESEARCH_EDITORIAL_FILTERS.needsReview,
    '_type == "research" && (editorialStatus == "needs_review" || (!defined(editorialStatus) && _id in path("drafts.**")))',
  );
  assert.equal(
    RESEARCH_EDITORIAL_FILTERS.readyToPublish,
    '_type == "research" && editorialStatus == "ready_to_publish"',
  );
  assert.equal(
    RESEARCH_EDITORIAL_FILTERS.published,
    '_type == "research" && !(_id in path("drafts.**"))',
  );
  assert.equal(
    RESEARCH_EDITORIAL_FILTERS.rejected,
    '_type == "research" && editorialStatus == "rejected"',
  );
});

test("studio research desk exposes the editorial lists and keeps the document type", () => {
  assert.deepEqual(
    RESEARCH_EDITORIAL_DESK.map((item) => item.title),
    ["Needs Review", "Ready to Publish", "Published", "Rejected", "All Research"],
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
    ["Needs Review", "Ready to Publish", "Published", "Rejected", "All Research"],
  );
  assert.equal(research?.items?.[0]?.child?.filter, RESEARCH_EDITORIAL_FILTERS.needsReview);
  assert.equal(research?.items?.[1]?.child?.filter, RESEARCH_EDITORIAL_FILTERS.readyToPublish);
  assert.equal(research?.items?.[2]?.child?.filter, RESEARCH_EDITORIAL_FILTERS.published);
  assert.equal(research?.items?.[3]?.child?.filter, RESEARCH_EDITORIAL_FILTERS.rejected);
  assert.equal(research?.items?.[0]?.child?.schemaType, "research");
  assert.equal(research?.items?.[4]?.schemaType, "research");
  assert.equal(research?.items?.[4]?.type, "documentTypeListItem");
});

test("research preview identifies editorial and AI status without hiding the study", () => {
  assert.equal(editorialStatusLabel(undefined, "drafts.research-pubmed-1"), "Needs review");
  assert.equal(editorialStatusLabel(undefined, "research-published"), "");
  assert.equal(editorialStatusLabel("ready_to_publish"), "Ready to publish");
  assert.equal(editorialStatusLabel("rejected"), "Rejected");
  assert.equal(aiEnrichmentStatusLabel("needs_review"), "AI needs review");
  assert.equal(editorialPreviewTone(undefined, "drafts.research-pubmed-1"), "needs_review");
  assert.equal(editorialPreviewTone(undefined, "research-published"), "neutral");
  assert.equal(editorialPreviewTone("ready_to_publish"), "ready_to_publish");
  assert.equal(editorialPreviewTone("rejected"), "rejected");
  assert.equal(editorialPreviewTone("reviewed"), "neutral");

  const subtitle = researchPreviewSubtitle({
    editorialStatus: undefined,
    aiEnrichmentStatus: "needs_review",
    documentId: "drafts.research-pubmed-1",
    details: ["English", "Exercise Snacks", "Randomized Controlled Trial", 2024],
  });
  assert.equal(
    subtitle,
    "Needs review · AI needs review · English · Exercise Snacks · Randomized Controlled Trial · 2024",
  );

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
    studyDesign: "randomized-controlled-trial",
    year: 2024,
    editorialStatus: undefined,
    aiEnrichmentStatus: undefined,
    media: image,
      ...overrides,
    }) as Parameters<typeof prepare>[0];

  const empty = prepare(
    selected({ editorialStatus: undefined, aiEnrichmentStatus: "needs_review" }),
  );
  assert.match(String(empty.subtitle), /^Needs review · AI needs review · English/);
  assert.notEqual(empty.media, image);

  const ready = prepare(selected({ editorialStatus: "ready_to_publish" }));
  assert.match(String(ready.subtitle), /^Ready to publish/);
  assert.notEqual(ready.media, image);

  const rejected = prepare(
    selected({ editorialStatus: "rejected", aiEnrichmentStatus: "completed" }),
  );
  assert.match(String(rejected.subtitle), /^Rejected · AI completed/);
  assert.notEqual(rejected.media, image);

  const reviewed = prepare(selected({ editorialStatus: "reviewed" }));
  assert.match(String(reviewed.subtitle), /^Reviewed/);
  assert.equal(reviewed.media, image);

  const published = prepare(
    selected({
      id: "research-published",
      editorialStatus: undefined,
      aiEnrichmentStatus: undefined,
    }),
  );
  assert.equal(String(published.subtitle).includes("Needs review"), false);
  assert.equal(published.media, image);
});

test("editorial fields stay on the internal review group", () => {
  const fields = fieldMap(researchType.fields as unknown as readonly FieldDef[]);
  assert.equal(fields.editorialStatus?.group, "editorial");
  assert.equal(fields.editorialReviewNote?.group, "editorial");
  assert.equal(fields.reviewedAt?.group, "editorial");
  assert.equal(fields.reviewedBy?.group, "editorial");
  assert.equal(fields.editorialChecklist?.group, "editorial");
  assert.equal(fields.aiEnrichmentStatus?.group, "editorial");
  assert.equal(fields.aiEnrichmentNote?.group, "editorial");
  assert.equal(fields.aiEnrichedAt?.group, "editorial");
  assert.equal(fields.aiModel?.group, "editorial");
  assert.equal(fields.importSource?.group, "automation");
  assert.equal(fields.title?.group, "basic");

  const checklist = fields.editorialChecklist?.fields ?? [];
  assert.deepEqual(
    checklist.map((field) => field.name),
    [
      "reviewedMetadata",
      "reviewedScientificSummary",
      "reviewedPracticalInterpretation",
      "reviewedLinks",
    ],
  );
  for (const field of checklist) {
    assert.equal(field.validation, undefined, field.name);
  }

  const groups = researchType.groups ?? [];
  assert.ok(groups.some((group) => group.name === "editorial" && group.title === "Editorial Review"));
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
