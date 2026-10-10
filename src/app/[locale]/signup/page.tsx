import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { AuthForm } from "@/components/AuthForm";
import { Header } from "@/components/Header";
import { getUser } from "@/lib/auth";
import { getDict } from "@/lib/i18n";
import { isLocale } from "@/lib/i18n/config";

const MODE = "signup" as "signup" | "login";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = getDict(locale).auth;
  return {
    title: MODE === "signup" ? t.signupTitle : t.loginTitle,
    alternates: {
      canonical: `/${locale}/${MODE}`,
      languages: { "pt-BR": `/pt/${MODE}`, en: `/en/${MODE}` },
    },
  };
}

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  if (await getUser()) redirect(`/${locale}/app`);
  const dict = getDict(locale);
  const t = dict.auth;
  const signup = MODE === "signup";
  return (
    <>
      <Header locale={locale} dict={dict} user={null} />
      <main id="main" className="sheet">
        <h1 className="display">{signup ? t.signupTitle : t.loginTitle}</h1>
        <p className="lead">{signup ? t.signupLead : t.loginLead}</p>
        <AuthForm
          mode={MODE}
          locale={locale}
          t={{
            name: t.name,
            email: t.email,
            password: t.password,
            passwordHint: t.passwordHint,
            phone: t.phone,
            phoneHint: t.phoneHint,
            submit: signup ? t.submitSignup : t.submitLogin,
            pending: t.pending,
            switchQuestion: signup ? t.haveAccount : t.noAccount,
            switchLabel: signup ? dict.nav.login : dict.nav.signup,
          }}
        />
      </main>
    </>
  );
}
