# Deploys TC2007B Edge Functions with the Supabase CLI.
#
#   .\tools\deploy-course-functions.ps1              # functions that share the sign-in guard
#   .\tools\deploy-course-functions.ps1 -All         # every course function
#   .\tools\deploy-course-functions.ps1 -Only course-auth-context, course-exit-ticket
#
# Run it from the repository root, after `npx supabase login` and `npx supabase link`.

[CmdletBinding()]
param(
  [switch]$All,
  [string[]]$Only
)

$ErrorActionPreference = "Stop"

# Everything that imports _shared/identity.ts, plus the roster function that records
# access grants. Redeploy all of these together whenever the shared guard changes:
# a function left on the old code will not recognise external access grants.
$guardFunctions = @(
  "course-auth-context",
  "course-content-access",
  "course-activity-attempt",
  "course-exit-ticket",
  "course-portfolio-entry",
  "course-student-progress",
  "course-identity-confirmation",
  "course-roster-management"
)

if (-not (Test-Path "supabase/functions")) {
  Write-Error "Run this from the repository root (the folder containing the supabase directory)."
}

if ($Only) {
  $targets = $Only
} elseif ($All) {
  $targets = Get-ChildItem "supabase/functions" -Directory |
    Where-Object { $_.Name -notlike "_*" } |
    Select-Object -ExpandProperty Name |
    Sort-Object
} else {
  $targets = $guardFunctions
}

foreach ($name in $targets) {
  if (-not (Test-Path "supabase/functions/$name/index.ts")) {
    Write-Error "No such function: $name"
  }
}

Write-Host "Deploying $($targets.Count) function(s)..." -ForegroundColor Cyan

$failed = @()
foreach ($name in $targets) {
  Write-Host "-> $name" -ForegroundColor Cyan
  npx supabase functions deploy $name
  if ($LASTEXITCODE -ne 0) {
    $failed += $name
    Write-Host "   failed" -ForegroundColor Red
  }
}

Write-Host ""
if ($failed.Count) {
  Write-Host "Failed: $($failed -join ', ')" -ForegroundColor Red
  Write-Host "Re-run just those with: .\tools\deploy-course-functions.ps1 -Only $($failed -join ', ')"
  exit 1
}

Write-Host "Deployed $($targets.Count) function(s)." -ForegroundColor Green
