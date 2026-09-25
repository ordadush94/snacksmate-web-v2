import { normalizeDoi } from "./normalize";
import { publicationDate, publicationYear } from "./study-metadata";

export type CrossrefMetadata = {
  doi?: string;
  title?: string;
  journal?: string;
  authors: string[];
  year?: number;
  publishedAt?: string;
};

type CrossrefMessage = {
  DOI?: string;
  title?: string[];
  "container-title"?: string[];
  author?: { given?: string; family?: string; name?: string }[];
  issued?: { "date-parts"?: number[][] };
  published?: { "date-parts"?: number[][] };
  "published-online"?: { "date-parts"?: number[][] };
  "published-print"?: { "date-parts"?: number[][] };
};

export type CrossrefClientOptions = {
  email: string;
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
};

export function createCrossrefClient(options: CrossrefClientOptions) {
  const fetchImpl = options.fetchImpl ?? fetch;
  const sleep = options.sleep ?? ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms)));
  const cache = new Map<string, CrossrefMetadata | null>();
  let lastRequestAt = 0;

  async function lookup(doi: string): Promise<CrossrefMetadata | null> {
    const normalized = normalizeDoi(doi);
    if (!normalized) return null;
    if (cache.has(normalized)) return cache.get(normalized) ?? null;

    const elapsed = Date.now() - lastRequestAt;
    if (lastRequestAt > 0 && elapsed < 250) {
      await sleep(250 - elapsed);
    }
    lastRequestAt = Date.now();

    const url = `https://api.crossref.org/works/${encodeURIComponent(normalized)}`;
    try {
      const response = await fetchWithRetry(url, fetchImpl, options.email);
      if (response.status === 404) {
        cache.set(normalized, null);
        return null;
      }
      if (!response.ok) {
        console.warn(
          `Crossref enrichment failed for ${normalized} (HTTP ${response.status}). Continuing with PubMed metadata.`,
        );
        cache.set(normalized, null);
        return null;
      }

      const payload = (await response.json()) as { message?: CrossrefMessage };
      const metadata = payload.message ? mapMessage(payload.message) : null;
      cache.set(normalized, metadata);
      return metadata;
    } catch (error) {
      const message = error instanceof Error ? error.message : "network error";
      console.warn(
        `Crossref enrichment failed for ${normalized} (${message}). Continuing with PubMed metadata.`,
      );
      cache.set(normalized, null);
      return null;
    }
  }

  return { lookup };
}

async function fetchWithRetry(url: string, fetchImpl: typeof fetch, email: string) {
  const init: RequestInit = {
    headers: {
      accept: "application/json",
      "user-agent": `SnacksmateResearchDiscovery/1.0 (mailto:${email}; https://www.snacksmate.com)`,
    },
    signal: AbortSignal.timeout(30_000),
  };

  const response = await fetchImpl(url, init);
  if (response.status !== 429 && response.status !== 503) return response;
  await new Promise((resolve) => setTimeout(resolve, 2000));
  return fetchImpl(url, init);
}

function mapMessage(message: CrossrefMessage): CrossrefMetadata {
  const dateParts =
    message.issued?.["date-parts"]?.[0] ??
    message.published?.["date-parts"]?.[0] ??
    message["published-online"]?.["date-parts"]?.[0] ??
    message["published-print"]?.["date-parts"]?.[0];
  const [year, month, day] = dateParts ?? [];

  return {
    doi: normalizeDoi(message.DOI) ?? undefined,
    title: firstText(message.title),
    journal: firstText(message["container-title"]),
    authors: (message.author ?? [])
      .map((author) => {
        if (author.name?.trim()) return author.name.trim();
        return [author.given, author.family].filter(Boolean).join(" ").trim();
      })
      .filter(Boolean),
    year: publicationYear({ year }),
    publishedAt: publicationDate({ year, month, day }),
  };
}

function firstText(values: string[] | undefined): string | undefined {
  const value = values?.find((item) => item.trim());
  return value?.trim() || undefined;
}

export function enrichFromCrossref<T extends CrossrefMetadata>(
  pubmed: T,
  crossref: CrossrefMetadata | null,
): T {
  if (!crossref) return pubmed;
  return {
    ...pubmed,
    title: pubmed.title || crossref.title || "",
    journal: pubmed.journal || crossref.journal,
    authors: pubmed.authors.length > 0 ? pubmed.authors : crossref.authors,
    year: pubmed.year ?? crossref.year,
    publishedAt: pubmed.publishedAt ?? crossref.publishedAt,
    doi: pubmed.doi || crossref.doi,
  };
}
