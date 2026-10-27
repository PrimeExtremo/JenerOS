"""JenerOS editable, beat-timed trailer. Run with Blender -b -P this_file -- --help.

Every construction primitive publishes an atomic live checkpoint. No handlers are
needed for playback: transforms, visibility, ring growth and cameras are keyed.
"""
import argparse
import json
import math
import os
from pathlib import Path
import re
import subprocess
import sys
import time
import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parent
REPO = ROOT.parents[1]
LIVE = ROOT / 'live'
ASSETS = ROOT / 'assets'
PYTHON = Path(bpy.app.binary_path).parent / '5.2/python/bin/python.exe'
FPS = 60
SEGMENTS = [('Second life', 8), ('Your stuff', 4), ('Lives at home', 8),
            ('Set up from your phone', 8), ('Make it yours', 4), ('Storage', 12),
            ('Updates that undo themselves', 8), ('Your own app store', 8), ('Yours', 8)]
parser = argparse.ArgumentParser()
parser.add_argument('--only', choices=['scene'+str(i) for i in range(1,10)])
parser.add_argument('--beats', type=Path, help='Beat grid for a full rebuild; loaded files keep their packed timing')
parser.add_argument('--render', choices=['draft', 'final', 'vertical'])
parser.add_argument('--check-only', action='store_true', help='Validate --render settings without rendering or writing video')
parser.add_argument('--output-dir', type=Path, help='Video destination, preferably on S:')
parser.add_argument('--still', type=int, choices=range(1,10))
parser.add_argument('--frame', type=int)
parser.add_argument('--no-preview', action='store_true')
args = parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
if args.check_only and not args.render: parser.error('--check-only requires --render')
LIVE.mkdir(exist_ok=True); ASSETS.mkdir(exist_ok=True)
grid = json.loads((args.beats or REPO/'[SITE]/assets/video/beats.json').read_text(encoding='utf-8-sig'))


def timing(value):
    global BEATS,END,origin
    raw=value['beats']; downs=value['downbeats']
    assert len(raw)>=69 and all(math.isfinite(x) and x>=0 for x in raw)
    assert all(b>a for a,b in zip(raw,raw[1:]))
    assert downs and all(any(abs(d-b)<.002 for b in raw) for d in downs)
    drop=min(downs,key=lambda d:abs(d-value['drop']))
    drop_i=min(range(len(raw)),key=lambda i:abs(raw[i]-drop))
    candidates=[i for i,b in enumerate(raw[:-68]) if any(abs(b-d)<.002 for d in downs)]
    assert candidates, 'Need a full 68-beat phrase beginning on a downbeat'
    first=min(candidates,key=lambda i:abs(i-(drop_i-64)))
    origin=raw[first] if first else 0
    BEATS=[b-origin for b in raw[first:first+69]]
    END=round(BEATS[-1]*FPS)


timing(grid)
STARTS = [0]
for _,length in SEGMENTS: STARTS.append(STARTS[-1]+length)
S = None
COL = None
CURRENT = 0
WINDOW = (1, END+1)
SAVE_COUNT = 0

def f(beat):
    if beat == 0: return round(BEATS[0]*FPS)+1
    i = int(beat); fract = beat-i
    return round((BEATS[i] if not fract else BEATS[i]+fract*(BEATS[i+1]-BEATS[i]))*FPS)+1

def log(message, image=None, video=None, step=None):
    cmd=[str(PYTHON),str(ROOT/'live.py'),message]
    if step: cmd += ['--step',step]
    if image: cmd += ['--image',image]
    if video: cmd += ['--video',video]
    subprocess.run(cmd,check=True,stdout=subprocess.DEVNULL)
    print(message,flush=True)

def save(message):
    global SAVE_COUNT
    bpy.context.preferences.filepaths.save_version=0
    status=bpy.data.objects.get('STATUS')
    if status: status.data.body=message
    S['build_status']=message
    S['beat_grid']=json.dumps(grid)
    S['audio_start_seconds']=origin
    S.frame_start=1; S.frame_end=END; S.render.fps=FPS
    S.render.resolution_x=1920; S.render.resolution_y=1080
    S.render.resolution_percentage=100
    bpy.ops.file.pack_all()
    bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'trailer.tmp.blend'),copy=True)
    os.replace(ROOT/'trailer.tmp.blend',ROOT/'trailer.blend')
    SAVE_COUNT+=1

def curves(owner):
    if not owner.animation_data or not owner.animation_data.action: return []
    action=owner.animation_data.action
    return [fc for layer in action.layers for strip in layer.strips
            for bag in strip.channelbags for fc in bag.fcurves]

def smooth(owner):
    for fc in curves(owner):
        for k in fc.keyframe_points:
            if fc.data_path in ('hide_render','hide_viewport'): k.interpolation='CONSTANT'
            else:
                k.interpolation='BEZIER'; k.handle_left_type='AUTO_CLAMPED'; k.handle_right_type='AUTO_CLAMPED'


def ease_out(owner, prop):
    # A quick, soft arrival with zero terminal velocity; never a linear entrance.
    for fc in curves(owner):
        if fc.data_path != prop: continue
        keys=list(fc.keyframe_points)
        for left,right in zip(keys,keys[1:]):
            dt=right.co.x-left.co.x; dv=right.co.y-left.co.y
            left.interpolation='BEZIER'
            left.handle_right_type='FREE'; right.handle_left_type='FREE'
            left.handle_right=(left.co.x+dt/3,left.co.y+dv*.8)
            right.handle_left=(right.co.x-dt/3,right.co.y)

