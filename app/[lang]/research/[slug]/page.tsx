import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLocale } from "@/content";
import { articlePath } from "@/content/articles";
import { researchItemPath } from "@/content/research";
import { ResearchDetail } from "@/components/research/ResearchDetail";
import { createResearchMetadata } from "@/lib/metadata";
import { getArticlesByLanguage, pickArticlesByTopic } from "@/sanity/lib/articles";
import {
  getPublishedResearchParams,
  getResearchByLanguage,
  getResearchByLanguageAndSlug,
  getResearchTranslation,
  pickRelatedResearch,
} from "@/sanity/lib/research";

export const revalidate = 60;
export const dynamicParams = true;

export async function generateStaticParams() {
  const items = await getPublishedResearchParams();
  return items
    .filter((item) => isLocale(item.language) && item.slug)
    .map((item) => ({
      lang: item.language,
      slug: item.slug,
    }));
}

export async function generateMetadata({
  params,
}: PageProps<"/[lang]/research/[slug]">): Promise<Metadata> {
  const { lang, slug } = await params;
  if (!isLocale(lang)) return {};

  const research = await getResearchByLanguageAndSlug(lang, slug);
  if (!research) notFound();

  const translationKey = research.translationSlug?.trim();
  const translation = translationKey
    ? await getResearchTranslation(lang, slug, translationKey)
    : null;
  return createResearchMetadata(lang, research, translation);
}

export default async function ResearchItemPage({
  params,
}: PageProps<"/[lang]/research/[slug]">) {
  const { lang, slug } = await params;
  if (!isLocale(lang)) notFound();

  const research = await getResearchByLanguageAndSlug(lang, slug);
  if (!research) notFound();

  const items = await getResearchByLanguage(lang);
  const related = pickRelatedResearch(items, research);
  const translationKey = research.translationSlug?.trim();
  const translation = translationKey
    ? await getResearchTranslation(lang, slug, translationKey)
    : null;
  const [relatedArticle] = pickArticlesByTopic(
    await getArticlesByLanguage(lang),
    research.topic,
    1,
  );

  return (
    <ResearchDetail
      research={research}
      locale={lang}
      related={related}
      relatedArticle={
        relatedArticle
          ? {
              title: relatedArticle.title,
              href: articlePath(lang, relatedArticle.slug),
            }
          : null
      }
      alternateHref={
        translation
          ? researchItemPath(translation.language, translation.slug)
          : undefined
      }
    />
  );
}
