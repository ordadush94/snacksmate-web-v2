/**
 * Cost-conscious default for high-volume structured extraction.
 *
 * gpt-5.6-luna supports the Responses API and strict structured outputs.
 * Reasoning effort is set to "none" for this model family so routine
 * extraction does not spend reasoning tokens. Change the model here only.
 */
export const DEFAULT_RESEARCH_AI_MODEL = "gpt-5.6-luna";

export const DEFAULT_ENRICHMENT_LIMIT = 5;

/** One run cannot walk the whole historic library. */
export const MAX_ENRICHMENT_LIMIT = 25;

export function resolveResearchAiModel(value: string | undefined): string {
  const model = value?.trim() || DEFAULT_RESEARCH_AI_MODEL;
  if (!/^[A-Za-z0-9._-]+$/.test(model)) {
    throw new Error(
      "RESEARCH_AI_MODEL must be a single model id. The default is gpt-5.6-luna.",
    );
  }
  return model;
}

export function resolveEnrichmentLimit(value: string | undefined): number {
  if (value === undefined || value.trim() === "") return DEFAULT_ENRICHMENT_LIMIT;

  const token = value.trim();
  if (!/^\d+$/.test(token)) {
    throw new Error(
      `Limit must be an integer from 1 to ${MAX_ENRICHMENT_LIMIT}. The default is ${DEFAULT_ENRICHMENT_LIMIT}.`,
    );
  }

  const parsed = Number(token);
  if (parsed < 1 || parsed > MAX_ENRICHMENT_LIMIT) {
    throw new Error(
      `Limit must be an integer from 1 to ${MAX_ENRICHMENT_LIMIT}. The default is ${DEFAULT_ENRICHMENT_LIMIT}. Larger batches are refused so enrichment cannot walk the historic library in one run.`,
    );
  }

  return parsed;
}

export function parsePmidArg(value: string | undefined): string | undefined {
  if (value === undefined || value.trim() === "") return undefined;
  const pmid = value.trim();
  if (!/^\d{1,9}$/.test(pmid)) {
    throw new Error(`PMID must be a numeric PubMed id. Received: ${value}`);
  }
  return pmid;
}
