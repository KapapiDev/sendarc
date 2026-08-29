//go:build windows

package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

// Phase 11 — notify-only update service (REL-03, REL-05).
//
// Scope boundary (locked by phase CONTEXT.md):
//   - D-03: notify-only. No download, no installer launch, no in-process
//     binary replacement. Ever. Any future helper that "quits and installs"
//     belongs to a later phase and must not reuse this service surface.
//   - D-04: update-check failures are silent to the user. CheckNow returns
//     (state, error); callers log the error but never flip a user-visible
//     error banner or tray icon on transient GitHub/network failures.
//   - D-05: persisted preferences live in AppSettings (see settings.go),
//     never in a second config file.
//   - D-06: manual "Check for updates now" must exist as a callable path.
//     The service exposes CheckNow() for that use case; App wiring comes in
//     Task 2.
//   - D-07: exposed state must include current version, last-checked
//     timestamp, and the enabled flag so tray/frontend can render without
//     duplicating this logic.
//   - D-08: update checks default enabled. AppSettings handles the default;
//     the service stays a pure consumer of the (already-defaulted) settings.
//
// We call GitHub's official latest-release metadata endpoint, do our own
// version compare, and hand the user the release page to review and download
// manually. The app never downloads or applies an update itself.

const (
	// gitHubOwner / gitHubRepo are hardcoded to the repo slug so no user
	// input or settings file can redirect update checks to a different
	// origin (threat T-11-01-01 partial mitigation + Pitfall-4 guard).
	gitHubOwner      = "maxtop9843-byte"
	gitHubRepo       = "sendarc"
	gitHubAPIVersion = "2026-03-10"

	// manualReleaseURL is the stable page shown to users when an update is
	// available. SendArc intentionally uses notify-only updates until its
	// Windows installer/update path has been independently verified.
	manualReleaseURL = "https://github.com/" + gitHubOwner + "/" + gitHubRepo +
		"/releases/latest"
	// Kept as the existing frontend/test contract name. It deliberately points
	// to the human-reviewed release page, not an executable download.
	installerDownloadURL = manualReleaseURL

	// updateCheckWindow is the cadence floor between background checks
	// (REL-03: "every 24h").
	updateCheckWindow = 24 * time.Hour
)

// UpdateState is the single source of truth that tray and frontend render
// from. Intentionally metadata-only — no fields for download paths,
// staged installers, or replacement flags. If you find yourself wanting
// to add one, revisit D-03; that belongs in a later phase, not here.
type UpdateState struct {
	// CurrentVersion is main.Version at process start (ldflags-injected,
	// see main.go). Always populated.
	CurrentVersion string `json:"currentVersion"`

	// LatestVersion is the tag/version reported by the most recent
	// successful release fetch. Empty string if no successful fetch has
	// happened yet or the most recent fetch failed.
	LatestVersion string `json:"latestVersion"`

	// LatestReleaseURL points at the GitHub release page for
	// LatestVersion. Used for the "Release notes" affordance (D-02).
	LatestReleaseURL string `json:"latestReleaseUrl"`

	// InstallerURL is retained for the frontend contract, but points to the
	// manual GitHub release page rather than a direct-download executable.
	InstallerURL string `json:"installerUrl"`

	// UpdateAvailable is true iff LatestVersion > CurrentVersion. Pure
	// derived signal — tray/frontend treat this as the "show banner"
	// trigger.
	UpdateAvailable bool `json:"updateAvailable"`

	// LastCheckedAt is the RFC3339 timestamp of the most recent check
	// attempt (success OR failure). Empty string when never checked.
	// Refreshed even on fetch failure so cadence advances and users are
	// not stuck in a hot-loop of failing re-fetches.
	LastCheckedAt string `json:"lastCheckedAt"`

	// Enabled mirrors AppSettings.UpdateChecksEnabled so tray/frontend
	// can render the toggle state without reading settings themselves.
	Enabled bool `json:"enabled"`
}

// latestRelease is the subset of release metadata the service needs.
// Keeping this as our own type means tests can stub without pulling any
// transport-specific type into the service contract.
type latestRelease struct {
	Version    string
	ReleaseURL string
}

