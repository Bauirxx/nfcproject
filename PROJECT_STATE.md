# PROJECT_STATE — NFC Business

Atualizado em 2026-11-19. **Para retomar noutro PC, comece pela secção «Registo de continuidade» no fim deste ficheiro.**

## Identificação

- Produto: NFC Business, plataforma de cartões de visita digitais por NFC e QR Code.
- Repositório: https://github.com/Bauirxx/nfcproject (público).
- Instruções obrigatórias: `CLAUDE.md` (prompt mestre) e `docs/prompts/FRONTEND.md`.
- Produção:
  - frontend: https://nfcproject-zeta.vercel.app (Vercel);
  - backend: https://nfcproject-im6b.onrender.com (Render, plano free);
  - Supabase: projeto `ughsgiqolymjyzdjkpks`, eu-west-1, **plano Free**.
- Fases: 1 (fundação) e 2 (gestão) cumprem o critério de saída; 3 (página pública e envio) feita, com o email limitado até haver domínio próprio; 4 (operação) em curso; 5 (publicação) por fazer.

## Resumo da arquitetura

- Monorepo pnpm:
  - `apps/web`: React 19, Vite 8, TypeScript 6, Tailwind 4;
  - `packages/shared`: schemas Zod, constantes, validadores, links, vCard e permissões;
  - `apps/api`: NestJS 11 com Express, empacotado com esbuild em `dist/server.cjs`.
- O frontend só chama `/api/*` na mesma origem (rewrite do Vercel para o Render), com `credentials: include` e `X-CSRF-Token`. Em produção não há API simulada; o MSW só existe em desenvolvimento e nos testes.
- Base de dados:
  - o backend liga-se como `app_backend`, sem BYPASSRLS, com RLS por transação (`app.company_id`);
  - a service_role só é usada no `SupabaseAdminService` (convites, membros, Storage; ADR-0017).
- Decisões em `docs/adr/0001` a `0022`; grafo em `docs/codebase-graph.md`; requisitos em `docs/requirements.md`.
- Operação:
  - CI de segurança: `docs/ci.md`;
  - cópias de segurança: `docs/backup.md`;
  - incidentes: `docs/incident-response.md`;
  - deploy: `docs/deploy.md`.

## Módulos

auth, companies, members, cards, profiles, sharing (página pública e VCF), contact-sending, analytics, themes (dentro dos perfis, P-02), audit e uploads. Todos têm ecrãs e endpoints reais.

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

| Tarefa | Estado | O que falta |
| --- | --- | --- |
| T-BE-05 Página pública no backend | Em revisão | Confirmar `TRUST_PROXY_HOPS=2` nos logs de produção (o IP certo nos limites) |
| T-BE-09 Cópias de segurança (ADR-0022) | Em testes | Dono: instalar o PostgreSQL 17 command line tools, primeira cópia e primeiro restauro (`docs/backup.md`) |
| T-BE-10 Plano de incidentes | Em revisão | Dono: preencher os contactos e fazer a primeira simulação |
| T-FE-01 Base do projeto | Em revisão | `playwright.config.ts` (com T-FE-27) |

## Pendentes

Funcionalidades:
1. **Reposição do MFA por um administrador** no painel (decisão do dono; hoje só pelo painel do Supabase).
2. **Procedimento de gravação dos chips NFC** (regra 4: chip bloqueado contra regravação). Precisa da resposta do dono: modelo dos chips (NTAG213/215/216?) e aplicação de gravação.
3. **Papel e empresa em `app.users`** em vez do `app_metadata` do Supabase Auth.
4. Lista de sessões ativas: o ecrã «Conta» só mostra a sessão atual (limitação do Supabase).

Qualidade:
- T-FE-26 (axe, incluindo o *timeout* dos `findBy*` sob carga) e T-FE-27 (Playwright: cinco fluxos, CSP, 360 px).

