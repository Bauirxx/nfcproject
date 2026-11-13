# PROJECT_STATE — NFC Business

Atualizado em 2026-11-13.

## Identificação

- Produto: NFC Business, plataforma de cartões de visita digitais por NFC e QR Code.
- Repositório: https://github.com/Bauirxx/nfcproject
- Instruções obrigatórias: `CLAUDE.md` (prompt mestre) e `docs/prompts/FRONTEND.md`.
- Fase em curso: frontend sobre API simulada (MSW) e **backend iniciado** (`apps/api`, fase 1 fundação, ADR-0010). A ligação ao Supabase precisa de credenciais do dono do produto.

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
- T-BE-01 (parcial) Fundação do backend `apps/api` (NestJS 11, Express): guard global negar-por-defeito com `@Public()`, filtro de erros no formato do contrato, validação do ambiente (Zod), cabeçalhos de segurança (helmet) e CORS fechado, e health público. 10 testes. A autenticação real (Supabase) está bloqueada por falta de credenciais (T-BE-02).
- T-FE-19 Empresas (só platform_admin): lista com contagens de cartões e membros, criar (convida o primeiro administrador por email), editar, cores da marca e logótipo. 5 testes. O ajudante de upload passou para `shared/lib/upload.ts` (usado por perfis, temas e empresas).

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
| T-FE-01 Base do projeto | Em revisão | `main.tsx` feito; faltam `playwright.config.ts` (T-FE-27) e `scripts/check-bundle-size.mjs` (T-FE-28) |
| T-FE-03 Cliente da API | Em revisão | Código, testes e ADR-0005 prontos; `lib/parsed-api.ts` ganha teste com o primeiro consumidor (T-FE-06) |
| T-FE-04 API simulada (MSW) | Em revisão | Código, testes, ADR-0009 e grafo prontos; `main.tsx` chama `startMockApi`; falta confirmar o worker no browser real (ao abrir `pnpm dev`) |
| T-BE-01 Fundação do backend | Em desenvolvimento | Estrutura, segurança, guard global, filtro de erros, env e health feitos (10 testes) |
| T-BE-03 Validação com Zod partilhado | Em desenvolvimento | `ZodValidationPipe` a consumir `@nfc-business/shared/schemas` (2 testes); falta aplicar aos endpoints e o empacotamento executável |
| T-BE-02 Supabase e login BFF | Bloqueada | Precisa de um projeto Supabase e credenciais do dono do produto (URL e chaves num `.env`) |

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

Ver `docs/adr/` (0001 a 0009). A estratégia de testes e a API simulada estão no ADR-0009; os códigos de erro da API simulada a confirmar pelo backend estão no complemento do ADR-0004.

Decisões da T-FE-05 (sem ADR próprio; impostas pela CSP estrita, ADR-0006):

- O menu no telemóvel é um painel colapsável (botão com `aria-expanded`/`aria-controls`), não um diálogo modal: o `react-remove-scroll` usado pelo `Dialog` do Radix injeta um `<style>`, incompatível com `style-src 'self'`. O Radix Dialog/DropdownMenu só será usado onde for mesmo preciso (confirmações de ações em cartões e membros) e a compatibilidade com a CSP será verificada nos e2e (T-FE-27).
- A conta e o terminar sessão estão no rodapé da barra lateral (visíveis), em vez de um menu suspenso, pela mesma razão e porque a gestão detalhada da conta tem ecrã próprio (T-FE-25).
- O tema é um store ao nível do módulo (`app/theme.ts`) sobre a única leitura de `localStorage` permitida (`shared/lib/theme-preference.ts`); o modo escuro é a classe `dark` em `<html>`.

## Alterações recentes

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
- `pnpm test`: 362 testes a passar (82 em `packages/shared`, 268 em `apps/web`, 12 em `apps/api`).
- `pnpm --filter @nfc-business/web build`: a passar; API simulada fora do bundle; chunk inicial da página pública 78 KB gzip (< 100 KB), sem router/TanStack Query/RHF/Zod (confirmado por `Select-String` no chunk).
- Playwright: ainda sem testes. Falta o `scripts/check-bundle-size.mjs` (T-FE-28).

## Registo de continuidade

- Última tarefa: **T-FE-19 empresas — concluída** (lista, criar, editar, marca e logótipo; 5 testes). Antes: backend `apps/api` (fase 1, fundação) — T-BE-01 parcial. Estrutura NestJS, segurança, guard global negar-por-defeito (`@Public()`), filtro de erros do contrato, validação do ambiente e health público, com 10 testes. Decisões no ADR-0010. `typecheck`, `lint`, `pnpm test` (355) e `pnpm --filter @nfc-business/api build` a passar. Antes (frontend): T-FE-11 (envio do dono na página pública) — concluída. Botão «Enviar o meu contacto» só para o dono com sessão, que abre o `SendContactForm` via `public-send-panel` carregado por `import()` (fora do bundle público). Antes: T-FE-17/18 (envio de contacto), T-FE-14/15/16 (perfis). `typecheck`, `lint`, `pnpm test` (345) e build de produção a passar (página pública ~79 KB gzip; formulário de envio em chunk separado).
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

1. **Backend (precisa do dono do produto para avançar a sério):** pedir um projeto Supabase e as chaves (URL, anon key) para um `.env` (ver `apps/api/.env.example`), para ligar o `SessionService` ao Supabase Auth e começar o login BFF (T-BE-02). Entretanto, podem avançar-se peças do backend que não dependem do Supabase: `ValidationPipe` global com os schemas Zod partilhados e a estratégia de empacotamento executável (T-BE-03).
2. **Frontend, em paralelo (não bloqueado):** T-FE-20 membros (company_admin: listar, convidar por email, mudar papel, remover com confirmação; handler `/api/members*` pronto; o próprio nunca se altera — ver nota do bloco 2 da API simulada). Depois T-FE-21/22/23/24/25 (dashboard, estatísticas com CSV, temas, auditoria, conta).
5. **T-FE-21** Dashboard, **T-FE-22** Estatísticas e CSV, **T-FE-23** Temas (ecrã dedicado), **T-FE-24** Auditoria, **T-FE-25** Conta.
6. **T-FE-26/27/28** Suite de testes de acessibilidade (axe), Playwright (cinco fluxos, CSP, 360 px) e `scripts/check-bundle-size.mjs`.
7. Em cada passo: atualizar `docs/codebase-graph.md`, `docs/requirements.md` (estados) e este ficheiro; só marcar Concluída o que cumprir a Definition of Done.

### Passos para retomar

- `git pull` (o trabalho desta sessão está em `origin/main`).
- Instalar/correr: ver `README.md`. No PC de casa há Node 24 com nvm (`nvm use 24.22.2`). No PC do trabalho não há Node 24 nem nvm, pelo que se usa um Node 24 portátil só para a sessão; aí o `git push` faz-se pelo PowerShell.
- Correr `pnpm typecheck`, `pnpm lint` e `pnpm test` antes de continuar.
