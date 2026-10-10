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

Veja `.env.example`. Só `DATABASE_URL` é obrigatória. As credenciais dos canais (SendGrid ou SMTP, Evolution API, Twilio) e os limites do plano são preenchidos no painel admin; as variáveis de ambiente servem de reserva. Quando WhatsApp ou SMS não podem ser usados, o aviso segue por email.

## Campos do compromisso

Toda coluna de `activities` além de `id`, `userId`, `title`, `startsAt` e `createdAt` é um campo de detalhe: aparece sozinha no formulário, na agenda e em todos os emails. Para criar um campo, adicione a coluna em `src/db/schema.ts` e rode `npm run db:generate`. Rótulo, tipo de entrada e ordem podem ser ajustados em `src/lib/activity-fields.ts` (`overrides`); dados de outras tabelas entram pelos `detailProviders` do mesmo arquivo.

## Contagem regressiva

Com o email ativo, cada usuário recebe um email diário (hora escolhida em Configurações, padrão 8h) com os dias que faltam para cada compromisso e, no dia, um "É HOJE! Faltam 3 horas para …". A lógica está em `src/lib/countdown.ts`.

## Painel admin

`/pt/admin`, visível só para as contas listadas em `ADMIN_EMAILS`: visão geral, canais (com envio de teste), usuários e registro de lembretes.

## Deploy (CapRover)

O `Dockerfile` gera a imagem de produção e escuta na porta 80. `GET /api/health` mostra o estado do banco e dos canais.
