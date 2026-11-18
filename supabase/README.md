# Base de dados (Supabase)

Migrações do schema `app` do NFC Business (CLAUDE.md, regra 3). São SQL simples, para aplicar e **verificar no Supabase**.

## Como aplicar

1. No painel do Supabase: **SQL Editor** → **New query**.
2. Cole o conteúdo de `migrations/0001_foundation.sql` e clique em **Run**.
3. Confirme em **Table Editor** (schema `app`) que apareceram as tabelas `companies`, `users`, `profiles`, `cards` e a vista `public_profiles`.
4. Em **Project Settings → API → Exposed schemas**, confirme que o schema `app` **não** está exposto (só `public`). As tabelas de negócio ficam fora da Data API.
5. **Migração 0002** (`migrations/0002_sharing_analytics_audit.sql`). Primeiro, em **Integrations → Cron**, ative o **pg_cron**, que agenda a anonimização diária dos destinatários com mais de 90 dias. Depois cole a migração no SQL Editor e clique em **Run**. A migração faz o seguinte:
   - restringe as políticas da 0001 ao `app_backend` e retira ao `anon` e ao `authenticated` qualquer acesso ao schema `app`;
   - cria `contact_shares`, `email_suppressions`, `analytics_events` e `audit_logs` (esta é append-only: sem permissão de alterar ou apagar e com um trigger que o recusa);
   - cria a vista `public_cards` (só cartões ativos e só campos públicos) e a função de anonimização.
   - Para verificar: `DB_INTEGRATION=1 pnpm --filter @nfc-business/api test`.
6. **Ligação do backend (ADR-0013):**
   - No SQL Editor, corra `alter role app_backend with login nobypassrls password '<password longa, só letras e números>';`.
   - Em **Connect → Direct → Session pooler**, copie o URL. Troque `postgres.` por `app_backend.` e ponha a password. Guarde-o como `DATABASE_URL` no `apps/api/.env` e nas variáveis do Render.
   - Em **Database → Settings → SSL configuration**, ative **Enforce SSL**. O certificado (**Download certificate**) já está em `apps/api/certs/supabase-ca.crt`.
   - Para verificar: `DB_INTEGRATION=1 pnpm --filter @nfc-business/api test`.

Estado em 2026-11-18: a migração 0001 está aplicada e a ligação com o `app_backend` foi verificada (TLS com a CA, sem BYPASSRLS, RLS a bloquear escritas).

## O que já está aqui

- Schema `app` e o papel `app_backend` (privilégios mínimos, sem BYPASSRLS).
- Tabelas centrais: `companies`, `users` (ligada ao `auth.users`), `profiles` (contactos e redes em JSON), `cards`.
- Vista `public_profiles` (só os campos públicos, com contactos/redes filtrados por `isPublic`).
- RLS ativa em todas as tabelas, com políticas que usam `current_setting('app.company_id')` e `current_setting('app.is_platform_admin')` — o `company_id` vem sempre da sessão, nunca do cliente.

## O que falta (próximas migrações / trabalho em casa)

- ~~`migrations/0002_*`~~: escrita (`0002_sharing_analytics_audit.sql`); falta aplicá-la no Supabase.
- Backend: ~~ligação direta ao Postgres com o papel `app_backend`~~ (feito: `apps/api/src/database/database.service.ts`, ADR-0013), e os módulos de endpoints (empresas, membros, cartões, perfis, envio, estatísticas, auditoria, público) sobre o contrato do ADR-0004.
- Migrar o papel/empresa do `app_metadata` do Supabase Auth (interim, ADR-0011) para a tabela `app.users`.

> Nota: estes ficheiros são a fundação; aplique-os ao seu projeto e verifique no SQL Editor. A chave **service_role** só será usada para correr migrações no CI (regra 3), nunca na aplicação em execução.
