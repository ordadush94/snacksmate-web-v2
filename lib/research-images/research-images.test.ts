import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmodSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { buildResearchImageAlt } from "./alt";
import { parseResearchImageArgs } from "./args";
import { buildImagePrompt, buildResearchVisualBrief } from "./brief";
import {
  DEFAULT_RESEARCH_IMAGE_MODEL,
  researchImageSize,
  resolveMaxImages,
} from "./config";
import {
  buildImageGenerationRequest,
  requestResearchCoverImage,
  assertImageReview,
} from "./generate";
import { groupResearchDocuments } from "./group";
import { assertAllowlistedImagePatch } from "./patch";
import { chooseBriefSource } from "./plan";
import { formatResearchImageReport } from "./report";
import { runResearchImageBackfill } from "./run";
import { patchResearchImage } from "./sanity";
import type { ResearchImageAutomation, ResearchImageDocument } from "./types";

const PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
const PNG = Buffer.from(PNG_BASE64, "base64");
const ASSET = "image-abc123-2048x1152-png";
const HEBREW = /[\u0590-\u05FF]/;
const CONFIRM = "GENERATE RESEARCH IMAGES";

const workflow = readFileSync(
  new URL("../../.github/workflows/research-image-backfill.yml", import.meta.url),
  "utf8",
);
const discovery = readFileSync(
  new URL("../../.github/workflows/research-discovery.yml", import.meta.url),
  "utf8",
);
const automation = readFileSync(new URL("../../scripts/automate-research.ts", import.meta.url), "utf8");

test("English and Hebrew versions of one study share a single image asset", async () => {
  const documents = [
    research({
      _id: "research-pubmed-12345",
      pmid: "12345",
      translationSlug: "exercise-snacks-and-stair-climbing",
    }),
    research({
      _id: "research-he-research-pubmed-12345",
      language: "he",
      pmid: "12345",
      translationSourceId: "research-pubmed-12345",
      translationSlug: "exercise-snacks-and-stair-climbing",
    }),
  ];
  assert.equal(groupResearchDocuments(documents).length, 1);

  const { calls, result } = await writeRun(documents);
  assert.equal(calls.generate, 1);
  assert.equal(calls.upload, 1);
  assert.equal(calls.review, 1);
  assert.equal(calls.patch.length, 2);
  const refs = calls.patch.map((patch) => imageRef(patch.fields));
  assert.deepEqual(refs, [ASSET, ASSET]);
  const english = calls.patch.find((patch) => patch.id === "research-pubmed-12345");
  const hebrew = calls.patch.find((patch) => patch.id === "research-he-research-pubmed-12345");
  assert.ok(english && hebrew);
  assert.match(imageAlt(english.fields), /^Illustration of /);
  assert.equal(HEBREW.test(imageAlt(english.fields)), false);
  assert.match(imageAlt(hebrew.fields), HEBREW);
  assert.equal(result.studies[0]?.assetReused, false);
  assert.equal(result.imageApiCalls, 1);
});

test("the same PMID groups documents into one logical study", () => {
  const groups = groupResearchDocuments([
    research({ _id: "english-doc", pmid: "55", title: "Alpha study of brief cycling bouts in adults" }),
    research({
      _id: "hebrew-doc",
      language: "he",
      pmid: "55",
      title: "A completely different stored title for the Hebrew document",
    }),
  ]);
  assert.equal(groups.length, 1);
  assert.deepEqual(
    groups[0]?.documents.map((doc) => doc._id).sort(),
    ["english-doc", "hebrew-doc"],
  );
});

test("translationSourceId groups a Hebrew document with its English source", () => {
  const groups = groupResearchDocuments([
    research({
      _id: "research-pubmed-9",
      title: "English source document for a stair climbing study",
    }),
    research({
      _id: "research-he-research-pubmed-9",
      language: "he",
      translationSourceId: "research-pubmed-9",
      title: "כותרת עברית שונה שאינה זהה לכותרת האנגלית",
    }),
  ]);
  assert.equal(groups.length, 1);
});

test("a normalized DOI groups documents when stronger identities are absent", () => {
  const groups = groupResearchDocuments([
    research({
      _id: "doi-english",
      doi: "https://doi.org/10.1000/XYZ.9",
      title: "First scientific title about brief cycling snacks",
    }),
    research({
      _id: "doi-hebrew",
      language: "he",
      doi: "DOI:10.1000/xyz.9",
      title: "Second scientific title that is not the same study name",
    }),
  ]);
  assert.equal(groups.length, 1);
});

test("different PMIDs stay separate even when the scientific title matches", () => {
  const title = "Identical scientific title that must not merge different studies";
  const groups = groupResearchDocuments([
    research({ _id: "study-a", pmid: "101", title, doi: "10.1000/same" }),
    research({ _id: "study-b", pmid: "202", title, doi: "10.1000/same" }),
  ]);
  assert.equal(groups.length, 2);
});

test("a translation slug groups language versions without merging a different PMID", () => {
  const linked = groupResearchDocuments([
    research({
      _id: "slug-en",
      translationSlug: "shared-study-key",
      title: "One long English title for slug grouping",
    }),
    research({
      _id: "slug-he",
      language: "he",
      translationSlug: "shared-study-key",
      title: "כותרת עברית שונה לחלוטין ממחקר אחר לגמרי",
    }),
  ]);
  assert.equal(linked.length, 1);

  const conflict = groupResearchDocuments([
    research({ _id: "pmid-a", pmid: "11", translationSlug: "shared-key" }),
    research({ _id: "pmid-b", pmid: "22", translationSlug: "shared-key" }),
  ]);
  assert.equal(conflict.length, 2);
});

