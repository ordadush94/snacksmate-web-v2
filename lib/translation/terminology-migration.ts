/**
 * Field-level planner for the Hebrew exercise-snack terminology migration.
 * It proposes patches. It does not talk to Sanity and it does not publish.
 */

import {
  countOutdatedPublicTerminology,
  migrateHebrewExerciseSnackText,
  migrationProblems,
} from "./terminology";

function unchangedOutdatedCount(plan: TerminologyMigrationPlan): number {
  return plan.plans.reduce(
    (sum, item) =>
      sum + item.skipped.reduce((inner, skip) => inner + countOutdatedPublicTerminology(skip.text), 0),
    0,
  );
}

export type TerminologyDocumentType = "research" | "article";

const RESEARCH_STRING_FIELDS = [
  "seoTitle",
  "excerpt",
  "population",
  "duration",
  "comparator",
  "seoDescription",
] as const;

const ARTICLE_STRING_FIELDS = ["title", "excerpt", "seoTitle", "seoDescription"] as const;

const RESEARCH_PORTABLE_FIELDS = [
  "intervention",
  "mainFindings",
  "practicalInterpretation",
  "limitations",
  "snacksmateRelevance",
] as const;

const ARTICLE_PORTABLE_FIELDS = ["body"] as const;

export type TerminologyChange = {
  id: string;
  type: TerminologyDocumentType;
  publication: "published" | "draft";
  field: string;
  before: string;
  after: string;
  /** Top-level Sanity field this span belongs to. */
  patchField: string;
};

export type BlockedTerminologyChange = TerminologyChange & {
  problems: string[];
};

export type TerminologyDocumentPlan = {
  id: string;
  type: TerminologyDocumentType;
  publication: "published" | "draft";
  changes: TerminologyChange[];
  blocked: BlockedTerminologyChange[];
  /** Allowlisted patch. Portable Text arrays keep every key, mark, and link. */
  patch: Record<string, unknown>;
  /** Old terminology found outside the allowlist. Reported, never patched. */
  skipped: Array<{ field: string; text: string }>;
};

export type TerminologyMigrationPlan = {
  documentsScanned: number;
  researchAffected: number;
  articlesAffected: number;
  publishedAffected: number;
  draftsAffected: number;
  fieldsThatWouldChange: number;
  outdatedBefore: number;
  outdatedAfter: number;
  plans: TerminologyDocumentPlan[];
};

type MutablePlan = {
  changes: TerminologyChange[];
  blocked: BlockedTerminologyChange[];
  patch: Record<string, unknown>;
  skipped: Array<{ field: string; text: string }>;
};

export function planTerminologyMigration(documents: readonly unknown[]): TerminologyMigrationPlan {
  const plans = documents.flatMap((document) => {
    const plan = planDocument(document);
    return plan ? [plan] : [];
  });
  const affected = plans.filter((plan) => plan.changes.length > 0 || plan.blocked.length > 0 || plan.skipped.length > 0);
  const changing = plans.filter((plan) => plan.changes.length > 0);
  return {
    documentsScanned: plans.length,
    researchAffected: new Set(changing.filter((plan) => plan.type === "research").map((plan) => plan.id)).size,
    articlesAffected: new Set(changing.filter((plan) => plan.type === "article").map((plan) => plan.id)).size,
    publishedAffected: new Set(changing.filter((plan) => plan.publication === "published").map((plan) => plan.id)).size,
    draftsAffected: new Set(changing.filter((plan) => plan.publication === "draft").map((plan) => plan.id)).size,
    fieldsThatWouldChange: changing.reduce((sum: number, plan) => sum + plan.changes.length, 0),
    outdatedBefore: documents.reduce(
      (sum: number, document: unknown) => sum + countOutdatedPublicTerminology(collectText(document)),
      0,
    ),
    outdatedAfter: documents.reduce((sum: number, document: unknown) => {
      const plan = plans.find((item) => item.id === documentId(document));
      return sum + countOutdatedPublicTerminology(collectText(applyPlan(document, plan)));
    }, 0),
    plans: affected,
  };
}

