import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ActivityForm } from "@/components/ActivityForm";
import { getUser } from "@/lib/auth";
import { activityFormOptions } from "@/lib/form-options";
import { getDict } from "@/lib/i18n";
import { isLocale } from "@/lib/i18n/config";
import { MAX_REMINDERS_PER_ACTIVITY } from "@/lib/plans";
import { dayKey } from "@/lib/time";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return { title: isLocale(locale) ? getDict(locale).form.titleNew : undefined };
}

export default async function NewActivityPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const user = await getUser();
  if (!user) redirect(`/${locale}/login`);
  const dict = getDict(locale);
  const options = activityFormOptions(locale, dict, user);
  return (
    <main id="main" className="sheet sheet--wide">
      <h1 className="display">{dict.form.titleNew}</h1>
      <ActivityForm
        locale={locale}
        t={options.strings}
        offsets={options.offsets}
        channels={options.channels}
        maxReminders={MAX_REMINDERS_PER_ACTIVITY}
        initial={{
          title: "",
          date: dayKey(new Date(), user.timezone),
          time: "",
          location: "",
          notes: "",
          reminders: [{ offset: "30", channel: "email" }],
        }}
        note={
          options.phoneNeeded ? (
            <>
              {dict.form.needsPhone} <Link href={`/${locale}/app/settings`}>{dict.nav.settings}</Link>
            </>
          ) : undefined
        }
      />
    </main>
  );
}
