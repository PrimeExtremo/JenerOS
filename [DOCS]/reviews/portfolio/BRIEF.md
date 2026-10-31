# Portfolio review brief

Project: jener.dev, Jener's portfolio for companies. Files: `[SITE]/index.html`, `[SITE]/assets/portfolio.css` (builds on `[SITE]/assets/site.css`). Live at https://jener.dev.

Goal from the owner: a portfolio that "blows people's mind": cinematic motion-graphic typography, smooth shape transitions, 3D elements, seamless camera movement. It must also follow good web, design, motion, accessibility and copy practice.

Hard constraints:
- No JavaScript. The site CSP is `script-src 'none'`; motion is CSS only (keyframes plus `animation-timeline: view()` scroll-driven animations).
- Static files on Cloudflare Workers static assets.
- Respect `prefers-reduced-motion`; no horizontal scroll on phones; one accent colour (#d97757).
- Only public projects may be shown (JenerOS, umbrelos-green). Do not invent facts about the owner.

Reviewer role: be adversarial. Find what is weak, broken, generic, slow, inaccessible or unconvincing to a hiring manager. For each finding give: severity (high/medium/low), file:line, the problem, and a concrete fix. End with a verdict line: `VERDICT: SHIP` or `VERDICT: CHANGES NEEDED`.

## Round 2 context
Round 1 findings from Codex and Cursor were applied: owner-approved contact hello@jener.dev added (nav, hero, finale, footer); "can't be bricked" softened; JenerOS labelled early preview with a sample-data note; spinning aurora, grid animation, shard backdrop-filter and scroll-timeline blur removed; gradient text has solid fallbacks; dark-only screenshots and color-scheme; phones show all three screens stacked; CSS-only "Pause motion" toggle; header stays above the intro; twitter meta added.
Re-review the current files. Only flag real remaining problems. If it is good enough to ship, say VERDICT: SHIP.

## Round 3 context
Round 2 fixes applied: the unclosed @supports block is closed (braces balance), "Pause motion" now also stops all scroll-driven animations, display type uses the loaded 700 weight instead of faux 800. Re-review; only flag real remaining problems; say VERDICT: SHIP if it is good enough to ship.

## Round 4 context
Round 3 finding fixed: Pause no longer pauses the accent word's entrance (it shows it fully instead), and the Pause button only appears after the opening (2.2 s). Confirm or flag real remaining problems; VERDICT: SHIP if good.

## Round 5 context
Round 4 (Cursor) fixed: the motion toggle moved to the end of the page (last tab stop) and shows itself when focused; under reduced motion both the checkbox and label are display:none. Codex already gave SHIP in round 4.

## Round 6 context
Round 5 fixed: toggle uses only its visible <label> as its name (aria-label removed); no ghost outline on the hidden checkbox. Also: all inline style="--i/--n" attributes were removed because the site CSP style-src self blocks them; stagger order now comes from nth-child rules at the end of portfolio.css. Codex already said SHIP.
