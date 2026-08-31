# SendArc release process

The first public target is `v0.1.0-beta`. Releases are built from an immutable Git tag on GitHub Actions `windows-2025`, never from an unverified developer-machine binary.

As of 2026-09-01, no SendArc GitHub release has been published. The latest no-publish dry-run is [33413608181](https://github.com/kapapi-dev/sendarc/actions/runs/33413608181) at `d7f6086`: its exact unsigned installer passed all 31 release acceptance cases, and the downloaded asset independently matched `SHA256SUMS.txt` (`09d19ca5d0161cdff9f9525c899f92ef1ef21cbf15b50b7aa137cd2557106a2c`). Do not turn that dry-run into a launch claim; use [REQUIREMENTS_MATRIX.md](REQUIREMENTS_MATRIX.md) for the remaining real-account and public-release gates.

## Required preconditions

- The tag points to the reviewed commit and the working tree is reproducible from a clean checkout.
- Go tests/vet/race checks, frontend build/check/tests, x64/x86 interceptor builds/tests, deterministic harness, Wails build, and installer round-trip are green.
- The harness fails when no expected queue output is produced; `continue-on-error` cannot mask a functional failure.
- OAuth values come only from protected release secrets and are absent from source, history, logs, summaries, and public debug artifacts.
- User-facing and machine-facing active identifiers use SendArc: EXE/DLL, installer, app paths, registry keys, AUMID, uninstall entry, updater repository, and release assets.
- Installer coexistence, previous-handler backup/restoration, and non-removal of unrelated mail clients are verified.
- `LICENSE`, matching source history/tag, upstream baseline, and `THIRD_PARTY_NOTICES.md` are present.
- Website download/legal/support routes are ready but do not point to an asset until it exists.
- Signing status is explicit. Under the authorized no-payment fallback, the beta is labeled **Unsigned beta**.
- Requirement gaps marked Blocked/Missing in the matrix are resolved or explicitly prevent publication.

## Reproduce checks

```powershell
npm ci
npm --workspace src/app/frontend run build
npm --workspace src/app/frontend run check
npm --workspace src/app/frontend run test:run

go vet ./internal/mapi/... ./src/app/...
go test ./internal/mapi/... ./src/app/...
go test -race ./internal/mapi/... ./src/app/...

powershell -NoProfile -ExecutionPolicy Bypass -File src/interceptor/build.ps1 -Arch x64 -Config Release -Tests -Clean -Version 0.1.0-beta
ctest --test-dir src/interceptor/build-x64 --output-on-failure -C Release

powershell -NoProfile -ExecutionPolicy Bypass -File src/interceptor/build.ps1 -Arch x86 -Config Release -Tests -Clean -Version 0.1.0-beta
ctest --test-dir src/interceptor/build-x86 --output-on-failure -C Release
```

The release workflow owns the pinned Wails/NSIS commands and version injection. Before publication it runs the full installer install/upgrade/uninstall round-trip against the exact final signed-or-unsigned installer bytes, including previous-handler restoration. Review that workflow at the tagged commit; do not assume this guide can compensate for stale automation.

## Artifact contract

For `v0.1.0-beta`, publish at least:

- `SendArc-Setup-0.1.0-beta.exe`;
- `SHA256SUMS.txt`;
- GitHub's source archives for the exact tag.

The build may create a local intermediate named `SendArc-Setup.exe`; the release workflow must copy/rename it to the versioned public filename before hashing and upload. Optional standalone artifacts, if intentionally published, are `SendArc.exe`, `SendArc-x64.dll`, and `SendArc-x86.dll`.

`SHA256SUMS.txt` uses lowercase 64-character SHA-256 values, two spaces, and the exact public basenames. Generate checksums only after all signing/packaging is complete. Download the published files into a clean directory and verify them again before wiring the website download.

## Release notes contract

Use [`.github/release-template.md`](../.github/release-template.md) and state:

- beta status and supported Windows versions;
- Gmail/Google Workspace-only Simple MAPI scope;
- local preview and explicit Send/Cancel behavior;
- tested x86/x64 workflows and known application-specific gaps;
- `gmail.send` permission and direct-to-Google privacy boundary;
- unsigned/SmartScreen status;
- manual update and uninstall/previous-handler behavior;
- upstream go-mapi attribution, LGPL status, and matching source tag;
- support/security routes.

Do not claim a test, compatibility result, signature, OAuth publication state, or public deployment that the tagged evidence does not prove.

## Publish

1. Update changelog/status/matrix with evidence from the candidate commit.
2. Create and push annotated tag `v0.1.0-beta`.
3. Let the release workflow build and test that tag.
4. Publish only after every required job is green.
5. Verify artifact names, sizes, checksums, source tag, release text, and public URLs.
6. Update/deploy the Cloudflare website download route to the verified release asset.
7. Test the website-to-download path and a clean Windows install/uninstall.

## Updates and rollback

The beta updater is notify-only: it opens the official GitHub release page and never silently self-replaces binaries. A release is immutable. If privacy, credentials, registry restoration, message integrity, or installer safety is compromised, remove the download CTA or affected asset, publish a notice, and issue a new version/tag/checksum. Never replace bytes under an existing version.
