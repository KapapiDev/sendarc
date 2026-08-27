# Implementation status

Last updated: 2026-08-28

## Completed

- Repository created at `maxtop9843-byte/sendarc`; upstream remote and LGPL history preserved.
- Unmodified baseline built and tested on GitHub Actions from commit `b90fcb08754f910fc318cbc922cbf24702582463`.
- Local Go 1.25 toolchain installed without updating Windows; baseline Go and frontend tests passed.
- Gmail user-facing transport changed from draft creation to explicit `users.messages.send`.
- OAuth reduced to `gmail.send`; SendArc Credential Manager service name adopted.
- Upstream auto-draft startup disabled and legacy automatic mode rejected.
- Local preview-first frontend with explicit Send/Cancel semantics and duplicate-send protection.
- Gmail/MIME validation and privacy-safe error handling added; Go tests pass.
- C++ attachment filename traversal defenses and regression tests added.
- Reference image copied to `docs/design/SendArc-final-reference.png`.
- Support issue forms and privacy/security/decision/release documentation added.
- Reference-matched Astro/Cloudflare website, legal/support/Affixa routes, real release discovery, first-party event endpoints, and D1-backed Business Beta form implemented.
- Website lint, typecheck, build, link checks, 5 unit tests, and 12 desktop/tablet/mobile Playwright tests (including axe accessibility) pass locally.
- Go tests and vet pass; frontend check, 60 tests, build, and dependency audit pass with zero known npm vulnerabilities.
- Gitleaks current-history scan and GitHub Actions syntax validation pass locally.
- Dedicated Google Cloud project `sendarc` created and Gmail API enabled without billing.
- Cloudflare D1 database `sendarc-leads` provisioned, bound, and migrated; Cloudflare Pages project `sendarc` provisioned.

## In progress

- Verify the application/installer/registry/AUMID/path rebrand on clean Windows runners.
- Run the repaired Windows x64/x86 CI, interceptor harness, and installer smoke tests.
- Capture and compare the website full-page reference screenshot.
- Deploy the already-provisioned Cloudflare Pages project on its generated URL; custom domain remains deferred.
- Complete the dedicated Google OAuth consent screen and desktop client without committing credentials.

## Not yet complete

- Clean SendArc installer and uninstall/previous-handler restoration verification.
- Real Gmail test-account send verified in Gmail Sent.
- Signed binaries. The no-payment beta is expected to be explicitly unsigned unless a legitimate free signing route becomes available.
- GitHub `v0.1.0-beta` tag/release, installer asset, and SHA256 checksums.
- Public Cloudflare website, working download, business-beta form, analytics, and browser/mobile QA.
- Full Windows end-to-end test from a legacy MAPI application through Gmail Sent.

Do not describe SendArc as launched until every acceptance item in the autonomous build prompt has been verified.
