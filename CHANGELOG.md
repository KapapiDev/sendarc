# Changelog

All notable SendArc changes are documented here.

## [Unreleased] — 0.1.0-beta

### Added

- Gmail `users.messages.send` transport with a top-level `raw` MIME payload.
- Local preview-first Send/Cancel flow.
- Minimal `gmail.send` OAuth scope and Windows Credential Manager storage under the SendArc service name.
- MIME and attachment validation, bounded message size, randomized MIME boundaries, and typed privacy-safe Gmail errors.
- Attachment filename traversal defenses in both MAPI conversion and the filesystem copy boundary.
- Bug, compatibility, and feature-request issue forms with privacy guidance.
- SendArc privacy, security, OAuth, release, code-signing, architecture, market-validation, and requirement-evidence documentation.
- Rebranded application/installer/release assets and Cloudflare website work for the first beta.

### Changed

- Disabled the upstream automatic-draft worker and rejected legacy `auto-draft` settings.
- Removed direct send/draft actions from Windows notifications; notifications open the local review flow.
- Replaced Gmail draft creation in the user-facing path with explicit send.
- Changed the product/repository identity from go-mapi to SendArc while retaining upstream Go module paths and legal attribution where appropriate.
- Changed the deployment target from the original Vercel assumption to Cloudflare; custom-domain purchase remains deferred.
- Changed updates to a notify-only flow that opens the official GitHub release page.

### Security

- Gmail response bodies and message-derived file paths are excluded from frontend errors and application logs.
- Missing recipients, header injection, unsafe attachment names, stale refresh state, and path traversal are rejected.

### Known beta constraints

- Gmail/Google Workspace only; no Microsoft 365 transport.
- No public release is complete until the tagged Windows CI, installer round-trip, real Gmail send, and end-to-end acceptance flow are green.
- The no-payment beta may be unsigned and must disclose possible SmartScreen or enterprise-policy blocking.
- The custom `SendArc.app` domain is not purchased or connected.
