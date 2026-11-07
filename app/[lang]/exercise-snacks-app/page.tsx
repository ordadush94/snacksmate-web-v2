import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ExerciseSnacksAppPage } from "@/components/exercise-snacks-app/ExerciseSnacksAppPage";
import { isLocale } from "@/content";
import { exerciseSnacksAppMetadata } from "@/lib/exercise-snacks-app";
import { getArticlesByLanguage } from "@/sanity/lib/articles";
import { getResearchByLanguage } from "@/sanity/lib/research";

export const revalidate = 60;

export async function generateMetadata({
  params,
}: PageProps<"/[lang]/exercise-snacks-app">): Promise<Metadata> {
  const { lang } = await params;
  if (lang !== "en") return {};
  return exerciseSnacksAppMetadata();
}

export default async function ExerciseSnacksAppRoute({
  params,
}: PageProps<"/[lang]/exercise-snacks-app">) {
  const { lang } = await params;
  if (!isLocale(lang) || lang !== "en") notFound();

  const [articles, studies] = await Promise.all([
    getArticlesByLanguage("en"),
    getResearchByLanguage("en"),
  ]);

  return (
    <ExerciseSnacksAppPage
      articles={articles.map((article) => ({
        slug: article.slug,
        title: article.title,
      }))}
      studies={studies.map((study) => ({
        topic: study.topic,
        slug: study.slug,
        title: study.title,
      }))}
    />
  );
}
