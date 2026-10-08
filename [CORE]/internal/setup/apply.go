package setup

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io/fs"
	"os"
	"os/exec"
	"os/user"
	"path/filepath"
	"strings"
	"time"
)

type command func(name, stdin string, args ...string) error

// Apply is only invoked by the root systemd service, never by an HTTP handler.
func Apply(p Paths) error {
	if os.Geteuid() != 0 {
		return errors.New("setup-apply needs to run as root")
	}
	return apply(p, runCommand, func(name string) (bool, error) {
		_, err := user.Lookup(name)
		if _, ok := err.(user.UnknownUserError); ok {
			return false, nil
		}
		return err == nil, err
	})
}

func runCommand(name, stdin string, args ...string) error {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	cmd := exec.CommandContext(ctx, name, args...)
	cmd.Stdin = strings.NewReader(stdin)
	// No subprocess output is captured or logged: chpasswd input is private.
	if err := cmd.Run(); err != nil {
		return fmt.Errorf("%s could not finish. Please try setup again.", name)
	}
	return nil
}

func apply(p Paths, run command, accountExists func(string) (bool, error)) (err error) {
	// Delete the password request on success AND failure, avoiding path-unit loops.
	// A fresh POST can retry a partial apply, but cannot claim an existing user.
	defer func() {
		if removeErr := os.Remove(p.Request); removeErr != nil && !errors.Is(removeErr, fs.ErrNotExist) {
			err = errors.Join(err, errors.New("Could not clear the setup request."))
		}
		if err != nil {
			if statusErr := writeStatus(p, Status{State: "failed", Message: err.Error()}); statusErr != nil {
				err = errors.Join(err, statusErr)
			}
		}
	}()
	done, err := exists(p.Done)
	if err != nil {
		return errors.New("Could not read the setup state.")
	}
	if done {
		return nil
	}
	if err := writeStatus(p, Status{State: "applying", Message: "Setting up your box. Please keep it switched on."}); err != nil {
		return err
	}
	f, err := os.Open(p.Request)
	if err != nil {
		return errors.New("Could not read the setup request.")
	}
	req, err := Decode(f)
	f.Close()
	if err != nil {
		return err
	}
	info, err := ReadInfo(p)
	if err != nil {
		return errors.New("Could not read your box's setup choices.")
	}
	if err := Validate(req, info); err != nil {
		return err
	}
	if req.PrivacyPolicyVersion != PrivacyPolicyVersion {
		return errors.New("Please review the current Privacy Policy and try setup again.")
	}
	if _, err := time.Parse(time.RFC3339Nano, req.PrivacyAcceptedAt); err != nil {
		return errors.New("Could not read the privacy acceptance time. Please try setup again.")
	}
	used, err := accountExists(req.Username)
	if err != nil {
		return errors.New("Could not check the owner account.")
	}
	pending, err := os.ReadFile(p.PendingOwner)
	if err != nil && !errors.Is(err, fs.ErrNotExist) {
		return errors.New("Could not read the pending owner.")
	}
	if len(pending) > 0 && strings.TrimSpace(string(pending)) != req.Username {
		return errors.New("A previous setup started an owner account. Use that same username to finish.")
	}
	if used && strings.TrimSpace(string(pending)) != req.Username {
		return errors.New("That username is already in use. Choose another one.")
	}

	keymapErr := run("localectl", "", "--no-convert", "set-keymap", req.Keymap)
	// Cage reads this small environment file on startup. Keep XKB and console
	// names separate: UK is uk in console-data and gb in xkeyboard-config.
	layout, variant := req.Keymap, ""
	switch req.Keymap {
	case "uk":
		layout = "gb"
	case "pt-latin1":
		layout = "pt"
	case "br-abnt2":
		layout = "br"
	case "dvorak":
		layout, variant = "us", "dvorak"
	}
	if err := atomicWrite(filepath.Join(filepath.Dir(p.Done), "kiosk-keyboard"), []byte("XKB_DEFAULT_LAYOUT="+layout+"\nXKB_DEFAULT_VARIANT="+variant+"\n"), 0o644); err != nil {
		return errors.New("Could not save the screen's keyboard layout.")
	}
	// Debian configures its console through keyboard-configuration instead of
	// vconsole alone. Save its boot cache without disturbing the active compositor.
	keyboard := "XKBMODEL=pc105\nXKBLAYOUT=" + layout + "\nXKBVARIANT=" + variant + "\nXKBOPTIONS=\nBACKSPACE=guess\n"
	if err := atomicWrite(p.Keyboard, []byte(keyboard), 0o644); err != nil {
		return errors.New("Could not save the keyboard layout.")
	}
	if err := run("setupcon", "", "--save-only", "--keyboard-only"); err != nil {
		return err
	}
	if keymapErr != nil {
		// Some Debian builds reject localectl keymap changes. The equivalent kbd
		// operation is safe here: every selectable console map is bundled.
		if err := run("loadkeys", "", req.Keymap); err != nil {
			return err
		}
	}
	if err := run("timedatectl", "", "set-timezone", req.Timezone); err != nil {
		return err
	}
	if err := run("hostnamectl", "", "set-hostname", req.Hostname); err != nil {
		return err
	}
	if !used {
		if err := atomicWrite(p.PendingOwner, []byte(req.Username+"\n"), 0o600); err != nil {
			return errors.New("Could not save the pending owner.")
		}
		if err := run("useradd", "", "-m", "-s", "/bin/bash", "-G", "sudo", req.Username); err != nil {
			return err
		}
	}
	if err := run("chpasswd", req.Username+":"+req.Password+"\n"); err != nil {
		return err
	}
	if err := atomicWrite(p.Owner, []byte(req.Username+"\n"), 0o600); err != nil {
		return errors.New("Could not save the owner account.")
	}
	if req.Network.Mode == "fixed" {
		n := req.Network
		config := "# Written by JenerOS setup\n[Match]\nName=" + n.Interface + "\n\n[Network]\nDHCP=no\nAddress=" + n.Address + "\nGateway=" + n.Gateway + "\n"
		for _, dns := range n.DNS {
			config += "DNS=" + dns + "\n"
		}
		if err := atomicWrite(p.Network, []byte(config), 0o644); err != nil {
			return errors.New("Could not save the fixed address.")
		}
		if err := run("networkctl", "", "reload"); err != nil {
			return err
		}
		if err := run("networkctl", "", "reconfigure", n.Interface); err != nil {
			return err
		}
	} else {
		// A failed fixed-address attempt may be retried with Automatic.
		fixed, err := exists(p.Network)
		if err != nil {
			return errors.New("Could not check the network settings.")
		}
		if fixed {
			previous, err := os.ReadFile(p.Network)
			if err != nil {
				return errors.New("Could not read the previous fixed address.")
			}
			connection := ""
			for _, line := range strings.Split(string(previous), "\n") {
				if name, ok := strings.CutPrefix(line, "Name="); ok && contains(info.Interfaces, name) {
					connection = name
				}
			}
			if err := os.Remove(p.Network); err != nil {
				return errors.New("Could not restore Automatic networking.")
			}
			if err := run("networkctl", "", "reload"); err != nil {
				return err
			}
			if connection != "" {
				if err := run("networkctl", "", "reconfigure", connection); err != nil {
					return err
				}
			}
		}
	}
	consent, err := json.Marshal(struct {
		AcceptedAt    string `json:"acceptedAt"`
		PolicyVersion string `json:"policyVersion"`
		Language      string `json:"language"`
	}{req.PrivacyAcceptedAt, req.PrivacyPolicyVersion, req.Language})
	if err != nil {
		return err
	}
	if err := atomicWrite(filepath.Join(filepath.Dir(p.Done), "privacy.json"), consent, 0o600); err != nil {
		return errors.New("Could not save privacy acceptance.")
	}
	if err := writeStatus(p, Status{State: "done", Message: "Your box is ready."}); err != nil {
		return err
	}
	// The marker is last. From this point every setup endpoint returns 403.
	if err := atomicWrite(p.Done, nil, 0o600); err != nil {
		return errors.New("Could not finish saving setup.")
	}
	if err := os.Remove(p.Code); err != nil && !errors.Is(err, fs.ErrNotExist) {
		return errors.New("Could not clear the setup code.")
	}
	if err := os.Remove(p.PendingOwner); err != nil && !errors.Is(err, fs.ErrNotExist) {
		return errors.New("Could not clear the pending owner.")
	}
	return nil
}

func writeStatus(p Paths, status Status) error {
	b, err := json.Marshal(status)
	if err != nil {
		return err
	}
	if err := atomicWrite(p.Status, b, 0o644); err != nil {
		return errors.New("Could not write setup progress.")
	}
	return nil
}
