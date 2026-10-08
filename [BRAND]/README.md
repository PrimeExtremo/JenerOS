# JenerOS brand

Techy geometric logo, clean Apple/ZimaOS-style interface, warm palette of its own.
The **Arvey name and AV monogram are retired**. Never use them here.

## Logo
- **J monogram:** a custom drawn shape, not a font. Square J with a 45° bevel and a square dot.
  Path: `M128 80H416V336L320 432H96V272H192V336H280L320 296V176H128Z` + dot `M144 208H176V240H144Z`.
  Files and rules: [logo/README.md](logo/README.md).
- **Wordmark:** **JENEROS** in custom wide geometric capitals with chamfered corners, drawn as
  paths to match the J (no font). Files: `logo/jeneros-wordmark.svg` (ink) and
  `logo/jeneros-wordmark-light.svg` (paper). Jener picked this techy look over clean grotesk
  versions on 2026-10-08; keep it.
- Monochrome: ink `#1F1913` on light, paper `#F6F1E7` on dark. No orange in the logo.

## Type
| Use | Font | License |
|---|---|---|
| Wordmark | Custom geometric capitals (paths, no font) | Ours |
| Dashboard headings, "JenerOS" next to the J | Bricolage Grotesque Bold, self-hosted in `[DASHBOARD]/fonts/` | OFL |
| Body and UI text | System font stack (`system-ui`, -apple-system, Segoe UI, Roboto) | n/a |
| Box text consoles | DejaVu Sans Mono / the console font | n/a |

## Colors
| Token | Light | Dark | Use |
|---|---|---|---|
| Paper | `#F6F1E7` (cream) | `#1F1913` (brown) | Page background |
| Card | `#FFFCF6` | `#2B241C` | Cards, panels |
| Ink | `#1F1913` | `#F6F1E7` | Text, logo |
| Orange | `#D97757` | `#D97757` | Decoration, highlights |
| Orange button | `#B9562F` | `#B9562F` | Button fill (white text passes AA) |

Dashboard tokens live in `[DASHBOARD]/style.css`; treat that file as the source of truth.
