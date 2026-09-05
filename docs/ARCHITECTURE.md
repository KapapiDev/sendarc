# SendArc architecture

## Message path

```text
Legacy Windows application (32-bit or 64-bit)
  → Simple MAPI call
  → architecture-matched SendArc MAPI DLL
  → per-user local queue (JSON + copied attachments)
  → SendArc desktop app and local preview
  → explicit user Send
  → Gmail users.messages.send over HTTPS
  → Gmail Sent
```

The MAPI call is captured asynchronously: the originating legacy application learns that SendArc accepted the message into the local queue, not that Gmail ultimately delivered it. The desktop UI is therefore the authoritative send-status surface.

## Components

- `src/interceptor`: native Simple MAPI DLL, built for x86 and x64. It converts ANSI/Wide MAPI structures, copies attachments into an isolated queue item, and atomically writes the message envelope.
- `internal/mapi`: queue protocol, watcher, MIME construction, and Gmail transport.
- `src/app`: Wails/Go desktop host, OAuth lifecycle, Credential Manager integration, queue coordination, notifications, tray, and update metadata.
- `src/app/frontend`: Svelte local preview. It renders message content as text, keeps it on-device, and exposes explicit Send/Cancel/Discard actions.
- `src/installer`: Windows installer and uninstall/registry restoration logic.
- `website`: Astro site for Cloudflare Pages, with Pages Functions and an optional D1-backed privacy-minimized lead/event funnel. This infrastructure is separate from the desktop message path.

## Trust boundaries

1. MAPI input is untrusted. Recipients, headers, attachment names, and paths are validated before queueing and again before MIME construction/copy.
2. Queue files are local untrusted input. The watcher validates protocol fields; sending validates again.
3. OAuth tokens never enter queue files or logs. Production tokens are stored under the `SendArc` service in Windows Credential Manager.
4. Message data is not sent to SendArc infrastructure. Only the Gmail API receives it after an explicit click.
5. Website analytics and beta forms are isolated from the desktop message path and must never accept message-derived fields.

## Send invariant

There is one user-facing transmit operation: `App.SendMessageForID`. It resolves a currently queued message, performs an authenticated Gmail call with a bounded context, marks the queue item processed only after a 2xx Gmail response, and emits a privacy-safe result. Notifications may open the preview but cannot send. Legacy auto-draft code is not started and automatic mode is rejected.

## Local data lifecycle

Each intercepted item remains in the per-user queue until one of these events:

- Gmail accepts the explicit send, after which `MarkProcessed` removes it;
- the user chooses Discard;
- local administrative maintenance removes it.

Cancellation only closes the preview and keeps the queued item. Failed sends also keep the item for review/retry.