test("an existing image prevents generation and is reused by the other language", async () => {
  const asset = "image-editor-upload-1400x788-png";
  const { calls, result } = await writeRun([
    research({
      _id: "research-pubmed-12345",
      pmid: "12345",
      mainImage: image(asset, "Custom editor description of the photo."),
    }),
    research({
      _id: "research-he-research-pubmed-12345",
      language: "he",
      pmid: "12345",
      translationSourceId: "research-pubmed-12345",
    }),
  ]);
  assert.equal(calls.generate, 0);
  assert.equal(calls.upload, 0);
  assert.equal(calls.patch.length, 1);
  assert.equal(calls.patch[0]?.id, "research-he-research-pubmed-12345");
  assert.equal(imageRef(calls.patch[0]?.fields ?? {}), asset);
  assert.match(imageAlt(calls.patch[0]?.fields ?? {}), HEBREW);
  assert.equal(result.studies[0]?.action, "reuse_existing_asset");
  assert.equal(result.studies[0]?.imageGeneration, "skipped");
  assert.equal(result.studies[0]?.assetReused, true);
  assert.equal(result.studies[0]?.reason, "existing image");
});

test("an existing Hebrew image is reused by the English document", async () => {
  const asset = "image-hebrew-source-1400x788-png";
  const { calls } = await writeRun([
    research({ _id: "research-pubmed-77", pmid: "77" }),
    research({
      _id: "research-he-research-pubmed-77",
      language: "he",
      pmid: "77",
      mainImage: image(asset, "איור קיים שהועלה ידנית."),
    }),
  ]);
  assert.equal(calls.generate, 0);
  assert.equal(calls.upload, 0);
  assert.equal(calls.patch.length, 1);
  assert.equal(calls.patch[0]?.id, "research-pubmed-77");
  assert.equal(imageRef(calls.patch[0]?.fields ?? {}), asset);
  assert.match(imageAlt(calls.patch[0]?.fields ?? {}), /^Illustration of /);
});

test("English and Hebrew alt text describe the visible activity", () => {
  const brief = buildResearchVisualBrief(
    research({
      title: "Brief stationary cycling for inactive adults",
      intervention: "Participants completed short stationary cycling bouts.",
      population: "Inactive adults",
      outcomes: ["fitness"],
      mainFindings: "The activity was stationary cycling.",
    }),
  );
  const english = buildResearchImageAlt(brief, "en");
  const hebrew = buildResearchImageAlt(brief, "he");
  assert.match(english, /^Illustration of /);
  assert.match(english, /cycling/i);
  assert.match(hebrew, /רכיבה|אופני כושר/);
  assert.equal(HEBREW.test(english), false);
  assert.match(hebrew, HEBREW);
  assert.equal(english.includes("mortality"), false);
  assert.equal(hebrew.includes(brief.scene), false);
  assert.equal(english.includes(brief.plan.rationale), false);
});

test("older adults and disease context change the scene without depicting the disease", () => {
  const older = buildResearchVisualBrief(
    research({
      title: "Resistance exercise snacks for older adults",
      intervention: "Participants performed short bodyweight resistance bouts.",
      population: "Older adults aged 70 to 80",
      outcomes: ["strength"],
      mainFindings: "Strength was the measured outcome.",
    }),
  );
  assert.equal(older.population, "older-adult");
  assert.equal(older.activity, "resistance");
  assert.equal(older.plan.approximateAge, "older");
  assert.match(buildResearchImageAlt(older, "en"), /older/);
  assert.match(buildResearchImageAlt(older, "he"), /מבוגר/);

  const diabetes = buildResearchVisualBrief(
    research({
      title: "Cycling exercise snacks in type 2 diabetes",
      intervention: "Participants performed brief stationary cycling.",
      population: "Adults with type 2 diabetes",
      outcomes: ["glucose"],
      mainFindings: "Glucose was measured after cycling.",
    }),
  );
  const prompt = buildImagePrompt(diabetes);
  assert.equal(diabetes.activity, "cycling");
  assert.equal(diabetes.population, "adult");
  assert.equal(diabetes.metabolic, true);
  assert.match(prompt, /Do not show glucose meters/i);
  assert.equal(prompt.includes("type 2 diabetes"), false);
});

test("the image prompt describes the activity and omits scientific claims", () => {
  const source = research({
    title: "Cycling snacks reduced mortality by 12 percent",
    doi: "10.1000/secret-doi",
    excerpt: "Reduced mortality and fat loss were reported.",
    intervention: "Participants performed brief stationary cycling.",
    mainFindings: "The paper mentioned lower cancer risk.",
    practicalInterpretation: "Improved glucose should not become a picture.",
    outcomes: ["mortality"],
  });
  const prompt = buildImagePrompt(buildResearchVisualBrief(source));
  assert.match(prompt, /stationary cycling/i);
  assert.match(prompt, /no text/i);
  assert.equal(prompt.includes(source.title ?? ""), false);
  assert.equal(prompt.includes("reduced mortality"), false);
  assert.equal(prompt.includes("fat loss"), false);
  assert.equal(prompt.includes("cancer"), false);
  assert.equal(prompt.includes("10.1000"), false);
  assert.equal(prompt.includes("12"), false);
});

