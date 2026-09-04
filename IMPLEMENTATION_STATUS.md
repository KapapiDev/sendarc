# Implementation status

Last updated: 2026-09-04

## Completed

- Canonical repository is `KapapiDev/sendarc` (moved from `maxtop9843-byte/sendarc`); upstream remote and LGPL history are preserved.
- KaPaPi is the parent developer brand while SendArc remains the product name. The public family entry at `https://kapapi.dev/sendarc/` and the full product site at `https://sendarc.pages.dev/` link to each other; the family entry was merged in [KaPaPi site PR #1](https://github.com/KapapiDev/kapapi-dev.github.io/pull/1) as `fb6363d`. The current SendArc privacy/retention wording was merged in [PR #3](https://github.com/KapapiDev/kapapi-dev.github.io/pull/3) as `34a892f` and passed [site-quality run 33774839714](https://github.com/KapapiDev/kapapi.dev/actions/runs/33774839714), Pages deployment, and live desktop/mobile accessibility and overflow checks.
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
- Website lint, typecheck, build, link checks, 20 isolated unit tests, and 30 desktop/tablet/mobile/landscape Playwright tests (including axe accessibility) pass locally under the production security headers.
- Go tests and vet pass; frontend check, 77 tests, build, and dependency audit pass with zero known npm vulnerabilities.
- UI/UX Pro Max audit applied: consistent SVG icon language, visible keyboard focus, accessible modal focus/escape behavior, reduced-motion handling, and explicit asynchronous form progress.
- Gitleaks current-history scan and GitHub Actions syntax validation pass locally.
- Dedicated Google Cloud project `sendarc` created and Gmail API enabled without billing.
- Cloudflare D1 database `sendarc-leads` provisioned, bound, and migrated; Cloudflare Pages project `sendarc` and private scheduled Worker `sendarc-retention` provisioned.
- Local production website captured and compared with the supplied reference; no desktop-width overflow or missing primary imagery was observed.
- Cloudflare Pages production deployment `dd810192-ec33-4a03-b58d-04b4d6d2342f` from `33c75a6` is live at `https://sendarc.pages.dev`; all 30 deployed desktop/tablet/mobile/landscape Playwright and axe scenarios pass with the production CSP active.
- Production Pages Functions and D1 were verified end to end after the privacy migration: a valid synthetic Business Beta submission returned 201 and atomically created its content-free success event, an allowlisted event returned 204, forged success and malformed lead requests returned 400, unsafe referrer/campaign data was discarded, and all synthetic form rows were deleted afterward.
- The event pipeline now accepts only known routes/events and bounded JSON, transmits hostname-only referrer data, uses a private hourly/endpoint HMAC solely for abuse control, and stores no visitor identifier. The Business Beta form records a success event only in the same server-side transaction as the lead.
- The no-route `sendarc-retention` Worker runs every 15 minutes and enforces 24-hour abuse-window, 90-day event, and 12-calendar-month lead retention. On 2026-09-04, the live D1 console showed zero for a seeded 91-day event, retained visitor identifiers, expired events, and expired abuse rows after scheduled execution; the Cloudflare dashboard showed 59 Worker invocations and `$0.00` billable usage.
- Clean GitHub Actions at current commit `33c75a6` passed the Wails app and x64/x86 Debug/Release interceptors in [33775060019](https://github.com/KapapiDev/sendarc/actions/runs/33775060019), the installer round-trip in [33775060057](https://github.com/KapapiDev/sendarc/actions/runs/33775060057), website/privacy/retention checks in [33775060016](https://github.com/KapapiDev/sendarc/actions/runs/33775060016), and security/policy checks in [33775059985](https://github.com/KapapiDev/sendarc/actions/runs/33775059985).
- Google Authentication Platform is configured for SendArc with external Testing audience, the controlled test account, deployed policy URLs, authorized `sendarc.pages.dev` domain, and exactly the `gmail.send` scope.
- The enabled `SendArc Windows Desktop` OAuth client is injected only through the gitignored local environment file and protected GitHub Actions secrets; no credential values were committed.
- Protected installer release dry-run [33628247764](https://github.com/KapapiDev/sendarc/actions/runs/33628247764) built the OAuth-injected Wails app, both interceptor DLLs, unsigned beta installer, and checksum from parent-brand commit `7840d89` without publishing a tag or release. The exact final installer passed all 31 release Pester cases, including installed x64/x86 ANSI and Unicode system-MAPI routing; neither OAuth value appeared in the workflow log.
- The downloaded dry-run `SendArc-Setup-0.1.0-beta.exe` independently matched `SHA256SUMS.txt` (`9c1e8ffe91a59f80c719f9fb39af0e18e3d571d13af5d873c4a2b3195c3eb1de`), contained exactly the installer and checksum manifest, and was confirmed unsigned as authorized.
- The local production-mode Windows app completed real Google OAuth on 2026-09-01 with an ephemeral loopback redirect, S256 PKCE, offline access, SendArc branding/policy links, and exactly the `gmail.send` scope. Tokens were stored in Windows Credential Manager, survived an app restart, and passed the app's live Google token-introspection connection test.
- After the original access token expired, a real connection test on 2026-09-02 refreshed it through Google, persisted the new expiry in Windows Credential Manager, and restored the refreshed signed-in state after another app restart without exposing token values.
- The production-mode Windows app was rebuilt from `7840d89` after the KaPaPi relationship was added; it launched successfully and restored the existing Google-authenticated state from Windows Credential Manager without exposing credential values.
- OAuth preflight copy now tells users to stop on an unverified/unsafe warning instead of instructing them to bypass it, and credential-bearing Wails builds run quietly so ldflags are not printed.
- `docs/OAUTH_VERIFICATION.md` records the exact KaPaPi-hosted public URLs, minimum-scope justification, Domain-property ownership gate, sanitized demonstration plan, and submission checklist without claiming Production approval or a completed Gmail send.
- Active rebrand audit completed and documented in `docs/REBRAND_AUDIT.md`; obsolete pre-SendArc sandbox/Azure/installer tooling and the disabled silent binary-replacement experiment were removed rather than left as misleading or risky paths.
- The Windows Status screen now reads real Gmail/MAPI state, 32-bit and 64-bit bridge presence, default-handler registration, and privacy-safe last-intercept/last-send timestamps; its Gmail connection test calls Google's token introspection endpoint without reading or sending mail.
- Broken MAPI registration now has a guarded administrator repair path that preserves the installer's prior-handler backup and refuses to run when installed bridge files are incomplete. The non-elevated boundary, backend logic, small-window layout, keyboard focus, and Escape/focus-return behavior are tested; final installed UAC repair remains an acceptance check.
- Windows Server 2025 installed-provider acceptance now covers x64 and x86 `MAPISendMail` plus `MAPISendMailW`. A loader-lock fail-fast was traced to shell directory creation in `DllMain`; queue creation is now lazy at the first mail call, and the final installer round-trip passes 31/31.
- The current Cloudflare deployment was rechecked on 2026-09-04 across desktop, tablet, mobile, small-mobile, and mobile-landscape: all 30 Playwright/axe scenarios passed without creating production form data.
- The manual queue helper now copies attachments into the same queue-owned sibling layout as the real interceptor. A live Unicode attachment round-trip passed, and actionable Windows toast XML now escapes activation arguments and other attributes before WinRT parsing.

## Not yet complete

- Real interactive clean-Windows install, application launch, and uninstall/previous-handler restoration verification beyond the passing automated installer round-trip.
- Real Gmail test-account send verified in Gmail Sent.
- Google Production verification: verify the owned `kapapi.dev` Domain property, save the KaPaPi-hosted branding/policy URLs and logo, record the real sanitized consent/send demonstration, and submit it without broadening `gmail.send`.
- Signed binaries. The no-payment beta is expected to be explicitly unsigned unless a legitimate free signing route becomes available.
- GitHub `v0.1.0-beta` tag/release, installer asset, and SHA256 checksums.
- Published GitHub release asset and working website download path.
- Full Windows end-to-end test from a legacy MAPI application through Gmail Sent.

Do not describe SendArc as launched until every acceptance item in the autonomous build prompt has been verified.
