import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  classifyResearchDocument,
  executeResearchRecovery,
  formatRecoveryReport,
  parseRecoveryArgs,
  RECOVERY_PMIDS,
  recoveryExitCode,
  selectRecoveryDrafts,
  type RecoveryDocument,
  type RecoveryEffects,
  type RecoveryStudy,
} from "./recover";

test("recovery selects only the two remaining English draft ids", () => {
  const selected = selectRecoveryDrafts([
    {
      pmid: "42925061",
      _id: "drafts.research-pubmed-42925061",
      language: "en",
      title: "Exercise snacks and smartphones",
    },
    {
      pmid: "42923131",
      _id: "drafts.research-pubmed-42923131",
      language: "en",
      title: "  Psychological impacts  ",
    },
    {
      pmid: "42948631",
      _id: "drafts.research-pubmed-42948631",
      language: "en",
      title: "Already recovered",
    },
    {
      pmid: "42925061",
      _id: "research-pubmed-42925061",
      language: "en",
      title: "Published id is ignored",
    },
  ]);

  assert.deepEqual(
    selected.map((draft) => draft.draftId),
    ["drafts.research-pubmed-42925061", "drafts.research-pubmed-42923131"],
  );
  assert.deepEqual(RECOVERY_PMIDS, ["42925061", "42923131"]);
  assert.equal(RECOVERY_PMIDS.includes("42948631" as never), false);
});

test("dry_run causes zero enrichment OpenAI calls", async () => {
  const effects = countingEffects();
  const result = await executeResearchRecovery({
    dryRun: true,
    studies: remainingStudies(),
    effects: effects.effects,
  });
  assert.equal(effects.calls.enrich, 0);
  assert.equal(result.openAiCalls, 0);
});

test("dry_run causes zero image API calls", async () => {
  const effects = countingEffects();
  const result = await executeResearchRecovery({
    dryRun: true,
    studies: remainingStudies(),
    effects: effects.effects,
  });
  assert.equal(effects.calls.image, 0);
  assert.equal(result.imageGenerationAttempts, 0);
});

test("dry_run causes zero image QA API calls", async () => {
  const effects = countingEffects();
  const result = await executeResearchRecovery({
    dryRun: true,
    studies: remainingStudies(),
    effects: effects.effects,
  });
  assert.equal(effects.calls.qa, 0);
  assert.equal(result.imageQaCalls, 0);
});

test("dry_run causes zero Sanity mutations", async () => {
  const effects = countingEffects();
  const result = await executeResearchRecovery({
    dryRun: true,
    studies: remainingStudies(),
    effects: effects.effects,
  });
  assert.equal(effects.calls.sanity, 0);
  assert.equal(effects.calls.upload, 0);
  assert.equal(effects.calls.hebrew, 0);
  assert.equal(result.sanityWrites, 0);
  assert.equal(result.assetsUploaded, 0);
  assert.equal(result.hebrewDraftsCreated, 0);
  assert.equal(result.published, 0);
  const imageStudy = result.studies.find((study) => study.pmid === "42923131");
  const readyStudy = result.studies.find((study) => study.pmid === "42925061");
  assert.equal(imageStudy?.imageResult, "would_attempt_once");
  assert.equal(imageStudy?.hebrewResult, "would_create");
  assert.equal(readyStudy?.enrichment, "skip");
  assert.equal(readyStudy?.imageResult, "skip_existing");
  assert.equal(readyStudy?.hebrewResult, "would_create");
});

test("drafts.* with publishedAt remains a draft source", () => {
  const classified = classifyResearchDocument({
    id: "drafts.research-pubmed-42925061",
    publishedAt: "2026-10-26T15:03:00.000Z",
    publishedCounterpartExists: false,
  });
  assert.equal(classified.documentState, "draft");
  assert.equal(classified.publishedAtField, "present");
  assert.equal(classified.publishedCounterpart, "missing");
});

