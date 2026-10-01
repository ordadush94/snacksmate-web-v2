import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import type { ResearchDraftSnapshot } from "../research-enrichment/apply";
import { HUMAN_REVIEWED_EDITORIAL_STATUSES } from "../research-enrichment/apply";
import type { EnrichmentSummary } from "../research-enrichment/run";
import { SCHEDULED_RESEARCH_CREATE_LIMIT, runResearchDiscovery } from "../research-discovery/run";
import type { EnglishDocument } from "../translation/types";
import {
  automateCreatedResearchDrafts,
  canTranslateEnrichedResearch,
  formatResearchAutomationReport,
  projectDiscoveryReport,
} from "./run";

test("scheduled discovery writes only auto-draft studies and stops at 10", async () => {
  const autos = Array.from({ length: 12 }, (_, index) => String(101 + index));
  const ids = ["9001", "9002", ...autos];
  const created: { _id: string; pmid: string; title: string; editorialStatus?: string }[] = [];
  await mute(async () => {
    const summary = await runResearchDiscovery({
      dryRun: false,
      lookbackDays: 14,
      maxCreates: SCHEDULED_RESEARCH_CREATE_LIMIT,
      email: "research@snacksmate.com",
      sanity: {
        projectId: "project",
        dataset: "production",
        apiVersion: "2026-09-22",
        token: "token",
      },
      sanityClient: {
        fetch: async () => [],
        create: async (document) => {
          created.push(document);
          return document;
        },
      },
      sleep: async () => {},
      now: () => 0,
      fetchImpl: pubmedFetch(ids),
    });

    assert.equal(summary.rejected, 1);
    assert.equal(summary.reviewCandidates, 1);
    assert.equal(summary.createdDrafts.length, 10);
    assert.equal(summary.withheldByLimit.length, 2);
    assert.deepEqual(
      created.map((document) => document.pmid),
      autos.slice(0, 10),
    );
    assert.deepEqual(
      summary.withheldByLimit.map((draft) => draft.pmid),
      autos.slice(10),
    );
    for (const document of created) {
      assert.equal(document._id, `drafts.research-pubmed-${document.pmid}`);
      assert.equal(document.editorialStatus, "needs_review");
      assert.equal(document._id.startsWith("drafts."), true);
      assert.equal(document.title.includes("Exercise snacks"), true);
    }
    assert.equal(created.some((document) => document.pmid === "9001"), false);
    assert.equal(created.some((document) => document.pmid === "9002"), false);
  });
});

test("discovery dry-run applies the same cap and writes nothing", async () => {
  const autos = Array.from({ length: 12 }, (_, index) => String(201 + index));
  let creates = 0;
  await mute(async () => {
    const summary = await runResearchDiscovery({
      dryRun: true,
      lookbackDays: 14,
      maxCreates: SCHEDULED_RESEARCH_CREATE_LIMIT,
      email: "research@snacksmate.com",
      sanity: {
        projectId: "project",
        dataset: "production",
        apiVersion: "2026-09-22",
        token: "token",
      },
      sanityClient: {
        fetch: async () => [],
        create: async () => {
          creates += 1;
          return {};
        },
      },
      sleep: async () => {},
      now: () => 0,
      fetchImpl: pubmedFetch(autos),
    });
    assert.equal(creates, 0);
    assert.equal(summary.createdDrafts.length, 0);
    assert.equal(summary.wouldCreate.length, 10);
    assert.equal(summary.withheldByLimit.length, 2);
    const report = formatResearchAutomationReport(projectDiscoveryReport(summary));
    assert.match(report, /English drafts created: 0/);
    assert.match(report, /Would create English drafts: 10/);
    assert.match(report, /Would enrich: 10/);
    assert.match(report, /Would create Hebrew drafts: 10/);
    assert.match(report, /Published: 0/);
    assert.equal(report.includes("sk-"), false);
  });
});

test("a translation link is checked again immediately before the English create", async () => {
  let fetches = 0;
  const created: string[] = [];
  await mute(async () => {
    const summary = await runResearchDiscovery({
      dryRun: false,
      lookbackDays: 14,
      maxCreates: 10,
      email: "research@snacksmate.com",
      sanity: {
        projectId: "project",
        dataset: "production",
        apiVersion: "2026-09-22",
        token: "token",
      },
      sanityClient: {
        fetch: async () => {
          fetches += 1;
          if (fetches === 1) return [];
          return [
            {
              id: "drafts.research-he-research-pubmed-301",
              translationSourceId: "research-pubmed-301",
              translationSlug: "exercise-snacks-trial-301",
              slug: "exercise-snacks-trial-301",
              language: "he",
            },
          ];
        },
        create: async (document) => {
          created.push(document.pmid);
          return document;
        },
      },
      sleep: async () => {},
      now: () => 0,
      fetchImpl: pubmedFetch(["301"]),
    });
    assert.deepEqual(created, []);
    assert.equal(summary.duplicatesSkipped, 1);
    assert.equal(summary.createdDrafts.length, 0);
  });
});

