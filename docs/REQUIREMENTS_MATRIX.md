# SendArc requirement-completion matrix

Last audited: 2026-08-28 against `SENDARC_AUTONOMOUS_A_TO_Z_BUILD_PROMPT.md`, the current worktree, GitHub repository state, and the conversation overrides.

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
| Preserve LGPL/license/attribution | Implemented; verification pending | [LICENSE](../LICENSE), [THIRD_PARTY_NOTICES.md](../THIRD_PARTY_NOTICES.md), preserved history/module paths | Generate and inspect complete release dependency/license inventory; include notices in installer/About; verify matching source tag |
| Brand remains SendArc | Verified decision | [DECISIONS.md](../DECISIONS.md) records the owner's explicit decision | Apply consistently to all active machine/user-facing identifiers |
| Brand collision review | Implemented; verification pending | [BRAND_CLEARANCE.md](BRAND_CLEARANCE.md) | Preliminary engineering search recommends professional similarity/common-law review before spending or broad launch |
| Visual reference preserved | Verified | [SendArc-final-reference.png](design/SendArc-final-reference.png) | None |
| Production logo/icon set | In progress | Website SVG marks exist under `website/public`; installer/app assets are being reworked | Verify original vector mark plus Windows ICO resources at required sizes/light-dark variants; do not use screenshot crops |

## Desktop product

| Requirement | Status | Evidence | Gap / release gate |
|---|---|---|---|
| Gmail `users.messages.send` transport | Implemented; verification pending | `internal/mapi/gmail.go` uses `/messages/send`; request/error tests in `gmail_test.go` | Current clean Windows CI and a real Gmail Sent result |
| Exact `gmail.send` scope; no mailbox/profile scope | Implemented; verification pending | `src/app/auth.go`, [OAUTH.md](OAUTH.md) | Inspect actual consent URL/screen and Google Cloud configuration |
| Windows Credential Manager token storage | Implemented; verification pending | Keyring service `SendArc`, account `oauth-tokens` in `src/app/auth.go` | Real Windows save/load/refresh/disconnect/reconnect evidence |
| Local preview before transmission | Implemented; verification pending | `QueueRow.svelte` and `App.svelte`; 64 frontend tests passed locally on 2026-08-28 | Wails/Windows runtime and real MAPI foreground/preview flow |
| Explicit Send and Cancel/Discard; no auto-send/draft | Implemented; verification pending | `App.SendMessageForID`, manual-only settings, removed auto-mode controls; [ARCHITECTURE.md](ARCHITECTURE.md) | Current Go suite/Windows build plus runtime proof that notifications cannot send |
| Preserve To/Cc/Bcc/subject/body/attachments/Unicode | Implemented; verification pending | Go protocol/MIME tests and C++ converter/harness tests in the worktree | x86 and x64 harness must run against exact built DLLs; representative real applications still untested |
| Attachment/path/header validation | Implemented; verification pending | Go validation tests and C++ `fs_utils`/`message_converter` regression tests | Clean x86/x64 CTest and adversarial Windows file tests |
| Privacy-safe errors/logging/diagnostics | Implemented; verification pending | Typed Gmail errors, generic frontend errors, sanitized ID logging, [SECURITY.md](../SECURITY.md) | Full log inspection under auth/API/path failures and secret scan |
| Success/actionable failure and retry | Implemented; verification pending | `send-result` event/UI states and queue retention on failure | Runtime offline, expired-auth, Gmail 4xx/5xx, success, retry evidence |
| Single-account connect/disconnect/re-auth | Implemented; verification pending | Auth manager/bindings/UI and tests in `src/app` | Real account flow; account identity is intentionally generic without profile scopes |
| Polished Status/Account/Settings/About functions | In progress | Existing Wails/Svelte UI provides auth, queue, pause/update surfaces | Audit requested status/MAPI repair/test-connection/diagnostics/About functions; remove any control without a real action |
| Complete active rebrand | In progress | SendArc names/paths/AUMID/package/installer work exists in the worktree | Run classified search; distinguish lawful upstream module/license references from stale active product identifiers |
| Clean checkout desktop build | Missing for SendArc changes | Baseline run only | Push current branch and obtain green clean `windows-2025` build |

