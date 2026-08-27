# SendArc privacy policy

Last updated: 2026-08-27

SendArc is operated by 장형진. Privacy and deletion requests may be sent to `maxtop9843@gmail.com`.

## Desktop application

SendArc processes an outgoing Simple MAPI message locally so it can show a preview before sending. This may include To, Cc, Bcc, subject, body, formatting, and attachments. Pending message JSON and copied attachments remain in a per-user folder on the Windows device until the message is sent, discarded, or removed through local maintenance.

When the user clicks **Send**, the desktop application builds the MIME message locally and sends it directly to Google's Gmail API over HTTPS using the connected Google account. SendArc does not route message content through a SendArc-owned server and does not read the user's inbox.

OAuth tokens are stored through Windows Credential Manager. The beta requests only `https://www.googleapis.com/auth/gmail.send`. It does not request `gmail.compose`, mailbox-read, contacts, or calendar access. Users can disconnect SendArc and revoke its access from their Google Account.

The desktop beta has no hidden telemetry, advertising, or sale of user data. Local logs are designed to exclude OAuth tokens, recipients, subjects, bodies, attachment names, local attachment paths, Gmail message IDs, and Gmail response bodies. Users should nevertheless inspect and sanitize diagnostics before sharing them.

## Website hosting and measurement

The planned public site uses Cloudflare Pages and Pages Functions. When Cloudflare hosting is deployed, Cloudflare processes ordinary request, security, and delivery data under its own terms. Cloudflare Web Analytics may be enabled for aggregate page/performance measurement.

The site also prepares a first-party, allowlisted event endpoint for:

- landing and Affixa-alternative page views;
- download and business-beta CTA clicks;
- business-beta form submission.

Those events contain only the event name, referrer host, and allowed UTM source/campaign values. They do not use a cross-site identifier or accept desktop email data. Until the Cloudflare project, analytics, and D1 bindings are actually deployed, no public-site collection through that configuration is claimed as active.

## Business-beta form

When deployed, the form stores only:

- work email;
- company name;
- approximate seat range;
- current workflow category;
- optional note;
- allowed UTM source/campaign values;
- submission time.

Do not submit email-message content, recipients, attachments, OAuth tokens, credentials, or confidential client data in the note. Form records are stored in a Cloudflare D1 database bound to the site as `SENDARC_DB` and are used only to evaluate and contact people about the SendArc beta.

For abuse prevention, the form may store a SHA-256 hash derived from IP address and user-agent for no more than 24 hours; the raw values are not placed in the lead record. Lead records are deleted at the earlier of a valid deletion request or 12 months after the last product/beta contact, unless a shorter period is required by law. SendArc does not sell form data.

## Other processors

- Google processes OAuth and Gmail API data under Google's terms and privacy policies.
- Cloudflare processes deployed website delivery, security, analytics, Pages Functions, and D1 data when those services are enabled.
- GitHub processes release downloads, issues, and security reports submitted through GitHub.

## User choices

Users can cancel or discard a pending local message, disconnect Google access, revoke access in their Google Account, and uninstall SendArc. Website visitors can avoid the optional business-beta form. To request access to or deletion of beta-form data, email `maxtop9843@gmail.com` from the submitted address.

## Changes

Material changes are recorded in this repository and published with an updated date before they apply to a release or deployed site.
