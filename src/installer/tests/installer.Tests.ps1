# src/installer/tests/installer.Tests.ps1
# Pester 5 smoke test — install, coexistence, upgrade, and uninstall coverage.
#
# Pester 5 idioms only: New-PesterConfiguration, Describe/Context/It, Should -BeTrue/-BeFalse.
# Pester 4 EnableExit switch is forbidden (D-30).
#
# MUST run on an ephemeral CI runner (windows-2025) — this suite invokes
# SendArc-setup.exe /S /D=... which actually writes to HKLM, ProgramFiles,
# Start Menu, and Windows Firewall. Running on a developer workstation will
# modify the system.
#
# D-21 item coverage (13 items, split across two Context blocks):
#   Silent install:   1 (exit code), 2 (binaries), 3 (MAPI key + DLLPath),
#                     4 (backup JSON shape), 5 (shortcut + AUMID),
#                     6 (firewall rule present)
#   Silent uninstall: 7 (exit code), 8 (install dir gone), 9 (MAPI key gone),
#                     10 (firewall rule gone), 11 (%APPDATA% gone),
#                     12 (Credential Manager scrubbed), 13 (shortcut gone)
#
# Cross-plan literal contract (byte-for-byte match with 10-03 + 10-04):
#   AUMID         = app.sendarc.desktop    (NOT app.sendarc.desktop.dev)
#   Firewall rule = SendArc OAuth loopback   (match 10-03 AddFirewallRule + 10-04 RemoveFirewallRule)
#   Cred target   = SendArc:oauth-tokens     (COLON separator — zalando/go-keyring Windows backend)

