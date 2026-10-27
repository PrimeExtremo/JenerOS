Make a standalone JenerOS LOGO INTRO in Blender. New folder `.scratch/logo-intro/` only. Don't touch `.scratch/trailer-blender/`, AI-UPDATES.md, or anything else.

Blender 5.2.2 is at `C:\Program Files\Blender Foundation\Blender 5.2\blender.exe`. Run it headless: `blender -b --factory-startup -P make_intro.py -- [--still N] [--render]`. Python is not on PATH (use Blender's own). The Eevee engine id is `BLENDER_EEVEE`.

## What to build: `make_intro.py`, which writes `logo-intro.blend` and renders `out/jeneros-logo-intro.mp4`
- 1920x1080, 60 fps, exactly 6.0 s (360 frames), silent, H.264 (FFMPEG, MPEG4 container, codec H264, audio NONE).
- Logo geometry: read `[BRAND]/logo/j-monogram.svg` (the J) and `[BRAND]/logo/jeneros-wordmark-light.svg` (the JENEROS wordmark), and turn the path data into curves. Copy the SVG parsing approach from the `logo()` function in `.scratch/trailer-blender/build_trailer.py` (lines 284-315); it already handles M/L/H/V/Z and translate/scale. Read the SVG files first to check which commands they use.
- Font if needed: `.scratch/trailer-blender/assets/BricolageGrotesque-Bold.ttf`.

## Shot (keep it simple and clean; quality over tricks)
| Frames | What happens |
|---|---|
| 1-60 | Near-black warm void (world color about #0E0A07) with a faint amber haze glow in the center. Camera on a 85 mm lens, slowly pushing in. |
| 30-150 | About 40 small amber glass cubes (0.06-0.12 size, bevelled) fly in from off-screen along curved paths with soft ease-out, stagger them, and land into the J's shape (sample target points inside the J's filled area). As they land they fade out while the solid J fades in (keyframe alpha or scale them to 0), so the J looks assembled. |
| 120-200 | The J is a thick bevelled shape (extrude about 0.15, bevel about 0.02). Material: amber glass, Principled BSDF, transmission 1.0, IOR 1.45, roughness 0.08, base color #D97757 tinted, plus a thin emission rim. One warm key light from the upper left and one cream rim light behind. The camera slides along the J's edge at a 3/4 angle (about 25 degrees off-axis), then settles front-on by frame 200. |
| 196-200 | A warm flash: an emission plane in front of the camera, cream #F6F1E7, ramps 0 to 1 to 0 over 6 frames. |
| 200-300 | The J moves left, and the JENEROS wordmark rises in to its right (cream #F6F1E7, slight emission), letters staggered by 2 frames, soft ease-out. Below it, small text "Free. Open source. Yours." fades in at frame 250 (Bricolage, cream, with "Yours." in #D97757). |
| 300-360 | Hold with a very slow push, then fade everything to black over the last 30 frames. |

Depth of field: ON, but focus distance keyed to the J (or the cubes) so the hero is ALWAYS SHARP. f-stop 2.8 to 4 (NOT lower; the trailer's opening was too blurry). Motion blur ON (shutter 0.5). Compositor: a Glare node (Fog Glow, small) for bloom. Never copy Microsoft/Apple assets.

## Check your work
- Render stills at frames 1, 60, 120, 170, 198, 230, 280 and 340 (960x540, 16 samples) into `.scratch/logo-intro/stills/`. Look at each one. The J must be crisp and readable, nothing clipped at the frame edges, nothing overlapping the text. Fix and re-check once.
- Then render the full video: `--render` -> `out/jeneros-logo-intro.mp4`. It's only 360 frames, so it's fast on this PC.
- Save `logo-intro.blend` so Jener can open it and tweak it. Pack images with `bpy.ops.file.pack_all()` if any are used.
- Write a 10-line `README.md` (how to re-render and what to tweak). Files only, no commits.
