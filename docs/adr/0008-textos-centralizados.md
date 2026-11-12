# ADR-0008 — Textos centralizados sem biblioteca de i18n

- Estado: Aceite
- Data: 2026-11-10

## Contexto

A interface é em português e os textos têm de estar centralizados para tradução futura. A página pública tem um orçamento de JavaScript apertado.

## Decisão

Os textos vivem em `apps/web/src/shared/i18n/`:

- `public.ts` — textos da página pública (pequeno, entra no carregamento inicial).
- `panel/` — textos do painel, um ficheiro por funcionalidade, reunidos em `panel/index.ts`.
- `errors.ts` — mensagens genéricas por código de erro da API.
- `format.ts` — datas e números com `Intl`, no locale `pt-MZ`.

Cada dicionário é um objeto TypeScript `as const`. Os textos com variáveis são funções. Os componentes importam o dicionário; nenhum texto visível é escrito diretamente num componente.

## Alternativas

1. `i18next` ou `react-intl`: resolvem a troca de língua em tempo de execução, que ainda não é requisito, e pesam na página pública.
2. Textos nos componentes: contraria o requisito.

## Justificação

Um objeto tipado dá verificação em tempo de compilação (uma chave em falta não compila) e custo zero em execução.

## Consequências

- Acrescentar uma língua passa por criar dicionários com a mesma forma e um seletor de locale. Nessa altura, reavaliar uma biblioteca.
- A revisão de código deve recusar texto visível fora de `src/shared/i18n`.
