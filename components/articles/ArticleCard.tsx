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
import { ContentCard } from "@/components/content/ContentCard";

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
    <ContentCard
      href={href}
      title={article.title}
      linkLabel={copy.readArticle}
      takeaway={article.excerpt}
      kicker={topic}
      image={
        imageUrl
          ? {
              src: imageUrl,
              alt: articleImageAlt(article.mainImage, article.title),
              width: 960,
              height: 540,
            }
          : undefined
      }
      meta={
        <>
          <time dateTime={article.publishedAt}>
            {formatArticleDate(article.publishedAt, locale)}
          </time>
          {article.author ? ` · ${article.author}` : null}
        </>
      }
    />
  );
}
