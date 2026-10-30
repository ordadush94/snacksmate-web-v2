import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { hasContent } from "../lib/research-enrichment/apply";
import { resolveResearchAiModel } from "../lib/research-enrichment/config";
import { OpenAiRequestError, requestResearchEnrichment } from "../lib/research-enrichment/openai";
import { buildEnrichmentInput, ENRICHMENT_INSTRUCTIONS } from "../lib/research-enrichment/prompt";
import { runResearchEnrichment } from "../lib/research-enrichment/run";
import { loadResearchDraftsByPmid, patchResearchDraft } from "../lib/research-enrichment/sanity";
import { attachResearchCoverImages } from "../lib/research-automation/images";
import {
  automateCreatedResearchDrafts,
  formatResearchAutomationReport,
} from "../lib/research-automation/run";
import { RECOVERY_PMIDS, selectRecoveryDrafts } from "../lib/research-automation/recover";
import { createPubmedClient, PubmedUnavailableError } from "../lib/research-discovery/pubmed";
import { createSanityWriteClient } from "../lib/research-discovery/sanity";
import {
  loadResearchImageDocumentsByIds,
  patchResearchImage,
  uploadResearchImage,
} from "../lib/research-images/sanity";
import { matchingHebrewLink } from "../lib/translation/document";
import { requestHebrewFieldRepair, requestHebrewLocalization } from "../lib/translation/openai";
import { runHebrewTranslation } from "../lib/translation/run";
import {
  createHebrewDraft,
  loadEnglishResearchDraft,
  loadHebrewLinks,
} from "../lib/translation/sanity";

const RECOVER_CONFIRM = "RECOVER RESEARCH DRAFTS";

loadLocalEnv(".env.local");
loadLocalEnv(".env");

type InspectionRow = {
  _id: string;
  pmid: string;
  language: string;
  title: string;
  editorialStatus: string;
  aiEnrichmentStatus: string;
  translationStatus: string;
  publishedAt: string;
  excerpt: unknown;
  findings: number;
  alt: string;
  asset: string;
};

const INSPECTION_QUERY = `*[_type == "research" && pmid in $pmids]{
  _id,
  pmid,
  language,
  title,
  editorialStatus,
  aiEnrichmentStatus,
  translationStatus,
  publishedAt,
  excerpt,
  "findings": count(mainFindings),
  "alt": mainImage.alt,
  "asset": mainImage.asset._ref
}`;

