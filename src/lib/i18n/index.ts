import en from "./en";
import pt, { type Dictionary } from "./pt";
import type { Locale } from "./config";

const dictionaries: Record<Locale, Dictionary> = { pt, en };

export function getDict(locale: Locale): Dictionary {
  return dictionaries[locale];
}

export type { Dictionary };
