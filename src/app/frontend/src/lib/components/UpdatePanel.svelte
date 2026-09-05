<!--
  UpdatePanel — in-app update panel (Phase 11-03, D-02/D-07/D-08).

  Design:
  - Opened from UpdateBanner "View update" action in the root shell.
  - Exposes BOTH required links (D-02):
    1. GitHub release page (human-readable release notes)
    2. Stable installer URL (direct download of the SendArc installer)
    Both route through Wails' BrowserOpenURL — we must NOT use plain
    <a href> because WebView2 would open the URL inside the app window
    rather than the user's system browser.
  - Shows current version and last checked timestamp (D-07).
  - Includes exactly one "update checks are enabled by default" callout
    (D-08). This is the only place that callout appears in the UI so
    the frontend does not accidentally render it in multiple spots.
  - Manual "Check for updates now" action (D-06 tie-in) forwards to the
    lib/settings.ts wrapper that hides Wails' context auto-injection.
  - Modal presentation over a backdrop, matching PreAuthModal's pattern
    so the panel is dismissible with Close and does not require a
    dedicated route/settings page (phase D-05 keeps it lightweight).
  - D-04 silent-failure rule: the manual check wrapper swallows errors;
    we never render a red "check failed" state from the UI.
  - Copy is v3-focused and manual-install oriented (D-03): no "Quit and
    install", no staged installer helper.
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import { BrowserOpenURL } from '../../../wailsjs/runtime/runtime';
  import { activateModal, handleModalKeydown } from '../modal';
  import { checkForUpdatesNow, type UpdateState } from '../settings';

  interface Props {
    update: UpdateState;
    onClose: () => void;
  }
  // Note: the prop is named `update` (not `state`) because Svelte 5 runes
  // mode treats `state` as a reserved identifier in reactive contexts; a
  // prop destructured as `state` collides with the `$state` rune and the
  // compiler raises `store_invalid_shape` at runtime.
  let { update, onClose }: Props = $props();

  let checking = $state(false);
  let panel: HTMLDivElement;

  onMount(() => activateModal(panel));

  /** Render the last-checked timestamp in a user-friendly form. */
  const lastCheckedLabel = $derived(formatLastChecked(update.lastCheckedAt));

  function formatLastChecked(iso: string): string {
    if (!iso) return 'never';
    try {
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return iso;
      return d.toLocaleString();
    } catch {
      return iso;
    }
  }

  function openReleasePage() {
    if (update.latestReleaseUrl) BrowserOpenURL(update.latestReleaseUrl);
  }

  function openInstaller() {
    if (update.installerUrl) BrowserOpenURL(update.installerUrl);
  }

  async function handleCheckNow() {
    if (checking) return;
    checking = true;
    try {
      // D-04: wrapper already swallows failures; backend logs them.
      await checkForUpdatesNow();
    } finally {
      checking = false;
    }
  }
</script>

<div class="backdrop">
  <div
    class="panel"
    role="dialog"
    aria-modal="true"
    aria-labelledby="update-panel-title"
    tabindex="-1"
    bind:this={panel}
    onkeydown={(event) => handleModalKeydown(event, panel, onClose)}
  >
    <header>
      <h2 id="update-panel-title">
        {#if update.updateAvailable}
          Update available
        {:else}
          SendArc is up to date
        {/if}
      </h2>
      <button type="button" class="close" aria-label="Close update panel" onclick={onClose}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
          <path d="M6 6l12 12M18 6 6 18" />
        </svg>
      </button>
    </header>

    <section class="body">
      {#if update.updateAvailable}
        <p class="lede">
          A newer release is available:
          <strong>SendArc {update.latestVersion}</strong>.
        </p>
        <p>
          Download and run the installer manually to update. SendArc never
          installs updates in the background.
        </p>
        <div class="actions">
          <button
            type="button"
            class="primary link"
            onclick={openInstaller}
          >
            Download SendArc installer
          </button>
          <button
            type="button"
            class="secondary link"
            onclick={openReleasePage}
          >
            Release notes
          </button>
        </div>
      {:else}
        <p class="lede">
          You're running the latest release.
        </p>
      {/if}

      <dl class="status">
        <dt>Current version</dt>
        <dd>{update.currentVersion || 'unknown'}</dd>
        <dt>Last checked</dt>
        <dd>{lastCheckedLabel}</dd>
      </dl>

      <p class="default-note">
        Background update checks are <strong>enabled by default</strong>.
        You can turn them off from the tray menu.
      </p>

      <div class="manual">
        <button
          type="button"
          class="check"
          onclick={handleCheckNow}
          disabled={checking}
        >
          {checking ? 'Checking…' : 'Check for updates now'}
        </button>
      </div>
    </section>
  </div>
</div>

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 90;
  }
  .panel {
    background: white;
    border-radius: 8px;
    max-width: 32rem;
    width: calc(100% - 2rem);
    max-height: calc(100vh - 2rem);
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
    overflow-y: auto;
  }
  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.75rem 1rem;
    border-bottom: 1px solid var(--c-border);
  }
  header h2 {
    margin: 0;
    font-size: 1.05rem;
  }
  .close {
    display: grid;
    place-items: center;
    width: 40px;
    height: 40px;
    background: transparent;
    border: 0;
    cursor: pointer;
    color: var(--c-text);
    padding: 0;
    border-radius: 6px;
  }
  .body {
    padding: 1rem;
  }
  .lede {
    margin-top: 0;
  }
  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin: 0.5rem 0 1rem;
  }
  .link {
    min-height: 40px;
    padding: 0.5rem 0.85rem;
    border-radius: 4px;
    border: 0;
    cursor: pointer;
    font-size: 0.9rem;
  }
  .primary {
    background: var(--c-accent);
    color: white;
  }
  .secondary {
    background: #eee;
    color: var(--c-text);
  }
  .status {
    display: grid;
    grid-template-columns: max-content 1fr;
    gap: 0.25rem 1rem;
    margin: 0.75rem 0 1rem;
    font-size: 0.9rem;
  }
  .status dt {
    font-weight: 600;
    color: #555;
  }
  .status dd {
    margin: 0;
  }
  .default-note {
    font-size: 0.85rem;
    color: #555;
    border-left: 3px solid var(--c-accent);
    padding: 0.25rem 0.75rem;
    background: #f7f9fc;
    border-radius: 2px;
  }
  .manual {
    display: flex;
    justify-content: flex-end;
    margin-top: 0.75rem;
  }
  .check {
    min-height: 40px;
    background: transparent;
    border: 1px solid var(--c-border);
    padding: 0.4rem 0.85rem;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.9rem;
  }
  .check:disabled {
    opacity: 0.6;
    cursor: default;
  }
  button:active:not(:disabled) { opacity: 0.8; }
</style>
