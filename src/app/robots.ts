import type { MetadataRoute } from "next";

import { SITE_URL } from "@/lib/i18n/config";

export const dynamic = "force-dynamic";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/pt/app", "/en/app", "/api/"] }],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
