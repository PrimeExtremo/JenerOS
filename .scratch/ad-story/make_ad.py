"""Editable silent JenerOS story. Blender -b -P make_ad.py -- --help.

Y is up; screens face +Z. Helpers are local snapshots of the approved trailer.
No video is rendered during construction. Each beat is an atomic checkpoint.
"""
import argparse
import json
import math
import os
from pathlib import Path
import random
import re
import statistics
import sys
import time
import xml.etree.ElementTree as ET
import bpy
from mathutils import Vector, Matrix

ROOT = Path(__file__).resolve().parent
REPO = ROOT.parents[1]
ASSETS = REPO / '.scratch/trailer-blender/assets'
FPS = 60
ORDER = [1, 2, 3, 4, 5, 6, 12, 8, 9, 7, 10, 11]
NAMES = ['Second life', 'Your cloud', 'Plug in', 'Phone setup', 'At home',
         'Your photos and files', 'Old hardware', 'Two copies', 'Safe updates',
         'App Store', 'All here', 'End card slot']
LENGTHS = [8, 6, 6, 8, 4, 6, 10, 10, 8, 8, 10]
STARTS = [0]
for length in LENGTHS: STARTS.append(STARTS[-1] + length)
ap = argparse.ArgumentParser(description=__doc__)
ap.add_argument('--build-beat', type=int, choices=range(1, 13))
ap.add_argument('--beats', type=Path)
ap.add_argument('--still', type=int, choices=range(1, 13))
ap.add_argument('--frame', type=int)
ap.add_argument('--render', choices=['final', 'shots'])
ap.add_argument('--output-dir', type=Path)
ap.add_argument('--probe', action='store_true', help='Render exactly the first video frame, then stop')
ap.add_argument('--check', action='store_true')
args = ap.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
exec(compile((ROOT/'trailer_helpers.py').read_text(), 'trailer_helpers.py', 'exec'))
exec(compile((ROOT/'intro_helpers.py').read_text(), 'intro_helpers.py', 'exec'))
original_materials = materials
COL = None
CURRENT = 0
WINDOW = (1, 2)
LOCAL = None


def timing(grid):
    raw = grid['beats']
    if len(raw) < 2 or not all(math.isfinite(x) and x >= 0 for x in raw):
        raise ValueError('Need at least two finite beat times')
    if any(b <= a for a, b in zip(raw, raw[1:])): raise ValueError('Beat times must increase')
    # The supplied grid ends at 43 s. Continue its last full bar's median period.
    period = statistics.median([b-a for a,b in zip(raw[-5:-1],raw[-4:])]) if len(raw)>=5 else raw[1]-raw[0]
    beats = list(raw)
    while len(beats) <= STARTS[-1]: beats.append(beats[-1]+period)
    origin = raw[0]
    return [b-origin for b in beats], origin, period


def gf(beat):
    i = int(beat); frac = beat-i
    return 1+round((BEATS[i] if not frac else BEATS[i]+frac*(BEATS[i+1]-BEATS[i]))*FPS)


def mapped_beat(beat):
    if LOCAL:
        old_a, old_b, new_a, new_b = LOCAL
        if (old_a,old_b)==(32,44):
            # Keep all reused storage CUTS on actual integer beats.
            for left,right,aa,bb in [(32,34,48,50),(34,42,50,56),(42,44,56,58)]:
                if beat<=right: return aa+(beat-left)/(right-left)*(bb-aa)
        beat = new_a+(beat-old_a)/(old_b-old_a)*(new_b-new_a)
    return beat


def f(beat):
    return gf(mapped_beat(beat))


def save(message):
    # The reused helpers call this often. Only beat boundaries write the file.
    S['build_status'] = message
    if bpy.data.objects.get('STATUS'): bpy.data.objects['STATUS'].data.body = message


def atomic(message):
    save(message)
    S['beat_grid'] = json.dumps(GRID)
    S['timing_origin_seconds'] = ORIGIN
    S['extended_period_seconds'] = PERIOD
    S['beat_ranges'] = json.dumps(RANGES)
    S.frame_start = 1; S.frame_end = END; S.render.fps = FPS
    S.render.resolution_x = 2560; S.render.resolution_y = 1440
    S.render.resolution_percentage = 100; S.render.image_settings.media_type = 'IMAGE'
    S.render.image_settings.file_format = 'PNG'; S.eevee.taa_render_samples = 32
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.file.pack_all()
    bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'ad.tmp.blend'), copy=True)
    for attempt in range(50):
        try: os.replace(ROOT/'ad.tmp.blend',ROOT/'ad.blend'); break
        except PermissionError:
            if attempt == 49: raise
            time.sleep(.1)
    print(message, flush=True)


def finish(o):
    for c in list(o.users_collection): c.objects.unlink(o)
    COL.objects.link(o)
    visibility(o)
    o['beat'] = CURRENT
    return o


def materials():
    global BODY_FONT, BEIGE, WOOD, BLACK, GLASS, METAL, DARK, EDGE, FRAME
    original_materials()
    BODY_FONT = FONT
    BEIGE = material('Old warm cream plastic',rgb('#F6F1E7'),.05,.52)
    WOOD = material('Closet warm wood',rgb('#1F1913'),0,.75)
    BLACK = ink('True black','#000000')
    for m,col in [(DARK,'#0E0A07'),(METAL,'#1F1913'),(EDGE,'#D97757'),(FRAME,'#B9562F'),(GLASS,'#1F1913')]:
        m.node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value=(*rgb(col),1)


