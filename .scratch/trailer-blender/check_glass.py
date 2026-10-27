"""Material look-development stills; leaves the live blend unchanged."""
from pathlib import Path
import bpy
ROOT=Path(__file__).resolve().parent
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'trailer.blend'))
s=bpy.context.scene; s.frame_set(169)
s.render.resolution_x=960; s.render.resolution_y=540; s.render.resolution_percentage=100
s.eevee.taa_render_samples=16; s.render.image_settings.file_format='PNG'
p=bpy.data.materials['Amber optical glass'].node_tree.nodes.get('Principled BSDF')
for name,trans in [('glass-no-haze',.92),('glass-shader',.92),('glass-no-rays',.92)]:
    p.inputs['Transmission Weight'].default_value=trans
    bpy.data.materials['Amber optical glass'].use_raytrace_refraction=True
    bpy.data.materials['Amber optical glass'].thickness_mode='SLAB'
    bpy.data.materials['Amber optical glass'].surface_render_method='DITHERED'
    for o in bpy.data.objects:
        if 'atmosphere' in o.name.lower() and o.type=='MESH': o.hide_render=True
    if name=='glass-shader':
        mat=bpy.data.materials['Amber optical glass']; g=mat.node_tree
        glass=g.nodes.new('ShaderNodeBsdfGlass'); glass.inputs['Color'].default_value=(.8,.53,.3,1)
        glass.inputs['Roughness'].default_value=.065; glass.inputs['IOR'].default_value=1.45
        g.links.new(glass.outputs[0],g.nodes.get('Material Output').inputs['Surface'])
    if name=='glass-no-rays': s.eevee.use_raytracing=False
    s.render.use_motion_blur=False
    s.render.filepath=str(ROOT/'live'/f'{name}.png')
    bpy.ops.render.render(write_still=True)
