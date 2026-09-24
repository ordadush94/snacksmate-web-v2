"use client";

import { useMemo, useState } from "react";
import type { Locale } from "@/content/types";
import {
  getResearchCopy,
  researchTopicLabel,
  studyDesignLabel,
} from "@/content/research";
import {
  filterResearchItems,
  uniqueResearchStudyDesigns,
  uniqueResearchTopics,
  uniqueResearchYears,
} from "@/lib/research-filters";
import type { ResearchListItem } from "@/sanity/lib/research";
import { ResearchCard } from "./ResearchCard";

type ResearchLibraryProps = {
  locale: Locale;
  items: ResearchListItem[];
};

export function ResearchLibrary({ locale, items }: ResearchLibraryProps) {
  const copy = getResearchCopy(locale);
  const [query, setQuery] = useState("");
  const [topic, setTopic] = useState("");
  const [studyDesign, setStudyDesign] = useState("");
  const [year, setYear] = useState("");

  const topics = useMemo(() => uniqueResearchTopics(items), [items]);
  const designs = useMemo(() => uniqueResearchStudyDesigns(items), [items]);
  const years = useMemo(() => uniqueResearchYears(items), [items]);

  const filtered = useMemo(
    () => filterResearchItems(items, { query, topic, studyDesign, year }),
    [items, query, topic, studyDesign, year],
  );

  if (items.length === 0) {
    return (
      <p className="articles-empty" role="status">
        {copy.empty}
      </p>
    );
  }

  return (
    <>
      <form
        className="research-filters"
        role="search"
        onSubmit={(event) => event.preventDefault()}
      >
        <label className="research-filter">
          <span>{copy.searchLabel}</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={copy.searchPlaceholder}
          />
        </label>
        <label className="research-filter">
          <span>{copy.topicLabel}</span>
          <select
            value={topic}
            onChange={(event) => setTopic(event.target.value)}
          >
            <option value="">{copy.allTopics}</option>
            {topics.map((value) => (
              <option key={value} value={value}>
                {researchTopicLabel(value, locale)}
              </option>
            ))}
          </select>
        </label>
        <label className="research-filter">
          <span>{copy.studyDesignLabel}</span>
          <select
            value={studyDesign}
            onChange={(event) => setStudyDesign(event.target.value)}
          >
            <option value="">{copy.allStudyDesigns}</option>
            {designs.map((value) => (
              <option key={value} value={value}>
                {studyDesignLabel(value, locale)}
              </option>
            ))}
          </select>
        </label>
        <label className="research-filter">
          <span>{copy.yearLabel}</span>
          <select
            value={year}
            onChange={(event) => setYear(event.target.value)}
          >
            <option value="">{copy.allYears}</option>
            {years.map((value) => (
              <option key={value} value={String(value)}>
                {value}
              </option>
            ))}
          </select>
        </label>
      </form>
      {filtered.length === 0 ? (
        <p className="articles-empty" role="status">
          {copy.noMatches}
        </p>
      ) : (
        <div className="research-list">
          {filtered.map((item) => (
            <ResearchCard key={item._id} item={item} locale={locale} />
          ))}
        </div>
      )}
    </>
  );
}
