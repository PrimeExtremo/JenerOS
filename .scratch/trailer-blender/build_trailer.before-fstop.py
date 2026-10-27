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
from mathutils import Vector, Matrix

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
parser.add_argument('--polish', action='store_true', help='Rebuild camera paths, compositor and chapters on the saved scene')
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
    # Windows can briefly lock the destination while the live watcher reads it.
    # Retry the atomic rename; never remove or truncate the visible file.
    for attempt in range(50):
        try:
            os.replace(ROOT/'trailer.tmp.blend',ROOT/'trailer.blend')
            break
        except PermissionError:
            if attempt==49: raise
            time.sleep(.1)
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


def camera_rotation(position,target):
    # This set uses Y as world-up. to_track_quat assumes Z-up and rolls the frame.
    forward=(Vector(target)-Vector(position)).normalized()
    right=forward.cross(Vector((0,1,0))).normalized()
    up=right.cross(forward)
    return Matrix((right,up,-forward)).transposed().to_euler()

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
    global WINDOW
    # A quiet half-second silhouette; the first downbeat cuts along the bevel.
    WINDOW=(1,f(0)); glass_j('Dark J silhouette',width=5)
    haze('Opening atmosphere')
    WINDOW=(f(0),f(4)); glass_j('J fuses from glass',width=5,assemble=True)
    haze('Assembly atmosphere')
    shot(4,8); pc(); cozy_room()

def scene2():
    shot(8,11)
    # One continuous physical set: the macro really is this monitor's screen.
    pc(); cozy_room()
    for o in COL.objects:
        if o.name.startswith(('Opening wordmark','Second life caption')):
            bpy.data.objects.remove(o,do_unlink=True)
    for o in COL.objects:
        if o.name.startswith('Hero old PC'):
            o.animation_data_clear(); o.rotation_euler=(0,0,0)
        if o.name.startswith('Monitor') and o.type=='EMPTY':
            o.animation_data_clear(); o.location=(0,0,0)
    words('Your stuff.',11,12)

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
    word_to_ring()

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
    word_to_bays()
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
        # Slow anticipation, six-frame passing move, slow settlement.
        sign=1 if i==0 else -1
        for beat,loc in [(48,(0,-.15,0)),(49.65,(.18*sign,0,.12*sign)),
                         (49.9,(2.3*sign,0,1.65*sign)),(50.15,(4.4*sign,0,.3*sign)),
                         (51,(4.6*sign,0,0)),(51.98,(4.62*sign,.03,0))]:
            key(root,'location',loc,f(beat))
        smooth(root)
        root['speed_ramp']='49.65 -> 50.15 beats; separated in depth at crossing'
    text('Rollback caption','If an update fails, your PC comes back.',(0,-3.05,.3),.4)
    line('Rollback check',[(-.32,-2.35,.3),(-.08,-2.57,.3),(.4,-2.12,.3)],ORANGE,.038)
    save('Scene 7: safe A/B return')

def scene8():
    words('Your own app store.',52,54)
    shot(54,56)
    icon_cloud()
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
    global DARK,METAL,EDGE,FRAME,GLASS,CREAM,ORANGE,ACCENT,FONT,BODY_FONT,HERO,ICON
    DARK=material('Warm graphite recess',rgb('#201A15'),.05,.5,.15)
    METAL=material('Satin graphite',rgb('#49433D'),.38,.42)
    EDGE=material('Soft champagne bevel',rgb('#88725A'),.25,.4,.12)
    FRAME=material('Thin muted copper frame',rgb('#71503A'),.3,.38)
    CREAM=ink('Cream type #F6F1E7','#F6F1E7')
    ACCENT=ink('Accent word #D97757','#D97757')
    ORANGE=ink('Orange indicator','#D97757')
    GLASS=material('Warm glass #2B241C',rgb('#2B241C'),.04,.38,.35)
    p=GLASS.node_tree.nodes.get('Principled BSDF')
    p.inputs['Transmission Weight'].default_value=.32
    p.inputs['Roughness'].default_value=.24
    p.inputs['IOR'].default_value=1.45
    p.inputs['Specular IOR Level'].default_value=.5
    p.inputs['Coat Weight'].default_value=.45; p.inputs['Coat Roughness'].default_value=.12
    HERO=material('Amber optical glass',rgb('#E9A168'),.02,.065)
    # Pure dielectric avoids the noisy mixed transmission lobe in low-sample
    # Eevee previews while retaining real refraction and the 1.45 glass IOR.
    glass=HERO.node_tree.nodes.get('Optical glass')
    if not glass:
        glass=HERO.node_tree.nodes.new('ShaderNodeBsdfGlass'); glass.name='Optical glass'
    glass.inputs['Color'].default_value=(.8,.53,.3,1)
    glass.inputs['Roughness'].default_value=.065; glass.inputs['IOR'].default_value=1.45
    HERO.node_tree.links.new(glass.outputs[0],HERO.node_tree.nodes.get('Material Output').inputs['Surface'])
    HERO.use_raytrace_refraction=True; HERO.thickness_mode='SLAB'
    ICON=material('Glossy porcelain app bodies',rgb('#382F26'),.15,.17)
    ICON.node_tree.nodes.get('Principled BSDF').inputs['Coat Weight'].default_value=.65
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
        if o.parent or o.get('entrance_in_place') or o.get('physical_set'): continue
        if any(fc.data_path=='location' for fc in curves(o)): continue
        timed=[c for c in [o,*o.children_recursive] if 'shot_start' in c]
        if not timed: continue
        start=min(c['shot_start'] for c in timed); end=min(c['shot_end'] for c in timed)
        rise(o,start,min(start+36,end-1),.18 if o.type=='FONT' else .28)


