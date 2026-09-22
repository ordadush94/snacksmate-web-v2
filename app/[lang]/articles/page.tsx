import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLocale } from "@/content";
import { ArticlesIndex } from "@/components/articles/ArticlesIndex";
import { createArticlesIndexMetadata } from "@/lib/metadata";
import { getArticlesByLanguage } from "@/sanity/lib/articles";

export const revalidate = 60;

export async function generateMetadata({
  params,
}: PageProps<"/[lang]/articles">): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  return createArticlesIndexMetadata(lang);
}

export default async function ArticlesPage({
  params,
}: PageProps<"/[lang]/articles">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();

  const articles = await getArticlesByLanguage(lang);
  return <ArticlesIndex locale={lang} articles={articles} />;
}
