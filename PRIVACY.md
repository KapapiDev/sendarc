# SendArc privacy policy

Last updated: 2026-09-04

SendArc is operated by 장형진 under the KaPaPi developer brand. Privacy and deletion requests may be sent to `maxtop9843@gmail.com`.

## Desktop application

SendArc processes an outgoing Simple MAPI message locally so it can show a preview before sending. This may include To, Cc, Bcc, subject, body, formatting, and attachments. Pending message JSON and copied attachments remain in a per-user folder on the Windows device until the message is sent, discarded, or removed through local maintenance.

When the user clicks **Send**, the desktop application builds the MIME message locally and sends it directly to Google's Gmail API over HTTPS using the connected Google account. SendArc does not route message content through a SendArc-owned server and does not read the user's inbox.

OAuth tokens are stored through Windows Credential Manager. The beta requests only `https://www.googleapis.com/auth/gmail.send`. It does not request `gmail.compose`, mailbox-read, contacts, or calendar access. Users can disconnect SendArc and revoke its access from their Google Account.

SendArc's use and transfer of information received from Google APIs adheres to the [Google API Services User Data Policy](https://developers.google.com/terms/api-services-user-data-policy), including the Limited Use requirements. Google user data is not sold, used for advertising, or used to train general-purpose AI models.

The desktop beta has no hidden telemetry, advertising, or sale of user data. Local logs are designed to exclude OAuth tokens, recipients, subjects, bodies, attachment names, local attachment paths, Gmail message IDs, and Gmail response bodies. Users should nevertheless inspect and sanitize diagnostics before sharing them.

## Website hosting and measurement

The product site uses Cloudflare Pages and Pages Functions. Cloudflare processes ordinary request, security, and delivery metadata under its own policies. The site uses first-party events rather than advertising cookies or cross-site tracking.

The first-party, allowlisted event endpoint measures:

- landing and Affixa-alternative page views;
- download and business-beta CTA clicks;
- business-beta form submission.

Events contain an event name, a known public page path, referrer hostname and coarse UTM source/campaign labels (letters, digits, underscores or hyphens, at most 64 characters). Full referrer URLs are stripped in the browser before transmission. Arbitrary paths, URL parameters and visitor identifiers are not stored in events. A beta-submission event is recorded atomically with a successful form save, not merely a button click. Event records expire after 90 days.

## Business-beta form

The form stores only:

- work email;
- company name;
- approximate seat range;
- current workflow category;
- optional note;
- allowed UTM source/campaign values;
- submission time.

Do not submit email-message content, recipients, attachments, OAuth tokens, credentials, or confidential client data in the note. Form records are stored in a Cloudflare D1 database bound to the site as `SENDARC_DB` and are used only to evaluate and contact people about the SendArc beta.

For abuse prevention, a separate rate-limit table stores a secret-keyed HMAC-SHA-256 derived from the connecting IP, endpoint and hourly window. It rotates hourly, differs between endpoints and is never included in events or lead records. Raw IP and user-agent values are not copied into these tables. Abuse records expire 24 hours after the start of their hourly window. Lead records expire 12 months after the latest form submission, or earlier on a verified deletion request. SendArc does not sell form data.

## Retention execution and recovery copies

The `sendarc-retention` scheduled Worker deletes expired records every 15 minutes, including when the site has no traffic. Records are removed on the next successful cleanup after expiry; service outages can delay deletion. It logs only execution time and deleted row counts. See [the operational procedure](docs/DATA_RETENTION.md) for verification and recovery.

Cloudflare's D1 recovery history can retain deleted data for up to seven additional days on the current free plan. Recovery copies are not used for routine analytics or marketing. A database restore must reapply identifier scrubbing, expired-record cleanup and any verified deletion requests before the restored data is used. [Cloudflare Time Travel documentation](https://developers.cloudflare.com/d1/reference/time-travel/)

## Other processors

- Google processes OAuth and Gmail API data under Google's terms and privacy policies.
- Cloudflare processes website delivery, security, Pages Functions, D1 and maintenance logs.
- GitHub serves the KaPaPi brand site and processes source access, release downloads, issues and security reports submitted through GitHub.
- The product site hosts its own fonts. KaPaPi brand pages load fonts from Google Fonts; Google receives ordinary font-request metadata.

## User choices

Users can cancel or discard a pending local message, disconnect Google access, revoke access in their Google Account, and uninstall SendArc. Website visitors can avoid the optional business-beta form. To request access to or deletion of beta-form data, email `maxtop9843@gmail.com` from the submitted address.

## Changes

Material changes are recorded in this repository and published with an updated date before they apply to a release or deployed site.
