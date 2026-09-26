"use client";

import Link from "next/link";
import { useLayoutEffect } from "react";
import { usePathname } from "next/navigation";
import type { Locale } from "@/content/types";
import { PublicationShell } from "@/components/site/PublicationShell";

const copy = {
  en: {
    title: "This page isn’t here.",
    body: "The link may be old, or the page may have moved.",
    home: "Home",
    research: "Research",
    articles: "Articles",
  },
  he: {
    title: "העמוד הזה לא נמצא.",
    body: "יכול להיות שהקישור ישן, או שהעמוד עבר.",
    home: "בית",
    research: "מחקרים",
    articles: "כתבות",
  },
} as const;

function localeFromPath(pathname: string | null): Locale {
  if (pathname === "/he" || pathname?.startsWith("/he/")) return "he";
  return "en";
}

export function NotFoundScreen() {
  const locale = localeFromPath(usePathname());
  const text = copy[locale];

  useLayoutEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = locale === "he" ? "rtl" : "ltr";
  }, [locale]);

  return (
    <PublicationShell locale={locale}>
      <div className="articles-shell not-found">
        <p className="section-kicker">Snacksmate</p>
        <h1>{text.title}</h1>
        <p className="section-lead">{text.body}</p>
        <ul className="content-close-links">
          <li>
            <Link href={`/${locale}/`}>{text.home}</Link>
          </li>
          <li>
            <Link href={`/${locale}/research/`}>{text.research}</Link>
          </li>
          <li>
            <Link href={`/${locale}/articles/`}>{text.articles}</Link>
          </li>
        </ul>
      </div>
    </PublicationShell>
  );
}
