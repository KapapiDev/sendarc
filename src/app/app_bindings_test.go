//go:build windows

package main

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/marcfargas/go-mapi/internal/mapi"
)

// nopWatcherCallback discards watcher callbacks in binding tests.
type nopWatcherCallback struct{}

func (*nopWatcherCallback) OnQueueChanged(_ []mapi.EmailWithId) {}
func (*nopWatcherCallback) OnError(_ error)                     {}

// ---- shared helper for binding tests ----

// setupAppForBindingTests builds a minimal App with a real EmailWatcher pointed
// at a temp dir, a fake keyring, and valid in-memory tokens. It does NOT start
// the automode goroutine or tray — binding tests only need watcher + auth.
//
// Returns (app, watchDir, cleanup). The caller must defer cleanup().
func setupAppForBindingTests(t *testing.T) (*App, string) {
	t.Helper()

	watchDir := t.TempDir()

	// App with fake keyring and valid in-memory tokens.
	app := NewApp()
	app.auth = NewAuthManagerWithStore(newFakeKeyringStore())
	app.auth.tokens = &OAuthTokens{
		AccessToken:  "valid-access-token",
		RefreshToken: "valid-refresh-token",
		TokenType:    "Bearer",
		Expiry:       time.Now().Add(1 * time.Hour),
	}

	// shutdownCtx — cancelled on t.Cleanup.
	shutdownCtx, cancel := context.WithCancel(context.Background())
	app.shutdownCtx = shutdownCtx
	app.shutdownCancel = cancel
	t.Cleanup(cancel)

	// Real EmailWatcher pointed at watchDir.
	cb := &nopWatcherCallback{}
	ew, err := mapi.NewEmailWatcher(watchDir, cb)
	if err != nil {
		t.Fatalf("NewEmailWatcher: %v", err)
	}
	t.Cleanup(func() { ew.Stop() })
	if err := ew.Start(); err != nil {
		t.Fatalf("ew.Start: %v", err)
	}
	app.watcher = ew

	// Default settings.
	app.settings = AppSettings{Mode: defaultMode}

	// Keep binding-test settings outside the real per-user profile.
	t.Setenv("SENDARC_APPDATA_DIR", t.TempDir())
	// Register this after TempDir/Setenv cleanups so it runs first (LIFO) and
	// releases the Windows file handle before testing removes the directory.
	t.Cleanup(closeLog)

	return app, watchDir
}

// seedBindingEmail writes a valid email JSON to watchDir and waits for the
// watcher to register it. Returns the queue id.
func seedBindingEmail(t *testing.T, app *App, watchDir, filename, subject string) string {
	t.Helper()
	msg := mapi.MailMessage{
		Version:    1,
		Timestamp:  "2024-01-01T00:00:00Z",
		Subject:    subject,
		Body:       "body",
		BodyFormat: "plain",
		Recipients: mapi.Recipients{
			To: []mapi.Recipient{{Address: "to@example.com"}},
		},
	}
	data, err := json.Marshal(msg)
	if err != nil {
		t.Fatalf("json.Marshal: %v", err)
	}
	path := filepath.Join(watchDir, filename)
	if err := os.WriteFile(path, data, 0644); err != nil {
		t.Fatalf("os.WriteFile: %v", err)
	}
	// Poll until watcher sees the file.
	deadline := time.Now().Add(3 * time.Second)
	for time.Now().Before(deadline) {
		for _, e := range app.watcher.Snapshot() {
			if e.Message.Subject == subject {
				return e.Id
			}
		}
		time.Sleep(50 * time.Millisecond)
	}
	t.Fatalf("seedBindingEmail: %q did not appear in watcher snapshot within 3s", subject)
	return ""
}

// ---- validateEmailID ----

func TestValidateEmailID_EmptyReturnsError(t *testing.T) {
	if err := validateEmailID(""); err == nil {
		t.Error("expected error for empty id, got nil")
	}
}

