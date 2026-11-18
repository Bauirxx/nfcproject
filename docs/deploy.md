# Publicação (deploy)

Arquitetura (CLAUDE.md): **backend no Render**, **frontend no Vercel**. O frontend chama `/api/*` na
sua própria origem (Vercel) e o Vercel reencaminha esses pedidos para o backend no Render (um *rewrite*),
por isso para o browser tudo é a mesma origem e os cookies de sessão funcionam sem CORS.

> **Estado atual:** o backend tem a autenticação (login, logout, sessão), o health e a página pública
> (cartão, VCF e eventos, ligados à base de dados). Os ecrãs do painel que dependem de outros endpoints
> (cartões, perfis, etc.) ainda dão erro, porque esses endpoints ainda não foram construídos.

## 1. Backend no Render

1. Em [render.com](https://render.com), crie uma conta e ligue o repositório do GitHub.
2. **New +** → **Blueprint** e escolha este repositório. O Render lê o `render.yaml` e cria o serviço `nfc-business-api`.
3. Nas **Environment Variables** do serviço, preencha (como no `.env` local; a chave é a anon/publishable):
   - `SUPABASE_URL` = o URL do projeto Supabase (só o endereço, sem `/rest/v1/`).
   - `SUPABASE_ANON_KEY` = a chave anon/publishable.
   - `DATABASE_URL` = a mesma linha do `apps/api/.env`: o Session pooler com o utilizador `app_backend.<ref>` (ADR-0013). Nunca use a password do `postgres`.
   - `IP_HASH_SECRET` é gerado pelo Render (Blueprint). Se criou o serviço à mão, defina um valor aleatório com pelo menos 32 caracteres.
   - `TRUST_PROXY_HOPS` = `2` (Vercel → Render).
   - `PUBLIC_APP_URL` = o endereço do frontend no Vercel (por exemplo `https://nfc-business.vercel.app`), depois de o publicar.
   - (`NODE_ENV=production`, `NODE_VERSION=24.22.2` já vêm do `render.yaml`.)
4. **Deploy**. Quando terminar, o Render dá um URL, por exemplo `https://nfc-business-api.onrender.com`.
5. Confirme: abra `https://…onrender.com/api/health` → deve mostrar `{"status":"ok"}`.

## 2. Ligar o Vercel ao backend

1. (Feito a 2026-11-18) O `vercel.json` aponta para `https://nfcproject-im6b.onrender.com`. Se o serviço do Render mudar de URL, troque-o aí.
2. Faça commit e push dessa alteração.

## 3. Frontend no Vercel

1. Em [vercel.com](https://vercel.com), ligue o repositório do GitHub (**Add New… → Project**).
2. O Vercel lê o `vercel.json` (build, pasta de saída e os cabeçalhos de segurança). Não é preciso configurar framework.
3. Em **Settings → General → Node.js Version**, escolha **24.x** (o projeto exige Node 24).
4. **Deploy**. O Vercel dá um URL, por exemplo `https://nfc-business.vercel.app`.
5. Confirme: abra o site e faça login com o utilizador criado no Supabase.

## 4. Supabase: recuperação da palavra-passe

O backend pede o email ao Supabase. O link tem de abrir a página `/definir-password` do site com o token de uso único:

1. **Authentication → URL Configuration**:
   - **Site URL** = `https://nfcproject-zeta.vercel.app`;
   - em **Redirect URLs**, acrescente `https://nfcproject-zeta.vercel.app/definir-password`.
2. **Authentication → Emails → Reset Password**: troque o link do modelo por
   `<a href="{{ .RedirectTo }}?token={{ .TokenHash }}">Definir uma nova palavra-passe</a>`.
3. **Authentication → Sign In / Providers → Email**: confirme que a validade do link (Email OTP Expiration) é `3600` segundos (1 hora, regra 1).

O envio de emails do Supabase tem um limite baixo de mensagens por hora. Para produção, configure um SMTP próprio (Resend), o mesmo que o envio de contacto vai usar.

## 5. Supabase: convites (ADR-0017)

1. Em **Project Settings → API Keys**, copie a chave **service_role** (ou "secret"). Ponha-a **só** em `SUPABASE_SERVICE_ROLE_KEY`, no `apps/api/.env` e nas variáveis do Render. Nunca a ponha no chat, no Git nem no Vercel.
2. **Authentication → URL Configuration → Redirect URLs**: acrescente `https://nfcproject-zeta.vercel.app/convite`.
3. **Authentication → Emails → Invite user**: troque o link do modelo por
   `<a href="{{ .RedirectTo }}?token={{ .TokenHash }}">Aceitar o convite</a>`.

## Notas

- As chaves do Supabase ficam só nos painéis do Render e do Vercel (e no `.env` local), nunca no repositório.
- A chave **service_role** só existe no Render e no `.env` local, e só o `SupabaseAdminService` a usa (exceção isolada à regra 3, ADR-0017).
- O backend é empacotado num único ficheiro (`apps/api/dist/server.cjs`) por esbuild (ver ADR-0012), por isso o
  arranque no Render é só `node apps/api/dist/server.cjs`.
- O plano gratuito do Render adormece o serviço quando está sem uso; o primeiro pedido depois disso é mais lento.
