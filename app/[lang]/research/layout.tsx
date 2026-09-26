import { notFound } from "next/navigation";
import { isLocale } from "@/content";

export const revalidate = 60;

export default async function ResearchLayout({
  children,
  params,
}: LayoutProps<"/[lang]/research">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  return children;
}
