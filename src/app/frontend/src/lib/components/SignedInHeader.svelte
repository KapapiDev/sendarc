<script lang="ts">
  let { email, name, onSignOut }: {
    email: string;
    name: string;
    onSignOut: () => void;
  } = $props();

  const displayName = $derived(email || name || 'your Google account');
</script>

<header class="hdr">
  <div>
    <span class="brand">SendArc</span>
    <span class="who">Sending with <strong>{displayName}</strong></span>
  </div>
  <button type="button" class="signout" onclick={onSignOut}>Sign out</button>
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

  .signout {
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

  .signout:hover {
    background: var(--c-surface-alt);
  }

  .signout:focus-visible {
    outline: 2px solid var(--c-accent);
    outline-offset: -2px;
  }

  @media (max-width: 620px) {
    .hdr > div { align-items: flex-start; flex-direction: column; gap: 0; }
  }
</style>
