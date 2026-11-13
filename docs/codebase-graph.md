# NFC Business — Grafo do código

Atualizado em 2026-11-12. Mapa dos módulos, ficheiros principais, endpoints, tabelas e dependências. Cada relação está marcada como **confirmada** (existe no código ou num ADR aceite) ou **inferida** (prevista, ainda sem código, ou à espera de confirmação do backend). Antes de alterar código partilhado, consulta aqui quem depende dele e que testes repetir.

## 1. Pacotes

| Pacote | Caminho | Papel | Estado |
|--------|---------|-------|--------|
| `@nfc-business/shared` | `packages/shared` | Contrato partilhado com o futuro backend: constantes, validadores, links, permissões, contraste, imagens e schemas Zod | Confirmado (82 testes) |
| `@nfc-business/web` | `apps/web` | Frontend: página pública, painel e API simulada | Confirmado (em curso) |
| `apps/api` | — | Backend NestJS (fases 1 e 2 do prompt mestre) | Inferido (não existe) |

## 2. Pacote partilhado (`packages/shared/src`)

| Ficheiro | Exporta | Usado por (confirmado) |
|----------|---------|------------------------|
| `constants.ts` | `ROLES`, `MEMBER_ROLES`, `MFA_REQUIRED_ROLES`, `CARD_STATUSES`, `CARD_ACTIONS`, `CARD_TRANSITIONS`, `CARD_HISTORY_ACTIONS`, `PUBLIC_EVENT_TYPES`, `CONTACT_TYPES`, `SHARE_CHANNELS`, `SOCIAL_PLATFORMS`, `THEME_TEMPLATES`, `DEFAULT_THEME`, `UPLOAD_MIME_TYPES`, `UPLOAD_PURPOSES`, `RATE_LIMIT_SCOPES`, `DEFAULT_PHONE_PREFIX`, `LIMITS`, `AUDIT_ACTIONS` | `validators.ts`, `schemas/*`, `permissions.ts`, `images.ts`, `apps/web/src/shared/api/{client,errors,endpoints}.ts`, `apps/web/src/shared/i18n/{errors,validation}.ts`, `apps/web/src/mocks/**` |
| `validators.ts` | `isE164`, `normalizePhone`, `isEmail`, `parseHttpsUrl`, `isHttpsUrl`, `isAllowedSocialUrl`, `isCardToken`, `isSlug`, `isHexColor`, `containsLink`, `containsHtml`, `isSingleLineText`, `isMultilineText`, `isValidNote` | `schemas/*`, `links.ts`, `apps/web/src/mocks/{vcard,handlers/profiles,handlers/public}.ts` |
| `links.ts` | `buildCardUrl`, `buildProfileUrl`, `toSafeHttpsUrl`, `toSafeImageUrl`, `buildTelUrl`, `buildWhatsAppUrl`, `buildSmsUrl`, `buildMailtoUrl`, `buildMapsUrl`, `formatPhoneDisplay`, `maskEmail`, `maskPhone`, `maskRecipient`, `buildShareMessage` | `apps/web/src/mocks/{seed,handlers/contact-shares}.ts`; página pública e envio de contacto (inferido) |
| `permissions.ts` | `PERMISSIONS`, `can`, `permissionsOf`, `requiresMfa` | `apps/web/src/mocks/{domain,handlers/http,handlers/auth,handlers/profiles,handlers/analytics}.ts`; menu e guards do painel (inferido) |
| `contrast.ts` | `meetsContrast`, `CONTRAST_AA_TEXT`, `CONTRAST_AA_LARGE` | `schemas/profiles.ts`; editor de temas (inferido) |
| `images.ts` | `detectImageType`, `isUploadMimeType`, `IMAGE_SIGNATURE_BYTES` | `apps/web/src/mocks/handlers/uploads.ts`; validação de uploads no cliente (inferido) |
| `schemas/common.ts` | `idSchema`, `emailSchema`, `phoneSchema`, `httpsUrlSchema`, `hexColorSchema`, `dateTimeSchema`, `dateSchema`, `passwordSchema`, `personNameSchema`, `paginationQuerySchema`, `paginatedSchema`, `apiErrorSchema` | restantes schemas, `apps/web/src/mocks/handlers/http.ts` |
| `schemas/auth.ts` | sessão, login, MFA, recuperação, convite, conta, palavra-passe, sessões | `apps/web/src/shared/api/session.ts`, `apps/web/src/mocks/handlers/auth.ts` |
| `schemas/companies.ts` | empresas e membros | `apps/web/src/mocks/handlers/{companies,members}.ts` |
| `schemas/cards.ts` | cartões e histórico | `apps/web/src/mocks/handlers/cards.ts` |
| `schemas/profiles.ts` | perfis, contactos, redes, tema, vista pública, eventos públicos, uploads | `apps/web/src/mocks/handlers/{profiles,uploads,public}.ts`, `apps/web/src/mocks/vcard.ts` |
| `schemas/contact-shares.ts` | envio de contacto e histórico | `apps/web/src/mocks/handlers/contact-shares.ts` |
| `schemas/analytics.ts` | estatísticas e auditoria | `apps/web/src/mocks/handlers/{analytics,audit}.ts` |

