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
const FETCH_BATCH_SIZE = 80;

export class PubmedUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PubmedUnavailableError";
  }
}

export type PubmedAuthor = string;

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
  studyDesign?: StudyDesign;
  sampleSize?: number;
};

export type PubmedClientOptions = {
  email: string;
  apiKey?: string;
  lookbackDays: number;
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
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
  const minIntervalMs = options.apiKey ? 120 : 400;
  let lastRequestAt = 0;

  async function pace() {
    const elapsed = Date.now() - lastRequestAt;
    if (lastRequestAt > 0 && elapsed < minIntervalMs) {
      await sleep(minIntervalMs - elapsed);
    }
    lastRequestAt = Date.now();
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
      const body = await getText(url, fetchImpl, pace);
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

    return ids.slice(0, MAX_IDS_PER_QUERY);
  }

  async function fetchRecords(pmids: string[]): Promise<{
    records: PubmedRecord[];
    errors: { pmid?: string; message: string }[];
  }> {
    const records: PubmedRecord[] = [];
    const errors: { pmid?: string; message: string }[] = [];

    for (let index = 0; index < pmids.length; index += FETCH_BATCH_SIZE) {
      const batch = pmids.slice(index, index + FETCH_BATCH_SIZE);
      const params = new URLSearchParams({
        db: "pubmed",
        id: batch.join(","),
        retmode: "xml",
        ...identification(),
      });
      const url = `${EUTILS_ORIGIN}/efetch.fcgi?${params.toString()}`;
      const xml = await getText(url, fetchImpl, pace);
      const parsed = parsePubmedFetchXml(xml);
      records.push(...parsed.records);
      errors.push(...parsed.errors);
    }

    return { records, errors };
  }

  return { searchQuery, fetchRecords };
}

export async function getText(
  url: string,
  fetchImpl: typeof fetch,
  pace: () => Promise<void>,
): Promise<string> {
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

  const body = await response.text();
  if (!response.ok) {
    throw new PubmedUnavailableError(
      `PubMed request failed with HTTP ${response.status}.`,
    );
  }
  return body;
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
    studyDesign:
      inferStudyDesignFromTitle(textContent(articleNode.ArticleTitle)) ??
      inferStudyDesign(publicationTypes),
    sampleSize: extractSampleSize(abstractSections),
  };
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
