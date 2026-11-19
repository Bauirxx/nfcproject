# NFC Business — Requisitos

Fonte dos requisitos: `CLAUDE.md` (prompt mestre) e `docs/prompts/FRONTEND.md`. Nenhum requisito é inventado: cada linha indica a origem. Os pressupostos assumidos onde a fonte é omissa estão em [Pressupostos](#pressupostos) e precisam de confirmação.

Estados das tarefas: Não iniciada, Planeada, Em desenvolvimento, Em revisão, Em testes, Bloqueada, Concluída, Cancelada. O progresso conta-se por tarefas e critérios verificados (ver `PROJECT_STATE.md`).

Âmbito: **frontend** (`apps/web` e `packages/shared`) e, desde 2026-11-13, o **backend** (`apps/api`) — ver [Requisitos do backend](#requisitos-do-backend). O frontend continua sobre a API simulada (MSW) até existirem endpoints reais.

## Requisitos funcionais do frontend

| ID | Requisito | Módulo | Origem | Tarefas | Testes |
|----|-----------|--------|--------|---------|--------|
| RF-FE-01 | Página pública do cartão em `/c/:token` (e `/p/:slug`) | public-card | FRONTEND «Página pública» | T-FE-10 | `PublicCardPage.test.tsx`, e2e `04-public-card` |
| RF-FE-02 | Cartão indisponível mostra página neutra, sem motivo | public-card | FRONTEND «Página pública»; CLAUDE regra 4 | T-FE-10 | `PublicCardPage.test.tsx`, e2e `04-public-card` |
| RF-FE-03 | Login com verificação MFA | auth | FRONTEND «Autenticação»; CLAUDE regra 1 | T-FE-06 | `LoginPage.test.tsx`, `MfaVerifyPage.test.tsx`, e2e `01-login-mfa` |
| RF-FE-04 | Configuração de MFA: QR TOTP e códigos de recuperação | auth | FRONTEND «Autenticação»; CLAUDE regra 1 | T-FE-07 | `MfaSetupPage.test.tsx` |
| RF-FE-05 | Recuperar password e definir nova password | auth | FRONTEND «Autenticação»; CLAUDE regra 1 | T-FE-08 | `RecoverPasswordPage.test.tsx`, `ResetPasswordPage.test.tsx` |
| RF-FE-06 | Aceitar convite | auth | FRONTEND «Autenticação»; CLAUDE regra 1 | T-FE-09 | `AcceptInvitePage.test.tsx` |
| RF-FE-07 | Dashboard com resumo e atalhos | analytics | FRONTEND «Dashboard» | T-FE-21 | `DashboardPage.test.tsx` |
| RF-FE-08 | Empresas: listar, criar, editar, logótipo, identidade visual | companies | FRONTEND «Empresas» | T-FE-19 | `CompaniesPage.test.tsx`, `CompanyForm.test.tsx` |
| RF-FE-09 | Membros: listar, convidar, alterar papel, remover | members | FRONTEND «Membros» | T-FE-20 | `MembersPage.test.tsx` |
| RF-FE-10 | Cartões: lista com pesquisa, filtros, paginação; criar e associar a perfil | cards | FRONTEND «Cartões» | T-FE-12 | `CardsPage.test.tsx`, e2e `02-create-activate-card` |
| RF-FE-11 | Cartões: mudanças de estado com confirmação, URL do chip, QR em PNG e SVG, histórico | cards | FRONTEND «Cartões»; CLAUDE regra 4 | T-FE-13 | `CardDetailPage.test.tsx`, `qr.test.ts`, e2e `02-create-activate-card` |
| RF-FE-12 | Perfis: lista e editor com pré-visualização em tempo real | profiles | FRONTEND «Perfis» | T-FE-14 | `ProfileEditorPage.test.tsx`, e2e `03-edit-profile` |
| RF-FE-13 | Perfis: ordem por drag-and-drop, visibilidade por campo, fotografia com recorte | profiles | FRONTEND «Perfis»; CLAUDE regra 8 | T-FE-15, T-FE-16 | `SortableList.test.tsx`, `image-validation.test.ts`, `PhotoCropDialog.test.tsx` |
| RF-FE-14 | Enviar contacto: formulário curto, canais Email, WhatsApp e SMS, pré-visualização | contact-sending | FRONTEND «Enviar contacto»; CLAUDE «Módulo de envio» | T-FE-17 | `SendContactForm.test.tsx`, `message.test.ts`, e2e `05-send-contact` |
| RF-FE-15 | Histórico de envios com destinatário mascarado e mensagens de limite | contact-sending | FRONTEND «Enviar contacto»; CLAUDE regra 5 | T-FE-18 | `ContactHistory.test.tsx`, e2e `05-send-contact` |
| RF-FE-16 | Botão «Enviar o meu contacto» na página pública só para o dono com sessão | public-card, contact-sending | FRONTEND «Página pública»; CLAUDE «Módulo de envio» | T-FE-11 | `PublicCardPage.test.tsx` |
| RF-FE-17 | Temas: modelos, cores com verificação de contraste, logótipo, pré-visualização | themes | FRONTEND «Temas» | T-FE-23 | `theme-editor.test.tsx`, `themes-page.test.tsx`, `contrast.test.ts` |
| RF-FE-18 | Estatísticas: gráficos por período, cartão e empresa; exportação CSV | analytics | FRONTEND «Estatísticas» | T-FE-22 | `AnalyticsPage.test.tsx`, `csv.test.ts` |
| RF-FE-19 | Auditoria: tabela filtrável (administradores) | audit | FRONTEND «Auditoria» | T-FE-24 | `AuditPage.test.tsx` |
| RF-FE-20 | Conta: dados pessoais, password, MFA, sessões ativas e terminar todas | auth | FRONTEND «Conta» | T-FE-25 | `account-page.test.tsx` |
| RF-FE-21 | Páginas 403, 404, 500 e sessão expirada | app | FRONTEND «Páginas de erro» | T-FE-05 | `ErrorPages.test.tsx` |
| RF-FE-22 | Menu e ações por papel; tratamento central de 401, 403 e 429 | app, shared | FRONTEND «Permissões na interface» | T-FE-03, T-FE-05 | `client.test.ts`, `permissions.test.ts`, `AppLayout.test.tsx` |

### Critérios de aceitação

**RF-FE-01** — Mostra fotografia, nome, cargo, empresa e descrição; botões Guardar contacto (VCF), Ligar, WhatsApp, Email, Website e Localização apenas para os campos públicos existentes; redes sociais; botão para partilhar ou mostrar o QR Code; aplica o tema do perfil; regista os eventos `view`, `whatsapp_click`, `email_click` e `vcf_download` pela lista fechada; `/p/:slug` mostra o mesmo conteúdo.

**RF-FE-02** — Qualquer resposta que não seja um cartão ativo (404, erro, token mal formado) mostra a mesma página neutra, com o mesmo texto e sem indicar o motivo.

**RF-FE-03** — Email e password validados; erro de credenciais com mensagem genérica; quando a API pede MFA, pede o código TOTP de 6 dígitos ou um código de recuperação; 429 informa o limite; depois de autenticado, vai para o destino pedido (só caminhos internos).

**RF-FE-04** — Mostra o QR TOTP gerado localmente e a chave manual; confirma com um código; mostra os códigos de recuperação uma única vez, com cópia e confirmação de que foram guardados; administradores sem MFA não entram no painel sem o configurar.

**RF-FE-05** — O pedido de recuperação responde sempre com a mesma mensagem, exista ou não a conta; a nova password exige 12 caracteres e confirmação; um link inválido ou expirado mostra mensagem genérica; depois de definir, encaminha para o login.

**RF-FE-06** — Com o token do convite, o utilizador define nome e password; token inválido mostra mensagem genérica.

**RF-FE-07** — Totais de visitas, cliques, downloads de VCF e contactos enviados; atalhos conforme o papel; «Enviar contacto» em destaque para `profile_owner`.

**RF-FE-08** — Só `platform_admin` vê e acede; lista, criação e edição com validação; upload de logótipo validado; cores da identidade visual.

**RF-FE-09** — Só `company_admin` vê e acede; convite por email com papel; alteração de papel; remoção com confirmação.

**RF-FE-10** — Pesquisa por texto, filtro por estado e paginação refletem-se no pedido à API; criação de cartão com etiqueta e perfil opcional; associação a um perfil.

**RF-FE-11** — Ativar, desativar, marcar como perdido e bloquear pedem confirmação; mostra e copia o URL do chip; descarrega o QR em PNG e SVG gerados localmente; mostra o histórico do cartão.

**RF-FE-12** — Lista de perfis; o editor atualiza a pré-visualização em formato telemóvel a cada alteração, antes de guardar; guarda pela API com validação.

**RF-FE-13** — Contactos e redes sociais reordenáveis por arrastar, por teclado e por botões (alternativa sem arrastar, WCAG 2.5.7); interruptor de visibilidade pública por campo; fotografia aceita só JPEG, PNG e WebP até 2 MB, com dimensões validadas e recorte antes do envio.

**RF-FE-14** — Perfil pré-selecionado quando só há um; nome opcional; telefone em E.164 com `+258` por defeito, ou email; canal Email, WhatsApp ou SMS; nota até 200 caracteres, sem links nem HTML; pré-visualização da mensagem antes de enviar; Email envia pela API e confirma; WhatsApp abre `wa.me`; SMS abre `sms:`; todos os envios passam por `POST /api/contact-shares`.

**RF-FE-15** — Histórico com destinatário mascarado, data e canal; resposta 429 mostra mensagem clara de limite atingido.

**RF-FE-16** — O botão só aparece quando há sessão e o utilizador é o dono do perfil do cartão; visitantes anónimos nunca o veem.

**RF-FE-17** — Escolha de modelo; cores com verificação de contraste WCAG AA e bloqueio de gravação quando falha; logótipo; pré-visualização.

**RF-FE-18** — Gráficos de visitas, cliques, VCF e contactos enviados por período; filtro por cartão e, para `platform_admin`, por empresa; exportação CSV protegida contra injeção de fórmulas.

**RF-FE-19** — Só administradores; tabela paginada com filtros por ação, autor e datas.

**RF-FE-20** — Edição de dados pessoais; alteração de password com a atual; ativar MFA; lista de sessões e terminar todas.

**RF-FE-21** — Cada página tem título, explicação e ação de saída; a de sessão expirada leva ao login.

**RF-FE-22** — O menu mostra só as entradas do papel; rotas sem permissão mostram 403; 401 tenta renovar a sessão uma vez e depois redireciona para o login; 403 e 429 mostram mensagem clara.

## Requisitos não funcionais do frontend

| ID | Requisito | Origem | Verificação |
|----|-----------|--------|-------------|
| RNF-FE-01 | Segurança no frontend (lista abaixo) | FRONTEND «Segurança no frontend»; CLAUDE regras 1, 4, 5, 7, 8, 9 | ESLint, `client.test.ts`, `links.test.ts`, e2e com CSP |
| RNF-FE-02 | Página pública: JavaScript inicial abaixo de 100 KB comprimido; painel em lazy; carregamento abaixo de 1,5 s em 4G | FRONTEND «Design e qualidade» | `pnpm --filter @nfc-business/web check:bundle` |
| RNF-FE-03 | WCAG 2.2 AA: contraste, teclado, foco visível, labels, textos alternativos | FRONTEND «Design e qualidade» | axe em testes de componentes e em Playwright |
| RNF-FE-04 | Estados de carregamento, vazio e erro em todos os ecrãs com dados | FRONTEND «Design e qualidade» | testes de componentes |
| RNF-FE-05 | Interface em português, com textos centralizados | FRONTEND «Design e qualidade» | revisão: textos em `src/shared/i18n` |
| RNF-FE-06 | Funciona a partir de 360 px, em Android e iPhone | FRONTEND «Design e qualidade» | Playwright com viewport de 360 px |
| RNF-FE-07 | Tailwind e shadcn/ui; modo claro e escuro no painel | FRONTEND «Design e qualidade» | `ThemeToggle.test.tsx`, axe nos dois modos |
| RNF-FE-08 | Código por funcionalidade; MSW segue os endpoints do prompt mestre | FRONTEND «Estrutura e testes» | `docs/codebase-graph.md` |
| RNF-FE-09 | Vitest, Testing Library, axe e Playwright nos cinco fluxos principais | FRONTEND «Estrutura e testes» | execução das suites |

### Critérios de RNF-FE-01

1. Todas as chamadas vão para `/api` na mesma origem, com `credentials: 'include'`.
2. Não há tokens, chaves nem segredos no código, em variáveis `VITE_` ou no armazenamento do browser.
3. `X-CSRF-Token` em todos os POST, PATCH e DELETE.
4. `dangerouslySetInnerHTML` proibido pela regra `react/no-danger`.
5. Compatível com CSP estrita: sem scripts nem estilos inline, sem CDNs, fontes e ícones locais, QR Code local.
6. Links externos só em `https`, com `rel="noopener noreferrer"`.
7. Links `wa.me` e `sms:` construídos a partir de dados validados.
8. Schemas Zod partilhados com o backend (`packages/shared`).
9. Uploads validados no cliente: tipo, 2 MB e dimensões; SVG rejeitado.
10. Mensagens de erro genéricas.
11. Sem dados pessoais em logs nem em ferramentas de terceiros.
12. Dev server do Vite só em `127.0.0.1`.

## Tarefas

| ID | Tarefa | Passo | Requisitos | Estado |
|----|--------|-------|------------|--------|
| T-FE-01 | Workspace, ferramentas e configuração | 1 | RNF-FE-01, RNF-FE-08 | Em desenvolvimento |
| T-FE-02 | Pacote partilhado: schemas, validadores, links, permissões | 1 | RNF-FE-01, RF-FE-22 | Concluída |
| T-FE-03 | Cliente da API: credenciais, CSRF, renovação, 401/403/429 | 1 | RF-FE-22, RNF-FE-01 | Em revisão |
| T-FE-04 | API simulada com MSW | 1 | RNF-FE-08 | Em revisão |
| T-FE-05 | Casca da aplicação: routing, layout, menu por papel, tema, erros, i18n, componentes | 1 | RF-FE-21, RF-FE-22, RNF-FE-03 a 07 | Planeada |
| T-FE-06 | Login e verificação MFA | 2 | RF-FE-03 | Planeada |
| T-FE-07 | Configuração de MFA | 2 | RF-FE-04 | Planeada |
| T-FE-08 | Recuperar e definir password | 2 | RF-FE-05 | Planeada |
| T-FE-09 | Aceitar convite | 2 | RF-FE-06 | Planeada |
| T-FE-10 | Página pública do cartão | 3 | RF-FE-01, RF-FE-02, RNF-FE-02 | Planeada |
| T-FE-11 | «Enviar o meu contacto» na página pública | 5 | RF-FE-16 | Planeada |
| T-FE-12 | Cartões: lista, criação e associação | 4 | RF-FE-10 | Planeada |
| T-FE-13 | Cartões: estados, URL do chip, QR, histórico | 4 | RF-FE-11 | Planeada |
| T-FE-14 | Perfis: lista e editor com pré-visualização | 4 | RF-FE-12 | Planeada |
| T-FE-15 | Perfis: ordenação e visibilidade | 4 | RF-FE-13 | Planeada |
| T-FE-16 | Perfis: fotografia com recorte e validação | 4 | RF-FE-13 | Planeada |
| T-FE-17 | Enviar contacto: formulário, canais, pré-visualização | 5 | RF-FE-14 | Planeada |
| T-FE-18 | Histórico de envios e limites | 5 | RF-FE-15 | Planeada |
| T-FE-19 | Empresas | 6 | RF-FE-08 | Planeada |
| T-FE-20 | Membros | 6 | RF-FE-09 | Planeada |
| T-FE-21 | Dashboard | 7 | RF-FE-07 | Planeada |
| T-FE-22 | Estatísticas e CSV | 7 | RF-FE-18 | Planeada |
| T-FE-23 | Temas e personalização | 7 | RF-FE-17 | Concluída |
| T-FE-24 | Auditoria | 7 | RF-FE-19 | Concluída |
| T-FE-25 | Conta | 8 | RF-FE-20 | Concluída |
| T-FE-26 | Suite de testes de componentes e acessibilidade | 9 | RNF-FE-03, RNF-FE-09 | Planeada |
| T-FE-27 | Playwright: cinco fluxos, CSP e 360 px | 9 | RNF-FE-01, RNF-FE-06, RNF-FE-09 | Planeada |
| T-FE-28 | Verificação do orçamento de JavaScript | 9 | RNF-FE-02 | Concluída |

## Requisitos do backend

Fonte: `CLAUDE.md` (arquitetura, endpoints, regras de segurança e fases). O backend é um monólito modular em NestJS 11 (adaptador Express), a única parte que fala com o Supabase e o email. Decisões de fundação no ADR-0010.

| ID | Tarefa | Fase | Estado |
|----|--------|------|--------|
| T-BE-01 | Fundação: pacote `apps/api`, segurança (helmet, CORS fechado, cabeçalhos), guard global negar-por-defeito com `@Public()`, filtro de erros no formato do contrato, validação do ambiente, health público | 1 | Em desenvolvimento |
| T-BE-02 | Supabase: projeto, schema `app`, RLS, papel `app_backend`, ligação do `SessionService` ao Supabase Auth e login BFF por cookies | 1 | Bloqueada (precisa de credenciais do dono do produto) |
| T-BE-03 | `ValidationPipe` global com os schemas Zod partilhados; empacotamento executável do backend | 1 | Não iniciada |
| T-BE-05 | Página pública no backend real: cartão e VCF por token e slug, eventos públicos (rate limit 60/min por IP, cache 60 s, noindex, 404 neutro, IP só como hash, deduplicação de 30 min). ADR-0014. Testes: `public/*.test.ts`, `common/{rate-limiter,ip-hash}.test.ts` e o teste de integração de `public_cards` | 3 | Em revisão (falta confirmar `TRUST_PROXY_HOPS` depois do deploy) |
| T-BE-06 | CI de segurança (regras 9 e 10): gitleaks no histórico e no pre-commit, `pnpm audit`, osv-scanner, Semgrep com regras próprias, testes e builds, SBOM com syft; Actions fixadas por hash, ferramentas por checksum, permissões mínimas; Dependabot com 7 dias. ADR-0020, `docs/ci.md`. Critérios: (1) cada ferramenta corre em local sem resultados; (2) as regras próprias disparam em exemplos com erro; (3) o primeiro run no GitHub passa os cinco jobs | 4 | Concluída (2026-11-19: os três critérios verificados; run do commit `f43ab2c` verde) |
| T-BE-08 | Logs JSON com `request_id` e alertas (regra 11): logger JSON global, `X-Request-Id`, log de acesso com a rota padrão (sem tokens nem query string), alertas `server_error`, `contact_spike`, `contact_rate_limited` e `auth_rate_limited` no log e por email (`ALERT_EMAIL_TO`). ADR-0021. Testes: `common/observability.test.ts` (9). Critérios: (1) todas as linhas em JSON e com `request_id` dentro do pedido; (2) nenhum token nem query string no log; (3) cada regra de alerta dispara e repete no máximo uma vez em 15 min; (4) o servidor empacotado arranca e regista em JSON | 4 | Concluída (2026-11-19: os quatro critérios verificados, o 4.º com o `dist/server.cjs` em local) |
| T-BE-09 | Cópias de segurança (regra 11), com exceção temporária no plano Free (ADR-0022): `scripts/backup/backup-db.ps1` (pg_dump de `app` e `auth` cifrado com gpg, sem cópia em claro no disco) e `restore-db.ps1` (num projeto de teste, recusa a produção), procedimento em `docs/backup.md`. Critérios: (1) scripts sem erros de sintaxe e proteções a funcionar; (2) primeira cópia feita pelo dono; (3) primeiro teste de restauro num projeto separado com as contagens iguais | 4 | Em testes (critério 1 verificado; 2 e 3 dependem do dono: PostgreSQL 17 command line tools e a palavra-passe da base de dados) |
| T-BE-10 | Plano de resposta a incidentes (regra 11, «escrito antes do lançamento»): `docs/incident-response.md` com gravidade, fases, interruptores de emergência, 9 cenários (segredo exposto com tabela de rotação, conta comprometida, fuga de dados, abuso do envio, vulnerabilidade, indisponibilidade, perda de dados, força bruta, cartão perdido), comunicação e registo/revisão. Critérios: (1) cada ação referida existe no sistema (verificado: transições dos cartões, remoção de membros, efeitos da rotação do `IP_HASH_SECRET`); (2) o dono preenche os contactos (secção 1); (3) primeira simulação de mesa antes da fase 5 | 4 | Em revisão (critério 1 verificado; 2 e 3 dependem do dono) |
| T-BE-11 | Testes de isolamento entre empresas (regra 2; critério de saída da fase 2): `common/isolation.integration.test.ts` (15 testes) — RLS sozinha nas 8 tabelas por empresa (consultas sem filtro no contexto da A não veem a B; escritas sobre a B afetam 0 linhas; inserir na B é recusado), membros (lista só da própria empresa; mudar papel/remover da B dá 404 sem chamar o Supabase Auth), empresas (company_admin recebe 403 pelo papel) e uploads (B não envia nem consome ficheiros da A). Junta-se a `panel`, `cards`, `profiles` e `contact-sending`. Critério: suíte de integração completa a passar contra o Supabase real | 2 | Concluída (2026-11-19: 158/158 com `DB_INTEGRATION=1`) |
| T-BE-07 | OWASP ZAP em staging e aprovação manual para produção (regra 10; critério de saída da fase 4: ZAP sem alertas altos) | 4 | Bloqueada (não há ambiente de staging nem projeto Supabase de staging) |
| T-BE-04+ | Módulos de domínio (empresas, membros, cartões, perfis, partilha, envio, estatísticas, temas, auditoria) sobre o contrato do ADR-0004 | 2–3 | Não iniciada |

Critério de saída da fase 1 (CLAUDE.md): nenhum endpoint responde sem autenticação, exceto os `@Public()`. O guard global já o garante; falta a autenticação real (T-BE-02).

### Modelação de ameaças (STRIDE) da página pública (T-BE-05)

| Ameaça | Risco | Mitigação |
|--------|-------|-----------|
| Spoofing | Adivinhar tokens para descobrir cartões | Tokens de 128 bits aleatórios; 60 pedidos/min por IP; o mesmo 404 para tudo |
| Tampering | Inflacionar estatísticas | Lista fechada de eventos; deduplicação de 30 min por cartão, tipo e hash do IP; empresa resolvida no servidor |
| Repudiation | — | Eventos com data; o `contact_sent` só é registado pelo backend |
| Information disclosure | Expor campos privados ou o estado do cartão | Vista `public_cards` (só ativos e campos públicos); `toPublicCard` filtra e valida; o `company_id` não sai; 404 neutro sem cache |
| Denial of service | Inundar a página ou a base de dados | Rate limit; cache de 60 s; entradas mal formadas recusadas sem consultar a base de dados; `statement_timeout` de 10 s |
| Elevation of privilege | Ler outras empresas pela página pública | Leitura sem contexto só pela vista; RLS nas tabelas; `app_backend` sem BYPASSRLS |

## Pressupostos

Pontos em que as fontes são omissas. Foram assumidos para não bloquear o trabalho e ficam à espera de confirmação.

| ID | Pressuposto | Impacto se mudar |
|----|-------------|------------------|
| P-01 | Os endpoints não listados em «Endpoints principais» (sessão, CSRF, sub-rotas de MFA, conta, histórico do cartão) seguem o contrato provisório do ADR-0004 | Ajuste em `src/shared/api` e em `src/mocks` |
| P-02 | O tema é parte do recurso perfil e grava-se por `PATCH /api/profiles/:id` | Ajuste em `features/themes` |
| P-03 | Temas são geridos por `company_admin` e `company_editor`; o `profile_owner` edita o seu perfil mas não o tema | Uma linha na matriz de permissões |
| P-04 | O `profile_owner` não vê a lista de cartões; envia o contacto a partir do seu perfil | Uma linha na matriz de permissões |
| P-05 | O nome do perfil é sempre público; os restantes campos têm interruptor de visibilidade | Schema do perfil |
| P-06 | O `platform_admin` não tem empresa na sessão e não gere cartões, perfis nem membros | Matriz de permissões |
| P-07 | A interface não inclui eliminar empresas, cartões nem perfis, por não constar do prompt do frontend | Novos ecrãs |
| P-08 | Não foram encontrados ecrãs exportados do Google Stitch; o design segue shadcn/ui sóbrio | Revisão visual |
| P-09 | O primeiro administrador de uma empresa é convidado pelo `adminEmail` de `POST /api/companies`; não há registo público | Schema de criação de empresa e handler |
| P-10 | O dono de um perfil é atribuído por `ownerUserId`, só por `company_admin` (permissão `profiles.assignOwner`) | Matriz de permissões e editor de perfil |
| P-11 | Um cartão só pode ser ativado com perfil associado, e o perfil não pode ser desassociado de um cartão ativo | Ações do cartão e handler |