def shot(a,b):
    global WINDOW
    WINDOW = (f(a),f(b))


def window(a,b):
    global WINDOW
    WINDOW=(gf(a),gf(b))


def back(color):
    return box('Chapter backdrop',(0,0,-5),(200,120,.1),ink('Background '+color,color),0)


def lighting(power=1500):
    local_light('Cream softbox',(-6,7,8),power,rgb('#F6F1E7'),7,(0,0,0))
    local_light('Orange edge',(6,2,1),power*.65,rgb('#D97757'),5,(0,0,0))


def camera(label,a,b,start=(.4,.1,29),end=(-.3,.2,28),target=(0,0,0),focal=None,lens=62,stops=4,extra=None):
    cd=bpy.data.cameras.new(label); cd.lens=lens; cd.clip_start=.02; cd.clip_end=150
    cd.dof.use_dof=True; cd.dof.aperture_fstop=stops; cd.dof.aperture_blades=7
    cam=bpy.data.objects.new(label,cd); COL.objects.link(cam)
    focus=empty(label+' focus'); cd.dof.focus_object=focus
    points=[(0,start,target,focal or target),(1,end,target,focal or target)]
    if extra: points=extra
    for u,loc,look,fp in points:
        frame=round(a+(b-a-1)*u)
        key(cam,'location',loc,frame); key(cam,'rotation_euler',camera_rotation(loc,look),frame)
        key(focus,'location',fp,frame)
    for ob in (cam,focus):
        for fc in curves(ob):
            for k in fc.keyframe_points: k.interpolation='LINEAR'
    marker=S.timeline_markers.new(f'{CURRENT:02} | {label}',frame=a); marker.camera=cam
    cam['cut_start']=a; cam['cut_end']=b; cam['beat']=CURRENT
    S.camera=cam
    return cam


def cam(a,b,**kwargs):
    return camera(kwargs.pop('label',NAMES[CURRENT-1]),gf(a),gf(b),**kwargs)


def gradient():
    m=bpy.data.materials.get('Cream to orange headline')
    if m: return m
    m=mat_fadeable('Cream to orange headline',emission(hexcol('#F6F1E7'),1))
    nt=m.node_tree; tex=nt.nodes.new('ShaderNodeTexCoord'); sep=nt.nodes.new('ShaderNodeSeparateXYZ')
    ramp=nt.nodes.new('ShaderNodeValToRGB'); ramp.color_ramp.elements[0].color=hexcol('#F6F1E7')
    ramp.color_ramp.elements[1].color=hexcol('#D97757')
    nt.links.new(tex.outputs['Generated'],sep.inputs[0]); nt.links.new(sep.outputs['X'],ramp.inputs[0])
    nt.links.new(ramp.outputs['Color'],next(n for n in nt.nodes if n.type=='EMISSION').inputs[0])
    return m


def word(body,a,b,color='#F6F1E7',grad=False,wallpaper=False):
    window(a,b)
    if wallpaper: ribbon_background()
    else: back('#0E0A07')
    m=gradient() if grad else mat_fadeable('Type '+body,emission(hexcol(color),1))
    o=text('Words '+body,body,(0,0,0),1.4,11.8,mat=m)
    rise(o,WINDOW[0],WINDOW[0]+15,.22)
    for frame,alpha in [(WINDOW[0],0),(WINDOW[0]+10,1),(WINDOW[1]-1,1)]: setcolor_alpha(o,frame,alpha)
    cam(a,b,label=body,start=(.08,.03,25),end=(-.08,.02,24),target=(0,0,0),lens=58)


def words(body,a,b):
    # Adapt the old storage/update helpers onto this beat's clock.
    word(body,mapped_beat(a),mapped_beat(b))


def word_to_bays():
    """The ad uses a hard title-to-bay cut instead of the older trailer's morph."""
    return


def clean_pc(screen='dashboard',room=False):
    pc()
    for o in list(COL.objects):
        if o.name.startswith(('Opening wordmark','Second life caption')): bpy.data.objects.remove(o,do_unlink=True)
        elif o.name.startswith('Hero old PC') or (o.name.startswith('Monitor') and o.type=='EMPTY'):
            o.animation_data_clear(); o.location=(0,0,0); o.rotation_euler=(0,0,0)
        elif o.name.startswith(('Old PC tower','Tower front')):
            o.data.materials.clear(); o.data.materials.append(BEIGE)
        elif o.name.startswith('USB port'):
            o.data.materials.clear(); o.data.materials.append(BLACK)
        elif o.name.startswith('Monitor screen'):
            o.data.materials.clear(); o.data.materials.append(image_material(REPO/'[SITE]/assets/shots/src'/f'{screen}.png'))
    if room: cozy_room()


