[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [string]$ProductionDLL,
  [Parameter(Mandatory = $true)]
  [string]$E2EDLL
)

$ErrorActionPreference = 'Stop'

function Test-ByteSequence {
  param(
    [byte[]]$Data,
    [byte[]]$Needle
  )
  if ($Needle.Length -eq 0 -or $Data.Length -lt $Needle.Length) { return $false }
  for ($i = 0; $i -le $Data.Length - $Needle.Length; $i++) {
    if ($Data[$i] -ne $Needle[0]) { continue }
    $matches = $true
    for ($j = 1; $j -lt $Needle.Length; $j++) {
      if ($Data[$i + $j] -ne $Needle[$j]) {
        $matches = $false
        break
      }
    }
    if ($matches) { return $true }
  }
  return $false
}

$productionPath = (Resolve-Path -LiteralPath $ProductionDLL).Path
$e2ePath = (Resolve-Path -LiteralPath $E2EDLL).Path
$marker = [Text.Encoding]::Unicode.GetBytes('SENDARC_E2E_QUEUE_DIR')
$productionHasHook = Test-ByteSequence ([IO.File]::ReadAllBytes($productionPath)) $marker
$e2eHasHook = Test-ByteSequence ([IO.File]::ReadAllBytes($e2ePath)) $marker

if ($productionHasHook) {
  throw 'Production interceptor contains the test-only queue-redirection marker.'
}
if (-not $e2eHasHook) {
  throw 'E2E interceptor does not contain the expected queue-redirection marker.'
}

Write-Host 'Native E2E hook isolation verified: production=absent, e2e=present.' -ForegroundColor Green
