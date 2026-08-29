import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';

const { browserOpenURL } = vi.hoisted(() => ({ browserOpenURL: vi.fn() }));

vi.mock('../../../wailsjs/runtime/runtime', () => ({
  BrowserOpenURL: (url: string) => browserOpenURL(url),
}));

import AboutPanel from './AboutPanel.svelte';

describe('AboutPanel', () => {
  it('shows the real version, privacy posture, attribution, and resource actions', () => {
    const { getByText, getByRole } = render(AboutPanel, {
      props: { version: '0.1.0-beta', onOpenLogs: vi.fn(), onClose: vi.fn() },
    });

    expect(getByText('Version 0.1.0-beta')).toBeInTheDocument();
    expect(getByText(/no inbox access/i)).toBeInTheDocument();
    expect(getByText(/derived from go-mapi/i)).toBeInTheDocument();
    expect(getByRole('button', { name: /source code/i })).toBeInTheDocument();
    expect(getByRole('button', { name: /licenses & notices/i })).toBeInTheDocument();
  });

  it('opens resources through the system browser binding', async () => {
    const { getByRole } = render(AboutPanel, {
      props: { version: '0.1.0-beta', onOpenLogs: vi.fn(), onClose: vi.fn() },
    });

    await fireEvent.click(getByRole('button', { name: /privacy policy/i }));
    expect(browserOpenURL).toHaveBeenCalledWith('https://sendarc.pages.dev/privacy/');
  });

  it('runs diagnostics and close actions', async () => {
    const onOpenLogs = vi.fn();
    const onClose = vi.fn();
    const { getByRole } = render(AboutPanel, {
      props: { version: '', onOpenLogs, onClose },
    });

    await fireEvent.click(getByRole('button', { name: /open diagnostic logs/i }));
    await fireEvent.click(getByRole('button', { name: /done/i }));
    expect(onOpenLogs).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalledOnce();
  });
});
