# Build the production Simple MAPI provider with Microsoft's ABI toolchain.
#
# Current Windows MAPI32 stubs use XFG type-hash dispatch for legacy ANSI
# calls. MSVC is therefore the authoritative compiler for installer/release
# DLLs; build.ps1 remains available for portable local and hermetic CI tests.

param(
    [ValidateSet("x64", "x86")]
    [string]$Arch = "x64",
    [ValidateSet("Debug", "Release")]
    [string]$Config = "Release",
    [ValidatePattern('^[0-9A-Za-z][0-9A-Za-z.+-]*$')]
    [string]$Version = "",
    [switch]$Tests,
    [switch]$E2E,
    [switch]$Clean
)

$ErrorActionPreference = "Stop"

$interceptorRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$buildName = if ($E2E) { "build-e2e-$Arch" } else { "build-$Arch" }
$buildDir = Join-Path $interceptorRoot $buildName
$platform = if ($Arch -eq "x64") { "x64" } else { "Win32" }

$cmake = Get-Command cmake -ErrorAction SilentlyContinue
if (-not $cmake) {
    throw "CMake was not found. Install Visual Studio 2022 with Desktop development with C++."
}

if ($Clean -and (Test-Path -LiteralPath $buildDir)) {
    Remove-Item -LiteralPath $buildDir -Recurse -Force
}

$repoRoot = Split-Path -Parent (Split-Path -Parent $interceptorRoot)
$sendArcVersion = $Version
if (-not $sendArcVersion) {
    $packageJson = Join-Path $repoRoot "package.json"
    if (Test-Path -LiteralPath $packageJson) {
        $pkg = Get-Content -LiteralPath $packageJson -Raw | ConvertFrom-Json
        $sendArcVersion = $pkg.version
    }
}
if (-not $sendArcVersion) {
    $sendArcVersion = "0.0.0-dev"
}

Write-Host "================================"
Write-Host "  SendArc Production MAPI Build"
Write-Host "  (MSVC + CFG/XFG + static CRT)"
Write-Host "  Arch: $Arch"
Write-Host "================================"

$configureArgs = @(
    "-G", "Visual Studio 17 2022",
    "-A", $platform,
    "-DBUILD_TESTS=$(if ($Tests) { 'ON' } else { 'OFF' })",
    "-DSENDARC_E2E=$(if ($E2E) { 'ON' } else { 'OFF' })",
    "-DSENDARC_VERSION=$sendArcVersion",
    "-S", $interceptorRoot,
    "-B", $buildDir
)

& $cmake.Source @configureArgs
if ($LASTEXITCODE -ne 0) {
    throw "MSVC CMake configuration failed (exit $LASTEXITCODE)."
}

& $cmake.Source --build $buildDir --config $Config
if ($LASTEXITCODE -ne 0) {
    throw "MSVC build failed (exit $LASTEXITCODE)."
}

$provider = Join-Path $buildDir "bin\SendArc.dll"
if (-not (Test-Path -LiteralPath $provider)) {
    throw "MSVC build did not produce $provider."
}
if ($Tests) {
    $harness = Join-Path $buildDir "bin\SendArc-test-harness.exe"
    if (-not (Test-Path -LiteralPath $harness)) {
        throw "MSVC build did not produce $harness."
    }
}

Write-Host "Production provider built: $provider"
