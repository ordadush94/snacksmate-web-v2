import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLocale } from "@/content";
import { ArticleDetail } from "@/components/articles/ArticleDetail";
import { createArticleMetadata } from "@/lib/metadata";
import {
  getArticleByLanguageAndSlug,
  getPublishedArticleParams,
} from "@/sanity/lib/articles";

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
  return createArticleMetadata(lang, article);
}

export default async function ArticlePage({
  params,
}: PageProps<"/[lang]/articles/[slug]">) {
  const { lang, slug } = await params;
  if (!isLocale(lang)) notFound();

  const article = await getArticleByLanguageAndSlug(lang, slug);
  if (!article) notFound();

  return <ArticleDetail article={article} locale={lang} />;
}
