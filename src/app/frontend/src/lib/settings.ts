/**
 * Typed wrappers for SendArc session events and update state.
 *
 * Privacy: send-result payloads contain only a queue id and status metadata.
 * Never log the complete payload or add message content to these events.
 */

import { EventsOn } from '../../wailsjs/runtime/runtime';
import {
  PauseWatching,
  ResumeWatching,
  GetPausedState,
  GetUpdateState,
  CheckForUpdatesNow,
} from '../../wailsjs/go/main/App';
import type { main } from '../../wailsjs/go/models';

export type ErrorCategory = 'signed-out' | 'network' | 'gmail';

export interface SendResult {
  emailId: string;
  success: boolean;
  errorCategory?: ErrorCategory;
  reason?: string;
}

export type UpdateState = main.UpdateState;

export async function pauseWatching(): Promise<void> {
  await PauseWatching();
}

export async function resumeWatching(): Promise<void> {
  await ResumeWatching();
}

export async function getPausedState(): Promise<boolean> {
  return await GetPausedState();
}

export function subscribeSendResult(cb: (result: SendResult) => void): () => void {
  return EventsOn('send-result', (result: SendResult) => cb(result));
}

export function subscribePauseChanged(cb: (paused: boolean) => void): () => void {
  return EventsOn('pause-changed', (paused: boolean) => cb(paused));
}

export async function fetchUpdateState(): Promise<UpdateState> {
  return await GetUpdateState();
}

export async function checkForUpdatesNow(): Promise<void> {
  try {
    await (CheckForUpdatesNow as unknown as (...args: unknown[]) => Promise<void>)();
  } catch {
    // Update-check failures are logged by the backend and stay non-blocking.
  }
}

export function subscribeUpdateState(
  cb: (state: UpdateState) => void,
): () => void {
  return EventsOn('update-state-changed', (state: UpdateState) => cb(state));
}
