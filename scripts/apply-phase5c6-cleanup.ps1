$ErrorActionPreference = "Stop"
$root = Resolve-Path (Join-Path $PSScriptRoot "..")
Push-Location $root
try {
  node scripts/apply-phase5c6-cleanup.mjs
} finally {
  Pop-Location
}
