"use client";

import { useEffect } from "react";
import { isLocale, type LandingContent, type Locale } from "@/content/types";
import { setLangPreference } from "@/lib/language";
import { Topbar } from "@/components/landing/Topbar";
import { Hero } from "@/components/landing/Hero";
import { Problem } from "@/components/landing/Problem";
import { Concept } from "@/components/landing/Concept";
import { Effects } from "@/components/landing/Effects";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { Benefits } from "@/components/landing/Benefits";
import { Trust } from "@/components/landing/Trust";
import { DownloadCta } from "@/components/landing/DownloadCta";
import { SiteFooter } from "@/components/landing/SiteFooter";
import { researchPath } from "@/content/research";

type LandingPageProps = {
  content: LandingContent;
};

function smScroll(id: string, evt?: Event) {
  const el = document.getElementById(id);
  if (!el) return true;
  evt?.preventDefault();
  const y =
    el.getBoundingClientRect().top +
    (window.pageYOffset || document.documentElement.scrollTop || 0) -
    88;
  try {
    window.scrollTo({ top: Math.max(0, y), behavior: "smooth" });
  } catch {
    window.scrollTo(0, Math.max(0, y));
  }
  return false;
}

function useLandingBehavior(locale: Locale) {
  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = locale === "he" ? "rtl" : "ltr";
    document.body.setAttribute("data-lang", locale);
    setLangPreference(locale);

    const abort = new AbortController();
    const { signal } = abort;

    document.querySelectorAll("[data-set-lang]").forEach((el) => {
      el.addEventListener(
        "click",
        () => {
          const lang = el.getAttribute("data-set-lang");
          if (lang && isLocale(lang)) setLangPreference(lang);
        },
        { signal }
      );
    });

    document.querySelectorAll("[data-sm-scroll]").forEach((el) => {
      el.addEventListener(
        "click",
        (evt) => {
          const id = el.getAttribute("data-sm-scroll");
          if (id) smScroll(id, evt);
        },
        { signal }
      );
    });

    const topbar = document.getElementById("topbar");
    function onScroll() {
      if (!topbar) return;
      const y = window.pageYOffset || document.documentElement.scrollTop || 0;
      topbar.classList.toggle("is-scrolled", y > 8);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true, signal });

    const nodes = document.querySelectorAll(
      ".reveal, .problem-list li, .steps li, .effects-grid li"
    );

    let observer: IntersectionObserver | null = null;
    if (!("IntersectionObserver" in window)) {
      nodes.forEach((node) => node.classList.add("is-in"));
    } else {
      observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            entry.target.classList.add("is-in");
            observer?.unobserve(entry.target);
          });
        },
        { rootMargin: "0px 0px -8% 0px", threshold: 0.12 }
      );
      nodes.forEach((node, index) => {
        (node as HTMLElement).style.transitionDelay = `${(index % 5) * 60}ms`;
        observer?.observe(node);
      });
    }

    return () => {
      abort.abort();
      observer?.disconnect();
    };
  }, [locale]);
}

export function LandingPage({ content }: LandingPageProps) {
  useLandingBehavior(content.locale);

  return (
    <>
      <Topbar
        locale={content.locale}
        languageAria={content.languageSwitcherAria}
        downloadLabel={content.footer.downloadLabel}
        menuLabel={content.nav.menuLabel}
        closeMenuLabel={content.nav.closeMenuLabel}
      />
      <main id="sm-top">
        <Hero content={content} />
        <Problem content={content.problem} />
        <Concept content={content.concept} />
        <Effects
          content={content.effects}
          researchHref={researchPath(content.locale)}
        />
        <HowItWorks content={content.howItWorks} />
        <Benefits content={content.benefits} />
        <Trust content={content.trust} />
        <DownloadCta content={content.download} store={content.store} />
      </main>
      <SiteFooter content={content.footer} locale={content.locale} />
    </>
  );
}