def key(o,prop,value,frame):
    setattr(o,prop,value); o.keyframe_insert(data_path=prop,frame=frame)

def visibility(o, start=None,end=None):
    a,b=WINDOW if start is None else (start,end)
    o['shot_start']=a; o['shot_end']=b
    # A delayed reveal replaces its construction-time visibility completely.
    # Leaving an earlier False key makes labels appear before their intended cue.
    for fc in curves(o):
        if fc.data_path in ('hide_render','hide_viewport'): fc.keyframe_points.clear()
    for prop in ('hide_render','hide_viewport'):
        key(o,prop,True,0); key(o,prop,False,a); key(o,prop,True,b)
    smooth(o)

def finish(o):
    if COL:
        for c in list(o.users_collection): c.objects.unlink(o)
        COL.objects.link(o)
        visibility(o)
    S.frame_set(min(WINDOW[0]+60,WINDOW[1]-1))
    save(f'Scene {CURRENT} of 9: {o.name}')
    return o

def material(name,color,metal=0,rough=.35,emission=0):
    m=bpy.data.materials.get(name)
    if m: return m
    m=bpy.data.materials.new(name); m.diffuse_color=(*color,1); m.use_nodes=True
    p=m.node_tree.nodes.get('Principled BSDF'); p.inputs['Base Color'].default_value=(*color,1)
    p.inputs['Metallic'].default_value=metal; p.inputs['Roughness'].default_value=rough
    p.inputs['Emission Color'].default_value=(*color,1); p.inputs['Emission Strength'].default_value=emission
    return m


def rgb(value):
    values=[int(value[i:i+2],16)/255 for i in (1,3,5)]
    return tuple(c/12.92 if c <= .04045 else ((c+.055)/1.055)**2.4 for c in values)


def ink(name, color):
    m=bpy.data.materials.get(name)
    if m: return m
    m=bpy.data.materials.new(name); m.use_nodes=True; m.diffuse_color=(*rgb(color),1)
    n=m.node_tree.nodes; n.clear(); em=n.new('ShaderNodeEmission'); out=n.new('ShaderNodeOutputMaterial')
    em.inputs['Color'].default_value=(*rgb(color),1)
    m.node_tree.links.new(em.outputs[0],out.inputs['Surface'])
    return m

def box(name,loc,size,mat,radius=.12):
    if radius >= .2:
        w,h,d=size; r=min(radius,w/2,h/2); ring=[]
        for cx,cy,base in [(w/2-r,h/2-r,0),(-w/2+r,h/2-r,90),(-w/2+r,-h/2+r,180),(w/2-r,-h/2+r,270)]:
            for i in range(9):
                angle=math.radians(base+i*90/8); ring.append((cx+r*math.cos(angle),cy+r*math.sin(angle)))
        count=len(ring); verts=[(x,y,z) for z in (-d/2,d/2) for x,y in ring]
        faces=[tuple(reversed(range(count))),tuple(range(count,2*count))]
        faces += [(i,(i+1)%count,(i+1)%count+count,i+count) for i in range(count)]
        mesh=bpy.data.meshes.new(name); mesh.from_pydata(verts,[],faces)
        o=bpy.data.objects.new(name,mesh); S.collection.objects.link(o); o.location=loc
    else:
        bpy.ops.mesh.primitive_cube_add(size=1,location=loc); o=bpy.context.object; o.name=name
        o.dimensions=size; bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    bevel=o.modifiers.new('Soft machined edges','BEVEL'); bevel.width=radius; bevel.segments=5
    o.modifiers.new('Weighted highlights','WEIGHTED_NORMAL')
    o.data.materials.append(mat)
    if mat == GLASS:
        o.data.materials.append(EDGE); bevel.material=1; bevel.width=min(radius,.025 if radius >= .2 else .055)
    return finish(o)

def empty(name):
    o=bpy.data.objects.new(name,None); S.collection.objects.link(o)
    if COL:
        S.collection.objects.unlink(o); COL.objects.link(o)
    return o

def group_since(name,before):
    root=empty(name)
    for o in list(COL.objects):
        if o.name not in before and o!=root and o.parent is None: o.parent=root
    return root

def rise(o,a,b=None,amount=.65):
    b=b or min(a+48,WINDOW[1]-1)
    target=o.location.copy()
    key(o,'location',target-Vector((0,amount,0)),a)
    key(o,'location',target,b)
    smooth(o); ease_out(o,'location')

def text(name,body,loc,size=.6,width=None,mat=None,accent=None):
    bpy.ops.object.text_add(location=loc); o=bpy.context.object; o.name=name
    o.data.body=body; o.data.align_x='CENTER'; o.data.align_y='CENTER'
    o.data.size=size; o.data.space_line=1.12; o.data.extrude=.001; o.data.bevel_depth=0
    o.data.font=FONT if size >= .38 else BODY_FONT; o.data.materials.append(mat or CREAM)
    if mat is None:
        accent=accent or (body.rsplit(' ',1)[-1] if ' ' in body else None)
        if accent and accent in body:
            o.data.materials.append(ACCENT); start=body.rfind(accent)
            for char in o.data.body_format[start:start+len(accent)]: char.material_index=1
    bpy.context.view_layer.update()
    if width and o.dimensions.x>width: o.scale *= width/o.dimensions.x
    return finish(o)

