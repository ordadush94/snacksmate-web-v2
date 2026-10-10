const LATIN_PARENTHETICAL = /(\([^()\n]*[A-Za-z][^()\n]*\))/;

export function isLatinParenthetical(part: string): boolean {
  return /^\([^()\n]*[A-Za-z][^()\n]*\)$/.test(part);
}

/** Split out Latin parentheticals so they can be isolated from surrounding Hebrew. */
export function splitLatinParentheticals(text: string): string[] {
  return text.split(new RegExp(LATIN_PARENTHETICAL.source, "g"));
}
