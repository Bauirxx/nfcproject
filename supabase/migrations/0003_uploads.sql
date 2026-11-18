-- NFC Business: migração 0003 (uploads de imagens, CLAUDE.md regra 8; ADR-0018).
-- Aplicar no Supabase: SQL Editor -> colar -> Run (depois da 0002). Pode correr-se mais do que uma vez.

-- ---------------------------------------------------------------------------
-- 1. Registo dos uploads: o pedido (sign), o ficheiro recebido e o consumo por um perfil ou empresa.
-- ---------------------------------------------------------------------------
create table if not exists app.uploads (
  id            text primary key default ('f_' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 16)),
  -- null para os logótipos de empresa pedidos pelo platform_admin.
  company_id    text references app.companies(id) on delete cascade,
  user_id       uuid not null,
  purpose       text not null check (purpose in ('profile_photo', 'company_logo', 'theme_logo')),
  content_type  text not null check (content_type in ('image/jpeg', 'image/png', 'image/webp')),
  size          integer not null check (size between 1 and 2097152),
  status        text not null default 'pending' check (status in ('pending', 'ready', 'consumed')),
  -- Caminho no bucket público (nome gerado pelo sistema), preenchido depois do processamento.
  public_path   text,
  expires_at    timestamptz not null default now() + interval '15 minutes',
  created_at    timestamptz not null default now()
);
create index if not exists uploads_user_idx on app.uploads(user_id, created_at);

alter table app.uploads enable row level security;
drop policy if exists uploads_rw on app.uploads;
create policy uploads_rw on app.uploads for all to app_backend
  using (
    current_setting('app.is_platform_admin', true) = 'true'
    or company_id = current_setting('app.company_id', true)
  )
  with check (
    current_setting('app.is_platform_admin', true) = 'true'
    or company_id = current_setting('app.company_id', true)
  );
grant select, insert, update on app.uploads to app_backend;
revoke delete, truncate on app.uploads from app_backend;

-- ---------------------------------------------------------------------------
-- 2. Buckets: quarentena privada (originais por validar) e público (só imagens re-codificadas em WebP).
--    Sem políticas para anon/authenticated: só o backend (service_role isolada, ADR-0017) escreve.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('uploads-quarantine', 'uploads-quarantine', false, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = false, file_size_limit = 2097152, allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('public-images', 'public-images', true, 2097152, array['image/webp'])
on conflict (id) do update
  set public = true, file_size_limit = 2097152, allowed_mime_types = array['image/webp'];
