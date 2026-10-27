package setup

import (
	"errors"
	"os"
	"strings"
	"testing"
)

func TestCodeRotationAndExpiry(t *testing.T) {
	p, req := applyFixture(t)
	if err := os.Remove(p.Request); err != nil {
		t.Fatal(err)
	}
	m, err := New(p)
	if err != nil {
		t.Fatal(err)
	}
	first, err := m.LocalCode()
	if err != nil {
		t.Fatal(err)
	}
	for n := 0; n < 10; n++ {
		req.Code = "invalid"
		if !errors.Is(m.Submit(req), ErrCode) {
			t.Fatal("bad code accepted")
		}
	}
	next, err := m.LocalCode()
	if err != nil || next == first || len(next) != 6 {
		t.Fatal("code was not rotated")
	}
	b, err := os.ReadFile(p.Code)
	if err != nil || strings.TrimSpace(string(b)) != next {
		t.Fatal("box screen did not receive current code")
	}
	req.Code = first
	if !errors.Is(m.Submit(req), ErrCode) {
		t.Fatal("old code accepted")
	}
	req.Code = next
	if err := m.Submit(req); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(p.Done, nil, 0o600); err != nil {
		t.Fatal(err)
	}
	if code, err := m.LocalCode(); err != nil || code != "" || !errors.Is(m.Submit(req), ErrDone) {
		t.Fatal("code survived setup completion")
	}
}
