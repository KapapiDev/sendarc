<#
.SYNOPSIS
  Drives the real NSIS installer and uninstaller UI on an ephemeral Windows runner.

.DESCRIPTION
  This is deliberately separate from installer.Tests.ps1. The Pester suite proves
  machine state and MAPI routing with the supported silent mode; this script proves
  that the visible Welcome, License, Directory, Install, Finish, Uninstall, and Close
  controls can complete the same round trip.

  The script writes HKLM and Program Files and must only run on a disposable,
  administrator Windows CI runner. A precise finally block removes SendArc and
  restores the runner's original default mail client if a UI assertion fails.
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory)]
    [string]$SetupExe,

    [ValidateRange(10, 600)]
    [int]$UiTimeoutSeconds = 240
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = [Security.Principal.WindowsPrincipal]::new($identity)
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    throw 'Interactive installer acceptance requires an administrator disposable Windows runner.'
}

$setupPath = (Resolve-Path -LiteralPath $SetupExe -ErrorAction Stop).Path
$installDir = Join-Path $env:ProgramFiles 'SendArc'
$appPath = Join-Path $installDir 'SendArc.exe'
$uninstallerPath = Join-Path $installDir 'uninstall.exe'
$mailSubkey = 'SOFTWARE\Clients\Mail'
$sendArcSubkey = "$mailSubkey\SendArc"
$uninstallSubkey = 'SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\SendArc'
$fixtureName = 'SendArc Interactive Previous Client'

Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes

$script:buttonCondition = [System.Windows.Automation.PropertyCondition]::new(
    [System.Windows.Automation.AutomationElement]::ControlTypeProperty,
    [System.Windows.Automation.ControlType]::Button
)

function Find-SendArcButton {
    param(
        [Parameter(Mandatory)]
        [string[]]$Names,
        [Parameter(Mandatory)]
        [datetime]$Deadline
    )

    $normalizedNames = @($Names | ForEach-Object { ($_ -replace '&', '').Trim() })
    do {
        $windows = [System.Windows.Automation.AutomationElement]::RootElement.FindAll(
            [System.Windows.Automation.TreeScope]::Children,
            [System.Windows.Automation.Condition]::TrueCondition
        )
        for ($windowIndex = 0; $windowIndex -lt $windows.Count; $windowIndex++) {
            $window = $windows.Item($windowIndex)
            $title = $window.Current.Name
            if ($title -notmatch 'SendArc') { continue }

            $buttons = $window.FindAll(
                [System.Windows.Automation.TreeScope]::Subtree,
                $script:buttonCondition
            )
            for ($buttonIndex = 0; $buttonIndex -lt $buttons.Count; $buttonIndex++) {
                $button = $buttons.Item($buttonIndex)
                $normalizedButtonName = ($button.Current.Name -replace '&', '').Trim()
                if ($normalizedNames -contains $normalizedButtonName -and $button.Current.IsEnabled) {
                    return [pscustomobject]@{
                        Button = $button
                        ButtonName = $button.Current.Name
                        WindowTitle = $title
                    }
                }
            }
        }
        Start-Sleep -Milliseconds 200
    } while ((Get-Date) -lt $Deadline)

    $visibleTitles = @()
    $visibleButtons = @()
    $windows = [System.Windows.Automation.AutomationElement]::RootElement.FindAll(
        [System.Windows.Automation.TreeScope]::Children,
        [System.Windows.Automation.Condition]::TrueCondition
    )
    for ($index = 0; $index -lt $windows.Count; $index++) {
        $title = $windows.Item($index).Current.Name
        if ($title) { $visibleTitles += $title }
        if ($title -match 'SendArc') {
            $buttons = $windows.Item($index).FindAll(
                [System.Windows.Automation.TreeScope]::Subtree,
                $script:buttonCondition
            )
            for ($buttonIndex = 0; $buttonIndex -lt $buttons.Count; $buttonIndex++) {
                $button = $buttons.Item($buttonIndex)
                $visibleButtons += "'$($button.Current.Name)' (enabled=$($button.Current.IsEnabled))"
            }
        }
    }
    throw "Timed out waiting for SendArc UI button [$($Names -join ', ')]. Visible windows: $($visibleTitles -join ' | '). SendArc buttons: $($visibleButtons -join ' | ')"
}

function Invoke-SendArcButton {
    param(
        [Parameter(Mandatory)]
        [string[]]$Names,
        [int]$TimeoutSeconds = 60
    )

    $match = Find-SendArcButton -Names $Names -Deadline (Get-Date).AddSeconds($TimeoutSeconds)
    $pattern = [System.Windows.Automation.InvokePattern]$match.Button.GetCurrentPattern(
        [System.Windows.Automation.InvokePattern]::Pattern
    )
    Write-Host "[interactive-installer] $($match.WindowTitle): invoking '$($match.ButtonName)'"
    $pattern.Invoke()
    Start-Sleep -Milliseconds 350
}

function Wait-SendArcWindow {
    param(
        [Parameter(Mandatory)]
        [System.Diagnostics.Process]$Process,
        [int]$TimeoutSeconds = 30
    )

    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    do {
        $Process.Refresh()
        if ($Process.HasExited) {
            throw "SendArc exited before presenting its main window (exit $($Process.ExitCode))."
        }
        if ($Process.MainWindowHandle -ne [IntPtr]::Zero) {
            Write-Host "[interactive-installer] SendArc application window opened (PID $($Process.Id))."
            return
        }
        Start-Sleep -Milliseconds 200
    } while ((Get-Date) -lt $deadline)
    throw 'Timed out waiting for the installed SendArc application window.'
}

