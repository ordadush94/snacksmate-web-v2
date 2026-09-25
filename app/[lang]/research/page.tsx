import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLocale } from "@/content";
import { ResearchIndex } from "@/components/research/ResearchIndex";
import { createResearchIndexMetadata } from "@/lib/metadata";
import { getResearchByLanguage } from "@/sanity/lib/research";

export const revalidate = 60;

export async function generateMetadata({
  params,
}: PageProps<"/[lang]/research">): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  return createResearchIndexMetadata(lang);
}

export default async function ResearchPage({
  params,
}: PageProps<"/[lang]/research">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();

  const items = await getResearchByLanguage(lang);
  return <ResearchIndex locale={lang} items={items} />;
}
