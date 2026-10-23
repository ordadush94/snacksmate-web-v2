import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import type { ResearchDraftSnapshot } from "../research-enrichment/apply";
import type { EnrichmentSummary } from "../research-enrichment/run";
import {
  loadResearchImageDocumentsByIds,
  RESEARCH_IMAGE_DOCUMENTS_BY_ID_QUERY,
} from "../research-images/sanity";
import type { ResearchImageDocument } from "../research-images/types";
import { buildHebrewDraft } from "../translation/document";
import { runHebrewTranslation } from "../translation/run";
import type { EnglishDocument, ResearchTranslation } from "../translation/types";
import { attachResearchCoverImages } from "./images";
import {
  automateCreatedResearchDrafts,
  combineAutomationReport,
  formatResearchAutomationReport,
} from "./run";

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);
const NEW_ASSET = "image-new-study-2048x1152-png";
const EXISTING_ASSET = "image-existing-1400x788-png";
const HEBREW = /[\u0590-\u05FF]/;
const HEBREW_ALT = "איור של אדם העולה במדרגות במהלך פעילות גופנית קצרה.";

test("scheduled images load only the draft ids from this run", async () => {
  let query = "";
  let params: unknown;
  const documents = await loadResearchImageDocumentsByIds(
    {
      fetch: async (nextQuery, nextParams) => {
        query = nextQuery;
        params = nextParams;
        return [{ _id: "drafts.research-pubmed-11", language: "en", pmid: "11", title: "Stairs" }];
      },
    },
    [" drafts.research-pubmed-11 ", "drafts.research-pubmed-11", ""],
  );
  assert.equal(query, RESEARCH_IMAGE_DOCUMENTS_BY_ID_QUERY);
  assert.match(query, /_id in \$ids/);
  assert.equal(query.includes('*[_type == "research"]{'), false);
  assert.deepEqual(params, { ids: ["drafts.research-pubmed-11"] });
  assert.equal(documents[0]?._id, "drafts.research-pubmed-11");

  let calls = 0;
  const empty = await loadResearchImageDocumentsByIds(
    {
      fetch: async () => {
        calls += 1;
        return [];
      },
    },
    [],
  );
  assert.equal(calls, 0);
  assert.deepEqual(empty, []);
});

