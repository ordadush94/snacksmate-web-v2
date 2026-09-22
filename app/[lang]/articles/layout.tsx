import { notFound } from "next/navigation";
import { getContent, isLocale } from "@/content";
import { Topbar } from "@/components/landing/Topbar";
import { SiteFooter } from "@/components/landing/SiteFooter";

export const revalidate = 60;

export default async function ArticlesLayout({
  children,
  params,
}: LayoutProps<"/[lang]/articles">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();

  const content = getContent(lang);

  return (
    <>
      <Topbar
        locale={lang}
        languageAria={content.languageSwitcherAria}
        homeHref={`/${lang}/`}
        articlesActive
        elevated
      />
      <main>{children}</main>
      <SiteFooter content={content.footer} />
    </>
  );
}
