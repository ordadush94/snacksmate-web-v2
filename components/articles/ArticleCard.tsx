import Link from "next/link";
import type { Locale } from "@/content/types";
import {
  articlePath,
  formatArticleDate,
  getArticlesCopy,
  topicLabel,
} from "@/content/articles";
import {
  articleImageAlt,
  articleImageUrl,
  type ArticleListItem,
} from "@/sanity/lib/articles";

type ArticleCardProps = {
  article: ArticleListItem;
  locale: Locale;
};

export function ArticleCard({ article, locale }: ArticleCardProps) {
  const copy = getArticlesCopy(locale);
  const href = articlePath(locale, article.slug);
  const imageUrl = articleImageUrl(article.mainImage, 960, 540);
  const topic = topicLabel(article.topic, locale);

  return (
    <article className="article-card">
      {imageUrl ? (
        <Link href={href} className="article-card-image" tabIndex={-1}>
          <img
            src={imageUrl}
            alt={articleImageAlt(article.mainImage, article.title)}
            width={960}
            height={540}
          />
        </Link>
      ) : null}
      <div className="article-card-body">
        {topic ? <p className="section-kicker">{topic}</p> : null}
        <h2>
          <Link href={href}>{article.title}</Link>
        </h2>
        <p className="article-excerpt">{article.excerpt}</p>
        <p className="article-meta">
          <time dateTime={article.publishedAt}>
            {formatArticleDate(article.publishedAt, locale)}
          </time>
          {article.author ? ` · ${article.author}` : null}
        </p>
        <Link className="article-read-link" href={href}>
          {copy.readArticle}
        </Link>
      </div>
    </article>
  );
}
