# jener.dev website

The public website for JenerOS. Plain HTML and CSS: no framework, no build step, no trackers,
no cookies, nothing loaded from other websites. The only JavaScript is `assets/preview.js` on the
preview page, and `_headers` allows scripts on `/preview` only.

## What's here

| File | What it is |
|---|---|
| `index.html` | Home |
| `preview.html` | "A closer look": scroll-driven 3D tour of real screens on liquid glass |
| `download.html` | Download, hardware needs, flashing, virtual machines |
| `privacy.html` | Privacy policy (from `[DOCS]/PRIVACY.md`), links `privacy.pdf` |
| `about.html` | Jener, Inc., why JenerOS exists, contact |
| `404.html` | "Page not found" (uses `/` paths, since it can show at any address) |
| `assets/site.css` | All styles. Colors are tokens at the top, light and dark |
| `assets/preview.css`, `assets/preview.js` | The preview page only (glass, 3D story, still-grid fallback) |
| `assets/shots/` | Real dashboard screenshots as WebP, light and dark, 1x and 2x. `src/` holds the PNG originals (not published) |
| `assets/video/` | The preview as MP4: 1920x1080 and 1080x1920 (Shorts/Reels/TikTok), plus poster JPGs |
| `assets/fonts/` | Bricolage Grotesque Bold + its OFL license (copied from `[DASHBOARD]/fonts/`) |
| `assets/logo/` | J monogram and wordmark (copied from `[BRAND]/logo/`, unchanged) |
| `assets/ribbons-*.svg` | Ribbon art for page headers (from `[DASHBOARD]/wallpaper-ribbon.svg`) |
| `assets/og-image.svg` | Source of the 1200 x 630 share image |
| `og-image.png`, `favicon.*`, `apple-touch-icon.png` | Share image and icons |
| `_headers` | Security headers (Cloudflare reads this; not served) |
| `wrangler.jsonc`, `.assetsignore` | Cloudflare Workers config; these are not published |

The header and footer are copied into every page. If you change one, change all six.

## Preview on your PC

Any static server works. From the repo root:

```bash
cd "[SITE]"
python -m http.server 8080      # or: npx http-server -p 8080
```

Then open http://localhost:8080. Light and dark follow your system setting.

Tip: open pages as `http://`, not by double-clicking the file. The 404 page and some icons need a server.

## Deploy to jener.dev with Cloudflare Workers

The site is a Worker with **static assets only** (no Worker code). Settings are in `wrangler.jsonc`:
worker name `jener-dev`, the 404 page for unknown addresses, and clean URLs (`/download` serves
`download.html`).

You run these steps yourself. Nothing has been deployed.

1. Install Node.js 20 or newer, if you don't have it.
2. Log in once: `npx wrangler login` (opens the browser, pick your Cloudflare account).
3. First deploy, to a test address:

   ```bash
   cd "[SITE]"
   npx wrangler deploy
   ```

   Wrangler prints a `https://jener-dev.<your-subdomain>.workers.dev` link. Check every page there.
4. Go live on jener.dev: in `wrangler.jsonc`, remove the `//` in front of the `routes` lines
   (keep the comma before `"routes"`), then run `npx wrangler deploy` again.
   Because jener.dev is already on your Cloudflare account, Wrangler adds the domain and its DNS
   record by itself. Do this only when you're ready for the site to be public.
   (Dashboard way instead: Workers & Pages, `jener-dev`, Settings, Domains & Routes, Add, Custom domain.)
5. Updates later: change files, run `npx wrangler deploy` again.

Optional: connect the GitHub repo in the Cloudflare dashboard (Workers & Pages, `jener-dev`,
Settings, Builds) with root directory `[SITE]` and deploy command `npx wrangler deploy`, so every
push to the chosen branch publishes the site.

## Before going live

- Create the `privacy@jener.dev` mailbox (Cloudflare Email Routing can forward it), or change the address.
- When the first release is out, update the "coming soon" box on `download.html` and the home page.
- If `[DOCS]/PRIVACY.md` changes, update `privacy.html` and `privacy.pdf` too.

## Remake the share image

`og-image.png` is `assets/og-image.svg` rendered at 1200 x 630. Open the SVG in Chromium or Edge
from a local server, take a 1200 x 630 screenshot, and save it as `og-image.png`
(keep it under about 150 KB).

## The preview page, screenshots and videos

`preview.html` is a cinematic tour: a booting box, assembled brand lettering, icon close-ups,
a growing CPU widget, phone connection, Settings flip, disk bays, rollback and App Store, then
a closing screen stack. Short word cards separate the shots. The warm cinema background stays
dark; real screens and small glass pieces follow the system's light/dark preference.

Scroll normally through nine sticky stages. **Still view** stops motion. Reduced motion,
forced colors or JavaScript off use the same real captions and screens in a still grid.
The only blur/refraction is on small chips and far macro icons, never on screen-sized layers.
One requestAnimationFrame loop handles scroll progress, idle drift and pointer light; an
IntersectionObserver stops offscreen work. The thin progress line uses a native CSS scroll
timeline when supported, with a JS fallback. No libraries or external requests.

For a clock-driven trailer, open:

```text
/preview.html?trailer=1&beats=assets/video/beats.json
```

The supplied grid is **96 BPM, offset 0.5 seconds, 43 seconds total**. The page is silent;
the quiet `assets/video/test-click.wav` is only a timing aid for the recorder. No music is licensed
or included. `sfx-cues.json` lists sound-effect times and types. A cleared track can replace the
test clicks after beat analysis. See `.scratch/marketing/README.md` for exact commands.

**Video status (2026-10-08):** the MP4s and posters are still the earlier 30 fps tour. ffmpeg was
not available locally, so they were preserved. Links say "Earlier preview" until both new cuts
are generated. The new recorder exports both sizes at 60 fps, enforces under 15 MB per file,
normalizes audio toward -14 LUFS and adds 0.5/1.5 second fades. It needs installed Chrome/Edge,
Node 22+ and ffmpeg; no Playwright dependency for recording.

To refresh screenshots (the existing capture tool still needs Playwright and Python/Pillow):

```bash
node .scratch/marketing/capture-shots.cjs     # PNGs into [SITE]/assets/shots/src/
python3 .scratch/marketing/make-webp.py       # WebP 1x and 2x into [SITE]/assets/shots/
node .scratch/marketing/record-video.cjs      # after ffmpeg is available; both 60 fps cuts
```

More detail: `.scratch/marketing/README.md`.