def camera_drift():
    cinematic_cameras()

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
    sample_beats=[3.6,10.8,16,25.6,30,39,51,54.45,65.5]
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
    S.render.resolution_x=1080 if mode=='vertical' else 960 if mode=='draft' else 2560
    S.render.resolution_y=1920 if mode=='vertical' else 540 if mode=='draft' else 1440
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
        assert S.render.use_motion_blur
        assert S.camera.data.dof.use_dof and S.camera.data.dof.focus_object
        assert 50<=S.camera.data.lens<=100
        assert S.compositing_node_group
        volumes=[m.name for m in bpy.data.materials if m.use_nodes and
                 any(n.type=='PRINCIPLED_VOLUME' for n in m.node_tree.nodes)]
        assert volumes, 'Missing opening atmosphere'
        print(json.dumps({'mode':mode,'resolution':[S.render.resolution_x,S.render.resolution_y],
                          'fps':S.render.fps,'frames':S.frame_end,'codec':S.render.ffmpeg.codec,
                          'samples':S.eevee.taa_render_samples,'motion_blur':S.render.use_motion_blur,
                          'shutter':S.render.motion_blur_shutter,'lens_mm':S.camera.data.lens,
                          'keyed_focus':bool(S.camera.data.dof.focus_object.animation_data),
                          'volumes':volumes,'compositor':S.compositing_node_group.name,
                          'audio':S.render.ffmpeg.audio_codec,
                          'output':str(out),'rendered':False}),flush=True)
        return
    out.parent.mkdir(exist_ok=True); S.render.filepath=str(out.with_name(out.stem+'.rendering.mp4'))
    log(f'Rendering {mode}: {S.frame_end} frames, silent H.264.',step='Render draft animation' if mode=='draft' else 'Estimate and render final versions')
    t=time.monotonic(); bpy.ops.render.render(animation=True)
    os.replace(S.render.filepath,out)
    (LIVE/f'{mode}-timing.json').write_text(json.dumps({'seconds':time.monotonic()-t,'frames':S.frame_end,'fps':S.render.fps},indent=2))
    log(f'{mode.title()} animation ready.',video=str(out.relative_to(ROOT)).replace('\\','/') if out.is_relative_to(ROOT) else out.as_posix())

