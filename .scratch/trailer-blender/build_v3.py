"""VO-led PROMPT-5 story. Blender 5.2; no third-party Python dependencies."""
import argparse, json, math, os, sys, time, types
from pathlib import Path
import bpy
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view
ROOT=Path(__file__).resolve().parent
sys.path.insert(0,str(ROOT))
import analyze_audio
p=argparse.ArgumentParser()
p.add_argument('--render',choices=['draft','final','vertical','shots'])
p.add_argument('--check-only',action='store_true')
p.add_argument('--probe',action='store_true')
p.add_argument('--output-dir',type=Path)
p.add_argument('--no-preview',action='store_true')
p.add_argument('--still',type=int)
p.add_argument('--frame',type=int)
p.add_argument('--check-cuts',action='store_true')
p.add_argument('--review-stills',action='store_true')
p.add_argument('--polish',action='store_true',help='Refresh v3 captions and camera paths without rebuilding geometry')
p.add_argument('--beats',type=Path)
a=p.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
if a.probe and not a.render:p.error('--probe requires --render')
if a.check_only and not (a.render or a.check_cuts):p.error('--check-only requires --render or --check-cuts')
# Retain the PRO geometry, materials, screenshots and exact approved SVG paths.
P=types.ModuleType('pro'); P.__file__=str(ROOT/'build_trailer_pro.py')
argv=sys.argv; sys.argv=[argv[0]]
exec(compile((ROOT/'build_trailer_pro.py').read_text().split('if args.render or args.still or args.only or args.polish:')[0],P.__file__,'exec'),P.__dict__)
sys.argv=argv
OUT=ROOT/'out'; OUT.mkdir(exist_ok=True)
LIVE=ROOT/'live/v3'; LIVE.mkdir(parents=True,exist_ok=True)
S=None; SHOTS=[]; Q=None; GRID=None
B=P.box; T=P.text; K=P.key; V=P.visibility
def owner_curves(owner):
    data=owner.animation_data
    if not data or not data.action or not data.action_slot:return []
    return [fc for layer in data.action.layers for strip in layer.strips for bag in strip.channelbags
            if bag.slot_handle==data.action_slot.handle for fc in bag.fcurves]
# Blender 5 can share one Action between object and data slots. Never scale or
# ease another owner's curves (notably boolean visibility alongside light power).
P.curves=owner_curves
def f(t):return round(t*60)+1
def finish(o):
    if P.COL:
        for c in list(o.users_collection):c.objects.unlink(o)
        P.COL.objects.link(o); V(o); o['v3_shot']=Q['id']
    return o
P.finish=finish; P.save=lambda message:None
def save(message):
    S['build_status']=message; S['v3_shots']=json.dumps(SHOTS); S['beat_grid']=json.dumps(GRID)
    S['voiceover_lines']=(ROOT/'voiceover/lines.json').read_text()
    S.render.resolution_x=2560; S.render.resolution_y=1440; S.render.resolution_percentage=100
    S.render.fps=60; S.frame_start=1; S.frame_end=SHOTS[-1]['b']-1; S.eevee.taa_render_samples=32
    bpy.context.preferences.filepaths.save_version=0; bpy.ops.file.pack_all()
    bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'trailer.tmp.blend'),copy=True)
    for attempt in range(50):
        try:os.replace(ROOT/'trailer.tmp.blend',ROOT/'trailer.blend');break
        except PermissionError:
            if attempt==49:raise
            time.sleep(.1)
    P.log(message,step='PROMPT-5: '+message)
def anim(o,prop,points):
    for u,v in points:K(o,prop,v,round(Q['a']+u*(Q['b']-Q['a']-1)))
    P.smooth(o)
def before():return set(o.name for o in P.COL.objects)
def group(name,old,loc=(0,0,0),scale=1):
    o=P.group_since(name,old);o.location=loc;o.scale=(scale,)*3;return o
def noise(name,color,metal=0,rough=.5):
    m=P.material(name,P.rgb(color),metal,rough);n=m.node_tree.nodes;l=m.node_tree.links
    bs=n.get('Principled BSDF');tex=n.new('ShaderNodeTexNoise');tex.inputs['Scale'].default_value=95
    bump=n.new('ShaderNodeBump');bump.inputs['Strength'].default_value=.2;bump.inputs['Distance'].default_value=.014
    ramp=n.new('ShaderNodeMapRange');ramp.inputs['To Min'].default_value=rough*.7;ramp.inputs['To Max'].default_value=min(1,rough*1.2)
    l.new(tex.outputs['Fac'],bump.inputs['Height']);l.new(bump.outputs['Normal'],bs.inputs['Normal'])
    l.new(tex.outputs['Fac'],ramp.inputs['Value']);l.new(ramp.outputs['Result'],bs.inputs['Roughness']);return m
def sphere(name,loc,scale,mat):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=12,ring_count=8,location=loc)
    o=bpy.context.object;o.name=name;o.scale=scale;o.data.materials.append(mat);return finish(o)
def screw(x,y,z):
    sphere('Crosshead screw',(x,y,z),(.045,.045,.018),P.METAL)
    for dx,dy in ((.03,0),(0,.03)):P.line('Screw slot',[(x-dx,y-dy,z+.019),(x+dx,y+dy,z+.019)],P.DARK,.005)
def tower(name,loc=(0,0,0),scale=1,beige=True):
    old=before();m=BEIGE if beige else PAINT
    B(name+' folded steel',(0,0,0),(1.65,3.7,2.3),m,.035)
    B('Front seam',(0,0,1.17),(1.55,3.55,.055),P.DARK,.022)
    B('Molded front',(0,0,1.22),(1.5,3.49,.075),m,.03)
    for y in (.98,.65):
        B('Optical bay seam',(0,y,1.27),(1.28,.29,.03),P.DARK,.008)
        B('Optical tray',(0,y,1.29),(1.22,.23,.025),m,.008)
        B('Eject key',(.46,y,1.31),(.12,.055,.02),P.METAL,.009)
    for row in range(12):
        for col in range(5):B('Punched cooling vent',(-.52+col*.25,-.38-row*.085,1.27),(.17,.023,.025),P.DARK,.006)
    for x in (-.43,-.1):
        B('USB metal port',(x,.18,1.285),(.23,.13,.035),P.METAL,.007)
        B('USB opening',(x,.18,1.308),(.18,.08,.02),P.DARK,.002)
        B('USB tongue',(x,.16,1.322),(.14,.015,.01),BEIGE,.002)
    sphere('Headphone jack',(.3,.18,1.29),(.055,.055,.02),P.DARK)
    sphere('Power button',(.53,.43,1.29),(.085,.085,.035),P.METAL)
    B('Amber LED',(.53,.62,1.29),(.035,.035,.02),P.ORANGE,.01)
    for x in (-.68,.68):
        for y in (-1.55,1.55):screw(x,y,1.28)
    for x in (-.55,.55):
        for z in (-.7,.7):B('Rubber foot',(x,-1.91,z),(.24,.12,.3),P.DARK,.025)
    T('Asset tag','OFFICE PC / 2012',(0,-1.55,1.29),.085,1.1,mat=P.CREAM)
    P.line('Side seam',[(.827,-1.7,.95),(.827,1.7,.95),(.827,1.7,-.96)],P.DARK,.009)
    P.line('Power cable',[(.55,-1.2,-1.15),(.75,-1.9,-1.6),(1.4,-1.95,-1.7),(1.7,-1.94,-.5)],P.DARK,.045)
    return group(name,old,loc,scale)
