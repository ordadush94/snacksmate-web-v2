import { hasEnrichableGap } from "../research-enrichment/apply";
import { resolveResearchAiModel } from "../research-enrichment/config";
import { requestResearchEnrichment } from "../research-enrichment/openai";
import { buildEnrichmentInput, ENRICHMENT_INSTRUCTIONS } from "../research-enrichment/prompt";
import { runResearchEnrichment } from "../research-enrichment/run";
import { loadResearchDraftsByPmid, patchResearchDraft } from "../research-enrichment/sanity";
import { createPubmedClient } from "../research-discovery/pubmed";
import { createSanityWriteClient } from "../research-discovery/sanity";

/**
 * Separate stage from draft creation. Uses the existing enrichment runner.
 * Throws on failure and does not delete or replace the source drafts.
 */
export async function enrichBackfillDrafts(pmids: string[]): Promise<void> {
  if (pmids.length === 0) return;

  if (process.env.NEXT_PUBLIC_OPENAI_API_KEY?.trim()) {
    throw new Error(
      "Remove NEXT_PUBLIC_OPENAI_API_KEY. The OpenAI key must stay server-side as OPENAI_API_KEY. Created drafts were not changed.",
    );
  }

  const openAiKey = process.env.OPENAI_API_KEY?.trim();
  const email = process.env.NCBI_CONTACT_EMAIL?.trim();
  const token = process.env.SANITY_WRITE_TOKEN?.trim();
  const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID?.trim();
  const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET?.trim();
  if (!openAiKey) {
    throw new Error("OPENAI_API_KEY must be set before AI enrichment. Created drafts were not changed.");
  }
  if (!email || !email.includes("@")) {
    throw new Error("NCBI_CONTACT_EMAIL must be set before AI enrichment. Created drafts were not changed.");
  }
  if (!token || !projectId || !dataset) {
    throw new Error("Sanity configuration is required before AI enrichment. Created drafts were not changed.");
  }

  const model = resolveResearchAiModel(process.env.RESEARCH_AI_MODEL);
  const sanity = createSanityWriteClient({
    projectId,
    dataset,
    apiVersion: process.env.NEXT_PUBLIC_SANITY_API_VERSION?.trim() || "2026-09-22",
    token,
  });
  const pubmed = createPubmedClient({
    email,
    apiKey: process.env.NCBI_API_KEY?.trim() || undefined,
    lookbackDays: 1,
  });

  const loaded = await loadResearchDraftsByPmid(sanity, pmids);
  const found = new Set(loaded.map((draft) => draft.pmid));
  const missing = pmids.filter((pmid) => !found.has(pmid));
  if (missing.length > 0) {
    throw new Error(
      `Enrichment could not read the new draft for PMID ${missing.join(", ")}. The source draft was not deleted.`,
    );
  }
  const drafts = loaded.filter(hasEnrichableGap);
  if (drafts.length === 0) return;

  const summary = await runResearchEnrichment({
    dryRun: false,
    model,
    eligibleCount: drafts.length,
    drafts,
    fetchRecords: (ids) => pubmed.fetchRecords(ids),
    complete: (study) =>
      requestResearchEnrichment({
        apiKey: openAiKey,
        model,
        instructions: ENRICHMENT_INSTRUCTIONS,
        input: buildEnrichmentInput(study),
      }),
    writeDraft: (id, fields) => patchResearchDraft(sanity, id, fields),
  });

  if (summary.failed > 0) {
    throw new Error(
      `AI enrichment failed for ${summary.failed} draft(s). Source drafts were not deleted.`,
    );
  }
}
