import { XMLParser } from "fast-xml-parser";

import {
  extractSampleSize,
  inferStudyDesign,
  inferStudyDesignFromTitle,
  publicationDate,
  publicationYear,
  type StudyDesign,
} from "./study-metadata";

const EUTILS_ORIGIN = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils";
const PAGE_SIZE = 200;
const MAX_IDS_PER_QUERY = 400;
/** NCBI accepts large EFetch id lists; 200 stays within a normal GET URL. */
const FETCH_BATCH_SIZE = 200;
/**
 * Without an API key NCBI's published ceiling is 3 requests/second.
 * 600 ms keeps every 1-second window at 2 requests or fewer.
 */
const MIN_INTERVAL_WITHOUT_API_KEY_MS = 600;
/**
 * With an API key NCBI's published ceiling is 10 requests/second.
 * 150 ms stays under a conservative 8 requests/second.
 */
const MIN_INTERVAL_WITH_API_KEY_MS = 150;
const MAX_ATTEMPTS = 5;
const RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504]);

export class PubmedUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PubmedUnavailableError";
  }
}

export type PubmedAuthor = string;

export type PubmedCommentCorrection = {
  refType: string;
  pmid?: string;
};

export type PubmedRecord = {
  pmid: string;
  title: string;
  abstract: string;
  abstractSections: { label?: string; text: string }[];
  authors: string[];
  journal?: string;
  year?: number;
  publishedAt?: string;
  doi?: string;
  publicationTypes: string[];
  commentCorrections: PubmedCommentCorrection[];
  studyDesign?: StudyDesign;
  sampleSize?: number;
};

export type PubmedClientOptions = {
  email: string;
  apiKey?: string;
  lookbackDays: number;
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
};

type ESearchResult = {
  esearchresult?: {
    count?: string;
    idlist?: string[];
    ERROR?: string;
    errorlist?: { ERROR?: string };
  };
};

export function createPubmedClient(options: PubmedClientOptions) {
  const fetchImpl = options.fetchImpl ?? fetch;
  const sleep = options.sleep ?? defaultSleep;
  const now = options.now ?? Date.now;
  const minIntervalMs = options.apiKey
    ? MIN_INTERVAL_WITH_API_KEY_MS
    : MIN_INTERVAL_WITHOUT_API_KEY_MS;
  let lastRequestAt: number | null = null;
  const recordCache = new Map<string, PubmedRecord>();

  async function pace() {
    if (lastRequestAt !== null) {
      const elapsed = now() - lastRequestAt;
      if (elapsed < minIntervalMs) {
        await sleep(minIntervalMs - elapsed);
      }
    }
    lastRequestAt = now();
  }

  async function requestText(url: string): Promise<string> {
    return getText(url, fetchImpl, pace, sleep, now);
  }

  function identification(): Record<string, string> {
    const params: Record<string, string> = {
      tool: "snacksmate",
      email: options.email,
    };
    if (options.apiKey) params.api_key = options.apiKey;
    return params;
  }

  async function searchQuery(term: string): Promise<string[]> {
    const ids: string[] = [];
    let retstart = 0;
    let total = 0;

    do {
      const params = new URLSearchParams({
        db: "pubmed",
        term,
        retmode: "json",
        retmax: String(PAGE_SIZE),
        retstart: String(retstart),
        datetype: "edat",
        reldate: String(options.lookbackDays),
        sort: "pub_date",
        ...identification(),
      });
      const url = `${EUTILS_ORIGIN}/esearch.fcgi?${params.toString()}`;
      const body = await requestText(url);
      let parsed: ESearchResult;
      try {
        parsed = JSON.parse(body) as ESearchResult;
      } catch {
        throw new PubmedUnavailableError(
          "PubMed ESearch returned a response that was not JSON.",
        );
      }

      const result = parsed.esearchresult;
      const error = result?.ERROR || result?.errorlist?.ERROR;
      if (error) {
        throw new PubmedUnavailableError(`PubMed ESearch failed: ${error}`);
      }
      if (!result) {
        throw new PubmedUnavailableError("PubMed ESearch returned an empty result.");
      }

      total = Number(result.count ?? "0");
      if (!Number.isFinite(total)) {
        throw new PubmedUnavailableError("PubMed ESearch returned an invalid result count.");
      }

      ids.push(...(result.idlist ?? []).filter(Boolean));
      retstart += PAGE_SIZE;

      if (ids.length >= MAX_IDS_PER_QUERY) {
        console.warn(
          `PubMed query truncated at ${MAX_IDS_PER_QUERY} records: ${term}`,
        );
        break;
      }
    } while (retstart < total);

    return uniquePmids(ids).slice(0, MAX_IDS_PER_QUERY);
  }

  async function fetchRecords(pmids: string[]): Promise<{
    records: PubmedRecord[];
    errors: { pmid?: string; message: string }[];
  }> {
    const unique = uniquePmids(pmids);
    const missing = unique.filter((pmid) => !recordCache.has(pmid));
    const errors: { pmid?: string; message: string }[] = [];

    for (let index = 0; index < missing.length; index += FETCH_BATCH_SIZE) {
      const batch = missing.slice(index, index + FETCH_BATCH_SIZE);
      const params = new URLSearchParams({
        db: "pubmed",
        id: batch.join(","),
        retmode: "xml",
        ...identification(),
      });
      const url = `${EUTILS_ORIGIN}/efetch.fcgi?${params.toString()}`;
      const xml = await requestText(url);
      const parsed = parsePubmedFetchXml(xml);
      for (const record of parsed.records) {
        recordCache.set(record.pmid, record);
      }
      errors.push(...parsed.errors);
    }

    const records: PubmedRecord[] = [];
    for (const pmid of unique) {
      const record = recordCache.get(pmid);
      if (record) records.push(record);
    }

    return { records, errors };
  }

  return { searchQuery, fetchRecords };
}