def image_material(path):
    name='Image: '+path.name
    m=bpy.data.materials.get(name)
    if m: return m
    m=bpy.data.materials.new(name); m.use_nodes=True
    n=m.node_tree.nodes; n.clear(); out=n.new('ShaderNodeOutputMaterial'); em=n.new('ShaderNodeEmission')
    tex=n.new('ShaderNodeTexImage'); tex.image=bpy.data.images.load(str(path),check_existing=True)
    em.inputs['Strength'].default_value=.85
    m.node_tree.links.new(tex.outputs['Color'],em.inputs['Color']); m.node_tree.links.new(em.outputs[0],out.inputs['Surface'])
    return m

def rounded_image(name,path,loc,w,h,r=.1,uv=(0,0,1,1)):
    verts=[(0,0,0)]
    for cx,cy,base in [(w/2-r,h/2-r,0),(-w/2+r,h/2-r,90),(-w/2+r,-h/2+r,180),(w/2-r,-h/2+r,270)]:
        for k in range(9):
            angle=math.radians(base+k*90/8)
            verts.append((cx+r*math.cos(angle),cy+r*math.sin(angle),0))
    faces=[(0,i,1 if i==len(verts)-1 else i+1) for i in range(1,len(verts))]
    mesh=bpy.data.meshes.new(name); mesh.from_pydata(verts,[],faces); mesh.uv_layers.new()
    for p in mesh.polygons:
        for li in p.loop_indices:
            x,y,_=verts[mesh.loops[li].vertex_index]
            mesh.uv_layers.active.data[li].uv=(uv[0]+(x/w+.5)*(uv[2]-uv[0]),uv[1]+(y/h+.5)*(uv[3]-uv[1]))
    o=bpy.data.objects.new(name,mesh); S.collection.objects.link(o); o.location=loc
    mesh.materials.append(image_material(path)); return finish(o)

def panel(name,shot,loc=(0,-.2,0),width=10.5,phone=False,uv=(0,0,1,1),height=None):
    before=set(o.name for o in COL.objects)
    path=shot if isinstance(shot,Path) else REPO/'[SITE]/assets/shots/src'/f'{shot}.png'
    img=bpy.data.images.load(str(path),check_existing=True)
    h=height or width*img.size[1]/img.size[0]*(uv[3]-uv[1])/(uv[2]-uv[0])
    x,y,z=loc
    box(name+' glass rim',(x,y,z-.08),(width+.075,h+.075,.17),FRAME,.06)
    box(name+' smoked back',(x,y,z-.13),(width+.08,h+.08,.17),DARK,.1)
    rounded_image(name+' screen',path,(x,y,z+.035),width,h,min(.1,width*.045),uv)
    if phone: box(name+' earpiece',(x,y+h/2-.08,z+.05),(.35,.04,.02),DARK,.02)
    root=group_since(name,before); rise(root,WINDOW[0],amount=.32); save(f'Scene {CURRENT}: {name} rise and glass'); return root

def line(name,points,mat,thick=.025):
    cu=bpy.data.curves.new(name,'CURVE'); cu.dimensions='3D'; cu.bevel_depth=thick; cu.bevel_resolution=3
    sp=cu.splines.new('POLY'); sp.points.add(len(points)-1)
    for p,co in zip(sp.points,points): p.co=(*co,1)
    o=bpy.data.objects.new(name,cu); S.collection.objects.link(o); cu.materials.append(mat); return finish(o)

def logo(name,loc,width=7,assemble=False):
    # Read the approved SVG path geometry, including the original counters.
    import xml.etree.ElementTree as ET
    tree=ET.parse(REPO/'[BRAND]/logo/jeneros-wordmark-light.svg')
    paths=[]
    def walk(el,tx=0,ty=0,scale=1):
        tr=el.attrib.get('transform','')
        t=re.search(r'translate\(([-\d.]+)[ ,]+([-\d.]+)\)',tr)
        if t: tx+=float(t[1])*scale; ty+=float(t[2])*scale
        sc=re.search(r'scale\(([-\d.]+)\)',tr)
        if sc: scale*=float(sc[1])
        if el.tag.endswith('path'): paths.append((el.attrib['d'],tx,ty,scale))
        for ch in el: walk(ch,tx,ty,scale)
    walk(tree.getroot()); factor=width/1472
    for idx,(d,tx,ty,sc) in enumerate(paths):
        cu=bpy.data.curves.new(name+str(idx),'CURVE'); cu.dimensions='2D'; cu.fill_mode='BOTH'; cu.extrude=.006
        tokens=re.findall(r'[MLHVZ]|-?\d+(?:\.\d+)?',d); i=0; x=y=0; pts=[]
        def flush():
            if not pts:return
            sp=cu.splines.new('POLY'); sp.points.add(len(pts)-1)
            for p,(px,py) in zip(sp.points,pts): p.co=((tx+px*sc-736)*factor,(160-ty-py*sc)*factor,0,1)
            sp.use_cyclic_u=True
        while i<len(tokens):
            cmd=tokens[i]; i+=1
            if cmd in ('M','L'): x=float(tokens[i]); y=float(tokens[i+1]); i+=2; pts.append((x,y))
            elif cmd=='H': x=float(tokens[i]); i+=1; pts.append((x,y))
            elif cmd=='V': y=float(tokens[i]); i+=1; pts.append((x,y))
            elif cmd=='Z': flush(); pts=[]
        o=bpy.data.objects.new(name+' '+str(idx),cu); S.collection.objects.link(o); o.location=loc; cu.materials.append(CREAM); finish(o)
        if assemble:
            a=WINDOW[0]+idx*3; rise(o,a,min(WINDOW[0]+60,WINDOW[1]-1),.35)
    save(f'Scene {CURRENT}: approved wordmark assembled')

