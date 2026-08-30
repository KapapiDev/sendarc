import { createServer, type Server, type IncomingMessage, type ServerResponse } from 'node:http';
import { AddressInfo } from 'node:net';

// Phase 11 plan 06 — minimal HTTP server impersonating the Gmail API.
//
// The Wails app's GmailClient (internal/mapi/gmail.go) accepts a base URL
// override; the e2e shim writes that override from SENDARC_E2E_GMAIL_BASE_URL.
// Routes intentionally mirror the Gmail v1 paths the real client posts to:
//   POST /upload/gmail/v1/users/me/messages/send → SendMessage
// The drafts route deliberately fails and records any attempt. The public beta
// must never create a Gmail draft or depend on the gmail.compose scope.
//
// Tests can queue per-call status overrides via failNextWith — used by the
// invalid-grant regression spec to force a 401 → AuthManager classifies it
// → ReAuthBanner appears.
//
// Address must be 127.0.0.1, not localhost. Go's HTTP client occasionally
// resolves localhost to ::1 first; if the server only binds IPv4 the call
// returns ECONNREFUSED before any test assertion fires.

export interface GmailCall {
  body: string;
  headers: Record<string, string | string[] | undefined>;
}

export interface FakeGmailControl {
  url: string;
  port: number;
  messages: GmailCall[];
  draftAttempts: GmailCall[];
  failNextWith(status: number): void;
  reset(): void;
  close(): Promise<void>;
}

export async function startFakeGmail(): Promise<FakeGmailControl> {
  const messages: GmailCall[] = [];
  const draftAttempts: GmailCall[] = [];
  const overrides: number[] = [];

  const handler = async (req: IncomingMessage, res: ServerResponse) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    await new Promise<void>((resolve) => req.on('end', () => resolve()));
    const body = Buffer.concat(chunks).toString('utf8');

    const url = req.url ?? '';
    const method = req.method ?? '';

    // A draft request is always a product regression. Record it for a precise
    // assertion and return a hard failure so the UI cannot accidentally treat
    // it as a successful send.
    if (method === 'POST' && (url.endsWith('/drafts') || url.includes('/gmail/v1/users/me/drafts'))) {
      draftAttempts.push({ body, headers: req.headers });
      res.statusCode = 405;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: { code: 405, message: 'draft creation is disabled' } }));
      return;
    }

    if (method === 'POST' && (url.endsWith('/messages/send') || url.includes('/gmail/v1/users/me/messages/send'))) {
      messages.push({ body, headers: req.headers });
      const override = overrides.shift();
      if (override !== undefined) {
        res.statusCode = override;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({
          error: { code: override, message: `fake-gmail forced ${override}` },
        }));
        return;
      }
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ id: 'msg-fake-1' }));
      return;
    }

    res.statusCode = 404;
    res.end(`fake-gmail: no route for ${method} ${url}`);
  };

  const server: Server = createServer(handler);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const addr = server.address() as AddressInfo;
  const port = addr.port;

  return {
    url: `http://127.0.0.1:${port}`,
    port,
    messages,
    draftAttempts,
    failNextWith(status: number) {
      overrides.push(status);
    },
    reset() {
      messages.length = 0;
      draftAttempts.length = 0;
      overrides.length = 0;
    },
    async close() {
      await new Promise<void>((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      });
    },
  };
}
