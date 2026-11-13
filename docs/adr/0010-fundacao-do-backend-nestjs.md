# ADR-0010 — Fundação do backend NestJS (apps/api)

- Estado: Aceite
- Data: 2026-11-13

## Contexto

O frontend foi construído sobre uma API simulada com MSW, sempre assumida como temporária até o backend existir (ADR-0009). O dono do produto pediu para iniciar o backend real, para a plataforma deixar de depender de simulação. O `CLAUDE.md` define a stack (NestJS 11.1.24+ com adaptador Express, Supabase para Auth, PostgreSQL no schema `app` e Storage) e a fase 1 (Fundação), cujo critério de saída é: «nenhum endpoint responde sem autenticação, exceto os marcados como @Public()».

Não há ainda projeto Supabase nem credenciais. Não se inventam segredos (regra 9), por isso a fundação é construída de forma a verificar-se sem infraestrutura ao vivo, deixando a ligação ao Supabase pronta a receber a configuração.

## Decisão

1. **Novo pacote `apps/api`** (`@nfc-business/api`), monólito modular em NestJS 11 com adaptador Express, no monorepo pnpm existente.
2. **Guard global com negar por defeito** (`AuthGuard` via `APP_GUARD`): só as rotas marcadas com `@Public()` respondem sem sessão; as restantes exigem uma sessão válida. Cumpre já o critério de saída da fase 1.
3. **Seam de sessão** (`SessionService`): lê o access token do cookie HttpOnly (`nfc_access`) e valida-o. A validação real contra o Supabase Auth é a próxima fase; sem fornecedor configurado, nenhuma sessão é válida (os endpoints protegidos respondem 401), o que é o comportamento correto para a fundação.
4. **Erros no formato do contrato** (`ApiExceptionFilter`): toda a resposta de erro é `{ "error": { "code": "..." } }`, com um código estável; nunca se expõe texto do servidor nem stack traces (regra 9). Os 5xx são registados no servidor.
5. **Configuração validada no arranque** (`loadEnv`, com Zod): o processo não sobe com configuração inválida; em produção o Supabase é obrigatório. Nenhum segredo no código; `apps/api/.env.example` documenta as variáveis.
6. **Cabeçalhos de segurança e CORS fechado** no `main.ts`: `helmet` (HSTS com preload, CSP restrita, `Referrer-Policy`, nosniff, frameguard), `Permissions-Policy`, remoção de `X-Powered-By`, `cors: false`, prefixo global `/api`.
7. **Ferramentas e módulo**: TypeScript com `experimentalDecorators` e `emitDecoratorMetadata` (exigidos pela injeção de dependências do NestJS). `module: esnext` e `moduleResolution: bundler` servem o `typecheck` e os testes (Vitest, consistente com o resto do monorepo). Os testes unitários instanciam as classes diretamente, sem depender do contentor de DI. A regra ESLint `consistent-type-imports` é desligada em `apps/api`, porque os tipos do construtor têm de ser importados como valores para a metadata da DI.

## Alternativas

1. Manter os mocks (ADR-0009) e não iniciar o backend: recusado pelo dono do produto.
2. Construir todo o backend de uma vez: demasiado grande para um bloco verificável e, sem Supabase, não seria executável de ponta a ponta.
3. Remover já o MSW: deixaria o frontend sem API nenhuma (o dev server e os testes deixariam de funcionar) até o backend estar pronto.

## Consequências

- O frontend continua a usar a API simulada (MSW) até existirem endpoints reais; a migração far-se-á endpoint a endpoint, trocando o alvo do proxy `/api` (ADR-0009: `API_MOCKING=false`).
- **Por fazer, dependente de credenciais do dono do produto**: projeto Supabase (URL e chaves), `SessionService` a validar contra o Supabase Auth, schema `app`, RLS, papel `app_backend` e o login BFF. Sem isto, o backend não corre de ponta a ponta.
- **Decisões adiadas para quando o servidor for executado** (próximos blocos, a registar quando forem tomadas): a estratégia de empacotamento executável (a resolução `bundler` não emite extensões para Node ESM, por isso o `dist` atual não é executável tal como está — será resolvido com um empacotador ou `moduleResolution: nodenext`), e a forma como o backend consome o pacote `@nfc-business/shared` (schemas Zod partilhados, regra 7) em tempo de execução.
- `ValidationPipe` global (regra 7) e o adaptador de validação com os schemas Zod partilhados entram com os primeiros endpoints.
- O `apps/api/dist` está no `.gitignore`.
