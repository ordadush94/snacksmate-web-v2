const PUBLICATION_TYPE_PRIORITY = [
  ["randomized controlled trial", "randomized-controlled-trial"],
  ["controlled clinical trial", "controlled-trial"],
  ["meta-analysis", "meta-analysis"],
  ["systematic review", "systematic-review"],
  ["observational study", "observational-study"],
] as const;

export type StudyDesign =
  | (typeof PUBLICATION_TYPE_PRIORITY)[number][1]
  | "crossover-study";

export function inferStudyDesignFromTitle(title: string): StudyDesign | undefined {
  if (/\bcross-?over(?:\s+(?:study|trial))?\b/i.test(title)) return "crossover-study";
  if (/\brandomi[sz]ed\s+controlled\s+trials?\b/i.test(title)) {
    return "randomized-controlled-trial";
  }
  if (/\bmeta-analysis\b/i.test(title)) return "meta-analysis";
  if (/\bsystematic\s+reviews?\b/i.test(title)) return "systematic-review";
  return undefined;
}

const SAMPLE_SIZE_LABEL = /^(participants?|subjects?|patients?|methods?|sample)$/i;
const SAMPLE_SIZE_PATTERN = /\b(?:n\s*=\s*|sample size of\s+)(\d{1,6})\b/gi;

export function inferStudyDesign(
  publicationTypes: readonly string[],
): StudyDesign | undefined {
  const normalized = new Set(
    publicationTypes.map((type) => type.trim().toLowerCase()).filter(Boolean),
  );

  for (const [publicationType, design] of PUBLICATION_TYPE_PRIORITY) {
    if (normalized.has(publicationType)) return design;
  }

  return undefined;
}

/**
 * Stores only a single unambiguous integer from a structured methods or
 * participants label. Abstract sentences are not copied.
 */
export function extractSampleSize(
  sections: readonly { label?: string; text: string }[],
): number | undefined {
  const numbers = new Set<number>();

  for (const section of sections) {
    if (!section.label || !SAMPLE_SIZE_LABEL.test(section.label.trim())) continue;
    for (const match of section.text.matchAll(SAMPLE_SIZE_PATTERN)) {
      const value = Number(match[1]);
      if (value >= 1 && value <= 1_000_000) numbers.add(value);
    }
  }

  if (numbers.size !== 1) return undefined;
  return [...numbers][0];
}

const MONTHS: Record<string, string> = {
  jan: "01",
  january: "01",
  feb: "02",
  february: "02",
  mar: "03",
  march: "03",
  apr: "04",
  april: "04",
  may: "05",
  jun: "06",
  june: "06",
  jul: "07",
  july: "07",
  aug: "08",
  august: "08",
  sep: "09",
  sept: "09",
  september: "09",
  oct: "10",
  october: "10",
  nov: "11",
  november: "11",
  dec: "12",
  december: "12",
};

export function publicationDate(parts: {
  year?: string | number | null;
  month?: string | number | null;
  day?: string | number | null;
}): string | undefined {
  const year = numericPart(parts.year);
  const month = monthPart(parts.month);
  const day = numericPart(parts.day);

  if (!year || year < 1900 || year > 2100 || !month || !day) return undefined;
  if (month < 1 || month > 12 || day < 1 || day > 31) return undefined;

  const iso = `${year.toString().padStart(4, "0")}-${month.toString().padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
  const parsed = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return undefined;
  if (parsed.getUTCDate() !== day) return undefined;
  return iso;
}

export function publicationYear(parts: {
  year?: string | number | null;
  medlineDate?: string | null;
}): number | undefined {
  const direct = numericPart(parts.year);
  if (direct && direct >= 1900 && direct <= 2100) return direct;

  const match = parts.medlineDate?.match(/\b(19|20)\d{2}\b/);
  if (!match) return undefined;
  const year = Number(match[0]);
  if (year < 1900 || year > 2100) return undefined;
  return year;
}

function numericPart(value: string | number | null | undefined): number | undefined {
  if (typeof value === "number" && Number.isInteger(value)) return value;
  if (typeof value !== "string") return undefined;
  const match = value.trim().match(/^(\d{1,4})$/);
  if (!match) return undefined;
  return Number(match[1]);
}

function monthPart(value: string | number | null | undefined): number | undefined {
  if (typeof value === "number" && Number.isInteger(value)) return value;
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim().toLowerCase();
  if (/^\d{1,2}$/.test(trimmed)) return Number(trimmed);
  const mapped = MONTHS[trimmed];
  return mapped ? Number(mapped) : undefined;
}
