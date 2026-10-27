# PROMPT-5 review — 2026-10-09

The current `trailer.blend` contains the finished placeholder edit: 28 shots,
14 story chapters, 3,810 frames at 60 fps (63.5 seconds). The last six seconds
are the recreated JENEROS end card. No full v3 video has been rendered.

## Resume audit

The interrupted run had already built every chapter in the requested order,
written the 57.68-second VO analysis and timing guide, saved the forward-shutter
blur fix, rendered 28 shot stills and three portrait stills, and encoded the
one-frame probe. These completed steps were preserved rather than rebuilt.

`build_trailer.py` is the entry point; implementation is in `build_v3.py`.
`build_trailer_pro.py` and `trailer-pro.blend` preserve the earlier PRO version.
The saved project already includes the brighter boot J, dark caption on the
sunlit wall, revised QR/phone framing, scanning sweep and storage macro.

## Completed checks

| Check | Result / evidence |
|---|---|
| Every master frame | 3,810 frames pass exclusive shot visibility, render/viewport agreement and projected headline/label collision checks. `live/v3/cut-check.json` |
| Motion-blur boundaries | 276 fractional samples pass on both sides of cuts and delayed reveals, and at first/last shutter exposures. Inactive shot lights have zero energy. Visibility keys are constant. `live/v3-resume-subframes.log` |
| Shutter | Saved scene uses START, 0.4 frames. The check rejects centered/end exposure or a shutter of one frame or more. |
| Rendered boundaries | Refreshed all 81 stills: frame before, first frame, and 12 frames after each of 27 cuts. Visually inspected all seven contact sheets; no previous-shot text/geometry bleed. `live/v3/boundaries/` |
| Shot compositions | Reviewed all 28 current stills and refreshed their three contact sheets. `live/v3/contact-01.png` through `contact-03.png` |
| Export configuration | Existing final, vertical and shots checks pass: 60 fps, PERC_LOSSLESS, BEST, filter 1.0, silent. Logs: `live/v3-config-*.log`. No full exports launched. |
| First-frame probe | Rechecked the existing latest MP4: one video track, 2560×1440, duration 1/60 second, no audio, 168,100 bytes. `out/probe-check.json` |
| Audio analyzer | Existing synthetic fixture passed: measured 95.703 BPM for a 96 BPM source and drop at 60.163 seconds for the known 60.25-second change. This is not a test on the actual song. |

The live page now presents the 28 current stills in story order. Its earlier
video is explicitly marked pre-v3. Boundary sheets now read before/on/after
from left to right. The cut report is written after fractional checks, so a
subframe failure cannot leave a report that claims success.

## Song status and Claude's next steps

`music/falling-apart.mp3` and `.wav` are absent. `music/` contains only the
96 BPM placeholder `beats.json`. No song re-time was performed.

When the actual track is supplied, run the rebuild command in `README.md`.
The builder analyzes and retimes after building the story, writes the chosen
song in-point and shot beats to `out/timing-guide.txt`, and saves the grid into
the blend. Then rerun `--check-cuts` and review the new boundary stills.
Actual-song tempo/downbeat/drop detection and animation retiming remain
untested. Correct musical phrasing by ear before final exports.

Claude should render the draft to S:, review pacing and the full QR whip,
drive insertion, A/B crossing and hardware tumbles in motion, then render
final/vertical/shots using the README commands. Check portrait framing through
the entire edit: the current vertical camera preserves the horizontal layout
with substantial space above and below. Three portrait stills do not establish
full portrait readability. Low-sample stills are noisy and do not establish
final-quality grain, DOF or motion-blur appearance.

VO paragraph timing is measured from pauses; interior word cues are envelope
estimates, not transcription. Verify word sync in Premiere, place VO at zero,
and mix the song there. Blender exports stay silent. Long-file and per-shot
encoding, actual-song sync, and replacing the ending with the external logo
intro remain for Claude/Jener.
