JenerOS repo (C:\Users\jener\jeneros, branch zimaos-style). Build the JenerOS launch trailer in Blender, as a scripted scene, and keep a LIVE progress page updated the whole time so Jener can watch you work.

## 1. Jener watches LIVE IN BLENDER (top priority)
Jener has Blender open via `.scratch/trailer-blender/Watch live in Blender.bat`, which runs `watch_live.py` (already written, don't change its behavior): it reloads `.scratch/trailer-blender/trailer.blend` every time that file changes. So:
- Save the very first `trailer.blend` within your first few minutes (even just the dark world, camera and a "Building..." 3D text), then build the scene up INCREMENTALLY and re-save `trailer.blend` after every meaningful step (each object, material, scene, camera move, timing pass). Build the scene in pieces (e.g. `build_trailer.py --only scene3` appending to the existing file, or one step function at a time) so saves happen often, not just once at the end.
- Save atomically: save to `trailer.tmp.blend` with `bpy.ops.wm.save_as_mainfile(filepath=..., copy=True)`, then `os.replace` it onto `trailer.blend`, so Blender never reloads a half-written file. Never leave `.blend1` backups next to it (set `bpy.context.preferences.filepaths.save_version = 0` in your script).
- Inside the .blend, keep a 3D text object "STATUS" parked outside the camera view (and hidden from render) saying the current step, e.g. "Scene 3 of 9: Set up from your phone", so Jener can read progress in the viewport. Set the timeline range to the full trailer and keep the active camera set, so pressing Space plays it.
- Images: pack textures into the .blend (`bpy.ops.file.pack_all()`) so the file is self-contained.
- An HTML page (LIVE.html, live.py) was started earlier; you may keep updating it as a secondary log, but the .blend is what Jener watches. Python is not on PATH: use Blender's bundled Python for any helper.

## 2. The trailer
Blender 5.2.2 LTS is installed: `C:\Program Files\Blender Foundation\Blender 5.2\blender.exe`. Run it headless (`blender -b -P script.py -- args`). Check the real Eevee engine id with bpy before using it.

- `.scratch/trailer-blender/build_trailer.py`: builds the whole scene from scratch into `trailer.blend` (so Jener can open and tweak it by hand) and can render.
- Use ONLY our assets: real screenshots in `[SITE]/assets/shots/` (webp; use the PNG originals in `shots/src/` where they exist, or convert webp to png with Blender/Pillow), the logo and wallpapers in `[BRAND]/`. Read `[BRAND]/README.md` and `.scratch/marketing/CODEX-PREVIEW-MOTION.md` (the full trailer breakdown and beat grammar: follow it).
- Look: near-black warm brown world; screens are rounded glass panels (real screenshot texture + a glass bevel/rim with specular highlights, slight thickness); shallow depth of field on macro shots; soft orange glow; an old PC/box model (simple, clean, modeled in script) for the opening and closing hero; word cards as real 3D text in Bricolage Grotesque if the font is available on the system or in the repo, otherwise a clean sans, with a cream-to-#D97757 gradient.
- Camera never stops; entrances rise in with long soft ease (Bezier keyframes, no linear except drift); tiles grow in place into panels. NOTHING may overlap or clip: each shot owns the frame, previous elements are fully gone (hidden/keyframed out) before the next arrives. This is the main complaint about the web version.
- Timing from `[SITE]/assets/video/beats.json` (cuts on beats, big moments on downbeats). Same story order as the web trailer, ~43 s, 60 fps. A `--beats` arg lets us re-time to a new song later.
- Silent. No music (Jener adds a song later).

## 3. Rendering
- While building, render a small preview still (960x540, low samples) of EACH scene as soon as it exists, into `.scratch/trailer-blender/live/`, and show it on LIVE.html. Look at each still yourself and fix overlaps/clipping before moving on.
- Then a draft animation at 960x540 30 fps -> `live/draft.mp4` (Blender's FFmpeg output, H.264), shown on LIVE.html.
- Final: 1920x1080 60 fps -> `.scratch/trailer-blender/out/jeneros-trailer.mp4`, and a 1080x1920 vertical camera variant -> `out/jeneros-trailer-vertical.mp4`. If the final render would take more than ~40 minutes, stop after the draft and write the exact render command in README.md instead; say so on LIVE.html.

## 4. Wrap up
- `.scratch/trailer-blender/README.md`: how to open/tweak the .blend, how to re-time to a song, render commands.
- Don't commit large renders (add `out/` and `live/*.mp4` to .gitignore). Log in `[DOCS]/AI-UPDATES.md`. Files only: no commits, pushes or deploys. Never copy Apple/ZimaOS assets. Never use the name "Arvey". No em dashes in any user-facing text.