test("publishedAt is not treated as Sanity publication state", () => {
  const withDate = classifyResearchDocument({
    id: "drafts.research-pubmed-42925061",
    publishedAt: "2026-10-26T15:03:00.000Z",
    publishedCounterpartExists: false,
  });
  const withoutDate = classifyResearchDocument({
    id: "research-pubmed-42925061",
    publishedAt: "",
    publishedCounterpartExists: true,
  });
  assert.equal(withDate.documentState, "draft");
  assert.equal(withoutDate.documentState, "published");
  assert.notEqual(withDate.documentState, "published");
});

test("published counterpart detection is separate", () => {
  const overlay = classifyResearchDocument({
    id: "drafts.research-pubmed-42925061",
    publishedAt: "2026-10-26T15:03:00.000Z",
    publishedCounterpartExists: true,
  });
  const draftOnly = classifyResearchDocument({
    id: "drafts.research-pubmed-42925061",
    publishedAt: "2026-10-26T15:03:00.000Z",
    publishedCounterpartExists: false,
  });
  assert.equal(overlay.documentState, "draft overlay");
  assert.equal(overlay.publishedCounterpart, "exists");
  assert.equal(draftOnly.documentState, "draft");
  assert.equal(draftOnly.publishedCounterpart, "missing");
  assert.equal(overlay.publishedAtField, draftOnly.publishedAtField);
});

test("explicit recovery can translate a draft overlay", async () => {
  const effects = countingEffects();
  const result = await executeResearchRecovery({
    dryRun: false,
    studies: [
      {
        pmid: "42925061",
        documents: [
          english("42925061", {
            asset: "image-existing",
            alt: "People moving",
            publishedAt: "2026-10-26T15:03:00.000Z",
          }),
          english("42925061", {
            _id: "research-pubmed-42925061",
            publishedAt: "2026-10-26T15:03:00.000Z",
          }),
        ],
      },
      { pmid: "42923131", documents: [] },
    ],
    effects: effects.effects,
  });
  const study = result.studies.find((item) => item.pmid === "42925061");
  assert.equal(study?.documentState, "draft overlay");
  assert.equal(study?.publishedAtField, "present");
  assert.equal(study?.publishedCounterpart, "exists");
  assert.equal(effects.calls.hebrew, 1);
  assert.equal(study?.hebrewResult, "created");
  assert.equal(result.published, 0);
});

test("missing mainImage does not block Hebrew localization", async () => {
  const effects = countingEffects();
  const result = await executeResearchRecovery({
    dryRun: false,
    studies: [{ pmid: "42923131", documents: [english("42923131")] }, { pmid: "42925061", documents: [] }],
    effects: effects.effects,
  });
  assert.equal(effects.calls.hebrew, 1);
  assert.equal(result.studies.find((study) => study.pmid === "42923131")?.hebrewResult, "created");
});

test("image QA failure still allows Hebrew draft creation", async () => {
  const effects = countingEffects({ imageOk: false, imageError: "Image QA failed. Empty exercise space." });
  const result = await executeResearchRecovery({
    dryRun: false,
    studies: [{ pmid: "42923131", documents: [english("42923131")] }, { pmid: "42925061", documents: [] }],
    effects: effects.effects,
  });
  const study = result.studies.find((item) => item.pmid === "42923131");
  assert.equal(study?.imageResult, "failed");
  assert.match(study?.imageError ?? "", /Image QA failed/);
  assert.equal(study?.hebrewResult, "created");
  assert.equal(effects.calls.hebrew, 1);
});

test("image retry is maximum one per explicit recovery invocation", async () => {
  const effects = countingEffects({ imageOk: false });
  await executeResearchRecovery({
    dryRun: false,
    studies: [{ pmid: "42923131", documents: [english("42923131")] }, { pmid: "42925061", documents: [] }],
    effects: effects.effects,
  });
  assert.equal(effects.calls.image, 1);
  assert.equal(effects.calls.qa, 1);
});

