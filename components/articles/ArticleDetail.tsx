import Link from "next/link";
import type { Locale } from "@/content/types";
import {
  articlesPath,
  formatArticleDate,
  getArticlesCopy,
  topicLabel,
} from "@/content/articles";
import {
  articleImageAlt,
  articleImageUrl,
  type Article,
} from "@/sanity/lib/articles";
import { ArticlePortableText } from "./ArticlePortableText";

type ArticleDetailProps = {
  article: Article;
  locale: Locale;
};

export function ArticleDetail({ article, locale }: ArticleDetailProps) {
  const copy = getArticlesCopy(locale);
  const topic = topicLabel(article.topic, locale);
  const imageUrl = articleImageUrl(article.mainImage, 1400);
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
      <div className="article-reading">
        <p className="article-back">
          <Link href={articlesPath(locale)}>{copy.backToArticles}</Link>
        </p>
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
      </div>
    </article>
  );
}
