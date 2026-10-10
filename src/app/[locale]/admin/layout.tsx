import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { AdminNav } from "@/components/AdminNav";
import { Header } from "@/components/Header";
import { requireAdmin } from "@/lib/admin";
import { getDict } from "@/lib/i18n";
import { isLocale } from "@/lib/i18n/config";

export const metadata: Metadata = { title: "Painel admin", robots: { index: false, follow: false } };

export default async function AdminLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale) || !process.env.DATABASE_URL) notFound();
  const user = await requireAdmin();
  // The panel is written in Portuguese only.
  if (locale !== "pt") redirect("/pt/admin");
  return (
    <>
      <Header locale="pt" dict={getDict("pt")} user={user} />
      <main id="main" className="admin">
        <h1 className="display">Painel admin</h1>
        <AdminNav />
        {children}
      </main>
    </>
  );
}
