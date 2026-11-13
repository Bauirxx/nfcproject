# ADR-0011 — Ligação do backend ao Supabase Auth

- Estado: Aceite (parcial; o modelo de utilizadores na base de dados vem a seguir)
- Data: 2026-11-13

## Contexto

O dono do produto criou um projeto Supabase e forneceu o `SUPABASE_URL` e a chave pública (anon/publishable) num `.env` local. O `CLAUDE.md` (regra 1) manda que o login seja feito pelo backend (NestJS), que chama o Supabase Auth do lado do servidor, com as sessões em cookies HttpOnly. A fundação do backend (ADR-0010) já tem o guard global e o `SessionService` como seam, por ligar.

## Decisão

1. **Configuração do ambiente** (`config/config.module.ts`, `config/env.ts`): a configuração validada é fornecida por injeção pelo símbolo `ENV`. O `main.ts` carrega o `.env` local com `process.loadEnvFile()` (Node 24) em desenvolvimento; em produção a configuração vem do ambiente do processo. O `SUPABASE_URL` é **normalizado para a origem** (`new URL(value).origin`), para tolerar valores colados com caminho (por exemplo `.../rest/v1/`).
2. **Ponte para o Supabase** (`supabase/supabase-auth.service.ts`): cria o cliente `@supabase/supabase-js` com a chave anon e `persistSession: false`. Expõe `getUser(accessToken)` (valida o token) e `signIn(email, password)`. Sem configuração, os métodos devolvem `null` (comportamento da fundação).
3. **Papel e empresa no `app_metadata`** (interim): o `mapSupabaseUser` lê `app_metadata.role` e `app_metadata.company_id` do utilizador do Supabase. O `app_metadata` só é escrito pelo backend/administração, nunca pelo cliente, por isso é fonte fiável para a autorização. Um utilizador sem email ou sem papel não tem sessão válida.
4. **Sessão** (`common/session.service.ts`): lê o cookie HttpOnly `nfc_access` e valida-o com o `SupabaseAuthService`. O guard global passa a ter autenticação real: um token válido dá acesso, tudo o resto dá 401.

## Alternativas

1. Guardar o papel/empresa numa tabela `app.users` desde já: é o destino final (regra 3, com RLS), mas precisa do schema `app`, das migrações e dos dados criados no projeto Supabase. Fica para o bloco seguinte; usar o `app_metadata` desbloqueia a autenticação sem esperar por tudo isso.
2. Validar o JWT localmente com o segredo: evitava uma chamada por pedido, mas obrigava a guardar o segredo do JWT e a replicar a lógica do Supabase. `auth.getUser` é mais simples e seguro para já.

## Consequências

- O backend valida sessões reais contra o Supabase. O endpoint de **login** (`POST /api/auth/login`, a pôr os cookies) e a **sessão completa** (nome, nome da empresa, estado do MFA — campos do contrato `sessionUserSchema`) ficam para o próximo bloco, porque dependem do modelo de utilizadores na base de dados.
- **Por fazer, a seguir:** migrações do schema `app` (tabela `users` e restantes), RLS, papel `app_backend`, e o controlador de autenticação (login/logout) a pôr e limpar os cookies. Depois, ligar o frontend ao backend real endpoint a endpoint (`API_MOCKING=false`), substituindo o MSW.
- A chave service_role continua fora da aplicação (só para migrações no CI, regra 3). O `.env` local nunca entra no repositório.
- Mantém-se em aberto (ADR-0010) a estratégia de empacotamento executável do backend e a forma de consumir `@nfc-business/shared` em runtime; a autenticação atual não depende disso para o `typecheck`, os testes e o build.