test("enrichment receives only newly created PMIDs and one failure does not stop the next study", async () => {
  const store = new Map<string, ResearchDraftSnapshot>([
    ["1", snapshot("1")],
    ["2", snapshot("2")],
    ["9", snapshot("9", { excerpt: "Already in the library." })],
  ]);
  const enriched: string[][] = [];
  const translated: string[] = [];

  const automation = await automateCreatedResearchDrafts({
    created: [ref("1"), ref("2")],
    loadDrafts: async (pmids) => {
      assert.deepEqual(pmids, ["1", "2"]);
      return pmids.flatMap((pmid) => {
        const draft = store.get(pmid);
        return draft ? [draft] : [];
      });
    },
    enrich: async (drafts) => {
      enriched.push(drafts.map((draft) => draft.pmid));
      const next = snapshot("2", {
        excerpt: "Adults used brief exercise snacks.",
        aiEnrichmentStatus: "needs_review",
      });
      store.set("2", next);
      return summaryFor([
        { pmid: "1", outcome: "failed" },
        { pmid: "2", outcome: "enriched" },
      ]);
    },
    reloadDrafts: async (pmids) => {
      assert.deepEqual(pmids, ["1", "2"]);
      return pmids.flatMap((pmid) => {
        const draft = store.get(pmid);
        return draft ? [draft] : [];
      });
    },
    loadTranslationSource: async (draftId) => englishDocument(draftId),
    translate: async (sources) => {
      translated.push(...sources.map((source) => source.document._id));
      assert.equal(sources[0]?.aiEnrichmentStatus, "needs_review");
      return {
        created: 1,
        skipped: 0,
        failed: 0,
        dryRun: 0,
        reports: [],
        items: [
          {
            sourceId: sources[0]?.document._id ?? "",
            outcome: "created",
            draftId: "drafts.research-he-research-pubmed-2",
            translationStatus: "needs_review",
            reviewNote: "Glossary term is missing.",
          },
        ],
      };
    },
  });

  assert.deepEqual(enriched, [["1", "2"]]);
  assert.equal(enriched.flat().includes("9"), false);
  assert.deepEqual(translated, ["drafts.research-pubmed-2"]);
  assert.equal(store.has("1"), true);
  assert.equal(automation.enrichmentFailed, 1);
  assert.equal(automation.enrichedSuccessfully, 1);
  assert.equal(automation.hebrewDraftsCreated, 1);
  assert.equal(automation.translationFailed, 0);
  const failed = automation.studies.find((study) => study.pmid === "1");
  const translatedStudy = automation.studies.find((study) => study.pmid === "2");
  assert.match(failed?.note ?? "", /kept/);
  assert.equal(translatedStudy?.hebrewDraftId, "drafts.research-he-research-pubmed-2");
  assert.equal(translatedStudy?.translationStatus, "needs_review");
  assert.deepEqual(translatedStudy?.translationReviewWarnings, ["Glossary term is missing."]);
});

test("translation failure and a failed enrichment status keep the English draft", async () => {
  const automation = await automateCreatedResearchDrafts({
    created: [ref("3"), ref("4")],
    loadDrafts: async () => [snapshot("3"), snapshot("4")],
    enrich: async () =>
      summaryFor([
        { pmid: "3", outcome: "enriched" },
        { pmid: "4", outcome: "enriched" },
      ]),
    reloadDrafts: async () => [
      snapshot("3", { excerpt: "Exercise snack summary.", aiEnrichmentStatus: "failed" }),
      snapshot("4", { excerpt: "Exercise snack summary.", aiEnrichmentStatus: "completed" }),
    ],
    loadTranslationSource: async (draftId) => englishDocument(draftId),
    translate: async (sources) => {
      assert.deepEqual(
        sources.map((source) => source.document._id),
        ["drafts.research-pubmed-4"],
      );
      return {
        created: 0,
        skipped: 0,
        failed: 1,
        dryRun: 0,
        reports: [],
        items: [
          {
            sourceId: "drafts.research-pubmed-4",
            outcome: "failed",
            message: "The model response was incomplete.",
          },
        ],
      };
    },
  });

  assert.equal(automation.enrichedSuccessfully, 1);
  assert.equal(automation.enrichmentFailed, 1);
  assert.equal(automation.hebrewDraftsCreated, 0);
  assert.equal(automation.translationFailed, 1);
  assert.match(automation.studies.find((study) => study.pmid === "3")?.note ?? "", /failed/);
  assert.match(automation.studies.find((study) => study.pmid === "4")?.note ?? "", /kept/);
});

