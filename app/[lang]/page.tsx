import { notFound } from "next/navigation";
import { getContent, isLocale } from "@/content";
import { articlePath, formatArticleDate } from "@/content/articles";
import { researchItemPath } from "@/content/research";
import { LandingPage } from "@/components/landing/LandingPage";
import type { HomeArticle, HomeStudy } from "@/components/landing/home-content";
import { researchReaderTitle } from "@/lib/research-display";
import { getArticlesByLanguage } from "@/sanity/lib/articles";
import { getResearchByLanguage } from "@/sanity/lib/research";

export const revalidate = 60;

const HOME_RESEARCH_COUNT = 3;
const HOME_ARTICLE_COUNT = 3;

export default async function LocalePage({ params }: PageProps<"/[lang]">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();

  const [articles, studies] = await Promise.all([
    getArticlesByLanguage(lang),
    getResearchByLanguage(lang),
  ]);

  const homeArticles: HomeArticle[] = articles.slice(0, HOME_ARTICLE_COUNT).map((article) => ({
    id: article._id,
    href: articlePath(lang, article.slug),
    title: article.title,
    meta: formatArticleDate(article.publishedAt, lang),
    dateTime: article.publishedAt,
  }));

  const homeStudies: HomeStudy[] = studies.slice(0, HOME_RESEARCH_COUNT).map((study) => ({
    id: study._id,
    href: researchItemPath(lang, study.slug),
    title: researchReaderTitle(study),
    excerpt: study.excerpt?.trim() ?? "",
    meta: [study.journal?.trim(), study.year].filter(Boolean).join(" · "),
  }));

  return (
    <LandingPage
      content={getContent(lang)}
      studies={homeStudies}
      articles={homeArticles}
    />
  );
}
