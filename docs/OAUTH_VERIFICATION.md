# SendArc OAuth verification package

Prepared 2026-09-04. This is a submission preparation packet, **not evidence of
approval or a completed Gmail send**. Keep [REQUIREMENTS_MATRIX.md](REQUIREMENTS_MATRIX.md)
as the release gate. Never include OAuth client secrets, access/refresh tokens,
private mailbox contents or real customer attachments in the submission media.

## Identity and public materials

| Field | Prepared value |
| --- | --- |
| Google Cloud project | `sendarc` (SendArc) |
| OAuth application name | SendArc |
| Parent developer brand / operator | KaPaPi / 장형진 |
| Support and developer contact | `maxtop9843@gmail.com` |
| Homepage | `https://kapapi.dev/sendarc/` |
| Privacy | `https://kapapi.dev/sendarc/privacy.html` |
| Terms | `https://kapapi.dev/sendarc/terms.html` |
| Support | `https://kapapi.dev/sendarc/support.html` |
| Authorized root domain to verify | `kapapi.dev` |
| Desktop icon for branding | `docs/design/brand/sendarc-icon-128.png` |
| Only requested scope | `https://www.googleapis.com/auth/gmail.send` |

The KaPaPi entry is a real publicly accessible product-description page, not a
cross-domain redirect. It explains local message handling and the Gmail permission
and links to the matching privacy notice. The separate full product site remains
at `sendarc.pages.dev` pending consolidation under the owner's chosen path.
The root/other product pages must not be changed to impersonate SendArc.

Last authenticated console inspection (2026-09-02) showed External / Testing,
one test user, the dedicated Windows Desktop client and exactly `gmail.send`.
Branding still used `sendarc.pages.dev` homepage/policy URLs and did not have an
uploaded logo. Those observations must be revalidated before editing or submitting.
No transition to Production or verification submission is recorded as complete.

## Scope justification (prepared text)

SendArc is a Windows Simple MAPI bridge for people whose existing desktop
applications compose outgoing email. It receives the outgoing recipients,
subject, body and attachments locally and displays a preview. Only after the user
presses Send does SendArc construct the MIME message on the Windows device and
call Gmail's users.messages.send endpoint for the connected Google account.
The gmail.send permission is necessary for that explicit user-facing action.
SendArc does not read the inbox, list messages, search the mailbox, create Gmail
drafts, or access contacts or calendars. No narrower Gmail permission can send
the composed message. Tokens remain in Windows Credential Manager; message
content is sent directly to Google, never through a KaPaPi or SendArc server.

## Domain ownership gate

Use Google Search Console under an account that owns the SendArc Cloud project.
Check for an existing verified **Domain property** for `kapapi.dev` first. If
absent, obtain the actual DNS verification value from Search Console, add that
exact TXT record through the authorized DNS account and verify it. Never invent
the record, replace unrelated DNS entries or infer verification from a working
website alone. Google's current guidance calls for DNS-level Domain-property
verification, not merely a URL-prefix property. [Google domain verification guidance](https://support.google.com/cloud/answer/13804266?hl=en)

After verified ownership and required action-time authority, save the matching
homepage/privacy/terms URLs and logo in the SendArc project's Branding screen.
Confirm the saved values by reopening the screen. Keep the Desktop installed-app
client and loopback/PKCE flow; do not create a Web client or add mailbox-read scope
to solve a branding issue. [Google homepage requirements](https://support.google.com/cloud/answer/13807376?hl=en)

## Demonstration recording plan

Use the release-candidate Windows build and only a sanitized synthetic message
addressed to an explicitly authorized controlled test mailbox. Recording must
show the real app and real consent flow in English; do not simulate Google's UI,
splice a fake success state, bypass an unsafe-app warning or show a different app.

1. Introduce SendArc and its KaPaPi relationship. Show the public product/privacy
   pages and the app version without any credential values.
2. Start Connect from the desktop app. Show the system-browser Google consent
   screen, SendArc identity, matching policy links and only the send permission.
3. Complete consent and show the app's connected state and connection test.
4. Use the installed x86 or x64 synthetic MAPI harness (and a representative
   legacy app when available) to supply synthetic To/Cc/Bcc, subject, Unicode
   body and harmless attachment. Show the local preview before sending.
5. Demonstrate Cancel on one request. For a fresh request, use the explicit Send
   button and show the app's real success state.
6. Independently verify the uniquely labelled test message in Gmail Sent. Do not
   expand unrelated messages or increase SendArc's permissions for this check.
7. Show disconnect/reconnect behavior and explain Credential Manager storage and
   the direct-to-Google data path. Provide implementation/network evidence for
   that path separately; a video alone cannot prove a negative network claim.

Publish the recording only to a reviewer-accessible, authorized location and
check its access before including its link. A script or local screenshot is not
a substitute for the recording. [Google demo-video requirements](https://support.google.com/cloud/answer/13804565?hl=en)

## Before submission

- Revalidate the actual console state and all four public URLs.
- Verify domain ownership with the project-owner account.
- Confirm the branding is saved and the consent screen matches it.
- Complete real Gmail send/Sent and disconnect/reconnect evidence.
- Create and check the real demonstration recording.
- Use Google's current verification workflow; do not report approval from the
  Testing-mode message that verification is not yet required.
- If Google requires an identity/legal attestation or human challenge, prepare
  the exact remaining step without asserting it was performed.
- Keep installer/UAC, final release artifact and end-to-end acceptance gates
  separate. OAuth approval alone does not complete the launch.
