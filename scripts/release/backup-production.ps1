# MarkLens release (R-4 step A): back up the PRODUCTION database before any migration. Free plan = no dashboard backups,
# so this is the only restore point. READ ONLY on the database (pg_dump in the Supabase CLI's container).
#   powershell -STA -ExecutionPolicy Bypass -File scripts/release/backup-production.ps1 [-Expect <readiness.csv>] [-LogFile <path>]
# A small window asks for the database password only; host, port, user and database are the production Session pooler
# below, so nothing else has to be copied. The password is never stored, never printed and masked as *** in the log.
# -Rehearsal runs the identical steps against a LOOPBACK Supabase stack (supabase start) and refuses any other host;
# -TestPassword (rehearsal only) fills the same window automatically.
# Needs Docker Desktop running. Writes roles.sql, schema.sql, data.sql and manifest.json to
# %USERPROFILE%\MarkLens-backups\prod-<date> - outside the repository. Storage FILES (bucket objects) are not included.
param(
  [string]$Expect = "",
  [string]$OutRoot = (Join-Path $HOME "MarkLens-backups"),
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

# Password window (normal Windows text box: Ctrl+V and right click both paste). Returns $null when cancelled.
function Read-DbPassword([string]$Title, [string]$Prompt, [string]$AutoFill) {
  Add-Type -AssemblyName System.Windows.Forms
  Add-Type -AssemblyName System.Drawing
  $form = New-Object System.Windows.Forms.Form
  $form.Text = $Title; $form.Width = 460; $form.Height = 190; $form.TopMost = $true; $form.StartPosition = "CenterScreen"
  $form.FormBorderStyle = "FixedDialog"; $form.MaximizeBox = $false; $form.MinimizeBox = $false
  $label = New-Object System.Windows.Forms.Label
  $label.Text = $Prompt; $label.Left = 14; $label.Top = 12; $label.Width = 420; $label.Height = 40
  $box = New-Object System.Windows.Forms.TextBox
  $box.Left = 14; $box.Top = 56; $box.Width = 416; $box.UseSystemPasswordChar = $true
  $ok = New-Object System.Windows.Forms.Button
  $ok.Text = "OK"; $ok.Left = 254; $ok.Top = 96; $ok.Width = 84; $ok.DialogResult = [System.Windows.Forms.DialogResult]::OK
  $cancel = New-Object System.Windows.Forms.Button
  $cancel.Text = "Cancel"; $cancel.Left = 346; $cancel.Top = 96; $cancel.Width = 84; $cancel.DialogResult = [System.Windows.Forms.DialogResult]::Cancel
  $form.Controls.AddRange(@($label, $box, $ok, $cancel)); $form.AcceptButton = $ok; $form.CancelButton = $cancel
  $form.Add_Shown({ $form.Activate(); $box.Focus() })
  if ($AutoFill) {
    $timer = New-Object System.Windows.Forms.Timer
    $timer.Interval = 800
    $timer.Add_Tick({ $timer.Stop(); $box.Text = $AutoFill; $ok.PerformClick() })
    $form.Add_Shown({ $timer.Start() })
  }
  $result = $form.ShowDialog()
  $value = $box.Text
  $form.Dispose()
  if ($result -ne [System.Windows.Forms.DialogResult]::OK) { return $null }
  return $value
}

if ($MyInvocation.InvocationName -eq '.') { return } # dot-sourced by the tests: define the functions only

$secrets = @()
function Write-Log([string]$Line) {
  foreach ($s in $script:secrets) { if ($s) { $Line = $Line.Replace($s, "***") } }
  Write-Host $Line
  if ($LogFile) { Add-Content -Path $LogFile -Value $Line -Encoding UTF8 }
}

try {
  if ($Rehearsal) {
    if ($DbHost -notin @("127.0.0.1", "localhost", "::1")) { throw "-Rehearsal only runs against a loopback database, not $DbHost." }
  } else {
    if ($TestPassword) { throw "-TestPassword is for -Rehearsal only." }
    if ($DbUser -ne "postgres.$ProdRef" -or $DbHost -notmatch '\.pooler\.supabase\.com$') { throw "Production mode only backs up $ProdRef through its Session pooler." }
  }
  docker info *> $null
  if ($LASTEXITCODE -ne 0) { throw "Docker Desktop is not running. Start it, wait until it says 'Engine running', then run this again." }

  $target = if ($Rehearsal) { "REHEARSAL (loopback $DbHost)" } else { "PRODUCTION $ProdRef" }
  Write-Log "waiting for the database password ($target)"
  $pw = Read-DbPassword "MarkLens backup - $target" "Database password for $DbUser@$DbHost`n(Supabase -> Project Settings -> Database). Only the password." $TestPassword
  if ($pw) { $pw = $pw.Trim() } # a pasted password often carries a space or line break; Supabase passwords have none at the ends
  if (-not $pw) { throw "No password entered (window cancelled or empty). Nothing was dumped." }
  $enc = [uri]::EscapeDataString($pw)
  $script:secrets = @($pw, $enc)
  $url = "postgresql://${DbUser}:${enc}@${DbHost}:${DbPort}/${DbName}"
  if (-not $Rehearsal) {
    $check = Test-ProductionConnection $url $ProdRef
    if ($check.Problem) { throw "Connection refused: $($check.Problem). Nothing was dumped." }
  }
  Write-Log "connecting to $DbUser@${DbHost}:$DbPort/$DbName"

  $dir = Join-Path $OutRoot ("prod-" + (Get-Date -Format "yyyyMMdd-HHmmss"))
  New-Item -ItemType Directory -Force $dir | Out-Null
  # The CLI reads .env / .env.local from its working directory and stops on any it cannot parse (a project checkout has
  # one): run it from the new, empty backup folder.
  Push-Location $dir
  try {
    # Flat string arrays: a nested array reaches npx as ONE argument ("--use-copy --data-only ...").
    $steps = [ordered]@{
      "roles.sql"  = [string[]]@("--role-only")
      "schema.sql" = [string[]]@()
      "data.sql"   = [string[]]@("--use-copy", "--data-only", "-x", "storage.buckets_vectors", "-x", "storage.vector_indexes")
    }
    foreach ($name in $steps.Keys) {
      Write-Log "dumping $name ..."
      $cliArgs = [string[]](@("--yes", $Cli, "db", "dump", "--db-url", $url, "-f", (Join-Path $dir $name)) + $steps[$name])
      # The CLI reports progress on stderr. With output redirected, Windows PowerShell 5.1 turns each stderr line into an
      # error record, which "Stop" would treat as a failure: judge the step by its exit code only.
      $ErrorActionPreference = "Continue"
      & npx @cliArgs 2>&1 | ForEach-Object { Write-Log "  $_" }
      $code = $LASTEXITCODE
      $ErrorActionPreference = "Stop"
      if ($code -ne 0) {
        Pop-Location; Push-Location $OutRoot
        Remove-Item -Recurse -Force $dir -ErrorAction SilentlyContinue # a partial dump is no restore point
        throw "$name failed (exit $code); the incomplete folder was removed. See the lines above."
      }
    }
  } finally {
    Pop-Location
    Remove-Variable url, pw, enc -ErrorAction SilentlyContinue
  }

  $verify = Join-Path $PSScriptRoot "verify-backup.mjs"
  $ErrorActionPreference = "Continue"
  if ($Expect) { & node $verify $dir --expect $Expect 2>&1 | ForEach-Object { Write-Log "$_" } } else { & node $verify $dir 2>&1 | ForEach-Object { Write-Log "$_" } }
  $code = $LASTEXITCODE
  $ErrorActionPreference = "Stop"
  if ($code -ne 0) { throw "Backup check failed - see INCOMPLETE above. Folder: $dir" }
  Write-Log "RESULT: backup complete - $dir"
} catch {
  Write-Log "RESULT: FAILED - $($_.Exception.Message)"
  exit 1
}
