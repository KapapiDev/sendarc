// Tests for App.svelte — explicit local preview + Gmail send wiring.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock wailsjs bindings BEFORE importing App — vi.mock is hoisted.
vi.mock('../wailsjs/go/main/App', () => ({
  GetAuthStatus: vi.fn().mockResolvedValue({ authenticated: false }),
  GetQueue: vi.fn().mockResolvedValue([]),
  SignIn: vi.fn(),
  SignOut: vi.fn(),
  SendMessageForID: vi.fn().mockResolvedValue(undefined),
  DismissEmail: vi.fn().mockResolvedValue(undefined),
  OpenDiagnosticLogs: vi.fn().mockResolvedValue(undefined),
  GetProductStatus: vi.fn().mockResolvedValue({
    gmail: { authenticated: false },
    mapi: {
      registered: false,
      default: false,
      dll64Present: false,
      dll32Present: false,
      healthy: false,
      canRepair: false,
      detail: 'Run the installer again.',
    },
    lastInterceptedAt: '',
    lastSuccessfulSend: '',
  }),
  TestGmailConnection: vi.fn(),
  RepairMAPIRegistration: vi.fn(),
  GetUpdateState: vi.fn().mockResolvedValue({
    currentVersion: '3.0.0',
    latestVersion: '',
    latestReleaseUrl: '',
    installerUrl: 'https://github.com/kapapi-dev/sendarc/releases/latest/download/SendArc-Setup.exe',
    updateAvailable: false,
    lastCheckedAt: '',
    enabled: true,
  }),
  CheckForUpdatesNow: vi.fn().mockResolvedValue(undefined),
}));

// Track calls to BrowserOpenURL so tests can assert that update links route
// through Wails' system-browser helper instead of anchor hrefs (WebView2
// would try to navigate inside the app window otherwise).
const browserOpenURL = vi.fn();

// Track EventsOn registrations so tests can fire events manually.
const eventHandlers: Record<string, ((...args: unknown[]) => void)[]> = {};
vi.mock('../wailsjs/runtime/runtime', () => ({
  EventsOn: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
    if (!eventHandlers[event]) eventHandlers[event] = [];
    eventHandlers[event].push(handler);
    return () => {
      eventHandlers[event] = eventHandlers[event].filter((h) => h !== handler);
    };
  }),
  // Update links open via Wails' BrowserOpenURL — stub it so tests can assert
  // the panel actions routed through it (instead of a plain <a href>).
  BrowserOpenURL: (url: string) => browserOpenURL(url),
}));

// Mock settings module
vi.mock('./lib/settings', () => ({
  subscribeSendResult: vi.fn((cb: (r: unknown) => void) => {
    if (!eventHandlers['send-result']) eventHandlers['send-result'] = [];
    eventHandlers['send-result'].push(cb as (...args: unknown[]) => void);
    return () => {};
  }),
  // Phase 11-03 — notify-only update wrappers.
  fetchUpdateState: vi.fn().mockResolvedValue({
    currentVersion: '3.0.0',
    latestVersion: '',
    latestReleaseUrl: '',
    installerUrl: 'https://github.com/kapapi-dev/sendarc/releases/latest/download/SendArc-Setup.exe',
    updateAvailable: false,
    lastCheckedAt: '',
    enabled: true,
  }),
  checkForUpdatesNow: vi.fn().mockResolvedValue(undefined),
  subscribeUpdateState: vi.fn((cb: (s: unknown) => void) => {
    if (!eventHandlers['update-state-changed']) eventHandlers['update-state-changed'] = [];
    eventHandlers['update-state-changed'].push(cb as (...args: unknown[]) => void);
    return () => {};
  }),
}));

// Mock queue module
vi.mock('./lib/queue', () => ({
  fetchQueue: vi.fn().mockResolvedValue([]),
  subscribeQueue: vi.fn(() => () => {}),
}));

// Mock auth module
vi.mock('./lib/auth', () => ({
  fetchAuthStatus: vi.fn().mockResolvedValue({ authenticated: false }),
  subscribeAuth: vi.fn(() => () => {}),
  hasSeenPreAuthExplainer: vi.fn().mockReturnValue(false),
  markPreAuthExplainerSeen: vi.fn(),
  signIn: vi.fn(),
  signOut: vi.fn(),
}));

