"""Small cut checks, including the word cards inside each numbered scene."""
import json
from pathlib import Path
import bpy

ROOT = Path(__file__).resolve().parent
bpy.ops.wm.open_mainfile(filepath=str(ROOT / 'trailer.blend'))
s = bpy.context.scene
s.camera = bpy.data.objects['CAMERA landscape']
s.render.resolution_x = 960
s.render.resolution_y = 540
s.render.resolution_percentage = 100
s.eevee.taa_render_samples = 4
s.render.image_settings.file_format = 'PNG'
out = ROOT / 'live' / 'boundaries'
out.mkdir(exist_ok=True)
cuts = sorted({int(o['shot_start']) for o in bpy.data.objects
               if 'shot_start' in o and 1 < o['shot_start'] <= s.frame_end})
report = []
timed=[o for o in bpy.data.objects if 'shot_start' in o]
for frame in range(1,s.frame_end+1):
    s.frame_set(frame)
    for o in timed:
        expected=o['shot_start'] <= frame < o['shot_end']
        assert (not o.hide_render) == expected, (frame,o.name,'render visibility')
        assert (not o.hide_viewport) == expected, (frame,o.name,'viewport visibility')
    windows={(o['shot_start'],o['shot_end']) for o in timed
             if not o.hide_render and not o.get('detail_reveal')}
    assert len(windows)==1, (frame,windows)
for cut in cuts:
    for offset in (-12, 0, 20):
        frame = cut + offset
        if not 1 <= frame <= s.frame_end: continue
        s.frame_set(frame)
        active = [c.name for c in bpy.data.collections
                  if any(o.type in {'MESH', 'FONT', 'CURVE'} and not o.hide_render
                         for o in c.objects) and c.name[:2].isdigit()]
        assert len(active) == 1, (frame, active)
        file = out / f'cut-{cut:04d}-{offset:+03d}.png'
        s.render.filepath = str(file)
        bpy.ops.render.render(write_still=True)
        report.append({'cut': cut, 'offset': offset, 'frame': frame,
                       'collections': active, 'file': file.name})
(out / 'report.json').write_text(json.dumps(report, indent=2))
print(f'Checked every frame for exclusive shot visibility; {len(cuts)} cuts, {len(report)} stills.', flush=True)