def beat1():
    a,b=STARTS[0:2]; window(a,b); back('#0E0A07'); clean_pc()
    # Keep the opening entirely physical: the monitor is asleep in the closet.
    for o in COL.objects:
        if o.name.startswith('Monitor screen'): o.data.materials.clear(); o.data.materials.append(BLACK)
    box('Closet shelf',(0,-2.95,-.2),(12,.3,6),WOOD,.08)
    box('Closet back',(0,1,-3.5),(13,12,.3),WOOD,.05)
    for x in (-6,6): box('Closet side',(x,1,-.4),(.25,12,6),WOOD,.06)
    box('Upper shelf',(0,4,-.4),(12,.25,6),WOOD,.08)
    hinge=empty('Door hinge'); hinge.location=(-6,0,3)
    door=box('Opening closet door',(0,.6,3),(12,8,.2),WOOD,.08)
    door.parent=hinge; door.location=(6,.6,0)
    handle=box('Door handle',(0,0,0),(.14,.9,.18),EDGE,.04); handle.parent=hinge; handle.location=(11.4,.1,.22)
    key(hinge,'rotation_euler',(0,0,0),gf(0)); key(hinge,'rotation_euler',(0,-1.72,0),gf(2.2)); smooth(hinge)
    light=local_light('Door warm spill',(-3,6,9),2100,rgb('#D97757'),4,(2,0,0))
    for fr,p in [(gf(0),35),(gf(2.2),2100),(gf(8),0)]: key(light.data,'energy',p,fr)
    local_light('Night fill',(3,5,1),160,rgb('#F6F1E7'),6,(0,0,0))
    rnd=random.Random(7)
    for i in range(28):
        loc=(rnd.uniform(-5,5),rnd.uniform(-2.6,3.5),rnd.uniform(-1,2))
        ob=box('Dust mote',loc,(.014,.014,.014),BEIGE,.005)
        key(ob,'location',loc,gf(a)); key(ob,'location',Vector(loc)+Vector((.18,.22,.08)),gf(b)-1)
    cam(0,4,label='Closet opens',start=(7,2,27),end=(6.3,1.8,25),target=(.6,-.2,0),lens=52)
    cam(4,8,label='Old PC on the shelf',start=(9,1,21),end=(8.2,.9,20),target=(2.1,-.3,.4),focal=(3.15,0,1),lens=65)


def beat2():
    for body,a,b in [('This old PC...',8,10),('could be',10,12),('your cloud.',12,14)]: word(body,a,b,grad=body=='your cloud.')


def beat3():
    window(14,18); back('#0E0A07'); clean_pc(); lighting()
    # Reuse the PC ports and fit the stick to the right port, oriented along Z.
    plug=empty('USB slides into front port')
    for name,loc,size,mat in [('USB body',(3.25,-.35,1.75),(.26,.12,.72),METAL),('USB connector',(3.25,-.35,1.31),(.19,.065,.23),EDGE)]:
        ob=box(name,loc,size,mat,.02); ob.parent=plug
    key(plug,'location',(0,0,1.2),gf(14)); key(plug,'location',(0,0,0),gf(15.3)); smooth(plug)
    led=next(o for o in COL.objects if o.name.startswith('Power light'))
    for fr,s in [(gf(14),.08),(gf(15.4),1),(gf(15.8),.08),(gf(16.1),1)]: key(led,'scale',(s,s,s),fr)
    usb_cam=cam(14,16,label='USB macro',start=(4.7,-.1,5.8),end=(4.5,-.15,5.6),target=(3.25,-.35,1.8),focal=(3.25,-.35,2.1),lens=55,stops=4)
    for fr in range(gf(14),gf(16)):
        S.frame_set(fr); key(usb_cam.data.dof.focus_object,'location',(3.25,-.35,2.1+plug.location.z),fr)
    cam(16,18,label='Amber power',start=(4.2,.5,4.5),end=(4,.4,4.3),target=(3.15,0,1.1),lens=60,stops=3.5)
    window(18,20); back('#0E0A07'); clean_pc(); lighting()
    for scr in [o for o in COL.objects if o.name.startswith('Monitor screen')]:
        scr.data.materials.clear(); scr.data.materials.append(BLACK)
    polys=svg_paths(REPO/'[BRAND]/logo/j-monogram-light.svg')
    for group in polys:
        for poly in group:
            cu=bpy.data.curves.new('Approved boot J','CURVE'); cu.dimensions='2D'; cu.fill_mode='BOTH'
            sp=cu.splines.new('POLY'); sp.points.add(len(poly)-1)
            for point,(x,y) in zip(sp.points,poly): point.co=((x-256)/352*.75,(256-y)/352*.75,0,1)
            sp.use_cyclic_u=True; cu.materials.append(CREAM)
            ob=bpy.data.objects.new('Boot J',cu); S.collection.objects.link(ob); ob.location=(-1.4,-.15,.35); finish(ob)
    cam(18,20,label='J boot splash',start=(-1.15,-.1,14),end=(-1.4,0,13.4),target=(-1.4,-.15,.35),lens=63)


