// Package transport manages the box's private, self-signed LAN identity.
package transport

import (
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/sha256"
	"crypto/tls"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/hex"
	"encoding/pem"
	"errors"
	"math/big"
	"net"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"time"
)

type Identity struct {
	mu   sync.RWMutex
	path string
	cert *tls.Certificate
}

// New uses systemd's mode-0700 private StateDirectory in the installed image.
// One atomic PEM bundle prevents a crash from pairing the wrong key and cert.
func New(dir string) (*Identity, error) {
	if err := os.MkdirAll(dir, 0o700); err != nil {
		return nil, err
	}
	if err := os.Chmod(dir, 0o700); err != nil {
		return nil, err
	}
	i := &Identity{path: filepath.Join(dir, "identity.pem")}
	if b, err := os.ReadFile(i.path); err == nil {
		c, err := tls.X509KeyPair(b, b)
		if err != nil {
			return nil, err
		}
		c.Leaf, err = x509.ParseCertificate(c.Certificate[0])
		if err != nil {
			return nil, err
		}
		if err := os.Chmod(i.path, 0o600); err != nil {
			return nil, err
		}
		i.cert = &c
	} else if !errors.Is(err, os.ErrNotExist) {
		return nil, err
	}
	if err := i.Refresh(); err != nil {
		return nil, err
	}
	return i, nil
}

func lanIdentity() (string, []net.IP, error) {
	host, err := os.Hostname()
	if err != nil {
		return "", nil, err
	}
	host = strings.TrimSuffix(strings.ToLower(host), ".local")
	ifs, err := net.Interfaces()
	if err != nil {
		return "", nil, err
	}
	var ips []net.IP
	for _, iface := range ifs {
		if iface.Flags&net.FlagUp == 0 || iface.Flags&net.FlagLoopback != 0 {
			continue
		}
		virtual := false
		for _, prefix := range []string{"docker", "br-", "ja-", "veth", "virbr", "incus", "lxc", "lxd", "cni", "flannel", "podman"} {
			if strings.HasPrefix(iface.Name, prefix) {
				virtual = true
			}
		}
		if virtual {
			continue
		}
		addrs, err := iface.Addrs()
		if err != nil {
			return "", nil, err
		}
		for _, addr := range addrs {
			ip, _, err := net.ParseCIDR(addr.String())
			if err == nil && ip.IsGlobalUnicast() && !ip.IsLoopback() {
				ips = append(ips, ip)
			}
		}
	}
	sort.Slice(ips, func(a, b int) bool { return ips[a].String() < ips[b].String() })
	return host, ips, nil
}

func (i *Identity) Refresh() error {
	host, ips, err := lanIdentity()
	if err != nil {
		return err
	}
	return i.refresh(host, ips, time.Now())
}

func (i *Identity) refresh(host string, ips []net.IP, now time.Time) error {
	i.mu.Lock()
	defer i.mu.Unlock()
	if i.cert != nil {
		c := i.cert.Leaf
		match := c.Subject.CommonName == host && len(c.DNSNames) == 2 && c.DNSNames[0] == host && c.DNSNames[1] == host+".local" && len(c.IPAddresses) == len(ips)
		for n, ip := range ips {
			if n >= len(c.IPAddresses) || !ip.Equal(c.IPAddresses[n]) {
				match = false
			}
		}
		if match && now.After(c.NotBefore) && now.Add(30*24*time.Hour).Before(c.NotAfter) {
			return nil
		}
	}
	key, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		return err
	}
	serial, err := rand.Int(rand.Reader, new(big.Int).Lsh(big.NewInt(1), 128))
	if err != nil {
		return err
	}
	template := &x509.Certificate{SerialNumber: serial, Subject: pkix.Name{CommonName: host},
		DNSNames: []string{host, host + ".local"}, IPAddresses: ips,
		NotBefore: now.Add(-24*time.Hour), NotAfter: now.Add(365*24*time.Hour),
		KeyUsage: x509.KeyUsageDigitalSignature, ExtKeyUsage: []x509.ExtKeyUsage{x509.ExtKeyUsageServerAuth}, BasicConstraintsValid: true}
	der, err := x509.CreateCertificate(rand.Reader, template, template, &key.PublicKey, key)
	if err != nil {
		return err
	}
	private, err := x509.MarshalPKCS8PrivateKey(key)
	if err != nil {
		return err
	}
	bundle := append(pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: der}), pem.EncodeToMemory(&pem.Block{Type: "PRIVATE KEY", Bytes: private})...)
	c, err := tls.X509KeyPair(bundle, bundle)
	if err != nil {
		return err
	}
	c.Leaf, err = x509.ParseCertificate(der)
	if err != nil {
		return err
	}
	f, err := os.CreateTemp(filepath.Dir(i.path), ".identity-*")
	if err != nil {
		return err
	}
	defer os.Remove(f.Name())
	if _, err := f.Write(bundle); err != nil {
		f.Close()
		return err
	}
	if err := f.Sync(); err != nil {
		f.Close()
		return err
	}
	if err := f.Close(); err != nil {
		return err
	}
	if err := os.Rename(f.Name(), i.path); err != nil {
		return err
	}
	i.cert = &c
	return nil
}

func (i *Identity) Fingerprint() string {
	i.mu.RLock()
	defer i.mu.RUnlock()
	sum := sha256.Sum256(i.cert.Certificate[0])
	return strings.ToUpper(hex.EncodeToString(sum[:]))
}

func (i *Identity) Config() *tls.Config {
	return &tls.Config{MinVersion: tls.VersionTLS12,
		CipherSuites: []uint16{tls.TLS_ECDHE_ECDSA_WITH_AES_128_GCM_SHA256, tls.TLS_ECDHE_ECDSA_WITH_AES_256_GCM_SHA384, tls.TLS_ECDHE_ECDSA_WITH_CHACHA20_POLY1305_SHA256},
		GetCertificate: func(*tls.ClientHelloInfo) (*tls.Certificate, error) {
			i.mu.RLock()
			defer i.mu.RUnlock()
			return i.cert, nil
		}}
}
