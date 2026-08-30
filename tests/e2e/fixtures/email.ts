import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';

// Phase 11 plan 06 — TS mirror of internal/mapi.MailMessage so harness
// drops are guaranteed to satisfy ValidateMailMessage. Keep the field set
// minimal: only what protocol.go validates as required + what the UI renders.

export interface EmailFixtureRecipient {
  name?: string;
  address: string;
}

export interface EmailFixtureAttachment {
  filename: string;
  content: string | Buffer;
}

export interface EmailFixtureOptions {
  subject?: string;
  body?: string;
  bodyFormat?: 'plain' | 'html';
  to?: EmailFixtureRecipient[];
  cc?: EmailFixtureRecipient[];
  bcc?: EmailFixtureRecipient[];
  attachments?: EmailFixtureAttachment[];
  originApp?: string;
  timestamp?: string;
  filename?: string;
}

export interface DroppedEmail {
  filename: string;
  fullPath: string;
}

export class WatchDirHelper {
  constructor(public readonly dir: string) {}

  /** Drop a valid MailMessage JSON into the watch dir. Resolves once written. */
  async dropEmail(opts: EmailFixtureOptions = {}): Promise<DroppedEmail> {
    const filename = opts.filename ?? `email-${Date.now()}-${randomBytes(4).toString('hex')}.json`;
    if (!filename.endsWith('.json')) throw new Error('e2e fixture filename must end in .json');

    const stem = filename.slice(0, -'.json'.length);
    const attachments = [];
    if (opts.attachments?.length) {
      const attachmentDir = join(this.dir, stem);
      await mkdir(attachmentDir, { recursive: false });
      for (const attachment of opts.attachments) {
        if (!attachment.filename || /[\\/:\r\n]/.test(attachment.filename)) {
          throw new Error(`e2e fixture has unsafe attachment filename: ${attachment.filename}`);
        }
        const content = Buffer.isBuffer(attachment.content)
          ? attachment.content
          : Buffer.from(attachment.content, 'utf8');
        const path = join(attachmentDir, attachment.filename);
        await writeFile(path, content);
        attachments.push({ filename: attachment.filename, path, size: content.byteLength });
      }
    }

    const message = {
      version: 1,
      interceptorVersion: 'e2e',
      hostVersion: 'e2e',
      timestamp: opts.timestamp ?? new Date().toISOString(),
      subject: opts.subject ?? 'E2E test subject',
      body: opts.body ?? 'E2E test body',
      bodyFormat: opts.bodyFormat ?? 'plain',
      recipients: {
        to: opts.to ?? [{ name: 'Recipient', address: 'recipient@example.com' }],
        cc: opts.cc ?? [],
        bcc: opts.bcc ?? [],
      },
      attachments,
      originApp: opts.originApp ?? 'e2e-harness',
    };
    const fullPath = join(this.dir, filename);
    await writeFile(fullPath, JSON.stringify(message, null, 2), 'utf8');
    return { filename, fullPath };
  }
}
