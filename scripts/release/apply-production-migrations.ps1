# MarkLens release (R-4 batch 1a): apply 017 -> 023 -> 024 -> 026 to the PRODUCTION database, each only if the schema
# check says it is missing, one file at a time, stopping at the first error. Data counts before/after are compared.
#   powershell -STA -ExecutionPolicy Bypass -File scripts/release/apply-production-migrations.ps1 -LogFile <path>
# The database password is asked in the same window as backup-production.ps1 and never printed (masked in the log).
# psql runs in a postgres:17 container; the password reaches it through the PGPASSWORD environment variable, not the
# command line. -Rehearsal runs the identical steps against a LOOPBACK database only (a local copy of production).
param(
  [string]$LogFile = "",
  [switch]$Rehearsal,
  [string]$DbHost = "aws-1-ap-northeast-2.pooler.supabase.com",
  [int]$DbPort = 5432,
  [string]$DbUser = "postgres.ndehtnchkgvpjbxlkazk",
  [string]$DbName = "postgres",
  [string]$TestPassword = ""
)
$ErrorActionPreference = "Stop"
$ProdRef = "ndehtnchkgvpjbxlkazk"
$Repo = Split-Path (Split-Path $PSScriptRoot)
$Batch = @("017", "023", "024", "026")
$Image = "postgres:17-alpine"
# Take only the two functions from backup-production.ps1. Dot-sourcing the file would also run its param() block in this
# scope and reset -Rehearsal / -DbHost to their production defaults.
$ast = [System.Management.Automation.Language.Parser]::ParseFile((Join-Path $PSScriptRoot "backup-production.ps1"), [ref]$null, [ref]$null)
foreach ($fn in $ast.FindAll({ param($n) $n -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $n.Name -in @("Read-DbPassword", "Test-ProductionConnection") }, $false)) {
  . ([scriptblock]::Create($fn.Extent.Text))
}

$script:secrets = @()
function Write-Log([string]$Line) {
  foreach ($s in $script:secrets) { if ($s) { $Line = $Line.Replace($s, "***") } }
  Write-Host $Line
  if ($LogFile) { Add-Content -Path $LogFile -Value $Line -Encoding UTF8 }
}
# Runs SQL from a file through psql in the container; returns output lines. -Single wraps it in one transaction.
function Invoke-Psql([string]$File, [switch]$Rows) {
  $target = if ($Rehearsal) { "host.docker.internal" } else { $DbHost }
  $dockerArgs = @("run", "--rm", "-i", "-e", "PGPASSWORD", $Image, "psql", "-h", $target, "-p", "$DbPort", "-U", $DbUser, "-d", $DbName, "-v", "ON_ERROR_STOP=1", "-X", "-q")
  if ($Rows) { $dockerArgs += @("-A", "-t", "-F", "|") }
  $ErrorActionPreference = "Continue"
  $out = Get-Content -Raw -Encoding UTF8 $File | & docker @dockerArgs 2>&1 | ForEach-Object { "$_" }
  $code = $LASTEXITCODE
  $ErrorActionPreference = "Stop"
  return [pscustomobject]@{ Code = $code; Lines = @($out) }
}
function Get-Present() {
  $r = Invoke-Psql (Join-Path $Repo "scripts\release\check-production-schema.sql") -Rows
  if ($r.Code -ne 0) { throw "schema check failed: $($r.Lines -join ' ')" }
  $present = @{}
  foreach ($l in $r.Lines) { $p = $l -split '\|'; if ($p.Count -eq 3) { $present[$p[0]] = ($p[2] -eq 't') } }
  return $present
}
function Get-Counts() {
  $tmp = New-TemporaryFile
  Set-Content -Path $tmp -Encoding UTF8 -Value "SELECT 'articles', count(*) FROM public.articles UNION ALL SELECT 'insights', count(*) FROM public.insights UNION ALL SELECT 'subscribers', count(*) FROM public.subscribers UNION ALL SELECT 'cardnews', count(*) FROM public.cardnews UNION ALL SELECT 'insight_sessions', count(*) FROM public.insight_sessions UNION ALL SELECT 'auth users', count(*) FROM auth.users;"
  try { $r = Invoke-Psql $tmp -Rows } finally { Remove-Item $tmp }
  if ($r.Code -ne 0) { throw "count query failed: $($r.Lines -join ' ')" }
  $c = [ordered]@{}; foreach ($l in $r.Lines) { $p = $l -split '\|'; if ($p.Count -eq 2) { $c[$p[0]] = [int]$p[1] } }
  return $c
}

