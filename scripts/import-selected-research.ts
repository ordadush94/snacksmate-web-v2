/**
 * Creates unpublished English research drafts for a fixed PubMed list,
 * then runs the existing enrichment and Hebrew localization on those drafts.
 *
 * Dry-run is the default. It reads Sanity and PubMed and does not write.
 *
 *   npx tsx scripts/import-selected-research.ts
 *   IMPORT_CONFIRM="CREATE DRAFTS" npx tsx scripts/import-selected-research.ts --write
 *
 * --write uses client.create on drafts.research-pubmed-{PMID} only.
 * It never publishes and skips a study already in Sanity.
 */

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { planSelectedStudy } from "../lib/research-import/plan";
import {
  SELECTED_RESEARCH_PMIDS,
  SELECTED_RESEARCH_SOURCE_QUERY,
  assertSelectedResearchPmids,
} from "../lib/research-import/selection";
import { automateCreatedResearchDrafts } from "../lib/research-automation/run";
import { createCrossrefClient } from "../lib/research-discovery/crossref";
import { buildResearchDraft } from "../lib/research-discovery/draft";
import { normalizeDoi } from "../lib/research-discovery/normalize";
import { createPubmedClient } from "../lib/research-discovery/pubmed";
import { assessRelevance } from "../lib/research-discovery/relevance";
import { assertDiscoveryConfig, PubmedUnavailableError } from "../lib/research-discovery/run";
import {
  createResearchDraft,
  createSanityWriteClient,
  loadResearchIdentities,
} from "../lib/research-discovery/sanity";
import { mapResearchTopic } from "../lib/research-discovery/topics";
import { resolveResearchAiModel } from "../lib/research-enrichment/config";
import { OpenAiRequestError, requestResearchEnrichment } from "../lib/research-enrichment/openai";
import { buildEnrichmentInput, ENRICHMENT_INSTRUCTIONS } from "../lib/research-enrichment/prompt";
import { runResearchEnrichment } from "../lib/research-enrichment/run";
import { loadResearchDraftsByPmid, patchResearchDraft } from "../lib/research-enrichment/sanity";
import { matchingHebrewLink } from "../lib/translation/document";
import { requestHebrewFieldRepair, requestHebrewLocalization } from "../lib/translation/openai";
import { runHebrewTranslation } from "../lib/translation/run";
import {
  createHebrewDraft,
  loadEnglishResearchDraft,
  loadHebrewLinks,
} from "../lib/translation/sanity";

loadLocalEnv(".env.local");
loadLocalEnv(".env");

type PreparedStudy = {
  pmid: string;
  title: string;
  draftId: string;
  action: "create" | "resume" | "skip";
  reason: string;
};

