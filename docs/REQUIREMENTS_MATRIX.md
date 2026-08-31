# SendArc requirement-completion matrix

Last audited: 2026-09-01 against `SENDARC_AUTONOMOUS_A_TO_Z_BUILD_PROMPT.md`, the current worktree, GitHub repository state, and the conversation overrides.

This file separates **implementation** from **verification**. A source file or unit test does not prove a clean installer, real Gmail send, deployed website, or end-to-end user flow.

Status meanings:

- **Verified** — direct current evidence covers the stated requirement.
- **Implemented; verification pending** — code/artifact exists, but the full required environment or flow is not proven.
- **In progress** — work exists but is incomplete or changing.
- **Missing** — required evidence/artifact does not exist.
- **Deferred** — explicitly moved out of launch-critical scope by the owner.

## Repository, brand, and legal

| Requirement | Status | Evidence | Gap / release gate |
|---|---|---|---|
| Public SendArc repository | Verified | [maxtop9843-byte/sendarc](https://github.com/maxtop9843-byte/sendarc) is public; current work is pushed in PR #1 | Merge only after the current clean CI and release gates pass |
| Preserve Git history and `upstream` remote | Verified | Local remotes: `origin=maxtop9843-byte/sendarc`, `upstream=marcfargas/go-mapi`; history starts from upstream | Recheck at release tag |
| Record exact upstream baseline | Verified | `b90fcb08754f910fc318cbc922cbf24702582463` in [DECISIONS.md](../DECISIONS.md) and [THIRD_PARTY_NOTICES.md](../THIRD_PARTY_NOTICES.md) | None |
| Baseline build/test before modification | Verified for baseline only | GitHub Actions [run 32971058311](https://github.com/maxtop9843-byte/sendarc/actions/runs/32971058311) succeeded at the baseline SHA | This run does not validate SendArc changes; the interceptor harness coverage in that baseline was later found inadequate |
| Preserve LGPL/license/attribution | Implemented; verification pending | [LICENSE](../LICENSE), [THIRD_PARTY_NOTICES.md](../THIRD_PARTY_NOTICES.md), preserved history/module paths, desktop About disclosure, and the audited [dependency/distribution inventory](dependency-inventory/README.md). The unlicensed precompiled ApplicationID plug-in was replaced with repository-owned source, and notices/inventories are installed with the app | Verify the matching public source tag, published hashes, and installed notices from the final release artifact |
| Brand remains SendArc | Verified decision | [DECISIONS.md](../DECISIONS.md) records the owner's explicit decision | Apply consistently to all active machine/user-facing identifiers |
| Brand collision review | Implemented; verification pending | [BRAND_CLEARANCE.md](BRAND_CLEARANCE.md) | Preliminary engineering search recommends professional similarity/common-law review before spending or broad launch |
| Visual reference preserved | Verified | [SendArc-final-reference.png](design/SendArc-final-reference.png) | None |
| Production logo/icon set | Verified | Clean primary/monochrome SVGs and favicon; raster exports at 16/24/32/48/64/128/256/512; Wails source hash matches the 512 export; Windows app ICO has seven 32-bit frames from 16–256 and every tray state has 16/32/48 frames; [BRAND_ASSETS.md](design/BRAND_ASSETS.md) | Recheck embedded icon and version metadata on the immutable release installer |

## Desktop product

| Requirement | Status | Evidence | Gap / release gate |
|---|---|---|---|
| Gmail `users.messages.send` transport | Implemented; verification pending | `internal/mapi/gmail.go` uses `/messages/send`; request/error tests plus the real Wails/WebView2 hermetic E2E in [run 33284510085](https://github.com/maxtop9843-byte/sendarc/actions/runs/33284510085) observed exactly one `/messages/send` request and zero draft attempts after a native `MAPISendMailW` call | Repeat at the immutable release candidate and obtain a real Gmail Sent result |
| Exact `gmail.send` scope; no mailbox/profile scope | Verified | `src/app/auth.go`, [OAUTH.md](OAUTH.md); Google Cloud data-access configuration contains only `https://www.googleapis.com/auth/gmail.send`; the 2026-08-29 live Windows authorization request reached Google with that single scope, S256 PKCE, and an ephemeral loopback redirect | Reconfirm at the release candidate without broadening the scope |
| Windows Credential Manager token storage | Verified | Keyring service `SendArc`, account `oauth-tokens` in `src/app/auth.go`; [run 33284768883](https://github.com/maxtop9843-byte/sendarc/actions/runs/33284768883) passed the opt-in real Windows Credential Manager integration for save, fresh-store reload, delete, and `AuthManager` clear. Each run uses a unique test-only service and leaves no credential behind; routine tests cannot touch the production login | None; real Google refresh/disconnect/reconnect remains covered by the separate account-flow release gate |
| Local preview before transmission | Implemented; verification pending | `QueueRow.svelte` and `App.svelte`; 77 frontend tests plus the 2026-08-30 real Wails/WebView2 E2E proved an actual x64 `MAPISendMailW` interception reaches the preview with zero Gmail requests | Representative third-party legacy application flow |
| Explicit Send and Cancel/Discard; no auto-send/draft | Verified for Windows app runtime | The hermetic Wails E2E proves Preview, Cancel, and Dismiss make zero Gmail requests; only the separate Send confirmation makes one `users.messages.send` request; the fake server rejects and records draft attempts, with zero observed. A Windows binding regression test records zero Gmail calls for both notification Review and Dismiss actions | Repeat at the immutable release candidate |
| Preserve To/Cc/Bcc/subject/body/attachments/Unicode | Implemented; verification pending | Go protocol/MIME tests, locale-independent ANSI and wide C++ harness tests, and the 2026-08-30 native-MAPI-to-Wails E2E verified visible To/Cc/Bcc, subject, Korean/Unicode body, and a Korean attachment filename; explicit-send E2E verified the generated MIME | Representative real legacy applications remain untested |
| Attachment/path/header validation | Verified | Go tests reject header injection, unsafe names, filename/path mismatch, and attachments outside the queue-owned sibling directory; C++ tests reject traversal, absolute paths, and separators while preserving Unicode basenames. x86/x64 CTest and native E2E are green in [run 33284510085](https://github.com/maxtop9843-byte/sendarc/actions/runs/33284510085) | Repeat at the immutable release tag |
| Privacy-safe errors/logging/diagnostics | Implemented; verification pending | Typed Gmail errors, generic frontend errors, sanitized ID logging, [SECURITY.md](../SECURITY.md); Windows E2E in [run 33284510085](https://github.com/maxtop9843-byte/sendarc/actions/runs/33284510085) inspected Gmail 503 and offline logs and rejected subject, recipient, token, and response-detail leakage | Reconfirm at the immutable release candidate and inspect real-auth failure logs |
| Success/actionable failure and retry | Implemented; verification pending | `send-result` event/UI states and queue retention on failure; Windows E2E verifies send success, Gmail 503 retry, offline queue retention, and the repeated-401 invalid-grant re-auth banner | Real Gmail success evidence |
| Single-account connect/disconnect/re-auth | Implemented; verification pending | Auth manager/bindings/UI and tests in `src/app` | Real account flow; account identity is intentionally generic without profile scopes |
| Polished Status/Account/Settings/About functions | Implemented; verification pending | Real Gmail/MAPI/component/default-handler status, privacy-safe activity timestamps, Google token-introspection test, guarded elevated MAPI repair, auth/diagnostics/update controls, and About/privacy/license/support are wired. The Status and About modals passed type/accessibility, small-window scroll, keyboard focus, and Escape/focus-return Windows checks on 2026-08-29 | Verify Gmail test with the real account and complete installed UAC repair/refresh once in final Windows acceptance |
| Complete active rebrand | Verified | Shipping identifiers use SendArc; stale sandbox/Azure/installer and disabled silent-update paths were removed; intentional module/namespace/legal/test-only matches are classified in [REBRAND_AUDIT.md](REBRAND_AUDIT.md) | Re-run the classified audit at the release tag |
| Clean checkout desktop build | Verified | GitHub Actions [run 33413612174](https://github.com/kapapi-dev/sendarc/actions/runs/33413612174) passed the Wails app and all interceptor matrices at `d7f6086` on `windows-2025` | Repeat at the immutable release tag |

## Installer, updates, and Windows validation

| Requirement | Status | Evidence | Gap / release gate |
|---|---|---|---|
| x64 and x86 interceptor builds | Verified | Latest-head [Build and Test run 33413612174](https://github.com/kapapi-dev/sendarc/actions/runs/33413612174) passed x64/x86 Debug/Release builds and harness tests; [release dry-run 33413608181](https://github.com/kapapi-dev/sendarc/actions/runs/33413608181) rebuilt both Release targets with tests | Repeat at the immutable release tag |
| NSIS installer with SendArc paths/registry/uninstall entry | Verified by automated round-trip | `src/installer/SendArc.nsi`; latest-head [installer run 33413612230](https://github.com/kapapi-dev/sendarc/actions/runs/33413612230) and exact-artifact [release dry-run 33413608181](https://github.com/kapapi-dev/sendarc/actions/runs/33413608181) passed all 31 install/uninstall cases | Perform the final interactive clean-Windows acceptance flow |
| Preserve/restore previous mail handler | Verified by automated round-trip | [Installer run 33413612230](https://github.com/kapapi-dev/sendarc/actions/runs/33413612230) exercises JSON plus registry backup, repeated install/uninstall, and prior-handler restoration | Confirm once more in the final interactive acceptance flow |
| Coexistence; never remove unrelated mail apps | Verified by automated round-trip | [Installer run 33413612230](https://github.com/kapapi-dev/sendarc/actions/runs/33413612230) plants Affixa, go-mapi, and an alternate default; verifies install preservation, restoration, and non-removal through repeated cycles | Repeat in final interactive acceptance |
| Notify-only update path | Implemented; verification pending | Metadata-only GitHub REST client, fixed repository/release origin, no binary-update dependency, no unattended task, and transport/security tests; [SECURITY_AUDIT.md](SECURITY_AUDIT.md) | Runtime click-through to the official SendArc release page and immutable-tag recheck |
| Unsigned-beta disclosure | Implemented in documentation | [CODE_SIGNING.md](CODE_SIGNING.md), README, IT notes, release template | Repeat disclosure on actual website/release/installer; verify artifact signature state |
| Authenticode signing | Missing but allowed fallback | No eligible no-payment credential confirmed | Unsigned beta is authorized; do not claim publisher trust or spend money |
| Windows install/MAPI/uninstall smoke | Verified by automated installed-system round-trip | [Installer run 33413612230](https://github.com/kapapi-dev/sendarc/actions/runs/33413612230) and exact-artifact [release dry-run 33413608181](https://github.com/kapapi-dev/sendarc/actions/runs/33413608181) pass installed x64/x86 `MAPISendMail` and `MAPISendMailW`, version/AUMID/license/coexistence, reinstall, uninstall, and previous-handler restore in 31/31 cases | Installed third-party legacy-app call, Gmail Sent, and interactive uninstall/restore remain |

## Website, legal, and market probe

| Requirement | Status | Evidence | Gap / release gate |
|---|---|---|---|
| Reference-matched scrolling website | Verified | Astro/Cloudflare site; full-page production-build capture; 20 deployed desktop/tablet/mobile/landscape Playwright and axe scenarios passed on 2026-08-28; [WEBSITE_VISUAL_QA.md](WEBSITE_VISUAL_QA.md) | None before the release asset changes the download state |
| Truthful Gmail-only claims/no dead buttons | Verified for current release-pending state | Nine static routes build; broken-link scan passes; deployed Playwright exercises navigation, FAQ and beta form | Repeat after publishing the real release asset |
| Affixa-alternative route and independence wording | Verified | Deployed `/affixa-alternative/`, canonical metadata, official retirement link, and independence wording | None |
| Privacy/terms/licenses/security/support routes | Verified | All deployed routes pass link, accessibility, and browser checks | None |
| Business-beta form | Verified | Production Pages Function + D1 returned 201, stored the exact test fields, and the synthetic row was retrieved and deleted on 2026-08-28; [MARKET_VALIDATION.md](MARKET_VALIDATION.md) | Continue operational retention/deletion review after real submissions begin |
| Privacy-minimized analytics | Verified for first-party event pipeline | Production allowlisted event returned 204, an invalid event returned 400, D1 retrieval succeeded, and the synthetic event/abuse rows were deleted | Optional Cloudflare Web Analytics remains nonessential |
| Public Cloudflare deployment | Verified | `https://sendarc.pages.dev` production deployment; Functions bundle and D1 binding active; 20 live cross-viewport tests passed | Custom domain remains deferred |
| Custom `SendArc.app` domain | Deferred | Owner explicitly deferred purchase/connection; [DECISIONS.md](../DECISIONS.md) | No purchase or payment; generated Cloudflare URL is acceptable |
| Operator/support identity | Verified decision | 장형진 / `maxtop9843@gmail.com` in policies and decisions | Recheck all public pages/Google consent metadata |
| GitHub issue forms | Implemented; verification pending | Bug, compatibility, and feature forms under `.github/ISSUE_TEMPLATE` | Push and open template chooser; confirm labels/forms render |

## CI, security, release, and end-to-end

| Requirement | Status | Evidence | Gap / release gate |
|---|---|---|---|
| Current app/frontend tests | Verified at pushed head | [Build and Test run 33413612174](https://github.com/kapapi-dev/sendarc/actions/runs/33413612174) passed Go vet/race suites, isolated real Credential Manager integration, Svelte checks and 77 frontend tests, Wails build, native-MAPI Windows E2E, all x86/x64 Debug/Release matrices, and production-DLL test-hook isolation at `d7f6086` | Repeat at the immutable release tag |
| Windows app E2E | Verified locally and in CI | Seven real Wails/WebView2 Playwright scenarios passed locally and in [run 33284510085](https://github.com/maxtop9843-byte/sendarc/actions/runs/33284510085) on 2026-08-30, beginning with an actual x64 `MAPISendMailW` call: native interception/local preview, explicit send with complete MIME, Cancel/Dismiss, multi-arrival, Gmail 503 retry, offline queue retention, and repeated-401 re-auth using hermetic local OAuth/Gmail services | Repeat at the immutable release candidate |
| C++/installer CI | Verified at pushed head | x64/x86 Debug/Release jobs passed in [run 33413612174](https://github.com/kapapi-dev/sendarc/actions/runs/33413612174); the 31-test installed-system Pester round-trip passed in [run 33413612230](https://github.com/kapapi-dev/sendarc/actions/runs/33413612230) and again against the exact release bytes in [run 33413608181](https://github.com/kapapi-dev/sendarc/actions/runs/33413608181) | Repeat at the immutable release tag and in final interactive acceptance |
| Website CI/QA | Verified | [Website run 33413612059](https://github.com/kapapi-dev/sendarc/actions/runs/33413612059) passed at `d7f6086`; 20 live desktop/tablet/mobile/small-mobile/landscape Playwright/axe scenarios were re-run successfully against `https://sendarc.pages.dev` on 2026-09-01 | Repeat after the release asset changes download state |
| Dependency/secret/security audit | Verified at pushed head | [Security run 33413612307](https://github.com/kapapi-dev/sendarc/actions/runs/33413612307) reproduced the dependency inventories and passed Gitleaks at `d7f6086`; npm/Go vulnerability gates and history scans remain green; [SECURITY_AUDIT.md](SECURITY_AUDIT.md) | Repeat at the immutable release tag |
| `v0.1.0-beta` tag/release | Missing; latest pipeline dry-run verified | Protected [dry-run 33413608181](https://github.com/kapapi-dev/sendarc/actions/runs/33413608181) at `d7f6086` built the OAuth-injected unsigned installer, passed 31/31 exact-artifact acceptance cases, generated `SHA256SUMS.txt`, and skipped publication. The downloaded installer independently matched SHA-256 `09d19ca5d0161cdff9f9525c899f92ef1ef21cbf15b50b7aa137cd2557106a2c`; no tag or release exists | Complete real Gmail/acceptance gates, then create the immutable tag and public release |
| Website download path | Missing | The production website exists, but no release asset is published and the download controls truthfully remain in release-pending state | Verify real browser download of the exact checksummed installer after release |
| Real Google OAuth + Gmail Sent | In progress | Project/API, branding/policies, external Testing audience, controlled test user, exact scope, Desktop client, and protected injection are complete; a live Windows run reached Google's correctly branded account chooser with the exact PKCE request | Complete account consent without bypassing a safety warning, then prove token storage/refresh/disconnect, explicit send, and Gmail Sent result |
| Complete 19-step acceptance flow | Missing | No single end-to-end evidence set | Verify discovery → download → install → registration → OAuth → MAPI → preview → Send → Gmail Sent → uninstall/restore |

## Owner constraints applied

- No payment has been authorized; no purchase is part of completion.
- Cloudflare replaces the prompt's Vercel default.
- Domain purchase/connection is deferred.
- The beta may ship unsigned when no legitimate free signing route is available, with explicit warnings.
- Windows updates are not required locally; clean Windows verification uses GitHub Actions `windows-2025`.
- Operator: 장형진. Support: `maxtop9843@gmail.com`.

The project is **not complete or launched** while any release-critical row above remains In progress, Missing, or lacks the stated verification.