Testes: `*.test.ts` ao lado de cada ficheiro e `schemas/schemas.test.ts`.

## 3. Frontend (`apps/web`)

### 3.1 Configuração

| Ficheiro | Papel | Depende de |
|----------|-------|------------|
| `vite.config.ts` | Vite e Vitest; CSP do `preview` (ADR-0006); constante `__API_MOCKING__`; plugin do worker do MSW (ADR-0009); alias `@` | `mocks-static/mockServiceWorker.js`, `src/test/setup.ts` |
| `tsconfig.json`, `tsconfig.node.json` | Tipos do browser e de Node (config, e2e, `mocks/{totp,credentials}.ts`) | `../../tsconfig.base.json` |
| `index.html`, `public/favicon.svg`, `src/styles/index.css` | Casca HTML e estilos Tailwind | — |
| `src/vite-env.d.ts` | Declara `__API_MOCKING__` | — |
| `eslint.config.mjs` (raiz) | Regras de segurança (`react/no-danger`, armazenamento do browser, `no-console`) e fronteira do bundle da página pública (ADR-0003) | — |

### 3.2 `src/shared` (confirmado)

| Ficheiro | Exporta | Depende de | Usado por |
|----------|---------|------------|-----------|
| `api/endpoints.ts` | `endpoints` (todos os caminhos `/api/*`, ADR-0004) | `shared/constants` (tipo) | `api/client.ts`, `api/session.ts`; features (inferido) |
| `api/client.ts` | `apiFetch`, `refreshSession` | `api/csrf.ts`, `api/endpoints.ts`, `api/errors.ts`, `api/events.ts`, `shared/constants` | `api/session.ts`, `lib/parsed-api.ts`; features (inferido) |
| `api/csrf.ts` | `getCsrfToken`, `setCsrfToken` (só em memória, ADR-0005) | — | `api/client.ts` |
| `api/errors.ts` | `ApiError`, `isApiError`, `hasStatus` | `shared/constants` | `api/client.ts`, `lib/parsed-api.ts`, `i18n/errors.ts` |
| `api/events.ts` | `onUnauthorized`, `emitUnauthorized` | — | `api/client.ts`; guard do painel (inferido) |
| `api/session.ts` | `loadSession` (usa `refreshable`) | `api/client.ts`, `api/endpoints.ts`, `shared/schemas` (tipos) | arranque do painel e página pública (inferido) |
| `lib/parsed-api.ts` | `apiParsed` (resposta validada por schema; só no painel) | `api/client.ts`, `api/errors.ts`, `zod` | features do painel (inferido); sem testes próprios |
| `lib/cn.ts` | `cn` | `clsx`, `tailwind-merge` | componentes do painel (inferido) |
| `i18n/errors.ts` | `errorTexts`, `errorMessage` | `shared/constants`, `api/errors.ts`, `i18n/format.ts` | painel (inferido) |
| `i18n/format.ts` | datas, números e durações em `pt-MZ` (ADR-0008) | — | `i18n/errors.ts`; painel (inferido) |
| `i18n/public.ts` | `publicTexts` (sem dependências, ADR-0003) | — | página pública (inferido) |
| `i18n/validation.ts` | `validationMessage` (código do schema → texto) | `shared/constants` | formulários (inferido) |

