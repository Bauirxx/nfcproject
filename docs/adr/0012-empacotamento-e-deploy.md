# ADR-0012 — Empacotamento do backend e deploy (Render + Vercel)

- Estado: Aceite
- Data: 2026-11-13

## Contexto

Chegou a altura de publicar. O `CLAUDE.md` define o alojamento: frontend no Vercel, backend no Render. Faltava resolver duas pendências do ADR-0010: como empacotar o backend para correr num host, e como o backend consome o pacote `@nfc-business/shared` em tempo de execução (o pacote só tem código-fonte TypeScript, sem build).

## Decisão

1. **Empacotamento do backend com esbuild** (`apps/api/esbuild.mjs`): `src/main.ts` é empacotado num único ficheiro CommonJS (`dist/server.cjs`), com o `@nfc-business/shared` **incluído** no pacote. Isto resolve de uma vez o arranque (basta `node dist/server.cjs`) e o consumo do pacote partilhado em runtime (fica inlinado). As dependências opcionais que o NestJS só carrega se existirem (`@nestjs/microservices`, `@nestjs/websockets`, `class-validator`, etc.) ficam marcadas como externas.
2. **Injeção de dependências explícita** (`@Inject(...)` em todos os construtores): o esbuild não gera `emitDecoratorMetadata`, de que o NestJS precisaria para inferir os tipos do construtor. Com `@Inject` por token explícito, a DI não depende dessa metadata e o pacote corre. Os serviços base (sessão e Supabase) ficam num módulo `@Global()` (`CoreModule`), para estarem disponíveis em todos os módulos.
3. **Render para o backend** (`render.yaml`): serviço web Node, `pnpm install --frozen-lockfile` e `pnpm --filter @nfc-business/api build`, arranque `node apps/api/dist/server.cjs`, `healthCheckPath: /api/health`. As chaves do Supabase são variáveis de ambiente do Render (`sync: false`), nunca no repositório.
4. **Vercel para o frontend** (`vercel.json`): build do `apps/web`, *rewrite* de `/api/*` para o URL do backend no Render e os cabeçalhos de segurança (CSP restrita, HSTS com preload, nosniff, Referrer-Policy, Permissions-Policy). O frontend chama `/api` na sua própria origem; o Vercel reencaminha para o Render, por isso o browser vê tudo como a mesma origem (cookies sem CORS).

## Alternativas

1. `tsc` a emitir JS e correr `node dist/main.js`: precisaria de resolver o `@nfc-business/shared` em runtime (build do pacote ou extensões `nodenext`), mais atrito do que empacotar.
2. Backend no Vercel como função serverless: foi equacionado, mas afasta-se do `CLAUDE.md` (Render) e junta as limitações do serverless; o Render mantém o modelo de servidor sempre ligado previsto.
3. Compilar com swc (gera metadata): evitaria o `@Inject` explícito, mas junta uma cadeia de ferramentas; o `@Inject` é pouco e torna a DI independente de metadata.

## Consequências

- O backend corre com `node apps/api/dist/server.cjs` (verificado localmente: `/api/health` → 200, `/api/auth/session` → `{ user: null }`).
- O `dist` do backend está no `.gitignore`; é gerado no build do Render.
- Depois de o backend estar no Render, é preciso trocar o URL em `vercel.json` (`SUBSTITUA-PELO-URL-DO-RENDER`).
- Só a autenticação está implementada no backend; os restantes endpoints do contrato (ADR-0004) ainda têm de ser construídos para o frontend funcionar por inteiro contra o backend real. Até lá, o frontend continua a poder usar a API simulada em desenvolvimento (`API_MOCKING`, ADR-0009).
- Guia passo a passo em `docs/deploy.md`.
