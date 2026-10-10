"use server";

import { and, eq, inArray, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDb, schema } from "@/db";
import { readFieldValues } from "@/lib/activity-fields";
import { createSession, destroyOtherSessions, destroySession, getUser, hashPassword, verifyPassword } from "@/lib/auth";
import { getDict } from "@/lib/i18n";
import { defaultLocale, isLocale, type Locale } from "@/lib/i18n/config";
import { normalizePhone } from "@/lib/phone";
import { isChannel, MAX_REMINDERS_PER_ACTIVITY, offsetOptions, type Channel } from "@/lib/plans";
import { allow } from "@/lib/rate-limit";
import { isValidTimezone, zonedToUtc } from "@/lib/time";

export type FormState = { error?: string; ok?: boolean; values?: Record<string, string> };

/** Error state that echoes the typed values back, so the form keeps them. */
function fail(form: FormData, error: string): FormState {
  const values: Record<string, string> = {};
  for (const [key, value] of form.entries()) {
    if (typeof value === "string" && key !== "password" && !key.startsWith("reminder")) values[key] = value;
  }
  return { error, values };
}

function localeOf(form: FormData): Locale {
  const value = String(form.get("locale") ?? "");
  return isLocale(value) ? value : defaultLocale;
}

function field(form: FormData, name: string, max = 500): string {
  return String(form.get(name) ?? "").trim().slice(0, max);
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export async function signup(_prev: FormState, form: FormData): Promise<FormState> {
  const locale = localeOf(form);
  const t = getDict(locale).errors;
  if (!process.env.DATABASE_URL) return fail(form, t.unavailable);
  if (!(await allow("signup", 8, 10 * 60_000))) return fail(form, t.rateLimited);

  const name = field(form, "name", 80);
  const email = field(form, "email", 200).toLowerCase();
  const password = String(form.get("password") ?? "");
  const phoneRaw = field(form, "phone", 30);
  const tzRaw = field(form, "timezone", 60);

  if (!name) return fail(form, t.nameRequired);
  if (!EMAIL_RE.test(email)) return fail(form, t.emailInvalid);
  if (password.length < 8 || password.length > 200) return fail(form, t.passwordShort);
  const phone = phoneRaw ? normalizePhone(phoneRaw) : null;
  if (phoneRaw && !phone) return fail(form, t.phoneInvalid);
  const timezone = isValidTimezone(tzRaw) && tzRaw ? tzRaw : "America/Sao_Paulo";

  try {
    const db = getDb();
    const existing = await db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.email, email)).limit(1);
    if (existing.length > 0) return fail(form, t.emailTaken);
    const [user] = await db
      .insert(schema.users)
      .values({ name, email, passwordHash: await hashPassword(password), phone, locale, timezone })
      .returning({ id: schema.users.id });
    await createSession(user.id);
  } catch (err) {
    console.error("[orario] signup failed:", err);
    return fail(form, t.generic);
  }
  redirect(`/${locale}/app`);
}

export async function login(_prev: FormState, form: FormData): Promise<FormState> {
  const locale = localeOf(form);
  const t = getDict(locale).errors;
  if (!process.env.DATABASE_URL) return fail(form, t.unavailable);
  if (!(await allow("login", 10, 10 * 60_000))) return fail(form, t.rateLimited);

  const email = field(form, "email", 200).toLowerCase();
  const password = String(form.get("password") ?? "");
  try {
    const rows = await getDb().select().from(schema.users).where(eq(schema.users.email, email)).limit(1);
    const user = rows[0];
    const valid = user ? await verifyPassword(password, user.passwordHash) : false;
    if (!user || !valid) return fail(form, t.credentials);
    await createSession(user.id);
  } catch (err) {
    console.error("[orario] login failed:", err);
    return fail(form, t.generic);
  }
  redirect(`/${locale}/app`);
}

export async function logout(form: FormData): Promise<void> {
  const locale = localeOf(form);
  await destroySession();
  redirect(`/${locale}`);
}

type ReminderInput = { offsetMinutes: number; channel: Channel };

