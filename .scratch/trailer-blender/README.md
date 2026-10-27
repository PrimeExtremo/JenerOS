# JenerOS launch trailer v3 (PROMPT-5)

`trailer.blend` is the editable 60 fps project. The 57.68-second voiceover drives
28 cuts across the 14 requested chapters. The placeholder edit is 63.5 seconds,
including a six-second end card. The original PRO project and builder are kept
as `trailer-pro.blend` and `build_trailer_pro.py`.

## Build and watch

Run from the repository root with the existing Blender installation:

```powershell
$blender = 'C:/Program Files/Blender Foundation/Blender 5.2/blender.exe'
$builder = '.scratch/trailer-blender/build_trailer.py'
& $blender -b --python-exit-code 1 -P $builder
```

The entry point runs `build_v3.py`, which reuses the PRO geometry and materials.
It measures the VO first, builds chapters 1-7, then 14, 8, 9, 11, 13, 10, 12,
and analyzes/retimes to the song last if it exists. Each completed shot is saved
to a temporary blend and atomically replaces `trailer.blend`. The existing live
watcher can reload these checkpoints. `LIVE.html` includes the new stills.
Use `--no-preview` to omit ordinary stills during a rebuild.

The saved project packs fonts, real UI screenshots and the original generated
family photo. `assets/family-photo-prompt.txt` records its prompt and provenance.
The UI readings are samples. App Store art explicitly says Coming soon.

Collections and timeline markers name every cut. Headline text uses Bricolage.
Transforms, cut visibility, camera paths and focus targets are editable keys;
no playback handlers are required. The physical set is scaled to 20 cm per unit.
Both cameras have 62 mm lenses, keyed focus, f/2.8-4 and motion blur. The portrait
camera preserves the landscape composition rather than cropping off captions.

## Timing and retiming

- `voiceover/lines.json`: each script paragraph's measured start/end, speech
  islands and shorter editorial cues.
- `voiceover/envelope.json`: the 10 ms RMS analysis summary and >=250 ms silences.
- `music/beats.json`: the beat-grid format used by the website, plus source,
  placeholder status, selected song in-point and analysis notes.
- `out/timing-guide.txt`: every shot's time range, frame range, VO line and beat.
- `out/shots.json`: machine-readable edit list. Frame ends are exclusive here.

Place VO at 00:00.000 in Premiere. No audio is mixed into the Blender exports.
Paragraph starts use detected >=250 ms pauses, mapped to the script in order.
Interior cues use >=60 ms silence minima near script estimates. This is RMS
alignment, not speech recognition: check fine word sync by ear before final mix.
Cuts snap to the nearest beat, so picture may lead or trail speech by half a beat.

The song was absent when this edit was built. Drop
`music/falling-apart.mp3` or `music/falling-apart.wav` into this folder and run the
builder again. It uses Blender aud and numpy only: log spectral-flux STFT,
autocorrelation tempo, best onset phase, strongest four-beat phase, and the
largest sustained energy jump after 35% of the track. It chooses a downbeat
in-point covering the VO and ending, then remaps animation and visibility.
Downbeats are an acoustic estimate; review musical phrasing in Premiere.
The selected song in-point is printed in the timing guide. Short songs fail
instead of silently truncating the picture.

An externally corrected grid can be supplied on a full rebuild:

```powershell
& $blender -b --python-exit-code 1 -P $builder -- --beats '.scratch/trailer-blender/music/beats-reviewed.json'
```

Keep `beats`, `downbeats`, `drop`, `bpm` and `section_start` in that JSON; set
`placeholder` to false. Render commands always use timing packed in the blend.
The end card is recreated with the approved JENEROS paths, promise and URL.
Jener may replace the last six seconds with the supplied logo-intro MP4.

## Review without full video renders

```powershell
& $blender -b --python-exit-code 1 -P $builder -- --review-stills
& $blender -b --python-exit-code 1 -P $builder -- --still 12
& $blender -b --python-exit-code 1 -P $builder -- --still 12 --frame 1030
& $blender -b --python-exit-code 1 -P $builder -- --check-cuts
& $blender -b --python-exit-code 1 -P $builder -- --render final --check-only
& $blender -b --python-exit-code 1 -P $builder -- --render vertical --check-only
& $blender -b --python-exit-code 1 -P $builder -- --render shots --check-only
& $blender -b --python-exit-code 1 -P $builder -- --render final --probe
```

`--check-cuts` evaluates every master frame for exclusive render/viewport shot
visibility and projected headline/label collisions. It also checks fractional
times on both sides of shot cuts and delayed reveals, plus each shot's first
and last shutter exposure, including inactive light energy. Motion blur uses
START with a 0.4-frame shutter; keep the shutter below one frame so it cannot
sample the neighboring shot. Visibility keys must use CONSTANT interpolation.
It then renders stills one
frame before, on, and 12 frames after each cut into `live/v3/boundaries/`.
This geometric check complements visual inspection; it cannot establish the
quality of full-motion playback or prove that every pictured UI detail is readable.
`--probe` encodes exactly one 2560x1440 frame into `out/first-frame-probe.mp4`.
It never launches the full movie. `--check-only` writes no video.

## Full exports: Claude runs these

Large video output belongs on S:. No full renders are requested in PROMPT-5.

```powershell
$videoOutput = 'S:/[VMs]/[JENEROS-TRAILER]/v3'
& $blender -b --python-exit-code 1 -P $builder -- --render final --output-dir $videoOutput
& $blender -b --python-exit-code 1 -P $builder -- --render vertical --output-dir $videoOutput
& $blender -b --python-exit-code 1 -P $builder -- --render shots --output-dir $videoOutput
```

| Mode | Picture | FPS | Samples | Output |
|---|---|---|---|---|
| final | 2560x1440 | 60 | 32 | jeneros-trailer-final.mp4 |
| vertical | 1440x2560 | 60 | 32 | jeneros-trailer-vertical.mp4 |
| shots | 2560x1440 | 60 | 32 | shots/01-closet.mp4 through shots/28-brand.mp4 |
| draft | 960x540 | 60 | 8 | jeneros-trailer-draft.mp4 |

All modes use silent H.264/MPEG4, PERC_LOSSLESS, BEST and filter_size=1.0.
Blender 5 sets media_type=VIDEO before FFMPEG. Files are staged before replacement.
Without an output override the requested per-shot path is `out/shots/`; use S:
for actual full exports. There are no soundtrack strips or audio export channels.

See `REVIEW-v3.md` for the completed local checks and remaining review limits.
The live page shows the 28 current stills in story order. Its collapsed earlier
trailer is the pre-v3 video; no full v3 movie has been rendered.
