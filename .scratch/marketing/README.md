# JenerOS captures and the beat-driven trailer

Run commands from the repo root. These are local tools; nothing deploys or publishes.

## Current status

The new page and timeline are ready to review. Its placeholder soundtrack is original sine
clicks, for timing tests only. No copyrighted recording or sound effect is included.
The MP4s/posters in `[SITE]/assets/video/` are **the earlier 30 fps tour**, not the new animation.
This Windows session has Edge and Node, but no ffmpeg. Recording was attempted and stopped
before replacing files. Do not present the earlier MP4s as the new trailer.

## Preview without installing anything

```powershell
node -e "require('./.scratch/marketing/browser.cjs').serve().then(s=>console.log(s.base+'/preview.html'))"
```

Open the printed URL. Append `?trailer=1&beats=assets/video/beats.json` for timed playback.
The browser page stays silent. It has Pause/Play, Replay, Still view and Skip to download.
Reduced motion always wins over trailer mode. Press Ctrl+C in the terminal to stop the server.
The helper applies the actual site CSP: scripts allowed only on `/preview` and `/preview.html`.

## Choose the audio, then analyze it

Only use a recording Jener has cleared for distribution. Jener runs any required installation:

```text
pip install librosa soundfile
python .scratch/marketing/beats.py song.mp3 > beats.json
```

Put the resulting JSON at `[SITE]/assets/video/beats.json`, or use a different local JSON URL.
Windows PowerShell 5 redirection writes UTF-16; use this form there to preserve JSON as UTF-8:

```powershell
python .scratch/marketing/beats.py song.mp3 | Set-Content -LiteralPath '[SITE]/assets/video/beats.json' -Encoding UTF8
```

Schema: `{ "bpm": number, "offset": seconds, "beats": [seconds], "downbeats": [seconds], "drop": seconds }`.
Times are absolute positions in the original audio. `beats.py` uses librosa's beat tracker and
onset strength, chooses the strongest averaged phase out of four for downbeats, and finds the
largest smoothed onset-energy increase after 40% for the drop. These are estimates: listen and
adjust the grid before release. Beat analysis needs at least 69 beats; allow 72 to cover all phases.
Errors go to stderr and exit nonzero, never a fake success grid. librosa extraction has not run here.

The story spans 68 beats. Its start is a downbeat chosen so the closing logo lands as close as
possible to the drop's nearest downbeat, while keeping a complete phrase in the supplied audio.
For early drops/short tracks, that may be the first full phrase. This is 43 seconds at 96 BPM;
other tempos change the duration. Around 92–136 BPM normally gives a 30–45 second cut.
Both aspect ratios use exactly the same phrase, audio offset and cue list.

## Record both cuts

Prerequisites: **Node 22+**, an installed **Chrome or Edge**, and **ffmpeg with libx264 and AAC**.
No Playwright or npm install is needed for the new recorder. It finds standard Chrome/Edge paths
on Windows; Linux defaults to `google-chrome`. If needed, point it at existing executables:

```powershell
$env:PREVIEW_BROWSER = 'C:/path/to/chrome.exe'
$env:FFMPEG = 'S:/path/to/ffmpeg.exe'
node .scratch/marketing/record-video.cjs all --audio='S:/path/to/cleared-song.wav'
```

Optional `wide` or `tall` replaces `all`. Optional `--beats=assets/video/my-beats.json` chooses
another same-origin beat grid. Without `--audio`, it muxes the supplied **test clicks**, so label
that export as a timing test. A too-short audio track or bad grid aborts instead of truncating the story.

| Output | Format |
|---|---|
| `jeneros-preview.mp4` | 1920×1080, 60 fps, H.264/AAC |
| `jeneros-preview-vertical.mp4` | 1080×1920, 60 fps, H.264/AAC |
| `jeneros-preview-poster.jpg`, `jeneros-preview-vertical-poster.jpg` | New hero stills |
| `sfx-cues.json` | `{time, type}` entries: boot, whoosh, pop, chime |

