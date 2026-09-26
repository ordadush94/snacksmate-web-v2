import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLocale } from "@/content";
import { ArticleDetail } from "@/components/articles/ArticleDetail";
import { createArticleMetadata } from "@/lib/metadata";
import { articlePath } from "@/content/articles";
import {
  getArticleByLanguageAndSlug,
  getArticleTranslation,
  getArticlesByLanguage,
  getPublishedArticleParams,
  pickRelatedArticles,
} from "@/sanity/lib/articles";
import { getResearchByLanguage, pickResearchByTopic } from "@/sanity/lib/research";

export const revalidate = 60;
export const dynamicParams = true;

export async function generateStaticParams() {
  const articles = await getPublishedArticleParams();
  return articles
    .filter((article) => isLocale(article.language) && article.slug)
    .map((article) => ({
      lang: article.language,
      slug: article.slug,
    }));
}

export async function generateMetadata({
  params,
}: PageProps<"/[lang]/articles/[slug]">): Promise<Metadata> {
  const { lang, slug } = await params;
  if (!isLocale(lang)) return {};

  const article = await getArticleByLanguageAndSlug(lang, slug);
  if (!article) notFound();

  const translationKey = article.translationSlug?.trim();
  const translation = translationKey
    ? await getArticleTranslation(lang, slug, translationKey)
    : null;
  return createArticleMetadata(lang, article, translation);
}

export default async function ArticlePage({
  params,
}: PageProps<"/[lang]/articles/[slug]">) {
  const { lang, slug } = await params;
  if (!isLocale(lang)) notFound();

  const article = await getArticleByLanguageAndSlug(lang, slug);
  if (!article) notFound();

  const articles = await getArticlesByLanguage(lang);
  const related = pickRelatedArticles(articles, article);
  const translationKey = article.translationSlug?.trim();
  const translation = translationKey
    ? await getArticleTranslation(lang, slug, translationKey)
    : null;
  const relatedResearch = pickResearchByTopic(
    await getResearchByLanguage(lang),
    article.topic,
    3,
  );

  return (
    <ArticleDetail
      article={article}
      locale={lang}
      related={related}
      relatedResearch={relatedResearch}
      alternateHref={
        translation
          ? articlePath(translation.language, translation.slug)
          : undefined
      }
    />
  );
}