function Get-MailState {
    $base = [Microsoft.Win32.RegistryKey]::OpenBaseKey(
        [Microsoft.Win32.RegistryHive]::LocalMachine,
        [Microsoft.Win32.RegistryView]::Registry64
    )
    try {
        $mail = $base.CreateSubKey($mailSubkey, $true)
        try {
            return [pscustomobject]@{
                Present = $mail.GetValueNames() -contains ''
                Value = $mail.GetValue('', $null, [Microsoft.Win32.RegistryValueOptions]::DoNotExpandEnvironmentNames)
            }
        } finally {
            $mail.Dispose()
        }
    } finally {
        $base.Dispose()
    }
}

$original = Get-MailState
$fixtureCreated = $false

try {
    $base = [Microsoft.Win32.RegistryKey]::OpenBaseKey(
        [Microsoft.Win32.RegistryHive]::LocalMachine,
        [Microsoft.Win32.RegistryView]::Registry64
    )
    try {
        $mail = $base.CreateSubKey($mailSubkey, $true)
        try {
            $existingFixture = $mail.OpenSubKey($fixtureName)
            if ($null -ne $existingFixture) {
                $existingFixture.Dispose()
                throw "Refusing to overwrite pre-existing mail client fixture '$fixtureName'."
            }
            $fixture = $mail.CreateSubKey($fixtureName, $true)
            try {
                $fixture.SetValue('', $fixtureName, [Microsoft.Win32.RegistryValueKind]::String)
            } finally {
                $fixture.Dispose()
            }
            $fixtureCreated = $true
            $mail.SetValue('', $fixtureName, [Microsoft.Win32.RegistryValueKind]::String)
        } finally {
            $mail.Dispose()
        }
    } finally {
        $base.Dispose()
    }

    Write-Host "[interactive-installer] Starting visible installer: $setupPath"
    $null = Start-Process -FilePath $setupPath -PassThru
    Invoke-SendArcButton -Names @('Next >', 'Next')
    Invoke-SendArcButton -Names @('I Agree')
    Invoke-SendArcButton -Names @('Install')
    Invoke-SendArcButton -Names @('Finish') -TimeoutSeconds $UiTimeoutSeconds

    if (-not (Test-Path -LiteralPath $appPath -PathType Leaf)) {
        throw "Interactive install did not create $appPath"
    }
    if (-not (Test-Path -LiteralPath $uninstallerPath -PathType Leaf)) {
        throw "Interactive install did not create $uninstallerPath"
    }

    $base = [Microsoft.Win32.RegistryKey]::OpenBaseKey(
        [Microsoft.Win32.RegistryHive]::LocalMachine,
        [Microsoft.Win32.RegistryView]::Registry64
    )
    try {
        $mail = $base.OpenSubKey($mailSubkey)
        $handler = $base.OpenSubKey($sendArcSubkey)
        $uninstall = $base.OpenSubKey($uninstallSubkey)
        try {
            if ($mail.GetValue('', $null) -ne 'SendArc') { throw 'Interactive install did not set SendArc as the default mail client.' }
            if ($null -eq $handler) { throw 'Interactive install did not create the SendArc MAPI handler key.' }
            if ($null -eq $uninstall) { throw 'Interactive install did not create Add/Remove Programs metadata.' }
            if ($uninstall.GetValue('URLInfoAbout', '') -ne 'https://kapapi.dev/sendarc/') {
                throw 'Interactive install wrote an unexpected product information URL.'
            }
        } finally {
            if ($null -ne $uninstall) { $uninstall.Dispose() }
            if ($null -ne $handler) { $handler.Dispose() }
            if ($null -ne $mail) { $mail.Dispose() }
        }
    } finally {
        $base.Dispose()
    }

    $app = Start-Process -FilePath $appPath -PassThru
    Wait-SendArcWindow -Process $app
    Stop-Process -Id $app.Id -Force
    $app.WaitForExit(15000) | Out-Null

    Write-Host "[interactive-installer] Starting visible uninstaller: $uninstallerPath"
    $null = Start-Process -FilePath $uninstallerPath -PassThru
    Invoke-SendArcButton -Names @('Uninstall')
    Invoke-SendArcButton -Names @('Close') -TimeoutSeconds $UiTimeoutSeconds

    if (Test-Path -LiteralPath $appPath) { throw 'Interactive uninstall left SendArc.exe installed.' }
    $restored = Get-MailState
    if (-not $restored.Present -or $restored.Value -ne $fixtureName) {
        throw "Interactive uninstall did not restore the previous mail client; got '$($restored.Value)'."
    }

    Write-Host '[interactive-installer] PASS: visible install, app launch, visible uninstall, and previous-handler restoration completed.'
} finally {
    Get-Process -Name SendArc -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue

    if (Test-Path -LiteralPath $uninstallerPath -PathType Leaf) {
        Write-Warning '[interactive-installer] UI flow did not fully uninstall; running silent cleanup on the ephemeral runner.'
        Start-Process -FilePath $uninstallerPath -ArgumentList '/S' -Wait | Out-Null
    }

    $base = [Microsoft.Win32.RegistryKey]::OpenBaseKey(
        [Microsoft.Win32.RegistryHive]::LocalMachine,
        [Microsoft.Win32.RegistryView]::Registry64
    )
    try {
        $mail = $base.CreateSubKey($mailSubkey, $true)
        try {
            if ($fixtureCreated) { $mail.DeleteSubKeyTree($fixtureName, $false) }
            if ($original.Present) {
                $mail.SetValue('', [string]$original.Value, [Microsoft.Win32.RegistryValueKind]::String)
            } else {
                $mail.DeleteValue('', $false)
            }
        } finally {
            $mail.Dispose()
        }
    } finally {
        $base.Dispose()
    }
}