test("new enriched drafts get one shared image before Hebrew, and one failure stays isolated", async () => {
  const documents = new Map<string, ResearchImageDocument>([
    ["11", cover("11", { intervention: "Participants completed short stair-climbing bouts." })],
    ["12", cover("12", { intervention: "Participants completed stationary cycling." })],
    [
      "13",
      cover("13", {
        intervention: "Participants completed a short walk.",
        mainImage: {
          _type: "image",
          alt: "Illustration of a person taking a short walk.",
          asset: { _type: "reference", _ref: EXISTING_ASSET },
        },
      }),
    ],
  ]);
  const snapshots = new Map<string, ResearchDraftSnapshot>([
    ["10", snapshot("10")],
    ["11", snapshot("11", { excerpt: "Stair summary.", aiEnrichmentStatus: "needs_review" })],
    ["12", snapshot("12", { excerpt: "Cycling summary.", aiEnrichmentStatus: "completed" })],
    ["13", snapshot("13", { excerpt: "Walking summary.", aiEnrichmentStatus: "completed" })],
  ]);
  const events: string[] = [];
  const uploads: string[] = [];
  const patches: { id: string; fields: Record<string, unknown> }[] = [];
  let generations = 0;
  const hebrewDrafts: { pmid: string; asset: string; alt: string }[] = [];

  const automation = await mute(async () =>
    automateCreatedResearchDrafts({
      created: [ref("10"), ref("11"), ref("12"), ref("13")],
      loadDrafts: async (pmids) => pmids.flatMap((pmid) => snapshots.get(pmid) ?? []),
      enrich: async () => {
        events.push("enrich");
        return summaryFor([
          { pmid: "10", outcome: "failed" },
          { pmid: "11", outcome: "enriched" },
          { pmid: "12", outcome: "enriched" },
          { pmid: "13", outcome: "enriched" },
        ]);
      },
      reloadDrafts: async (pmids) => pmids.flatMap((pmid) => snapshots.get(pmid) ?? []),
      attachImages: async (studies) => {
        events.push("image");
        assert.deepEqual(
          studies.map((study) => study.pmid),
          ["11", "12", "13"],
        );
        assert.equal(studies.some((study) => study.pmid === "10"), false);
        return attachResearchCoverImages({
          documents: studies.flatMap((study) => {
            const document = documents.get(study.pmid);
            return document ? [document] : [];
          }),
          qaModel: "gpt-5.6-luna",
          generateImage: async (request) => {
            generations += 1;
            if (request.prompt.includes("Activity: cycling.")) {
              throw new Error("image provider unavailable");
            }
            return PNG;
          },
          reviewImage: async () => ({
            hasVisibleText: false,
            activityMatches: true,
            reason: "The activity is visible and the image has no text.",
          }),
          uploadImage: async (_bytes, filename) => {
            uploads.push(filename);
            return NEW_ASSET;
          },
          patchDocument: async (id, fields) => {
            patches.push({ id, fields });
            const pmid = id.replace("drafts.research-pubmed-", "");
            const document = documents.get(pmid);
            if (!document) throw new Error(`missing ${id}`);
            document.mainImage = fields.mainImage as ResearchImageDocument["mainImage"];
            document.imageAutomation = fields.imageAutomation as ResearchImageDocument["imageAutomation"];
          },
          now: () => new Date("2026-10-23T00:00:00.000Z"),
        });
      },
      loadTranslationSource: async (draftId) => {
        const pmid = draftId.replace("drafts.research-pubmed-", "");
        events.push(`reload:${pmid}`);
        return englishFrom(documents.get(pmid)!);
      },
      translate: async (sources) => {
        events.push("hebrew");
        assert.equal(generations, 2);
        const stair = researchDocument(sources, "11");
        const cycle = researchDocument(sources, "12");
        const walk = researchDocument(sources, "13");
        assert.equal(stair?.mainImage?.asset?._ref, NEW_ASSET);
        assert.equal(stair?.editorialStatus, "needs_review");
        assert.equal(cycle?.mainImage, null);
        assert.equal(walk?.mainImage?.asset?._ref, EXISTING_ASSET);
        return runHebrewTranslation({
          dryRun: false,
          model: "gpt-5.6-luna",
          sources: sources.map((source) => source.document),
          existing: [],
          translate: async () => hebrewTranslation(),
          writeDraft: async (draft) => {
            hebrewDrafts.push({
              pmid: draft.pmid ?? "",
              asset: draft.mainImage?.asset?._ref ?? "",
              alt: draft.mainImage?.alt ?? "",
            });
          },
          log: () => undefined,
          now: () => "2026-10-23T00:00:00.000Z",
        });
      },
    }),
  );

  assert.deepEqual(events, ["enrich", "image", "reload:11", "reload:12", "reload:13", "hebrew"]);
  assert.equal(generations, 2);
  assert.deepEqual(uploads, ["research-cover-pmid-11.png"]);
  assert.equal(patches.length, 1);
  assert.equal(patches[0]?.id, "drafts.research-pubmed-11");
  assert.deepEqual(Object.keys(patches[0]?.fields ?? {}).sort(), ["imageAutomation", "mainImage"]);
  assert.equal("editorialStatus" in (patches[0]?.fields ?? {}), false);
  const mainImage = patches[0]?.fields.mainImage as { alt?: string; asset?: { _ref?: string } };
  const automationRecord = patches[0]?.fields.imageAutomation as { source?: string; assetRef?: string };
  assert.equal(mainImage.asset?._ref, NEW_ASSET);
  assert.equal(HEBREW.test(mainImage.alt ?? ""), false);
  assert.notEqual(mainImage.alt, HEBREW_ALT);
  assert.equal(automationRecord.source, "research-image-automation");
  assert.equal(automationRecord.assetRef, NEW_ASSET);
  assert.equal(documents.has("12"), true);
  assert.equal(documents.get("12")?.mainImage, undefined);
  assert.equal(snapshots.get("11")?.aiEnrichmentStatus, "needs_review");

  assert.deepEqual(
    hebrewDrafts.map((draft) => draft.pmid).sort(),
    ["11", "12", "13"],
  );
  const stairHebrew = hebrewDrafts.find((draft) => draft.pmid === "11");
  const cycleHebrew = hebrewDrafts.find((draft) => draft.pmid === "12");
  const walkHebrew = hebrewDrafts.find((draft) => draft.pmid === "13");
  assert.equal(stairHebrew?.asset, NEW_ASSET);
  assert.equal(stairHebrew?.alt, HEBREW_ALT);
  assert.equal(cycleHebrew?.asset, "");
  assert.equal(walkHebrew?.asset, EXISTING_ASSET);
  assert.equal(walkHebrew?.alt, HEBREW_ALT);
  assert.equal(HEBREW.test(stairHebrew?.alt ?? ""), true);

  assert.equal(automation.enrichmentAttempted, 4);
  assert.equal(automation.enrichedSuccessfully, 3);
  assert.equal(automation.enrichmentFailed, 1);
  assert.equal(automation.imageEligible, 3);
  assert.equal(automation.imageGenerationAttempted, 2);
  assert.equal(automation.imageGenerated, 1);
  assert.equal(automation.imageGenerationFailed, 1);
  assert.equal(automation.sanityImageUploadsAttempted, 1);
  assert.equal(automation.sanityImageUploadsCompleted, 1);
  assert.equal(automation.englishImageAttached, 1);
  assert.equal(automation.englishAltCreated, 1);
  assert.equal(automation.hebrewDraftsCreated, 3);
  assert.equal(automation.hebrewImageAssetReused, 2);
  assert.equal(automation.hebrewAltCreated, 2);
  assert.equal(automation.translationFailed, 0);
  assert.equal(automation.studies.find((study) => study.pmid === "10")?.imageStatus, "not_eligible");
  assert.equal(automation.studies.find((study) => study.pmid === "12")?.imageStatus, "failed");
  assert.match(
    automation.studies.find((study) => study.pmid === "12")?.imageFailure ?? "",
    /image provider unavailable/,
  );
  assert.equal(automation.studies.find((study) => study.pmid === "13")?.imageStatus, "skipped_existing");
  assert.equal(snapshots.has("10"), true);
  assert.equal(snapshots.has("12"), true);

  const report = formatResearchAutomationReport(
    combineAutomationReport(
      {
        dryRun: false,
        lookbackDays: 14,
        queriesRun: 1,
        pubmedRecordsFound: 4,
        duplicatesSkipped: 0,
        rejected: 0,
        reviewCandidates: 0,
        autoDraftCandidates: 4,
        createdDrafts: [ref("10"), ref("11"), ref("12"), ref("13")],
        wouldCreate: [],
        withheldByLimit: [],
        errors: 0,
      },
      automation,
    ),
  );
  assert.match(report, /Research created: 4/);
  assert.match(report, /Enrichment attempted: 4/);
  assert.match(report, /Enrichment completed: 3/);
  assert.match(report, /Image eligible: 3/);
  assert.match(report, /Image generation attempted: 2/);
  assert.match(report, /Image generated: 1/);
  assert.match(report, /Image generation failed: 1/);
  assert.match(report, /Sanity image uploads attempted: 1/);
  assert.match(report, /Sanity image uploads completed: 1/);
  assert.match(report, /English image attached: 1/);
  assert.match(report, /English ALT created: 1/);
  assert.match(report, /Hebrew drafts created: 3/);
  assert.match(report, /Image asset reused in Hebrew: 2/);
  assert.match(report, /Hebrew ALT created: 2/);
  assert.match(report, /Translation failed: 0/);
  assert.match(report, /Published: 0/);
  assert.match(report, /PMID: 12/);
  assert.match(report, /Image status: failed/);
  assert.match(report, /Same image reused: yes/);
  assert.equal(report.includes(".publish("), false);

  const direct = buildHebrewDraft({
    source: englishFrom(documents.get("11")!),
    translation: hebrewTranslation(),
    model: "gpt-5.6-luna",
    translatedAt: "2026-10-23T00:00:00.000Z",
  });
  assert.equal(direct.mainImage?.asset?._ref, NEW_ASSET);
  assert.equal(direct.mainImage?.alt, HEBREW_ALT);
  assert.equal(direct.editorialStatus, "needs_review");
});

