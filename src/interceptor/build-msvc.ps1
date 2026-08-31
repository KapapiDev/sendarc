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

$cmake = Get-Command cmake -ErrorAction SilentlyContinue
if (-not $cmake) {
    throw "CMake was not found. Install Visual Studio 2022 with Desktop development with C++."
}

$ninja = Get-Command ninja -ErrorAction SilentlyContinue
if (-not $ninja) {
    throw "Ninja was not found. Install Ninja or use the GitHub Windows runner image."
}

# Do not depend on CMake's Visual Studio instance discovery. Some hardened
# Windows Server 2025 runner revisions have a complete VS installation but do
# not expose it as a registered generator instance. Import VsDevCmd's compiler
# environment explicitly and drive cl.exe with Ninja instead.
$vswhere = Join-Path ${env:ProgramFiles(x86)} "Microsoft Visual Studio\Installer\vswhere.exe"
$vsInstall = ""
if (Test-Path -LiteralPath $vswhere) {
    $vsInstall = (& $vswhere -latest -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath | Select-Object -First 1)
}
if (-not $vsInstall) {
    $knownInstall = Join-Path $env:ProgramFiles "Microsoft Visual Studio\2022\Enterprise"
    if (Test-Path -LiteralPath $knownInstall) {
        $vsInstall = $knownInstall
    }
}
if (-not $vsInstall) {
    throw "Visual Studio 2022 C++ tools were not found."
}

$vsDevCmd = Join-Path $vsInstall "Common7\Tools\VsDevCmd.bat"
if (-not (Test-Path -LiteralPath $vsDevCmd)) {
    throw "VsDevCmd.bat was not found at $vsDevCmd."
}
$targetArch = if ($Arch -eq "x64") { "amd64" } else { "x86" }
$environmentLines = & $env:ComSpec /s /c "`"$vsDevCmd`" -arch=$targetArch -host_arch=amd64 -no_logo && set"
if ($LASTEXITCODE -ne 0) {
    throw "VsDevCmd failed for $targetArch (exit $LASTEXITCODE)."
}
foreach ($line in $environmentLines) {
    if ($line -match '^([^=][^=]*)=(.*)$') {
        Set-Item -Path "Env:$($matches[1])" -Value $matches[2]
    }
}
if (-not (Get-Command cl.exe -ErrorAction SilentlyContinue)) {
    throw "VsDevCmd did not expose cl.exe for $targetArch."
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
    "-G", "Ninja",
    "-DCMAKE_BUILD_TYPE=$Config",
    "-DCMAKE_C_COMPILER=cl.exe",
    "-DCMAKE_CXX_COMPILER=cl.exe",
    "-DCMAKE_MAKE_PROGRAM=$($ninja.Source)",
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