def laptop(loc,scale=1):
    old=before();B('Laptop base',(0,-.6,.55),(3.4,.17,2.2),PAINT,.04)
    for row in range(5):
        for col in range(12):B('Laptop key',(-1.38+col*.25,-.49,-.18+row*.23),(.19,.026,.17),P.DARK,.018)
    B('Trackpad',(0,-.502,1.22),(1,.012,.43),P.METAL,.025)
    B('Laptop lid',(0,.55,-.55),(3.45,2.25,.14),PAINT,.035)
    ui('Laptop real desktop','dashboard',(0,.55,-.464),3.2,2)
    sphere('Webcam',(0,1.63,-.455),(.032,.032,.01),P.DARK)
    for x in (-1.2,1.2):B('Laptop hinge',(x,-.52,-.52),(.4,.18,.2),P.METAL,.025)
    return group('Old laptop',old,loc,scale)
def plant(x=-5,y=-2.6,z=-1.8,scale=1):
    old=before();B('Terracotta pot',(0,.4,0),(.85,.85,.85),CLAY,.13)
    for i in range(9):
        angle=i*2.4;end=(math.sin(angle)*.8,1.4+i*.1,math.cos(angle)*.5)
        P.line('Plant stem',[(0,.6,0),end],LEAF,.014)
        o=sphere('Long leaf',end,(.18,.53,.035),LEAF);o.rotation_euler=(.2,0,math.sin(angle)*1.1)
    return group('Plant',old,(x,y,z),scale)
def room(closet=False):
    B('Sunlit plaster wall',(0,1,-3.8),(24,14,.18),PLASTER,0)
    B('Walnut desk',(0,-2.55,-.4),(15,.23,5.4),WOOD,.07)
    for x in (-6,6):B('Desk leg',(x,-4,-1),(.23,3,.35),PAINT,.025)
    for i in range(3):
        B('Book pages',(3.6,-2.25+i*.19,-.8),(1.8,.15,1.2),BEIGE,.015)
        B('Book cover',(3.6,-2.34+i*.19,-.8),(1.85,.035,1.24),CLAY if i%2 else PAINT,.005)
    sphere('Ceramic mug',(4.9,-2.02,.9),(.35,.47,.35),BEIGE)
    P.line('Mug handle',[(5.12,-1.7,.9),(5.5,-1.75,.9),(5.52,-2.15,.9),(5.13,-2.2,.9)],BEIGE,.065)
    plant();P.local_light('Golden window',(-5,5,4),1700,(1,.71,.42),3,(0,0,-2))
    plant(-3,1.2,-1.5,1.35)
    for x in (-5.2,-2.4):B('Window shadow caster',(x,3,1.3),(.08,7,.1),PAINT,.005)
    if closet:
        B('Closet back',(0,0,-2.35),(4.2,5.2,.2),WOOD,.02)
        for x in (-2.1,2.1):B('Closet side',(x,0,-.2),(.2,5.2,4.4),WOOD,.025)
        B('Closet shelf',(0,2.5,-.1),(4.4,.2,4.4),WOOD,.025)
        B('Closet base',(0,-2.25,-.1),(4.4,.18,4.4),WOOD,.025)
        root=P.empty('Door hinge');root.location=(-2.15,0,2.08)
        door=B('Opening closet door',(2.15,0,0),(4.25,5.15,.13),WOOD,.035);door.parent=root
        handle=B('Door handle',(3.75,-.1,.16),(.07,.65,.09),P.EDGE,.035);handle.parent=root
        anim(root,'rotation_euler',[(0,(0,0,0)),(.15,(0,-.1,0)),(.7,(0,-1.82,0)),(1,(0,-1.86,0))])
def ui(name,shot,loc,w,h):
    path=P.REPO/f'[SITE]/assets/shots/src/{shot}.png'
    img=bpy.data.images.load(str(path),check_existing=True);ratio=img.size[0]/img.size[1]
    # Preserve screenshot geometry in every monitor, laptop, phone and recap.
    if w/h>ratio:w=h*ratio
    else:h=w/ratio
    return P.rounded_image(name,path,loc,w,h,.025)
def monitor(shot='dashboard',loc=(-1,0,0),w=7):
    x,y,z=loc;h=w*.625;B('Monitor bezel',(x,y,z),(w+.27,h+.34,.22),PAINT,.04)
    if shot:ui('Monitor real UI',shot,(x,y,z+.125),w,h)
    B('Monitor stand',(x,y-h/2-.36,z-.15),(.32,.7,.32),P.METAL,.025)
    B('Monitor foot',(x,y-h/2-.75,z+.1),(2,.13,1.1),PAINT,.04)
    sphere('Monitor LED',(x+w/2-.12,y-h/2-.11,z+.14),(.025,.018,.01),P.ORANGE)
def scan_sweep():
    o=P.line('QR scanning light',[(-2.67,-.1,.28),(-1.33,-.1,.28)],P.ORANGE,.018)
    anim(o,'location',[(0,(0,.62,0)),(.24,(0,-.62,0)),(.5,(0,.62,0)),(.65,(0,-.62,0))])
    V(o,Q['a'],round(Q['a']+.68*(Q['b']-Q['a'])))
    return o
def label(body,y=2.55,size=.58):return T('Headline '+body,body,(0,y,1.4),size,10.5,mat=P.CREAM)
def gradient(name,left):
    m=P.ink(name,left);n=m.node_tree.nodes;l=m.node_tree.links
    tex=n.new('ShaderNodeTexCoord');sep=n.new('ShaderNodeSeparateXYZ');ramp=n.new('ShaderNodeValToRGB')
    ramp.color_ramp.elements[0].color=(*P.rgb(left),1);ramp.color_ramp.elements[1].color=(*P.rgb('#F6F1E7'),1)
    l.new(tex.outputs['Generated'],sep.inputs[0]);l.new(sep.outputs['X'],ramp.inputs[0]);l.new(ramp.outputs[0],next(node for node in n if node.type=='EMISSION').inputs['Color']);return m
