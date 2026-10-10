import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { PasswordForm } from "@/components/PasswordForm";
import { SettingsForm } from "@/components/SettingsForm";
import { getUser } from "@/lib/auth";
import { getDict } from "@/lib/i18n";
import { isLocale } from "@/lib/i18n/config";
import { monthlyLimit } from "@/lib/limits";
import { channels } from "@/lib/plans";
import { usageThisMonth } from "@/lib/usage";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return { title: isLocale(locale) ? getDict(locale).settings.title : undefined };
}

export default async function SettingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ saved?: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const user = await getUser();
  if (!user) redirect(`/${locale}/login`);
  const dict = getDict(locale);
  const t = dict.settings;
  const usage = await usageThisMonth(user.id);
  const limits = Object.fromEntries(
    await Promise.all(channels.map(async (c) => [c, await monthlyLimit(user.plan, c)] as const)),
  );
  const timezones = Intl.supportedValuesOf("timeZone");
  if (!timezones.includes(user.timezone)) timezones.unshift(user.timezone);

  return (
    <main id="main" className="sheet sheet--wide">
      <h1 className="display">{t.title}</h1>
      <SettingsForm
        locale={locale}
        timezones={timezones}
        justSaved={(await searchParams).saved === "1"}
        initial={{
          name: user.name,
          email: user.email,
          phone: user.phone ?? "",
          timezone: user.timezone,
          language: user.locale,
          dailyDigest: user.dailyDigest,
          digestHour: user.digestHour,
        }}
        t={{
          name: t.name,
          email: t.email,
          phone: t.phone,
          phoneHint: t.phoneHint,
          timezone: t.timezone,
          language: t.language,
          digest: t.digest,
          digestHint: t.digestHint,
          digestHour: t.digestHour,
          save: t.save,
          saved: t.saved,
          pending: dict.auth.pending,
        }}
      />

      <h2 className="section-title">{t.usage}</h2>
      <p className="hint">{t.plan}</p>
      <dl className="usage">
        {channels.map((channel) => {
          const limit = limits[channel];
          return (
            <div key={channel}>
              <dt>{dict.channels[channel]}</dt>
              <dd>
                {limit === null ? `${t.usageSent(usage[channel])}, ${t.usageUnlimited}` : t.usageOf(usage[channel], limit)}
              </dd>
            </div>
          );
        })}
      </dl>

      <h2 className="section-title">{t.passwordTitle}</h2>
      <PasswordForm
        locale={locale}
        t={{
          current: t.currentPassword,
          next: t.newPassword,
          hint: dict.auth.passwordHint,
          submit: t.changePassword,
          pending: dict.auth.pending,
          done: t.passwordChanged,
        }}
      />
    </main>
  );
}
