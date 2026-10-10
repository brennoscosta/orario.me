import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import "@fontsource-variable/bodoni-moda";
import "@fontsource-variable/hanken-grotesk";
import "../globals.css";
import { getDict } from "@/lib/i18n";
import { htmlLang, isLocale, SITE_URL } from "@/lib/i18n/config";

export const viewport: Viewport = { themeColor: "#f6f7f7", width: "device-width", initialScale: 1 };

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const dict = getDict(locale);
  return {
    metadataBase: new URL(SITE_URL),
    title: { default: dict.meta.title, template: "%s — Orario" },
    description: dict.meta.description,
    applicationName: "Orario",
    openGraph: {
      type: "website",
      siteName: "Orario",
      title: dict.meta.title,
      description: dict.meta.description,
      url: `/${locale}`,
      locale: locale === "pt" ? "pt_BR" : "en_US",
    },
    twitter: { card: "summary_large_image", title: dict.meta.title, description: dict.meta.description },
  };
}

export default async function RootLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = getDict(locale);
  return (
    <html lang={htmlLang[locale]}>
      <body>
        <a href="#main" className="skip">
          {dict.nav.skip}
        </a>
        {children}
      </body>
    </html>
  );
}