try {
  if ($Rehearsal) {
    if ($DbHost -notin @("127.0.0.1", "localhost")) { throw "-Rehearsal only runs against a loopback database, not $DbHost." }
  } else {
    if ($TestPassword) { throw "-TestPassword is for -Rehearsal only." }
    if ($DbUser -ne "postgres.$ProdRef" -or $DbHost -notmatch '\.pooler\.supabase\.com$') { throw "Production mode only migrates $ProdRef through its Session pooler." }
  }
  docker info *> $null
  if ($LASTEXITCODE -ne 0) { throw "Docker Desktop is not running." }
  $target = if ($Rehearsal) { "REHEARSAL (loopback $DbHost)" } else { "PRODUCTION $ProdRef" }
  Write-Log "waiting for the database password ($target) - migrations $($Batch -join ', ')"
  $pw = Read-DbPassword "MarkLens migrations - $target" "Database password for $DbUser@$DbHost`n(Supabase -> Project Settings -> Database). Only the password." $TestPassword
  if ($pw) { $pw = $pw.Trim() }
  if (-not $pw) { throw "No password entered (window cancelled or empty). Nothing was changed." }
  $script:secrets = @($pw, [uri]::EscapeDataString($pw))
  if (-not $Rehearsal) {
    $check = Test-ProductionConnection "postgresql://${DbUser}:$([uri]::EscapeDataString($pw))@${DbHost}:${DbPort}/${DbName}" $ProdRef
    if ($check.Problem) { throw "Connection refused: $($check.Problem). Nothing was changed." }
  }
  $env:PGPASSWORD = $pw

  $present = Get-Present
  $countsBefore = Get-Counts
  Write-Log "before: present $((@($present.Keys | Where-Object { $present[$_] }) | Sort-Object) -join ' ')"
  Write-Log "before: counts $(($countsBefore.GetEnumerator() | ForEach-Object { "$($_.Key)=$($_.Value)" }) -join ', ')"
  foreach ($n in $Batch) {
    if ($present[$n]) { Write-Log "$n already applied - skipped"; continue }
    $file = Get-ChildItem (Join-Path $Repo "supabase\migrations") -Filter "${n}_*.sql" | Select-Object -First 1
    Write-Log "applying $($file.Name) ..."
    $r = Invoke-Psql $file.FullName
    $r.Lines | Where-Object { $_ -match 'ERROR|FATAL|NOTICE' } | ForEach-Object { Write-Log "  $_" }
    if ($r.Code -ne 0) { throw "$($file.Name) failed (exit $($r.Code)) - stopped here; later files were not run. The file itself rolled back (BEGIN/COMMIT)." }
    $now = Get-Present
    if (-not $now[$n]) { throw "$($file.Name) ran but the schema check does not show $n - stopped." }
    Write-Log "$n applied and confirmed"
  }
  $after = Get-Present
  $countsAfter = Get-Counts
  Write-Log "after: present $((@($after.Keys | Where-Object { $after[$_] }) | Sort-Object) -join ' ')"
  Write-Log "after: counts $(($countsAfter.GetEnumerator() | ForEach-Object { "$($_.Key)=$($_.Value)" }) -join ', ')"
  $changed = @($countsBefore.Keys | Where-Object { $countsBefore[$_] -ne $countsAfter[$_] })
  if ($changed.Count) { Write-Log "NOTE: counts changed during the run (live traffic?): $($changed -join ', ')" }
  $missing = @($Batch | Where-Object { -not $after[$_] })
  if ($missing.Count) { throw "not applied: $($missing -join ', ')" }
  Write-Log "RESULT: migrations complete - $($Batch -join ', ') present"
} catch {
  Write-Log "RESULT: FAILED - $($_.Exception.Message)"
  exit 1
} finally {
  Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
}