Testes: `api/client.test.ts` (23 testes, `fetch` substituído por `vi.stubGlobal`).

### 3.3 API simulada (`src/mocks`, confirmado, ADR-0009)

| Ficheiro | Papel | Depende de |
|----------|-------|------------|
| `credentials.ts` | Contas, códigos de recuperação e tokens fictícios (também usado pelos e2e, em Node) | — |
| `totp.ts` | TOTP RFC 6238 (gerar, verificar, chave nova) | Web Crypto |
| `seed.ts` | Dados de demonstração determinísticos; `DB_VERSION` | `credentials.ts`, `shared/constants`, `shared/links` |
| `db.ts` | Tipos `Db*`, `getDb`, `resetDb`, `enablePersistence`, `loadDb`, `saveDb`, `nextId`, `randomToken` | `seed.ts` |
| `domain.ts` | `toSessionUser`, `recordAudit`, `startSession`, `endCurrentSession`, `endSessions`, `inviteUser`, `emailTaken`, `activeCardOf`, `bumpCounter`, `counterKey`, `civilDate`, `describeDevice` | `db.ts`, `shared/permissions` |
| `vcard.ts` | `buildVCard`, `escapeVCardText`, `foldLine` (vCard 4.0) | `shared/validators` |
| `vcf-download.ts` | `interceptVcfDownloads`, `downloadVcf`, `vcfLinkOf`, `isVcfPath` | `fetch` (intercetado pelo MSW) |
| `server.ts` | `server = setupServer(...handlers)` para o Vitest | `handlers/index.ts` |
| `browser.ts` | `startMockApi()` (persistência, worker, captura do VCF) | `db.ts`, `handlers/index.ts`, `vcf-download.ts`, `msw/browser` |
| `handlers/http.ts` | `route`, `fail`, `failure`, `json`, `noContent`, `readBody`, `readQuery`, `paginate`, `hitLimit`, `sessionUser`, `requireUser`, `requirePermission`, `requireCompany` | `db.ts`, `shared/permissions`, `msw`, `zod` |
| `handlers/testing.ts` | `useMockServer`, `signIn`, `signOut`, `api`, `errorCode`, `readJson`, `imageBytes`, `uploadImage` (só para testes) | `server.ts`, `db.ts`, `domain.ts` |
| `handlers/auth.ts` | `authHandlers` | `http.ts`, `domain.ts`, `totp.ts`, `credentials.ts` |
| `handlers/uploads.ts` | `uploadHandlers`, `consumeUpload` | `http.ts`, `shared/images` |
| `handlers/companies.ts` | `companyHandlers`, `toCompany` | `http.ts`, `domain.ts`, `uploads.ts` |
| `handlers/members.ts` | `memberHandlers`, `membersOf`, `toMember` | `http.ts`, `domain.ts` |
| `handlers/cards.ts` | `cardHandlers`, `toCard`, `profileNameOf` | `http.ts`, `domain.ts` |
| `handlers/profiles.ts` | `profileHandlers`, `toProfile`, `visibleProfiles`, `profileOr404`, `slugFor` | `http.ts`, `domain.ts`, `uploads.ts` |
| `handlers/contact-shares.ts` | `contactShareHandlers`, `toShare` | `http.ts`, `domain.ts`, `profiles.ts`, `shared/links` |
| `handlers/analytics.ts` | `analyticsHandlers`, `daysBetween` | `http.ts`, `domain.ts`, `cards.ts`, `profiles.ts` |
| `handlers/audit.ts` | `auditHandlers`, `toAuditEntry` | `http.ts`, `domain.ts` |
| `handlers/public.ts` | `publicHandlers`, `toPublicCard` | `http.ts`, `domain.ts`, `vcard.ts` |
| `handlers/index.ts` | `handlers` (todos, mais 404 para `/api/*`) | todos os anteriores |
| `src/test/setup.ts` | Liga `server.ts` ao Vitest; `cleanup`, `resetHandlers`, `resetDb` após cada teste | `server.ts`, `db.ts` |

