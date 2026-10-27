"""Read ISO BMFF metadata for the one-frame smoke test, without ffprobe."""
from pathlib import Path
import json,struct
root=Path(__file__).resolve().parent
data=(root/'out/first-frame-probe.mp4').read_bytes()
def boxes(start,end):
    while start+8<=end:
        size,kind=struct.unpack_from('>I4s',data,start);head=8
        if size==1:size=struct.unpack_from('>Q',data,start+8)[0];head=16
        if size==0:size=end-start
        if size<head:raise ValueError('Invalid MP4 box')
        yield kind,start+head,start+size
        start+=size
moov=next((s,e) for k,s,e in boxes(0,len(data)) if k==b'moov')
tracks=[]
for kind,start,end in boxes(*moov):
    if kind!=b'trak':continue
    track={}
    for k,s,e in boxes(start,end):
        if k==b'tkhd':
            track['width']=struct.unpack_from('>I',data,e-8)[0]/65536
            track['height']=struct.unpack_from('>I',data,e-4)[0]/65536
        if k!=b'mdia':continue
        for mk,ms,me in boxes(s,e):
            if mk==b'hdlr':track['handler']=data[ms+8:ms+12].decode()
            if mk==b'mdhd':
                offset=20 if data[ms]==1 else 12
                rate=struct.unpack_from('>I',data,ms+offset)[0]
                duration=struct.unpack_from('>Q' if data[ms]==1 else '>I',data,ms+offset+4)[0]
                track['duration']=duration/rate
    tracks.append(track)
assert len(tracks)==1 and tracks[0]['handler']=='vide',tracks
assert tracks[0]['width']==2560 and tracks[0]['height']==1440,tracks
assert abs(tracks[0]['duration']-1/60)<.0001,tracks
result={'passed':True,'bytes':len(data),'tracks':tracks,'frames':1,'audio_tracks':0}
(root/'out/probe-check.json').write_text(json.dumps(result,indent=2));print(json.dumps(result))
