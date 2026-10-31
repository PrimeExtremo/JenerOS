**medium** | `portfolio.css:221` | `.motion-label` is `opacity: 0` for 2.2s (`rise` + `both`) but still hit-tests in the fixed corner, so users can click an invisible Pause control during the intro/hero. | Keep it non-interactive until visible (`pointer-events: none` by default, enable when shown; prefer `forwards` over `both` if you set opacity in the base rule).

**medium** | `portfolio.css:226` | Pause sets `.me h1 .accent { animation: none }`. Unchecking Play re-applies `word-in` + `shimmer`, so “Jener.” vanishes and re-enters. | Don’t remove the finished entrance. Pause only shimmer (e.g. separate infinite animation / `animation-play-state`), and keep the entrance fill as-is.

VERDICT: CHANGES NEEDED
