# MarkLens release (R-4 step A): back up the PRODUCTION database before any migration. Free plan = no dashboard backups,
# so this is the only restore point. Run it yourself in PowerShell from the repository root; the connection string is
# typed here (hidden), never stored, never printed. READ ONLY on the database (pg_dump in the Supabase CLI's container).
#   powershell -ExecutionPolicy Bypass -File scripts/release/backup-production.ps1 [-Expect <production-readiness.csv>]
# Needs Docker Desktop running and the Session pooler connection string from Supabase → Connect (password included,
# special characters percent-encoded). Writes roles.sql, schema.sql, data.sql and manifest.json to
# %USERPROFILE%\MarkLens-backups\prod-<date> — outside the repository. Storage FILES (bucket objects) are not included.
param([string]$Expect = "", [string]$OutRoot = (Join-Path $HOME "MarkLens-backups"))
$ErrorActionPreference = "Stop"
$ProdRef = "ndehtnchkgvpjbxlkazk"
$Cli = "supabase@2.120.0"

docker info *> $null
if ($LASTEXITCODE -ne 0) { throw "Docker Desktop is not running. Start it, wait until it says 'Engine running', then run this again." }

$secure = Read-Host -AsSecureString "Production connection string (Session pooler URI with password)"
$bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
$dir = Join-Path $OutRoot ("prod-" + (Get-Date -Format "yyyyMMdd-HHmm"))
try {
  $url = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
  if ($url -notmatch $ProdRef) { throw "This is not the production project ($ProdRef). Nothing was dumped." }
  New-Item -ItemType Directory -Force $dir | Out-Null
  $steps = @(
    @("roles.sql", @("--role-only")),
    @("schema.sql", @()),
    @("data.sql", @("--use-copy", "--data-only", "-x", "storage.buckets_vectors", "-x", "storage.vector_indexes"))
  )
  foreach ($s in $steps) {
    Write-Host "dumping $($s[0]) ..."
    & npx --yes $Cli db dump --db-url $url -f (Join-Path $dir $s[0]) @($s[1])
    if ($LASTEXITCODE -ne 0) { throw "$($s[0]) failed (exit $LASTEXITCODE). The folder $dir is incomplete - do not rely on it." }
  }
} finally {
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
  Remove-Variable url -ErrorAction SilentlyContinue
}

$verify = Join-Path $PSScriptRoot "verify-backup.mjs"
if ($Expect) { & node $verify $dir --expect $Expect } else { & node $verify $dir }
if ($LASTEXITCODE -ne 0) { throw "Backup check failed - see INCOMPLETE above." }
Write-Host "`nBackup folder: $dir"
