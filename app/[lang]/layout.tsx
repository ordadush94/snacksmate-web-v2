import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getContent, isLocale, locales } from "@/content";
import { fontClassName } from "@/app/fonts";
import { GoogleAnalytics } from "@/components/GoogleAnalytics";
import { createLocaleMetadata } from "@/lib/metadata";
import "../globals.css";

export const dynamicParams = false;

export function generateStaticParams() {
  return locales.map((lang) => ({ lang }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  return createLocaleMetadata(getContent(lang));
}

export default async function LocaleLayout({
  children,
  params,
}: LayoutProps<"/[lang]">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();

  const dir = lang === "he" ? "rtl" : "ltr";

  return (
    <html lang={lang} dir={dir} className={fontClassName}>
      <body data-lang={lang}>
        {children}
        <GoogleAnalytics />
      </body>
    </html>
  );
}
