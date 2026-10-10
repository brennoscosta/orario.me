import type { Metadata } from "next";
import Link from "next/link";
import { and, asc, desc, eq, gte, inArray, lt } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import { deleteActivity } from "../actions";
import { getDb, schema } from "@/db";
import type { Reminder } from "@/db/schema";
import { activityDetails, loadExtraDetails } from "@/lib/activity-fields";
import { getUser } from "@/lib/auth";
import { getDict } from "@/lib/i18n";
import { isLocale } from "@/lib/i18n/config";
import { offsetLabel } from "@/lib/i18n/labels";
import { isChannel } from "@/lib/plans";
import { addDaysKey, dayKey, longDay, timeOfDay, zonedToUtc } from "@/lib/time";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return { title: isLocale(locale) ? getDict(locale).nav.agenda : "Agenda" };
}

export default async function AgendaPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ view?: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const user = await getUser();
  if (!user) redirect(`/${locale}/login`);
  const dict = getDict(locale);
  const t = dict.app;
  const past = (await searchParams).view === "past";

  const tz = user.timezone;
  const todayKey = dayKey(new Date(), tz);
  const todayStart = zonedToUtc(todayKey, "00:00", tz) ?? new Date();
  const db = getDb();
  const activities = past
    ? await db
        .select()
        .from(schema.activities)
        .where(
          and(
            eq(schema.activities.userId, user.id),
            lt(schema.activities.startsAt, todayStart),
            gte(schema.activities.startsAt, new Date(todayStart.getTime() - 30 * 86_400_000)),
          ),
        )
        .orderBy(desc(schema.activities.startsAt))
        .limit(200)
    : await db
        .select()
        .from(schema.activities)
        .where(and(eq(schema.activities.userId, user.id), gte(schema.activities.startsAt, todayStart)))
        .orderBy(asc(schema.activities.startsAt))
        .limit(300);

  const remindersByActivity = new Map<string, Reminder[]>();
  if (activities.length > 0) {
    const rows = await db
      .select()
      .from(schema.reminders)
      .where(inArray(schema.reminders.activityId, activities.map((a) => a.id)))
      .orderBy(asc(schema.reminders.sendAt));
    for (const row of rows) {
      const list = remindersByActivity.get(row.activityId) ?? [];
      list.push(row);
      remindersByActivity.set(row.activityId, list);
    }
  }

  const extras = await loadExtraDetails(activities.map((a) => a.id), locale);
  const days: { key: string; items: typeof activities }[] = [];
  for (const activity of activities) {
    const key = dayKey(activity.startsAt, tz);
    const last = days[days.length - 1];
    if (last && last.key === key) last.items.push(activity);
    else days.push({ key, items: [activity] });
  }
  const tomorrowKey = addDaysKey(todayKey, 1);
  const firstName = user.name.trim().split(/\s+/)[0];

  return (
    <main id="main" className="agenda">
      <div className="agenda-head">
        <h1 className="display">{t.greeting(firstName)}</h1>
        <Link href={`/${locale}/app/new`} className="button">
          {t.newActivity}
        </Link>
      </div>
      <nav className="tabs" aria-label={dict.nav.agenda}>
        <Link href={`/${locale}/app`} aria-current={past ? undefined : "page"}>
          {t.upcoming}
        </Link>
        <Link href={`/${locale}/app?view=past`} aria-current={past ? "page" : undefined}>
          {t.past}
        </Link>
      </nav>

      {days.length === 0 &&
        (past ? (
          <p className="soft" style={{ marginTop: "2rem" }}>
            {t.emptyPast}
          </p>
        ) : (
          <div className="empty">
            <h2 className="display">{t.emptyTitle}</h2>
            <p>{t.emptyBody}</p>
            <Link href={`/${locale}/app/new`} className="button">
              {t.newActivity}
            </Link>
          </div>
        ))}

      {days.map((day) => {
        const label = longDay(day.items[0].startsAt, tz, locale);
        const relative = day.key === todayKey ? t.today : day.key === tomorrowKey ? t.tomorrow : null;
        return (
          <section className="day" key={day.key}>
            <h2>
              {relative ?? label}
              {relative && <small>{label}</small>}
            </h2>
            <ul>
              {day.items.map((activity) => {
                const reminders = remindersByActivity.get(activity.id) ?? [];
                return (
                  <li className="entry" key={activity.id}>
                    <span className="entry-time">{timeOfDay(activity.startsAt, tz, locale)}</span>
                    <div>
                      <p className="entry-title">{activity.title}</p>
                      {activityDetails(activity, locale, extras.get(activity.id)).map((d) => (
                        <p className="entry-meta" key={d.key}>
                          {d.plain ? d.value : `${d.label}: ${d.value}`}
                        </p>
                      ))}
                    </div>
                    <div className="entry-actions">
                      <Link href={`/${locale}/app/${activity.id}`}>{t.edit}</Link>
                      <details>
                        <summary>{t.delete}</summary>
                        <form action={deleteActivity} className="confirm">
                          <input type="hidden" name="locale" value={locale} />
                          <input type="hidden" name="id" value={activity.id} />
                          <p>{t.confirmDelete}</p>
                          <button type="submit" className="button button--small">
                            {t.confirmDeleteYes}
                          </button>
                        </form>
                      </details>
                    </div>
                    <div className="chips">
                      {reminders.length === 0 && <span className="soft" style={{ fontSize: "0.85rem" }}>{t.noReminders}</span>}
                      {reminders.map((r) => {
                        const status = (r.status in t.status ? r.status : "pending") as keyof typeof t.status;
                        const channel = isChannel(r.channel) ? dict.channels[r.channel] : r.channel;
                        const fellBack = r.status === "sent" && r.deliveredVia && r.deliveredVia !== r.channel;
                        return (
                          <span className={`chip chip--${status}`} key={r.id}>
                            <span>
                              <b>{channel}</b>, {offsetLabel(r.offsetMinutes, locale).toLowerCase()}
                            </span>
                            <span>{fellBack ? t.sentByEmailInstead : t.status[status]}</span>
                          </span>
                        );
                      })}
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </main>
  );
}