test("the richest English document is the image brief source", () => {
  const thinPublished = research({
    _id: "research-pubmed-5",
    title: "Stair climbing exercise snacks",
    excerpt: "",
    topic: "",
    studyDesign: "",
    population: "",
    intervention: "",
    outcomes: [],
    mainFindings: "",
    practicalInterpretation: "",
    seoTitle: "",
  });
  const richDraft = research({
    _id: "drafts.research-pubmed-5",
    seoTitle: "Stair climbing exercise snacks",
  });
  assert.equal(chooseBriefSource([thinPublished, richDraft])._id, "drafts.research-pubmed-5");

  const equalDraft = research({
    _id: "drafts.equal",
    title: "Equal richness stair climbing study",
    excerpt: "",
    topic: "",
    studyDesign: "",
    population: "",
    intervention: "",
    outcomes: [],
    mainFindings: "",
    practicalInterpretation: "",
    seoTitle: "",
  });
  const equalPublished = research({
    _id: "equal",
    title: "Equal richness stair climbing study",
    excerpt: "",
    topic: "",
    studyDesign: "",
    population: "",
    intervention: "",
    outcomes: [],
    mainFindings: "",
    practicalInterpretation: "",
    seoTitle: "",
  });
  assert.equal(chooseBriefSource([equalDraft, equalPublished])._id, "equal");

  const hebrew = research({
    _id: "research-he-only",
    language: "he",
    title: "מחקר בעברית בלבד על עליית מדרגות",
    intervention: "המשתתפים עלו במדרגות.",
  });
  assert.equal(chooseBriefSource([hebrew])._id, "research-he-only");
});

test("dry-run reports the work and makes zero image calls and zero Sanity writes", async () => {
  const documents = [
    research({ _id: "research-pubmed-12345", pmid: "12345" }),
    research({
      _id: "drafts.research-he-research-pubmed-12345",
      language: "he",
      pmid: "12345",
    }),
  ];
  const { calls, result, lines } = await writeRun(documents, { dryRun: true, confirm: "" });
  const report = formatResearchImageReport(result);
  assert.equal(calls.load, 1);
  assert.equal(calls.generate, 0);
  assert.equal(calls.review, 0);
  assert.equal(calls.upload, 0);
  assert.equal(calls.patch.length, 0);
  assert.equal(lines.join("\n").includes("Images to generate"), false);
  assert.match(report, /Logical Research studies: 1/);
  assert.match(report, /Already have image: 0/);
  assert.match(report, /Would reuse existing image: 0/);
  assert.match(report, /Missing image: 1/);
  assert.match(report, /Images that would be generated: 1/);
  assert.match(report, /Published documents that would be patched: 1/);
  assert.match(report, /Draft documents that would be patched: 1/);
  assert.match(report, /Estimated image API calls: 1/);
  assert.match(report, /Sanity mutations: 0/);
  assert.match(report, /PMID: 12345/);
  assert.match(report, /research-pubmed-12345 \(published, en\)/);
  assert.match(report, /drafts\.research-he-research-pubmed-12345 \(draft, he\)/);
  assert.match(report, /Action: generate_image/);
  assert.match(report, /Image generation: planned/);
});

test("a wrong confirmation exits before image calls and Sanity writes", async () => {
  for (const confirm of ["", "generate research images", "GENERATE RESEARCH IMAGES ", " GENERATE RESEARCH IMAGES"]) {
    let called = false;
    await assert.rejects(
      () =>
        runResearchImageBackfill({
          dryRun: false,
          scope: "all_missing",
          maxImages: "ALL",
          confirm,
          loadDocuments: async () => {
            called = true;
            return [];
          },
          generateImage: async () => {
            called = true;
            return PNG;
          },
          uploadImage: async () => {
            called = true;
            return ASSET;
          },
          patchDocument: async () => {
            called = true;
          },
        }),
      /GENERATE RESEARCH IMAGES/,
    );
    assert.equal(called, false, confirm);
  }
});

test("max_images limits new images and ALL processes every missing study", async () => {
  const documents = [
    research({ _id: "research-pubmed-1", pmid: "1", title: "First cycling study of exercise snacks" }),
    research({ _id: "research-pubmed-2", pmid: "2", title: "Second walking study of exercise snacks" }),
  ];
  const limited = await writeRun(documents, { maxImages: "1" });
  assert.equal(limited.calls.generate, 1);
  assert.equal(limited.calls.upload, 1);
  assert.equal(limited.calls.patch.length, 1);
  assert.equal(limited.calls.patch[0]?.id, "research-pubmed-1");
  assert.equal(
    limited.result.studies.find((study) => study.pmid === "2")?.action,
    "withheld_by_max_images",
  );
  assert.match(formatResearchImageReport(limited.result), /Missing image: 2/);
  assert.match(formatResearchImageReport(limited.result), /Images that would be generated: 1/);

  const all = await writeRun(documents, { maxImages: "ALL" });
  assert.equal(all.calls.generate, 2);
  assert.equal(all.calls.upload, 2);
  assert.equal(all.calls.patch.length, 2);
  assert.equal(resolveMaxImages("ALL"), "ALL");
  assert.throws(() => resolveMaxImages("51"), /1 to 50/);
  assert.throws(() => resolveMaxImages("0"), /1 to 50/);
});