import { render, fireEvent } from '@testing-library/svelte';
import App from './App.svelte';
import { fetchQueue, subscribeQueue } from './lib/queue';
import { fetchAuthStatus } from './lib/auth';
import { SendMessageForID } from '../wailsjs/go/main/App';

beforeEach(() => {
  // Reset all event handler maps between tests to prevent cross-test bleed.
  Object.keys(eventHandlers).forEach((k) => { eventHandlers[k] = []; });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('App.svelte — smoke', () => {
  it('mounts without throwing and renders the sign-in screen when unauthenticated', async () => {
    const { findByRole } = render(App);
    expect(await findByRole('button', { name: /sign in with google/i })).toBeInTheDocument();
  });

  it('opens and dismisses the About panel from the signed-out screen', async () => {
    const { findByRole, queryByRole } = render(App);
    await fireEvent.click(await findByRole('button', { name: /about, privacy & licenses/i }));
    expect(await findByRole('dialog', { name: /sendarc/i })).toBeInTheDocument();

    await fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });
    expect(queryByRole('dialog', { name: /sendarc/i })).toBeNull();
  });

  it('opens the real Status panel from the signed-out screen', async () => {
    const { findByRole, findByText } = render(App);
    await fireEvent.click(await findByRole('button', { name: /^status$/i }));
    expect(await findByRole('dialog', { name: /sendarc status/i })).toBeInTheDocument();
    expect(await findByText(/simple mapi handler/i)).toBeInTheDocument();
  });
});

