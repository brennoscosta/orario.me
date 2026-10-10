"use client";

import { useActionState } from "react";
import { saveSettings, type FormState } from "@/app/[locale]/actions";

type Strings = {
  name: string;
  email: string;
  phone: string;
  phoneHint: string;
  timezone: string;
  language: string;
  save: string;
  saved: string;
  pending: string;
};

export function SettingsForm(props: {
  locale: string;
  t: Strings;
  timezones: string[];
  initial: { name: string; email: string; phone: string; timezone: string; language: string };
  justSaved: boolean;
}) {
  const { locale, t, timezones, initial, justSaved } = props;
  const [state, action, pending] = useActionState<FormState, FormData>(saveSettings, {});
  const v = { ...initial, ...state.values };
  return (
    <form action={action} className="form" key={state.ok ? "saved" : "form"}>
      <input type="hidden" name="locale" value={locale} />
      {state.error && (
        <p className="alert" role="alert">
          {state.error}
        </p>
      )}
      {(state.ok || (justSaved && !state.error)) && (
        <p className="alert alert--ok" role="status">
          {t.saved}
        </p>
      )}
      <div className="field">
        <label htmlFor="name">{t.name}</label>
        <input id="name" name="name" className="input" required maxLength={80} defaultValue={v.name} autoComplete="name" />
      </div>
      <div className="field">
        <label htmlFor="email">{t.email}</label>
        <input id="email" className="input" value={initial.email} readOnly disabled />
      </div>
      <div className="field">
        <label htmlFor="phone">{t.phone}</label>
        <input id="phone" name="phone" type="tel" className="input" maxLength={30} defaultValue={v.phone} autoComplete="tel" aria-describedby="phone-hint" />
        <span id="phone-hint" className="hint">
          {t.phoneHint}
        </span>
      </div>
      <div className="row-2">
        <div className="field">
          <label htmlFor="timezone">{t.timezone}</label>
          <select id="timezone" name="timezone" className="input" defaultValue={v.timezone}>
            {timezones.map((tz) => (
              <option key={tz} value={tz}>
                {tz.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="language">{t.language}</label>
          <select id="language" name="language" className="input" defaultValue={v.language}>
            <option value="pt">Português</option>
            <option value="en">English</option>
          </select>
        </div>
      </div>
      <div className="form-actions">
        <button type="submit" className="button" disabled={pending}>
          {pending ? t.pending : t.save}
        </button>
      </div>
    </form>
  );
}
