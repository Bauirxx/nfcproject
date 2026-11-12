# ADR-0004 — Contrato de API provisório para o frontend

- Estado: Aceite (provisório até o backend o confirmar)
- Data: 2026-11-10

## Contexto

O frontend está a ser desenvolvido antes do backend, com MSW. O prompt mestre lista os «endpoints principais», mas os ecrãs pedidos precisam de mais detalhe: formato dos corpos, sub-rotas de MFA, sessão atual, conta e histórico do cartão.

## Decisão

1. Os endpoints do prompt mestre são usados tal como estão (**confirmados**).
2. O que falta é definido aqui como contrato provisório (**inferido**) e fica marcado como tal em `docs/codebase-graph.md`.
3. Os formatos vivem como schemas Zod em `packages/shared`, que o backend deve reutilizar.
4. No frontend, os caminhos estão concentrados em `apps/web/src/shared/api/endpoints.ts`. Mudar um caminho é mudar uma linha ali e outra no handler MSW.

### Convenções

- JSON com chaves em camelCase.
- Erros: `{ "error": { "code": "..." } }`. O frontend mostra uma mensagem genérica por código e nunca o texto do servidor.
- Paginação: `?page=1&pageSize=20` devolve `{ items, page, pageSize, total }`.
- 429: cabeçalho `Retry-After` em segundos e `{ "error": { "code": "rate_limited", "scope": "hour" | "day" | "company" } }`.

### Endpoints

| Método e caminho | Estado | Notas |
|------------------|--------|-------|
| `GET /api/auth/session` | Inferido | `{ user \| null, csrfToken }`. Ver ADR-0005 |
| `POST /api/auth/login` | Confirmado | `{ status: "authenticated", user }` ou `{ status: "mfa_required" }` |
| `POST /api/auth/logout` | Confirmado | 204 |
| `POST /api/auth/refresh` | Confirmado | 204 ou 401 |
| `POST /api/auth/mfa/verify` | Inferido (sub-rota de `/api/auth/mfa`) | `{ code }` ou `{ recoveryCode }` |
| `POST /api/auth/mfa/setup` | Inferido | `{ secret, otpauthUrl }` |
| `POST /api/auth/mfa/confirm` | Inferido | `{ code }` devolve `{ recoveryCodes }` |
| `POST /api/auth/mfa/disable` | Inferido | `{ password }`; recusado a administradores |
| `POST /api/auth/recover` | Confirmado | 202 sempre |
| `POST /api/auth/recover/confirm` | Inferido | `{ token, password }` |
| `POST /api/auth/invite/accept` | Confirmado | `{ token, name, password }` |
| `PATCH /api/auth/account` | Inferido | Dados pessoais |
| `POST /api/auth/password` | Inferido | `{ currentPassword, newPassword }` |
| `GET /api/auth/sessions` | Inferido | Sessões ativas |
| `DELETE /api/auth/sessions` | Inferido | Termina todas |
| `GET, POST /api/companies`; `GET, PATCH /api/companies/:id` | Confirmado (CRUD) | Só `platform_admin` |
| `GET, POST /api/members`; `PATCH, DELETE /api/members/:id` | Confirmado (CRUD) | `POST` cria o convite |
| `GET, POST /api/cards`; `GET, PATCH /api/cards/:id` | Confirmado (CRUD) | `?search&status&page&pageSize` |
| `POST /api/cards/:id/activate`, `deactivate`, `lost`, `block` | Confirmado | Devolve o cartão |
| `GET /api/cards/:id/history` | Inferido | Histórico do cartão |
| `GET, POST /api/profiles`; `GET, PATCH /api/profiles/:id` | Confirmado (CRUD) | O tema faz parte do perfil |
| `POST /api/uploads/sign` | Confirmado | Devolve `{ fileId, uploadUrl }`; `uploadUrl` tem de ser um caminho `/api/` na mesma origem |
| `PUT <uploadUrl>` | Inferido | Envio do ficheiro |
| `POST /api/contact-shares` | Confirmado | Regista o envio em todos os canais |
| `GET /api/contact-shares` | Inferido | Histórico com destinatário mascarado |
| `GET /api/analytics/summary` | Confirmado | `?from&to&cardId&companyId`; totais, série diária e totais por cartão |
| `GET /api/audit` | Confirmado | `?action&actor&from&to&page&pageSize` |
| `GET /api/public/cards/:token` | Confirmado | Só campos públicos |
| `GET /api/public/cards/:token/contact.vcf` | Confirmado | Descarregado por link |
| `POST /api/public/events` | Confirmado | `{ type, token }` ou `{ type, slug }` |
| `GET /api/public/profiles/:slug` e `.../contact.vcf` | Inferido | Só para a rota opcional `/p/:slug` |

