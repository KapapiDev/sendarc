//go:build windows

package main

import (
	"context"
	"errors"
	"fmt"
	"net"
	"testing"

	"github.com/marcfargas/go-mapi/internal/mapi"
)

func TestClassifySendError(t *testing.T) {
	tests := []struct {
		name string
		err  error
		want string
	}{
		{"nil", nil, ""},
		{"signed out", ErrNotAuthenticated, "signed-out"},
		{"invalid grant wrapped", fmt.Errorf("refresh: %w", ErrInvalidGrant), "signed-out"},
		{"deadline", context.DeadlineExceeded, "network"},
		{"connection refused", &net.OpError{Op: "dial", Net: "tcp", Err: errors.New("refused")}, "network"},
		{"rate limited", &mapi.GmailAPIError{StatusCode: 429}, "network"},
		{"gmail unavailable", &mapi.GmailAPIError{StatusCode: 503}, "network"},
		{"gmail bad request", &mapi.GmailAPIError{StatusCode: 400}, "gmail"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := classifyAutomodeError(tt.err); got != tt.want {
				t.Fatalf("got %q, want %q", got, tt.want)
			}
		})
	}
}
