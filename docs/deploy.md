# Publicação (deploy)

Arquitetura (CLAUDE.md): **backend no Render**, **frontend no Vercel**. O frontend chama `/api/*` na
sua própria origem (Vercel) e o Vercel reencaminha esses pedidos para o backend no Render (um *rewrite*),
por isso para o browser tudo é a mesma origem e os cookies de sessão funcionam sem CORS.

> **Estado atual:** o backend só tem a autenticação (login, logout, sessão) e o health. Depois do deploy,
> o **login funciona**, mas os ecrãs que dependem de outros endpoints (cartões, perfis, etc.) ainda dão erro,
> porque esses endpoints do backend ainda não foram construídos.

## 1. Backend no Render

1. Em [render.com](https://render.com), crie uma conta e ligue o repositório do GitHub.
2. **New +** → **Blueprint** e escolha este repositório. O Render lê o `render.yaml` e cria o serviço `nfc-business-api`.
3. Nas **Environment Variables** do serviço, preencha (como no `.env` local; a chave é a anon/publishable):
   - `SUPABASE_URL` = o URL do projeto Supabase (só o endereço, sem `/rest/v1/`).
   - `SUPABASE_ANON_KEY` = a chave anon/publishable.
   - (`NODE_ENV=production`, `NODE_VERSION=24.22.2` já vêm do `render.yaml`.)
4. **Deploy**. Quando terminar, o Render dá um URL, por exemplo `https://nfc-business-api.onrender.com`.
5. Confirme: abra `https://…onrender.com/api/health` → deve mostrar `{"status":"ok"}`.

## 2. Ligar o Vercel ao backend

1. No repositório, abra `vercel.json` e troque `https://SUBSTITUA-PELO-URL-DO-RENDER` pelo URL do Render do passo 1.
2. Faça commit e push dessa alteração.

## 3. Frontend no Vercel

1. Em [vercel.com](https://vercel.com), ligue o repositório do GitHub (**Add New… → Project**).
2. O Vercel lê o `vercel.json` (build, pasta de saída e os cabeçalhos de segurança). Não é preciso configurar framework.
3. Em **Settings → General → Node.js Version**, escolha **24.x** (o projeto exige Node 24).
4. **Deploy**. O Vercel dá um URL, por exemplo `https://nfc-business.vercel.app`.
5. Confirme: abra o site e faça login com o utilizador criado no Supabase.

## Notas

- As chaves do Supabase ficam só nos painéis do Render e do Vercel (e no `.env` local), nunca no repositório.
- A chave **service_role** continua fora de tudo isto; só servirá para migrações no CI (CLAUDE.md, regra 3).
- O backend é empacotado num único ficheiro (`apps/api/dist/server.cjs`) por esbuild (ver ADR-0012), por isso o
  arranque no Render é só `node apps/api/dist/server.cjs`.
- O plano gratuito do Render adormece o serviço quando está sem uso; o primeiro pedido depois disso é mais lento.
