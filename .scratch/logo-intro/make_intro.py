"""JenerOS logo intro: amber glass cubes fly in and build the J, warm flash, wordmark rises in.

Run:  blender -b --factory-startup -P make_intro.py -- [--still FRAME ...] [--render]
Writes logo-intro.blend next to this file (open it to tweak), stills/ and out/jeneros-logo-intro-1440p.mp4.
"""
import argparse, math, random, re, sys
import xml.etree.ElementTree as ET
from pathlib import Path
import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parent
REPO = ROOT.parents[1]
WORDMARK = REPO / '[BRAND]/logo/jeneros-wordmark-light.svg'
FONT = REPO / '.scratch/trailer-blender/assets/BricolageGrotesque-Bold.ttf'
FPS, END = 60, 360
K = 7.0 / 1472            # wordmark is 7 units wide
J_CENTER = (144, 160)     # centre of the J inside the wordmark (svg px)
HERO = 4.0                # J scale while it's the hero
SEED = 7

ap = argparse.ArgumentParser()
ap.add_argument('--still', type=int, nargs='*')
ap.add_argument('--render', action='store_true')
ap.add_argument('--samples', type=int, default=32)
args = ap.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [])


def hexcol(h, a=1.0):
    h = h.lstrip('#'); c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c) + (a,)


CREAM, ORANGE, AMBER, VOID = hexcol('#F6F1E7'), hexcol('#D97757'), hexcol('#E08A4F'), hexcol('#0E0A07')

# ---------- svg ----------
def svg_paths(path):
    out = []
    def walk(el, tx=0.0, ty=0.0, sc=1.0):
        tr = el.attrib.get('transform', '')
        t = re.search(r'translate\(([-\d.]+)[ ,]+([-\d.]+)\)', tr)
        if t: tx += float(t[1]) * sc; ty += float(t[2]) * sc
        s = re.search(r'scale\(([-\d.]+)\)', tr)
        if s: sc *= float(s[1])
        if el.tag.endswith('path'):
            polys, pts, x, y = [], [], 0.0, 0.0
            toks = re.findall(r'[A-Za-z]|-?\d*\.?\d+', el.attrib['d']); i = 0
            while i < len(toks):
                c = toks[i]; i += 1
                if c in 'ML': x, y = float(toks[i]), float(toks[i + 1]); i += 2
                elif c == 'H': x = float(toks[i]); i += 1
                elif c == 'V': y = float(toks[i]); i += 1
                elif c == 'Z': polys.append(pts); pts = []; continue
                else: raise ValueError('unsupported svg command ' + c)
                pts.append((tx + x * sc, ty + y * sc))
            if pts: polys.append(pts)
            out.append(polys)
        for ch in el: walk(ch, tx, ty, sc)
    walk(ET.parse(path).getroot())
    return out


def inside(p, poly):
    x, y = p; hit = False
    for (x1, y1), (x2, y2) in zip(poly, poly[1:] + poly[:1]):
        if (y1 > y) != (y2 > y) and x < x1 + (y - y1) * (x2 - x1) / (y2 - y1): hit = not hit
    return hit


# ---------- scene helpers ----------
def fcurves(action):
    try:
        for layer in action.layers:
            for strip in layer.strips:
                for bag in strip.channelbags: yield from bag.fcurves
    except AttributeError:
        yield from action.fcurves


def setkey(o, attr, f, value, ease='EASE_OUT'):
    setattr(o, attr, value); o.keyframe_insert(attr, frame=f)
    for fc in fcurves(o.animation_data.action):
        if fc.data_path == attr:
            for kp in fc.keyframe_points:
                if abs(kp.co.x - f) < .5: kp.interpolation = 'BEZIER'; kp.easing = ease


def setcolor_alpha(o, f, a):
    o.color = (1, 1, 1, a); o.keyframe_insert('color', index=3, frame=f)