def glass_j(name, loc=(0,0,0), width=5, assemble=False):
    """Extrude the approved monogram paths, including its separate square."""
    import xml.etree.ElementTree as ET
    paths=ET.parse(REPO/'[BRAND]/logo/j-monogram-light.svg').getroot()
    polygons=[]
    for el in paths:
        if not el.tag.endswith('path'): continue
        tokens=re.findall(r'[MLHVZ]|-?\d+(?:\.\d+)?',el.attrib['d'])
        pts=[]; i=0; x=y=0
        while i<len(tokens):
            cmd=tokens[i]; i+=1
            if cmd in ('M','L'): x=float(tokens[i]); y=float(tokens[i+1]); i+=2
            elif cmd=='H': x=float(tokens[i]); i+=1
            elif cmd=='V': y=float(tokens[i]); i+=1
            elif cmd=='Z': continue
            pts.append(((x-256)*width/352,(256-y)*width/352))
        polygons.append(pts)
        cu=bpy.data.curves.new(name,'CURVE'); cu.dimensions='2D'; cu.fill_mode='BOTH'
        cu.extrude=.24; cu.bevel_depth=.055; cu.bevel_resolution=4
        sp=cu.splines.new('POLY'); sp.points.add(len(pts)-1)
        for p,(x,y) in zip(sp.points,pts): p.co=(x,y,0,1)
        sp.use_cyclic_u=True; cu.materials.append(HERO)
        o=bpy.data.objects.new(name,cu); S.collection.objects.link(o); o.location=loc
        o['physical_set']=True; finish(o)
        if assemble:
            key(o,'scale',(.001,.001,.001),WINDOW[0])
            key(o,'scale',(.001,.001,.001),f(1.7))
            key(o,'scale',(1,1,1),f(2.7)); smooth(o)
    if not assemble: return
    def inside(x,y,poly):
        odd=False
        for (ax,ay),(bx,by) in zip(poly,poly[1:]+poly[:1]):
            if (ay>y)!=(by>y) and x<(bx-ax)*(y-ay)/(by-ay)+ax: odd=not odd
        return odd
    step=.37; n=0
    for ix in range(-7,8):
        for iy in range(-7,8):
            x=ix*step; y=iy*step
            if not any(inside(x,y,p) for p in polygons): continue
            o=box(f'Amber voxel {n:03}',(x,y,0),(.33,.33,.4),HERO,.055)
            phase=n*.71; target=Vector((x,y,0)); a=WINDOW[0]+(n%9)*2; end=f(2.2)+(n%7)*2
            key(o,'location',target+Vector((math.cos(phase)*5,math.sin(phase)*4,2.5+(n%3))),a)
            key(o,'location',target+Vector((math.sin(phase)*1.3,math.cos(phase)*1.1,1.4)),round((a+end)*.58))
            key(o,'location',target,end)
            key(o,'rotation_euler',(phase,.8,phase*.3),a); key(o,'rotation_euler',(0,0,0),end)
            key(o,'scale',(1,1,1),end); key(o,'scale',(.001,.001,.001),f(3.1))
            smooth(o); n+=1
    save(f'Cold open: {n} curved voxel paths fuse into the approved bevelled glass J')


def haze(name):
    mat=bpy.data.materials.get('Fine warm volume')
    if not mat:
        mat=bpy.data.materials.new('Fine warm volume'); mat.use_nodes=True
        n=mat.node_tree.nodes; n.clear(); p=n.new('ShaderNodeVolumePrincipled'); out=n.new('ShaderNodeOutputMaterial')
        p.inputs['Density'].default_value=.006; p.inputs['Color'].default_value=(*rgb('#BE896A'),1)
        p.inputs['Anisotropy'].default_value=.25
        mat.node_tree.links.new(p.outputs['Volume'],out.inputs['Volume'])
    o=box(name,(0,0,1),(22,16,8),mat,0); o['physical_set']=True; o.display_type='WIRE'
    local_light(name+' rim',(-4,4,-1),900,(1,.58,.3),3,(0,0,0))
    local_light(name+' edge',(4,0,3),450,(1,.82,.6),2,(0,0,0))


def local_light(name,loc,power,color,size,target):
    bpy.ops.object.light_add(type='AREA',location=loc); o=bpy.context.object; o.name=name
    o.data.energy=power; o.data.color=color; o.data.shape='DISK'; o.data.size=size
    o.rotation_euler=(Vector(target)-o.location).to_track_quat('-Z','Y').to_euler()
    o['physical_set']=True; finish(o)
    # Eevee does not use object hide_render consistently for light evaluation.
    for frame,value in [(0,0),(WINDOW[0],power),(WINDOW[1],0)]: key(o.data,'energy',value,frame)
    for fc in curves(o.data):
        for k in fc.keyframe_points: k.interpolation='CONSTANT'
    return o


