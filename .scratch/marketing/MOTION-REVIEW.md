# Cinematic preview review, 2026-10-08

Status: ready-for-human

## What changed

Nine sticky features replace the earlier six repeated screen entrances. The same choreography
runs from scroll progress or a beat clock. Original JenerOS lettering, ribbons, icon paths and
screenshots remain the visual sources. No framework, runtime dependency, CDN or WebGL.

| Beat range | Scene and principal action |
|---|---|
| 0–8 | Box boot, screen rise/tilt, letters assemble and land on beat 4 |
| 8–12 | Top-bar crop, camera glide over glossy app tiles |
| 12–20 | “Your stuff.”, tile grows into a CPU widget, “Lives at home.” |
| 20–28 | “Set up / from your phone.”, phone, QR line, Connected pill |
| 28–32 | Dashboard flips into Settings, sidebar highlight moves |
| 32–44 | “Storage”, disks drop, mirror fills, ready pill lands on beat 40 |
| 44–52 | “Updates / that undo themselves.”, two systems exchange places |
| 52–60 | “Your own / app store.”, tiles fan out then stack |
| 60–68 | Five screens orbit into a stack, logo lands on beat 64, buttons rise |

Default music grid: 96 BPM, 0.5 s offset, final logo at 40.5 s, ending at 43 s.
The clock starts major actions on beats; letter micro-staggers stay within the phrase.
Scroll uses those same actions with native scrolling. The native CSS scroll timeline drives the
progress line; the 3D narrative uses one rAF/IntersectionObserver path in all browsers so it can
share the recorder's deterministic renderer. Near/far ribbons, a small camera drift and highlights
continue during a visible scene. Offscreen and hidden-document work stops. Will-change belongs
only to active scenes. Blur is confined to the small far icons; SVG displacement affects chip
backgrounds, not text. No filters on full-screen layers.

## Design guidance

Read `.scratch/motion/BRIEF.md` and the local motion-design/apple-design skills (including motion,
glass, accessibility, typography, layout, color and cross-platform references). Used Impeccable's
published [skill](https://github.com/pbakaus/impeccable/blob/main/.agents/skills/impeccable/SKILL.md),
[animate](https://github.com/pbakaus/impeccable/blob/main/.agents/skills/impeccable/reference/animate.md)
and craft-floor guidance; its launcher is not installed here. The supplied request authorizes
longer trailer entrances, large gradient word cards and a richer glass treatment. Motion curves
remain the JenerOS signature/entrance/pop curves; overshoot is reserved for small joyful moments.
PRODUCT.md still contains older monochrome and implementation-status statements. Current user
instructions and handoff section 4 take precedence; PRODUCT.md was not rewritten as a side task.

## Verified

- Installed Edge/Chromium: 360×800, 780×360, 1440×900 and 3440×1440, both themes.
- Every quarter-second of the trailer: one current scene, finite transforms, reverse seek determinism.
- Nine sticky scroll stages, visible final actions, no leaking actions from inactive trailer scenes.
- Real reduced-motion media changes produce the still grid and cancel the loop. Reduced-transparency
  removes refraction. JS-off retains all captions; no horizontal overflow.
- Same-origin beat validation and external-grid refusal/fallback. Irregular beats and shifted
  downbeat phase work. Cues come from the selected grid, not a separate hand-timed file.
- Local server applies the preview CSP; zero CSP violations or browser exceptions. `_headers` unchanged.
- Full-tour decoded resource weight: about 525 KB at 1440@2x, 322 KB at 360@3x. Videos/test WAV
  are not loaded by the page. Limit 2 MB. Glass text contrast against worst-case composited black/white:
  12.95:1 dark and 12.73:1 light. Calculations cover settled text, not transitional opacity.
- Offscreen shutdown and modeled document-hidden event; JS progress fallback. JavaScript syntax,
  Python syntax via an already installed Python, and `git diff --check` pass.
- Desktop/phone captured frames were inspected, including boot, macro, CPU, phone, storage and finale.

## Remaining checks / limits

No ffmpeg exists in the local search paths. Recorder preflight was attempted and preserved the old
MP4s/posters. The new 60 fps H.264/AAC encode, 15 MB cap, mux/fades and loudness therefore need a
real run using README commands. Test WAV was generated with the equivalent Node sine-burst fallback.
Python/librosa beat detection itself is untested; only syntax passed. A licensed track is still needed.

Check real 60 fps on a mid laptop, hardware phone scrolling, keyboard/screen readers, and Safari/Firefox
small-glass fallback. Headless layout checks are not a GPU frame-rate benchmark. Browser support for
SVG refraction varies; losing it should leave the tinted chip and readable text.

`git pull --ff-only` failed because `.git/FETCH_HEAD` is not writable in this session. Local HEAD is
`fd52661`, the merge of PR #8, on `zimaos-style`. No commits, pushes, deploys, installs or VM operations.
