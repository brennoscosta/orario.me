"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { saveActivity, type FormState } from "@/app/[locale]/actions";

export type ActivityFormStrings = {
  title: string;
  titlePlaceholder: string;
  date: string;
  time: string;
  optional: string;
  reminders: string;
  remindersHint: string;
  when: string;
  channel: string;
  addReminder: string;
  removeReminder: string;
  save: string;
  saving: string;
  cancel: string;
};

type Option = { value: string; label: string; disabled?: boolean };
type ReminderRow = { key: number; offset: string; channel: string };

/** A detail field of the appointment, described by the server (see activity-fields.ts). */
export type FormField = {
  name: string;
  label: string;
  input: "text" | "textarea" | "number" | "checkbox" | "datetime";
  required: boolean;
  maxLength: number;
  value: string;
};

export type ActivityInitial = {
  id?: string;
  title: string;
  date: string;
  time: string;
  reminders: { offset: string; channel: string }[];
};

export function ActivityForm(props: {
  locale: string;
  t: ActivityFormStrings;
  offsets: Option[];
  channels: Option[];
  maxReminders: number;
  initial: ActivityInitial;
  fields: FormField[];
  note?: React.ReactNode;
}) {
  const { locale, t, offsets, channels, maxReminders, initial, fields, note } = props;
  const [state, action, pending] = useActionState<FormState, FormData>(saveActivity, {});
  const [rows, setRows] = useState<ReminderRow[]>(() => initial.reminders.map((r, i) => ({ key: i, ...r })));
  const [nextKey, setNextKey] = useState(initial.reminders.length);
  const v = { ...initial, ...state.values };
  const firstChannel = channels.find((c) => !c.disabled)?.value ?? "email";

  const update = (key: number, patch: Partial<ReminderRow>) =>
    setRows((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)));

  return (
    <form action={action} className="form">
      <input type="hidden" name="locale" value={locale} />
      {initial.id && <input type="hidden" name="id" value={initial.id} />}
      {state.error && (
        <p className="alert" role="alert">
          {state.error}
        </p>
      )}
      <div className="field">
        <label htmlFor="title">{t.title}</label>
        <input id="title" name="title" className="input" required maxLength={120} defaultValue={v.title} placeholder={t.titlePlaceholder} />
      </div>
      <div className="row-2">
        <div className="field">
          <label htmlFor="date">{t.date}</label>
          <input id="date" name="date" type="date" className="input" required defaultValue={v.date} />
        </div>
        <div className="field">
          <label htmlFor="time">{t.time}</label>
          <input id="time" name="time" type="time" className="input" required defaultValue={v.time} />
        </div>
      </div>
      {fields.map((f) => {
        const value = state.values ? (state.values[f.name] ?? "") : f.value;
        const label = f.required || f.input === "checkbox" ? f.label : `${f.label} ${t.optional}`;
        if (f.input === "checkbox") {
          return (
            <label className="check" key={f.name}>
              <input type="checkbox" name={f.name} defaultChecked={value === "on"} /> {label}
            </label>
          );
        }
        return (
          <div className="field" key={f.name}>
            <label htmlFor={f.name}>{label}</label>
            {f.input === "textarea" ? (
              <textarea id={f.name} name={f.name} className="input" maxLength={f.maxLength} required={f.required} defaultValue={value} />
            ) : (
              <input
                id={f.name}
                name={f.name}
                className="input"
                type={f.input === "number" ? "number" : f.input === "datetime" ? "datetime-local" : "text"}
                step={f.input === "number" ? "any" : undefined}
                maxLength={f.input === "text" ? f.maxLength : undefined}
                required={f.required}
                defaultValue={value}
              />
            )}
          </div>
        );
      })}

      <fieldset>
        <legend className="legend">{t.reminders}</legend>
        <p className="hint">{t.remindersHint}</p>
        <div className="reminder-rows">
          {rows.map((row, index) => (
            <div className="reminder-row" key={row.key}>
              <select
                name="reminderOffset"
                className="input"
                aria-label={`${t.when} ${index + 1}`}
                value={row.offset}
                onChange={(e) => update(row.key, { offset: e.target.value })}
              >
                {offsets.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              <select
                name="reminderChannel"
                className="input"
                aria-label={`${t.channel} ${index + 1}`}
                value={row.channel}
                onChange={(e) => update(row.key, { channel: e.target.value })}
              >
                {channels.map((c) => (
                  <option key={c.value} value={c.value} disabled={c.disabled && c.value !== row.channel}>
                    {c.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="icon-button"
                aria-label={`${t.removeReminder} ${index + 1}`}
                onClick={() => setRows((current) => current.filter((r) => r.key !== row.key))}
              >
                ×
              </button>
            </div>
          ))}
        </div>
        {rows.length < maxReminders && (
          <p style={{ marginTop: "0.75rem" }}>
            <button
              type="button"
              className="button button--quiet button--small"
              onClick={() => {
                setRows((current) => [...current, { key: nextKey, offset: "30", channel: firstChannel }]);
                setNextKey((k) => k + 1);
              }}
            >
              {t.addReminder}
            </button>
          </p>
        )}
        {note && <p className="hint" style={{ marginTop: "0.75rem" }}>{note}</p>}
      </fieldset>

      <div className="form-actions">
        <button type="submit" className="button" disabled={pending}>
          {pending ? t.saving : t.save}
        </button>
        <Link href={`/${locale}/app`}>{t.cancel}</Link>
      </div>
    </form>
  );
}