test("one failed study does not stop the remaining studies", async () => {
  const documents = [
    research({ _id: "research-pubmed-1", pmid: "1" }),
    research({ _id: "research-pubmed-2", pmid: "2" }),
  ];
  let generated = 0;
  const { calls, result } = await writeRun(documents, {
    generateImage: async () => {
      generated += 1;
      if (generated === 1) throw new Error("model unavailable");
      return PNG;
    },
  });
  assert.equal(generated, 2);
  assert.equal(calls.upload, 1);
  assert.deepEqual(calls.patch.map((patch) => patch.id), ["research-pubmed-2"]);
  const failed = result.studies.find((study) => study.pmid === "1");
  const succeeded = result.studies.find((study) => study.pmid === "2");
  assert.equal(failed?.imageGeneration, "failed");
  assert.equal(failed?.patches.every((patch) => patch.status === "not_applied"), true);
  assert.equal(succeeded?.imageGeneration, "generated");
  assert.equal(succeeded?.patches[0]?.status, "patched");
});

test("image QA failure and upload failure do not leave a broken image reference", async () => {
  const documents = [research({ _id: "research-pubmed-1", pmid: "1" })];
  const qa = await writeRun(documents, {
    reviewImage: async () => ({
      hasVisibleText: true,
      activityMatches: false,
      reason: "A caption is visible.",
    }),
  });
  assert.equal(qa.calls.generate, 1);
  assert.equal(qa.calls.upload, 0);
  assert.equal(qa.calls.patch.length, 0);
  assert.equal(qa.result.studies[0]?.imageGeneration, "failed");

  const upload = await writeRun(documents, {
    uploadImage: async () => {
      throw new Error("Sanity upload failed");
    },
  });
  assert.equal(upload.calls.generate, 1);
  assert.equal(upload.calls.patch.length, 0);
  assert.equal(upload.result.studies[0]?.patches[0]?.status, "not_applied");
});

test("a Hebrew patch failure keeps the English image", async () => {
  const kept: { id: string; fields: Record<string, unknown> }[] = [];
  const { calls, result } = await writeRun([
    research({ _id: "research-pubmed-12345", pmid: "12345" }),
    research({
      _id: "research-he-research-pubmed-12345",
      language: "he",
      pmid: "12345",
    }),
  ], {
    patchDocument: async (id, fields) => {
      if (id.includes("-he-")) throw new Error("Hebrew patch failed");
      kept.push({ id, fields });
    },
  });
  assert.equal(calls.upload, 1);
  assert.deepEqual(kept.map((patch) => patch.id), ["research-pubmed-12345"]);
  const study = result.studies[0];
  assert.equal(study?.patches.find((patch) => patch.id === "research-pubmed-12345")?.status, "patched");
  assert.equal(
    study?.patches.find((patch) => patch.id === "research-he-research-pubmed-12345")?.status,
    "failed",
  );
});

test("published and draft patches change only mainImage and do not publish", async () => {
  const hotspot = { _type: "sanity.imageHotspot", x: 0.4, y: 0.3, height: 0.5, width: 0.5 };
  const { calls } = await writeRun([
    research({ _id: "research-pubmed-42", pmid: "42" }),
    research({ _id: "drafts.research-pubmed-42", pmid: "42" }),
  ]);
  assert.equal(calls.upload, 1);
  assert.equal(calls.patch.length, 2);
  for (const patch of calls.patch) {
    assert.deepEqual(Object.keys(patch.fields).sort(), ["imageAutomation", "mainImage"]);
    const imageValue = patch.fields.mainImage as Record<string, unknown>;
    assert.deepEqual(Object.keys(imageValue).sort(), ["_type", "alt", "asset"]);
    const automation = patch.fields.imageAutomation as { source?: string; assetRef?: string };
    assert.equal(automation.source, "research-image-automation");
    assert.equal(automation.assetRef, ASSET);
    assert.equal("editorialStatus" in patch.fields, false);
    assert.equal("title" in patch.fields, false);
    assert.equal("slug" in patch.fields, false);
    assert.equal("seoTitle" in patch.fields, false);
  }
  assert.equal(
    calls.patch.some((patch) => patch.id === "drafts.research-pubmed-42"),
    true,
  );
  assert.equal(
    calls.patch.some((patch) => patch.id === "research-pubmed-42"),
    true,
  );

  const altOnly = await writeRun([
    research({
      _id: "research-pubmed-43",
      pmid: "43",
      mainImage: { ...image("image-editor-1400x788-png"), alt: "   ", hotspot },
    }),
  ]);
  assert.equal(altOnly.calls.generate, 0);
  assert.deepEqual(Object.keys(altOnly.calls.patch[0]?.fields ?? {}), ["mainImage.alt"]);
  assert.equal(JSON.stringify(altOnly.calls.patch[0]?.fields).includes("hotspot"), false);

  const ops: string[] = [];
  await patchResearchImage(
    {
      patch: (id) => ({
        set: (fields) => ({
          commit: async () => {
            ops.push(`${id}:${Object.keys(fields).join(",")}`);
          },
        }),
      }),
    },
    "drafts.research-pubmed-43",
    { "mainImage.alt": "Illustration of a person moving briskly up a flight of stairs." },
  );
  assert.deepEqual(ops, [
    "drafts.research-pubmed-43:mainImage.alt",
  ]);
  assert.throws(
    () => assertAllowlistedImagePatch({ title: "Changed title", editorialStatus: "published" }),
    /Only mainImage/,
  );
});

