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
    <h2 id="preauth-title">One thing before we continue</h2>
    <p>
      During the beta, Google may show a warning that <strong>SendArc isn't verified</strong>.
      Only continue if the app name shown by Google is SendArc.
    </p>
    <p>To continue, click:</p>
    <ol class="steps">
      <li><strong>Advanced</strong></li>
      <li><strong>Go to SendArc (unsafe)</strong></li>
    </ol>
    <p class="note">
      SendArc requests permission to send mail with Gmail after you review it
      locally and click Send. You can revoke access from your Google account settings.
    </p>
    <div class="actions">
      <button type="button" class="secondary" onclick={onCancel}>Cancel</button>
      <button type="button" class="primary" onclick={onContinue}>Continue to Google</button>
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
  .steps { padding-left: 1.5rem; }
  .steps li { margin: 0.25rem 0; }
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
