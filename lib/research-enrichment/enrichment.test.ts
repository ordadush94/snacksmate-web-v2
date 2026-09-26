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
  omitInferredSessionCounts,
  proseIssues,
  type ResearchDraftSnapshot,
} from "./apply";
import { buildResponsesRequest, requestResearchEnrichment } from "./openai";
import { runResearchEnrichment, type PubmedEnrichmentRecord } from "./run";
import { ELIGIBLE_DRAFTS_QUERY, patchResearchDraft } from "./sanity";
import {
  EnrichmentValidationError,
  parseEnrichmentOutput,
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

function planFor(
  current: ResearchDraftSnapshot,
  output: EnrichmentOutput,
  sourceOverrides: Partial<ReturnType<typeof source>> = {},
) {
  return buildEnrichmentUpdate({
    draft: current,
    extraction: output,
    source: { ...source(), ...sourceOverrides },
    model: MODEL,
    enrichedAt: ENRICHED_AT,
  });
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
    needsReview: false,
    reviewNote: null,
    abstractSufficient: true,
  };
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
