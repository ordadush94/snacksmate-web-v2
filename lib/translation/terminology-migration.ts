/**
 * Field-level planner for the Hebrew exercise-snack terminology migration.
 * It proposes patches. It does not talk to Sanity and it does not publish.
 */

import {
  CONTEXTUAL_REPLACEMENTS,
  classifyBareSnacks,
  contextualRulesUsed,
  countBareProductUnitSnacks,
  countOutdatedPublicTerminology,
  migrateHebrewExerciseSnackText,
  migrationProblems,
  type ContextualReplacement,
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
  publishedScanned: number;
  draftsScanned: number;
  researchAffected: number;
  articlesAffected: number;
  publishedAffected: number;
  draftsAffected: number;
  fieldsThatWouldChange: number;
  outdatedBefore: number;
  outdatedAfter: number;
  /** Exact נשנוש כושר forms in reader-facing fields, before the proposed patch. */
  readerFacingExactBefore: number;
  /** Exact נשנוש כושר forms in reader-facing fields after the proposed patch. */
  readerFacingExactAfter: number;
  /** Bare נשנוש that names the Snacksmate activity unit, reader-facing, before. */
  bareProductUnitBefore: number;
  /** Bare product-unit נשנוש in reader-facing fields after the proposed patch. */
  bareProductUnitAfter: number;
  /** Reader-facing strings that still contain נשנוש after the proposed patch. */
  readerFacingRemainder: string[];
  plans: TerminologyDocumentPlan[];
};

/** Source-file phrases already rewritten in this pass. Printed with the dry-run. */
export const STATIC_CONTEXTUAL_REWRITES: readonly { file: string; field: string; from: string }[] = [
  { file: "content/he.ts", field: "concept.highlight", from: "נשנושים קטנים. השפעה גדולה." },
  { file: "content/he.ts", field: "howItWorks.steps[0].title", from: "בוחרים נשנוש" },
  { file: "content/he.ts", field: "howItWorks.steps[2].body", from: "כל נשנוש נספר" },
  { file: "content/he.ts", field: "benefits.lead", from: "נשנוש קטן נותן בוסט גדול" },
  { file: "content/he.ts", field: "benefits.items[1].body", from: "כל נשנוש שהושלם" },
  { file: "content/he.ts", field: "download.heading", from: "הנשנוש הראשון שלכם מחכה." },
  { file: "content/he.ts", field: "download.lead", from: "בחרו נשנוש של כמה דקות" },
  { file: "content/he.ts", field: "footer.copyright", from: "נשנושים קטנים. השפעה גדולה." },
  { file: "legacy-site/index (1).html", field: "concept highlight", from: "נשנושים קטנים. השפעה גדולה." },
  { file: "legacy-site/index (1).html", field: "how it works step title", from: "בוחרים נשנוש" },
  { file: "legacy-site/index (1).html", field: "how it works habit step", from: "כל נשנוש נספר" },
  { file: "legacy-site/index (1).html", field: "benefits lead", from: "נשנוש קטן נותן בוסט גדול" },
  { file: "legacy-site/index (1).html", field: "benefits completed item", from: "כל נשנוש שהושלם" },
  { file: "legacy-site/index (1).html", field: "download heading", from: "הנשנוש הראשון שלכם מחכה." },
  { file: "legacy-site/index (1).html", field: "download lead", from: "בחרו נשנוש של כמה דקות" },
  { file: "legacy-site/index (1).html", field: "footer", from: "נשנושים קטנים. השפעה גדולה." },
  { file: "scripts/update-drafts.ts", field: "hebrewBodies.release session menu", from: "נשנוש קצר לכל הגוף, נשנוש כוח או נשנוש אינטרוולים קצר" },
  { file: "scripts/update-drafts.ts", field: "hebrewBodies.release shown session", from: "הנשנוש שמופיע" },
  { file: "scripts/update-drafts.ts", field: "hebrewBodies.release weekly goal", from: "יעד שבועי של נשנושים" },
  { file: "scripts/update-drafts.ts", field: "hebrewBodies.release snacks earned", from: "והנשנושים שצברתם" },
  { file: "scripts/update-drafts.ts", field: "hebrewBodies.release weekly count", from: "סופר נשנושים" },
  { file: "scripts/update-drafts.ts", field: "hebrewBodies.custom movements", from: "אילו תנועות נכנסות לנשנוש" },
  { file: "scripts/update-drafts.ts", field: "hebrewBodies.custom adapts", from: "הנשנוש צריך לזוז יחד איתם" },
  { file: "scripts/update-drafts.ts", field: "hebrewBodies.custom build", from: "בונים נשנוש משלכם" },
  { file: "scripts/update-drafts.ts", field: "hebrewBodies.preferences keep session", from: "בלי לוותר על הנשנוש" },
  { file: "scripts/update-drafts.ts", field: "preferences seoDescription", from: "בלי לוותר על הנשנוש" },
  { file: "scripts/update-drafts.ts", field: "hebrewBodies.effort when it ends", from: "כשהנשנוש נגמר" },
  { file: "scripts/update-drafts.ts", field: "hebrewBodies.effort very easy", from: "שהנשנוש בקושי עלה" },
  { file: "scripts/update-drafts.ts", field: "hebrewBodies.effort the session", from: "הנשנוש היה המפגש" },
  { file: "scripts/update-drafts.ts", field: "hebrewBodies.effort worth it", from: "אם הנשנוש היה שווה" },
];

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
    publishedScanned: plans.filter((plan) => plan.publication === "published").length,
    draftsScanned: plans.filter((plan) => plan.publication === "draft").length,
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
    ...readerFacingCounts(documents, plans),
    plans: affected,
  };
}

