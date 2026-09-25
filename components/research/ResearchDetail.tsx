import Link from "next/link";
import type { PortableTextBlock } from "@portabletext/types";
import type { Locale } from "@/content/types";
import { formatArticleDate } from "@/content/articles";
import {
  getResearchCopy,
  researchItemPath,
  researchPath,
  researchTopicLabel,
  studyDesignLabel,
} from "@/content/research";
import { breadcrumbJsonLd } from "@/lib/article-seo";
import {
  doiHref,
  researchCanonicalUrl,
  researchPageJsonLd,
  scholarlyArticleJsonLd,
} from "@/lib/research-seo";
import { absoluteUrl } from "@/lib/site";
import {
  researchImageAlt,
  researchImageUrl,
  type Research,
  type ResearchListItem,
} from "@/sanity/lib/research";
import { ArticlePortableText } from "@/components/articles/ArticlePortableText";
import { JsonLd } from "@/components/articles/JsonLd";

type ResearchDetailProps = {
  research: Research;
  locale: Locale;
  related: ResearchListItem[];
};

function hasPortableText(
  value?: PortableTextBlock[] | null,
): value is PortableTextBlock[] {
  return Array.isArray(value) && value.length > 0;
}

function textValue(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed || undefined;
}

export function ResearchDetail({
  research,
  locale,
  related,
}: ResearchDetailProps) {
  const copy = getResearchCopy(locale);
  const topic = researchTopicLabel(research.topic, locale);
  const design = studyDesignLabel(research.studyDesign, locale);
  const imageUrl = researchImageUrl(research.mainImage, 1400);
  const canonicalUrl = researchCanonicalUrl(locale, research);
  const homeUrl = absoluteUrl(`/${locale}/`);
  const researchUrl = absoluteUrl(researchPath(locale));
  const description =
    research.excerpt?.trim() || research.seoDescription?.trim();
  const authors = research.studyAuthors?.map((name) => name.trim()).filter(Boolean);
  const outcomes = research.outcomes?.map((item) => item.trim()).filter(Boolean);
  const journal = textValue(research.journal);
  const population = textValue(research.population);
  const duration = textValue(research.duration);
  const comparator = textValue(research.comparator);
  const doi = textValue(research.doi);
  const studyUrl = textValue(research.studyUrl);
  const doiUrl = doiHref(doi);
  const references = research.references?.filter(
    (reference) =>
      reference.title ||
      reference.source ||
      reference.url ||
      reference.doi ||
      reference.year,
  );
  const overviewRows: { label: string; value: string }[] = [];
  if (authors?.length) {
    overviewRows.push({ label: copy.studyAuthorsLabel, value: authors.join(", ") });
  }
  if (population) {
    overviewRows.push({ label: copy.populationLabel, value: population });
  }
  if (typeof research.sampleSize === "number") {
    overviewRows.push({
      label: copy.sampleSizeLabel,
      value: String(research.sampleSize),
    });
  }
  if (duration) {
    overviewRows.push({ label: copy.durationLabel, value: duration });
  }
  if (comparator) {
    overviewRows.push({ label: copy.comparatorLabel, value: comparator });
  }
  if (outcomes?.length) {
    overviewRows.push({ label: copy.outcomesLabel, value: outcomes.join(" · ") });
  }
  const metaChips = [
    journal,
    research.year,
    design,
  ].filter(Boolean);

  return (
    <article className="research-page">
      <JsonLd
        data={[
          researchPageJsonLd({
            locale,
            title: research.title,
            description,
            imageUrl: researchImageUrl(research.mainImage, 1600),
            summaryAuthor: research.summaryAuthor,
            publishedAt: research.publishedAt,
            updatedAt: research.updatedAt,
            canonicalUrl,
            scholarlyArticle: scholarlyArticleJsonLd({
              title: research.title,
              studyAuthors: research.studyAuthors,
              journal: research.journal,
              year: research.year,
              studyPublishedAt: research.studyPublishedAt,
              doi: research.doi,
              studyUrl: research.studyUrl,
            }),
          }),
          breadcrumbJsonLd([
            { name: copy.homeLabel, url: homeUrl },
            { name: copy.navLabel, url: researchUrl },
            { name: research.title, url: canonicalUrl },
          ]),
        ]}
      />
      <div className="research-reading">
        <nav className="article-breadcrumbs" aria-label={copy.breadcrumbLabel}>
          <ol>
            <li>
              <Link href={`/${locale}/`}>{copy.homeLabel}</Link>
            </li>
            <li>
              <span aria-hidden="true" className="article-breadcrumb-sep">
                &gt;
              </span>
              <Link href={researchPath(locale)}>{copy.navLabel}</Link>
            </li>
            <li>
              <span aria-hidden="true" className="article-breadcrumb-sep">
                &gt;
              </span>
              <span aria-current="page">{research.title}</span>
            </li>
          </ol>
        </nav>
        {topic ? <p className="section-kicker">{topic}</p> : null}
        <h1>{research.title}</h1>
        {research.excerpt ? <p className="lede">{research.excerpt}</p> : null}
        <p className="article-meta">
          {research.summaryAuthor ? `${copy.summaryByLabel} ${research.summaryAuthor} · ` : null}
          <span>
            {copy.publishedLabel}{" "}
            <time dateTime={research.publishedAt}>
              {formatArticleDate(research.publishedAt, locale)}
            </time>
          </span>
          {research.updatedAt ? (
            <>
              {" · "}
              <span>
                {copy.updatedLabel}{" "}
                <time dateTime={research.updatedAt}>
                  {formatArticleDate(research.updatedAt, locale)}
                </time>
              </span>
            </>
          ) : null}
        </p>
        {metaChips.length > 0 ? (
          <p className="research-meta-row">
            {metaChips.map((chip) => (
              <span key={String(chip)} className="research-chip">
                {chip}
              </span>
            ))}
          </p>
        ) : null}
        {imageUrl ? (
          <figure className="article-hero-image">
            <img
              src={imageUrl}
              alt={researchImageAlt(research.mainImage, research.title)}
              width={1400}
              height={788}
            />
          </figure>
        ) : null}
        {overviewRows.length > 0 ? (
          <section className="research-overview" aria-labelledby="study-overview">
            <h2 id="study-overview">{copy.studyOverviewHeading}</h2>
            <dl>
              {overviewRows.map((row) => (
                <div key={row.label} className="research-overview-row">
                  <dt>{row.label}</dt>
                  <dd>{row.value}</dd>
                </div>
              ))}
            </dl>
          </section>
        ) : null}
        {hasPortableText(research.intervention) ? (
          <section className="research-section">
            <h2>{copy.interventionHeading}</h2>
            <div className="article-body">
              <ArticlePortableText value={research.intervention} />
            </div>
          </section>
        ) : null}
        {hasPortableText(research.mainFindings) ? (
          <section className="research-section">
            <h2>{copy.mainFindingsHeading}</h2>
            <div className="article-body">
              <ArticlePortableText value={research.mainFindings} />
            </div>
          </section>
        ) : null}
        {hasPortableText(research.practicalInterpretation) ? (
          <section
            className="research-section research-interpretation"
            aria-labelledby="research-interpretation"
          >
            <h2 id="research-interpretation">{copy.interpretationHeading}</h2>
            <p className="research-interpretation-note">{copy.interpretationNote}</p>
            <div className="article-body">
              <ArticlePortableText value={research.practicalInterpretation} />
            </div>
          </section>
        ) : null}
        {hasPortableText(research.limitations) ? (
          <section className="research-section">
            <h2>{copy.limitationsHeading}</h2>
            <div className="article-body">
              <ArticlePortableText value={research.limitations} />
            </div>
          </section>
        ) : null}
        {hasPortableText(research.snacksmateRelevance) ? (
          <section className="research-section">
            <h2>{copy.snacksmateRelevanceHeading}</h2>
            <div className="article-body">
              <ArticlePortableText value={research.snacksmateRelevance} />
            </div>
          </section>
        ) : null}
        {references && references.length > 0 ? (
          <section className="article-references">
            <h2>{copy.referencesHeading}</h2>
            <ol>
              {references.map((reference) => {
                const referenceDoi = doiHref(reference.doi);
                const href = reference.url || referenceDoi;
                const label =
                  reference.title ||
                  reference.source ||
                  reference.doi ||
                  href ||
                  copy.referencesHeading;
                const details = [
                  reference.title ? reference.source : undefined,
                  reference.year,
                  reference.doi ? `${copy.doiLabel}: ${reference.doi}` : undefined,
                ]
                  .filter(Boolean)
                  .join(" · ");

                return (
                  <li key={reference._key}>
                    {href ? (
                      <a href={href} target="_blank" rel="noopener noreferrer">
                        {label}
                      </a>
                    ) : (
                      label
                    )}
                    {details ? <span>{details}</span> : null}
                  </li>
                );
              })}
            </ol>
          </section>
        ) : null}
        {doiUrl || studyUrl ? (
          <section className="research-original">
            <h2>{copy.originalStudyHeading}</h2>
            {doi && doiUrl ? (
              <p>
                <a href={doiUrl} target="_blank" rel="noopener noreferrer">
                  {copy.doiLabel}: {doi}
                </a>
              </p>
            ) : null}
            {studyUrl ? (
              <p>
                <a
                  className="btn btn-ghost research-original-link"
                  href={studyUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {copy.viewOriginalStudy}
                </a>
              </p>
            ) : null}
          </section>
        ) : null}
        {related.length > 0 ? (
          <section className="article-related" aria-labelledby="related-research">
            <h2 id="related-research">{copy.relatedHeading}</h2>
            <ul>
              {related.map((item) => {
                const itemTopic = researchTopicLabel(item.topic, locale);
                const itemDesign = studyDesignLabel(item.studyDesign, locale);
                const itemMeta = [item.journal?.trim(), item.year, itemDesign]
                  .filter(Boolean)
                  .join(" · ");
                return (
                  <li key={item._id}>
                    {itemTopic ? (
                      <p className="section-kicker">{itemTopic}</p>
                    ) : null}
                    <Link href={researchItemPath(locale, item.slug)}>
                      {item.title}
                    </Link>
                    {itemMeta ? <span>{itemMeta}</span> : null}
                  </li>
                );
              })}
            </ul>
          </section>
        ) : null}
      </div>
    </article>
  );
}