func TestValidateEmailID_TooLongReturnsError(t *testing.T) {
	long := make([]byte, 129)
	for i := range long {
		long[i] = 'a'
	}
	if err := validateEmailID(string(long)); err == nil {
		t.Error("expected error for 129-char id, got nil")
	}
}

func TestValidateEmailID_NormalIDReturnsNil(t *testing.T) {
	// 64-char hex SHA256 hash — typical watcher id.
	id := "a3f2c1b4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2"
	if err := validateEmailID(id); err != nil {
		t.Errorf("unexpected error for valid id: %v", err)
	}
}

// ---- SendMessageForID ----

func TestSendMessageForID_EmptyIDReturnsError(t *testing.T) {
	app, _ := setupAppForBindingTests(t)
	if err := app.SendMessageForID(""); err == nil {
		t.Error("expected error for empty id")
	}
}

func TestSendMessageForID_InvalidIDReturnsError(t *testing.T) {
	app, _ := setupAppForBindingTests(t)
	for _, id := range []string{"short", strings.Repeat("A", 64), strings.Repeat("g", 64)} {
		if err := app.SendMessageForID(id); err == nil {
			t.Errorf("expected error for invalid id %q", id)
		}
	}
}

func TestSendMessageForID_UnknownIDReturnsNilIdempotent(t *testing.T) {
	// An id not in the queue should return nil (idempotency — already processed).
	app, _ := setupAppForBindingTests(t)
	id := "a3f2c1b4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2"
	if err := app.SendMessageForID(id); err != nil {
		t.Errorf("expected nil for unknown id (idempotent), got %v", err)
	}
}

func TestSendMessageForID_UnauthenticatedReturnsError(t *testing.T) {
	app, watchDir := setupAppForBindingTests(t)

	// Seed an email.
	id := seedBindingEmail(t, app, watchDir, "email1.json", "Test Unauth")

	// Clear tokens — simulate signed-out state.
	app.auth.tokens = nil

	err := app.SendMessageForID(id)
	if err == nil {
		t.Fatal("expected error when not authenticated, got nil")
	}
}

func TestSendMessageForID_SuccessMarkProcessed(t *testing.T) {
	app, watchDir := setupAppForBindingTests(t)

	// Gmail stub — returns success.
	gmailSrv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(200)
		_, _ = w.Write([]byte(`{"id":"draft-test-123"}`))
	}))
	t.Cleanup(gmailSrv.Close)
	gmailBaseURLOverride = gmailSrv.URL
	t.Cleanup(func() { gmailBaseURLOverride = "" })

	id := seedBindingEmail(t, app, watchDir, "email1.json", "Test Success")

	if err := app.SendMessageForID(id); err != nil {
		t.Fatalf("expected nil, got %v", err)
	}

	// Email must be removed from the queue after success (MarkProcessed ran).
	deadline := time.Now().Add(2 * time.Second)
	for time.Now().Before(deadline) {
		found := false
		for _, e := range app.watcher.Snapshot() {
			if e.Id == id {
				found = true
				break
			}
		}
		if !found {
			return // passed
		}
		time.Sleep(50 * time.Millisecond)
	}
	t.Error("email still in snapshot after successful SendMessageForID — MarkProcessed should have removed it")
}

