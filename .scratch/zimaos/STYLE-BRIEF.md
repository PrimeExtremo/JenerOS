# Make JenerOS look and work like ZimaOS, in the JenerOS palette

The user loves ZimaOS's style. Rebuild the JenerOS dashboard, setup and installer to be **very close to ZimaOS in layout, flow and feel**, but with the JenerOS palette and brand so it stays unique.

Reference screenshots (local only, git-ignored, never copy into the product): `.scratch/zimaos/shots/01..32`. Written notes: `.scratch/zimaos/RESEARCH.md`. Open the screenshots and match them closely.

## Keep from JenerOS (what makes it unique)
- Palette: light = cream paper `#F6F1E7`, cards `#FFFCF6`; dark = brown paper `#1F1913`, cards `#2B241C`. Accent Claude orange `#D97757` (decorative) / `#B9562F` (buttons, AA contrast). Where Zima uses its blue, we use our orange.
- Angular v1 J logo, monochrome. Bricolage font (self-hosted in [DASHBOARD]/fonts). Small corner J watermark.
- Friendly, kid-friendly copy in our own words. Never copy Zima's text, logo, icons, illustrations, wallpapers or names (no "Zima", "Network ID", "ZVM", "PeerDrop").
- Dark mode is the default look like Zima, with a warm brown abstract wallpaper (make our own with CSS/SVG gradients, swooshes in brown/orange). Light mode stays cream.

## Copy from ZimaOS (layout and behavior)
1. **Dashboard (shots 11, 26):** wallpaper background. Left column of widget cards: clock + date; System with CPU and RAM ring gauges (+ temp if available); Storage with "Healthy" badge and used/total bar; Network with a live up/down graph; "Widget settings". Right: search bar on top, a swipeable row of notice cards with dots (new disk found -> Manage, remote access tip, app install progress bar), then "Apps" title with "+" and a grid of big rounded app tiles with large icons. Top-left: account and settings icons. Glassy translucent cards.
2. **Settings window (shots 12, 18-21):** one rounded modal with a left sidebar (General, Storage, Network, Apps, Account avatar, power button at the bottom). General: device card (name, LAN IP, device info), version, wallpaper picker, language, timezone, time format, disk standby, UPS (later), developer mode/SSH toggle. (SSH toggle backend: jenerd writes /run/jeneros/ssh.request via the privilege-split path-unit pattern; root helper creates/removes /var/lib/jeneros/ssh-enabled and starts/stops ssh. Today there is no UI for it.) Network: connection rows. Apps: where app data lives + cleanup. Account: owner card with a cute avatar, change password, Members list (family accounts, later). No paid limits: JenerOS is free.
3. **Storage (shots 12-17):** "Bays" drawing of disk slots; pool usage bar; system disk row; a big "Create storage" card. Flow: choose Combine or Enable -> comparison table with friendly labels (Mirror "Safe", Parity "Balanced") and columns: spare disks, min disks, speed bars, usable %, can grow, best for -> pick disks with "Use recommended" and live usable vs protection bar -> summary + "I understand this erases these disks" checkbox -> progress with "Keep going in the background". Use Btrfs (raid1/raid10; raid5 marked "coming later" if not safe). Backend in jenerd via privilege-split root helper, like update.request.
4. **App Store (shots 22-25):** separate window with sidebar (Search, My Apps, categories: Media, Photos, Files, Home, Network, AI, Tools). Discover page: big hero banner, illustrated "Popular" cards, "New" list. App page: icon, name, tagline, Install button with progress ring, chips (category, developer, min memory, disk use), screenshots, what's new, about. Custom install: Form/YAML toggle. My Apps: table with status, port, uptime, memory, CPU, start/stop. Use the existing [STORE] manifest format, extend fields as needed (screenshots, minMemory, diskGB, developer).
5. **Files (shots 27-28) and Backup (31-32), VMs (29), Photos (30):** add as app tiles with honest "coming soon" panels styled the same, unless already built.
6. **Setup (shots 08-10):** wallpaper + one centered white/cream card, big two-line title ("Welcome to / JenerOS"), language select + privacy checkbox bottom-left, round orange next button bottom-right. Then "Create your account" card the same way with inline field errors. Then an "Introducing JenerOS" card with 4 feature tiles and buttons (Start with Files / Open App Store / Go to dashboard).
7. **Installer (shots 01-06):** follow exactly in the installer brief (.scratch/installer/BRIEF.md).
8. **Console screen (shot 07):** already assigned; match the layout closely.

## Rules
- Plain HTML/CSS/JS in [DASHBOARD], no frameworks, no CDNs. Go stdlib only in jenerd. Config in /usr, never /etc.
- Accessible: big touch targets, focus rings, keyboard/TV remote navigation still works, prefers-reduced-motion.
- Run the impeccable detector if available; keep files tidy. Do not build images, commit, or touch git history. Log in [DOCS]/AI-UPDATES.md. Go isn't installed on Windows; Claude runs vet/tests on the build VM.
- Work in this order and stop after each phase with a summary: (1) dashboard + settings window + wallpaper, (2) setup cards, (3) App Store, (4) Storage.

## Note from Claude (phase 2)
- The setup privacy link must open `privacy.pdf` (like ZimaOS, which links a PDF). The PDF is built from privacy.html by `[DOCS]/privacy-pdf/make.sh` on the build VM; keep privacy.html as the readable fallback.
