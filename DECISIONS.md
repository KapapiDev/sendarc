# SendArc decisions

This log records decisions that future maintainers and autonomous agents must preserve unless later evidence requires a change.

## Product and ownership

- Product name: **SendArc**. The user explicitly chose to retain this name after a preliminary collision review.
- Parent developer brand: **KaPaPi**. SendArc remains the product name and is presented as **“A KaPaPi product”**; the product-family path is `https://kapapi.dev/sendarc/`.
- Operator: **장형진**.
- Current support contact: `maxtop9843@gmail.com`. A role address such as `support@sendarc.app` may replace it after the domain is purchased.
- The public beta is Gmail-only. Do not claim Microsoft 365 support until it is implemented and verified.

## Architecture and privacy

- Reuse the LGPL-3.0 go-mapi codebase and preserve its Git history, license, notices, and `upstream` remote.
- Exact upstream baseline: `b90fcb08754f910fc318cbc922cbf24702582463`.
- Flow: legacy Windows app → Simple MAPI interceptor → local per-user queue → local preview → explicit Send → Gmail API.
- OAuth scope is exactly `gmail.send` for the initial beta. No `gmail.compose`, mailbox-read, or profile scope.
- Automatic draft creation and automatic sending are disabled. A message cannot be transmitted before an explicit preview-and-Send action.
- OAuth tokens live in Windows Credential Manager. Message content never goes to a SendArc-owned server.

## Distribution

- Clean Windows builds and installer tests run in GitHub Actions on `windows-2025`; the current local Windows installation is used for source tests and development only.
- The no-payment beta may be unsigned. Every unsigned artifact and download surface must say so plainly; never advise users to disable Windows security controls.
- Updates are notify-only for the beta. The app may open the official GitHub release page but must not silently replace EXE/DLL files or create an automatic-update Scheduled Task.
- No payment may be made and no domain may be purchased autonomously.
- The owner has purchased and operates `kapapi.dev` for the KaPaPi developer brand. Its existing GitHub Pages product-family structure uses `/cleanpaste/`, `/sortdoc/`, and now reserves `/sendarc/` for SendArc.
- `SendArc.app` purchase and connection remain deferred. The full SendArc application/legal site continues on the generated Cloudflare URL until a path-aware migration is explicitly verified; the KaPaPi path may act as the product-family entry page without duplicating the full site.
- Hosting target is Cloudflare, replacing the original prompt's Vercel default.
- The planned site uses Cloudflare Pages/Pages Functions and a D1 binding named `SENDARC_DB`. Lead retention is at most 12 months after last contact; abuse hashes are at most 24 hours. Collection remains inactive until a real deployment/binding exists.

## External setup

- Use separate SendArc Google OAuth credentials rather than SortDoc production credentials. SortDoc may be consulted for non-secret operator/contact conventions only.
- Browser sessions may be used for authorized setup, but saved passwords must not be inspected or exposed. CAPTCHA, OTP, or forced reauthentication must not stop independent implementation and test work.
