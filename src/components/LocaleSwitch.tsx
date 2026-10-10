"use client";

import { usePathname } from "next/navigation";
import type { Locale } from "@/lib/i18n/config";

export function LocaleSwitch({ locale, label }: { locale: Locale; label: string }) {
  const pathname = usePathname() || `/${locale}`;
  const other: Locale = locale === "pt" ? "en" : "pt";
  const target = pathname.replace(new RegExp(`^/${locale}(?=/|$)`), `/${other}`);
  return (
    <a href={target} hrefLang={other} lang={other} className="optional">
      {label}
    </a>
  );
}
