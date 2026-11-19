# CI de segurança: operação

Decisão e justificação no [ADR-0020](adr/0020-ci-de-seguranca.md). O workflow é `.github/workflows/ci.yml` e os resultados aparecem no separador **Actions** do GitHub.

## 1. Configuração única no GitHub e no Render (dono do repositório)

1. **Proteger a `main`.** No GitHub, em **Settings > Branches**, crie uma regra para `main`:
   - ative «Require status checks to pass»;
   - marque os jobs do CI: *Segredos (gitleaks)*, *Tipos, lint, testes e builds*, *Vulnerabilidades em dependências*, *Análise estática (Semgrep)* e *SBOM (syft)*.
2. **Correções de segurança.** Em **Settings > Advanced Security**, ative *Dependabot alerts* e *Dependabot security updates*.
3. **Bloquear o deploy do backend com o CI vermelho.** No Render, no serviço do backend, vá a **Settings > Build & Deploy > Auto-Deploy** e escolha **After CI Checks Pass**.
4. **Bloquear o deploy do frontend com o CI vermelho (opcional).** O Vercel não espera pelo CI por defeito. Pode limitá-lo à produção com **Settings > Git > Ignored Build Step**, ou ligar a produção só depois do CI.

## 2. Hook de pre-commit (cada máquina)

1. Instale o gitleaks 8.30.1 a partir das [releases oficiais](https://github.com/gitleaks/gitleaks/releases/tag/v8.30.1). Confirme o SHA-256 no `gitleaks_8.30.1_checksums.txt` e ponha o executável no PATH.
2. No repositório, corra uma vez:

   ```sh
   git config core.hooksPath scripts/hooks
   ```

3. A partir daí, cada commit é analisado. Sem o gitleaks no PATH, o commit é recusado.

## 3. Quando o CI falha

| Job | O que fazer |
|-----|-------------|
| **Segredos** | Se o segredo for real: **revogue-o primeiro** no fornecedor (Supabase, Resend, ...), depois retire-o do código. Apagar o commit não chega, porque o segredo já saiu. Se for um dado fictício de teste: acrescente `// gitleaks:allow (razão)` na linha. |
| **Vulnerabilidades** | Atualize a dependência direta, ou use `overrides` em `pnpm-workspace.yaml`, sempre com uma versão com 7 ou mais dias. Prazos (regra 10): CISA KEV ou crítica exposta em 72 horas, alta em 14 dias, média em 30 dias. Se não houver correção, registe a exceção com prazo num ADR. |
| **Semgrep** | Corrija o código. Só quando for comprovadamente um falso positivo: `// nosemgrep: <regra> (razão)`. |
| **Tipos, lint, testes** | Como em local: `pnpm typecheck`, `pnpm lint` e `pnpm test`. |

## 4. Reproduzir em local

```sh
pnpm install --frozen-lockfile && pnpm typecheck && pnpm lint && pnpm test
pnpm audit
gitleaks git --redact .
osv-scanner scan source --lockfile pnpm-lock.yaml
semgrep scan --metrics=off --config p/default --config p/typescript --config p/react \
  --config p/nodejsscan --config p/owasp-top-ten --config p/github-actions --config .semgrep/
```

## 5. Atualizar as ferramentas fixadas

As Actions são atualizadas pelo Dependabot, que muda o hash e o comentário da versão.

O gitleaks, o osv-scanner, o syft e a imagem do Semgrep atualizam-se à mão no topo do workflow, com versões de 7 ou mais dias:

| Ferramenta | O que mudar |
|------------|-------------|
| gitleaks | `*_VERSION` e `*_SHA256`, tirado do ficheiro de checksums da release |
| osv-scanner | `*_VERSION` e `*_SHA256`, tirado do ficheiro de checksums da release |
| syft | `syft-version` |
| Semgrep | o digest da imagem, tirado do Docker Hub |

## 6. Ainda por fazer

- **OWASP ZAP:** precisa de um ambiente de staging.
- **Testes de integração no CI:** precisam de um projeto Supabase de staging.
- **Aprovação manual para produção:** precisa de um environment do GitHub com revisores, quando os deploys passarem pelo Actions.
