import type { ReactNode } from "react";
import { getContent } from "@/content";
import type { Locale } from "@/content/types";
import { SiteFooter } from "@/components/landing/SiteFooter";
import { Topbar } from "@/components/landing/Topbar";

type PublicationShellProps = {
  locale: Locale;
  children: ReactNode;
  articlesActive?: boolean;
  researchActive?: boolean;
  alternateHref?: string;
};

export function PublicationShell({
  locale,
  children,
  articlesActive = false,
  researchActive = false,
  alternateHref,
}: PublicationShellProps) {
  const content = getContent(locale);

  return (
    <>
      <Topbar
        locale={locale}
        languageAria={content.languageSwitcherAria}
        homeHref={`/${locale}/`}
        articlesActive={articlesActive}
        researchActive={researchActive}
        elevated
        downloadLabel={content.footer.downloadLabel}
        menuLabel={content.nav.menuLabel}
        closeMenuLabel={content.nav.closeMenuLabel}
        alternateHref={alternateHref}
      />
      <main>{children}</main>
      <SiteFooter content={content.footer} locale={locale} />
    </>
  );
}
