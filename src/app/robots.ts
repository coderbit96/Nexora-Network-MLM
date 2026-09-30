import type { MetadataRoute } from "next";

import { getAbsoluteUrl } from "@/lib/seo/site-url";

export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: "*", allow: "/", disallow: ["/admin/", "/member/", "/staff/", "/api/", "/login", "/register", "/forgot-password", "/reset-password", "/verify-email"] }, sitemap: getAbsoluteUrl("/sitemap.xml") };
}