def beat4():
    window(20,24); back('#1F1913'); lighting()
    monitor=panel('Welcome on monitor','setup-welcome',(-2.5,0,0),6.5); monitor.animation_data_clear(); monitor.location=(0,0,0)
    # Real QR shown on top of the real welcome screen as requested.
    rounded_image('Pairing QR',ASSETS/'qr.png',(-1.55,-.25,.09),.85,.85,.03)
    phone=panel('Phone','phone-setup',(3,0,.5),2.25,phone=True)
    key(phone,'location',(0,-6,0),gf(20)); key(phone,'location',(0,0,0),gf(22)); smooth(phone)
    cam(20,24,label='QR to phone whip',extra=[(0,(-1.45,-.2,6),(-1.55,-.25,.1),(-1.55,-.25,.1)),(.40,(-1.35,-.15,5.9),(-1.55,-.25,.1),(-1.55,-.25,.1)),(.47,(3,0,20),(3,0,.5),(3,0,.55)),(1,(3.2,.1,19.5),(3,0,.5),(3,0,.55))],lens=60,stops=4)
    window(24,26); back('#1F1913'); lighting()
    panel('Phone connected','phone-setup',(2.8,0,0),2.3,phone=True)
    text('Set up title','Set up',(-2.3,.7,.4),.95,mat=CREAM)
    before=set(o.name for o in COL.objects)
    box('Connected pill',(-2.3,-.7,.1),(3.7,.85,.15),GLASS,.3)
    text('Connected label','Connected',(-2.3,-.7,.23),.46,mat=CREAM)
    root=group_since('Connected grows',before); root.location=(-2.3,-.7,0)
    for o in root.children: o.location-=root.location
    key(root,'scale',(.05,.05,.05),gf(24)); key(root,'scale',(1,1,1),gf(24.8)); smooth(root)
    cam(24,26,label='Connected',start=(.4,.1,24),end=(.2,.2,23.5),lens=60)
    word('from your phone.',26,28)


def beat5():
    window(28,32); back('#1F1913'); clean_pc(room=True); lighting(1100)
    for o in COL.objects:
        if o.name.startswith('Room rear wall'): o.scale=(8,8,1)
    # A smaller source behind the plant projects leaf silhouettes on the wall.
    local_light('Plant shadows',(-8,-1,3),1300,rgb('#D97757'),.25,(-3,2,-3.5))
    cam(28,32,label='Cozy room reveal',start=(6.8,1.1,29),end=(5.1,1.3,28),target=(0,-.35,0),focal=(-1.4,0,.35),lens=48,stops=4)


def ribbon_background():
    # Reuse the actual approved SVG's cubic paths as editable Blender curves.
    source=REPO/'[BRAND]/wallpapers/jeneros-ribbons-2560x1440-dark.svg'
    tree=ET.parse(source); back('#1F1913')
    paths=[el for el in tree.iter() if el.tag.endswith('path') and el.attrib.get('d','').startswith(('M730','M-160'))]
    for index,el in enumerate(paths[:2]):
        tokens=re.findall(r'[MCSHVZ]|-?\d+(?:\.\d+)?',el.attrib['d']); i=0; points=[]; current=(0,0); previous_control=None
        while i<len(tokens):
            cmd=tokens[i]; i+=1
            if cmd=='M': current=tuple(map(float,tokens[i:i+2])); i+=2; points.append(current)
            elif cmd in ('C','S'):
                p0=current
                if cmd=='C': p1=tuple(map(float,tokens[i:i+2])); i+=2
                else: p1=tuple(2*current[j]-previous_control[j] for j in range(2)) if previous_control else current
                p2=tuple(map(float,tokens[i:i+2])); p3=tuple(map(float,tokens[i+2:i+4])); i+=4
                for k in range(1,33):
                    t=k/32; points.append(tuple((1-t)**3*p0[j]+3*(1-t)**2*t*p1[j]+3*(1-t)*t*t*p2[j]+t**3*p3[j] for j in range(2)))
                current=p3; previous_control=p2
            elif cmd=='H': current=(float(tokens[i]),current[1]); i+=1; points.append(current)
            elif cmd=='V': current=(current[0],float(tokens[i])); i+=1; points.append(current)
            elif cmd=='Z': pass
        coords=[((x-800)/1600*30,(500-y)/1000*16.875,-3) for x,y in points]
        mat=material('Approved amber ribbon',rgb('#1F1913'),0,.75,.08)
        shader=mat.node_tree.nodes.get('Principled BSDF')
        shader.inputs['Base Color'].default_value=hexcol('#1F1913')
        shader.inputs['Emission Color'].default_value=hexcol('#B9562F'); shader.inputs['Emission Strength'].default_value=.18
        shader.inputs['Metallic'].default_value=0; shader.inputs['Roughness'].default_value=.75
        shader.inputs['Specular IOR Level'].default_value=.2
        if index==0:
            mesh=bpy.data.meshes.new('Wallpaper cubic silhouette'); mesh.from_pydata(coords,[],[tuple(range(len(coords)))])
            o=bpy.data.objects.new('Approved wallpaper ribbon',mesh); S.collection.objects.link(o); mesh.materials.append(mat); finish(o)
        else: line('Approved wallpaper crossing',coords,mat,1.1)
    lighting(800)


def beat6():
    for body,a,b in [('Your photos.',32,34),('Your files.',34,36),('At home.',36,38)]: word(body,a,b,grad=body=='At home.',wallpaper=True)


