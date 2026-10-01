import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  automateCreatedResearchDrafts,
  combineAutomationReport,
  formatResearchAutomationReport,
  projectDiscoveryReport,
} from "../lib/research-automation/run";
import { resolveLookbackDays } from "../lib/research-discovery/config";
import {
  assertDiscoveryConfig,
  PubmedUnavailableError,
  runResearchDiscovery,
  SCHEDULED_RESEARCH_CREATE_LIMIT,
} from "../lib/research-discovery/run";
import { createPubmedClient } from "../lib/research-discovery/pubmed";
import { createSanityWriteClient } from "../lib/research-discovery/sanity";
import { resolveResearchAiModel } from "../lib/research-enrichment/config";
import { OpenAiRequestError, requestResearchEnrichment } from "../lib/research-enrichment/openai";
import { buildEnrichmentInput, ENRICHMENT_INSTRUCTIONS } from "../lib/research-enrichment/prompt";
import { runResearchEnrichment } from "../lib/research-enrichment/run";
import {
  loadResearchDraftsByPmid,
  patchResearchDraft,
} from "../lib/research-enrichment/sanity";
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

function parseArgs(argv: string[]) {
  let dryRun = false;
  let maxCreates = String(SCHEDULED_RESEARCH_CREATE_LIMIT);
  let lookback: string | undefined;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--dry-run") {
      dryRun = true;
      continue;
    }
    if (arg === "--max-creates") {
      maxCreates = requiredValue(argv, index, "--max-creates");
      index += 1;
      continue;
    }
    if (arg.startsWith("--max-creates=")) {
      maxCreates = arg.slice("--max-creates=".length);
      continue;
    }
    if (arg === "--lookback-days") {
      lookback = requiredValue(argv, index, "--lookback-days");
      index += 1;
      continue;
    }
    if (arg.startsWith("--lookback-days=")) {
      lookback = arg.slice("--lookback-days=".length);
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  if (!/^\d+$/.test(maxCreates)) {
    throw new Error(`--max-creates must be an integer from 1 to ${SCHEDULED_RESEARCH_CREATE_LIMIT}.`);
  }
  const parsedMax = Number(maxCreates);
  if (parsedMax < 1 || parsedMax > SCHEDULED_RESEARCH_CREATE_LIMIT) {
    throw new Error(
      `--max-creates must be an integer from 1 to ${SCHEDULED_RESEARCH_CREATE_LIMIT}. Received: ${maxCreates}`,
    );
  }

  return {
    dryRun,
    maxCreates: parsedMax,
    lookbackDays: resolveLookbackDays(lookback ?? process.env.RESEARCH_LOOKBACK_DAYS),
  };
}

function requiredValue(argv: string[], index: number, flag: string): string {
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) throw new Error(`${flag} requires a value.`);
  return value;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
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
  if (!args.dryRun && !openAiKey) {
    throw new Error(
      "OPENAI_API_KEY must be set before the scheduled pipeline creates drafts. Nothing was written.",
    );
  }

  const discovery = await runResearchDiscovery({
    dryRun: args.dryRun,
    lookbackDays: args.lookbackDays,
    maxCreates: args.maxCreates,
    email: config.email,
    apiKey: process.env.NCBI_API_KEY?.trim() || undefined,
    sanity: {
      projectId: config.projectId,
      dataset: config.dataset,
      apiVersion: process.env.NEXT_PUBLIC_SANITY_API_VERSION?.trim() || "2026-09-22",
      token: config.token,
    },
  });

  if (args.dryRun) {
    console.log(formatResearchAutomationReport(projectDiscoveryReport(discovery)));
    console.log("Published: 0");
    return;
  }

  const model = resolveResearchAiModel(process.env.RESEARCH_AI_MODEL);
  const sanity = createSanityWriteClient({
    projectId: config.projectId,
    dataset: config.dataset,
    apiVersion: process.env.NEXT_PUBLIC_SANITY_API_VERSION?.trim() || "2026-09-22",
    token: config.token,
  });
  const pubmed = createPubmedClient({
    email: config.email,
    apiKey: process.env.NCBI_API_KEY?.trim() || undefined,
    lookbackDays: 1,
  });

  const automation = await automateCreatedResearchDrafts({
    created: discovery.createdDrafts,
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
      const existing = await loadHebrewLinks(sanity, "research");
      return runHebrewTranslation({
        dryRun: false,
        model,
        sources: sources.map((source) => source.document),
        existing,
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
        writeDraft: (draft) => createHebrewDraft(sanity, draft),
      });
    },
  });

  console.log(formatResearchAutomationReport(combineAutomationReport(discovery, automation)));
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
  const message = error instanceof Error ? error.message : "Research automation failed.";
  console.error(redact(message));
  process.exit(1);
});
