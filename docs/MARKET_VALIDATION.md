# SendArc market-validation plan

The first question is narrow: do teams that depend on legacy Windows Simple MAPI workflows value a safe Gmail bridge enough to install and test an unsigned beta?

No billing system is part of the probe. The Business Beta proposition may state a planned price of **$29/year per seat**, but it must also say **No charge today** and collect interest only.

## Funnel

1. Landing-page or `/affixa-alternative` visit.
2. Visitor understands “legacy Windows email action → local preview → explicit Send → Gmail”.
3. Download CTA click or Business Beta CTA click.
4. Versioned GitHub installer download.
5. Install and Google account connection.
6. First local preview.
7. First successful explicit send.
8. Sanitized compatibility report, support request, or voluntary beta feedback.

The website can measure steps 1–3 and GitHub can expose aggregate release-asset downloads. Desktop steps 4–8 are not silently instrumented in the initial beta. Do not infer successful installs or sends from a download count.

## Website measurement design

The production site at `https://sendarc.pages.dev` uses Cloudflare Pages/Pages Functions with these privacy-minimized mechanisms:

- Cloudflare Web Analytics, if enabled, for aggregate page/performance statistics;
- a first-party `/api/events` endpoint backed by D1 for an allowlist of landing/Affixa views, download CTA, beta CTA, and beta-submission events;
- referrer **host** and allowed UTM source/campaign values only;
- no cookie, cross-site ID, recipient/message fields, OAuth data, or stable visitor fingerprint.

The first-party event endpoint and `SENDARC_DB` binding were verified in production on 2026-08-28: an allowlisted event returned 204 and was retrievable in D1, while an invalid event returned 400. The synthetic event and its abuse-window rows were deleted immediately after verification. Optional Cloudflare Web Analytics is not required for the first-party measurement path.

## Business-beta data

The Cloudflare D1 binding is `SENDARC_DB`; the intended database is `sendarc-leads`. The form stores only work email, company, seat range, current workflow, optional note, allowed UTM values, and timestamps.

The live Business Beta endpoint returned 201 and the submitted declared fields were retrieved from D1 on 2026-08-28. The synthetic lead was deleted immediately after verification, and a follow-up query confirmed zero matching lead and event rows.

Rate limiting uses an hourly, endpoint-specific, secret-keyed IP hash in `abuse_windows` only. It is never stored with events or leads. Abuse windows expire after 24 hours, events after 90 days, and leads after 12 months from their latest submission (or earlier on a verified deletion request). The independent `sendarc-retention` Worker removes expired rows every 15 minutes, even without website traffic. Cloudflare recovery copies follow the separately disclosed backup period.

Retrieve records without building an admin dashboard:

```powershell
Set-Location website
npx wrangler d1 execute sendarc-leads --remote --command "SELECT created_at,email,company,seats_range,current_workflow,note,utm_source,utm_campaign FROM business_leads ORDER BY created_at DESC"
```

Delete after verifying a request sent to `maxtop9843@gmail.com` from the submitted address:

```powershell
Set-Location website
npx wrangler d1 execute sendarc-leads --remote --command "DELETE FROM business_leads WHERE lower(email)=lower('requester@example.com')"
```

Use [DATA_RETENTION.md](DATA_RETENTION.md) for deployment, aggregate verification and failed-cleanup recovery. The API records `business_beta_submit` only after a successful transactional save; `business_beta_cta` measures the submit-button attempt, including attempts that fail validation. Duplicate submissions count as attempts but update one lead row; neither count represents unique people.

## Safe signals

- landing and Affixa-alternative traffic by coarse source/campaign;
- download and Business Beta CTA conversion;
- GitHub release-asset download count;
- Business Beta submissions and requested seat ranges;
- recurring sanitized compatibility reports by application, Windows version, and x86/x64 architecture;
- repeated requests for Microsoft 365, RDS/Citrix, MSI, or managed deployment;
- voluntary reports of a successful preview/send and continued use.

Never collect recipients, subject/body text, attachment names, message-linked sizes, Gmail message IDs, OAuth tokens, local paths, or confidential application data.

## Decision gates

- **Message clarity:** most moderated testers can explain the product after viewing the hero for ten seconds.
- **Compatibility:** successful preview/send is independently verified in representative real MAPI callers across x86 and x64.
- **Activation:** qualified testers voluntarily confirm at least one sanitized successful send.
- **Trust:** privacy and unsigned-beta disclosures do not surprise testers after installation.
- **Demand:** multiple identifiable organizations describe a real legacy workflow and seat requirement, rather than submitting generic newsletter interest.

Set numerical go/no-go thresholds only after the site has a stable measurement baseline. Never fabricate traffic, customer, conversion, or quality scores.

## Reading each metric

| Metric | Source | Caveat |
|---|---|---|
| Page/performance aggregates | Cloudflare Web Analytics dashboard, when enabled | Not proof of a unique person or qualified demand |
| Allowlisted events | D1 event table through Wrangler | Clicks are not completed downloads/installs |
| Lead submissions | D1 `business_leads` query above | Self-reported; deduplicate carefully without building profiles |
| Release downloads | GitHub release asset API/page | Downloads can include retries, bots, and CI |
| Compatibility | GitHub compatibility issues | Voluntary, sanitized, and selection-biased |
| Successful send | Opt-in tester confirmation/evidence | No hidden desktop event is collected |
