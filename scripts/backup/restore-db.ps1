<#
.SYNOPSIS
  Restaura uma cópia cifrada do NFC Business num projeto Supabase (ADR-0022, teste mensal de restauro).

.DESCRIPTION
  Pensado para o TESTE DE RESTAURO num projeto Supabase separado, nunca em produção por engano:
  - recusa o projeto de produção, salvo -AllowProduction (só num incidente real, ver docs/backup.md);
  - o projeto de destino já tem de ter as migrações supabase/migrations/0001 a 000N aplicadas (schema, papéis,
    grants, RLS e pg_cron), porque só os DADOS são restaurados (schemas app e auth).

  O ficheiro decifrado fica numa pasta temporária só durante o restauro e é apagado no fim.

.EXAMPLE
  .\scripts\backup\restore-db.ps1 -Backup "$HOME\nfc-backups\nfc-business-20261119-1200.dump.gpg" `
    -DbUrl 'postgresql://postgres.<ref-de-teste>@aws-0-eu-west-1.pooler.supabase.com:5432/postgres'
#>
param(
  [Parameter(Mandatory = $true)]
  [string]$Backup,
  [Parameter(Mandatory = $true)]
  [string]$DbUrl,
  [string]$PgBin = $env:PG_BIN,
  [string]$Gpg = 'C:\Program Files\Git\usr\bin\gpg.exe',
  [string]$ProductionRef = 'ughsgiqolymjyzdjkpks',
  [switch]$AllowProduction
)

$ErrorActionPreference = 'Stop'
$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..\..')
$caFile = Join-Path $repoRoot 'apps\api\certs\supabase-ca.crt'

if ($DbUrl -match '://[^/@]+:[^/@]+@') { throw 'O URL não pode levar a palavra-passe: ela é pedida a seguir.' }
if ($DbUrl -match [regex]::Escape($ProductionRef) -and -not $AllowProduction) {
  throw 'Este é o projeto de PRODUÇÃO. O teste de restauro faz-se num projeto separado. Num incidente real, use -AllowProduction (docs/backup.md).'
}
$pgRestore = if ($PgBin) { Join-Path $PgBin 'pg_restore.exe' } else { (Get-Command pg_restore -ErrorAction SilentlyContinue).Source }
if (-not $pgRestore -or -not (Test-Path $pgRestore)) { throw 'pg_restore não encontrado. Instale o PostgreSQL 17 (command line tools) ou indique -PgBin.' }

$checksumFile = "$Backup.sha256"
if (Test-Path $checksumFile) {
  $expected = (Get-Content $checksumFile).Split(' ')[0]
  $actual = (Get-FileHash $Backup -Algorithm SHA256).Hash.ToLower()
  if ($expected -ne $actual) { throw 'O SHA-256 não coincide: a cópia está danificada ou foi alterada.' }
  Write-Host 'SHA-256 verificado.'
} else {
  Write-Warning 'Sem ficheiro .sha256: a integridade não foi verificada.'
}

$work = Join-Path ([IO.Path]::GetTempPath()) ("nfc-restore-" + [guid]::NewGuid())
New-Item -ItemType Directory $work | Out-Null
$plain = Join-Path $work 'backup.dump'
$secure = Read-Host -AsSecureString 'Palavra-passe da base de dados de destino (postgres)'
$bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
try {
  & $Gpg --decrypt --output $plain $Backup
  if ($LASTEXITCODE -ne 0) { throw 'Não foi possível decifrar (frase-passe errada ou ficheiro danificado).' }

  $env:PGPASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
  $env:PGSSLMODE = 'verify-full'
  $env:PGSSLROOTCERT = $caFile

  # Contas primeiro (as tabelas de app referem utilizadores), depois os dados do produto.
  # As versões internas do Supabase Auth (auth.schema_migrations) já existem no projeto de destino: ficam de fora.
  foreach ($schema in 'auth', 'app') {
    Write-Host "A restaurar os dados do schema $schema..."
    $list = Join-Path $work "$schema.list"
    & $pgRestore --list --data-only --schema=$schema $plain |
      Where-Object { $_ -notmatch '\bschema_migrations\b' } |
      Set-Content -Encoding ascii $list
    if ($LASTEXITCODE -ne 0) { throw "Não foi possível ler o conteúdo da cópia (código $LASTEXITCODE)." }
    & $pgRestore --data-only --no-owner --no-privileges --exit-on-error --use-list=$list --dbname=$DbUrl $plain
    if ($LASTEXITCODE -ne 0) { throw "O restauro do schema $schema falhou (código $LASTEXITCODE)." }
  }
  Write-Host 'Restauro concluído. Verifique as contagens (docs/backup.md, secção 4).'
} finally {
  Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
  Remove-Item Env:PGSSLMODE -ErrorAction SilentlyContinue
  Remove-Item Env:PGSSLROOTCERT -ErrorAction SilentlyContinue
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
  Remove-Item -Recurse -Force $work -ErrorAction SilentlyContinue
}