BeforeAll {
    # Dot-source the AUMID reader helper (defines Get-ShortcutAumid + .NET types).
    . "$PSScriptRoot\AumidReader.ps1"

    # FileVersionInfo does not expose UTF-16 (code page 1200) string tables on
    # every supported PowerShell/.NET combination. Query the standard Windows
    # VERSIONINFO resource directly so CI verifies what Explorer consumes.
    if ($null -eq ('SendArcVersionResource' -as [type])) {
        Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;

public static class SendArcVersionResource
{
    [DllImport("version.dll", CharSet = CharSet.Unicode)]
    private static extern uint GetFileVersionInfoSizeW(string path, out uint handle);

    [DllImport("version.dll", CharSet = CharSet.Unicode)]
    private static extern bool GetFileVersionInfoW(string path, uint handle, uint length, byte[] data);

    [DllImport("version.dll", CharSet = CharSet.Unicode)]
    private static extern bool VerQueryValueW(byte[] block, string subBlock, out IntPtr value, out uint length);

    public static string ReadString(string path, string key)
    {
        uint handle;
        uint size = GetFileVersionInfoSizeW(path, out handle);
        if (size == 0) return null;

        byte[] data = new byte[size];
        if (!GetFileVersionInfoW(path, 0, size, data)) return null;

        IntPtr translation;
        uint translationLength;
        if (!VerQueryValueW(data, @"\VarFileInfo\Translation", out translation, out translationLength) || translationLength < 4)
            return null;

        ushort language = (ushort)Marshal.ReadInt16(translation, 0);
        ushort codePage = (ushort)Marshal.ReadInt16(translation, 2);
        string query = string.Format(@"\StringFileInfo\{0:X4}{1:X4}\{2}", language, codePage, key);

        IntPtr value;
        uint valueLength;
        if (!VerQueryValueW(data, query, out value, out valueLength) || valueLength == 0)
            return null;
        return Marshal.PtrToStringUni(value, (int)valueLength - 1);
    }
}
'@
    }

    # The installer binary is produced by the CI workflow (installer-smoke.yml)
    # via `makensis src\installer\SendArc.nsi` at the repo root.
    # Path resolution:
    #   From src/installer/tests/installer.Tests.ps1 ..\..\..\ = repo root
    $script:SetupExe     = Join-Path $PSScriptRoot '..\..\..\SendArc-setup.exe' | Resolve-Path -ErrorAction Stop | ForEach-Object Path
    $script:InstallDir   = "$env:ProgramFiles\SendArc"
    $script:ProgramData  = "$env:ProgramData\SendArc"
    $script:BackupJson   = "$script:ProgramData\uninst\previous-mail-client.json"
    $script:MapiKey      = 'HKLM:\SOFTWARE\Clients\Mail\SendArc'
    $script:MailKey      = 'HKLM:\SOFTWARE\Clients\Mail'
    $script:UninstallKey = 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\SendArc'
    $script:Shortcut     = "$env:ProgramData\Microsoft\Windows\Start Menu\Programs\SendArc.lnk"
    $script:FirewallRule = 'SendArc OAuth loopback'
    $script:ExpectedAumid = 'app.sendarc.desktop'
    $script:CredTarget   = 'SendArc:oauth-tokens'
    # QUICK-260423-ntu T3d — dual-bitness install surfaces
    $script:InstallDir32 = "${env:ProgramFiles(x86)}\SendArc"

    # Phase 11.1 D-03 / D-18 case 4: %APPDATA% path is the negative-assertion target.
    # The %ProgramData% path is already $script:Shortcut (set by Phase 10).
    $script:AppDataLnk = Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs\SendArc.lnk'

    # SendArc beta is notify-only: installing must not create an unattended updater.
    $script:TaskName    = 'SendArc Auto Update'

    # Coexistence fixtures. These deliberately model the three cases from the
    # product brief: Affixa, upstream go-mapi, and another default mail client.
    # We record exactly which keys this run created and remove only those in
    # AfterAll, so a pre-existing runner state is never destroyed.
    $script:CoexistenceClients = @('Affixa', 'go-mapi', 'SendArc Test Previous Client')
    $script:CreatedCoexistenceClients = @()
    $base = [Microsoft.Win32.RegistryKey]::OpenBaseKey(
        [Microsoft.Win32.RegistryHive]::LocalMachine,
        [Microsoft.Win32.RegistryView]::Registry64
    )
    $mail = $null
    try {
        $mail = $base.CreateSubKey('SOFTWARE\Clients\Mail', $true)
        $script:OriginalDefaultMailClient = $mail.GetValue('', $null)
        foreach ($client in $script:CoexistenceClients) {
            $existing = $mail.OpenSubKey($client)
            if ($null -ne $existing) {
                $existing.Dispose()
                continue
            }
            $fixture = $mail.CreateSubKey($client, $true)
            $fixture.SetValue('', $client, [Microsoft.Win32.RegistryValueKind]::String)
            $fixture.Dispose()
            $script:CreatedCoexistenceClients += $client
        }
        $mail.SetValue('', 'SendArc Test Previous Client', [Microsoft.Win32.RegistryValueKind]::String)
    } finally {
        if ($null -ne $mail) { $mail.Dispose() }
        $base.Dispose()
    }

    Write-Host ("[Setup] SetupExe    = {0}" -f $script:SetupExe)
    Write-Host ("[Setup] InstallDir  = {0}" -f $script:InstallDir)
    Write-Host ("[Setup] ProgramData = {0}" -f $script:ProgramData)
    Write-Host ("[Setup] CredTarget  = {0}" -f $script:CredTarget)
}

AfterAll {
    # Restore the runner's original default and remove only fixture keys that
    # this test created. The runner is ephemeral, but keeping teardown precise
    # proves the same non-destructive discipline expected of the product.
    $base = [Microsoft.Win32.RegistryKey]::OpenBaseKey(
        [Microsoft.Win32.RegistryHive]::LocalMachine,
        [Microsoft.Win32.RegistryView]::Registry64
    )
    $mail = $null
    try {
        $mail = $base.CreateSubKey('SOFTWARE\Clients\Mail', $true)
        if ($null -eq $script:OriginalDefaultMailClient) {
            $mail.DeleteValue('', $false)
        } else {
            $mail.SetValue('', $script:OriginalDefaultMailClient, [Microsoft.Win32.RegistryValueKind]::String)
        }
        foreach ($client in $script:CreatedCoexistenceClients) {
            $mail.DeleteSubKeyTree($client, $false)
        }
    } finally {
        if ($null -ne $mail) { $mail.Dispose() }
        $base.Dispose()
    }
}

