import type { MetadataRoute } from "next";

import { getAbsoluteUrl } from "@/lib/seo/site-url";
import { publicProductSitemapEntries } from "@/services/catalog/catalog-query";

export const revalidate = 3_600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const publicPages: MetadataRoute.Sitemap = ["/", "/about", "/products", "/contact"].map((path) => ({
    url: getAbsoluteUrl(path),
    changeFrequency: path === "/products" ? "daily" : "monthly",
    priority: path === "/" ? 1 : 0.7,
  }));

  try {
    const products = await publicProductSitemapEntries();
    return [...publicPages, ...products.map((product) => ({
      url: getAbsoluteUrl(`/products/${encodeURIComponent(product.slug)}`),
      lastModified: product.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.6,
      images: product.imageUrls.slice(0, 1),
    }))];
  } catch {
    // A temporary catalogue database failure must not make robots discover an
    // invalid sitemap. The public static routes remain available for crawling.
    return publicPages;
  }
}
