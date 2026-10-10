"use client";

import { useActionState } from "react";
import { saveChannel, saveLimits, testChannel, type AdminState } from "@/app/[locale]/admin/actions";

export type ChannelField = {
  name: string;
  label: string;
  value?: string;
  placeholder?: string;
  hint?: string;
  /** Secret fields never show the saved value. */
  secret?: boolean;
  saved?: boolean;
  type?: string;
};

function Feedback({ state }: { state: AdminState }) {
  if (state.error) return <p className="alert" role="alert">{state.error}</p>;
  if (state.ok) return <p className="alert alert--ok" role="status">{state.ok}</p>;
  return null;
}

export function ChannelCard(props: {
  channel: string;
  title: string;
  description: string;
  ready: boolean;
  enabled: boolean;
  fields: ChannelField[];
  testLabel: string;
}) {
  const { channel, title, description, ready, enabled, fields, testLabel } = props;
  const [saveState, save, saving] = useActionState<AdminState, FormData>(saveChannel, {});
  const [testState, test, testing] = useActionState<AdminState, FormData>(testChannel, {});
  return (
    <section className="panel">
      <header className="panel-head">
        <h2>{title}</h2>
        <span className={`badge ${ready ? "badge--on" : "badge--off"}`}>{ready ? "Ativo" : "Inativo"}</span>
      </header>
      <p className="soft">{description}</p>
      <form action={save} className="form" key={saveState.ok ?? "form"}>
        <input type="hidden" name="channel" value={channel} />
        <Feedback state={saveState} />
        <div className="field-grid">
          {fields.map((f) => (
            <div className="field" key={f.name}>
              <label htmlFor={`${channel}-${f.name}`}>{f.label}</label>
              <input
                id={`${channel}-${f.name}`}
                name={f.name}
                className="input"
                type={f.secret ? "password" : (f.type ?? "text")}
                defaultValue={f.secret ? "" : f.value}
                placeholder={f.secret ? (f.saved ? "Salvo. Deixe em branco para manter." : "") : f.placeholder}
                autoComplete="off"
                spellCheck={false}
              />
              {f.hint && <span className="hint">{f.hint}</span>}
            </div>
          ))}
        </div>
        <label className="check">
          <input type="checkbox" name="enabled" defaultChecked={enabled} /> Canal ligado
        </label>
        <div className="form-actions">
          <button type="submit" className="button" disabled={saving}>
            {saving ? "Salvando…" : "Salvar"}
          </button>
        </div>
      </form>
      <form action={test} className="test-row">
        <input type="hidden" name="channel" value={channel} />
        <button type="submit" className="button button--quiet button--small" disabled={testing}>
          {testing ? "Enviando…" : testLabel}
        </button>
        <Feedback state={testState} />
      </form>
    </section>
  );
}

export function LimitsForm({ whatsapp, sms }: { whatsapp: number; sms: number }) {
  const [state, action, pending] = useActionState<AdminState, FormData>(saveLimits, {});
  return (
    <section className="panel">
      <header className="panel-head">
        <h2>Limites do plano gratuito</h2>
      </header>
      <p className="soft">
        Avisos por mês para cada usuário. Ao atingir o limite, o aviso segue por email. Os números da página inicial
        acompanham estes valores.
      </p>
      <form action={action} className="form" key={state.ok ?? "form"}>
        <Feedback state={state} />
        <div className="field-grid">
          <div className="field">
            <label htmlFor="limit-whatsapp">WhatsApp por mês</label>
            <input id="limit-whatsapp" name="whatsapp" type="number" min={0} max={99999} className="input" defaultValue={whatsapp} required />
          </div>
          <div className="field">
            <label htmlFor="limit-sms">SMS por mês</label>
            <input id="limit-sms" name="sms" type="number" min={0} max={99999} className="input" defaultValue={sms} required />
          </div>
        </div>
        <div className="form-actions">
          <button type="submit" className="button" disabled={pending}>
            {pending ? "Salvando…" : "Salvar limites"}
          </button>
        </div>
      </form>
    </section>
  );
}
