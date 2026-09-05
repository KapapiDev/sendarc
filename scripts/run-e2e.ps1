<#
.SYNOPSIS
  Build the e2e-tagged Wails binary and run the Playwright suite.

.DESCRIPTION
  Builds a test-only x64 Simple MAPI interceptor plus
  src/app/build/bin/SendArc.exe with -tags e2e and ldflags-injected fake
  OAuth credentials. Then invokes `npm run e2e` from the repo root.

.PARAMETER NoBuild
  Skip both native and Wails build steps. Use when iterating on test code;
  the previously built binaries must still exist at their expected paths.

.PARAMETER InstallDeps
  Run `npm ci` before testing. The first invocation on a fresh clone
  needs this to fetch the Playwright client library. The suite connects to
  Wails' WebView2 instance and does not download a separate browser.

.PARAMETER SkipNativeBuild
  Use a prebuilt test-only x64 interceptor and harness under
  src/interceptor/build-e2e-x64/bin. CI downloads these from the interceptor
  matrix so it does not install the native toolchain twice.
#>
[CmdletBinding()]
param(
  [switch]$NoBuild,
  [switch]$InstallDeps,
  [switch]$SkipNativeBuild
)

$ErrorActionPreference = 'Stop'
$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
Set-Location $repoRoot

if ($InstallDeps) {
  Write-Host '[run-e2e] npm ci (root workspaces)...' -ForegroundColor Cyan
  npm ci
  if ($LASTEXITCODE -ne 0) { throw "npm ci failed ($LASTEXITCODE)" }
}

if (-not $NoBuild -and -not $SkipNativeBuild) {
  Write-Host '[run-e2e] building test-only x64 MAPI interceptor...' -ForegroundColor Cyan
  Push-Location (Join-Path $repoRoot 'src/interceptor')
  try {
    & powershell -NoProfile -ExecutionPolicy Bypass -File .\build.ps1 `
      -Arch x64 -Config Release -Version e2e -Tests -E2E -Clean
    if ($LASTEXITCODE -ne 0) { throw "native E2E build failed ($LASTEXITCODE)" }
  } finally {
    Pop-Location
  }
}

if (-not $NoBuild) {
  Write-Host '[run-e2e] building e2e-tagged Wails binary...' -ForegroundColor Cyan
  Push-Location (Join-Path $repoRoot 'src/app')
  try {
    # ldflags injects fake OAuth creds so checkOAuthCredentials() passes.
    # The values are clearly-fake markers (T-11-06-02 mitigation).
    $ldflags = @(
      '-X', 'main.Version=e2e',
      '-X', 'main.oauthClientID=e2e-fake-client-do-not-use',
      '-X', 'main.oauthClientSecret=e2e-fake-secret-do-not-use',
      '-s', '-w'
    ) -join ' '

    & wails build -v 0 -platform windows/amd64 -tags e2e -ldflags $ldflags -clean
    if ($LASTEXITCODE -ne 0) { throw "wails build failed ($LASTEXITCODE)" }
  } finally {
    Pop-Location
  }
}

$binary = Join-Path $repoRoot 'src/app/build/bin/SendArc.exe'
if (-not (Test-Path $binary)) {
  throw "expected $binary after build but it does not exist"
}
Write-Host "[run-e2e] binary at $binary" -ForegroundColor Green

$nativeDir = Join-Path $repoRoot 'src/interceptor/build-e2e-x64/bin'
foreach ($nativeName in @('SendArc.dll', 'SendArc-test-harness.exe')) {
  $nativePath = Join-Path $nativeDir $nativeName
  if (-not (Test-Path $nativePath)) {
    throw "expected native E2E artifact $nativePath but it does not exist"
  }
}
Write-Host "[run-e2e] native MAPI probe at $nativeDir" -ForegroundColor Green

# Belt-and-braces: kill only an orphan whose executable path is the e2e build.
# Never terminate a separately installed SendArc instance.
Get-CimInstance Win32_Process -Filter "Name='SendArc.exe'" -ErrorAction SilentlyContinue |
  Where-Object { $_.ExecutablePath -eq $binary } |
  ForEach-Object {
    Write-Host "[run-e2e] killing orphan e2e SendArc.exe pid=$($_.ProcessId)" -ForegroundColor Yellow
    Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
  }

Write-Host '[run-e2e] running Playwright...' -ForegroundColor Cyan
npm run e2e
$exitCode = $LASTEXITCODE

# Final path-filtered cleanup pass for a test that crashed mid-run.
Get-CimInstance Win32_Process -Filter "Name='SendArc.exe'" -ErrorAction SilentlyContinue |
  Where-Object { $_.ExecutablePath -eq $binary } |
  ForEach-Object {
    Write-Host "[run-e2e] post-run cleanup pid=$($_.ProcessId)" -ForegroundColor Yellow
    Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
  }

exit $exitCode