Files go into `[SITE]/assets/video/`. Frames are streamed to ffmpeg, not saved as a large sequence.
Each cut seeks the page to `frame / 60` before capture, with all images/fonts decoded. Capture mode
pauses the page clock and hides controls. Nothing relies on the speed of the recording computer.
Output is staged as `.pending.mp4`; the existing film is replaced only after ffmpeg succeeds and
the result is below 15,000,000 bytes. A 14 MB bitrate budget leaves container/audio headroom.
The mux uses `-shortest`, `loudnorm=I=-14:TP=-1.5:LRA=11`, a 0.5 s fade in and 1.5 s fade out.
Loudness is a target; verify the finished mix after adding music/SFX.

After **both** cuts succeed, watch them, verify their duration/audio sync, then remove "Earlier"
from the film link labels in `compose-preview.cjs` and regenerate the HTML. Update the status
paragraph in `[SITE]/README.md`. Never overwrite a chosen grid by running `make-timing.cjs` later.

## Test clicks, cues and frame access

```text
node .scratch/marketing/make-timing.cjs
```

This deliberately resets `beats.json` to 96 BPM / 0.5 s, writes matching `sfx-cues.json`, creates
`test-click.wav`, and regenerates the public preview QR using JenerOS's MIT QR encoder.
The QR links to `https://jener.dev/preview`; it contains no pairing code or local network address.
Clicks are 22 ms sine bursts, 880 Hz on downbeats and 660 Hz otherwise, with an exponential decay
and -30 dBFS peak. The script constructs an ffmpeg `aevalsrc` expression. If ffmpeg is missing,
it writes the equivalent PCM directly with Node. That fallback produced the checked-in test WAV.
The page does not load the WAV, MP4s or posters during normal playback.

`?trailer=1&capture=1` exposes deterministic access:

```js
await JenerTrailer.ready;
JenerTrailer.seek(12.5); // seconds, absolute within this cut; also pauses the clock
JenerTrailer.play();
JenerTrailer.cues;      // same list the recorder writes to assets/video/sfx-cues.json
JenerTrailer.audioStart;
```

In trailer mode the page emits `jeneros:sfx-cues` with the cue list as `event.detail` after loading
the grid. A browser cannot silently write repo files; the recorder is the filesystem exporter.
All scene changes and authored actions start on beat boundaries; letter micro-staggers occur
within that beat phrase. Wordmark assemblies finish on downbeats. Tiny chip refraction is an
optional effect; it never distorts the caption text. Pointer input is disabled during capture.

## Local checks

```text
node .scratch/marketing/check-preview.cjs
node .scratch/marketing/check-preview-budget.cjs
```

The first checks timeline math, reverse seeking, sticky scenes, real media preferences, themes,
360/780/1440/3440 widths, assets, JS-off, grid errors and CSP. The second checks full-tour page
weight, worst-case glass contrast, reduced transparency and scroll-progress fallback. Local
screenshots/reports go into ignored `shots/`. These checks use installed Edge/Chrome, not a VM.
They do not establish 60 fps on a mid laptop, Safari/Firefox behavior, hardware touch or screen-reader quality.

## Refresh the source screenshots

The original tools still apply. They need Playwright, Python/Pillow and the real dashboard:

```text
node .scratch/marketing/capture-shots.cjs
python .scratch/marketing/make-webp.py
```

`capture-shots.cjs` serves `[DASHBOARD]/` with sample `/api/*` responses and a fixed 9:41 clock.
The sample box has 8 GB RAM, a 250 GB system disk and three data disks. `store-catalog.json`
contains the real catalog. The page labels these readings and the illustrative animations.
`compose-preview.cjs` rebuilds the static story from that artwork and the real dashboard icon
sprite; it preserves the page header/footer. Run it after editing the composition source.
