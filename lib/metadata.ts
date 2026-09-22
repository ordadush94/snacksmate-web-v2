import type { Metadata } from "next";
import type { LandingContent } from "@/content/types";
import { APPLE_APP_ID, SITE_URL } from "@/lib/site";
import { enContent } from "@/content/en";

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
