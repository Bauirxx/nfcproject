# ADR-0007 — Dependências do frontend fora da stack base

- Estado: Aceite
- Data: 2026-11-10

## Contexto

O prompt mestre fixa a stack (React, TypeScript, Vite, React Router, TanStack Query, React Hook Form, Zod, Tailwind CSS, shadcn/ui, Lucide) e proíbe inventar dependências. Alguns requisitos precisam de mais do que a stack base. Cada dependência adicional aumenta a superfície da cadeia de fornecimento (regra 10).

## Decisão

Dependências de execução acrescentadas, cada uma ligada a um requisito:

| Pacote | Requisito | Porquê |
|--------|-----------|--------|
| `@hookform/resolvers` | RNF-FE-01 (schemas partilhados) | Liga o React Hook Form aos schemas Zod |
| `@radix-ui/react-dialog`, `react-alert-dialog`, `react-dropdown-menu`, `react-slot` | RNF-FE-03, RNF-FE-07 | Primitivas em que o shadcn/ui assenta: foco preso, teclado e ARIA |
| `class-variance-authority`, `clsx`, `tailwind-merge` | RNF-FE-07 | Utilitários usados pelos componentes shadcn/ui |
| `@dnd-kit/core`, `sortable`, `utilities` | RF-FE-13 | Ordenação por arrastar com suporte de teclado e leitor de ecrã |
| `uqr` | RF-FE-01, RF-FE-11, RF-FE-04 | QR Code gerado localmente, sem dependências |

Dependências de desenvolvimento: as do prompt (Vitest, Testing Library, axe, Playwright, MSW) mais `jsdom`, `@axe-core/playwright` e os plugins de ESLint.

Rejeitadas, com alternativa própria:

| Pacote | Motivo | Alternativa |
|--------|--------|-------------|
| `recharts` | Peso e risco com CSP estrita | Gráficos em SVG próprio |
| `sonner` | Injeta `<style>` em tempo de execução | Notificações próprias |
| `@radix-ui/react-select`, `react-scroll-area` | Injetam `<style>` | `<select>` nativo e scroll nativo |
| `react-easy-crop` | Injeta `<style>` por defeito | Recorte próprio com canvas |
| Fontes web (`@fontsource`) | Bytes na página pública | Fontes do sistema |
| Biblioteca de i18n | Uma só língua por agora | Dicionários tipados (ADR-0008) |
| Biblioteca de datas | `Intl` chega | `Intl.DateTimeFormat` |
| `vitest-axe`, `jest-axe` | Camada fina sobre o axe | `axe-core` com um helper próprio |

## Alternativas

Usar o conjunto completo que o CLI do shadcn/ui instala. Traria perto de vinte pacotes Radix e bibliotecas incompatíveis com a CSP (ADR-0006).

## Justificação

Menos dependências significa menos código de terceiros a auditar e um bundle mais pequeno.

## Consequências

- Os gráficos, o recorte de imagem e as notificações são código próprio e têm os seus testes.
- Qualquer dependência nova exige atualizar este ADR.
