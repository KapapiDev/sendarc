# SendArc development guide

This guide is for contributors and release maintainers. End users should start with the [README](README.md).

## Architecture

```text
Windows application (x86 or x64)
  -> MAPISendMail / MAPISendMailW
  -> architecture-matched SendArc.dll
  -> %LOCALAPPDATA%\SendArc\queue\ (JSON + copied attachments)
  -> SendArc.exe (Go/Wails + Svelte/WebView2)
  -> local preview
  -> explicit user Send
  -> Gmail users.messages.send
```

The originating application receives the result of local queue acceptance, not the eventual Gmail result. The desktop UI owns the send result. See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for trust boundaries and lifecycle details.

| Component | Location | Responsibility |
|---|---|---|
| MAPI interceptor | `src/interceptor/` | C++17 x86/x64 DLL, MAPI conversion, safe attachment copying, atomic queue write |
| Shared Go core | `internal/mapi/` | Queue protocol/validation, watcher, MIME construction, Gmail `messages.send` transport |
| Desktop host | `src/app/` | Wails lifecycle, OAuth PKCE loopback, Credential Manager, tray/toasts, queue coordination, update notification |
| Desktop UI | `src/app/frontend/` | Svelte local preview, explicit Send/Cancel/Discard, auth and update surfaces |
| Installer | `src/installer/` | NSIS install, MAPI registration, previous-handler backup/restoration, uninstall |
| Website | `website/` | Cloudflare-hosted product/legal/support/market-validation site |

The Go module paths still contain `github.com/marcfargas/go-mapi`. They are internal source identifiers inherited from upstream, not the public product name. Changing them is not required for the SendArc user-facing rebrand and would create avoidable import churn.

## Prerequisites

- Windows 10/11
- Git
- Go 1.25.x
- Node.js 24.x and npm
- Wails CLI 2.12.0
- CMake 3.16+ and Ninja
- the MinGW/LLVM UCRT toolchain used by `src/interceptor/build.ps1`, with both x86 and x64 cross-compilers
- NSIS for a local installer build
- Microsoft Edge WebView2 runtime for the desktop UI

Install the pinned Wails CLI:

```powershell
go install github.com/wailsapp/wails/v2/cmd/wails@v2.12.0
```

Do not use `@latest` in a reproducible build.

## Clone and remotes

```powershell
git clone https://github.com/KapapiDev/sendarc.git
Set-Location sendarc
git remote add upstream https://github.com/marcfargas/go-mapi.git
git remote -v
npm ci
```

The SendArc fork began at upstream commit `b90fcb08754f910fc318cbc922cbf24702582463`. Preserve upstream copyright history and never rewrite a published source tag.

## OAuth development configuration

Create a separate Google Cloud **Desktop app** OAuth client for SendArc. Enable the Gmail API and configure only:

`https://www.googleapis.com/auth/gmail.send`

Copy `.env.local.example` to the ignored `.env.local` file and set:

```dotenv
SENDARC_OAUTH_CLIENT_ID=...
SENDARC_OAUTH_CLIENT_SECRET=...
```

Never commit that file, paste its values into issues, or print them in build logs. A desktop client secret is extractable from a distributed binary and is not a confidential security boundary; PKCE, exact loopback redirect handling, and least privilege remain required. See [docs/OAUTH.md](docs/OAUTH.md).

## Common checks

Use path-based npm workspace selectors so internal package-scope renames do not break contributor commands:

```powershell
npm ci
npm --workspace src/app/frontend run build
npm --workspace src/app/frontend run check
npm --workspace src/app/frontend run test:run

go vet ./internal/mapi/... ./src/app/...
go test ./internal/mapi/... ./src/app/...
go test -race ./internal/mapi/... ./src/app/...
```

The Go race detector may require a working native compiler. A local check is useful, but the clean `windows-2025` GitHub Actions run is the release authority.

