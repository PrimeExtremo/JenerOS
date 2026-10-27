// jenerd is the JenerOS core daemon. It serves the dashboard and the API that
// drives storage, apps, machines and networking.
package main

import (
	"flag"
	"fmt"
	"log"
	"net"
	"net/http"
	"os"
	"time"

	"github.com/PrimeExtremo/JenerOS/core/internal/access"
	"github.com/PrimeExtremo/JenerOS/core/internal/api"
	"github.com/PrimeExtremo/JenerOS/core/internal/auth"
	"github.com/PrimeExtremo/JenerOS/core/internal/catalog"
	"github.com/PrimeExtremo/JenerOS/core/internal/runtime"
	"github.com/PrimeExtremo/JenerOS/core/internal/setup"
	"github.com/PrimeExtremo/JenerOS/core/internal/storage"
	"github.com/PrimeExtremo/JenerOS/core/internal/transport"
	"github.com/PrimeExtremo/JenerOS/core/internal/update"
)

func main() {
	if len(os.Args) == 2 {
		var run func(runtime.Paths) error
		switch os.Args[1] {
		case "apps-prepare":
			run = runtime.Prepare
		case "apps-apply":
			run = runtime.Apply
		case "apps-init":
			run = runtime.Init
		case "apps-status":
			run = func(p runtime.Paths) error { return runtime.Refresh(p, false) }
		case "apps-restore":
			run = func(p runtime.Paths) error { return runtime.Refresh(p, true) }
		}
		if run != nil {
			if err := run(runtime.DefaultPaths); err != nil {
				log.Fatal(err)
			}
			return
		}
	}
	if len(os.Args) == 2 && os.Args[1] == "storage-create" {
		if err := storage.Apply(storage.DefaultPaths); err != nil {
			log.Fatal(err)
		}
		return
	}
	if len(os.Args) == 2 && os.Args[1] == "auth-helper" {
		if err := auth.ServeHelper(); err != nil {
			log.Fatal(err)
		}
		return
	}
	if len(os.Args) == 2 && os.Args[1] == "rollback-entry" {
		entry, err := update.OtherEntry(os.Stdin)
		if err != nil {
			log.Fatal(err)
		}
		fmt.Println(entry)
		return
	}
	if len(os.Args) > 1 && os.Args[1] == "setup-apply" {
		if len(os.Args) != 3 || os.Args[2] != setup.DefaultPaths.Request {
			log.Fatal("usage: jenerd setup-apply /run/jeneros/setup.request")
		}
		if err := setup.Apply(setup.DefaultPaths); err != nil {
			log.Fatal(err)
		}
		return
	}
	addr := flag.String("addr", ":8080", "listen address")
	tlsAddr := flag.String("tls-addr", "", "HTTPS listen address (installed image: :443)")
	tlsDir := flag.String("tls-dir", "/var/lib/jeneros-tls", "private TLS identity directory")
	storeDir := flag.String("store", "../[STORE]/apps", "app catalog directory")
	webDir := flag.String("web", "../[DASHBOARD]", "dashboard directory")
	setupEnabled := flag.Bool("setup", true, "enable first-boot setup (-setup=false skips setup; owner authentication is always required)")
	flag.Parse()

	cat, err := catalog.Load(*storeDir)
	if err != nil {
		log.Fatalf("load catalog: %v", err)
	}
	log.Printf("loaded %d apps from %s", len(cat.Apps()), *storeDir)

	rt := runtime.NewIncus()
	rt.Paths.Catalog = *storeDir
	srv := api.New(cat, rt, update.DefaultPaths)
	var identity *transport.Identity
	if *tlsAddr != "" {
		identity, err = transport.New(*tlsDir)
		if err != nil {
			log.Fatalf("initialize HTTPS: %v", err)
		}
		srv.Fingerprint = identity.Fingerprint
		go func() {
			for range time.NewTicker(30 * time.Second).C {
				if err := identity.Refresh(); err != nil {
					log.Printf("refresh HTTPS identity: %v", err)
				}
			}
		}()
	}
	mux := http.NewServeMux()
	sessions := auth.New()
	api.RegisterAuth(mux, sessions)
	srv.Register(mux)
	api.RegisterSSH(mux, access.DefaultPaths)
	api.RegisterStorage(mux, storage.DefaultPaths)
	var firstBoot *setup.Manager
	if *setupEnabled {
		firstBoot, err = setup.New(setup.DefaultPaths)
		if err != nil {
			log.Fatalf("initialize setup: %v", err)
		}
		api.RegisterSetup(mux, firstBoot)
		srv.SetupCode = firstBoot.LocalCode
	}
	web := http.FileServer(http.Dir(*webDir))
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		// Image builds can give every version the same file times, so a cached
		// dashboard could outlive an OS update. The files are small; skip caching.
		w.Header().Set("Cache-Control", "no-store")
		w.Header().Set("Referrer-Policy", "no-referrer")
		if firstBoot != nil && (r.URL.Path == "/" || r.URL.Path == "/index.html") {
			done, err := firstBoot.Done()
			if err != nil {
				http.Error(w, "Could not read setup state.", 500)
				return
			}
			if !done {
				http.Redirect(w, r, "/setup.html", http.StatusSeeOther)
				return
			}
		}
		_, signedIn := sessions.Owner(r)
		if !signedIn && (r.URL.Path == "/" || r.URL.Path == "/index.html") {
			http.Redirect(w, r, "/login", http.StatusSeeOther)
			return
		}
		if r.URL.Path == "/login" {
			r = r.Clone(r.Context())
			r.URL.Path = "/login.html"
		}
		web.ServeHTTP(w, r)
	})

	log.Printf("JenerOS listening on %s", *addr)
	handler := api.OwnerOnly(sessions, mux)
	if identity != nil {
		_, port, err := net.SplitHostPort(*tlsAddr)
		if err != nil {
			log.Fatal(err)
		}
		handler = transport.HTTPS(handler, port)
		tlsServer := &http.Server{Addr: *tlsAddr, Handler: transport.Headers(handler), TLSConfig: identity.Config(),
			ReadHeaderTimeout: 5 * time.Second, ReadTimeout: 15 * time.Second, WriteTimeout: 20 * time.Second, IdleTimeout: 60 * time.Second, MaxHeaderBytes: 32 << 10}
		go func() { log.Fatal(tlsServer.ListenAndServeTLS("", "")) }()
	}
	handler = transport.Headers(handler)
	server := &http.Server{Addr: *addr, Handler: handler, ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout: 15 * time.Second, WriteTimeout: 20 * time.Second, IdleTimeout: 60 * time.Second, MaxHeaderBytes: 32 << 10}
	log.Fatal(server.ListenAndServe())
}