def hardware(kind):
    before=set(o.name for o in COL.objects)
    if kind=='Old laptop':
        box('Laptop base',(0,-1.1,0),(4.7,.22,2.5),BEIGE,.12)
        box('Laptop lid',(0,.5,-.9),(4.7,3,.22),BEIGE,.12)
        rounded_image('Laptop screen',REPO/'[SITE]/assets/shots/src/dashboard.png',(0,.5,-.77),4.35,2.45,.06)
        for row in range(4):
            for col in range(10): box('Laptop key',(-1.8+col*.4,-.96,-.75+row*.32),(.29,.03,.21),DARK,.015)
    elif kind=='Office PC':
        box('Beige office PC',(0,0,0),(2.8,4,2.8),BEIGE,.16)
        box('Optical tray',(0,.9,1.44),(2.3,.32,.08),METAL,.03)
        for i in range(8): box('Office vent',(0,-.6-i*.13,1.44),(2,.045,.06),DARK,.015)
        box('Office power',(1,.15,1.44),(.12,.12,.06),ORANGE,.04)
    else:
        box('Mini PC',(0,0,0),(3,1.1,2.6),METAL,.2)
        for x in (-.8,-.3): box('Mini USB',(x,0,1.32),(.3,.13,.06),BLACK,.02)
        box('Mini amber LED',(.9,0,1.32),(.1,.1,.06),ORANGE,.03)
    return group_since(kind+' tumble',before)


def foliage():
    leaf=material('Warm foliage',rgb('#1F1913'),0,.7)
    rnd=random.Random(12)
    for i in range(18):
        z=rnd.uniform(16,21); edge=(25-z)*.3
        loc=(z/25*5+rnd.choice([-1,1])*edge*rnd.uniform(.95,1.35),z/25*2+rnd.uniform(-2.2,2.2),z)
        bpy.ops.mesh.primitive_uv_sphere_add(segments=20,ring_count=12,location=loc)
        o=bpy.context.object; o.name='Soft foliage'; o.scale=(.22,.65,.07); o.rotation_euler=(.2,rnd.uniform(-.5,.5),rnd.uniform(-1,1))
        for poly in o.data.polygons: poly.use_smooth=True
        o.data.materials.append(leaf); finish(o)


def beat7():
    for label,a,b in [('Old laptop',38,40),('Office PC',40,42),('Mini PC',42,44)]:
        window(a,b); back('#B9562F'); lighting(2100); foliage(); root=hardware(label)
        for t,loc,rot in [(a,(-5,.5,-1),(.25,-.65,-.2)),(a+.65,(0,.25,0),(.12,.1,.04)),(b-.05,(.35,.15,0),(.05,.3,-.04))]:
            key(root,'location',loc,gf(t)); key(root,'rotation_euler',rot,gf(t))
        smooth(root)
        text(label+' label',label,(0,-2.6,1.5),.72,mat=CREAM)
        cam(a,b,label=label,start=(5,2,25),end=(4.5,1.8,24.5),target=(0,-.1,0),lens=60,stops=3.5)
    window(44,48); back('#F6F1E7')
    o=text('Handwritten free','for free!',(0,.25,0),1.65,mat=ink('Free orange','#B9562F')); o.data.shear=.2; o.rotation_euler.z=.04
    pts=[(-3.2+i*.13,-.85+.06*math.sin(i*.17),.1) for i in range(50)]
    stroke=line('Hand drawn underline',pts,ORANGE,.028)
    key(stroke.data,'bevel_factor_end',.001,gf(44)); key(stroke.data,'bevel_factor_end',1,gf(45.5)); smooth(stroke.data)
    # Original small heart outline in orange, one continuous hand-drawn stroke.
    heart=[]
    for i in range(101):
        t=i*2*math.pi/100; heart.append((3.5+.023*16*math.sin(t)**3,.85+.023*(13*math.cos(t)-5*math.cos(2*t)-2*math.cos(3*t)-math.cos(4*t)),.1))
    line('Little orange heart',heart,ORANGE,.035)
    cam(44,48,label='For free',start=(.1,.1,25),end=(-.1,.15,24),lens=58)


def beat8():
    global LOCAL
    LOCAL=(32,44,48,58); scene6(); LOCAL=None
    # Existing disk/bay choreography, with readable quiet titles.
    for o in COL.objects:
        if o.type=='FONT' and o.name.startswith('Storage heading'): o.data.body='Two copies.'
        if o.type=='FONT' and o.name.startswith('Mirror caption'): o.data.body='One calm place.'
    for i in range(2):
        root=next(o for o in COL.objects if o.name.startswith('Disk drops '+str(i)))
        root.animation_data_clear()
        key(root,'location',(0,1.6,0),gf(50+i)); key(root,'location',(0,0,0),gf(50.8+i)); smooth(root)
    fill=next(o for o in COL.objects if o.name.startswith('Mirror fill'))
    fill.animation_data_clear(); visibility(fill,gf(50),gf(56))
    key(fill,'scale',(.001,1,1),gf(52)); key(fill,'scale',(1,1,1),gf(53)); smooth(fill)
    window(50,58); back('#B9562F'); lighting(1400)
    cam(50,52,label='First disk macro',start=(5,-1,20),end=(4.7,-.8,19.6),target=(0,-.2,0),focal=(-1.6,0,.3),lens=58)
    cam(52,54,label='Mirror fills',start=(1.8,-1.2,21),end=(1.5,-1.1,20.7),target=(0,-.5,0),focal=(0,-1,.3),lens=58)
    cam(54,56,label='Storage ready',start=(.4,-.1,24),end=(.1,0,23.5),target=(0,-.4,.1),lens=58)
    cam(56,58,label='Storage screen',start=(.4,.2,27),end=(.1,.1,26.5),lens=58)


