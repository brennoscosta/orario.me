import "server-only";
import { and, asc, eq, gt, lte } from "drizzle-orm";
import { getDb, getSql, schema } from "@/db";
import type { Activity, User } from "@/db/schema";
import { loadExtraDetails } from "./activity-fields";
import { configuredChannels, sendEmail } from "./channels";
import { isLocale, type Locale } from "./i18n/config";
import { digestMessage, todayMessage, type Message } from "./i18n/messages";
import { dayKey } from "./time";

/** Hours before the appointment at which the "it's today" email goes out. */
export const TODAY_LEAD_HOURS = 3;
const MAX_DIGEST_ITEMS = 40;

const localeOf = (user: User): Locale => (isLocale(user.locale) ? user.locale : "pt");

/**
 * Sends one email at most once: the notice row is the claim. When the send
 * fails the claim is released so the next pass tries again.
 */
async function sendOnce(user: User, kind: string, key: string, build: () => Promise<Message>): Promise<boolean> {
  const db = getDb();
  const claimed = await db
    .insert(schema.notices)
    .values({ userId: user.id, kind, key })
    .onConflictDoNothing()
    .returning({ id: schema.notices.id });
  if (claimed.length === 0) return false;
  try {
    const msg = await build();
    await sendEmail({ to: user.email, subject: msg.subject, text: msg.text, html: msg.html });
    await db.insert(schema.deliveries).values({ userId: user.id, channel: "email" });
    return true;
  } catch (err) {
    console.error(`[orario] ${kind} email to ${user.id} failed:`, (err as Error).message);
    await db.delete(schema.notices).where(eq(schema.notices.id, claimed[0].id));
    return false;
  }
}

/** Daily email with the days left for each upcoming appointment, at the user's chosen hour. */
async function sendDigests(): Promise<number> {
  const due = await getSql()<{ id: string }[]>`
    select u.id from users u
    where u.daily_digest
      and extract(hour from now() at time zone u.timezone)::int = u.digest_hour
      and exists (select 1 from activities a where a.user_id = u.id and a.starts_at > now())
      and not exists (
        select 1 from notices n
        where n.user_id = u.id and n.kind = 'digest'
          and n.key = to_char(now() at time zone u.timezone, 'YYYY-MM-DD')
      )
    limit 200`;
  let sent = 0;
  const db = getDb();
  for (const row of due) {
    const [user] = await db.select().from(schema.users).where(eq(schema.users.id, row.id)).limit(1);
    if (!user) continue;
    const ok = await sendOnce(user, "digest", dayKey(new Date(), user.timezone), async () => {
      const activities = await db
        .select()
        .from(schema.activities)
        .where(and(eq(schema.activities.userId, user.id), gt(schema.activities.startsAt, new Date())))
        .orderBy(asc(schema.activities.startsAt))
        .limit(MAX_DIGEST_ITEMS);
      const locale = localeOf(user);
      const extras = await loadExtraDetails(activities.map((a) => a.id), locale);
      return digestMessage({ locale, user, activities, extras });
    });
    if (ok) sent += 1;
  }
  return sent;
}

/** "É HOJE! Faltam 3 horas para …", once per appointment (again if it is rescheduled). */
async function sendTodayNotices(): Promise<number> {
  const db = getDb();
  const now = Date.now();
  const rows = await db
    .select({ activity: schema.activities, user: schema.users })
    .from(schema.activities)
    .innerJoin(schema.users, eq(schema.users.id, schema.activities.userId))
    .where(
      and(
        eq(schema.users.dailyDigest, true),
        gt(schema.activities.startsAt, new Date(now + (TODAY_LEAD_HOURS - 1) * 3_600_000)),
        lte(schema.activities.startsAt, new Date(now + TODAY_LEAD_HOURS * 3_600_000)),
      ),
    )
    .orderBy(asc(schema.activities.startsAt))
    .limit(500);
  let sent = 0;
  for (const { activity, user } of rows as { activity: Activity; user: User }[]) {
    const key = `${activity.id}:${activity.startsAt.toISOString()}`;
    const ok = await sendOnce(user, "today", key, async () => {
      const locale = localeOf(user);
      const extras = (await loadExtraDetails([activity.id], locale)).get(activity.id);
      return todayMessage({ locale, user, activity, extras });
    });
    if (ok) sent += 1;
  }
  return sent;
}

export async function countdownTick(): Promise<void> {
  if (!(await configuredChannels()).email) return;
  await sendTodayNotices();
  await sendDigests();
}