def words(body,a,b):
    global WINDOW
    WINDOW=(f(a),f(b)); S.frame_set(WINDOW[0]+20)
    o=text('Words: '+body,body,(0,0,1),1.35,12)
    rise(o,WINDOW[0],min(WINDOW[0]+24,WINDOW[1]-1),.15)
    # True transparency, not a black emission silhouette at either end of a cut.
    for index,source in enumerate(list(o.data.materials)):
        m=source.copy(); o.data.materials[index]=m
        nodes=m.node_tree.nodes; links=m.node_tree.links
        out=nodes.get('Material Output'); surface=out.inputs['Surface'].links[0].from_socket
        transparent=nodes.new('ShaderNodeBsdfTransparent'); mix=nodes.new('ShaderNodeMixShader')
        links.new(transparent.outputs[0],mix.inputs[1]); links.new(surface,mix.inputs[2]); links.new(mix.outputs[0],out.inputs['Surface'])
        sock=mix.inputs[0]
        for frame,value in [(WINDOW[0],0),(WINDOW[0]+18,1),(WINDOW[1]-12,1),(WINDOW[1]-1,0)]:
            sock.default_value=value; sock.keyframe_insert('default_value',frame=frame)
        smooth(m.node_tree)
    save(f'Scene {CURRENT}: word card {body}')

def pc(final=False):
    before=set(o.name for o in COL.objects)
    panel('Monitor','dashboard',(-1.4,-.15,.3),6.5)
    box('Monitor neck',(-1.4,-2.48,-.3),(.4,.6,.4),METAL)
    box('Monitor foot',(-1.4,-2.77,.1),(2.8,.18,1.1),METAL)
    box('Old PC tower',(3.15,-.75,-.35),(1.8,4,2.6),METAL,.18)
    box('Tower front',(3.15,-.75,1.0),(1.61,3.8,.09),DARK,.08)
    box('Optical drive',(3.15,.5,1.08),(1.3,.22,.06),METAL,.03)
    for i in range(7): box('Vent '+str(i),(3.15,-1.22-i*.13,1.08),(1.2,.035,.03),EDGE,.01)
    box('Power light',(3.15,.03,1.1),(.09,.09,.03),ORANGE,.045)
    for x in (2.85,3.25): box('USB port',(x,-.35,1.09),(.2,.07,.02),EDGE,.01)
    root=group_since('Hero old PC',before)
    for frame,rot in [(WINDOW[0],(.015,-.11,-.015)),(WINDOW[1]-1,(-.015,.05,.006))]: key(root,'rotation_euler',rot,frame)
    smooth(root); save('Old PC camera-facing rotation')
    if final:
        logo('Closing wordmark',(0,2.9,.3),7,True)
        text('Closing promise','Free. Open source. Yours.',(0,-3.35,.4),.46)
    else:
        logo('Opening wordmark',(0,2.8,.3),6,True)
        text('Second life caption','A second life for your old PC.',(0,-3.35,.4),.42)

def shot(a,b):
    global WINDOW
    WINDOW=(1 if a==0 else f(a),min(f(b),END+1))

def scene1():
    shot(0,8); pc()

def scene2():
    shot(8,10)
    panel('Top bar macro','dashboard',(0,1.8,-.4),11.5,uv=(.015,.938,.5,1),height=.82)
    for idx,(label,x0,x1) in enumerate([('Files',.292,.373),('App Store',.4,.481),('Photos',.61,.69),('Backup',.715,.795),('Machines',.822,.903)]):
        root=panel(label+' macro','dashboard',((idx-2)*2.36,-.3,(2-idx)*.22),1.95,uv=(x0,.38,x1,.54),height=2.4)
        root.rotation_euler=(.04,-.09,(idx-2)*.025)
    text('Macro label','Everything has a place.',(0,-2.5,.5),.47)
    words('Your stuff.',10,12)

def scene3():
    shot(12,18)
    before=set(o.name for o in COL.objects)
    box('Growing CPU panel',(0,0,0),(7.6,4.2,.22),GLASS)
    text('Widget label','Room to do more.',(0,1.15,.2),.55)
    pts=[(-1.8+1.05*math.cos(math.radians(135+k*270/80)),-.3+1.05*math.sin(math.radians(135+k*270/80)),.2) for k in range(81)]
    line('CPU track',pts,EDGE,.065); arc=line('CPU sweep',pts,ORANGE,.07)
    arc.data.bevel_factor_end=.001; arc.data.keyframe_insert('bevel_factor_end',frame=f(14))
    arc.data.bevel_factor_end=.28; arc.data.keyframe_insert('bevel_factor_end',frame=f(16)); smooth(arc.data)
    text('CPU number','28%',(-1.8,-.3,.25),.65)
    text('CPU units','CPU',(-1.8,-1.62,.25),.27,mat=CREAM)
    text('Memory figure','8 GB',(1.5,-.25,.25),.8)
    text('Memory label','Your home. Your hardware.',(1.5,-1.1,.25),.25,mat=CREAM)
    root=group_since('Tile grows into widget',before)
    key(root,'scale',(.72,.72,1),f(12)); key(root,'scale',(1,1,1),f(14)); smooth(root); ease_out(root,'scale')
    save('Scene 3: tile grows into CPU widget')
    words('Lives at home.',18,20)

