//go:build windows

package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/marcfargas/go-mapi/internal/mapi"
	"golang.org/x/sys/windows"
	"golang.org/x/sys/windows/registry"
)

const (
	runtimeStatusFile = "runtime-status.json"
	repairMAPIArg     = "--repair-mapi"
	mailClientsKey    = `SOFTWARE\Clients\Mail`
	sendArcMailKey    = `SOFTWARE\Clients\Mail\SendArc`
)

// RuntimeStatus contains non-message operational timestamps. It intentionally
// stores no recipients, subject, body, attachment metadata, or OAuth material.
type RuntimeStatus struct {
	LastInterceptedAt  string `json:"lastInterceptedAt,omitempty"`
	LastSuccessfulSend string `json:"lastSuccessfulSend,omitempty"`
}

// MAPIStatus is the user-facing health snapshot for Windows registration.
type MAPIStatus struct {
	Registered   bool   `json:"registered"`
	Default      bool   `json:"default"`
	DLL64Present bool   `json:"dll64Present"`
	DLL32Present bool   `json:"dll32Present"`
	Healthy      bool   `json:"healthy"`
	CanRepair    bool   `json:"canRepair"`
	Detail       string `json:"detail"`
}

// ProductStatus backs the real Status screen. Auth identity remains in memory;
// runtime timestamps and MAPI facts contain no email content.
type ProductStatus struct {
	Gmail              AuthStatus `json:"gmail"`
	MAPI               MAPIStatus `json:"mapi"`
	LastInterceptedAt  string     `json:"lastInterceptedAt,omitempty"`
	LastSuccessfulSend string     `json:"lastSuccessfulSend,omitempty"`
}

type ConnectionTestResult struct {
	Connected bool   `json:"connected"`
	CheckedAt string `json:"checkedAt"`
	Message   string `json:"message"`
}

var (
	inspectMAPIRegistration = inspectMAPIRegistrationWindows
	launchElevatedRepair    = launchElevatedMAPIRepair
	connectionTestEndpoint  = "https://oauth2.googleapis.com/tokeninfo"
)

func runtimeStatusPath() string {
	return filepath.Join(appDataDir(), runtimeStatusFile)
}

func loadRuntimeStatus() RuntimeStatus {
	data, err := os.ReadFile(runtimeStatusPath())
	if err != nil {
		return RuntimeStatus{}
	}
	var status RuntimeStatus
	if json.Unmarshal(data, &status) != nil {
		return RuntimeStatus{}
	}
	return status
}

func saveRuntimeStatus(status RuntimeStatus) error {
	dir := appDataDir()
	if err := os.MkdirAll(dir, 0o700); err != nil {
		return fmt.Errorf("runtime status: create directory: %w", err)
	}
	data, err := json.Marshal(status)
	if err != nil {
		return fmt.Errorf("runtime status: encode: %w", err)
	}
	tmp, err := os.CreateTemp(dir, "runtime-status-*.tmp")
	if err != nil {
		return fmt.Errorf("runtime status: create temp: %w", err)
	}
	tmpPath := tmp.Name()
	defer os.Remove(tmpPath)
	if _, err := tmp.Write(data); err != nil {
		_ = tmp.Close()
		return fmt.Errorf("runtime status: write: %w", err)
	}
	if err := tmp.Sync(); err != nil {
		_ = tmp.Close()
		return fmt.Errorf("runtime status: sync: %w", err)
	}
	if err := tmp.Close(); err != nil {
		return fmt.Errorf("runtime status: close: %w", err)
	}
	if err := moveFileAtomic(tmpPath, runtimeStatusPath()); err != nil {
		return fmt.Errorf("runtime status: commit: %w", err)
	}
	return nil
}

func (a *App) recordLastIntercepted(snapshot []mapi.EmailWithId) {
	var latest time.Time
	for _, item := range snapshot {
		if item.Message == nil {
			continue
		}
		t, err := time.Parse(time.RFC3339Nano, item.Message.Timestamp)
		if err == nil && t.After(latest) {
			latest = t
		}
	}
	if latest.IsZero() {
		return
	}

	a.statusMu.Lock()
	prior, _ := time.Parse(time.RFC3339Nano, a.runtimeStatus.LastInterceptedAt)
	if !latest.After(prior) {
		a.statusMu.Unlock()
		return
	}
	a.runtimeStatus.LastInterceptedAt = latest.UTC().Format(time.RFC3339Nano)
	if err := saveRuntimeStatus(a.runtimeStatus); err != nil {
		logError("runtime status: record intercept: %v", err)
	}
	a.statusMu.Unlock()
}

