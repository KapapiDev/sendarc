package mapi

import (
	"bytes"
	"context"
	"crypto/rand"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"mime"
	"net/http"
	netmail "net/mail"
	"os"
	"path/filepath"
	"strings"
	"time"
)

const (
	GmailAPIBase   = "https://www.googleapis.com/gmail/v1/users/me"
	MaxFileSize    = 25 * 1024 * 1024 // individual attachment safety bound
	MaxMessageSize = 25 * 1024 * 1024 // serialized MIME size bound
)

// GmailClient handles Gmail API operations
type GmailClient struct {
	httpClient *http.Client
	token      string
	baseURL    string // injection point for tests and CLI flag; defaults to GmailAPIBase
}

// GmailAPIError preserves the HTTP status without copying a Gmail response
// body (which may contain user data) into logs or the UI.
type GmailAPIError struct {
	StatusCode int
}

func (e *GmailAPIError) Error() string {
	return fmt.Sprintf("Gmail API error (%d)", e.StatusCode)
}

// NewGmailClient creates a new Gmail API client with the given OAuth token
// using the default Gmail API base URL. For tests or alternate endpoints,
// use NewGmailClientWithBase.
func NewGmailClient(token string) *GmailClient {
	return NewGmailClientWithBase(token, GmailAPIBase)
}

// NewGmailClientWithBase creates a Gmail API client with an explicit base URL.
// Used by tests (httptest.Server) and by the native host when --gmail-api-base
// is passed on the command line.
// If baseURL is empty, the default GmailAPIBase is used.
func NewGmailClientWithBase(token, baseURL string) *GmailClient {
	if baseURL == "" {
		baseURL = GmailAPIBase
	}
	return &GmailClient{
		httpClient: &http.Client{Timeout: 30 * time.Second},
		token:      token,
		baseURL:    baseURL,
	}
}

// MessageResponse represents the subset of a Gmail API message response used
// by SendArc. The API returns the message id after a successful send.
type MessageResponse struct {
	ID string `json:"id"`
}