Testes: `totp.test.ts`, `vcard.test.ts`, `vcf-download.test.ts`, `handlers/*.test.ts` (um por handler, mais `http.test.ts` e `index.test.ts`).

### 3.4 Casca do painel (`src/app` e base de UI, confirmado, T-FE-05)

| Ficheiro | Exporta | Depende de |
|----------|---------|------------|
| `main.tsx` | Entrada: arranca a API simulada (dev/e2e); ramifica por caminho — `/c/:token` e `/p/:slug` renderizam a página pública (import estático relativo de `features/public-card/mount`), o resto carrega o painel por `import()` | `./features/public-card/mount` (estático), `@/mocks/browser` e `@/app/entry` (por `import()`) |
| `app/entry.tsx` | `renderPanel` | `providers`, `query-client`, `router`, `session-events`, `theme` |
| `app/routes.tsx`, `app/router.ts` | `routes`, `createRouter` | guards, páginas de erro, `app-shell`, `placeholder-page` |
| `app/guards.tsx` | `RequireAuth`, `RequireGuest`, `RequirePermission` | `session`, `session-events`, `error-pages`, `shared/permissions` |
| `app/app-shell.tsx` | `AppShell` (menu por papel, seletor de tema, terminar sessão) | `nav-items`, `session`, `theme-toggle`, `use-sign-out`, `shared/permissions` |
| `app/error-pages.tsx` | `ForbiddenPage`, `NotFoundPage`, `ServerErrorPage`, `SessionExpiredPage` | `session-events`, `i18n/panel/error-pages`, `ui/button` |
| `app/session.ts` | `useSession`, `useCurrentUser`, `usePermission` | `api/session`, `session-events`, `shared/permissions` |
| `app/session-events.ts` | `sessionQueryKey`, `isSessionExpired`, `clearSessionExpired`, `watchSession` | `api/events` |
| `app/query-client.ts` | `createQueryClient` (avisos nas mutações sem `inlineError`) | `ui/toast-store`, `i18n/errors` |
| `app/providers.tsx` | `Providers` (QueryClient + Toaster) | `ui/toaster` |
| `app/theme.ts`, `app/theme-toggle.tsx` | `initTheme`, `useTheme`, `set/getThemePreference`, `ThemeToggle` | `shared/lib/theme-preference` |
| `app/nav-items.ts`, `app/use-sign-out.ts`, `app/placeholder-page.ts` | `navItems`, `useSignOut`, `PlaceholderPage` | `i18n/panel/nav`, `api/client`, `endpoints` |
| `shared/components/ui/{button,spinner,skeleton,toaster,toast-store}` | `Button`/`buttonVariants`, `Spinner`, `Skeleton`, `Toaster`, `toast` | `lib/cn`, `i18n/panel/common`, `@radix-ui/react-slot`, `class-variance-authority`, `lucide-react` |
| `shared/components/ui/{input,label,text-field,password-field,card,alert,qr-code}` | `Input`, `Label`, `TextField`, `PasswordField`, `Card*`, `Alert`, `QrCode` | `lib/cn`, `i18n/panel/common`, `lucide-react`, `uqr` (só `qr-code`) |
| `shared/components/ui/{dialog,confirm-dialog,page-header,badge,empty-state,error-state,table,pagination,select}` | `Dialog` (modal sem Radix) e `ConfirmDialog`, `PageHeader`, `Badge`, `EmptyState`, `ErrorState`, `Table*`, `Pagination`, `Select`/`SelectField` | `lib/cn`, `hooks/use-scroll-lock`, `i18n/{errors,panel/common}`, `lucide-react` |
| `shared/components/ui/{switch,textarea,color-field}` | `Switch` (role switch, sem Radix), `Textarea`/`TextareaField`, `ColorField` (seletor nativo + hex) | `lib/cn`, `i18n/panel/common`, `@nfc-business/shared/validators` (`color-field`) |
| `shared/hooks/{use-scroll-lock,use-debounced-value,use-document-title}` | hooks utilitários | `i18n/panel/common` (título) |
| `shared/lib/{qr,download}` | `qrSvgMarkup`, `downloadBlob`/`downloadText` | `uqr` (`qr`) |
| `shared/lib/image-validation` | `checkSizeAndType`, `checkImageFile` (medição injetável), `PHOTO_LIMITS`/`LOGO_LIMITS` | `@nfc-business/shared/{constants,images}` |
| `shared/i18n/panel/*` | `commonTexts`, `navTexts`, `errorPageTexts`, `authTexts` | — |
| `shared/lib/theme-preference.ts` | tema em `localStorage` (única exceção) e classe `dark` | — |
| `test/utils.tsx` | `renderApp`, `renderWithProviders`, `makeTestClient` | `providers`, `routes`, `mocks/handlers/testing` |

