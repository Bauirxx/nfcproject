# PROJECT_STATE — NFC Business

Atualizado em 2026-11-13.

## Identificação

- Produto: NFC Business, plataforma de cartões de visita digitais por NFC e QR Code.
- Repositório: https://github.com/Bauirxx/nfcproject
- Instruções obrigatórias: `CLAUDE.md` (prompt mestre) e `docs/prompts/FRONTEND.md`.
- Fase em curso: frontend sobre API simulada (MSW) e backend `apps/api` (fase 1). O Supabase está **ligado** (ADR-0011): a sessão valida o token real; faltam o schema `app` e o login BFF.

## Resumo da arquitetura

- Monorepo pnpm: `apps/web` (React 19, Vite 8, TypeScript 6, Tailwind 4), `packages/shared` (schemas Zod, constantes, validadores, links e permissões) e `apps/api` (backend NestJS 11 com adaptador Express; fundação feita).
- O frontend só chama `/api/*` na mesma origem, com `credentials: include` e `X-CSRF-Token` nos pedidos que alteram dados (`apps/web/src/shared/api/client.ts`).
- A página pública (`/c/:token`, `/p/:slug`) entra no carregamento inicial; o painel é carregado à parte (ADR-0003).
- Decisões registadas em `docs/adr/0001` a `0009`; grafo do código em `docs/codebase-graph.md`.

## Módulos

auth, companies, members, cards, profiles, sharing, contact-sending, analytics, themes, audit, public-card. Nenhum tem ainda ecrãs implementados.

## Funcionalidades concluídas

Cumprem a Definition of Done:

- T-FE-02 Pacote partilhado (`packages/shared`): schemas, validadores, links, permissões, contraste e imagens, com 82 testes, registado no grafo e nos ADR-0004, 0005 e 0009.
- T-FE-05 Estrutura do painel: router por objetos (`app/routes.tsx`) com guards por sessão, MFA e permissão, casca responsiva (`app/app-shell.tsx`) com menu por papel e seletor de tema, páginas de erro 403/404/500/sessão expirada, cliente do TanStack Query com avisos (toasts), sessão sobre `['session']` e `main.tsx` a arrancar a API simulada e a carregar o painel por `import()`. Os ecrãs internos são provisórios (`PlaceholderPage`) até às tarefas seguintes. 13 testes; build de produção verificado.
- T-FE-06 Autenticação: login, verificação MFA (TOTP e código de recuperação), configuração de MFA (QR local com `uqr` desenhado em SVG + chave manual + códigos de recuperação mostrados uma vez), recuperação e definição de palavra-passe (token do URL, retirado do endereço) e aceitar convite, sobre a API simulada e com respostas validadas por `apiParsed`. 19 testes.
- T-FE-10 Página pública (cartão por token `/c/:token` e perfil por endereço amigável `/p/:slug`): render estático e leve a partir de `main.tsx`, página neutra «Cartão indisponível» para tudo o que não seja um cartão ativo com perfil, ações (VCF, Ligar, WhatsApp, Email, Website, Localização) e redes sociais a partir de dados saneados, tema do perfil aplicado por estilos inline, eventos públicos (`view`, `whatsapp_click`, `email_click`, `vcf_download`), QR a pedido (`uqr` por `import()`) e partilha (`navigator.share` com cópia de link). 4 testes. Build confirmado: chunk inicial 78 KB gzip (sem router/TanStack Query/RHF/Zod); painel e QR carregam à parte. Falta o envio do dono (T-FE-11).
- T-FE-12/13 Cartões: lista com pesquisa (debounce), filtro por estado e paginação; criação (com perfil opcional); detalhe com endereço do chip (copiar), QR Code no ecrã e transferência em PNG e SVG, associação de perfil, ações de estado (ativar/desativar/perdido/bloquear) com confirmação nas irreversíveis e histórico. 8 testes (inclui `qr.test.ts`).
- T-FE-14/15/16 Perfis: lista (pesquisa com debounce, paginação, posse por papel), criar (nome e dono opcional), editor (nome/cargo/empresa/apresentação, interruptores de visibilidade, contactos e redes reordenáveis por arrastar e por botões, fotografia com recorte, dono) e editor de tema (modelo, três cores com verificação de contraste AA ao vivo que bloqueia o guardar, logótipo). 25 testes novos (inclui `image-validation`, `sortable-list`, `photo-crop-dialog`, `theme-editor`, `profiles-page`, `profile-editor-page`).
- T-FE-17/18 Envio de contacto: formulário reutilizável (`SendContactForm`) com perfil pré-selecionado, destinatário validado (email, ou telefone normalizado para E.164 com +258 por defeito), canal Email/WhatsApp/SMS, nota até 200 caracteres e pré-visualização da mensagem; Email envia pela API, WhatsApp abre `wa.me` e SMS abre `sms:`, todos registando o envio; histórico com destinatário mascarado e mensagem clara de limite (429). 4 testes.
- T-FE-11 «Enviar o meu contacto» na página pública: só aparece ao dono do perfil com sessão (verificado por `loadSession` + `GET /api/profiles/:id`); abre o `SendContactForm` embrulhado em `public-send-panel`, carregado por `import()` dinâmico para ficar fora do bundle público (chunk próprio de ~70 KB gzip). 3 testes novos na página pública.
- T-BE-01 (parcial) Fundação do backend `apps/api` (NestJS 11, Express): guard global negar-por-defeito com `@Public()`, filtro de erros no formato do contrato, validação do ambiente (Zod), cabeçalhos de segurança (helmet) e CORS fechado, e health público. 10 testes.
- T-BE-02 (parcial) Ligação ao Supabase Auth e login BFF: `SupabaseAuthService` (`getUser`/`signIn`), `.env` carregado no arranque, papel e empresa do `app_metadata`, sessão a validar o token real (ADR-0011); `AuthController` com `POST /api/auth/login` (põe cookies HttpOnly), `logout` e `GET /api/auth/session`. 12 testes novos. Falta criar o utilizador no Supabase e o schema `app`/RLS.
- T-FE-19 Empresas (só platform_admin): lista com contagens de cartões e membros, criar (convida o primeiro administrador por email), editar, cores da marca e logótipo. 5 testes. O ajudante de upload passou para `shared/lib/upload.ts` (usado por perfis, temas e empresas).
- T-FE-20 Membros (só company_admin): lista, convidar por email com papel, mudar papel em linha, remover com confirmação; o próprio não se altera nem se remove (desativado na interface, além da proteção da API). 6 testes.
- T-FE-21 Dashboard: totais dos últimos 30 dias (visitas, cliques, VCF, contactos enviados) de `GET /api/analytics/summary` e atalhos por papel (com «Enviar contacto» em destaque para o dono de perfil). 4 testes. Query de analytics partilhada em `features/analytics/queries.ts`.
- T-FE-22 Estatísticas: filtros por período, cartão e (platform_admin) empresa; quatro gráficos de linha em SVG local (pequenos múltiplos, uma cor por gráfico, dica por ponto focável); tabela por cartão; exportação CSV protegida contra injeção de fórmulas (`shared/lib/csv.ts`). 13 testes (gráfico, CSV e página). Skill `dataviz` seguido: pequenos múltiplos para evitar eixo duplo.
- T-FE-24 Auditoria (só administradores, `audit.view`): tabela paginada (mais recentes primeiro) com filtros por ação, por autor (nome ou email, com debounce) e por intervalo de datas (`De`/`Até`), sobre `GET /api/audit`; estados de carregamento, vazio e erro. platform_admin vê tudo; company_admin só a sua empresa (filtragem no handler). `features/audit/{queries,audit-page}.tsx`, `shared/i18n/panel/audit.ts`, rota `/painel/auditoria` ligada. 4 testes.

