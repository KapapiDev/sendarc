# SendArc requirement-completion matrix

Last audited: 2026-08-30 against `SENDARC_AUTONOMOUS_A_TO_Z_BUILD_PROMPT.md`, the current worktree, GitHub repository state, and the conversation overrides.

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
| Gmail `users.messages.send` transport | Implemented; verification pending | `internal/mapi/gmail.go` uses `/messages/send`; request/error tests plus the 2026-08-30 real Wails/WebView2 hermetic E2E observed exactly one `/messages/send` request and zero draft attempts | Current E2E CI and a real Gmail Sent result |
| Exact `gmail.send` scope; no mailbox/profile scope | Verified | `src/app/auth.go`, [OAUTH.md](OAUTH.md); Google Cloud data-access configuration contains only `https://www.googleapis.com/auth/gmail.send`; the 2026-08-29 live Windows authorization request reached Google with that single scope, S256 PKCE, and an ephemeral loopback redirect | Reconfirm at the release candidate without broadening the scope |
| Windows Credential Manager token storage | Implemented; verification pending | Keyring service `SendArc`, account `oauth-tokens` in `src/app/auth.go` | Real Windows save/load/refresh/disconnect/reconnect evidence |
| Local preview before transmission | Implemented; verification pending | `QueueRow.svelte` and `App.svelte`; 77 frontend tests plus the 2026-08-30 real Wails/WebView2 E2E proved arrival and preview make zero Gmail requests | Real legacy-application MAPI foreground/preview flow |
| Explicit Send and Cancel/Discard; no auto-send/draft | Verified for Windows app runtime | The hermetic Wails E2E proves Preview, Cancel, and Dismiss make zero Gmail requests; only the separate Send confirmation makes one `users.messages.send` request; the fake server rejects and records draft attempts, with zero observed | Repeat at the immutable release candidate and verify notification actions cannot send |
| Preserve To/Cc/Bcc/subject/body/attachments/Unicode | Implemented; verification pending | Go protocol/MIME tests, C++ converter/harness tests, and the 2026-08-30 Wails E2E verified visible preview plus generated MIME for To/Cc/Bcc, subject, Unicode body, and an attachment | Representative real legacy applications remain untested |
| Attachment/path/header validation | Implemented; verification pending | Go validation tests and C++ `fs_utils`/`message_converter` regression tests | Clean x86/x64 CTest and adversarial Windows file tests |
| Privacy-safe errors/logging/diagnostics | Implemented; verification pending | Typed Gmail errors, generic frontend errors, sanitized ID logging, [SECURITY.md](../SECURITY.md) | Full log inspection under auth/API/path failures and secret scan |
| Success/actionable failure and retry | Implemented; verification pending | `send-result` event/UI states and queue retention on failure; Windows E2E verifies send success and the repeated-401 invalid-grant re-auth banner | Runtime offline and Gmail 5xx retry evidence; real success evidence |
| Single-account connect/disconnect/re-auth | Implemented; verification pending | Auth manager/bindings/UI and tests in `src/app` | Real account flow; account identity is intentionally generic without profile scopes |
| Polished Status/Account/Settings/About functions | Implemented; verification pending | Real Gmail/MAPI/component/default-handler status, privacy-safe activity timestamps, Google token-introspection test, guarded elevated MAPI repair, auth/diagnostics/update controls, and About/privacy/license/support are wired. The Status and About modals passed type/accessibility, small-window scroll, keyboard focus, and Escape/focus-return Windows checks on 2026-08-29 | Verify Gmail test with the real account and complete installed UAC repair/refresh once in final Windows acceptance |
| Complete active rebrand | Verified | Shipping identifiers use SendArc; stale sandbox/Azure/installer and disabled silent-update paths were removed; intentional module/namespace/legal/test-only matches are classified in [REBRAND_AUDIT.md](REBRAND_AUDIT.md) | Re-run the classified audit at the release tag |
| Clean checkout desktop build | Verified | GitHub Actions [run 33122480690](https://github.com/maxtop9843-byte/sendarc/actions/runs/33122480690) passed the Wails app and all interceptor matrices at `2be8d82` on `windows-2025` | Repeat at the immutable release candidate/tag |

## Installer, updates, and Windows validation

| Requirement | Status | Evidence | Gap / release gate |
|---|---|---|---|
| x64 and x86 interceptor builds | Verified | GitHub Actions [run 33122480690](https://github.com/maxtop9843-byte/sendarc/actions/runs/33122480690) passed x64/x86 Debug/Release builds and harness tests | Repeat at the immutable release candidate/tag |
| NSIS installer with SendArc paths/registry/uninstall entry | Verified by automated round-trip | `src/installer/SendArc.nsi`; GitHub Actions [run 33122480705](https://github.com/maxtop9843-byte/sendarc/actions/runs/33122480705) passed installer build and Pester install/uninstall round-trip | Perform the final interactive clean-Windows acceptance flow |
| Preserve/restore previous mail handler | Verified by automated round-trip | [Installer smoke run 33253969365](https://github.com/maxtop9843-byte/sendarc/actions/runs/33253969365) exercises JSON plus registry backup, repeated install/uninstall, and prior-handler restoration | Confirm once more in the final interactive acceptance flow |
| Coexistence; never remove unrelated mail apps | Verified by automated round-trip | [Installer smoke run 33253969365](https://github.com/maxtop9843-byte/sendarc/actions/runs/33253969365) plants Affixa, go-mapi, and an alternate default; verifies install preservation, restoration, and non-removal through repeated cycles | Repeat in final interactive acceptance |
| Notify-only update path | Implemented; verification pending | Metadata-only GitHub REST client, fixed repository/release origin, no binary-update dependency, no unattended task, and transport/security tests; [SECURITY_AUDIT.md](SECURITY_AUDIT.md) | Runtime click-through to the official SendArc release page and immutable-tag recheck |
| Unsigned-beta disclosure | Implemented in documentation | [CODE_SIGNING.md](CODE_SIGNING.md), README, IT notes, release template | Repeat disclosure on actual website/release/installer; verify artifact signature state |
| Authenticode signing | Missing but allowed fallback | No eligible no-payment credential confirmed | Unsigned beta is authorized; do not claim publisher trust or spend money |
| Windows install/MAPI/uninstall smoke | Implemented; verification pending | Current x64/x86 interceptor CI and installer Pester round-trip are green at `2be8d82` | Real legacy-application MAPI send, app launch, Gmail Sent, and interactive uninstall/restore remain |

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
| Current app/frontend tests | Verified at pushed head | [Build and Test run 33255244999](https://github.com/maxtop9843-byte/sendarc/actions/runs/33255244999) passed Go vet, both Go race suites, Svelte check, 77 frontend tests, Wails build, and x86/x64 Debug/Release interceptor matrices at `04c2adb` | Repeat after the new E2E gate lands and at the immutable release candidate/tag |
| Windows app E2E | Verified locally; CI gate added | Five real Wails/WebView2 Playwright scenarios passed on 2026-08-30 using hermetic local OAuth/Gmail services: arrival, local preview, explicit send with complete MIME, Cancel/Dismiss, multi-arrival, and repeated-401 re-auth | Confirm the newly added `windows-2025` E2E job at the pushed head |
| C++/installer CI | Verified at pushed head | x64/x86 Debug/Release jobs passed in [run 33255244999](https://github.com/maxtop9843-byte/sendarc/actions/runs/33255244999); 27-test Pester install/uninstall round-trip including version metadata, AUMID, license bundle, coexistence, and previous-handler restoration passed in [run 33255245018](https://github.com/maxtop9843-byte/sendarc/actions/runs/33255245018) | Repeat at the immutable release candidate/tag and in final interactive acceptance |
| Website CI/QA | Verified | [Website run 33255244995](https://github.com/maxtop9843-byte/sendarc/actions/runs/33255244995) passed at `04c2adb`; 20 live cross-viewport Playwright/axe scenarios also pass on the deployed site | Repeat after the release asset changes download state |
| Dependency/secret/security audit | Verified at pushed head | [Security run 33255245061](https://github.com/maxtop9843-byte/sendarc/actions/runs/33255245061) reproduced the checked-in dependency inventories and passed Gitleaks at `04c2adb`; both npm audits report 0 vulnerabilities, both Go modules report 0 reachable vulnerabilities, and the 595-commit history scan is clean; [SECURITY_AUDIT.md](SECURITY_AUDIT.md) | Confirm the next pushed-head CI and repeat against the immutable release tag |
| `v0.1.0-beta` tag/release | Missing; pipeline dry-run verified | Protected release [dry-run 33126115747](https://github.com/maxtop9843-byte/sendarc/actions/runs/33126115747) built the OAuth-injected unsigned installer and checksum and skipped publication as intended | Complete real Gmail/acceptance gates, then create the immutable tag and public release |
| Website download path | Missing | Release asset and production website do not yet exist | Verify real browser download of the exact checksummed installer |
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
