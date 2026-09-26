import type { PortableTextBlock, PortableTextSpan } from "@portabletext/types";

function cleanSpanText(text: string) {
  return text
    .replace(/Design-level limitation:\s*/gi, "")
    .replace(/Author-stated limitations:\s*/gi, "");
}

function isSpan(child: PortableTextBlock["children"][number]): child is PortableTextSpan {
  return (
    typeof child === "object" &&
    child !== null &&
    "_type" in child &&
    child._type === "span" &&
    "text" in child &&
    typeof child.text === "string"
  );
}

export function stripEditorialLabels(
  blocks: PortableTextBlock[],
): PortableTextBlock[] {
  return blocks.flatMap((block) => {
    if (block._type !== "block" || !Array.isArray(block.children)) return [block];

    const children = block.children.map((child) => {
      if (!isSpan(child)) return child;
      const text = cleanSpanText(child.text);
      if (text === child.text) return child;
      return { ...child, text: text.trimStart() };
    });

    const hasVisibleText = children.some((child) => {
      if (!isSpan(child)) return true;
      return child.text.trim().length > 0;
    });

    if (!hasVisibleText) return [];
    return [{ ...block, children }];
  });
}

export function formatOutcomeList(outcomes: string[]) {
  return outcomes
    .map((outcome) => outcome.trim())
    .filter(Boolean)
    .join(", ");
}
