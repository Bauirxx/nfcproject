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
- Mecânica comum dos handlers da API simulada (CSRF, sessão, permissões, validação, limites): 7 testes a passar.
- Handlers de autenticação e conta da API simulada (`handlers/auth.ts`): 34 testes a passar.
- Handlers de uploads, empresas e membros da API simulada (`handlers/{uploads,companies,members}.ts`): 32 testes a passar.
- Handlers de cartões da API simulada (`handlers/cards.ts`): 18 testes a passar.
- Handlers de perfis da API simulada (`handlers/profiles.ts`): 18 testes a passar.
- Handlers de envio de contacto da API simulada (`handlers/contact-shares.ts`): 12 testes a passar.
- Handlers de estatísticas e auditoria da API simulada (`handlers/{analytics,audit}.ts`): 15 testes a passar.
- Handlers públicos da API simulada (`handlers/public.ts`) e gerador de vCard 4.0 (`mocks/vcard.ts`): 18 testes a passar.
- Junção de todos os handlers com 404 para `/api/*` desconhecidos (`handlers/index.ts`): 3 testes a passar.

## Em curso

| Tarefa | Estado | Notas |
| --- | --- | --- |
| T-FE-01 Base do projeto | Em desenvolvimento | Faltam `main.tsx`, `playwright.config.ts` e `scripts/check-bundle-size.mjs` |
| T-FE-02 Pacote partilhado | Em testes | Inclui `images.ts` (magic bytes de JPEG, PNG e WebP); falta registar no grafo |
| T-FE-03 Cliente da API | Em testes | Código e testes prontos; falta atualizar ADR-0004 e ADR-0005 |
| T-FE-04 API simulada (MSW) | Em desenvolvimento | Feitos `credentials.ts`, `totp.ts`, `db.ts`, `seed.ts`, `domain.ts`, `vcard.ts`, `handlers/{http,testing,auth,uploads,companies,members,cards,profiles,contact-shares,analytics,audit,public,index}.ts`; faltam `browser.ts`, `server.ts` e a ligação ao `src/test/setup.ts` |
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
- 2026-11-12: handlers de autenticação e conta da API simulada (sessão, login, MFA, recuperação, convite, conta, sessões) com 34 testes; `endCurrentSession` no domínio; helper `handlers/testing.ts` para os testes dos handlers.
- 2026-11-12: handlers de uploads (URL assinado, magic bytes, `consumeUpload`), empresas e membros com 32 testes; `inviteUser` e `emailTaken` no domínio; `uploadImage` no helper de testes.
- 2026-11-12: handlers de cartões (lista com pesquisa, filtro e paginação; criar; editar; ativar, desativar, perdido e bloquear; histórico) com 18 testes.
- 2026-11-12: handlers de perfis (lista com pesquisa e posse, criação com endereço amigável único, edição de campos, contactos, redes sociais, visibilidade, dono, fotografia e tema com logótipo) com 18 testes.
- 2026-11-12: handlers de envio de contacto (registo com destinatário mascarado, limites por hora e por dia, evento `contactsSent`, auditoria, histórico com posse) com 12 testes; `bumpCounter` e `counterKey` no domínio.
- 2026-11-12: handlers de estatísticas (série diária determinística mais eventos registados, por cartão e por empresa, com posse e filtros) e de auditoria (filtros por ação, autor e datas; isolamento por empresa) com 15 testes.
- 2026-11-12: handlers públicos (cartão por token e por endereço amigável, VCF, eventos com deduplicação) e gerador de vCard 4.0 com escape e dobragem de linhas, com 18 testes.
- 2026-11-12: `handlers/index.ts` junta todos os handlers e responde 404 `not_found` a qualquer outro `/api/*`, com 3 testes (inclui a verificação de que não há método e caminho repetidos).

## Estado dos testes

- `pnpm typecheck`: sem erros.
- `pnpm lint`: sem erros nem avisos.
- `pnpm test`: 270 testes a passar (82 em `packages/shared`, 188 em `apps/web`).
- Playwright: ainda sem testes. Sem verificação de build nem de tamanho do bundle.

## Registo de continuidade

- Última tarefa: T-FE-04, API simulada — handlers por módulo concluídos (blocos 1 a 8: autenticação; uploads, empresas e membros; cartões; perfis; envio de contacto; estatísticas e auditoria; página pública; índice).
- Ficheiros envolvidos: `apps/web/src/mocks/handlers/{http,testing,auth,uploads,companies,members,cards,profiles,contact-shares,analytics,audit,public,index}.ts` (cada um com o seu `.test.ts`, exceto `testing.ts`), `apps/web/src/mocks/vcard.ts` (com teste), `apps/web/src/mocks/domain.ts`.
- Estado exato: todos os endpoints do ADR-0004 têm handler e testes, reunidos em `handlers/index.ts` (`handlers`), que termina com `http.all('/api/*')` a responder 404 `not_found`. Faltam `mocks/browser.ts` (worker do MSW, `enablePersistence`, captura do clique no link do VCF), `mocks/server.ts` (`setupServer(...handlers)` para o Vitest) e a ligação do servidor MSW em `src/test/setup.ts`.
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
- Próxima tarefa, por ordem:
  1. Feito: `packages/shared/src/images.ts`, `mocks/vcard.ts`, `handlers/{auth,uploads,companies,members,cards,profiles,contact-shares,analytics,audit,public,index}.ts`.
  2. Feito: `handlers/index.ts`.
  3. `mocks/browser.ts` (inclui a captura do clique no link do VCF) e `mocks/server.ts`; ligar o servidor MSW em `src/test/setup.ts`.
  4. Componentes base, router, guards, layout, páginas de erro e `main.tsx`.
  5. `docs/codebase-graph.md`, ADR-0009, atualização dos ADR-0004 e 0005 e de `docs/requirements.md`.
- Passos para retomar: ver `README.md` (instalação) e depois correr `pnpm typecheck`, `pnpm lint` e `pnpm test` antes de continuar.