def scene4():
    words('Set up',20,22)
    shot(22,26)
    panel('Phone setup','phone-setup',(2.8,0,.2),2.3,phone=True)
    panel('Box welcome','setup-welcome',(-2.35,.75,-.15),5.8)
    panel('Pairing QR',ASSETS/'qr.png',(-2.35,-2.15,.1),1.15)
    line('Connection',[(-1.55,-2.15,.2),(.4,-2.15,.2),(1.2,-1.35,.2)],ORANGE,.025)
    text('Phone scene caption','from your phone.',(0,3,.3),.68)
    save('Scene 4: phone and QR connection')
    shot(26,28)
    before=set(o.name for o in COL.objects)
    box('Connected pill',(0,0,0),(6.8,1.6,.25),GLASS,.45)
    text('Connected','Connected.',(0,0,.2),.85)
    root=group_since('Connected card and label',before)
    key(root,'scale',(.8,.8,1),f(26)); key(root,'scale',(1,1,1),f(27)); smooth(root); ease_out(root,'scale')
    save('Scene 4: Connected pill grows')

def scene5():
    shot(28,32)
    panel('Settings','settings-general',(0,-.45,0),9.7)
    text('Settings heading','Make it yours.',(0,3.1,.3),.68)
    save('Scene 5: Settings reveal')

def scene6():
    words('Storage',32,34)
    shot(34,42)
    text('Storage heading','A place for everything.',(0,2.8,.3),.65)
    for i in range(2):
        x=(i-.5)*3.2
        box('Disk bay '+str(i),(x,0,-.18),(2.55,2.75,.3),DARK)
        before=set(o.name for o in COL.objects)
        box('Disk '+str(i),(x,0,.15),(2.3,2.48,.22),GLASS)
        box('Drive face '+str(i),(x,.28,.29),(1.83,1.15,.035),METAL,.06)
        text('Drive brand '+str(i),'JENER',(x,.47,.33),.28,mat=CREAM)
        for j in range(3):
            box(f'Drive vent {i}-{j}',(x,.05+j*.075,.32),(1.1,.024,.015),DARK,.008)
        for sx in (-.99,.99):
            for sy in (-1.05,1.05):
                box(f'Drive screw {i}-{sx}-{sy}',(x+sx,sy,.29),(.055,.055,.025),EDGE,.026)
        text('Disk label '+str(i),f'Disk {i+1}',(x,-.67,.31),.32,mat=CREAM)
        for j in range(6):
            box(f'Drive connector {i}-{j}',(x-.3+j*.12,-1.16,.3),(.065,.1,.025),EDGE,.012)
        root=group_since('Disk drops '+str(i),before)
        a=f(34+i*.65); key(root,'location',(0,.55,0),a); key(root,'location',(0,0,0),min(a+40,f(37))); smooth(root); ease_out(root,'location')
    text('Mirror caption','Two copies. One calm place.',(0,-1.72,.3),.4)
    box('Mirror track',(0,-2.18,0),(6.4,.13,.14),DARK,.06)
    fill=box('Mirror fill',(-3.18,-2.18,.09),(6.36,.08,.06),ORANGE,.035)
    # Shift mesh to make scaling grow from its left edge.
    for v in fill.data.vertices:v.co.x+=3.18
    key(fill,'scale',(.001,1,1),f(36)); key(fill,'scale',(1,1,1),f(38)); smooth(fill)
    before=set(o.name for o in COL.objects)
    box('Storage ready pill',(0,-2.95,.05),(5.9,.7,.14),GLASS,.3)
    text('Storage ready label','Your storage is ready.',(0,-2.95,.19),.41,width=5.2)
    # Scale around the pill's own center. Keep the filled bar and both disks on screen.
    root=group_since('Storage ready grows in place',before); pivot=Vector((0,-2.95,0))
    root.location=pivot; root['entrance_in_place']=True
    for o in root.children:
        o.location-=pivot
        visibility(o,f(38.25),f(42))
        o['detail_reveal']=True
    key(root,'scale',(.82,.82,1),f(38.25)); key(root,'scale',(1,1,1),f(39)); smooth(root); ease_out(root,'scale')
    save('Scene 6: two drive faces, full mirror bar and ready pill')
    shot(42,44); panel('Real storage','settings-storage',(0,-.45,0),9.7)
    text('Storage real heading','All together.',(0,3.1,.2),.65)

