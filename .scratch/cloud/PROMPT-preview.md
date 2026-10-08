Work in the GitHub repo PrimeExtremo/JenerOS. Branch from `zimaos-style` into `cloud/preview` and open a pull request into `zimaos-style` when done.

Read first: AGENTS.md, [SITE]/README.md, [SITE]/index.html, [SITE]/assets/site.css, [SITE]/_headers, [BRAND]/README.md, .scratch/motion/BRIEF.md, and the dashboard in [DASHBOARD]/ (index.html, setup.html, login.html, desktop.css, store.css).

Goal: a cinematic, Apple-quality product preview for jener.dev in the style of macOS Tahoe "Liquid Glass": glassy, refractive, floating 3D, but in the JenerOS palette (cream #F6F1E7, brown #1F1913, orange #D97757 / #B9562F, ribbon wallpaper) so it stays unique. Never copy Apple or ZimaOS assets, icons or text.

Build:
1. Real screenshots first. Serve [DASHBOARD]/ with any static server (it falls back to sample data without jenerd) and capture with headless Chromium/Playwright at 2x: dashboard (dark + light), Settings > General, Settings > Storage + the Create storage table step, App Store Discover, setup Welcome card, phone layout (390x844) of the dashboard. Save optimized WebP (and PNG originals in a non-published folder) under [SITE]/assets/shots/. These are real product screens, not mockups.
2. [SITE]/preview.html (also linked from the home page hero as "Watch the preview"): a scroll-driven 3D story over the ribbon wallpaper.
   - The screens float as layered planes using CSS 3D transforms (perspective, rotateX/Y, translateZ), tilting with scroll and gently with pointer, then settle flat as each feature is explained ("Set up from your phone", "Updates that undo themselves", "Storage in a few taps", "Your own app store").
   - Liquid Glass: frames, captions and the floating phone use a glass material: Chromium gets real refraction via an inline SVG filter (feTurbulence or an feImage displacement map + feGaussianBlur -> feDisplacementMap) applied with backdrop-filter: url(#glass) plus blur/saturate; other browsers get frosted glass (backdrop-filter: blur saturate) and the same rim light (inset highlights, a moving specular sheen with a gradient). Text on glass must keep 4.5:1 contrast (add a tint layer).
   - One signature moment: a soft light sweep across the glass as each section lands.
   - No libraries if CSS + a small vanilla JS (IntersectionObserver / scroll-timeline with fallback) can do it; if you truly need WebGL, self-host three.js (no CDN), lazy-load it only on this page, keep the page under 1.5 MB total, and keep a CSS fallback.
   - prefers-reduced-motion: no movement, show the screens flat in a clean grid. JS off: same static grid. Works from 360px phones to 3440px ultrawide, light and dark.
   - Update [SITE]/_headers so ONLY /preview allows script-src 'self' (keep script-src 'none' everywhere else).
3. Also export the preview as a video for social posts: record the page with Playwright (scroll through it) to [SITE]/assets/video/jeneros-preview.mp4 (1920x1080, H.264, ~30-45s, under 15 MB) and a 1080x1920 vertical cut for Shorts/Reels/TikTok, plus a poster image. Use ffmpeg if available in the environment; if video export is impossible there, write .scratch/marketing/VIDEO.md with the exact commands for Jener to run.
4. Replace the "Screenshot coming soon" placeholders on index.html with the real screenshots.

Quality: Apple-clean, calm, premium, cute; use the motion tokens (--ease etc.) from .scratch/motion/BRIEF.md; 60fps on a mid laptop (animate only transform/opacity; the SVG refraction only on small elements, never full screen). Accessible: alt text describing each real screen, captions as real text, skip link, focus styles.

Never use the retired name "Arvey". Plain friendly words, no em dashes. Don't deploy, don't touch main, no secrets.

When done: append to [DOCS]/AI-UPDATES.md (date, who = Claude cloud, files, what is untested), commit with author "Jener <124105257+PrimeExtremo@users.noreply.github.com>" and trailer "Co-Authored-By: Claude <noreply@anthropic.com>", push, open the PR, and end its description with:
🤖 Generated with [Claude Code](https://claude.com/claude-code)
