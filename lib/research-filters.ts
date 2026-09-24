export type ResearchFilterable = {
  title?: string;
  excerpt?: string;
  journal?: string;
  topic?: string;
  studyDesign?: string;
  year?: number;
};

export type ResearchFiltersState = {
  query: string;
  topic: string;
  studyDesign: string;
  year: string;
};

export function filterResearchItems<T extends ResearchFilterable>(
  items: T[],
  filters: ResearchFiltersState,
): T[] {
  const query = filters.query.trim().toLowerCase();

  return items.filter((item) => {
    if (filters.topic && item.topic !== filters.topic) return false;
    if (filters.studyDesign && item.studyDesign !== filters.studyDesign) {
      return false;
    }
    if (filters.year && String(item.year ?? "") !== filters.year) return false;
    if (!query) return true;

    const haystack = [item.title, item.excerpt, item.journal]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return haystack.includes(query);
  });
}

export function uniqueResearchTopics(items: ResearchFilterable[]) {
  return [
    ...new Set(
      items
        .map((item) => item.topic)
        .filter((value): value is string => Boolean(value)),
    ),
  ].sort();
}

export function uniqueResearchStudyDesigns(items: ResearchFilterable[]) {
  return [
    ...new Set(
      items
        .map((item) => item.studyDesign)
        .filter((value): value is string => Boolean(value)),
    ),
  ].sort();
}

export function uniqueResearchYears(items: ResearchFilterable[]) {
  return [
    ...new Set(
      items
        .map((item) => item.year)
        .filter((year): year is number => typeof year === "number"),
    ),
  ].sort((a, b) => b - a);
}