// releaseFetcher abstracts "ask GitHub for the newest stable release"
// so tests can inject a stub without a real HTTP call. The production
// implementation calls GitHub's official latest-release REST endpoint and
// consumes metadata only. No release asset is downloaded by this service.
type releaseFetcher interface {
	FetchLatestRelease(ctx context.Context) (*latestRelease, error)
}

// updateLogger is the logging seam used by the service. Matches the
// existing logInfo/logError signature in logging.go so production code
// can pass those directly.
type updateLogger func(format string, args ...any)

// updateService owns the notify-only update flow: version compare,
// cadence gating, release fetching, and state emission. It does NOT
// own persistence — App does, via a guarded writer (Task 2) — and does
// NOT own Wails event emission — App does, after calling CheckNow.
type updateService struct {
	currentVersion string
	fetcher        releaseFetcher
	log            updateLogger
}

// newUpdateService builds the service. currentVersion should be
// main.Version. logger may be nil (falls back to a no-op); in
// production we pass logInfo.
func newUpdateService(currentVersion string, fetcher releaseFetcher, logger updateLogger) *updateService {
	if logger == nil {
		logger = func(string, ...any) {}
	}
	return &updateService{
		currentVersion: currentVersion,
		fetcher:        fetcher,
		log:            logger,
	}
}

// updateSettings is the subset of AppSettings plus the current time
// that MaybeCheck needs. Pulling `Now` in as a parameter keeps cadence
// logic deterministic under test (no time.Now() mock plumbing).
type updateSettings struct {
	Enabled         bool
	LastUpdateCheck string // RFC3339, "" = never checked
	Now             time.Time
}

// MaybeCheck runs the cadence/opt-out decision tree and performs a
// background check iff the user has checks enabled AND the last check
// is older than updateCheckWindow (or missing). Returns:
//   - state: the resulting UpdateState regardless of whether a check
//     was performed (so callers can hydrate tray/UI after every call);
//   - checked: true iff FetchLatestRelease was actually invoked. This
//     lets the caller decide whether to persist a new LastUpdateCheck
//     through the App-owned guarded writer (Task 2);
//   - err: non-nil iff the fetch was attempted and failed. Callers log
//     the error and preserve prior user-visible fields (D-04). The
//     returned state still has LastCheckedAt refreshed so cadence
//     advances even on failure.
func (s *updateService) MaybeCheck(ctx context.Context, settings updateSettings) (UpdateState, bool, error) {
	// Base state — always reflects current version + enabled flag so
	// callers have a valid snapshot even on the opt-out path.
	state := UpdateState{
		CurrentVersion: s.currentVersion,
		InstallerURL:   manualReleaseURL,
		Enabled:        settings.Enabled,
		LastCheckedAt:  settings.LastUpdateCheck,
	}

	if !settings.Enabled {
		// REL-05 opt-out: user turned checks off. Do not hit the
		// network. Do not mutate LastCheckedAt.
		return state, false, nil
	}

	if !s.cadenceExpired(settings.Now, settings.LastUpdateCheck) {
		// Inside the 24h window; skip the fetch but return the
		// cached state so callers can hydrate tray/UI.
		return state, false, nil
	}

	// Cadence expired — do the fetch. Failure is silent to the user
	// but the caller receives the error so it can be logged and the
	// prior user-visible state preserved (D-04).
	newState, err := s.CheckNow(ctx)
	if err != nil {
		s.log("updates: background fetch failed: %v", err)
	}
	// Preserve the Enabled flag the caller asked about — CheckNow does
	// not know about the settings.Enabled gate.
	newState.Enabled = settings.Enabled
	return newState, true, err
}

