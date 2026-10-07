# JenerOS

Your own iCloud, on your own hardware. One install turns an old PC, mini PC,
Raspberry Pi or VM into:

- **Photos** — phone backup, albums, face search
- **Drive** — files synced everywhere
- **Home** — smart home control
- **TV** — your movies on every TV (Fire TV app included)
- **Relay** — network-wide ad and tracker blocking
- **Machines** — virtual machines and containers
- **Storage** — disk pools, shares, snapshots, backups
- **Router** — optional, replaces your router's software
- **Store** — one-click self-hosted apps

One account, one storage pool, one dashboard. No Docker to manage.

## Start here

New to this repo (human or AI)? Read [handoff.md](handoff.md), then [AGENTS.md](AGENTS.md).

## Layout

| Path | What's in it |
|---|---|
| `handoff.md` | Current state, decisions, next steps |
| `AGENTS.md` / `CLAUDE.md` | Rules for AIs working here |
| `[DOCS]/` | [Architecture](%5BDOCS%5D/ARCHITECTURE.md), [OS plan](%5BDOCS%5D/OS-PLAN.md), [Phase 1 tasks](%5BDOCS%5D/PHASE-1.md), [Roadmap](%5BDOCS%5D/ROADMAP.md), [AI updates log](%5BDOCS%5D/AI-UPDATES.md) |
| `[SPEC]/` | [App manifest format](%5BSPEC%5D/app-manifest.md) |
| `[STORE]/apps/` | Store catalog, one folder per app |
| `[CORE]/` | `jenerd`, the core daemon (Go) |
| `[DASHBOARD]/` | Web dashboard |
| `[OS]/` | Bootable image build (mkosi) |
| `[BRAND]/` | Brand tokens and logo files |
| `[CLIENTS]/` | Future TV / phone apps |

## Run it (development)

The dashboard opens on its own with sample data: open `[DASHBOARD]/index.html`.

To run it against real data (Linux or the build VM, Go 1.22+):

```
cd "[CORE]"
go run ./cmd/jenerd
```

Then open http://localhost:8080.

To build the OS image (Debian build VM in VMware): `./[OS]/setup-build-vm.sh` once, then `./[OS]/build.sh`.
Details in [PHASE-1.md](%5BDOCS%5D/PHASE-1.md).
