# Marketing captures for jener.dev

Scripts that make the real screenshots and the preview videos for `[SITE]/`. Nothing here is published.

| File | What it does |
|---|---|
| `capture-shots.cjs` | Serves `[DASHBOARD]/` and takes 2x PNGs of 8 screens, dark and light, into `[SITE]/assets/shots/src/` |
| `store-catalog.json` | The real `[STORE]/apps` catalog as `/api/store` returns it, so the App Store shows its normal list |
| `make-webp.py` | PNG to WebP: 1280 px and 2560 px wide (phones 390 and 780) |
| `record-video.cjs` | Films `[SITE]/preview.html` frame by frame and encodes H.264 MP4s with ffmpeg |

## Run them

From the repo root, on Linux (the build VM works) with Node + Playwright, Python + Pillow and ffmpeg:

```bash
node .scratch/marketing/capture-shots.cjs          # all screens; or name some: dashboard store-discover
python3 .scratch/marketing/make-webp.py
node .scratch/marketing/record-video.cjs           # both cuts; or: wide / tall
```

## What the screens show

The dashboard runs from static files. `/api/*` answers come from the capture script in the same
shape jenerd sends: a 4-core box with 8 GB of memory, a 250 GB system disk, three empty data disks
(2 to 4 TB), JenerOS 0.1.0 "up to date", owner "jener", and the clock fixed at 9:41 AM on
2026-10-08. Every screen is real dashboard code; only the readings are sample values.
The preview page says so under its call to action.

To refresh `store-catalog.json` after the catalog changes, run a throwaway Go file inside `[CORE]`
(delete it afterwards) that calls `catalog.Load("../[STORE]/apps")`, wraps each manifest with
`"status": "not-installed"`, and prints the list as JSON.

## Videos

| File | Size | Use |
|---|---|---|
| `[SITE]/assets/video/jeneros-preview.mp4` | 1920x1080, 30 fps, H.264, about 40 s | YouTube, X, LinkedIn, the site |
| `[SITE]/assets/video/jeneros-preview-vertical.mp4` | 1080x1920, same | Shorts, Reels, TikTok |
| `jeneros-preview-poster.jpg`, `jeneros-preview-vertical-poster.jpg` | stills | thumbnails, `og:image` |

The recorder hides the site header and footer, loads every image, then for each frame sets the
scroll position, waits two animation frames and takes a screenshot that it pipes into ffmpeg
(`-c:v libx264 -preset slow -crf 19 -pix_fmt yuv420p -movflags +faststart`). It holds about
2.3 s on each screen once it has settled. The videos have no sound; add music in your editor if you like.