test("scope chooses published documents or drafts without generating a second image", async () => {
  const documents = [
    research({
      _id: "research-pubmed-8",
      pmid: "8",
      mainImage: image("image-live-1400x788-png", "Illustration of a person taking a short walk."),
    }),
    research({ _id: "drafts.research-pubmed-8", pmid: "8" }),
    research({ _id: "drafts.research-pubmed-9", pmid: "9" }),
  ];

  const drafts = await writeRun(documents, { scope: "drafts_missing" });
  assert.equal(drafts.calls.generate, 1);
  assert.equal(drafts.calls.upload, 1);
  assert.equal(
    drafts.calls.patch.some((patch) => patch.id === "research-pubmed-8"),
    false,
  );
  const reused = drafts.calls.patch.find((patch) => patch.id === "drafts.research-pubmed-8");
  assert.equal(imageRef(reused?.fields ?? {}), "image-live-1400x788-png");
  assert.equal(
    drafts.calls.patch.some((patch) => patch.id === "drafts.research-pubmed-9"),
    true,
  );

  const published = await writeRun(
    [
      research({ _id: "drafts.research-pubmed-8", pmid: "8" }),
      research({ _id: "research-pubmed-9", pmid: "9" }),
    ],
    { scope: "published_missing" },
  );
  assert.deepEqual(published.calls.patch.map((patch) => patch.id), ["research-pubmed-9"]);
  assert.equal(published.result.studies.length, 1);
});

test("the image request is one landscape cover and the size follows the model", async () => {
  assert.equal(DEFAULT_RESEARCH_IMAGE_MODEL, "gpt-image-2.5-flare");
  assert.equal(researchImageSize("gpt-image-2.5-flare"), "2048x1152");
  assert.equal(researchImageSize("gpt-image-1.5"), "1536x1024");
  assert.equal(researchImageSize("dall-e-3"), "1792x1024");

  const body = buildImageGenerationRequest({
    model: "gpt-image-2.5-flare",
    prompt: "scene",
    size: "2048x1152",
  });
  assert.equal(body.n, 1);
  assert.equal(body.size, "2048x1152");
  assert.equal(body.output_format, "png");

  let calls = 0;
  const bytes = await requestResearchCoverImage({
    apiKey: "server-side-test-key",
    model: "gpt-image-2.5-flare",
    prompt: "scene",
    size: "2048x1152",
    sleep: async () => {},
    fetchImpl: async (_url, init) => {
      calls += 1;
      const request = JSON.parse(String(init?.body)) as { n: number };
      assert.equal(request.n, 1);
      assert.equal(String(init?.body).includes("server-side-test-key"), false);
      if (calls === 1) return new Response("unavailable", { status: 503 });
      return Response.json({ data: [{ b64_json: PNG_BASE64 }] });
    },
  });
  assert.equal(calls, 2);
  assert.ok(bytes.byteLength >= 32);

  let once = 0;
  await assert.rejects(
    () =>
      requestResearchCoverImage({
        apiKey: "server-side-test-key",
        model: "gpt-image-2.5-flare",
        prompt: "scene",
        size: "2048x1152",
        sleep: async () => {},
        fetchImpl: async () => {
          once += 1;
          return Response.json({ data: [{ b64_json: "" }] });
        },
      }),
    /image bytes/,
  );
  assert.equal(once, 1);
  assert.throws(
    () => assertImageReview({ hasVisibleText: true, activityMatches: true, reason: "letters" }),
    /Image QA failed/,
  );
});

test("the manual workflow is the only trigger and the schedule does not generate images", () => {
  assert.match(workflow, /name: Research Image Backfill/);
  assert.match(workflow, /workflow_dispatch:/);
  assert.equal(workflow.includes("cron:"), false);
  assert.match(workflow, /dry_run:[\s\S]*?type: boolean[\s\S]*?default: true/);
  assert.match(workflow, /scope:[\s\S]*?type: choice[\s\S]*?- all_missing[\s\S]*?- published_missing[\s\S]*?- drafts_missing/);
  assert.match(workflow, /max_images:[\s\S]*?default: "10"/);
  assert.match(workflow, /regeneration_mode:[\s\S]*?- missing_only[\s\S]*?- ai_generated_only[\s\S]*?default: missing_only/);
  assert.match(workflow, /confirm_write:[\s\S]*?default: ""/);
  assert.match(workflow, /GENERATE RESEARCH IMAGES/);
  assert.match(workflow, /REGENERATE RESEARCH IMAGES/);
  assert.match(workflow, /OPENAI_API_KEY: \$\{\{ secrets\.OPENAI_API_KEY \}\}/);
  assert.match(workflow, /SANITY_WRITE_TOKEN: \$\{\{ secrets\.SANITY_WRITE_TOKEN \}\}/);
  assert.match(workflow, /RESEARCH_IMAGE_MODEL: \$\{\{ vars\.RESEARCH_IMAGE_MODEL \}\}/);
  assert.equal(workflow.includes("NEXT_PUBLIC_OPENAI_API_KEY"), false);
  assert.equal(workflow.includes(".publish("), false);
  assert.equal(/echo[^\n]*(SANITY_WRITE_TOKEN|OPENAI_API_KEY)/.test(workflow), false);
  assert.match(discovery, /cron: "0 8 \* \* 1,4"/);
  assert.equal(discovery.includes("research:image-backfill"), false);
  assert.equal(discovery.includes("research-images"), false);
  assert.equal(automation.includes("research-images"), false);
  assert.equal(automation.includes("research:image-backfill"), false);

  const files = [
    ...readdirSync(new URL(".", import.meta.url)).filter(
      (file) => file.endsWith(".ts") && !file.endsWith(".test.ts"),
    ),
    "scripts/backfill-research-images.ts",
  ];
  for (const file of files) {
    const source = readFileSync(file.startsWith("scripts/") ? new URL(`../../${file}`, import.meta.url) : new URL(file, import.meta.url), "utf8");
    assert.equal(source.includes(".publish("), false, file);
    assert.equal(source.includes("createOrReplace"), false, file);
    assert.equal(source.includes(".create("), false, file);
  }
});

