# ADR-0003 — Página pública separada do painel no mesmo projeto Vite

- Estado: Aceite
- Data: 2026-11-10

## Contexto

A página pública tem de carregar em menos de 1,5 s em 4G, com menos de 100 KB de JavaScript inicial comprimido. O painel usa React Router, TanStack Query, React Hook Form e Zod, que sozinhos ultrapassam esse orçamento. As duas partes vivem no mesmo projeto Vite.

## Decisão

O ponto de entrada (`src/main.tsx`) decide pelo caminho do URL:

- `/c/:token` e `/p/:slug` renderizam a página pública, importada estaticamente. Usa apenas React, o cliente da API (sem dependências) e os validadores do pacote partilhado. Não carrega router, TanStack Query, React Hook Form nem Zod.
- Qualquer outro caminho carrega o painel com `import()` dinâmico.

Dentro da página pública, o QR Code e o envio de contacto do dono são carregados a pedido.

O orçamento é verificado por `scripts/check-bundle-size.mjs`, que soma o JavaScript referenciado pelo `index.html` de produção.

## Alternativas

1. Uma única árvore de rotas com `lazy()` por rota: o router e o cliente de dados entrariam no carregamento inicial da página pública.
2. Dois projetos Vite: contraria «duas partes no mesmo projeto Vite».
3. Página pública em HTML gerado no servidor: exigiria outra arquitetura de alojamento, sem ADR que a justifique.

## Justificação

A página pública é aberta por visitantes em rede móvel, muitas vezes uma única vez. Cada KB conta mais ali do que no painel, onde os utilizadores voltam e têm cache.

## Consequências

- A página pública não pode importar de `src/app` nem de componentes que dependam de `class-variance-authority` ou `tailwind-merge`. Uma regra de ESLint (`no-restricted-imports`) impede-o.
- A navegação entre a página pública e o painel é um carregamento de página normal.
- Os textos da página pública ficam num dicionário próprio e pequeno (`src/shared/i18n/public.ts`).
