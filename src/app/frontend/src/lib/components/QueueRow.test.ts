import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import QueueRow from './QueueRow.svelte';
import type { EmailWithId, MailMessage } from '../queue';

function mkItem(overrides: Partial<MailMessage> = {}, id = 'abc'): EmailWithId {
  return {
    id,
    message: {
      version: 1,
      timestamp: '2026-04-19T12:00:00Z',
      bodyFormat: 'plain',
      from: { name: 'Legacy CRM', address: 'sender@example.com' },
      recipients: {
        to: [{ name: 'Alice', address: 'alice@example.com' }],
        cc: [{ address: 'team@example.com' }],
        bcc: [{ name: 'Archive', address: 'archive@example.com' }],
      },
      subject: 'Quarterly report',
      body: 'Hello Alice,\n\nThe report is attached.',
      attachments: [{ filename: 'report.pdf', size: 1536 }],
      ...overrides,
    },
  };
}

function renderRow(overrides: Record<string, unknown> = {}) {
  const onSend = vi.fn();
  const onDismiss = vi.fn();
  const view = render(QueueRow, {
    props: { item: mkItem(), onSend, onDismiss, ...overrides },
  });
  return { ...view, onSend, onDismiss };
}

describe('QueueRow explicit preview flow', () => {
  it('shows only the summary before Preview and makes no send call', () => {
    const { getByText, getByRole, queryByRole, onSend } = renderRow();
    expect(getByText('Legacy CRM')).toBeInTheDocument();
    expect(getByText('Quarterly report')).toBeInTheDocument();
    expect(getByRole('button', { name: 'Preview' })).toHaveAttribute('aria-expanded', 'false');
    expect(queryByRole('region', { name: /email preview/i })).toBeNull();
    expect(queryByRole('button', { name: /send with gmail/i })).toBeNull();
    expect(onSend).not.toHaveBeenCalled();
  });

  it('opens a local plain-text preview with recipients, subject, body, and attachment metadata', async () => {
    const { getByRole, getByText, getByTestId, container } = renderRow();
    await fireEvent.click(getByRole('button', { name: 'Preview' }));

    expect(getByRole('region', { name: /email preview: quarterly report/i })).toBeInTheDocument();
    expect(getByText('Alice <alice@example.com>')).toBeInTheDocument();
    expect(getByText('team@example.com')).toBeInTheDocument();
    expect(getByText('Archive <archive@example.com>')).toBeInTheDocument();
    expect(getByTestId('message-body')).toHaveTextContent('The report is attached.');
    expect(getByText('report.pdf')).toBeInTheDocument();
    expect(getByText('1.5 KB')).toBeInTheDocument();
    expect(container.querySelector('img')).toBeNull();
  });

  it('renders markup-looking message content as text, never as HTML', async () => {
    const item = mkItem({ body: '<img src=x onerror=alert(1)>Hello<script>bad()</script>' });
    const { getByRole, getByTestId, container } = render(QueueRow, {
      props: { item, onSend: vi.fn(), onDismiss: vi.fn() },
    });
    await fireEvent.click(getByRole('button', { name: 'Preview' }));
    expect(getByTestId('message-body')).toHaveTextContent('<img src=x onerror=alert(1)>');
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('script')).toBeNull();
  });

  it('calls SendMessage only from the separate Send button after preview opens', async () => {
    const { getByRole, onSend } = renderRow({ item: mkItem({}, 'send-id') });
    await fireEvent.click(getByRole('button', { name: 'Preview' }));
    expect(onSend).not.toHaveBeenCalled();
    await fireEvent.click(getByRole('button', { name: /send with gmail/i }));
    expect(onSend).toHaveBeenCalledOnce();
    expect(onSend).toHaveBeenCalledWith('send-id');
  });

  it('Cancel closes the preview without sending', async () => {
    const { getByRole, queryByRole, onSend } = renderRow();
    await fireEvent.click(getByRole('button', { name: 'Preview' }));
    await fireEvent.click(getByRole('button', { name: 'Cancel' }));
    expect(queryByRole('region', { name: /email preview/i })).toBeNull();
    expect(onSend).not.toHaveBeenCalled();
  });

  it('keeps Dismiss available and forwards the queue id', async () => {
    const { getByRole, onDismiss } = renderRow({ item: mkItem({}, 'dismiss-id') });
    await fireEvent.click(getByRole('button', { name: 'Dismiss' }));
    expect(onDismiss).toHaveBeenCalledWith('dismiss-id');
  });

  it('announces in-flight state and disables every conflicting preview action', async () => {
    const { getByRole, getByText } = renderRow({ status: 'in-flight' });
    expect(getByRole('status')).toHaveTextContent('Sending with Gmail');
    expect(getByText('Quarterly report').closest('li')).toHaveAttribute('aria-busy', 'true');
    expect(getByRole('button', { name: 'Preview' })).toBeDisabled();
  });

  it('announces send errors with a useful reason', () => {
    const { getByRole } = renderRow({
      status: 'error',
      errorCategory: 'network',
      errorReason: 'connection reset',
    });
    const alert = getByRole('alert');
    expect(alert).toHaveTextContent('Send failed');
    expect(alert).toHaveTextContent('network is unavailable');
    expect(alert).toHaveTextContent('connection reset');
  });

  it('announces successful Gmail send state', () => {
    const { getByRole } = renderRow({ status: 'sent-flash' });
    expect(getByRole('status')).toHaveTextContent('Sent with Gmail');
  });

  it('allows local preview and Dismiss while signed out but disables Send', async () => {
    const { getByRole } = renderRow({ authenticated: false });
    expect(getByRole('button', { name: 'Preview' })).toBeEnabled();
    expect(getByRole('button', { name: 'Dismiss' })).toBeEnabled();
    await fireEvent.click(getByRole('button', { name: 'Preview' }));
    const send = getByRole('button', { name: /send with gmail/i });
    expect(send).toBeDisabled();
    expect(send).toHaveAttribute('title', 'Sign in with Google before sending');
  });

  it('leaves the non-interactive list item out of the tab order', () => {
    const { getByTestId } = renderRow();
    expect(getByTestId('queue-row')).not.toHaveAttribute('tabindex');
  });
});
