# SendArc engineering context

SendArc is a Windows utility that connects Simple MAPI actions from legacy applications to Gmail or Google Workspace. The public beta is Gmail-only: the interceptor writes a local queue item, the Wails app displays a local preview, and the user must explicitly press **Send** before the app calls Gmail `users.messages.send`.

## Product invariants

- Product and machine-facing identity is **SendArc**.
- OAuth requests exactly `https://www.googleapis.com/auth/gmail.send`.
- No mailbox reading, Gmail drafts, automatic sending, hidden telemetry, or SendArc email relay exists.
- OAuth tokens use Windows Credential Manager service `SendArc`, account `oauth-tokens`.
- Queue files live under `%LOCALAPPDATA%\SendArc\queue`; app settings and privacy-filtered logs live under `%APPDATA%\SendArc`.
- The release updater is notify-only and opens the official GitHub release. Do not restore the removed silent binary-replacement experiment.
- Never log or commit OAuth values, tokens, message content, recipients, subjects, attachment names, or local attachment paths.

## Source layout

- `src/interceptor/` — x86/x64 C++17 Simple MAPI interceptor and deterministic harness.
- `internal/mapi/` — queue protocol, Gmail MIME/send transport, and shared validation.
- `src/app/` — Go/Wails Windows host, OAuth lifecycle, Credential Manager, tray, queue watcher, notifications, and update metadata.
- `src/app/frontend/` — Svelte 5 local preview and account/update UI.
- `src/installer/SendArc.nsi` — NSIS machine-wide installer and uninstaller.
- `website/` — Astro/Cloudflare Pages site and Pages Functions.
- `tests/e2e/` — Playwright Wails flow with local fake OAuth/Gmail endpoints; the `e2e` build tag must never ship.

The inherited Go module path and C++ namespace still reference `marcfargas/go-mapi`; those are internal source identifiers retained to avoid risky import churn and to preserve upstream history. They are not the product brand. Legal attribution belongs in `LICENSE`, `THIRD_PARTY_NOTICES.md`, and public license/about surfaces.

## Common commands

From the repository root:

```powershell
npm ci
npm test
npm run check
npm run build:interceptor
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\build-wails.ps1
npm run build:installer
```

Go workspace tests must name the workspace modules:

```powershell
go test ./internal/mapi/... ./src/app/...
go vet ./internal/mapi/... ./src/app/...
```

Frontend-only verification:

```powershell
npm --workspace src/app/frontend test -- --run
npm --workspace src/app/frontend run check
npm --workspace src/app/frontend run build
```

Website verification:

```powershell
npm --workspace website run lint
npm --workspace website run check
npm --workspace website run test
npm --workspace website run build
npm --workspace website run test:e2e
```

## OAuth builds

Local real-OAuth values belong only in the gitignored repository-root `.env.local`:

```dotenv
SENDARC_OAUTH_CLIENT_ID=...
SENDARC_OAUTH_CLIENT_SECRET=...
```

`scripts/build-wails.ps1` passes those values through quiet Wails output so the ldflags string is not printed. GitHub release automation uses protected secrets with the same names. Desktop OAuth client secrets are extractable from distributed binaries, so PKCE, state validation, loopback-only binding, least privilege, and correct Google client controls are the actual security boundaries.

## Release rules

- Initial version: `v0.1.0-beta`.
- Required assets: `SendArc-Setup-0.1.0-beta.exe` and `SHA256SUMS.txt`.
- Unsigned beta is permitted only with explicit SmartScreen disclosure; do not weaken Windows security or tell users to bypass warnings.
- Do not create the public tag/release until clean CI and the real Gmail/Windows acceptance flow are proven.
- Cloudflare Pages is the selected host; domain purchase is deferred and must not block the generated Pages URL.

Read `DEVELOPMENT.md`, `docs/ARCHITECTURE.md`, `docs/OAUTH.md`, `docs/RELEASE.md`, and `docs/REQUIREMENTS_MATRIX.md` before changing the relevant subsystem.