Fase 5 (antes de gravar os chips definitivos):
- domínio próprio com DNSSEC;
- SPF, DKIM e DMARC: sem eles o Resend só entrega no email da conta Resend, por isso **o email a clientes reais ainda não funciona**;
- plano Pro do Supabase e cópia diária automática noutro fornecedor (prazo do ADR-0022);
- staging, OWASP ZAP e aprovação manual para produção (T-BE-07);
- revisão externa ou pentest.

## Bloqueios

- T-BE-07 (ZAP): não há ambiente de staging.
- Gravação dos chips: à espera do modelo do chip e da aplicação de gravação.

## Problemas conhecidos e pontos por confirmar

- Os endpoints marcados como «inferidos» no ADR-0004 e os pressupostos P-01 a P-08 de `docs/requirements.md` precisam de confirmação quando o backend for desenhado.
- `apps/web/src/mocks/credentials.ts` tem palavras-passe e chaves TOTP fictícias (domínios `.test`): exceção feita linha a linha no gitleaks e mocks excluídos do Semgrep (ADR-0020).
- Tailwind 4 exige browsers recentes (Safari 16.4, Chrome 111, Firefox 128).
- `containsLink` pode recusar notas com um ponto sem espaço antes de palavras como «com» (aceite: erra para o lado seguro).
- O ficheiro `apps/web/mocks-static/mockServiceWorker.js` tem de acompanhar a versão do MSW (3.0.3); confirmar no browser quando `main.tsx` existir.
- Os ficheiros `cn.ts`, `parsed-api.ts` e os de `shared/i18n` passam no typecheck e no lint, mas ainda não têm testes próprios nem consumidores.

## Decisões

Ver `docs/adr/` (0001 a 0022). A estratégia de testes e a API simulada estão no ADR-0009; os códigos de erro da API simulada a confirmar pelo backend estão no complemento do ADR-0004.

Decisões da T-FE-05 (sem ADR próprio; impostas pela CSP estrita, ADR-0006):

- O menu no telemóvel é um painel colapsável (botão com `aria-expanded`/`aria-controls`), não um diálogo modal: o `react-remove-scroll` usado pelo `Dialog` do Radix injeta um `<style>`, incompatível com `style-src 'self'`. O Radix Dialog/DropdownMenu só será usado onde for mesmo preciso (confirmações de ações em cartões e membros) e a compatibilidade com a CSP será verificada nos e2e (T-FE-27).
- A conta e o terminar sessão estão no rodapé da barra lateral (visíveis), em vez de um menu suspenso, pela mesma razão e porque a gestão detalhada da conta tem ecrã próprio (T-FE-25).
- O tema é um store ao nível do módulo (`app/theme.ts`) sobre a única leitura de `localStorage` permitida (`shared/lib/theme-preference.ts`); o modo escuro é a classe `dark` em `<html>`.

## Alterações recentes

- 2026-11-19: **Testes de isolamento entre empresas (T-BE-11). Critério de saída da fase 2 cumprido.**
  - `common/isolation.integration.test.ts`, 15 testes:
    - **RLS sozinha nas 8 tabelas por empresa:** consultas sem filtro no contexto da empresa A não veem nada de outras; `update`/`delete` sobre linhas da B afetam 0 linhas; inserir na B ou criar empresas é recusado pela RLS;
    - **membros:** mudar papel ou remover um membro da B dá 404 sem chamar o Supabase Auth;
    - **empresas:** 403 pelo papel para o company_admin;
    - **uploads:** B não envia nem consome ficheiros da A.
  - Cria duas contas temporárias no Supabase Auth (sem email) e apaga-as no fim.
  - Suíte completa com `DB_INTEGRATION=1`: **158/158** contra o Supabase real.
  - O dono configurou `RESEND_API_KEY` e `ALERT_EMAIL_TO` no Render; o primeiro envio real por email ainda não foi confirmado.

