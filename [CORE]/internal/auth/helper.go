package auth

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net"
	"os"
	"os/exec"
	"strconv"
	"strings"
	"time"

	"github.com/PrimeExtremo/JenerOS/core/internal/setup"
)

type checkPassword func(context.Context, string, string) error

// checkSystem uses Debian's existing shadow verifier without a PAM conversation
// or cgo. Its fixed nonull option rejects blank/locked hashes and supports the
// system's crypt formats (including yescrypt). The NUL-terminated password goes
// only through stdin. chkexpiry also refuses expired accounts/passwords.
func checkSystem(ctx context.Context, username, password string) error {
	for _, option := range []string{"nonull", "chkexpiry"} {
		cmd := exec.CommandContext(ctx, "/usr/sbin/unix_chkpwd", username, option)
		cmd.Env = []string{"PATH=/usr/sbin:/usr/bin"}
		if option == "nonull" {
			cmd.Stdin = strings.NewReader(password + "\x00")
		}
		if err := cmd.Run(); err != nil {
			var exit *exec.ExitError
			if errors.As(err, &exit) {
				return ErrCredentials
			}
			return ErrUnavailable
		}
	}
	return nil
}

func verifyOwner(ctx context.Context, c Credentials, p setup.Paths, check checkPassword) error {
	if !Valid(c) {
		return ErrCredentials
	}
	if _, err := os.Stat(p.Done); err != nil {
		return ErrUnavailable
	}
	owner, err := os.ReadFile(p.Owner)
	if err != nil {
		return ErrUnavailable
	}
	if strings.TrimSpace(string(owner)) != c.Username {
		return ErrCredentials
	}
	return check(ctx, c.Username, c.Password)
}

// ServeHelper is a fixed-purpose root service using systemd's inherited socket.
// Socket ownership is assigned to the running DynamicUser by systemd, outside
// jenerd's writable directory. Requests and replies are bounded and never logged.
func ServeHelper() error {
	if os.Geteuid() != 0 || os.Getenv("LISTEN_PID") != strconv.Itoa(os.Getpid()) || os.Getenv("LISTEN_FDS") != "1" {
		return errors.New("auth-helper requires root and one systemd socket")
	}
	f := os.NewFile(3, "auth-socket")
	listener, err := net.FileListener(f)
	f.Close()
	if err != nil {
		return err
	}
	defer listener.Close()
	limit := Limiter{Max: 30, Window: time.Minute}
	for {
		conn, err := listener.Accept()
		if err != nil {
			return err
		}
		// Sequential checking bounds crypt CPU/memory and in-flight passwords.
		handleHelper(conn, setup.DefaultPaths, checkSystem, &limit)
	}
}

func handleHelper(conn net.Conn, p setup.Paths, check checkPassword, limit *Limiter) {
	defer conn.Close()
	if err := conn.SetDeadline(time.Now().Add(10 * time.Second)); err != nil {
		return
	}
	var c Credentials
	decoder := json.NewDecoder(io.LimitReader(conn, 2048))
	decoder.DisallowUnknownFields()
	err := decoder.Decode(&c)
	if err == nil && limit.Allow("owner", time.Now()) {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		err = verifyOwner(ctx, c, p, check)
		cancel()
	} else {
		err = ErrCredentials
	}
	c.Password = ""
	// No hash or system-account detail leaves this process.
	_ = json.NewEncoder(conn).Encode(struct {
		OK          bool `json:"ok"`
		Unavailable bool `json:"unavailable"`
	}{err == nil, errors.Is(err, ErrUnavailable)})
}