def scene7():
    words('Updates',44,46); words('that undo themselves.',46,48)
    shot(48,52)
    text('Update heading','A safe way back.',(0,2.65,.3),.65)
    for i,(label,sub) in enumerate([('A','Your working system'),('B','The next update')]):
        x=(-1 if i==0 else 1)*2.3
        before=set(o.name for o in COL.objects)
        box('System '+label,(x,0,0),(3.9,3.8,.22),GLASS)
        text('System letter '+label,label,(x,.35,.2),1.5)
        text('System caption '+label,sub,(x,-1.0,.2),.32,mat=CREAM)
        root=group_since('System card '+label,before)
        key(root,'location',(0,-.28,0),f(48))
        key(root,'location',(0,0,0),f(49))
        key(root,'location',(0,0,.18 if not i else -.18),f(51))
        smooth(root); ease_out(root,'location')
    text('Rollback caption','If an update fails, your PC comes back.',(0,-3.05,.3),.4)
    line('Rollback check',[(-.32,-2.35,.3),(-.08,-2.57,.3),(.4,-2.12,.3)],ORANGE,.038)
    save('Scene 7: safe A/B return')

def scene8():
    words('Your own app store.',52,54)
    shot(54,56)
    for i,shotname in enumerate(['dashboard','store-discover','phone-dashboard']):
        root=panel('App fan '+str(i),shotname,((i-1)*4,0,-abs(i-1)*.3),3.1,height=3.6)
        key(root,'rotation_euler',(0,0,0),f(54)); key(root,'rotation_euler',(0,(i-1)*-.09,(i-1)*-.06),f(55)); smooth(root)
    text('App fan caption','Find your next favorite.',(0,2.85,.3),.65)
    shot(56,60); panel('App Store','store-discover',(0,-.45,0),9.7)
    text('App Store heading','Made for your home.',(0,3.1,.3),.65)
    save('Scene 8: App Store fan and real screen')

def scene9():
    shot(60,64)
    for i,shotname in enumerate(['settings-storage','dashboard','store-discover']):
        root=panel('Final screen '+str(i),shotname,((i-1)*4.3,-.2,-abs(i-1)*.4),3.65)
        key(root,'rotation_euler',(.04,(i-1)*-.17,(i-1)*-.035),f(60))
        key(root,'rotation_euler',(-.02,(i-1)*-.04,0),f(64)-1); smooth(root)
    text('Final collection heading','Your home. All here.',(0,2.7,.3),.8)
    shot(64,68); pc(True)
    text('Download and source','Download at jener.dev   /   GitHub: PrimeExtremo/JenerOS',(0,-3.85,.3),.25,mat=CREAM)
    save('Scene 9: final hero lands on the downbeat')

def materials():
    global DARK,METAL,EDGE,FRAME,GLASS,CREAM,ORANGE,ACCENT,FONT,BODY_FONT
    DARK=material('Warm graphite recess',rgb('#201A15'),.05,.5,.15)
    METAL=material('Satin graphite',rgb('#49433D'),.38,.42)
    EDGE=material('Soft champagne bevel',rgb('#88725A'),.25,.4,.12)
    FRAME=material('Thin muted copper frame',rgb('#71503A'),.3,.38)
    CREAM=ink('Cream type #F6F1E7','#F6F1E7')
    ACCENT=ink('Accent word #D97757','#D97757')
    ORANGE=ink('Orange indicator','#D97757')
    GLASS=material('Warm glass #2B241C',rgb('#2B241C'),.04,.38,.35)
    p=GLASS.node_tree.nodes.get('Principled BSDF')
    p.inputs['Transmission Weight'].default_value=0
    p.inputs['Specular IOR Level'].default_value=.22
    p.inputs['Coat Weight'].default_value=.18; p.inputs['Coat Roughness'].default_value=.32
    FONT=bpy.data.fonts.get('Bricolage Grotesque Bold')
    if not FONT:
        FONT=bpy.data.fonts.load(str(ASSETS/'BricolageGrotesque-Bold.ttf')); FONT.name='Bricolage Grotesque Bold'
    BODY_FONT=bpy.data.fonts.get('Trailer labels')
    if not BODY_FONT:
        BODY_FONT=bpy.data.fonts.load('C:/Windows/Fonts/seguisb.ttf'); BODY_FONT.name='Trailer labels'


def backdrop():
    # Unlit backdrop: area-light reflections cannot create a visible white blob.
    m=bpy.data.materials.new('Warm brown with soft orange halo'); m.use_nodes=True
    n=m.node_tree.nodes; n.clear(); links=m.node_tree.links
    geometry=n.new('ShaderNodeNewGeometry'); distance=n.new('ShaderNodeVectorMath'); distance.operation='DISTANCE'
    distance.inputs[1].default_value=(1,0,-4)
    scale=n.new('ShaderNodeMath'); scale.operation='MULTIPLY'; scale.inputs[1].default_value=.085
    ramp=n.new('ShaderNodeValToRGB'); ramp.color_ramp.interpolation='EASE'
    ramp.color_ramp.elements[0].color=(*rgb('#382318'),1)
    ramp.color_ramp.elements[1].color=(*rgb('#140F0B'),1)
    middle=ramp.color_ramp.elements.new(.55); middle.color=(*rgb('#201610'),1)
    em=n.new('ShaderNodeEmission'); out=n.new('ShaderNodeOutputMaterial')
    links.new(geometry.outputs['Position'],distance.inputs[0]); links.new(distance.outputs['Value'],scale.inputs[0])
    links.new(scale.outputs[0],ramp.inputs[0]); links.new(ramp.outputs[0],em.inputs['Color']); links.new(em.outputs[0],out.inputs['Surface'])
    box('Backdrop',(0,0,-4),(200,200,.1),m,0)


