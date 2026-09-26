import assert from "node:assert/strict";
import test from "node:test";

import { createPubmedClient, PubmedUnavailableError } from "./pubmed";
import { runResearchDiscovery } from "./run";

const EMAIL = "research@snacksmate.com";

function virtualClock(start = 0) {
  let clock = start;
  const sleeps: number[] = [];
  return {
    now: () => clock,
    sleep: async (ms: number) => {
      sleeps.push(ms);
      clock += ms;
    },
    sleeps,
  };
}

function esearchResponse(ids: string[] = [], status = 200, headers?: HeadersInit): Response {
  return new Response(
    JSON.stringify({
      esearchresult: { count: String(ids.length), idlist: ids },
    }),
    { status, headers: { "content-type": "application/json", ...headersObject(headers) } },
  );
}

function headersObject(headers?: HeadersInit): Record<string, string> {
  if (!headers) return {};
  if (headers instanceof Headers) return Object.fromEntries(headers.entries());
  if (Array.isArray(headers)) return Object.fromEntries(headers);
  return headers;
}

function articleXml(pmid: string): string {
  return `<PubmedArticle><MedlineCitation><PMID>${pmid}</PMID><Article><ArticleTitle>Exercise snacks ${pmid}</ArticleTitle></Article></MedlineCitation></PubmedArticle>`;
}

function fetchXml(pmids: string[]): string {
  return `<PubmedArticleSet>${pmids.map(articleXml).join("")}</PubmedArticleSet>`;
}

function idsFrom(url: string): string[] {
  return new URL(url).searchParams.get("id")?.split(",").filter(Boolean) ?? [];
}

async function captureWarnings(run: () => Promise<void>): Promise<string[]> {
  const warnings: string[] = [];
  const original = console.warn;
  console.warn = (message?: unknown, ...rest: unknown[]) => {
    warnings.push([message, ...rest].map((part) => String(part)).join(" "));
  };
  try {
    await run();
    return warnings;
  } finally {
    console.warn = original;
  }
}

function maxInWindow(times: number[], windowMs: number): number {
  let max = 0;
  for (const start of times) {
    const count = times.filter((time) => time >= start && time < start + windowMs).length;
    if (count > max) max = count;
  }
  return max;
}

test("spaces requests without an API key so PubMed stays at or under 2 per second", async () => {
  const clock = virtualClock();
  const times: number[] = [];
  let firstUrl = "";
  const client = createPubmedClient({
    email: EMAIL,
    lookbackDays: 14,
    now: clock.now,
    sleep: clock.sleep,
    fetchImpl: async (input) => {
      const url = String(input);
      if (!firstUrl) firstUrl = url;
      times.push(clock.now());
      return esearchResponse();
    },
  });

  for (let index = 0; index < 10; index += 1) {
    await client.searchQuery(`term-${index}`);
  }

  assert.deepEqual(
    clock.sleeps,
    Array.from({ length: 9 }, () => 600),
  );
  for (let index = 1; index < times.length; index += 1) {
    assert.ok(times[index] - times[index - 1] >= 600);
  }
  assert.ok(maxInWindow(times, 1000) <= 2);
  const params = new URL(firstUrl).searchParams;
  assert.equal(params.get("tool"), "snacksmate");
  assert.equal(params.get("email"), EMAIL);
  assert.equal(params.get("api_key"), null);
});

test("spaces requests with an API key under 8 per second", async () => {
  const clock = virtualClock();
  const times: number[] = [];
  let firstUrl = "";
  const client = createPubmedClient({
    email: EMAIL,
    apiKey: "ncbi-key",
    lookbackDays: 14,
    now: clock.now,
    sleep: clock.sleep,
    fetchImpl: async (input) => {
      const url = String(input);
      if (!firstUrl) firstUrl = url;
      times.push(clock.now());
      return esearchResponse();
    },
  });

  for (let index = 0; index < 10; index += 1) {
    await client.searchQuery(`term-${index}`);
  }

  assert.deepEqual(
    clock.sleeps,
    Array.from({ length: 9 }, () => 150),
  );
  for (let index = 1; index < times.length; index += 1) {
    assert.ok(times[index] - times[index - 1] >= 150);
  }
  assert.ok(maxInWindow(times, 1000) <= 8);
  const params = new URL(firstUrl).searchParams;
  assert.equal(params.get("tool"), "snacksmate");
  assert.equal(params.get("email"), EMAIL);
  assert.equal(params.get("api_key"), "ncbi-key");
});