function readReminders(form: FormData): ReminderInput[] {
  const offsets = form.getAll("reminderOffset").map((v) => Number(v));
  const chans = form.getAll("reminderChannel").map(String);
  const seen = new Set<string>();
  const out: ReminderInput[] = [];
  for (let i = 0; i < offsets.length && out.length < MAX_REMINDERS_PER_ACTIVITY; i++) {
    const offsetMinutes = offsets[i];
    const channel = chans[i] ?? "";
    if (!(offsetOptions as readonly number[]).includes(offsetMinutes) || !isChannel(channel)) continue;
    const key = `${offsetMinutes}:${channel}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ offsetMinutes, channel });
  }
  return out;
}

export async function saveActivity(_prev: FormState, form: FormData): Promise<FormState> {
  const locale = localeOf(form);
  const t = getDict(locale).errors;
  const user = await getUser();
  if (!user) redirect(`/${locale}/login`);

  const id = field(form, "id", 40);
  const title = field(form, "title", 120);
  const details = readFieldValues(form);
  if (!title) return fail(form, t.titleRequired);
  if (details.missing) return fail(form, `${t.fieldRequired} ${details.missing.label[locale]}`);
  const startsAt = zonedToUtc(field(form, "date", 10), field(form, "time", 5), user.timezone);
  if (!startsAt) return fail(form, t.dateInvalid);
  const wanted = readReminders(form);

  try {
    const db = getDb();
    await db.transaction(async (tx) => {
      let activityId = id;
      let keep = new Set<string>();
      if (id) {
        const rows = await tx
          .select()
          .from(schema.activities)
          .where(and(eq(schema.activities.id, id), eq(schema.activities.userId, user.id)))
          .limit(1);
        const current = rows[0];
        if (!current) throw new Error("not_found");
        const sameTime = current.startsAt.getTime() === startsAt.getTime();
        await tx
          .update(schema.activities)
          .set({ ...details.values, title, startsAt })
          .where(eq(schema.activities.id, id));
        if (sameTime) {
          // Reminders already delivered stay as they are when still requested.
          const sent = await tx
            .select()
            .from(schema.reminders)
            .where(and(eq(schema.reminders.activityId, id), eq(schema.reminders.status, "sent")));
          const wantedKeys = new Set(wanted.map((r) => `${r.offsetMinutes}:${r.channel}`));
          const keepIds = sent.filter((r) => wantedKeys.has(`${r.offsetMinutes}:${r.channel}`));
          keep = new Set(keepIds.map((r) => `${r.offsetMinutes}:${r.channel}`));
          const ids = keepIds.map((r) => r.id);
          await tx
            .delete(schema.reminders)
            .where(
              ids.length > 0
                ? and(eq(schema.reminders.activityId, id), ne(schema.reminders.status, "sent"))
                : eq(schema.reminders.activityId, id),
            );
          if (ids.length > 0) {
            const stale = sent.filter((r) => !ids.includes(r.id)).map((r) => r.id);
            if (stale.length > 0) await tx.delete(schema.reminders).where(inArray(schema.reminders.id, stale));
          }
        } else {
          await tx.delete(schema.reminders).where(eq(schema.reminders.activityId, id));
        }
      } else {
        const [created] = await tx
          .insert(schema.activities)
          .values({ ...details.values, userId: user.id, title, startsAt })
          .returning({ id: schema.activities.id });
        activityId = created.id;
      }

      const now = Date.now();
      const fresh = wanted
        .filter((r) => !keep.has(`${r.offsetMinutes}:${r.channel}`))
        .map((r) => {
          const sendAt = new Date(startsAt.getTime() - r.offsetMinutes * 60_000);
          const late = sendAt.getTime() < now - 60_000;
          return {
            activityId,
            userId: user.id,
            channel: r.channel,
            offsetMinutes: r.offsetMinutes,
            sendAt,
            status: late ? "skipped" : "pending",
            error: late ? "created_late" : null,
          };
        });
      if (fresh.length > 0) await tx.insert(schema.reminders).values(fresh);
    });
  } catch (err) {
    if ((err as Error).message === "not_found") return fail(form, t.notFound);
    console.error("[orario] saveActivity failed:", err);
    return fail(form, t.generic);
  }
  revalidatePath(`/${locale}/app`);
  redirect(`/${locale}/app`);
}

export async function deleteActivity(form: FormData): Promise<void> {
  const locale = localeOf(form);
  const user = await getUser();
  if (!user) redirect(`/${locale}/login`);
  const id = field(form, "id", 40);
  if (/^[0-9a-f-]{36}$/.test(id)) {
    await getDb()
      .delete(schema.activities)
      .where(and(eq(schema.activities.id, id), eq(schema.activities.userId, user.id)));
  }
  revalidatePath(`/${locale}/app`);
  redirect(`/${locale}/app`);
}

export async function saveSettings(_prev: FormState, form: FormData): Promise<FormState> {
  const locale = localeOf(form);
  const t = getDict(locale).errors;
  const user = await getUser();
  if (!user) redirect(`/${locale}/login`);

  const name = field(form, "name", 80);
  const phoneRaw = field(form, "phone", 30);
  const timezone = field(form, "timezone", 60);
  const language = field(form, "language", 5);
  if (!name) return fail(form, t.nameRequired);
  const phone = phoneRaw ? normalizePhone(phoneRaw) : null;
  if (phoneRaw && !phone) return fail(form, t.phoneInvalid);
  if (!timezone || !isValidTimezone(timezone)) return fail(form, t.timezoneInvalid);
  const newLocale = isLocale(language) ? language : locale;
  const dailyDigest = form.get("dailyDigest") === "on";
  const hour = Number(field(form, "digestHour", 2));
  const digestHour = Number.isInteger(hour) && hour >= 0 && hour <= 23 ? hour : user.digestHour;

  try {
    await getDb()
      .update(schema.users)
      .set({ name, phone, timezone, locale: newLocale, dailyDigest, digestHour })
      .where(eq(schema.users.id, user.id));
  } catch (err) {
    console.error("[orario] saveSettings failed:", err);
    return fail(form, t.generic);
  }
  if (newLocale !== locale) redirect(`/${newLocale}/app/settings?saved=1`);
  revalidatePath(`/${locale}/app`, "layout");
  return { ok: true };
}

export async function changePassword(_prev: FormState, form: FormData): Promise<FormState> {
  const locale = localeOf(form);
  const t = getDict(locale).errors;
  const user = await getUser();
  if (!user) redirect(`/${locale}/login`);
  if (!(await allow("password", 8, 10 * 60_000))) return { error: t.rateLimited };
  const current = String(form.get("currentPassword") ?? "");
  const next = String(form.get("newPassword") ?? "");
  if (!(await verifyPassword(current, user.passwordHash))) return { error: t.currentPasswordWrong };
  if (next.length < 8 || next.length > 200) return { error: t.passwordShort };
  try {
    await getDb().update(schema.users).set({ passwordHash: await hashPassword(next) }).where(eq(schema.users.id, user.id));
    await destroyOtherSessions(user.id);
  } catch (err) {
    console.error("[orario] changePassword failed:", err);
    return { error: t.generic };
  }
  return { ok: true };
}
