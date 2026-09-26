"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import type { Locale } from "@/content/types";
import { articlesPath, getArticlesCopy } from "@/content/articles";
import { getResearchCopy, researchPath } from "@/content/research";
import { BrandMark } from "@/components/landing/BrandMark";
import { LanguageSwitch } from "@/components/landing/LanguageSwitch";

type TopbarProps = {
  locale: Locale;
  languageAria: string;
  homeHref?: string;
  articlesActive?: boolean;
  researchActive?: boolean;
  elevated?: boolean;
  downloadLabel: string;
  menuLabel: string;
  closeMenuLabel: string;
  alternateHref?: string;
};

export function Topbar({
  locale,
  languageAria,
  homeHref,
  articlesActive = false,
  researchActive = false,
  elevated = false,
  downloadLabel,
  menuLabel,
  closeMenuLabel,
  alternateHref,
}: TopbarProps) {
  const [open, setOpen] = useState(false);
  const actionsRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const articlesHref = articlesPath(locale);
  const articlesLabel = getArticlesCopy(locale).navLabel;
  const researchHref = researchPath(locale);
  const researchLabel = getResearchCopy(locale).navLabel;
  const downloadHref = `/${locale}/#sm-download`;

  useEffect(() => {
    if (!open) return;

    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    function onPointer(event: PointerEvent) {
      if (!actionsRef.current?.contains(event.target as Node)) setOpen(false);
    }

    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open]);

  return (
    <header className={elevated ? "topbar is-scrolled" : "topbar"} id="topbar">
      <div className="wrap topbar-inner">
        <BrandMark variant="topbar" href={homeHref} />
        <div className="topbar-actions" ref={actionsRef}>
          <button
            type="button"
            className="nav-toggle"
            aria-expanded={open}
            aria-controls={menuId}
            onClick={() => setOpen((value) => !value)}
          >
            <span className="sr-only">{open ? closeMenuLabel : menuLabel}</span>
            <span className="nav-toggle-bars" aria-hidden="true" />
          </button>
          <nav
            id={menuId}
            className={open ? "topbar-nav is-open" : "topbar-nav"}
            onClick={() => setOpen(false)}
          >
            <Link
              className={
                articlesActive ? "topbar-nav-link is-active" : "topbar-nav-link"
              }
              href={articlesHref}
              aria-current={articlesActive ? "page" : undefined}
            >
              {articlesLabel}
            </Link>
            <Link
              className={
                researchActive ? "topbar-nav-link is-active" : "topbar-nav-link"
              }
              href={researchHref}
              aria-current={researchActive ? "page" : undefined}
            >
              {researchLabel}
            </Link>
            <a className="btn btn-primary topbar-download" href={downloadHref}>
              {downloadLabel}
            </a>
          </nav>
          <LanguageSwitch
            locale={locale}
            ariaLabel={languageAria}
            alternateHref={alternateHref}
          />
        </div>
      </div>
    </header>
  );
}