def cozy_room():
    before=set(o.name for o in COL.objects)
    wood=material('Walnut desk',rgb('#392319'),.05,.35)
    p=wood.node_tree.nodes.get('Principled BSDF')
    if not wood.node_tree.nodes.get('Desk grain'):
        noise=wood.node_tree.nodes.new('ShaderNodeTexNoise'); noise.name='Desk grain'; noise.inputs['Scale'].default_value=7
        coord=wood.node_tree.nodes.new('ShaderNodeTexCoord'); mapping=wood.node_tree.nodes.new('ShaderNodeVectorMath'); mapping.operation='MULTIPLY'; mapping.inputs[1].default_value=(1,28,3)
        bump=wood.node_tree.nodes.new('ShaderNodeBump'); bump.inputs['Strength'].default_value=.18; bump.inputs['Distance'].default_value=.06
        links=wood.node_tree.links; links.new(coord.outputs['Generated'],mapping.inputs[0]); links.new(mapping.outputs[0],noise.inputs['Vector']); links.new(noise.outputs['Fac'],bump.inputs['Height']); links.new(bump.outputs[0],p.inputs['Normal'])
    box('Desk with rounded solid edge',(0,-2.98,-.3),(17,.28,7),wood,.12)
    wall=material('Warm plaster wall',rgb('#292017'),0,.85)
    box('Room rear wall',(0,1,-3.65),(25,16,.18),wall,0)
    box('Lamp base',(5.85,-2.76,-1.2),(1.3,.16,1.1),METAL,.1)
    line('Lamp stem',[(5.85,-2.7,-1.2),(5.85,1,-1.2)],EDGE,.05)
    bpy.ops.mesh.primitive_cone_add(vertices=48,radius1=.8,radius2=.45,depth=1.05,location=(5.85,1.35,-1.2),rotation=(math.pi/2,0,0))
    o=bpy.context.object; o.name='Linen lamp shade'; o.data.materials.append(material('Warm linen glow',rgb('#E4BD8B'),0,.65,.75)); finish(o)
    local_light('Lamp pool',(5.85,.6,-.5),320,(1,.54,.25),2,(4,-2.7,0))
    box('Plant ceramic pot',(-6.1,-2.3,-1.2),(1.05,1.25,.95),DARK,.23)
    leafmat=material('Plant silhouette',rgb('#242B1B'),0,.5)
    for i in range(7):
        angle=i*2.4; end=(-6.1+math.cos(angle)*.85,-.5+(i%3)*.5,-1.2+math.sin(angle)*.4)
        line('Plant stem '+str(i),[(-6.1,-1.8,-1.2),end],leafmat,.025)
        bpy.ops.mesh.primitive_uv_sphere_add(segments=12,ring_count=6,location=end); o=bpy.context.object; o.name='Plant leaf '+str(i)
        o.scale=(.25,.6,.07); o.rotation_euler=(.25,0,math.cos(angle)*.9); o.data.materials.append(leafmat); finish(o)
    for o in COL.objects:
        if o.name not in before: o['physical_set']=True
    save('Screen-to-world set: solid walnut desk, linen lamp and plant silhouette')


def dissolve_text(o,start,end):
    for m in o.data.materials:
        mix=next((n for n in m.node_tree.nodes if n.bl_idname=='ShaderNodeMixShader'),None)
        if not mix: continue
        sock=mix.inputs[0]
        # Replace the standard card fade with a purposeful UI handoff.
        for fc in curves(m.node_tree): fc.keyframe_points.clear()
        for frame,value in [(WINDOW[0],0),(WINDOW[0]+12,1),(start,1),(end,0),(WINDOW[1]-1,0)]:
            sock.default_value=value; sock.keyframe_insert('default_value',frame=frame)
        smooth(m.node_tree)


def word_to_ring():
    o=COL.objects.get('Words: Lives at home.'); a=f(18.9); b=f(19.7)
    dissolve_text(o,a,b)
    key(o,'scale',(1,1,1),a); key(o,'scale',(.34,.65,1),b)
    key(o,'location',(0,0,1),a); key(o,'location',(-1.8,-.3,.4),b); smooth(o)
    points=[(-1.8+1.05*math.cos(math.radians(135+k*270/80)),-.3+1.05*math.sin(math.radians(135+k*270/80)),.4) for k in range(81)]
    arc=line('Words become CPU arc',points,ORANGE,.065)
    arc.data.bevel_factor_end=.001; arc.data.keyframe_insert('bevel_factor_end',frame=a)
    arc.data.bevel_factor_end=1; arc.data.keyframe_insert('bevel_factor_end',frame=b); smooth(arc.data)
    for frame,scale in [(a,(.001,.001,.001)),(a+5,(1,1,1))]: key(arc,'scale',scale,frame)
    arc['physical_set']=True
    label=text('Morph CPU label','CPU',(-1.8,-.3,.45),.38,mat=CREAM)
    visibility(label,b,WINDOW[1]); label['detail_reveal']=True
    save('Lives at home contracts into the CPU ring')


