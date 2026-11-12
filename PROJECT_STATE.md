# PROJECT_STATE — NFC Business

Atualizado em 2026-11-12.

## Identificação

- Produto: NFC Business, plataforma de cartões de visita digitais por NFC e QR Code.
- Repositório: https://github.com/Bauirxx/nfcproject
- Instruções obrigatórias: `CLAUDE.md` (prompt mestre) e `docs/prompts/FRONTEND.md`.
- Fase em curso: frontend completo sobre API simulada (MSW). O backend (fases 1 e 2 do prompt mestre) ainda não foi iniciado.

## Resumo da arquitetura

- Monorepo pnpm: `apps/web` (React 19, Vite 8, TypeScript 6, Tailwind 4) e `packages/shared` (schemas Zod, constantes, validadores, links e permissões, partilhados com o futuro backend). `apps/api` ainda não existe.
- O frontend só chama `/api/*` na mesma origem, com `credentials: include` e `X-CSRF-Token` nos pedidos que alteram dados (`apps/web/src/shared/api/client.ts`).
- A página pública (`/c/:token`, `/p/:slug`) entra no carregamento inicial; o painel é carregado à parte (ADR-0003).
- Decisões registadas em `docs/adr/0001` a `0008`.

## Módulos

auth, companies, members, cards, profiles, sharing, contact-sending, analytics, themes, audit, public-card. Nenhum tem ainda ecrãs implementados.

## Funcionalidades concluídas

Nenhuma tarefa cumpre ainda a Definition of Done. O que existe e está verificado:

- Ferramentas do repositório: workspace pnpm, TypeScript, ESLint (inclui `react/no-danger` e proibição de armazenamento do browser), configuração do Vite com CSP no `preview`.
- `packages/shared` completo: 77 testes a passar.
- Cliente da API com CSRF, renovação de sessão e tratamento de 401, 403 e 429: 23 testes a passar.
- TOTP da API simulada (RFC 6238): 8 testes a passar.

## Em curso

| Tarefa | Estado | Notas |
| --- | --- | --- |
| T-FE-01 Base do projeto | Em desenvolvimento | Faltam `main.tsx`, `playwright.config.ts` e `scripts/check-bundle-size.mjs` |
| T-FE-02 Pacote partilhado | Em testes | Inclui `images.ts` (magic bytes de JPEG, PNG e WebP); falta registar no grafo |
| T-FE-03 Cliente da API | Em testes | Código e testes prontos; falta atualizar ADR-0004 e ADR-0005 |
| T-FE-04 API simulada (MSW) | Em desenvolvimento | Feitos `credentials.ts`, `totp.ts`, `db.ts`, `seed.ts`, `domain.ts`, `handlers/http.ts`; faltam os handlers de cada módulo, `browser.ts`, `server.ts` |
| T-FE-05 Estrutura do painel | Planeada | Router, guards, layout, páginas de erro |

## Pendentes

T-FE-06 a T-FE-28 (ver `docs/requirements.md`): autenticação, página pública, cartões, perfis, envio de contacto, empresas, membros, painel, estatísticas, temas, auditoria, conta, testes finais (Vitest, axe, Playwright) e orçamento do bundle.

## Bloqueios

Nenhum.

## Problemas conhecidos e pontos por confirmar

- Os endpoints marcados como «inferidos» no ADR-0004 e os pressupostos P-01 a P-08 de `docs/requirements.md` precisam de confirmação quando o backend for desenhado.
- Novos pressupostos por registar em `docs/requirements.md`: P-09 (o primeiro administrador de uma empresa é convidado por `adminEmail`), P-10 (o dono do perfil é atribuído por `ownerUserId`, só por company_admin), P-11 (um cartão só pode ser ativado com perfil associado).
- ADR-0005 por atualizar: lista de pedidos sem renovação, campo `refreshable` da sessão e pontos em que o token CSRF é reposto.
- `apps/web/src/mocks/credentials.ts` e `seed.ts` têm palavras-passe e chaves TOTP fictícias (domínios `.test`). Quando o gitleaks for configurado, estes dois ficheiros precisam de uma exceção.
- Tailwind 4 exige browsers recentes (Safari 16.4, Chrome 111, Firefox 128).
- `containsLink` pode recusar notas com um ponto sem espaço antes de palavras como «com» (aceite: erra para o lado seguro).
- `docs/codebase-graph.md` ainda não existe.
- Os ficheiros `cn.ts`, `parsed-api.ts` e os de `shared/i18n` passam no typecheck e no lint, mas ainda não têm testes próprios nem consumidores.

