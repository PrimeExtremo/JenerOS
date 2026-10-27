JenerOS LAUNCH TRAILER v3 in Blender: the PRO trailer's camera work + the umbrelOS 2.0 video's storytelling, timed to a voiceover and a song. Work in `.scratch/trailer-blender/` (the pro trailer: `build_trailer.py`, `trailer.blend`). Jener's favorite is the PRO version (smooth, lots of camera work). Keep that quality and camera language, and restructure the story.

## Inputs (read these; don't re-read other docs)
- `REFERENCE-UMBREL.md`: a second-by-second breakdown of the WHOLE umbrelOS 2.0 video (146 s), plus the contact sheets `ref/umbrel/sheet_01..05.jpg` (one frame per second for the entire video; LOOK at all five). Make ours SUPER similar in structure, pacing, shot types and variety (copy grammar only, never Umbrel's text, UI, logos or assets).
- `REFERENCE-WIN11.md` + `ref/win11/*.jpg`: lens and camera tricks.
- VOICEOVER: `voiceover/jeneros-vo-v3.mp3` (ElevenLabs, about 60 s) and its script `voiceover/script-v3.txt`. Every visual follows the words: when she says "photos", we see photos; "scan the code", the phone scans the QR; "two copies", the two disks; "rolls back", the A/B swap; "no paid tier / no disk limits / no user limits", three big kinetic word cards; "landfill", old PCs saved. Detect each line's start time yourself from the audio (Blender's `aud` module + numpy: RMS envelope, silences over 250 ms). Write the timings to `voiceover/lines.json` and drive the shots from them.
- SONG: OTE "Falling Apart" (Jener has the artist's OK). Jener puts the file at `music/falling-apart.mp3` (or .wav). If it isn't there yet, build against the voiceover timing and a 96 BPM placeholder, and keep everything re-timable. When the song is present: detect tempo, beats, downbeats and the drop yourself in numpy (onset strength from the spectral flux of an STFT, tempo by autocorrelation, beat phase by best alignment, drop = biggest sustained energy jump after 35%). Write `music/beats.json` in the same format as `[SITE]/assets/video/beats.json`. Cuts land on beats, big reveals on downbeats or the drop, and the VO sits on top. Pick a song section about as long as the VO plus the end card. Don't mix the audio into the video; Jener mixes in Premiere. Do export `out/timing-guide.txt` listing each shot with its time, the VO line and the beat.

## Story (follow the VO; Umbrel-style variety)
Real-world warmth, then the UI on real screens, then playful 3D, then kinetic words, then a bento recap, then the end card. Shot types to include (all Umbrel-style):
1. A cozy, sunlit room at golden hour, plant shadows on the wall; the closet door opens to a dusty old PC (DOF, slow push).
2. Kinetic words that pop in word by word, with a gradient keyword ("It's not junk." / "your new cloud").
3. A photo card flies out (a real photo-like card with a JenerOS-style frame) and travels to the PC at home: Umbrel's "10 ft" idea, told our way ("at home, not on someone else's computer").
4. A macro: a USB stick plugs into the old PC, the power LED, the J splash on the monitor.
5. The box screen QR, a whip pan, the phone in a hand (simple stylized hand/arm OK) shows setup, "Connected".
6. Three quick word cards: "No keyboard." "No commands." "No account."
7. The dashboard on the monitor in the room (the existing room-reveal shot), a macro across glossy app icons.
8. Storage: two drives slide into bays in macro; the mirror bar fills; "Lose a drive? Nothing's lost."
9. Updates: A/B glass slabs, a speed ramp, a check mark, "rolls back".
10. App Store: a 3D icon wall slides (our tile icons, extruded and glossy), honestly labeled "Coming soon".
11. "No paid tier." "No disk limits." "No user limits." Big, each on its own beat and color (these ARE verified differences; see Facts).
12. Old laptops and office PCs tumble in 3D through soft foliage with labels, then "one less computer in a landfill".
13. A BENTO GRID recap of all features flies in.
14. The end card: leave 6 s for `.scratch/logo-intro/out/jeneros-logo-intro-1440p.mp4` (or recreate it inside if easy).

## Quality bar (Jener's complaints about the last ad: fix all of them)
- NO OVERLAPS: run a cut check over every frame (objects of the previous shot gone; no text over text or panels). Render boundary stills and look.
- More DETAIL, less "smooth blob" modeling: bevels plus real surface detail (screws, vents, ports, seams, LED, label text, drive connectors), materials with roughness variation or a noise bump, and small props (cables, a plant, books, a mug) in the room. Old PCs should look like real beige/black 2010s towers and laptops, not rounded soap bars.
- Camera never stops; DOF with the hero always sharp (f/2.8-4, keyed focus); motion blur; flashes, whip pans and rack focus as in the PRO version.
- Real screenshots for all UI (`[SITE]/assets/shots/src/*.png`). Bricolage for headlines (`assets/BricolageGrotesque-Bold.ttf`). Our palette only.

## Facts you may say (Claude verified these on the web; say nothing else as "only JenerOS")
- ZimaOS's free tier is capped at 4 disks and 3 users (a $29 Plus license removes the caps). umbrelOS sells hardware but is also free to self-install. So we may say "No paid tier. No disk limits. No user limits." but NOT "the only free one".
- umbrelOS and ZimaOS also have A/B updates with rollback, so present rollback as a feature, not as unique.
- JenerOS strengths to lead with: built for OLD PCs (e-waste), setup by scanning a QR code on the box's own screen, no account, everything free.

## Output and budget
- Keep the existing `--render final|vertical` and add `--render shots` (one mp4 per shot into `out/shots/`). 2560x1440, 60 fps, PERC_LOSSLESS, BEST, `filter_size=1.0`, silent. Blender 5 needs `media_type='VIDEO'` before FFMPEG. Do NOT run the full renders; Claude does. Probe the first frame only.
- Build incrementally with atomic saves (Jener may watch live) and low-sample stills per shot.
- Order: VO timing, then shots 1-7, then 14, 8, 9, 11, 13, 10, 12, then the song re-time (if the file exists).
- README: render commands, how to re-time to the song. Append to `[DOCS]/AI-UPDATES.md`. Files only, no commits.