def words(body,color='#D97757'):
    terms=body.split();objs=[]
    for i,term in enumerate(terms):objs.append(T('Kinetic '+term,term,(0,0,1.1),1.5,mat=P.CREAM if i<len(terms)-1 else gradient('Gradient '+body,color)))
    bpy.context.view_layer.update();widths=[o.dimensions.x for o in objs];total=sum(widths)+.28*(len(objs)-1);x=-total/2;factor=min(1,10/total)
    for i,(o,w) in enumerate(zip(objs,widths)):
        o.location.x=(x+w/2)*factor;o.scale*=factor;x+=w+.28
        st=Q['a']+i*min(8,max(1,(Q['b']-Q['a'])//(len(objs)*4)))
        V(o,st,Q['b']);P.rise(o,st,min(st+12,Q['b']-1),.24)
def photo(loc=(0,0,0),scale=1):
    old=before();B('Photo paper edge',(0,0,0),(3.3,3.8,.08),BEIGE,.035)
    P.rounded_image('Original family photograph',P.ASSETS/'family-photo.png',(0,.2,.049),3,2.9,.025)
    T('Photo caption','a little moment at home',(0,-1.55,.06),.17,2.8,mat=P.ACCENT)
    return group('Photo card',old,loc,scale)
def icons(wall=False):
    uv=[(.419,.458,.457,.518),(.523,.458,.562,.518),(.628,.458,.667,.518),(.734,.458,.772,.518),(.841,.458,.879,.518)]
    names=['Files','App Store','Photos','Backup','Machines']
    for i in range(15 if wall else 5):
        x=(i%5-2)*2.2;y=(i//5-1)*1.85 if wall else 0;old=before()
        B(names[i%5]+' glossy extrusion',(x,y,0),(1.5,1.5,.38),P.ICON,.21)
        P.rounded_image(names[i%5]+' real glyph',P.REPO/'[SITE]/assets/shots/src/dashboard.png',(x,y,.205),1.38,1.38,.17,uv[i%5])
        o=group('Icon slide',old);anim(o,'location',[(0,(2.2+i*.12,0,-.4)),(.3,(.3,0,0)),(1,(-.4,0,.1))])
    if wall:label('App Store · Coming soon',3.35,.68)
def storage():
    label('Two copies of everything.',3.15,.65)
    for i,x in enumerate((-1.85,1.85)):
        B('Drive bay',(x,0,-.55),(2.95,3.8,.75),PAINT,.06)
        for side in (-1,1):B('Guide rail',(x+side*1.38,0,-.06),(.08,3.4,.14),P.METAL,.015)
        old=before();B('Drive cast chassis',(x,0,0),(2.55,3.3,.4),P.METAL,.04)
        B('Pressed drive lid',(x,0,.23),(2.42,3.15,.065),BEIGE,.025)
        B('Drive paper label',(x,.35,.274),(1.95,1.22,.008),P.CREAM,.01)
        T('Drive label',f'JENER / DATA {i+1}',(x,.55,.285),.17,1.75,mat=P.ACCENT)
        T('Drive capacity','MIRRORED COPY',(x,.1,.285),.12,1.75,mat=P.ACCENT)
        for dx in (-1.05,1.05):
            for y in (-1.35,1.35):screw(x+dx,y,.28)
        for j in range(12):B('SATA contact',(x-.85+j*.145,-1.62,.16),(.08,.14,.05),P.EDGE,.002)
        o=group('Drive insertion '+str(i+1),old)
        if Q['cue']=='lose_drive':
            if i==0:anim(o,'location',[(0,(0,0,0)),(.65,(0,0,2)),(1,(-5,2,4))])
        else:anim(o,'location',[(0,(0,3+i,2)),(.2+i*.16,(0,0,0)),(1,(0,0,0))])
    B('Mirror track',(0,-2.35,.2),(6.5,.15,.08),P.DARK,.03)
    bar=B('Mirror fill',(0,-2.35,.26),(6.5,.11,.045),P.ORANGE,.025)
    root=P.empty('Mirror left anchor');root.location=(-3.25,-2.35,.26);bar.parent=root;bar.location=(3.25,0,0)
    if Q['cue']=='lose_drive':label("Lose a drive? Nothing's lost.",-3.05,.53)
    else:
        anim(root,'scale',[(0,(.001,1,1)),(.65,(1,1,1)),(1,(1,1,1))])
        o=T('Ready pill label','Your storage is ready.',(0,-2.9,.4),.45,8,mat=P.CREAM);V(o,Q['a']+int((Q['b']-Q['a'])*.7),Q['b'])
def updates():
    label('Updates with a way back.',3.1,.68)
    for i,x in enumerate((-2.25,2.25)):
        old=before();B('System glass slab '+str(i),(x,0,0),(3.7,3.4,.36),P.GLASS,.2)
        T('System letter '+str(i),'A' if i==0 else 'B',(x,.38,.22),1.3,mat=P.CREAM)
        T('System state '+str(i),'Current system' if i==0 else 'Second copy',(x,-.8,.22),.29,3,mat=P.CREAM)
        o=group('System swap '+str(i),old)
        if Q['cue']=='rolls_back':
            anim(o,'location',[(0,(0,0,0)),(.35,(.12,0,0)),(.55,(-x*2,0,.7 if i==0 else -.7)),(1,(-x*2,0,0))])
            anim(o,'rotation_euler',[(0,(0,.04,0)),(.48,(0,.5*(-1 if i else 1),0)),(1,(0,-.04,0))])
            # During the fast crossing only the slabs are visible. Labels return
            # after separation, avoiding two overprinted words at the midpoint.
            for ob in o.children:
                if ob.type=='FONT':
                    for prop in ('hide_render','hide_viewport'):
                        K(ob,prop,True,round(Q['a']+.35*(Q['b']-Q['a'])))
                        K(ob,prop,False,round(Q['a']+.72*(Q['b']-Q['a'])))
                    P.smooth(ob)
    if Q['cue']=='rolls_back':
        label('It just rolls back.',-2.7,.65)
        o=P.line('Rollback check',[(3.8,-1.6,.8),(4.05,-1.85,.8),(4.6,-1.2,.8)],P.ORANGE,.07);V(o,Q['a']+int((Q['b']-Q['a'])*.6),Q['b'])
    else:label('A second copy of the system.',-2.7,.52)
def bento():
    cells=[(-3.35,1.55,5.6,2.65,'dashboard','At home'),(2.8,1.55,5.6,2.65,'settings-storage','Two copies'),(-4,-1.55,4.2,2.6,'phone-setup','Scan to set up'),(.35,-1.55,4.05,2.6,'settings-general','Safe updates'),(4.4,-1.55,3.65,2.6,'store-discover','Apps · Coming soon')]
    for i,(x,y,w,h,shot,title) in enumerate(cells):
        old=before();B('Bento card',(x,y,0),(w,h,.15),P.GLASS,.16)
        ui('Bento real '+shot,shot,(x,y+.28,.09),w-.22,h-.85)
        T('Bento '+title,title,(x,y-h/2+.32,.13),.28,w-.35,mat=P.CREAM)
        o=group('Bento arrival '+str(i),old);anim(o,'location',[(0,((i-2)*2,-2.5,-1)),(.08+i*.025,(0,0,0)),(1,(0,.03,.04))])
        for ob in o.children:
            if ob.type=='FONT':V(ob,round(Q['a']+(.08+i*.025)*(Q['b']-Q['a'])),Q['b'])
def build(q):
    global Q
    Q=q;P.WINDOW=(q['a'],q['b']);P.CURRENT=q['id'];P.COL=bpy.data.collections.new(f"{q['id']:02} {q['name']}");S.collection.children.link(P.COL)
    kind=q['kind']
    if kind=='closet':
        room(True);tower('Dusty office PC',(0,-.3,-.2))
        for i in range(24):sphere('Dust mote',(-1.1+(i*1.73)%2.2,-1.4+(i*.73)%3.5,1.5+(i*.17)%1),(.013,)*3,BEIGE)
    elif kind=='words':words(q['text'],q.get('color','#D97757'))
    elif kind=='photo':
        o=photo();anim(o,'location',[(0,(-4,-.4,4)),(.45,(0,0,.3)),(1,(.4,.2,0))]);anim(o,'rotation_euler',[(0,(.1,.4,-.2)),(1,(0,-.12,.08))]);label('Your photos.',2.8)
    elif kind=='files':
        for i in range(3):
            old=before();B('Document paper',((i-1)*2.6,0,-i*.2),(2,2.5,.06),BEIGE,.025)
            for j in range(5):B('Document line',((i-1)*2.6,.65-j*.3,.05-i*.2),(1.35,.035,.01),P.FRAME,.002)
            o=group('File arrival',old);anim(o,'location',[(0,(0,-2-i,0)),(.4,(0,0,0)),(1,(.1,.05,0))])
        label('Your files.')
    elif kind=='movies':
        B('Movie frame',(0,0,0),(6.6,3.8,.2),PAINT,.07);P.rounded_image('Home movie still',P.ASSETS/'family-photo.png',(0,0,.11),6.25,3.5,.025,uv=(0,.22,1,.78))
        for x in (-3.2,3.2):
            for y in (-1.4,-.7,0,.7,1.4):B('Film perforation',(x,y,.12),(.09,.26,.01),BEIGE,.01)
        label('Your movies.',2.8)
    elif kind=='home':
        room();tower('Home PC',(2.8,-.65,-.2),.9);monitor('dashboard',(-1.45,.1,-.35),5.4)
        o=photo((-3,1,2),.52);anim(o,'location',[(0,(-4,1.7,4)),(.5,(.1,1.2,2)),(.85,(2.8,0,1)),(1,(2.8,0,.95))]);anim(o,'scale',[(0,(.52,)*3),(.6,(.42,)*3),(1,(.05,)*3)]);label('At home.',3.5)
    elif kind=='usb':
        tower('USB hero PC',(-.8,0,-1.2),1.25);old=before()
        B('USB metal plug',(-1.34,.225,.8),(.24,.12,.45),P.METAL,.008);B('USB body',(-1.34,.225,1.35),(.39,.2,.65),CLAY,.035)
        T('USB engraving','JENER',(-1.34,.235,1.68),.065,.32,mat=P.CREAM)
        o=group('USB insertion',old);anim(o,'location',[(0,(0,0,2)),(.55,(0,0,.15)),(.8,(0,0,0)),(1,(0,0,-.01))])
    elif kind=='boot':
        monitor(None,(0,0,0),7);P.glass_j('J boot splash',(0,0,.3),1.7);label('Turn it on.',3.1)
        for ob in P.COL.objects:
            if ob.name.startswith('J boot splash'):
                ob.data.materials.clear();ob.data.materials.append(P.CREAM);ob.data.extrude=.01;ob.data.bevel_depth=.002
    elif kind=='scan':
        monitor('setup-welcome',(-2,.1,0),5.2);B('Box QR card',(-2,-.1,.2),(1.7,1.7,.05),BEIGE,.035)
        P.rounded_image('Box setup QR',P.ASSETS/'qr.png',(-2,-.1,.24),1.5,1.5,.01);old=before()
        B('Phone body',(2.7,-.1,.4),(1.8,3.55,.22),PAINT,.19);ui('Phone real setup','phone-setup',(2.7,-.1,.525),1.63,3.35)
        B('Phone earpiece',(2.7,1.48,.535),(.35,.035,.02),P.DARK,.017)
        B('Palm',(3.1,-1.65,.08),(1.05,1.15,.4),SKIN,.22);B('Forearm',(3.25,-3.1,-.05),(.65,2.2,.55),SKIN,.21)
        for i in range(4):B('Finger',(3.55,-.45-i*.28,.48),(.38,.2,.25),SKIN,.09)
        o=group('Phone and hand',old);anim(o,'location',[(0,(-.6,-.5,1.4)),(.4,(0,0,0)),(1,(.08,.08,0))]);old=before()
        B('Connected pill',(2.7,-2.35,.8),(2.1,.5,.08),P.GLASS,.22);T('Connected label','Connected',(2.7,-2.35,.86),.28,1.8,mat=P.CREAM)
        for ob in P.COL.objects:
            if ob.name not in old:V(ob,q['a']+int((q['b']-q['a'])*.7),q['b'])
        scan_sweep()
    elif kind=='dashboard':room();monitor('dashboard',(-1,0,-.2),7);tower('Home PC',(4,-.65,-.8),.88)
    elif kind=='icons':icons()
    elif kind=='storage':storage()
    elif kind=='updates':updates()
    elif kind=='store':icons(True)
    elif kind=='hardware':
        plant(-6,-3,-2,2);plant(5,-2,-2,2);aa=tower('Office PC',(-2,0,0),.85);bb=laptop((2,.2,1))
        for i,o in enumerate((aa,bb)):
            loc=o.location.copy();anim(o,'location',[(0,loc+Vector((0,-3-i,1))),(.35,loc),(1,loc+Vector((.5,.4,-.4)))]);anim(o,'rotation_euler',[(0,(.35,-.5,-.45+i*.7)),(.45,(.1,.25,.08-i*.2)),(1,(-.15,.45,-.12))])
        T('Office PC label','Office PC',(-2.2,-2.25,1.5),.36,3,mat=P.CREAM);T('Laptop label','Old laptop',(2.3,-2.25,1.5),.36,3,mat=P.CREAM);label('The PC you already have.',3.05,.7)
    elif kind=='landfill':plant(-5,-3,-1,2);plant(5,-3,-2,2);tower('Saved PC',(0,-.2,-.2),.8);label('One less computer',2.6,.7);label('in a landfill.',-2.65,.75)
    elif kind=='bento':bento()
    elif kind=='end':
        P.logo('JenerOS wordmark',(0,.65,.3),8,True);T('Closing promise','Free. Open source. Yours.',(0,-.75,.4),.6,10,mat=P.CREAM);T('URL','jener.dev',(0,-2,.4),.52,5,mat=P.ACCENT)
    if kind=='home':
        for ob in P.COL.objects:
            if ob.name.startswith('Headline At home'):ob.data.materials[0]=P.ink('Graphite on sunlit wall','#382A20')
    camera(q);S.frame_set((q['a']+q['b'])//2);save(f"Shot {q['id']:02}: {q['name']} ready")
def camera(q):
    kind=q['kind'];st,en=P.WINDOW
    pts=[(0,(2.2,.5,29),(0,0,0)),(1,(1.3,.8,28.1),(0,.02,0))]
    if kind=='closet':pts=[(0,(6,2,30),(0,0,0)),(1,(3.7,1,25),(0,-.2,0))]
    elif kind=='usb':pts=[(0,(.1,.6,10),(-1,.4,.8)),(1,(-.15,.55,9.6),(-1,.35,.8))]
    elif kind=='scan':pts=[(0,(-1.7,.1,9),(-2,-.1,.24)),(.23,(-1.4,.1,9.5),(-2,-.1,.24)),(.32,(3.3,.2,17),(2.7,-.35,.52)),(.6,(3.1,.3,18),(2.7,-.35,.52)),(1,(3,.7,29),(0,0,.2))]
    elif kind=='dashboard':pts=[(0,(-.5,.5,10),(-1,.2,0)),(.55,(3,1.2,25),(0,0,-.2)),(1,(4,1.5,30),(0,0,-.2))]
    elif kind=='icons':pts=[(0,(-4,-1,8),(-3,0,.2)),(1,(4,-.6,9),(2.6,0,.2))]
    elif kind=='storage' and q['cue']=='drives':pts=[(0,(-.7,-.3,11),(-1.85,0,.3)),(.18,(0,-.3,14),(-1.8,0,.3)),(.4,(2,-.4,18),(1.85,0,.3)),(.7,(3.4,-.7,28),(.1,-.15,.2)),(1,(2.7,-.4,28),(0,-.25,.2))]
    elif kind in ('words','end'):pts=[(0,(.8,.2,27),(0,0,1)),(1,(.3,.3,26.3),(0,0,1))]
    elif kind=='bento':pts=[(0,(2,1,33),(0,0,0)),(1,(1,.6,31.8),(0,0,0))]
    elif kind=='store':pts=[(0,(4,-1,32),(0,.3,0)),(1,(2.5,-.6,30),(0,.3,0))]
    for name in ('CAMERA landscape','CAMERA vertical'):
        cam=bpy.data.objects[name];focus=bpy.data.objects[name+' focus']
        for u,loc,target in pts:
            fi=round(st+u*(en-st-1));K(cam,'location',loc,fi);K(cam,'rotation_euler',P.camera_rotation(loc,target),fi);K(focus,'location',target,fi)
            cam.data.dof.aperture_fstop=4 if kind in ('closet','dashboard','bento','home') else 2.8;cam.data.dof.keyframe_insert('aperture_fstop',frame=fi)
        for owner in (cam,focus,cam.data):
            for fc in P.curves(owner):
                ks=[k for k in fc.keyframe_points if st<=k.co.x<en]
                for i,k in enumerate(ks):
                    prev=ks[max(0,i-1)];nxt=ks[min(len(ks)-1,i+1)];dt=nxt.co.x-prev.co.x
                    slope=(nxt.co.y-prev.co.y)/dt if dt else 0
                    left=(k.co.x-prev.co.x)/3;right=(nxt.co.x-k.co.x)/3
                    k.interpolation='BEZIER' if i<len(ks)-1 else 'CONSTANT'
                    k.handle_left_type='FREE';k.handle_right_type='FREE'
                    k.handle_left=(k.co.x-left,k.co.y-left*slope);k.handle_right=(k.co.x+right,k.co.y+right*slope)
    S.timeline_markers.new(f"{q['id']:02} {q['name']}",frame=st)
def plan(lines,grid):
    c=lines['cues'];origin=grid.get('section_start',0);beats=[b-origin for b in grid['beats'] if b>=origin]
    defs=[('closet','closet',0,1,'Closet opens'),('not_junk','words',c['not_junk'],2,"It's not junk."),('new_cloud','words',c['new_cloud'],2,'Your new cloud.'),('photos','photo',c['photos'],3,'Your photos'),('files','files',c['files'],3,'Your files'),('movies','movies',c['movies'],3,'Your movies'),('at_home','home',c['at_home'],3,'The photo comes home'),('dashboard','dashboard',10.625,7,'Dashboard screen-to-room'),('icons','icons',11.875,7,'Glossy app icon macro'),('setup','usb',c['setup'],4,'USB insertion'),('power','boot',c['power'],4,'Power LED and J splash'),('scan','scan',c['scan'],5,'QR to phone whip'),('no_keyboard','words',c['no_keyboard'],6,'No keyboard.'),('no_commands','words',c['no_commands'],6,'No commands.'),('no_account','words',c['no_account'],6,'No account.'),('drives','storage',c['drives'],8,'Two drives, two copies'),('lose_drive','storage',c['lose_drive'],8,"Lose a drive? Nothing's lost."),('updates','updates',c['updates'],9,'System A and system B'),('rolls_back','updates',c['rolls_back'],9,'Rollback speed ramp'),('store','store',c['store'],10,'App Store on the way'),('best_part','words',c['best_part'],11,'The best part?'),('no_paid','words',c['no_paid'],11,'No paid tier.'),('no_disks','words',c['no_disks'],11,'No disk limits.'),('no_users','words',c['no_users'],11,'No user limits.'),('old_hardware','hardware',c['old_hardware'],12,'A second life'),('landfill','landfill',c['landfill'],12,'One less computer in a landfill'),('recap','bento',50.625,13,'Everything, at home'),('brand','end',57.5,14,'JenerOS end card')]
    result=[]
    for cue,kind,t,ch,name in sorted(defs,key=lambda d:d[2]):
        st=0 if not result else round(min(beats,key=lambda b:abs(b-t)),6)
        if result and st<=result[-1]['start']:st=next(b for b in beats if b>result[-1]['start']+.01)
        result.append({'id':len(result)+1,'cue':cue,'kind':kind,'chapter':ch,'name':name,'text':name,'start':st,'vo_cue':t,'beat':min(range(len(beats)),key=lambda i:abs(beats[i]-st))+1})
    for i,q in enumerate(result):
        q['end']=result[i+1]['start'] if i+1<len(result) else q['start']+6;q['a']=f(q['start']);q['b']=f(q['end'])
        line=min(lines['lines'],key=lambda l:0 if l['start']<=q['vo_cue']<=l['end'] else min(abs(l['start']-q['vo_cue']),abs(l['end']-q['vo_cue'])))
        q['vo_line']=line['text'] if q['vo_cue']<=lines['duration'] else 'End-card hold'
        q['color']={'no_paid':'#D97757','no_disks':'#E9A168','no_users':'#BDA98B'}.get(q['cue'],'#D97757')
    return result
def setup():
    global S,PAINT,BEIGE,WOOD,PLASTER,CLAY,LEAF,SKIN
    bpy.ops.wm.read_factory_settings(use_empty=True);S=bpy.context.scene;P.S=S;P.COL=None
    S.name='JenerOS VO launch v3';S.render.engine='BLENDER_EEVEE';S.render.fps=60;S.view_settings.view_transform='Standard';S.view_settings.look='None'
    S.world=bpy.data.worlds.new('Warm studio');S.world.use_nodes=True;S.world.node_tree.nodes['Background'].inputs[0].default_value=(*P.rgb('#493326'),1);S.world.node_tree.nodes['Background'].inputs[1].default_value=.6
    P.materials();P.backdrop();PAINT=noise('Powder-coated graphite','#39342E',.35,.38);BEIGE=noise('Aged cream ABS','#C5B89C');WOOD=noise('Walnut veneer','#70503A',0,.48);PLASTER=noise('Golden plaster','#B19B7D',0,.82);CLAY=noise('Terracotta','#D97757');LEAF=noise('Warm olive foliage','#55523B',0,.48);SKIN=noise('Warm stylized skin','#B98564',0,.6)
    for name in ('CAMERA landscape','CAMERA vertical'):
        bpy.ops.object.camera_add();cam=bpy.context.object;cam.name=name;cam.data.lens=62;cam.data.sensor_fit='HORIZONTAL';cam.data.dof.use_dof=True;cam.data.dof.aperture_blades=7
        focus=bpy.data.objects.new(name+' focus',None);S.collection.objects.link(focus);cam.data.dof.focus_object=focus
    S.camera=bpy.data.objects['CAMERA landscape']
    for name,loc,power,color,size in [('Cream key',(-5,7,8),1100,(1,.88,.74),8),('Amber rim',(6,2,3),850,(1,.5,.28),5),('Top softbox',(0,7,0),900,(1,.9,.78),6)]:
        bpy.ops.object.light_add(type='AREA',location=loc);o=bpy.context.object;o.name=name;o.data.energy=power;o.data.color=color;o.data.shape='DISK';o.data.size=size;o.rotation_euler=(Vector((0,0,0))-o.location).to_track_quat('-Z','Y').to_euler()
    S.render.use_motion_blur=True;S.render.motion_blur_shutter=.4;S.render.motion_blur_position='START';S.render.filter_size=1;S.eevee.motion_blur_steps=4;S.eevee.use_raytracing=True
def optics():
    g=bpy.data.node_groups.new('V3 PRO lens and warm flashes','CompositorNodeTree');S.compositing_node_group=g;g.interface.new_socket(name='Image',in_out='OUTPUT',socket_type='NodeSocketColor');n=g.nodes;l=g.links
    src=n.new('CompositorNodeRLayers');glow=n.new('CompositorNodeGlare');glow.inputs['Type'].default_value='Fog Glow';glow.inputs['Threshold'].default_value=1.3;glow.inputs['Strength'].default_value=.12
    lens=n.new('CompositorNodeLensdist');lens.inputs['Dispersion'].default_value=.001;lens.inputs['Fit'].default_value=True;l.new(src.outputs['Image'],glow.inputs['Image']);l.new(glow.outputs['Image'],lens.inputs['Image'])
    flash=n.new('ShaderNodeMix');flash.data_type='RGBA';flash.inputs[7].default_value=(*P.rgb('#F6F1E7'),1);l.new(lens.outputs['Image'],flash.inputs[6]);fac=flash.inputs[0];fac.default_value=0;fac.keyframe_insert('default_value',frame=1)
    for q in SHOTS:
        if q['cue'] not in ('power','updates','no_paid'):continue
        for delta,v in [(-3,0),(-1,.2),(0,.32),(2,0)]:fac.default_value=v;fac.keyframe_insert('default_value',frame=q['a']+delta)
    fade=n.new('ShaderNodeMix');fade.data_type='RGBA';fade.inputs[7].default_value=(0,0,0,1);l.new(flash.outputs[2],fade.inputs[6])
    for fi,v in [(1,0),(SHOTS[-1]['b']-61,0),(SHOTS[-1]['b']-1,1)]:fade.inputs[0].default_value=v;fade.inputs[0].keyframe_insert('default_value',frame=fi)
    l.new(fade.outputs[2],n.new('NodeGroupOutput').inputs['Image'])
    for fc in P.curves(g):
        for k in fc.keyframe_points:k.interpolation='LINEAR'
def still(q,fi=None,path=None,width=640):
    S.frame_set(fi or round(q['a']+(q['b']-q['a'])*.7));S.render.resolution_x=width;S.render.resolution_y=round(width*9/16);S.render.resolution_percentage=100
    S.render.image_settings.media_type='IMAGE';S.render.image_settings.file_format='PNG';S.eevee.taa_render_samples=8
    S.render.filepath=str(path or LIVE/f"shot-{q['id']:02}.png");bpy.ops.render.render(write_still=True)
    P.log(f"V3 shot {q['id']:02}: {q['name']}",image=str(Path(S.render.filepath).relative_to(ROOT)).replace('\\','/'))
def guide():
    rows=['JenerOS launch v3 — silent picture; VO and music mixed in Premiere.',f"60 fps. Music: {'96 BPM PLACEHOLDER' if GRID.get('placeholder') else GRID.get('source')}.",f"Song in-point {GRID.get('section_start',0):.3f}s. VO at 00:00.000.",'Cuts snap to beats; fine word cues are envelope estimates. Check by ear.','End card: six-second in-scene recreation; optionally replace with logo-intro MP4.','']
    for q in SHOTS:rows.append(f"{q['id']:02} | {q['start']:07.3f}-{q['end']:07.3f}s | frames {q['a']}-{q['b']-1} | beat {q['beat']} | {q['name']}\n    VO {q['vo_cue']:.3f}s: {q['vo_line']}")
    (OUT/'timing-guide.txt').write_text('\n'.join(rows),encoding='utf-8');(OUT/'shots.json').write_text(json.dumps(SHOTS,indent=2))
def render(mode):
    S.camera=bpy.data.objects['CAMERA vertical' if mode=='vertical' else 'CAMERA landscape'];S.render.resolution_x=1440 if mode=='vertical' else 960 if mode=='draft' else 2560;S.render.resolution_y=2560 if mode=='vertical' else 540 if mode=='draft' else 1440
    S.render.resolution_percentage=100;S.render.fps=60;S.eevee.taa_render_samples=8 if mode=='draft' else 32;S.render.filter_size=1
    S.render.image_settings.media_type='VIDEO';S.render.image_settings.file_format='FFMPEG';S.render.ffmpeg.format='MPEG4';S.render.ffmpeg.codec='H264';S.render.ffmpeg.constant_rate_factor='PERC_LOSSLESS';S.render.ffmpeg.ffmpeg_preset='BEST';S.render.ffmpeg.audio_codec='NONE';S.render.use_sequencer=False
    S.frame_start=1;S.frame_end=SHOTS[-1]['b']-1
    report={'mode':mode,'resolution':[S.render.resolution_x,S.render.resolution_y],'fps':60,'quality':S.render.ffmpeg.constant_rate_factor,'preset':S.render.ffmpeg.ffmpeg_preset,'filter_size':S.render.filter_size,'silent':True,'frames':S.frame_end,'shots':len(SHOTS),'rendered':False}
    if a.check_only:print(json.dumps(report));return
    base=a.output_dir or OUT;base.mkdir(parents=True,exist_ok=True)
    if a.probe:jobs=[('first-frame-probe',1,1)]
    elif mode=='shots':
        base=base/'shots';base.mkdir(exist_ok=True);jobs=[(f"{q['id']:02}-{q['cue']}",q['a'],q['b']-1) for q in SHOTS]
    else:jobs=[('jeneros-trailer-'+mode,S.frame_start,S.frame_end)]
    for name,st,en in jobs:
        S.frame_start=st;S.frame_end=en;S.render.filepath=str(base/(name+'.rendering.mp4'));bpy.ops.render.render(animation=True);os.replace(S.render.filepath,base/(name+'.mp4'))
    report['rendered']=True;report['probe_only']=a.probe;print(json.dumps(report))
def check():
    assert S.render.motion_blur_position=='START','Centered blur samples across hard cuts'
    assert S.render.use_motion_blur and 0<S.render.motion_blur_shutter<1,'Forward shutter must stay within one frame'
    failures=[];collisions=[];objects=[o for o in bpy.data.objects if o.get('v3_shot')]
    typography=[o for o in objects if o.type=='FONT' and o.name.startswith(('Headline','Kinetic','System letter','System state','Closing','URL','Bento ','Connected label','Ready pill label'))]
    for fi in range(1,SHOTS[-1]['b']):
        S.frame_set(fi);expected=next(q['id'] for q in SHOTS if q['a']<=fi<q['b']);active={o['v3_shot'] for o in objects if not o.hide_render}
        if active!={expected}:failures.append({'frame':fi,'active':list(active),'expected':expected})
        for o in objects:
            if bool(o.hide_render)!=bool(o.hide_viewport):failures.append({'frame':fi,'mismatch':o.name})
        bounds=[]
        for o in typography:
            if o.hide_render:continue
            points=[world_to_camera_view(S,S.camera,o.matrix_world@Vector(c)) for c in o.bound_box]
            x0=max(0,min(v.x for v in points));x1=min(1,max(v.x for v in points));y0=max(0,min(v.y for v in points));y1=min(1,max(v.y for v in points))
            if x1>x0 and y1>y0:bounds.append((o.name,x0,y0,x1,y1))
        for i,x in enumerate(bounds):
            for y in bounds[i+1:]:
                overlap=max(0,min(x[3],y[3])-max(x[1],y[1]))*max(0,min(x[4],y[4])-max(x[2],y[2]))
                if overlap>min((x[3]-x[1])*(x[4]-x[2]),(y[3]-y[1])*(y[4]-y[2]))*.025:collisions.append({'frame':fi,'text':[x[0],y[0]]})
    # Integer frames alone miss ghost text and light flashes during an exposure.
    # Check both sides of every reveal, plus the first/last shutter in each shot.
    shutter=S.render.motion_blur_shutter
    sample_times=set()
    for ob in objects:
        for prop in ('shot_start','shot_end'):
            for delta in (-.001,.001):sample_times.add(float(ob[prop])+delta)
        for fc in P.curves(ob):
            if fc.data_path in ('hide_render','hide_viewport'):
                assert all(k.interpolation=='CONSTANT' for k in fc.keyframe_points),ob.name
                for k in fc.keyframe_points:
                    for delta in (-.001,.001):sample_times.add(float(k.co.x)+delta)
    for q in SHOTS:
        for fi in (q['a'],q['b']-1):
            for sub in (0,shutter/2,shutter):sample_times.add(fi+sub)
    sample_times=sorted(t for t in sample_times if 1<=t<SHOTS[-1]['b'])
    subframe_failures=[]
    for t in sample_times:
        S.frame_set(math.floor(t),subframe=t%1)
        expected=next(q['id'] for q in SHOTS if q['a']<=t<q['b'])
        active={ob['v3_shot'] for ob in objects if not ob.hide_render}
        if active!={expected}:subframe_failures.append({'time':t,'active':sorted(active),'expected':expected})
        for ob in objects:
            hidden=not (ob['shot_start']<=t<ob['shot_end'])
            # Some labels intentionally hide again during the A/B crossing.
            if (hidden and not ob.hide_render) or bool(ob.hide_viewport)!=bool(ob.hide_render):
                subframe_failures.append({'time':t,'object':ob.name,'expected_hidden':hidden})
            if ob.type=='LIGHT' and ob['v3_shot']!=expected and ob.data.energy>1e-6:
                subframe_failures.append({'time':t,'light':ob.name,'energy':ob.data.energy})
    report={'frames':SHOTS[-1]['b']-1,'failures':failures,'text_collisions':collisions,
            'shutter_position':S.render.motion_blur_position,'shutter':shutter,
            'subframe_samples':len(sample_times),'subframe_failures':subframe_failures}
    (LIVE/'cut-check.json').write_text(json.dumps(report,indent=2))
    if failures:raise AssertionError(failures[:10])
    if collisions:raise AssertionError(collisions[:10])
    if subframe_failures:raise AssertionError(subframe_failures[:10])
    print(f"PASS {SHOTS[-1]['b']-1} frames and {len(sample_times)} subframe samples; visibility, text and lights",flush=True)
    if a.check_only:return
    folder=LIVE/'boundaries';folder.mkdir(exist_ok=True)
    for q in SHOTS[1:]:
        for delta in (-1,0,12):still(q,q['a']+delta,folder/f"cut-{q['id']:02}-{delta:+03}.png",480)
if a.render or a.still or a.check_cuts or a.review_stills or a.polish:
    bpy.ops.wm.open_mainfile(filepath=str(ROOT/'trailer.blend'));S=bpy.context.scene;P.S=S;SHOTS=json.loads(S['v3_shots']);GRID=json.loads(S['beat_grid'])
    if a.beats:p.error('--beats requires full rebuild')
    if a.render:render(a.render)
    elif a.still:still(SHOTS[a.still-1],a.frame,width=960)
    elif a.review_stills:
        for q in SHOTS:still(q)
    elif a.polish:
        P.materials()
        S.render.motion_blur_position='START'
        for ob in bpy.data.objects:
            if ob.type=='LIGHT' and ob.get('v3_shot'):V(ob,int(ob['shot_start']),int(ob['shot_end']))
            if ob.name.startswith('Headline At home'):ob.data.materials[0]=P.ink('Graphite on sunlit wall','#382A20')
            if ob.name.startswith('J boot splash'):
                ob.data.materials.clear();ob.data.materials.append(P.CREAM);ob.data.extrude=.01;ob.data.bevel_depth=.002
        for name in ('CAMERA landscape','CAMERA vertical'):
            cam=bpy.data.objects[name];cam.animation_data_clear();cam.data.animation_data_clear();bpy.data.objects[name+' focus'].animation_data_clear()
        for marker in list(S.timeline_markers):S.timeline_markers.remove(marker)
        for q in SHOTS:P.WINDOW=(q['a'],q['b']);camera(q)
        if not bpy.data.objects.get('QR scanning light'):
            Q=next(q for q in SHOTS if q['kind']=='scan');P.WINDOW=(Q['a'],Q['b'])
            P.COL=bpy.data.collections[f"{Q['id']:02} {Q['name']}"]
            ob=scan_sweep();ob.parent=bpy.data.objects['Physical world scale'];P.COL=None
        Q=next(q for q in SHOTS if q['kind']=='bento')
        for i in range(5):
            root=bpy.data.objects['Bento arrival '+str(i)];root.animation_data_clear()
            anim(root,'location',[(0,((i-2)*2,-2.5,-1)),(.08+i*.025,(0,0,0)),(1,(0,.03,.04))])
            for ob in root.children:
                if ob.type=='FONT':V(ob,round(Q['a']+(.08+i*.025)*(Q['b']-Q['a'])),Q['b'])
        guide();S.frame_set(1);save('V3 visual review fixes: readable splash, sunlit caption, phone clearance and storage macro')
    else:check()
else:
    analyze_audio.speech();lines=json.loads((ROOT/'voiceover/lines.json').read_text())
    GRID={'bpm':96,'offset':0,'beats':[i*.625 for i in range(120)],'downbeats':[i*2.5 for i in range(30)],'drop':45,'placeholder':True,'section_start':0}
    SHOTS=plan(lines,GRID);setup()
    for chapter in [1,2,3,4,5,6,7,14,8,9,11,13,10,12]:
        for q in [q for q in SHOTS if q['chapter']==chapter]:
            build(q)
            if q['kind']=='closet':still(q,f(3.3),LIVE/'home-photo.png',960)
            if not a.no_preview:still(q)
    P.COL=None;optics();root=bpy.data.objects.new('Physical world scale',None);S.collection.objects.link(root);root.scale=(.2,)*3
    for o in list(bpy.data.objects):
        if o!=root and o.parent is None:o.parent=root
        if o.type=='LIGHT':
            o.data.energy*=.04
            for fc in P.curves(o.data):
                for k in fc.keyframe_points:
                    for co in (k.co,k.handle_left,k.handle_right):co.y*=.04
    save('Story built: 14 chapters on voiceover clock')
    song=analyze_audio.music(SHOTS[-1]['end']) if not a.beats else json.loads(a.beats.read_text())
    if not song.get('placeholder',False):
        old=SHOTS;new=plan(lines,song);pairs=[(x['a'],x['b'],y['a'],y['b']) for x,y in zip(old,new)]
        def remap(t):
            if t<=0:return t
            st,en,ns,ne=next((v for v in pairs if v[0]<=t<v[1]),pairs[-1])
            if abs(t-(en-1))<.0001:return ne-1
            return ns+(t-st)*(ne-ns)/(en-st)
        for action in bpy.data.actions:
            for layer in action.layers:
                for strip in layer.strips:
                    for bag in strip.channelbags:
                        for fc in bag.fcurves:
                            for k in fc.keyframe_points:
                                for co in (k.co,k.handle_left,k.handle_right):co.x=round(remap(co.x))
        for o in bpy.data.objects:
            for prop in ('shot_start','shot_end'):
                if prop in o:o[prop]=round(remap(o[prop]))
        for m in S.timeline_markers:m.frame=round(remap(m.frame))
        SHOTS=new;GRID=song;save('Song beat retime complete')
    else:GRID=song
    guide();S.frame_set(1);save('PROMPT-5 built; ready for cut review')
    if not a.no_preview:
        for q in SHOTS:still(q)
