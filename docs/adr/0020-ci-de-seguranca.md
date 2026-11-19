# ADR-0020: CI de segurança e cadeia de fornecimento

- Estado: Aceite
- Data: 2026-11-19
- Relacionados: CLAUDE.md, regras 9 (segredos) e 10 (cadeia de fornecimento), fase 4; ADR-0012 (deploy), ADR-0017 (service_role)

## Contexto

A regra 10 pede um pipeline com gitleaks, `pnpm audit`, osv-scanner, Semgrep, testes, SBOM com syft e OWASP ZAP em staging, com as Actions fixadas por hash, permissões mínimas e aprovação manual para produção. A regra 9 pede o gitleaks também no pre-commit. Até aqui não havia CI: os deploys do Render e do Vercel saíam de cada push para `main` sem verificação.

## Decisão

1. **Workflow `.github/workflows/ci.yml`**, que corre em cada push para `main`, em cada pull request e à mão. Tem cinco jobs independentes:

   | Job | O que faz | Falha quando |
   |-----|-----------|--------------|
   | `secrets` | gitleaks 8.30.1 sobre **todo o histórico** | encontra um segredo |
   | `quality` | `pnpm install --frozen-lockfile`, tipos, lint, testes unitários, build do frontend com o orçamento de 100 KB, build do backend | algum passo falha |
   | `dependencies` | `pnpm audit` e osv-scanner 2.7.1 sobre o `pnpm-lock.yaml` | há vulnerabilidades conhecidas, **de qualquer severidade** |
   | `sast` | Semgrep 1.185.0 com conjuntos públicos (`p/default`, `p/typescript`, `p/react`, `p/nodejsscan`, `p/owasp-top-ten`, `p/github-actions`) e regras próprias (`.semgrep/`) | há qualquer resultado |
   | `sbom` | SBOM SPDX com syft 1.57.1, guardado como artefacto do run | — |

2. **Fixação.**
   - As Actions estão fixadas pelo hash do commit, com a versão em comentário.
   - O gitleaks e o osv-scanner são descarregados das releases oficiais e verificados por SHA-256 antes de correr.
   - A imagem do Semgrep está fixada por digest.
   - Todas as versões tinham pelo menos 7 dias à data da escolha.
3. **Permissões mínimas.**
   - `permissions: {}` no topo e `contents: read` em cada job.
   - `persist-credentials: false` no checkout.
   - Nenhum job recebe segredos.
   - Os testes de integração contra o Supabase **não** correm no CI, porque exigiriam credenciais da base de dados real.
4. **Regras Semgrep próprias** (`.semgrep/nfc-business.yml`). Verificadas contra exemplos com erros de propósito, para confirmar que disparam. Proíbem:
   - `dangerouslySetInnerHTML`;
   - TLS sem verificação;
   - o cliente Supabase no frontend;
   - `localStorage`/`sessionStorage` fora da preferência de tema;
   - a `SUPABASE_SERVICE_ROLE_KEY` fora do `SupabaseAdminService`;
   - segredos em variáveis `VITE_`.
5. **Exceções explícitas e revistas, nunca por ficheiro com segredos reais.**
   - **gitleaks:** `.gitleaksignore` com as impressões digitais exatas (commit, ficheiro, regra e linha) de 4 dados fictícios no histórico. As mesmas linhas no código atual levam `gitleaks:allow` com a razão.
   - **Semgrep:** o `.semgrepignore` exclui os testes e a API simulada, que têm dados fictícios e não chegam a produção. Dois `nosemgrep` com justificação:
     - o SHA-1 exigido pelo protocolo k-anonymity do HIBP;
     - uma expressão regular ancorada de tamanho fixo.

     São excluídas três regras «good_helmet_checks», que só confirmam que o helmet está ativo.
6. **Cadeia de fornecimento no pnpm.**
   - `blockExoticSubdeps: true`: dependências indiretas só do registo.
   - `trustPolicy: no-downgrade`.
   - `min-release-age=7` no `.npmrc`, para quem use o npm.
   - `overrides` para as duas vulnerabilidades encontradas na primeira análise:
     - multer 2.5.0: GHSA-q7qp-rjg7-q26m, alta, via `@nestjs/platform-express`;
     - minimatch 11.0.1: GHSA-g3hv-75wg-m249, média, via typescript-eslint, só em desenvolvimento.

     Retiram-se quando as dependências diretas trouxerem essas versões.
7. **Dependabot** (`.github/dependabot.yml`) para npm e GitHub Actions, semanal, com `cooldown` de 7 dias.
8. **Pre-commit** (`scripts/hooks/pre-commit`). Corre o gitleaks sobre o que está em stage e ativa-se por máquina com `git config core.hooksPath scripts/hooks`. Sem o gitleaks instalado, o commit é recusado em vez de passar sem verificação.

## Alternativas consideradas

- **`gitleaks/gitleaks-action`:** exige licença para repositórios de organizações e esconde a versão do binário. O binário verificado por checksum é mais simples e auditável.
- **`google/osv-scanner-action`:** usa uma imagem Docker identificada só pela tag, não pelo digest.
- **Falhar o `pnpm audit` só a partir de «alta»:** as médias têm prazo de 30 dias (regra 10). Falhar em tudo obriga a decidir caso a caso, por correção ou exceção documentada, em vez de as deixar esquecidas.
- **Correr os testes de integração no CI:** exigiria guardar no GitHub a ligação à base de dados de produção. Fica para quando houver um projeto Supabase de staging.

## Consequências

- **Por fazer, fora deste ADR:**
  - **ZAP:** precisa de um ambiente de staging, que ainda não existe.
  - **Aprovação manual para produção:** os deploys são feitos pelo Render e pelo Vercel, não pelo Actions.

  Até lá, o dono deve:
  - proteger a `main` no GitHub, exigindo os cinco jobs;
  - no Render, mudar o Auto-Deploy para «After CI Checks Pass», para que um push com o CI vermelho não chegue à produção (ver `docs/ci.md`).
- **Novas vulnerabilidades:** uma vulnerabilidade publicada numa dependência põe o CI vermelho mesmo sem alterações ao código. É intencional, porque os prazos da regra 10 contam a partir da deteção.
- **Atualizações:** cada atualização de uma Action ou ferramenta exige atualizar o hash ou o checksum no workflow. O Dependabot fá-lo para as Actions; o gitleaks, o osv-scanner, o syft e o Semgrep atualizam-se à mão.
