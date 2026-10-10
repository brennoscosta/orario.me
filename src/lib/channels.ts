import "server-only";
import nodemailer, { type Transporter } from "nodemailer";
import type { Channel } from "./plans";

export function channelConfigured(channel: Channel): boolean {
  const e = process.env;
  if (channel === "email") return Boolean(e.SMTP_HOST && e.MAIL_FROM);
  if (channel === "whatsapp") return Boolean(e.EVOLUTION_API_URL && e.EVOLUTION_API_KEY && e.EVOLUTION_INSTANCE);
  return Boolean(e.TWILIO_ACCOUNT_SID && e.TWILIO_AUTH_TOKEN && e.TWILIO_FROM);
}

export function configuredChannels(): Record<Channel, boolean> {
  return {
    email: channelConfigured("email"),
    whatsapp: channelConfigured("whatsapp"),
    sms: channelConfigured("sms"),
  };
}

let transporter: Transporter | null = null;

function mailer(): Transporter {
  if (!transporter) {
    const port = Number(process.env.SMTP_PORT || 587);
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: port === 465,
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
    });
  }
  return transporter;
}

export async function sendEmail(msg: { to: string; subject: string; text: string; html: string }): Promise<void> {
  await mailer().sendMail({ from: process.env.MAIL_FROM, ...msg });
}

async function expectOk(res: Response, provider: string): Promise<void> {
  if (res.ok) return;
  const body = (await res.text().catch(() => "")).slice(0, 300);
  throw new Error(`${provider} ${res.status}: ${body}`);
}

export async function sendWhatsApp(phone: string, text: string): Promise<void> {
  const base = process.env.EVOLUTION_API_URL!.replace(/\/$/, "");
  const instance = encodeURIComponent(process.env.EVOLUTION_INSTANCE!);
  const res = await fetch(`${base}/message/sendText/${instance}`, {
    method: "POST",
    headers: { "content-type": "application/json", apikey: process.env.EVOLUTION_API_KEY! },
    body: JSON.stringify({ number: phone.replace(/\D/g, ""), text }),
    signal: AbortSignal.timeout(20_000),
  });
  await expectOk(res, "whatsapp");
}

export async function sendSms(phone: string, text: string): Promise<void> {
  const sid = process.env.TWILIO_ACCOUNT_SID!;
  const auth = Buffer.from(`${sid}:${process.env.TWILIO_AUTH_TOKEN!}`).toString("base64");
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: "POST",
    headers: { authorization: `Basic ${auth}`, "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ To: phone, From: process.env.TWILIO_FROM!, Body: text }),
    signal: AbortSignal.timeout(20_000),
  });
  await expectOk(res, "sms");
}