test("needs_review can translate when the excerpt exists, and failed enrichment cannot", () => {
  assert.equal(
    canTranslateEnrichedResearch({
      aiEnrichmentStatus: "failed",
      excerpt: "A usable summary.",
    }).translate,
    false,
  );
  assert.equal(
    canTranslateEnrichedResearch({
      aiEnrichmentStatus: "needs_review",
      excerpt: "",
    }).translate,
    false,
  );
  const allowed = canTranslateEnrichedResearch({
    aiEnrichmentStatus: "needs_review",
    excerpt: "Adults completed brief exercise snacks.",
  });
  assert.equal(allowed.translate, true);
  assert.match(allowed.reason, /needs_review/);
  assert.match(allowed.reason, /preserved/);
  assert.equal(
    canTranslateEnrichedResearch({
      aiEnrichmentStatus: "completed",
      excerpt: "Adults completed brief exercise snacks.",
    }).translate,
    true,
  );
});

test("editorial locks use the schema statuses and the pipeline cannot publish", () => {
  const reviewedStatuses: readonly string[] = HUMAN_REVIEWED_EDITORIAL_STATUSES;
  assert.equal(reviewedStatuses.includes("ready"), true);
  assert.equal(reviewedStatuses.includes("published"), true);
  assert.equal(reviewedStatuses.includes("needs_review"), false);

  const workflow = readFileSync(
    new URL("../../.github/workflows/research-discovery.yml", import.meta.url),
    "utf8",
  );
  const automation = readFileSync(new URL("./run.ts", import.meta.url), "utf8");
  const script = readFileSync(new URL("../../scripts/automate-research.ts", import.meta.url), "utf8");
  const hebrew = readFileSync(
    new URL("../../.github/workflows/hebrew-translation.yml", import.meta.url),
    "utf8",
  );
  assert.match(workflow, /cron: "0 8 \* \* 1,4"/);
  assert.match(workflow, /research:automate -- --max-creates=10/);
  assert.match(workflow, /research:discover -- --dry-run/);
  assert.equal(workflow.includes(".publish("), false);
  assert.equal(workflow.includes("createOrReplace"), false);
  assert.equal(automation.includes(".publish("), false);
  assert.equal(automation.includes("createOrReplace"), false);
  assert.equal(script.includes(".publish("), false);
  assert.equal(script.includes("createOrReplace"), false);
  assert.match(script, /runResearchEnrichment/);
  assert.match(script, /requestHebrewLocalization/);
  assert.match(script, /loadEnglishResearchDraft/);
  assert.equal(hebrew.includes("research:automate"), false);
  assert.equal(hebrew.includes("schedule:"), false);
});

function ref(pmid: string) {
  return {
    pmid,
    draftId: `drafts.research-pubmed-${pmid}`,
    title: `Exercise snacks trial ${pmid}`,
  };
}

function snapshot(
  pmid: string,
  extra: Partial<ResearchDraftSnapshot> = {},
): ResearchDraftSnapshot {
  return {
    _id: `drafts.research-pubmed-${pmid}`,
    pmid,
    title: `Exercise snacks trial ${pmid}`,
    ...extra,
  };
}

function englishDocument(draftId: string): EnglishDocument {
  const pmid = draftId.replace("drafts.research-pubmed-", "");
  return {
    _id: draftId,
    _type: "research",
    language: "en",
    title: `Exercise snacks trial ${pmid}`,
    slug: `exercise-snacks-trial-${pmid}`,
    excerpt: "Adults completed brief exercise snacks.",
    pmid,
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

function pubmedFetch(ids: string[]): typeof fetch {
  const titles: Record<string, string> = {
    "9001": "Commentary on exercise snacks for adults",
    "9002": "Coffee intake and office sitting time",
  };
  return async (input) => {
    const url = String(input);
    if (url.includes("esearch.fcgi")) {
      return new Response(
        JSON.stringify({ esearchresult: { count: String(ids.length), idlist: ids } }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }
    if (url.includes("efetch.fcgi")) {
      const requested = new URL(url).searchParams.get("id")?.split(",").filter(Boolean) ?? ids;
      const articles = requested
        .map((pmid) => {
          const title = titles[pmid] ?? `Exercise snacks trial ${pmid}`;
          return `<PubmedArticle><MedlineCitation><PMID>${pmid}</PMID><Article><ArticleTitle>${title}</ArticleTitle></Article></MedlineCitation></PubmedArticle>`;
        })
        .join("");
      return new Response(`<PubmedArticleSet>${articles}</PubmedArticleSet>`, {
        status: 200,
        headers: { "content-type": "text/xml" },
      });
    }
    throw new Error(`unexpected request ${url}`);
  };
}

async function mute(run: () => Promise<void>) {
  const log = console.log;
  const error = console.error;
  const warn = console.warn;
  console.log = () => undefined;
  console.error = () => undefined;
  console.warn = () => undefined;
  try {
    await run();
  } finally {
    console.log = log;
    console.error = error;
    console.warn = warn;
  }
}
