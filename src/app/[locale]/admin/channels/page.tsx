import { ChannelCard, LimitsForm } from "@/components/AdminForms";
import { requireAdmin } from "@/lib/admin";
import { getChannelConfig, isReady } from "@/lib/channels";
import { monthlyLimit } from "@/lib/limits";

export default async function AdminChannels() {
  const admin = await requireAdmin();
  const config = await getChannelConfig();
  const phoneNote = admin.phone ? `para ${admin.phone}` : "(cadastre seu celular em Configurações)";
  return (
    <>
      <ChannelCard
        channel="email"
        title="Email (SMTP)"
        description="Usado para os avisos por email e como reserva quando WhatsApp ou SMS não podem ser usados."
        ready={isReady(config, "email")}
        enabled={config.email.enabled}
        testLabel={`Enviar email de teste para ${admin.email}`}
        fields={[
          { name: "host", label: "Servidor SMTP", value: config.email.host, placeholder: "smtp.seuprovedor.com" },
          { name: "port", label: "Porta", value: String(config.email.port), hint: "587 (STARTTLS) ou 465 (SSL)." },
          { name: "user", label: "Usuário", value: config.email.user },
          { name: "pass", label: "Senha", secret: true, saved: Boolean(config.email.pass) },
          {
            name: "from",
            label: "Remetente",
            value: config.email.from,
            placeholder: "Orario <lembretes@orario.me>",
            hint: "O endereço precisa ser aceito pelo seu provedor SMTP.",
          },
        ]}
      />
      <ChannelCard
        channel="whatsapp"
        title="WhatsApp (Evolution API)"
        description="Os avisos saem do número conectado à instância informada."
        ready={isReady(config, "whatsapp")}
        enabled={config.whatsapp.enabled}
        testLabel={`Enviar WhatsApp de teste ${phoneNote}`}
        fields={[
          { name: "url", label: "Endereço da API", value: config.whatsapp.url, placeholder: "https://evolution.seudominio.com", type: "url" },
          { name: "instance", label: "Nome da instância", value: config.whatsapp.instance },
          { name: "key", label: "Chave da API (apikey)", secret: true, saved: Boolean(config.whatsapp.key) },
        ]}
      />
      <ChannelCard
        channel="sms"
        title="SMS (Twilio)"
        description="Cada SMS é cobrado pela Twilio; o limite mensal por usuário fica logo abaixo."
        ready={isReady(config, "sms")}
        enabled={config.sms.enabled}
        testLabel={`Enviar SMS de teste ${phoneNote}`}
        fields={[
          { name: "sid", label: "Account SID", value: config.sms.sid, placeholder: "AC…" },
          { name: "token", label: "Auth Token", secret: true, saved: Boolean(config.sms.token) },
          { name: "from", label: "Número de envio", value: config.sms.from, placeholder: "+15005550006", hint: "Número Twilio no formato internacional." },
        ]}
      />
      <LimitsForm
        whatsapp={(await monthlyLimit("free", "whatsapp")) ?? 0}
        sms={(await monthlyLimit("free", "sms")) ?? 0}
      />
    </>
  );
}
