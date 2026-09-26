import assert from "node:assert/strict";
import test from "node:test";
import type { SanityClient } from "@sanity/client";

import {
  acceptedSampleSize,
  assertDraftDocumentId,
  buildEnrichmentUpdate,
  buildInsufficientAbstractPlan,
  copiesAbstractSentence,
  enrichmentDraftId,
  evidenceIsUncertain,
  hasEnrichableGap,
  isMeaningfulSeoValue,
  omitInferredSessionCounts,
  proseIssues,
  seoMetadataIssues,
  type ResearchDraftSnapshot,
} from "./apply";
import { buildResponsesRequest, requestResearchEnrichment } from "./openai";
import { runResearchEnrichment, type PubmedEnrichmentRecord } from "./run";
import { ELIGIBLE_DRAFTS_QUERY, patchResearchDraft } from "./sanity";
import {
  EnrichmentValidationError,
  parseEnrichmentOutput,
  RESEARCH_ENRICHMENT_JSON_SCHEMA,
  type EnrichmentOutput,
} from "./schema";
import {
  researchByLanguageAndSlugQuery,
  researchByLanguageQuery,
} from "../../sanity/lib/queries";

const MODEL = "gpt-5.6-luna";
const ENRICHED_AT = "2026-09-26T12:00:00.000Z";

test("empty fields are eligible for enrichment", () => {
  const plan = planFor(draft(), extraction());

  assert.equal(plan.draftId, "drafts.research-pubmed-42");
  assert.equal(typeof plan.set.excerpt, "string");
  assert.equal(plan.set.population, "Sedentary male university students aged 18–25");
  assert.equal(plan.set.sampleSize, 42);
  assert.equal(plan.set.duration, "6 weeks");
  assert.equal(plan.set.comparator, "usual activity");
  assert.deepEqual(plan.set.outcomes, ["VO2peak", "blood pressure"]);
  assert.equal(plan.set.studyDesign, "randomized-controlled-trial");
  assert.ok(Array.isArray(plan.set.mainFindings));
  assert.ok(Array.isArray(plan.set.intervention));
  assert.ok(Array.isArray(plan.set.practicalInterpretation));
  assert.equal(plan.set.journal, undefined);
  assert.equal(plan.set.doi, undefined);
  assert.equal(plan.set.title, undefined);
  assert.ok(plan.unchanged.includes("journal"));
  assert.ok(plan.unchanged.includes("doi"));
  assert.equal(plan.status, "completed");

  const copied = extraction();
  let sentence =
    "Participants were assigned to short stair-climbing bouts or usual activity for six weeks in this report.";
  while (sentence.length < 180) sentence += " The same sentence continues.";
  assert.ok(sentence.length >= 160 && sentence.length <= 300);
  copied.excerpt = {
    value: sentence,
    confidence: "high",
    evidence: "abstract",
  };
  const rejected = planFor(draft(), copied, {
    abstract: `Background note. ${sentence} Results were described after that sentence.`,
  });
  assert.equal(rejected.set.excerpt, undefined);
  assert.equal(copiesAbstractSentence(sentence, `${sentence} More text.`), true);
  assert.ok(rejected.leftEmpty.some((field) => field.field === "excerpt" && field.reason.includes("copied")));
});

test("human-edited fields are preserved", () => {
  const edited = draft();
  edited.excerpt = originalExcerpt();
  edited.population = "Editor population";
  edited.studyDesign = "cohort-study";
  edited.intervention = blocks("Editor intervention.");
  edited.mainFindings = blocks("Editor findings that are already written.");
  edited.limitations = blocks("Editor limitations.");
  edited.practicalInterpretation = blocks("Editor interpretation.");

  const incoming = extraction();
  incoming.studyDesign.value = "randomized-controlled-trial";
  incoming.population.value = "A different population the model suggested";
  const plan = planFor(edited, incoming);

  for (const field of [
    "excerpt",
    "population",
    "studyDesign",
    "intervention",
    "mainFindings",
    "limitations",
    "practicalInterpretation",
  ]) {
    assert.equal(field in plan.set, false, field);
    assert.ok(plan.unchanged.includes(field), field);
  }
  assert.equal(plan.set.duration, "6 weeks");
  assert.equal(plan.set.journal, undefined);
});

test("malformed AI response is rejected and does not write", async () => {
  assert.throws(
    () => parseEnrichmentOutput("not json"),
    (error: unknown) => error instanceof EnrichmentValidationError,
  );
  assert.throws(
    () => parseEnrichmentOutput({ excerpt: "free prose without a schema" }),
    (error: unknown) => error instanceof EnrichmentValidationError,
  );
  assert.throws(
    () => {
      const output = extraction();
      const malformed: EnrichmentOutput = {
        ...output,
        sampleSize: { ...output.sampleSize, value: 42.5 as unknown as number },
      };
      parseEnrichmentOutput(malformed);
    },
    (error: unknown) => error instanceof EnrichmentValidationError,
  );

  let writes = 0;
  const failedCall = await runResearchEnrichment({
    dryRun: false,
    model: MODEL,
    eligibleCount: 1,
    drafts: [draft()],
    fetchRecords: async () => ({ records: [record()], errors: [] }),
    complete: async () => ({ excerpt: "free prose" }),
    writeDraft: async () => {
      writes += 1;
    },
    now: () => ENRICHED_AT,
  });
  assert.equal(writes, 0);
  assert.equal(failedCall.failed, 1);
  assert.equal(failedCall.enriched, 0);
  assert.equal(failedCall.aiCalls, 1);

  writes = 0;
  const thrown = await runResearchEnrichment({
    dryRun: false,
    model: MODEL,
    eligibleCount: 1,
    drafts: [draft()],
    fetchRecords: async () => ({ records: [record()], errors: [] }),
    complete: async () => {
      throw new Error("OpenAI request failed with HTTP 500.");
    },
    writeDraft: async () => {
      writes += 1;
    },
    now: () => ENRICHED_AT,
  });
  assert.equal(writes, 0);
  assert.equal(thrown.failed, 1);
  assert.equal(thrown.enriched, 0);
});

