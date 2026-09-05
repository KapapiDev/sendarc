//go:build windows

package main

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/marcfargas/go-mapi/internal/mapi"
)

func TestRuntimeStatusRoundTrip(t *testing.T) {
	dir := t.TempDir()
	t.Setenv("SENDARC_APPDATA_DIR", dir)
	want := RuntimeStatus{
		LastInterceptedAt:  "2026-08-29T01:02:03Z",
		LastSuccessfulSend: "2026-08-29T01:03:04Z",
	}
	if err := saveRuntimeStatus(want); err != nil {
		t.Fatalf("saveRuntimeStatus: %v", err)
	}
	if got := loadRuntimeStatus(); got != want {
		t.Fatalf("loadRuntimeStatus = %#v, want %#v", got, want)
	}
	if info, err := os.Stat(filepath.Join(dir, runtimeStatusFile)); err != nil || !info.Mode().IsRegular() {
		t.Fatalf("runtime status file missing: info=%v err=%v", info, err)
	}
}

func TestRecordLastInterceptedKeepsNewestTimestampAndNoMessageData(t *testing.T) {
	dir := t.TempDir()
	t.Setenv("SENDARC_APPDATA_DIR", dir)
	app := NewApp()
	app.recordLastIntercepted([]mapi.EmailWithId{
		{Message: &mapi.MailMessage{Timestamp: "2026-08-29T01:04:05Z", Subject: "must not persist"}},
		{Message: &mapi.MailMessage{Timestamp: "2026-08-29T01:03:05Z"}},
	})
	app.recordLastIntercepted([]mapi.EmailWithId{
		{Message: &mapi.MailMessage{Timestamp: "2026-08-29T01:00:00Z"}},
	})

	got := loadRuntimeStatus()
	if got.LastInterceptedAt != "2026-08-29T01:04:05Z" {
		t.Fatalf("LastInterceptedAt = %q", got.LastInterceptedAt)
	}
	data, err := os.ReadFile(runtimeStatusPath())
	if err != nil {
		t.Fatal(err)
	}
	if string(data) == "" || json.Valid(data) == false {
		t.Fatalf("invalid runtime status JSON: %q", data)
	}
	if string(data) != `{"lastInterceptedAt":"2026-08-29T01:04:05Z"}` {
		t.Fatalf("runtime status persisted unexpected data: %s", data)
	}
}

func TestGetProductStatusCombinesAuthMapiAndRuntimeFacts(t *testing.T) {
	t.Setenv("SENDARC_APPDATA_DIR", t.TempDir())
	priorInspect := inspectMAPIRegistration
	inspectMAPIRegistration = func() MAPIStatus {
		return MAPIStatus{Healthy: true, Registered: true, Default: true, Detail: "healthy"}
	}
	defer func() { inspectMAPIRegistration = priorInspect }()

	app := NewApp()
	app.auth.tokens = &OAuthTokens{AccessToken: "token", Expiry: time.Now().Add(time.Hour)}
	app.auth.email = "user@example.com"
	app.runtimeStatus = RuntimeStatus{LastSuccessfulSend: "2026-08-29T01:05:06Z"}
	got := app.GetProductStatus()
	if !got.Gmail.Authenticated || got.Gmail.Email != "user@example.com" {
		t.Fatalf("unexpected Gmail status: %#v", got.Gmail)
	}
	if !got.MAPI.Healthy || got.LastSuccessfulSend != "2026-08-29T01:05:06Z" {
		t.Fatalf("unexpected product status: %#v", got)
	}
}

func TestGmailConnectionChecksExactSendScope(t *testing.T) {
	t.Setenv("SENDARC_APPDATA_DIR", t.TempDir())
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Query().Get("access_token") != "private-token" {
			t.Error("connection test did not pass the current access token")
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"scope":"https://www.googleapis.com/auth/gmail.send","expires_in":"3600"}`))
	}))
	defer server.Close()
	priorEndpoint := connectionTestEndpoint
	connectionTestEndpoint = server.URL
	defer func() { connectionTestEndpoint = priorEndpoint }()

	app := NewApp()
	app.auth.tokens = &OAuthTokens{AccessToken: "private-token", Expiry: time.Now().Add(time.Hour)}
	result, err := app.TestGmailConnection()
	if err != nil {
		t.Fatalf("TestGmailConnection: %v", err)
	}
	if !result.Connected || result.CheckedAt == "" {
		t.Fatalf("unexpected connection result: %#v", result)
	}
}

func TestGmailConnectionRejectsMissingSendScope(t *testing.T) {
	t.Setenv("SENDARC_APPDATA_DIR", t.TempDir())
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		_, _ = w.Write([]byte(`{"scope":"openid email"}`))
	}))
	defer server.Close()
	priorEndpoint := connectionTestEndpoint
	connectionTestEndpoint = server.URL
	defer func() { connectionTestEndpoint = priorEndpoint }()

	app := NewApp()
	app.auth.tokens = &OAuthTokens{AccessToken: "private-token", Expiry: time.Now().Add(time.Hour)}
	if _, err := app.TestGmailConnection(); err == nil {
		t.Fatal("expected missing gmail.send scope to fail")
	}
}

func TestRepairBindingUsesElevatedHelperOnlyWhenInstalledComponentsExist(t *testing.T) {
	t.Setenv("SENDARC_APPDATA_DIR", t.TempDir())
	priorInspect := inspectMAPIRegistration
	priorLaunch := launchElevatedRepair
	inspectMAPIRegistration = func() MAPIStatus { return MAPIStatus{CanRepair: true} }
	var launched string
	launchElevatedRepair = func(exe string) error { launched = exe; return nil }
	defer func() {
		inspectMAPIRegistration = priorInspect
		launchElevatedRepair = priorLaunch
	}()

	if err := NewApp().RepairMAPIRegistration(); err != nil {
		t.Fatalf("RepairMAPIRegistration: %v", err)
	}
	if launched == "" {
		t.Fatal("elevated repair helper was not launched")
	}
}
