# SendArc rebrand audit

Last audited: 2026-08-29

The audit classifies every remaining `go-mapi`/`gomapi` match instead of applying an unsafe global replacement.

## Shipping identity

The application, installer, DLLs, registry client, AUMID, firewall rule, Credential Manager service, Program Files/AppData paths, queue, diagnostics, release artifacts, repository metadata, website, policies, and support surfaces use **SendArc**.

Current development helpers use `SendArc.exe`, `%LOCALAPPDATA%\SendArc\queue`, and `app.sendarc.desktop.dev`. Obsolete pre-SendArc Windows Sandbox/Inno Setup tooling, Azure RAM-provisioning scripts, Phase 11 installer wrapper, and the disabled silent binary-replacement experiment were removed because they referenced incompatible paths or could not exercise the current NSIS product.

## Intentional retained identifiers

- `github.com/marcfargas/go-mapi/...` Go module/import paths preserve upstream history and avoid risky import churn. They are not displayed to users.
- `go_mapi` is an internal C++ namespace only. DLL filenames, exports, paths, installer registration, and diagnostics remain SendArc.
- Legal, license, changelog, README, release-note, and website-license references to **go-mapi** are required upstream attribution.
- `GOMAPI_DEBUG_BROWSER_ARGS` is the name implemented by the vendored WebView2 test fork. It is test-only; release hygiene rejects it from production workflows and environment captures.
- README/release warnings may name go-mapi only as an unrelated mail client that the SendArc uninstaller must not remove.

## Verification command

Run a classified search, then inspect every result against the categories above:

```powershell
rg -n -i "go[-_ ]?mapi|gomapi" src scripts .github website README.md DEVELOPMENT.md CHANGELOG.md CLAUDE.md
```

Any new user-facing, machine-facing, artifact, path, registry, credential, environment, or release identifier is a regression unless it is explicitly documented here as an inherited internal or legal reference.
