-- NFC Business: migração 0004 (envio de contacto, ADR-0019).
-- Aplicar no Supabase: SQL Editor -> colar -> Run (depois da 0003). Pode correr-se mais do que uma vez.
--
-- O remetente de um envio é o utilizador da sessão (id do Supabase Auth). Nem todos os utilizadores estão espelhados
-- em app.users (por exemplo o platform_admin inicial e contas anteriores aos convites), por isso a chave estrangeira
-- impedia esses utilizadores de enviar. O sender_user_id continua a identificar o remetente para os limites
-- (10/hora, 50/dia) e para o histórico, sem depender do espelho.
alter table app.contact_shares drop constraint if exists contact_shares_sender_user_id_fkey;
