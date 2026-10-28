import io, re, os, json, sys
SRC = sys.argv[1]; DST = sys.argv[2]
assets = {os.path.splitext(f)[0]: f for f in os.listdir(os.path.join(DST, 'glass-assets'))}
def blobs(s, prefix):
    def rep(m):
        h = m.group(1); assert h in assets, h
        return prefix + assets[h]
    return re.sub(r'/_blob/([0-9a-f]{32})', rep, s)

css = ['@font-face { font-family: "Bricolage Grotesque"; src: url(../fonts/bricolage-grotesque-700.woff2) format("woff2"); font-weight: 400 800; font-display: swap; }\n']
js = ['// Generated from the "JenerOS Glass" design files by port.py. Edit the designs, then regenerate.\n']
for name in ['Main', 'Settings', 'Store', 'Splash']:
    s = io.open(os.path.join(SRC, name + '.dc.html'), encoding='utf-8').read()
    inner = re.search(r'<x-dc>(.*)</x-dc>', s, re.S).group(1)
    helmet = re.search(r'<helmet>(.*?)</helmet>', inner, re.S).group(1)
    for st in re.findall(r'<style>(.*?)</style>', helmet, re.S):
        css.append(f'/* {name} */\n' + blobs(st, '../glass-assets/') + '\n')
    tpl = blobs(re.sub(r'<helmet>.*?</helmet>', '', inner, flags=re.S).strip(), 'glass-assets/')
    m = re.search(r"<script type=\"text/x-dc\" data-dc-script data-props='(.*?)'>(.*?)</script>", s, re.S)
    props = json.loads(m.group(1))
    defaults = {k: v['default'] for k, v in props.items() if not k.startswith('$') and isinstance(v, dict) and 'default' in v}
    code = blobs(m.group(2), 'glass-assets/')
    js.append(f'(() => {{\n{code}\nDC.define({json.dumps(name)}, {json.dumps(tpl)}, Component, {json.dumps(defaults)});\n}})();\n')
# body{margin:0} rules from the designs are fine; overflow hidden on body suits a full-screen board.
io.open(os.path.join(DST, 'glass', 'glass.css'), 'w', encoding='utf-8', newline='\n').write('\n'.join(css))
io.open(os.path.join(DST, 'glass', 'components.js'), 'w', encoding='utf-8', newline='\n').write('\n'.join(js))
print('ok', sum(len(x) for x in js))
