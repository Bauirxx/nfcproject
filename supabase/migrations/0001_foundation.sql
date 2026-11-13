-- NFC Business — Fundação da base de dados (fase 1 do CLAUDE.md, regra 3).
-- Aplicar no Supabase: SQL Editor -> colar -> Run. Depois confirmar as tabelas em Table Editor (schema `app`).
--
-- Princípios (CLAUDE.md, regra 3):
--   * As tabelas ficam no schema `app`, fora da Data API (não expor `app` nas Exposed schemas das API Settings).
--   * RLS ativa em todas as tabelas; sem políticas para `anon` nem `authenticated`.
--   * O backend liga-se com o papel `app_backend` (privilégios mínimos, sem BYPASSRLS) e define, por pedido:
--       set_config('app.company_id', '<id da empresa da sessão>', true);
--       set_config('app.user_id', '<id do utilizador>', true);
--       set_config('app.is_platform_admin', 'true'|'false', true);
--     As políticas usam current_setting(...) — o company_id nunca vem do cliente.
--
-- Esta migração cria o núcleo (empresas, utilizadores, cartões, perfis) e a vista pública. As tabelas
-- restantes (contact_shares, analytics_events, audit_logs) seguem o mesmo padrão e entram na migração 0002.

create schema if not exists app;

-- Papel do backend: privilégios mínimos, sem BYPASSRLS. A forma de ligação (pooler/segredo) define-se no deploy.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'app_backend') then
    create role app_backend nologin;
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- Empresas
-- ---------------------------------------------------------------------------
create table if not exists app.companies (
  id            text primary key default ('co_' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 10)),
  name          text not null,
  contact_email text not null,
  logo_url      text,
  brand         jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Utilizadores (ligados ao Supabase Auth)
-- ---------------------------------------------------------------------------
create table if not exists app.users (
  id         uuid primary key references auth.users(id) on delete cascade,
  name       text,
  email      text not null,
  role       text not null check (role in ('platform_admin', 'company_admin', 'company_editor', 'profile_owner')),
  company_id text references app.companies(id) on delete set null,
  status     text not null default 'active' check (status in ('active', 'invited')),
  created_at timestamptz not null default now()
);
create index if not exists users_company_idx on app.users(company_id);

-- ---------------------------------------------------------------------------
-- Perfis (contactos e redes guardados como JSON, como no contrato partilhado)
-- ---------------------------------------------------------------------------
create table if not exists app.profiles (
  id             text primary key default ('p_' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 10)),
  company_id     text not null references app.companies(id) on delete cascade,
  slug           text not null unique,
  owner_user_id  uuid references app.users(id) on delete set null,
  display_name   text not null,
  title          text,
  company_name   text,
  bio            text,
  photo_url      text,
  visibility     jsonb not null default '{"title":true,"company":true,"bio":true,"photo":true}'::jsonb,
  contacts       jsonb not null default '[]'::jsonb,
  social_links   jsonb not null default '[]'::jsonb,
  theme          jsonb not null default '{}'::jsonb,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists profiles_company_idx on app.profiles(company_id);

-- ---------------------------------------------------------------------------
-- Cartões NFC (histórico embutido como JSON)
-- ---------------------------------------------------------------------------
create table if not exists app.cards (
  id          text primary key default ('c_' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 10)),
  company_id  text not null references app.companies(id) on delete cascade,
  label       text not null,
  token       text not null unique,
  status      text not null default 'inactive' check (status in ('active', 'inactive', 'lost', 'blocked')),
  profile_id  text references app.profiles(id) on delete set null,
  history     jsonb not null default '[]'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists cards_company_idx on app.cards(company_id);
create index if not exists cards_profile_idx on app.cards(profile_id);

-- ---------------------------------------------------------------------------
-- Vista pública: só os campos públicos de cada perfil com cartão ativo.
-- ---------------------------------------------------------------------------
create or replace view app.public_profiles as
select
  p.id    as profile_id,
  p.slug,
  p.display_name,
  case when (p.visibility->>'title')::boolean   then p.title       end as title,
  case when (p.visibility->>'company')::boolean then p.company_name end as company,
  case when (p.visibility->>'bio')::boolean     then p.bio         end as bio,
  case when (p.visibility->>'photo')::boolean   then p.photo_url    end as photo_url,
  p.theme,
  -- Só os contactos e redes marcados como públicos.
  (select coalesce(jsonb_agg(c - 'id'), '[]'::jsonb) from jsonb_array_elements(p.contacts) c
     where (c->>'isPublic')::boolean) as contacts,
  (select coalesce(jsonb_agg(s - 'id'), '[]'::jsonb) from jsonb_array_elements(p.social_links) s
     where (s->>'isPublic')::boolean) as social_links
from app.profiles p;

-- ---------------------------------------------------------------------------
-- RLS: ativa em todas as tabelas. As políticas usam o company_id da sessão (nunca do cliente).
-- ---------------------------------------------------------------------------
alter table app.companies enable row level security;
alter table app.users     enable row level security;
alter table app.profiles  enable row level security;
alter table app.cards     enable row level security;

-- Leitura: platform_admin vê tudo; os restantes só a sua empresa.
create policy companies_read on app.companies for select
  using (current_setting('app.is_platform_admin', true) = 'true' or id = current_setting('app.company_id', true));
-- Escrita de empresas: só platform_admin.
create policy companies_write on app.companies for all
  using (current_setting('app.is_platform_admin', true) = 'true')
  with check (current_setting('app.is_platform_admin', true) = 'true');

create policy users_rw on app.users for all
  using (current_setting('app.is_platform_admin', true) = 'true' or company_id = current_setting('app.company_id', true))
  with check (current_setting('app.is_platform_admin', true) = 'true' or company_id = current_setting('app.company_id', true));

create policy profiles_rw on app.profiles for all
  using (current_setting('app.is_platform_admin', true) = 'true' or company_id = current_setting('app.company_id', true))
  with check (current_setting('app.is_platform_admin', true) = 'true' or company_id = current_setting('app.company_id', true));

create policy cards_rw on app.cards for all
  using (current_setting('app.is_platform_admin', true) = 'true' or company_id = current_setting('app.company_id', true))
  with check (current_setting('app.is_platform_admin', true) = 'true' or company_id = current_setting('app.company_id', true));

-- Privilégios mínimos para o papel do backend (sem DDL, sem BYPASSRLS).
grant usage on schema app to app_backend;
grant select, insert, update, delete on all tables in schema app to app_backend;
grant select on app.public_profiles to app_backend;
alter default privileges in schema app grant select, insert, update, delete on tables to app_backend;
