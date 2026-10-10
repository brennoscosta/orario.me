import type { Activity, User } from "@/db/schema";
import { dayKey, longDay, timeOfDay } from "../time";
import { SITE_URL, type Locale } from "./config";
import { durationLabel } from "./labels";

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

export function reminderMessage(input: { locale: Locale; user: User; activity: Activity; offsetMinutes: number }) {
  const { locale, user, activity, offsetMinutes } = input;
  const tz = user.timezone;
  const time = timeOfDay(activity.startsAt, tz, locale);
  const isToday = dayKey(activity.startsAt, tz) === dayKey(new Date(), tz);
  const day = longDay(activity.startsAt, tz, locale);
  const firstName = user.name.trim().split(/\s+/)[0];
  const pt = locale === "pt";

  let headline: string;
  if (offsetMinutes === 0) {
    headline = pt ? `Está na hora: ${activity.title}, às ${time}.` : `It's time: ${activity.title}, at ${time}.`;
  } else {
    const lead = durationLabel(offsetMinutes, locale);
    const when = isToday
      ? pt ? `às ${time}` : `at ${time}`
      : pt ? `${day.toLowerCase()}, às ${time}` : `${day}, at ${time}`;
    headline = pt
      ? `${activity.title} começa em ${lead}, ${when}.`
      : `${activity.title} starts in ${lead}, ${when}.`;
  }

  const greeting = pt ? `Com licença, ${firstName}.` : `Pardon the interruption, ${firstName}.`;
  const lines = [`${greeting} ${headline}`];
  if (activity.location) lines.push(`${pt ? "Local" : "Place"}: ${activity.location}`);
  const short = `${lines.join(" ")} — Orario`;
  if (activity.notes) lines.push(`${pt ? "Observações" : "Notes"}: ${activity.notes}`);
  const text = `${lines.join("\n")}\n\nOrario · ${SITE_URL.replace(/^https?:\/\//, "")}`;

  const subject = pt ? `Lembrete: ${activity.title}, ${time}` : `Reminder: ${activity.title}, ${time}`;
  const detail = (label: string, value: string) =>
    `<tr><td style="padding:6px 16px 6px 0;color:#5a647a;font-size:14px;vertical-align:top">${label}</td><td style="padding:6px 0;font-size:15px;color:#0f1b33">${escapeHtml(value)}</td></tr>`;
  const html = `<!doctype html><html lang="${pt ? "pt-BR" : "en"}"><body style="margin:0;background:#f4f6f7;padding:32px 16px;font-family:Helvetica,Arial,sans-serif;color:#0f1b33">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
<table role="presentation" width="520" cellpadding="0" cellspacing="0" style="max-width:520px;width:100%;background:#ffffff;border:1px solid #dde2e7">
<tr><td style="padding:28px 32px 8px;font-family:Georgia,'Times New Roman',serif;font-size:22px;letter-spacing:.04em">Orario</td></tr>
<tr><td style="padding:8px 32px 0;font-size:15px;color:#5a647a">${escapeHtml(greeting)}</td></tr>
<tr><td style="padding:6px 32px 18px;font-family:Georgia,'Times New Roman',serif;font-size:24px;line-height:1.3">${escapeHtml(headline)}</td></tr>
<tr><td style="padding:0 32px 28px"><table role="presentation" cellpadding="0" cellspacing="0" style="border-top:1px solid #dde2e7;width:100%">
${detail(pt ? "Quando" : "When", `${day}, ${time}`)}
${activity.location ? detail(pt ? "Local" : "Place", activity.location) : ""}
${activity.notes ? detail(pt ? "Observações" : "Notes", activity.notes) : ""}
</table></td></tr>
<tr><td style="padding:16px 32px;border-top:1px solid #dde2e7;font-size:13px;color:#5a647a"><a href="${SITE_URL}/${locale}/app" style="color:#0f1b33">${pt ? "Abrir minha agenda" : "Open my agenda"}</a></td></tr>
</table></td></tr></table></body></html>`;

  return { subject, text, short, html };
}
