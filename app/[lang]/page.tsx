import { notFound } from "next/navigation";
import { getContent, isLocale } from "@/content";
import { LandingPage } from "@/components/landing/LandingPage";

export default async function LocalePage({ params }: PageProps<"/[lang]">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  return <LandingPage content={getContent(lang)} />;
}
