import { RESEARCH_ENRICHMENT_JSON_SCHEMA } from "./schema";

const RESPONSES_URL = "https://api.openai.com/v1/responses";
const MAX_ATTEMPTS = 3;
const RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504]);

export class OpenAiRequestError extends Error {
  readonly retryable: boolean;

  constructor(message: string, retryable: boolean) {
    super(message);
    this.name = "OpenAiRequestError";
    this.retryable = retryable;
  }
}

export function buildResponsesRequest(input: {
  model: string;
  instructions: string;
  input: string;
}): Record<string, unknown> {
  const body: Record<string, unknown> = {
    model: input.model,
    instructions: input.instructions,
    input: input.input,
    store: false,
    max_output_tokens: 4000,
    text: {
      format: {
        type: "json_schema",
        name: "research_enrichment",
        strict: true,
        schema: RESEARCH_ENRICHMENT_JSON_SCHEMA,
      },
    },
  };

  if (/^(gpt-5|gpt-6|o\d)/i.test(input.model)) {
    body.reasoning = { effort: "none" };
  }

  return body;
}

export async function requestResearchEnrichment(options: {
  apiKey: string;
  model: string;
  instructions: string;
  input: string;
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
}): Promise<unknown> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const sleep = options.sleep ?? defaultSleep;
  const now = options.now ?? Date.now;
  const body = JSON.stringify(
    buildResponsesRequest({
      model: options.model,
      instructions: options.instructions,
      input: options.input,
    }),
  );

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
        signal: AbortSignal.timeout(90_000),
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
      const text = extractResponseText(payload);
      return JSON.parse(text) as unknown;
    } catch (error) {
      if (error instanceof OpenAiRequestError && error.retryable && attempt < MAX_ATTEMPTS) {
        lastError = error;
        console.warn(
          `OpenAI response was incomplete — retrying (attempt ${attempt}/${MAX_ATTEMPTS})`,
        );
        await sleep(backoffMs(attempt));
        continue;
      }
      if (error instanceof OpenAiRequestError) throw error;
      throw new OpenAiRequestError("OpenAI structured output was not valid JSON.", false);
    }
  }

  throw (
    lastError ??
    new OpenAiRequestError("OpenAI request failed before a response was received.", true)
  );
}

export function extractResponseText(payload: unknown): string {
  const record = asRecord(payload);
  if (!record) {
    throw new OpenAiRequestError("OpenAI response was not an object.", false);
  }
  if (record.status === "incomplete" || record.status === "failed") {
    throw new OpenAiRequestError(`OpenAI response status was ${String(record.status)}.`, false);
  }

  const output = Array.isArray(record.output) ? record.output : [];
  const texts: string[] = [];
  for (const item of output) {
    const message = asRecord(item);
    if (!message || message.type !== "message") continue;
    const content = Array.isArray(message.content) ? message.content : [];
    for (const part of content) {
      const block = asRecord(part);
      if (!block) continue;
      if (block.type === "refusal") {
        const reason = typeof block.refusal === "string" ? block.refusal : "refused";
        throw new OpenAiRequestError(`OpenAI refused the enrichment request: ${reason}`, false);
      }
      if (block.type === "output_text" && typeof block.text === "string") {
        texts.push(block.text);
      }
    }
  }

  if (texts.length === 0 && typeof record.output_text === "string" && record.output_text.trim()) {
    return record.output_text;
  }
  if (texts.length === 0) {
    throw new OpenAiRequestError("OpenAI response did not include structured text.", true);
  }
  return texts.join("");
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
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