export async function getText(
  url: string,
  fetchImpl: typeof fetch,
  pace: () => Promise<void>,
  sleep: (ms: number) => Promise<void> = defaultSleep,
  now: () => number = Date.now,
): Promise<string> {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    await pace();
    let response: Response;
    try {
      response = await fetchImpl(url, {
        headers: {
          "user-agent": "snacksmate-research-discovery",
        },
        signal: AbortSignal.timeout(30_000),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "network error";
      throw new PubmedUnavailableError(`PubMed request failed: ${message}`);
    }

    if (response.ok) {
      return response.text();
    }

    const retryable = RETRYABLE_STATUSES.has(response.status);
    if (!retryable || attempt === MAX_ATTEMPTS) {
      const attempts = retryable ? ` after ${MAX_ATTEMPTS} attempts` : "";
      throw new PubmedUnavailableError(
        `PubMed request failed with HTTP ${response.status}${attempts}.`,
      );
    }

    const delay = retryDelayMs(response, attempt, now);
    console.warn(
      `PubMed ${response.status} — retrying in ${delay} ms (attempt ${attempt}/${MAX_ATTEMPTS})`,
    );
    await consumeBody(response);
    await sleep(delay);
  }

  throw new PubmedUnavailableError(
    `PubMed request failed with HTTP 429 after ${MAX_ATTEMPTS} attempts.`,
  );
}

function retryDelayMs(response: Response, attempt: number, now: () => number): number {
  const fallback = 1000 * 2 ** (attempt - 1);
  const header = response.headers.get("retry-after")?.trim();
  if (!header) return fallback;

  if (/^\d+(\.\d+)?$/.test(header)) {
    return Math.max(0, Math.round(Number(header) * 1000));
  }

  const dateMs = Date.parse(header);
  if (Number.isFinite(dateMs)) {
    return Math.max(0, dateMs - now());
  }

  return fallback;
}

async function consumeBody(response: Response): Promise<void> {
  try {
    await response.text();
  } catch {
    // The status is already known. A body read failure should not hide the retry.
  }
}

function uniquePmids(pmids: string[]): string[] {
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const pmid of pmids) {
    if (!pmid || seen.has(pmid)) continue;
    seen.add(pmid);
    unique.push(pmid);
  }
  return unique;
}

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  trimValues: true,
  processEntities: true,
  htmlEntities: true,
  isArray: (name) =>
    [
      "PubmedArticle",
      "Author",
      "AbstractText",
      "PublicationType",
      "ArticleId",
      "CommentsCorrections",
    ].includes(name),
});

export function parsePubmedFetchXml(xml: string): {
  records: PubmedRecord[];
  errors: { pmid?: string; message: string }[];
} {
  const records: PubmedRecord[] = [];
  const errors: { pmid?: string; message: string }[] = [];
  let parsed: Record<string, unknown>;

  try {
    parsed = xmlParser.parse(stripInlineMarkup(xml)) as Record<string, unknown>;
  } catch (error) {
    const message = error instanceof Error ? error.message : "invalid XML";
    throw new PubmedUnavailableError(`PubMed EFetch XML could not be parsed: ${message}`);
  }

  const set = asRecord(parsed.PubmedArticleSet);
  const articles = arrayOf(set?.PubmedArticle);
  if (articles.length === 0 && !set) {
    throw new PubmedUnavailableError("PubMed EFetch did not return a PubmedArticleSet.");
  }

  for (const article of articles) {
    try {
      const record = parseArticle(article);
      if (record) records.push(record);
    } catch (error) {
      const message = error instanceof Error ? error.message : "malformed record";
      errors.push({ message });
    }
  }

  return { records, errors };
}