Testes: `app/{app-shell,error-pages,theme-toggle,session-events}.test.tsx`.

### 3.6 Funcionalidades (confirmado)

| Caminho | Conteúdo | Depende de | Tarefa |
|---------|----------|------------|--------|
| `features/auth/` (`auth-layout`, `from-state`, `use-url-token`, `schemas`, `login-page`, `mfa-verify-page`, `mfa-setup-page`, `recover-password-page`, `reset-password-page`, `accept-invite-page`) | Ecrãs de autenticação; substituem os `PlaceholderPage` das rotas de auth | `api/client`/`lib/parsed-api`, `endpoints`, `shared/schemas`, `shared/components/ui/*`, `app/session-events`, `react-hook-form`, `@hookform/resolvers/zod` | T-FE-06 |
| `features/public-card/` (`mount`, `public-card-page`, `parse-public-card`, `public-events`, `public-qr`) | Página pública leve (ADR-0003): fetch, estados, página neutra, ações saneadas, eventos, QR por `import()`, partilha e, para o dono com sessão, botão «Enviar o meu contacto» que carrega o painel de envio por `import()` (`@/features/contact-sending/public-send-panel`) | `api/client`, `endpoints`, `api/session` (dono), `i18n/public`, `@nfc-business/shared/{links,constants,contrast,validators}`, tipos de `/schemas`, `uqr` e `public-send-panel` (dinâmicos) | T-FE-10, T-FE-11 |
| `features/cards/` (`queries`, `cards-page`, `card-create-dialog`, `card-detail-page`, `card-status-badge`, `qr-download`) | Lista (pesquisa/filtro/paginação), criação, detalhe (chip URL, QR PNG/SVG, perfil, ações de estado, histórico) | `lib/parsed-api`, `endpoints`, `shared/schemas`, `shared/components/ui/*`, `app/session`, `shared/lib/{qr,download}` | T-FE-12/13 |
| `features/profiles/` (`queries`, `upload`, `profiles-page`, `profile-create-dialog`, `profile-editor-page`, `theme-editor`, `sortable-list`, `photo-field`, `photo-crop-dialog`) | Lista (pesquisa/paginação/posse), criar (com dono opcional), editor (campos, visibilidade, contactos e redes reordenáveis por arrastar e por botões, fotografia com recorte, dono), editor de tema com contraste AA que bloqueia o guardar | `lib/parsed-api`/`api/client`, `endpoints`, `shared/schemas`, `shared/components/ui/{switch,textarea,color-field,...}`, `shared/lib/image-validation`, `app/session`, `@dnd-kit/*`, `react-hook-form`, `@nfc-business/shared/{contrast,links,validators}` | T-FE-14/15/16 |
| `features/contact-sending/` (`queries`, `send-contact-form`, `contact-history`, `send-contact-page`, `public-send-panel`) | Envio por Email (API), WhatsApp (`wa.me`) e SMS (`sms:`), com perfil pré-selecionado, destinatário validado, nota, pré-visualização da mensagem e histórico com destinatário mascarado; o limite 429 aparece no formulário. `public-send-panel` embrulha o `SendContactForm` nos seus próprios providers para a página pública (T-FE-11), carregado por `import()` para ficar fora do bundle público | `lib/parsed-api`, `endpoints`, `shared/schemas`, `shared/components/ui/*`, `app/query-client` (painel público), `@nfc-business/shared/{links,validators,constants}`, `react-hook-form` | T-FE-17/18, T-FE-11 |

