<script lang="ts">
  import { onMount } from 'svelte';
  import {
    GetProductStatus,
    RepairMAPIRegistration,
    TestGmailConnection,
  } from '../../../wailsjs/go/main/App';
  import type { main } from '../../../wailsjs/go/models';
  import { activateModal, handleModalKeydown } from '../modal';

  let { onOpenLogs, onClose }: { onOpenLogs: () => void; onClose: () => void } = $props();

  let panel: HTMLDivElement;
  let status = $state<main.ProductStatus | null>(null);
  let loading = $state(true);
  let loadError = $state('');
  let testing = $state(false);
  let connectionResult = $state('');
  let repairing = $state(false);
  let repairResult = $state('');

  onMount(() => {
    const restoreFocus = activateModal(panel);
    void refreshStatus();
    return restoreFocus;
  });

  async function refreshStatus() {
    loading = true;
    loadError = '';
    try {
      status = await GetProductStatus();
    } catch {
      loadError = 'SendArc could not read the current Windows status.';
    } finally {
      loading = false;
    }
  }

  async function testConnection() {
    testing = true;
    connectionResult = '';
    try {
      const result = await TestGmailConnection();
      connectionResult = result.message;
      await refreshStatus();
    } catch {
      connectionResult = 'Google could not verify this connection. Reconnect the account, then retry.';
    } finally {
      testing = false;
    }
  }

  async function repairRegistration() {
    repairing = true;
    repairResult = '';
    try {
      await RepairMAPIRegistration();
      repairResult = 'Windows opened a permission request. Approve it, then refresh this status.';
    } catch {
      repairResult = 'Repair could not start. Run the current SendArc installer again.';
    } finally {
      repairing = false;
    }
  }

  function formatTimestamp(value?: string) {
    if (!value) return 'Not yet';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return 'Not yet';
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(parsed);
  }
</script>

