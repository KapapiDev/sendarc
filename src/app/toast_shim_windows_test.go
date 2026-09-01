//go:build windows

package main

import (
	"encoding/xml"
	"strings"
	"testing"

	toast "git.sr.ht/~jackmordaunt/go-toast/v2"
)

func TestBuildToastXMLEscapesActionsAndPreservesCDATA(t *testing.T) {
	n := toast.Notification{
		Title:               "To: A ]]> B & C",
		Body:                "Body ]]> & < remains text",
		Icon:                `C:\A&B\"icon\".png`,
		ActivationType:      toast.Foreground,
		ActivationArguments: "action=open&emailId=abc",
		Audio:               "ms-winsoundevent:Notification.Mail&test=1",
		Actions: []toast.Action{{
			Type:      toast.Foreground,
			Content:   "Review & confirm",
			Arguments: "action=review&emailId=abc",
		}},
	}

	xmlText, err := buildToastXML(n)
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(xmlText, `launch="action=open&emailId=abc"`) {
		t.Fatal("activation arguments were interpolated without XML escaping")
	}
	if !strings.Contains(xmlText, `launch="action=open&amp;emailId=abc"`) {
		t.Fatalf("escaped activation arguments missing from XML: %s", xmlText)
	}
	if !strings.Contains(xmlText, `content="Review &amp; confirm"`) {
		t.Fatalf("escaped action content missing from XML: %s", xmlText)
	}
	if !strings.Contains(xmlText, `src="ms-winsoundevent:Notification.Mail&amp;test=1"`) {
		t.Fatalf("escaped audio source missing from XML: %s", xmlText)
	}

	var parsed struct {
		Launch string `xml:"launch,attr"`
		Visual struct {
			Binding struct {
				Text []string `xml:"text"`
			} `xml:"binding"`
		} `xml:"visual"`
		Actions struct {
			Action []struct {
				Content   string `xml:"content,attr"`
				Arguments string `xml:"arguments,attr"`
			} `xml:"action"`
		} `xml:"actions"`
	}
	if err := xml.Unmarshal([]byte(xmlText), &parsed); err != nil {
		t.Fatalf("toast XML is not well formed: %v\n%s", err, xmlText)
	}
	if parsed.Launch != n.ActivationArguments {
		t.Fatalf("launch round trip = %q, want %q", parsed.Launch, n.ActivationArguments)
	}
	if len(parsed.Visual.Binding.Text) != 2 || parsed.Visual.Binding.Text[0] != n.Title || parsed.Visual.Binding.Text[1] != n.Body {
		t.Fatalf("CDATA text did not round trip: %#v", parsed.Visual.Binding.Text)
	}
	if len(parsed.Actions.Action) != 1 || parsed.Actions.Action[0].Content != n.Actions[0].Content || parsed.Actions.Action[0].Arguments != n.Actions[0].Arguments {
		t.Fatalf("action attributes did not round trip: %#v", parsed.Actions.Action)
	}
}
