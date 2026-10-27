"""Render only 960x540 low-sample stills; never write a movie or save the blend."""
import json
import sys
import time
from pathlib import Path
import bpy

ROOT=Path(__file__).resolve().parent
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'trailer.blend'))
s=bpy.context.scene
grid=json.loads(s['beat_grid'])
origin=s['audio_start_seconds']
raw=[v-origin for v in grid['beats'] if v>=origin]
def frame(beat):
    i=int(beat); part=beat-i
    return round((raw[i]+part*(raw[i+1]-raw[i]))*60)+1

shots={'scene-01':3.6,'scene-02':10.8,'scene-03':16,'scene-04':25.6,
       'scene-05':30,'scene-06':39,'scene-07':51,'scene-08':54.45,'scene-09':65.5,
       'pro-01-void':-.3,'pro-02-voxel-macro':.7,'pro-03-room':6,
       'pro-04-topbar-macro':8.12,'pro-05-screen-reveal':9.6,
       'pro-06-cpu-morph':19.85,'pro-07-qr-macro':22.5,'pro-08-phone':23.8,
       'pro-09-storage-morph':33.85,'pro-10-swap-crossing':49.9,
       'pro-11-icons-land':55.85,'pro-12-warm-flash':44,'pro-13-cream-words':46.8}
requested=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
if requested: shots={name:shots[name] for name in requested}
s.render.resolution_x=960; s.render.resolution_y=540; s.render.resolution_percentage=100
s.eevee.taa_render_samples=12; s.render.image_settings.media_type='IMAGE'; s.render.image_settings.file_format='PNG'
s.camera=bpy.data.objects['CAMERA landscape']
times={}
for name,beat in shots.items():
    f=12 if beat<0 else frame(beat); s.frame_set(f)
    s.render.filepath=str(ROOT/'live'/f'{name}.png')
    t=time.monotonic(); bpy.ops.render.render(write_still=True)
    times[name]={'frame':f,'seconds':round(time.monotonic()-t,2)}
    print('PRO STILL',name,times[name],flush=True)
report=ROOT/'live'/'pro-render-times.json'
previous=json.loads(report.read_text()) if report.exists() else {}
previous.update(times); report.write_text(json.dumps(previous,indent=2))