Testes: `features/auth/*.test.tsx`, `features/public-card/public-card-page.test.tsx`, `features/cards/*.test.tsx`, `features/profiles/{profiles-page,profile-editor-page,theme-editor,sortable-list,photo-crop-dialog}.test.tsx`, `features/contact-sending/send-contact-page.test.tsx`, `shared/lib/image-validation.test.ts` (a mensagem de partilha é testada em `packages/shared/src/links.test.ts`). Regra do bundle público verificada no build (secção 6).

### 3.5 Planeado (inferido, sem código)

| Caminho | Conteúdo previsto | Tarefas |
|---------|-------------------|---------|
| `src/features/{companies,members,analytics,themes,audit}/` | Ecrãs por funcionalidade (substituem os `PlaceholderPage`) | T-FE-19 a T-FE-25 |
| `e2e/`, `playwright.config.ts` | Cinco fluxos principais contra o build com CSP | T-FE-27 |
| `scripts/check-bundle-size.mjs` | Orçamento de JavaScript da página pública | T-FE-28 |

## 4. Endpoints

Estado do contrato segundo o ADR-0004. Todos têm handler e testes na API simulada. «Consumidor» é o ecrã previsto (inferido).

| Método e caminho | Contrato | Handler | Schemas | Tabelas do backend (inferido) | Consumidor |
|------------------|----------|---------|---------|-------------------------------|------------|
| `GET /api/auth/session` | Inferido | `auth.ts` | `sessionResponseSchema` | users, companies | arranque do painel e da página pública |
| `POST /api/auth/login`, `logout`, `refresh` | Confirmado | `auth.ts` | `loginRequestSchema`, `loginResponseSchema` | users, audit_logs | auth |
| `POST /api/auth/mfa/verify`, `setup`, `confirm`, `disable` | Inferido | `auth.ts` | `mfa*Schema` | users, audit_logs | auth, conta |
| `POST /api/auth/recover`, `recover/confirm`, `invite/accept` | Confirmado / inferido / confirmado | `auth.ts` | `recover*Schema`, `inviteAcceptRequestSchema` | users, audit_logs | auth |
| `PATCH /api/auth/account`, `POST /api/auth/password`, `GET`/`DELETE /api/auth/sessions` | Inferido | `auth.ts` | `accountUpdateRequestSchema`, `passwordChangeRequestSchema`, `authSessionListSchema` | users, audit_logs | conta |
| `GET`/`POST /api/companies`, `GET`/`PATCH /api/companies/:id` | Confirmado | `companies.ts` | `company*Schema` | companies, users, audit_logs | companies |
| `GET`/`POST /api/members`, `PATCH`/`DELETE /api/members/:id` | Confirmado | `members.ts` | `member*Schema` | company_members, users, audit_logs | members |
| `GET`/`POST /api/cards`, `GET`/`PATCH /api/cards/:id` | Confirmado | `cards.ts` | `card*Schema` | nfc_cards, digital_profiles, audit_logs | cards |
| `POST /api/cards/:id/{activate,deactivate,lost,block}` | Confirmado | `cards.ts` | `cardSchema` | nfc_cards, audit_logs | cards |
| `GET /api/cards/:id/history` | Inferido | `cards.ts` | `cardHistorySchema` | nfc_cards (histórico), audit_logs | cards |
| `GET`/`POST /api/profiles`, `GET`/`PATCH /api/profiles/:id` | Confirmado | `profiles.ts` | `profile*Schema` | digital_profiles, social_links, profile_themes, users | profiles, themes |
| `POST /api/uploads/sign`, `PUT /api/uploads/:fileId` | Confirmado / inferido | `uploads.ts` | `uploadSign*Schema` | Supabase Storage (quarentena e público) | profiles, companies, themes |
| `POST`/`GET /api/contact-shares` | Confirmado / inferido | `contact-shares.ts` | `contactShare*Schema` | contact_shares, analytics_events, audit_logs | contact-sending, página pública (dono) |
| `GET /api/analytics/summary` | Confirmado | `analytics.ts` | `analyticsQuerySchema`, `analyticsSummarySchema` | analytics_events, nfc_cards, companies | dashboard, analytics |
| `GET /api/audit` | Confirmado | `audit.ts` | `auditQuerySchema`, `auditPageSchema` | audit_logs | audit |
| `GET /api/public/cards/:token`, `.../contact.vcf` | Confirmado | `public.ts` | `publicCardSchema` | vista public_profiles, nfc_cards | public-card |
| `GET /api/public/profiles/:slug`, `.../contact.vcf` | Inferido | `public.ts` | `publicCardSchema` | vista public_profiles, nfc_cards | public-card (`/p/:slug`) |
| `POST /api/public/events` | Confirmado | `public.ts` | `publicEventRequestSchema` | analytics_events | public-card |

