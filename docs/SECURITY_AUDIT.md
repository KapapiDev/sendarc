# SendArc security audit

Last audited: 2026-09-01

This is a reproducible engineering audit of the current beta candidate. It is
not a penetration-test certificate and does not replace the immutable release
tag checks in `docs/RELEASE.md`.

## Dependency and secret results

| Surface | Check | Result |
|---|---|---|
| Desktop frontend/workspace | `npm audit --audit-level=high` | 0 vulnerabilities |
| Cloudflare website | `npm audit --audit-level=high` | 0 vulnerabilities |
| Windows app Go module | `govulncheck ./...` | 0 reachable vulnerabilities |
| MAPI bridge Go module | `govulncheck ./...` | 0 reachable vulnerabilities |
| Repository history | Gitleaks, redacted output | 595 commits scanned; no leaks found |

Both Go scans reported one advisory in an imported package that the compiled
SendArc paths do not call. `govulncheck` reported zero affected symbols and
zero vulnerable required modules.

The latest-head [security and repository policy run 33413612307](https://github.com/kapapi-dev/sendarc/actions/runs/33413612307) reproduced the dependency inventories and passed the secret/history and policy gates at `d7f6086`. The no-publish [release run 33413608181](https://github.com/kapapi-dev/sendarc/actions/runs/33413608181) also passed release-hygiene checks before and after compilation.

The audit initially found reachable OpenPGP and SSH advisories introduced by
`github.com/creativeprojects/go-selfupdate`. SendArc never applied updates, so
that binary-update dependency was unnecessary. It was removed along with its
archive, OpenPGP, SSH, GitHub/GitLab/Gitea SDK, and related transitive surface.
The production checker now uses a small `net/http` client for GitHub's official
latest-release metadata endpoint. Tests cover the required GitHub headers,
the pre-launch 404 state, prerelease exclusion, and rejection of release links
outside the fixed SendArc GitHub origin.

## Update integrity boundary

The beta update path is notification-only:

- it downloads no executable, archive, patch, or release asset;
- it does not launch an installer or replace a running binary;
- it accepts metadata only from the hard-coded SendArc repository endpoint;
- the user is sent to the fixed GitHub release page for manual review.

The public release workflow remains responsible for generating the installer
checksum. Final publication is gated on the acceptance checklist and a clean
scan of the immutable tag.

## Installer and elevated-command review

The installer/elevated paths were reviewed for shell injection and confused
deputy risks:

- process detection and shutdown use fixed `SendArc.exe` image names;
- Credential Manager and firewall removal use fixed target/rule names;
- the WebView2 bootstrapper and firewall rule quote the install path, which is
  a Windows filesystem path rather than network or message input;
- PowerShell is used only for a fixed UTC timestamp and as a backward-compatible
  parser for the machine-owned `%ProgramData%` backup JSON; current installs
  restore from a machine-owned registry mirror first, and the parsed value is
  never re-evaluated as a command;
- MAPI repair elevates the current `os.Executable()` path with one fixed
  `--repair-mapi` argument and first requires both installed DLLs;
- previous-handler restoration verifies that SendArc is still the current
  handler and that the saved handler key still exists before changing the
  default.

No message recipient, subject, body, attachment path, OAuth token, website
form field, or network response is interpolated into a shell command.

## Release recheck

Before publishing a tag, repeat both npm audits, both `govulncheck` scans,
Gitleaks against history and staged content, the Windows installer coexistence
round-trip, release hygiene, and checksum validation. Real OAuth/Gmail and
interactive Windows acceptance remain separate release gates.
