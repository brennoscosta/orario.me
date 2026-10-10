"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb, schema } from "@/db";
import { isAdmin, requireAdmin } from "@/lib/admin";
import { configuredChannels, sendEmail, sendSms, sendWhatsApp } from "@/lib/channels";
import { isChannel } from "@/lib/plans";
import { saveSettings } from "@/lib/settings";

export type AdminState = { error?: string; ok?: string };

const text = (form: FormData, name: string, max = 300) => String(form.get(name) ?? "").trim().slice(0, max);

/** Field names per channel. `secret` fields keep their saved value when submitted blank. */
const channelFields = {
  email: { prefix: "smtp", plain: ["host", "port", "user", "from"], secret: ["pass"] },
  whatsapp: { prefix: "whatsapp", plain: ["url", "instance"], secret: ["key"] },
  sms: { prefix: "sms", plain: ["sid", "from"], secret: ["token"] },
} as const;

export async function saveChannel(_prev: AdminState, form: FormData): Promise<AdminState> {
  await requireAdmin();
  const channel = text(form, "channel", 20);
  if (!isChannel(channel)) return { error: "Canal desconhecido." };
  const spec = channelFields[channel];
  const entries: Record<string, string> = {};
  for (const name of spec.plain) entries[`${spec.prefix}.${name}`] = text(form, name);
  for (const name of spec.secret) {
    const value = text(form, name, 500);
    if (value) entries[`${spec.prefix}.${name}`] = value;
  }
  entries[`${spec.prefix}.enabled`] = form.get("enabled") === "on" ? "1" : "0";

  if (channel === "email") {
    const port = entries["smtp.port"];
    if (port && !/^\d{2,5}$/.test(port)) return { error: "A porta precisa ser um número, como 587 ou 465." };
  }
  if (channel === "whatsapp" && entries["whatsapp.url"] && !/^https?:\/\//.test(entries["whatsapp.url"])) {
    return { error: "O endereço da Evolution API precisa começar com http:// ou https://." };
  }
  try {
    await saveSettings(entries);
  } catch (err) {
    console.error("[orario] saveChannel failed:", err);
    return { error: "Não foi possível salvar. Tente novamente." };
  }
  revalidatePath("/pt/admin", "layout");
  const ready = (await configuredChannels())[channel];
  return { ok: ready ? "Salvo. O canal está ativo." : "Salvo. O canal ainda não está ativo: confira os campos obrigatórios." };
}

export async function testChannel(_prev: AdminState, form: FormData): Promise<AdminState> {
  const admin = await requireAdmin();
  const channel = text(form, "channel", 20);
  if (!isChannel(channel)) return { error: "Canal desconhecido." };
  if (!(await configuredChannels())[channel]) return { error: "Salve as credenciais e ative o canal antes de testar." };
  const message = "Teste da Orario: este canal está funcionando.";
  try {
    if (channel === "email") {
      await sendEmail({
        to: admin.email,
        subject: "Teste da Orario",
        text: message,
        html: `<p style="font-family:Helvetica,Arial,sans-serif;font-size:15px">${message}</p>`,
      });
      return { ok: `Email de teste enviado para ${admin.email}.` };
    }
    if (!admin.phone) return { error: "Cadastre seu celular em Configurações para receber o teste." };
    if (channel === "whatsapp") await sendWhatsApp(admin.phone, message);
    else await sendSms(admin.phone, message);
    return { ok: `Mensagem de teste enviada para ${admin.phone}.` };
  } catch (err) {
    return { error: `O envio falhou: ${(err as Error).message.slice(0, 300)}` };
  }
}

export async function saveLimits(_prev: AdminState, form: FormData): Promise<AdminState> {
  await requireAdmin();
  const entries: Record<string, string> = {};
  for (const channel of ["whatsapp", "sms"] as const) {
    const raw = text(form, channel, 6);
    if (!/^\d{1,5}$/.test(raw)) return { error: "Informe os limites como números inteiros (0 desliga o canal no plano gratuito)." };
    entries[`limits.${channel}`] = String(Number(raw));
  }
  try {
    await saveSettings(entries);
  } catch (err) {
    console.error("[orario] saveLimits failed:", err);
    return { error: "Não foi possível salvar. Tente novamente." };
  }
  revalidatePath("/", "layout");
  return { ok: "Limites salvos." };
}

export async function deleteUser(form: FormData): Promise<void> {
  const admin = await requireAdmin();
  const id = text(form, "id", 40);
  if (!/^[0-9a-f-]{36}$/.test(id) || id === admin.id) return;
  const db = getDb();
  const rows = await db.select().from(schema.users).where(eq(schema.users.id, id)).limit(1);
  if (!rows[0] || isAdmin(rows[0])) return;
  await db.delete(schema.users).where(eq(schema.users.id, id));
  revalidatePath("/pt/admin", "layout");
}

export async function retryReminders(form: FormData): Promise<void> {
  await requireAdmin();
  const id = text(form, "id", 40);
  const db = getDb();
  const reset = { status: "pending", attempts: 0, claimedAt: null, error: null };
  if (id === "all-failed") {
    await db.update(schema.reminders).set(reset).where(eq(schema.reminders.status, "failed"));
  } else if (/^[0-9a-f-]{36}$/.test(id)) {
    await db
      .update(schema.reminders)
      .set(reset)
      .where(and(eq(schema.reminders.id, id), eq(schema.reminders.status, "failed")));
  }
  revalidatePath("/pt/admin/reminders");
}