## Decisões

Ver `docs/adr/`. Decisões tomadas e ainda sem ADR: estratégia de testes (e2e contra o build com CSP e MSW, constante `__API_MOCKING__`, worker do MSW fora de `public/`, base de dados simulada em localStorage só com dados fictícios) — a registar como ADR-0009.

## Alterações recentes

- 2026-11-12: cliente da API e testes; textos centralizados (`shared/i18n`); início da API simulada; primeiro commit no GitHub.

## Estado dos testes

- `pnpm typecheck`: sem erros.
- `pnpm lint`: sem erros nem avisos.
- `pnpm test`: 120 testes a passar (82 em `packages/shared`, 38 em `apps/web`).
- Playwright: ainda sem testes. Sem verificação de build nem de tamanho do bundle.

## Registo de continuidade

- Última tarefa: T-FE-04, API simulada.
- Ficheiros envolvidos: `apps/web/src/mocks/{credentials,totp,db,seed,domain}.ts`, `apps/web/src/mocks/handlers/http.ts` (com `http.test.ts`), `packages/shared/src/images.ts`, `docs/chaves-de-demonstracao.md`.
- Estado exato: base de dados, dados de demonstração, regras de domínio comuns e mecânica dos handlers (CSRF, sessão, MFA obrigatório, permissões, validação estrita, limites, paginação) escritos e testados. Ainda não há handlers de nenhum endpoint.
- Comportamentos já decididos para os handlers (para não redesenhar):
  - Login: 5 tentativas por minuto por email (429 com Retry-After); conta com MFA responde `mfa_required`; credenciais erradas dão 401 `invalid_credentials`.
  - `mfa/verify`: código TOTP ou código de recuperação de uso único; sem desafio pendente dá 401 `mfa_challenge_expired`; código errado dá 401 `invalid_code`.
  - `mfa/disable`: administradores recebem 403 `mfa_required_for_role`; palavra-passe errada dá 422 `invalid_current_password`.
  - `recover` responde sempre 202; `recover/confirm` dá 204, 400 `invalid_token` ou 422 `weak_password` e termina todas as sessões; `invite/accept` dá 204 sem criar sessão.
  - `DELETE /api/auth/sessions` termina todas as sessões, incluindo a atual.
  - Recursos de outra empresa dão sempre 404. Membros: 409 `already_member`, `last_admin`, `cannot_change_self`.
  - Cartões: transição inválida dá 409 `invalid_transition`; ativar sem perfil dá 409 `card_without_profile`.
  - Envios: 10 por hora e 50 por dia por utilizador (429 com `scope` e Retry-After); perfil sem cartão ativo dá 409 `profile_without_card`; só se guarda o destinatário mascarado.
  - Página pública: só cartões `active` com perfil; tudo o resto dá o mesmo 404. O VCF é `text/vcard`. Eventos públicos respondem sempre 204, com deduplicação de 30 minutos.
  - Estatísticas: base determinística por cartão e dia, mais os contadores registados.
  - Uploads: `POST /api/uploads/sign` devolve `/api/uploads/<fileId>`; o `PUT` valida tamanho e magic bytes com `detectImageType`.
- Verificado no ambiente de testes (Vitest com jsdom): o MSW resolve URLs relativos, aceita `AbortSignal`, corpos `Blob` e respostas lançadas pelos resolvers. No MSW 3 a opção chama-se `onUnhandledFrame` (não `onUnhandledRequest`).
- Próxima tarefa, por ordem:
  1. Feito: `packages/shared/src/images.ts`.
  2. `apps/web/src/mocks/handlers/` por módulo, cada um com testes: auth, companies e members, cards, profiles e uploads, contact-shares, analytics e audit, public, index.
  3. `mocks/browser.ts` (inclui a captura do clique no link do VCF) e `mocks/server.ts`; ligar o servidor MSW em `src/test/setup.ts`.
  4. Componentes base, router, guards, layout, páginas de erro e `main.tsx`.
  5. `docs/codebase-graph.md`, ADR-0009, atualização dos ADR-0004 e 0005 e de `docs/requirements.md`.
- Passos para retomar: ver `README.md` (instalação) e depois correr `pnpm typecheck`, `pnpm lint` e `pnpm test` antes de continuar.
