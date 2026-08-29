<script lang="ts">
  import { onMount } from 'svelte';
  import { BrowserOpenURL } from '../../../wailsjs/runtime/runtime';
  import { activateModal, handleModalKeydown } from '../modal';

  let { version, onOpenLogs, onClose }: {
    version: string;
    onOpenLogs: () => void;
    onClose: () => void;
  } = $props();

  let panel: HTMLDivElement;

  const links = [
    { label: 'Source code', url: 'https://github.com/maxtop9843-byte/sendarc' },
    { label: 'Privacy policy', url: 'https://sendarc.pages.dev/privacy/' },
    { label: 'Licenses & notices', url: 'https://sendarc.pages.dev/licenses/' },
    { label: 'Support', url: 'https://sendarc.pages.dev/support/' },
  ];

  onMount(() => activateModal(panel));
</script>

<div class="backdrop">
  <div
    class="panel"
    role="dialog"
    aria-modal="true"
    aria-labelledby="about-title"
    tabindex="-1"
    bind:this={panel}
    onkeydown={(event) => handleModalKeydown(event, panel, onClose)}
  >
    <header>
      <div>
        <p class="eyebrow">About</p>
        <h2 id="about-title">SendArc</h2>
      </div>
      <button type="button" class="close" aria-label="Close About" onclick={onClose}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
          <path d="M6 6l12 12M18 6 6 18" />
        </svg>
      </button>
    </header>

    <section class="body">
      <p class="version">Version {version || 'unknown'}</p>
      <p class="lede">
        A focused Windows bridge for reviewing legacy-app email locally and sending it
        through Gmail only after you click Send.
      </p>

      <div class="facts">
        <section>
          <h3>Privacy by design</h3>
          <p>No inbox access, email relay, hidden telemetry, or background sending.</p>
        </section>
        <section>
          <h3>Open source</h3>
          <p>
            Derived from go-mapi under LGPL-3.0-or-later. SendArc is independent and is
            not affiliated with the upstream author, Affixa, or Google.
          </p>
        </section>
      </div>

      <div class="links" aria-label="SendArc resources">
        {#each links as link}
          <button type="button" onclick={() => BrowserOpenURL(link.url)}>{link.label}</button>
        {/each}
      </div>
    </section>

    <footer>
      <button type="button" class="secondary" onclick={onOpenLogs}>Open diagnostic logs</button>
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
    width: min(32rem, calc(100% - 2rem));
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
  .eyebrow {
    margin: 0 0 2px;
    color: var(--c-accent);
    font-size: 11px;
    font-weight: 750;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
  h2 { margin: 0; font-size: 22px; line-height: 1.2; }
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
  .body { padding: var(--space-lg); }
  .version {
    display: inline-flex;
    margin: 0 0 var(--space-md);
    padding: 4px 9px;
    border: 1px solid var(--c-accent-border);
    border-radius: 999px;
    background: var(--c-accent-surface-strong);
    color: var(--c-accent-text);
    font-size: 12px;
    font-weight: 650;
  }
  .lede { margin: 0; color: var(--c-text); font-size: 15px; line-height: 1.55; }
  .facts {
    display: grid;
    gap: var(--space-sm);
    margin: var(--space-lg) 0;
  }
  .facts section {
    padding: var(--space-md);
    border: 1px solid var(--c-border);
    border-radius: 8px;
    background: var(--c-surface-alt);
  }
  h3 { margin: 0 0 4px; font-size: 14px; }
  .facts p { margin: 0; color: var(--c-text-muted); font-size: 13px; line-height: 1.5; }
  .links { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--space-sm); }
  .links button,
  footer button {
    min-height: 44px;
    border-radius: 7px;
    padding: 8px 12px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
  }
  .links button {
    border: 1px solid var(--c-border-strong);
    background: var(--c-surface);
    color: var(--c-accent);
    text-align: left;
  }
  .links button:hover { background: var(--c-accent-surface); }
  footer {
    display: flex;
    justify-content: flex-end;
    gap: var(--space-sm);
    padding: var(--space-md) var(--space-lg);
    border-top: 1px solid var(--c-border);
    background: var(--c-surface-alt);
  }
  footer .secondary { border: 1px solid var(--c-border-strong); background: var(--c-surface); color: var(--c-text); }
  footer .primary { border: 1px solid var(--c-accent); background: var(--c-accent); color: white; }
  footer .primary:hover { background: var(--c-accent-hover); }
  @media (max-width: 460px) {
    .links { grid-template-columns: 1fr; }
    footer { flex-direction: column-reverse; }
    footer button { width: 100%; }
  }
</style>
