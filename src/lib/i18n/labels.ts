import type { Locale } from "./config";

/** "10 minutos", "1 hora", "2 dias", "1 semana". */
export function durationLabel(minutes: number, locale: Locale): string {
  const units =
    locale === "pt"
      ? { min: ["minuto", "minutos"], hour: ["hora", "horas"], day: ["dia", "dias"], week: ["semana", "semanas"] }
      : { min: ["minute", "minutes"], hour: ["hour", "hours"], day: ["day", "days"], week: ["week", "weeks"] };
  const pick = (n: number, forms: string[]) => `${n} ${n === 1 ? forms[0] : forms[1]}`;
  if (minutes % 10080 === 0 && minutes > 0) return pick(minutes / 10080, units.week);
  if (minutes % 1440 === 0 && minutes > 0) return pick(minutes / 1440, units.day);
  if (minutes % 60 === 0 && minutes > 0) return pick(minutes / 60, units.hour);
  return pick(minutes, units.min);
}

/** "Na hora", "10 minutos antes". */
export function offsetLabel(minutes: number, locale: Locale): string {
  if (minutes === 0) return locale === "pt" ? "Na hora" : "At the time";
  return locale === "pt" ? `${durationLabel(minutes, locale)} antes` : `${durationLabel(minutes, locale)} before`;
}
