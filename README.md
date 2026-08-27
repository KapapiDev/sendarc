# SendArc

> Keep your old apps. Use modern email.

SendArc is a Windows Simple MAPI bridge for Gmail and Google Workspace. A legacy Windows application hands an outgoing message to SendArc, SendArc shows the message locally for review, and nothing is transmitted until the user clicks **Send**. The desktop app then sends the message directly to the Gmail API.

SendArc is an independent open-source project. It is not affiliated with Google, Affixa, Notably Good Ltd., or the original go-mapi author.

## Beta status

The repository is preparing `v0.1.0-beta`. Install only a tagged SendArc release that contains both a versioned installer and its checksum manifest. If the [latest release page](https://github.com/maxtop9843-byte/sendarc/releases/latest) does not contain `SendArc-Setup-0.1.0-beta.exe`, the public beta is not yet available.

The initial beta is deliberately narrow:

- Gmail and Google Workspace only; Microsoft 365 is not supported.
- One connected Google account.
- Simple MAPI callers on Windows 10/11, with application-specific compatibility still being validated.
- Local preview with To, Cc, Bcc, subject, body, and attachments.
- Explicit Send or Cancel/Discard; no automatic sending and no Gmail draft creation in the launch path.
- Manual update notification through the official GitHub release page; no silent self-update.

See [Implementation status](IMPLEMENTATION_STATUS.md) and the [requirements matrix](docs/REQUIREMENTS_MATRIX.md) before treating any unverified item as release-ready.

## Install

After a tagged beta is published:

1. Download `SendArc-Setup-0.1.0-beta.exe` and `SHA256SUMS.txt` from the same [GitHub release](https://github.com/maxtop9843-byte/sendarc/releases).
2. Verify the installer's SHA-256 value against `SHA256SUMS.txt`.
3. Run the installer and approve the Windows elevation request needed to register a machine-wide mail handler.
4. Start SendArc and connect a Gmail or Google Workspace account in the system browser.

The no-payment beta may be unsigned. Windows SmartScreen or an organization policy can therefore warn about or block it. Do not disable Microsoft Defender, SmartScreen, AppLocker, or WDAC to install SendArc; use the checksum and your organization's normal software-approval process. See [code-signing status](docs/CODE_SIGNING.md).

## Use

1. In a Windows application that supports Simple MAPI, choose its email action, such as **Send to → Mail recipient**.
2. Review the local SendArc preview, including recipients, subject, body, and attachments.
3. Click **Send** to transmit directly to Gmail, or cancel without transmitting. Discard removes the queued local item.
4. Wait for SendArc's success or failure result. The originating application only knows that SendArc accepted the local MAPI request; it does not know whether Gmail accepted the final send.

Compatibility varies because some applications do not implement Simple MAPI consistently. Please use the [compatibility report](https://github.com/maxtop9843-byte/sendarc/issues/new?template=compatibility_report.yml) with sanitized test data.

## Gmail permission and privacy

SendArc requests only:

`https://www.googleapis.com/auth/gmail.send`

It does not request inbox-read, mailbox-search, contacts, calendar, `gmail.modify`, `gmail.compose`, or `mail.google.com` access. OAuth tokens are stored through Windows Credential Manager. Pending messages and copied attachments stay in a per-user local queue until sent or discarded. When the user clicks Send, the MIME message goes directly from the Windows app to Google's Gmail API over HTTPS; there is no SendArc email relay or message-content server.

The desktop beta has no hidden telemetry and does not send recipients, subjects, bodies, attachment names, local paths, OAuth tokens, or Gmail response bodies to SendArc analytics. Read the full [privacy policy](PRIVACY.md) and [security policy](SECURITY.md).

## Updates and uninstall

SendArc can notify the user that a newer GitHub release exists. Updating is manual: download the new installer, verify its checksum, and run it. The beta does not silently replace installed binaries.

Uninstall through **Settings → Apps → Installed apps**. The installer is designed to restore the previous default mail handler when it is safe to do so and must not remove Affixa, go-mapi, Outlook, Thunderbird, or another mail client. Installer/uninstaller verification must be green for the tagged release; current evidence is tracked in the [requirements matrix](docs/REQUIREMENTS_MATRIX.md).

## Source, license, and upstream

SendArc incorporates and modifies [go-mapi](https://github.com/marcfargas/go-mapi) by Marc Fargas. The exact starting baseline is commit [`b90fcb08754f910fc318cbc922cbf24702582463`](https://github.com/marcfargas/go-mapi/commit/b90fcb08754f910fc318cbc922cbf24702582463), with Git history and the `upstream` remote preserved.

The repository declares `LGPL-3.0-or-later`; see [LICENSE](LICENSE) and [third-party notices](THIRD_PARTY_NOTICES.md). Matching source must accompany every distributed binary through the corresponding public tag/release. SendArc is independent and the upstream author does not endorse it.

For contributors, see [DEVELOPMENT.md](DEVELOPMENT.md). For cautious IT evaluation of the beta, see [ENTERPRISE.md](ENTERPRISE.md).