def beat9():
    global LOCAL
    LOCAL=(44,52,58,66); scene7(); LOCAL=None
    window(62,66); back('#F6F1E7'); lighting(1000)
    # Title and explanatory caption stay graphite on cream; card text stays cream.
    for o in COL.objects:
        if o.type=='FONT' and o.name.startswith(('Update heading','Rollback caption')):
            o.data.materials.clear(); o.data.materials.append(ink('Graphite type','#1F1913'))
    cam(62,64,label='A B anticipate',start=(2,1,27),end=(1.6,.8,26.5),lens=60)
    cam(64,66,label='A B speed ramp',start=(.8,.3,27),end=(.4,.2,26),lens=60)


def beat10():
    window(66,70); back('#0E0A07'); lighting()
    panel('Store discover','store-discover',(0,-.15,-.7),10.7)
    tiles=[('Files',(.311,.458,.349,.518)),('App Store',(.417,.445,.455,.505)),('Photos',(.628,.458,.667,.518)),('Backup',(.734,.458,.772,.518)),('Machines',(.841,.458,.879,.518))]
    for i,(label,uv) in enumerate(tiles):
        before=set(o.name for o in COL.objects); x=(i-2)*2.15
        box(label+' tile',(x,.5,1.4),(1.65,1.65,.3),GLASS,.24)
        rounded_image(label+' actual icon',REPO/'[SITE]/assets/shots/src/dashboard.png',(x,.5,1.57),1.35,1.35,.16,uv)
        root=group_since(label+' fan',before)
        key(root,'rotation_euler',(0,(i-2)*.19,(i-2)*.1),gf(66)); key(root,'rotation_euler',(0,(i-2)*.08,0),gf(70)-1)
        key(root,'location',(0,-2,-1),gf(66)); key(root,'location',(0,.2,.2),gf(67+i*.16)); smooth(root)
    text('Store title','Your own app store.',(0,4,.4),.75,mat=CREAM)
    cam(66,68,label='App tiles fan',start=(5,-.5,28),end=(4.5,-.3,27),target=(0,.3,0),lens=60)
    cam(68,70,label='Through the tiles',start=(3,.3,26),end=(2.4,.4,25),target=(0,.3,0),lens=58)
    window(70,74); back('#1F1913'); lighting()
    panel('Real App Store','store-discover',(0,-.3,0),11)
    text('Browse title','Find something good.',(0,4,.1),.72,mat=CREAM)
    text('Honest availability','App installs are coming soon.',(0,-4.35,.2),.34,mat=CREAM)
    verts=[(0,0,0),(0,-.6,0),(.16,-.45,0),(.29,-.68,0),(.42,-.6,0),(.28,-.38,0),(.52,-.35,0)]
    mesh=bpy.data.meshes.new('Cursor'); mesh.from_pydata([tuple(v*.7 for v in point) for point in verts],[],[tuple(range(7))]); cursor=bpy.data.objects.new('Browse cursor',mesh); S.collection.objects.link(cursor); mesh.materials.append(CREAM); finish(cursor)
    key(cursor,'location',(2,-1,.25),gf(70)); key(cursor,'location',(-3.9,1.75,.25),gf(71.7)); smooth(cursor)
    for beat,sz in [(71.7,1),(72,.82),(72.2,1)]: key(cursor,'scale',(sz,sz,sz),gf(beat))
    cam(70,74,label='Browse store',start=(.6,.1,28),end=(.2,.15,27),lens=58)


def beat11():
    window(74,84); back('#1F1913'); lighting(950)
    cards=[('Phone setup','phone-setup',-4.25,1.3),('Safe updates',None,0,1.3),('Storage','settings-storage',4.25,1.3),
           ('App Store','store-discover',-4.25,-1.8),('Free & open source',None,0,-1.8),('Runs on old PCs','dashboard',4.25,-1.8)]
    for i,(label,img,x,y) in enumerate(cards):
        before=set(o.name for o in COL.objects)
        box(label+' recap card',(x,y,0),(3.95,2.8,.2),GLASS,.25)
        text(label+' recap title',label,(x,y-.88,.19),.35,3.55,mat=CREAM)
        if img:
            if img=='phone-setup': rounded_image(label+' miniature',REPO/'[SITE]/assets/shots/src'/f'{img}.png',(x,y+.28,.15),.7,1.5,.05)
            elif label=='Runs on old PCs':
                rounded_image(label+' miniature',REPO/'[SITE]/assets/shots/src'/f'{img}.png',(x-.35,y+.3,.15),2.35,1.4,.08)
                box('Recap beige tower',(x+1.22,y+.3,.15),(.55,1.45,.3),BEIGE,.06)
                box('Recap optical drive',(x+1.22,y+.65,.32),(.41,.08,.03),DARK,.01)
            else: rounded_image(label+' miniature',REPO/'[SITE]/assets/shots/src'/f'{img}.png',(x,y+.3,.15),3.35,1.65,.08)
        elif label=='Safe updates':
            for j in range(2):
                box('Recap system slab',(x+(j-.5)*1.2,y+.3,.15),(.9,1.2,.1),FRAME,.1)
                text('Recap AB','AB'[j],(x+(j-.5)*1.2,y+.3,.24),.65,mat=CREAM)
        else:
            free=text('Free recap','for free!',(x,y+.35,.2),.7,mat=ACCENT); free.data.shear=.2
            line('Free recap underline',[(x-1.3+j*.065,y-.1+.03*math.sin(j*.2),.2) for j in range(41)],ORANGE,.018)
        root=group_since(label+' flies in',before)
        start=gf(74+i*.4); key(root,'location',((i%2*2-1)*10,-5,4),start); key(root,'location',(0,0,0),start+42)
        key(root,'rotation_euler',(.25,.3,.16),start); key(root,'rotation_euler',(0,0,0),start+42); smooth(root)
    text('Private at home recap','Private at home.',(0,3.55,.3),.74,mat=CREAM)
    cam(74,78,label='Bento cards arrive',start=(2,.8,31),end=(1.3,.65,30.5),target=(0,.2,0),lens=57)
    cam(78,82,label='Bento settles',start=(.5,.3,30),end=(0,.4,29),target=(0,.2,0),lens=57)
    cam(82,84,label='Bento final push',start=(0,.4,29),end=(-.25,.45,28.5),target=(0,.2,0),lens=57)


