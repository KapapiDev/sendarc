<script lang="ts">
  import type { EmailWithId, MailAddress } from '../queue';
  import type { ErrorCategory } from '../settings';

  let {
    item,
    status = 'idle',
    authenticated = true,
    errorCategory,
    errorReason,
    onSend,
    onDismiss,
  }: {
    item: EmailWithId;
    status?: 'idle' | 'in-flight' | 'sent-flash' | 'error';
    authenticated?: boolean;
    errorCategory?: ErrorCategory;
    errorReason?: string;
    onSend: (id: string) => void | Promise<void>;
    onDismiss: (id: string) => void | Promise<void>;
  } = $props();

  let previewOpen = $state(false);

  const msg = $derived(item.message);
  const sender = $derived(
    msg?.from?.name || msg?.from?.address || msg?.originApp || 'Windows app',
  );
  const subject = $derived(msg?.subject || '(no subject)');
  const body = $derived(msg?.body || '(no message body)');
  const attachments = $derived(msg?.attachments ?? []);
  const attachCount = $derived(attachments.length);
  const tsDisplay = $derived(formatTs(msg?.timestamp));
  const previewId = $derived(`preview-${item.id}`);
  const sendDisabled = $derived(status === 'in-flight' || !authenticated);
  const controlsDisabled = $derived(status === 'in-flight');
  const sendTitle = $derived(!authenticated ? 'Sign in with Google before sending' : '');
  const errorLabel = $derived(
    errorCategory === 'signed-out'
      ? 'Your Google session expired. Sign in again, then retry.'
      : errorCategory === 'network'
        ? 'Send failed because the network is unavailable. Check your connection and retry.'
        : 'Gmail could not send this message. Review it and retry.',
  );

  function formatRecipient(recipient: MailAddress): string {
    const name = recipient.name?.trim();
    const address = recipient.address?.trim();
    if (name && address) return `${name} <${address}>`;
    return address || name || '(missing address)';
  }

  function formatRecipients(recipients?: MailAddress[]): string {
    if (!recipients?.length) return '—';
    return recipients.map(formatRecipient).join(', ');
  }

  function formatSize(bytes?: number): string {
    if (!Number.isFinite(bytes) || (bytes ?? 0) <= 0) return '0 B';
    const value = bytes as number;
    const units = ['B', 'KB', 'MB', 'GB'];
    const unitIndex = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
    const scaled = value / (1024 ** unitIndex);
    const digits = unitIndex === 0 || scaled >= 10 ? 0 : 1;
    return `${scaled.toFixed(digits)} ${units[unitIndex]}`;
  }

  function formatTs(iso?: string): string {
    if (!iso) return '';
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return '';
    const sameDay = date.toDateString() === new Date().toDateString();
    return sameDay
      ? date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
      : date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  }
</script>

<li
  class="queue-row"
  class:queue-row--flash={status === 'sent-flash'}
  class:queue-row--error={status === 'error'}
  class:queue-row--inflight={status === 'in-flight'}
  data-testid="queue-row"
  data-email-id={item.id}
  aria-busy={status === 'in-flight'}
