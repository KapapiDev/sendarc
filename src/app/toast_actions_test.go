//go:build windows

package main

import (
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"
)

// Notification buttons are deliberately limited to local review or discard.
// This regression test places a recorder at the Gmail endpoint so any future
// accidental send from a toast action becomes a hard failure.
func TestHandleToastAction_ReviewAndDismissNeverSend(t *testing.T) {
	app, watchDir := setupAppForBindingTests(t)

	var gmailCalls atomic.Int32
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		gmailCalls.Add(1)
		w.WriteHeader(http.StatusInternalServerError)
	}))
	t.Cleanup(server.Close)
	previousBaseURL := gmailBaseURLOverride
	gmailBaseURLOverride = server.URL
	t.Cleanup(func() { gmailBaseURLOverride = previousBaseURL })

	var showCalls atomic.Int32
	app.windowShowOverride = func() { showCalls.Add(1) }

	reviewID := seedBindingEmail(t, app, watchDir, "review.json", "Review from notification")
	app.handleToastAction("action=review&emailId=" + reviewID)
	if showCalls.Load() != 1 {
		t.Fatalf("review action showed the app %d times; want 1", showCalls.Load())
	}
	if gmailCalls.Load() != 0 {
		t.Fatalf("review action made %d Gmail calls; want 0", gmailCalls.Load())
	}
	if len(app.watcher.Snapshot()) != 1 {
		t.Fatal("review action must leave the message queued for local preview")
	}

	dismissID := seedBindingEmail(t, app, watchDir, "dismiss.json", "Dismiss from notification")
	app.handleToastAction("action=dismiss&emailId=" + dismissID)
	if showCalls.Load() != 1 {
		t.Fatal("dismiss action must not open the app window")
	}
	if gmailCalls.Load() != 0 {
		t.Fatalf("dismiss action made %d Gmail calls; want 0", gmailCalls.Load())
	}
	for _, item := range app.watcher.Snapshot() {
		if item.Id == dismissID {
			t.Fatal("dismiss action left the discarded message in the queue")
		}
		if item.Id != reviewID {
			t.Fatalf("unexpected queue item after dismiss: %s", safeIDPrefix(item.Id))
		}
	}
}
