<script lang="ts">
  let { email, name, onSignOut, onOpenLogs }: {
    email: string;
    name: string;
    onSignOut: () => void;
    onOpenLogs: () => void;
  } = $props();

  const displayName = $derived(email || name || 'your Google account');
</script>

<header class="hdr">
  <div>
    <span class="brand">SendArc</span>
    <span class="who">Sending with <strong>{displayName}</strong></span>
  </div>
  <div class="actions">
    <button type="button" class="secondary" onclick={onOpenLogs}>Open logs</button>
    <button type="button" class="secondary" onclick={onSignOut}>Sign out</button>
  </div>
</header>

<style>
  .hdr {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--space-sm) var(--space-md);
    border-bottom: 1px solid var(--c-border);
    gap: var(--space-md);
  }

  .hdr > div {
    display: flex;
    align-items: baseline;
    gap: var(--space-md);
    min-width: 0;
  }

  .brand {
    color: var(--c-text);
    font-size: 18px;
    font-weight: 750;
  }

  .who {
    color: var(--c-text-muted);
    font-size: 14px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .actions {
    display: flex;
    gap: var(--space-sm);
    flex: 0 0 auto;
  }

  .secondary {
    background: transparent;
    border: 1px solid var(--c-border);
    border-radius: 6px;
    min-height: 36px;
    padding: 6px var(--space-btn-x);
    cursor: pointer;
    color: var(--c-text);
    font-size: 14px;
    font-family: inherit;
  }

  .secondary:hover {
    background: var(--c-surface-alt);
  }

  .secondary:focus-visible {
    outline: 2px solid var(--c-accent);
    outline-offset: -2px;
  }

  @media (max-width: 620px) {
    .hdr > div { align-items: flex-start; flex-direction: column; gap: 0; }
  }
</style>