for (const status of [429, 500, 502, 503, 504]) {
  test(`retries PubMed HTTP ${status} and continues after it clears`, async () => {
    const clock = virtualClock();
    let attempts = 0;
    const warnings = await captureWarnings(async () => {
      const client = createPubmedClient({
        email: EMAIL,
        lookbackDays: 14,
        now: clock.now,
        sleep: clock.sleep,
        fetchImpl: async () => {
          attempts += 1;
          if (attempts < 3) return new Response("busy", { status });
          return esearchResponse(["111"]);
        },
      });
      const ids = await client.searchQuery("VILPA");
      assert.deepEqual(ids, ["111"]);
    });

    assert.equal(attempts, 3);
    assert.deepEqual(warnings, [
      `PubMed ${status} — retrying in 1000 ms (attempt 1/5)`,
      `PubMed ${status} — retrying in 2000 ms (attempt 2/5)`,
    ]);
    assert.deepEqual(clock.sleeps, [1000, 2000]);
  });
}

test("honors a numeric Retry-After header", async () => {
  const clock = virtualClock();
  let attempts = 0;
  const warnings = await captureWarnings(async () => {
    const client = createPubmedClient({
      email: EMAIL,
      lookbackDays: 14,
      now: clock.now,
      sleep: clock.sleep,
      fetchImpl: async () => {
        attempts += 1;
        if (attempts === 1) {
          return new Response("busy", {
            status: 429,
            headers: { "retry-after": "3" },
          });
        }
        return esearchResponse(["222"]);
      },
    });
    assert.deepEqual(await client.searchQuery("VILPA"), ["222"]);
  });

  assert.equal(attempts, 2);
  assert.deepEqual(warnings, ["PubMed 429 — retrying in 3000 ms (attempt 1/5)"]);
  assert.deepEqual(clock.sleeps, [3000]);
});

test("honors an HTTP-date Retry-After header", async () => {
  const start = Date.UTC(2026, 8, 26, 12, 0, 0);
  const clock = virtualClock(start);
  const retryAt = new Date(start + 5000).toUTCString();
  const client = createPubmedClient({
    email: EMAIL,
    lookbackDays: 14,
    now: clock.now,
    sleep: clock.sleep,
    fetchImpl: async () => {
      if (clock.sleeps.length === 0) {
        return new Response("busy", {
          status: 503,
          headers: { "retry-after": retryAt },
        });
      }
      return esearchResponse(["333"]);
    },
  });

  const warnings = await captureWarnings(async () => {
    assert.deepEqual(await client.searchQuery("VILPA"), ["333"]);
  });

  assert.deepEqual(warnings, ["PubMed 503 — retrying in 5000 ms (attempt 1/5)"]);
  assert.deepEqual(clock.sleeps, [5000]);
});

test("still rate-limits when Retry-After is shorter than the request spacing", async () => {
  const clock = virtualClock();
  const times: number[] = [];
  const client = createPubmedClient({
    email: EMAIL,
    lookbackDays: 14,
    now: clock.now,
    sleep: clock.sleep,
    fetchImpl: async () => {
      times.push(clock.now());
      if (times.length === 1) {
        return new Response("busy", {
          status: 429,
          headers: { "retry-after": "0" },
        });
      }
      return esearchResponse(["444"]);
    },
  });

  await captureWarnings(async () => {
    assert.deepEqual(await client.searchQuery("VILPA"), ["444"]);
  });

  assert.equal(times[1] - times[0], 600);
  assert.ok(maxInWindow(times, 1000) <= 2);
});