test("review article sample size handling", () => {
  const includedStudies = extraction();
  includedStudies.studyDesign.value = "meta-analysis";
  includedStudies.sampleSize = {
    value: 12,
    meaning: "included_studies",
    confidence: "high",
    evidence: "abstract",
  };
  const countedPapers = planFor(draft(), includedStudies, {
    publicationTypes: ["Meta-Analysis", "Systematic Review"],
  });
  assert.equal(countedPapers.set.sampleSize, undefined);
  assert.match(
    countedPapers.leftEmpty.find((field) => field.field === "sampleSize")?.reason ?? "",
    /review/i,
  );

  const unclear = extraction();
  unclear.studyDesign.value = "systematic-review";
  unclear.sampleSize = {
    value: 400,
    meaning: "unclear",
    confidence: "high",
    evidence: "abstract",
  };
  assert.equal(
    planFor(draft(), unclear, { publicationTypes: ["Systematic Review"] }).set.sampleSize,
    undefined,
  );

  const medium = extraction();
  medium.studyDesign.value = "meta-analysis";
  medium.sampleSize = {
    value: 840,
    meaning: "participants",
    confidence: "medium",
    evidence: "abstract",
  };
  assert.equal(
    planFor(draft(), medium, { publicationTypes: ["Meta-Analysis"] }).set.sampleSize,
    undefined,
  );
  assert.equal(
    acceptedSampleSize({
      proposed: 840,
      meaning: "participants",
      confidence: "medium",
      evidence: "abstract",
    }),
    null,
  );

  const explicit = extraction();
  explicit.studyDesign.value = "meta-analysis";
  explicit.sampleSize = {
    value: 840,
    meaning: "participants",
    confidence: "high",
    evidence: "abstract",
  };
  assert.equal(
    planFor(draft(), explicit, { publicationTypes: ["Meta-Analysis"] }).set.sampleSize,
    840,
  );
});

test("observational study language stays associative", () => {
  const causal = "This proves VILPA causes a lower risk of dementia.";
  assert.ok(
    proseIssues(causal, {
      field: "practicalInterpretation",
      observational: true,
      vilpa: true,
    }).includes("causal wording"),
  );

  const risky = extraction();
  risky.studyDesign.value = "cohort-study";
  risky.mainFindings.value =
    "Micro-bursts of vigorous activity were associated with a lower rate of the studied brain outcomes.";
  risky.practicalInterpretation.value = causal;
  const rejected = planFor(draft(), risky, {
    title: "Vigorous intermittent lifestyle physical activity and brain health",
    publicationTypes: ["Observational Study"],
  });
  assert.equal(rejected.set.practicalInterpretation, undefined);
  assert.equal(rejected.status, "needs_review");
  assert.ok(rejected.set.mainFindings);

  const cautious = extraction();
  cautious.studyDesign.value = "cohort-study";
  cautious.mainFindings.value = risky.mainFindings.value;
  cautious.practicalInterpretation.value =
    "These findings suggest vigorous intermittent activity is associated with a lower risk. The study is observational and does not establish a causal effect.";
  const accepted = planFor(draft(), cautious, {
    title: "Vigorous intermittent lifestyle physical activity and brain health",
    publicationTypes: ["Observational Study"],
  });
  assert.ok(accepted.set.practicalInterpretation);
  assert.equal(accepted.set.studyDesign, "cohort-study");
  const practical = portableText(accepted.set.practicalInterpretation);
  assert.match(practical, /observational/i);
  assert.match(practical, /associated/i);
  assert.doesNotMatch(practical, /\bcauses\b/i);
});

test("maps scoping, umbrella, and evidence-map designs directly", () => {
  const cases = [
    ["scoping-review", "Exercise snacking: a scoping review", "Scoping Review"],
    ["umbrella-review", "Exercise snacks: an umbrella review", "Umbrella Review"],
    ["evidence-map", "Exercise snacking: an evidence map", "Evidence Map"],
  ] as const;

  for (const [value, title, publicationType] of cases) {
    const output = extraction();
    output.studyDesign = { value, confidence: "high", evidence: "metadata" };
    const plan = planFor(draft(), output, { title, publicationTypes: [publicationType] });
    assert.equal(plan.set.studyDesign, value);
    assert.notEqual(plan.set.studyDesign, "other");
  }

  const mappedToOther = extraction();
  mappedToOther.studyDesign = { value: "other", confidence: "medium", evidence: "abstract" };
  const corrected = planFor(draft(), mappedToOther, {
    title: "Exercise snacking for chronic conditions: a scoping review",
    publicationTypes: ["Review"],
  });
  assert.equal(corrected.set.studyDesign, "scoping-review");

  const parsed = parseEnrichmentOutput({
    ...extraction(),
    studyDesign: { value: "umbrella-review", confidence: "high", evidence: "metadata" },
  });
  assert.equal(parsed.studyDesign.value, "umbrella-review");
});

test("omits an intervention session count that would require inference", () => {
  const abstract =
    "Sedentary students completed 1-minute hard stair-climbing bouts with 1 minute of rest for 4 weeks.";
  const inferred =
    "Hard stair-climbing bouts lasting 1 minute, with 1 minute of rest, totaling 48 sessions in 4 weeks.";
  assert.equal(omitInferredSessionCounts(inferred, abstract)?.includes("48"), false);
  assert.doesNotMatch(omitInferredSessionCounts(inferred, abstract) ?? "", /sessions/i);

  const output = extraction();
  output.intervention.value = inferred;
  const plan = planFor(draft(), output, { abstract });
  const text = portableText(plan.set.intervention);
  assert.doesNotMatch(text, /48/);
  assert.doesNotMatch(text, /sessions/i);
  assert.match(text, /1 minute/);
  assert.match(text, /rest/i);

  const explicitAbstract = "Participants completed 48 sessions of stair climbing.";
  const explicit = extraction();
  explicit.intervention.value = "Stair-climbing work totaling 48 sessions.";
  const kept = planFor(draft(), explicit, { abstract: explicitAbstract });
  assert.match(portableText(kept.set.intervention), /48 sessions/);

  const modifiedAbstract =
    "Over 4 weeks, both intervention groups completed 48 supervised sessions, each consisting of three 20 s maximal stair climbs.";
  const modified = extraction();
  modified.intervention.value =
    "Supervised maximal stair climbs lasting 20 seconds, performed over 48 sessions in 4 weeks.";
  const keptModified = planFor(draft(), modified, { abstract: modifiedAbstract });
  assert.match(portableText(keptModified.set.intervention), /48 sessions/);
});

test("draft updates keep the drafts prefix", async () => {
  assert.equal(enrichmentDraftId("42798426"), "drafts.research-pubmed-42798426");
  assert.throws(() => enrichmentDraftId("pubmed-42798426"));
  assert.throws(() => assertDraftDocumentId("research-pubmed-42798426"));
  assert.throws(() =>
    buildEnrichmentUpdate({
      draft: { ...draft(), _id: "research-pubmed-42" },
      extraction: extraction(),
      source: source(),
      model: MODEL,
      enrichedAt: ENRICHED_AT,
    }),
  );

  let patched: string | undefined;
  const client = {
    patch(id: string) {
      return {
        set() {
          return {
            async commit() {
              patched = id;
            },
          };
        },
      };
    },
  };
  await patchResearchDraft(client as unknown as SanityClient, "drafts.research-pubmed-42798426", {
    excerpt: "Updated on the draft only.",
  });
  assert.equal(patched, "drafts.research-pubmed-42798426");

  let called = false;
  await assert.rejects(() =>
    patchResearchDraft(
      {
        patch() {
          called = true;
          throw new Error("should not patch");
        },
      } as unknown as SanityClient,
      "research-pubmed-42798426",
      {},
    ),
  );
  assert.equal(called, false);

  let writtenId = "";
  const summary = await runResearchEnrichment({
    dryRun: false,
    model: MODEL,
    eligibleCount: 1,
    drafts: [draft()],
    fetchRecords: async () => ({ records: [record()], errors: [] }),
    complete: async () => extraction(),
    writeDraft: async (id, fields) => {
      writtenId = id;
      assert.equal(fields._id, undefined);
      assert.equal(String(id).startsWith("drafts."), true);
    },
    now: () => ENRICHED_AT,
  });
  assert.equal(writtenId, "drafts.research-pubmed-42");
  assert.equal(summary.enriched, 1);
  assert.equal(summary.failed, 0);
});

