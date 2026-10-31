Round 5 fixes check out (toggle last in tab order, shows on `:focus-visible`, hidden under `prefers-reduced-motion`). One real a11y hole remains on that control:

medium | index.html:224 | `aria-label="Pause background motion"` wins over the `<label>`, so when checked the visible text is “Play motion” but the accessible name stays “Pause…” (WCAG 2.5.3 Label in Name) | Drop the `aria-label` and let the label’s `.on` / `.off` text name the checkbox

low | portfolio.css:218 | The opacity-0 checkbox still gets `site.css`’s `:focus-visible` outline, so Tab can show a ghost ring as well as the label ring | `.motion-toggle:focus-visible { outline: none; }` (keep the existing label outline rule)

VERDICT: CHANGES NEEDED
