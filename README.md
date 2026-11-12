# NFC Business

Plataforma de cartões de visita digitais por NFC e QR Code. O estado do projeto está em `PROJECT_STATE.md`; as regras estão em `CLAUDE.md`.

## Preparar um computador novo

1. Instalar o Git e o Node.js 24 (o projeto recusa versões anteriores). Com nvm: `nvm install 24.22.2` e `nvm use 24.22.2`.
2. Ativar o pnpm: `corepack enable` (a versão certa vem do campo `packageManager` do `package.json`).
3. Clonar e instalar:

   ```sh
   git clone https://github.com/Bauirxx/nfcproject.git
   cd nfcproject
   pnpm install --frozen-lockfile
   ```

4. Só para os testes de ponta a ponta: `pnpm --filter @nfc-business/web exec playwright install chromium`.

## Comandos

| Comando | O que faz |
| --- | --- |
| `pnpm typecheck` | Verifica os tipos de todos os pacotes |
| `pnpm lint` | ESLint, sem avisos permitidos |
| `pnpm test` | Testes unitários e de componentes (Vitest) |
| `pnpm --filter @nfc-business/web dev` | Servidor de desenvolvimento em http://127.0.0.1:5173 |

Não é preciso nenhum ficheiro `.env`: o frontend corre sobre uma API simulada.

## Estrutura

- `apps/web` — frontend (React, Vite, TypeScript, Tailwind).
- `packages/shared` — schemas Zod, constantes e validadores partilhados com o backend.
- `docs/` — ADRs, requisitos, modelo de ameaças e prompts.