def word_to_bays():
    o=COL.objects.get('Words: Storage'); a=f(33); b=f(33.8); dissolve_text(o,a,b)
    key(o,'scale',(1,1,1),a); key(o,'scale',(1.1,.045,1),b); smooth(o)
    for i in range(2):
        x=(i-.5)*3.2
        bay=box('Word becomes disk bay '+str(i),(x,0,-.18),(2.55,2.75,.3),GLASS,.12)
        key(bay,'scale',(.001,.001,.001),a); key(bay,'scale',(1,.03,1),f(33.35)); key(bay,'scale',(1,1,1),b); smooth(bay)
    save('Storage stretches into two physical drive bays')


def icon_cloud():
    path=REPO/'[SITE]/assets/shots/src/dashboard.png'
    dashboard=panel('Icon landing dashboard','dashboard',(0,0,-2.5),11)
    dashboard.animation_data_clear(); dashboard.location=(0,0,0)
    # UVs crop only the actual glyph tiles, not their labels or card backgrounds.
    tiles=[('Files',(.311,.458,.349,.518)),('App Store',(.417,.445,.455,.505)),
           ('Photos',(.628,.458,.667,.518)),('Backup',(.734,.458,.772,.518)),
           ('Machines',(.841,.458,.879,.518))]
    glass_j('Icon cloud J',(0,.5,-.4),2.65)
    for o in list(COL.objects):
        if o.name.startswith('Icon cloud J'):
            key(o,'scale',(1,1,1),f(54)); key(o,'scale',(.001,.001,.001),f(55.5)); smooth(o)
    positions=[(-3.6,1.7,3.8),(-2.6,-1.4,1.2),(2.3,1.8,1.7),(3.6,-1.8,3),(1,-2.3,6)]
    for i,(name,uv) in enumerate(tiles):
        before=set(o.name for o in COL.objects)
        body=box(name+' solid rounded icon',(0,0,0),(1.48,1.48,.42),ICON,.27)
        rounded_image(name+' real cropped glyph',path,(0,0,.235),1.35,1.35,.22,uv)
        root=group_since(name+' zero gravity flight',before)
        x=(sum((uv[0],uv[2]))/2-.5)*11
        y=(sum((uv[1],uv[3]))/2-.5)*6.875
        for beat,loc in [(54,positions[i]),(54.55,(positions[i][0]*.85,positions[i][1]+.2,positions[i][2]-.5)),
                         (55.75,(x,y,-2.18)),(55.98,(x,y,-2.19))]: key(root,'location',loc,f(beat))
        for beat,rot in [(54,(.22,(i-2)*.22,(i-2)*.13)),(54.65,(-.12,(2-i)*.12,.08)),(55.75,(0,0,0))]: key(root,'rotation_euler',rot,f(beat))
        key(root,'scale',(1,1,1),f(54.6)); key(root,'scale',(.31,.31,.31),f(55.75)); smooth(root)
    save('Five glossy real app glyphs fly through depth and land in their dashboard slots')


def compositor():
    g=bpy.data.node_groups.new('Jener lens, warm flashes and end fade','CompositorNodeTree')
    S.compositing_node_group=g
    g.interface.new_socket(name='Image',in_out='OUTPUT',socket_type='NodeSocketColor')
    n=g.nodes; links=g.links; src=n.new('CompositorNodeRLayers'); src.location=(-600,0)
    glow=n.new('CompositorNodeGlare'); glow.name='Subtle optical bloom'; glow.location=(-380,0)
    glow.inputs['Type'].default_value='Fog Glow'; glow.inputs['Threshold'].default_value=1.2
    glow.inputs['Strength'].default_value=.18; glow.inputs['Size'].default_value=.35
    lens=n.new('CompositorNodeLensdist'); lens.name='Fine edge dispersion'; lens.location=(-150,0)
    lens.inputs['Dispersion'].default_value=.0025; lens.inputs['Fit'].default_value=True
    links.new(src.outputs['Image'],glow.inputs['Image']); links.new(glow.outputs['Image'],lens.inputs['Image'])
    flash=n.new('ShaderNodeMix'); flash.data_type='RGBA'; flash.name='Five frame warm flash'; flash.location=(60,0)
    flash.inputs[7].default_value=(*rgb('#FFE8C3'),1); links.new(lens.outputs['Image'],flash.inputs[6])
    fac=flash.inputs[0]; fac.default_value=0; fac.keyframe_insert('default_value',frame=1)
    for beat in (12,44,52):
        cut=f(beat)
        for offset,val in [(-3,0),(-1,.65),(0,.96),(1,.65),(3,0)]:
            fac.default_value=val; fac.keyframe_insert('default_value',frame=cut+offset)
    fade=n.new('ShaderNodeMix'); fade.data_type='RGBA'; fade.name='Calm end to black'; fade.location=(280,0)
    fade.inputs[7].default_value=(0,0,0,1); links.new(flash.outputs[2],fade.inputs[6])
    for frame,value in [(1,0),(f(67),0),(END,1)]:
        fade.inputs[0].default_value=value; fade.inputs[0].keyframe_insert('default_value',frame=frame)
    out=n.new('NodeGroupOutput'); out.location=(500,0); links.new(fade.outputs[2],out.inputs['Image'])
    for fc in curves(g):
        for k in fc.keyframe_points: k.interpolation='LINEAR'