// SendMessage sends a MailMessage through the authenticated Gmail account.
// The complete MIME payload is built locally and submitted in one request.
func (gc *GmailClient) SendMessage(ctx context.Context, msg *MailMessage) (string, error) {
	if err := ValidateMailMessage(msg); err != nil {
		return "", fmt.Errorf("invalid message: %w", err)
	}
	mimeMsg, err := BuildFullMIME(msg)
	if err != nil {
		return "", fmt.Errorf("failed to build MIME message: %w", err)
	}

	bodyJSON, err := json.Marshal(map[string]string{
		"raw": Base64URLEncode(mimeMsg),
	})
	if err != nil {
		return "", fmt.Errorf("failed to marshal request: %w", err)
	}

	url := fmt.Sprintf("%s/messages/send", gc.baseURL)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(bodyJSON))
	if err != nil {
		return "", fmt.Errorf("failed to create request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+gc.token)
	req.Header.Set("Content-Type", "application/json")

	resp, err := gc.httpClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("failed to send message: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < http.StatusOK || resp.StatusCode >= http.StatusMultipleChoices {
		return "", &GmailAPIError{StatusCode: resp.StatusCode}
	}

	var sent MessageResponse
	if err := json.NewDecoder(resp.Body).Decode(&sent); err != nil {
		return "", fmt.Errorf("failed to parse response: %w", err)
	}
	return sent.ID, nil
}

// CreateDraft creates a Gmail draft from a MailMessage, including attachments.
// Deprecated: retained only for upstream compatibility while the legacy
// automode implementation is removed. SendArc's user-facing flow calls
// SendMessage and never requests the gmail.compose scope.
func (gc *GmailClient) CreateDraft(msg *MailMessage) (string, error) {
	// Build full MIME message with attachments
	mimeMsg, err := BuildFullMIME(msg)
	if err != nil {
		return "", fmt.Errorf("failed to build MIME message: %w", err)
	}

	encodedMsg := Base64URLEncode(mimeMsg)

	body := map[string]interface{}{
		"message": map[string]interface{}{
			"raw": encodedMsg,
		},
	}
	bodyJSON, err := json.Marshal(body)
	if err != nil {
		return "", fmt.Errorf("failed to marshal request: %w", err)
	}

	url := fmt.Sprintf("%s/drafts", gc.baseURL)
	req, err := http.NewRequest("POST", url, bytes.NewReader(bodyJSON))
	if err != nil {
		return "", fmt.Errorf("failed to create request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+gc.token)
	req.Header.Set("Content-Type", "application/json")

	resp, err := gc.httpClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("failed to create draft: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode == 401 {
		return "", fmt.Errorf("token expired")
	}
	if resp.StatusCode != 200 {
		respBody, _ := io.ReadAll(resp.Body)
		return "", fmt.Errorf("Gmail API error (%d): %s", resp.StatusCode, string(respBody))
	}

	var draft MessageResponse
	if err := json.NewDecoder(resp.Body).Decode(&draft); err != nil {
		return "", fmt.Errorf("failed to parse response: %w", err)
	}

	return draft.ID, nil
}

// BuildFullMIME builds a complete RFC 2822 message from a MailMessage,
// including attachments as MIME parts. Single-pass, no network calls.
func BuildFullMIME(msg *MailMessage) ([]byte, error) {
	if err := ValidateMailMessage(msg); err != nil {
		return nil, fmt.Errorf("invalid message: %w", err)
	}
	var buf bytes.Buffer

	hasAttachments := len(msg.Attachments) > 0
	boundary, err := randomMIMEBoundary()
	if err != nil {
		return nil, fmt.Errorf("generate MIME boundary: %w", err)
	}

	// Headers
	if len(msg.Recipients.To) > 0 {
		buf.WriteString(fmt.Sprintf("To: %s\r\n", formatRecipients(msg.Recipients.To)))
	}
	if len(msg.Recipients.CC) > 0 {
		buf.WriteString(fmt.Sprintf("Cc: %s\r\n", formatRecipients(msg.Recipients.CC)))
	}
	if len(msg.Recipients.BCC) > 0 {
		buf.WriteString(fmt.Sprintf("Bcc: %s\r\n", formatRecipients(msg.Recipients.BCC)))
	}
	buf.WriteString(fmt.Sprintf("Subject: %s\r\n", mimeEncodeHeader(msg.Subject)))
	buf.WriteString("MIME-Version: 1.0\r\n")
	if sentAt, err := time.Parse(time.RFC3339, msg.Timestamp); err == nil {
		buf.WriteString(fmt.Sprintf("Date: %s\r\n", sentAt.Format(time.RFC1123Z)))
	}

	if hasAttachments {
		buf.WriteString(fmt.Sprintf("Content-Type: multipart/mixed; boundary=\"%s\"\r\n", boundary))
		buf.WriteString("\r\n")

		// Body part
		buf.WriteString(fmt.Sprintf("--%s\r\n", boundary))
		contentType := "text/plain"
		if msg.BodyFormat == "html" {
			contentType = "text/html"
		}
		buf.WriteString(fmt.Sprintf("Content-Type: %s; charset=UTF-8\r\n", contentType))
		buf.WriteString("Content-Transfer-Encoding: base64\r\n")
		buf.WriteString("\r\n")
		buf.WriteString(base64Wrap([]byte(msg.Body)))
		buf.WriteString("\r\n")

		// Attachment parts
		for _, att := range msg.Attachments {
			info, err := os.Stat(att.Path)
			if err != nil {
				return nil, fmt.Errorf("attachment not found: %s: %w", att.Path, err)
			}
			if info.Size() > MaxFileSize {
				return nil, fmt.Errorf("attachment too large (%d bytes): %s", info.Size(), att.Filename)
			}

			fileData, err := os.ReadFile(att.Path)
			if err != nil {
				return nil, fmt.Errorf("failed to read %s: %w", att.Path, err)
			}

			mimeType := mime.TypeByExtension(filepath.Ext(att.Filename))
			if mimeType == "" {
				mimeType = "application/octet-stream"
			}
			mediaType, params, err := mime.ParseMediaType(mimeType)
			if err != nil {
				mediaType = "application/octet-stream"
				params = map[string]string{}
			}
			params["name"] = att.Filename

			buf.WriteString(fmt.Sprintf("--%s\r\n", boundary))
			buf.WriteString(fmt.Sprintf("Content-Type: %s\r\n", mime.FormatMediaType(mediaType, params)))
			buf.WriteString("Content-Transfer-Encoding: base64\r\n")
			buf.WriteString(fmt.Sprintf("Content-Disposition: %s\r\n", mime.FormatMediaType("attachment", map[string]string{"filename": att.Filename})))
			buf.WriteString("\r\n")
			buf.WriteString(base64Wrap(fileData))
			buf.WriteString("\r\n")
		}

		buf.WriteString(fmt.Sprintf("--%s--\r\n", boundary))
	} else {
		// Simple message, no attachments
		contentType := "text/plain"
		if msg.BodyFormat == "html" {
			contentType = "text/html"
		}
		buf.WriteString(fmt.Sprintf("Content-Type: %s; charset=UTF-8\r\n", contentType))
		buf.WriteString("Content-Transfer-Encoding: base64\r\n")
		buf.WriteString("\r\n")
		buf.WriteString(base64Wrap([]byte(msg.Body)))
	}

	if buf.Len() > MaxMessageSize {
		return nil, fmt.Errorf("message too large (%d bytes)", buf.Len())
	}
	return buf.Bytes(), nil
}

func randomMIMEBoundary() (string, error) {
	var raw [18]byte
	if _, err := rand.Read(raw[:]); err != nil {
		return "", err
	}
	return "sendarc_" + hex.EncodeToString(raw[:]), nil
}

// formatRecipients formats a list of recipients for an email header
func formatRecipients(recipients []Recipient) string {
	parts := make([]string, len(recipients))
	for i, r := range recipients {
		parts[i] = (&netmail.Address{Name: r.Name, Address: r.Address}).String()
	}
	return strings.Join(parts, ", ")
}

// mimeEncodeHeader encodes a string for use in email headers (RFC 2047)
func mimeEncodeHeader(s string) string {
	// Check if encoding is needed
	needsEncoding := false
	for _, c := range s {
		if c > 126 || c < 32 {
			needsEncoding = true
			break
		}
	}
	if !needsEncoding {
		return s
	}
	encoded := base64.StdEncoding.EncodeToString([]byte(s))
	return fmt.Sprintf("=?UTF-8?B?%s?=", encoded)
}

// base64Wrap encodes data as base64 with 76-char line wrapping
func base64Wrap(data []byte) string {
	encoded := base64.StdEncoding.EncodeToString(data)
	var buf strings.Builder
	for i := 0; i < len(encoded); i += 76 {
		end := i + 76
		if end > len(encoded) {
			end = len(encoded)
		}
		buf.WriteString(encoded[i:end])
		buf.WriteString("\r\n")
	}
	return buf.String()
}

// Base64URLEncode encodes bytes to base64url without padding
func Base64URLEncode(data []byte) string {
	s := base64.StdEncoding.EncodeToString(data)
	s = strings.ReplaceAll(s, "+", "-")
	s = strings.ReplaceAll(s, "/", "_")
	s = strings.TrimRight(s, "=")
	return s
}
