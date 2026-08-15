import type { Metadata } from "next";
import type { CatalogProduct, ContentEntry } from "@beyondx/theme-sdk";
import { mediaUrl } from "@/lib/beyondx";

const SITE_URL = process.env.NEXT_PUBLIC_STOREFRONT_URL?.trim() || "http://localhost:3001";

export function siteUrl(path = "/"): string {
  return new URL(path, SITE_URL.endsWith("/") ? SITE_URL : `${SITE_URL}/`).toString();
}

export function productMetadata(product: CatalogProduct): Metadata {
  const title = product.name;
  const description = product.description || `View ${product.name} on BeyondX.`;
  const image = product.media[0];

  return {
    title,
    description,
    alternates: { canonical: siteUrl(`/products/${product.slug}`) },
    openGraph: {
      title,
      description,
      type: "website",
      url: siteUrl(`/products/${product.slug}`),
      ...(image ? { images: [{ url: mediaUrl(image.id), alt: image.altText || product.name }] } : {}),
    },
  };
}

export function contentMetadata(entry: ContentEntry): Metadata {
  const title = entry.seoTitle || readableTitle(entry);
  const description = entry.seoDescription || null;
  const path = `/content/${entry.contentTypeApiId}/${entry.slug}`;

  return {
    title,
    ...(description ? { description } : {}),
    alternates: { canonical: siteUrl(path) },
    openGraph: {
      title,
      ...(description ? { description } : {}),
      type: "article",
      url: siteUrl(path),
    },
  };
}

export function readableTitle(entry: ContentEntry): string {
  const candidate = entry.data.title ?? entry.data.name ?? entry.data.heading;
  return typeof candidate === "string" && candidate.trim() ? candidate : entry.slug.replaceAll("-", " ");
}