def beat12():
    global WINDOW
    WINDOW=RANGES[11]; back('#000000')
    camera('Six second black end card slot',*WINDOW,start=(0,0,25),end=(.05,0,24.9))


def init():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    s=bpy.context.scene; s.name='JenerOS | Your cloud at home'
    s.render.engine='BLENDER_EEVEE'; s.render.use_motion_blur=True; s.render.motion_blur_shutter=.4
    s.render.filter_size=1.; s.eevee.taa_render_samples=32; s.eevee.use_raytracing=True
    s.eevee.motion_blur_steps=4
    s.view_settings.view_transform='Standard'; s.view_settings.look='None'
    s.world=bpy.data.worlds.new('Warm night'); s.world.use_nodes=True
    s.world.node_tree.nodes['Background'].inputs[0].default_value=hexcol('#1F1913')
    s.world.node_tree.nodes['Background'].inputs[1].default_value=.3
    bpy.ops.object.text_add(location=(0,1000,0)); status=bpy.context.object; status.name='STATUS'; status.hide_render=True
    s['completed_beats']='[]'
    return s


def build(number):
    global COL,CURRENT,WINDOW
    CURRENT=number; WINDOW=RANGES[number-1]
    name=f'{number:02} {NAMES[number-1]}'
    existing=bpy.data.collections.get(name)
    if existing:
        for o in list(existing.objects): bpy.data.objects.remove(o,do_unlink=True)
        bpy.data.collections.remove(existing)
    for marker in list(S.timeline_markers):
        if marker.name.startswith(f'{number:02} |'): S.timeline_markers.remove(marker)
    COL=bpy.data.collections.new(name); S.collection.children.link(COL)
    globals()[f'beat{number}']()
    root=empty(name+' physical scale'); root.scale=(.2,)*3
    for o in list(COL.objects):
        if o!=root and o.parent is None: o.parent=root
        if o.type=='LIGHT':
            o.data.energy*=.04
            for fc in curves(o.data):
                if fc.data_path=='energy':
                    for k in fc.keyframe_points:
                        for co in (k.co,k.handle_left,k.handle_right): co.y*=.04
    done=set(json.loads(S['completed_beats'])); done.add(number); S['completed_beats']=json.dumps(sorted(done))
    S.frame_set(WINDOW[0]); atomic(f'Beat {number:02} complete: {NAMES[number-1]}. Stills awaiting inspection.')


def select_camera(frame):
    cameras=[o for o in S.objects if o.type=='CAMERA' and o.get('cut_start',END+1)<=frame<o.get('cut_end',0)]
    if len(cameras)!=1: raise AssertionError(f'Frame {frame}: {len(cameras)} active cameras')
    S.camera=cameras[0]; S.frame_set(frame)


def stills(number,frame=None):
    samples={1:(.3,.75),2:(.23,.89),3:(.23,.87),4:(.3,.66),5:(.25,.75),6:(.23,.88),7:(.14,.88),8:(.38,.78),9:(.3,.9),10:(.3,.85),11:(.4,.87),12:(.2,.8)}
    a,b=RANGES[number-1]; frames=[frame] if frame else [round(a+(b-a-1)*u) for u in samples[number]]
    (ROOT/'stills').mkdir(exist_ok=True)
    S.render.resolution_x=1280; S.render.resolution_y=720; S.render.resolution_percentage=100
    S.eevee.taa_render_samples=16; S.render.image_settings.media_type='IMAGE'; S.render.image_settings.file_format='PNG'
    for i,fr in enumerate(frames):
        select_camera(fr); S.render.filepath=str(ROOT/'stills'/f'beat-{number:02}-{i+1}-f{fr:04}.png')
        bpy.ops.render.render(write_still=True)
        print(f'INSPECT {S.render.filepath}',flush=True)