>
  <div class="summary">
    <div class="message-summary">
      <div class="summary-topline">
        <span class="sender">{sender}</span>
        {#if tsDisplay}<time datetime={msg?.timestamp}>{tsDisplay}</time>{/if}
      </div>
      <p class="subject">{subject}</p>
      {#if attachCount > 0}
        <p class="attachment-count">{attachCount} {attachCount === 1 ? 'attachment' : 'attachments'}</p>
      {/if}
    </div>

    {#if !previewOpen}
      <div class="actions actions--summary">
        <button
          type="button"
          class="btn btn--primary"
          disabled={controlsDisabled}
          aria-expanded="false"
          aria-controls={previewId}
          data-testid="queue-row-preview"
          onclick={() => { previewOpen = true; }}
        >Preview</button>
        <button
          type="button"
          class="btn btn--ghost"
          disabled={controlsDisabled}
          data-testid="queue-row-dismiss"
          onclick={() => onDismiss(item.id)}
        >Dismiss</button>
      </div>
    {/if}
  </div>

  {#if status === 'in-flight'}
    <p class="send-status" role="status" aria-live="polite" aria-atomic="true">
      Sending with Gmail…
    </p>
  {:else if status === 'sent-flash'}
    <p class="send-status send-status--success" role="status" aria-live="polite" aria-atomic="true">
      Sent with Gmail
    </p>
  {/if}

  {#if status === 'error' && errorCategory}
    <div class="send-error" role="alert" data-testid="send-error">
      <strong>Send failed.</strong> {errorLabel}
      {#if errorReason}<span class="error-detail">Details: {errorReason}</span>{/if}
    </div>
  {/if}

  {#if previewOpen}
    <section class="preview" id={previewId} aria-label={`Email preview: ${subject}`}>
      <div class="preview-heading">
        <div>
          <p class="eyebrow">Local preview</p>
          <h2>{subject}</h2>
        </div>
        <p class="privacy-note">Shown as plain text. Nothing is sent until you click Send.</p>
      </div>

      <dl class="recipient-list">
        <div><dt>To</dt><dd>{formatRecipients(msg?.recipients?.to)}</dd></div>
        <div><dt>Cc</dt><dd>{formatRecipients(msg?.recipients?.cc)}</dd></div>
        <div><dt>Bcc</dt><dd>{formatRecipients(msg?.recipients?.bcc)}</dd></div>
        <div><dt>Subject</dt><dd>{subject}</dd></div>
      </dl>

      <div class="body-section">
        <h3>Message</h3>
        <pre data-testid="message-body">{body}</pre>
      </div>

      <div class="attachment-section">
        <h3>Attachments</h3>
        {#if attachments.length === 0}
          <p class="empty-value">No attachments</p>
        {:else}
          <ul class="attachment-list">
            {#each attachments as attachment, index (`${attachment.filename}-${index}`)}
              <li>
                <span>{attachment.filename || 'Unnamed attachment'}</span>
                <span>{formatSize(attachment.size)}</span>
              </li>
            {/each}
          </ul>
        {/if}
      </div>

      <div class="actions actions--preview">
        <button
          type="button"
          class="btn btn--primary"
          disabled={sendDisabled}
          title={sendTitle}
          data-testid="queue-row-send"
          onclick={() => onSend(item.id)}
        >{status === 'in-flight' ? 'Sending…' : 'Send with Gmail'}</button>
        <button
          type="button"
          class="btn btn--secondary"
          disabled={controlsDisabled}
          aria-expanded="true"
          aria-controls={previewId}
          data-testid="queue-row-cancel"
          onclick={() => { previewOpen = false; }}
        >Cancel</button>
        <button
          type="button"
          class="btn btn--ghost"
          disabled={controlsDisabled}
          data-testid="queue-row-dismiss"
          onclick={() => onDismiss(item.id)}
        >Dismiss</button>
      </div>
    </section>
  {/if}
</li>

<style>
  .queue-row {
    list-style: none;
    border: 1px solid var(--c-border);
    border-radius: 8px;
    background: var(--c-surface);
    overflow: hidden;
    transition: border-color 150ms ease, background-color 150ms ease, opacity 150ms ease;
  }

  .queue-row:hover:not(.queue-row--flash):not(.queue-row--error) {
    border-color: var(--c-border-strong);
  }

  .queue-row--inflight { opacity: 0.82; }
  .queue-row--error { border-color: var(--c-error-border); }
  .queue-row--flash { background: var(--c-success-flash); border-color: var(--c-success-border); }

  .summary {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: var(--space-md);
    align-items: center;
    padding: var(--space-md);
  }

  .message-summary { min-width: 0; text-align: left; }
  .summary-topline { display: flex; align-items: baseline; gap: var(--space-sm); }
  .sender { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 650; }
  time { margin-left: auto; color: var(--c-text-muted); font-size: 12px; white-space: nowrap; }
  .subject { margin: 2px 0 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--c-text-muted); }
  .attachment-count { margin: 4px 0 0; color: var(--c-text-muted); font-size: 12px; }

  .actions { display: flex; align-items: center; gap: var(--space-sm); flex-wrap: wrap; }
  .actions--summary { justify-content: flex-end; }
  .actions--preview { justify-content: flex-end; padding-top: var(--space-md); border-top: 1px solid var(--c-border); }

  .btn {
    min-height: 36px;
    padding: 6px var(--space-btn-x);
    border-radius: 6px;
    font: 600 14px/1.2 inherit;
    cursor: pointer;
    transition: background-color 120ms ease, border-color 120ms ease, color 120ms ease;
  }
  .btn:focus-visible { outline: 2px solid var(--c-accent); outline-offset: 2px; }
  .btn:disabled { opacity: 0.52; cursor: not-allowed; }
  .btn--primary { border: 1px solid var(--c-accent); background: var(--c-accent); color: white; }
  .btn--primary:hover:not(:disabled) { background: var(--c-accent-hover); border-color: var(--c-accent-hover); }
  .btn--secondary { border: 1px solid var(--c-border-strong); background: var(--c-surface); color: var(--c-text); }
  .btn--secondary:hover:not(:disabled) { background: var(--c-surface-alt); }
  .btn--ghost { border: 1px solid transparent; background: transparent; color: var(--c-destructive); }
  .btn--ghost:hover:not(:disabled) { background: var(--c-error-bg); }

  .send-status, .send-error { margin: 0 var(--space-md) var(--space-md); text-align: left; }
  .send-status { color: var(--c-text-muted); }
  .send-status--success { color: var(--c-success-text); font-weight: 650; }
  .send-error { padding: var(--space-sm) var(--space-md); border-radius: 6px; background: var(--c-error-bg); color: var(--c-destructive); }
  .error-detail { display: block; margin-top: 4px; overflow-wrap: anywhere; color: var(--c-text); font-size: 12px; }

  .preview { padding: var(--space-lg); border-top: 1px solid var(--c-border); background: var(--c-surface-alt); text-align: left; }
  .preview-heading { display: flex; justify-content: space-between; align-items: flex-start; gap: var(--space-lg); }
  .eyebrow { margin: 0 0 4px; color: var(--c-accent); font-size: 11px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; }
  .preview h2 { margin: 0; font-size: 18px; line-height: 1.35; overflow-wrap: anywhere; }
  .privacy-note { max-width: 30ch; margin: 0; color: var(--c-text-muted); font-size: 12px; line-height: 1.5; }

  .recipient-list { margin: var(--space-lg) 0; padding: var(--space-md); border: 1px solid var(--c-border); border-radius: 6px; background: var(--c-surface); }
  .recipient-list > div { display: grid; grid-template-columns: 72px minmax(0, 1fr); gap: var(--space-sm); padding: 5px 0; }
  .recipient-list dt { color: var(--c-text-muted); font-weight: 600; }
  .recipient-list dd { margin: 0; overflow-wrap: anywhere; }

  .body-section, .attachment-section { margin-top: var(--space-lg); }
  .preview h3 { margin: 0 0 var(--space-sm); font-size: 13px; font-weight: 700; }
  pre { max-height: 240px; margin: 0; padding: var(--space-md); overflow: auto; white-space: pre-wrap; overflow-wrap: anywhere; border: 1px solid var(--c-border); border-radius: 6px; background: var(--c-surface); color: var(--c-text); font: 14px/1.55 var(--font); }
  .empty-value { margin: 0; color: var(--c-text-muted); }
  .attachment-list { margin: 0; padding: 0; list-style: none; border: 1px solid var(--c-border); border-radius: 6px; background: var(--c-surface); }
  .attachment-list li { display: flex; justify-content: space-between; gap: var(--space-md); padding: var(--space-sm) var(--space-md); }
  .attachment-list li + li { border-top: 1px solid var(--c-border); }
  .attachment-list li span:first-child { min-width: 0; overflow-wrap: anywhere; }
  .attachment-list li span:last-child { flex: none; color: var(--c-text-muted); font-size: 12px; }

  @media (max-width: 620px) {
    .summary { grid-template-columns: 1fr; }
    .actions--summary { justify-content: flex-start; }
    .preview-heading { flex-direction: column; gap: var(--space-sm); }
    .privacy-note { max-width: none; }
    .recipient-list > div { grid-template-columns: 56px minmax(0, 1fr); }
    .actions--preview { justify-content: flex-start; }
  }

  @media (prefers-reduced-motion: reduce) {
    .queue-row, .btn { transition: none; }
  }
</style>