func TestSendMessageForID_DuplicateConcurrentCallSendsOnce(t *testing.T) {
	app, watchDir := setupAppForBindingTests(t)

	entered := make(chan struct{}, 1)
	release := make(chan struct{})
	var requests atomic.Int32
	gmailSrv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		requests.Add(1)
		entered <- struct{}{}
		<-release
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"id":"sent-once"}`))
	}))
	t.Cleanup(gmailSrv.Close)
	gmailBaseURLOverride = gmailSrv.URL
	t.Cleanup(func() { gmailBaseURLOverride = "" })

	id := seedBindingEmail(t, app, watchDir, "duplicate.json", "Send once")
	firstDone := make(chan error, 1)
	go func() { firstDone <- app.SendMessageForID(id) }()
	select {
	case <-entered:
	case <-time.After(2 * time.Second):
		t.Fatal("first send did not reach Gmail stub")
	}
	secondDone := make(chan error, 1)
	go func() { secondDone <- app.SendMessageForID(id) }()
	select {
	case err := <-secondDone:
		if err != nil {
			t.Fatalf("duplicate call should be an idempotent no-op, got %v", err)
		}
	case <-time.After(500 * time.Millisecond):
		close(release)
		t.Fatal("duplicate call blocked instead of returning idempotently")
	}
	close(release)
	if err := <-firstDone; err != nil {
		t.Fatalf("first send failed: %v", err)
	}
	if got := requests.Load(); got != 1 {
		t.Fatalf("Gmail requests = %d, want 1", got)
	}
}

func TestSendMessageForID_InvalidGrantDoesNotBacklogSkip(t *testing.T) {
	// Token endpoint returns invalid_grant; Gmail returns 401 to trigger refresh.
	tokenSrv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(400)
		_, _ = w.Write([]byte(`{"error":"invalid_grant"}`))
	}))
	t.Cleanup(tokenSrv.Close)
	tokenEndpointOverride = tokenSrv.URL
	t.Cleanup(func() { tokenEndpointOverride = "" })

	gmailSrv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(401)
		_, _ = w.Write([]byte(`{"error":"unauthorized"}`))
	}))
	t.Cleanup(gmailSrv.Close)
	gmailBaseURLOverride = gmailSrv.URL
	t.Cleanup(func() { gmailBaseURLOverride = "" })

	app, watchDir := setupAppForBindingTests(t)
	// Expire the token so refreshIfNeededLocked hits the token endpoint.
	app.auth.tokens.Expiry = time.Now().Add(-time.Minute)

	id := seedBindingEmail(t, app, watchDir, "email1.json", "Test InvalidGrant")

	err := app.SendMessageForID(id)
	if err == nil {
		t.Fatal("expected error from invalid_grant path, got nil")
	}

	// Explicit SendMessageForID must not populate the legacy backlogSkip set.
	if app.isBacklogSkipped(id) {
		t.Error("explicit SendMessageForID must not populate backlogSkip")
	}
}

// ---- DismissEmail ----

func TestDismissEmail_EmptyIDReturnsError(t *testing.T) {
	app, _ := setupAppForBindingTests(t)
	if err := app.DismissEmail(""); err == nil {
		t.Error("expected error for empty id")
	}
}

func TestDismissEmail_Success(t *testing.T) {
	app, watchDir := setupAppForBindingTests(t)
	id := seedBindingEmail(t, app, watchDir, "email1.json", "Dismiss Success")

	if err := app.DismissEmail(id); err != nil {
		t.Fatalf("DismissEmail: unexpected error: %v", err)
	}
}

func TestDismissEmail_Idempotent(t *testing.T) {
	app, watchDir := setupAppForBindingTests(t)
	id := seedBindingEmail(t, app, watchDir, "email1.json", "Dismiss Idempotent")

	if err := app.DismissEmail(id); err != nil {
		t.Fatalf("first DismissEmail: %v", err)
	}
	// Second dismiss must also return nil (idempotent per Plan 03 Task 1).
	if err := app.DismissEmail(id); err != nil {
		t.Fatalf("second DismissEmail should be idempotent, got: %v", err)
	}
}

func TestDismissEmail_WorksWhenSignedOut(t *testing.T) {
	app, watchDir := setupAppForBindingTests(t)
	id := seedBindingEmail(t, app, watchDir, "email1.json", "Dismiss SignedOut")

	// Clear tokens — signed out.
	app.auth.tokens = nil

	// DismissEmail must NOT require auth (design decision per plan).
	if err := app.DismissEmail(id); err != nil {
		t.Fatalf("DismissEmail should work when signed out, got: %v", err)
	}
}

// ---- GetSettings / SaveSettings ----

func TestGetSettings_DefaultsToManual(t *testing.T) {
	app, _ := setupAppForBindingTests(t)
	s := app.GetSettings()
	if s.Mode != "manual" {
		t.Errorf("expected default mode=manual, got %q", s.Mode)
	}
}

func TestSaveSettings_RejectsAutomaticMode(t *testing.T) {
	app, _ := setupAppForBindingTests(t)

	if err := app.SaveSettings(AppSettings{Mode: "auto-draft"}); err == nil {
		t.Fatal("expected automatic mode to be rejected")
	}

	s := app.GetSettings()
	if s.Mode != defaultMode {
		t.Errorf("expected mode=%s after rejection, got %q", defaultMode, s.Mode)
	}
}

func TestSaveSettings_ValidatesMode(t *testing.T) {
	app, _ := setupAppForBindingTests(t)

	if err := app.SaveSettings(AppSettings{Mode: "invalid-mode"}); err == nil {
		t.Error("expected error for invalid mode, got nil")
	}

	// Settings must not have been updated.
	if app.GetSettings().Mode != "manual" {
		t.Error("mode should still be manual after failed SaveSettings")
	}
}

func TestSaveSettings_PersistsToDisk(t *testing.T) {
	app, _ := setupAppForBindingTests(t)

	if err := app.SaveSettings(AppSettings{Mode: defaultMode}); err != nil {
		t.Fatalf("SaveSettings: %v", err)
	}

	// Read the file back directly to confirm it was persisted.
	data, err := os.ReadFile(settingsPath())
	if err != nil {
		t.Fatalf("ReadFile(settingsPath): %v", err)
	}
	var s AppSettings
	if err := json.Unmarshal(data, &s); err != nil {
		t.Fatalf("Unmarshal: %v", err)
	}
	if s.Mode != defaultMode {
		t.Errorf("expected mode=%s on disk, got %q", defaultMode, s.Mode)
	}
}

// ---- GetMode / SetMode ----

func TestGetMode_ReturnsCurrentMode(t *testing.T) {
	app, _ := setupAppForBindingTests(t)
	if got := app.GetMode(); got != defaultMode {
		t.Errorf("expected %q, got %q", defaultMode, got)
	}
}

func TestSetMode_AcceptsManualAndRejectsAutomatic(t *testing.T) {
	app, _ := setupAppForBindingTests(t)

	if err := app.SetMode(defaultMode); err != nil {
		t.Fatalf("SetMode: %v", err)
	}
	if app.GetMode() != defaultMode {
		t.Errorf("GetMode should remain manual, got %q", app.GetMode())
	}

	if err := app.SetMode("auto-draft"); err == nil {
		t.Error("expected automatic mode to be rejected")
	}
}

// ---- PauseWatching / ResumeWatching / GetPausedState ----

func TestPauseAndResume_UpdateGetPausedState(t *testing.T) {
	app, _ := setupAppForBindingTests(t)

	if app.GetPausedState() {
		t.Error("expected paused=false by default")
	}

	app.PauseWatching()
	if !app.GetPausedState() {
		t.Error("expected paused=true after PauseWatching")
	}

	app.ResumeWatching()
	if app.GetPausedState() {
		t.Error("expected paused=false after ResumeWatching")
	}
}

func TestPauseWatching_IsIdempotent(t *testing.T) {
	app, _ := setupAppForBindingTests(t)
	app.PauseWatching()
	app.PauseWatching() // second call must not panic or change state unexpectedly
	if !app.GetPausedState() {
		t.Error("expected still paused after double PauseWatching")
	}
}

func TestResumeWatching_WhenAlreadyRunning(t *testing.T) {
	app, _ := setupAppForBindingTests(t)
	app.ResumeWatching() // called when not paused — must be a no-op
	if app.GetPausedState() {
		t.Error("expected paused=false after ResumeWatching on non-paused app")
	}
}
