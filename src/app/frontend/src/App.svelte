<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { EventsOn } from '../wailsjs/runtime/runtime';
  import { SendMessageForID, DismissEmail, OpenDiagnosticLogs } from '../wailsjs/go/main/App';
  import { subscribeQueue, fetchQueue, type EmailWithId } from './lib/queue';
  import {
    fetchAuthStatus,
    subscribeAuth,
    signIn,
    signOut,
    hasSeenPreAuthExplainer,
    markPreAuthExplainerSeen,
    type AuthStatus,
  } from './lib/auth';
  import {
    subscribeSendResult,
    fetchUpdateState,
    subscribeUpdateState,
    type ErrorCategory,
    type SendResult,
    type UpdateState,
  } from './lib/settings';
  import SignInScreen from './lib/components/SignInScreen.svelte';
  import PreAuthModal from './lib/components/PreAuthModal.svelte';
  import ReAuthBanner from './lib/components/ReAuthBanner.svelte';
  import SignedInHeader from './lib/components/SignedInHeader.svelte';
  import QueueRow from './lib/components/QueueRow.svelte';
  import UpdateBanner from './lib/components/UpdateBanner.svelte';
  import UpdatePanel from './lib/components/UpdatePanel.svelte';
  import AboutPanel from './lib/components/AboutPanel.svelte';
  import './lib/styles.css';

  let queue = $state<EmailWithId[]>([]);
  let errorMsg = $state<string | null>(null);
  let auth = $state<AuthStatus>({ authenticated: false });
  let showPreAuthModal = $state(false);
  let showReAuthBanner = $state(false);
  let wasAuthenticated = false;

  let sendErrors = $state(new Map<string, ErrorCategory>());
  let sendReasons = $state(new Map<string, string>());
  let flashingIds = $state(new Set<string>());
  let inflightIds = $state(new Set<string>());

  let updateState = $state<UpdateState | null>(null);
  let showUpdatePanel = $state(false);
  let showAboutPanel = $state(false);

  const unsubs: Array<() => void> = [];

  onMount(async () => {
    const [initialAuth, initialQueue, initialUpdate] = await Promise.all([
      fetchAuthStatus(),
      fetchQueue().catch((error) => {
        errorMsg = error instanceof Error ? error.message : 'Queue fetch failed';
        return [];
      }),
      fetchUpdateState().catch(() => null),
    ]);

    auth = initialAuth as AuthStatus;
    wasAuthenticated = auth.authenticated;
    queue = initialQueue as EmailWithId[];
    updateState = initialUpdate as UpdateState | null;

    unsubs.push(subscribeQueue(
      (next) => {
        queue = next;
        pruneRowState(new Set(next.map((email) => email.id)));
      },
      (error) => {
        errorMsg = error instanceof Error ? error.message : 'Queue fetch failed';
      },
    ));

    unsubs.push(EventsOn('queue-error', (message: string) => { errorMsg = message; }));

    unsubs.push(subscribeAuth((status) => {
      const becameSignedOut = wasAuthenticated && !status.authenticated;
      auth = status;
      if (becameSignedOut) {
        showReAuthBanner = true;
      } else if (status.authenticated) {
        showReAuthBanner = false;
      }
      wasAuthenticated = status.authenticated;
    }));

    unsubs.push(subscribeSendResult((result: SendResult) => {
      inflightIds = without(inflightIds, result.emailId);

      if (result.success) {
        sendErrors = withoutKey(sendErrors, result.emailId);
        sendReasons = withoutKey(sendReasons, result.emailId);
        flashingIds = new Set([...flashingIds, result.emailId]);
        setTimeout(() => { flashingIds = without(flashingIds, result.emailId); }, 1600);
        return;
      }

      const nextErrors = new Map(sendErrors);
      nextErrors.set(result.emailId, result.errorCategory ?? 'gmail');
      sendErrors = nextErrors;

      const nextReasons = new Map(sendReasons);
      if (result.reason) nextReasons.set(result.emailId, result.reason);
      else nextReasons.delete(result.emailId);
      sendReasons = nextReasons;
    }));

    unsubs.push(subscribeUpdateState((state: UpdateState) => { updateState = state; }));
  });

  onDestroy(() => {
    for (const unsubscribe of unsubs) unsubscribe();
  });

  function without(values: Set<string>, id: string): Set<string> {
    return new Set([...values].filter((value) => value !== id));
  }

  function withoutKey<T>(values: Map<string, T>, id: string): Map<string, T> {
    const next = new Map(values);
    next.delete(id);
    return next;
  }

  function pruneRowState(ids: Set<string>) {
    sendErrors = new Map([...sendErrors].filter(([id]) => ids.has(id)));
    sendReasons = new Map([...sendReasons].filter(([id]) => ids.has(id)));
    flashingIds = new Set([...flashingIds].filter((id) => ids.has(id)));
    inflightIds = new Set([...inflightIds].filter((id) => ids.has(id)));
  }

  function rowStateFor(id: string): 'idle' | 'in-flight' | 'sent-flash' | 'error' {
    if (flashingIds.has(id)) return 'sent-flash';
    if (inflightIds.has(id)) return 'in-flight';
    if (sendErrors.has(id)) return 'error';
    return 'idle';
  }

  async function handleSend(id: string) {
    sendErrors = withoutKey(sendErrors, id);
    sendReasons = withoutKey(sendReasons, id);
    inflightIds = new Set([...inflightIds, id]);

    try {
      await SendMessageForID(id);
    } catch {
      inflightIds = without(inflightIds, id);
      // The backend also emits send-result. Preserve its more precise category
      // if that event arrived before the rejected binding promise settled.
      if (!sendErrors.has(id)) {
        const nextErrors = new Map(sendErrors);
        nextErrors.set(id, 'gmail');
        sendErrors = nextErrors;
        const nextReasons = new Map(sendReasons);
        nextReasons.set(id, 'Gmail could not send this message. Please retry.');
        sendReasons = nextReasons;
      }
    }
  }

  async function handleDismiss(id: string) {
    try {
      await DismissEmail(id);
    } catch {
      // The queue watcher remains the source of truth; leave the row in place.
    }
  }

  async function handleSignInClick() {
    if (!hasSeenPreAuthExplainer()) {
      showPreAuthModal = true;
      return;
    }
    await signIn();
  }

  async function handlePreAuthContinue() {
    markPreAuthExplainerSeen();
    showPreAuthModal = false;
    await signIn();
  }

  function handlePreAuthCancel() {
    showPreAuthModal = false;
  }

  async function handleReAuthClick() {
    showReAuthBanner = false;
    await signIn();
  }

  async function handleSignOutClick() {
    await signOut();
  }

  async function handleOpenLogs() {
    try {
      await OpenDiagnosticLogs();
    } catch {
      errorMsg = 'SendArc could not open app.log. Restart the app and try again.';
    }
  }

  function handleOpenAbout() {
    showAboutPanel = true;
  }
