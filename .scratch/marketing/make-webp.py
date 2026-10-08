# Turn the PNG captures into WebP for the site: a 1x-ish and a 2x size per screen.
# Run from the repo root: python3 .scratch/marketing/make-webp.py  (needs Pillow)
from pathlib import Path
from PIL import Image

src = Path('[SITE]/assets/shots/src')
out = Path('[SITE]/assets/shots')
for png in sorted(src.glob('*.png')):
    im = Image.open(png).convert('RGB')
    phone = png.stem.startswith('phone')
    for width, quality, suffix in ((390 if phone else 1280, 86, ''), (780 if phone else 2560, 82, '@2x')):
        w = min(width, im.width)
        small = im.resize((w, round(im.height * w / im.width)), Image.LANCZOS)
        dest = out / f'{png.stem}{suffix}.webp'
        small.save(dest, 'WEBP', quality=quality, method=6)
        print(f'{dest.name:34} {small.width}x{small.height} {dest.stat().st_size // 1024} KB')