def mat_fadeable(name, shader_fn, blend=True):
    m = bpy.data.materials.new(name); m.use_nodes = True
    nt = m.node_tree; nt.nodes.clear()
    outn = nt.nodes.new('ShaderNodeOutputMaterial')
    surf = shader_fn(nt)
    info = nt.nodes.new('ShaderNodeObjectInfo')
    tr = nt.nodes.new('ShaderNodeBsdfTransparent')
    mix = nt.nodes.new('ShaderNodeMixShader')
    nt.links.new(info.outputs['Alpha'], mix.inputs[0])
    nt.links.new(tr.outputs[0], mix.inputs[1]); nt.links.new(surf, mix.inputs[2])
    nt.links.new(mix.outputs[0], outn.inputs['Surface'])
    if blend and hasattr(m, 'surface_render_method'): m.surface_render_method = 'BLENDED'
    return m


def principled(base, rough=.3, metal=0., trans=0., ior=1.45, coat=0., emit=None, emit_s=0.):
    def build(nt):
        p = nt.nodes.new('ShaderNodeBsdfPrincipled')
        p.inputs['Base Color'].default_value = base
        p.inputs['Roughness'].default_value = rough
        p.inputs['Metallic'].default_value = metal
        p.inputs['Transmission Weight'].default_value = trans
        p.inputs['IOR'].default_value = ior
        p.inputs['Coat Weight'].default_value = coat
        if emit:
            p.inputs['Emission Color'].default_value = emit
            p.inputs['Emission Strength'].default_value = emit_s
        return p.outputs[0]
    return build


def emission(col, strength):
    def build(nt):
        e = nt.nodes.new('ShaderNodeEmission')
        e.inputs['Color'].default_value = col; e.inputs['Strength'].default_value = strength
        return e.outputs[0]
    return build


def curve_obj(name, polys, origin, extrude, bevel, mat):
    cu = bpy.data.curves.new(name, 'CURVE'); cu.dimensions = '2D'; cu.fill_mode = 'BOTH'
    cu.extrude = extrude; cu.bevel_depth = bevel; cu.bevel_resolution = 3
    ox, oy = origin
    for poly in polys:
        sp = cu.splines.new('POLY'); sp.points.add(len(poly) - 1)
        for p, (x, y) in zip(sp.points, poly): p.co = ((x - ox) * K, -(y - oy) * K, 0, 1)
        sp.use_cyclic_u = True
    o = bpy.data.objects.new(name, cu); bpy.context.scene.collection.objects.link(o)
    o.rotation_euler = (math.radians(90), 0, 0)   # stand the logo up, facing -Y (the camera)
    cu.materials.append(mat)
    return o


