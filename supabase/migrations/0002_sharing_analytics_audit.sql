-- NFC Business: migração 0002 (envios de contacto, estatísticas, auditoria e página pública).
-- Aplicar no Supabase: SQL Editor -> colar -> Run (depois da 0001). Pode correr-se mais do que uma vez.
-- Regras do CLAUDE.md: 3 (RLS e app_backend), 4 (página pública), 5 (envio de contacto),
-- 6 (estatísticas) e 11 (audit_logs append-only).

-- ---------------------------------------------------------------------------
-- 1. Correção da 0001: as políticas aplicam-se só ao app_backend (nunca a anon/authenticated/PUBLIC).
-- ---------------------------------------------------------------------------
alter policy companies_read  on app.companies to app_backend;
alter policy companies_write on app.companies to app_backend;
alter policy users_rw        on app.users     to app_backend;
alter policy profiles_rw     on app.profiles  to app_backend;
alter policy cards_rw        on app.cards     to app_backend;

-- Os papéis da Data API não têm nada a fazer no schema app.
revoke all on schema app from public, anon, authenticated;
revoke all on all tables in schema app from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Envios de contacto (regra 5). Os dados do destinatário são anonimizados aos 90 dias.
-- ---------------------------------------------------------------------------
create table if not exists app.contact_shares (
  id               text primary key default ('cs_' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 12)),
  company_id       text not null references app.companies(id) on delete cascade,
  profile_id       text not null references app.profiles(id) on delete cascade,
  sender_user_id   uuid references app.users(id) on delete set null,
  channel          text not null check (channel in ('email', 'whatsapp', 'sms')),
  recipient_name   text check (char_length(recipient_name) <= 80),
  recipient_phone  text check (recipient_phone ~ '^\+[1-9][0-9]{6,14}$'),
  recipient_email  text check (char_length(recipient_email) <= 254),
  -- O que a interface mostra; o valor completo nunca volta ao cliente.
  recipient_masked text not null,
  note             text check (char_length(note) <= 200),
  created_at       timestamptz not null default now(),
  -- Depois da anonimização (90 dias) os campos do destinatário ficam a null.
  anonymized_at    timestamptz,
  constraint contact_shares_recipient check (
    anonymized_at is not null
    or (channel = 'email' and recipient_email is not null)
    or (channel <> 'email' and recipient_phone is not null)
  )
);
-- Limites por utilizador (10/hora, 50/dia) e por empresa: contagens por janela de tempo.
create index if not exists contact_shares_sender_idx  on app.contact_shares(sender_user_id, created_at);
create index if not exists contact_shares_company_idx on app.contact_shares(company_id, created_at);
create index if not exists contact_shares_profile_idx on app.contact_shares(profile_id, created_at);

