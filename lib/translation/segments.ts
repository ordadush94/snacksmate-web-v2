import type { EnglishDocument, SpanTranslation } from "./types";

export type SourceSpan = {
  id: string;
  field: string;
  text: string;
};

const EDITORIAL_LABEL = /^(?:Design-level limitation|Author-stated limitations):\s*/i;

export function spanId(field: string, blockIndex: number, childIndex: number): string {
  return `${field}.${blockIndex}.children.${childIndex}`;
}

export function readerFacingText(field: string, text: string): string {
  if (field === "limitations") return text.replace(EDITORIAL_LABEL, "");
  return text;
}

export function portableTextSpans(value: unknown, field: string): SourceSpan[] {
  if (!Array.isArray(value)) return [];
  const spans: SourceSpan[] = [];

  value.forEach((block, blockIndex) => {
    if (!isRecord(block) || block._type !== "block" || !Array.isArray(block.children)) return;
    block.children.forEach((child, childIndex) => {
      if (!isSpan(child)) return;
      const text = readerFacingText(field, child.text);
      if (!text.trim()) return;
      spans.push({ id: spanId(field, blockIndex, childIndex), field, text });
    });
  });

  return spans;
}

export function outcomeSpans(outcomes: readonly string[] | null | undefined): SourceSpan[] {
  if (!outcomes) return [];
  return outcomes.flatMap((text, index) => {
    if (typeof text !== "string" || !text.trim()) return [];
    return [{ id: `outcomes.${index}`, field: "outcomes", text }];
  });
}

export function translatePortableText(
  value: unknown,
  field: string,
  translations: ReadonlyMap<string, string>,
): unknown {
  if (!Array.isArray(value)) return undefined;
  return value.map((block, blockIndex) => {
    if (!isRecord(block)) return block;
    if (block._type !== "block" || !Array.isArray(block.children)) return block;
    return {
      ...block,
      children: block.children.map((child, childIndex) => {
        if (!isSpan(child)) return child;
        const next = translations.get(spanId(field, blockIndex, childIndex));
        if (next === undefined) return child;
        return { ...child, text: next };
      }),
    };
  });
}

export function translateOutcomes(
  outcomes: readonly string[] | null | undefined,
  translations: ReadonlyMap<string, string>,
): string[] | undefined {
  if (!outcomes?.length) return undefined;
  return outcomes.map((text, index) => translations.get(`outcomes.${index}`) ?? text);
}

export function researchSourceSpans(source: EnglishDocument): SourceSpan[] {
  if (source._type !== "research") return [];
  return [
    ...portableTextSpans(source.intervention, "intervention"),
    ...portableTextSpans(source.mainFindings, "mainFindings"),
    ...portableTextSpans(source.practicalInterpretation, "practicalInterpretation"),
    ...portableTextSpans(source.limitations, "limitations"),
    ...portableTextSpans(source.snacksmateRelevance, "snacksmateRelevance"),
    ...outcomeSpans(source.outcomes),
  ];
}

export function articleSourceSpans(source: EnglishDocument): SourceSpan[] {
  if (source._type !== "article") return [];
  return portableTextSpans(source.body, "body");
}

export function stringFieldSpans(source: EnglishDocument): SourceSpan[] {
  const fields: Array<[string, string | null | undefined]> =
    source._type === "article"
      ? [
          ["title", source.title],
          ["excerpt", source.excerpt],
          ["seoTitle", source.seoTitle],
          ["seoDescription", source.seoDescription],
        ]
      : [
          ["excerpt", source.excerpt],
          ["seoTitle", source.seoTitle],
          ["seoDescription", source.seoDescription],
          ["population", source.population],
          ["duration", source.duration],
          ["comparator", source.comparator],
        ];

  return fields.flatMap(([field, text]) => {
    if (typeof text !== "string" || !text.trim()) return [];
    return [{ id: field, field, text: text.trim() }];
  });
}

export function translatableSpans(source: EnglishDocument): SourceSpan[] {
  return [
    ...stringFieldSpans(source),
    ...(source._type === "article" ? articleSourceSpans(source) : researchSourceSpans(source)),
  ];
}

export function spanMap(spans: readonly SpanTranslation[]): Map<string, string> {
  return new Map(spans.map((span) => [span.id, span.text]));
}

export function plainText(value: unknown): string {
  if (typeof value === "string") return value;
  if (!Array.isArray(value)) return "";
  return value
    .flatMap((block) => {
      if (!isRecord(block) || !Array.isArray(block.children)) return [];
      return block.children.map((child) => (isSpan(child) ? child.text : ""));
    })
    .join(" ");
}

export function collectUrls(value: unknown): string[] {
  const urls: string[] = [];
  walk(value, urls);
  return urls;
}

function walk(value: unknown, urls: string[]): void {
  if (!value || typeof value !== "object") return;
  if (Array.isArray(value)) {
    for (const item of value) walk(item, urls);
    return;
  }
  for (const [key, item] of Object.entries(value)) {
    if ((key === "href" || key === "url" || key === "studyUrl") && typeof item === "string") {
      urls.push(item);
    } else {
      walk(item, urls);
    }
  }
}

function isSpan(value: unknown): value is { _type: "span"; text: string } {
  return isRecord(value) && value._type === "span" && typeof value.text === "string";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