Describe "SendArc installer round-trip" {

    Context "Silent install" {
        # D-21 item 1
        It "1. silent install exits 0 with /S /D=<InstallDir>" {
            # NSIS /D= must be the LAST argument and NOT quoted (per RESEARCH Pitfall 5).
            # PowerShell's -ArgumentList array form preserves the token correctly.
            $proc = Start-Process -FilePath $script:SetupExe -ArgumentList '/S',"/D=$($script:InstallDir)" -Wait -PassThru
            $proc.ExitCode | Should -Be 0
        }

        # D-21 item 2
        It "2. SendArc.exe and SendArc.dll are deposited in InstallDir" {
            $appExe = Join-Path $script:InstallDir 'SendArc.exe'
            Test-Path $appExe | Should -BeTrue
            Test-Path (Join-Path $script:InstallDir 'SendArc.dll') | Should -BeTrue

            [SendArcVersionResource]::ReadString($appExe, 'ProductName') | Should -Be 'SendArc'
            [SendArcVersionResource]::ReadString($appExe, 'CompanyName') | Should -Be '장형진'
            [SendArcVersionResource]::ReadString($appExe, 'ProductVersion') | Should -Be '0.1.0.0'
        }

        It "2b. installed license and dependency inventory bundle is complete" {
            $licenseDir = Join-Path $script:InstallDir 'licenses'
            foreach ($name in @(
                'LICENSE.txt',
                'THIRD_PARTY_NOTICES.md',
                'DEPENDENCY_INVENTORY.md',
                'go-runtime.csv',
                'npm-workspace.csv',
                'npm-website.csv',
                'installer-payloads.csv'
            )) {
                Test-Path (Join-Path $licenseDir $name) | Should -BeTrue
            }
            Get-Content (Join-Path $licenseDir 'LICENSE.txt') -Raw | Should -Match 'GNU LESSER GENERAL PUBLIC LICENSE'
            Get-Content (Join-Path $licenseDir 'THIRD_PARTY_NOTICES.md') -Raw | Should -Match 'Third-party notices'
        }

        # D-21 item 3
        It "3. HKLM MAPI handler key is registered with expandable DLLPath" {
            Test-Path $script:MapiKey | Should -BeTrue
            $base = [Microsoft.Win32.RegistryKey]::OpenBaseKey(
                [Microsoft.Win32.RegistryHive]::LocalMachine,
                [Microsoft.Win32.RegistryView]::Registry64
            )
            $key = $null
            try {
                $key = $base.OpenSubKey('SOFTWARE\Clients\Mail\SendArc')
                $key.GetValueKind('DLLPath') | Should -Be ([Microsoft.Win32.RegistryValueKind]::ExpandString)
                $raw = $key.GetValue(
                    'DLLPath',
                    $null,
                    [Microsoft.Win32.RegistryValueOptions]::DoNotExpandEnvironmentNames
                )
                $raw | Should -Be '%PROGRAMFILES%\SendArc\SendArc.dll'
            } finally {
                if ($null -ne $key) { $key.Dispose() }
                $base.Dispose()
            }
            # (Default) value read via Get-ItemProperty with '(default)' property name
            (Get-ItemProperty -Path $script:MapiKey -Name '(default)').'(default)' | Should -Be 'SendArc'
        }

        # D-21 item 4
        It "4. previous-mail-client.json backup exists and parses with required fields" {
            Test-Path $script:BackupJson | Should -BeTrue
            $json = Get-Content $script:BackupJson -Raw | ConvertFrom-Json
            $json.PSObject.Properties.Name | Should -Contain 'previousClient'
            $json.PSObject.Properties.Name | Should -Contain 'backedUpAt'
            # PowerShell 7 may deserialize an ISO-8601 JSON string directly to
            # DateTime, so validate parseability instead of its runtime type.
            $parsedTimestamp = [DateTimeOffset]::MinValue
            [DateTimeOffset]::TryParse([string]$json.backedUpAt, [ref]$parsedTimestamp) | Should -BeTrue
            $json.previousClient | Should -Be 'SendArc Test Previous Client'
            (Get-ItemProperty -Path $script:UninstallKey -Name 'PreviousMailClientPresent').PreviousMailClientPresent |
                Should -Be 1
            (Get-ItemProperty -Path $script:UninstallKey -Name 'PreviousMailClient').PreviousMailClient |
                Should -Be 'SendArc Test Previous Client'
        }

        It "4b. install preserves Affixa, go-mapi, and the alternate mail-client key" {
            foreach ($client in $script:CoexistenceClients) {
                Test-Path (Join-Path $script:MailKey $client) | Should -BeTrue -Because "SendArc must coexist with $client"
            }
            (Get-ItemProperty -Path $script:MailKey -Name '(default)').'(default)' | Should -Be 'SendArc'
        }

        # D-21 item 5 — AUMID stamped on shortcut
        It "5. Start Menu shortcut exists with AUMID == app.sendarc.desktop" {
            Test-Path $script:Shortcut | Should -BeTrue
            $actual = Get-ShortcutAumid -Path $script:Shortcut
            $actual | Should -Be $script:ExpectedAumid
        }

        # D-21 item 6
        It "6. Windows Firewall inbound rule 'SendArc OAuth loopback' exists" {
            $rule = Get-NetFirewallRule -DisplayName $script:FirewallRule -ErrorAction SilentlyContinue
            $rule | Should -Not -BeNullOrEmpty
            $rule.Direction | Should -Be 'Inbound'
            $rule.Action    | Should -Be 'Allow'
        }

        # QUICK-260423-ntu item 14 — install-time running-process guard (silent)
        It "14. silent install succeeds when SendArc.exe is already running in InstallDir" {
            # Pre-condition: install completed in item 1. Launch a decoy process
            # from the installed path, then re-run the installer in /S mode and
            # assert the exe is still runnable post-install (i.e. the installer
            # closed the old instance cleanly, overwrote it, and did NOT abort).
            $exe = Join-Path $script:InstallDir 'SendArc.exe'
            $decoy = Start-Process -FilePath $exe -PassThru -WindowStyle Hidden
            try {
                Start-Sleep -Seconds 1
                $proc = Start-Process -FilePath $script:SetupExe -ArgumentList '/S',"/D=$($script:InstallDir)" -Wait -PassThru
                $proc.ExitCode | Should -Be 0
                Test-Path $exe | Should -BeTrue
            } finally {
                # Belt-and-braces cleanup in case the installer did not close it
                if (-not $decoy.HasExited) { $decoy.Kill() }
            }
        }

        # QUICK-260423-ntu item 16 — x86 DLL deposited alongside x64 DLL
        It "16. SendArc.dll is deposited in both ProgramFiles and ProgramFiles(x86)" {
            Test-Path (Join-Path $script:InstallDir   'SendArc.dll') | Should -BeTrue
            Test-Path (Join-Path $script:InstallDir32 'SendArc.dll') | Should -BeTrue
        }

        # QUICK-260423-ntu item 17 — each DLL has the matching PE bitness
        It "17. x64 DLL is PE32+ and x86 DLL is PE32" {
            function Get-PeMagic($p) {
                $b = [IO.File]::ReadAllBytes($p)
                $e = [BitConverter]::ToInt32($b, 0x3C)
                return [BitConverter]::ToUInt16($b, $e + 4 + 20)
            }
            Get-PeMagic (Join-Path $script:InstallDir   'SendArc.dll') | Should -Be 0x20B
            Get-PeMagic (Join-Path $script:InstallDir32 'SendArc.dll') | Should -Be 0x10B
        }

        # QUICK-260423-ntu item 18 — shared REG_EXPAND_SZ resolves per caller bitness
        It "18. shared DLLPath resolves to the matching x64 and x86 DLL" {
            $base = [Microsoft.Win32.RegistryKey]::OpenBaseKey(
                [Microsoft.Win32.RegistryHive]::LocalMachine,
                [Microsoft.Win32.RegistryView]::Registry64
            )
            $key = $null
            try {
                $key = $base.OpenSubKey('SOFTWARE\Clients\Mail\SendArc')
                $raw = $key.GetValue(
                    'DLLPath',
                    $null,
                    [Microsoft.Win32.RegistryValueOptions]::DoNotExpandEnvironmentNames
                )
            } finally {
                if ($null -ne $key) { $key.Dispose() }
                $base.Dispose()
            }

            [Environment]::ExpandEnvironmentVariables($raw) |
                Should -Be (Join-Path $script:InstallDir 'SendArc.dll')

            $powershell32 = "$env:WINDIR\SysWOW64\WindowsPowerShell\v1.0\powershell.exe"
            # Pass the raw REG_EXPAND_SZ through the inherited environment.
            # Appending `%PROGRAMFILES%\...` as an unquoted native-command
            # argument makes Windows PowerShell parse `%` as an operator.
            $priorRawPath = $env:SENDARC_TEST_DLLPATH
            try {
                $env:SENDARC_TEST_DLLPATH = $raw
                $expanded32 = & $powershell32 -NoProfile -Command '[Environment]::ExpandEnvironmentVariables($env:SENDARC_TEST_DLLPATH)'
            } finally {
                $env:SENDARC_TEST_DLLPATH = $priorRawPath
            }
            $expanded32 | Should -Be (Join-Path $script:InstallDir32 'SendArc.dll')
        }

        # Phase 11.1 D-05 / D-18 case 3 — silent reinstall overwrites both DLLs (T4 regression)
        It "21. silent reinstall over existing install overwrites both x64 and x86 DLLs" {
            # Pre-condition: prior items already installed once into $script:InstallDir.
            # Capture both DLLs' hashes before reinstall to detect "no overwrite happened".
            $x64Path = Join-Path $script:InstallDir   'SendArc.dll'
            $x86Path = Join-Path $script:InstallDir32 'SendArc.dll'
            $x64Before = (Get-FileHash -Algorithm SHA256 -Path $x64Path).Hash
            $x86Before = (Get-FileHash -Algorithm SHA256 -Path $x86Path).Hash

            # Touch both files to a known earlier mtime so a silent skip leaves them stale.
            $staleTime = (Get-Date).AddDays(-1)
            (Get-Item $x64Path).LastWriteTime = $staleTime
            (Get-Item $x86Path).LastWriteTime = $staleTime

            # Reinstall silently WITHOUT prior uninstall — this is the T4 repro case.
            $proc = Start-Process -FilePath $script:SetupExe -ArgumentList '/S',"/D=$($script:InstallDir)" -Wait -PassThru
            $proc.ExitCode | Should -Be 0

            # NSIS preserves the packaged files' build timestamps, so compare
            # against the deliberately stale value instead of wall-clock time.
            (Get-Item $x64Path).LastWriteTime | Should -BeGreaterThan $staleTime
            (Get-Item $x86Path).LastWriteTime | Should -BeGreaterThan $staleTime

            # Hashes should match the prior install (same binaries shipped — confirms the
            # overwrite happened with a real File write rather than NSIS skipping).
            (Get-FileHash -Algorithm SHA256 -Path $x64Path).Hash | Should -Be $x64Before
            (Get-FileHash -Algorithm SHA256 -Path $x86Path).Hash | Should -Be $x86Before

            # The shared expandable path must remain intact after reinstall.
            $base = [Microsoft.Win32.RegistryKey]::OpenBaseKey(
                [Microsoft.Win32.RegistryHive]::LocalMachine,
                [Microsoft.Win32.RegistryView]::Registry64
            )
            $key = $null
            try {
                $key = $base.OpenSubKey('SOFTWARE\Clients\Mail\SendArc')
                $raw = $key.GetValue(
                    'DLLPath',
                    $null,
                    [Microsoft.Win32.RegistryValueOptions]::DoNotExpandEnvironmentNames
                )
                $raw | Should -Be '%PROGRAMFILES%\SendArc\SendArc.dll'
            } finally {
                if ($null -ne $key) { $key.Dispose() }
                $base.Dispose()
            }
        }

        # Phase 11.1 D-03 / D-18 case 4 — Start Menu shortcut location regression
        It "25. Start Menu shortcut lands at %ProgramData%\Microsoft\Windows\Start Menu\Programs (D-03 regression)" {
            # The reinstall above ensures the shortcut is in place — no extra setup needed.
            Test-Path $script:Shortcut    | Should -BeTrue  -Because "D-03: shortcut MUST be all-users (%ProgramData%)"
            Test-Path $script:AppDataLnk  | Should -BeFalse -Because "D-03: per-user shortcut MUST NOT be created (%APPDATA%)"
        }

        It "22. install does not register an unattended updater" {
            Get-ScheduledTask -TaskName $script:TaskName -ErrorAction SilentlyContinue |
                Should -BeNullOrEmpty -Because "SendArc beta updates are notify-only"
        }

        # Uninstaller scrubs *.old.<pid> artifacts from interrupted upgrades.
        It "24b. uninstaller scrubs *.old.<pid> interrupted-upgrade artifacts" {
            # Reinstall fresh so $script:InstallDir exists with the binary.
            $uninst = Join-Path $script:InstallDir 'uninstall.exe'
            if (Test-Path $uninst) {
                Start-Process -FilePath $uninst -ArgumentList '/S' -Wait | Out-Null
                Start-Sleep -Seconds 2
                (Get-ItemProperty -Path $script:MailKey -Name '(default)').'(default)' |
                    Should -Be 'SendArc Test Previous Client' -Because 'every uninstall must restore the saved alternate default'
            }
            Start-Process -FilePath $script:SetupExe -ArgumentList '/S',"/D=$($script:InstallDir)" -Wait | Out-Null

            # Plant orphan files matching the installer cleanup pattern.
            $orphan64  = Join-Path $script:InstallDir   'SendArc.exe.old.123'
            $orphanDll = Join-Path $script:InstallDir   'SendArc.dll.old.456'
            $orphan32  = Join-Path $script:InstallDir32 'SendArc.dll.old.789'
            New-Item -ItemType File -Path $orphan64  -Force | Out-Null
            New-Item -ItemType File -Path $orphanDll -Force | Out-Null
            New-Item -ItemType File -Path $orphan32  -Force | Out-Null

            Test-Path $orphan64  | Should -BeTrue  # sanity
            Test-Path $orphanDll | Should -BeTrue
            Test-Path $orphan32  | Should -BeTrue

            # Uninstall — orphans MUST be gone.
            $uninstAfter = Join-Path $script:InstallDir 'uninstall.exe'
            $proc = Start-Process -FilePath $uninstAfter -ArgumentList '/S' -Wait -PassThru
            $proc.ExitCode | Should -Be 0
            Start-Sleep -Seconds 2

            Test-Path $orphan64  | Should -BeFalse -Because "uninstaller MUST scrub *.old.<pid> orphans in `$INSTDIR (W7)"
            Test-Path $orphanDll | Should -BeFalse -Because "uninstaller MUST scrub *.old.<pid> orphans in `$INSTDIR (W7)"
            Test-Path $orphan32  | Should -BeFalse -Because "uninstaller MUST scrub *.old.<pid> orphans in `$PROGRAMFILES32\SendArc (W7)"

            # Leave the product installed for the dedicated uninstall context.
            $reinstall = Start-Process -FilePath $script:SetupExe -ArgumentList '/S',"/D=$($script:InstallDir)" -Wait -PassThru
            $reinstall.ExitCode | Should -Be 0
        }
    }

    Context "Silent uninstall" {
        # D-21 item 7
        It "7. silent uninstall exits 0 with /S" {
            $uninst = Join-Path $script:InstallDir 'uninstall.exe'
            Test-Path $uninst | Should -BeTrue -Because "uninstaller must be in place after install"
            $proc = Start-Process -FilePath $uninst -ArgumentList '/S' -Wait -PassThru
            $proc.ExitCode | Should -Be 0
            # NSIS uninstaller self-deletes via a batch wrapper; sleep briefly so the
            # batch can complete before subsequent Test-Path probes.
            Start-Sleep -Seconds 2
        }

        # D-21 item 8
        It "8. install dir is gone (or empty)" {
            $exists = Test-Path $script:InstallDir
            if ($exists) {
                # Acceptable if empty — NSIS RMDir (non-recursive) leaves dir when files remain
                (Get-ChildItem $script:InstallDir -Force -ErrorAction SilentlyContinue).Count | Should -Be 0
            }
        }

        # D-21 item 9
        It "9. MAPI handler key HKLM\SOFTWARE\Clients\Mail\SendArc is gone" {
            Test-Path $script:MapiKey | Should -BeFalse
        }

        # D-21 item 10
        It "10. firewall rule 'SendArc OAuth loopback' is gone" {
            Get-NetFirewallRule -DisplayName $script:FirewallRule -ErrorAction SilentlyContinue | Should -BeNullOrEmpty
        }

        # D-21 item 11
        It "11. %APPDATA%\SendArc\ is gone for the runner user" {
            Test-Path "$env:APPDATA\SendArc" | Should -BeFalse
        }

        # D-21 item 12 — Credential Manager scrub (colon target per PATTERNS.md Shared Pattern 3)
        It "12. cmdkey /list:SendArc:oauth-tokens returns no matching entries" {
            # cmdkey prints to stdout + may use stderr depending on locale; merge streams.
            $out = & cmdkey /list:$script:CredTarget 2>&1 | Out-String
            # cmdkey output contains 'Target:' lines when an entry matches, or a
            # "NONE" / locale-dependent "no credentials" message when nothing matches.
            # The filter heading repeats the requested target even when it says
            # "* NONE *". Only an actual `Target:` record means it still exists.
            $entryPattern = '(?im)^\s*Target:\s*.*' + [regex]::Escape($script:CredTarget)
            $out | Should -Not -Match $entryPattern -Because "cmdkey should find no credentials under target '$($script:CredTarget)' after uninstall"
        }

        # D-21 item 13
        It "13. Start Menu shortcut is gone" {
            Test-Path $script:Shortcut | Should -BeFalse
        }

        # QUICK-260423-ntu item 15 — uninstall-time running-process guard (silent)
        It "15. silent uninstall closes a running SendArc.exe in InstallDir and removes the binary" {
            # Re-install first because item 7 already uninstalled.
            Start-Process -FilePath $script:SetupExe -ArgumentList '/S',"/D=$($script:InstallDir)" -Wait
            $exe = Join-Path $script:InstallDir 'SendArc.exe'
            $decoy = Start-Process -FilePath $exe -PassThru -WindowStyle Hidden
            try {
                Start-Sleep -Seconds 1
                $uninst = Join-Path $script:InstallDir 'uninstall.exe'
                $proc = Start-Process -FilePath $uninst -ArgumentList '/S' -Wait -PassThru
                $proc.ExitCode | Should -Be 0
                Start-Sleep -Seconds 2   # NSIS batch-wrapper self-delete
                Test-Path $exe | Should -BeFalse -Because "uninstaller should have closed the running instance and deleted the binary"
                $decoy.HasExited | Should -BeTrue
            } finally {
                if (-not $decoy.HasExited) { $decoy.Kill() }
            }
        }

        # QUICK-260423-ntu item 19 — x86 DLL + install dir removed by uninstall
        It "19. ProgramFiles(x86)\SendArc is gone after uninstall" {
            $exists = Test-Path $script:InstallDir32
            if ($exists) {
                (Get-ChildItem $script:InstallDir32 -Force -ErrorAction SilentlyContinue).Count | Should -Be 0
            }
            Test-Path (Join-Path $script:InstallDir32 'SendArc.dll') | Should -BeFalse
        }

        # QUICK-260423-ntu item 20 — shared MAPI key removed
        It "20. HKLM MAPI handler key is gone after uninstall" {
            Test-Path $script:MapiKey | Should -BeFalse
        }

        It "20b. uninstall restores the alternate default and preserves unrelated mail clients" {
            (Get-ItemProperty -Path $script:MailKey -Name '(default)').'(default)' |
                Should -Be 'SendArc Test Previous Client'
            foreach ($client in $script:CoexistenceClients) {
                Test-Path (Join-Path $script:MailKey $client) | Should -BeTrue -Because "uninstall must not delete $client"
            }
        }
    }
}
