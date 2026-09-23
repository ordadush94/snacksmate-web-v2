import Link from "next/link";
import type { Locale } from "@/content/types";
import {
  articlePath,
  articlesPath,
  formatArticleDate,
  getArticlesCopy,
  topicLabel,
} from "@/content/articles";
import {
  articleCanonicalUrl,
  articleJsonLd,
  breadcrumbJsonLd,
} from "@/lib/article-seo";
import { absoluteUrl } from "@/lib/site";
import {
  articleImageAlt,
  articleImageUrl,
  type Article,
  type ArticleListItem,
} from "@/sanity/lib/articles";
import { ArticlePortableText } from "./ArticlePortableText";
import { JsonLd } from "./JsonLd";

type ArticleDetailProps = {
  article: Article;
  locale: Locale;
  related: ArticleListItem[];
};

export function ArticleDetail({
  article,
  locale,
  related,
}: ArticleDetailProps) {
  const copy = getArticlesCopy(locale);
  const topic = topicLabel(article.topic, locale);
  const imageUrl = articleImageUrl(article.mainImage, 1400);
  const canonicalUrl = articleCanonicalUrl(locale, article);
  const homeUrl = absoluteUrl(`/${locale}/`);
  const articlesUrl = absoluteUrl(articlesPath(locale));
  const description = article.excerpt?.trim() || article.seoDescription?.trim();
  const references = article.references?.filter(
    (reference) =>
      reference.title ||
      reference.source ||
      reference.url ||
      reference.doi ||
      reference.year,
  );

  return (
    <article className="article-page">
      <JsonLd
        data={[
          articleJsonLd({
            locale,
            title: article.title,
            description,
            imageUrl: articleImageUrl(article.mainImage, 1600),
            author: article.author,
            publishedAt: article.publishedAt,
            updatedAt: article.updatedAt,
            canonicalUrl,
          }),
          breadcrumbJsonLd([
            { name: copy.homeLabel, url: homeUrl },
            { name: copy.navLabel, url: articlesUrl },
            { name: article.title, url: canonicalUrl },
          ]),
        ]}
      />
      <div className="article-reading">
        <nav className="article-breadcrumbs" aria-label={copy.breadcrumbLabel}>
          <ol>
            <li>
              <Link href={`/${locale}/`}>{copy.homeLabel}</Link>
            </li>
            <li>
              <span aria-hidden="true" className="article-breadcrumb-sep">
                &gt;
              </span>
              <Link href={articlesPath(locale)}>{copy.navLabel}</Link>
            </li>
            <li>
              <span aria-hidden="true" className="article-breadcrumb-sep">
                &gt;
              </span>
              <span aria-current="page">{article.title}</span>
            </li>
          </ol>
        </nav>
        {topic ? <p className="section-kicker">{topic}</p> : null}
        <h1>{article.title}</h1>
        {article.excerpt ? <p className="lede">{article.excerpt}</p> : null}
        <p className="article-meta">
          {article.author ? `${article.author} · ` : null}
          <span>
            {copy.publishedLabel}{" "}
            <time dateTime={article.publishedAt}>
              {formatArticleDate(article.publishedAt, locale)}
            </time>
          </span>
          {article.updatedAt ? (
            <>
              {" · "}
              <span>
                {copy.updatedLabel}{" "}
                <time dateTime={article.updatedAt}>
                  {formatArticleDate(article.updatedAt, locale)}
                </time>
              </span>
            </>
          ) : null}
        </p>
        {imageUrl ? (
          <figure className="article-hero-image">
            <img
              src={imageUrl}
              alt={articleImageAlt(article.mainImage, article.title)}
              width={1400}
              height={788}
            />
          </figure>
        ) : null}
        {article.body?.length ? (
          <div className="article-body">
            <ArticlePortableText value={article.body} />
          </div>
        ) : null}
        {references && references.length > 0 ? (
          <section className="article-references">
            <h2>{copy.referencesHeading}</h2>
            <ol>
              {references.map((reference) => {
                const doiHref = reference.doi
                  ? `https://doi.org/${reference.doi.replace(/^https?:\/\/(dx\.)?doi\.org\//, "")}`
                  : undefined;
                const href = reference.url || doiHref;
                const label =
                  reference.title ||
                  reference.source ||
                  reference.doi ||
                  href ||
                  copy.referencesHeading;
                const details = [
                  reference.title ? reference.source : undefined,
                  reference.year,
                  reference.doi ? `DOI: ${reference.doi}` : undefined,
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
        {related.length > 0 ? (
          <section className="article-related" aria-labelledby="more-articles">
            <h2 id="more-articles">{copy.relatedHeading}</h2>
            <ul>
              {related.map((item) => {
                const itemTopic = topicLabel(item.topic, locale);
                return (
                  <li key={item._id}>
                    {itemTopic ? (
                      <p className="section-kicker">{itemTopic}</p>
                    ) : null}
                    <Link href={articlePath(locale, item.slug)}>{item.title}</Link>
                    {item.publishedAt ? (
                      <time dateTime={item.publishedAt}>
                        {formatArticleDate(item.publishedAt, locale)}
                      </time>
                    ) : null}
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