async function main() {
  if (process.env.RECOVER_CONFIRM?.trim() !== RECOVER_CONFIRM) {
    throw new Error(
      `Refusing to recover drafts. Set RECOVER_CONFIRM to exactly: ${RECOVER_CONFIRM}`,
    );
  }
  if (process.env.NEXT_PUBLIC_OPENAI_API_KEY?.trim()) {
    throw new Error(
      "Remove NEXT_PUBLIC_OPENAI_API_KEY. The OpenAI key must stay server-side as OPENAI_API_KEY.",
    );
  }

  const token = process.env.SANITY_WRITE_TOKEN?.trim();
  const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID?.trim();
  const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET?.trim();
  const email = process.env.NCBI_CONTACT_EMAIL?.trim();
  const openAiKey = process.env.OPENAI_API_KEY?.trim();
  if (!token || !projectId || !dataset) {
    throw new Error("Sanity project id, dataset, and SANITY_WRITE_TOKEN are required. Nothing was written.");
  }
  if (!email) {
    throw new Error("NCBI_CONTACT_EMAIL is required to read the three PubMed abstracts. Nothing was written.");
  }
  if (!openAiKey) {
    throw new Error("OPENAI_API_KEY is required. Nothing was written.");
  }

  const sanity = createSanityWriteClient({
    projectId,
    dataset,
    apiVersion: process.env.NEXT_PUBLIC_SANITY_API_VERSION?.trim() || "2026-09-22",
    token,
  });

  console.log("Recovery targets:", RECOVERY_PMIDS.join(", "));
  console.log("PubMed discovery is not run. English drafts are not created. Published: 0");
  const before = await inspect(sanity);
  printInspection("Before recovery", before);

  const selected = selectRecoveryDrafts(before);
  for (const pmid of RECOVERY_PMIDS) {
    if (!selected.some((draft) => draft.pmid === pmid)) {
      console.error(
        `PMID ${pmid}: English draft drafts.research-pubmed-${pmid} was not found. It was not created.`,
      );
    }
  }
  if (selected.length === 0) {
    throw new Error("None of the three English drafts could be read. Nothing was written.");
  }

  const model = resolveResearchAiModel(process.env.RESEARCH_AI_MODEL);
  const pubmed = createPubmedClient({
    email,
    apiKey: process.env.NCBI_API_KEY?.trim() || undefined,
    lookbackDays: 1,
  });

  const automation = await automateCreatedResearchDrafts({
    created: selected,
    loadDrafts: (pmids) => loadResearchDraftsByPmid(sanity, pmids),
    reloadDrafts: (pmids) => loadResearchDraftsByPmid(sanity, pmids),
    enrich: (drafts) =>
      runResearchEnrichment({
        dryRun: false,
        model,
        eligibleCount: drafts.length,
        drafts,
        fetchRecords: (pmids) => pubmed.fetchRecords(pmids),
        complete: (study) =>
          requestResearchEnrichment({
            apiKey: openAiKey,
            model,
            instructions: ENRICHMENT_INSTRUCTIONS,
            input: buildEnrichmentInput(study),
          }),
        writeDraft: (id, fields) => patchResearchDraft(sanity, id, fields),
      }),
    attachImages: async (studies) => {
      const documents = await loadResearchImageDocumentsByIds(
        sanity,
        studies.map((study) => study.draftId),
      );
      return attachResearchCoverImages({
        documents,
        apiKey: openAiKey,
        model: process.env.RESEARCH_IMAGE_MODEL,
        qaModel: model,
        uploadImage: (bytes, filename) => uploadResearchImage(sanity, bytes, filename),
        patchDocument: (id, fields) => patchResearchImage(sanity, id, fields),
      });
    },
    loadTranslationSource: async (draftId) => {
      const document = await loadEnglishResearchDraft(sanity, draftId);
      if (document.publishedAt?.trim()) {
        throw new Error(
          `Refusing to translate ${draftId}. publishedAt is set, and this recovery does not publish.`,
        );
      }
      const assetRef = document.mainImage?.asset?._ref?.trim();
      if (!assetRef) {
        throw new Error(
          `Reloaded ${draftId} has no mainImage. Hebrew localization did not start for this draft.`,
        );
      }
      console.log(`Reloaded ${draftId} with mainImage ${assetRef}.`);
      return document;
    },
    translate: async (sources) => {
      const existing = await loadHebrewLinks(sanity, "research");
      return runHebrewTranslation({
        dryRun: false,
        model,
        sources: sources.map((source) => source.document),
        existing,
        translate: async (source) => {
          const translated = await requestHebrewLocalization({
            apiKey: openAiKey,
            model,
            source,
          });
          const status = sources.find((item) => item.document._id === source._id)?.aiEnrichmentStatus;
          if (status === "needs_review") {
            translated.reviewNotes = [
              ...translated.reviewNotes,
              "English AI enrichment status is needs_review. The English enrichment note was left on the English draft. Translation review notes are preserved.",
            ];
          }
          return translated;
        },
        repair: (request) =>
          requestHebrewFieldRepair({
            apiKey: openAiKey,
            model,
            request,
          }),
        alreadyTranslated: async (source) => {
          const links = await loadHebrewLinks(sanity, "research");
          return matchingHebrewLink(source, links) !== null;
        },
        writeDraft: (draft) => createHebrewDraft(sanity, draft),
      });
    },
  });

  console.log(
    formatResearchAutomationReport({
      dryRun: false,
      discovered: 0,
      rejected: 0,
      reviewCandidates: 0,
      eligible: selected.length,
      existing: RECOVERY_PMIDS.length,
      englishDraftsCreated: 0,
      published: 0,
      withheldByLimit: 0,
      ...automation,
    }),
  );

  const after = await inspect(sanity);
  printInspection("After recovery", after);
  const recovered = printVerification(before, after);
  console.log("Published: 0");
  if (recovered !== RECOVERY_PMIDS.length) {
    process.exitCode = 1;
  }
}

async function inspect(client: { fetch: (query: string, params: { pmids: readonly string[] }) => Promise<unknown> }) {
  const rows = await client.fetch(INSPECTION_QUERY, { pmids: RECOVERY_PMIDS });
  if (!Array.isArray(rows)) return [];
  return rows.flatMap((row) => {
    const parsed = parseInspectionRow(row);
    return parsed ? [parsed] : [];
  });
}

function parseInspectionRow(value: unknown): InspectionRow | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  if (typeof row._id !== "string" || typeof row.pmid !== "string") return null;
  return {
    _id: row._id,
    pmid: row.pmid,
    language: typeof row.language === "string" ? row.language : "",
    title: typeof row.title === "string" ? row.title : "",
    editorialStatus: typeof row.editorialStatus === "string" ? row.editorialStatus : "",
    aiEnrichmentStatus: typeof row.aiEnrichmentStatus === "string" ? row.aiEnrichmentStatus : "",
    translationStatus: typeof row.translationStatus === "string" ? row.translationStatus : "",
    publishedAt: typeof row.publishedAt === "string" ? row.publishedAt : "",
    excerpt: row.excerpt,
    findings: typeof row.findings === "number" ? row.findings : 0,
    alt: typeof row.alt === "string" ? row.alt : "",
    asset: typeof row.asset === "string" ? row.asset : "",
  };
}