test("the workflow refuses a write until the confirmation and max are valid", () => {
  for (const confirm of ["", "generate research images", "GENERATE RESEARCH IMAGES "]) {
    const result = runDispatch({
      IMAGE_DRY_RUN: "false",
      IMAGE_SCOPE: "all_missing",
      IMAGE_MAX: "ALL",
      IMAGE_CONFIRM: confirm,
    });
    assert.equal(result.status, 1, confirm);
    assert.equal(result.calls, "");
    assert.match(result.stdout, /GENERATE RESEARCH IMAGES/);
    assert.match(result.stdout, /before image generation or any Sanity write/);
  }

  const invalidMax = runDispatch({
    IMAGE_DRY_RUN: "true",
    IMAGE_SCOPE: "all_missing",
    IMAGE_MAX: "51",
    IMAGE_CONFIRM: "",
  });
  assert.equal(invalidMax.status, 1);
  assert.equal(invalidMax.calls, "");

  const dryRun = runDispatch({
    IMAGE_DRY_RUN: "true",
    IMAGE_SCOPE: "all_missing",
    IMAGE_MAX: "ALL",
    IMAGE_CONFIRM: "",
  });
  assert.equal(dryRun.status, 0);
  assert.match(dryRun.calls, /research:image-backfill -- --dry-run --scope=all_missing --max-images=ALL/);
  assert.equal(dryRun.calls.includes("--write"), false);

  const write = runDispatch({
    IMAGE_DRY_RUN: "false",
    IMAGE_SCOPE: "published_missing",
    IMAGE_MAX: "10",
    IMAGE_CONFIRM: CONFIRM,
  });
  assert.equal(write.status, 0);
  assert.match(
    write.calls,
    /research:image-backfill -- --write --scope=published_missing --max-images=10 --regeneration-mode=missing_only --confirm=GENERATE RESEARCH IMAGES/,
  );
});

test("CLI args default to a dry-run and reject a write without the exact confirmation", () => {
  const dryRun = parseResearchImageArgs(["--scope=drafts_missing", "--max-images=ALL"]);
  assert.equal(dryRun.dryRun, true);
  assert.equal(dryRun.scope, "drafts_missing");
  assert.equal(dryRun.maxImages, "ALL");
  assert.equal(dryRun.regenerationMode, "missing_only");
  assert.throws(() => parseResearchImageArgs(["--write", "--confirm=CREATE DRAFTS"]), /GENERATE RESEARCH IMAGES/);
  assert.throws(
    () =>
      parseResearchImageArgs([
        "--write",
        "--regeneration-mode=ai_generated_only",
        "--confirm=GENERATE RESEARCH IMAGES",
      ]),
    /REGENERATE RESEARCH IMAGES/,
  );
});

test("a manual image cannot be replaced and regeneration requires its own confirmation", async () => {
  const manual = await writeRun(
    [
      research({
        _id: "research-pubmed-5",
        pmid: "5",
        mainImage: image("image-editor-upload-1400x788-png", "Editor photograph of a kitchen."),
      }),
    ],
    { regenerationMode: "ai_generated_only", confirm: "REGENERATE RESEARCH IMAGES" },
  );
  assert.equal(manual.calls.generate, 0);
  assert.equal(manual.calls.upload, 0);
  assert.equal(manual.calls.patch.length, 0);
  assert.equal(manual.result.studies[0]?.action, "skip_existing_image");
  assert.equal(manual.result.studies[0]?.regenerationEligible, false);
  assert.equal(manual.result.studies[0]?.provenance, "unknown");
  assert.match(formatResearchImageReport(manual.result), /Unknown or manual provenance: 1/);
  assert.match(formatResearchImageReport(manual.result), /not recorded/);

  const replaced = "image-editor-replacement-1400x788-png";
  const stale = await writeRun(
    [
      research({
        _id: "research-pubmed-6",
        pmid: "6",
        mainImage: image(replaced, "Editor replacement."),
        imageAutomation: automationRecord("image-old-auto-2048x1152-png", "pmid-6"),
      }),
    ],
    { regenerationMode: "ai_generated_only", confirm: "REGENERATE RESEARCH IMAGES" },
  );
  assert.equal(stale.calls.generate, 0);
  assert.equal(stale.result.studies[0]?.provenance, "unknown");

  let loaded = false;
  await assert.rejects(
    () =>
      runResearchImageBackfill({
        dryRun: false,
        scope: "all_missing",
        maxImages: "ALL",
        regenerationMode: "ai_generated_only",
        confirm: CONFIRM,
        loadDocuments: async () => {
          loaded = true;
          return [];
        },
        uploadImage: async () => ASSET,
        patchDocument: async () => {},
      }),
    /REGENERATE RESEARCH IMAGES/,
  );
  assert.equal(loaded, false);

  await assert.rejects(
    () =>
      runResearchImageBackfill({
        dryRun: false,
        scope: "all_missing",
        maxImages: "ALL",
        regenerationMode: "missing_only",
        confirm: "REGENERATE RESEARCH IMAGES",
        loadDocuments: async () => [],
        uploadImage: async () => ASSET,
        patchDocument: async () => {},
      }),
    /GENERATE RESEARCH IMAGES/,
  );
});

