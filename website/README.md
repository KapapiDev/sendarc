# SendArc website

Public marketing, documentation, support, and Business Beta site for SendArc. It is a static Astro site with Cloudflare Pages Functions for first-party lead capture and minimal funnel events.

## Local development

Requirements: Node.js 24 or newer.

```powershell
npm ci
npm run dev
```

Run the full local quality gate:

```powershell
npm run qa
```

The Playwright suite covers 1440×900 desktop, 768×1024 tablet, and 390×844 mobile layouts. It checks navigation, FAQ behavior, the beta form, release routing, internal links, and axe accessibility rules.

## Cloudflare Pages

- Project name: `sendarc`
- Build command: `npm run build`
- Output directory: `dist`
- Root directory in the repository: `website`
- Functions directory: `functions`
- D1 binding name: `SENDARC_DB`

Create a free D1 database named `sendarc-leads`, bind it to the Pages project as `SENDARC_DB`, then apply `migrations/0001_business_beta.sql`. The checked-in `wrangler.jsonc` intentionally contains no made-up database UUID; bind the actual database in Cloudflare or add its real ID to the configuration before deployment.

For local Functions testing after a build:

```powershell
npm run db:migrate:local
npm run pages:dev
```

Cloudflare Web Analytics can be enabled from the Pages project Metrics screen. It provides aggregate page/performance data. The site additionally posts a small allowlist of first-party funnel events to `/api/events`; those events are recorded only when `SENDARC_DB` is bound.

## Data retrieval and deletion

Retrieve leads without an admin UI:

```powershell
npx wrangler d1 execute sendarc-leads --remote --command "SELECT created_at,email,company,seats_range,current_workflow,note,utm_source,utm_campaign FROM business_leads ORDER BY created_at DESC"
```

Delete a lead after a verified request to `maxtop9843@gmail.com`:

```powershell
npx wrangler d1 execute sendarc-leads --remote --command "DELETE FROM business_leads WHERE lower(email)=lower('requester@example.com')"
```

Business Beta records are retained for at most 12 months after the last beta/product contact, then deleted. Abuse-prevention hashes are deleted after 24 hours. No desktop email content is collected.
