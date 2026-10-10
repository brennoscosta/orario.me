import type { Metadata } from "next";
import Link from "next/link";
import { and, asc, eq } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import { ActivityForm } from "@/components/ActivityForm";
import { getDb, schema } from "@/db";
import { getUser } from "@/lib/auth";
import { activityFormOptions } from "@/lib/form-options";
import { getDict } from "@/lib/i18n";
import { isLocale } from "@/lib/i18n/config";
import { MAX_REMINDERS_PER_ACTIVITY } from "@/lib/plans";
import { dayKey, inputTime } from "@/lib/time";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return { title: isLocale(locale) ? getDict(locale).form.titleEdit : undefined };
}

export default async function EditActivityPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  if (!isLocale(locale)) notFound();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id)) notFound();
  const user = await getUser();
  if (!user) redirect(`/${locale}/login`);
  const db = getDb();
  const rows = await db
    .select()
    .from(schema.activities)
    .where(and(eq(schema.activities.id, id), eq(schema.activities.userId, user.id)))
    .limit(1);
  const activity = rows[0];
  if (!activity) notFound();
  const reminders = await db
    .select()
    .from(schema.reminders)
    .where(eq(schema.reminders.activityId, id))
    .orderBy(asc(schema.reminders.sendAt));

  const dict = getDict(locale);
  const options = await activityFormOptions(locale, dict, user, activity);
  return (
    <main id="main" className="sheet sheet--wide">
      <h1 className="display">{dict.form.titleEdit}</h1>
      <ActivityForm
        locale={locale}
        t={options.strings}
        offsets={options.offsets}
        channels={options.channels}
        maxReminders={MAX_REMINDERS_PER_ACTIVITY}
        fields={options.fields}
        initial={{
          id: activity.id,
          title: activity.title,
          date: dayKey(activity.startsAt, user.timezone),
          time: inputTime(activity.startsAt, user.timezone),
          reminders: reminders.map((r) => ({ offset: String(r.offsetMinutes), channel: r.channel })),
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