test("an image batch failure keeps every English draft and still translates", async () => {
  const snapshots = new Map<string, ResearchDraftSnapshot>([
    ["21", snapshot("21", { excerpt: "A usable summary.", aiEnrichmentStatus: "completed" })],
    ["22", snapshot("22", { excerpt: "A usable summary.", aiEnrichmentStatus: "needs_review" })],
  ]);
  const translated: string[] = [];
  const automation = await automateCreatedResearchDrafts({
    created: [ref("21"), ref("22")],
    loadDrafts: async () => [...snapshots.values()],
    enrich: async () =>
      summaryFor([
        { pmid: "21", outcome: "enriched" },
        { pmid: "22", outcome: "enriched" },
      ]),
    reloadDrafts: async () => [...snapshots.values()],
    attachImages: async () => {
      throw new Error("OPENAI_API_KEY must be set before image generation. Nothing was written.");
    },
    loadTranslationSource: async (draftId) => englishFrom(cover(draftId.replace("drafts.research-pubmed-", ""))),
    translate: async (sources) => {
      translated.push(...sources.map((source) => researchPmid(source.document)));
      return {
        created: sources.length,
        skipped: 0,
        failed: 0,
        dryRun: 0,
        reports: [],
        items: sources.map((source) => ({
          sourceId: source.document._id,
          outcome: "created" as const,
          draftId: `drafts.research-he-${source.document._id.replace(/^drafts\./, "")}`,
          translationStatus: "needs_review" as const,
          imageAssetRef: null,
          imageAlt: null,
        })),
      };
    },
  });

  assert.deepEqual(translated.sort(), ["21", "22"]);
  assert.equal(snapshots.has("21"), true);
  assert.equal(snapshots.has("22"), true);
  assert.equal(automation.imageGenerationAttempted, 2);
  assert.equal(automation.imageGenerationFailed, 2);
  assert.equal(automation.imageGenerated, 0);
  assert.equal(automation.hebrewDraftsCreated, 2);
  assert.equal(automation.translationFailed, 0);
  assert.match(automation.studies[0]?.imageFailure ?? "", /OPENAI_API_KEY/);
  assert.equal(automation.studies.every((study) => study.imageStatus === "failed"), true);
});