func (a *App) recordSuccessfulSend(at time.Time) {
	a.statusMu.Lock()
	a.runtimeStatus.LastSuccessfulSend = at.UTC().Format(time.RFC3339Nano)
	if err := saveRuntimeStatus(a.runtimeStatus); err != nil {
		logError("runtime status: record send: %v", err)
	}
	a.statusMu.Unlock()
}

func (a *App) GetProductStatus() ProductStatus {
	a.statusMu.Lock()
	runtimeStatus := a.runtimeStatus
	a.statusMu.Unlock()
	return ProductStatus{
		Gmail:              a.GetAuthStatus(),
		MAPI:               inspectMAPIRegistration(),
		LastInterceptedAt:  runtimeStatus.LastInterceptedAt,
		LastSuccessfulSend: runtimeStatus.LastSuccessfulSend,
	}
}

func installedDLLPaths() (string, string) {
	programFiles64 := os.Getenv("ProgramW6432")
	if programFiles64 == "" {
		programFiles64 = os.Getenv("ProgramFiles")
	}
	programFiles32 := os.Getenv("ProgramFiles(x86)")
	if programFiles32 == "" {
		programFiles32 = programFiles64
	}
	return filepath.Join(programFiles64, "SendArc", "SendArc.dll"),
		filepath.Join(programFiles32, "SendArc", "SendArc.dll")
}

func fileExists(path string) bool {
	info, err := os.Stat(path)
	return err == nil && info.Mode().IsRegular()
}

func inspectMAPIRegistrationWindows() MAPIStatus {
	dll64, dll32 := installedDLLPaths()
	status := MAPIStatus{
		DLL64Present: fileExists(dll64),
		DLL32Present: fileExists(dll32),
	}
	status.CanRepair = status.DLL64Present && status.DLL32Present

	clientKey, err := registry.OpenKey(registry.LOCAL_MACHINE, mailClientsKey, registry.QUERY_VALUE|registry.WOW64_64KEY)
	if err == nil {
		defer clientKey.Close()
		if defaultClient, _, readErr := clientKey.GetStringValue(""); readErr == nil {
			status.Default = strings.EqualFold(defaultClient, "SendArc")
		}
	}

	handlerKey, err := registry.OpenKey(registry.LOCAL_MACHINE, sendArcMailKey, registry.QUERY_VALUE|registry.WOW64_64KEY)
	if err == nil {
		defer handlerKey.Close()
		registeredName, _, nameErr := handlerKey.GetStringValue("")
		dllPath, _, pathErr := handlerKey.GetStringValue("DLLPath")
		expandedPath := os.ExpandEnv(dllPath)
		status.Registered = nameErr == nil && pathErr == nil &&
			strings.EqualFold(registeredName, "SendArc") &&
			strings.EqualFold(filepath.Clean(expandedPath), filepath.Clean(dll64))
	}

	status.Healthy = status.Registered && status.Default && status.DLL64Present && status.DLL32Present
	switch {
	case status.Healthy:
		status.Detail = "SendArc is the default Simple MAPI handler for 32-bit and 64-bit apps."
	case !status.DLL64Present || !status.DLL32Present:
		status.Detail = "One or more installed MAPI components are missing. Run the SendArc installer again."
	case !status.Registered:
		status.Detail = "SendArc's Windows mail-handler registration is missing or incorrect."
	case !status.Default:
		status.Detail = "SendArc is installed but is not the default Windows mail handler."
	default:
		status.Detail = "SendArc's MAPI registration needs attention."
	}
	return status
}

// TestGmailConnection performs a real Google token introspection without
// reading the inbox or sending a message. The access token is sent only to
// Google's OAuth endpoint and is never logged or returned to the frontend.
func (a *App) TestGmailConnection() (ConnectionTestResult, error) {
	ctx := a.shutdownCtx
	if ctx == nil {
		ctx = context.Background()
	}
	ctx, cancel := context.WithTimeout(ctx, 12*time.Second)
	defer cancel()

	err := a.MakeAuthenticatedGmailCall(ctx, func(accessToken string) (int, error) {
		endpoint, err := url.Parse(connectionTestEndpoint)
		if err != nil {
			return 0, errors.New("connection test is unavailable")
		}
		query := endpoint.Query()
		query.Set("access_token", accessToken)
		endpoint.RawQuery = query.Encode()
		req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint.String(), nil)
		if err != nil {
			return 0, errors.New("connection test is unavailable")
		}
		client := &http.Client{Timeout: 10 * time.Second}
		resp, err := client.Do(req)
		if err != nil {
			return 0, errors.New("could not reach Google")
		}
		defer resp.Body.Close()
		if resp.StatusCode == http.StatusBadRequest || resp.StatusCode == http.StatusUnauthorized {
			return http.StatusUnauthorized, errors.New("Google rejected the current session")
		}
		if resp.StatusCode != http.StatusOK {
			return resp.StatusCode, errors.New("Google connection check failed")
		}
		var payload struct {
			Scope string `json:"scope"`
		}
		if err := json.NewDecoder(resp.Body).Decode(&payload); err != nil {
			return resp.StatusCode, errors.New("Google returned an unreadable connection result")
		}
		for _, scope := range strings.Fields(payload.Scope) {
			if scope == scopeGmailSend {
				return resp.StatusCode, nil
			}
		}
		return resp.StatusCode, errors.New("Gmail send permission is missing")
	})
	if err != nil {
		return ConnectionTestResult{}, err
	}
	return ConnectionTestResult{
		Connected: true,
		CheckedAt: time.Now().UTC().Format(time.RFC3339),
		Message:   "Google accepted the current Gmail send connection.",
	}, nil
}