export function formatTerminologyMigrationReport(plan: TerminologyMigrationPlan, mode: "dry-run" | "write"): string {
  const lines = [
    `Mode: ${mode}`,
    "Sanity writes: " + (mode === "write" ? "requested" : "none"),
    "Publishing: no",
    `Documents scanned: ${plan.documentsScanned}`,
    `Research documents affected: ${plan.researchAffected}`,
    `Update documents affected: ${plan.articlesAffected}`,
    `Published documents affected: ${plan.publishedAffected}`,
    `Draft documents affected: ${plan.draftsAffected}`,
    `Fields that would change: ${plan.fieldsThatWouldChange}`,
    `Old terminology occurrences before: ${plan.outdatedBefore}`,
    `Old terminology occurrences after proposed migration: ${plan.outdatedAfter}`,
    `Reader-facing occurrences after proposed migration: ${plan.outdatedAfter - unchangedOutdatedCount(plan)}`,
    `Occurrences left outside the allowlist: ${unchangedOutdatedCount(plan)}`,
    "",
  ];

  const research = plan.plans.filter((item) => item.type === "research");
  const articles = plan.plans.filter((item) => item.type === "article");
  lines.push(...section("Research", research));
  lines.push(...section("Updates", articles));

  const skipped = plan.plans.flatMap((item) =>
    item.skipped.map((skip) => `${item.id} (${item.publication}) ${skip.field}: ${skip.text}`),
  );
  lines.push("Not patched (outside the allowlist):");
  lines.push(skipped.length === 0 ? "None" : skipped.join("\n"));
  lines.push("");

  const blocked = plan.plans.flatMap((item) => item.blocked);
  lines.push("Blocked changes:");
  if (blocked.length === 0) {
    lines.push("None");
  } else {
    for (const change of blocked) {
      lines.push(`${change.id} ${change.field}: ${change.problems.join(" ")}`);
      lines.push(`Before: ${change.before}`);
      lines.push(`After: ${change.after}`);
    }
  }
  return lines.join("\n");
}

function section(title: string, plans: readonly TerminologyDocumentPlan[]): string[] {
  const lines = [`## ${title}`, ""];
  if (plans.length === 0) {
    lines.push("None", "");
    return lines;
  }
  for (const plan of plans) {
    lines.push(`Document id: ${plan.id}`);
    lines.push(`Document type: ${plan.type}`);
    lines.push(`Status: ${plan.publication}`);
    if (plan.changes.length === 0) {
      lines.push("Proposed field changes: none");
    }
    for (const change of plan.changes) {
      lines.push(`Field: ${change.field}`);
      lines.push(`Before: ${change.before}`);
      lines.push(`After: ${change.after}`);
      lines.push("");
    }
    lines.push("");
  }
  return lines;
}

function planDocument(document: unknown): TerminologyDocumentPlan | null {
  if (!isRecord(document)) return null;
  const id = documentId(document);
  const type = document._type === "article" || document._type === "research" ? document._type : null;
  if (!id || !type || document.language !== "he") return null;

  const state: MutablePlan = { changes: [], blocked: [], patch: {}, skipped: [] };
  const stringFields = type === "research" ? RESEARCH_STRING_FIELDS : ARTICLE_STRING_FIELDS;
  const portableFields = type === "research" ? RESEARCH_PORTABLE_FIELDS : ARTICLE_PORTABLE_FIELDS;

  for (const field of stringFields) {
    considerString(state, document, id, type, field, field);
  }
  if (type === "research" && Array.isArray(document.outcomes)) {
    considerStringArray(state, document.outcomes, id, type, "outcomes");
  }
  for (const field of portableFields) {
    considerPortable(state, document[field], id, type, field);
  }
  considerImageAlt(state, document.mainImage, id, type);
  collectSkipped(state, document, type);

  return {
    id,
    type,
    publication: id.startsWith("drafts.") ? "draft" : "published",
    changes: state.changes,
    blocked: state.blocked,
    patch: state.patch,
    skipped: state.skipped,
  };
}

function considerString(
  state: MutablePlan,
  document: Record<string, unknown>,
  id: string,
  type: TerminologyDocumentType,
  field: string,
  patchField: string,
): void {
  const current = document[field];
  if (typeof current !== "string" || !current.includes("נשנוש")) return;
  const after = migrateHebrewExerciseSnackText(current);
  if (after === current) return;
  recordChange(state, { id, type, publication: id.startsWith("drafts.") ? "draft" : "published", field, patchField, before: current, after });
  if (migrationProblems(after).length === 0) state.patch[patchField] = after;
}

function considerStringArray(
  state: MutablePlan,
  outcomes: unknown[],
  id: string,
  type: TerminologyDocumentType,
  field: string,
): void {
  let acceptedAny = false;
  const next = outcomes.map((item, index) => {
    if (typeof item !== "string") return item;
    const after = migrateHebrewExerciseSnackText(item);
    if (after === item) return item;
    const accepted = migrationProblems(after).length === 0;
    recordChange(state, {
      id,
      type,
      publication: id.startsWith("drafts.") ? "draft" : "published",
      field: `${field}[${index}]`,
      patchField: field,
      before: item,
      after,
    });
    if (!accepted) return item;
    acceptedAny = true;
    return after;
  });
  if (acceptedAny) state.patch[field] = next;
}

