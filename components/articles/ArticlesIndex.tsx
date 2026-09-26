import Link from "next/link";
import type { Locale } from "@/content/types";
import { getArticlesCopy } from "@/content/articles";
import { researchPath } from "@/content/research";
import type { ArticleListItem } from "@/sanity/lib/articles";
import { PublicationShell } from "@/components/site/PublicationShell";
import { ArticleCard } from "./ArticleCard";

type ArticlesIndexProps = {
  locale: Locale;
  articles: ArticleListItem[];
};

export function ArticlesIndex({ locale, articles }: ArticlesIndexProps) {
  const copy = getArticlesCopy(locale);

  return (
    <PublicationShell locale={locale} articlesActive>
      <div className="articles-shell">
        <header className="articles-header">
          <p className="section-kicker">{copy.navLabel}</p>
          <h1>{copy.pageTitle}</h1>
          <p className="section-lead">{copy.pageDescription}</p>
        </header>
        {articles.length === 0 ? (
          <div className="content-empty" role="status">
            <p>{copy.empty}</p>
            <Link className="text-link" href={researchPath(locale)}>
              {copy.emptyAction}
            </Link>
          </div>
        ) : (
          <div className="content-list">
            {articles.map((article) => (
              <ArticleCard key={article._id} article={article} locale={locale} />
            ))}
          </div>
        )}
      </div>
    </PublicationShell>
  );
}