// CheckNow forces a fetch regardless of cadence. Used by:
//   - the D-06 manual "Check for updates now" action; and
//   - MaybeCheck when the cadence window has expired.
//
// Always refreshes LastCheckedAt so cadence advances on both success
// and failure paths — otherwise a persistent GitHub outage would pin
// the app in a retry loop every startup.
func (s *updateService) CheckNow(ctx context.Context) (UpdateState, error) {
	now := time.Now().UTC().Format(time.RFC3339)
	state := UpdateState{
		CurrentVersion: s.currentVersion,
		InstallerURL:   manualReleaseURL,
		LastCheckedAt:  now,
		Enabled:        true, // caller may overwrite; CheckNow semantically assumes the user asked for a check
	}

	rel, err := s.fetcher.FetchLatestRelease(ctx)
	if err != nil {
		// D-04: return the error for logging but do not let it mutate
		// user-visible fields — no stale LatestVersion, no banner.
		return state, err
	}
	if rel == nil {
		// No release found yet (e.g. pre-v3 tag list). Not an error;
		// nothing to announce.
		return state, nil
	}

	state.LatestVersion = rel.Version
	state.LatestReleaseURL = rel.ReleaseURL
	state.UpdateAvailable = isNewerVersion(s.currentVersion, rel.Version)
	return state, nil
}

// cadenceExpired reports whether now - lastISO >= updateCheckWindow.
// Empty / unparsable lastISO counts as "never checked" → expired.
func (s *updateService) cadenceExpired(now time.Time, lastISO string) bool {
	if lastISO == "" {
		return true
	}
	last, err := time.Parse(time.RFC3339, lastISO)
	if err != nil {
		s.log("updates: invalid LastUpdateCheck %q, treating as never-checked: %v", lastISO, err)
		return true
	}
	return now.Sub(last) >= updateCheckWindow
}

// isNewerVersion returns true iff latest > current using semver-ish
// comparison tolerant of "vX.Y.Z" tag prefixes and dev-mode strings.
//
// Dev / prerelease builds (e.g. "3.0.0-dev") are compared by semver rules:
// a tagged release of the same main version is newer, but an older main
// version is NOT newer. Prior to QUICK-260423-qpx this function shortcut
// isDevVersion(current) -> true unconditionally, which caused a 3.0.0-dev
// user to see v2.1.0 as an "upgrade" when that was the newest stable tag
// on GitHub. The compareSemver path below gets this right out of the
// box because splitPrerelease treats the prerelease segment per semver
// (release > prerelease on equal main; main segments dominate otherwise).
func isNewerVersion(current, latest string) bool {
	if latest == "" {
		return false
	}
	return selfupdateGreaterThan(latest, current)
}

// selfupdateGreaterThan retains its historical name for test compatibility.
// It is now a local semver comparison with no self-update dependency.
func selfupdateGreaterThan(latest, current string) bool {
	l := trimVersion(latest)
	c := trimVersion(current)
	// If the library is reachable we could use hashicorp/go-version
	// directly, but pulling it in explicitly keeps the dep surface
	// narrow. Hand-rolled compare is fine for our two-segment release
	// cadence (3.0.0, 3.0.1, 3.1.0).
	return compareSemver(l, c) > 0
}

// trimVersion strips a leading "v" and anything after a "+" build
// metadata separator. Preserves "-prerelease" so prereleases compare
// lower than their stable counterpart.
func trimVersion(v string) string {
	v = strings.TrimSpace(v)
	v = strings.TrimPrefix(v, "v")
	if i := strings.IndexByte(v, '+'); i >= 0 {
		v = v[:i]
	}
	return v
}

// compareSemver returns >0 if a>b, <0 if a<b, 0 if equal. Tolerant
// but not fully spec-compliant — see trimVersion for the dialect we
// accept.
func compareSemver(a, b string) int {
	aMain, aPre := splitPrerelease(a)
	bMain, bPre := splitPrerelease(b)
	if n := compareNumericSegments(aMain, bMain); n != 0 {
		return n
	}
	// Main segments equal. Semver rule: a release without a prerelease
	// identifier is greater than one with it.
	switch {
	case aPre == "" && bPre == "":
		return 0
	case aPre == "":
		return 1
	case bPre == "":
		return -1
	default:
		return strings.Compare(aPre, bPre)
	}
}

func splitPrerelease(v string) (main, pre string) {
	if i := strings.IndexByte(v, '-'); i >= 0 {
		return v[:i], v[i+1:]
	}
	return v, ""
}