# ---------- build ----------
def build():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    S = bpy.context.scene
    S.render.fps = FPS; S.frame_start = 1; S.frame_end = END
    S.render.engine = 'BLENDER_EEVEE'
    S.render.resolution_x, S.render.resolution_y = 2560, 1440
    S.render.filter_size = 1.0
    S.render.use_motion_blur = True; S.render.motion_blur_shutter = .5
    S.eevee.taa_render_samples = args.samples
    for attr, val in (('use_raytracing', True), ('use_shadows', True)):
        if hasattr(S.eevee, attr): setattr(S.eevee, attr, val)
    S.view_settings.view_transform = 'AgX'; S.view_settings.look = 'AgX - Medium High Contrast'
    bpy.context.preferences.filepaths.save_version = 0

    w = bpy.data.worlds.new('Void'); S.world = w; w.use_nodes = True
    bg = w.node_tree.nodes.get('Background'); bg.inputs[0].default_value = VOID; bg.inputs[1].default_value = 1

    # Warm glow backdrop behind the logo so the glass has something to refract.
    bpy.ops.mesh.primitive_plane_add(size=60, location=(0, 14, 0), rotation=(math.radians(90), 0, 0))
    back = bpy.context.object; back.name = 'Backdrop glow'
    m = bpy.data.materials.new('Backdrop'); m.use_nodes = True; nt = m.node_tree; nt.nodes.clear()
    o = nt.nodes.new('ShaderNodeOutputMaterial'); e = nt.nodes.new('ShaderNodeEmission')
    tc = nt.nodes.new('ShaderNodeTexCoord'); grad = nt.nodes.new('ShaderNodeTexGradient'); grad.gradient_type = 'SPHERICAL'
    mp = nt.nodes.new('ShaderNodeMapping'); mp.inputs['Scale'].default_value = (.085, .085, .085)
    ramp = nt.nodes.new('ShaderNodeValToRGB')
    ramp.color_ramp.elements[0].color = VOID; ramp.color_ramp.elements[1].color = hexcol('#4A2412')
    ramp.color_ramp.elements[1].position = 1.0
    nt.links.new(tc.outputs['Object'], mp.inputs[0]); nt.links.new(mp.outputs[0], grad.inputs[0])
    nt.links.new(grad.outputs['Fac'], ramp.inputs[0]); nt.links.new(ramp.outputs[0], e.inputs[0])
    e.inputs[1].default_value = 1.0; nt.links.new(e.outputs[0], o.inputs[0]); back.data.materials.append(m)

    paths = svg_paths(WORDMARK)
    j_polys = paths[0] + paths[1]
    glass = mat_fadeable('Amber glass', principled(hexcol('#E7915F'), rough=.1, trans=.55, coat=1, emit=AMBER, emit_s=.35))
    cream = mat_fadeable('Cream', principled(CREAM, rough=.35, emit=CREAM, emit_s=.6))

    # Hero J, built from the same geometry as the wordmark's J so it lands exactly in place.
    J = curve_obj('Hero J', j_polys, J_CENTER, extrude=.05, bevel=.008, mat=glass)
    jx = (J_CENTER[0] - 736) * K
    J.scale = (HERO,) * 3
    setcolor_alpha(J, 112, 0.0); setcolor_alpha(J, 156, 1.0)
    setkey(J, 'location', 200, (0, 0, 0), 'EASE_IN_OUT'); setkey(J, 'scale', 200, (HERO,) * 3, 'EASE_IN_OUT')
    setkey(J, 'location', 226, (jx, 0, 0), 'EASE_OUT'); setkey(J, 'scale', 226, (1, 1, 1), 'EASE_OUT')
    J.location = (0, 0, 0); J.scale = (HERO,) * 3
    # Slow turn so the bevel catches the light, settling flat by the flash.
    setkey(J, 'rotation_euler', 120, (math.radians(90), 0, math.radians(-14)), 'EASE_IN_OUT')
    setkey(J, 'rotation_euler', 198, (math.radians(90), 0, 0), 'EASE_IN_OUT')

    # Amber glass cubes that fly in and fill the J's shape.
    rnd = random.Random(SEED)
    targets = []
    xs = [p[0] for poly in j_polys for p in poly]; ys = [p[1] for poly in j_polys for p in poly]
    while len(targets) < 44:
        p = (rnd.uniform(min(xs), max(xs)), rnd.uniform(min(ys), max(ys)))
        if any(inside(p, poly) for poly in j_polys) and all((p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2 > 14 ** 2 for q in targets):
            targets.append(p)
    cube_mat = mat_fadeable('Cube glass', principled(hexcol('#E7915F'), rough=.08, trans=.6, coat=1, emit=AMBER, emit_s=.8), blend=False)
    for i, (tx, ty) in enumerate(sorted(targets, key=lambda p: p[1])):
        end = Vector(((tx - J_CENTER[0]) * K * HERO, 0, -(ty - J_CENTER[1]) * K * HERO))
        ang = rnd.uniform(0, 2 * math.pi); r = rnd.uniform(5, 8)
        start = Vector((math.cos(ang) * r, rnd.uniform(-14, -2), math.sin(ang) * r * .55))
        mid = start.lerp(end, .55) + Vector((rnd.uniform(-2, 2), rnd.uniform(-3, 0), rnd.uniform(-1.5, 1.5)))
        bpy.ops.mesh.primitive_cube_add(size=1, location=start)
        c = bpy.context.object; c.name = f'Cube {i:02}'; s = rnd.uniform(.17, .26); c.scale = (s,) * 3
        bev = c.modifiers.new('Bevel', 'BEVEL'); bev.width = .12; bev.segments = 3
        c.data.materials.append(cube_mat); c.color = (1, 1, 1, 1)
        a = 4 + i * 2.4; b = a + 70
        c.rotation_euler = [rnd.uniform(-3, 3) for _ in range(3)]
        setkey(c, 'location', a, start, 'EASE_OUT'); setkey(c, 'location', (a + b) / 2, mid, 'EASE_IN_OUT')
        setkey(c, 'location', b, end, 'EASE_OUT')
        setkey(c, 'rotation_euler', a, tuple(c.rotation_euler), 'EASE_OUT'); setkey(c, 'rotation_euler', b, (0, 0, 0), 'EASE_OUT')
        setkey(c, 'scale', 1, (0,) * 3); setkey(c, 'scale', a, (0,) * 3); setkey(c, 'scale', a + 8, (s,) * 3)
        fade = 140 + i * .4
        setkey(c, 'scale', fade, (s,) * 3, 'EASE_IN'); setkey(c, 'scale', fade + 16, (0,) * 3, 'EASE_IN')

    # Wordmark letters rise in after the flash.
    for i, polys in enumerate(paths[2:]):
        L = curve_obj(f'Letter {i}', polys, (736, 160), extrude=.03, bevel=.004, mat=cream)
        a = 214 + i * 3
        setcolor_alpha(L, 1, 0.0); setcolor_alpha(L, a, 0.0); setcolor_alpha(L, a + 18, 1.0)
        setkey(L, 'location', a, (0, 0, -.35)); setkey(L, 'location', a + 26, (0, 0, 0))

    # Tagline, with "Yours." in orange.
    bpy.ops.object.text_add(location=(0, 0, -1.25), rotation=(math.radians(90), 0, 0))
    T = bpy.context.object; T.name = 'Tagline'
    T.data.body = 'Free. Open source. Yours.'; T.data.align_x = 'CENTER'; T.data.size = .36
    T.data.font = bpy.data.fonts.load(str(FONT)); T.data.extrude = .004
    orange = mat_fadeable('Orange', principled(ORANGE, rough=.35, emit=ORANGE, emit_s=.8))
    T.data.materials.append(cream); T.data.materials.append(orange)
    for idx in range(T.data.body.index('Yours.'), len(T.data.body)): T.data.body_format[idx].material_index = 1
    setcolor_alpha(T, 1, 0.0); setcolor_alpha(T, 250, 0.0); setcolor_alpha(T, 274, 1.0)
    setkey(T, 'location', 250, (0, 0, -1.45)); setkey(T, 'location', 280, (0, 0, -1.25))

    # Lights: warm key upper-left, cream rim behind, soft fill.
    def area(name, loc, rot, col, power, size):
        d = bpy.data.lights.new(name, 'AREA'); d.color = col[:3]; d.energy = power; d.size = size
        o = bpy.data.objects.new(name, d); S.collection.objects.link(o); o.location = loc; o.rotation_euler = rot
        return o
    area('Key', (-7, -8, 6), (math.radians(60), 0, math.radians(-40)), hexcol('#FFB27A'), 2600, 5)
    area('Rim', (3, 7, 4), (math.radians(-60), 0, math.radians(160)), CREAM, 3200, 4)
    area('Fill', (6, -9, -2), (math.radians(95), 0, math.radians(35)), hexcol('#D97757'), 500, 6)

    # Camera on a pivot: 3/4 orbit that settles front-on, with a continuous push.
    piv = bpy.data.objects.new('Camera pivot', None); S.collection.objects.link(piv)
    cd = bpy.data.cameras.new('Camera'); cd.lens = 85
    cd.dof.use_dof = True; cd.dof.aperture_fstop = 4.0
    cam = bpy.data.objects.new('Camera', cd); S.collection.objects.link(cam); S.camera = cam
    cam.parent = piv; cam.rotation_euler = (math.radians(90), 0, 0)
    focus = bpy.data.objects.new('Focus', None); S.collection.objects.link(focus); cd.dof.focus_object = focus
    setkey(focus, 'location', 1, (0, 0, 0))
    setkey(piv, 'rotation_euler', 1, (math.radians(4), 0, math.radians(32)), 'EASE_IN_OUT')
    setkey(piv, 'rotation_euler', 198, (0, 0, 0), 'EASE_IN_OUT')
    setkey(piv, 'rotation_euler', 360, (0, 0, math.radians(-2)), 'EASE_IN_OUT')
    setkey(cam, 'location', 1, (0, -34, 0), 'EASE_OUT'); setkey(cam, 'location', 198, (0, -30, 0), 'EASE_IN_OUT')
    setkey(cam, 'location', 210, (0, -31, .2), 'EASE_OUT'); setkey(cam, 'location', 360, (0, -28, .2), 'EASE_IN_OUT')
    for o in (piv, cam):
        for fc in fcurves(o.animation_data.action):
            for kp in fc.keyframe_points: kp.interpolation = 'BEZIER'; kp.easing = 'AUTO'

    # Warm flash and the final fade to black: planes just in front of the lens.
    def veil(name, col, strength, z, keys):
        bpy.ops.mesh.primitive_plane_add(size=1)
        v = bpy.context.object; v.name = name; v.parent = cam; v.location = (0, 0, z); v.scale = (2, 2, 2)
        v.data.materials.append(mat_fadeable(name, emission(col, strength)))
        for f, a in keys: setcolor_alpha(v, f, a)
        v.visible_shadow = False
        return v
    veil('Flash', CREAM, 3.0, -.5, [(1, 0), (194, 0), (198, 1), (204, 0)])
    veil('Fade to black', (0, 0, 0, 1), 0.0, -.4, [(1, 0), (330, 0), (360, 1)])

    for o in S.objects:
        ad = o.animation_data
        if ad and ad.action:
            for fc in fcurves(ad.action):
                if fc.data_path == 'color':
                    for kp in fc.keyframe_points: kp.interpolation = 'BEZIER'; kp.easing = 'EASE_IN_OUT'
    bloom(S)
    S.frame_set(1)
    bpy.ops.wm.save_as_mainfile(filepath=str(ROOT / 'logo-intro.blend'))
    return S


def bloom(S):
    """Soft fog-glow bloom. Blender 5 uses compositor node groups; skip quietly if the API differs."""
    try:
        ng = bpy.data.node_groups.new('Bloom', 'CompositorNodeTree')
        S.compositing_node_group = ng
        rl = ng.nodes.new('CompositorNodeRLayers'); gl = ng.nodes.new('CompositorNodeGlare')
        out = ng.nodes.new('NodeGroupOutput'); ng.interface.new_socket('Image', in_out='OUTPUT', socket_type='NodeSocketColor')
        for name, val in (('glare_type', 'FOG_GLOW'), ('quality', 'HIGH'), ('size', 7), ('threshold', .8), ('mix', -.6)):
            if hasattr(gl, name): setattr(gl, name, val)
        for name, val in (('Type', 'Fog Glow'), ('Threshold', .8), ('Strength', .45), ('Size', .6)):
            sock = gl.inputs.get(name)
            if sock is not None:
                try: sock.default_value = val
                except Exception: pass
        ng.links.new(rl.outputs['Image'], gl.inputs['Image']); ng.links.new(gl.outputs['Image'], out.inputs[0])
    except Exception as exc:
        print('Bloom skipped:', exc)


S = build()
if args.still:
    (ROOT / 'stills').mkdir(exist_ok=True)
    S.render.resolution_percentage = 50; S.eevee.taa_render_samples = 16
    S.render.image_settings.file_format = 'PNG'
    for f in args.still:
        S.frame_set(f); S.render.filepath = str(ROOT / 'stills' / f'f{f:03}.png')
        bpy.ops.render.render(write_still=True)
    S.render.resolution_percentage = 100; S.eevee.taa_render_samples = args.samples
if args.render:
    (ROOT / 'out').mkdir(exist_ok=True)
    S.render.image_settings.media_type = 'VIDEO'
    S.render.image_settings.file_format = 'FFMPEG'; S.render.ffmpeg.format = 'MPEG4'; S.render.ffmpeg.codec = 'H264'
    S.render.ffmpeg.constant_rate_factor = 'PERC_LOSSLESS'; S.render.ffmpeg.ffmpeg_preset = 'BEST'; S.render.ffmpeg.audio_codec = 'NONE'
    S.render.filepath = str(ROOT / 'out' / 'jeneros-logo-intro-1440p.mp4')
    bpy.ops.render.render(animation=True)
