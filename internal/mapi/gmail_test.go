package mapi

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

// HTTP-level tests for GmailClient.SendMessage.
//
// Uses httptest.Server via the FOUND-03 NewGmailClientWithBase injection
// point so the real Gmail endpoint is never touched. Covers happy path,
// authentication failure, server-side error, network failure, and
// response-body parse error.

// newTestMail returns a minimal MailMessage that BuildFullMIME can encode
// without touching the filesystem (no attachments).
func newTestMail() *MailMessage {
	return &MailMessage{
		Version:    1,
		Timestamp:  "2026-04-10T00:00:00Z",
		Subject:    "Gmail client test",
		Body:       "body text",
		BodyFormat: "plain",
		Recipients: Recipients{
			To: []Recipient{{Name: "Alice", Address: "alice@example.com"}},
		},
	}
}

func TestGmailClient_SendMessage(t *testing.T) {
	type stubHandler struct {
		status int
		body   string
	}

	cases := []struct {
		name         string
		stub         stubHandler
		closeServer  bool // true = start then close, simulating network failure
		wantID       string
		wantErrSub   string
		expectCalled bool // false only when server is closed before the call
	}{
		{
			name:         "happy path returns message id",
			stub:         stubHandler{status: 200, body: `{"id":"msg_abc123"}`},
			wantID:       "msg_abc123",
			expectCalled: true,
		},
		{
			name:         "401 unauthorized preserves status",
			stub:         stubHandler{status: 401, body: `{"error":"unauthorized"}`},
			wantErrSub:   "Gmail API error (401)",
			expectCalled: true,
		},
		{
			name:         "500 server error surfaces gmail api error",
			stub:         stubHandler{status: 500, body: `{"error":"internal"}`},
			wantErrSub:   "Gmail API error (500)",
			expectCalled: true,
		},
		{
			name:         "200 with non-json body surfaces parse error",
			stub:         stubHandler{status: 200, body: `not-json-at-all`},
			wantErrSub:   "failed to parse response",
			expectCalled: true,
		},
		{
			name:         "network failure when server is closed",
			closeServer:  true,
			wantErrSub:   "failed to send message",
			expectCalled: false,
		},
	}

	for _, tc := range cases {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			var (
				gotMethod string
				gotPath   string
				gotAuth   string
				called    bool
			)

			srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				called = true
				gotMethod = r.Method
				gotPath = r.URL.Path
				gotAuth = r.Header.Get("Authorization")
				// Drain the request body so the client sees a clean response cycle.
				_, _ = io.Copy(io.Discard, r.Body)
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(tc.stub.status)
				_, _ = io.WriteString(w, tc.stub.body)
			}))

			baseURL := srv.URL
			if tc.closeServer {
				// Close the server first so the client gets a connection error.
				srv.Close()
			} else {
				defer srv.Close()
			}

			client := NewGmailClientWithBase("test-token", baseURL)
			id, err := client.SendMessage(context.Background(), newTestMail())

			if tc.wantErrSub == "" {
				if err != nil {
					t.Fatalf("SendMessage unexpected error: %v", err)
				}
				if id != tc.wantID {
					t.Fatalf("SendMessage id = %q, want %q", id, tc.wantID)
				}
			} else {
				if err == nil {
					t.Fatalf("SendMessage expected error containing %q, got nil (id=%q)", tc.wantErrSub, id)
				}
				if !strings.Contains(err.Error(), tc.wantErrSub) {
					t.Fatalf("SendMessage error = %q, want substring %q", err.Error(), tc.wantErrSub)
				}
			}

			if tc.expectCalled {
				if !called {
					t.Fatalf("expected server to be called, wasn't")
				}
				if gotMethod != http.MethodPost {
					t.Errorf("request method = %q, want POST", gotMethod)
				}
				if gotPath != "/messages/send" {
					t.Errorf("request path = %q, want /messages/send", gotPath)
				}
				if gotAuth != "Bearer test-token" {
					t.Errorf("Authorization header = %q, want %q", gotAuth, "Bearer test-token")
				}
			}
		})
	}
}

func TestGmailClient_SendMessage_RequestBodyShape(t *testing.T) {
	// Gmail users.messages.send expects raw at the top level, unlike the
	// nested message.raw envelope used by drafts.create.
	var gotRaw string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var body struct {
			Raw string `json:"raw"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			t.Errorf("failed to decode request body: %v", err)
		}
		gotRaw = body.Raw
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(200)
		_, _ = io.WriteString(w, `{"id":"abc"}`)
	}))
	defer srv.Close()

	client := NewGmailClientWithBase("t", srv.URL)
	if _, err := client.SendMessage(context.Background(), newTestMail()); err != nil {
		t.Fatalf("SendMessage error: %v", err)
	}
	if gotRaw == "" {
		t.Fatal("expected non-empty top-level raw in request body")
	}
	// base64url should not contain padding, plus or slash characters.
	if strings.ContainsAny(gotRaw, "+/=") {
		t.Errorf("message.raw contains non-base64url characters: %q", gotRaw)
	}
}

func TestGmailClient_SendMessage_ContextCancellation(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	cancel()

	client := NewGmailClientWithBase("t", "http://127.0.0.1:1")
	_, err := client.SendMessage(ctx, newTestMail())
	if !errors.Is(err, context.Canceled) {
		t.Fatalf("expected context cancellation, got %v", err)
	}
}

func TestGmailClient_SendMessage_APIErrorDoesNotExposeResponseBody(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
		_, _ = io.WriteString(w, `{"error":"private-message-content"}`)
	}))
	defer srv.Close()

	client := NewGmailClientWithBase("t", srv.URL)
	_, err := client.SendMessage(context.Background(), newTestMail())
	var apiErr *GmailAPIError
	if !errors.As(err, &apiErr) || apiErr.StatusCode != http.StatusInternalServerError {
		t.Fatalf("expected typed GmailAPIError(500), got %v", err)
	}
	if strings.Contains(err.Error(), "private-message-content") {
		t.Fatalf("API response body leaked into error: %v", err)
	}
}

func TestGmailClient_SendMessage_RejectsMissingRecipientBeforeNetwork(t *testing.T) {
	msg := newTestMail()
	msg.Recipients = Recipients{}
	client := NewGmailClientWithBase("t", "http://127.0.0.1:1")
	if _, err := client.SendMessage(context.Background(), msg); err == nil || !strings.Contains(err.Error(), "missing recipient") {
		t.Fatalf("expected missing-recipient validation error, got %v", err)
	}
}
