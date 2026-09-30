import type { LandingContent } from "@/content/types";
import { articlesPath } from "@/content/articles";
import type { HomeArticle } from "@/components/landing/home-content";
import { Reveal } from "@/components/landing/Reveal";

type HomeArticlesProps = {
  locale: LandingContent["locale"];
  heading: string;
  moreLabel: string;
  articles: HomeArticle[];
};

export function HomeArticles({
  locale,
  heading,
  moreLabel,
  articles,
}: HomeArticlesProps) {
  if (articles.length === 0) return null;

  return (
    <section id="sm-articles">
      <div className="wrap">
        <Reveal as="h2">{heading}</Reveal>
        <ul className="home-article-list">
          {articles.map((article) => (
            <li key={article.id}>
              <a href={article.href}>{article.title}</a>
              {article.meta ? <time dateTime={article.dateTime}>{article.meta}</time> : null}
            </li>
          ))}
        </ul>
        <p className="home-more">
          <a className="btn-text" href={articlesPath(locale)}>
            {moreLabel}
          </a>
        </p>
      </div>
    </section>
  );
}