O que mais existe e está verificado:

- Ferramentas do repositório: workspace pnpm, TypeScript, ESLint (inclui `react/no-danger` e proibição de armazenamento do browser), configuração do Vite com CSP no `preview`.
- `packages/shared` completo: 77 testes a passar.
- Cliente da API com CSRF, renovação de sessão e tratamento de 401, 403 e 429: 23 testes a passar.
- TOTP da API simulada (RFC 6238): 8 testes a passar.
- Mecânica comum dos handlers da API simulada (CSRF, sessão, permissões, validação, limites): 7 testes a passar.
- Handlers de autenticação e conta da API simulada (`handlers/auth.ts`): 34 testes a passar.
- Handlers de uploads, empresas e membros da API simulada (`handlers/{uploads,companies,members}.ts`): 32 testes a passar.
- Handlers de cartões da API simulada (`handlers/cards.ts`): 18 testes a passar.
- Handlers de perfis da API simulada (`handlers/profiles.ts`): 18 testes a passar.
- Handlers de envio de contacto da API simulada (`handlers/contact-shares.ts`): 12 testes a passar.
- Handlers de estatísticas e auditoria da API simulada (`handlers/{analytics,audit}.ts`): 15 testes a passar.
- Handlers públicos da API simulada (`handlers/public.ts`) e gerador de vCard 4.0 (`mocks/vcard.ts`): 18 testes a passar.
- Junção de todos os handlers com 404 para `/api/*` desconhecidos (`handlers/index.ts`): 3 testes a passar.
- Servidor MSW global nos testes (`mocks/server.ts` ligado em `src/test/setup.ts`), arranque no browser (`mocks/browser.ts`) e captura do clique no link do VCF (`mocks/vcf-download.ts`): 5 testes a passar.

## Em curso

| Tarefa | Estado | Notas |
| --- | --- | --- |
| T-FE-01 Base do projeto | Em revisão | `main.tsx` e `scripts/check-bundle-size.mjs` feitos; falta `playwright.config.ts` (T-FE-27) |
| T-FE-03 Cliente da API | Em revisão | Código, testes e ADR-0005 prontos; `lib/parsed-api.ts` ganha teste com o primeiro consumidor (T-FE-06) |
| T-FE-04 API simulada (MSW) | Em revisão | Código, testes, ADR-0009 e grafo prontos; `main.tsx` chama `startMockApi`; falta confirmar o worker no browser real (ao abrir `pnpm dev`) |
| T-BE-01 Fundação do backend | Em desenvolvimento | Estrutura, segurança, guard global, filtro de erros, env e health feitos (10 testes) |
| T-BE-03 Validação com Zod partilhado | Em desenvolvimento | `ZodValidationPipe` a consumir `@nfc-business/shared/schemas` (2 testes); falta aplicar aos endpoints e o empacotamento executável |
| T-BE-02 Supabase e login BFF | Em desenvolvimento | Login/logout/sessão feitos; login real verificado (HTTP 200). Migração 0001 aplicada; ligação `app_backend` com RLS verificada (ADR-0013). Falta a migração 0002 e os restantes endpoints do contrato |
| Deploy (Render + Vercel) | Em desenvolvimento | Backend empacotado e a correr localmente (`/api/health` 200); `render.yaml`, `vercel.json` e `docs/deploy.md` prontos (ADR-0012). A publicação em si é feita pelo dono nas contas Render/Vercel |

## Pendentes