test("image automation files do not publish", () => {
  const files = [
    new URL("./images.ts", import.meta.url),
    new URL("./run.ts", import.meta.url),
    new URL("../../scripts/automate-research.ts", import.meta.url),
    new URL("../../.github/workflows/research-discovery.yml", import.meta.url),
    new URL("../../.github/workflows/research-image-backfill.yml", import.meta.url),
  ];
  for (const file of files) {
    const source = readFileSync(file, "utf8");
    assert.equal(source.includes(".publish("), false, file.pathname);
    assert.equal(source.includes("createOrReplace"), false, file.pathname);
  }
});

function ref(pmid: string) {
  return {
    pmid,
    draftId: `drafts.research-pubmed-${pmid}`,
    title: `Study ${pmid}`,
  };
}

function snapshot(
  pmid: string,
  extra: Partial<ResearchDraftSnapshot> = {},
): ResearchDraftSnapshot {
  return {
    _id: `drafts.research-pubmed-${pmid}`,
    pmid,
    title: `Study ${pmid}`,
    editorialStatus: "needs_review",
    ...extra,
  };
}

function cover(
  pmid: string,
  extra: Partial<ResearchImageDocument> = {},
): ResearchImageDocument {
  return {
    _id: `drafts.research-pubmed-${pmid}`,
    language: "en",
    title: `Study ${pmid}`,
    seoTitle: `Study ${pmid}`,
    excerpt: "Participants used a short bout of movement during the day.",
    population: "Inactive adults",
    pmid,
    ...extra,
  };
}

function researchDocument(
  sources: readonly { document: EnglishDocument }[],
  pmid: string,
): Extract<EnglishDocument, { _type: "research" }> {
  const document = sources.find((source) => researchPmid(source.document) === pmid)?.document;
  if (!document || document._type !== "research") throw new Error(`missing research ${pmid}`);
  return document;
}

function researchPmid(document: EnglishDocument): string {
  return document._type === "research" ? document.pmid ?? "" : "";
}

function englishFrom(document: ResearchImageDocument): EnglishDocument {
  return {
    _id: document._id,
    _type: "research",
    language: "en",
    title: document.title || "Study",
    slug: `study-${document.pmid}`,
    excerpt: document.excerpt || "Participants used a short bout of movement during the day.",
    pmid: document.pmid,
    editorialStatus: "needs_review",
    mainImage: document.mainImage?.asset?._ref
      ? {
          _type: "image",
          alt: document.mainImage.alt ?? "",
          asset: { _type: "reference", _ref: document.mainImage.asset._ref },
        }
      : null,
  };
}

function hebrewTranslation(): ResearchTranslation {
  return {
    kind: "research",
    excerpt:
      "משתתפים לא פעילים ביצעו רצף קצר של תנועה במהלך היום, והסיכום נשאר טיוטה לבדיקה אנושית.",
    seoTitle: "חטיף תנועה קצר",
    seoDescription:
      "סיכום בעברית של מחקר על רצף תנועה קצר אצל מבוגרים לא פעילים, שנשמר כטיוטה לבדיקה לפני פרסום.",
    population: "מבוגרים לא פעילים",
    duration: null,
    comparator: null,
    outcomes: [],
    intervention: [],
    mainFindings: [],
    practicalInterpretation: [],
    limitations: [],
    snacksmateRelevance: [],
    imageAlt: HEBREW_ALT,
    reviewNotes: [],
  };
}

function summaryFor(
  pmidResults: { pmid: string; outcome: "enriched" | "failed" | "skipped" }[],
): EnrichmentSummary {
  return {
    dryRun: false,
    model: "gpt-5.6-luna",
    eligibleDrafts: pmidResults.length,
    inspected: pmidResults.length,
    aiCalls: pmidResults.length,
    enriched: pmidResults.filter((item) => item.outcome === "enriched").length,
    proposedUpdates: pmidResults.length,
    skipped: 0,
    failed: pmidResults.filter((item) => item.outcome === "failed").length,
    insufficientAbstracts: [],
    pmidResults,
  };
}

async function mute<T>(run: () => Promise<T>): Promise<T> {
  const log = console.log;
  const error = console.error;
  console.log = () => undefined;
  console.error = () => undefined;
  try {
    return await run();
  } finally {
    console.log = log;
    console.error = error;
  }
}
