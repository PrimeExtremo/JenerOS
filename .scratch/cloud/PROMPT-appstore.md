Work in the GitHub repo PrimeExtremo/JenerOS on the branch `zimaos-style` (not main). Create your own branch from it named `cloud/appstore` and open a pull request into `zimaos-style` when done.

Read first, in this order: AGENTS.md, handoff.md, the newest entries at the bottom of [DOCS]/AI-UPDATES.md, .scratch/zimaos/RESEARCH.md, .scratch/zimaos/STYLE-BRIEF.md.

Context: JenerOS is a cute, all-in-one home server OS (Debian 13, mkosi image, A/B updates). jenerd is a Go stdlib-only daemon in [CORE] that serves the plain HTML/CSS/JS dashboard in [DASHBOARD]. The owner loves ZimaOS's look, so the UI copies ZimaOS's layout and flow closely, but in the JenerOS palette (cream #F6F1E7 / card #FFFCF6 light, brown #1F1913 / card #2B241C dark, orange #D97757 decorative, #B9562F buttons), the angular J logo, Bricolage Grotesque display font, and our own friendly words. Never copy ZimaOS text, icons, images or names, and never use the retired name "Arvey".

Your task: phase 3 of STYLE-BRIEF.md, the App Store.
- An App Store window opened from the App Store tile, styled like the Settings window that already exists (desktop.css): sidebar with Search, My Apps, categories; a Discover page with a hero banner, "Popular" cards and a "New" list; an app page with icon, name, tagline, Install button with a progress ring, info chips (category, developer, min memory, disk use), screenshots area, what's new, about; a Custom install sheet with a Form/YAML toggle; My Apps as a table (status, port, uptime, memory, CPU, start/stop).
- Data comes from the existing catalog in [STORE]/apps/*/app.json through jenerd's /api/store. Extend the manifest only as needed (screenshots, developer, minMemoryMB, diskGB, whatsNew) and update the Go catalog code plus its tests. Installs are not implemented in the backend yet: show honest "coming soon" states for Install / start / stop instead of faking them.
- Keep it in NEW files where you can (e.g. [DASHBOARD]/store.js and store.css) and touch index.html/app.js only to open the window. Another agent (Codex) is editing the login screen, setup.html/setup.js and the jenerd auth code right now on the owner's PC, so do not touch those files.

Quality bar: accessible (labels on icon buttons, visible focus rings, keyboard navigation, prefers-reduced-motion, prefers-reduced-transparency), works at phone width with no horizontal scroll, light and dark both checked. Go: gofmt, go vet, go test must pass. No new dependencies, no CDNs, no frameworks.

When done: append an entry to [DOCS]/AI-UPDATES.md (date, who = Claude cloud, files, why, what is untested), commit with author "Jener <124105257+PrimeExtremo@users.noreply.github.com>" and a trailer line "Co-Authored-By: Claude <noreply@anthropic.com>", push, and open the PR. End the PR description with:
🤖 Generated with [Claude Code](https://claude.com/claude-code)
Do not build OS images, do not touch main, do not commit secrets or SSH keys.
