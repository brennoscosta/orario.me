"use client";

import { useActionState } from "react";
import { changePassword, type FormState } from "@/app/[locale]/actions";

type Strings = { current: string; next: string; hint: string; submit: string; pending: string; done: string };

export function PasswordForm({ locale, t }: { locale: string; t: Strings }) {
  const [state, action, pending] = useActionState<FormState, FormData>(changePassword, {});
  return (
    <form action={action} className="form" style={{ marginTop: "1rem" }}>
      <input type="hidden" name="locale" value={locale} />
      {state.error && (
        <p className="alert" role="alert">
          {state.error}
        </p>
      )}
      {state.ok && (
        <p className="alert alert--ok" role="status">
          {t.done}
        </p>
      )}
      <div className="row-2">
        <div className="field">
          <label htmlFor="currentPassword">{t.current}</label>
          <input id="currentPassword" name="currentPassword" type="password" className="input" autoComplete="current-password" required />
        </div>
        <div className="field">
          <label htmlFor="newPassword">{t.next}</label>
          <input
            id="newPassword"
            name="newPassword"
            type="password"
            className="input"
            autoComplete="new-password"
            required
            minLength={8}
            maxLength={200}
            aria-describedby="new-password-hint"
          />
          <span id="new-password-hint" className="hint">
            {t.hint}
          </span>
        </div>
      </div>
      <div className="form-actions">
        <button type="submit" className="button button--quiet" disabled={pending}>
          {pending ? t.pending : t.submit}
        </button>
      </div>
    </form>
  );
}