test("fails clearly after 5 attempts when PubMed keeps returning 429", async () => {
  const clock = virtualClock();
  let attempts = 0;
  const client = createPubmedClient({
    email: EMAIL,
    lookbackDays: 14,
    now: clock.now,
    sleep: clock.sleep,
    fetchImpl: async () => {
      attempts += 1;
      return new Response("busy", { status: 429 });
    },
  });

  const warnings = await captureWarnings(async () => {
    await assert.rejects(
      () => client.searchQuery("VILPA"),
      (error: unknown) => {
        assert.ok(error instanceof PubmedUnavailableError);
        assert.equal(error.message, "PubMed request failed with HTTP 429 after 5 attempts.");
        return true;
      },
    );
  });

  assert.equal(attempts, 5);
  assert.deepEqual(clock.sleeps, [1000, 2000, 4000, 8000]);
  assert.deepEqual(warnings, [
    "PubMed 429 — retrying in 1000 ms (attempt 1/5)",
    "PubMed 429 — retrying in 2000 ms (attempt 2/5)",
    "PubMed 429 — retrying in 4000 ms (attempt 3/5)",
    "PubMed 429 — retrying in 8000 ms (attempt 4/5)",
  ]);
});

test("does not retry a non-transient PubMed status", async () => {
  let attempts = 0;
  const client = createPubmedClient({
    email: EMAIL,
    lookbackDays: 14,
    sleep: async () => {
      throw new Error("sleep should not be called");
    },
    fetchImpl: async () => {
      attempts += 1;
      return new Response("bad query", { status: 400 });
    },
  });

  await assert.rejects(
    () => client.searchQuery("VILPA"),
    (error: unknown) => {
      assert.ok(error instanceof PubmedUnavailableError);
      assert.equal(error.message, "PubMed request failed with HTTP 400.");
      return true;
    },
  );
  assert.equal(attempts, 1);
});

test("deduplicates PMIDs, batches EFetch, and reuses cached records", async () => {
  const requested: string[][] = [];
  const client = createPubmedClient({
    email: EMAIL,
    apiKey: "ncbi-key",
    lookbackDays: 14,
    sleep: async () => {},
    fetchImpl: async (input) => {
      const url = String(input);
      const params = new URL(url).searchParams;
      assert.equal(params.get("tool"), "snacksmate");
      assert.equal(params.get("email"), EMAIL);
      assert.equal(params.get("api_key"), "ncbi-key");
      const ids = idsFrom(url);
      requested.push(ids);
      return new Response(fetchXml(ids), {
        status: 200,
        headers: { "content-type": "application/xml" },
      });
    },
  });

  const ids = Array.from({ length: 201 }, (_, index) => String(index + 1));
  const first = await client.fetchRecords([ids[0], ...ids, ids[1], ids[0]]);
  assert.equal(requested.length, 2);
  assert.equal(requested[0].length, 200);
  assert.deepEqual(requested[1], ["201"]);
  assert.equal(first.records.length, 201);
  assert.equal(first.errors.length, 0);

  const again = await client.fetchRecords(["201", "1", "201"]);
  assert.equal(requested.length, 2);
  assert.deepEqual(
    again.records.map((record) => record.pmid),
    ["201", "1"],
  );
});

test("a PubMed outage after retries does not create Sanity drafts", async () => {
  const originalFetch = globalThis.fetch;
  const externalCalls: string[] = [];
  globalThis.fetch = async (input) => {
    externalCalls.push(String(input));
    throw new Error(`unexpected request ${String(input)}`);
  };

  try {
    await captureWarnings(async () => {
      await assert.rejects(
        () =>
          runResearchDiscovery({
            dryRun: false,
            lookbackDays: 14,
            email: EMAIL,
            sanity: {
              projectId: "project",
              dataset: "production",
              apiVersion: "2026-09-22",
              token: "token",
            },
            fetchImpl: async () => new Response("busy", { status: 429 }),
            sleep: async () => {},
            now: () => 10_000,
          }),
        (error: unknown) => {
          assert.ok(error instanceof PubmedUnavailableError);
          assert.equal(
            error.message,
            "PubMed request failed with HTTP 429 after 5 attempts.",
          );
          return true;
        },
      );
    });
    assert.deepEqual(externalCalls, []);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