test("only a matching automation record can be regenerated, and missing_only leaves it", async () => {
  const asset = "image-auto-2048x1152-png";
  const documents = [
    research({
      _id: "research-pubmed-8",
      pmid: "8",
      title: "Brief stationary cycling for inactive adults",
      intervention: "Participants completed short stationary cycling bouts.",
      mainImage: image(asset, "Illustration of a woman performing a short stationary cycling session."),
      imageAutomation: automationRecord(asset, "pmid-8"),
    }),
    research({
      _id: "research-he-research-pubmed-8",
      language: "he",
      pmid: "8",
      mainImage: image(asset, "איור קיים."),
      imageAutomation: automationRecord(asset, "pmid-8"),
    }),
  ];

  const partialAsset = "image-auto-partial-2048x1152-png";
  const partial = await writeRun(
    [
      research({
        _id: "research-pubmed-7",
        pmid: "7",
        mainImage: image(partialAsset, "Illustration of a person taking a short walk."),
        imageAutomation: automationRecord(partialAsset, "pmid-7"),
      }),
      research({
        _id: "research-he-research-pubmed-7",
        language: "he",
        pmid: "7",
        mainImage: image(partialAsset, "איור קיים בלי תיעוד."),
      }),
    ],
    { regenerationMode: "ai_generated_only", confirm: "REGENERATE RESEARCH IMAGES" },
  );
  assert.equal(partial.calls.generate, 0);
  assert.equal(partial.result.studies[0]?.provenance, "unknown");

  const kept = await writeRun(documents, { regenerationMode: "missing_only" });
  assert.equal(kept.calls.generate, 0);
  assert.equal(kept.calls.patch.length, 0);
  assert.equal(kept.result.studies[0]?.action, "skip_existing_image");
  assert.equal(kept.result.audit.automated, 1);
  assert.equal(kept.result.audit.recordedPeople.femalePresenting, 1);

  const regenerated = await writeRun(documents, {
    regenerationMode: "ai_generated_only",
    confirm: "REGENERATE RESEARCH IMAGES",
  });
  assert.equal(regenerated.calls.generate, 1);
  assert.equal(regenerated.calls.upload, 1);
  assert.equal(regenerated.calls.patch.length, 2);
  const refs = regenerated.calls.patch.map((patch) => imageRef(patch.fields));
  assert.deepEqual(refs, [ASSET, ASSET]);
  for (const patch of regenerated.calls.patch) {
    const record = patch.fields.imageAutomation as { assetRef?: string; source?: string };
    assert.equal(record.source, "research-image-automation");
    assert.equal(record.assetRef, ASSET);
  }

  const blocked = runDispatch({
    IMAGE_DRY_RUN: "false",
    IMAGE_SCOPE: "all_missing",
    IMAGE_MAX: "10",
    IMAGE_CONFIRM: CONFIRM,
    IMAGE_REGENERATION_MODE: "ai_generated_only",
  });
  assert.equal(blocked.status, 1);
  assert.equal(blocked.calls, "");
  assert.match(blocked.stdout, /REGENERATE RESEARCH IMAGES/);

  const allowed = runDispatch({
    IMAGE_DRY_RUN: "false",
    IMAGE_SCOPE: "all_missing",
    IMAGE_MAX: "10",
    IMAGE_CONFIRM: "REGENERATE RESEARCH IMAGES",
    IMAGE_REGENERATION_MODE: "ai_generated_only",
  });
  assert.equal(allowed.status, 0);
  assert.match(allowed.calls, /--regeneration-mode=ai_generated_only/);
  assert.match(allowed.calls, /--confirm=REGENERATE RESEARCH IMAGES/);
});

test("the cost banner is printed before the first image request", async () => {
  const { calls, lines } = await writeRun([research({ _id: "research-pubmed-4", pmid: "4" })]);
  const banner = lines.join("\n");
  assert.match(banner, /Logical studies: 1/);
  assert.match(banner, /Missing images: 1/);
  assert.match(banner, /Existing images: 0/);
  assert.match(banner, /Images eligible for regeneration: 0/);
  assert.match(banner, /Images to generate: 1/);
  assert.match(banner, /Estimated API calls: 1/);
  assert.match(banner, /Eligible logical studies: 1/);
  assert.match(banner, /Existing images reused: 0/);
  assert.match(banner, /Requested max: ALL/);
  assert.match(banner, /Image model: gpt-image-2\.5-flare/);
  assert.match(banner, /Image size: 2048x1152/);
  assert.equal(calls.order[0], "banner");
  assert.equal(calls.order.includes("generate"), true);
  assert.ok(calls.order.indexOf("banner") < calls.order.indexOf("generate"));
});

function research(overrides: Partial<ResearchImageDocument> = {}): ResearchImageDocument {
  return {
    _id: "research-fixture",
    language: "en",
    title: "Brief stair-climbing exercise snacks for inactive adults",
    seoTitle: "Stair-climbing exercise snacks",
    excerpt: "Participants climbed stairs in short bouts during the day.",
    topic: "exercise-snacks",
    studyDesign: "randomized-controlled-trial",
    population: "Inactive adults",
    intervention: "Participants completed short stair-climbing bouts.",
    outcomes: ["fitness"],
    mainFindings: [{ _type: "block", children: [{ _type: "span", text: "Stair climbing was the activity." }] }],
    practicalInterpretation: "The study concerns short stair-climbing bouts.",
    ...overrides,
  };
}

