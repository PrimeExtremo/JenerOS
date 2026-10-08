# JenerOS motion spec

Applies to the dashboard, Settings window, App Store window, login and setup cards.

## Personality
**Gentle playful.** Apple-calm for everyday UI, one small bounce reserved for moments of joy (setup done, app installed, success). Cute, never jittery. Emotional target: *calm confidence with a smile*.

## Brand motion identity (use these and nothing else)
| Token | Value | Use |
|---|---|---|
| `--ease` (signature, 80% of motion) | `cubic-bezier(0.2, 0, 0, 1)` | on-screen changes, entrances |
| `--ease-out` | `cubic-bezier(0.05, 0.7, 0.1, 1)` | windows/cards entering |
| `--ease-in` | `cubic-bezier(0.3, 0, 1, 1)` | exits, dismissals |
| `--ease-pop` | `cubic-bezier(0.175, 0.885, 0.32, 1.275)` | joy moments only |
| `--t-quick` | `120ms` | hover, press, toggles |
| `--t-std` | `240ms` | cards, tiles, notices, tabs |
| `--t-slow` | `380ms` | windows/dialogs, page changes |

Entrances are ~40% longer than exits. Animate only `transform` and `opacity` (plus `background-color`/`box-shadow` on hover). Never `transition: all`. Never linear except spinners and progress bars.

**One entrance pattern everywhere:** rise 12px + fade in, `--t-std`, `--ease-out`.

## Recipes
| Element | Motion |
|---|---|
| Dashboard load | Widgets (left) then notices then app tiles: rise+fade, micro cascade 30ms per item, total under 400ms. Clock first (hero). |
| App tile hover | lift `translateY(-2px)`, shadow grows, icon scale 1.04, `--t-quick`. |
| App tile press | scale 0.97 at 80ms, release to 1 with `--ease` 200ms (secondary: shadow shrinks while pressed). |
| Settings / App Store / app windows | open: backdrop fade 200ms; window scale 0.96 → 1 + fade, `--t-slow`, `--ease-out`. close: scale 0.98 + fade, 220ms, `--ease-in`. Focus moves after the open settles. |
| Settings sidebar switch | content crossfade + 8px slide in from the right, `--t-std`. Active pill slides between items (transform, not re-render). |
| Notice carousel | slide by card width with `--ease`, 320ms; dots stretch (active dot width 8px to 20px). Auto-advance no faster than every 8s, pauses on hover/focus, off under reduced motion. |
| CPU/RAM rings | sweep to the new value with `--ease`, 600ms; numbers count up with the ring. |
| Network graph | new points slide in from the right; no full redraw flash. |
| Buttons | press scale 0.97, `--t-quick`; primary orange button gets a soft glow on hover. |
| Toggles (SSH etc.) | knob slides with `--ease-pop` 220ms (tiny 8% overshoot); track color fades 120ms. |
| Setup / login cards | card enters rise+fade; step change slides old card out left (`--ease-in`, 200ms) and new in from right (`--ease-out`, 300ms). Wrong password: horizontal shake 3 times ±8px, 320ms, firm, no overshoot, field border turns orange. |
| Success (setup finished, app installed) | check icon pops with `--ease-pop` 300ms, the check stroke draws in 250ms, 6 small cream/orange confetti dots burst once (ambient, 600ms). The only celebratory moment. |
| Install progress ring | linear stroke progress; ring pulses gently (opacity 0.7 to 1, 1.2s sine) while waiting for real progress. |
| Wallpaper | ambient: the swoosh drifts very slowly (60s loop, translate under 2%, sine). Pauses when the tab is hidden. Off under reduced motion. |
| Toasts | rise from bottom 16px + fade, `--t-std`; leave with fade + 8px drop, 180ms. |

## Layers check
- Primary: windows, cards, tiles.
- Secondary: shadows, icon scale, dot stretch, number count.
- Ambient: wallpaper drift, waiting pulse.
1/3 rule: never more than a third of visible items moving at once (the load cascade is the only exception, under 400ms).

## Accessibility (must)
- `@media (prefers-reduced-motion: reduce)`: no movement or scale; keep 120ms opacity fades so state changes stay visible; no wallpaper drift, no confetti, no auto-advance.
- Nothing is communicated by motion alone (errors also have text, success also has a label).
- Motion never blocks input; any animation can be interrupted by a click or key.
- TV/remote focus ring moves instantly (no animated focus); only the focused element lifts.
