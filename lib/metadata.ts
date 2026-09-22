import type { Metadata } from "next";
import type { LandingContent, Locale } from "@/content/types";
import { articlePath, articlesPath, getArticlesCopy } from "@/content/articles";
import { APPLE_APP_ID, SITE_URL } from "@/lib/site";
import { enContent } from "@/content/en";
import {
  articleImageAlt,
  articleImageUrl,
  type Article,
} from "@/sanity/lib/articles";

export const iconMetadata: Metadata["icons"] = {
  icon: [{ url: "/favicon.png", sizes: "32x32", type: "image/png" }],
  apple: [{ url: "/apple-touch-icon.png" }],
};

export const hreflangLanguages = {
  en: "/en/",
  he: "/he/",
  "x-default": "/en/",
};

export function createLocaleMetadata(content: LandingContent): Metadata {
  const path = `/${content.locale}/`;
  return {
    metadataBase: new URL(SITE_URL),
    title: content.meta.title,
    description: content.meta.description,
    alternates: {
      canonical: path,
      languages: hreflangLanguages,
    },
    openGraph: {
      title: content.meta.ogTitle,
      description: content.meta.ogDescription,
      type: "website",
      url: path,
      images: [{ url: "/app-icon.png" }],
    },
    twitter: {
      card: "summary",
      images: ["/app-icon.png"],
    },
    icons: iconMetadata,
    itunes: {
      appId: APPLE_APP_ID,
    },
  };
}

export function createArticlesIndexMetadata(locale: Locale): Metadata {
  const copy = getArticlesCopy(locale);
  const path = articlesPath(locale);
  return {
    title: copy.metaTitle,
    description: copy.pageDescription,
    alternates: {
      canonical: path,
      languages: {
        en: articlesPath("en"),
        he: articlesPath("he"),
        "x-default": articlesPath("en"),
      },
    },
    openGraph: {
      title: copy.pageTitle,
      description: copy.pageDescription,
      type: "website",
      url: path,
    },
    twitter: {
      card: "summary",
    },
  };
}

export function createArticleMetadata(
  locale: Locale,
  article: Article,
): Metadata {
  const path = articlePath(locale, article.slug);
  const title = article.seoTitle?.trim() || article.title;
  const description = article.seoDescription?.trim() || article.excerpt;
  const canonical = article.canonicalUrl?.trim() || path;
  const imageUrl = articleImageUrl(article.mainImage, 1200, 630);

  return {
    title,
    description,
    alternates: {
      canonical,
    },
    openGraph: {
      title,
      description,
      type: "article",
      url: canonical,
      publishedTime: article.publishedAt,
      modifiedTime: article.updatedAt || undefined,
      images: imageUrl
        ? [
            {
              url: imageUrl,
              alt: articleImageAlt(article.mainImage, article.title),
            },
          ]
        : undefined,
    },
    twitter: {
      card: imageUrl ? "summary_large_image" : "summary",
      title,
      description,
      images: imageUrl ? [imageUrl] : undefined,
    },
  };
}

export const rootMetadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: enContent.meta.title,
  description: enContent.meta.description,
  robots: {
    index: false,
    follow: true,
  },
  alternates: {
    languages: hreflangLanguages,
  },
  openGraph: {
    title: enContent.meta.ogTitle,
    description: enContent.meta.ogDescription,
    type: "website",
    url: "/en/",
    images: [{ url: "/app-icon.png" }],
  },
  twitter: {
    card: "summary",
    images: ["/app-icon.png"],
  },
  icons: iconMetadata,
};