test("dry-run never writes", async () => {
  let writes = 0;
  const summary = await runResearchEnrichment({
    dryRun: true,
    model: MODEL,
    eligibleCount: 6,
    drafts: [draft()],
    fetchRecords: async () => ({ records: [record()], errors: [] }),
    complete: async () => extraction(),
    writeDraft: async () => {
      writes += 1;
    },
    now: () => ENRICHED_AT,
  });

  assert.equal(writes, 0);
  assert.equal(summary.dryRun, true);
  assert.equal(summary.aiCalls, 1);
  assert.equal(summary.enriched, 0);
  assert.equal(summary.failed, 0);
  assert.equal(summary.proposedUpdates, 1);
  assert.equal(summary.eligibleDrafts, 6);
});

test("public research queries do not read enrichment internals", () => {
  const internalFields = [
    "aiEnrichedAt",
    "aiModel",
    "aiEnrichmentStatus",
    "aiEnrichmentNote",
    "editorialStatus",
    "editorialReviewNote",
    "editorialChecklist",
    "reviewedStudyDetails",
    "reviewedMainFindings",
    "reviewedInterpretation",
    "reviewedLimitations",
    "reviewedAt",
    "reviewedBy",
    "reviewedMetadata",
    "reviewedScientificSummary",
    "reviewedPracticalInterpretation",
    "reviewedLinks",
  ];
  for (const query of [researchByLanguageQuery, researchByLanguageAndSlugQuery]) {
    for (const field of internalFields) {
      assert.equal(query.includes(field), false, field);
    }
  }
});

test("successful enrichment sets needs_review only when editorial status is empty", async () => {
  for (const status of [undefined, null, "", "   "]) {
    const current = draft();
    current.editorialStatus = status;
    const plan = planFor(current, extraction());
    assert.equal(plan.set.editorialStatus, "needs_review", JSON.stringify(status));
    assert.equal(plan.editorialStatusSet, true);
    assert.match(String(plan.set.aiEnrichmentNote), /Editorial status set to needs_review/);

    const insufficient = buildInsufficientAbstractPlan({
      draft: current,
      model: MODEL,
      enrichedAt: ENRICHED_AT,
    });
    assert.equal(insufficient.set.editorialStatus, "needs_review", JSON.stringify(status));
    assert.equal(insufficient.editorialStatusSet, true);
  }

  let written: Record<string, unknown> | undefined;
  const summary = await runResearchEnrichment({
    dryRun: false,
    model: MODEL,
    eligibleCount: 1,
    drafts: [draft()],
    fetchRecords: async () => ({ records: [record()], errors: [] }),
    complete: async () => extraction(),
    writeDraft: async (_id, fields) => {
      written = fields;
    },
    now: () => ENRICHED_AT,
  });
  assert.equal(summary.enriched, 1);
  assert.equal(summary.failed, 0);
  assert.equal(written?.editorialStatus, "needs_review");
});

test("human editorial status is never overwritten", () => {
  for (const status of ["needs_review", "reviewed", "ready_to_publish", "published_manually"] as const) {
    const current = draft();
    current.editorialStatus = status;
    const plan = planFor(current, extraction());
    assert.equal("editorialStatus" in plan.set, false, status);
    assert.equal(plan.editorialStatusSet, false, status);
    assert.match(String(plan.set.aiEnrichmentNote), /Editorial status was left unchanged/);
    assert.equal(typeof plan.set.excerpt, "string", status);

    const insufficient = buildInsufficientAbstractPlan({
      draft: current,
      model: MODEL,
      enrichedAt: ENRICHED_AT,
    });
    assert.equal("editorialStatus" in insufficient.set, false, status);
    assert.equal(insufficient.editorialStatusSet, false, status);
  }

  const rejected = draft();
  rejected.editorialStatus = "rejected";
  assert.throws(
    () => planFor(rejected, extraction()),
    /Editorial status is rejected/,
  );
  assert.throws(
    () =>
      buildInsufficientAbstractPlan({
        draft: rejected,
        model: MODEL,
        enrichedAt: ENRICHED_AT,
      }),
    /Editorial status is rejected/,
  );
});

test("rejected drafts are skipped by enrichment", async () => {
  const rejected = draft();
  rejected.editorialStatus = "rejected";
  let writes = 0;
  let fetches = 0;
  let aiCalls = 0;
  const summary = await runResearchEnrichment({
    dryRun: false,
    model: MODEL,
    eligibleCount: 1,
    drafts: [rejected],
    fetchRecords: async () => {
      fetches += 1;
      return { records: [record()], errors: [] };
    },
    complete: async () => {
      aiCalls += 1;
      return extraction();
    },
    writeDraft: async () => {
      writes += 1;
    },
    now: () => ENRICHED_AT,
  });

  assert.equal(writes, 0);
  assert.equal(fetches, 0);
  assert.equal(aiCalls, 0);
  assert.equal(summary.skipped, 1);
  assert.equal(summary.enriched, 0);
  assert.equal(summary.failed, 0);
  assert.equal(summary.aiCalls, 0);
  assert.match(ELIGIBLE_DRAFTS_QUERY, /editorialStatus != "rejected"/);
  assert.match(ELIGIBLE_DRAFTS_QUERY, /_id in path\("drafts\.\*\*"\)/);
});

test("published documents are not modified as drafts", async () => {
  const published = draft();
  published._id = "research-pubmed-42";
  let writes = 0;
  let fetches = 0;
  let aiCalls = 0;
  const summary = await runResearchEnrichment({
    dryRun: false,
    model: MODEL,
    eligibleCount: 1,
    drafts: [published],
    fetchRecords: async () => {
      fetches += 1;
      return { records: [record()], errors: [] };
    },
    complete: async () => {
      aiCalls += 1;
      return extraction();
    },
    writeDraft: async () => {
      writes += 1;
    },
    now: () => ENRICHED_AT,
  });

  assert.equal(writes, 0);
  assert.equal(fetches, 0);
  assert.equal(aiCalls, 0);
  assert.equal(summary.enriched, 0);
  assert.equal(summary.failed, 1);
  assert.equal(summary.proposedUpdates, 0);

  let called = false;
  await assert.rejects(() =>
    patchResearchDraft(
      {
        patch() {
          called = true;
          throw new Error("should not patch");
        },
      } as unknown as SanityClient,
      "research-pubmed-42",
      { editorialStatus: "needs_review" },
    ),
  );
  assert.equal(called, false);
  assert.throws(() => assertDraftDocumentId("research-pubmed-42"));
});