T-FE-06 a T-FE-28 (ver `docs/requirements.md`): autenticação, página pública, cartões, perfis, envio de contacto, empresas, membros, painel, estatísticas, temas, auditoria, conta, testes finais (Vitest, axe, Playwright) e orçamento do bundle.

## Bloqueios

Nenhum.

## Problemas conhecidos e pontos por confirmar

- Os endpoints marcados como «inferidos» no ADR-0004 e os pressupostos P-01 a P-08 de `docs/requirements.md` precisam de confirmação quando o backend for desenhado.
- `apps/web/src/mocks/credentials.ts` e `seed.ts` têm palavras-passe e chaves TOTP fictícias (domínios `.test`). Quando o gitleaks for configurado, estes dois ficheiros precisam de uma exceção.
- Tailwind 4 exige browsers recentes (Safari 16.4, Chrome 111, Firefox 128).
- `containsLink` pode recusar notas com um ponto sem espaço antes de palavras como «com» (aceite: erra para o lado seguro).
- O ficheiro `apps/web/mocks-static/mockServiceWorker.js` tem de acompanhar a versão do MSW (3.0.3); confirmar no browser quando `main.tsx` existir.
- Os ficheiros `cn.ts`, `parsed-api.ts` e os de `shared/i18n` passam no typecheck e no lint, mas ainda não têm testes próprios nem consumidores.

## Decisões

Ver `docs/adr/` (0001 a 0016). A estratégia de testes e a API simulada estão no ADR-0009; os códigos de erro da API simulada a confirmar pelo backend estão no complemento do ADR-0004.

Decisões da T-FE-05 (sem ADR próprio; impostas pela CSP estrita, ADR-0006):

- O menu no telemóvel é um painel colapsável (botão com `aria-expanded`/`aria-controls`), não um diálogo modal: o `react-remove-scroll` usado pelo `Dialog` do Radix injeta um `<style>`, incompatível com `style-src 'self'`. O Radix Dialog/DropdownMenu só será usado onde for mesmo preciso (confirmações de ações em cartões e membros) e a compatibilidade com a CSP será verificada nos e2e (T-FE-27).
- A conta e o terminar sessão estão no rodapé da barra lateral (visíveis), em vez de um menu suspenso, pela mesma razão e porque a gestão detalhada da conta tem ecrã próprio (T-FE-25).
- O tema é um store ao nível do módulo (`app/theme.ts`) sobre a única leitura de `localStorage` permitida (`shared/lib/theme-preference.ts`); o modo escuro é a classe `dark` em `<html>`.

## Alterações recentes

- 2026-11-18: **Perfis no backend real** (`apps/api/src/profiles/profiles.controller.ts`):
  - lista com pesquisa e paginação; o dono de perfil só vê os seus (P-04);
  - criação com slug único entre empresas (a base de dados garante a unicidade; em conflito tenta-se um sufixo, com savepoint);
  - edição de campos, visibilidade, contactos, redes e tema (só com `themes.manage`); o dono só é atribuído pelo company_admin (P-10);
  - `activeCardToken` e `cardsCount`; auditoria;
  - a fotografia e o logótipo só podem ser removidos, até existirem os uploads.

  `profiles.integration.test.ts` verifica contra o Supabase real: slug, edição, campos privados ausentes da página pública, permissões e isolamento entre empresas.

- 2026-11-18: **Cartões no backend real** (`apps/api/src/cards/cards.controller.ts`): lista com pesquisa, filtro e paginação; criação com token de 128 bits; edição (rótulo e perfil da mesma empresa); ativar, desativar, perdido e bloquear com as transições de `CARD_TRANSITIONS` (não se ativa um cartão sem perfil e `blocked` é terminal); histórico em jsonb; auditoria. Posse por `id` e `company_id` da sessão, além da RLS. `cards.integration.test.ts` verifica contra o Supabase real, incluindo o isolamento entre empresas (404 em todas as operações). Com `DB_INTEGRATION=1`, o tempo limite dos testes passa a 60 s.

- 2026-11-18: **Primeiros endpoints do painel no backend real**, todos com o contexto RLS da sessão e as permissões partilhadas:
  - `GET /api/analytics/summary` (`analytics/analytics.service.ts`): agregação por cartão e dia civil (Africa/Maputo), visibilidade por papel, `byCompany` só para o platform_admin e 404 para um cartão de outra empresa;
  - `GET /api/audit` (`audit/audit.controller.ts`): filtros e paginação;
  - `GET`/`PATCH /api/companies[/:id]` (`companies/companies.controller.ts`). O `POST /api/companies` responde 501 `invites_unavailable`: convidar o primeiro administrador exige a API de administração do Supabase (service_role, regra 3) e **precisa de uma decisão do dono**. O logótipo fica à espera do módulo de uploads.

  Verificado contra a base de dados real (`analytics/panel.integration.test.ts`): isolamento entre empresas e totais. Com `DB_INTEGRATION=1`, os ficheiros de teste correm em série.

- 2026-11-18: **MFA TOTP no backend (ADR-0016).** Endpoints `/api/auth/mfa/{setup,confirm,verify,disable}` com a API de MFA do Supabase, sempre na sessão do utilizador e sem `service_role`. Também:
  - limites de 5 tentativas por minuto: no login por IP e por email (regra 1) e nos códigos de MFA por utilizador e por IP;
  - `AuditService` com `auth.login`, `auth.login_failed` e `auth.mfa_enabled`;
  - decisão do dono: **sem códigos de recuperação na v1**; o contrato, o frontend, a API simulada e os testes foram atualizados.

  Testes: 461 (90 shared, 295 web, 76 api). Falta verificar a configuração do MFA no site publicado com uma aplicação de autenticação real.