func (a *App) RepairMAPIRegistration() error {
	status := inspectMAPIRegistration()
	if !status.CanRepair {
		return errors.New("repair requires a complete SendArc installation; run the installer again")
	}
	exePath, err := os.Executable()
	if err != nil {
		return errors.New("could not locate the SendArc application")
	}
	if err := launchElevatedRepair(exePath); err != nil {
		return fmt.Errorf("could not start MAPI repair: %w", err)
	}
	return nil
}

func launchElevatedMAPIRepair(exePath string) error {
	verb, err := windows.UTF16PtrFromString("runas")
	if err != nil {
		return err
	}
	file, err := windows.UTF16PtrFromString(exePath)
	if err != nil {
		return err
	}
	args, err := windows.UTF16PtrFromString(repairMAPIArg)
	if err != nil {
		return err
	}
	return windows.ShellExecute(0, verb, file, args, nil, 1)
}

func repairMAPIRegistrationNow() error {
	dll64, dll32 := installedDLLPaths()
	if !fileExists(dll64) || !fileExists(dll32) {
		return errors.New("installed MAPI components are missing")
	}
	if err := backupCurrentMailClientIfNeeded(); err != nil {
		return err
	}

	handlerKey, _, err := registry.CreateKey(registry.LOCAL_MACHINE, sendArcMailKey, registry.SET_VALUE|registry.WOW64_64KEY)
	if err != nil {
		return fmt.Errorf("open SendArc mail-handler key: %w", err)
	}
	defer handlerKey.Close()
	if err := handlerKey.SetStringValue("", "SendArc"); err != nil {
		return fmt.Errorf("write handler name: %w", err)
	}
	if err := handlerKey.SetExpandStringValue("DLLPath", `%PROGRAMFILES%\SendArc\SendArc.dll`); err != nil {
		return fmt.Errorf("write handler path: %w", err)
	}

	clientKey, err := registry.OpenKey(registry.LOCAL_MACHINE, mailClientsKey, registry.SET_VALUE|registry.WOW64_64KEY)
	if err != nil {
		return fmt.Errorf("open Windows mail-client key: %w", err)
	}
	defer clientKey.Close()
	if err := clientKey.SetStringValue("", "SendArc"); err != nil {
		return fmt.Errorf("set default mail handler: %w", err)
	}
	logInfo("MAPI registration repaired")
	return nil
}

func backupCurrentMailClientIfNeeded() error {
	programData := os.Getenv("ProgramData")
	if programData == "" {
		return errors.New("ProgramData is unavailable")
	}
	backupPath := filepath.Join(programData, "SendArc", "uninst", "previous-mail-client.json")
	if _, err := os.Stat(backupPath); err == nil {
		return nil
	} else if !errors.Is(err, os.ErrNotExist) {
		return fmt.Errorf("inspect previous mail-client backup: %w", err)
	}

	var previousClient *string
	clientKey, err := registry.OpenKey(registry.LOCAL_MACHINE, mailClientsKey, registry.QUERY_VALUE|registry.WOW64_64KEY)
	if err == nil {
		defer clientKey.Close()
		if current, _, readErr := clientKey.GetStringValue(""); readErr == nil && current != "" && !strings.EqualFold(current, "SendArc") {
			previousClient = &current
		}
	}
	payload := struct {
		PreviousClient *string `json:"previousClient"`
		BackedUpAt     string  `json:"backedUpAt"`
	}{
		PreviousClient: previousClient,
		BackedUpAt:     time.Now().UTC().Format(time.RFC3339),
	}
	data, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("encode previous mail-client backup: %w", err)
	}
	if err := os.MkdirAll(filepath.Dir(backupPath), 0o755); err != nil {
		return fmt.Errorf("create previous mail-client backup directory: %w", err)
	}
	if err := os.WriteFile(backupPath, data, 0o600); err != nil {
		return fmt.Errorf("write previous mail-client backup: %w", err)
	}
	return nil
}
