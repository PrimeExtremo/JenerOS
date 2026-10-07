// Package runtime runs store apps. The only backend is Incus, which runs OCI
// images, system containers and VMs without a Docker daemon.
package runtime

import (
	"errors"

	"github.com/PrimeExtremo/JenerOS/core/internal/catalog"
)

var ErrNotImplemented = errors.New("not implemented yet")

type Status string

const (
	NotInstalled Status = "not-installed"
	Running      Status = "running"
	Stopped      Status = "stopped"
)

type Runtime interface {
	Install(m catalog.Manifest) error
	Remove(id string) error
	Status(id string) Status
}

// Incus drives the local Incus daemon. Phase 2 ([DOCS]/ROADMAP.md) fills this in:
// one Incus project per app, one OCI container per service.
type Incus struct{}

func NewIncus() *Incus { return &Incus{} }

func (*Incus) Install(catalog.Manifest) error { return ErrNotImplemented }
func (*Incus) Remove(string) error            { return ErrNotImplemented }
func (*Incus) Status(string) Status           { return NotInstalled }
