medium | `portfolio.css:224` | “Pause motion” uses `animation-play-state: paused` on `.me h1 .accent`, which also runs the one-shot `word-in` entrance. The control sits above the intro (`z-index: 115`), so a click in the first ~2s can freeze “Jener.” at opacity 0 / mid-blur indefinitely. | Drop `.me h1 .accent` from the play-state list; on `:checked` set `animation: none !important; opacity: 1; transform: none; filter: none` so the static gradient (or solid `#ffd9c4` fallback) remains.

VERDICT: CHANGES NEEDED
