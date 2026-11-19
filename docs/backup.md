# Cópias de segurança e restauro

Decisão e exceção à regra 11 no [ADR-0022](adr/0022-copias-de-seguranca-plano-free.md).

**Atenção:** no plano Free, o Supabase **não faz cópias automáticas** e não tem PITR. Até haver um fornecedor e um plano pago, a única cópia é a que o dono faz com o script abaixo.

## 1. Preparar (uma vez por máquina)

1. **Instale o PostgreSQL 17 command line tools**, pelo instalador oficial em postgresql.org > Download > Windows. No instalador marque só *Command Line Tools*, sem servidor. Confirme que funciona:
   ```powershell
   pg_dump --version   # 17.x ou superior
   ```
   Se o `pg_dump` não ficar no PATH, use `-PgBin 'C:\Program Files\PostgreSQL\17\bin'` nos scripts.
2. **O gpg** já vem com o Git para Windows. Os scripts usam `C:\Program Files\Git\usr\bin\gpg.exe`.
3. **URL de ligação, sem a palavra-passe.** No Supabase, abra **Connect > Session pooler**. O utilizador é `postgres.<ref>`. Copie o URL e **retire** a palavra-passe (`:[YOUR-PASSWORD]`), para ficar assim:
   ```
   postgresql://postgres.ughsgiqolymjyzdjkpks@aws-0-eu-west-1.pooler.supabase.com:5432/postgres
   ```
   A palavra-passe da base de dados é pedida pelo script. Se não a souber, pode redefini-la em **Database > Settings**; isto não afeta o `app_backend`.
4. **Escolha uma frase-passe forte para as cópias** e guarde-a num gestor de palavras-passe. **Sem ela, nenhuma cópia se recupera.** Use sempre a mesma.

## 2. Fazer uma cópia

Corra a partir da raiz do repositório:

```powershell
.\scripts\backup\backup-db.ps1 -DbUrl 'postgresql://postgres.<ref>@aws-0-eu-west-1.pooler.supabase.com:5432/postgres'
```

- **O que acontece:** o script pede a palavra-passe da base de dados e o gpg abre uma janela para a frase-passe (duas vezes). A cópia cifrada fica em `%USERPROFILE%\nfc-backups\nfc-business-AAAAMMDD-HHMM.dump.gpg`, com o `.sha256` ao lado.
- **Para fora deste PC:** copie os dois ficheiros para um **disco externo ou outra máquina**. É isto que protege contra perder o projeto ou a conta Supabase.
- **Retenção:** as cópias com mais de 35 dias são apagadas automaticamente da pasta `nfc-backups`, mas não do disco externo.

**Quando fazer uma cópia:**
- **pelo menos uma vez por semana**;
- **sempre antes** de aplicar uma migração;
- antes de importar dados em massa.

**O que está na cópia:**
- schema `app`: empresas, membros, perfis, cartões, envios, estatísticas, auditoria e uploads;
- schema `auth`: contas, palavras-passe cifradas pelo Supabase e fatores de MFA.

**O que NÃO está:** as imagens do bucket `public-images` (fotografias e logótipos). Se se perderem, os perfis ficam sem imagem e voltam a ser carregados na interface.

## 3. Teste de restauro mensal

O teste faz-se **num projeto Supabase separado**, nunca em produção. O plano Free permite um segundo projeto gratuito.

1. **Criar o projeto de teste.** No Supabase, crie o projeto `nfc-restore-test`, na mesma região.
2. **Aplicar as migrações.** No SQL Editor desse projeto, aplique as migrações de `supabase/migrations`, por ordem (0001 a 0004 e as seguintes). Elas criam o schema, os papéis, as permissões e o RLS.
3. **Restaurar a cópia mais recente:**
   ```powershell
   .\scripts\backup\restore-db.ps1 -Backup "$HOME\nfc-backups\nfc-business-AAAAMMDD-HHMM.dump.gpg" `
     -DbUrl 'postgresql://postgres.<ref-de-teste>@aws-0-eu-west-1.pooler.supabase.com:5432/postgres'
   ```
   - O script verifica o SHA-256 e decifra para uma pasta temporária.
   - Restaura primeiro `auth` e depois `app`, e apaga o ficheiro decifrado no fim.
   - Recusa o projeto de produção.
4. **Comparar com a produção** (secção 4).
5. **Registar o teste** em `PROJECT_STATE.md`: data, cópia usada, resultado e contagens.
6. **Limpar.** Pode apagar os dados do projeto de teste ou mantê-lo para o próximo mês.

## 4. Verificação depois do restauro

Corra a mesma consulta nos dois projetos (produção e teste) e compare:

```sql
select 'companies' t, count(*) from app.companies
union all select 'profiles', count(*) from app.profiles
union all select 'cards', count(*) from app.cards
union all select 'contact_shares', count(*) from app.contact_shares
union all select 'audit_logs', count(*) from app.audit_logs
union all select 'auth.users', count(*) from auth.users;
```

As contagens devem coincidir com as da produção no momento da cópia.

## 5. Num incidente real (perda de dados em produção)

1. **Pare as escritas.** No Render, suspenda o serviço do backend. A página pública fica indisponível e mostra o 404 neutro.
2. **Escolha a cópia** mais recente anterior ao problema.
3. **Ensaie primeiro** o restauro dessa cópia no projeto de teste (secção 3).
4. **Restaure em produção.** Esvazie as tabelas afetadas e corra o `restore-db.ps1` com `-AllowProduction`. Se a perda for total, use um projeto novo com as migrações aplicadas e atualize o `DATABASE_URL` e as chaves no Render.
5. **Registe o incidente** em `audit_logs` e no plano de resposta a incidentes. Os dados criados entre a cópia e o incidente perdem-se.
