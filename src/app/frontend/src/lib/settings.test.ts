import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../wailsjs/go/main/App', () => ({
  PauseWatching: vi.fn(),
  ResumeWatching: vi.fn(),
  GetPausedState: vi.fn(),
  GetUpdateState: vi.fn(),
  CheckForUpdatesNow: vi.fn(),
}));

vi.mock('../../wailsjs/runtime/runtime', () => ({ EventsOn: vi.fn() }));

import {
  PauseWatching,
  ResumeWatching,
  GetPausedState,
  GetUpdateState,
  CheckForUpdatesNow,
} from '../../wailsjs/go/main/App';
import { EventsOn } from '../../wailsjs/runtime/runtime';
import {
  pauseWatching,
  resumeWatching,
  getPausedState,
  subscribeSendResult,
  subscribePauseChanged,
  fetchUpdateState,
  checkForUpdatesNow,
  subscribeUpdateState,
  type UpdateState,
} from './settings';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const asMock = <T extends (...args: any[]) => any>(fn: T) =>
  fn as unknown as ReturnType<typeof vi.fn>;

describe('settings.ts', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('forwards watcher pause, resume, and paused-state calls', async () => {
    asMock(PauseWatching).mockResolvedValue(undefined);
    asMock(ResumeWatching).mockResolvedValue(undefined);
    asMock(GetPausedState).mockResolvedValue(true);
    await pauseWatching();
    await resumeWatching();
    expect(await getPausedState()).toBe(true);
    expect(PauseWatching).toHaveBeenCalledOnce();
    expect(ResumeWatching).toHaveBeenCalledOnce();
  });

  it('subscribes to send-result without logging message content', () => {
    const unsubscribe = vi.fn();
    asMock(EventsOn).mockReturnValue(unsubscribe);
    const callback = vi.fn();
    const off = subscribeSendResult(callback);

    expect(EventsOn).toHaveBeenCalledWith('send-result', expect.any(Function));
    const handler = asMock(EventsOn).mock.calls[0]?.[1] as ((result: unknown) => void) | undefined;
    const result = { emailId: 'abc', success: false, errorCategory: 'network' };
    handler?.(result);
    expect(callback).toHaveBeenCalledWith(result);
    off();
    expect(unsubscribe).toHaveBeenCalledOnce();
  });

  it('subscribes to pause-changed', () => {
    const unsubscribe = vi.fn();
    asMock(EventsOn).mockReturnValue(unsubscribe);
    const callback = vi.fn();
    const off = subscribePauseChanged(callback);
    const handler = asMock(EventsOn).mock.calls[0]?.[1] as ((paused: boolean) => void) | undefined;
    handler?.(true);
    expect(callback).toHaveBeenCalledWith(true);
    off();
    expect(unsubscribe).toHaveBeenCalledOnce();
  });

  describe('update-state wrappers', () => {
    const sampleState: UpdateState = {
      currentVersion: '0.1.0-beta',
      latestVersion: '0.1.1-beta',
      latestReleaseUrl: 'https://github.com/KapapiDev/sendarc/releases/tag/v0.1.1-beta',
      installerUrl: 'https://github.com/KapapiDev/sendarc/releases/download/v0.1.1-beta/SendArc-Setup-0.1.1-beta.exe',
      updateAvailable: true,
      lastCheckedAt: '2026-08-27T12:00:00Z',
      enabled: true,
    };

    it('fetches typed update state', async () => {
      asMock(GetUpdateState).mockResolvedValueOnce(sampleState);
      await expect(fetchUpdateState()).resolves.toEqual(sampleState);
    });

    it('checks for updates without exposing the injected context argument', async () => {
      asMock(CheckForUpdatesNow).mockResolvedValueOnce(undefined);
      await checkForUpdatesNow();
      expect(CheckForUpdatesNow).toHaveBeenCalledOnce();
    });

    it('keeps update-check failures non-blocking', async () => {
      asMock(CheckForUpdatesNow).mockRejectedValueOnce(new Error('offline'));
      await expect(checkForUpdatesNow()).resolves.toBeUndefined();
    });

    it('subscribes to update-state-changed', () => {
      const unsubscribe = vi.fn();
      asMock(EventsOn).mockReturnValue(unsubscribe);
      const callback = vi.fn();
      const off = subscribeUpdateState(callback);
      const handler = asMock(EventsOn).mock.calls[0]?.[1] as ((state: UpdateState) => void) | undefined;
      handler?.(sampleState);
      expect(callback).toHaveBeenCalledWith(sampleState);
      off();
      expect(unsubscribe).toHaveBeenCalledOnce();
    });
  });
});