- 2026-11-19: **Plano de resposta a incidentes (T-BE-10, `docs/incident-response.md`).**
  - Conteúdo: gravidade SEV-1 a SEV-3, fases, interruptores de emergência (suspender o Render, voltar a versões anteriores, revogar chaves, `app_backend nologin`, desativar cartões) e 9 cenários. A tabela de rotação de segredos refere o efeito do `IP_HASH_SECRET` (invalida os links de cancelamento já enviados e os tokens CSRF).
  - **Registado como incidente aberto INC-0001:** a palavra-passe do `app_backend` exposta numa captura (2026-11-18), por rodar.
  - Ao verificar o plano contra o código, corrigi duas afirmações: «Bloqueado» é definitivo (só «Perdido» se reativa) e o platform_admin não remove membros (P-06).
  - **Falta (dono):** preencher os contactos e fazer a primeira simulação de mesa.

- 2026-11-19: **Cópias de segurança (T-BE-09, ADR-0022), exceção temporária à regra 11.**
  - **Contexto:** o dono decidiu ficar só com o Supabase por agora, mas o projeto está no **plano Free, que não tem cópias automáticas nem PITR** (documentação do Supabase). Na prática, não havia nenhuma cópia.
  - **Feito:**
    - `scripts/backup/backup-db.ps1`: pg_dump de `app` e `auth` → gpg AES-256, sem cópia em claro no disco, TLS verificado;
    - `scripts/backup/restore-db.ps1`: só num projeto de teste, verifica o SHA-256, exclui `auth.schema_migrations`;
    - `docs/backup.md`: preparar, copiar, teste mensal, verificação por contagens, incidente;
    - `.gitignore` recusa ficheiros de cópia.
  - **Verificado:** sintaxe e proteções. **Por verificar:** a primeira cópia e o primeiro restauro, que dependem do dono.
  - **Prazo da exceção:** antes da fase 5 e de gravar os chips definitivos (plano Pro/PITR e fornecedor para a cópia diária automática).

- 2026-11-19: **Logs JSON com `request_id` e alertas (T-BE-08, ADR-0021).**
  - Logger JSON global; `X-Request-Id` em todas as respostas; log de acesso com a rota padrão (sem tokens, query string nem IP).
  - Alertas no log (campo `alert`) e por email para `ALERT_EMAIL_TO`, no máximo 1 por tipo e chave a cada 15 min:
    - 5xx;
    - pico de envios (50 por empresa ou 200 na plataforma em 15 min, valores assumidos);
    - 429 no envio;
    - 429 na autenticação.
  - `EmailService` passou para o `CoreModule`; esbuild com `keepNames`; `.env.example` atualizado (as opcionais comentadas, porque vazias falham a validação).
  - Testes: 114 unitários na API (+9). Verificado com o `dist/server.cjs` em local: arranque e pedidos em JSON, o mesmo `request_id` no cabeçalho e no log, e o token do caminho e a query string ausentes.
  - **Falta (dono):** definir `ALERT_EMAIL_TO` no Render (requer `RESEND_API_KEY`).

