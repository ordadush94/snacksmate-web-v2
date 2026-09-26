import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { hasEnrichableGap } from "../lib/research-enrichment/apply";
import {
  parsePmidArg,
  resolveEnrichmentLimit,
  resolveResearchAiModel,
} from "../lib/research-enrichment/config";
import { OpenAiRequestError, requestResearchEnrichment } from "../lib/research-enrichment/openai";
import { buildEnrichmentInput, ENRICHMENT_INSTRUCTIONS } from "../lib/research-enrichment/prompt";
import { runResearchEnrichment } from "../lib/research-enrichment/run";
import {
  loadEligibleResearchDrafts,
  loadResearchDraftsByPmid,
  patchResearchDraft,
} from "../lib/research-enrichment/sanity";
import { createPubmedClient, PubmedUnavailableError } from "../lib/research-discovery/pubmed";
import { createSanityWriteClient } from "../lib/research-discovery/sanity";

loadLocalEnv(".env.local");
loadLocalEnv(".env");

function parseArgs(argv: string[]) {
  let dryRun = false;
  let force = false;
  let limit: string | undefined;
  let pmid: string | undefined;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--dry-run") {
      dryRun = true;
      continue;
    }
    if (arg === "--force") {
      force = true;
      continue;
    }
    if (arg === "--limit") {
      limit = requiredValue(argv, index, "--limit");
      index += 1;
      continue;
    }
    if (arg.startsWith("--limit=")) {
      limit = arg.slice("--limit=".length);
      continue;
    }
    if (arg === "--pmid") {
      pmid = requiredValue(argv, index, "--pmid");
      index += 1;
      continue;
    }
    if (arg.startsWith("--pmid=")) {
      pmid = arg.slice("--pmid=".length);
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  const pmids = parsePmidArg(pmid);
  if (force && (!pmids || pmids.length === 0)) {
    throw new Error(
      "--force requires --pmid. It reprocesses only those drafts and cannot walk the library.",
    );
  }

  return {
    dryRun,
    force,
    limit: resolveEnrichmentLimit(limit),
    pmids,
  };
}

function requiredValue(argv: string[], index: number, flag: string): string {
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`${flag} requires a value.`);
  }
  return value;
}

function assertEnrichmentConfig(config: {
  email: string | undefined;
  token: string | undefined;
  projectId: string | undefined;
  dataset: string | undefined;
  openAiKey: string | undefined;
}): asserts config is {
  email: string;
  token: string;
  projectId: string;
  dataset: string;
  openAiKey: string;
} {
  if (process.env.NEXT_PUBLIC_OPENAI_API_KEY?.trim()) {
    throw new Error(
      "Remove NEXT_PUBLIC_OPENAI_API_KEY. The OpenAI key must stay server-side as OPENAI_API_KEY.",
    );
  }
  if (!config.openAiKey?.trim()) {
    throw new Error(
      "OPENAI_API_KEY must be set. Dry-run calls the model and does not write. Never use a NEXT_PUBLIC_ name for this key.",
    );
  }
  if (!config.email?.trim() || !config.email.includes("@")) {
    throw new Error(
      "NCBI_CONTACT_EMAIL must be set to a contact email for NCBI E-utilities. It is not hardcoded.",
    );
  }
  if (!config.token?.trim()) {
    throw new Error(
      "SANITY_WRITE_TOKEN must be set. Dry-run still reads drafts and does not write or publish.",
    );
  }
  if (!config.projectId?.trim() || !config.dataset?.trim()) {
    throw new Error(
      "NEXT_PUBLIC_SANITY_PROJECT_ID and NEXT_PUBLIC_SANITY_DATASET must be set.",
    );
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const config = {
    email: process.env.NCBI_CONTACT_EMAIL?.trim(),
    token: process.env.SANITY_WRITE_TOKEN?.trim(),
    projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID?.trim(),
    dataset: process.env.NEXT_PUBLIC_SANITY_DATASET?.trim(),
    openAiKey: process.env.OPENAI_API_KEY?.trim(),
  };
  assertEnrichmentConfig(config);

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

  const drafts = args.force
    ? await loadResearchDraftsByPmid(sanity, args.pmids ?? [])
    : await loadEligibleResearchDrafts(sanity);
  const actionable = args.force ? drafts : drafts.filter(hasEnrichableGap);
  const populated = drafts.length - actionable.length;
  if (!args.force && populated > 0) {
    console.log(
      `Skipped ${populated} draft${populated === 1 ? "" : "s"} that already have public fields populated.`,
    );
  }

  const selected = args.pmids
    ? drafts.filter((draft) => args.pmids?.includes(draft.pmid))
    : actionable.slice(0, args.limit);

  if (args.pmids && selected.length !== args.pmids.length) {
    const found = new Set(selected.map((draft) => draft.pmid));
    const missing = args.pmids.filter((pmid) => !found.has(pmid));
    throw new Error(
      `No eligible PubMed research draft found for PMID ${missing.join(", ")}. Enrichment does not create documents.`,
    );
  }

  if (args.pmids) {
    console.log(
      `PMID filter: ${args.pmids.join(", ")}.${args.force ? " Force reprocesses these drafts only and does not publish." : " Limit is ignored for an explicit PMID list."}`,
    );
  } else if (actionable.length > selected.length) {
    console.log(
      `Processing ${selected.length} of ${actionable.length} eligible drafts. Pass --limit to change the batch. The maximum is 25.`,
    );
  }

  const summary = await runResearchEnrichment({
    dryRun: args.dryRun,
    force: args.force,
    model,
    eligibleCount: actionable.length,
    drafts: selected,
    fetchRecords: (pmids) => pubmed.fetchRecords(pmids),
    complete: (study) =>
      requestResearchEnrichment({
        apiKey: config.openAiKey,
        model,
        instructions: ENRICHMENT_INSTRUCTIONS,
        input: buildEnrichmentInput(study),
      }),
    writeDraft: (id, fields) => patchResearchDraft(sanity, id, fields),
  });

  if (summary.failed > 0) {
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
  const message = error instanceof Error ? error.message : "Research enrichment failed.";
  console.error(redact(message));
  process.exit(1);
});
