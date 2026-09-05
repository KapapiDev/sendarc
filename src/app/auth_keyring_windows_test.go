//go:build windows && credentialstore_integration

package main

import (
	"errors"
	"fmt"
	"os"
	"testing"
	"time"

	"github.com/zalando/go-keyring"
)

// isolatedWindowsKeyringStore maps production service/account arguments to a
// unique, test-only Credential Manager entry. The integration suite therefore
// cannot read, overwrite, or delete a real SendArc login.
type isolatedWindowsKeyringStore struct {
	real    realKeyringStore
	service string
	user    string
}

func (s isolatedWindowsKeyringStore) Get(_, _ string) (string, error) {
	return s.real.Get(s.service, s.user)
}

func (s isolatedWindowsKeyringStore) Set(_, _, secret string) error {
	return s.real.Set(s.service, s.user, secret)
}

func (s isolatedWindowsKeyringStore) Delete(_, _ string) error {
	return s.real.Delete(s.service, s.user)
}

func newIsolatedWindowsKeyringStore(t *testing.T) isolatedWindowsKeyringStore {
	t.Helper()
	stamp := fmt.Sprintf("%d-%d", os.Getpid(), time.Now().UnixNano())
	store := isolatedWindowsKeyringStore{
		real:    realKeyringStore{},
		service: "SendArc-Credential-Integration-" + stamp,
		user:    "oauth-tokens-integration",
	}
	_ = store.real.Delete(store.service, store.user)
	t.Cleanup(func() { _ = store.real.Delete(store.service, store.user) })
	return store
}

// TestRealKeyring_WindowsRoundTrip exercises realKeyringStore against the
// real Windows Credential Manager. Runs only when the explicit
// credentialstore_integration build tag is supplied. D-11 integration coverage: the cross-platform
// unit tests use fakeKeyringStore; this file confirms the real backend
// honours the same contract (Get/Set/Delete + keyring.ErrNotFound after Delete).
func TestRealKeyring_WindowsRoundTrip(t *testing.T) {
	store := newIsolatedWindowsKeyringStore(t)
	payload := `{"access_token":"a","refresh_token":"r","token_type":"Bearer","expiry":"2026-04-15T00:00:00Z"}`

	if err := store.Set("ignored", "ignored", payload); err != nil {
		t.Fatalf("Set: %v", err)
	}
	restartedStore := isolatedWindowsKeyringStore{
		real:    realKeyringStore{},
		service: store.service,
		user:    store.user,
	}
	got, err := restartedStore.Get("ignored", "ignored")
	if err != nil {
		t.Fatalf("Get: %v", err)
	}
	if got != payload {
		t.Fatalf("round-trip mismatch:\n got %q\nwant %q", got, payload)
	}
	if err := restartedStore.Delete("ignored", "ignored"); err != nil {
		t.Fatalf("Delete: %v", err)
	}
	if _, err := store.Get("ignored", "ignored"); !errors.Is(err, keyring.ErrNotFound) {
		t.Fatalf("expected keyring.ErrNotFound after Delete, got %v", err)
	}
}

// TestAuthManagerKeyringRoundTrip_RealKeyring pairs AuthManager with an
// isolated wrapper over the real keyring and confirms save/load across fresh
// manager/store instances without using the production credential name.
func TestAuthManagerKeyringRoundTrip_RealKeyring(t *testing.T) {
	store := newIsolatedWindowsKeyringStore(t)
	am := NewAuthManagerWithStore(store)
	am.tokens = &OAuthTokens{
		AccessToken:  "a",
		RefreshToken: "r",
		TokenType:    "Bearer",
		Expiry:       time.Date(2026, 4, 15, 0, 0, 0, 0, time.UTC),
	}
	if err := am.SaveToKeyring(); err != nil {
		t.Fatalf("save: %v", err)
	}

	restartedStore := isolatedWindowsKeyringStore{
		real:    realKeyringStore{},
		service: store.service,
		user:    store.user,
	}
	am2 := NewAuthManagerWithStore(restartedStore)
	if err := am2.LoadFromKeyring(); err != nil {
		t.Fatalf("load: %v", err)
	}
	if am2.tokens == nil {
		t.Fatal("tokens nil after load")
	}
	if *am2.tokens != *am.tokens {
		t.Fatalf("round-trip mismatch:\n got %+v\n want %+v", *am2.tokens, *am.tokens)
	}
	if err := am2.ClearTokens(); err != nil {
		t.Fatalf("clear: %v", err)
	}
	if _, err := restartedStore.Get("ignored", "ignored"); !errors.Is(err, keyring.ErrNotFound) {
		t.Fatalf("expected keyring.ErrNotFound after ClearTokens, got %v", err)
	}
}
