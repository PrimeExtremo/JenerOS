Round 4 accent + 2.2s delay look correct. Two real pause-control a11y holes remain.

medium | portfolio.css:229 | `prefers-reduced-motion` sets `.motion-label { display: none }` but leaves `#motion-off` in the tree; it stays focusable (`opacity: 0` does not remove it from tab order) and announces “Pause background motion” even though motion is already forced off | In that same query, hide the input too: `.motion-toggle, .motion-label { display: none }`

medium | portfolio.css:218-221 (with index.html:33-34) | Checkbox is the second tab stop (right after Skip) while the label stays `opacity: 0` for 2.2s via `rise`/`both`, so early Tab lands on a control with no visible focus UI | Keep the delay, but gate focusability: start `.motion-toggle` at `visibility: hidden` and flip to `visibility: visible` at 2.2s (`animation…forwards`); add `visibility` to the label’s delayed show the same way

VERDICT: CHANGES NEEDED
