<script lang="ts">
  let { onSignIn, onAbout }: { onSignIn: () => void; onAbout: () => void } = $props();
</script>

<section class="signin">
  <h1>SendArc</h1>
  <p class="tagline">Modern Gmail sending for your Windows apps.</p>
  <p class="copy">
    Sign in with Google to review each local email preview, then send it with
    Gmail. SendArc never sends in the background and does not upload messages
    to a SendArc server.
  </p>
  <button class="signin-btn" type="button" onclick={onSignIn}>
    Sign in with Google
  </button>
  <p class="footnote">
    Queued emails stay on your computer until you review or dismiss them.
  </p>
  <button class="about-btn" type="button" onclick={onAbout}>About, privacy & licenses</button>
</section>

<style>
  .signin {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 1rem;
    padding: 3rem 2rem;
    min-height: 100%;
    text-align: center;
  }
  .signin h1 { font-size: 2rem; margin: 0; }
  .tagline { color: var(--c-text-muted, #666); margin: 0; }
  .copy { max-width: 32em; line-height: 1.5; color: var(--c-text, #222); }
  .signin-btn {
    background: #1a73e8;
    color: white;
    font-size: 1rem;
    font-weight: 600;
    padding: 0.75rem 1.5rem;
    border: 0;
    border-radius: 4px;
    cursor: pointer;
  }
  .signin-btn:hover { background: #1662c4; }
  .signin-btn:focus-visible { outline: 2px solid var(--c-accent); outline-offset: 3px; }
  .footnote { font-size: 0.85rem; color: var(--c-text-muted, #666); }
  .about-btn {
    min-height: 44px;
    border: 0;
    border-radius: 6px;
    background: transparent;
    color: var(--c-accent);
    cursor: pointer;
    font-size: 0.875rem;
    text-decoration: underline;
    text-underline-offset: 3px;
  }
  .about-btn:hover { background: var(--c-surface-alt); }
</style>
