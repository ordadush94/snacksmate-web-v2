import type { Metadata } from "next";
import type { LandingContent, Locale } from "@/content/types";
import { articlesPath, getArticlesCopy } from "@/content/articles";
import {
  articleCanonicalUrl,
  articleHreflangLanguages,
  type ArticleSeoIdentity,
} from "@/lib/article-seo";
import { absoluteUrl, APPLE_APP_ID, SITE_URL } from "@/lib/site";
import { enContent } from "@/content/en";
import {
  articleImageAlt,
  articleImageUrl,
  type Article,
  type ArticleTranslation,
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
  const canonical = absoluteUrl(articlesPath(locale));
  return {
    title: copy.metaTitle,
    description: copy.metaDescription,
    robots: {
      index: true,
      follow: true,
    },
    alternates: {
      canonical,
      languages: {
        en: absoluteUrl(articlesPath("en")),
        he: absoluteUrl(articlesPath("he")),
        "x-default": absoluteUrl(articlesPath("en")),
      },
    },
    openGraph: {
      title: copy.metaTitle,
      description: copy.metaDescription,
      type: "website",
      url: canonical,
    },
    twitter: {
      card: "summary",
      title: copy.metaTitle,
      description: copy.metaDescription,
    },
  };
}

export function createArticleMetadata(
  locale: Locale,
  article: Article,
  translation?: ArticleTranslation | null,
): Metadata {
  const title = article.seoTitle?.trim() || article.title;
  const description = article.seoDescription?.trim() || article.excerpt;
  const canonical = articleCanonicalUrl(locale, article);
  const imageUrl = articleImageUrl(article.mainImage, 1200, 630);
  const identity: ArticleSeoIdentity = {
    slug: article.slug,
    language: locale,
    canonicalUrl: article.canonicalUrl,
    translationSlug: article.translationSlug,
  };
  const translationIdentity: ArticleSeoIdentity | null = translation
    ? {
        slug: translation.slug,
        language: translation.language,
        canonicalUrl: translation.canonicalUrl,
        translationSlug: translation.translationSlug,
      }
    : null;

  return {
    title,
    description,
    robots: {
      index: true,
      follow: true,
    },
    alternates: {
      canonical,
      languages: articleHreflangLanguages(identity, translationIdentity),
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