-- Destinatários que cancelaram (link de cancelamento em cada email). Guarda-se só o hash do email.
create table if not exists app.email_suppressions (
  email_hash text primary key check (email_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 3. Eventos de estatísticas (regra 6). IP só como hash com sal diário (calculado no backend).
-- ---------------------------------------------------------------------------
create table if not exists app.analytics_events (
  id          bigint generated always as identity primary key,
  company_id  text not null references app.companies(id) on delete cascade,
  card_id     text references app.cards(id) on delete set null,
  profile_id  text references app.profiles(id) on delete set null,
  -- Lista fechada: os quatro eventos públicos e o contact_sent, registado só pelo backend.
  type        text not null check (type in ('view', 'whatsapp_click', 'email_click', 'vcf_download', 'contact_sent')),
  ip_hash     text check (ip_hash ~ '^[0-9a-f]{64}$'),
  created_at  timestamptz not null default now()
);
-- Deduplicação por 30 minutos (mesmo cartão, tipo e IP) e resumos por empresa/cartão e data.
create index if not exists analytics_dedup_idx   on app.analytics_events(card_id, type, ip_hash, created_at);
create index if not exists analytics_company_idx on app.analytics_events(company_id, created_at);

-- ---------------------------------------------------------------------------
-- 4. Auditoria append-only (regra 11): sem passwords nem tokens; sem update nem delete.
-- ---------------------------------------------------------------------------
create table if not exists app.audit_logs (
  id            text primary key default ('a_' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 14)),
  -- null para ações sem empresa (por exemplo login falhado ou ações do platform_admin).
  company_id    text references app.companies(id) on delete set null,
  actor_user_id uuid,
  -- Cópia do nome e email no momento da ação (o registo sobrevive à remoção do utilizador).
  actor_name    text not null default '' check (char_length(actor_name) <= 120),
  actor_email   text not null default '' check (char_length(actor_email) <= 254),
  action        text not null check (action in (
    'auth.login', 'auth.login_failed', 'auth.logout', 'auth.mfa_enabled', 'auth.password_changed',
    'auth.sessions_revoked', 'company.created', 'company.updated', 'member.invited', 'member.role_changed',
    'member.removed', 'card.created', 'card.updated', 'card.activated', 'card.deactivated', 'card.lost',
    'card.blocked', 'profile.created', 'profile.updated', 'contact.sent'
  )),
  target        text check (char_length(target) <= 200),
  metadata      jsonb not null default '{}'::jsonb,
  request_id    text check (char_length(request_id) <= 64),
  created_at    timestamptz not null default now()
);
create index if not exists audit_company_idx on app.audit_logs(company_id, created_at desc);
create index if not exists audit_action_idx  on app.audit_logs(action, created_at desc);

-- Defesa em profundidade: mesmo que alguém conceda privilégios a mais, update/delete falham.
create or replace function app.audit_logs_append_only() returns trigger
language plpgsql as $$
begin
  raise exception 'audit_logs é append-only';
end
$$;
drop trigger if exists audit_logs_no_change on app.audit_logs;
create trigger audit_logs_no_change before update or delete on app.audit_logs
  for each row execute function app.audit_logs_append_only();

-- ---------------------------------------------------------------------------
-- 5. RLS das tabelas novas (só para app_backend; contexto da sessão em current_setting).
-- ---------------------------------------------------------------------------
alter table app.contact_shares     enable row level security;
alter table app.email_suppressions enable row level security;
alter table app.analytics_events   enable row level security;
alter table app.audit_logs         enable row level security;

drop policy if exists contact_shares_rw on app.contact_shares;
create policy contact_shares_rw on app.contact_shares for all to app_backend
  using (current_setting('app.is_platform_admin', true) = 'true' or company_id = current_setting('app.company_id', true))
  with check (current_setting('app.is_platform_admin', true) = 'true' or company_id = current_setting('app.company_id', true));

-- Lista global de cancelamentos: o backend consulta-a antes de cada email e insere ao cancelar.
drop policy if exists email_suppressions_rw on app.email_suppressions;
create policy email_suppressions_rw on app.email_suppressions for all to app_backend
  using (true) with check (true);

-- Os eventos públicos são inseridos no contexto da empresa do cartão, resolvida no servidor pela vista pública.
drop policy if exists analytics_events_rw on app.analytics_events;
create policy analytics_events_rw on app.analytics_events for all to app_backend
  using (current_setting('app.is_platform_admin', true) = 'true' or company_id = current_setting('app.company_id', true))
  with check (current_setting('app.is_platform_admin', true) = 'true' or company_id = current_setting('app.company_id', true));

drop policy if exists audit_logs_read on app.audit_logs;
create policy audit_logs_read on app.audit_logs for select to app_backend
  using (current_setting('app.is_platform_admin', true) = 'true' or company_id = current_setting('app.company_id', true));
-- Inserir: na própria empresa, ou sem empresa (ações de sistema, como o login falhado).
drop policy if exists audit_logs_insert on app.audit_logs;
create policy audit_logs_insert on app.audit_logs for insert to app_backend
  with check (
    current_setting('app.is_platform_admin', true) = 'true'
    or company_id is null
    or company_id = current_setting('app.company_id', true)
  );

-- ---------------------------------------------------------------------------
-- 6. Vista da página pública (regra 4): só cartões ativos e só campos públicos.
--    É a única forma de ler cartões sem contexto de empresa. Corre com os privilégios do dono da vista,
--    por isso as colunas são escolhidas a dedo. O company_id serve só ao backend, para registar
--    os eventos na empresa certa, e nunca é devolvido ao cliente.
-- ---------------------------------------------------------------------------
create or replace view app.public_cards as
select
  c.id          as card_id,
  c.token,
  c.company_id,
  pp.profile_id,
  pp.slug,
  pp.display_name,
  pp.title,
  pp.company,
  pp.bio,
  pp.photo_url,
  pp.theme,
  pp.contacts,
  pp.social_links
from app.cards c
join app.public_profiles pp on pp.profile_id = c.profile_id
where c.status = 'active';

-- ---------------------------------------------------------------------------
-- 7. Privilégios mínimos do app_backend.
-- ---------------------------------------------------------------------------
grant usage on schema app to app_backend;
grant select, insert, update, delete on app.contact_shares, app.analytics_events to app_backend;
revoke update, truncate on app.email_suppressions from app_backend;
grant select, insert, delete on app.email_suppressions to app_backend;
-- audit_logs: só ler e acrescentar.
revoke update, delete, truncate on app.audit_logs from app_backend;
grant select, insert on app.audit_logs to app_backend;
-- As vistas públicas são só de leitura.
revoke insert, update, delete, truncate on app.public_profiles, app.public_cards from app_backend;
grant select on app.public_profiles, app.public_cards to app_backend;

-- ---------------------------------------------------------------------------
-- 8. Anonimização dos destinatários aos 90 dias (regra 5).
--    A função corre com os privilégios do dono (postgres) a partir do pg_cron. O app_backend não a pode chamar.
-- ---------------------------------------------------------------------------
create or replace function app.anonymize_old_contact_shares() returns integer
language sql security definer set search_path = app, pg_temp as $$
  with updated as (
    update app.contact_shares
       set recipient_name = null, recipient_phone = null, recipient_email = null,
           recipient_masked = '—', note = null, anonymized_at = now()
     where anonymized_at is null and created_at < now() - interval '90 days'
    returning 1
  )
  select count(*)::integer from updated;
$$;
revoke all on function app.anonymize_old_contact_shares() from public, anon, authenticated, app_backend;

-- Agendamento diário às 03:00 UTC, só se a extensão pg_cron estiver ativa (Integrations -> Cron).
-- Sem pg_cron, ative-a e volte a correr esta migração.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    execute $cron$select cron.schedule('anonymize-contact-shares', '0 3 * * *',
                                       'select app.anonymize_old_contact_shares()')$cron$;
  else
    raise notice 'pg_cron não está ativo: ative-o e volte a correr esta migração para agendar a anonimização.';
  end if;
end
$$;
