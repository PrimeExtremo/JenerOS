// jenerd is the JenerOS core daemon. It serves the dashboard and the API that
// drives storage, apps, machines and networking.
package main

import (
	"flag"
	"log"
	"net/http"

	"github.com/PrimeExtremo/JenerOS/core/internal/api"
	"github.com/PrimeExtremo/JenerOS/core/internal/catalog"
	"github.com/PrimeExtremo/JenerOS/core/internal/runtime"
	"github.com/PrimeExtremo/JenerOS/core/internal/update"
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

	srv := api.New(cat, runtime.NewIncus(), update.DefaultPaths)
	mux := http.NewServeMux()
	srv.Register(mux)
	web := http.FileServer(http.Dir(*webDir))
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		// Image builds can give every version the same file times, so a cached
		// dashboard could outlive an OS update. The files are small; skip caching.
		w.Header().Set("Cache-Control", "no-store")
		web.ServeHTTP(w, r)
	})

	log.Printf("JenerOS listening on %s", *addr)
	log.Fatal(http.ListenAndServe(*addr, mux))
}
