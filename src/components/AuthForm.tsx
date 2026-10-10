"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { login, signup, type FormState } from "@/app/[locale]/actions";

type Strings = {
  name: string;
  email: string;
  password: string;
  passwordHint: string;
  phone: string;
  phoneHint: string;
  submit: string;
  pending: string;
  switchQuestion: string;
  switchLabel: string;
};

export function AuthForm({ mode, locale, t }: { mode: "signup" | "login"; locale: string; t: Strings }) {
  const [state, action, pending] = useActionState<FormState, FormData>(mode === "signup" ? signup : login, {});
  const [timezone, setTimezone] = useState("");
  useEffect(() => {
    try {
      setTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone || "");
    } catch {
      /* keeps the server default */
    }
  }, []);

  return (
    <>
      <form action={action} className="form">
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="timezone" value={timezone} />
        {state.error && (
          <p className="alert" role="alert">
            {state.error}
          </p>
        )}
        {mode === "signup" && (
          <div className="field">
            <label htmlFor="name">{t.name}</label>
            <input id="name" name="name" className="input" autoComplete="given-name" required maxLength={80} defaultValue={state.values?.name} />
          </div>
        )}
        <div className="field">
          <label htmlFor="email">{t.email}</label>
          <input id="email" name="email" type="email" className="input" autoComplete="email" required maxLength={200} defaultValue={state.values?.email} />
        </div>
        <div className="field">
          <label htmlFor="password">{t.password}</label>
          <input
            id="password"
            name="password"
            type="password"
            className="input"
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
            required
            minLength={mode === "signup" ? 8 : undefined}
            maxLength={200}
            aria-describedby={mode === "signup" ? "password-hint" : undefined}
          />
          {mode === "signup" && (
            <span id="password-hint" className="hint">
              {t.passwordHint}
            </span>
          )}
        </div>
        {mode === "signup" && (
          <div className="field">
            <label htmlFor="phone">{t.phone}</label>
            <input id="phone" name="phone" type="tel" className="input" autoComplete="tel" maxLength={30} aria-describedby="phone-hint" defaultValue={state.values?.phone} />
            <span id="phone-hint" className="hint">
              {t.phoneHint}
            </span>
          </div>
        )}
        <div className="form-actions">
          <button type="submit" className="button" disabled={pending}>
            {pending ? t.pending : t.submit}
          </button>
        </div>
      </form>
      <p className="switch-auth">
        {t.switchQuestion} <Link href={`/${locale}/${mode === "signup" ? "login" : "signup"}`}>{t.switchLabel}</Link>
      </p>
    </>
  );
}
