# SendArc security policy

## Report a vulnerability privately

Use GitHub's private [security advisory form](https://github.com/maxtop9843-byte/sendarc/security/advisories/new) or email `maxtop9843@gmail.com`. SendArc is operated by 장형진.

Do not open a public issue for a vulnerability and do not send live OAuth tokens, passwords, private attachments, email bodies, recipient lists, Gmail response bodies, or confidential client data. A sanitized reproduction, affected SendArc version, Windows version, calling application/architecture, and non-sensitive diagnostic excerpt are enough to begin triage.

There is no guaranteed response-time SLA for the beta. A report will be acknowledged and handled privately as capacity permits. Security fixes are published as a new immutable version; a released binary is never silently replaced under the same tag/checksum.

## Security boundaries

SendArc accepts untrusted Simple MAPI input on the user's Windows machine, validates it, and writes a per-user local queue item. It displays a local preview and transmits only after the user clicks Send. Message content then travels directly from the desktop app to Google's Gmail API over HTTPS. SendArc has no email relay or message-content server.

The public beta:

- requests only `https://www.googleapis.com/auth/gmail.send`;
- does not request mailbox-read, `gmail.modify`, `gmail.compose`, contacts, calendar, or broad `mail.google.com` access;
- uses OAuth Authorization Code with PKCE, a random state value, and an ephemeral `127.0.0.1` callback;
- stores tokens through Windows Credential Manager;
- does not auto-send or create Gmail drafts in the user-facing path;
- keeps desktop telemetry off by default;
- must not log tokens, recipients, subjects, bodies, attachment names, local attachment paths, Gmail message IDs, or Gmail response bodies.

Queue files and copied attachments contain sensitive message data and inherit the security of the signed-in Windows account and local filesystem. Users and administrators should not share that directory or include it in public diagnostics.

## Release integrity

Every binary release must have a matching public source tag and `SHA256SUMS.txt`. Verify checksums after downloading the final immutable artifacts. The no-payment beta may be unsigned and must be labeled **Unsigned beta** wherever it is downloadable.

Do not disable Microsoft Defender, SmartScreen, AppLocker, WDAC, browser protections, or enterprise controls to run SendArc. If policy requires a trusted publisher, wait for a properly signed release.

## Supported versions

Until a stable release exists, only the newest published beta is eligible for security fixes. Unpublished source branches and superseded betas are not supported releases. Current verification and known gaps are listed in [docs/REQUIREMENTS_MATRIX.md](docs/REQUIREMENTS_MATRIX.md).