- 2026-11-19: **CI de segurança (T-BE-06, ADR-0020, `docs/ci.md`).**
  - `.github/workflows/ci.yml` com cinco jobs:
    - gitleaks em todo o histórico;
    - tipos, lint, testes e builds;
    - `pnpm audit` e osv-scanner;
    - Semgrep (conjuntos públicos e 6 regras próprias em `.semgrep/`);
    - SBOM com syft.
  - Fixação e permissões: Actions fixadas por hash, binários verificados por SHA-256, Semgrep por digest, versões com 7 ou mais dias, `permissions: {}`/`contents: read`. Dependabot com `cooldown` de 7 dias. Hook `scripts/hooks/pre-commit` com o gitleaks.
  - **Corrigido nesta análise:** multer 2.4.0 → 2.5.0 (GHSA-q7qp-rjg7-q26m, **alta**, em produção via NestJS) e minimatch → 11.0.1 (GHSA-g3hv-75wg-m249, média, só em desenvolvimento), por `overrides`.
  - Endurecido: `blockExoticSubdeps` e `trustPolicy: no-downgrade`.
  - Histórico do git sem segredos reais; as 4 ocorrências eram dados fictícios, com exceção por impressão digital e `gitleaks:allow`.
  - Verificado em local, tudo sem resultados: gitleaks no histórico, `pnpm audit`, osv-scanner, Semgrep, typecheck, lint, testes (90 + 105 + 295) e builds.
  - **Primeiro run no GitHub (commit `f43ab2c`): os cinco jobs a verde.** T-BE-06 concluída.
  - **Falta:**
    - ações do dono: proteção da `main` e Auto-Deploy «After CI Checks Pass» no Render (`docs/ci.md`, secção 1);
    - T-BE-07 (ZAP e aprovação manual para produção), bloqueada sem staging.
  - Neste PC o hook de pre-commit está ativo (`core.hooksPath`): os commits precisam do gitleaks no PATH.

- 2026-11-19: O dono aplicou a migração 0004. Os testes de integração do envio de contacto (`DB_INTEGRATION=1 vitest run src/contact-sending`) passam contra o Supabase real (7/7): registo mascarado, `contact_sent`, 409 sem cartão ativo, 404 entre empresas e 429 com `scope: hour` ao 11.º envio. O canal email só falta ligar com `RESEND_API_KEY` (ação do dono).

- 2026-11-18: **Envio de contacto no backend (ADR-0019).**
  - `POST`/`GET /api/contact-shares`: posse do perfil, cartão ativo obrigatório e limites duráveis na base de dados (10/h e 50/dia por utilizador, 500/dia por empresa) com lock por utilizador.
  - Registo mascarado, `contact_sent` e auditoria.
  - Email pelo Resend: modelo fixo escapado, VCF em anexo, List-Unsubscribe; 503 sem `RESEND_API_KEY`.
  - Cancelamento `/api/public/unsubscribe` (GET confirma, POST `@SkipCsrf` com HMAC); o filtro de erros passa a devolver o `scope` e o `Retry-After`.
  - Testes: 105 unitários.
  - **Defeito apanhado pelo teste de integração:** a chave estrangeira `contact_shares.sender_user_id → app.users` impedia o envio a utilizadores não espelhados. A migração `0004_contact_shares_sender.sql` corrige-o (aplicada a 2026-11-19).
  - Nota do ambiente: o Node portátil do scratchpad foi apagado pela limpeza dos temporários do Windows; foi reposto (v24.22.2, checksum oficial verificado) e o `corepack enable` foi refeito.

- 2026-11-18: O dono aplicou a migração 0003 e configurou `SUPABASE_SERVICE_ROLE_KEY` (tipo `sb_secret_`) no `.env` e no Render. Verificado: chave válida, buckets `uploads-quarantine` (privado) e `public-images` (público), `app.uploads` com RLS. `uploads.integration.test.ts` passa contra o Supabase real: WebP de 512 px sem EXIF servido pela URL pública, consumo único, SVG recusado.

- 2026-11-18: **Uploads de imagens (ADR-0018).**
  - `POST /api/uploads/sign` e `PUT /api/uploads/:fileId`: magic bytes, 2 MB, tamanho exato, quarentena, sharp numa worker isolada (`env: {}`) e WebP sem EXIF no bucket público.
  - Os perfis (fotografia e logótipo do tema) e as empresas (logótipo) consomem o `fileId` uma única vez.
  - Migração `supabase/migrations/0003_uploads.sql` (tabela `app.uploads` com RLS e buckets `uploads-quarantine` e `public-images`), **por aplicar pelo dono**.
  - Novas dependências: `sharp` 0.35.5 (binários por plataforma no lockfile, Linux incluído) e `express` 5.2.1 direto.
  - Verificado: 100 testes unitários (EXIF removido, SVG e tipos disfarçados recusados) e a worker empacotada a processar um JPEG real sem variáveis de ambiente.

