import { Fragment } from "react";
import { isLatinParenthetical, splitLatinParentheticals } from "@/lib/bidi";

export function LatinParentheticals({ text }: { text: string }) {
  const parts = splitLatinParentheticals(text);
  if (parts.length === 1) return text;

  return parts.map((part, index) =>
    isLatinParenthetical(part) ? (
      <bdi className="latin-parenthetical" dir="ltr" key={index}>
        {part}
      </bdi>
    ) : (
      <Fragment key={index}>{part}</Fragment>
    ),
  );
}
