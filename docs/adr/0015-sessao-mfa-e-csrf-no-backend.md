# ADR-0015: Sessão no contrato, MFA obrigatório e CSRF aplicados no backend

- Estado: Aceite
- Data: 2026-11-18
- Relacionados: ADR-0005 (sessão, CSRF e renovação), ADR-0011 (Supabase Auth); CLAUDE.md, regras 1, 2 e 7

## Contexto

No primeiro teste do site publicado (2026-11-18), o login com a password certa mostrou um erro, mas o painel abriu depois com "Olá, undefined". A investigação mostrou três falhas:

1. O backend devolvia um utilizador fora do contrato `sessionUserSchema`: faltavam `name`, `companyName`, `mfaEnabled` e `mfaRequired`, e a sessão não trazia `csrfToken`. A resposta do login falhava a validação no frontend, embora os cookies de sessão já tivessem sido gravados.
2. O frontend carregava a sessão sem a validar e mostrava o painel com dados incompletos.
3. O backend não aplicava o MFA obrigatório para administradores (regra 1) nem a proteção CSRF por cabeçalho e Origin (regra 7).

Não houve acesso sem credenciais: a sessão era de um login real com a password certa. Mesmo assim, as falhas 2 e 3 são de segurança.

## Decisão

1. **Sessão no contrato.**
   - O `SessionService` monta o utilizador completo: o nome vem do `user_metadata` ou, na falta dele, da parte local do email; o nome da empresa é lido de `app.companies` com o contexto RLS da própria empresa.
   - O `mfaEnabled` exige um fator TOTP verificado no Supabase; o `mfaRequired` vem de `MFA_REQUIRED_ROLES`.
   - Papéis desconhecidos não dão sessão.
   - O login e a sessão são testados contra os schemas partilhados.
2. **MFA aplicado no servidor.**
   - Com MFA ativo e o token em `aal1`, não há sessão: `GET /session` devolve `user: null`, o login devolve `mfa_required` e o guard responde 401.
   - Um administrador sem MFA configurado tem sessão, mas o guard só o deixa chegar às rotas `@AllowWithoutMfa()` (configurar o MFA); as outras dão 403 `mfa_setup_required`.
   - O `aal` lê-se do access token depois de o Supabase o validar e, em caso de dúvida, conta como `aal1`.
3. **CSRF.**
   - Um `CsrfGuard` global, que corre antes do `AuthGuard`, verifica todos os pedidos que alteram dados:
     - `X-CSRF-Token` igual a um HMAC do access token do cookie (ou de "anonymous"), comparado em tempo constante;
     - quando `PUBLIC_APP_URL` está definido, `Origin` igual a ele.
   - O token é devolvido em `GET /api/auth/session` (com `Cache-Control: no-store`) e muda com a sessão. Quando ele muda, o cliente renova-o com o `csrf_invalid` (ADR-0005).
   - O segredo é o `IP_HASH_SECRET`, com um prefixo próprio (`csrf:`) para separar os usos.
4. **Frontend: falha fechada.** O `loadSession` valida o utilizador com uma guarda de tipos sem Zod (o bundle público não leva Zod). Um utilizador fora do contrato conta como "sem sessão".

## Alternativas

- **Token CSRF aleatório guardado num cookie (double submit).** Rejeitado: obriga a mais um cookie, e o HMAC ligado à sessão não precisa de estado.
- **Bloquear o login de administradores sem MFA.** Rejeitado: impedia que configurassem o MFA. Optou-se por uma sessão limitada à configuração.
- **Segredo CSRF próprio.** Adiado: obrigaria a mais uma variável no Render. A separação por prefixo chega por agora.

## Consequências

- Os administradores sem MFA ficam limitados ao ecrã de configuração até existirem `POST /api/auth/mfa/setup`, `confirm` e `verify` no backend (próxima tarefa). É intencional: a regra 1 torna o MFA obrigatório.
- Em produção, o `PUBLIC_APP_URL` deve estar definido para a verificação de Origin ficar ativa.
- A mudança do token CSRF ao fazer login custa um pedido extra (o retry do `csrf_invalid`).
