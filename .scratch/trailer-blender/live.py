import argparse, datetime, html, json
from pathlib import Path
ROOT = Path(__file__).resolve().parent
LIVE = ROOT / 'live'
LIVE.mkdir(exist_ok=True)
p = argparse.ArgumentParser()
p.add_argument('message')
p.add_argument('--step')
p.add_argument('--error', action='store_true')
p.add_argument('--image')
p.add_argument('--video')
p.add_argument('--done', action='store_true')
a = p.parse_args()
path = LIVE / 'log.json'
s = json.loads(path.read_text(encoding='utf-8')) if path.exists() else {'step':'Create live page and progress helper','logs':[], 'images':[], 'videos':[], 'completed':[]}
if a.step:
    if s['step'] != a.step and s['step'] not in s['completed']: s['completed'].append(s['step'])
    s['step'] = a.step
s['logs'].insert(0, {'time':datetime.datetime.now().strftime('%H:%M:%S'), 'text':a.message, 'error':a.error})
if a.image: s['images'].insert(0, {'path':a.image,'caption':a.message})
if a.video and a.video not in s['videos']: s['videos'].append(a.video)
if a.done: s['step'] = 'DONE'
path.write_text(json.dumps(s, indent=2), encoding='utf-8')
esc = html.escape
steps = ['Create live page and progress helper','Read project and trailer direction','Verify Blender and assets'] + [f'Build and inspect scene {i} of 9' for i in range(1,10)] + ['Render draft animation','Estimate and render final versions','Write handoff and render instructions']
items = ''.join(f'<li>{"DONE" if x in s["completed"] or a.done else "WORKING" if x == s["step"] else "TODO"}: {esc(x)}</li>' for x in steps)
v3 = s['step'].startswith('PROMPT-5') and (ROOT/'out/shots.json').exists()
if v3:
    shots = json.loads((ROOT/'out/shots.json').read_text(encoding='utf-8'))
    check_path = LIVE/'v3/cut-check.json'
    check = json.loads(check_path.read_text()) if check_path.exists() else {}
    passed = check.get('subframe_samples', 0) and not any(check.get(k) for k in ('failures','text_collisions','subframe_failures'))
    song = any((ROOT/'music'/('falling-apart'+ext)).exists() for ext in ('.mp3','.wav'))
    status = [f'{len(shots)} shots / 14 chapters; six-second end card.',
              f'Cut check: {check.get("frames", 0)} frames and {check.get("subframe_samples", 0)} subframe samples passed.' if passed else 'Cut review pending.',
              'Song file present; see music/beats.json for analysis status.' if song else 'Song not supplied; edit uses the 96 BPM placeholder.',
              'Silent full exports and playback review: Claude. See README.md.']
    items = ''.join(f'<li>{esc(x)}</li>' for x in status)
logs = ''.join(f'<p class="{"error" if x["error"] else ""}"><time>{x["time"]}</time> {esc(x["text"])}</p>' for x in s['logs'][:30])
stamp = int(datetime.datetime.now().timestamp())
images = ''.join(f'<figure><img src="{esc(x["path"])}?v={stamp}"><figcaption>{esc(x["caption"])}</figcaption></figure>' for x in s['images'])
if v3:
    images = ''.join(f'<figure><img src="live/v3/shot-{q["id"]:02}.png?v={stamp}"><figcaption>{q["id"]:02}: {esc(q["name"])}</figcaption></figure>' for q in shots if (LIVE/f'v3/shot-{q["id"]:02}.png').exists())
videos = ''.join(f'<figure><video controls src="{esc(x)}?v={stamp}"></video><figcaption>{esc(x)}</figcaption></figure>' for x in s['videos'])
if v3 and videos:
    videos = '<details><summary>Earlier trailer (pre-v3). The current edit is shown in the stills below.</summary>'+videos+'</details>'
(ROOT/'LIVE.html').write_text(f'''<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="refresh" content="3"><title>JenerOS trailer live</title><style>body{{background:#1F1913;color:#F6F1E7;font:22px system-ui;margin:40px}}h1{{font-size:46px;color:#D97757}}section,figure{{background:#2B241C;border-radius:18px;padding:24px;margin:0 0 24px}}.grid{{display:grid;grid-template-columns:repeat(auto-fit,minmax(480px,1fr));gap:24px}}img,video{{width:100%;border-radius:12px}}li{{margin:8px}}time{{color:#D97757}}.error{{color:#ff7878}}figcaption{{padding-top:16px}}p{{margin:12px 0}}</style></head><body><h1>{esc(s['step'])}</h1>{videos}<section><h2>Progress</h2><ul>{items}</ul></section><section><h2>Latest activity</h2>{logs}</section><h2>Preview stills</h2><div class="grid">{images}</div></body></html>''', encoding='utf-8')
print(a.message)