Build and test both MAPI architectures:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File src/interceptor/build.ps1 -Arch x64 -Config Release -Tests -Clean -Version 0.1.0-beta
ctest --test-dir src/interceptor/build-x64 --output-on-failure -C Release

powershell -NoProfile -ExecutionPolicy Bypass -File src/interceptor/build.ps1 -Arch x86 -Config Release -Tests -Clean -Version 0.1.0-beta
ctest --test-dir src/interceptor/build-x86 --output-on-failure -C Release
```

The deterministic harness must load the exact DLL path passed on its command line and verify that all expected queue items are produced. A zero-test or zero-artifact harness run is a failure, not a pass.

Run the real Windows desktop flow against hermetic local OAuth and Gmail
stand-ins:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/run-e2e.ps1
```

The seven Playwright scenarios launch the e2e-tagged Wails/WebView2 binary and
verify a real x64 `MAPISendMailW` call through the test-only interceptor into
the live queue and local preview, explicit `users.messages.send`,
To/Cc/Bcc, Unicode body and attachment MIME preservation, Cancel/Dismiss with
zero Gmail requests, multi-arrival behavior, Gmail 503 retry, offline queue
retention, and the expired-sign-in banner.
The fake Gmail server records and rejects every draft attempt. E2E settings
disable update checks and all Google endpoints are replaced, so this suite does
not use real credentials, contact Gmail, or touch Windows Credential Manager.
The native interceptor is compiled with `SENDARC_E2E` only for this suite so it
can target a per-test temporary queue. Normal app, installer, and release builds
do not contain the environment-variable queue redirection hook.
GitHub Actions runs the same suite on `windows-2025` for every pull request.

The real Windows Credential Manager integration is opt-in so routine local
tests can never touch a user's SendArc login. It creates a unique fake entry,
proves save, fresh-store reload, delete, and `AuthManager` clear behavior, then
removes the entry:

```powershell
Set-Location src/app
go test -tags credentialstore_integration -run '^(TestRealKeyring_WindowsRoundTrip|TestAuthManagerKeyringRoundTrip_RealKeyring)$' -count=1 -v .
```

## Desktop development and builds

For hot reload:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/dev-wails.ps1
```

For a release-style desktop build:

```powershell
npm --workspace src/app/frontend run build
Set-Location src/app
wails build -platform windows/amd64
```

The rebranded output is `src/app/build/bin/SendArc.exe`. x86/x64 interceptor and installer names are defined by the build/installer scripts; the release-facing names are documented in [docs/RELEASE.md](docs/RELEASE.md).

## Security review before a release

- Search source, history, logs, artifacts, and screenshots for secrets.
- Confirm the authorization URL requests exactly `gmail.send`.
- Confirm notifications cannot send and auto-draft/auto-send modes remain unavailable.
- Verify message-derived data and Gmail response bodies do not enter logs or UI errors.
- Run attachment traversal, header injection, invalid-recipient, offline, auth-expiry, and cancellation tests.
- Audit `npm audit`, Go modules, vendored code, and bundled licenses; record rather than hide unresolved findings.
- Verify SHA-256 checksums from downloaded, final immutable artifacts.

## Release

Do not publish from a developer workstation. A release must come from a clean `v0.1.0-beta` tag through the pinned `windows-2025` workflow, after required CI is green. The release is manual-update only and may be unsigned under the no-payment constraint. Follow [docs/RELEASE.md](docs/RELEASE.md), [docs/CODE_SIGNING.md](docs/CODE_SIGNING.md), and the [requirements matrix](docs/REQUIREMENTS_MATRIX.md).

## Upstream and LGPL maintenance

Fetch upstream deliberately and review changes rather than performing blind merges:

```powershell
git fetch upstream --tags
git log --oneline --decorate HEAD..upstream/main
```

Keep `LICENSE`, applicable source headers, `THIRD_PARTY_NOTICES.md`, Git history, and a matching public source tag for every binary release. Do not imply that Marc Fargas or the go-mapi project endorses SendArc.
