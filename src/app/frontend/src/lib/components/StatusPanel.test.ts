import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, waitFor } from '@testing-library/svelte';

const bindings = vi.hoisted(() => ({
  getProductStatus: vi.fn(),
  testGmailConnection: vi.fn(),
  repairMAPIRegistration: vi.fn(),
}));

vi.mock('../../../wailsjs/go/main/App', () => ({
  GetProductStatus: () => bindings.getProductStatus(),
  TestGmailConnection: () => bindings.testGmailConnection(),
  RepairMAPIRegistration: () => bindings.repairMAPIRegistration(),
}));

import StatusPanel from './StatusPanel.svelte';

const healthyStatus = {
  gmail: { authenticated: true, email: 'person@example.com', name: '' },
  mapi: {
    registered: true,
    default: true,
    dll64Present: true,
    dll32Present: true,
    healthy: true,
    canRepair: true,
    detail: 'SendArc is ready.',
  },
  lastInterceptedAt: '2026-08-29T01:02:03Z',
  lastSuccessfulSend: '2026-08-29T01:03:04Z',
};

beforeEach(() => {
  vi.clearAllMocks();
  bindings.getProductStatus.mockResolvedValue(healthyStatus);
});

describe('StatusPanel', () => {
  it('shows Gmail, MAPI, component, and recent activity facts', async () => {
    const { findByText, getByRole, getByText } = render(StatusPanel, {
      props: { onOpenLogs: vi.fn(), onClose: vi.fn() },
    });

    expect(await findByText('person@example.com')).toBeInTheDocument();
    expect(getByRole('heading', { name: /simple mapi handler/i })).toBeInTheDocument();
    expect(getByRole('list', { name: /mapi component checks/i })).toHaveTextContent('64-bit bridge');
    expect(getByText(/last intercepted request/i)).toBeInTheDocument();
    expect(getByText(/last successful send/i)).toBeInTheDocument();
  });

  it('performs a real connection check action and shows the result', async () => {
    bindings.testGmailConnection.mockResolvedValue({
      connected: true,
      checkedAt: '2026-08-29T01:04:05Z',
      message: 'Google accepted the current Gmail send connection.',
    });
    const { findByRole, findByText } = render(StatusPanel, {
      props: { onOpenLogs: vi.fn(), onClose: vi.fn() },
    });

    await fireEvent.click(await findByRole('button', { name: /^test connection$/i }));
    expect(bindings.testGmailConnection).toHaveBeenCalledOnce();
    expect(await findByText(/google accepted/i)).toBeInTheDocument();
  });

  it('offers a real registration repair only when installed files allow it', async () => {
    bindings.getProductStatus.mockResolvedValue({
      ...healthyStatus,
      mapi: { ...healthyStatus.mapi, healthy: false, detail: 'Registration is broken.' },
    });
    bindings.repairMAPIRegistration.mockResolvedValue(undefined);
    const { findByRole, findByText } = render(StatusPanel, {
      props: { onOpenLogs: vi.fn(), onClose: vi.fn() },
    });

    await fireEvent.click(await findByRole('button', { name: /repair mapi registration/i }));
    expect(bindings.repairMAPIRegistration).toHaveBeenCalledOnce();
    expect(await findByText(/permission request/i)).toBeInTheDocument();
  });

  it('disables connection testing while signed out and keeps log/close actions real', async () => {
    bindings.getProductStatus.mockResolvedValue({
      ...healthyStatus,
      gmail: { authenticated: false, email: '', name: '' },
    });
    const onOpenLogs = vi.fn();
    const onClose = vi.fn();
    const { findByRole } = render(StatusPanel, { props: { onOpenLogs, onClose } });

    expect(await findByRole('button', { name: /^test connection$/i })).toBeDisabled();
    await fireEvent.click(await findByRole('button', { name: /open diagnostic logs/i }));
    await fireEvent.click(await findByRole('button', { name: /^done$/i }));
    await waitFor(() => expect(onOpenLogs).toHaveBeenCalledOnce());
    expect(onClose).toHaveBeenCalledOnce();
  });
});