async function main() {
  const write = process.argv.includes("--write");
  const unexpected = process.argv.slice(2).filter((arg) => arg !== "--write");
  if (unexpected.length > 0) {
    throw new Error(`Unknown argument: ${unexpected.join(", ")}. Pass --write to create drafts. The default is dry-run.`);
  }
  if (write && process.env.IMPORT_CONFIRM !== "CREATE DRAFTS") {
    throw new Error(
      "Refusing to write. Set IMPORT_CONFIRM to CREATE DRAFTS. Nothing was written or published.",
    );
  }

  assertSelectedResearchPmids(SELECTED_RESEARCH_PMIDS);
  const config = {
    email: process.env.NCBI_CONTACT_EMAIL?.trim(),
    token: process.env.SANITY_WRITE_TOKEN?.trim(),
    projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID?.trim(),
    dataset: process.env.NEXT_PUBLIC_SANITY_DATASET?.trim(),
  };
  assertDiscoveryConfig(config);
  if (process.env.NEXT_PUBLIC_OPENAI_API_KEY?.trim()) {
    throw new Error(
      "Remove NEXT_PUBLIC_OPENAI_API_KEY. The OpenAI key must stay server-side as OPENAI_API_KEY.",
    );
  }
  const openAiKey = process.env.OPENAI_API_KEY?.trim();
  if (write && !openAiKey) {
    throw new Error("OPENAI_API_KEY must be set before drafts are created. Nothing was written.");
  }

  const pubmed = createPubmedClient({
    email: config.email,
    apiKey: process.env.NCBI_API_KEY?.trim() || undefined,
    lookbackDays: 1,
  });
  const crossref = createCrossrefClient({ email: config.email });
  const sanity = createSanityWriteClient({
    projectId: config.projectId,
    dataset: config.dataset,
    apiVersion: process.env.NEXT_PUBLIC_SANITY_API_VERSION?.trim() || "2026-09-22",
    token: config.token,
  });

  const fetched = await pubmed.fetchRecords([...SELECTED_RESEARCH_PMIDS]);
  for (const error of fetched.errors) {
    console.error(`Record error${error.pmid ? ` for PMID ${error.pmid}` : ""}: ${error.message}`);
  }
  const byPmid = new Map(fetched.records.map((record) => [record.pmid, record]));
  const existing = await loadResearchIdentities(sanity);
  const importedAt = new Date().toISOString();
  const prepared: PreparedStudy[] = [];
  const toAutomate: { pmid: string; draftId: string; title: string }[] = [];

  for (const pmid of SELECTED_RESEARCH_PMIDS) {
    const record = byPmid.get(pmid);
    if (!record) {
      prepared.push({
        pmid,
        title: "",
        draftId: `drafts.research-pubmed-${pmid}`,
        action: "skip",
        reason: "PubMed did not return this record.",
      });
      continue;
    }

    const relevance = assessRelevance({
      title: record.title,
      abstract: record.abstract,
      abstractSections: record.abstractSections,
      publicationTypes: record.publicationTypes,
      commentCorrections: record.commentCorrections,
    });
    const doi = normalizeDoi(record.doi);
    let crossrefMetadata = null;
    let crossrefStatus: "enriched" | "no-doi" | "failed" = "no-doi";
    if (doi && relevance.disposition !== "reject") {
      crossrefMetadata = await crossref.lookup(doi);
      crossrefStatus = crossrefMetadata ? "enriched" : "failed";
    }

    const draft = buildResearchDraft({
      record,
      crossref: crossrefMetadata,
      crossrefStatus,
      topic: mapResearchTopic(record.title, record.abstract),
      relevanceRules: relevance.rules,
      sourceQueries: [SELECTED_RESEARCH_SOURCE_QUERY],
      importedAt,
    });
    if (!draft) {
      prepared.push({
        pmid,
        title: record.title,
        draftId: `drafts.research-pubmed-${pmid}`,
        action: "skip",
        reason: "Missing title or identifier.",
      });
      continue;
    }
    draft.automationNote = [
      "Sanity draft created from a manually selected PubMed study.",
      `Relevance: ${relevance.rules.join(", ") || relevance.reason}.`,
      "The abstract was not stored.",
      "Population, intervention, outcomes, limitations, and interpretation are filled by enrichment and stay unpublished until a person reviews them.",
      "Do not publish until a human completes the summary.",
    ].join(" ");

    const plan = planSelectedStudy({
      draft: {
        pmid: draft.pmid,
        title: draft.title,
        draftId: draft._id,
        slug: draft.slug.current,
        doi: draft.doi,
      },
      existing,
      relevance,
    });
    prepared.push(plan);
    console.log(`${plan.action.toUpperCase()} ${plan.draftId} — ${plan.title}`);
    console.log(`Reason: ${plan.reason}`);

    if (plan.action === "skip") continue;
    if (!write) continue;

    if (plan.action === "create") {
      const created = await createResearchDraft(sanity, draft);
      if (created === "duplicate") {
        plan.action = "skip";
        plan.reason = "Create conflict. The existing document was left unchanged.";
        console.log(`Skip ${draft._id}: create conflict`);
        continue;
      }
      console.log(`Created unpublished English draft ${draft._id}`);
    }
    toAutomate.push({ pmid: draft.pmid, draftId: draft._id, title: draft.title });
  }

  console.log("");
  console.log("Named research import");
  console.log(`Selected: ${SELECTED_RESEARCH_PMIDS.length}`);
  console.log(`English drafts to create: ${prepared.filter((item) => item.action === "create").length}`);
  console.log(`Existing English drafts to resume: ${prepared.filter((item) => item.action === "resume").length}`);
  console.log(`Skipped: ${prepared.filter((item) => item.action === "skip").length}`);
  console.log("Published: 0");

  if (!write) {
    console.log("Dry-run only. Nothing was written. Nothing was published.");
    return;
  }

  const model = resolveResearchAiModel(process.env.RESEARCH_AI_MODEL);
  const automation = await automateCreatedResearchDrafts({
    created: toAutomate,
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
            apiKey: openAiKey ?? "",
            model,
            instructions: ENRICHMENT_INSTRUCTIONS,
            input: buildEnrichmentInput(study),
          }),
        writeDraft: (id, fields) => patchResearchDraft(sanity, id, fields),
      }),
    loadTranslationSource: (draftId) => loadEnglishResearchDraft(sanity, draftId),
    translate: async (sources) => {
      const existingLinks = await loadHebrewLinks(sanity, "research");
      return runHebrewTranslation({
        dryRun: false,
        model,
        sources: sources.map((source) => source.document),
        existing: existingLinks,
        translate: async (source) => {
          const translated = await requestHebrewLocalization({
            apiKey: openAiKey ?? "",
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
            apiKey: openAiKey ?? "",
            model,
            request,
          }),
        alreadyTranslated: async (source) => {
          const links = await loadHebrewLinks(sanity, "research");
          return matchingHebrewLink(source, links) !== null;
        },
        writeDraft: (hebrew) => createHebrewDraft(sanity, hebrew),
      });
    },
  });

  console.log("");
  console.log(`English drafts sent through enrichment: ${toAutomate.length}`);
  console.log(`Enriched successfully: ${automation.enrichedSuccessfully}`);
  console.log(`Enrichment failed: ${automation.enrichmentFailed}`);
  console.log(`Hebrew drafts created: ${automation.hebrewDraftsCreated}`);
  console.log(`Translation failed: ${automation.translationFailed}`);
  console.log("Published: 0");
  for (const study of automation.studies) {
    console.log("");
    console.log(`PMID: ${study.pmid}`);
    console.log(`Title: ${study.title}`);
    console.log(`English draft id: ${study.englishDraftId}`);
    console.log(`AI enrichment status: ${study.aiEnrichmentStatus}`);
    console.log(`Hebrew draft id: ${study.hebrewDraftId ?? "(not created)"}`);
    console.log(`Translation status: ${study.translationStatus ?? "(not created)"}`);
    console.log(`Note: ${study.note}`);
  }

  if (automation.enrichmentFailed > 0 || automation.translationFailed > 0) {
    process.exitCode = 1;
  }
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
  const secrets = [
    process.env.OPENAI_API_KEY,
    process.env.SANITY_WRITE_TOKEN,
    process.env.NCBI_API_KEY,
  ];
  let text = message;
  for (const secret of secrets) {
    const value = secret?.trim();
    if (!value || value.length < 6) continue;
    text = text.split(value).join("[redacted]");
  }
  return text;
}

main().catch((error: unknown) => {
  if (error instanceof PubmedUnavailableError) {
    console.error(redact(`PubMed is unavailable. ${error.message}`));
    process.exit(1);
  }
  if (error instanceof OpenAiRequestError) {
    console.error(redact(error.message));
    process.exit(1);
  }
  const message = error instanceof Error ? error.message : "Named research import failed.";
  console.error(redact(message));
  process.exit(1);
});