function printInspection(label: string, rows: readonly InspectionRow[]) {
  console.log(`\n${label}`);
  for (const pmid of RECOVERY_PMIDS) {
    const related = rows.filter((row) => row.pmid === pmid);
    if (related.length === 0) {
      console.log(`PMID ${pmid}: no Research documents`);
      continue;
    }
    for (const row of related) {
      console.log(
        [
          `PMID ${row.pmid}`,
          row.language || "(no language)",
          row._id,
          `enrichment=${row.aiEnrichmentStatus || "(empty)"}`,
          `editorial=${row.editorialStatus || "(empty)"}`,
          `excerpt=${hasContent(row.excerpt) ? "present" : "missing"}`,
          `findings=${row.findings}`,
          `image=${row.asset || "missing"}`,
          `alt=${row.alt ? "present" : "missing"}`,
          `publishedAt=${row.publishedAt || "(empty)"}`,
        ].join(" | "),
      );
    }
  }
}

function printVerification(before: readonly InspectionRow[], after: readonly InspectionRow[]): number {
  let recovered = 0;
  let hebrewCreated = 0;
  let hebrewReused = 0;
  console.log("\nVerification");
  console.log(
    [
      "PMID",
      "English draft",
      "Enrichment status",
      "English mainImage",
      "English ALT",
      "Hebrew draft",
      "Same asset reused",
      "Hebrew ALT",
      "Editorial status",
      "Published?",
    ].join("\t"),
  );

  for (const pmid of RECOVERY_PMIDS) {
    const english = after.find((row) => row._id === `drafts.research-pubmed-${pmid}` && row.language === "en");
    const hebrew = after.find(
      (row) => row._id === `drafts.research-he-research-pubmed-${pmid}` && row.language === "he",
    );
    const published = after.some(
      (row) => row.pmid === pmid && (!row._id.startsWith("drafts.") || Boolean(row.publishedAt)),
    );
    const hebrewBefore = before.some(
      (row) => row._id === `drafts.research-he-research-pubmed-${pmid}` && row.language === "he",
    );
    if (hebrew && !hebrewBefore) hebrewCreated += 1;
    if (hebrew && hebrewBefore) hebrewReused += 1;
    const sameAsset = Boolean(english?.asset && hebrew?.asset && english.asset === hebrew.asset);
    const editorial = [english?.editorialStatus, hebrew?.editorialStatus].filter(Boolean).join(" / ");
    const complete = Boolean(
      english &&
        (english.aiEnrichmentStatus === "completed" || english.aiEnrichmentStatus === "needs_review") &&
        hasContent(english.excerpt) &&
        english.asset &&
        english.alt &&
        !english.publishedAt &&
        hebrew &&
        sameAsset &&
        hebrew.alt &&
        hebrew.editorialStatus === "needs_review" &&
        hebrew.translationStatus === "needs_review" &&
        !hebrew.publishedAt &&
        !published,
    );
    if (complete) recovered += 1;
    console.log(
      [
        pmid,
        english ? english._id : "missing",
        english?.aiEnrichmentStatus || "missing",
        english?.asset || "missing",
        english?.alt ? "present" : "missing",
        hebrew ? hebrew._id : "missing",
        sameAsset ? "yes" : "no",
        hebrew?.alt ? "present" : "missing",
        editorial || "missing",
        published ? "yes" : "no",
      ].join("\t"),
    );
  }

  console.log(`\nHebrew drafts created: ${hebrewCreated}`);
  console.log(`Hebrew drafts reused: ${hebrewReused}`);
  console.log(`Recovered through Hebrew draft: ${recovered}`);
  return recovered;
}

function loadLocalEnv(filename: string) {
  const path = resolve(process.cwd(), filename);
  if (!existsSync(path)) return;

  const text = readFileSync(path, "utf8");
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator <= 0) continue;
    const key = trimmed.slice(0, separator).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;
    if (process.env[key] !== undefined) continue;
    let value = trimmed.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

function redact(message: string): string {
  const secrets = [process.env.OPENAI_API_KEY, process.env.SANITY_WRITE_TOKEN, process.env.NCBI_API_KEY];
  let text = message;
  for (const secret of secrets) {
    const value = secret?.trim();
    if (!value || value.length < 6) continue;
    text = text.split(value).join("[redacted]");
  }
  return text;
}

main().catch((error: unknown) => {
  if (error instanceof PubmedUnavailableError || error instanceof OpenAiRequestError) {
    console.error(redact(error.message));
    process.exit(1);
  }
  const message = error instanceof Error ? error.message : "Research recovery failed.";
  console.error(redact(message));
  process.exit(1);
});
