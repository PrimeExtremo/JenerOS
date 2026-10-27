// Package runtime queues app work for a separate root worker. The dashboard
// never receives Incus socket access or generated application passwords.
package runtime

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"io"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"time"

	"github.com/PrimeExtremo/JenerOS/core/internal/catalog"
)

var ErrNotImplemented = errors.New("This app is coming soon.")
var ErrBusy = errors.New("An app change is already in progress. Please wait.")
var ErrUnavailable = errors.New("App management is not ready. Check the app service on your box.")
var ErrInvalid = errors.New("Invalid app request.")

// Not a valid storage pool name, so a real pool named "system" stays distinct.
const SystemPool = "@system"

type Status string

const (
	NotInstalled Status = "not-installed"
	Running      Status = "running"
	Stopped      Status = "stopped"
)

type Paths struct {
	Request, Public, Private, Catalog, SetupDone, Ready, Pools, Storage, Socket string
}

var DefaultPaths = Paths{
	Request: "/run/jeneros/apps.request", Public: "/run/jeneros-apps/status.json",
	Private: "/var/lib/jeneros/apps", Catalog: "/usr/share/jeneros/store/apps",
	SetupDone: "/var/lib/jeneros/setup-done", Ready: "/run/jeneros-apps/ready",
	Pools: "/var/lib/jeneros/pools", Storage: "/var/lib/jeneros/storage", Socket: "/var/lib/incus/unix.socket",
}

type Request struct {
	ID         string `json:"id"`
	App        string `json:"app"`
	Action     string `json:"action"`
	Pool       string `json:"pool,omitempty"`
	DeleteData bool   `json:"deleteData,omitempty"`
	Confirm    string `json:"confirm,omitempty"`
}

type Progress struct {
	ID      string `json:"id"`
	App     string `json:"app"`
	Action  string `json:"action"`
	Stage   string `json:"stage"`
	Percent int    `json:"percent"`
	Message string `json:"message"`
}

type App struct {
	ID       string   `json:"id"`
	State    Status   `json:"state"`
	Pool     string   `json:"pool"`
	Port     int      `json:"port"`
	URL      string   `json:"url,omitempty"`
	Uptime   float64  `json:"uptimeSec"`
	Memory   uint64   `json:"memoryBytes"`
	CPU      *float64 `json:"cpuPercent"`
	CPUTime  uint64   `json:"cpuTime"`
	Message  string   `json:"message,omitempty"`
	DataKept bool     `json:"dataKept,omitempty"`
}

type Snapshot struct {
	Available bool      `json:"available"`
	Updated   time.Time `json:"updated"`
	Sampled   time.Time `json:"sampled"`
	Apps      []App     `json:"apps"`
	Progress  Progress  `json:"progress"`
}

type Runtime interface {
	Status(string) Status
	Read() (Snapshot, error)
	Queue(Request) (Request, error)
}

type Incus struct{ Paths Paths }

func NewIncus() *Incus { return &Incus{Paths: DefaultPaths} }

func (rt *Incus) Status(id string) Status {
	s, err := rt.Read()
	if err != nil {
		return "unknown"
	}
	for _, a := range s.Apps {
		if a.ID == id {
			return a.State
		}
	}
	return NotInstalled
}

func (rt *Incus) Read() (Snapshot, error) {
	s := Snapshot{Apps: []App{}}
	b, err := os.ReadFile(rt.Paths.Public)
	if errors.Is(err, os.ErrNotExist) {
		return s, nil
	}
	if err != nil {
		return s, err
	}
	if err := json.Unmarshal(b, &s); err != nil {
		return s, err
	}
	_, ready := os.Stat(rt.Paths.Ready)
	_, setup := os.Stat(rt.Paths.SetupDone)
	s.Available = ready == nil && setup == nil
	if time.Since(s.Updated) > 45*time.Minute || time.Since(s.Updated) > 45*time.Second && !active(s.Progress.Stage) {
		s.Available = false
	}
	// A pull can take minutes while the worker owns the status lock. Progress
	// timestamps do not make the last CPU/memory sample current again.
	if !s.Available || s.Sampled.IsZero() || time.Since(s.Sampled) > 45*time.Second {
		for i := range s.Apps {
			if !s.Apps[i].DataKept {
				s.Apps[i].State, s.Apps[i].CPU = "unknown", nil
				s.Apps[i].URL = ""
			}
		}
	}
	if b, err := os.ReadFile(rt.Paths.Request); err == nil {
		var r Request
		if Decode(strings.NewReader(string(b)), &r) == nil && r.ID != s.Progress.ID {
			s.Progress = Progress{ID: r.ID, App: r.App, Action: r.Action, Stage: "queued", Message: "Waiting to begin."}
		}
	}
	return s, nil
}

func active(stage string) bool {
	return stage != "" && stage != "done" && stage != "failed"
}

var name = regexp.MustCompile(`^[a-z][a-z0-9-]{0,23}$`)
var poolName = regexp.MustCompile(`^[a-z][a-z0-9-]{0,31}$`)
var jobID = regexp.MustCompile(`^[a-f0-9]{32}$`)

func Decode(r io.Reader, v any) error {
	d := json.NewDecoder(io.LimitReader(r, 65537))
	d.DisallowUnknownFields()
	if err := d.Decode(v); err != nil {
		return ErrInvalid
	}
	if d.Decode(new(any)) != io.EOF {
		return ErrInvalid
	}
	return nil
}

func Validate(r Request) error {
	if !name.MatchString(r.App) || (r.ID != "" && !jobID.MatchString(r.ID)) || (r.Pool != "" && r.Pool != SystemPool && !poolName.MatchString(r.Pool)) {
		return ErrInvalid
	}
	switch r.Action {
	case "install":
	case "start", "stop", "uninstall":
		if r.Pool != "" {
			return ErrInvalid
		}
	default:
		return ErrInvalid
	}
	if r.DeleteData && (r.Action != "uninstall" || r.Confirm != r.App) || !r.DeleteData && r.Confirm != "" {
		return ErrInvalid
	}
	return nil
}

func (rt *Incus) Queue(r Request) (Request, error) {
	if r.ID != "" || Validate(r) != nil {
		return r, ErrInvalid
	}
	c, err := catalog.Load(rt.Paths.Catalog)
	if err != nil {
		return r, err
	}
	m, ok := c.Get(r.App)
	if !ok || !m.Available {
		return r, ErrNotImplemented
	}
	if err := catalog.ValidateRuntime(m); err != nil {
		return r, err
	}
	s, err := rt.Read()
	if err != nil {
		return r, err
	}
	if !s.Available {
		return r, ErrUnavailable
	}
	if active(s.Progress.Stage) {
		return r, ErrBusy
	}
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		return r, err
	}
	r.ID = hex.EncodeToString(b)
	f, err := os.CreateTemp(filepath.Dir(rt.Paths.Request), ".apps-*")
	if err != nil {
		return r, err
	}
	defer os.Remove(f.Name())
	err = json.NewEncoder(f).Encode(r)
	if e := f.Close(); err == nil {
		err = e
	}
	if err == nil {
		err = os.Link(f.Name(), rt.Paths.Request)
	}
	if errors.Is(err, os.ErrExist) {
		err = ErrBusy
	}
	return r, err
}
