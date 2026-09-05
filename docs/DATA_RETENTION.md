# Website data minimization and retention

Policy date: 2026-09-04. Scope: the product site's Cloudflare D1 database
`sendarc-leads` (`246981a9-e731-4fc0-ac07-9377ad61c54f`). No desktop email
data is stored here. Do not export lead rows into CI artifacts or agent logs.

## Collection boundaries

- `site_events`: fixed event name and public route, hostname-only referrer,
  campaign labels limited to `[A-Za-z0-9_-]` and 64 characters. No visitor ID.
- `business_leads`: declared contact/workflow fields and timestamps only.
  Successful saves and their content-free submission events use a D1 transaction.
- `abuse_windows`: HMAC-SHA-256 over IP + endpoint + hourly window, keyed by
  the Pages secret `ABUSE_HASH_SALT`. No public default key, raw IP or user-agent.
  If that secret is missing, form saves return 503 and analytics do not collect.
- Browser referrers are reduced before payload transmission; the product site's
  `Referrer-Policy: strict-origin` also avoids full same-origin Referer headers.
- JSON requests are bounded to 2 KiB for events and 8 KiB for leads, even when
  Content-Length is missing or false. Only plain object payloads are accepted.

## Schedule and expiry

`website/retention/wrangler.jsonc` deploys the cron-only `sendarc-retention`
Worker. It shares the existing D1 binding and has no HTTP route, workers.dev
endpoint or preview URL. One trigger runs every 15 minutes in UTC.

| Table | Expiry boundary | Indexed field |
| --- | --- | --- |
| `abuse_windows` | Hourly window older than 24 hours | `window_start` |
| `site_events` | At least 90 days old | `created_at` |
| `business_leads` | At least 12 calendar months since the latest form submission | `updated_at` |

Cleanup uses the scheduled timestamp, parameter binding and one D1 batch.
Duplicate/retried invocations are idempotent. Leap-day subtraction uses SQLite's
`floor` modifier. Rows expire at the above boundary and are deleted on the next
successful scheduled cleanup, normally within 15 minutes; outages can delay it.
The Worker logs only `retention_complete`, scheduled time and three row counts.
Unexpected failures remain failed executions, not false success messages.

This stays on the existing Workers/D1 free plan; no paid subscription, storage
product or external scheduler is required. Free quota exhaustion causes errors,
not an automatic upgrade. [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/)
and [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/).

## Deploy and verify

From `website`, after authentication and passing `npm run qa`:

1. Provision `ABUSE_HASH_SALT` with `wrangler pages secret put ABUSE_HASH_SALT
   --project-name sendarc`, using a cryptographically random value through stdin.
   Never print it, use a public default, or put it in Wrangler vars. For local
   development use gitignored `.dev.vars` with a separate disposable key.
2. Deploy the new Pages Functions before migrating, so old handlers stop writing
   `visitor_hash`. `npm run pages:deploy` is the ordinary Pages deployment path.
3. Inspect aggregate counts, then `npm run db:migrate:remote`. Migration 0001 is
   idempotent for the original directly provisioned schema. Migration 0002 clears
   only legacy event hash values and adds the lead expiry index; event counts and
   contact records are preserved.
4. Run `npm run retention:check`, then `npm run retention:deploy`.
5. Inspect the schedule and a **real cron invocation** with `wrangler tail
   sendarc-retention --format json`. Propagation can take up to 15 minutes; do not
   claim successful execution merely from a deploy receipt.
6. Query aggregate expired-row counts. Normal result after a successful run is
   zero. Inspect Workers Cron Events/Logs if the counts persist.

```sql
SELECT
  (SELECT count(*) FROM site_events WHERE visitor_hash <> '') AS event_identifiers,
  (SELECT count(*) FROM abuse_windows WHERE window_start < unixepoch('now')-86400) AS expired_abuse,
  (SELECT count(*) FROM site_events WHERE created_at <= strftime('%Y-%m-%dT%H:%M:%fZ','now','-90 days')) AS expired_events,
  (SELECT count(*) FROM business_leads WHERE updated_at <= strftime('%Y-%m-%dT%H:%M:%fZ','now','-12 months','floor')) AS expired_leads;
```

`npm run test:unit` runs isolated, real local D1 tests (remote bindings disabled,
no persisted test database): expiry boundaries, fresh rows, recently updated
leads, leap day, idempotence, transaction rollback, rate-limit concurrency,
legacy-hash scrubbing, malformed/oversized bodies and payload minimization.
`npm run retention:check` verifies generated binding types and the Worker bundle.

## Failure, rollback and deletion requests

Check failures against the specific Worker deployment and D1 database. Do not
create a second scheduler or broadly delete tables. Fix the failing binding,
quota or query, rerun local tests, redeploy and verify the next scheduled run.
If the schedule is disabled for maintenance, restore it before calling retention
operational. Do not roll Pages back to a version that writes visitor identifiers.

For a verified deletion request, match the exact submitted email in the private
operator workflow and delete only that lead. Record completion without copying
the address or note into public issues. No event visitor profile needs removal.

Cloudflare D1 Time Travel retains recovery history for seven days on the free
plan. No additional database backup is created by this project. After any
restore, reapply identifier scrubbing and retention, and reapply verified
deletions from private support records before resuming use. Do not restore old
data merely to resurrect expired leads. [D1 recovery history](https://developers.cloudflare.com/d1/reference/time-travel/)
