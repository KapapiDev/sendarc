<script lang="ts">
  import { onMount } from 'svelte';
  import { activateModal, handleModalKeydown } from '../modal';

  let { onContinue, onCancel }: { onContinue: () => void; onCancel: () => void } = $props();
  let modal: HTMLDivElement;

  onMount(() => activateModal(modal));
</script>

<div class="backdrop">
  <div
    class="modal"
    role="dialog"
    aria-modal="true"
    aria-labelledby="preauth-title"
    tabindex="-1"
    bind:this={modal}
    onkeydown={(event) => handleModalKeydown(event, modal, onCancel)}
  >
    <h2 id="preauth-title">Connect Google securely</h2>
    <p>
      Google should identify the app as <strong>SendArc</strong> and ask only for permission
      to send email on your behalf.
    </p>
    <p class="warning">
      If Google says the app is unverified or unsafe, close the tab and stop. Do not bypass
      the warning. Beta access is limited to accounts explicitly approved for testing.
    </p>
    <p class="note">
      SendArc requests permission to send mail with Gmail after you review it
      locally and click Send. It cannot read your inbox, and you can revoke access from
      your Google account settings.
    </p>
    <div class="actions">
      <button type="button" class="secondary" onclick={onCancel}>Cancel</button>
      <button type="button" class="primary" onclick={onContinue}>Open Google sign-in</button>
    </div>
  </div>
</div>

<style>
  .backdrop {
    position: fixed; inset: 0;
    background: rgba(0,0,0,0.5);
    display: flex; align-items: center; justify-content: center;
    z-index: 100;
  }
  .modal {
    background: white; border-radius: 8px;
    max-width: 28rem; width: calc(100% - 2rem);
    padding: 1.5rem;
    box-shadow: 0 10px 30px rgba(0,0,0,0.3);
    max-height: calc(100vh - 2rem);
    overflow-y: auto;
  }
  .modal h2 { margin-top: 0; }
  .warning {
    margin: 1rem 0;
    border-left: 3px solid #d97706;
    padding: 0.75rem 0.875rem;
    background: #fff8eb;
    color: #6b3a08;
  }
  .note { font-size: 0.85rem; color: #555; }
  .actions { display: flex; justify-content: flex-end; gap: 0.5rem; margin-top: 1rem; }
  .actions button {
    min-height: 40px; padding: 0.5rem 1rem; border-radius: 4px; border: 0; cursor: pointer; font-size: 0.95rem;
  }
  .primary { background: #1a73e8; color: white; }
  .secondary { background: #eee; color: #222; }
  .actions button:focus-visible { outline: 2px solid var(--c-accent); outline-offset: 2px; }
  .actions button:active { opacity: 0.8; }
</style>