test("existing image is never regenerated", async () => {
  const effects = countingEffects();
  effects.effects.attachCover = async () => {
    throw new Error("existing image was regenerated");
  };
  const result = await executeResearchRecovery({
    dryRun: false,
    studies: [
      {
        pmid: "42925061",
        documents: [english("42925061", { asset: "image-existing", alt: "People moving", publishedAt: "2026-10-26" })],
      },
      { pmid: "42923131", documents: [] },
    ],
    effects: effects.effects,
  });
  assert.equal(effects.calls.image, 0);
  assert.equal(result.imageGenerationAttempts, 0);
  assert.equal(result.studies.find((study) => study.pmid === "42925061")?.imageResult, "skip_existing");
});

test("completed Hebrew study is skipped", async () => {
  const effects = countingEffects();
  const result = await executeResearchRecovery({
    dryRun: false,
    studies: [
      {
        pmid: "42925061",
        documents: [
          english("42925061", { asset: "image-existing", alt: "People moving" }),
          hebrew("42925061", { asset: "image-existing", alt: "אנשים זזים" }),
        ],
      },
      { pmid: "42923131", documents: [] },
    ],
    effects: effects.effects,
  });
  assert.equal(effects.calls.enrich, 0);
  assert.equal(effects.calls.image, 0);
  assert.equal(effects.calls.hebrew, 0);
  assert.equal(result.studies.find((study) => study.pmid === "42925061")?.hebrewResult, "skip_existing");
});

test("image failure alone does not force exit code 1", async () => {
  const effects = countingEffects({ imageOk: false, imageError: "Image QA failed." });
  const result = await executeResearchRecovery({
    dryRun: false,
    studies: [
      {
        pmid: "42925061",
        documents: [english("42925061", { asset: "image-existing", alt: "People moving", publishedAt: "2026-10-26" })],
      },
      { pmid: "42923131", documents: [english("42923131")] },
    ],
    effects: effects.effects,
  });
  assert.equal(result.studies.find((study) => study.pmid === "42923131")?.imageResult, "failed");
  assert.equal(result.studies.every((study) => study.hebrewResult === "created"), true);
  assert.equal(recoveryExitCode(result), 0);

  const enrichmentFailure = await executeResearchRecovery({
    dryRun: false,
    studies: [
      { pmid: "42925061", documents: [english("42925061", { aiEnrichmentStatus: "", excerpt: "" })] },
      { pmid: "42923131", documents: [] },
    ],
    effects: {
      ...effects.effects,
      enrich: async () => {
        throw new Error("OpenAI request failed.");
      },
    },
  });
  assert.equal(recoveryExitCode(enrichmentFailure), 1);
});

test("the recovery report names both targets and keeps PMID 42948631 untouched", async () => {
  const effects = countingEffects({ imageOk: false, imageError: "Image QA failed." });
  const dryRun = await executeResearchRecovery({
    dryRun: true,
    studies: remainingStudies(),
    effects: effects.effects,
  });
  const preview = formatRecoveryReport(dryRun);
  assert.match(preview, /Recovery dry_run: true/);
  assert.match(preview, /Recovery targets: 42925061, 42923131/);
  assert.match(preview, /PMID 42948631 touched: no/);
  assert.match(preview, /OpenAI calls: 0/);
  assert.match(preview, /Image generation attempts: 0/);
  assert.match(preview, /Image QA calls: 0/);
  assert.match(preview, /Sanity writes: 0/);
  assert.match(preview, /Assets uploaded: 0/);
  assert.match(preview, /Hebrew drafts created: 0/);
  assert.match(preview, /Published: 0/);
  assert.match(preview, /PMID 42925061[\s\S]*document state: draft[\s\S]*enrichment result: skip[\s\S]*image result: skip_existing[\s\S]*image QA result: not_run[\s\S]*Hebrew result: would_create[\s\S]*Hebrew draft id: drafts\.research-he-research-pubmed-42925061/);
  assert.match(preview, /PMID 42923131[\s\S]*image result: would_attempt_once[\s\S]*image QA result: not_run[\s\S]*Hebrew result: would_create[\s\S]*Hebrew draft id: drafts\.research-he-research-pubmed-42923131/);
  assert.equal(preview.includes("42948631\n"), false);

  const live = await executeResearchRecovery({
    dryRun: false,
    studies: remainingStudies(),
    effects: countingEffects({ imageOk: false, imageError: "Image QA failed." }).effects,
  });
  const report = formatRecoveryReport(live);
  assert.match(report, /Recovery dry_run: false/);
  assert.match(report, /PMID 42923131[\s\S]*image result: failed[\s\S]*image QA result: failed[\s\S]*Hebrew result: created/);
  assert.match(report, /PMID 42925061[\s\S]*image result: skip_existing[\s\S]*image QA result: not_run[\s\S]*Hebrew result: created/);
  assert.match(report, /Published: 0/);
});

