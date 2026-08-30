//go:build windows && !e2e

package webviewloader

// appendSendArcE2EBrowserArgs is deliberately inert in every non-E2E build.
// Keeping the implementation in a separate build-tagged file ensures the
// shipped binary has no environment-variable-controlled CDP path at all.
func appendSendArcE2EBrowserArgs(existing string) string {
	return existing
}
