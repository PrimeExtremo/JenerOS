Build the JenerOS launch AD in Blender, in the style of the umbrelOS 2.0 video Jener loves. Work ONLY in a new folder `.scratch/ad-story/`. Jener will edit the result in Premiere, so make it a clean silent video plus separate shot clips.

## Read first (only these)
1. `.scratch/trailer-blender/REFERENCE-UMBREL.md`: the target style, a second-by-second breakdown plus "JenerOS version" at the bottom. This is the brief.
2. `.scratch/trailer-blender/REFERENCE-WIN11.md`: camera and lens tricks (skim the "Rules" section).
3. Reuse working code, don't rewrite it:
   - `.scratch/trailer-blender/build_trailer.py`: scene helpers, the screenshot panels (`panel()`, `rounded_image()`), the old PC + monitor + room (the room-reveal shot is already good), the disks, the A/B slabs, atomic saves, `--still`/`--render`. Blender 5 video output needs `image_settings.media_type='VIDEO'` before `file_format='FFMPEG'`.
   - `.scratch/logo-intro/make_intro.py`: SVG logo parsing, glass material, flash/fade veils, a fadeable material via Object Info alpha. Its finished video `.scratch/logo-intro/out/jeneros-logo-intro-1440p.mp4` is the END CARD; don't rebuild it, leave a 6 s slot for it at the end.
   - Assets: real screenshots `[SITE]/assets/shots/src/*.png`, `.scratch/trailer-blender/assets/` (Bricolage TTF, qr.png), `[BRAND]/logo/*.svg`, wallpapers in `[BRAND]/wallpapers/`.

## The story (about 60 s, 60 fps, 2560x1440, silent)
| Beat | Shot |
|---|---|
| 1 | A warm, slightly dusty closet at night. A beige old PC tower sits on a shelf. The door swings open and warm light spills in; slow push-in, DOF. |
| 2 | Kinetic words on near-black, one at a time, Bricolage: "This old PC..." then "could be" then "**your cloud.**" (gradient cream to #D97757). |
| 3 | Macro: a USB stick slides into the PC's front port (motion blur), the power LED blinks amber, then the monitor shows the J boot splash. |
| 4 | The monitor shows the setup QR (assets/qr.png on the setup-welcome screenshot). A phone (simple rounded slab) rises in from below; whip pan with motion blur; the phone shows the phone-setup screenshot; a "Connected" pill grows. Words: "Set up" / "from your phone." |
| 5 | Room reveal: the dashboard on the old PC's monitor in the cozy room with the lamp and plant (reuse the existing room shot), plant shadows on the wall, slow dolly. |
| 6 | Words over the amber ribbon wallpaper: "Your photos." "Your files." "**At home.**" |
| 7 | PLAYFUL 3D: old hardware tumbles through soft blurred foliage with labels, one per beat: "Old laptop", "Office PC", "Mini PC" (simple clean models). Then a handwritten "**for free!**" (draw a script-like stroke or use a curvy font if one is available; otherwise a hand-drawn underline under Bricolage italic-style text) with a small orange heart. |
| 8 | Storage: two disks drop into bays (macro, DOF), the mirror bar fills, "Your storage is ready." pill. Words: "Two copies." / "One calm place." |
| 9 | Updates: A/B glass slabs swap with a check mark and a speed ramp. Words: "Updates" / "that undo themselves." |
| 10 | App Store: the store-discover screenshot on a glass panel, tiles fan out in 3D, a cursor clicks. Keep it honest: no fake install counts. |
| 11 | BENTO GRID recap: 6 to 8 rounded cards fly in and settle (Phone setup, Safe updates, Storage, App Store, Free & open source, Runs on old PCs, Private at home), each with a tiny visual from the earlier shots. |
| 12 | Leave 6 s of black for the logo intro end card (Jener drops it in Premiere). |

Style rules: our palette only (near-black warm #0E0A07 to #1F1913, cream #F6F1E7, orange #D97757, button orange #B9562F); each section has its own background tone (warm dark, amber, cream, deep orange). The camera never stops. Every macro has DOF, but the HERO IS ALWAYS SHARP (f/2.8 to 4, focus keyed to the subject). Motion blur on. Cut every 1-3 s, on the beat grid from `[SITE]/assets/video/beats.json` (support `--beats` like the trailer). NOTHING overlaps across cuts; reuse the trailer's cut-check idea. Plain friendly words, no em dashes. Never copy Umbrel, Apple or Microsoft assets, UI, logos or exact lines.

## How to work (budget matters, Codex may hit its limit)
- `make_ad.py` builds `ad.blend` incrementally, one beat at a time, saving atomically after each beat, so a partial run is still usable. Keep a STATUS text out of frame like the trailer does.
- After each beat, render 2 stills (1280x720, 16 samples) into `stills/` and look at them; fix anything unreadable, clipped, overlapping or blurry before moving on.
- Do the beats in this order (most important first): 1, 2, 3, 4, 5, 6, 12, 8, 9, 7, 10, 11.
- Do NOT render the full video; Claude renders it. Make sure `--render final` (2560x1440, 60 fps, H.264 with `constant_rate_factor='PERC_LOSSLESS'`, `ffmpeg_preset='BEST'`, `filter_size=1.0`) and `--render shots` (each beat as its own mp4 in `out/shots/` for Premiere) work: start them and confirm the first frame renders, then stop.
- README.md: how to open and tweak, re-time with `--beats`, the render commands, and which real-life shots Jener could swap in later (filmed or AI video).
- Files only, no commits. Append a short entry to `[DOCS]/AI-UPDATES.md` at the very end.