- 2026-11-18: **Correção de segurança da sessão (ADR-0015).** No site publicado, o login mostrava erro apesar de a password estar certa, e o painel abria com "Olá, undefined". Causa: o backend devolvia o utilizador fora do contrato e o frontend não validava a sessão.
  - Backend: sessão completa no contrato (nome, empresa, `mfaEnabled`, `mfaRequired`, `csrfToken`).
  - Backend: MFA obrigatório aplicado no servidor (`aal`, `mfaPending`, 403 `mfa_setup_required` fora das rotas `@AllowWithoutMfa`).
  - Backend: `CsrfGuard` global (X-CSRF-Token com HMAC da sessão e Origin = `PUBLIC_APP_URL`).
  - Frontend: o `loadSession` valida o utilizador e falha fechada.
  - Testes: 67 api e 296 web; bundle público 77,2 KB.
  - Consequência: os administradores sem MFA ficam limitados à configuração do MFA, cujos endpoints são a próxima tarefa.

- 2026-11-18: **T-BE-05, página pública no backend real (ADR-0014).** Acrescentados:
  - `apps/api/src/public/{public.controller,public-card.service,public.module}.ts`, com cartão e VCF por token e por slug e com `POST /api/public/events`;
  - `common/rate-limiter.ts` (60 pedidos/min por IP) e `common/ip-hash.ts` (HMAC com sal diário);
  - `trust proxy` configurável (`TRUST_PROXY_HOPS`) e as variáveis `IP_HASH_SECRET` (obrigatória em produção) e `PUBLIC_APP_URL`;
  - o gerador de vCard passou para `packages/shared/src/vcard.ts`, partilhado com a API simulada.

  Verificado contra a base de dados real: teste de integração de `public_cards` com rollback (só o cartão ativo e só os campos públicos) e pedidos HTTP ao servidor compilado (404 neutro com `noindex` e `no-store`; evento inexistente dá 204; evento fora da lista dá 422). Testes: 440 (90 shared, 295 web, 55 api) e mais 10 de integração. Análise STRIDE em `docs/requirements.md`.

- 2026-11-18: **Migração 0002** (`supabase/migrations/0002_sharing_analytics_audit.sql`), **aplicada e verificada** (pg_cron ativo):
  - corrige a 0001, restringindo as políticas ao `app_backend` (antes valiam para `PUBLIC`) e revogando o acesso de `anon` e `authenticated` ao schema `app`;
  - cria `contact_shares` (anonimização aos 90 dias via pg_cron), `email_suppressions` (hash do email), `analytics_events` (lista fechada, `ip_hash`, índice de deduplicação) e `audit_logs` (append-only, por privilégios e por trigger);
  - cria a vista `public_cards` (só cartões ativos e só campos públicos, para a página pública sem contexto).

  Mais 4 testes de integração que verificam a 0002 depois de aplicada.
- 2026-11-18: **Ligação do backend à base de dados (ADR-0013).** O dono aplicou a migração 0001 no Supabase, ativou o login do `app_backend` (sem BYPASSRLS), pôs o `DATABASE_URL` (Session pooler) no `apps/api/.env` e ativou o "Enforce SSL". Acrescentados `apps/api/src/database/database.service.ts` (pool `pg`, TLS verificado com `apps/api/certs/supabase-ca.crt`, contexto RLS por transação com `set_config(..., true)`), `DATABASE_URL` e `DATABASE_POOL_MAX` no env (o `DATABASE_URL` é obrigatório em produção), `pg-native` como externo no esbuild, `DATABASE_URL` no `render.yaml` e no `docs/deploy.md`. +9 testes unitários e 5 de integração verificados contra a base de dados real (papel `app_backend`, contexto local à transação, RLS a bloquear escritas, sem acesso ao schema `auth`).
- 2026-11-18: T-FE-28 — `apps/web/scripts/check-bundle-size.mjs` (`pnpm --filter @nfc-business/web check:bundle`): soma o JavaScript inicial do `index.html` de produção em gzip e falha acima de 100 KB. Resultado atual: 77,0 KB.
- 2026-11-18: T-FE-23 temas — `features/themes/themes-page.tsx` (escolher o perfil e editar o tema com o `ThemeEditor` existente; sem requisitos novos), `shared/i18n/panel/themes.ts`, rota `/painel/temas` ligada. Removido `app/placeholder-page.tsx` (já nenhum ecrã é provisório). 3 testes (409). **Todos os ecrãs do frontend (T-FE-05 a T-FE-25) estão feitos.**
- 2026-11-18: T-FE-25 conta — `features/account/{queries,account-page}.tsx`, `shared/i18n/panel/account.ts`, rota `/painel/conta` ligada: dados pessoais, palavra-passe, estado do MFA (ativar/desativar conforme o papel) e sessões ativas com «terminar todas». 5 testes (406 no total).
- 2026-11-13: **T-FE-24 Auditoria concluída** — `features/audit/{queries,audit-page}.tsx`, `shared/i18n/panel/audit.ts` (`auditActionLabels`, `auditTexts`), rota `/painel/auditoria` ligada (substitui o `PlaceholderPage`). Tabela paginada com filtros por ação, autor (debounce) e datas sobre `GET /api/audit`. +4 testes → 401 (82 shared + 295 web + 24 api). `typecheck` 0, `lint` 0. Grafo e requisitos atualizados.
- 2026-11-13: fundação da base de dados — `supabase/migrations/0001_foundation.sql` (schema `app`, papel `app_backend`, tabelas `companies`/`users`/`profiles`/`cards`, vista `public_profiles`, RLS por `current_setting('app.company_id')`) e `supabase/README.md`. Por aplicar e verificar no Supabase.
- 2026-11-13: login real do Supabase verificado de ponta a ponta (utilizador Arsénio Baquir = platform_admin). Backend tornado executável: empacotado com esbuild num `dist/server.cjs` (resolve o arranque e o consumo do pacote partilhado), DI explícita com `@Inject`, `CoreModule` global; a correr localmente (`/api/health` 200, `/api/auth/session` `{user:null}`). Configuração de deploy: `render.yaml` (backend), `vercel.json` (frontend, com rewrite `/api` e cabeçalhos de segurança), `docs/deploy.md` e ADR-0012.

