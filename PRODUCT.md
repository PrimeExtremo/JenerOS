# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary: the owner/tinkerer, the person who installed JenerOS on an old PC, mini PC, Pi or VM. They open the dashboard to manage apps, disks, updates, VMs and (later) the router. Their household uses the apps (Photos, TV, Drive, Home) through those apps' own clients and rarely opens the dashboard.

## Product Purpose

JenerOS is an installable OS that replaces a pile of self-hosted apps (Immich, Nextcloud, Home Assistant, Jellyfin, Pi-hole/AdGuard, Proxmox, TrueNAS, router software) with one system: one install, one login, one storage pool, one dashboard, one app store. Success: the owner retires their other self-hosting tools and the household's photos, files and movies live on the box at home.

## Positioning

Your stuff lives at home. A first-time visitor should understand within seconds that their photos, files and movies sit on their own machine, not in someone else's cloud. Mechanism: image-based Debian with A/B updates and automatic rollback, apps run by Incus (no Docker to manage), data disks that any other Linux can read without wiping.

## Operating Context

- Opened in a desktop browser on the home network, on a phone, and on a TV browser.
- Runs on spare hardware; the owner reaches it at `http://<ip>` and over SSH.
- Fire TV / Android TV get a client app later; they cannot run the OS.

## Capabilities and Constraints

Built and verified (2026-10-07): boots in VMware; dashboard served by `jenerd` (Go) with real system data; store catalog of 5 apps (installing apps not built yet, Phase 2); one-click OS updates with automatic rollback; read-only `/usr`.

Not built yet: app installs, storage pools, VMs, owner account/login (M3), router mode, client apps. The dashboard must show these honestly as "coming soon", never as working.

Terminology: Photos, Drive, Home, TV, Relay (store app names); Machines (VMs/containers); Storage (pools, shares).

## Brand Commitments

- Name: JenerOS, by Jener, Inc. Site: jener.dev. Never use the retired "Arvey" name or AV logo.
- Jener's binding direction (2026-10-07): monochrome black and white; fun, cute, something kids would want and the public instantly gets; in the family of arvey.co and samdanpc.com (both Jener's own sites); keep the current dashboard layout, make it functional.
- Logo: J monogram + wordmark in `[BRAND]/logo/` (drafted by Codex, Jener will refine).
- Voice: friendly, plain words, no jargon on the dashboard (from samdanpc.com's "no confusing tech talk").

## Evidence on Hand

None yet: no users, testimonials, benchmarks or press. Do not invent any.

## Product Principles

1. Your data stays yours: at home, readable by any Linux, never locked in.
2. One of everything: one login, one pool, one dashboard, one update button.
3. Honest status: show what works, say plainly what's coming.
4. Safe by default: updates roll back by themselves; nothing privileged runs from the browser.

## Accessibility & Inclusion

- Big text and touch targets: usable by kids and grandparents, on a phone or with a TV remote.
- Readable on a TV from the couch; remote/keyboard-friendly navigation.
- Standard web accessibility: WCAG AA contrast, full keyboard use, visible focus.
