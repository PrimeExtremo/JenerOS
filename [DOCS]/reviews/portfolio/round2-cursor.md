**high** | `portfolio.css:144` | `@supports (animation-timeline: view())` never closes, so mobile layout, Round 1 header/skip z-index, motion toggle, and `prefers-reduced-motion` are all gated on scroll-timeline support (hard constraint break + broken phone gallery where `view()` is missing). | Close `@supports` after the scroll-timeline rules (~175); keep `@media` layout, polish, motion toggle, and reduced-motion **outside** that block.

**medium** | `portfolio.css:223` | “Pause motion” only pauses looping hero/blob animations; scroll-driven `view()` motion (statement, marquee, projects, gallery, skills, finale) still runs. | On `:checked`, also force `animation: none` (or `animation-play-state: paused`) on `.me-grid`, `.big-type .w`, `.reveal`, `.fly`, `.fan`, `.finale-type`, `.gallery-ring`, `.marquee .row` — or rename the control to match what it actually stops.

**medium** | `portfolio.css:36` (also 94, 100, 133) | Display type uses `font-weight: 800` but only Bricolage 700 is loaded (`site.css` + preload), so the cinematic type synthesizes faux-bold. | Use `font-weight: 700`, or add/preload a real 800 face.

VERDICT: CHANGES NEEDED