- 2026-11-13: login BFF no backend (`POST /api/auth/login` com cookies HttpOnly, `logout`, `GET /api/auth/session`), a autenticar pelo Supabase. +4 testes (397). Falta criar o utilizador no Supabase para o login real.
- 2026-11-13: backend ligado ao Supabase Auth (ADR-0011): config por `ENV`, `.env` carregado com `process.loadEnvFile`, `SupabaseAuthService`, `SessionService` a validar o token real; `SUPABASE_URL` normalizado para a origem. Chaves do projeto do dono confirmadas por um teste de ligação (HTTP 200). +8 testes (393).

- 2026-11-13: T-FE-22 estatísticas (filtros, 4 gráficos de linha SVG, tabela por cartão, exportação CSV protegida), 13 testes (385). Skill `dataviz` aplicado.
- 2026-11-13: T-FE-21 dashboard (totais dos últimos 30 dias e atalhos por papel) e `features/analytics/queries.ts`, 4 testes (372).
- 2026-11-13: T-FE-20 membros (lista, convidar, mudar papel, remover com confirmação; o próprio protegido), 6 testes (368).
- 2026-11-13: T-FE-19 empresas (lista, criar com convite do administrador, editar, marca e logótipo), 5 testes; `uploadImage` movido para `shared/lib/upload.ts`. +5 testes (362).
- 2026-11-13: `ZodValidationPipe` no backend, a validar com os schemas Zod partilhados de `@nfc-business/shared` (422 `validation_failed`); confirma que o backend consome o contrato partilhado. +2 testes (357).
- 2026-11-13: início do backend `apps/api` (NestJS 11, fase 1 fundação): segurança, guard global negar-por-defeito, filtro de erros do contrato, validação do ambiente e health público, com 10 testes. ADR-0010; requisitos e grafo atualizados. Dependências do NestJS adicionadas ao lockfile.
- 2026-11-13: T-FE-11 (envio do dono na página pública) **concluída**. `features/contact-sending/public-send-panel.tsx` (lazy, providers próprios) e o botão do dono em `features/public-card/public-card-page.tsx`. +3 testes (345 no total); build confirmado: a página pública mantém-se em ~79 KB gzip e o formulário de envio é um chunk separado. Grafo atualizado.
- 2026-11-13: T-FE-17/18 (envio de contacto) **concluída**. `features/contact-sending/*` (queries, `SendContactForm` reutilizável, `ContactHistory`, página) e `shared/i18n/panel/contact.ts`; rota `/painel/enviar-contacto` ligada. +4 testes (342 no total); build de produção confirmado (página pública 78,9 KB gzip). Grafo atualizado.
- 2026-11-13: T-FE-14/15/16 (perfis) **concluída**. Acrescentados `features/profiles/{profile-create-dialog,profiles-page,theme-editor,profile-editor-page}.tsx` e os testes de `image-validation`, `sortable-list`, `photo-crop-dialog`, `theme-editor`, `profiles-page` e `profile-editor-page`; rotas `/painel/perfis` e `/painel/perfis/:id` ligadas. +25 testes (338 no total); build de produção confirmado (página pública 78 KB gzip). Grafo e requisitos atualizados.
- 2026-11-13: T-FE-14/15/16 (perfis) — checkpoint WIP (ainda **não concluída**). Escritos os blocos base, todos a passar no `typecheck` e no `lint`, sem afetar os 313 testes existentes (nenhum ficheiro anterior foi alterado): textos (`shared/i18n/panel/profiles.ts`), componentes base (`shared/components/ui/{switch,textarea,color-field}.tsx`), validação de imagem no cliente (`shared/lib/image-validation.ts`), fluxo de upload (`features/profiles/upload.ts`), queries (`features/profiles/queries.ts`), lista reordenável (`features/profiles/sortable-list.tsx`), recorte de foto (`features/profiles/photo-crop-dialog.tsx`) e campo de foto (`features/profiles/photo-field.tsx`). Falta o resto (ver registo de continuidade).
- 2026-11-12: cliente da API e testes; textos centralizados (`shared/i18n`); início da API simulada; primeiro commit no GitHub.
- 2026-11-12: handlers de autenticação e conta da API simulada (sessão, login, MFA, recuperação, convite, conta, sessões) com 34 testes; `endCurrentSession` no domínio; helper `handlers/testing.ts` para os testes dos handlers.
- 2026-11-12: handlers de uploads (URL assinado, magic bytes, `consumeUpload`), empresas e membros com 32 testes; `inviteUser` e `emailTaken` no domínio; `uploadImage` no helper de testes.
- 2026-11-12: handlers de cartões (lista com pesquisa, filtro e paginação; criar; editar; ativar, desativar, perdido e bloquear; histórico) com 18 testes.
- 2026-11-12: handlers de perfis (lista com pesquisa e posse, criação com endereço amigável único, edição de campos, contactos, redes sociais, visibilidade, dono, fotografia e tema com logótipo) com 18 testes.
- 2026-11-12: handlers de envio de contacto (registo com destinatário mascarado, limites por hora e por dia, evento `contactsSent`, auditoria, histórico com posse) com 12 testes; `bumpCounter` e `counterKey` no domínio.
- 2026-11-12: handlers de estatísticas (série diária determinística mais eventos registados, por cartão e por empresa, com posse e filtros) e de auditoria (filtros por ação, autor e datas; isolamento por empresa) com 15 testes.
- 2026-11-12: handlers públicos (cartão por token e por endereço amigável, VCF, eventos com deduplicação) e gerador de vCard 4.0 com escape e dobragem de linhas, com 18 testes.
- 2026-11-12: `handlers/index.ts` junta todos os handlers e responde 404 `not_found` a qualquer outro `/api/*`, com 3 testes (inclui a verificação de que não há método e caminho repetidos).
- 2026-11-12: documentação da T-FE-04: ADR-0009 (estratégia de testes e API simulada), `docs/codebase-graph.md`, pressupostos P-09 a P-11 e estados das tarefas em `docs/requirements.md`, complementos aos ADR-0004 (códigos de erro) e ADR-0005 (renovação, `refreshable`, CSRF).
- 2026-11-12: `mocks/server.ts` ligado em `src/test/setup.ts` (todos os testes correm sobre a API simulada completa; `useMockServer` passou a acrescentar rotas ao servidor global antes de cada teste), `mocks/browser.ts` (`startMockApi`) e `mocks/vcf-download.ts` com 5 testes.
- 2026-11-12: T-FE-12/13 — cartões. Componentes base de listas/detalhe (`dialog` acessível sem Radix + `use-scroll-lock`, `confirm-dialog`, `page-header`, `badge`, `empty-state`, `error-state`, `table`, `pagination`, `select`); `features/cards` (queries, lista, criação, detalhe, badge de estado, descarga de QR); `shared/lib/{qr,download}`; hooks `use-debounced-value` e `use-document-title`; marca «Opcional» agora desligável (`hideOptional`) para filtros. 8 testes.
- 2026-11-12: T-FE-10 — página pública. `main.tsx` ramifica por caminho e importa estaticamente `features/public-card/mount` (import relativo); `public-card-page` (fetch + estados carregar/indisponível/pronto), `parse-public-card` (guarda de tipo sem Zod + saneamento de cores), `public-events` (lista fechada) e `public-qr` (uqr por `import()`). Chunk inicial 78 KB gzip. 4 testes.
- 2026-11-12: T-FE-06 (completa) — configuração de MFA (QR local `uqr` em SVG via `shared/components/ui/qr-code.tsx`, chave manual e códigos de recuperação mostrados uma vez), recuperação e definição de palavra-passe (token lido do URL com `useUrlToken` e retirado do endereço) e aceitar convite. Schemas de formulário (`features/auth/schemas.ts`) com confirmação de palavra-passe. Mais 13 testes.
- 2026-11-12: T-FE-06 (parcial) — login e verificação MFA. Componentes de formulário (`input`, `label`, `text-field`, `password-field`, `card`, `alert`), textos de autenticação, `AuthLayout`, `LoginPage` e `MfaVerifyPage` (TOTP e código de recuperação) sobre a API simulada, com `apiParsed` a validar as respostas. Rótulos marcam o campo opcional (não o obrigatório). 6 testes.
- 2026-11-12: T-FE-05 — estrutura do painel. Preferência e store de tema, textos do painel (`shared/i18n/panel`), componentes base (`shared/components/ui`: button, spinner, skeleton, toaster + toast-store), sessão e aviso de expiração (`app/session.ts`, `app/session-events.ts`), cliente do TanStack Query, providers, guards, páginas de erro, casca com menu por papel e seletor de tema, rotas, router, `app/entry.tsx` e `main.tsx`. 13 testes (casca, páginas de erro, tema, expiração) e build de produção verificado (`main.tsx` 1,2 KB gzip; painel 130 KB gzip à parte; API simulada fora do build).