<div class="backdrop">
  <div
    class="panel"
    role="dialog"
    aria-modal="true"
    aria-labelledby="status-title"
    tabindex="-1"
    bind:this={panel}
    onkeydown={(event) => handleModalKeydown(event, panel, onClose)}
  >
    <header>
      <div>
        <p class="eyebrow">System check</p>
        <h2 id="status-title">SendArc status</h2>
      </div>
      <button type="button" class="close" aria-label="Close status" onclick={onClose}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
          <path d="M6 6l12 12M18 6 6 18" />
        </svg>
      </button>
    </header>

    <section class="body">
      {#if loading && !status}
        <p class="loading" role="status">Checking Gmail and Windows integration…</p>
      {:else if loadError && !status}
        <div class="notice notice--error" role="alert">
          <p>{loadError}</p>
          <button type="button" onclick={refreshStatus}>Retry status check</button>
        </div>
      {:else if status}
        <section class="status-card" aria-labelledby="gmail-status-title">
          <div class="card-heading">
            <div>
              <p class="card-label">Gmail</p>
              <h3 id="gmail-status-title">Google connection</h3>
            </div>
            <span class:healthy={status.gmail.authenticated} class="badge">
              {status.gmail.authenticated ? 'Connected' : 'Not connected'}
            </span>
          </div>
          <p class="detail">
            {status.gmail.authenticated
              ? (status.gmail.email || status.gmail.name || 'One Google account connected')
              : 'Connect one Gmail or Google Workspace account to send.'}
          </p>
          <p class="permission">Permission: send email only. SendArc cannot read your inbox.</p>
          <button
            type="button"
            class="secondary"
            disabled={!status.gmail.authenticated || testing}
            onclick={testConnection}
          >
            {testing ? 'Testing connection…' : 'Test connection'}
          </button>
          {#if connectionResult}
            <p class="result" aria-live="polite">{connectionResult}</p>
          {/if}
        </section>

        <section class="status-card" aria-labelledby="mapi-status-title">
          <div class="card-heading">
            <div>
              <p class="card-label">Windows</p>
              <h3 id="mapi-status-title">Simple MAPI handler</h3>
            </div>
            <span class:healthy={status.mapi.healthy} class="badge">
              {status.mapi.healthy ? 'Ready' : 'Needs attention'}
            </span>
          </div>
          <p class="detail">{status.mapi.detail}</p>
          <ul class="checks" aria-label="MAPI component checks">
            <li><span>{status.mapi.registered ? 'Ready' : 'Missing'}</span> Registration</li>
            <li><span>{status.mapi.default ? 'Ready' : 'Not set'}</span> Default handler</li>
            <li><span>{status.mapi.dll64Present ? 'Ready' : 'Missing'}</span> 64-bit bridge</li>
            <li><span>{status.mapi.dll32Present ? 'Ready' : 'Missing'}</span> 32-bit bridge</li>
          </ul>
          {#if !status.mapi.healthy}
            {#if status.mapi.canRepair}
              <button type="button" class="secondary" disabled={repairing} onclick={repairRegistration}>
                {repairing ? 'Starting repair…' : 'Repair MAPI registration'}
              </button>
            {:else}
              <p class="repair-guidance">Run the current SendArc installer again to restore missing components.</p>
            {/if}
          {/if}
          {#if repairResult}
            <p class="result" aria-live="polite">{repairResult}</p>
          {/if}
        </section>

        <section class="activity" aria-labelledby="activity-title">
          <h3 id="activity-title">Recent activity</h3>
          <dl>
            <div>
              <dt>Last intercepted request</dt>
              <dd>{formatTimestamp(status.lastInterceptedAt)}</dd>
            </div>
            <div>
              <dt>Last successful send</dt>
              <dd>{formatTimestamp(status.lastSuccessfulSend)}</dd>
            </div>
          </dl>
        </section>
      {/if}
    </section>

    <footer>
      <button type="button" class="secondary" onclick={onOpenLogs}>Open diagnostic logs</button>
      <button type="button" class="secondary" disabled={loading} onclick={refreshStatus}>Refresh status</button>
      <button type="button" class="primary" onclick={onClose}>Done</button>
    </footer>
  </div>
</div>

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    z-index: 100;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(13, 22, 40, 0.56);
  }
  .panel {
    width: min(36rem, calc(100% - 2rem));
    max-height: calc(100vh - 2rem);
    overflow-y: auto;
    border: 1px solid var(--c-border);
    border-radius: 12px;
    background: var(--c-surface);
    box-shadow: 0 18px 48px rgba(24, 39, 68, 0.24);
  }
  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-md);
    padding: var(--space-md) var(--space-lg);
    border-bottom: 1px solid var(--c-border);
  }
  .eyebrow,
  .card-label {
    margin: 0 0 2px;
    color: var(--c-accent);
    font-size: 11px;
    font-weight: 750;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
  h2 { margin: 0; font-size: 22px; line-height: 1.2; }
  h3 { margin: 0; font-size: 15px; line-height: 1.35; }
  .close {
    display: grid;
    width: 44px;
    height: 44px;
    flex: 0 0 auto;
    place-items: center;
    border: 0;
    border-radius: 8px;
    background: transparent;
    color: var(--c-text);
    cursor: pointer;
  }
  .close:hover { background: var(--c-surface-alt); }
  .body { display: grid; gap: var(--space-md); padding: var(--space-lg); }
  .loading { margin: 0; color: var(--c-text-muted); }
  .status-card,
  .activity,
  .notice {
    padding: var(--space-md);
    border: 1px solid var(--c-border);
    border-radius: 8px;
    background: var(--c-surface-alt);
  }
  .card-heading {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--space-md);
  }
  .badge {
    flex: 0 0 auto;
    padding: 4px 8px;
    border: 1px solid var(--c-error-border);
    border-radius: 999px;
    background: var(--c-error-bg);
    color: var(--c-destructive);
    font-size: 12px;
    font-weight: 700;
  }
  .badge.healthy {
    border-color: var(--c-success-border);
    background: var(--c-success-flash);
    color: var(--c-success-text);
  }
  .detail { margin: var(--space-sm) 0 0; color: var(--c-text); line-height: 1.5; }
  .permission,
  .repair-guidance,
  .result {
    margin: var(--space-sm) 0 0;
    color: var(--c-text-muted);
    font-size: 12px;
    line-height: 1.5;
  }
  .result { color: var(--c-text); }
  .checks {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--space-sm);
    margin: var(--space-md) 0 0;
    padding: 0;
    list-style: none;
    color: var(--c-text-muted);
    font-size: 12px;
  }
  .checks span { color: var(--c-text); font-weight: 700; }
  .secondary,
  .primary,
  .notice button {
    min-height: 44px;
    margin-top: var(--space-md);
    padding: 8px 12px;
    border-radius: 7px;
    font-family: inherit;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
  }
  .secondary,
  .notice button {
    border: 1px solid var(--c-border-strong);
    background: var(--c-surface);
    color: var(--c-text);
  }
  .secondary:hover:not(:disabled),
  .notice button:hover { background: var(--c-accent-surface); }
  button:disabled { cursor: not-allowed; opacity: 0.48; }
  .notice p { margin: 0; }
  .notice--error { border-color: var(--c-error-border); background: var(--c-error-bg); }
  .activity dl { display: grid; gap: var(--space-sm); margin: var(--space-md) 0 0; }
  .activity dl div { display: flex; justify-content: space-between; gap: var(--space-md); }
  .activity dt { color: var(--c-text-muted); }
  .activity dd { margin: 0; color: var(--c-text); font-weight: 650; text-align: right; }
  footer {
    display: flex;
    justify-content: flex-end;
    gap: var(--space-sm);
    padding: var(--space-md) var(--space-lg);
    border-top: 1px solid var(--c-border);
    background: var(--c-surface-alt);
  }
  footer button { margin-top: 0; }
  footer .primary { border: 1px solid var(--c-accent); background: var(--c-accent); color: white; }
  footer .primary:hover { background: var(--c-accent-hover); }
  @media (max-width: 500px) {
    .checks { grid-template-columns: 1fr; }
    .activity dl div { flex-direction: column; gap: 2px; }
    .activity dd { text-align: left; }
    footer { flex-direction: column-reverse; }
    footer button { width: 100%; }
  }
</style>
