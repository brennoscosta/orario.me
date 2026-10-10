import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { enUS, ptBR } from "date-fns/locale";
import type { Locale } from "./i18n/config";

const dfLocale = { pt: ptBR, en: enUS } as const;

export function isValidTimezone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** Interprets a wall-clock date and time in the given timezone. */
export function zonedToUtc(date: string, time: string, tz: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return null;
  const d = fromZonedTime(`${date}T${time}:00`, tz);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function dayKey(d: Date, tz: string): string {
  return formatInTimeZone(d, tz, "yyyy-MM-dd");
}

export function timeOfDay(d: Date, tz: string, locale: Locale): string {
  return formatInTimeZone(d, tz, locale === "pt" ? "HH:mm" : "h:mm a", { locale: dfLocale[locale] });
}

export function inputTime(d: Date, tz: string): string {
  return formatInTimeZone(d, tz, "HH:mm");
}

export function longDay(d: Date, tz: string, locale: Locale): string {
  const pattern = locale === "pt" ? "EEEE, d 'de' MMMM" : "EEEE, MMMM d";
  const text = formatInTimeZone(d, tz, pattern, { locale: dfLocale[locale] });
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function shortDateTime(d: Date, tz: string, locale: Locale): string {
  const pattern = locale === "pt" ? "d 'de' MMM, HH:mm" : "MMM d, h:mm a";
  return formatInTimeZone(d, tz, pattern, { locale: dfLocale[locale] });
}

export function addDaysKey(key: string, days: number): string {
  const [y, m, d] = key.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + days));
  return date.toISOString().slice(0, 10);
}