- 2026-11-18: **Convites, empresas e membros no backend real (ADR-0017: service_role isolada, decisão do dono).**
  - `SupabaseAdminService` é o único com a chave e só faz `invite`, `setRole` e `deleteUser`.
  - `POST /api/companies` cria a empresa e convida o primeiro administrador na mesma transação.
  - `GET`/`POST`/`PATCH`/`DELETE /api/members`: convite, mudança de papel e remoção; o próprio é protegido.
  - `POST /api/auth/invite/accept`: `verifyOtp` do convite, password vazada recusada, conta ativada em `app.users`.
  - Testes: 96 unitários.
  - **Falta o dono:** pôr `SUPABASE_SERVICE_ROLE_KEY` no `.env` e no Render, acrescentar o Redirect URL `/convite` e mudar o modelo do email de convite (`docs/deploy.md`, secção 5).

- 2026-11-18: **Recuperação da palavra-passe no backend real.** `POST /api/auth/recover` responde sempre 202 e tem 5/min por IP e por email; `POST /api/auth/recover/confirm` usa `verifyOtp` com o token_hash (uso único, 1 h), recusa passwords vazadas antes de consumir o token, termina todas as sessões e audita. **Falta a configuração no Supabase pelo dono** (Site URL, Redirect URL e modelo do email, ver `docs/deploy.md` secção 4). Testes: 90 unitários.

- 2026-11-18: **Sessão e conta no backend real.**
  - Sessão: `POST /api/auth/refresh` (rotação do refresh token do Supabase; a sessão já não cai aos 15 minutos), `refreshable` em `GET /api/auth/session` e logout que revoga a sessão no Supabase e regista `auth.logout`.
  - Conta (`auth/account.controller.ts`): `PATCH /api/auth/account` (nome no `user_metadata`), `POST /api/auth/password` (confirma a atual, 5 tentativas/min e recusa passwords vazadas via Have I Been Pwned por k-anonimato, `common/breached-password.ts`), `GET`/`DELETE /api/auth/sessions`.
  - Limitação conhecida: o Supabase só lista as sessões de um utilizador pela API de administração (service_role, regra 3), por isso a lista mostra só a sessão atual. «Terminar todas» revoga mesmo todas (`signOut` global).
  - Se o HIBP não responder, a verificação deixa passar e regista um aviso (os 12 caracteres mínimos continuam a aplicar-se).
  - Testes: 88 unitários.

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

Verificado a 2026-11-19:
- `pnpm typecheck`: sem erros.
- `pnpm lint`: sem erros nem avisos.
- `pnpm test`: 499 testes a passar (90 em `packages/shared`, 295 em `apps/web`, 114 em `apps/api`).
- Integração com `DB_INTEGRATION=1` em `apps/api`: **158/158 contra o Supabase real** (inclui o isolamento entre empresas). Corre ficheiro a ficheiro, com 60 s de *timeout*; precisa do `apps/api/.env` com `DATABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY`.
- Builds: web com o orçamento do bundle (página pública ~77 KB gzip, abaixo de 100 KB) e api (`dist/server.cjs`, que arranca e responde em JSON).
- CI no GitHub: os cinco jobs verdes no último commit.
- Nota: com o paralelismo de ficheiros por defeito, sob carga a suíte web `cards` pode falhar por *timeout* dos `findBy*` (1000 ms). Não é regressão; fica para a T-FE-26.
- Playwright: ainda sem testes (T-FE-27).

## Registo de continuidade

### Retomar aqui (sessão de 2026-11-19, PC do trabalho → PC de casa)

**Estado exato.**
- Tudo está em `origin/main`, com o CI verde.
- Última tarefa concluída: os testes de isolamento entre empresas (T-BE-11). A fase 2 cumpre o critério de saída.
- Não há trabalho a meio nem alterações por commitar.

