# Orario

Agenda pessoal com lembretes por email, SMS e WhatsApp. Site: https://orario.me

## Stack

- Next.js 16 (App Router), React 19, TypeScript
- PostgreSQL com Drizzle ORM (migrações em `drizzle/`, aplicadas ao iniciar)
- Lembretes: agendador interno (a cada 30 s) com email (SMTP), WhatsApp (Evolution API) e SMS (Twilio)
- Idiomas: português (`/pt`) e inglês (`/en`)

## Desenvolvimento

```bash
cp .env.example .env.local   # ajuste DATABASE_URL
npm install
npm run dev
```

Depois de mudar `src/db/schema.ts`, gere a migração com `npm run db:generate`.

## Variáveis de ambiente

Veja `.env.example`. Só `DATABASE_URL` é obrigatória. As credenciais dos canais (SMTP, Evolution API, Twilio) e os limites do plano são preenchidos no painel admin; as variáveis de ambiente servem de reserva. Quando WhatsApp ou SMS não podem ser usados, o aviso segue por email.

## Painel admin

`/pt/admin`, visível só para as contas listadas em `ADMIN_EMAILS`: visão geral, canais (com envio de teste), usuários e registro de lembretes.

## Deploy (CapRover)

O `Dockerfile` gera a imagem de produção e escuta na porta 80. `GET /api/health` mostra o estado do banco e dos canais.
