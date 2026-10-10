import "server-only";
import nodemailer, { type Transporter } from "nodemailer";
import type { Channel } from "./plans";
import { getSettings } from "./settings";

export type ChannelConfig = {
  email: {
    enabled: boolean;
    provider: "sendgrid" | "smtp";
    from: string;
    sendgridKey: string;
    host: string;
    port: number;
    user: string;
    pass: string;
  };
  whatsapp: { enabled: boolean; url: string; key: string; instance: string };
  sms: { enabled: boolean; sid: string; token: string; from: string };
};

/** Admin-panel settings take precedence; environment variables are the fallback. */
export async function getChannelConfig(): Promise<ChannelConfig> {
  const s = await getSettings();
  const e = process.env;
  const pick = (key: string, env: string | undefined) => s.get(key) ?? env ?? "";
  const on = (key: string) => s.get(key) !== "0";
  const sendgridKey = pick("sendgrid.key", e.SENDGRID_API_KEY);
  const smtpHost = pick("smtp.host", e.SMTP_HOST);
  const chosen = pick("email.provider", e.EMAIL_PROVIDER);
  const provider = chosen === "smtp" || chosen === "sendgrid" ? chosen : smtpHost && !sendgridKey ? "smtp" : "sendgrid";
  return {
    email: {
      enabled: on("smtp.enabled"),
      provider,
      sendgridKey,
      host: smtpHost,
      port: Number(pick("smtp.port", e.SMTP_PORT) || 587),
      user: pick("smtp.user", e.SMTP_USER),
      pass: pick("smtp.pass", e.SMTP_PASS),
      from: s.get("email.from") ?? pick("smtp.from", e.MAIL_FROM),
    },
    whatsapp: {
      enabled: on("whatsapp.enabled"),
      url: pick("whatsapp.url", e.EVOLUTION_API_URL),
      key: pick("whatsapp.key", e.EVOLUTION_API_KEY),
      instance: pick("whatsapp.instance", e.EVOLUTION_INSTANCE),
    },
    sms: {
      enabled: on("sms.enabled"),
      sid: pick("sms.sid", e.TWILIO_ACCOUNT_SID),
      token: pick("sms.token", e.TWILIO_AUTH_TOKEN),
      from: pick("sms.from", e.TWILIO_FROM),
    },
  };
}

export function isReady(config: ChannelConfig, channel: Channel): boolean {
  if (channel === "email") {
    const m = config.email;
    return Boolean(m.enabled && m.from && (m.provider === "sendgrid" ? m.sendgridKey : m.host));
  }
  if (channel === "whatsapp") {
    const w = config.whatsapp;
    return Boolean(w.enabled && w.url && w.key && w.instance);
  }
  const m = config.sms;
  return Boolean(m.enabled && m.sid && m.token && m.from);
}

export async function configuredChannels(): Promise<Record<Channel, boolean>> {
  const config = await getChannelConfig();
  return { email: isReady(config, "email"), whatsapp: isReady(config, "whatsapp"), sms: isReady(config, "sms") };
}

let mailer: { key: string; transporter: Transporter } | null = null;

function transporterFor(c: ChannelConfig["email"]): Transporter {
  const key = JSON.stringify([c.host, c.port, c.user, c.pass]);
  if (!mailer || mailer.key !== key) {
    mailer = {
      key,
      transporter: nodemailer.createTransport({
        host: c.host,
        port: c.port,
        secure: c.port === 465,
        auth: c.user ? { user: c.user, pass: c.pass } : undefined,
        connectionTimeout: 15_000,
        greetingTimeout: 15_000,
        socketTimeout: 30_000,
      }),
    };
  }
  return mailer.transporter;
}

/** Splits "Orario <lembretes@orario.me>" into name and address. */
function parseFrom(from: string): { email: string; name?: string } {
  const match = from.match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/);
  if (!match) return { email: from.trim() };
  return match[1].trim() ? { email: match[2].trim(), name: match[1].trim() } : { email: match[2].trim() };
}

async function sendViaSendGrid(c: ChannelConfig["email"], msg: { to: string; subject: string; text: string; html: string }) {
  const base = (process.env.SENDGRID_API_URL || "https://api.sendgrid.com").replace(/\/$/, "");
  const res = await fetch(`${base}/v3/mail/send`, {
    method: "POST",
    headers: { authorization: `Bearer ${c.sendgridKey}`, "content-type": "application/json" },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: msg.to }] }],
      from: parseFrom(c.from),
      subject: msg.subject,
      content: [
        { type: "text/plain", value: msg.text },
        { type: "text/html", value: msg.html },
      ],
    }),
    signal: AbortSignal.timeout(20_000),
  });
  await expectOk(res, "sendgrid");
}

export async function sendEmail(msg: { to: string; subject: string; text: string; html: string }): Promise<void> {
  const { email } = await getChannelConfig();
  if (email.provider === "sendgrid") await sendViaSendGrid(email, msg);
  else await transporterFor(email).sendMail({ from: email.from, ...msg });
}

async function expectOk(res: Response, provider: string): Promise<void> {
  if (res.ok) return;
  const body = (await res.text().catch(() => "")).slice(0, 300);
  throw new Error(`${provider} ${res.status}: ${body}`);
}

export async function sendWhatsApp(phone: string, text: string): Promise<void> {
  const { whatsapp } = await getChannelConfig();
  const endpoint = `${whatsapp.url.replace(/\/$/, "")}/message/sendText/${encodeURIComponent(whatsapp.instance)}`;
  const number = phone.replace(/\D/g, "");
  const post = (body: unknown) =>
    fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json", apikey: whatsapp.key },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(20_000),
    });
  // Evolution API v2 body first; v1 uses a nested textMessage.
  let res = await post({ number, text });
  if (res.status === 400) res = await post({ number, textMessage: { text } });
  await expectOk(res, "whatsapp");
}

export async function sendSms(phone: string, text: string): Promise<void> {
  const { sms } = await getChannelConfig();
  const auth = Buffer.from(`${sms.sid}:${sms.token}`).toString("base64");
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sms.sid)}/Messages.json`, {
    method: "POST",
    headers: { authorization: `Basic ${auth}`, "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ To: phone, From: sms.from, Body: text }),
    signal: AbortSignal.timeout(20_000),
  });
  await expectOk(res, "sms");
}
