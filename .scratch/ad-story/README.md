# JenerOS: your cloud at home

Open `ad.blend` in Blender 5.2. The editable silent cut is **58.5 seconds**, **60 fps**, **2560 x 1440**. Its last **6 seconds are black**. Replace that slot in Premiere with the existing `../logo-intro/out/jeneros-logo-intro-1440p.mp4`. That video is not rebuilt or embedded here.

## Edit

Each numbered collection is one story beat. Camera markers make the internal cuts. Select a camera, press NumPad 0, and scrub the timeline. The named focus empties keep the hero in focus. The camera and focus keys are ordinary editable animation; no playback scripts or handlers are needed.

Text is live Bricolage. Screenshots, fonts and QR are packed. Screenshot planes come from the actual JenerOS site captures; their readings are samples. The App Store shot explicitly says installs are coming soon. The hardware is deliberately stylized.

The `physical scale` empty in each collection scales the modeling units to 20 cm. Move its children to adjust a shot. Avoid applying its scale unless you also adjust light power and lens focus. `STATUS` sits out of frame and records the latest checkpoint.

`make_ad.py` reuses the trailer's panel, rounded image, room, PC, disk and A/B helpers in `trailer_helpers.py`. `intro_helpers.py` reuses the intro's SVG parser and fadeable material code. These are local snapshots; the earlier projects are unchanged. The amber ribbon paths are read from the approved wallpaper SVG and converted to editable geometry with warm materials.

## Build and inspect

Run from the repository root in PowerShell. Nothing needs installing.

```powershell
$blender = 'C:/Program Files/Blender Foundation/Blender 5.2/blender.exe'
& $blender -b -t 8 -P '.scratch/ad-story/make_ad.py' -- --build-beat 1
```

Build order: **1, 2, 3, 4, 5, 6, 12, 8, 9, 7, 10, 11**. Each command replaces only that beat, saves `ad.blend` atomically, and renders two 1280 x 720 stills at 16 samples into `stills/`. Inspect them before continuing. A failed later beat leaves the previous checkpoint usable.

Render the same pair again, or inspect a specific frame:

```powershell
& $blender -b -t 8 -P '.scratch/ad-story/make_ad.py' -- --still 4
& $blender -b -t 8 -P '.scratch/ad-story/make_ad.py' -- --still 4 --frame 880
```

For a full rebuild, omit `--build-beat`. This replaces hand edits, so save a separate Blender copy first.

## Timing

The supplied `beats.json` contains 69 beat positions at 96 BPM, starting at 0.5 s. The edit starts at that first beat, uses 84 beat intervals (52.5 s), then holds black for exactly 360 frames. After the supplied grid ends, timing continues using the median spacing of its final four intervals. No existing beat time is changed. If adding the original music later, align its first beat at 0.5 s to the cut's start.

Use a different JSON grid with an increasing `beats` array:

```powershell
& $blender -b -t 8 -P '.scratch/ad-story/make_ad.py' -- --beats '.scratch/ad-story/my-beats.json'
```

This rebuilds the whole story and its preview pairs. Reinspect them. A long grid uses its actual irregular timing; a short grid is extended as described above. The last black slot remains six seconds. A loaded file uses its packed grid and rejects conflicting timing supplied with a single-beat edit, still or render.

| Beat | Subject | Time in default cut |
|---|---|---|
| 1 | Closet opens | 0–5 s |
| 2 | This old PC / could be / your cloud | 5–8.75 s |
| 3 | USB, amber power, J splash | 8.75–12.5 s |
| 4 | QR, phone, Connected | 12.5–17.5 s |
| 5 | Cozy room | 17.5–20 s |
| 6 | Photos / files / at home | 20–23.75 s |
| 7 | Hardware / for free | 23.75–30 s |
| 8 | Disks and mirror | 30–36.25 s |
| 9 | Safe updates | 36.25–41.25 s |
| 10 | App Store | 41.25–46.25 s |
| 11 | Bento recap | 46.25–52.5 s |
| 12 | Black logo slot | 52.5–58.5 s |

## Render in Claude's session

Full videos belong on **S:**. The render command requires `--output-dir` for a full run and refuses C:. Both modes use H.264, `PERC_LOSSLESS`, `BEST`, 32 samples, `filter_size=1.0`, motion blur, 60 fps, and no audio.

```powershell
& $blender -b -t 8 -P '.scratch/ad-story/make_ad.py' -- --render final --output-dir 'S:/[VMs]/[JENEROS-AD]/out'
& $blender -b -t 8 -P '.scratch/ad-story/make_ad.py' -- --render shots --output-dir 'S:/[VMs]/[JENEROS-AD]/out'
```

The first command writes `out/jeneros-ad.mp4`. The second writes 12 separate files in `out/shots/`, one per beat, retaining that beat's internal camera cuts. Put them in numerical order in a 2560 x 1440, 60 fps Premiere sequence. Clips are frame-exact and have no handles or audio. Swap clip 12 for the existing logo intro.

To exercise the actual encoder without rendering the video:

```powershell
& $blender -b -t 8 -P '.scratch/ad-story/make_ad.py' -- --render final --probe
& $blender -b -t 8 -P '.scratch/ad-story/make_ad.py' -- --render shots --probe
& $blender -b -t 8 -P '.scratch/ad-story/make_ad.py' -- --check
```

`--probe` starts the chosen video path, writes exactly its first frame, and stops normally. These tiny test MP4s may stay in local `out/` and `out/shots/`. They are not finished deliverables. The cut check evaluates every frame for exactly one active camera and no visible objects from another beat; it also checks the isolated end slot.

## Shots to replace later

| Beat | Filmed or AI-video replacement |
|---|---|
| 1 | A hand opening a real closet, revealing a dusty beige PC on a shelf |
| 3 | A hand plugging in the USB stick; real amber power light; real J boot splash |
| 4 | A phone approaching the monitor and scanning the QR; composite the real setup screen |
| 5 | Slow dolly past the real PC in a warm room, with a lamp and plant shadows |
| 7 | Keep the playful 3D, or film the actual spare laptop, office PC and mini PC |
| 8 | Real drives sliding into bays, followed by the existing animated mirror state |

Keep the real screen captures over replacement footage. Avoid invented UI or install success states.

## Review limits

Stills establish framing and legibility, not full-speed pacing. Claude should render and watch the complete cut and all 12 clips, check every fast move for motion-blur artifacts, and review the final 1440p screen sharpness before handing the files to Premiere. Low-sample stills can show shadow grain. The existing logo end card also needs checking in the assembled Premiere sequence.