def entrances():
    for o in list(COL.objects):
        if o.parent or o.get('entrance_in_place'): continue
        if any(fc.data_path=='location' for fc in curves(o)): continue
        timed=[c for c in [o,*o.children_recursive] if 'shot_start' in c]
        if not timed: continue
        start=min(c['shot_start'] for c in timed); end=min(c['shot_end'] for c in timed)
        rise(o,start,min(start+36,end-1),.18 if o.type=='FONT' else .28)


def camera_drift():
    # Reset on cuts only. Every actual shot pushes by 3%; only the drift is linear.
    cuts={1,END+1}
    for o in bpy.data.objects:
        if 'shot_start' in o and not o.get('detail_reveal'):
            cuts.update((int(o['shot_start']),int(o['shot_end'])))
    cuts=sorted(cuts)
    for name in ('CAMERA landscape','CAMERA vertical'):
        cam=bpy.data.objects[name]; cam.animation_data_clear(); cam.data.animation_data_clear()
        for a,b in zip(cuts,cuts[1:]):
            for frame,loc in [(a,(-.10,.04,20.35)),(b-1,(.10,.09,19.74))]:
                key(cam,'location',loc,frame)
        for fc in curves(cam):
            for k in fc.keyframe_points: k.interpolation='LINEAR'
        cam.data.dof.aperture_fstop=9
    S['shot_cut_frames']=json.dumps(cuts)
    save('All shot entrances eased; each camera shot has a gentle 3% push')

def init():
    global S,COL,WINDOW
    bpy.ops.wm.read_factory_settings(use_empty=True); S=bpy.context.scene; S.name='JenerOS launch trailer'
    S.render.engine='BLENDER_EEVEE'; S.eevee.taa_render_samples=16
    S.render.image_settings.file_format='PNG'; S.render.film_transparent=False
    S.view_settings.view_transform='Standard'; S.view_settings.look='None'
    S.world=bpy.data.worlds.new('Near-black warm brown'); S.world.use_nodes=True
    S.world.node_tree.nodes['Background'].inputs[0].default_value=(*rgb('#1F1913'),1)
    S.world.node_tree.nodes['Background'].inputs[1].default_value=.4
    bpy.ops.object.camera_add(location=(0,0,20)); cam=bpy.context.object; cam.name='CAMERA landscape'; cam.data.lens=42; S.camera=cam
    cam.data.dof.use_dof=True; cam.data.dof.focus_distance=20; cam.data.dof.aperture_fstop=7
    bpy.ops.object.text_add(location=(-10,6,0)); st=bpy.context.object; st.name='STATUS'; st.data.size=.4; st.hide_render=True; st.hide_viewport=True
    materials()
    backdrop()
    for name,loc,power,color,size in [('Large cream key',(-6,6,8),550,(1,.88,.75),10),('Orange rim',(6,1,5),240,(1,.48,.27),8),('Top softbox',(0,7,2),400,(1,.92,.82),8)]:
        bpy.ops.object.light_add(type='AREA',location=loc); o=bpy.context.object; o.name=name; o.data.energy=power; o.data.color=color; o.data.shape='DISK'; o.data.size=size
        o.rotation_euler=(-o.location).to_track_quat('-Z','Y').to_euler(); save('Lighting: '+name)
    for i in range(9):
        a=1 if i==0 else f(STARTS[i]); b=min(f(STARTS[i+1])-1,END)
        for frame,loc in [(a,(-.17,.06,20.35)),(b,(.17,.13,19.75))]: key(cam,'location',loc,frame)
        for frame,value in [(a,3 if i==1 else 7),(b,3 if i==1 else 7)]:
            cam.data.dof.aperture_fstop=value; cam.data.dof.keyframe_insert('aperture_fstop',frame=frame)
        S.timeline_markers.new(f'{i+1:02} {SEGMENTS[i][0]}',frame=a)
    for fc in curves(cam):
        for k in fc.keyframe_points:k.interpolation='LINEAR'
    vertical=cam.copy(); vertical.data=cam.data.copy(); vertical.name='CAMERA vertical'; S.collection.objects.link(vertical)
    vertical.data.lens=42; vertical.data.sensor_fit='HORIZONTAL'
    # Keep the whole landscape composition within a portrait frame, with breathing room.
    # A separate camera remains editable for a tighter social crop.
    for screen in bpy.data.screens:
        for area in screen.areas:
            if area.type=='VIEW_3D':
                area.spaces.active.region_3d.view_perspective='CAMERA'; area.spaces.active.shading.type='MATERIAL'
                area.spaces.active.shading.use_scene_world=True; area.spaces.active.shading.use_scene_lights=True
    S['font_note']='Packed Bricolage Grotesque Bold headlines and word cards; Segoe UI Semibold small labels.'
    save('Cameras and full 43-second beat timeline ready')