## Estado dos testes

- `pnpm typecheck`: sem erros.
- `pnpm lint`: sem erros nem avisos.
- `pnpm test`: 440 testes a passar (90 em `packages/shared`, 295 em `apps/web`, 55 em `apps/api`), mais 10 de integração da base de dados que só correm com `DB_INTEGRATION=1` (verificados a 2026-11-18 contra o Supabase real). Nota: com o paralelismo de ficheiros por defeito, sob carga a suíte `cards` pode falhar por *timeout* dos `findBy*` (1000 ms) — não é regressão (passa isolada e a suíte web completa passa com `--no-file-parallelism`); é um ponto de afinação do ambiente de testes (candidato a T-FE-26).
- `pnpm --filter @nfc-business/web build`: a passar; API simulada fora do bundle; chunk inicial da página pública 78 KB gzip (< 100 KB), sem router/TanStack Query/RHF/Zod (confirmado por `Select-String` no chunk).
- Playwright: ainda sem testes. Falta o `scripts/check-bundle-size.mjs` (T-FE-28).

## Registo de continuidade

- Backend publicado no Render (2026-11-18): `https://nfcproject-im6b.onrender.com` (health 200, página pública 404 neutro com a base de dados, eventos 204, HSTS/CSP, sem X-Powered-By). O `vercel.json` aponta para ele. **Falta trocar a password do `app_backend`**, que ficou visível numa captura de ecrã (SQL `alter role`, `.env` e Render), e publicar o frontend no Vercel.
- Última tarefa: **endpoints do painel: estatísticas, auditoria e empresas (leitura e edição)**. Bloqueio: decisão sobre os convites (criar empresa e membros exige criar contas no Supabase Auth, ou seja `service_role` ou outra via). Próximo: membros (lista, mudar papel, remover; convites à espera de decisão), envio de contacto e uploads. Cartões e perfis feitos. Antes: **MFA TOTP no backend (ADR-0016)**; falta o teste real no site com uma aplicação de autenticação. Próximo: os endpoints das empresas (`/api/companies`) e a migração do papel e da empresa para `app.users`. Antes: **correção da sessão, MFA e CSRF (ADR-0015)**. Próxima: endpoints de MFA (`/api/auth/mfa/setup`, `confirm`, `verify`, `disable`) com a API de MFA do Supabase, marcados com `@AllowWithoutMfa()` onde for preciso. Sem eles, o administrador não passa do ecrã de configuração do MFA. Antes: **T-BE-05, página pública no backend real** (ADR-0014). Em revisão: falta confirmar o `TRUST_PROXY_HOPS=2` depois do deploy. No Render é preciso acrescentar `TRUST_PROXY_HOPS=2`, `IP_HASH_SECRET` (aleatório, com 32 ou mais caracteres) e, depois do Vercel, `PUBLIC_APP_URL`. Próximo: os endpoints autenticados, a começar pelas empresas (`/api/companies`) e pela migração do papel e da empresa para `app.users`. Antes: **Migração 0002 aplicada e verificada** (pg_cron ativo; 9 testes de integração a passar contra o Supabase real). Próximo: os primeiros endpoints reais (empresas e página pública) sobre o `DatabaseService` e a vista `public_cards`. Antes: **Ligação à base de dados (ADR-0013)**. `DatabaseService` com o contexto RLS por transação, verificado contra o Supabase real. O `.env` do PC do trabalho tem o `DATABASE_URL`. **No PC de casa é preciso copiar a mesma linha `DATABASE_URL=...` para `apps/api/.env`, porque o ficheiro não vai para o Git.** Próximo: migração 0002 e os primeiros endpoints reais (empresas e página pública) sobre o `DatabaseService`. Antes: **T-FE-23 Temas** — ecrã dedicado que reutiliza o `ThemeEditor`; 3 testes; `PlaceholderPage` removido. Com isto, todos os ecrãs do frontend estão feitos. Antes: **T-FE-25 Conta** (frontend) — dados pessoais, palavra-passe, MFA e sessões; 5 testes. Antes: **T-FE-24 Auditoria** (frontend) — `features/audit/{queries,audit-page}.tsx`, `shared/i18n/panel/audit.ts`, rota ligada; 4 testes; grafo e requisitos atualizados. Antes disso (noutra sessão/máquina): **Backend executável e configuração de deploy (ADR-0012)** — empacotado com esbuild (`node apps/api/dist/server.cjs` corre; `/api/health` 200), DI explícita, `CoreModule` global; `render.yaml`, `vercel.json` e `docs/deploy.md` prontos. Login real do Supabase verificado (utilizador platform_admin criado pelo dono). Antes: login BFF, ligação ao Supabase; frontend até T-FE-22. (filtros, 4 gráficos de linha SVG, tabela por cartão, CSV protegido; 13 testes; skill `dataviz` aplicado). Antes: T-FE-21 dashboard, T-FE-20 membros, T-FE-19 empresas; backend T-BE-01 parcial. Estrutura NestJS, segurança, guard global negar-por-defeito (`@Public()`), filtro de erros do contrato, validação do ambiente e health público, com 10 testes. Decisões no ADR-0010. `typecheck`, `lint`, `pnpm test` (355) e `pnpm --filter @nfc-business/api build` a passar. Antes (frontend): T-FE-11 (envio do dono na página pública) — concluída. Botão «Enviar o meu contacto» só para o dono com sessão, que abre o `SendContactForm` via `public-send-panel` carregado por `import()` (fora do bundle público). Antes: T-FE-17/18 (envio de contacto), T-FE-14/15/16 (perfis). `typecheck`, `lint`, `pnpm test` (345) e build de produção a passar (página pública ~79 KB gzip; formulário de envio em chunk separado).
- Estado e decisões do backend (ADR-0010): `apps/api` usa `module: esnext` + `moduleResolution: bundler` (serve o typecheck e o Vitest); `experimentalDecorators` e `emitDecoratorMetadata` ligados para a DI do NestJS; a regra ESLint `consistent-type-imports` está desligada em `apps/api` (os tipos do construtor têm de ser imports de valor). O `SessionService` lê o cookie `nfc_access` mas ainda não valida (sem Supabase, os endpoints protegidos dão 401 — correto para a fundação). **Bloqueios conhecidos, por resolver nos próximos blocos:** a ligação ao Supabase precisa de credenciais do dono do produto; o `dist` emitido ainda não é executável (a resolução `bundler` não põe extensões para Node ESM) e a forma de consumir `@nfc-business/shared` em runtime fica por decidir.
- Decisões do T-FE-11: a posse verifica-se no cliente com `loadSession()` e, só havendo sessão, `GET /api/profiles/:id` (a resposta privada traz `ownerUserId` e `activeCardToken`, lidos sem Zod para não puxar o Zod para o bundle público); o painel (`public-send-panel`, default export) traz os seus próprios `QueryClientProvider` e `Toaster`, porque a página pública é montada fora dos providers; o import dinâmico de `@/features/*` não é apanhado pela regra `no-restricted-imports` do ESLint (só os estáticos).
- Decisões do envio de contacto: o seletor só mostra perfis com cartão ativo (`useSendableProfilesQuery`); o remetente da mensagem é o nome do perfil escolhido (coerente com «X partilhou consigo o seu cartão»); o telefone é normalizado com `normalizePhone` (+258 por defeito); o formulário usa `useWatch` (não `form.watch`) para a pré-visualização, por causa da regra do React Compiler no ESLint; a mutação tem `meta: { inlineError: true }` e o erro 429 (com `scope`) aparece no formulário via `errorMessage`; WhatsApp/SMS abrem o link com `window.open(url, '_blank', 'noopener,noreferrer')` **depois** de a API registar o envio.
- Ficheiros da tarefa: `apps/web/src/features/profiles/*` (base já no repositório desde o checkpoint anterior: `queries`, `upload`, `sortable-list`, `photo-field`, `photo-crop-dialog`, `switch`/`textarea`/`color-field` em `shared/components/ui`, `image-validation` em `shared/lib`; acrescentados nesta sessão: `profile-create-dialog`, `profiles-page`, `theme-editor`, `profile-editor-page` e os respetivos testes). Rotas em `apps/web/src/app/routes.tsx`.
- Decisões de implementação dos perfis (para não redesenhar):
  - O editor de perfil é um formulário React Hook Form com `zodResolver(profileFieldsSchema)`; o tipo do formulário é `z.input<typeof profileFieldsSchema>` (cargo, empresa e apresentação aceitam `null`; o campo vazio `''` é enviado e o backend simulado converte-o em `null`).
  - O **tema** é uma secção à parte (`ThemeEditor`) com o seu próprio `PATCH { theme }`, só para quem tem `themes.manage`; o contraste AA (texto 4,5:1, cor principal 3:1) é calculado ao vivo e **bloqueia** o botão de guardar. O resto do perfil guarda-se no botão «Guardar alterações».
  - Fotografia e dono vivem em estado fora do formulário. No submit: `PhotoState` `replace` → `uploadImage(blob,'profile_photo')` → `photoFileId`; `remove` → `photoFileId: null`; `keep` → omitido. O `ownerUserId` só é enviado com `profiles.assignOwner`.
  - Contactos e redes usam `useFieldArray` + `SortableList` (ids = `field.id` do RHF); novos itens recebem `id` com `crypto.randomUUID()`. O telefone/WhatsApp é normalizado no `onBlur` com `normalizePhone` e pré-visualizado com `formatPhoneDisplay`.
  - Nos testes: os rótulos opcionais acrescentam «Opcional» ao nome acessível, e «Mostrar o cargo» (interruptor) colide com «Cargo» — por isso o campo do cargo procura-se por `getByRole('textbox', { name: /^Cargo/ })`. O nome do perfil repete-se nas colunas nome e dono da lista, por isso os testes da lista filtram pelo cargo (único). A pesquisa é adiada (`useDebouncedValue`): esperar com `waitFor` que o não-correspondente saia.
