"""Known-tempo synthetic check; no music or speech content is copied."""
import json
from pathlib import Path
import sys
import wave
import numpy as np
ROOT=Path(__file__).resolve().parent
sys.path.insert(0,str(ROOT))
import analyze_audio as analyzer
fixture=ROOT/'out/audio-fixture';(fixture/'music').mkdir(parents=True,exist_ok=True)
sr=22050;duration=96;x=np.zeros(int(sr*duration),np.float32)
rng=np.random.default_rng(2026)
for beat,t in enumerate(np.arange(.25,duration,.625)):
    n=int(sr*.13);u=np.arange(n)/sr
    click=np.sin(2*np.pi*(90*u-130*u*u))*np.exp(-u*32)
    click+=rng.normal(0,.07,n)*np.exp(-u*60)
    gain=(.18 if t<60 else .65)*(1 if beat%4==0 else .65)
    st=int(sr*t);en=min(len(x),st+n);x[st:en]+=click[:en-st]*gain
path=fixture/'music/falling-apart.wav'
with wave.open(str(path),'wb') as w:
    w.setnchannels(1);w.setsampwidth(2);w.setframerate(sr);w.writeframes((x*32767).astype('<i2').tobytes())
original=analyzer.ROOT;analyzer.ROOT=fixture
try:
    grid=analyzer.music(63.5)
    assert abs(grid['bpm']-96)<2,grid['bpm']
    assert 55<grid['drop']<65,grid['drop']
    assert grid['section_start']+63.5<=duration
    assert all(b>a for a,b in zip(grid['beats'],grid['beats'][1:]))
    result={'passed':True,'expected_bpm':96,'bpm':grid['bpm'],'expected_drop':60.25,'drop':grid['drop'],
            'section_start':grid['section_start'],'note':'Synthetic onset/RMS fixture only; actual Falling Apart track is absent.'}
    (ROOT/'out/audio-analysis-check.json').write_text(json.dumps(result,indent=2));print(json.dumps(result))
finally:
    analyzer.ROOT=original;path.unlink()
