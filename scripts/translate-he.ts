import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { resolveResearchAiModel } from "../lib/research-enrichment/config";
import { OpenAiRequestError } from "../lib/research-enrichment/openai";
import { createSanityWriteClient } from "../lib/research-discovery/sanity";
import { parseTranslationArgs } from "../lib/translation/args";
import { matchingHebrewLink } from "../lib/translation/document";
import { requestHebrewFieldRepair, requestHebrewLocalization } from "../lib/translation/openai";
import { runHebrewTranslation } from "../lib/translation/run";
import {
  createHebrewDraft,
  loadEnglishDocumentsByIds,
  loadEnglishResearchDraft,
  loadHebrewLinks,
  loadPublishedEnglishDocument,
  loadPublishedEnglishIndex,
} from "../lib/translation/sanity";
import { TranslationValidationError } from "../lib/translation/schema";

loadLocalEnv(".env.local");
loadLocalEnv(".env");

function assertTranslationConfig(config: {
  token: string | undefined;
  projectId: string | undefined;
  dataset: string | undefined;
  openAiKey: string | undefined;
}): asserts config is {
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
  if (!config.token?.trim()) {
    throw new Error(
      "SANITY_WRITE_TOKEN must be set. Dry-run still reads drafts so an existing Hebrew translation is not duplicated. It does not write or publish.",
    );
  }
  if (!config.projectId?.trim() || !config.dataset?.trim()) {
    throw new Error(
      "NEXT_PUBLIC_SANITY_PROJECT_ID and NEXT_PUBLIC_SANITY_DATASET must be set.",
    );
  }
}

async function main() {
  const args = parseTranslationArgs(process.argv.slice(2));
  const config = {
    token: process.env.SANITY_WRITE_TOKEN?.trim(),
    projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID?.trim(),
    dataset: process.env.NEXT_PUBLIC_SANITY_DATASET?.trim(),
    openAiKey: process.env.OPENAI_API_KEY?.trim(),
  };
  assertTranslationConfig(config);

  const model = resolveResearchAiModel(process.env.RESEARCH_AI_MODEL);
  const sanity = createSanityWriteClient({
    projectId: config.projectId,
    dataset: config.dataset,
    apiVersion: process.env.NEXT_PUBLIC_SANITY_API_VERSION?.trim() || "2026-09-22",
    token: config.token,
  });

  const existing = await loadHebrewLinks(sanity, args.type);
  const sources = args.fromDraft
    ? [await loadEnglishResearchDraft(sanity, args.id ?? "")]
    : args.id
      ? [await loadPublishedEnglishDocument(sanity, args.type, args.id)]
      : await selectMissing(sanity, args.type, args.limit, existing);

  if (sources.length === 0) {
    console.log(
      args.missing
        ? `No published English ${args.type} documents are missing a Hebrew translation.`
        : "Nothing to translate.",
    );
    console.log("Nothing was published.");
    return;
  }

  if (args.dryRun) {
    console.log(
      "Dry run. The model will be called and the Hebrew text will be printed. Sanity will not be modified and nothing will be published.",
    );
  } else {
    console.log(
      "Creating Hebrew Sanity drafts only. Drafts stay unpublished until a person publishes them.",
    );
  }

  const summary = await runHebrewTranslation({
    dryRun: args.dryRun,
    model,
    sources,
    existing,
    translate: (source) =>
      requestHebrewLocalization({
        apiKey: config.openAiKey,
        model,
        source,
      }),
    repair: (request) =>
      requestHebrewFieldRepair({
        apiKey: config.openAiKey,
        model,
        request,
      }),
    writeDraft: (draft) => createHebrewDraft(sanity, draft),
  });

  console.log(
    `Done. Created ${summary.created} unpublished draft${summary.created === 1 ? "" : "s"}. Dry runs ${summary.dryRun}. Skipped ${summary.skipped}. Failed ${summary.failed}.`,
  );
  console.log("Nothing was published.");
  if (summary.failed > 0) process.exitCode = 1;
}

async function selectMissing(
  sanity: ReturnType<typeof createSanityWriteClient>,
  type: "article" | "research",
  limit: number,
  existing: Awaited<ReturnType<typeof loadHebrewLinks>>,
) {
  const index = await loadPublishedEnglishIndex(sanity, type);
  const missing = index.filter((item) => !matchingHebrewLink(item, existing));
  const selected = missing.slice(0, limit);
  if (missing.length > selected.length) {
    console.log(
      `Bulk limit: localizing ${selected.length} of ${missing.length} published English ${type} documents without Hebrew. The maximum is 25.`,
    );
  }
  return loadEnglishDocumentsByIds(
    sanity,
    type,
    selected.map((item) => item._id),
  );
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
  const secrets = [process.env.OPENAI_API_KEY, process.env.SANITY_WRITE_TOKEN];
  let text = message;
  for (const secret of secrets) {
    const value = secret?.trim();
    if (!value || value.length < 6) continue;
    text = text.split(value).join("[redacted]");
  }
  return text;
}

main().catch((error: unknown) => {
  if (error instanceof OpenAiRequestError || error instanceof TranslationValidationError) {
    console.error(redact(error.message));
    process.exit(1);
  }
  const message = error instanceof Error ? error.message : "Hebrew localization failed.";
  console.error(redact(message));
  process.exit(1);
});