- Conhecimento do ambiente e dos handlers (API simulada) continua válido: todos os endpoints do ADR-0004 têm handler e testes; os códigos de erro estão no complemento do ADR-0004; o mapa de ficheiros e dependências está em `docs/codebase-graph.md`.
- Ferramentas de teste do painel: `renderApp({ route, as })` e `renderWithProviders(ui)` em `src/test/utils.tsx` (`as` é um id dos dados de demonstração; inicia sessão antes de montar). Dados úteis: `u_ana` (company_admin, ACME), `u_edu` (editor), `u_paula`/`u_carlos` (donos), `u_marta` (platform_admin), `u_nelson` (admin sem MFA). Perfis `p_paula`/`p_carlos`/`p_recepcao`.

### Próxima tarefa, por ordem

1. **Deploy (o dono executa):** seguir `docs/deploy.md` — publicar o backend no Render (com as chaves do Supabase), trocar o URL do Render em `vercel.json`, publicar o frontend no Vercel. Depois do deploy: o **login funciona**; os restantes ecrãs dão erro até os endpoints existirem no backend.
2. **Backend (construir os endpoints):** (a) ~~aplicar a 0001~~ (feito) e escrever a migração 0002 (contact_shares, analytics_events, audit_logs), que o dono aplica no SQL Editor; (b) ~~ligação com o `app_backend`~~ (feito, ADR-0013; falta `app.user_id` quando for preciso); (c) os módulos de endpoints sobre o ADR-0004 (começar por público e painel), com `ZodValidationPipe` e posse por empresa; (d) migrar o papel/empresa do `app_metadata` para `app.users`; (e) MFA via Supabase.
2. **Frontend:** todos os ecrãs feitos (T-FE-23 temas e T-FE-25 conta concluídas em 2026-11-18). Falta só a fase de testes finais (T-FE-26/27/28). Notas antigas: (ecrã dedicado de personalização; o editor de tema por perfil já existe em `features/profiles/theme-editor.tsx` — decidir o que o ecrã de temas acrescenta face a isso, sem inventar requisitos: RF-FE-17 fala de modelos, cores com contraste, logótipo e pré-visualização, tudo já coberto pelo editor por perfil). **T-FE-24 auditoria concluída.**
5. (Feito) **T-FE-23** Temas.
6. **T-FE-26/27/28** Suite de testes de acessibilidade (axe; incluir aqui a afinação do *timeout*/paralelismo dos `findBy*`), Playwright (cinco fluxos, CSP, 360 px) e `scripts/check-bundle-size.mjs`.
7. Em cada passo: atualizar `docs/codebase-graph.md`, `docs/requirements.md` (estados) e este ficheiro; só marcar Concluída o que cumprir a Definition of Done.

### Passos para retomar

- `git pull` (o trabalho desta sessão está em `origin/main`).
- Instalar/correr: ver `README.md`. No PC de casa há Node 24 com nvm (`nvm use 24.22.2`). No PC do trabalho não há Node 24 nem nvm, pelo que se usa um Node 24 portátil só para a sessão; aí o `git push` faz-se pelo PowerShell.
- Correr `pnpm typecheck`, `pnpm lint` e `pnpm test` antes de continuar.
