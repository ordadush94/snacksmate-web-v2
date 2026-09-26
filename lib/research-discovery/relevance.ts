export type RelevanceDisposition = "auto_draft" | "review_candidate" | "reject";

export type RelevanceLink = {
  refType: string;
  pmid?: string | null;
};

export type RelevanceDecision = {
  disposition: RelevanceDisposition;
  rules: string[];
  reason: string;
  correctedPmids: string[];
};

type RelevanceRule = {
  id: string;
  label: string;
  pattern: RegExp;
};

/**
 * Phrases that are specific to Snacksmate. A title match is high confidence.
 * An abstract-only match stays a review candidate unless the abstract makes
 * the concept the subject of the paper.
 */
const STRONG_RULES: readonly RelevanceRule[] = [
  {
    id: "exercise-snacks",
    label: "exercise snacks / exercise snacking",
    pattern: /\bexercise[\s"'“”‘’-]+snack(?:s|ing)?\b/i,
  },
  {
    id: "activity-snacks",
    label: "activity snacks",
    pattern: /\b(?:physical\s+)?activity[\s-]+snacks?\b/i,
  },
  {
    id: "snacktivity",
    label: "Snacktivity",
    pattern: /\bsnacktivity\b/i,
  },
  {
    id: "vilpa-phrase",
    label: "vigorous intermittent lifestyle physical activity",
    pattern: /\bvigorous\s+intermittent\s+lifestyle\s+physical\s+activity\b/i,
  },
  {
    id: "vilpa",
    label: "VILPA",
    pattern: /\bvilpa\b/i,
  },
];

/**
 * Neighbouring ideas. They can auto-draft only when the abstract also
 * identifies the exposure as VILPA or an exercise snack.
 */
const RELATED_RULES: readonly RelevanceRule[] = [
  {
    id: "brief-bouts-vigorous",
    label: "brief bouts of vigorous physical activity",
    pattern: /\bbrief\s+bouts?\s+of\s+vigorous\s+physical\s+activity\b/i,
  },
  {
    id: "short-bouts-of-exercise",
    label: "short bouts of exercise",
    pattern: /\bshort\s+bouts?\s+of\s+exercise\b/i,
  },
  {
    id: "short-exercise-bouts",
    label: "short exercise bouts",
    pattern: /\bshort\s+exercise\s+bouts?\b/i,
  },
  {
    id: "brief-exercise-bouts",
    label: "brief exercise bouts",
    pattern: /\bbrief\s+exercise\s+bouts?\b/i,
  },
  {
    id: "intermittent-vigorous",
    label: "intermittent vigorous physical activity",
    pattern: /\bintermittent\s+vigorous\s+physical\s+activity\b/i,
  },
  {
    id: "lifestyle-micropatterns",
    label: "lifestyle physical activity micropatterns",
    pattern: /\b(?:intermittent\s+)?lifestyle\s+physical\s+activity\s+micropatterns?\b/i,
  },
];

/**
 * These PubMed publication types are commentary, not study results.
 * They override a core phrase in the title.
 */
const EDITORIAL_PUBLICATION_TYPE =
  /\b(?:editorials?|comments?|commentaries|commentary|letters?|perspectives?|viewpoints?|opinions?|news|newspapers?)\b/i;

const CORRECTION_TITLE =
  /^(?:(?:author|publisher)\s+)?(?:corrections?|errata|erratum|corrigenda|corrigendum)\s*(?::|to\b)|^(?:author|publisher)\s+(?:correction|erratum|corrigendum)\b|^published\s+erratum\b/i;

const COMMENTARY_TITLE =
  /^(?:an?\s+)?(?:commentaries|commentary|perspectives?|opinions?|editorials?|viewpoints?)\b|\bcomments?\s+on\b|\bletters?\s+to\s+the\s+editor\b|\ba\s+discussion\s+of\b/i;

const OBJECTIVE_LABEL = /^(?:objectives?|purposes?|aims?|goals?)$/i;

export function assessRelevance(input: {
  title?: string | null;
  abstract?: string | null;
  abstractSections?: readonly { label?: string; text: string }[] | null;
  publicationTypes?: readonly string[] | null;
  commentCorrections?: readonly RelevanceLink[] | null;
}): RelevanceDecision {
  const title = input.title ?? "";
  const abstract = input.abstract ?? "";
  const publicationTypes = input.publicationTypes ?? [];
  const links = input.commentCorrections ?? [];
  const correctedPmids = erratumPmids(links);

  if (isCorrection(title, publicationTypes, links)) {
    return {
      disposition: "reject",
      rules: [],
      reason: "correction/erratum",
      correctedPmids,
    };
  }

  const topical = classifyTopical(title, abstract, input.abstractSections ?? []);

  if (isProtocol(title, publicationTypes)) {
    return {
      disposition: "review_candidate",
      rules: topical.rules,
      reason: "study protocol",
      correctedPmids: [],
    };
  }

  if (topical.disposition !== "reject" && hasEditorialPublicationType(publicationTypes)) {
    return {
      disposition: "review_candidate",
      rules: topical.rules,
      reason: "Editorial/commentary publication type",
      correctedPmids: [],
    };
  }

  if (topical.disposition !== "reject" && COMMENTARY_TITLE.test(title.trim())) {
    return {
      disposition: "review_candidate",
      rules: topical.rules,
      reason: "commentary/perspective",
      correctedPmids: [],
    };
  }

  return { ...topical, correctedPmids: [] };
}

function classifyTopical(
  title: string,
  abstract: string,
  abstractSections: readonly { label?: string; text: string }[],
): Omit<RelevanceDecision, "correctedPmids"> {
  const titleText = withoutFoodSnackContext(title).trim();
  const abstractText = withoutFoodSnackContext(abstract).trim();
  const sections = abstractSections.map((section) => ({
    label: section.label,
    text: withoutFoodSnackContext(section.text ?? ""),
  }));

  if (!titleText && !abstractText) {
    return {
      disposition: "reject",
      rules: [],
      reason: "title and abstract are empty",
    };
  }

  const titleStrong = matchingRules(titleText, STRONG_RULES);
  const abstractStrong = matchingRules(abstractText, STRONG_RULES);
  const titleRelated = matchingRules(titleText, RELATED_RULES);

  if (titleStrong.length > 0) {
    return {
      disposition: "auto_draft",
      rules: uniqueIds(titleStrong, abstractStrong, titleRelated),
      reason: "core phrase in title",
    };
  }

  if (titleRelated.length > 0 && abstractStrong.length > 0) {
    return {
      disposition: "auto_draft",
      rules: uniqueIds(titleRelated, abstractStrong),
      reason: "related concept identified as VILPA or exercise snacks in the abstract",
    };
  }

  if (titleRelated.length > 0) {
    return {
      disposition: "review_candidate",
      rules: uniqueIds(titleRelated),
      reason: "related concept without VILPA or exercise-snack evidence in the abstract",
    };
  }

  if (abstractStrong.length > 0) {
    if (isClearlyCentral(abstractText, sections)) {
      return {
        disposition: "auto_draft",
        rules: uniqueIds(abstractStrong),
        reason: "core phrase is central in the abstract",
      };
    }
    return {
      disposition: "review_candidate",
      rules: uniqueIds(abstractStrong),
      reason: "core phrase found only in abstract",
    };
  }

  return {
    disposition: "reject",
    rules: [],
    reason: "no core Snacksmate concept in title or abstract",
  };
}

/**
 * Abstract-only matches stay in review unless the paper is about the concept.
 * A labeled aim counts. So does the phrase showing up in more than one sentence.
 * A single sentence that merely lists the concept does not.
 */
function isClearlyCentral(
  abstract: string,
  sections: readonly { label?: string; text: string }[],
): boolean {
  for (const section of sections) {
    const label = section.label?.trim().toLowerCase().replace(/:$/, "") ?? "";
    if (!OBJECTIVE_LABEL.test(label)) continue;
    if (matchingRules(section.text, STRONG_RULES).length > 0) return true;
  }

  const sentences = abstract.split(/(?<=[.!?])\s+/).map((sentence) => sentence.trim());
  const sentencesWithPhrase = sentences.filter(
    (sentence) => matchingRules(sentence, STRONG_RULES).length > 0,
  );
  return sentencesWithPhrase.length >= 2;
}

function isCorrection(
  title: string,
  publicationTypes: readonly string[],
  links: readonly RelevanceLink[],
): boolean {
  if (links.some((link) => isErratumFor(link.refType))) return true;
  if (publicationTypes.some((type) => isCorrectionType(type))) return true;
  return CORRECTION_TITLE.test(title.trim());
}

function isCorrectionType(type: string): boolean {
  const normalized = normalizePublicationType(type);
  return normalized === "published erratum" || normalized === "erratum" || normalized === "correction";
}

function isErratumFor(refType: string): boolean {
  const normalized = refType.replace(/[^a-z]/gi, "").toLowerCase();
  return normalized === "erratumfor" || normalized === "corrigendumfor";
}

function erratumPmids(links: readonly RelevanceLink[]): string[] {
  const pmids: string[] = [];
  for (const link of links) {
    if (!isErratumFor(link.refType)) continue;
    const pmid = link.pmid?.trim();
    if (!pmid || !/^\d+$/.test(pmid) || pmids.includes(pmid)) continue;
    pmids.push(pmid);
  }
  return pmids;
}

function isProtocol(title: string, publicationTypes: readonly string[]): boolean {
  if (publicationTypes.some((type) => /\bprotocols?\b/i.test(type))) return true;
  return /\bprotocols?\b/i.test(title);
}

function hasEditorialPublicationType(publicationTypes: readonly string[]): boolean {
  return publicationTypes.some((type) => EDITORIAL_PUBLICATION_TYPE.test(normalizePublicationType(type)));
}

function normalizePublicationType(type: string): string {
  return type.trim().toLowerCase().replace(/\s+/g, " ");
}

function matchingRules(text: string, rules: readonly RelevanceRule[]): RelevanceRule[] {
  if (!text.trim()) return [];
  return rules.filter((rule) => rule.pattern.test(text));
}

function uniqueIds(...groups: RelevanceRule[][]): string[] {
  const ids: string[] = [];
  for (const group of groups) {
    for (const rule of group) {
      if (!ids.includes(rule.id)) ids.push(rule.id);
    }
  }
  return ids;
}

function withoutFoodSnackContext(value: string): string {
  return value.replace(/\b(?:pre|post)[\s-]*exercise[\s-]+snack(?:s|ing)?\b/gi, " ");
}