func compareNumericSegments(a, b string) int {
	as := strings.Split(a, ".")
	bs := strings.Split(b, ".")
	n := len(as)
	if len(bs) > n {
		n = len(bs)
	}
	for i := 0; i < n; i++ {
		ai := segAt(as, i)
		bi := segAt(bs, i)
		if ai != bi {
			if ai > bi {
				return 1
			}
			return -1
		}
	}
	return 0
}

func segAt(segs []string, i int) int {
	if i >= len(segs) {
		return 0
	}
	n := 0
	for _, r := range segs[i] {
		if r < '0' || r > '9' {
			return n
		}
		n = n*10 + int(r-'0')
	}
	return n
}

// isDevVersion reports whether v looks like a local dev build rather
// than a tagged release. Anything containing "dev" or equal to
// "0.0.0" counts — the Wails default productVersion and the -ldflags
// fallback in main.go both match.
func isDevVersion(v string) bool {
	v = strings.ToLower(strings.TrimSpace(v))
	if v == "" {
		return true
	}
	if strings.Contains(v, "dev") {
		return true
	}
	if trimVersion(v) == "0.0.0" {
		return true
	}
	return false
}

// --- Production release fetcher ---------------------------------------

// gitHubReleaseFetcher is a minimal metadata-only client for GitHub's official
// latest-release endpoint. Keeping this on net/http avoids importing updater,
// archive, OpenPGP, SSH, or binary-replacement code into the shipping app.
type gitHubReleaseFetcher struct {
	client   *http.Client
	endpoint string
}

var gitHubLatestReleaseEndpoint = "https://api.github.com/repos/" + gitHubOwner + "/" + gitHubRepo + "/releases/latest"

// newGitHubReleaseFetcher builds a real GitHub-backed fetcher. The returned
// fetcher is safe to share across goroutines.
func newGitHubReleaseFetcher() (*gitHubReleaseFetcher, error) {
	return &gitHubReleaseFetcher{
		client:   &http.Client{Timeout: 12 * time.Second},
		endpoint: gitHubLatestReleaseEndpoint,
	}, nil
}

// FetchLatestRelease asks GitHub for the latest stable published release.
// GitHub returns 404 before the repository has a stable release; that is a
// normal pre-launch state and maps to (nil, nil).
func (g *gitHubReleaseFetcher) FetchLatestRelease(ctx context.Context) (*latestRelease, error) {
	if g == nil || g.client == nil || g.endpoint == "" {
		return nil, errors.New("updates: GitHub client not initialised")
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, g.endpoint, nil)
	if err != nil {
		return nil, fmt.Errorf("updates: build GitHub request: %w", err)
	}
	req.Header.Set("Accept", "application/vnd.github+json")
	req.Header.Set("X-GitHub-Api-Version", gitHubAPIVersion)
	req.Header.Set("User-Agent", "SendArc/"+Version)

	resp, err := g.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("updates: query GitHub: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode == http.StatusNotFound {
		return nil, nil
	}
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("updates: GitHub returned status %d", resp.StatusCode)
	}

	var payload struct {
		TagName    string `json:"tag_name"`
		HTMLURL    string `json:"html_url"`
		Draft      bool   `json:"draft"`
		Prerelease bool   `json:"prerelease"`
	}
	if err := json.NewDecoder(io.LimitReader(resp.Body, 1<<20)).Decode(&payload); err != nil {
		return nil, fmt.Errorf("updates: decode GitHub response: %w", err)
	}
	if payload.Draft || payload.Prerelease || strings.TrimSpace(payload.TagName) == "" {
		return nil, nil
	}
	if !isTrustedReleasePage(payload.HTMLURL) {
		return nil, errors.New("updates: GitHub returned an unexpected release URL")
	}
	return &latestRelease{
		Version:    trimVersion(payload.TagName),
		ReleaseURL: payload.HTMLURL,
	}, nil
}

func isTrustedReleasePage(raw string) bool {
	prefix := "https://github.com/" + gitHubOwner + "/" + gitHubRepo + "/releases/tag/"
	return strings.HasPrefix(raw, prefix) && len(raw) > len(prefix)
}