**1. Preparar o PC de casa (uma vez)**
1. `git pull`, depois `nvm use 24.22.2`, `corepack enable` e `pnpm install --frozen-lockfile`.
2. **`apps/api/.env`.** Não vai para o git. Tem de ter estas variáveis, com os valores tirados do Render ou do Supabase, nunca colados no chat:
   - `NODE_ENV=development` e `PORT=3000`;
   - `SUPABASE_URL` e `SUPABASE_ANON_KEY`;
   - `DATABASE_URL`: Session pooler, papel `app_backend`;
   - `SUPABASE_SERVICE_ROLE_KEY`;
   - `RESEND_API_KEY` e `ALERT_EMAIL_TO`;
   - locais, nunca as do Render: `PUBLIC_APP_URL=http://localhost:5173`, `TRUST_PROXY_HOPS=0` e um `IP_HASH_SECRET` próprio (48 bytes aleatórios em base64url).

   Variável presente mas vazia = o backend não arranca: comente as que não tiver. Modelo em `apps/api/.env.example`.
3. **Hook de pre-commit (opcional, recomendado).** Instale o gitleaks 8.30.1, verificando o checksum, e corra `git config core.hooksPath scripts/hooks` (`docs/ci.md`, secção 2).
4. **Para as cópias de segurança:** instale o PostgreSQL 17 command line tools (`docs/backup.md`, secção 1).
5. **Verificar:**
   - `pnpm typecheck && pnpm lint && pnpm test`;
   - em `apps/api`, com `DB_INTEGRATION=1`: `pnpm exec vitest run`. Esperado: 158/158.

**2. Ações do dono, por urgência**
1. **INC-0001: trocar a palavra-passe do `app_backend`.** Ficou exposta numa captura de ecrã a 2026-11-18. Passos:
   - SQL Editor: `alter role app_backend with password '…'`;
   - atualizar o `DATABASE_URL` no Render e no `.env` dos dois PCs;
   - fechar o INC-0001 em `docs/incident-response.md`.
2. **Primeira cópia de segurança.** No plano Free não existe nenhuma: `scripts/backup/backup-db.ps1`, e a cópia vai para um disco externo.
3. **GitHub e Render:** proteger a `main` (os 5 jobs), ativar os alertas do Dependabot e, no Render, Auto-Deploy «After CI Checks Pass» (`docs/ci.md`, secção 1).
4. **Supabase Auth:** modelos de email (Reset Password, Invite user), Site URL e Redirect URLs `/definir-password` e `/convite` (`docs/deploy.md`, secções 4 e 5).
5. **Testar o email:** no painel, «Enviar contacto» por email para o **email da conta Resend**. Até haver domínio, é o único destino que o Resend entrega. Deve chegar com o VCF em anexo.
6. **Plano de incidentes:** preencher os contactos (secção 1).
7. **Chips NFC:** dizer o modelo (NTAG213, 215 ou 216?) e a aplicação de gravação, para eu escrever o procedimento com o bloqueio contra regravação.
8. **PC do trabalho:** o disco C está cheio (0 MB livres antes da limpeza; ~400 MB depois). Convém libertar espaço.

**3. Próximas tarefas (Claude), por ordem.** Ver «Próxima tarefa, por ordem» abaixo.

**4. Notas de ambiente.**
- **PC do trabalho:**
  - o Node 24 portátil, o gitleaks e o osv-scanner ficam no scratchpad, e a limpeza do Windows apaga-os; reinstalar sempre com checksum;
  - o Bash não tem rede: push e chamadas de rede pelo PowerShell;
  - o hook de pre-commit está ativo (`core.hooksPath`), por isso os commits precisam do gitleaks no PATH.
- **Integração:** os testes contra o Supabase real criam e apagam dados de teste (empresas `co_it_*`, `co_its_*`, `co_iso_*`) e duas contas temporárias no Supabase Auth. Não usam dados reais.
- **Commits:** em português sem acentos, terminados com a linha `Co-Authored-By`.

