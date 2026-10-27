"""Three portrait stills; does not encode any animation."""
import json,runpy,sys
from pathlib import Path
import bpy
root=Path(__file__).resolve().parent
sys.argv=[sys.argv[0],'--','--render','vertical','--check-only']
runpy.run_path(str(root/'build_v3.py'),run_name='__main__')
s=bpy.context.scene
s.render.resolution_x=360;s.render.resolution_y=640
s.render.image_settings.media_type='IMAGE';s.render.image_settings.file_format='PNG';s.eevee.taa_render_samples=8
for q in json.loads(s['v3_shots']):
    if q['cue'] not in ('scan','recap','brand'):continue
    s.frame_set(round(q['a']+.85*(q['b']-q['a'])))
    s.render.filepath=str(root/f"live/v3/portrait-{q['cue']}.png")
    bpy.ops.render.render(write_still=True)
