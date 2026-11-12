# ADR-0002 — Versões das ferramentas

- Estado: Aceite
- Data: 2026-11-10

## Contexto

O prompt mestre fixa mínimos (Vite 8.0.16 ou superior, Node 24.x, pnpm) e um atraso mínimo de 7 dias para versões novas. Em 2026-11-10 as versões mais recentes de algumas ferramentas não são compatíveis entre si.

## Decisão

| Ferramenta | Versão | Motivo |
|------------|--------|--------|
| Node.js | 24.x (`.nvmrc`: 24.22.2) | Exigido pelo prompt mestre; o React Router 8 exige Node 22.22 ou superior |
| pnpm | 12.17.0 (`packageManager`) | A 12.18.0 tinha 5 dias, abaixo do atraso mínimo de 7 dias |
| TypeScript | 6.0.x | O `typescript-eslint` 8 só suporta TypeScript abaixo de 6.1; o TypeScript 7 ainda não é suportado |
| ESLint | 9.x | `eslint-plugin-react` (regra `react/no-danger`, exigida) e `eslint-plugin-jsx-a11y` só declaram suporte até ao ESLint 9 |
| Vite | 8.x | Mínimo do prompt mestre |

As restantes dependências usam a versão mais recente com pelo menos 7 dias, resolvida pelo pnpm através de `minimumReleaseAge: 10080`.

## Alternativas

1. TypeScript 7 e ESLint 10: deixaria o lint fora das versões suportadas pelos plugins, incluindo a regra de segurança exigida.
2. Trocar `eslint-plugin-react` por outro plugin: o requisito nomeia a regra `react/no-danger`.

## Justificação

A regra `react/no-danger` é um controlo de segurança pedido explicitamente. É preferível manter duas ferramentas uma versão atrás do que correr o controlo numa combinação sem suporte.

## Consequências

- Rever quando o `typescript-eslint` suportar TypeScript 7 e os plugins suportarem ESLint 10.
- O ESLint 9 está na linha de manutenção; acompanhar o fim de suporte.
- A máquina de desenvolvimento tinha Node 22.10.0 ativo. O Node 24.22.2 foi instalado lado a lado pelo nvm; é preciso `nvm use 24.22.2` para trabalhar no projeto.