### Histórico das sessões anteriores

- Última tarefa (2026-11-19): **testes de isolamento entre empresas (T-BE-11)**, concluída; a fase 2 cumpre o critério de saída. Próximo, por ordem: reposição do MFA por um administrador no painel (cenário 5.2 do plano de incidentes), migração do papel/empresa para `app.users`, T-FE-26/27 (axe e Playwright), pôr em dia os estados em `docs/requirements.md`. Antes: **plano de resposta a incidentes (T-BE-10)**, em revisão (contactos e simulação pelo dono). Antes: **cópias de segurança (T-BE-09, ADR-0022)**, em testes: scripts e procedimento prontos; falta o dono instalar o PostgreSQL 17 command line tools, fazer a primeira cópia e o primeiro restauro num projeto de teste (`docs/backup.md`). Antes: **logs JSON e alertas (T-BE-08, ADR-0021)**, concluída. Antes: **CI de segurança (T-BE-06, ADR-0020)**, **concluída**: verificada em local e com o primeiro run verde no GitHub. Depois disso: o plano de cópias de segurança e de resposta a incidentes. Ferramentas locais no PC do trabalho: gitleaks, osv-scanner e um venv com o Semgrep 1.185.0 no scratchpad (apagáveis pela limpeza do Windows; reinstalar com checksum).
- Antes: **endpoints do painel: estatísticas, auditoria e empresas (leitura e edição)**. Bloqueio: decisão sobre os convites (criar empresa e membros exige criar contas no Supabase Auth, ou seja `service_role` ou outra via). Próximo: membros (lista, mudar papel, remover; convites à espera de decisão), envio de contacto, uploads Cartões, perfis, renovação da sessão, conta e recuperação feitos. Antes: **MFA TOTP no backend (ADR-0016)**; falta o teste real no site com uma aplicação de autenticação. Próximo: os endpoints das empresas (`/api/companies`) e a migração do papel e da empresa para `app.users`. Antes: **correção da sessão, MFA e CSRF (ADR-0015)**. Próxima: endpoints de MFA (`/api/auth/mfa/setup`, `confirm`, `verify`, `disable`) com a API de MFA do Supabase, marcados com `@AllowWithoutMfa()` onde for preciso. Sem eles, o administrador não passa do ecrã de configuração do MFA. Antes: **T-BE-05, página pública no backend real** (ADR-0014). Em revisão: falta confirmar o `TRUST_PROXY_HOPS=2` depois do deploy. No Render é preciso acrescentar `TRUST_PROXY_HOPS=2`, `IP_HASH_SECRET` (aleatório, com 32 ou mais caracteres) e, depois do Vercel, `PUBLIC_APP_URL`. Próximo: os endpoints autenticados, a começar pelas empresas (`/api/companies`) e pela migração do papel e da empresa para `app.users`. Antes: **Migração 0002 aplicada e verificada** (pg_cron ativo; 9 testes de integração a passar contra o Supabase real). Próximo: os primeiros endpoints reais (empresas e página pública) sobre o `DatabaseService` e a vista `public_cards`. Antes: **Ligação à base de dados (ADR-0013)**. `DatabaseService` com o contexto RLS por transação, verificado contra o Supabase real. O `.env` do PC do trabalho tem o `DATABASE_URL`. **No PC de casa é preciso copiar a mesma linha `DATABASE_URL=...` para `apps/api/.env`, porque o ficheiro não vai para o Git.** Próximo: migração 0002 e os primeiros endpoints reais (empresas e página pública) sobre o `DatabaseService`. Antes: **T-FE-23 Temas** — ecrã dedicado que reutiliza o `ThemeEditor`; 3 testes; `PlaceholderPage` removido. Com isto, todos os ecrãs do frontend estão feitos. Antes: **T-FE-25 Conta** (frontend) — dados pessoais, palavra-passe, MFA e sessões; 5 testes. Antes: **T-FE-24 Auditoria** (frontend) — `features/audit/{queries,audit-page}.tsx`, `shared/i18n/panel/audit.ts`, rota ligada; 4 testes; grafo e requisitos atualizados. Antes disso (noutra sessão/máquina): **Backend executável e configuração de deploy (ADR-0012)** — empacotado com esbuild (`node apps/api/dist/server.cjs` corre; `/api/health` 200), DI explícita, `CoreModule` global; `render.yaml`, `vercel.json` e `docs/deploy.md` prontos. Login real do Supabase verificado (utilizador platform_admin criado pelo dono). Antes: login BFF, ligação ao Supabase; frontend até T-FE-22. (filtros, 4 gráficos de linha SVG, tabela por cartão, CSV protegido; 13 testes; skill `dataviz` aplicado). Antes: T-FE-21 dashboard, T-FE-20 membros, T-FE-19 empresas; backend T-BE-01 parcial. Estrutura NestJS, segurança, guard global negar-por-defeito (`@Public()`), filtro de erros do contrato, validação do ambiente e health público, com 10 testes. Decisões no ADR-0010. `typecheck`, `lint`, `pnpm test` (355) e `pnpm --filter @nfc-business/api build` a passar. Antes (frontend): T-FE-11 (envio do dono na página pública) — concluída. Botão «Enviar o meu contacto» só para o dono com sessão, que abre o `SendContactForm` via `public-send-panel` carregado por `import()` (fora do bundle público). Antes: T-FE-17/18 (envio de contacto), T-FE-14/15/16 (perfis). `typecheck`, `lint`, `pnpm test` (345) e build de produção a passar (página pública ~79 KB gzip; formulário de envio em chunk separado).
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