## Alternativas

1. Esperar pelo backend: bloquearia todo o frontend.
2. Perguntar cada sub-rota ao dono do produto: são decisões de desenho do backend que ainda não existem.

## Justificação

O prompt do frontend manda usar MSW «enquanto o backend não estiver pronto». Separar o confirmado do inferido mantém a rastreabilidade pedida pelo grafo e limita o custo de mudança a dois ficheiros por endpoint.

## Consequências

- O backend deve confirmar ou corrigir cada linha «Inferido». Cada correção atualiza este ADR, o grafo, `endpoints.ts` e o handler MSW.
- O prompt mestre descreve o corpo de `POST /api/contact-shares` com `profile_id`; aqui usa-se `profileId`, por coerência com camelCase. Se o backend preferir snake_case, a mudança faz-se nos schemas partilhados.
- As transições de estado dos cartões assumidas na interface (`blocked` é terminal; `lost` pode voltar a `active`) precisam de confirmação.

## Complemento de 2026-11-12 — códigos de erro usados pela API simulada

A API simulada (ADR-0009) responde com estes códigos; o backend deve confirmá-los ou corrigi-los, porque a interface os traduz em mensagens.

| Situação | Estado e código |
|----------|-----------------|
| Sem sessão ou access token expirado | 401 `unauthenticated` |
| Credenciais erradas, email desconhecido ou convite por aceitar | 401 `invalid_credentials` |
| Segundo passo sem desafio pendente / código TOTP ou de recuperação errado | 401 `mfa_challenge_expired` / 401 `invalid_code` |
| Token CSRF ausente ou errado | 403 `csrf_invalid` |
| Administrador sem MFA configurado / sem permissão do papel | 403 `mfa_setup_required` / 403 `forbidden` |
| Recurso de outra empresa, fora da posse ou inexistente | 404 `not_found` (sempre o mesmo) |
| Corpo que não é JSON ou query inválida | 400 `invalid_request` |
| Link de recuperação ou convite inválido, expirado ou já usado | 400 `invalid_token` |
| Corpo fora do schema ou com campos desconhecidos | 422 `validation_failed` |
| Palavra-passe exposta em fugas de dados / palavra-passe atual errada | 422 `weak_password` / 422 `invalid_current_password` |
| Upload: identificador inválido ou tamanho diferente do anunciado / acima de 2 MB / tipo não confirmado pelos magic bytes | 422 `invalid_file` / 413 `file_too_large` / 415 `unsupported_file_type` |
| MFA: já ativo, sem configuração iniciada, não ativo, obrigatório para o papel | 409 `mfa_already_enabled`, 409 `mfa_not_pending`, 409 `mfa_not_enabled`, 403 `mfa_required_for_role` |
| Email que já tem conta / o próprio a mudar o seu papel ou a remover-se | 409 `already_member` / 409 `cannot_change_self` |
| Transição de estado do cartão não permitida / ativar ou desassociar sem perfil | 409 `invalid_transition` / 409 `card_without_profile` |
| Envio para perfil sem cartão ativo | 409 `profile_without_card` |
| Limites: login e recuperação (5 por minuto por email), segundo passo (5 por minuto), envios (10 por hora, 50 por dia) | 429 `rate_limited`, com `Retry-After` e, nos envios, `scope` `hour` ou `day` |

Outros comportamentos simulados a confirmar: `POST /api/auth/recover` responde 202 sem corpo; `invite/accept` responde 204 sem iniciar sessão; `DELETE /api/auth/sessions` termina também a sessão atual; `POST /api/uploads/sign` responde 200 e o `PUT` do ficheiro 204; `POST /api/contact-shares` responde 201 com o envio já mascarado; os eventos públicos respondem sempre 204; a página pública envia `Cache-Control: public, max-age=60`; o VCF é `text/vcard; charset=utf-8` com `Content-Disposition: attachment; filename="<slug>.vcf"`.
