import bpy, os
from pathlib import Path
root=Path(__file__).resolve().parent
bpy.ops.wm.read_factory_settings(use_empty=True)
s=bpy.context.scene
print('ENGINES', [x.identifier for x in s.bl_rna.properties['render'].fixed_type.properties] if False else [x.identifier for x in s.render.bl_rna.properties['engine'].enum_items])
s.world=bpy.data.worlds.new('Warm dark world'); s.world.color=(0.018,0.010,0.007)
s.render.fps=60; s.frame_start=1; s.frame_end=2580
bpy.ops.object.camera_add(location=(0,0,12)); s.camera=bpy.context.object
s.camera.data.type='ORTHO'; s.camera.data.ortho_scale=12
bpy.ops.object.text_add(location=(0,0,0)); o=bpy.context.object; o.name='Building'; o.data.body='JenerOS\nBuilding...'; o.data.align_x='CENTER'; o.data.size=.8
bpy.ops.object.text_add(location=(-7,4,0)); o=bpy.context.object; o.name='STATUS'; o.data.body='Step 1: Building the live trailer'; o.data.size=.3; o.hide_render=True
for a in bpy.context.screen.areas if bpy.context.screen else []:
    if a.type=='VIEW_3D': a.spaces.active.region_3d.view_perspective='CAMERA'
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(root/'trailer.tmp.blend'),copy=True)
os.replace(root/'trailer.tmp.blend',root/'trailer.blend')