1. **Reposição do MFA por um administrador** (T-BE nova; decisão do dono, ADR-0016).
   - **Endpoint e ecrã:**
     - endpoint: platform_admin para administradores de empresa, company_admin para membros da sua empresa;
     - o ecrã de membros ganha a ação «Repor MFA», com confirmação.
   - **Comportamento:**
     - apaga os fatores no Supabase com o `SupabaseAdminService.auth.admin.mfa`, sem mexer na service_role fora desse serviço;
     - termina as sessões e regista `audit_logs`.
   - **Testes:** posse/isolamento (404 entre empresas) e testes unitários. Também é preciso atualizar o cenário 5.2 do plano de incidentes.
   - **Antes de implementar:** STRIDE (elevação de privilégio), ADR e confirmar a ação nova da auditoria em `AUDIT_ACTIONS`.
2. **Procedimento de gravação dos chips NFC** (regra 4), quando o dono indicar o modelo do chip e a aplicação de gravação. Fica em `docs/`, com o URL `/c/<token>` copiado do painel, o bloqueio permanente, a verificação depois de bloquear e o registo.
3. **Papel e empresa a partir de `app.users`** (regra 2). Ler na sessão e manter o `app_metadata` só como espelho; inclui uma migração para as contas antigas, por exemplo o platform_admin inicial.
4. **Confirmar o `TRUST_PROXY_HOPS=2`** com um pedido em produção e o log.
5. **T-FE-26/27:** axe e Playwright.
6. **Em cada passo:** atualizar `docs/codebase-graph.md`, `docs/requirements.md` e este ficheiro; só marcar Concluída o que cumprir a Definition of Done.

### Passos para retomar

- Ver «Retomar aqui» no início desta secção.
- `git pull`. No PC de casa: `nvm use 24.22.2`. No PC do trabalho: Node 24 portátil, e push pelo PowerShell.
- Antes de continuar: `pnpm typecheck`, `pnpm lint`, `pnpm test` e, com o `.env` completo, a integração em `apps/api` com `DB_INTEGRATION=1`.