function automationRecord(assetRef: string, studyKey: string): ResearchImageAutomation {
  return {
    _type: "researchImageAutomation",
    source: "research-image-automation",
    assetRef,
    studyKey,
    generatedAt: "2026-01-01T00:00:00.000Z",
    activity: "cycling",
    setting: "home",
    subjectCount: "one",
    subjectPresentation: "female",
    approximateAge: "adult",
    composition: "medium-activity",
    supportingPalette: "warm-sand",
    brandAccent: "accessory",
    keyProps: ["stationary bike"],
    appearanceVariation: "medium",
  };
}

function image(ref: string, alt = ""): NonNullable<ResearchImageDocument["mainImage"]> {
  return {
    _type: "image",
    alt,
    asset: { _type: "reference", _ref: ref },
  };
}

function imageRef(fields: Record<string, unknown>): string {
  const mainImage = fields.mainImage;
  if (!mainImage || typeof mainImage !== "object") return "";
  const asset = (mainImage as { asset?: { _ref?: string } }).asset;
  return asset?._ref ?? "";
}

function imageAlt(fields: Record<string, unknown>): string {
  if (typeof fields["mainImage.alt"] === "string") return fields["mainImage.alt"];
  const mainImage = fields.mainImage;
  if (!mainImage || typeof mainImage !== "object") return "";
  const alt = (mainImage as { alt?: string }).alt;
  return alt ?? "";
}

async function writeRun(
  documents: ResearchImageDocument[],
  options: {
    dryRun?: boolean;
    confirm?: string;
    regenerationMode?: "missing_only" | "ai_generated_only";
    scope?: "all_missing" | "published_missing" | "drafts_missing";
    maxImages?: number | "ALL" | string;
    generateImage?: () => Promise<Buffer>;
    reviewImage?: () => Promise<{ hasVisibleText: boolean; activityMatches: boolean; reason: string }>;
    uploadImage?: () => Promise<string>;
    patchDocument?: (id: string, fields: Record<string, unknown>) => Promise<void>;
  } = {},
) {
  const calls: {
    load: number;
    generate: number;
    review: number;
    upload: number;
    patch: { id: string; fields: Record<string, unknown> }[];
    order: string[];
  } = { load: 0, generate: 0, review: 0, upload: 0, patch: [], order: [] };
  const lines: string[] = [];
  const originalLog = console.log;
  const originalError = console.error;
  console.log = (...args: unknown[]) => {
    const line = args.map(String).join(" ");
    lines.push(line);
    if (line.includes("Images to generate")) calls.order.push("banner");
  };
  console.error = () => {};
  try {
    const result = await runResearchImageBackfill({
      dryRun: options.dryRun ?? false,
      scope: options.scope ?? "all_missing",
      maxImages: options.maxImages ?? "ALL",
      regenerationMode: options.regenerationMode,
      confirm: options.confirm ?? CONFIRM,
      model: "gpt-image-2.5-flare",
      loadDocuments: async () => {
        calls.load += 1;
        return documents;
      },
      generateImage: async () => {
        calls.generate += 1;
        calls.order.push("generate");
        if (options.generateImage) return options.generateImage();
        return PNG;
      },
      reviewImage: async () => {
        calls.review += 1;
        if (options.reviewImage) return options.reviewImage();
        return {
          hasVisibleText: false,
          activityMatches: true,
          reason: "The picture shows the activity and no text.",
        };
      },
      uploadImage: async () => {
        calls.upload += 1;
        calls.order.push("upload");
        if (options.uploadImage) return options.uploadImage();
        return ASSET;
      },
      patchDocument:
        options.patchDocument ??
        (async (id, fields) => {
          calls.patch.push({ id, fields });
          calls.order.push(`patch:${id}`);
        }),
    });
    return { calls, result, lines };
  } finally {
    console.log = originalLog;
    console.error = originalError;
  }
}

function runDispatch(env: Record<string, string>) {
  const directory = mkdtempSync(join(tmpdir(), "research-image-backfill-"));
  const log = join(directory, "npm.log");
  const npm = join(directory, "npm");
  writeFileSync(npm, `#!/bin/sh\nprintf '%s\\n' "$*" >> ${JSON.stringify(log)}\n`);
  chmodSync(npm, 0o755);
  const script = join(directory, "run.sh");
  writeFileSync(script, runScript(workflow));
  const result = spawnSync("bash", ["-eo", "pipefail", script], {
    env: { ...process.env, PATH: `${directory}:/usr/bin:/bin`, ...env },
    encoding: "utf8",
  });
  return {
    status: result.status,
    stdout: result.stdout,
    stderr: result.stderr,
    calls: readLog(log),
  };
}

function runScript(source: string): string {
  const marker = "run: |\n";
  const start = source.indexOf(marker);
  assert.ok(start >= 0);
  const body = source.slice(start + marker.length).replace(/\s*$/, "");
  const lines = body.split("\n");
  const indent = lines.find((line) => line.trim())?.match(/^( *)/)?.[1].length ?? 0;
  return `${lines.map((line) => (line.startsWith(" ".repeat(indent)) ? line.slice(indent) : line)).join("\n")}\n`;
}

function readLog(log: string): string {
  try {
    return readFileSync(log, "utf8");
  } catch {
    return "";
  }
}