## Installer, updates, and Windows validation

| Requirement | Status | Evidence | Gap / release gate |
|---|---|---|---|
| x64 and x86 interceptor builds | In progress | Rebranded CMake/build/harness files in worktree | Green builds/tests on `windows-2025` |
| NSIS installer with SendArc paths/registry/uninstall entry | In progress | `src/installer/SendArc.nsi` and smoke tests in worktree | Clean compile and Pester round-trip |
| Preserve/restore previous mail handler | In progress | Installer logic/tests are being rebranded | Verify clean install, upgrade, uninstall, and safe restore on Windows |
| Coexistence; never remove unrelated mail apps | In progress | Installer requirements/tests under development | Test existing go-mapi, Affixa marker, and alternate default; verify no unrelated deletion |
| Notify-only update path | In progress | Product decision and update code/workflow changes; [DECISIONS.md](../DECISIONS.md) | Go tests and runtime click-through to official SendArc release page; prove no silent task/path remains active |
| Unsigned-beta disclosure | Implemented in documentation | [CODE_SIGNING.md](CODE_SIGNING.md), README, IT notes, release template | Repeat disclosure on actual website/release/installer; verify artifact signature state |
| Authenticode signing | Missing but allowed fallback | No eligible no-payment credential confirmed | Unsigned beta is authorized; do not claim publisher trust or spend money |
| Windows install/MAPI/uninstall smoke | Missing for current SendArc build | Baseline CI is insufficient | Required clean Windows evidence, including x86/x64 and previous-handler restore |

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
| Current app/frontend tests | Partial | On 2026-08-28, frontend: 64 tests passed, Svelte check 0 errors/warnings, production build passed; `internal/mapi` Go tests passed | App Go package and all adjacent suites must pass after active rebrand merges |
| C++/installer CI | In progress | Workflows and harness/smoke repairs in worktree | Push and obtain unmasked green x86/x64/installer results |
| Website CI/QA | Verified locally; clean CI pending | Lint/typecheck/build/link scan pass; 5 unit and 20 Playwright desktop/tablet/mobile/landscape tests pass with axe; full-page visual artifact recorded | Push and obtain green GitHub Actions |
| Dependency/secret/security audit | In progress | Attachment/header/error hardening and policies exist | Resolve/document npm audit findings; Go/vendored/website dependency review; secret scan; update-integrity and installer command-injection review |
| `v0.1.0-beta` tag/release | Missing | No SendArc release returned by GitHub on 2026-08-27 | Green candidate, immutable tag, versioned installer, checksums, source, complete notes |
| Website download path | Missing | Release asset and production website do not yet exist | Verify real browser download of the exact checksummed installer |
| Real Google OAuth + Gmail Sent | In progress | Dedicated Google Cloud project `sendarc` exists and Gmail API is enabled; unit/local mock evidence passes | Complete SendArc consent/client configuration, inject protected credentials, then prove an explicit send in Gmail Sent |
| Complete 19-step acceptance flow | Missing | No single end-to-end evidence set | Verify discovery → download → install → registration → OAuth → MAPI → preview → Send → Gmail Sent → uninstall/restore |

## Owner constraints applied

- No payment has been authorized; no purchase is part of completion.
- Cloudflare replaces the prompt's Vercel default.
- Domain purchase/connection is deferred.
- The beta may ship unsigned when no legitimate free signing route is available, with explicit warnings.
- Windows updates are not required locally; clean Windows verification uses GitHub Actions `windows-2025`.
- Operator: 장형진. Support: `maxtop9843@gmail.com`.

The project is **not complete or launched** while any release-critical row above remains In progress, Missing, or lacks the stated verification.
