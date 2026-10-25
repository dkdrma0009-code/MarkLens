# MarkLens release (R-4 step A): back up the PRODUCTION database before any migration. Free plan = no dashboard backups,
# so this is the only restore point. Run it yourself in PowerShell from the repository root; the connection string is
# never stored and never printed. READ ONLY on the database (pg_dump in the Supabase CLI's container).
#   powershell -ExecutionPolicy Bypass -File scripts/release/backup-production.ps1 -FromClipboard [-Expect <production-readiness.csv>]
# Needs Docker Desktop running and the Session pooler connection string from Supabase -> Connect, with the password in
# place of [YOUR-PASSWORD]. -FromClipboard reads it from the clipboard and clears the clipboard; without it the string
# is typed into a hidden prompt (paste there with a right click - Ctrl+V only inserts a control character).
# Writes roles.sql, schema.sql, data.sql and manifest.json to %USERPROFILE%\MarkLens-backups\prod-<date> - outside the
# repository. Storage FILES (bucket objects) are not included.
param([string]$Expect = "", [string]$OutRoot = (Join-Path $HOME "MarkLens-backups"), [switch]$FromClipboard)
$ErrorActionPreference = "Stop"
$ProdRef = "ndehtnchkgvpjbxlkazk"
$Cli = "supabase@2.120.0"

# Checks a connection string for the production project. Returns Url (cleaned) or Problem - a reason that never
# contains the password or the full string, only its shape and the (non-secret) project ID and host.
function Test-ProductionConnection([string]$Raw, [string]$Expected) {
  if ($null -eq $Raw) { $Raw = "" }
  $fail = { param($why) [pscustomobject]@{ Url = $null; Problem = $why } }
  if ($Raw -match '[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]') {
    if ($Raw -match '^[\x00-\x1F\x7F\s]+$') { return & $fail "only a control character arrived (Ctrl+V does not paste into a hidden prompt) - use -FromClipboard, or paste with a right click" }
    return & $fail "the input contains control characters - copy the connection string again from Supabase -> Connect"
  }
  $u = $Raw.Trim()
  if ($u.Length -ge 2 -and (($u[0] -eq '"' -and $u[-1] -eq '"') -or ($u[0] -eq "'" -and $u[-1] -eq "'"))) { $u = $u.Substring(1, $u.Length - 2).Trim() }
  if ($u -eq "") { return & $fail "the input was empty (nothing was pasted) - use -FromClipboard, or paste with a right click" }
  # Supabase -> Connect also offers formats that wrap the URI (psql "postgresql://...", DATABASE_URL=postgresql://...):
  # take the URI out when there is exactly one.
  $embedded = [regex]::Matches($u, 'postgres(?:ql)?://[^\s"''`]+')
  if ($u -notmatch '^postgres(ql)?://' -and $embedded.Count -eq 1) { $u = $embedded[0].Value }
  elseif ($embedded.Count -gt 1) { return & $fail "the copied text holds $($embedded.Count) connection strings - copy only the Session pooler one" }
  if ($u -notmatch '^postgres(ql)?://') {
    if ($u -notmatch '://') { return & $fail "this is not a connection string (only a password?) - copy the whole Session pooler string from Supabase -> Connect" }
    return & $fail "the string does not start with postgresql:// - copy the Session pooler string from Supabase -> Connect"
  }
  if ($u -match '\[YOUR-PASSWORD\]') { return & $fail "the placeholder [YOUR-PASSWORD] is still in the string - replace it with the database password" }
  $m = [regex]::Match($u, '^postgres(?:ql)?://(?<user>[^:/@]+):(?<pw>.*)@(?<host>[^@:/]+)(?::(?<port>\d+))?/(?<db>[^?\s]*)')
  if (-not $m.Success) {
    if ($u -notmatch '@') { return & $fail "the string has no password@host part - copy the whole Session pooler string" }
    return & $fail "the string could not be read as user:password@host:port/database - copy it again from Supabase -> Connect"
  }
  $pw = $m.Groups['pw'].Value; $dbHost = $m.Groups['host'].Value; $user = $m.Groups['user'].Value
  if ($pw -eq "") { return & $fail "the password part is empty" }
  if ($pw.StartsWith('[') -and $pw.EndsWith(']')) { return & $fail "the password is still wrapped in [ ] - remove the brackets, keep only the password" }
  if ($pw -match '[@/?#\s]') { return & $fail "the password contains @ / ? # or a space as-is - percent-encode them, or reset to a letters-and-digits password" }
  $ref = $null
  if ($user -match '^postgres\.(?<r>[a-z0-9]{20})$') { $ref = $Matches['r'] }
  elseif ($dbHost -match '^db\.(?<r>[a-z0-9]{20})\.supabase\.co$') { $ref = $Matches['r'] }
  if (-not $ref) { return & $fail "no Supabase project ID found in the user name or host (host: $dbHost) - use the Session pooler string, whose user is postgres.<project ID>" }
  if ($ref -ne $Expected) { return & $fail "this string is for project $ref, not production ($Expected) - open the production project in Supabase and copy its string" }
  return [pscustomobject]@{ Url = $u; Problem = $null; Host = $dbHost }
}

if ($MyInvocation.InvocationName -eq '.') { return } # dot-sourced by the tests: define the function only

docker info *> $null
if ($LASTEXITCODE -ne 0) { throw "Docker Desktop is not running. Start it, wait until it says 'Engine running', then run this again." }

if ($FromClipboard) {
  $raw = Get-Clipboard -Raw
  Set-Clipboard -Value " " # do not leave the password on the clipboard
} else {
  $secure = Read-Host -AsSecureString "Production connection string (Session pooler URI with password; paste with a RIGHT CLICK)"
  $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  try { $raw = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr) } finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }
}
$check = Test-ProductionConnection $raw $ProdRef
Remove-Variable raw -ErrorAction SilentlyContinue
if ($check.Problem) { throw "Connection string refused: $($check.Problem). Nothing was dumped." }
Write-Host "production project $ProdRef via $($check.Host)"

$dir = Join-Path $OutRoot ("prod-" + (Get-Date -Format "yyyyMMdd-HHmm"))
try {
  $url = $check.Url
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
  Remove-Variable url, check -ErrorAction SilentlyContinue
}

$verify = Join-Path $PSScriptRoot "verify-backup.mjs"
if ($Expect) { & node $verify $dir --expect $Expect } else { & node $verify $dir }
if ($LASTEXITCODE -ne 0) { throw "Backup check failed - see INCOMPLETE above." }
Write-Host "`nBackup folder: $dir"
