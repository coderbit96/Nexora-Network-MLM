import type { MetadataRoute } from "next";

function appUrl() {
  try { return new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"); } catch { return new URL("http://localhost:3000"); }
}

export default function sitemap(): MetadataRoute.Sitemap {
  const base = appUrl();
  return ["/", "/about", "/products", "/contact"].map((path) => ({ url: new URL(path, base).toString(), lastModified: new Date(), changeFrequency: path === "/products" ? "daily" : "monthly", priority: path === "/" ? 1 : 0.7 }));
}
