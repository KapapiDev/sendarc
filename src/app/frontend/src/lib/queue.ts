import { EventsOn } from '../../wailsjs/runtime/runtime';
import { GetQueue } from '../../wailsjs/go/main/App';

export interface MailAddress { address: string; name?: string }
export interface MailRecipients {
  to?: MailAddress[];
  cc?: MailAddress[];
  bcc?: MailAddress[];
}
export interface MailAttachment {
  filename: string;
  size: number;
}
export interface MailMessage {
  version: number;
  timestamp: string;
  bodyFormat: string;
  subject?: string;
  body?: string;
  from?: MailAddress;
  recipients?: MailRecipients;
  attachments?: MailAttachment[];
  originApp?: string;
}
export interface EmailWithId { id: string; message?: MailMessage }

export async function fetchQueue(): Promise<EmailWithId[]> {
  return (await GetQueue()) ?? [];
}

export function subscribeQueue(
  onChange: (q: EmailWithId[]) => void,
  onError?: (err: unknown) => void,
): () => void {
  return EventsOn('queue-update', () => {
    fetchQueue()
      .then(onChange)
      .catch((e: unknown) => {
        // Without this, a transient IPC/Wails error silently freezes the UI
        // at the last-known snapshot. Log at minimum so it shows up in devtools,
        // and surface to the caller if a handler was provided.
        console.error('[SendArc] queue fetch failed:', e);
        onError?.(e);
      });
  });
}
