import type { Locale } from "@/content/types";
import { getArticlesCopy } from "@/content/articles";
import type { ArticleListItem } from "@/sanity/lib/articles";
import { ArticleCard } from "./ArticleCard";

type ArticlesIndexProps = {
  locale: Locale;
  articles: ArticleListItem[];
};

export function ArticlesIndex({ locale, articles }: ArticlesIndexProps) {
  const copy = getArticlesCopy(locale);

  return (
    <div className="articles-shell">
      <header className="articles-header">
        <p className="section-kicker">Snacksmate</p>
        <h1>{copy.pageTitle}</h1>
        <p className="section-lead">{copy.pageDescription}</p>
      </header>
      {articles.length === 0 ? (
        <p className="articles-empty">{copy.empty}</p>
      ) : (
        <div className="article-list">
          {articles.map((article) => (
            <ArticleCard key={article._id} article={article} locale={locale} />
          ))}
        </div>
      )}
    </div>
  );
}
