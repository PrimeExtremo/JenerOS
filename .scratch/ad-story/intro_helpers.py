# Reused verbatim from logo-intro/make_intro.py. No original entrypoint.

def hexcol(h, a=1.0):
    h = h.lstrip('#'); c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c) + (a,)

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