function considerPortable(
  state: MutablePlan,
  value: unknown,
  id: string,
  type: TerminologyDocumentType,
  field: string,
): void {
  if (!Array.isArray(value)) return;
  let acceptedAny = false;
  const next = value.map((block, blockIndex) => {
    if (!isRecord(block) || block._type !== "block" || !Array.isArray(block.children)) return block;
    let blockChanged = false;
    const children = block.children.map((child, childIndex) => {
      if (!isRecord(child) || child._type !== "span" || typeof child.text !== "string") return child;
      const after = migrateHebrewExerciseSnackText(child.text);
      if (after === child.text) return child;
      const accepted = migrationProblems(after).length === 0;
      recordChange(state, {
        id,
        type,
        publication: id.startsWith("drafts.") ? "draft" : "published",
        field: `${field}[${blockIndex}].children[${childIndex}].text`,
        patchField: field,
        before: child.text,
        after,
      });
      if (!accepted) return child;
      blockChanged = true;
      acceptedAny = true;
      return { ...child, text: after };
    });
    return blockChanged ? { ...block, children } : block;
  });
  if (acceptedAny) state.patch[field] = next;
}

function considerImageAlt(
  state: MutablePlan,
  image: unknown,
  id: string,
  type: TerminologyDocumentType,
): void {
  if (!isRecord(image) || typeof image.alt !== "string") return;
  const after = migrateHebrewExerciseSnackText(image.alt);
  if (after === image.alt) return;
  recordChange(state, {
    id,
    type,
    publication: id.startsWith("drafts.") ? "draft" : "published",
    field: "mainImage.alt",
    patchField: "mainImage.alt",
    before: image.alt,
    after,
  });
  if (migrationProblems(after).length === 0) state.patch["mainImage.alt"] = after;
}

function recordChange(state: MutablePlan, change: TerminologyChange): void {
  const problems = migrationProblems(change.after);
  if (problems.length > 0) state.blocked.push({ ...change, problems });
  else state.changes.push(change);
}

const RESEARCH_ALLOWLIST = new Set<string>([
  ...RESEARCH_STRING_FIELDS,
  "outcomes",
  ...RESEARCH_PORTABLE_FIELDS,
  "mainImage",
]);

const ARTICLE_ALLOWLIST = new Set<string>([...ARTICLE_STRING_FIELDS, ...ARTICLE_PORTABLE_FIELDS, "mainImage"]);

function collectSkipped(state: MutablePlan, document: Record<string, unknown>, type: TerminologyDocumentType): void {
  const allowlist = type === "research" ? RESEARCH_ALLOWLIST : ARTICLE_ALLOWLIST;
  for (const [key, value] of Object.entries(document)) {
    if (key.startsWith("_") || allowlist.has(key)) continue;
    walkSkipped(state, key, value);
  }
  if (type === "research" && typeof document.title === "string") {
    walkSkipped(state, "title", document.title);
  }
}

function walkSkipped(state: MutablePlan, field: string, value: unknown): void {
  if (typeof value === "string") {
    if (countOutdatedPublicTerminology(value) > 0) state.skipped.push({ field, text: value });
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => walkSkipped(state, `${field}[${index}]`, item));
    return;
  }
  if (!isRecord(value)) return;
  for (const [key, child] of Object.entries(value)) {
    if (key.startsWith("_")) continue;
    walkSkipped(state, `${field}.${key}`, child);
  }
}

function applyPlan(document: unknown, plan: TerminologyDocumentPlan | undefined): unknown {
  if (!isRecord(document) || !plan) return document;
  const next: Record<string, unknown> = { ...document };
  for (const [field, value] of Object.entries(plan.patch)) {
    if (field === "mainImage.alt" && isRecord(next.mainImage)) {
      next.mainImage = { ...next.mainImage, alt: value };
      continue;
    }
    next[field] = value;
  }
  return next;
}

function collectText(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map((item) => collectText(item)).join("\n");
  if (!isRecord(value)) return "";
  return Object.entries(value)
    .filter(([key]) => !key.startsWith("_"))
    .map(([, child]) => collectText(child))
    .join("\n");
}

function documentId(document: unknown): string {
  return isRecord(document) && typeof document._id === "string" ? document._id : "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