describe('App.svelte — explicit send wiring', () => {
  it('registers subscribeSendResult on mount', async () => {
    const { subscribeSendResult } = await import('./lib/settings');
    render(App);
    await new Promise((r) => setTimeout(r, 0));
    expect(subscribeSendResult).toHaveBeenCalled();
  });

  it('registers subscribeQueue on mount', async () => {
    render(App);
    await new Promise((r) => setTimeout(r, 0));
    expect(subscribeQueue).toHaveBeenCalled();
  });

  it('renders queue rows when authenticated and queue is non-empty', async () => {
    vi.mocked(fetchAuthStatus).mockResolvedValueOnce({ authenticated: true, email: 'a@b.com' });
    vi.mocked(fetchQueue).mockResolvedValueOnce([
      {
        id: 'email-1',
        message: {
          version: 1,
          timestamp: '2026-04-19T12:00:00Z',
          bodyFormat: 'plain',
          subject: 'Test Subject',
        } as unknown as import('./lib/queue').EmailWithId['message'],
      },
    ]);
    // subscribeQueue must call onChange with the queue for it to render
    vi.mocked(subscribeQueue).mockImplementationOnce((onChange) => {
      // initial call handled by fetchQueue; just register
      return () => {};
    });

    const { findByText } = render(App);
    expect(await findByText('Test Subject')).toBeInTheDocument();
  });

  it('opens Preview without a Gmail call, then sends only from the separate Send button', async () => {
    vi.mocked(fetchAuthStatus).mockResolvedValueOnce({ authenticated: true, email: 'a@b.com' });
    vi.mocked(fetchQueue).mockResolvedValueOnce([
      {
        id: 'send-1',
        message: {
          version: 1,
          timestamp: '2026-04-19T12:00:00Z',
          bodyFormat: 'plain',
          subject: 'Review first',
          body: 'This remains local until Send is clicked.',
          recipients: { to: [{ name: 'Alice', address: 'alice@example.com' }] },
          attachments: [],
        } as unknown as import('./lib/queue').EmailWithId['message'],
      },
    ]);

    const { findByRole, findByText } = render(App);
    await findByText('Review first');
    expect(SendMessageForID).not.toHaveBeenCalled();

    await fireEvent.click(await findByRole('button', { name: 'Preview' }));
    expect(await findByRole('region', { name: /email preview/i })).toBeInTheDocument();
    expect(SendMessageForID).not.toHaveBeenCalled();

    await fireEvent.click(await findByRole('button', { name: /send with gmail/i }));
    expect(SendMessageForID).toHaveBeenCalledWith('send-1');
  });

  it('renders an announced error when send-result reports failure', async () => {
    vi.mocked(fetchAuthStatus).mockResolvedValueOnce({ authenticated: true, email: 'a@b.com' });
    vi.mocked(fetchQueue).mockResolvedValueOnce([
      {
        id: 'err-1',
        message: {
          version: 1,
          timestamp: '2026-04-19T12:00:00Z',
          bodyFormat: 'plain',
          subject: 'Error email',
        } as unknown as import('./lib/queue').EmailWithId['message'],
      },
    ]);

    const { findByText, findByRole } = render(App);
    await findByText('Error email');

    const handlers = eventHandlers['send-result'] ?? [];
    handlers.forEach((handler) => handler({
      emailId: 'err-1',
      success: false,
      errorCategory: 'network',
      reason: 'connection reset',
    }));

    const alert = await findByRole('alert');
    expect(alert).toHaveTextContent('Send failed');
    expect(alert).toHaveTextContent('connection reset');
  });

  it('does not expose an automatic-send mode', async () => {
    vi.mocked(fetchAuthStatus).mockResolvedValueOnce({
      authenticated: true,
      email: 'a@b.com',
      name: 'Alice',
    });

    const { findByText, queryByText, queryByRole } = render(App);
    await findByText('a@b.com');
    expect(queryByText(/auto-draft/i)).toBeNull();
    expect(queryByRole('group', { name: /mode/i })).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Phase 11-03 — update UX wiring in the root shell (D-01/D-02/D-07/D-08).
// ---------------------------------------------------------------------------

describe('App.svelte — update UX (Phase 11-03)', () => {
  const availableState = {
    currentVersion: '3.0.0',
    latestVersion: '3.0.1',
    latestReleaseUrl: 'https://github.com/kapapi-dev/sendarc/releases/tag/v3.0.1',
    installerUrl:
      'https://github.com/kapapi-dev/sendarc/releases/latest/download/SendArc-Setup.exe',
    updateAvailable: true,
    lastCheckedAt: '2026-04-21T12:00:00Z',
    enabled: true,
  };

  const noUpdateState = {
    currentVersion: '3.0.0',
    latestVersion: '3.0.0',
    latestReleaseUrl: 'https://github.com/kapapi-dev/sendarc/releases/tag/v3.0.0',
    installerUrl:
      'https://github.com/kapapi-dev/sendarc/releases/latest/download/SendArc-Setup.exe',
    updateAvailable: false,
    lastCheckedAt: '2026-04-21T12:00:00Z',
    enabled: true,
  };

  it('renders the persistent update banner when initial state reports updateAvailable', async () => {
    const { fetchUpdateState } = await import('./lib/settings');
    vi.mocked(fetchUpdateState).mockResolvedValueOnce(availableState);
    const { findByRole } = render(App);
    const banner = await findByRole('region', { name: /update available/i });
    expect(banner).toBeInTheDocument();
    expect(banner.textContent ?? '').toMatch(/3\.0\.1/);
  });

  it('does not render the banner when no update is available', async () => {
    const { fetchUpdateState } = await import('./lib/settings');
    vi.mocked(fetchUpdateState).mockResolvedValueOnce(noUpdateState);
    const { queryByRole } = render(App);
    await new Promise((r) => setTimeout(r, 0));
    expect(queryByRole('region', { name: /update available/i })).toBeNull();
  });

  it('re-renders when update-state-changed event fires (no page reload)', async () => {
    const { fetchUpdateState } = await import('./lib/settings');
    vi.mocked(fetchUpdateState).mockResolvedValueOnce(noUpdateState);
    const { findByRole, queryByRole } = render(App);
    // Initially no banner.
    await new Promise((r) => setTimeout(r, 0));
    expect(queryByRole('region', { name: /update available/i })).toBeNull();

    // Backend emits a new state with updateAvailable=true.
    const handlers = eventHandlers['update-state-changed'] ?? [];
    handlers.forEach((h) => h(availableState));

    const banner = await findByRole('region', { name: /update available/i });
    expect(banner).toBeInTheDocument();
  });

  it('opens the update panel exposing both the release page and the stable installer URL', async () => {
    const { fetchUpdateState } = await import('./lib/settings');
    vi.mocked(fetchUpdateState).mockResolvedValueOnce(availableState);
    const { findByRole, findByText } = render(App);
    const openPanelBtn = await findByRole('button', { name: /view update|see details|open/i });
    await fireEvent.click(openPanelBtn);

    // The panel exposes both URLs (D-02).
    const releaseLink = await findByText(/release notes|release page/i);
    const installerLink = await findByText(/download sendarc installer/i);
    expect(releaseLink).toBeInTheDocument();
    expect(installerLink).toBeInTheDocument();
  });

  it('clicking release/installer links routes through BrowserOpenURL (D-02)', async () => {
    const { fetchUpdateState } = await import('./lib/settings');
    vi.mocked(fetchUpdateState).mockResolvedValueOnce(availableState);
    const { findByRole, findByText } = render(App);
    const openPanelBtn = await findByRole('button', { name: /view update|see details|open/i });
    await fireEvent.click(openPanelBtn);

    const releaseLink = await findByText(/release notes|release page/i);
    const installerLink = await findByText(/download sendarc installer/i);
    await fireEvent.click(releaseLink);
    await fireEvent.click(installerLink);

    const urls = browserOpenURL.mock.calls.map((c) => c[0] as string);
    expect(urls).toEqual(
      expect.arrayContaining([
        availableState.latestReleaseUrl,
        availableState.installerUrl,
      ]),
    );
  });

  it('panel shows current version and last checked timestamp (D-07)', async () => {
    const { fetchUpdateState } = await import('./lib/settings');
    vi.mocked(fetchUpdateState).mockResolvedValueOnce(availableState);
    const { findByRole, findByText } = render(App);
    const openPanelBtn = await findByRole('button', { name: /view update|see details|open/i });
    await fireEvent.click(openPanelBtn);

    expect(await findByText(/3\.0\.0/)).toBeInTheDocument(); // current version
    expect(await findByText(/last checked/i)).toBeInTheDocument();
  });

  it('calls out that background update checks are enabled by default exactly once (D-08)', async () => {
    const { fetchUpdateState } = await import('./lib/settings');
    vi.mocked(fetchUpdateState).mockResolvedValueOnce(availableState);
    const { findByRole, findAllByText } = render(App);
    const openPanelBtn = await findByRole('button', { name: /view update|see details|open/i });
    await fireEvent.click(openPanelBtn);

    const callouts = await findAllByText(/enabled by default/i);
    expect(callouts).toHaveLength(1);
  });

  it('does NOT show a user-visible failure banner for transient update-check errors (D-04)', async () => {
    const { fetchUpdateState } = await import('./lib/settings');
    // Hydration rejects — App.svelte already catches and degrades silently.
    vi.mocked(fetchUpdateState).mockRejectedValueOnce(new Error('github 503'));

    const { queryByRole } = render(App);
    await new Promise((r) => setTimeout(r, 0));

    // No update banner (no data), AND crucially no "update check failed" alert.
    expect(queryByRole('region', { name: /update available/i })).toBeNull();
    expect(queryByRole('alert', { name: /update check failed/i })).toBeNull();
  });

  it('manual "Check for updates now" action forwards to the wrapper', async () => {
    const { fetchUpdateState, checkForUpdatesNow } = await import('./lib/settings');
    vi.mocked(fetchUpdateState).mockResolvedValueOnce(availableState);
    const { findByRole } = render(App);
    const openPanelBtn = await findByRole('button', { name: /view update|see details|open/i });
    await fireEvent.click(openPanelBtn);
    const checkBtn = await findByRole('button', { name: /check.*for updates/i });
    await fireEvent.click(checkBtn);
    expect(checkForUpdatesNow).toHaveBeenCalled();
  });

  it('banner remains visible across a re-fetch while updateAvailable stays true (persistent, D-01)', async () => {
    const { fetchUpdateState } = await import('./lib/settings');
    vi.mocked(fetchUpdateState).mockResolvedValueOnce(availableState);
    const { findByRole } = render(App);
    await findByRole('region', { name: /update available/i });

    // A scheduled background check fires with the same availableState — banner must stay.
    const handlers = eventHandlers['update-state-changed'] ?? [];
    handlers.forEach((h) => h(availableState));

    const banner = await findByRole('region', { name: /update available/i });
    expect(banner).toBeInTheDocument();
  });
});
