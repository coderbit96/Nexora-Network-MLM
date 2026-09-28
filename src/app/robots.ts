import type { MetadataRoute } from "next";

function appUrl() {
  try { return new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"); } catch { return new URL("http://localhost:3000"); }
}

export default function robots(): MetadataRoute.Robots {
  const base = appUrl();
  return { rules: { userAgent: "*", allow: "/", disallow: ["/admin/", "/member/", "/api/", "/login", "/register", "/forgot-password", "/reset-password", "/verify-email"] }, sitemap: new URL("/sitemap.xml", base).toString() };
}
