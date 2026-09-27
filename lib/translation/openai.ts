import { extractResponseText, OpenAiRequestError } from "../research-enrichment/openai";
import { buildTranslationInput, buildTranslationInstructions } from "./prompt";
import type { FieldRepairRequest } from "./refine";
import {
  ARTICLE_TRANSLATION_JSON_SCHEMA,
  parseTranslation,
  RESEARCH_TRANSLATION_JSON_SCHEMA,
} from "./schema";
import type { EnglishDocument, HebrewTranslation } from "./types";

const RESPONSES_URL = "https://api.openai.com/v1/responses";
const MAX_ATTEMPTS = 3;
const RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504]);

export function buildTranslationRequest(input: {
  model: string;
  contentType: EnglishDocument["_type"];
  instructions: string;
  input: string;
  schema?: Record<string, unknown>;
  schemaName?: string;
}): Record<string, unknown> {
  const body: Record<string, unknown> = {
    model: input.model,
    instructions: input.instructions,
    input: input.input,
    store: false,
    max_output_tokens: 8000,
    text: {
      format: {
        type: "json_schema",
        name:
          input.schemaName ??
          (input.contentType === "article"
            ? "hebrew_article_localization"
            : "hebrew_research_localization"),
        strict: true,
        schema:
          input.schema ??
          (input.contentType === "article"
            ? ARTICLE_TRANSLATION_JSON_SCHEMA
            : RESEARCH_TRANSLATION_JSON_SCHEMA),
      },
    },
  };

  if (/^(gpt-5|gpt-6|o\d)/i.test(input.model)) {
    body.reasoning = { effort: "none" };
  }

  return body;
}

export async function requestHebrewLocalization(options: {
  apiKey: string;
  model: string;
  source: EnglishDocument;
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
}): Promise<HebrewTranslation> {
  const payload = await completeStructuredResponse({
    apiKey: options.apiKey,
    body: buildTranslationRequest({
      model: options.model,
      contentType: options.source._type,
      instructions: buildTranslationInstructions(options.source._type),
      input: buildTranslationInput(options.source),
    }),
    fetchImpl: options.fetchImpl,
    sleep: options.sleep,
    now: options.now,
  });
  return parseTranslation(options.source, payload);
}

export async function requestHebrewFieldRepair(options: {
  apiKey: string;
  model: string;
  request: FieldRepairRequest;
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
}): Promise<unknown> {
  return completeStructuredResponse({
    apiKey: options.apiKey,
    body: buildTranslationRequest({
      model: options.model,
      contentType: options.request.source._type,
      instructions: options.request.instructions,
      input: options.request.input,
      schema: options.request.schema,
      schemaName: options.request.schemaName,
    }),
    fetchImpl: options.fetchImpl,
    sleep: options.sleep,
    now: options.now,
  });
}

async function completeStructuredResponse(options: {
  apiKey: string;
  body: Record<string, unknown>;
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
}): Promise<unknown> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const sleep = options.sleep ?? defaultSleep;
  const now = options.now ?? Date.now;
  const body = JSON.stringify(options.body);

  let lastError: OpenAiRequestError | null = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    let response: Response;
    try {
      response = await fetchImpl(RESPONSES_URL, {
        method: "POST",
        headers: {
          authorization: `Bearer ${options.apiKey}`,
          "content-type": "application/json",
        },
        body,
        signal: AbortSignal.timeout(120_000),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "network error";
      lastError = new OpenAiRequestError(`OpenAI request failed: ${message}`, true);
      if (attempt === MAX_ATTEMPTS) break;
      await sleep(backoffMs(attempt));
      continue;
    }

    if (!response.ok) {
      const retryable = RETRYABLE_STATUSES.has(response.status);
      lastError = new OpenAiRequestError(
        `OpenAI request failed with HTTP ${response.status}.`,
        retryable,
      );
      if (!retryable || attempt === MAX_ATTEMPTS) break;
      const delay = retryDelayMs(response, attempt, now);
      console.warn(
        `OpenAI ${response.status} — retrying in ${delay} ms (attempt ${attempt}/${MAX_ATTEMPTS})`,
      );
      await consumeBody(response);
      await sleep(delay);
      continue;
    }

    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      throw new OpenAiRequestError("OpenAI returned a response that was not JSON.", false);
    }

    try {
      return JSON.parse(extractResponseText(payload)) as unknown;
    } catch (error) {
      if (error instanceof OpenAiRequestError && error.retryable && attempt < MAX_ATTEMPTS) {
        lastError = error;
        console.warn(
          `OpenAI response was incomplete — retrying (attempt ${attempt}/${MAX_ATTEMPTS})`,
        );
        await sleep(backoffMs(attempt));
        continue;
      }
      throw error;
    }
  }

  throw (
    lastError ??
    new OpenAiRequestError("OpenAI request failed before a response was received.", true)
  );
}

function backoffMs(attempt: number): number {
  return 1000 * 2 ** (attempt - 1);
}

function retryDelayMs(response: Response, attempt: number, now: () => number): number {
  const fallback = backoffMs(attempt);
  const header = response.headers.get("retry-after")?.trim();
  if (!header) return fallback;
  if (/^\d+(\.\d+)?$/.test(header)) return Math.max(0, Math.round(Number(header) * 1000));
  const dateMs = Date.parse(header);
  if (Number.isFinite(dateMs)) return Math.max(0, dateMs - now());
  return fallback;
}

async function consumeBody(response: Response): Promise<void> {
  try {
    await response.text();
  } catch {
    // The status is already known.
  }
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