def chapter_colors():
    mat=bpy.data.materials['Warm brown with soft orange halo']
    ramp=next(n for n in mat.node_tree.nodes if n.type=='VALTORGB')
    palettes=[(0,('#382318','#201610','#140F0B')),(12,('#A87948','#62412A','#281B12')),
              (20,('#483124','#2E2016','#160F0C')),(32,('#A7461C','#592811','#211008')),
              (44,('#EEE2CF','#C4AC8F','#9B7B5C')),(52,('#382318','#201610','#140F0B'))]
    for beat,colors in palettes:
        frame=1 if beat==0 else f(beat)
        for el,c in zip(ramp.color_ramp.elements,colors):
            el.color=(*rgb(c),1); el.keyframe_insert('color',frame=frame)
    for fc in curves(mat.node_tree):
        for k in fc.keyframe_points: k.interpolation='CONSTANT'
    # Soft cream update cards need graphite type; preserve the orange accent.
    darkink=ink('Graphite type on cream','#382A20')
    update=bpy.data.collections.get('07 Updates that undo themselves')
    if update:
        for o in update.objects:
            if o.type=='FONT' and not o.name.startswith(('System letter','System caption')):
                for m in o.data.materials:
                    for node in m.node_tree.nodes:
                        if node.type=='EMISSION' and 'Cream' in m.name:
                            if not m.name.startswith('Cream type #F6F1E7.'):
                                break
                            node.inputs['Color'].default_value=(*rgb('#382A20'),1)
                if o.name.startswith(('Update heading','Rollback caption')): o.data.materials[0]=darkink


def physical_scale():
    # Twenty centimetres per modeling unit gives the 72 mm lens meaningful
    # product-scale bokeh. Scale the whole set and focus rig together.
    root=bpy.data.objects.get('Physical world scale')
    if not root:
        root=bpy.data.objects.new('Physical world scale',None); S.collection.objects.link(root)
    root.scale=(.2,.2,.2)
    for o in list(bpy.data.objects):
        if o!=root and o.parent is None: o.parent=root
        if o.type=='LIGHT' and not o.data.get('world_scaled'):
            o.data.energy*=.04
            for fc in curves(o.data):
                if fc.data_path=='energy':
                    for k in fc.keyframe_points:
                        for co in (k.co,k.handle_left,k.handle_right): co.y*=.04
            o.data['world_scaled']=True
    volume=bpy.data.materials.get('Fine warm volume')
    if volume: volume.node_tree.nodes.get('Principled Volume').inputs['Density'].default_value=.03
    bg=bpy.data.materials['Warm brown with soft orange halo']
    for n in bg.node_tree.nodes:
        if n.type=='VECT_MATH': n.inputs[1].default_value=(.2,0,-.8)
        if n.type=='MATH': n.inputs[1].default_value=.425
    wood=bpy.data.materials.get('Walnut desk')
    if wood:
        for n in wood.node_tree.nodes:
            if n.type=='BUMP': n.inputs['Distance'].default_value=.012


