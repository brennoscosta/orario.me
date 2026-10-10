import "server-only";
import { eq } from "drizzle-orm";
import { getDb, getSql, schema } from "@/db";
import type { Activity, User } from "@/db/schema";
import { loadExtraDetails } from "./activity-fields";
import { configuredChannels, sendEmail, sendSms, sendWhatsApp } from "./channels";
import { countdownTick } from "./countdown";
import { isLocale, type Locale } from "./i18n/config";
import { reminderMessage } from "./i18n/messages";
import { monthlyLimit } from "./limits";
import { isChannel, type Channel } from "./plans";
import { usedThisMonth } from "./usage";

const TICK_MS = 30_000;
const MAX_ATTEMPTS = 3;
/** Reminders are dropped when the activity started more than this long ago. */
const LATE_MS = 60 * 60_000;

type Claimed = { id: string; activity_id: string; user_id: string; channel: string; offset_minutes: number; attempts: number };

/** Picks the channel that will actually carry the reminder, falling back to email. */
async function resolveChannel(user: User, wanted: Channel): Promise<{ channel: Channel; note: string | null } | null> {
  const ready = await configuredChannels();
  if (wanted !== "email") {
    let note: string | null = null;
    if (!ready[wanted]) note = "channel_unavailable";
    else if (!user.phone) note = "no_phone";
    else {
      const limit = await monthlyLimit(user.plan, wanted);
      if (limit !== null && (await usedThisMonth(user.id, wanted)) >= limit) note = "limit_reached";
    }
    if (!note) return { channel: wanted, note: null };
    if (ready.email) return { channel: "email", note };
    return null;
  }
  return ready.email ? { channel: "email", note: null } : null;
}

async function deliver(user: User, activity: Activity, channel: Channel, offsetMinutes: number): Promise<void> {
  const locale: Locale = isLocale(user.locale) ? user.locale : "pt";
  const extras = (await loadExtraDetails([activity.id], locale)).get(activity.id);
  const msg = reminderMessage({ locale, user, activity, offsetMinutes, extras });
  if (channel === "email") await sendEmail({ to: user.email, subject: msg.subject, text: msg.text, html: msg.html });
  else if (channel === "whatsapp") await sendWhatsApp(user.phone!, msg.text);
  else await sendSms(user.phone!, msg.short);
}

async function processOne(row: Claimed): Promise<void> {
  const db = getDb();
  const finish = (values: Partial<typeof schema.reminders.$inferInsert>) =>
    db.update(schema.reminders).set(values).where(eq(schema.reminders.id, row.id));

  const found = await db
    .select({ activity: schema.activities, user: schema.users })
    .from(schema.activities)
    .innerJoin(schema.users, eq(schema.users.id, schema.activities.userId))
    .where(eq(schema.activities.id, row.activity_id))
    .limit(1);
  const pair = found[0];
  if (!pair) return void (await finish({ status: "skipped", error: "activity_missing" }));

  const { activity, user } = pair;
  if (Date.now() - activity.startsAt.getTime() > LATE_MS) {
    return void (await finish({ status: "skipped", error: "too_late" }));
  }

  const wanted: Channel = isChannel(row.channel) ? row.channel : "email";
  const resolved = await resolveChannel(user, wanted);
  if (!resolved) return void (await finish({ status: "failed", error: "channel_unavailable" }));

  try {
    await deliver(user, activity, resolved.channel, row.offset_minutes);
    await db.insert(schema.deliveries).values({ userId: user.id, channel: resolved.channel });
    await finish({ status: "sent", sentAt: new Date(), deliveredVia: resolved.channel, error: resolved.note });
  } catch (err) {
    const attempts = row.attempts + 1;
    const message = (err as Error).message.slice(0, 500);
    console.error(`[orario] reminder ${row.id} failed (attempt ${attempts}):`, message);
    await finish({ attempts, error: message, status: attempts >= MAX_ATTEMPTS ? "failed" : "pending" });
  }
}

export async function tick(): Promise<number> {
  const pg = getSql();
  const claimed = await pg<Claimed[]>`
    update reminders set status = 'sending', claimed_at = now()
    where id in (
      select id from reminders
      where send_at <= now()
        and (
          (status = 'pending' and (claimed_at is null or claimed_at < now() - interval '2 minutes'))
          or (status = 'sending' and claimed_at < now() - interval '10 minutes')
        )
      order by send_at
      limit 25
      for update skip locked
    )
    returning id, activity_id, user_id, channel, offset_minutes, attempts`;
  for (const row of claimed) {
    try {
      await processOne(row);
    } catch (err) {
      console.error(`[orario] reminder ${row.id} crashed:`, err);
    }
  }
  return claimed.length;
}

const globalForScheduler = globalThis as unknown as { __orarioScheduler?: boolean };

export function startScheduler(): void {
  if (globalForScheduler.__orarioScheduler) return;
  globalForScheduler.__orarioScheduler = true;
  let running = false;
  let lastCountdown = 0;
  const run = async () => {
    if (running) return;
    running = true;
    try {
      await tick();
    } catch (err) {
      console.error("[orario] scheduler tick failed:", (err as Error).message);
    }
    try {
      // Countdown emails are checked once a minute.
      if (Date.now() - lastCountdown >= 60_000) {
        lastCountdown = Date.now();
        await countdownTick();
      }
    } catch (err) {
      console.error("[orario] countdown tick failed:", (err as Error).message);
    } finally {
      running = false;
    }
  };
  setInterval(run, TICK_MS).unref();
  void run();
  console.log("[orario] reminder scheduler started");
}
