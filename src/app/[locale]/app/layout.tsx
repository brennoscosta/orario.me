import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Header } from "@/components/Header";
import { getUser } from "@/lib/auth";
import { getDict } from "@/lib/i18n";
import { isLocale } from "@/lib/i18n/config";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function AppLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = getDict(locale);
  if (!process.env.DATABASE_URL) {
    return (
      <>
        <Header locale={locale} dict={dict} user={null} />
        <main id="main" className="sheet">
          <p className="alert">{dict.app.unavailable}</p>
        </main>
      </>
    );
  }
  const user = await getUser();
  if (!user) redirect(`/${locale}/login`);
  return (
    <>
      <Header locale={locale} dict={dict} user={user} />
      {children}
    </>
  );
}