def cinematic_cameras():
    cuts={1,END+1}
    for o in bpy.data.objects:
        if 'shot_start' in o and not o.get('detail_reveal'):
            cuts.update((int(o['shot_start']),int(o['shot_end'])))
    cuts=sorted(cuts)
    for name in ('CAMERA landscape','CAMERA vertical'):
        cam=bpy.data.objects[name]; cam.animation_data_clear(); cam.data.animation_data_clear()
        cam.data.lens=72; cam.data.sensor_fit='HORIZONTAL'; cam.data.dof.use_dof=True
        cam.data.dof.aperture_fstop=2.4; cam.data.dof.aperture_blades=7
        focus=bpy.data.objects.get(name+' focus') or empty(name+' focus')
        # Camera focus objects live outside the shot collections.
        for c in list(focus.users_collection): c.objects.unlink(focus)
        S.collection.objects.link(focus); focus.animation_data_clear(); cam.data.dof.focus_object=focus
        for a,b in zip(cuts,cuts[1:]):
            start=next((beat for beat in [0,4,8,11,12,18,20,22,26,28,32,34,42,44,46,48,52,54,56,60,64] if f(beat)==a),None)
            # (relative time, camera position, look-at target, focus point).
            points=[(0,(14,-3.5,29),(0,0,0),(0,0,.2)),(1,(12,-2.5,28),(.1,0,0),(.15,0,.2))]
            if a==1:
                points=[(0,(5,-1,18),(0,0,0),(0,0,.25)),(1,(4.8,-.8,17.5),(0,0,0),(0,0,.25))]
            elif start==0:
                points=[(0,(3.8,.8,5.5),(1.3,1.35,.1),(1.4,1.6,.3)),
                        (.28,(3,1,8),(.8,.8,0),(1,1,.25)),
                        (1,(4,-1,24),(0,0,0),(0,0,.25))]
            elif start==8:
                points=[(0,(-1.15,.9,5),(-2.25,1.42,.335),(-3.35,1.38,.335)),
                        (.22,(-.85,1.1,5.6),(-1.95,1.4,.335),(-.6,1.4,.335)),
                        (.7,(5,-1.5,19),(-.9,-.15,0),(-1.4,0,.335)),
                        (1,(12,-.3,31),(-.3,-.25,0),(-1.4,0,.335))]
            elif start==12:
                points=[(0,(7,-2,23),(0,0,0),(-1.8,-.3,.2)),(1,(5.5,-1,22),(0,0,0),(1.5,-.2,.2))]
            elif start==22:
                points=[(0,(-.6,-2.8,7),(-2.35,-2.15,.1),(-2.35,-2.15,.14)),
                        (.28,(-.35,-2.5,7.4),(-2.25,-2.1,.1),(-2.35,-2.15,.14)),
                        (.34,(5,-.8,12),(2.8,0,.2),(2.8,0,.25)),
                        (.61,(5.5,-.5,13),(2.8,0,.2),(2.8,0,.25)),
                        (1,(8,-1,29),(0,0,0),(2.8,0,.25))]
            elif start==34:
                points=[(0,(13,-4,25),(0,-.2,0),(-1.6,0,.3)),(.45,(12,-3.5,25.5),(0,-.2,0),(1.6,0,.3)),
                        (.72,(11.5,-3,26),(0,-.2,0),(0,-2.3,.2)),(1,(11,-2.5,26.5),(0,-.2,0),(0,-2.8,.2))]
            elif start==48:
                points=[(0,(9,-3,29),(0,-.1,0),(-2.3,0,.2)),(.4,(8.5,-2.8,28.5),(0,-.1,0),(-2.3,0,.2)),
                        (.54,(7.5,-2.5,27.8),(0,-.1,0),(2.3,0,.2)),(1,(7,-2.3,27),(0,-.1,0),(2.3,0,.2))]
            elif start==54:
                points=[(0,(6,-1.8,22),(0,0,0),(0,.5,-.4)),(.35,(4.5,-1,18),(0,0,0),(1,-.5,1.2)),
                        (1,(3,-.5,24),(0,0,-2),(0,0,-2.45))]
            elif start==60:
                points=[(0,(10,-3,33),(0,0,0),(0,0,.2)),(1,(8,-2,31),(0,0,0),(0,0,.2))]
            elif start==64:
                points=[(0,(9,-1.8,32),(0,-.2,0),(-1.4,0,.4)),(1,(7.8,-1.3,31),(0,-.2,0),(0,1,.3))]
            word=any(o.type=='FONT' and o.name.startswith('Words:') and o.get('shot_start')==a for o in bpy.data.objects)
            if word:
                points=[(0,(6,-1.2,29),(0,0,1),(0,0,1)),(1,(5,-.7,28),(0,0,1),(0,0,1))]
            for u,loc,target,focal in points:
                frame=round(a+(b-1-a)*u); loc=Vector(loc); target=Vector(target)
                key(cam,'location',loc,frame); key(cam,'rotation_euler',camera_rotation(loc,target),frame)
                key(focus,'location',focal,frame)
                cam.data.dof.aperture_fstop=1.8 if start in (0,8,22,54) else 2.6
                cam.data.dof.keyframe_insert('aperture_fstop',frame=frame)
            if start==0:
                # Catch one arriving cube sharply before racking onto the J.
                S.frame_set(f(.7))
                voxels=[o for o in bpy.data.objects if o.name.startswith('Amber voxel')]
                hero=min(voxels,key=lambda o:(o.location-Vector((2,1,2))).length)
                for beat in (.5,.7,1,1.4,2):
                    S.frame_set(f(beat)); key(focus,'location',hero.location.copy(),f(beat))
            # Interpolate within a shot; no travel across a hard cut.
        for owner in (cam,focus,cam.data):
            for fc in curves(owner):
                # Explicit tangents inside each shot. Automatic handles see the
                # next cut and can turn a slow reveal into an accidental rush.
                for a,b in zip(cuts,cuts[1:]):
                    ks=[k for k in fc.keyframe_points if a<=k.co.x<b]
                    for i,k in enumerate(ks):
                        prev=ks[max(0,i-1)]; nxt=ks[min(len(ks)-1,i+1)]
                        dt=nxt.co.x-prev.co.x
                        slope=(nxt.co.y-prev.co.y)/dt if dt else 0
                        left=(k.co.x-prev.co.x)/3; right=(nxt.co.x-k.co.x)/3
                        k.interpolation='BEZIER'; k.handle_left_type='FREE'; k.handle_right_type='FREE'
                        k.handle_left=(k.co.x-left,k.co.y-left*slope)
                        k.handle_right=(k.co.x+right,k.co.y+right*slope)
                        if i==len(ks)-1: k.interpolation='CONSTANT'
        save(name+': long lens, oblique dolly paths and keyed focus')
    S['shot_cut_frames']=json.dumps(cuts)
    for marker in list(S.timeline_markers):
        if marker.name.startswith('PRO '): S.timeline_markers.remove(marker)
    for beat,label in [(0,'First downbeat / bevel macro'),(8,'Macro to screen to room'),
                       (23.2,'QR to phone whip'),(44,'Warm flash / cream chapter'),
                       (49.65,'A/B speed ramp'),(54,'Icon cloud'),(67,'End fade')]:
        S.timeline_markers.new('PRO '+label,frame=f(beat))
    S['pro_pass']='PROMPT-3: lens, transitions, voxels, material depth, icon cloud, chapters, word-to-UI'
    S.render.use_motion_blur=True; S.render.motion_blur_shutter=.45
    S.eevee.motion_blur_steps=4; S.eevee.volumetric_samples=32; S.eevee.use_raytracing=True
    # The cold open is lit by its own rim lights, then the product key comes up
    # exactly on the old-PC cut. Global set lights do not flatten the glass J.
    for name,power in [('Large cream key',550),('Orange rim',240),('Top softbox',400)]:
        light=bpy.data.objects[name].data; light.animation_data_clear()
        light['world_scaled']=False
        for frame,value in [(1,0),(f(4),power)]: key(light,'energy',value,frame)
        for fc in curves(light):
            for k in fc.keyframe_points: k.interpolation='CONSTANT'
    old=S.compositing_node_group
    compositor()
    if old: bpy.data.node_groups.remove(old)
    chapter_colors()
    physical_scale()
    save('PRO PASS complete: camera, focus, warm flashes, bloom, chapters and end fade')


if args.render or args.still or args.only or args.polish:
    bpy.ops.wm.open_mainfile(filepath=str(ROOT/'trailer.blend')); S=bpy.context.scene
    packed_grid=json.loads(S['beat_grid'])
    if args.beats and grid != packed_grid:
        parser.error('A different --beats grid requires a full rebuild: omit --only, --still and --render')
    grid=packed_grid; timing(grid); materials()
else: init()

if args.render: render(args.render)
elif args.still: preview(args.still,args.frame)
else:
    numbers=[] if args.polish else [int(args.only[5:])] if args.only else range(1,10)
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
    camera_drift()
    if not args.no_preview:
        for number in numbers: preview(number)
    print('Atomic construction saves:',SAVE_COUNT,flush=True)
