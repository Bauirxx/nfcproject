# ADR-0005 — Sessão, CSRF e renovação no cliente

- Estado: Aceite (provisório até o backend o confirmar)
- Data: 2026-11-10

## Contexto

As sessões ficam em cookies HttpOnly, que o JavaScript não lê. O frontend precisa de saber quem é o utilizador, de enviar `X-CSRF-Token` em todos os POST, PATCH e DELETE, e de lidar com um access token de 15 minutos. O prompt mestre não diz como o token CSRF chega ao cliente.

## Decisão

1. `GET /api/auth/session` devolve `{ user, csrfToken }`. Para visitantes anónimos devolve `user: null` com estado 200, para não gerar erros na consola da página pública.
2. O token CSRF fica **só em memória** (variável de módulo em `src/shared/api/csrf.ts`). Nunca vai para `localStorage`, `sessionStorage` nem cookies escritos pelo cliente.
3. Antes do primeiro pedido que altera dados, o cliente garante que tem token; se não tiver, chama `GET /api/auth/session`. Depois de login, logout e renovação, o token é pedido de novo.
4. Uma resposta 403 com código `csrf_invalid` renova o token e repete o pedido uma vez.
5. Uma resposta 401 fora de `/api/auth/*` chama `POST /api/auth/refresh` uma única vez (pedidos em simultâneo partilham a mesma renovação) e repete o pedido. Se a renovação falhar, o cliente emite o evento `unauthorized`; o painel limpa a cache de dados e vai para o login ou para a página de sessão expirada.
6. Na página pública, a sessão é consultada depois de o cartão estar no ecrã, para obter o token CSRF do evento `view` e para saber se o visitante é o dono do cartão.

## Alternativas

1. Cookie CSRF legível pelo JavaScript (double submit): funciona, mas a resposta pública tem cache de 60 segundos e não pode definir cookies por visitante.
2. Indicador de sessão em `localStorage`: evitaria um pedido por visita anónima, mas põe estado de autenticação no armazenamento do browser.
3. Endpoint `/api/auth/csrf` separado: mais um pedido no arranque do painel.

## Justificação

Um só pedido resolve as duas necessidades e mantém o armazenamento do browser livre de qualquer estado de autenticação, como exige a regra 1.

## Consequências

- Cada visita anónima à página pública faz um pedido a `/api/auth/session`. Não bloqueia a renderização. Se o backend isentar `POST /api/public/events` de token CSRF, este pedido pode ser eliminado para anónimos.
- A preferência de tema claro ou escuro é o único valor guardado em `localStorage`. Não é um token nem um segredo.