test("OpenAI requests use structured Responses output and retry transient failures", async () => {
  const body = buildResponsesRequest({
    model: MODEL,
    instructions: "rules",
    input: "{}",
  });
  assert.equal(body.model, MODEL);
  assert.equal(JSON.stringify(body).includes("sk-test-secret"), false);
  const text = body.text as {
    format: { type: string; strict: boolean; name: string; schema: { additionalProperties: boolean } };
  };
  assert.equal(text.format.type, "json_schema");
  assert.equal(text.format.strict, true);
  assert.equal(text.format.name, "research_enrichment");
  assert.equal(text.format.schema.additionalProperties, false);
  assert.deepEqual(body.reasoning, { effort: "none" });

  const mini = buildResponsesRequest({
    model: "gpt-4.1-mini",
    instructions: "rules",
    input: "{}",
  });
  assert.equal(mini.reasoning, undefined);

  let calls = 0;
  const parsed = await requestResearchEnrichment({
    apiKey: "sk-test-secret",
    model: MODEL,
    instructions: "rules",
    input: "{}",
    sleep: async () => {},
    fetchImpl: async (url, init) => {
      calls += 1;
      assert.equal(url, "https://api.openai.com/v1/responses");
      const headers = new Headers(init?.headers);
      assert.equal(headers.get("authorization"), "Bearer sk-test-secret");
      const raw = JSON.parse(String(init?.body));
      assert.equal(JSON.stringify(raw).includes("sk-test-secret"), false);
      if (calls === 1) return new Response("busy", { status: 503 });
      return new Response(
        JSON.stringify({
          status: "completed",
          output: [
            {
              type: "message",
              content: [{ type: "output_text", text: "{\"ok\":true}" }],
            },
          ],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    },
  });

  assert.equal(calls, 2);
  assert.deepEqual(parsed, { ok: true });
});

test("PMID 42783760 does not imply a glucose benefit or keep a coarser design", () => {
  const title =
    "Exercise Snacks and Cardiometabolic Health: An Umbrella Review and De Novo Meta-Analysis";
  const abstract =
    "This umbrella review and de novo meta-analysis examined brief activity and post-meal glucose and insulin. Pooled effects were not statistically clear and the intervals were too imprecise to establish an effect. The evidence remains uncertain.";
  const current = pmidDraft("42783760", { studyDesign: "meta-analysis" });
  const output = extraction();
  output.studyDesign = { value: "meta-analysis", confidence: "medium", evidence: "metadata" };
  output.practicalInterpretation.value =
    "Brief bouts may affect post-meal glucose and insulin in adults.";

  const rejected = planFor(current, output, { title, abstract, publicationTypes: ["Meta-Analysis"] });
  assert.equal(rejected.set.studyDesign, "umbrella-review");
  assert.equal(rejected.set.practicalInterpretation, undefined);
  assert.equal(rejected.status, "needs_review");

  const cautious = extraction();
  cautious.studyDesign = output.studyDesign;
  cautious.practicalInterpretation.value =
    "Current evidence is insufficient to determine whether brief bouts change post-meal glucose or insulin.";
  const accepted = planFor(current, cautious, {
    title,
    abstract,
    publicationTypes: ["Meta-Analysis"],
  });
  const practical = portableText(accepted.set.practicalInterpretation);
  assert.match(practical, /insufficient to determine whether/i);
  assert.doesNotMatch(practical, /may affect|may improve|may provide benefits/i);
  assert.equal(accepted.set.studyDesign, "umbrella-review");

  const alreadySpecific = pmidDraft("42783760", { studyDesign: "umbrella-review" });
  const reduced = extraction();
  reduced.studyDesign = { value: "meta-analysis", confidence: "high", evidence: "metadata" };
  const kept = planFor(alreadySpecific, reduced, { title, abstract });
  assert.equal("studyDesign" in kept.set, false);

  const locked = pmidDraft("42783760", {
    studyDesign: "meta-analysis",
    editorialStatus: "reviewed",
  });
  const lockedPlan = planFor(locked, output, { title, abstract }, { force: true });
  assert.equal("studyDesign" in lockedPlan.set, false);
});

test("PMID 42652914 does not claim blood-flow restriction superiority or invent a control", () => {
  const abstract =
    "Adults were assigned to stair-climbing snacks with blood-flow restriction or a control group. Performance improved within each group. No significant between-group differences were observed.";
  const invented = "Control group without the stair-climbing exercise snack protocol";
  const current = pmidDraft("42652914", {
    studyDesign: "randomized-controlled-trial",
    comparator: invented,
    practicalInterpretation: blocks(
      "Blood-flow restriction may offer additional performance benefits during stair-climbing snacks.",
    ),
  });
  const output = extraction();
  output.studyDesign = {
    value: "randomized-controlled-trial",
    confidence: "high",
    evidence: "metadata",
  };
  output.comparator = { value: invented, confidence: "high", evidence: "abstract" };
  output.practicalInterpretation.value =
    "Blood-flow restriction may offer additional performance benefits.";

  const rejected = planFor(
    current,
    output,
    { title: "Blood-flow restriction stair-climbing snacks", abstract },
    { force: true },
  );
  assert.equal(rejected.set.comparator, "Control group");
  assert.equal(rejected.set.practicalInterpretation, undefined);
  assert.equal(rejected.status, "needs_review");
  assert.equal("studyDesign" in rejected.set, false);

  const safe = extraction();
  safe.studyDesign = output.studyDesign;
  safe.comparator = output.comparator;
  safe.practicalInterpretation.value =
    "Performance may improve within each group. The study did not establish that adding blood-flow restriction was superior.";
  const accepted = planFor(
    current,
    safe,
    { title: "Blood-flow restriction stair-climbing snacks", abstract },
    { force: true },
  );
  const practical = portableText(accepted.set.practicalInterpretation);
  assert.match(practical, /did not establish that adding blood-flow restriction was superior/i);
  assert.doesNotMatch(practical, /additional performance benefits/i);
  assert.equal(accepted.set.comparator, "Control group");

  const stated = extraction();
  stated.comparator = {
    value: "Control group without the stair-climbing protocol",
    confidence: "high",
    evidence: "abstract",
  };
  const explicit = planFor(pmidDraft("42652914"), stated, {
    abstract:
      "The control group without the stair-climbing protocol continued usual daily activity for four weeks.",
  });
  assert.equal(explicit.set.comparator, "Control group without the stair-climbing protocol");
});

test("PMID 42722087 keeps a review duration that is longer than 60 characters", () => {
  const duration =
    "Acute studies (3–24 h), short studies (2–4 days), and interventions lasting 3–12 weeks";
  assert.ok(duration.length > 60);
  assert.ok(duration.length <= 160);
  const output = extraction();
  output.studyDesign = { value: "scoping-review", confidence: "high", evidence: "metadata" };
  output.duration = { value: duration, confidence: "high", evidence: "abstract" };
  const plan = planFor(pmidDraft("42722087"), output, {
    title: "Exercise snacks: a scoping review",
    publicationTypes: ["Scoping Review"],
    abstract:
      "This scoping review grouped included timings into acute windows of 3 to 24 hours, short protocols of 2 to 4 days, and programs lasting 3 to 12 weeks.",
  });
  assert.equal(plan.set.duration, duration);

  const tooLong = extraction();
  tooLong.duration = {
    value: `${duration} plus an extra clause that pushes the stored timing past the accepted limit.`,
    confidence: "high",
    evidence: "abstract",
  };
  assert.ok((tooLong.duration.value ?? "").length > 160);
  const dropped = planFor(pmidDraft("42722087"), tooLong, {
    abstract: "Timing was described across several included study windows in this scoping review.",
  });
  assert.equal(dropped.set.duration, undefined);
  assert.match(
    dropped.leftEmpty.find((field) => field.field === "duration")?.reason ?? "",
    /too long/,
  );
});

test("PMID 42786495 may record that an observational design cannot establish causality", () => {
  const output = extraction();
  output.studyDesign = { value: "cohort-study", confidence: "high", evidence: "metadata" };
  output.limitations = {
    authorStated: null,
    designLevel: "Unmeasured diet might explain the finding.",
    confidence: "medium",
    evidence: "design_inference",
  };
  output.practicalInterpretation.value =
    "These findings suggest vigorous intermittent activity is associated with the studied outcome. The study is observational and does not establish a causal effect.";
  const plan = planFor(pmidDraft("42786495"), output, {
    title: "Vigorous intermittent lifestyle physical activity and incident outcomes",
    publicationTypes: ["Observational Study"],
    abstract:
      "In this cohort, vigorous intermittent lifestyle physical activity was associated with the outcome across follow-up. The analysis was observational.",
  });
  const limitations = portableText(plan.set.limitations);
  assert.match(limitations, /Observational design cannot establish causality\./);
  assert.doesNotMatch(limitations, /Unmeasured diet/);

  const trial = planFor(draft(), extraction());
  assert.doesNotMatch(portableText(trial.set.limitations), /cannot establish causality/i);
});

test("study-design precedence replaces only a coarser supported label", () => {
  const fromAbstract = extraction();
  fromAbstract.studyDesign = { value: "meta-analysis", confidence: "high", evidence: "abstract" };
  const identifiedInAbstract = planFor(pmidDraft("100", { studyDesign: "meta-analysis" }), fromAbstract, {
    title: "Exercise snacks and cardiometabolic outcomes",
    abstract: "This umbrella review pooled published meta-analyses of brief activity bouts.",
    publicationTypes: ["Review"],
  });
  assert.equal(identifiedInAbstract.set.studyDesign, "umbrella-review");

  const mentionOnly = planFor(pmidDraft("101", { studyDesign: "meta-analysis" }), fromAbstract, {
    title: "Exercise snacks and cardiometabolic outcomes",
    abstract: "Previous umbrella reviews have examined other activity patterns, and this meta-analysis pooled trials.",
    publicationTypes: ["Meta-Analysis"],
  });
  assert.equal("studyDesign" in mentionOnly.set, false);

  const otherDesign = extraction();
  otherDesign.studyDesign = {
    value: "randomized-controlled-trial",
    confidence: "high",
    evidence: "abstract",
  };
  const replacedOther = planFor(pmidDraft("102", { studyDesign: "other" }), otherDesign, {
    abstract: "This randomized controlled trial assigned students to stair-climbing snacks or usual activity.",
  });
  assert.equal(replacedOther.set.studyDesign, "randomized-controlled-trial");

  const mediumOther = extraction();
  mediumOther.studyDesign = {
    value: "randomized-controlled-trial",
    confidence: "medium",
    evidence: "abstract",
  };
  const keptOther = planFor(pmidDraft("103", { studyDesign: "other" }), mediumOther, {
    abstract: "This randomized controlled trial assigned students to stair-climbing snacks or usual activity.",
  });
  assert.equal("studyDesign" in keptOther.set, false);

  const trial = extraction();
  trial.studyDesign = { value: "umbrella-review", confidence: "high", evidence: "abstract" };
  const specificTrial = planFor(
    pmidDraft("104", { studyDesign: "randomized-controlled-trial" }),
    trial,
    { title: "Stair-climbing exercise snacks: a randomized trial", publicationTypes: ["Randomized Controlled Trial"] },
  );
  assert.equal("studyDesign" in specificTrial.set, false);
});

test("non-inferiority wording does not block a supported benefit statement", () => {
  const output = extraction();
  output.mainFindings.value =
    "Glucose reductions were significant versus prolonged sitting. The evidence was insufficient to demonstrate non-inferiority against one continuous session.";
  output.practicalInterpretation.value =
    "These findings suggest brief stair climbing may improve glucose compared with prolonged sitting. They do not show it matches a continuous session.";
  const plan = planFor(draft(), output, {
    abstract:
      "Glucose fell after brief stair climbing compared with prolonged sitting. The evidence was insufficient to demonstrate non-inferiority versus one continuous exercise session.",
  });
  assert.match(portableText(plan.set.practicalInterpretation), /may improve glucose/i);
});

test("a superiority claim is rejected when a later clause withdraws it", () => {
  const output = extraction();
  output.practicalInterpretation.value =
    "Blood-flow restriction may offer additional performance benefits, but the study did not establish superiority.";
  const plan = planFor(draft(), output, {
    abstract:
      "Both groups improved after stair-climbing snacks. No significant between-group differences were observed.",
  });
  assert.equal(plan.set.practicalInterpretation, undefined);
  assert.equal(plan.status, "needs_review");
});

test("automation notes drop stale blank-field claims and keep discovery provenance", () => {
  const abstractToken = "ZZZUNIQUEABSTRACTSENTENCE about stair snacks";
  const discovery =
    "Sanity draft created by PubMed discovery. Relevance: exercise-snacks. The abstract was not stored. Population, intervention, outcomes, limitations, and interpretation were left blank for editorial review. Do not publish until a human completes the summary.";
  const current = pmidDraft("42722087", { automationNote: discovery });
  const plan = planFor(current, extraction(), { abstract: `${sourceAbstract()} ${abstractToken}.` });
  const note = String(plan.set.automationNote);
  assert.match(note, /Sanity draft created by PubMed discovery/);
  assert.match(note, /Relevance: exercise-snacks/);
  assert.match(note, /Enrichment later filled study fields the abstract supported/);
  assert.doesNotMatch(note, /were left blank for editorial review/);
  assert.doesNotMatch(note, /ZZZUNIQUEABSTRACTSENTENCE/);

  const again = planFor(
    pmidDraft("42722087", { automationNote: note }),
    extraction(),
    { abstract: `${sourceAbstract()} ${abstractToken}.` },
  );
  assert.equal(again.set.automationNote, undefined);

  const editor = pmidDraft("42722087", {
    automationNote: "Editor rewrote this note after reading the paper.",
  });
  const custom = planFor(editor, extraction());
  assert.equal(custom.set.automationNote, undefined);
  assert.ok(custom.unchanged.includes("automationNote"));

  const locked = pmidDraft("42722087", {
    editorialStatus: "reviewed",
    automationNote: discovery,
    practicalInterpretation: blocks("Human interpretation."),
    excerpt: originalExcerpt(),
    studyDesign: "scoping-review",
    population: "Included adults",
    intervention: blocks("Included snack protocols."),
    mainFindings: blocks("Findings already reviewed."),
    limitations: blocks("Limitations already reviewed."),
  });
  const lockedPlan = planFor(locked, extraction(), {}, { force: true });
  assert.equal(lockedPlan.set.automationNote, undefined);
  assert.equal(lockedPlan.set.practicalInterpretation, undefined);
  assert.equal(lockedPlan.comparisons.length, 6);
  assert.equal(plan.comparisons.length, 0);
});

test("structured SEO output is required and validated before it is written", () => {
  assert.ok(RESEARCH_ENRICHMENT_JSON_SCHEMA.required.includes("seoTitle"));
  assert.ok(RESEARCH_ENRICHMENT_JSON_SCHEMA.required.includes("seoDescription"));
  const seoTitleSchema = RESEARCH_ENRICHMENT_JSON_SCHEMA.properties.seoTitle;
  const seoDescriptionSchema = RESEARCH_ENRICHMENT_JSON_SCHEMA.properties.seoDescription;
  assert.equal(seoTitleSchema.additionalProperties, false);
  assert.equal(seoDescriptionSchema.additionalProperties, false);

  const parsed = parseEnrichmentOutput(extraction());
  assert.equal(parsed.seoTitle.value, seoTitleText());
  assert.equal(parsed.seoDescription.value, seoDescriptionText());

  assert.throws(
    () => parseEnrichmentOutput({ ...extraction(), seoTitle: "a bare string" }),
    (error: unknown) => error instanceof EnrichmentValidationError,
  );
  assert.throws(
    () =>
      parseEnrichmentOutput({
        ...extraction(),
        seoDescription: { value: 12, confidence: "high", evidence: "abstract" },
      }),
    (error: unknown) => error instanceof EnrichmentValidationError,
  );

  const plan = planFor(draft(), extraction());
  assert.equal(plan.set.seoTitle, seoTitleText());
  assert.equal(plan.set.seoDescription, seoDescriptionText());
  assert.equal(plan.seoTitle.current, "");
  assert.equal(plan.seoTitle.proposed, seoTitleText());
  assert.equal(plan.seoTitle.characters, seoTitleText().length);
  assert.equal(plan.seoDescription.characters, seoDescriptionText().length);
  assert.equal("canonicalUrl" in plan.set, false);
  assert.ok(plan.unchanged.includes("canonicalUrl"));
  assert.match(String(plan.set.aiEnrichmentNote), /SEO metadata generated\./);
  assert.equal(String(plan.set.aiEnrichmentNote).includes(seoDescriptionText()), false);
  assert.equal(String(plan.set.automationNote).includes(seoDescriptionText()), false);
  assert.equal(plan.status, "completed");
});

test("SEO title and description stay inside a safe length", () => {
  const title = seoTitleText();
  assert.ok(title.length >= 45 && title.length <= 60);
  assert.deepEqual(seoIssues("seoTitle", exactLength(title, 30)), []);
  assert.deepEqual(seoIssues("seoTitle", exactLength(title, 70)), []);
  assert.ok(seoIssues("seoTitle", exactLength(title, 29)).includes("length 29 is outside the SEO target"));
  assert.ok(seoIssues("seoTitle", exactLength(title, 71)).includes("length 71 is too long"));

  const description = seoDescriptionText();
  assert.ok(description.length >= 140 && description.length <= 160);
  assert.deepEqual(seoIssues("seoDescription", exactLength(description, 120)), []);
  assert.deepEqual(seoIssues("seoDescription", exactLength(description, 180)), []);
  assert.ok(
    seoIssues("seoDescription", exactLength(description, 119)).includes(
      "length 119 is outside the SEO target",
    ),
  );
  assert.ok(seoIssues("seoDescription", exactLength(description, 181)).includes("length 181 is too long"));

  const output = extraction();
  output.seoTitle = assessment(exactLength(title, 90));
  output.seoDescription = assessment(exactLength(description, 240));
  const rejected = planFor(draft(), output);
  assert.equal(rejected.set.seoTitle, undefined);
  assert.equal(rejected.set.seoDescription, undefined);
  assert.match(rejected.leftEmpty.find((field) => field.field === "seoTitle")?.reason ?? "", /too long/);
  assert.match(
    rejected.leftEmpty.find((field) => field.field === "seoDescription")?.reason ?? "",
    /too long/,
  );
  assert.equal(rejected.status, "needs_review");
});

test("meaningful manual SEO values are preserved, including under force", () => {
  const manualTitle = "Editor title for stair-climbing snacks and student fitness";
  const manualDescription = exactLength(
    "Editor description of the stair-climbing snack trial and its cautious fitness outcome.",
    150,
  );
  assert.equal(isMeaningfulSeoValue(manualTitle), true);
  assert.equal(isMeaningfulSeoValue("TBD"), false);
  assert.equal(isMeaningfulSeoValue("  "), false);

  for (const force of [false, true]) {
    const current = draft();
    current.seoTitle = manualTitle;
    current.seoDescription = manualDescription;
    const plan = planFor(current, extraction(), {}, { force });
    assert.equal("seoTitle" in plan.set, false, String(force));
    assert.equal("seoDescription" in plan.set, false, String(force));
    assert.ok(plan.unchanged.includes("seoTitle"), String(force));
    assert.ok(plan.unchanged.includes("seoDescription"), String(force));
    assert.equal(plan.seoTitle.proposed, manualTitle);
    assert.equal(plan.seoTitle.characters, manualTitle.length);
    assert.equal(plan.seoDescription.proposed, manualDescription);
    assert.equal(String(plan.set.aiEnrichmentNote).includes("SEO metadata generated."), false);
  }

  const placeholder = draft();
  placeholder.seoTitle = "TBD";
  placeholder.seoDescription = "n/a";
  const filled = planFor(placeholder, extraction(), {}, { force: true });
  assert.equal(filled.set.seoTitle, seoTitleText());
  assert.equal(filled.set.seoDescription, seoDescriptionText());

  for (const status of ["reviewed", "ready", "published", "ready_to_publish", "published_manually"]) {
    const locked = draft();
    locked.editorialStatus = status;
    locked.seoTitle = manualTitle;
    const kept = planFor(locked, extraction(), {}, { force: true });
    assert.equal("seoTitle" in kept.set, false, status);

    const empty = draft();
    empty.editorialStatus = status;
    const untouched = planFor(empty, extraction(), {}, { force: true });
    assert.equal("seoTitle" in untouched.set, false, status);
    assert.equal("seoDescription" in untouched.set, false, status);
    assert.match(
      untouched.leftEmpty.find((field) => field.field === "seoTitle")?.reason ?? "",
      /human-reviewed/,
      status,
    );
  }

  const reviewing = draft();
  reviewing.editorialStatus = "needs_review";
  const generated = planFor(reviewing, extraction());
  assert.equal("editorialStatus" in generated.set, false);
  assert.equal(generated.set.seoTitle, seoTitleText());
  assert.equal(generated.editorialStatusSet, false);
});

test("observational SEO uses association language", () => {
  const causal =
    "This cohort proves vigorous activity lowers dementia risk in older adults who do brief bursts during daily life now.";
  assert.ok(seoIssues("seoDescription", causal, { observational: true }).includes("unsupported certainty"));
  assert.ok(
    seoIssues("seoDescription", causal, { observational: true }).includes(
      "missing cautious observational wording",
    ),
  );

  const output = extraction();
  output.studyDesign = { value: "cohort-study", confidence: "high", evidence: "metadata" };
  output.seoTitle = assessment("VILPA and Brain Health Risk: Prospective Cohort Study");
  output.seoDescription = assessment(causal);
  output.mainFindings.value =
    "Brief vigorous activity was associated with the studied brain-health outcome in this cohort.";
  output.practicalInterpretation.value =
    "These findings suggest vigorous intermittent activity is associated with the studied outcome. The study is observational and does not establish a causal effect.";
  const source = {
    title: "Vigorous intermittent lifestyle physical activity and brain health",
    publicationTypes: ["Observational Study"],
    abstract:
      "In this prospective cohort, vigorous intermittent lifestyle physical activity was associated with brain-health outcomes. The analysis was observational.",
  };
  const rejected = planFor(draft(), output, source);
  assert.equal(rejected.set.seoDescription, undefined);
  assert.match(
    rejected.leftEmpty.find((field) => field.field === "seoDescription")?.reason ?? "",
    /observational|certainty/,
  );

  output.seoDescription = assessment(
    "A prospective cohort associated brief vigorous activity with brain-health risk. The observational design does not establish a causal effect.",
  );
  const accepted = planFor(draft(), output, source);
  assert.equal(
    accepted.set.seoTitle,
    "VILPA and Brain Health Risk: Prospective Cohort Study",
  );
  assert.match(String(accepted.set.seoDescription), /associated/i);
  assert.match(String(accepted.set.seoDescription), /observational/i);
  assert.doesNotMatch(String(accepted.set.seoDescription), /\bproves\b|\bcauses\b|\bcures\b/i);
});

test("uncertain and null SEO results stay uncertain", () => {
  const firm =
    "Exercise snacks improve post-meal glucose and insulin for adults. The summary states a clear benefit from the brief activity bouts.";
  const uncertainAbstract =
    "This umbrella review examined brief activity and post-meal glucose. Pooled effects were not statistically clear and the intervals were too imprecise to establish an effect. The evidence remains uncertain.";
  assert.ok(
    seoIssues("seoDescription", firm, { abstract: uncertainAbstract, evidenceText: uncertainAbstract }).includes(
      "uncertain or null finding stated too firmly",
    ),
  );

  const cautious =
    "This review did not establish a clear effect of exercise snacks on post-meal glucose. The available evidence remains uncertain.";
  assert.deepEqual(
    seoIssues("seoDescription", cautious, { abstract: uncertainAbstract, evidenceText: uncertainAbstract }).filter(
      (issue) => issue.includes("uncertain") || issue.includes("benefit"),
    ),
    [],
  );

  const output = extraction();
  output.seoDescription = assessment(firm);
  const rejected = planFor(draft(), output, { abstract: uncertainAbstract });
  assert.equal(rejected.set.seoDescription, undefined);

  output.seoDescription = assessment(cautious);
  const accepted = planFor(draft(), output, { abstract: uncertainAbstract });
  assert.match(String(accepted.set.seoDescription), /did not establish/i);
  assert.match(String(accepted.set.seoDescription), /uncertain/i);

  const nullAbstract =
    "Adults were assigned to stair-climbing snacks or a control group. No significant between-group differences were observed.";
  const overstated =
    "Stair-climbing snacks improve performance for adults assigned to the brief activity program in this comparison.";
  assert.ok(
    seoIssues("seoDescription", overstated, { abstract: nullAbstract, evidenceText: nullAbstract }).includes(
      "uncertain or null finding stated too firmly",
    ),
  );
  const nullSafe =
    "Stair-climbing snacks were compared in adults. No significant between-group difference was found, so a performance benefit was not established.";
  const nullOutput = extraction();
  nullOutput.seoDescription = assessment(nullSafe);
  const nullPlan = planFor(draft(), nullOutput, { abstract: nullAbstract });
  assert.match(String(nullPlan.set.seoDescription), /no significant/i);
  assert.doesNotMatch(String(nullPlan.set.seoDescription), /\bimproves\b/i);
});

test("SEO text rejects hype, keyword stuffing, excerpt copies, and non-English generation", () => {
  assert.ok(
    seoIssues(
      "seoTitle",
      "Exercise exercise exercise snacks and exercise glucose responses",
    ).includes("keyword stuffing"),
  );
  assert.ok(seoIssues("seoTitle", "Amazing breakthrough in exercise snack research now").includes("hype"));
  assert.ok(
    seoIssues("seoTitle", "This trial proves snacks cure post-meal glucose now").includes(
      "unsupported certainty",
    ),
  );
  assert.ok(
    seoIssues("seoDescription", exactLength("This trial guarantees a cure for glucose spikes in adults.", 140)).includes(
      "unsupported certainty",
    ),
  );
  assert.ok(
    seoIssues(
      "seoDescription",
      exactLength("As an AI, this note summarizes stair-climbing snack findings for search results.", 140),
    ).includes("prompt or system language"),
  );
  assert.ok(
    seoIssues(
      "seoDescription",
      exactLength("System prompt: stair-climbing snacks and fitness in a six-week student trial.", 140),
    ).includes("prompt or system language"),
  );
  assert.ok(
    seoIssues("seoTitle", "Snacksmate stair snacks and student fitness trial").includes(
      "Snacksmate was not in the source",
    ),
  );

  const copied = extraction();
  copied.seoDescription = assessment(originalExcerpt().slice(0, 150));
  const rejected = planFor(draft(), copied);
  assert.equal(rejected.set.seoDescription, undefined);
  assert.match(
    rejected.leftEmpty.find((field) => field.field === "seoDescription")?.reason ?? "",
    /excerpt/,
  );

  const hebrew = draft();
  hebrew.language = "he";
  const skipped = planFor(hebrew, extraction());
  assert.equal("seoTitle" in skipped.set, false);
  assert.equal("seoDescription" in skipped.set, false);
  assert.match(
    skipped.leftEmpty.find((field) => field.field === "seoTitle")?.reason ?? "",
    /non-English/,
  );

  const english = draft();
  english.language = "en";
  assert.equal(planFor(english, extraction()).set.seoTitle, seoTitleText());

  const full = draft();
  full.excerpt = originalExcerpt();
  full.studyDesign = "randomized-controlled-trial";
  full.population = "Sedentary male students";
  full.sampleSize = 42;
  full.intervention = blocks("Short stair-climbing bouts.");
  full.duration = "6 weeks";
  full.comparator = "usual activity";
  full.outcomes = ["VO2peak"];
  full.mainFindings = blocks("Fitness changed modestly.");
  full.limitations = blocks("The pilot sample is small.");
  full.practicalInterpretation = blocks("These findings suggest a cautious fitness change.");
  assert.equal(hasEnrichableGap(full), true);
  full.seoTitle = seoTitleText();
  full.seoDescription = seoDescriptionText();
  assert.equal(hasEnrichableGap(full), false);
});

function planFor(
  current: ResearchDraftSnapshot,
  output: EnrichmentOutput,
  sourceOverrides: Partial<ReturnType<typeof source>> = {},
  options?: { force?: boolean },
) {
  return buildEnrichmentUpdate({
    draft: current,
    extraction: output,
    source: { ...source(), ...sourceOverrides },
    model: MODEL,
    enrichedAt: ENRICHED_AT,
    force: options?.force,
  });
}

function pmidDraft(
  pmid: string,
  fields: Partial<ResearchDraftSnapshot> = {},
): ResearchDraftSnapshot {
  return {
    ...draft(),
    _id: `drafts.research-pubmed-${pmid}`,
    pmid,
    title: fields.title ?? draft().title,
    ...fields,
  };
}

function draft(): ResearchDraftSnapshot {
  return {
    _id: "drafts.research-pubmed-42",
    pmid: "42",
    title: "Stair-climbing exercise snacks",
    journal: "Journal of Snacks",
    doi: "10.1000/example",
  };
}

function source() {
  return {
    title: "Stair-climbing exercise snacks",
    abstract: sourceAbstract(),
    publicationTypes: ["Randomized Controlled Trial"],
  };
}

function record(): PubmedEnrichmentRecord {
  return {
    pmid: "42",
    title: source().title,
    abstract: source().abstract,
    publicationTypes: ["Randomized Controlled Trial"],
    authors: ["Ada Example"],
    journal: "Journal of Snacks",
    year: 2026,
    doi: "10.1000/example",
  };
}

function sourceAbstract(): string {
  let text =
    "Background: The trial enrolled sedentary male university students aged 18 to 25. Methods: They climbed stairs in short bouts or continued usual activity. Results: Fitness indicators moved over six weeks.";
  while (text.length < 180) {
    text += " Further method detail was limited to the assigned stair-climbing program.";
  }
  return text;
}

function originalExcerpt(): string {
  let text =
    "Snacksmate summary of a stair-climbing snack program among sedentary male students. The note describes a broad fitness change over the program and stays cautious.";
  const pad = " Wording here is original.";
  while (text.length < 180) text += pad;
  if (text.length > 300) text = text.slice(0, 280).trim();
  return text;
}

function extraction(): EnrichmentOutput {
  return {
    excerpt: { value: originalExcerpt(), confidence: "high", evidence: "abstract" },
    studyDesign: {
      value: "randomized-controlled-trial",
      confidence: "high",
      evidence: "metadata",
    },
    population: {
      value: "Sedentary male university students aged 18–25",
      confidence: "high",
      evidence: "abstract",
    },
    sampleSize: {
      value: 42,
      meaning: "participants",
      confidence: "high",
      evidence: "abstract",
    },
    intervention: {
      value: "Short stair-climbing bouts on three days each week.",
      confidence: "high",
      evidence: "abstract",
    },
    duration: { value: "6 weeks", confidence: "high", evidence: "abstract" },
    comparator: { value: "usual activity", confidence: "high", evidence: "abstract" },
    outcomes: {
      value: ["VO2peak", "blood pressure"],
      confidence: "high",
      evidence: "abstract",
    },
    mainFindings: {
      value:
        "Stair-climbing snacks were followed by a modest fitness change over six weeks in this trial.",
      confidence: "high",
      evidence: "abstract",
    },
    limitations: {
      authorStated: null,
      designLevel: "The pilot sample is small.",
      confidence: "medium",
      evidence: "design_inference",
    },
    practicalInterpretation: {
      value:
        "These findings suggest brief stair-climbing snacks may support fitness in this student group. This was a small trial and it does not establish a broad health benefit.",
      confidence: "high",
      evidence: "abstract",
    },
    seoTitle: assessment(seoTitleText()),
    seoDescription: assessment(seoDescriptionText()),
    needsReview: false,
    reviewNote: null,
    abstractSufficient: true,
  };
}

function seoTitleText(): string {
  return "Stair-Climbing Exercise Snacks: Fitness Trial";
}

function seoDescriptionText(): string {
  return "In a six-week trial, sedentary male students used short stair-climbing snacks or usual activity. The small study followed modest fitness changes.";
}

function assessment(value: string): EnrichmentOutput["seoTitle"] {
  return { value, confidence: "high", evidence: "abstract" };
}

function exactLength(seed: string, length: number): string {
  const core = seed.replace(/\s+/g, " ").trim();
  if (core.length >= length) return core.slice(0, length);
  return core + "x".repeat(length - core.length);
}

function seoIssues(
  field: "seoTitle" | "seoDescription",
  value: string,
  overrides: {
    observational?: boolean;
    abstract?: string;
    evidenceText?: string;
    excerpt?: string;
  } = {},
): string[] {
  const abstract = overrides.abstract ?? source().abstract;
  const evidenceText = overrides.evidenceText ?? abstract;
  return seoMetadataIssues({
    field,
    value,
    abstract,
    excerpt: overrides.excerpt ?? originalExcerpt(),
    sourceText: `${source().title}\n${abstract}`,
    observational: overrides.observational === true,
    uncertain: evidenceIsUncertain(evidenceText),
    evidenceText,
  });
}

function blocks(text: string) {
  return [
    {
      _type: "block",
      _key: "human",
      style: "normal",
      markDefs: [],
      children: [{ _type: "span", _key: "human-span", text, marks: [] }],
    },
  ];
}

function portableText(value: unknown): string {
  if (!Array.isArray(value)) return "";
  return value
    .flatMap((block) => {
      if (!block || typeof block !== "object" || !("children" in block)) return [];
      const children = block.children;
      if (!Array.isArray(children)) return [];
      return children.map((child) =>
        child && typeof child === "object" && "text" in child && typeof child.text === "string"
          ? child.text
          : "",
      );
    })
    .join(" ");
}
