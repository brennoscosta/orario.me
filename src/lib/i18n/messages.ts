import type { Activity, User } from "@/db/schema";
import { activityDetails, type Detail } from "../activity-fields";
import { dayKey, inputTime, longDay, timeOfDay } from "../time";
import { SITE_URL, type Locale } from "./config";
import { durationLabel } from "./labels";

/**
 * Every email is built here from the same pieces: one layout and the detail
 * rows of each appointment (activityDetails). A new appointment field shows up
 * in all of them without touching this file.
 */

export type Message = { subject: string; text: string; short: string; html: string };

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

const firstNameOf = (user: User) => user.name.trim().split(/\s+/)[0];
const siteHost = SITE_URL.replace(/^https?:\/\//, "");

type Block = {
  /** Small line above the title, such as "É HOJE" or "Faltam 5 dias". */
  tag?: string;
  title?: string;
  rows: { label: string; value: string }[];
};

function renderEmail(input: { locale: Locale; greeting: string; headline: string; blocks: Block[]; footer?: string }): string {
  const { locale, greeting, headline, blocks, footer } = input;
  const pt = locale === "pt";
  const row = (r: { label: string; value: string }) =>
    `<tr><td style="padding:5px 16px 5px 0;color:#5a647a;font-size:14px;vertical-align:top;white-space:nowrap">${escapeHtml(r.label)}</td><td style="padding:5px 0;font-size:15px;color:#0f1b33">${escapeHtml(r.value)}</td></tr>`;
  const block = (b: Block) =>
    `<tr><td style="padding:16px 32px;border-top:1px solid #dde2e7">` +
    (b.tag ? `<div style="font-size:13px;color:#a38547;font-weight:bold;letter-spacing:.02em">${escapeHtml(b.tag)}</div>` : "") +
    (b.title ? `<div style="font-family:Georgia,'Times New Roman',serif;font-size:19px;padding:2px 0 6px">${escapeHtml(b.title)}</div>` : "") +
    `<table role="presentation" cellpadding="0" cellspacing="0">${b.rows.map(row).join("")}</table></td></tr>`;
  return `<!doctype html><html lang="${pt ? "pt-BR" : "en"}"><body style="margin:0;background:#f4f6f7;padding:32px 16px;font-family:Helvetica,Arial,sans-serif;color:#0f1b33">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
<table role="presentation" width="520" cellpadding="0" cellspacing="0" style="max-width:520px;width:100%;background:#ffffff;border:1px solid #dde2e7">
<tr><td style="padding:28px 32px 8px;font-family:Georgia,'Times New Roman',serif;font-size:22px;letter-spacing:.04em">Orario</td></tr>
<tr><td style="padding:8px 32px 0;font-size:15px;color:#5a647a">${escapeHtml(greeting)}</td></tr>
<tr><td style="padding:6px 32px 20px;font-family:Georgia,'Times New Roman',serif;font-size:24px;line-height:1.3">${escapeHtml(headline)}</td></tr>
${blocks.map(block).join("\n")}
<tr><td style="padding:16px 32px;border-top:1px solid #dde2e7;font-size:13px;color:#5a647a"><a href="${SITE_URL}/${locale}/app" style="color:#0f1b33">${pt ? "Abrir minha agenda" : "Open my agenda"}</a>${footer ? `<br><br>${footer}` : ""}</td></tr>
</table></td></tr></table></body></html>`;
}

function whenRow(activity: Activity, tz: string, locale: Locale) {
  return {
    label: locale === "pt" ? "Quando" : "When",
    value: `${longDay(activity.startsAt, tz, locale)}, ${timeOfDay(activity.startsAt, tz, locale)}`,
  };
}

function textLines(details: Detail[]): string[] {
  return details.map((d) => `${d.label}: ${d.value}`);
}

/** The reminder a user scheduled for one appointment. */
export function reminderMessage(input: {
  locale: Locale;
  user: User;
  activity: Activity;
  offsetMinutes: number;
  extras?: Detail[];
}): Message {
  const { locale, user, activity, offsetMinutes } = input;
  const tz = user.timezone;
  const pt = locale === "pt";
  const time = timeOfDay(activity.startsAt, tz, locale);
  const isToday = dayKey(activity.startsAt, tz) === dayKey(new Date(), tz);
  const day = longDay(activity.startsAt, tz, locale);
  const details = activityDetails(activity, locale, input.extras);

  let headline: string;
  if (offsetMinutes === 0) {
    headline = pt ? `Está na hora: ${activity.title}, às ${time}.` : `It's time: ${activity.title}, at ${time}.`;
  } else {
    const lead = durationLabel(offsetMinutes, locale);
    const when = isToday ? (pt ? `às ${time}` : `at ${time}`) : pt ? `${day.toLowerCase()}, às ${time}` : `${day}, at ${time}`;
    headline = pt ? `${activity.title} começa em ${lead}, ${when}.` : `${activity.title} starts in ${lead}, ${when}.`;
  }
  const greeting = pt ? `Com licença, ${firstNameOf(user)}.` : `Pardon the interruption, ${firstNameOf(user)}.`;
  const compact = details.filter((d) => d.plain && d.key !== "notes").map((d) => `${d.label}: ${d.value}`);
  return {
    subject: pt ? `Lembrete: ${activity.title}, ${time}` : `Reminder: ${activity.title}, ${time}`,
    short: `${[`${greeting} ${headline}`, ...compact].join(" ")} — Orario`,
    text: `${[`${greeting} ${headline}`, ...textLines(details)].join("\n")}\n\nOrario · ${siteHost}`,
    html: renderEmail({ locale, greeting, headline, blocks: [{ rows: [whenRow(activity, tz, locale), ...details] }] }),
  };
}

function settingsFooter(locale: Locale): string {
  const link = `<a href="${SITE_URL}/${locale}/app/settings" style="color:#5a647a">`;
  return locale === "pt"
    ? `Você recebe este email porque a contagem regressiva está ligada. Para mudar a hora ou desligar, abra as ${link}configurações</a>.`
    : `You get this email because the countdown is on. To change the time or turn it off, open ${link}settings</a>.`;
}

/** Whole calendar days between today and the appointment, in the user's time zone. */
export function daysUntil(activity: Activity, tz: string, now = new Date()): number {
  const toUtc = (key: string) => {
    const [y, m, d] = key.split("-").map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((toUtc(dayKey(activity.startsAt, tz)) - toUtc(dayKey(now, tz))) / 86_400_000);
}

function hoursLeft(activity: Activity, locale: Locale, now = new Date()): string {
  const minutes = Math.max(0, Math.round((activity.startsAt.getTime() - now.getTime()) / 60_000));
  const pt = locale === "pt";
  if (minutes < 50) return pt ? `faltam ${Math.max(1, minutes)} minutos` : `${Math.max(1, minutes)} minutes to go`;
  const hours = Math.round(minutes / 60);
  if (hours === 1) return pt ? "falta 1 hora" : "1 hour to go";
  return pt ? `faltam ${hours} horas` : `${hours} hours to go`;
}

/** "É HOJE", "É amanhã", "Faltam 5 dias". */
function countdownTag(days: number, locale: Locale): string {
  const pt = locale === "pt";
  if (days <= 0) return pt ? "É HOJE" : "IT'S TODAY";
  if (days === 1) return pt ? "É amanhã" : "It's tomorrow";
  return pt ? `Faltam ${days} dias` : `${days} days to go`;
}

function countdownSentence(activity: Activity, days: number, tz: string, locale: Locale, now: Date): string {
  const pt = locale === "pt";
  const time = timeOfDay(activity.startsAt, tz, locale);
  if (days <= 0) {
    return pt
      ? `É HOJE: ${activity.title}, às ${time} (${hoursLeft(activity, locale, now)}).`
      : `IT'S TODAY: ${activity.title}, at ${time} (${hoursLeft(activity, locale, now)}).`;
  }
  if (days === 1) return pt ? `É amanhã: ${activity.title}, às ${time}.` : `It's tomorrow: ${activity.title}, at ${time}.`;
  return pt ? `Faltam ${days} dias para ${activity.title}.` : `${days} days to go until ${activity.title}.`;
}

/** The daily email: how many days are left for each upcoming appointment. */
export function digestMessage(input: {
  locale: Locale;
  user: User;
  activities: Activity[];
  extras?: Map<string, Detail[]>;
  now?: Date;
}): Message {
  const { locale, user, activities } = input;
  const now = input.now ?? new Date();
  const tz = user.timezone;
  const pt = locale === "pt";
  const items = activities.map((activity) => ({ activity, days: daysUntil(activity, tz, now) }));
  const first = items[0];
  const firstSentence = countdownSentence(first.activity, first.days, tz, locale, now);
  const others = items.length - 1;
  const headline =
    others === 0
      ? firstSentence
      : pt
        ? `${firstSentence.replace(/\.$/, "")}, e mais ${others} ${others === 1 ? "compromisso" : "compromissos"} a caminho.`
        : `${firstSentence.replace(/\.$/, "")}, and ${others} more ${others === 1 ? "appointment" : "appointments"} ahead.`;
  const hour = Number(inputTime(now, tz).slice(0, 2));
  const salute = pt
    ? hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite"
    : hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const greeting = `${salute}, ${firstNameOf(user)}.`;

  const blocks: Block[] = items.map(({ activity, days }) => ({
    tag: days <= 0 ? `${countdownTag(days, locale)}, ${hoursLeft(activity, locale, now)}` : countdownTag(days, locale),
    title: activity.title,
    rows: [whenRow(activity, tz, locale), ...activityDetails(activity, locale, input.extras?.get(activity.id))],
  }));
  const text = [
    greeting,
    "",
    ...items.flatMap(({ activity, days }) => [
      countdownSentence(activity, days, tz, locale, now),
      `  ${whenRow(activity, tz, locale).value}`,
      ...textLines(activityDetails(activity, locale, input.extras?.get(activity.id))).map((l) => `  ${l}`),
      "",
    ]),
    `Orario · ${siteHost}`,
  ].join("\n");
  const subject = headline.replace(/\.$/, "").replace(/\s*\([^)]*\)/, "");
  return { subject, short: headline, text, html: renderEmail({ locale, greeting, headline, blocks, footer: settingsFooter(locale) }) };
}

/** Sent on the day, a few hours ahead: "É HOJE! Faltam 3 horas para …". */
export function todayMessage(input: { locale: Locale; user: User; activity: Activity; extras?: Detail[]; now?: Date }): Message {
  const { locale, user, activity } = input;
  const now = input.now ?? new Date();
  const tz = user.timezone;
  const pt = locale === "pt";
  const left = hoursLeft(activity, locale, now);
  const sameDay = daysUntil(activity, tz, now) <= 0;
  const leftSentence = pt
    ? `${left.charAt(0).toUpperCase()}${left.slice(1)} para “${activity.title}”`
    : `${left.charAt(0).toUpperCase()}${left.slice(1)} until “${activity.title}”`;
  const headline = sameDay ? `${pt ? "É HOJE!" : "IT'S TODAY!"} ${leftSentence}.` : `${leftSentence}.`;
  const greeting = pt ? `Com licença, ${firstNameOf(user)}.` : `Pardon the interruption, ${firstNameOf(user)}.`;
  const details = activityDetails(activity, locale, input.extras);
  return {
    subject: headline.replace(/\.$/, ""),
    short: `${greeting} ${headline} — Orario`,
    text: `${[`${greeting} ${headline}`, whenRow(activity, tz, locale).value, ...textLines(details)].join("\n")}\n\nOrario · ${siteHost}`,
    html: renderEmail({
      locale,
      greeting,
      headline,
      blocks: [{ rows: [whenRow(activity, tz, locale), ...details] }],
      footer: settingsFooter(locale),
    }),
  };
}

/** Plain message used by the admin panel's "send test" button. */
export function testMessage(): Message {
  const headline = "Este canal está funcionando.";
  const text = `Teste da Orario: ${headline.toLowerCase()}`;
  return {
    subject: "Teste da Orario",
    short: text,
    text,
    html: renderEmail({ locale: "pt", greeting: "Teste da Orario", headline, blocks: [] }),
  };
}
