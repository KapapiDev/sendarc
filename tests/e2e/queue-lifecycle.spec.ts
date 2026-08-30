import { test, expect } from './fixtures/wails-app';

// Phase 11 plan 06 — queue lifecycle regression coverage.
//
// Each test drives the real Wails app: the harness drops MailMessage JSON
// into the watched temp dir, the Go watcher picks it up, emits
// 'queue-changed', the Svelte app re-renders, the test asserts visible
// queue rows and drives clicks. This proves the current preview-first contract:
// no network call on arrival/preview/cancel/dismiss, exactly one users.messages.send
// call after explicit confirmation, retry-safe failure handling, and no Gmail
// draft request.

test.describe.serial('queue lifecycle', () => {
  test('Test 1 — arrival renders a queue row within 3s', async ({ app }) => {
    const dropped = await app.watchDir.dropEmail({
      subject: 'Arrival test',
      to: [{ name: 'Alice', address: 'alice@example.com' }],
    });

    const row = app.page.locator('[data-testid="queue-row"]').first();
    await expect(row).toBeVisible({ timeout: 3_000 });
    // Subject is the canonical user-visible content; sender renders
    // '(unknown sender)' because the MailMessage schema has no `from` field
    // in the current codebase (QueueRow reads msg.from if present; the Go
    // watcher only populates recipients). Asserting the subject proves the
    // arrival → render round-trip.
    await expect(row).toContainText('Arrival test');
    // Sanity check that the file we dropped exists on disk.
    expect(dropped.fullPath).toMatch(/\.json$/);
  });

  test('Test 2 — preview is local and explicit Send posts the complete MIME message', async ({ app }) => {
    const body = 'Unicode body: 안녕하세요 · café';
    const attachmentBody = 'SendArc attachment proof';
    await app.watchDir.dropEmail({
      subject: 'Explicit send proof',
      body,
      to: [{ name: 'Alice', address: 'alice@example.com' }],
      cc: [{ name: 'Carlos', address: 'carlos@example.com' }],
      bcc: [{ name: 'Bea', address: 'bea@example.com' }],
      attachments: [{ filename: 'proof.txt', content: attachmentBody }],
    });

    const row = app.page.locator('[data-testid="queue-row"]').first();
    await expect(row).toBeVisible({ timeout: 3_000 });
    expect(app.gmail.messages).toHaveLength(0);
    expect(app.gmail.draftAttempts).toHaveLength(0);

    await row.getByTestId('queue-row-preview').click();
    const preview = row.getByRole('region', { name: /email preview/i });
    await expect(preview).toBeVisible();
    await expect(preview).toContainText('alice@example.com');
    await expect(preview).toContainText('carlos@example.com');
    await expect(preview).toContainText('bea@example.com');
    await expect(preview.getByTestId('message-body')).toHaveText(body);
    await expect(preview).toContainText('proof.txt');

    // Preview itself is strictly local. The fake Gmail server must remain
    // untouched until the separate confirmation button is clicked.
    expect(app.gmail.messages).toHaveLength(0);
    expect(app.gmail.draftAttempts).toHaveLength(0);

    await row.getByTestId('queue-row-send').click();

    await expect(app.page.locator('[data-testid="queue-row"]')).toHaveCount(0, { timeout: 3_000 });

    expect(app.gmail.messages).toHaveLength(1);
    expect(app.gmail.draftAttempts).toHaveLength(0);
    expect(app.gmail.messages[0].headers.authorization).toBe('Bearer e2e-fake-token-do-not-use');

    const request = JSON.parse(app.gmail.messages[0].body) as { raw?: string; message?: unknown };
    expect(typeof request.raw).toBe('string');
    expect(request.message).toBeUndefined();
    const mime = Buffer.from(request.raw!, 'base64url').toString('utf8');
    expect(mime).toContain('To: "Alice" <alice@example.com>');
    expect(mime).toContain('Cc: "Carlos" <carlos@example.com>');
    expect(mime).toContain('Bcc: "Bea" <bea@example.com>');
    expect(mime).toContain('Subject: Explicit send proof');
    expect(mime).toContain(Buffer.from(body, 'utf8').toString('base64'));
    expect(mime).toContain('proof.txt');
    expect(mime).toContain(Buffer.from(attachmentBody, 'utf8').toString('base64'));
  });

  test('Test 3 — Cancel closes preview without sending; Dismiss removes the row', async ({ app }) => {
    await app.watchDir.dropEmail({ subject: 'Cancel and dismiss' });

    const row = app.page.locator('[data-testid="queue-row"]').first();
    await expect(row).toBeVisible({ timeout: 3_000 });

    await row.getByTestId('queue-row-preview').click();
    const preview = row.getByRole('region', { name: /email preview/i });
    await expect(preview).toBeVisible();
    await row.getByTestId('queue-row-cancel').click();
    await expect(preview).toBeHidden();
    expect(app.gmail.messages).toHaveLength(0);
    expect(app.gmail.draftAttempts).toHaveLength(0);

    await row.getByTestId('queue-row-dismiss').click();

    // Same root cause as Test 2 — Delete() must dispatch queue-changed
    // after os.Remove so the Svelte app re-renders empty.
    await expect(app.page.locator('[data-testid="queue-row"]')).toHaveCount(0, { timeout: 3_000 });

    // Dismiss must not contact Gmail at all.
    expect(app.gmail.messages).toHaveLength(0);
    expect(app.gmail.draftAttempts).toHaveLength(0);
  });

  test('Test 4 — multi-arrival shows BOTH rows (overwrite regression guard)', async ({ app }) => {
    // Timestamps are distinct so the canonical watcher sort is stable.
    const now = Date.now();
    await app.watchDir.dropEmail({
      subject: 'First arrival',
      timestamp: new Date(now).toISOString(),
      to: [{ name: 'Alice', address: 'alice@example.com' }],
    });
    // Slight delay so fsnotify debouncing doesn't collapse the two Creates
    // into a single processFile invocation.
    await app.page.waitForTimeout(600);
    await app.watchDir.dropEmail({
      subject: 'Second arrival',
      timestamp: new Date(now + 1_000).toISOString(),
      to: [{ name: 'Bob', address: 'bob@example.com' }],
    });

    const rows = app.page.locator('[data-testid="queue-row"]');
    await expect(rows).toHaveCount(2, { timeout: 3_000 });

    const allText = await rows.allTextContents();
    expect(allText.some((t) => t.includes('First arrival'))).toBe(true);
    expect(allText.some((t) => t.includes('Second arrival'))).toBe(true);
  });

  test('Test 5 — Gmail 503 keeps the row and a second explicit Send succeeds', async ({ app }) => {
    app.gmail.failNextWith(503);
    await app.watchDir.dropEmail({
      subject: 'Retry after Gmail outage',
      to: [{ name: 'Alice', address: 'alice@example.com' }],
    });

    const row = app.page.locator('[data-testid="queue-row"]').first();
    await expect(row).toBeVisible({ timeout: 3_000 });
    await row.getByTestId('queue-row-preview').click();
    await row.getByTestId('queue-row-send').click();

    await expect(row.getByTestId('send-error')).toContainText(
      'network is unavailable',
      { timeout: 3_000 },
    );
    await expect(row).toContainText('Retry after Gmail outage');
    expect(app.gmail.messages).toHaveLength(1);
    expect(app.gmail.draftAttempts).toHaveLength(0);

    await row.getByTestId('queue-row-send').click();
    await expect(app.page.locator('[data-testid="queue-row"]')).toHaveCount(0, { timeout: 3_000 });
    expect(app.gmail.messages).toHaveLength(2);
    expect(app.gmail.draftAttempts).toHaveLength(0);
  });

  test('Test 6 — offline send keeps the message queued with an actionable error', async ({ app }) => {
    await app.gmail.close();
    await app.watchDir.dropEmail({
      subject: 'Offline queue retention',
      to: [{ name: 'Alice', address: 'alice@example.com' }],
    });

    const row = app.page.locator('[data-testid="queue-row"]').first();
    await expect(row).toBeVisible({ timeout: 3_000 });
    await row.getByTestId('queue-row-preview').click();
    await row.getByTestId('queue-row-send').click();

    await expect(row.getByTestId('send-error')).toContainText(
      'network is unavailable',
      { timeout: 3_000 },
    );
    await expect(row).toContainText('Offline queue retention');
    expect(app.gmail.messages).toHaveLength(0);
    expect(app.gmail.draftAttempts).toHaveLength(0);
  });
});
