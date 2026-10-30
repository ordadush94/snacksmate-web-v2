import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { resolveResearchAiModel } from "../lib/research-enrichment/config";
import { OpenAiRequestError, requestResearchEnrichment } from "../lib/research-enrichment/openai";
import { buildEnrichmentInput, ENRICHMENT_INSTRUCTIONS } from "../lib/research-enrichment/prompt";
import { runResearchEnrichment } from "../lib/research-enrichment/run";
import { loadResearchDraftsByPmid, patchResearchDraft } from "../lib/research-enrichment/sanity";
import { attachResearchCoverImages } from "../lib/research-automation/images";
import {
  executeResearchRecovery,
  formatRecoveryReport,
  parseRecoveryArgs,
  planResearchRecovery,
  recoveryExitCode,
  RECOVERY_PMIDS,
  type RecoveryDocument,
} from "../lib/research-automation/recover";
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

  const args = parseRecoveryArgs(process.argv.slice(2));
  const token = process.env.SANITY_WRITE_TOKEN?.trim();
  const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID?.trim();
  const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET?.trim();
  if (!token || !projectId || !dataset) {
    throw new Error("Sanity project id, dataset, and SANITY_WRITE_TOKEN are required. Nothing was written.");
  }

  const sanity = createSanityWriteClient({
    projectId,
    dataset,
    apiVersion: process.env.NEXT_PUBLIC_SANITY_API_VERSION?.trim() || "2026-09-22",
    token,
  });
  const documents = await inspect(sanity);
  const studies = RECOVERY_PMIDS.map((pmid) => ({
    pmid,
    documents: documents.filter((document) => document.pmid === pmid),
  }));
  const plans = planResearchRecovery(studies);

  console.log(args.dryRun ? "Recovery dry_run: true" : "Recovery dry_run: false");
  console.log(`Recovery targets: ${RECOVERY_PMIDS.join(", ")}`);
  console.log("PMID 42948631 touched: no");

  if (!args.dryRun) {
    const openAiKey = process.env.OPENAI_API_KEY?.trim();
    const needsOpenAi = plans.some(
      (plan) => plan.enrich === "run" || plan.image === "attempt_once" || plan.hebrew === "create",
    );
    if (needsOpenAi && !openAiKey) {
      throw new Error("OPENAI_API_KEY is required for a live recovery. Nothing was written.");
    }
    if (plans.some((plan) => plan.enrich === "run") && !process.env.NCBI_CONTACT_EMAIL?.trim()) {
      throw new Error("NCBI_CONTACT_EMAIL is required to enrich a draft. Nothing was written.");
    }
  }

  const openAiKey = process.env.OPENAI_API_KEY?.trim() ?? "";
  const model = resolveResearchAiModel(process.env.RESEARCH_AI_MODEL);
  const execution = await executeResearchRecovery({
    dryRun: args.dryRun,
    studies,
    effects: {
      enrich: async (plan) => {
        const email = process.env.NCBI_CONTACT_EMAIL?.trim() ?? "";
        const pubmed = createPubmedClient({
          email,
          apiKey: process.env.NCBI_API_KEY?.trim() || undefined,
          lookbackDays: 1,
        });
        const drafts = await loadResearchDraftsByPmid(sanity, [plan.pmid]);
        const summary = await runResearchEnrichment({
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
        });
        const outcome = summary.pmidResults.find((item) => item.pmid === plan.pmid);
        if (!outcome || outcome.outcome === "failed") {
          throw new Error(`Enrichment failed for PMID ${plan.pmid}. The English draft was kept.`);
        }
      },
      attachCover: async (plan) => {
        if (!plan.englishDraftId) return { ok: false, error: "English draft is missing." };
        const imageDocuments = await loadResearchImageDocumentsByIds(sanity, [plan.englishDraftId]);
        const attachments = await attachResearchCoverImages({
          documents: imageDocuments,
          apiKey: openAiKey,
          model: process.env.RESEARCH_IMAGE_MODEL,
          qaModel: model,
          uploadImage: (bytes, filename) => uploadResearchImage(sanity, bytes, filename),
          patchDocument: (id, fields) => patchResearchImage(sanity, id, fields),
        });
        const attachment = attachments.find((item) => item.pmid === plan.pmid) ?? attachments[0];
        if (!attachment || attachment.status === "failed") {
          return {
            ok: false,
            error: attachment?.error || "Image generation failed. The English draft was kept without mainImage.",
          };
        }
        return { ok: attachment.status === "generated" || attachment.status === "skipped_existing", error: "" };
      },
      createHebrew: async (plan) => {
        if (!plan.englishDraftId) {
          throw new Error(`PMID ${plan.pmid} has no English draft to translate.`);
        }
        const document = await loadEnglishResearchDraft(sanity, plan.englishDraftId);
        const assetRef = document.mainImage?.asset?._ref?.trim();
        console.log(
          assetRef
            ? `Reloaded ${document._id} with mainImage ${assetRef}.`
            : `Reloaded ${document._id} without mainImage. Hebrew localization continues.`,
        );
        const existing = await loadHebrewLinks(sanity, "research");
        const summary = await runHebrewTranslation({
          dryRun: false,
          model,
          sources: [document],
          existing,
          translate: async (source) => {
            const translated = await requestHebrewLocalization({
              apiKey: openAiKey,
              model,
              source,
            });
            const status = documents.find((row) => row._id === document._id)?.aiEnrichmentStatus.trim();
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
        const item = summary.items.find((entry) => entry.sourceId === document._id);
        if (!item || item.outcome === "failed") {
          throw new Error(item?.message || `Hebrew localization failed for PMID ${plan.pmid}.`);
        }
        return item.outcome === "created" ? "created" : "skipped";
      },
    },
  });

  console.log(formatRecoveryReport(execution));
  process.exitCode = recoveryExitCode(execution);
}

async function inspect(client: {
  fetch: (query: string, params: { pmids: readonly string[] }) => Promise<unknown>;
}): Promise<RecoveryDocument[]> {
  const rows = await client.fetch(INSPECTION_QUERY, { pmids: RECOVERY_PMIDS });
  if (!Array.isArray(rows)) return [];
  return rows.flatMap((row) => {
    const parsed = parseInspectionRow(row);
    return parsed ? [parsed] : [];
  });
}

function parseInspectionRow(value: unknown): RecoveryDocument | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  if (typeof row._id !== "string" || typeof row.pmid !== "string") return null;
  return {
    _id: row._id,
    pmid: row.pmid,
    language: typeof row.language === "string" ? row.language : "",
    title: typeof row.title === "string" ? row.title : "",
    aiEnrichmentStatus: typeof row.aiEnrichmentStatus === "string" ? row.aiEnrichmentStatus : "",
    editorialStatus: typeof row.editorialStatus === "string" ? row.editorialStatus : "",
    translationStatus: typeof row.translationStatus === "string" ? row.translationStatus : "",
    publishedAt: typeof row.publishedAt === "string" ? row.publishedAt : "",
    excerpt: row.excerpt,
    alt: typeof row.alt === "string" ? row.alt : "",
    asset: typeof row.asset === "string" ? row.asset : "",
  };
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