def check():
    completed=json.loads(S['completed_beats']); assert set(completed)==set(range(1,13))
    cameras=[o for o in S.objects if o.type=='CAMERA']
    assert S.render.use_motion_blur and S.render.fps==60
    for camera_ob in cameras:
        assert camera_ob.data.dof.use_dof and camera_ob.data.dof.focus_object
        assert 2.8<=camera_ob.data.dof.aperture_fstop<=4
        duration=camera_ob['cut_end']-camera_ob['cut_start']
        assert camera_ob['cut_start'] in {gf(i) for i in range(STARTS[-1]+1)},(camera_ob.name,'off beat cut')
        if camera_ob['beat']!=12: assert 55<=duration<=180,(camera_ob.name,duration)
        assert len([fc for fc in curves(camera_ob) if fc.data_path=='location'])==3
    visual=[o for o in S.objects if 'shot_start' in o and o.type in ('MESH','FONT','CURVE')]
    for fr in range(1,END+1):
        S.frame_set(fr)
        cs=[c for c in cameras if c['cut_start']<=fr<c['cut_end']]
        assert len(cs)==1,(fr,'camera cuts',len(cs))
        beat=next(i+1 for i,(a,b) in enumerate(RANGES) if a<=fr<b)
        for ob in visual:
            visible=not ob.hide_render
            assert visible==(ob['shot_start']<=fr<ob['shot_end']),(fr,ob.name,'visibility')
            if visible: assert ob['beat']==beat,(fr,ob.name,'cross-cut leak')
        if beat==12:
            assert all(ob.name.startswith('Chapter backdrop') for ob in visual if not ob.hide_render)
    report={'frames_checked':END,'seconds':END/FPS,'beats':completed,'camera_cuts':len(cameras),'cross_beat_leaks':0,'end_card_frames':360,'fps':60,'audio':'NONE'}
    (ROOT/'cut-check.json').write_text(json.dumps(report,indent=2))
    print(json.dumps(report),flush=True)


def render(mode):
    assert set(json.loads(S['completed_beats']))==set(range(1,13)), 'Finish all beats before rendering'
    if not args.probe and (args.output_dir is None or args.output_dir.resolve().drive.upper()=='C:'):
        raise ValueError('Large final videos must use --output-dir on S:, not C:')
    dest=(args.output_dir or ROOT/'out')
    if mode=='shots': dest=dest/'shots'
    dest.mkdir(parents=True,exist_ok=True)
    S.render.resolution_x=2560; S.render.resolution_y=1440; S.render.resolution_percentage=100
    S.render.fps=60; S.render.filter_size=1.; S.eevee.taa_render_samples=32
    S.render.image_settings.media_type='VIDEO'; S.render.image_settings.file_format='FFMPEG'
    S.render.ffmpeg.format='MPEG4'; S.render.ffmpeg.codec='H264'
    S.render.ffmpeg.constant_rate_factor='PERC_LOSSLESS'; S.render.ffmpeg.ffmpeg_preset='BEST'; S.render.ffmpeg.audio_codec='NONE'
    clips=[('jeneros-ad',1,END)] if mode=='final' else [(f'{i+1:02}-{re.sub(r"[^a-z0-9]+","-",NAMES[i].lower())}',a,b-1) for i,(a,b) in enumerate(RANGES)]
    if args.probe: clips=clips[:1]
    for name,a,b in clips:
        select_camera(a); S.frame_start=a; S.frame_end=a if args.probe else b
        S.render.filepath=str(dest/(name+('-probe' if args.probe else '')+'.mp4'))
        print(f'RENDER {mode} {a}-{S.frame_end} 2560x1440 60fps silent H264 PERC_LOSSLESS BEST',flush=True)
        bpy.ops.render.render(animation=True)
        print(f'FIRST FRAME CONFIRMED: {S.render.filepath}',flush=True)
    if args.probe:
        (ROOT/f'{mode}-probe.json').write_text(json.dumps({'mode':mode,'first_frame':clips[0][1],'resolution':[2560,1440],'fps':60,'samples':32,'codec':'H264','crf':'PERC_LOSSLESS','preset':'BEST','audio':'NONE','stopped_after_first_frame':True},indent=2))


if __name__=='__main__':
    exists=(ROOT/'ad.blend').exists()
    if exists and (args.build_beat or args.still or args.render or args.check):
        bpy.ops.wm.open_mainfile(filepath=str(ROOT/'ad.blend')); S=bpy.context.scene
        GRID=json.loads(S['beat_grid'])
        if args.beats and json.loads(args.beats.read_text(encoding='utf-8-sig'))!=GRID: ap.error('Retime using a full rebuild: omit --build-beat, --still, --render and --check')
    else:
        GRID=json.loads((args.beats or REPO/'[SITE]/assets/video/beats.json').read_text(encoding='utf-8-sig')); S=init()
    BEATS,ORIGIN,PERIOD=timing(GRID)
    RANGES=[(gf(a),gf(b)) for a,b in zip(STARTS,STARTS[1:])]
    RANGES.append((gf(STARTS[-1]),gf(STARTS[-1])+360)); END=RANGES[-1][1]-1
    materials()
    if args.render: render(args.render)
    elif args.check:
        check(); select_camera(round((RANGES[0][0]+RANGES[0][1])*.5))
        atomic('All 12 beats built. Every-frame cut audit passed. Full video render remains for Claude.')
    elif args.still: stills(args.still,args.frame)
    else:
        for number in [args.build_beat] if args.build_beat else ORDER:
            build(number); stills(number)
        print('Saved ad.blend. Inspect stills before continuing.',flush=True)
