# JenerOS desktop wallpapers

| Screen | Warm dark | Cream light |
|---|---|---|
| Main ultrawide, 3440 × 1440 | `jeneros-ribbons-3440x1440-dark.svg` | `jeneros-ribbons-3440x1440-light.svg` |
| Second screen, 2560 × 1440 | `jeneros-ribbons-2560x1440-dark.svg` | `jeneros-ribbons-2560x1440-light.svg` |

The setup wizard's `wallpaper-ribbon.svg` spreads across the full width,
with broad copper folds toward the edges and a quiet center for desktop icons.
Dark uses `#1F1913`; light uses `#F6F1E7` and the wizard's .23 ribbon opacity.
Each SVG embeds all artwork and gradients. No fonts or external files are needed.

The angular J comes from `[DASHBOARD]/logo.svg`, at the corner mark's 28px
canvas scale and .7 opacity. Its **painted** right edge is 40px from the right;
its painted bottom edge is 80px from the bottom (48px taskbar + 32px gap).
The original logo's canvas padding is accounted for.

Regenerate from the repository root with Node (no packages):

```sh
node '[BRAND]/wallpapers/regenerate.cjs'
```

Claude can export each SVG to PNG on the build VM at its declared dimensions,
with PNG output directed to `S:\[VMs]\...` outside this repo. For exact placement,
use the matching native display resolution and no crop or span mode.
