import { getTableColumns } from "drizzle-orm";
import { activities, type Activity } from "@/db/schema";
import type { Locale } from "./i18n/config";

/**
 * Detail fields of an appointment, discovered from the table itself.
 *
 * Adding a column to `activities` in src/db/schema.ts (plus its migration) is
 * enough for it to appear in the form, the agenda and every email. An entry in
 * `overrides` is optional and only refines the label, input type or order.
 * Data from other tables joins the same layouts through `detailProviders`.
 */

export type FieldInput = "text" | "textarea" | "number" | "checkbox" | "datetime";

export type ActivityField = {
  /** Property name on the activity row. */
  key: string;
  label: Record<Locale, string>;
  input: FieldInput;
  required: boolean;
  maxLength: number;
  /** Shown without its label in compact lists. */
  plain: boolean;
};

const CORE = new Set(["id", "userId", "title", "startsAt", "createdAt"]);

const overrides: Record<string, Partial<Omit<ActivityField, "key">>> = {
  location: { label: { pt: "Local", en: "Place" }, maxLength: 160, plain: true },
  notes: { label: { pt: "Observações", en: "Notes" }, input: "textarea", maxLength: 1000, plain: true },
};

function humanize(key: string): string {
  const words = key.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/_/g, " ").toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

const inputByType: Record<string, FieldInput> = { string: "text", number: "number", boolean: "checkbox", date: "datetime" };

export function activityFields(): ActivityField[] {
  const columns = getTableColumns(activities) as Record<string, { dataType: string; notNull: boolean; hasDefault: boolean }>;
  const order = Object.keys(overrides);
  return Object.entries(columns)
    .filter(([key]) => !CORE.has(key))
    .map(([key, column]) => {
      const fallback = humanize(key);
      return {
        key,
        label: { pt: fallback, en: fallback },
        input: inputByType[column.dataType] ?? "text",
        required: column.notNull && !column.hasDefault && column.dataType !== "boolean",
        maxLength: 500,
        plain: false,
        ...overrides[key],
      } satisfies ActivityField;
    })
    .sort((a, b) => {
      const ia = order.indexOf(a.key), ib = order.indexOf(b.key);
      return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib);
    });
}

/** Form control name for a detail field. */
export const fieldName = (key: string) => `f_${key}`;

/** Reads the detail fields from a submitted form into column values. */
export function readFieldValues(form: FormData): { values: Record<string, unknown>; missing: ActivityField | null } {
  const values: Record<string, unknown> = {};
  let missing: ActivityField | null = null;
  for (const field of activityFields()) {
    const raw = form.get(fieldName(field.key));
    if (field.input === "checkbox") {
      values[field.key] = raw === "on";
      continue;
    }
    const text = String(raw ?? "").trim().slice(0, field.maxLength);
    if (!text) {
      if (field.required) missing ??= field;
      values[field.key] = null;
    } else if (field.input === "number") {
      const n = Number(text.replace(",", "."));
      values[field.key] = Number.isFinite(n) ? n : null;
    } else if (field.input === "datetime") {
      const d = new Date(text);
      values[field.key] = Number.isNaN(d.getTime()) ? null : d;
    } else {
      values[field.key] = text;
    }
  }
  return { values, missing };
}

/** Current value of a field as the string a form control expects. */
export function fieldFormValue(activity: Partial<Activity> | null, field: ActivityField): string {
  const value = (activity as Record<string, unknown> | null)?.[field.key];
  if (value === null || value === undefined) return "";
  if (field.input === "checkbox") return value ? "on" : "";
  if (value instanceof Date) return value.toISOString().slice(0, 16);
  return String(value);
}

export type Detail = { key: string; label: string; value: string; plain: boolean };

/** Extra details coming from other tables. Each provider returns rows per activity id. */
export type DetailProvider = (activityIds: string[], locale: Locale) => Promise<Map<string, Detail[]>>;
export const detailProviders: DetailProvider[] = [];

function display(value: unknown, locale: Locale): string {
  if (value === null || value === undefined || value === "") return "";
  if (typeof value === "boolean") return value ? (locale === "pt" ? "Sim" : "Yes") : "";
  if (value instanceof Date) return value.toLocaleString(locale === "pt" ? "pt-BR" : "en-US", { dateStyle: "medium", timeStyle: "short" });
  return String(value);
}

/** Filled-in detail fields of one appointment, ready for any layout. */
export function activityDetails(activity: Activity, locale: Locale, extras: Detail[] = []): Detail[] {
  const own = activityFields()
    .map((field) => ({
      key: field.key,
      label: field.label[locale],
      value: display((activity as Record<string, unknown>)[field.key], locale),
      plain: field.plain,
    }))
    .filter((d) => d.value !== "");
  return [...own, ...extras];
}

/** Details from related tables for a batch of appointments. */
export async function loadExtraDetails(activityIds: string[], locale: Locale): Promise<Map<string, Detail[]>> {
  const merged = new Map<string, Detail[]>();
  if (activityIds.length === 0) return merged;
  for (const provider of detailProviders) {
    for (const [id, rows] of await provider(activityIds, locale)) {
      merged.set(id, [...(merged.get(id) ?? []), ...rows]);
    }
  }
  return merged;
}
