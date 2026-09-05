//go:build windows && e2e

package webviewloader

import "os"

// appendSendArcE2EBrowserArgs is compiled only into the Playwright E2E app.
// The upstream loader clears the standard WebView2 argument overrides, so the
// hermetic Windows suite needs this narrowly build-tagged CDP entry point.
func appendSendArcE2EBrowserArgs(existing string) string {
	extra := os.Getenv("GOMAPI_DEBUG_BROWSER_ARGS")
	if extra == "" {
		return existing
	}
	if existing == "" {
		return extra
	}
	return existing + " " + extra
}