function parseArticle(article: unknown): PubmedRecord | null {
  const root = asRecord(article);
  const citation = asRecord(root?.MedlineCitation);
  const articleNode = asRecord(citation?.Article);
  if (!root || !citation || !articleNode) {
    throw new Error("PubMed record is missing MedlineCitation or Article.");
  }

  const pmid = textContent(citation.PMID);
  if (!/^\d+$/.test(pmid)) {
    throw new Error("PubMed record is missing a PMID.");
  }

  const abstractSections = abstractParts(articleNode.Abstract);
  const abstract = abstractSections.map((section) => section.text).filter(Boolean).join("\n");
  const publicationTypes = arrayOf(asRecord(articleNode.PublicationTypeList)?.PublicationType)
    .map(textContent)
    .filter(Boolean);
  const journalNode = asRecord(articleNode.Journal);
  const pubDate = asRecord(asRecord(journalNode?.JournalIssue)?.PubDate);
  const doi = doiFrom(root, articleNode);

  return {
    pmid,
    title: textContent(articleNode.ArticleTitle),
    abstract,
    abstractSections,
    authors: authorsFrom(articleNode.AuthorList),
    journal: textContent(journalNode?.Title) || undefined,
    year: publicationYear({
      year: textContent(pubDate?.Year) || undefined,
      medlineDate: textContent(pubDate?.MedlineDate) || undefined,
    }),
    publishedAt: publicationDate({
      year: textContent(pubDate?.Year) || undefined,
      month: textContent(pubDate?.Month) || undefined,
      day: textContent(pubDate?.Day) || undefined,
    }),
    doi,
    publicationTypes,
    commentCorrections: commentCorrectionsFrom(citation),
    studyDesign:
      inferStudyDesignFromTitle(textContent(articleNode.ArticleTitle)) ??
      inferStudyDesign(publicationTypes),
    sampleSize: extractSampleSize(abstractSections),
  };
}

function commentCorrectionsFrom(citation: Record<string, unknown>): PubmedCommentCorrection[] {
  const list = asRecord(citation.CommentsCorrectionsList);
  const links: PubmedCommentCorrection[] = [];
  for (const item of arrayOf(list?.CommentsCorrections)) {
    const record = asRecord(item);
    if (!record) continue;
    const refType = stringAttr(record, "@_RefType");
    if (!refType) continue;
    const pmid = textContent(record.PMID);
    links.push({
      refType,
      ...(pmid && /^\d+$/.test(pmid) ? { pmid } : {}),
    });
  }
  return links;
}

function doiFrom(root: Record<string, unknown>, articleNode: Record<string, unknown>): string | undefined {
  const data = asRecord(root.PubmedData);
  const ids = arrayOf(asRecord(data?.ArticleIdList)?.ArticleId);
  for (const id of ids) {
    const record = asRecord(id);
    const type = stringAttr(record, "@_IdType");
    if (type?.toLowerCase() === "doi") {
      const value = textContent(id);
      if (value) return value;
    }
  }

  const location = articleNode.ELocationID;
  const locations = Array.isArray(location) ? location : location ? [location] : [];
  for (const item of locations) {
    const record = asRecord(item);
    const type = stringAttr(record, "@_EIdType");
    if (type?.toLowerCase() === "doi") {
      const value = textContent(item);
      if (value) return value;
    }
  }

  return undefined;
}

function authorsFrom(authorList: unknown): string[] {
  const authors = arrayOf(asRecord(authorList)?.Author);
  const names: string[] = [];
  for (const author of authors) {
    const record = asRecord(author);
    if (!record) continue;
    const collective = textContent(record.CollectiveName);
    const foreName = textContent(record.ForeName);
    const lastName = textContent(record.LastName);
    const personal = [foreName, lastName].filter(Boolean).join(" ").trim();
    const name = personal || collective;
    if (name) names.push(name);
  }
  return names;
}

function abstractParts(abstract: unknown): { label?: string; text: string }[] {
  const node = asRecord(abstract);
  if (!node) return [];

  const sections: { label?: string; text: string }[] = [];
  for (const part of arrayOf(node.AbstractText)) {
    const text = textContent(part);
    if (!text) continue;
    const label = stringAttr(asRecord(part), "@_Label");
    sections.push({ label, text });
  }
  return sections;
}

function stripInlineMarkup(xml: string): string {
  return xml.replace(/<\/?(?:i|b|u|sup|sub|em|strong|italic)\b[^>]*>/gi, "");
}

function textContent(value: unknown): string {
  if (typeof value === "string" || typeof value === "number") {
    return decodeXmlEntities(String(value)).trim();
  }
  if (Array.isArray(value)) return value.map(textContent).filter(Boolean).join(" ").trim();
  const record = asRecord(value);
  if (!record) return "";
  if (typeof record["#text"] === "string" || typeof record["#text"] === "number") {
    return decodeXmlEntities(String(record["#text"])).trim();
  }
  return "";
}

export function decodeXmlEntities(value: string): string {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) =>
      String.fromCodePoint(Number.parseInt(hex, 16)),
    )
    .replace(/&#(\d+);/g, (_, num: string) => String.fromCodePoint(Number(num)))
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function stringAttr(record: Record<string, unknown> | null, key: string): string | undefined {
  const value = record?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function arrayOf(value: unknown): unknown[] {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
