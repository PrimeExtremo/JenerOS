// jenerd is the JenerOS core daemon. It serves the dashboard and the API that
// drives storage, apps, machines and networking.
package main

import (
	"flag"
	"log"
	"net/http"

	"github.com/PrimeExtremo/jeneros/core/internal/api"
	"github.com/PrimeExtremo/jeneros/core/internal/catalog"
	"github.com/PrimeExtremo/jeneros/core/internal/runtime"
)

func main() {
	addr := flag.String("addr", ":8080", "listen address")
	storeDir := flag.String("store", "../[STORE]/apps", "app catalog directory")
	webDir := flag.String("web", "../[DASHBOARD]", "dashboard directory")
	flag.Parse()

	cat, err := catalog.Load(*storeDir)
	if err != nil {
		log.Fatalf("load catalog: %v", err)
	}
	log.Printf("loaded %d apps from %s", len(cat.Apps()), *storeDir)

	srv := api.New(cat, runtime.NewIncus())
	mux := http.NewServeMux()
	srv.Register(mux)
	mux.Handle("/", http.FileServer(http.Dir(*webDir)))

	log.Printf("JenerOS listening on %s", *addr)
	log.Fatal(http.ListenAndServe(*addr, mux))
}
