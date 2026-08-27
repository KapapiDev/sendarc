//go:build windows

package main

import (
	"context"
	"errors"
	"net"
	"strings"

	"github.com/marcfargas/go-mapi/internal/mapi"
)

// classifyAutomodeError is retained under its historical name for binding and
// test compatibility. SendArc uses it only to classify explicit-send failures.
func classifyAutomodeError(err error) string {
	if err == nil {
		return ""
	}
	if errors.Is(err, ErrInvalidGrant) || errors.Is(err, ErrNotAuthenticated) {
		return "signed-out"
	}
	var netErr net.Error
	if errors.As(err, &netErr) {
		return "network"
	}
	var apiErr *mapi.GmailAPIError
	if errors.As(err, &apiErr) && (apiErr.StatusCode == 429 || apiErr.StatusCode >= 500) {
		return "network"
	}
	if errors.Is(err, context.DeadlineExceeded) {
		return "network"
	}
	return "gmail"
}

// safeIDPrefix keeps queue identifiers useful for diagnostics without logging
// the complete content-derived hash.
func safeIDPrefix(id string) string {
	if len(id) > 8 {
		id = id[:8]
	}
	var safe strings.Builder
	safe.Grow(len(id))
	for _, ch := range id {
		if (ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') || (ch >= '0' && ch <= '9') || ch == '-' || ch == '_' {
			safe.WriteRune(ch)
		} else {
			safe.WriteByte('_')
		}
	}
	return safe.String()
}

// Tests point explicit sends at an httptest server. Production leaves this
// empty so NewGmailClientWithBase selects Google's Gmail API endpoint.
var gmailBaseURLOverride string
