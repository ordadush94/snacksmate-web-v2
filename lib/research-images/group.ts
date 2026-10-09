import { normalizeDoi, normalizeTitle } from "../research-discovery/normalize";
import type { ResearchImageDocument } from "./types";

export type LogicalStudyGroup = {
  documents: ResearchImageDocument[];
};

const MIN_TITLE_KEY_LENGTH = 24;

export function publishedDocumentId(id: string): string {
  return id.trim().replace(/^drafts\./, "");
}

export function publicationState(id: string): "published" | "draft" | "other" {
  if (id.startsWith("drafts.")) return "draft";
  if (id.startsWith("versions.")) return "other";
  return "published";
}

export function normalizePmid(value: string | null | undefined): string | null {
  const pmid = value?.trim() ?? "";
  return /^\d{1,9}$/.test(pmid) ? pmid : null;
}

/**
 * Group Research documents that describe one scientific study.
 * Stronger identities always win. A weaker key cannot merge two groups that
 * already disagree on PMID, translation source, translation slug, or DOI.
 * Draft and published versions of the same Sanity id are always one study.
 */
export function groupResearchDocuments(
  documents: readonly ResearchImageDocument[],
): LogicalStudyGroup[] {
  const docs = documents.filter((doc) => doc._id.trim());
  const uf = new UnionFind(docs.length);

  unionBy(docs, uf, (doc) => {
    const base = publishedDocumentId(doc._id);
    return base.length > 0 ? base : null;
  }, "base");
  unionBy(docs, uf, (doc) => normalizePmid(doc.pmid), "pmid");
  unionTranslationSources(docs, uf);
  unionBy(docs, uf, (doc) => normalizeTranslationSlug(doc.translationSlug), "slug");
  unionBy(docs, uf, (doc) => normalizeDoi(doc.doi), "doi");
  unionBy(docs, uf, (doc) => normalizeScientificTitle(doc.title), "title");

  const groups = new Map<number, ResearchImageDocument[]>();
  docs.forEach((doc, index) => {
    const root = uf.find(index);
    const list = groups.get(root) ?? [];
    list.push(doc);
    groups.set(root, list);
  });

  return [...groups.values()]
    .map((members) => ({
      documents: members.slice().sort((a, b) => a._id.localeCompare(b._id)),
    }))
    .sort((a, b) => a.documents[0]?._id.localeCompare(b.documents[0]?._id ?? "") ?? 0);
}

function unionTranslationSources(docs: readonly ResearchImageDocument[], uf: UnionFind): void {
  unionBy(docs, uf, (doc) => blankToNull(doc.translationSourceId), "source");

  const ownerByBase = new Map<string, number>();
  docs.forEach((doc, index) => {
    const base = publishedDocumentId(doc._id);
    if (!ownerByBase.has(base)) ownerByBase.set(base, index);
  });

  docs.forEach((doc, index) => {
    const source = doc.translationSourceId?.trim();
    if (!source) return;
    const owner = ownerByBase.get(source);
    if (owner === undefined || uf.same(owner, index)) return;
    if (hasIdentityConflict(docs, uf, owner, index, "source")) return;
    uf.union(owner, index);
  });
}

type GroupLevel = "base" | "pmid" | "source" | "slug" | "doi" | "title";

function unionBy(
  docs: readonly ResearchImageDocument[],
  uf: UnionFind,
  keyFor: (doc: ResearchImageDocument) => string | null,
  level: GroupLevel,
): void {
  const buckets = new Map<string, number[]>();
  docs.forEach((doc, index) => {
    const key = keyFor(doc);
    if (!key) return;
    const list = buckets.get(key) ?? [];
    list.push(index);
    buckets.set(key, list);
  });

  for (const indexes of buckets.values()) {
    if (indexes.length < 2) continue;
    const anchor = indexes[0];
    for (const index of indexes.slice(1)) {
      if (uf.same(anchor, index)) continue;
      if (level !== "base" && hasIdentityConflict(docs, uf, anchor, index, level)) continue;
      uf.union(anchor, index);
    }
  }
}

function hasIdentityConflict(
  docs: readonly ResearchImageDocument[],
  uf: UnionFind,
  left: number,
  right: number,
  level: Exclude<GroupLevel, "base">,
): boolean {
  const a = signalsFor(docs, uf, left);
  const b = signalsFor(docs, uf, right);
  if (conflictsOn(a.pmids, b.pmids)) return true;
  if (level !== "pmid" && conflictsOn(a.sources, b.sources)) return true;
  if ((level === "doi" || level === "title") && conflictsOn(a.slugs, b.slugs)) return true;
  if (level === "title" && conflictsOn(a.dois, b.dois)) return true;
  return false;
}

type Signals = {
  pmids: Set<string>;
  sources: Set<string>;
  slugs: Set<string>;
  dois: Set<string>;
};

function signalsFor(
  docs: readonly ResearchImageDocument[],
  uf: UnionFind,
  index: number,
): Signals {
  const root = uf.find(index);
  const signals: Signals = {
    pmids: new Set(),
    sources: new Set(),
    slugs: new Set(),
    dois: new Set(),
  };
  docs.forEach((doc, docIndex) => {
    if (uf.find(docIndex) !== root) return;
    const pmid = normalizePmid(doc.pmid);
    if (pmid) signals.pmids.add(pmid);
    const source = doc.translationSourceId?.trim();
    if (source) signals.sources.add(source);
    const slug = normalizeTranslationSlug(doc.translationSlug);
    if (slug) signals.slugs.add(slug);
    const doi = normalizeDoi(doc.doi);
    if (doi) signals.dois.add(doi);
  });
  return signals;
}

function conflictsOn(left: Set<string>, right: Set<string>): boolean {
  if (left.size === 0 || right.size === 0) return false;
  for (const a of left) {
    for (const b of right) {
      if (a !== b) return true;
    }
  }
  return false;
}

function normalizeTranslationSlug(value: string | null | undefined): string | null {
  const slug = value?.trim() ?? "";
  return slug.length >= 3 ? slug : null;
}

function normalizeScientificTitle(value: string | null | undefined): string | null {
  const title = normalizeTitle(value);
  return title.length >= MIN_TITLE_KEY_LENGTH ? title : null;
}

function blankToNull(value: string | null | undefined): string | null {
  const text = value?.trim() ?? "";
  return text || null;
}

class UnionFind {
  private parent: number[];

  constructor(size: number) {
    this.parent = Array.from({ length: size }, (_, index) => index);
  }

  find(index: number): number {
    let root = index;
    while (this.parent[root] !== root) root = this.parent[root];
    let cursor = index;
    while (this.parent[cursor] !== root) {
      const next = this.parent[cursor];
      this.parent[cursor] = root;
      cursor = next;
    }
    return root;
  }

  same(left: number, right: number): boolean {
    return this.find(left) === this.find(right);
  }

  union(left: number, right: number): void {
    const leftRoot = this.find(left);
    const rightRoot = this.find(right);
    if (leftRoot !== rightRoot) this.parent[rightRoot] = leftRoot;
  }
}
