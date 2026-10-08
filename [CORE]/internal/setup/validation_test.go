package setup

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestOwnerValidation(t *testing.T) {
	_, valid := applyFixture(t)
	info := Info{Timezones: []string{"UTC"}, Keymaps: Keymaps}
	for _, name := range []string{"a", "jener", "jener_2", "home-owner", strings.Repeat("a", 32)} {
		req := valid
		req.Username = name
		if err := Validate(req, info); err != nil {
			t.Errorf("%q rejected: %v", name, err)
		}
	}
	for _, name := range append([]string{"", "_owner", "2owner", "Owner", "a.b", "a b", "a\n", strings.Repeat("a", 33)}, ReservedUsernames...) {
		req := valid
		req.Username = name
		if err := Validate(req, info); err == nil {
			t.Errorf("%q accepted", name)
		}
	}
	for _, password := range []string{"123456", "éééééé", strings.Repeat("a", 256)} {
		req := valid
		req.Password, req.PasswordConfirm = password, password
		if err := Validate(req, info); err != nil {
			t.Errorf("valid password rejected: %v", err)
		}
	}
	for _, password := range []string{"", "12345", "ééééé", strings.Repeat("a", 257), "password\n", "password\r", "password\x00", "password\xff"} {
		req := valid
		req.Password, req.PasswordConfirm = password, password
		if err := Validate(req, info); err == nil {
			t.Error("invalid password accepted")
		}
	}
	req := valid
	req.PasswordConfirm = "another-password"
	if err := Validate(req, info); err == nil {
		t.Error("mismatch accepted")
	}
	req = valid
	req.AcceptedPrivacy = false
	if err := Validate(req, info); err == nil {
		t.Error("missing consent accepted")
	}
}

func TestApplyPersistsPrivacyWithoutPasswords(t *testing.T) {
	p, req := applyFixture(t)
	if err := apply(p, func(string, string, ...string) error { return nil }, func(string) (bool, error) { return false, nil }); err != nil {
		t.Fatal(err)
	}
	b, err := os.ReadFile(filepath.Join(filepath.Dir(p.Done), "privacy.json"))
	if err != nil {
		t.Fatal(err)
	}
	var consent struct{ AcceptedAt, PolicyVersion, Language string }
	if err := json.Unmarshal(b, &consent); err != nil {
		t.Fatal(err)
	}
	if consent.AcceptedAt != req.PrivacyAcceptedAt || consent.PolicyVersion != PrivacyPolicyVersion || consent.Language != "en" || strings.Contains(string(b), req.Password) {
		t.Fatal("missing or unsafe persistent consent")
	}
}

func TestApplyRequiresStampedConsent(t *testing.T) {
	for _, field := range []string{"accepted", "time", "version"} {
		t.Run(field, func(t *testing.T) {
			p, req := applyFixture(t)
			switch field {
			case "accepted":
				req.AcceptedPrivacy = false
			case "time":
				req.PrivacyAcceptedAt = "invalid"
			case "version":
				req.PrivacyPolicyVersion = "old"
			}
			queueFixture(t, p, req)
			if err := apply(p, func(string, string, ...string) error { t.Fatal("ran a command before checking consent"); return nil }, func(string) (bool, error) { return false, nil }); err == nil {
				t.Fatal("invalid consent accepted")
			}
			if _, err := os.Stat(p.Done); !os.IsNotExist(err) {
				t.Fatal("invalid consent completed setup")
			}
		})
	}
}