## 5. Tabelas (backend, inferido)

Do prompt mestre: `users`, `companies`, `company_members`, `digital_profiles`, `nfc_cards`, `social_links`, `profile_themes`, `contact_shares`, `analytics_events`, `audit_logs` e a vista `public_profiles`. Na API simulada correspondem a `MockDb.users` (junta users e company_members), `companies`, `profiles` (junta digital_profiles, social_links e profile_themes), `cards` (com histórico embutido), `shares`, `counters` (analytics_events agregados por cartão, dia e métrica) e `audit`. As diferenças entre o modelo simulado e as tabelas reais são decisão do backend.

## 6. Regras de dependência verificadas por ferramenta

- Página pública, `shared/api/**` e `i18n/public.ts` não importam router, TanStack Query, React Hook Form, Zod, `class-variance-authority`, `tailwind-merge`, `uqr` (estático), `@nfc-business/shared` (raiz) nem `src/app`, `src/features`, Radix, dnd-kit ou hookform (ESLint `no-restricted-imports`, ADR-0003).
- `localStorage`, `sessionStorage`, `indexedDB` e `document.cookie` são proibidos fora de `src/mocks/**` e de `src/shared/lib/theme-preference.ts` (ESLint `no-restricted-globals` e `no-restricted-properties`).
- Nenhum `dangerouslySetInnerHTML`, `innerHTML`, `document.write` nem `console` no código do frontend.

## 7. Testes a repetir quando algo muda

| Se mudar… | Repetir |
|-----------|---------|
| `packages/shared/src/schemas/*` ou `constants.ts` | `pnpm test` completo (schemas, cliente e todos os handlers) |
| `apps/web/src/mocks/handlers/http.ts` ou `domain.ts` | todos os `handlers/*.test.ts` |
| `apps/web/src/mocks/seed.ts` | todos os `handlers/*.test.ts` (as contagens dos testes dependem dos dados de demonstração) e `docs/chaves-de-demonstracao.md` |
| `apps/web/src/shared/api/*` | `client.test.ts` e, quando existirem, os testes das features |
| `endpoints.ts` | o handler correspondente, o ADR-0004 e este grafo |
