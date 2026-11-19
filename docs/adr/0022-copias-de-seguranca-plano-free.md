# ADR-0022: Cópias de segurança no plano Free (exceção temporária à regra 11)

- Estado: Aceite (exceção temporária)
- Data: 2026-11-19
- Relacionados: CLAUDE.md, regra 11 e fases 4 e 5; ADR-0013 (ligação à base de dados)

## Contexto

A regra 11 pede duas coisas:
- o **point-in-time recovery do Supabase**;
- um **pg_dump diário cifrado noutro fornecedor**, com teste de restauro mensal.

O dono decidiu deixar as cópias no Supabase por agora, porque ainda não há onde as guardar. O projeto está no **plano Free**. Segundo a documentação do Supabase (Platform > Backups, consultada a 2026-11-19):
- só os planos Pro, Team e Enterprise têm cópias diárias automáticas (7, 14 e até 30 dias);
- o PITR é um extra pago desses planos (cerca de 100 USD por mês para 7 dias);
- no plano Free, a recomendação é exportar regularmente com o CLI e guardar a cópia fora do Supabase.

Ou seja, no plano Free, «deixar no Supabase» significa **não ter nenhuma cópia**.

## Decisão

1. **Sem fornecedor novo por agora.**
   - A cópia é um `pg_dump` dos schemas `app` e `auth`, cifrado com gpg (AES-256, frase-passe do dono).
   - É feita pelo dono com `scripts/backup/backup-db.ps1` e guardada fora do Supabase: no PC do dono e num disco externo.
   - O dump passa direto para o gpg, por isso a cópia em claro nunca é escrita no disco.
   - TLS verificado contra a CA do Supabase.
   - A palavra-passe da base de dados é pedida e passa só pelo ambiente do processo.
2. **Frequência:** pelo menos semanal e sempre antes de cada migração. Não é diária, porque é manual.
3. **Restauro.** `scripts/backup/restore-db.ps1` restaura os dados num **projeto Supabase de teste**, com as migrações já aplicadas, e recusa a produção sem `-AllowProduction`. O teste é **mensal**, com o procedimento e a verificação de contagens em `docs/backup.md`.
4. **Fora da cópia:** as imagens do Storage (re-carregáveis pela interface).
5. **Exceção temporária à regra 11, com prazo.** Antes da fase 5 (publicação) e **antes de gravar os chips definitivos**, o dono escolhe:
   - um plano Supabase com cópias diárias (Pro) ou PITR;
   - **e** um fornecedor para a cópia diária automática cifrada, por exemplo um bucket S3 compatível, B2 ou R2, com um workflow agendado.

   Quando isso acontecer, este ADR é substituído.

## Alternativas consideradas

- **Artefactos cifrados do GitHub Actions:** gratuitos e noutro fornecedor, mas o repositório é **público**: o ficheiro cifrado ficaria descarregável por qualquer conta GitHub. Também guardaria uma credencial da base de dados nos segredos do GitHub. Recusada enquanto o repositório for público.
- **Bucket privado no Supabase Storage:** não protege contra perder o projeto ou a conta, e exigiria a service_role num processo agendado.
- **Plano Pro já:** resolve as cópias diárias, mas é uma decisão de custo do dono.

## Consequências

- **Risco aceite pelo dono:**
  - entre duas cópias manuais, os dados novos podem perder-se;
  - se ninguém fizer a cópia, não há cópia nenhuma.
- **Ferramentas:** o dono precisa do PostgreSQL 17 command line tools e de guardar a frase-passe num gestor de palavras-passe.
- **Pendente:** a primeira cópia e o primeiro teste de restauro só ficam verificados quando o dono os correr. Os scripts estão verificados quanto à sintaxe e às proteções (URL com palavra-passe, destino de produção, ausência do `pg_dump`), não contra a base de dados.
