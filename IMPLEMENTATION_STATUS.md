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
- Website lint, typecheck, build, link checks, 5 unit tests, and 20 desktop/tablet/mobile/landscape Playwright tests (including axe accessibility) pass locally.
- Go tests and vet pass; frontend check, 64 tests, build, and dependency audit pass with zero known npm vulnerabilities.
- UI/UX Pro Max audit applied: consistent SVG icon language, visible keyboard focus, accessible modal focus/escape behavior, reduced-motion handling, and explicit asynchronous form progress.
- Gitleaks current-history scan and GitHub Actions syntax validation pass locally.
- Dedicated Google Cloud project `sendarc` created and Gmail API enabled without billing.
- Cloudflare D1 database `sendarc-leads` provisioned, bound, and migrated; Cloudflare Pages project `sendarc` provisioned.
- Local production website captured and compared with the supplied reference; no desktop-width overflow or missing primary imagery was observed.
- Cloudflare Pages production deployment is live at `https://sendarc.pages.dev`; all 20 deployed desktop/tablet/mobile/landscape Playwright and axe scenarios pass.
- Production Pages Functions and D1 were verified end to end: Business Beta returned 201 and persisted its declared fields, the allowlisted event endpoint returned 204, invalid events returned 400, and all synthetic verification rows were deleted afterward.
- Clean GitHub Actions at commit `2be8d82` passed the Wails app, x64/x86 Debug/Release interceptors, installer Pester round-trip, website, and security/policy jobs.
- Google Authentication Platform is configured for SendArc with external Testing audience, the controlled test account, deployed policy URLs, authorized `sendarc.pages.dev` domain, and exactly the `gmail.send` scope.
- The enabled `SendArc Windows Desktop` OAuth client is injected only through the gitignored local environment file and protected GitHub Actions secrets; no credential values were committed.

## Not yet complete

- Real interactive clean-Windows install, application launch, and uninstall/previous-handler restoration verification beyond the passing automated installer round-trip.
- Real Gmail test-account send verified in Gmail Sent.
- Signed binaries. The no-payment beta is expected to be explicitly unsigned unless a legitimate free signing route becomes available.
- GitHub `v0.1.0-beta` tag/release, installer asset, and SHA256 checksums.
- Published GitHub release asset and working website download path.
- Full Windows end-to-end test from a legacy MAPI application through Gmail Sent.

Do not describe SendArc as launched until every acceptance item in the autonomous build prompt has been verified.
