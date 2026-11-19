<#
.SYNOPSIS
  Cópia de segurança cifrada da base de dados do NFC Business (ADR-0022, regra 11).

.DESCRIPTION
  Faz um pg_dump (formato custom) dos schemas `app` (dados do produto) e `auth` (contas do Supabase Auth) e
  cifra-o com o gpg (AES-256, frase-passe pedida numa janela). A cópia em claro nunca é escrita no disco: o
  pg_dump escreve diretamente para o gpg. Guarda também o SHA-256 do ficheiro cifrado.

  Requisitos:
  - pg_dump 17 ou superior (o projeto usa PostgreSQL 17): "PostgreSQL command line tools".
  - gpg: vem com o Git para Windows (C:\Program Files\Git\usr\bin\gpg.exe).
  - Ligação como `postgres` pelo Session pooler (o app_backend está sujeito a RLS e não vê o schema auth).
    O URL não leva a palavra-passe: ela é pedida aqui e passa só por variável de ambiente do processo.

  As imagens (bucket public-images) NÃO estão nesta cópia (ver docs/backup.md).

.EXAMPLE
  .\scripts\backup\backup-db.ps1 -DbUrl 'postgresql://postgres.<ref>@aws-0-eu-west-1.pooler.supabase.com:5432/postgres'
#>
param(
  [Parameter(Mandatory = $true)]
  [string]$DbUrl,
  [string]$OutDir = (Join-Path $HOME 'nfc-backups'),
  [string]$PgBin = $env:PG_BIN,
  [string]$Gpg = 'C:\Program Files\Git\usr\bin\gpg.exe',
  # Cópias mais antigas do que isto são apagadas desta pasta (as copiadas para outro disco não são tocadas).
  [int]$KeepDays = 35
)

$ErrorActionPreference = 'Stop'
$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..\..')
$caFile = Join-Path $repoRoot 'apps\api\certs\supabase-ca.crt'

if ($DbUrl -match '://[^/@]+:[^/@]+@') {
  throw 'O URL não pode levar a palavra-passe (fica no histórico do terminal). Retire-a: ela é pedida a seguir.'
}
$pgDump = if ($PgBin) { Join-Path $PgBin 'pg_dump.exe' } else { (Get-Command pg_dump -ErrorAction SilentlyContinue).Source }
if (-not $pgDump -or -not (Test-Path $pgDump)) { throw 'pg_dump não encontrado. Instale o PostgreSQL 17 (command line tools) ou indique -PgBin.' }
$version = & $pgDump --version
if ($version -notmatch ' (1[7-9]|[2-9][0-9])\.') { throw "É preciso o pg_dump 17 ou superior (encontrado: $version)." }
if (-not (Test-Path $Gpg)) { throw "gpg não encontrado em $Gpg." }
if (-not (Test-Path $caFile)) { throw "Certificado da CA do Supabase não encontrado em $caFile." }

New-Item -ItemType Directory -Force $OutDir | Out-Null
$stamp = Get-Date -Format 'yyyyMMdd-HHmm'
$target = Join-Path $OutDir "nfc-business-$stamp.dump.gpg"

$secure = Read-Host -AsSecureString 'Palavra-passe da base de dados (postgres)'
$bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
try {
  $env:PGPASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
  # TLS sempre verificado contra a CA do Supabase (nunca desativar).
  $env:PGSSLMODE = 'verify-full'
  $env:PGSSLROOTCERT = $caFile

  Write-Host 'A exportar e a cifrar (o gpg vai pedir a frase-passe da cópia numa janela, duas vezes)...'
  # O pipe corre no cmd para passar bytes sem conversão (o PowerShell 5.1 estraga dados binários num pipe).
  $command = "`"$pgDump`" --format=custom --no-owner --no-privileges --schema=app --schema=auth --dbname=`"$DbUrl`" | " +
    "`"$Gpg`" --symmetric --cipher-algo AES256 --s2k-digest-algo SHA512 --output `"$target`""
  cmd /c $command
  if ($LASTEXITCODE -ne 0) { throw "A cópia falhou (código $LASTEXITCODE). Nada de válido foi guardado." }
} finally {
  Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
  Remove-Item Env:PGSSLMODE -ErrorAction SilentlyContinue
  Remove-Item Env:PGSSLROOTCERT -ErrorAction SilentlyContinue
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
}

$info = Get-Item $target
if ($info.Length -lt 1024) {
  Remove-Item $target
  throw 'O ficheiro cifrado ficou vazio ou quase: a exportação falhou. Veja as mensagens acima.'
}
$hash = (Get-FileHash $target -Algorithm SHA256).Hash.ToLower()
Set-Content -Encoding ascii "$target.sha256" "$hash  $($info.Name)"

Get-ChildItem $OutDir -Filter 'nfc-business-*.dump.gpg*' |
  Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-$KeepDays) } |
  Remove-Item

Write-Host "Cópia cifrada: $target ($([math]::Round($info.Length / 1KB)) KB)"
Write-Host "SHA-256: $hash"
Write-Host 'Copie este ficheiro e o .sha256 para um disco externo ou outra máquina. Guarde a frase-passe num gestor de palavras-passe: sem ela a cópia não se recupera.'
