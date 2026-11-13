# PROJECT_STATE — NFC Business

Atualizado em 2026-11-13.

## Identificação

- Produto: NFC Business, plataforma de cartões de visita digitais por NFC e QR Code.
- Repositório: https://github.com/Bauirxx/nfcproject
- Instruções obrigatórias: `CLAUDE.md` (prompt mestre) e `docs/prompts/FRONTEND.md`.
- Fase em curso: frontend completo sobre API simulada (MSW). O backend (fases 1 e 2 do prompt mestre) ainda não foi iniciado.

## Resumo da arquitetura

- Monorepo pnpm: `apps/web` (React 19, Vite 8, TypeScript 6, Tailwind 4) e `packages/shared` (schemas Zod, constantes, validadores, links e permissões, partilhados com o futuro backend). `apps/api` ainda não existe.
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
| T-FE-14/15/16 Perfis | Em desenvolvimento | Blocos base já escritos (ver registo de continuidade). Faltam editor de tema, diálogo de criar, páginas de lista e editor, ligar as rotas e os testes |
| T-FE-11 Envio do dono na página pública | Planeada | Depende do formulário de envio (T-FE-17, passo 5) |

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
- `pnpm test`: 313 testes a passar (82 em `packages/shared`, 231 em `apps/web`).
- `pnpm --filter @nfc-business/web build`: a passar; API simulada fora do bundle; chunk inicial da página pública 78 KB gzip (< 100 KB), sem router/TanStack Query/RHF/Zod (confirmado por `Select-String` no chunk).
- Playwright: ainda sem testes. Falta o `scripts/check-bundle-size.mjs` (T-FE-28).

## Registo de continuidade