export function formatTerminologyMigrationReport(plan: TerminologyMigrationPlan, mode: "dry-run" | "write"): string {
  const blockedCount = plan.plans.reduce((sum, item) => sum + item.blocked.length, 0);
  const lines = [
    `Mode: ${mode}`,
    "Publishing: no",
    `Published documents scanned: ${plan.publishedScanned}`,
    `Draft documents scanned: ${plan.draftsScanned}`,
    `Published documents affected: ${plan.publishedAffected}`,
    `Draft documents affected: ${plan.draftsAffected}`,
    `Fields affected: ${plan.fieldsThatWouldChange}`,
    `Reader-facing old terminology before: ${plan.readerFacingExactBefore}`,
    `Reader-facing old terminology after: ${plan.readerFacingExactAfter}`,
    `Bare product-unit נשנוש before: ${plan.bareProductUnitBefore}`,
    `Bare product-unit נשנוש after: ${plan.bareProductUnitAfter}`,
    `Internal-only old terminology remaining: ${unchangedOutdatedCount(plan)}`,
    `Blocked: ${blockedCount}`,
    "Sanity writes: " + (mode === "write" ? "requested" : "0"),
    "Published by script: 0",
    `Research documents affected: ${plan.researchAffected}`,
    `Update documents affected: ${plan.articlesAffected}`,
    "",
    ...contextualSection(plan),
  ];

  const research = plan.plans.filter((item) => item.type === "research");
  const articles = plan.plans.filter((item) => item.type === "article");
  lines.push(...section("Research", research));
  lines.push(...section("Updates", articles));

  const skipped = plan.plans.flatMap((item) =>
    item.skipped.map((skip) => `${item.id} (${item.publication}) ${skip.field}: ${skip.text}`),
  );
  lines.push("Reader-facing נשנוש remaining after proposed migration:");
  lines.push(plan.readerFacingRemainder.length === 0 ? "None" : plan.readerFacingRemainder.join("\n"));
  lines.push("");
  lines.push("Not patched (outside the allowlist, including internal review notes):");
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

/**
 * Drafts returned by an authenticated raw read. The unauthenticated published
 * query never includes them. Hidden published ids are the ones the public
 * drafts perspective omitted, which is how an overlay shows up without a token.
 */
export function formatDraftDiscoveryReport(
  documents: readonly unknown[],
  plan: TerminologyMigrationPlan,
  hiddenPublishedIds: readonly string[],
): string {
  const lines = ["Draft overlays not visible in the unauthenticated scan:", ""];
  const byId = new Map(plan.plans.map((item) => [item.id, item]));
  const draftIds = documents.map((document) => documentId(document)).filter((id) => id.startsWith("drafts."));
  if (hiddenPublishedIds.length === 0 && draftIds.length === 0) {
    lines.push("None");
    return lines.join("\n");
  }
  const seen = new Set<string>();
  for (const id of hiddenPublishedIds) {
    const draftId = id.startsWith("drafts.") ? id : `drafts.${id}`;
    seen.add(draftId);
    lines.push(...draftChangeBlock(draftId, byId.get(draftId), true));
  }
  for (const id of draftIds) {
    if (seen.has(id)) continue;
    seen.add(id);
    lines.push(...draftChangeBlock(id, byId.get(id), false));
  }
  return lines.join("\n");
}

function draftChangeBlock(
  id: string,
  item: TerminologyDocumentPlan | undefined,
  hiddenOverlay: boolean,
): string[] {
  const lines = [
    `Document id: ${id}`,
    hiddenOverlay
      ? "Visibility: hidden from the unauthenticated drafts perspective"
      : "Visibility: returned only by the authenticated read",
  ];
  const changes = item?.changes ?? [];
  if (changes.length === 0) {
    lines.push("Proposed field changes: none", "");
    return lines;
  }
  for (const change of changes) {
    lines.push(`Field: ${change.field}`);
    lines.push(`Before: ${change.before}`);
    lines.push(`After: ${change.after}`);
    lines.push("");
  }
  return lines;
}

function contextualSection(plan: TerminologyMigrationPlan): string[] {
  const lines = ["## Contextual rewrites in this pass", ""];
  lines.push("Source files already updated. These are not Sanity writes.");
  lines.push("");
  for (const item of STATIC_CONTEXTUAL_REWRITES) {
    const rule = contextualRule(item.from);
    lines.push(`File: ${item.file}`);
    lines.push(`Field: ${item.field}`);
    lines.push(`Before: ${rule.from}`);
    lines.push(`After: ${rule.to}`);
    lines.push(`Reason: ${rule.reason}`);
    lines.push("");
  }
  lines.push("Sanity documents. Proposed only. Nothing is written in a dry-run.");
  lines.push("");
  const changes = plan.plans.flatMap((item) =>
    [...item.changes, ...item.blocked].flatMap((change) => {
      const rules = contextualRulesUsed(change.before);
      return rules.length > 0 ? [{ change, rules }] : [];
    }),
  );
  if (changes.length === 0) {
    lines.push("None");
    lines.push("");
    return lines;
  }
  for (const { change, rules } of changes) {
    lines.push(`Document: ${change.id}`);
    lines.push(`Field: ${change.field}`);
    lines.push(`Before: ${change.before}`);
    lines.push(`After: ${change.after}`);
    for (const rule of rules) lines.push(`Reason: ${rule.reason}`);
    lines.push("");
  }
  return lines;
}

function contextualRule(from: string): ContextualReplacement {
  const rule = CONTEXTUAL_REPLACEMENTS.find((item) => item.from === from);
  if (!rule) throw new Error(`Missing contextual rule for: ${from}`);
  return rule;
}

function readerFacingCounts(
  documents: readonly unknown[],
  plans: readonly TerminologyDocumentPlan[],
): Pick<
  TerminologyMigrationPlan,
  "readerFacingExactBefore" | "readerFacingExactAfter" | "bareProductUnitBefore" | "bareProductUnitAfter" | "readerFacingRemainder"
> {
  let readerFacingExactBefore = 0;
  let readerFacingExactAfter = 0;
  let bareProductUnitBefore = 0;
  let bareProductUnitAfter = 0;
  const readerFacingRemainder: string[] = [];
  for (const document of documents) {
    const id = documentId(document);
    const plan = plans.find((item) => item.id === id);
    for (const part of readerFacingParts(document)) {
      readerFacingExactBefore += countOutdatedPublicTerminology(part.text);
      bareProductUnitBefore += countBareProductUnitSnacks(part.text);
    }
    for (const part of readerFacingParts(applyPlan(document, plan))) {
      readerFacingExactAfter += countOutdatedPublicTerminology(part.text);
      bareProductUnitAfter += countBareProductUnitSnacks(part.text);
      if (part.text.includes("נשנוש")) {
        readerFacingRemainder.push(`${id} ${part.field} (${remainderReason(part.text)}): ${part.text}`);
      }
    }
  }
  return {
    readerFacingExactBefore,
    readerFacingExactAfter,
    bareProductUnitBefore,
    bareProductUnitAfter,
    readerFacingRemainder,
  };
}

function remainderReason(text: string): string {
  const found = classifyBareSnacks(text);
  const reasons: string[] = [];
  if (countOutdatedPublicTerminology(text) > 0) reasons.push("exact outdated term still present");
  if (found.some((item) => item.kind === "product")) reasons.push("bare product-unit");
  if (found.some((item) => item.kind === "food")) reasons.push("food meaning, left unchanged");
  if (found.some((item) => item.kind === "tai-chi")) reasons.push("tai chi arm, left unchanged");
  if (reasons.length === 0) reasons.push("unclassified נשנוש");
  return reasons.join("; ");
}

function readerFacingParts(document: unknown): Array<{ field: string; text: string }> {
  if (!isRecord(document)) return [];
  const type = document._type === "article" || document._type === "research" ? document._type : null;
  if (!type || document.language !== "he") return [];
  const parts: Array<{ field: string; text: string }> = [];
  const stringFields = type === "research" ? RESEARCH_STRING_FIELDS : ARTICLE_STRING_FIELDS;
  for (const field of stringFields) {
    const value = document[field];
    if (typeof value === "string") parts.push({ field, text: value });
  }
  if (type === "research" && Array.isArray(document.outcomes)) {
    document.outcomes.forEach((item, index) => {
      if (typeof item === "string") parts.push({ field: `outcomes[${index}]`, text: item });
    });
  }
  const portableFields = type === "research" ? RESEARCH_PORTABLE_FIELDS : ARTICLE_PORTABLE_FIELDS;
  for (const field of portableFields) {
    const value = document[field];
    if (!Array.isArray(value)) continue;
    value.forEach((block, blockIndex) => {
      if (!isRecord(block) || !Array.isArray(block.children)) return;
      block.children.forEach((child, childIndex) => {
        if (isRecord(child) && typeof child.text === "string") {
          parts.push({
            field: `${field}[${blockIndex}].children[${childIndex}].text`,
            text: child.text,
          });
        }
      });
    });
  }
  if (isRecord(document.mainImage) && typeof document.mainImage.alt === "string") {
    parts.push({ field: "mainImage.alt", text: document.mainImage.alt });
  }
  return parts;
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
    if (value.includes("נשנוש")) state.skipped.push({ field, text: value });
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
