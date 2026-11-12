# ADR-0009 — Estratégia de testes e API simulada

- Estado: Aceite
- Data: 2026-11-12

## Contexto

O frontend é desenvolvido antes do backend (ADR-0004). Precisa de uma API que responda aos endpoints do contrato em desenvolvimento, nos testes de componentes (Vitest com jsdom) e nos testes de ponta a ponta (Playwright), sem que nada disso entre no build de produção nem relaxe as regras de segurança: CSP estrita (ADR-0006) e nada no armazenamento do browser além da preferência de tema (CLAUDE.md, regra 1).

## Decisão

1. **MSW (Mock Service Worker) com uma única definição de handlers**, em `apps/web/src/mocks/handlers`, um ficheiro por módulo (auth, uploads, companies, members, cards, profiles, contact-shares, analytics, audit, public), reunidos em `handlers/index.ts`. O último handler responde 404 a qualquer `/api/*` desconhecido: com a simulação ativa, nenhum pedido do frontend sai para a rede.
2. **Os handlers validam como o backend validará**: schemas Zod partilhados (`packages/shared`), recusa de campos desconhecidos (o equivalente a `forbidNonWhitelisted`), token CSRF em tudo o que não seja GET, sessão com access token de 15 minutos, MFA obrigatório para administradores, permissões por papel, posse por empresa (404 para recursos de outra empresa) e limites de tentativas e de envios. Os ecrãs são assim desenvolvidos contra as mesmas respostas de erro que vão receber do backend.
3. **Base de dados simulada** (`mocks/db.ts`, `mocks/seed.ts`): em memória nos testes; no browser guardada em `localStorage` (chave `nfc-business-mock-db`), para sobreviver a recarregamentos e ser partilhada entre separadores. Só tem dados fictícios (domínios `.test`). Os «cookies» e o token CSRF fazem parte dela porque, com um backend real, o JavaScript da aplicação nunca os veria. É a única exceção à proibição de armazenamento do browser além da preferência de tema, registada no ESLint apenas para `src/mocks/**`, e só existe em desenvolvimento e no build de e2e.
4. **Constante de compilação `__API_MOCKING__`**, definida em `vite.config.ts`: verdadeira em desenvolvimento (salvo `API_MOCKING=false`) e no modo `e2e`; falsa em produção. `main.tsx` só importa `mocks/browser.ts` com `import()` dinâmico dentro de `if (__API_MOCKING__)`, para que a simulação e o MSW fiquem fora do build de produção. Não é uma variável `VITE_`.
5. **Service worker fora de `public/`**: `apps/web/mocks-static/mockServiceWorker.js` é servido pelo dev server e emitido no build apenas quando a simulação está ativa (plugin `nfc-business:msw-worker` em `vite.config.ts`), para nunca ser copiado para produção.
6. **O Vitest corre sempre sobre a API simulada completa**: `src/test/setup.ts` liga `mocks/server.ts` (`setupServer(...handlers)`) com `onUnhandledFrame: 'error'` e repõe rotas e dados depois de cada teste. Testes que precisem de rotas próprias acrescentam-nas com `useMockServer` (`handlers/testing.ts`), que as põe à frente das restantes antes de cada teste. Só os testes do próprio cliente da API substituem o `fetch` com `vi.stubGlobal`.
7. **Testes de ponta a ponta contra o build**: o Playwright corre `vite build --mode e2e` e `vite preview`, que aplica a CSP de produção. Qualquer código incompatível com a CSP falha nos testes antes de chegar a produção. O TOTP dos testes vem de `mocks/totp.ts` (sem dependências) e as credenciais fictícias de `mocks/credentials.ts`.
8. **Descarregamento do VCF na simulação**: o service worker não resolve pedidos iniciados por `<a download>`, por isso `mocks/vcf-download.ts` captura o clique nesses links, pede o ficheiro com `fetch` e entrega-o como Blob. Só na simulação; em produção o link funciona diretamente.

## Alternativas

1. Servidor Node de simulação (json-server, Express ou semelhante): mais um processo e outra fonte de verdade, que os testes de componentes não reutilizariam.
2. Mocks por teste com `vi.fn` no cliente da API: rápidos, mas não exercitam CSRF, sessão, posse nem os erros reais; ficam reservados aos testes do próprio cliente.
3. Esperar pelo backend: bloquearia todo o frontend.

## Justificação

Uma só API simulada, partilhada por desenvolvimento, Vitest e Playwright, mantém os três alinhados com o contrato. As verificações de segurança nos handlers obrigam os ecrãs a tratar 401, 403, 404, 409, 422 e 429 desde o primeiro dia, em vez de os descobrir na integração.

## Consequências

- Cada alteração ao contrato muda `endpoints.ts`, os schemas partilhados e o handler respetivo, com teste; o grafo (`docs/codebase-graph.md`) regista onde.
- A simulação não conhece o IP do cliente: os limites por IP (login, página pública) e a deduplicação de eventos por visitante são feitos por email, por utilizador ou por cartão. Os testes desses limites por IP ficam para o backend.
- Limites sem valor definido no prompt (envios por empresa) não são simulados.
- Quando o backend existir, `API_MOCKING=false` liga o dev server ao proxy `/api` (`API_PROXY_TARGET`), sem mudar o código da aplicação.
- O ficheiro `mockServiceWorker.js` tem de acompanhar a versão do MSW instalada (`pnpm --filter @nfc-business/web exec msw init mocks-static --save=false` depois de atualizar o MSW).
