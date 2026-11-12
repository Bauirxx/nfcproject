# ADR-0001 — Monorepo pnpm com `apps/web` e `packages/shared`

- Estado: Aceite
- Data: 2026-11-10

## Contexto

O prompt mestre exige schemas Zod partilhados entre frontend e backend, pnpm como gestor de pacotes e um monólito modular. O frontend está a ser desenvolvido antes do backend, com a API simulada por MSW.

## Decisão

Um único repositório com workspace pnpm:

- `apps/web` — frontend Vite (página pública e painel).
- `packages/shared` — contrato partilhado: schemas Zod, constantes, validadores, construção de links e matriz de permissões.
- `apps/api` — reservado para o backend NestJS (ainda não criado).

`packages/shared` expõe o código TypeScript diretamente pelo campo `exports`, sem passo de build. Tem pontos de entrada separados para que a página pública importe validadores sem carregar o Zod.

## Alternativas

1. Repositórios separados com um pacote publicado: mais atrito e risco de versões desalinhadas.
2. Schemas duplicados em cada lado: contraria a regra 7.
3. Schemas dentro de `apps/web`: o backend teria de importar de uma aplicação.

## Justificação

Uma única fonte para a validação elimina divergências entre cliente e servidor, que é a razão de ser da regra 7. O workspace mantém um único lockfile, o que simplifica `pnpm install --frozen-lockfile` e as auditorias.

## Consequências

- Quando o backend arrancar, `packages/shared` passa a precisar de um build para CommonJS ou ESM compilado, conforme a configuração do NestJS. Fica registado como tarefa da fase de fundação.
- O ESLint e o TypeScript são instalados na raiz e servem os dois pacotes.
