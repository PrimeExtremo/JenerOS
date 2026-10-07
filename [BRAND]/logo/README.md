# JenerOS logos

Jener approved the angular v1 style. The heavy squared J has a 45-degree
bevel and a small square accent in the same color as the J. The wordmark
reads **JENEROS** in the original wide geometric capitals with chamfered corners.
The rounded v2 artwork is retired.

| File | Use |
|---|---|
| `j-monogram.svg` | Icon on light surfaces; ink `#16161D` |
| `j-monogram-light.svg` | Icon on dark surfaces; paper `#F7F7F9` |
| `jeneros-wordmark.svg` | Wordmark on light surfaces; ink |
| `jeneros-wordmark-light.svg` | Wordmark on dark surfaces; paper |
| `splash-512.svg` | Paper J and paper square on transparency for the dark boot splash |

All five assets have transparent backgrounds. Use paper `#F7F7F9` for light
surfaces and ink `#16161D` for dark surfaces. The boot theme supplies its own
`#16161D` background. No orange or cream remains in these assets.

The monograms and splash use a 512 x 512 canvas. The wordmarks restore the
v1 1472 x 320 canvas. Preserve the full canvas and aspect ratio with automatic
height. Light and ink versions share identical geometry. All artwork is filled
paths, with transparent letter counters; no fonts or external resources are needed.

The exact J path is `M128 80H416V336L320 432H96V272H192V336H280L320 296V176H128Z`.
The square path is `M144 208H176V240H144Z`. Keep both together.
Leave space around the mark and check the square and lettering at the final display size.
