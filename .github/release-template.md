## SendArc v0.1.0-beta

**Beta software — Gmail and Google Workspace only.**

SendArc connects Simple MAPI email actions in legacy Windows applications to Gmail. It captures the outgoing request locally, shows To/Cc/Bcc, subject, body, and attachments in a local preview, and sends to Gmail only after the user clicks **Send**.

### Install

1. Download `SendArc-Setup-0.1.0-beta.exe` and `SHA256SUMS.txt` from the assets below.
2. Verify the installer's SHA-256 checksum.
3. Run the installer and approve the elevation request needed for machine-wide MAPI registration.
4. Start SendArc and connect a Gmail or Google Workspace account.

Supported target: Windows 10 22H2 and Windows 11. Compatibility depends on how each application implements Simple MAPI; report sanitized results with the [compatibility form](https://github.com/KapapiDev/sendarc/issues/new?template=compatibility_report.yml).

### Signing and Windows warning

This no-payment beta is **unsigned** unless the published asset's verified signature and this section explicitly say otherwise. Windows SmartScreen or an organization policy may warn about or block it. Do not disable Defender, SmartScreen, AppLocker, or WDAC; verify the checksum and follow your organization's software-approval process.

### Gmail permission and privacy

SendArc requests only `https://www.googleapis.com/auth/gmail.send`. It does not read the inbox, create Gmail drafts, or request `gmail.compose`/`gmail.modify`/contacts/calendar access.

Pending messages remain on the Windows device. After explicit Send, the desktop app sends directly to Google's Gmail API. There is no SendArc email relay or message-content server, and the desktop beta has no hidden telemetry.

### Known limitations

- Gmail/Google Workspace only; no Microsoft 365 transport.
- One connected Google account.
- No MSI, fleet dashboard, or guaranteed application compatibility.
- Updates are manual. The app opens the official GitHub release page and never silently replaces its binaries.
- Unsigned builds may be unsuitable for managed environments that require a trusted publisher.

### Upgrade and uninstall

Run the newer verified installer to upgrade. Uninstall through **Settings → Apps → Installed apps**. The uninstaller is designed to restore the previous default mail handler when safe and must not remove Affixa, go-mapi, Outlook, Thunderbird, or another mail client.

### Assets

- `SendArc-Setup-0.1.0-beta.exe` — versioned Windows installer
- `SHA256SUMS.txt` — SHA-256 manifest for published binary assets
- source archives generated from this exact tag

### Source, license, and independence

Source for this release is the `v0.1.0-beta` tag in [KapapiDev/sendarc](https://github.com/KapapiDev/sendarc/tree/v0.1.0-beta).

SendArc incorporates and modifies [go-mapi](https://github.com/marcfargas/go-mapi) by Marc Fargas, starting from upstream commit `b90fcb08754f910fc318cbc922cbf24702582463`. Covered source is provided under LGPL-3.0-or-later; see [LICENSE](https://github.com/KapapiDev/sendarc/blob/v0.1.0-beta/LICENSE) and [THIRD_PARTY_NOTICES.md](https://github.com/KapapiDev/sendarc/blob/v0.1.0-beta/THIRD_PARTY_NOTICES.md).

SendArc is independent and is not affiliated with Google, Affixa, Notably Good Ltd., or the original go-mapi author.

Security reports: [private advisory](https://github.com/KapapiDev/sendarc/security/advisories/new)
General/compatibility reports: [GitHub Issues](https://github.com/KapapiDev/sendarc/issues)