</script>

{#if updateState?.updateAvailable}
  <UpdateBanner latestVersion={updateState.latestVersion} onViewUpdate={() => { showUpdatePanel = true; }} />
{/if}

{#if showReAuthBanner}
  <ReAuthBanner onRestore={handleReAuthClick} />
{/if}

{#if auth.authenticated}
  <SignedInHeader
    email={auth.email ?? ''}
    name={auth.name ?? ''}
    onSignOut={handleSignOutClick}
    onOpenLogs={handleOpenLogs}
    onAbout={handleOpenAbout}
  />
{/if}

<main>
  {#if !auth.authenticated}
    <SignInScreen onSignIn={handleSignInClick} onAbout={handleOpenAbout} />
  {:else if errorMsg}
    <section class="state state--error" role="alert">
      <h2>SendArc needs attention</h2>
      <p>SendArc cannot read the local email queue. Restart the app, or check app.log for details.</p>
      <button type="button" class="state-action" onclick={handleOpenLogs}>Open diagnostic log</button>
    </section>
  {:else if queue.length === 0}
    <section class="state state--empty">
      <h2>No emails waiting</h2>
      <p>When a Windows app sends to email, SendArc will show a local preview here.</p>
    </section>
  {:else}
    <section class="queue-shell" aria-labelledby="queue-title">
      <div class="queue-heading">
        <div>
          <p class="eyebrow">Ready for review</p>
          <h1 id="queue-title">Email queue</h1>
        </div>
        <p>{queue.length} {queue.length === 1 ? 'message' : 'messages'} waiting</p>
      </div>
      <ul class="queue">
        {#each queue as item (item.id)}
          <QueueRow
            {item}
            status={rowStateFor(item.id)}
            authenticated={auth.authenticated}
            errorCategory={sendErrors.get(item.id)}
            errorReason={sendReasons.get(item.id)}
            onSend={handleSend}
            onDismiss={handleDismiss}
          />
        {/each}
      </ul>
    </section>
  {/if}
</main>

{#if showPreAuthModal}
  <PreAuthModal onContinue={handlePreAuthContinue} onCancel={handlePreAuthCancel} />
{/if}

{#if showUpdatePanel && updateState}
  <UpdatePanel update={updateState} onClose={() => { showUpdatePanel = false; }} />
{/if}

{#if showAboutPanel}
  <AboutPanel
    version={updateState?.currentVersion ?? ''}
    onOpenLogs={handleOpenLogs}
    onClose={() => { showAboutPanel = false; }}
  />
{/if}
