import { extractResponseText, OpenAiRequestError } from "../research-enrichment/openai";
import type { ImageReview, VisualBrief } from "./types";

const GENERATIONS_URL = "https://api.openai.com/v1/images/generations";
const RESPONSES_URL = "https://api.openai.com/v1/responses";
const MAX_ATTEMPTS = 3;
const RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504]);

const IMAGE_QA_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    hasVisibleText: { type: "boolean" },
    activityMatches: { type: "boolean" },
    reason: { type: "string" },
  },
  required: ["hasVisibleText", "activityMatches", "reason"],
} as const;

export function buildImageGenerationRequest(input: {
  model: string;
  prompt: string;
  size: string;
}): Record<string, unknown> {
  const body: Record<string, unknown> = {
    model: input.model,
    prompt: input.prompt,
    size: input.size,
    n: 1,
  };
  if (/^dall-e-/i.test(input.model)) {
    body.response_format = "b64_json";
    return body;
  }
  body.quality = "high";
  body.output_format = "png";
  body.background = "opaque";
  return body;
}

/**
 * Generate exactly one image. Transient transport failures may retry until a
 * valid image comes back. A successful image is never regenerated here.
 */
export async function requestResearchCoverImage(options: {
  apiKey: string;
  model: string;
  prompt: string;
  size: string;
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
}): Promise<Buffer> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const sleep = options.sleep ?? defaultSleep;
  const body = buildImageGenerationRequest({
    model: options.model,
    prompt: options.prompt,
    size: options.size,
  });
  if (body.n !== 1) {
    throw new OpenAiRequestError("Research covers generate exactly one image.", false);
  }

  let lastError: OpenAiRequestError | null = null;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    let response: Response;
    try {
      response = await fetchImpl(GENERATIONS_URL, {
        method: "POST",
        headers: {
          authorization: `Bearer ${options.apiKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(180_000),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "network error";
      lastError = new OpenAiRequestError(`OpenAI image request failed: ${message}`, true);
      if (attempt === MAX_ATTEMPTS) break;
      await sleep(backoffMs(attempt));
      continue;
    }

    if (!response.ok) {
      const retryable = RETRYABLE_STATUSES.has(response.status);
      lastError = new OpenAiRequestError(
        `OpenAI image request failed with HTTP ${response.status}.`,
        retryable,
      );
      await consumeBody(response);
      if (!retryable || attempt === MAX_ATTEMPTS) break;
      await sleep(backoffMs(attempt));
      continue;
    }

    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      throw new OpenAiRequestError("OpenAI image response was not JSON.", false);
    }
    return decodeImagePayload(payload);
  }

  throw (
    lastError ??
    new OpenAiRequestError("OpenAI image request failed before an image was returned.", true)
  );
}

export function decodeImagePayload(payload: unknown): Buffer {
  if (!payload || typeof payload !== "object") {
    throw new OpenAiRequestError("OpenAI image response was not an object.", false);
  }
  const data = "data" in payload ? payload.data : undefined;
  if (!Array.isArray(data) || data.length !== 1) {
    throw new OpenAiRequestError("OpenAI image response did not contain exactly one image.", false);
  }
  const row = data[0];
  const b64 = row && typeof row === "object" && "b64_json" in row ? row.b64_json : undefined;
  if (typeof b64 !== "string" || !b64.trim()) {
    throw new OpenAiRequestError(
      "OpenAI image response did not include image bytes. Temporary image URLs are not stored.",
      false,
    );
  }
  const bytes = Buffer.from(b64, "base64");
  assertImageBytes(bytes);
  return bytes;
}

export function assertImageBytes(bytes: Uint8Array): void {
  if (bytes.byteLength < 32) {
    throw new OpenAiRequestError("Generated image was empty.", false);
  }
  const png =
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
  const jpeg = bytes[0] === 0xff && bytes[1] === 0xd8;
  const webp =
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46;
  if (!png && !jpeg && !webp) {
    throw new OpenAiRequestError("Generated image was not a PNG, JPEG, or WebP file.", false);
  }
}

export function assertAssetRef(ref: string | undefined | null): asserts ref is string {
  if (!ref?.trim() || !/^image-[A-Za-z0-9_-]+/.test(ref.trim())) {
    throw new Error("Sanity did not return a valid image asset reference.");
  }
}

export function buildImageQaRequest(input: {
  model: string;
  brief: VisualBrief;
  bytes: Buffer;
}): Record<string, unknown> {
  const body: Record<string, unknown> = {
    model: input.model,
    instructions: [
      "You check one cover illustration for a physical-activity research page.",
      "Judge only what is visible.",
      "hasVisibleText is true when any letter, number, word, caption, logo, chart label, or watermark is visible.",
      `activityMatches is true only when the picture shows this activity: ${input.brief.scene}.`,
      "Do not judge scientific outcomes. A simple depiction of the activity matches.",
      "reason is one short sentence.",
    ].join(" "),
    input: [
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: `Activity: ${input.brief.activity}. Setting: ${input.brief.setting}.`,
          },
          {
            type: "input_image",
            image_url: `data:image/png;base64,${input.bytes.toString("base64")}`,
          },
        ],
      },
    ],
    store: false,
    max_output_tokens: 300,
    text: {
      format: {
        type: "json_schema",
        name: "research_image_qa",
        strict: true,
        schema: IMAGE_QA_SCHEMA,
      },
    },
  };
  if (/^(gpt-5|gpt-6|o\d)/i.test(input.model)) {
    body.reasoning = { effort: "none" };
  }
  return body;
}

export async function reviewResearchCoverImage(options: {
  apiKey: string;
  model: string;
  brief: VisualBrief;
  bytes: Buffer;
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
}): Promise<ImageReview> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const sleep = options.sleep ?? defaultSleep;
  const body = JSON.stringify(
    buildImageQaRequest({
      model: options.model,
      brief: options.brief,
      bytes: options.bytes,
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
      lastError = new OpenAiRequestError(`OpenAI image QA failed: ${message}`, true);
      if (attempt === MAX_ATTEMPTS) break;
      await sleep(backoffMs(attempt));
      continue;
    }

    if (!response.ok) {
      const retryable = RETRYABLE_STATUSES.has(response.status);
      lastError = new OpenAiRequestError(
        `OpenAI image QA failed with HTTP ${response.status}.`,
        retryable,
      );
      await consumeBody(response);
      if (!retryable || attempt === MAX_ATTEMPTS) break;
      await sleep(backoffMs(attempt));
      continue;
    }

    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      throw new OpenAiRequestError("OpenAI image QA response was not JSON.", false);
    }
    try {
      return parseImageReview(JSON.parse(extractResponseText(payload)));
    } catch (error) {
      if (error instanceof OpenAiRequestError && error.retryable && attempt < MAX_ATTEMPTS) {
        lastError = error;
        await sleep(backoffMs(attempt));
        continue;
      }
      if (error instanceof OpenAiRequestError) throw error;
      throw new OpenAiRequestError("OpenAI image QA response was not valid JSON.", false);
    }
  }

  throw lastError ?? new OpenAiRequestError("OpenAI image QA failed before a verdict.", true);
}

export function parseImageReview(value: unknown): ImageReview {
  if (!value || typeof value !== "object") {
    throw new OpenAiRequestError("Image QA response was not an object.", false);
  }
  const row = value as Record<string, unknown>;
  if (typeof row.hasVisibleText !== "boolean" || typeof row.activityMatches !== "boolean") {
    throw new OpenAiRequestError("Image QA response was missing its checks.", false);
  }
  return {
    hasVisibleText: row.hasVisibleText,
    activityMatches: row.activityMatches,
    reason: typeof row.reason === "string" ? row.reason : "",
  };
}

export function assertImageReview(review: ImageReview): void {
  if (review.hasVisibleText || !review.activityMatches) {
    throw new Error(
      `Image QA failed. Visible text: ${review.hasVisibleText ? "yes" : "no"}. Activity match: ${review.activityMatches ? "yes" : "no"}. ${review.reason}`.trim(),
    );
  }
}

function backoffMs(attempt: number): number {
  return 1000 * 2 ** (attempt - 1);
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function consumeBody(response: Response): Promise<void> {
  try {
    await response.text();
  } catch {
    // The status is already known.
  }
}
