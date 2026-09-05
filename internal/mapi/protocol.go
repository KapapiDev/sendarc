package mapi

import (
	"fmt"
	netmail "net/mail"
	"strings"
	"time"
)

// MailMessage represents an intercepted email
type MailMessage struct {
	Version            int          `json:"version"`
	InterceptorVersion string       `json:"interceptorVersion,omitempty"`
	HostVersion        string       `json:"hostVersion,omitempty"`
	Timestamp          string       `json:"timestamp"`
	Subject            string       `json:"subject"`
	Body               string       `json:"body"`
	BodyFormat         string       `json:"bodyFormat"`
	Recipients         Recipients   `json:"recipients"`
	Attachments        []Attachment `json:"attachments"`
	OriginApp          string       `json:"originApp"`
}

// Recipients contains email recipients by type
type Recipients struct {
	To  []Recipient `json:"to"`
	CC  []Recipient `json:"cc"`
	BCC []Recipient `json:"bcc"`
}

// Recipient represents a single email recipient
type Recipient struct {
	Name    string `json:"name"`
	Address string `json:"address"`
}

// Attachment represents an email attachment
type Attachment struct {
	Filename string `json:"filename"`
	Path     string `json:"path"`
	Size     int64  `json:"size"`
}

// ValidateMailMessage validates required fields on a MailMessage.
// Returns an error describing the first missing or invalid field.
func ValidateMailMessage(mail *MailMessage) error {
	if mail == nil {
		return fmt.Errorf("message is nil")
	}
	if mail.Version == 0 {
		return fmt.Errorf("missing version")
	}
	if mail.Timestamp == "" {
		return fmt.Errorf("missing timestamp")
	}
	if _, err := time.Parse(time.RFC3339, mail.Timestamp); err != nil {
		return fmt.Errorf("invalid timestamp")
	}
	if mail.BodyFormat != "plain" && mail.BodyFormat != "html" {
		return fmt.Errorf("invalid bodyFormat: %s", mail.BodyFormat)
	}
	if containsHeaderBreak(mail.Subject) {
		return fmt.Errorf("subject contains a line break")
	}
	if len(mail.Recipients.To)+len(mail.Recipients.CC)+len(mail.Recipients.BCC) == 0 {
		return fmt.Errorf("missing recipient")
	}
	groups := []struct {
		label string
		items []Recipient
	}{
		{"to", mail.Recipients.To},
		{"cc", mail.Recipients.CC},
		{"bcc", mail.Recipients.BCC},
	}
	for _, group := range groups {
		for i, recipient := range group.items {
			if recipient.Address == "" {
				return fmt.Errorf("recipient %s[%d] missing address", group.label, i)
			}
			if containsHeaderBreak(recipient.Name) || containsHeaderBreak(recipient.Address) {
				return fmt.Errorf("recipient %s[%d] contains a line break", group.label, i)
			}
			parsed, err := netmail.ParseAddress(recipient.Address)
			if err != nil || !strings.EqualFold(parsed.Address, recipient.Address) {
				return fmt.Errorf("recipient %s[%d] has invalid address", group.label, i)
			}
		}
	}
	for i, attachment := range mail.Attachments {
		if attachment.Path == "" {
			return fmt.Errorf("attachment[%d] missing path", i)
		}
		if attachment.Filename == "" || attachment.Filename == "." || attachment.Filename == ".." {
			return fmt.Errorf("attachment[%d] has invalid filename", i)
		}
		if strings.ContainsAny(attachment.Filename, "/\\:\r\n") {
			return fmt.Errorf("attachment[%d] has unsafe filename", i)
		}
	}
	return nil
}

func containsHeaderBreak(value string) bool {
	return strings.ContainsAny(value, "\r\n")
}

// normalizeAddress strips common MAPI address prefixes (SMTP:, mailto:)
func normalizeAddress(addr string) string {
	prefixes := []string{"SMTP:", "smtp:", "MAILTO:", "mailto:"}
	for _, prefix := range prefixes {
		if strings.HasPrefix(addr, prefix) {
			return strings.TrimPrefix(addr, prefix)
		}
	}
	return addr
}

// normalizeRecipients applies address normalization to a slice of recipients
func normalizeRecipients(recipients []Recipient) {
	for i := range recipients {
		recipients[i].Address = normalizeAddress(recipients[i].Address)
	}
}