test("no publish path exists", () => {
  const files = [
    new URL("./recover.ts", import.meta.url),
    new URL("../../scripts/recover-research-drafts.ts", import.meta.url),
    new URL("../../.github/workflows/research-discovery.yml", import.meta.url),
    new URL("../../.github/workflows/recover-research-drafts.yml", import.meta.url),
  ];
  for (const file of files) {
    const source = readFileSync(file, "utf8");
    assert.equal(source.includes(".publish("), false, file.pathname);
    assert.equal(source.includes("createOrReplace"), false, file.pathname);
  }
  assert.equal(parseRecoveryArgs([]).dryRun, true);
  assert.equal(parseRecoveryArgs(["--dry-run"]).dryRun, true);
  assert.equal(parseRecoveryArgs(["--write"]).dryRun, false);
});

function remainingStudies(): RecoveryStudy[] {
  return [
    {
      pmid: "42925061",
      documents: [
        english("42925061", {
          asset: "image-existing",
          alt: "People moving between tasks",
          publishedAt: "2026-10-26T15:03:00.000Z",
        }),
      ],
    },
    { pmid: "42923131", documents: [english("42923131")] },
  ];
}

function english(pmid: string, extra: Partial<RecoveryDocument> = {}): RecoveryDocument {
  return {
    _id: `drafts.research-pubmed-${pmid}`,
    pmid,
    language: "en",
    title: `Study ${pmid}`,
    aiEnrichmentStatus: "completed",
    editorialStatus: "needs_review",
    translationStatus: "",
    publishedAt: "",
    excerpt: "Adults used short movement bouts, and the summary is complete enough to localize.",
    asset: "",
    alt: "",
    ...extra,
  };
}

function hebrew(pmid: string, extra: Partial<RecoveryDocument> = {}): RecoveryDocument {
  return english(pmid, {
    _id: `drafts.research-he-research-pubmed-${pmid}`,
    language: "he",
    title: "חטיף תנועה",
    translationStatus: "needs_review",
    ...extra,
  });
}

function countingEffects(options: { imageOk?: boolean; imageError?: string } = {}): {
  calls: { enrich: number; image: number; qa: number; sanity: number; upload: number; hebrew: number };
  effects: RecoveryEffects;
} {
  const calls = { enrich: 0, image: 0, qa: 0, sanity: 0, upload: 0, hebrew: 0 };
  const effects: RecoveryEffects = {
    enrich: async () => {
      calls.enrich += 1;
      calls.sanity += 1;
    },
    attachCover: async () => {
      calls.image += 1;
      calls.qa += 1;
      if (options.imageOk === false) {
        return { ok: false, error: options.imageError || "Image QA failed." };
      }
      calls.upload += 1;
      calls.sanity += 1;
      return { ok: true, error: "" };
    },
    createHebrew: async () => {
      calls.hebrew += 1;
      calls.sanity += 1;
      return "created";
    },
  };
  return { calls, effects };
}