def preview(number,frame=None,vertical=False):
    sample_beats=[4,9.5,16,24.5,30,38.5,50,58,65.5]
    frame=frame or f(sample_beats[number-1])
    S.frame_set(frame); S.render.resolution_x=540 if vertical else 960; S.render.resolution_y=960 if vertical else 540
    S.render.resolution_percentage=100; S.eevee.taa_render_samples=12
    S.camera=bpy.data.objects['CAMERA vertical' if vertical else 'CAMERA landscape']
    suffix='-vertical' if vertical else ''
    file=LIVE/f'scene-{number:02}{suffix}.png'; S.render.filepath=str(file)
    S.render.image_settings.file_format='PNG'; t=time.monotonic(); bpy.ops.render.render(write_still=True)
    elapsed=time.monotonic()-t
    stats=LIVE/'render-times.json'; data=json.loads(stats.read_text()) if stats.exists() else {}
    data[str(number)+suffix]={'seconds':elapsed,'frame':frame}; stats.write_text(json.dumps(data,indent=2))
    log(f'Scene {number}: {SEGMENTS[number-1][0]}. Preview ready for inspection ({elapsed:.1f}s).',image=f'live/{file.name}',step=f'Build and inspect scene {number} of 9')
    S.camera=bpy.data.objects['CAMERA landscape']; S.eevee.taa_render_samples=32
    save(f'Scene {number} of 9: preview ready for inspection')

def render(mode):
    S.camera=bpy.data.objects['CAMERA vertical' if mode=='vertical' else 'CAMERA landscape']
    if mode=='vertical': S.camera.data.lens=60  # fill the phone's width instead of a tiny centred strip
    S.render.resolution_x=1440 if mode=='vertical' else 960 if mode=='draft' else 2560
    S.render.resolution_y=2560 if mode=='vertical' else 540 if mode=='draft' else 1440
    S.render.resolution_percentage=100; S.eevee.taa_render_samples=8 if mode=='draft' else 32
    S.render.image_settings.media_type='VIDEO'
    S.render.image_settings.file_format='FFMPEG'; S.render.ffmpeg.format='MPEG4'; S.render.ffmpeg.codec='H264'
    S.render.ffmpeg.constant_rate_factor='PERC_LOSSLESS'; S.render.ffmpeg.ffmpeg_preset='BEST'; S.render.filter_size=1.0; S.render.ffmpeg.audio_codec='NONE'
    S.render.fps=60
    # Render on the master clock, then remap 60fps keys to 30fps on a disposable loaded copy.
    if mode=='draft':
        for action in bpy.data.actions:
            for layer in action.layers:
                for strip in layer.strips:
                    for bag in strip.channelbags:
                        for fc in bag.fcurves:
                            for k in fc.keyframe_points:
                                for co in (k.co,k.handle_left,k.handle_right): co.x=(co.x-1)/2+1
        S.frame_end=END//2; S.render.fps=30
    else: S.frame_end=END
    S.frame_start=1; S.frame_step=1
    out=LIVE/'draft.mp4' if mode=='draft' else ROOT/'out'/('jeneros-trailer-vertical.mp4' if mode=='vertical' else 'jeneros-trailer.mp4')
    if args.output_dir: out=args.output_dir/out.name
    if args.check_only:
        print(json.dumps({'mode':mode,'resolution':[S.render.resolution_x,S.render.resolution_y],
                          'fps':S.render.fps,'frames':S.frame_end,'codec':S.render.ffmpeg.codec,
                          'output':str(out),'rendered':False}),flush=True)
        return
    out.parent.mkdir(exist_ok=True); S.render.filepath=str(out.with_name(out.stem+'.rendering.mp4'))
    log(f'Rendering {mode}: {S.frame_end} frames, silent H.264.',step='Render draft animation' if mode=='draft' else 'Estimate and render final versions')
    t=time.monotonic(); bpy.ops.render.render(animation=True)
    os.replace(S.render.filepath,out)
    (LIVE/f'{mode}-timing.json').write_text(json.dumps({'seconds':time.monotonic()-t,'frames':S.frame_end,'fps':S.render.fps},indent=2))
    log(f'{mode.title()} animation ready.',video=str(out.relative_to(ROOT)).replace('\\','/') if out.is_relative_to(ROOT) else out.as_posix())

if args.render or args.still or args.only:
    bpy.ops.wm.open_mainfile(filepath=str(ROOT/'trailer.blend')); S=bpy.context.scene
    packed_grid=json.loads(S['beat_grid'])
    if args.beats and grid != packed_grid:
        parser.error('A different --beats grid requires a full rebuild: omit --only, --still and --render')
    grid=packed_grid; timing(grid); materials()
else: init()

if args.render: render(args.render)
elif args.still: preview(args.still,args.frame)
else:
    numbers=[int(args.only[5:])] if args.only else range(1,10)
    for number in numbers:
        CURRENT=number
        name=f'{number:02} {SEGMENTS[number-1][0]}'
        existing=bpy.data.collections.get(name)
        if existing:
            for o in list(existing.objects): bpy.data.objects.remove(o,do_unlink=True)
            bpy.data.collections.remove(existing)
        COL=bpy.data.collections.new(name); S.collection.children.link(COL)
        log(f'Building scene {number}: {SEGMENTS[number-1][0]}',step=f'Build and inspect scene {number} of 9')
        globals()['scene'+str(number)]()
        entrances()
        S.frame_set(min(WINDOW[0]+60,WINDOW[1]-1)); save(f'Scene {number} of 9 complete')
        if not args.no_preview: preview(number)
    camera_drift()
    print('Atomic construction saves:',SAVE_COUNT,flush=True)