- Última tarefa: T-FE-12/13, cartões — concluída (lista com pesquisa/filtro/paginação, criação, detalhe com chip URL, QR PNG/SVG, associação de perfil, ações de estado com confirmação, histórico). Ficheiros: `apps/web/src/features/cards/*`, novos componentes em `apps/web/src/shared/components/ui/*`, `apps/web/src/shared/lib/{qr,download}.ts`, hooks em `apps/web/src/shared/hooks/*`.
- Componentes partilhados criados aqui e reutilizáveis por perfis/membros/etc.: `Dialog` (modal acessível sem Radix, com armadilha de foco e `use-scroll-lock`), `ConfirmDialog`, `PageHeader`, `Badge`, `EmptyState`, `ErrorState`, `Table`/`THead`/`TBody`/`Tr`/`Th`/`Td`, `Pagination`, `Select`/`SelectField`, `Input`, `TextField`/`PasswordField` (com `hideOptional`).
- Tarefa anterior: T-FE-10, página pública — concluída, 4 testes, orçamento do bundle confirmado.
- Ficheiros da T-FE-06: `apps/web/src/features/auth/*` (auth-layout, from-state, use-url-token, schemas, login-page, mfa-verify-page, mfa-setup-page, recover-password-page, reset-password-page, accept-invite-page + testes), `apps/web/src/shared/components/ui/{input,label,text-field,password-field,card,alert,qr-code}`, `apps/web/src/shared/i18n/panel/auth.ts`, entradas novas em `shared/i18n/panel/common.ts` e `shared/i18n/errors.ts`.
- Notas de implementação da T-FE-06: as respostas são validadas por `apiParsed`; o QR do MFA é desenhado em SVG a partir da matriz de `uqr.encode` (sem `dangerouslySetInnerHTML`); os rótulos dos campos marcam o *opcional*, não o obrigatório (não poluir o nome acessível); depois de confirmar o MFA, a sessão em cache é corrigida (`mfaEnabled: true`) antes de ir para o painel; `useUrlToken` lê o `?token=` uma vez (inicializador de `useState`) e retira-o do URL.
- Última tarefa anterior: T-FE-05, estrutura do painel — concluída, com build de produção verificado.
- Ficheiros do último bloco: `apps/web/src/app/*` (routes, router, entry, app-shell, guards, error-pages, providers, query-client, session, session-events, theme, theme-toggle, nav-items, use-sign-out, placeholder-page), `apps/web/src/shared/components/ui/{button,spinner,skeleton,toaster,toast-store}`, `apps/web/src/shared/i18n/panel/*`, `apps/web/src/shared/lib/theme-preference.ts`, `apps/web/src/main.tsx`, `apps/web/src/test/utils.tsx`, e os testes `app/{app-shell,error-pages,theme-toggle,session-events}.test.tsx`.
- `main.tsx` ainda não ramifica para a página pública: todos os caminhos abrem o painel. A ramificação estática para `/c/:token` e `/p/:slug` entra na T-FE-10 (com import relativo, para não cair na regra `@/features/*` do ESLint do bundle público).
- Para testes de componentes/fluxos: `renderApp({ route, as })` e `renderWithProviders(ui)` em `src/test/utils.tsx` (`as` é um id de utilizador dos dados de demonstração; inicia sessão com `signIn` antes de montar).
- Estado exato: todos os endpoints do ADR-0004 têm handler e testes, reunidos em `handlers/index.ts`. O servidor MSW global (`mocks/server.ts`) é ligado em `src/test/setup.ts` com `onUnhandledFrame: 'error'`, e `resetHandlers` e `resetDb` correm depois de cada teste; `useMockServer(handlers)` acrescenta rotas com `server.use` antes de cada teste. `mocks/browser.ts` exporta `startMockApi()`: `enablePersistence()`, `setupWorker(...handlers).start({ onUnhandledFrame: 'bypass', quiet: true, serviceWorker: { url: '/mockServiceWorker.js' } })` e `interceptVcfDownloads()`. A captura do VCF (`mocks/vcf-download.ts`) impede a navegação nos links `/api/public/(cards|profiles)/:x/contact.vcf` da mesma origem, pede o ficheiro com `fetch` e entrega-o como Blob com o nome do `Content-Disposition`; não toca em cliques com modificadores nem já tratados. `startMockApi` ainda não é chamado por ninguém: falta `main.tsx` (T-FE-05).
- Comportamentos implementados no bloco 7 (público): `GET /api/public/cards/:token` e `/api/public/profiles/:slug` só respondem a cartões `active` com perfil (pelo endereço amigável, o perfil precisa de um cartão ativo) e devolvem a vista pública (nome sempre público, restantes campos conforme a visibilidade, só contactos e redes `isPublic`), com `Cache-Control: public, max-age=60`; tudo o resto, incluindo tokens mal formados, dá o mesmo 404 `not_found`. O VCF é `text/vcard; charset=utf-8`, `Content-Disposition: attachment; filename="<slug>.vcf"`, gerado por `mocks/vcard.ts` (vCard 4.0: escape de `\`, `,`, `;` e quebras de linha, remoção de caracteres de controlo, linhas dobradas a 75 octetos, `N` com o último nome como apelido, telefones só em E.164 sem repetições, redes em `X-SOCIALPROFILE`, link do cartão em `URL;TYPE=x-nfc-card`, sem fotografia). `POST /api/public/events` exige o token CSRF, valida a lista fechada, responde sempre 204 e deduplica 30 minutos por cartão e tipo (não por IP, que a simulação não conhece); o limite de 60 pedidos por minuto por IP também não é simulado.
- Comportamentos implementados no bloco 6: estatísticas com `from` e `to` obrigatórios (intervalo até 366 dias, senão 400), base determinística por cartão e dia (`demoWeight`, menos atividade ao fim de semana, nada no futuro nem antes da criação do cartão) somada aos contadores registados; cartões visíveis segundo o papel (platform_admin todos, com `byCompany` e filtro `companyId`; empresa; o dono só os cartões dos seus perfis); `cardId` fora dos visíveis dá 404 e `companyId` sem `analytics.filterByCompany` dá 403. Auditoria: platform_admin vê tudo, company_admin só a sua empresa; filtros `action`, `actor` (nome ou email, sem maiúsculas) e `from`/`to` por dia civil local; `from` > `to` dá 400. Nos testes, `signIn` regista um `auth.login` na auditoria, e as contagens contam com isso.
- Comportamentos implementados no bloco 5 (envio de contacto): o perfil tem de ser visível para o utilizador (as regras de posse dos perfis, senão 404) e ter cartão ativo (409 `profile_without_card`); só os envios aceites contam para os limites (10 por hora, scope `hour`; 50 por dia, scope `day`; sem limite por empresa, por não haver valor definido); o envio guarda apenas `recipientMasked`, incrementa o contador `contactsSent` do cartão ativo no dia civil local e regista `contact.sent`; o histórico mostra os envios dos perfis visíveis (o dono vê os dos seus perfis, mesmo feitos por outros), com filtro `profileId` (404 se não for visível) e paginação.
- Comportamentos implementados no bloco 4 (perfis): o profile_owner só vê e edita os perfis de que é dono (P-04), os outros papéis veem os da empresa; a lista vem por ordem alfabética e a pesquisa cobre nome, cargo e empresa; criar gera o endereço amigável a partir do nome (`slugFor`: sem acentos, único com sufixo `-2`, `-3`…) e preenche `company` com o nome da empresa; `ownerUserId` exige `profiles.assignOwner` (403) e um utilizador da empresa (404); `theme` exige `themes.manage` (403, P-03); as autorizações são verificadas antes de consumir uploads; `photoFileId` e `theme.logoFileId` seguem a regra `null` remove, omitido mantém, texto consome o upload; `title`, `company` e `bio` vazios ficam `null`; cada edição regista `profile.updated`.
- Comportamentos implementados no bloco 3 (cartões): a lista vem ordenada por `updatedAt` decrescente e a pesquisa cobre a etiqueta e o nome do perfil; o perfil referido em `profileId` tem de ser da mesma empresa (senão 404); cada alteração acrescenta uma entrada ao histórico (`updated`, `profile_linked`, `profile_unlinked`) e uma entrada `card.updated` na auditoria, nada quando não há alterações; desassociar o perfil de um cartão ativo dá 409 `card_without_profile`; o histórico vem do mais recente para o mais antigo, com empates pela ordem inversa de registo.
- Comportamentos implementados no bloco 2: `POST /api/uploads/sign` exige a permissão de quem edita o destino (`profiles.edit`, `themes.manage` ou `companies.manage`) e responde 200 com `uploadUrl` = `/api/uploads/<fileId>`; o `PUT` só aceita o ficheiro uma vez, do próprio utilizador, com o tamanho anunciado (422 `invalid_file`), até 2 MB (413 `file_too_large`) e com magic bytes e cabeçalho iguais ao tipo anunciado (415 `unsupported_file_type`); `consumeUpload` entrega o `dataUrl` uma única vez ou dá 422 `invalid_file`. Criar empresa convida o primeiro administrador (`adminEmail`, P-09) e regista `company.created` e `member.invited` com o `companyId` da nova empresa; emails são únicos na plataforma (409 `already_member`). Membros: o próprio não muda o seu papel nem se remove (409 `cannot_change_self`), o que garante que nunca fica uma empresa sem administrador, por isso o código `last_admin` previsto não é necessário e não existe; remover um membro termina as suas sessões, apaga os convites e liberta os perfis de que era dono.
- Comportamentos implementados em `handlers/auth.ts` (além dos decididos abaixo): o login substitui a sessão anterior deste browser; `mfa/verify` também tem limite de 5 tentativas por minuto por utilizador; `recover` cria um link novo sem invalidar os anteriores (facilita a demonstração); `refresh` mantém o token CSRF; `mfa/setup` com MFA já ativo dá 409 `mfa_already_enabled`; `mfa/confirm` sem configuração iniciada dá 409 `mfa_not_pending` e código errado 422 `invalid_code`; `mfa/disable` sem MFA dá 409 `mfa_not_enabled`; `account`, `password` e `sessions` exigem `account.manage` (administradores sem MFA recebem 403 `mfa_setup_required`).
- Para testar handlers: `useMockServer(handlers)`, `signIn(userId)`, `api(method, path, body?)` e `errorCode(response)` em `handlers/testing.ts`.
- Comportamentos já decididos para os handlers (para não redesenhar):
  - Login: 5 tentativas por minuto por email (429 com Retry-After); conta com MFA responde `mfa_required`; credenciais erradas dão 401 `invalid_credentials`.
  - `mfa/verify`: código TOTP ou código de recuperação de uso único; sem desafio pendente dá 401 `mfa_challenge_expired`; código errado dá 401 `invalid_code`.
  - `mfa/disable`: administradores recebem 403 `mfa_required_for_role`; palavra-passe errada dá 422 `invalid_current_password`.
  - `recover` responde sempre 202; `recover/confirm` dá 204, 400 `invalid_token` ou 422 `weak_password` e termina todas as sessões; `invite/accept` dá 204 sem criar sessão.
  - `DELETE /api/auth/sessions` termina todas as sessões, incluindo a atual.
  - Recursos de outra empresa dão sempre 404. Membros: 409 `already_member` e `cannot_change_self` (ver nota do bloco 2 sobre `last_admin`).
  - Cartões: transição inválida dá 409 `invalid_transition`; ativar sem perfil dá 409 `card_without_profile`.
  - Envios: 10 por hora e 50 por dia por utilizador (429 com `scope` e Retry-After); perfil sem cartão ativo dá 409 `profile_without_card`; só se guarda o destinatário mascarado.
  - Página pública: só cartões `active` com perfil; tudo o resto dá o mesmo 404. O VCF é `text/vcard`. Eventos públicos respondem sempre 204, com deduplicação de 30 minutos.
  - Estatísticas: base determinística por cartão e dia, mais os contadores registados.
  - Uploads: `POST /api/uploads/sign` devolve `/api/uploads/<fileId>`; o `PUT` valida tamanho e magic bytes com `detectImageType`.
- Verificado no ambiente de testes (Vitest com jsdom): o MSW resolve URLs relativos, aceita `AbortSignal`, corpos `Blob` e respostas lançadas pelos resolvers. No MSW 3 a opção chama-se `onUnhandledFrame` (não `onUnhandledRequest`).
- Tarefa em curso — T-FE-14/15/16 (perfis). **Checkpoint WIP** (typecheck 0, lint 0, 313 testes intactos). Já escrito e verificado:
  - `shared/i18n/panel/profiles.ts`: `profileTexts`, `contactTypeLabels`/`contactTypePlaceholders`, `socialPlatformLabels`, `themeTemplateLabels`. (Importa-se direto, como `cards.ts`; não está no `panel/index.ts`.)
  - `shared/components/ui/switch.tsx`: `Switch` (role="switch", sem Radix). `shared/components/ui/textarea.tsx`: `Textarea` + `TextareaField` (com `hideOptional`). `shared/components/ui/color-field.tsx`: `ColorField` (seletor nativo `<input type="color">` + campo de texto ligados ao mesmo hex).
  - `shared/lib/image-validation.ts`: `checkSizeAndType` (puro: 2 MB + magic bytes via `detectImageType`), `checkImageFile(file, limits, measure?)` (injeta `measure` para testes; por defeito `measureImageElement` via DOM), `PHOTO_LIMITS`/`LOGO_LIMITS` (de `LIMITS.photo`/`LIMITS.logo`).
  - `features/profiles/upload.ts`: `uploadImage(blob, purpose)` → `POST /api/uploads/sign` (contentType = `blob.type`, size = `blob.size`) e `PUT` do blob; devolve `fileId`.
  - `features/profiles/queries.ts`: `useProfilesQuery` (params concretos, `keepPreviousData`), `useProfileQuery`, `useCreateProfile`, `useUpdateProfile` (meta `inlineError`, atualiza a cache do detalhe), `useCompanyMembersQuery(enabled)` (seletor de dono; só para quem tem `members.manage`). `profileKeys`.
  - `features/profiles/sortable-list.tsx`: `SortableList` genérico (dnd-kit **e** botões cima/baixo, WCAG 2.5.7); transform/transition por `style` inline (CSP-safe). Props: `ids`, `onMove(from,to)`, `labels`, `renderItem(id,index)`.
  - `features/profiles/photo-crop-dialog.tsx`: `PhotoCropDialog` + `computeCropSource(natW,natH,zoom,offsetX,offsetY)` (puro, exportado para teste). Recorte quadrado para `OUTPUT_SIZE=512`, saída `image/jpeg`; fallback ao ficheiro original se não houver canvas (jsdom).
  - `features/profiles/photo-field.tsx`: `PhotoField` + tipo `PhotoState` (`keep`|`remove`|`replace`), valida com `checkImageFile(PHOTO_LIMITS)`, abre o recorte, guarda o blob pendente; revoga os object URLs no unmount.
- Falta (próxima sessão, por ordem):
  1. `features/profiles/theme-editor.tsx` (`ThemeEditor`): modelo (`themeTemplateLabels`), 3 cores (`ColorField`), logótipo (upload `theme_logo`), verificação de contraste AA ao vivo com `contrastRatio`/`meetsContrast` (`CONTRAST_AA_TEXT`/`CONTRAST_AA_LARGE`) que **bloqueia** o guardar; PATCH próprio `{ theme }` (só `themes.manage`, senão o backend dá 403). `profileThemeInputSchema` já valida.
  2. `features/profiles/profile-create-dialog.tsx` (`ProfileCreateDialog`): `displayName` (`personNameSchema`) + dono opcional (só `profiles.assignOwner`, via `useCompanyMembersQuery`). POST → navegar para `/painel/perfis/:id`.
  3. `features/profiles/profiles-page.tsx` (`ProfilesPage`): lista (pesquisa com `useDebouncedValue` + paginação), colunas nome/cargo/dono/cartões/atualizado, `EmptyState`, criar.
  4. `features/profiles/profile-editor-page.tsx` (`ProfileEditorPage`, `/painel/perfis/:id`): RHF com `zodResolver(profileFieldsSchema)`; nome/cargo/empresa/bio (`TextareaField`), interruptores de visibilidade (`Switch` em `Controller`), `PhotoField`, contactos e redes via `useFieldArray` + `SortableList` (ids = `field.id` do RHF), telefone/whatsapp normalizado no `onBlur` com `normalizePhone` e pré-visualização `formatPhoneDisplay`, dono (só `profiles.assignOwner`). Ids de novos itens: `crypto.randomUUID()`. No submit: se `PhotoState==='replace'` → `uploadImage(blob,'profile_photo')` → `photoFileId`; `'remove'` → `photoFileId:null`; `'keep'` → omitir. **Não** enviar `theme` nem `ownerUserId` sem a permissão respetiva.
  5. Ligar as rotas em `app/routes.tsx` (`perfis` → `ProfilesPage`, `perfis/:id` → `ProfileEditorPage`, em vez dos `PlaceholderPage`).
  6. Testes esperados: `image-validation.test.ts` (shared/lib; testa `checkSizeAndType` e `checkImageFile` com `measure` falso), `sortable-list.test.tsx` (botões cima/baixo → `onMove`), `photo-crop-dialog.test.tsx` (`computeCropSource`), `theme-editor.test.tsx` (contraste bloqueia/permite guardar), `profiles-page.test.tsx` (lista/pesquisa/criar), `profile-editor-page.test.tsx` (carregar, editar campo, adicionar contacto, guardar). Dados de demonstração úteis: `u_ana` (company_admin ACME), perfis `p_paula`/`p_carlos`/`p_recepcao`.
  7. DoD: atualizar `docs/codebase-graph.md` (secção de perfis) e este ficheiro, e só então marcar a tarefa como Concluída.
- T-FE-11 (envio do dono na página pública) fica para o passo 5 (envio de contacto, T-FE-17), quando existir o `SendContactForm` reutilizável; o plano está no histórico deste ficheiro.
- Passos para retomar: ver `README.md` (instalação) e depois correr `pnpm typecheck`, `pnpm lint` e `pnpm test` antes de continuar. Node 24 ativo (`nvm use 24.22.2`).
