Work in the GitHub repo PrimeExtremo/JenerOS. Branch from `zimaos-style` (it has the newest brand files, wallpapers and privacy PDF) into a new branch `cloud/site`, and open a pull request into `zimaos-style` when done. Build the public website for jener.dev in a new top-level folder `[SITE]/` (square brackets are part of the folder name; URL-encode them in Markdown links).

Read first: README.md, PRODUCT.md, [BRAND]/README.md, [BRAND]/logo/README.md, [DOCS]/PRIVACY.md, [DOCS]/RELEASING.md, handoff.md. For the current product look see [DASHBOARD]/desktop.css, setup.html, wallpaper-ribbon.svg, and [BRAND]/wallpapers/.

What JenerOS is: a free, open-source (GPL-3.0) home server OS by Jener, Inc. It turns an old PC into your own little cloud (photos, files, movies, smart home, ad blocking) with one friendly dashboard, its own app store, one-click updates that roll back by themselves if a new version fails to start, and setup from your phone with a QR code. Mission: keep old PCs out of e-waste. Promise: "Your stuff lives at home." Status: early preview.

Site pages (plain HTML + CSS, a little vanilla JS only if needed; no frameworks, no build step, no trackers, no cookies, no external CDNs; self-host fonts):
1. Home: hero with the JENEROS wordmark and the warm brown ribbon wallpaper look, the promise, two buttons (Download, See it on GitHub); a short "what it does" grid; "Give an old PC a second life" section; how setup works in 3 steps (flash, boot, scan the QR); safe updates explained simply; screenshots area with tasteful placeholders labeled "Screenshot coming soon" (do not invent screenshots); FAQ (Is it free? What hardware? Is my data private? Can I go back if an update breaks?).
2. Download: points to https://github.com/PrimeExtremo/JenerOS/releases (no release exists yet, so say "First preview release coming soon" and link the repo); hardware needs (x86-64 PC with UEFI, Secure Boot off, a spare disk); how to flash the .img.xz with balenaEtcher; VMware/VM option. No invented version numbers or sizes.
3. Privacy: the policy from [DOCS]/PRIVACY.md as a readable page, plus a link to the PDF at [DASHBOARD]/privacy.pdf (copy it into the site).
4. About: Jener, Inc., why JenerOS exists (e-waste, privacy, simplicity), open source, contact privacy@jener.dev.
Shared header (J logo + JenerOS, nav), footer (GitHub, license GPL-3.0, privacy, (c) Jener, Inc.), and a 404 page.

Design: Apple-clean and premium, fun and friendly for families and kids, but not childish. Palette: cream #F6F1E7 / card #FFFCF6 in light, brown #1F1913 / card #2B241C in dark, Claude orange #D97757 for decoration and #B9562F for button fills (white text passes AA). Logo: use the SVGs in [BRAND]/logo/ (monochrome, never recolored orange). Headings: Bricolage Grotesque (copy [DASHBOARD]/fonts/ and its OFL license); body: the system font stack. Light and dark via prefers-color-scheme. One subtle motion moment at most (a slow shine on the hero ribbons), off under prefers-reduced-motion. Responsive from 360px phones to 3440px ultrawide. Accessible: semantic landmarks, skip link, alt text, visible focus rings, 4.5:1 contrast for text, 44px tap targets. Fast: under 300 KB per page excluding fonts, images as SVG or optimized WebP with width/height set.

Never use the retired name "Arvey" anywhere. Never mention, compare to or copy ZimaOS (text, icons, images or names). Write in plain, friendly words, short sentences, no hype, no em dashes.

Also add `[SITE]/README.md` explaining how to preview it locally (any static server) and how Jener can deploy it to Cloudflare Pages or Workers static assets for jener.dev (instructions only: do not create accounts, deploy, or touch DNS).

Checks before pushing: every internal link and asset path resolves; HTML validates (no unclosed tags); each page works with JavaScript off; Lighthouse-style basics (meta description, viewport, lang, title, favicon from the J mark, Open Graph tags with a 1200x630 SVG-rendered or PNG share image you create from the wallpaper and wordmark).

When done: append an entry to [DOCS]/AI-UPDATES.md (date, who = Claude cloud, files, what is untested). Commit with author "Jener <124105257+PrimeExtremo@users.noreply.github.com>" and trailer "Co-Authored-By: Claude <noreply@anthropic.com>", push, open the PR, and end its description with:
🤖 Generated with [Claude Code](https://claude.com/claude-code)
Do not touch main, do not commit secrets, do not deploy.
