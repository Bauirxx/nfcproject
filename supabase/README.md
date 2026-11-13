# Base de dados (Supabase)

Migrações do schema `app` do NFC Business (CLAUDE.md, regra 3). São SQL simples, para aplicar e **verificar no Supabase**.

## Como aplicar

1. No painel do Supabase: **SQL Editor** → **New query**.
2. Cole o conteúdo de `migrations/0001_foundation.sql` e clique em **Run**.
3. Confirme em **Table Editor** (schema `app`) que apareceram as tabelas `companies`, `users`, `profiles`, `cards` e a vista `public_profiles`.
4. Em **Project Settings → API → Exposed schemas**, confirme que o schema `app` **não** está exposto (só `public`). As tabelas de negócio ficam fora da Data API.

## O que já está aqui

- Schema `app` e o papel `app_backend` (privilégios mínimos, sem BYPASSRLS).
- Tabelas centrais: `companies`, `users` (ligada ao `auth.users`), `profiles` (contactos e redes em JSON), `cards`.
- Vista `public_profiles` (só os campos públicos, com contactos/redes filtrados por `isPublic`).
- RLS ativa em todas as tabelas, com políticas que usam `current_setting('app.company_id')` e `current_setting('app.is_platform_admin')` — o `company_id` vem sempre da sessão, nunca do cliente.

## O que falta (próximas migrações / trabalho em casa)

- `migrations/0002_*`: tabelas `contact_shares`, `analytics_events`, `audit_logs` (mesmo padrão de RLS).
- Backend: ligação direta ao Postgres com o papel `app_backend`, a definir `app.company_id` / `app.user_id` / `app.is_platform_admin` por pedido (via `set_config(..., true)` numa transação), e os módulos de endpoints (empresas, membros, cartões, perfis, envio, estatísticas, auditoria, público) sobre o contrato do ADR-0004.
- Migrar o papel/empresa do `app_metadata` do Supabase Auth (interim, ADR-0011) para a tabela `app.users`.

> Nota: estes ficheiros são a fundação; aplique-os ao seu projeto e verifique no SQL Editor. A chave **service_role** só será usada para correr migrações no CI (regra 3), nunca na aplicação em execução.
