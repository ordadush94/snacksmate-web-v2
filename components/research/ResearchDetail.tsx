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
import { stripEditorialLabels } from "@/lib/research-display";
import { absoluteUrl } from "@/lib/site";
import {
  researchImageAlt,
  researchImageUrl,
  type Research,
  type ResearchListItem,
} from "@/sanity/lib/research";
import { ArticlePortableText } from "@/components/articles/ArticlePortableText";
import { JsonLd } from "@/components/articles/JsonLd";
import { PublicationShell } from "@/components/site/PublicationShell";

type RelatedArticleLink = {
  title: string;
  href: string;
};

type ResearchDetailProps = {
  research: Research;
  locale: Locale;
  related: ResearchListItem[];
  relatedArticle?: RelatedArticleLink | null;
  alternateHref?: string;
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

function sameDestination(left?: string, right?: string) {
  if (!left || !right) return false;
  const normalize = (value: string) =>
    value
      .trim()
      .replace(/^https?:\/\//i, "")
      .replace(/^dx\./i, "")
      .replace(/\/+$/, "")
      .toLowerCase();
  return normalize(left) === normalize(right);
}

export function ResearchDetail({
  research,
  locale,
  related,
  relatedArticle = null,
  alternateHref,
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
  const displayTitle = research.seoTitle?.trim() || research.title;
  const journal = textValue(research.journal);
  const population = textValue(research.population);
  const duration = textValue(research.duration);
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
  const overviewRows: { label: string; value: string }[] = [
    { label: copy.studyTitleLabel, value: research.title },
  ];
  if (journal) {
    overviewRows.push({ label: copy.journalLabel, value: journal });
  }
  if (research.year) {
    overviewRows.push({ label: copy.yearLabel, value: String(research.year) });
  }
  if (design) {
    overviewRows.push({ label: copy.studyDesignLabel, value: design });
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
  const limitations = hasPortableText(research.limitations)
    ? stripEditorialLabels(research.limitations)
    : null;
  const hasTakeaway =
    hasPortableText(research.practicalInterpretation) ||
    hasPortableText(research.snacksmateRelevance);
  const metaChips = [
    journal,
    research.year,
    design,
  ].filter(Boolean);

  return (
    <PublicationShell
      locale={locale}
      researchActive
      alternateHref={alternateHref}
    >
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
              <span aria-current="page">{displayTitle}</span>
            </li>
          </ol>
        </nav>
        {topic ? <p className="section-kicker">{topic}</p> : null}
        <h1>{displayTitle}</h1>
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
              <span key={String(chip)} className="chip">
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
          <section className="research-section research-findings">
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
        {limitations && limitations.length > 0 ? (
          <section className="research-section research-limitations">
            <h2>{copy.limitationsHeading}</h2>
            <div className="article-body">
              <ArticlePortableText value={limitations} />
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
        {journal || doiUrl || studyUrl ? (
          <section className="research-original">
            <h2>{copy.originalStudyHeading}</h2>
            {journal ? (
              <p className="research-source-line">
                <span>{copy.journalLabel}</span>
                {journal}
              </p>
            ) : null}
            {doi && doiUrl ? (
              <p>
                <a href={doiUrl} target="_blank" rel="noopener noreferrer">
                  {copy.doiLabel}: {doi}
                </a>
              </p>
            ) : null}
            {studyUrl && !sameDestination(studyUrl, doiUrl) ? (
              <p>
                <a href={studyUrl} target="_blank" rel="noopener noreferrer">
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
        <section className="content-close">
          <h2>{copy.closingHeading}</h2>
          {hasTakeaway ? (
            <p className="content-close-note">{copy.closingNote}</p>
          ) : null}
          <p>
            <Link className="text-link" href={researchPath(locale)}>
              {copy.backToResearch}
            </Link>
          </p>
          {relatedArticle ? (
            <div>
              <p className="section-kicker">{copy.relatedArticleLabel}</p>
              <Link className="text-link" href={relatedArticle.href}>
                {relatedArticle.title}
              </Link>
            </div>
          ) : null}
          <p>
            <a className="text-link" href={`/${locale}/#sm-download`}>
              {copy.appCta}
            </a>
          </p>
        </section>
      </div>
    </article>
    </PublicationShell>
  );
}
