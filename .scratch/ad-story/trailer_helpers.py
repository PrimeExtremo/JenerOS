# Reused verbatim from trailer-blender/build_trailer.py. No original entrypoint.

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
