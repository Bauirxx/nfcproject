# ADR-0016: MFA por TOTP do Supabase, sem códigos de recuperação na v1

- Estado: Aceite (decisão do dono do produto, 2026-11-18)
- Data: 2026-11-18
- Relacionados: ADR-0011 (Supabase Auth), ADR-0015 (MFA aplicado no servidor); CLAUDE.md, regras 1 e 3

## Contexto

O MFA TOTP é obrigatório para os administradores (regra 1). O frontend previa códigos de recuperação de uso único, mas o MFA do Supabase não os tem. Para os implementar havia duas hipóteses:
- usar a chave `service_role` em runtime, para apagar o fator com um código de recuperação, o que a regra 3 proíbe;
- criar uma camada de sessão própria por cima do Supabase, com mais código e mais superfície de ataque.

## Decisão

1. **TOTP do Supabase, na sessão do próprio utilizador.** As operações correm sempre com a sessão do utilizador (tokens dos cookies, `setSession`) e nunca com `service_role`:
   - `POST /api/auth/mfa/setup` (`@AllowWithoutMfa`): remove fatores TOTP por confirmar e cria um novo. Devolve o segredo e o URI otpauth.
   - `POST /api/auth/mfa/confirm` (`@AllowWithoutMfa`): `challengeAndVerify` do fator pendente. A sessão sobe a aal2, os cookies são regravados e fica registado `auth.mfa_enabled`. Devolve `{ user }`.
   - `POST /api/auth/mfa/verify` (`@Public`, porque uma sessão aal1 com MFA ativo não é sessão): `challengeAndVerify` do fator verificado. Sobe a aal2, regista `auth.login` (ou `auth.login_failed`) e devolve `{ user }`.
   - `POST /api/auth/mfa/disable`: só para papéis que não exigem MFA. Confirma a palavra-passe e remove o fator (o Supabase exige aal2).
2. **Limites.** 5 códigos por minuto por utilizador e por IP. O login também passa a ter 5 tentativas por minuto por IP e por email (regra 1), com a mensagem genérica `invalid_credentials` e auditoria do login falhado (só com o email tentado).
3. **Sem códigos de recuperação.**
   - Quem perde a aplicação de autenticação pede a um administrador que reponha o MFA. Para o próprio platform_admin, a reposição faz-se no painel do Supabase (Authentication → Users → o utilizador → remover o fator).
   - O contrato mudou: `mfaVerifyRequestSchema` só aceita `{ code }` e `mfaConfirmResponseSchema` passou a `{ user }`.
   - O frontend mostra uma nota sobre a reposição em vez dos códigos.
   - A API simulada e os testes acompanham o contrato.

## Alternativas

- **Códigos de recuperação com `service_role`.** Rejeitado: contraria a regra 3.
- **Sessão própria com códigos de recuperação.** Rejeitado na v1: complexidade e risco desproporcionados.

## Consequências

- A reposição do MFA de um membro por um administrador da empresa precisa de um endpoint próprio, que fica pendente no módulo de membros. Remover o fator de outro utilizador exige a API de administração do Supabase, que está ligada à `service_role` e à regra 3. Até haver uma solução aprovada, a reposição faz-se no painel do Supabase pelo dono da plataforma.
- Os limites de tentativas estão em memória (ADR-0014) e recomeçam quando o serviço reinicia.
