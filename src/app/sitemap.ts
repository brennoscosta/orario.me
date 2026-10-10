import type { MetadataRoute } from "next";

import { locales, SITE_URL } from "@/lib/i18n/config";

export const dynamic = "force-dynamic";

export default function sitemap(): MetadataRoute.Sitemap {
  const pages = ["", "/signup", "/login"];
  return pages.flatMap((page) =>
    locales.map((locale) => ({
      url: `${SITE_URL}/${locale}${page}`,
      changeFrequency: "monthly" as const,
      priority: page === "" ? 1 : 0.5,
      alternates: { languages: { "pt-BR": `${SITE_URL}/pt${page}`, en: `${SITE_URL}/en${page}` } },
    })),
  );
}
