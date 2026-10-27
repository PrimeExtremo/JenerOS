"""Blender aud + numpy only. Speech pauses and an optional song beat grid."""
from pathlib import Path
import json
import aud
import numpy as np

ROOT = Path(__file__).resolve().parent

def decode(path, rate=16000):
    sound = aud.Sound(str(path)).rechannel(1).resample(rate, True)
    return np.asarray(sound.data(), dtype=np.float32).reshape(-1), rate

def speech():
    path = ROOT/'voiceover/jeneros-vo-v3.mp3'
    x, sr = decode(path)
    hop = int(sr*.01)
    rms = np.sqrt(np.mean(x[:len(x)//hop*hop].reshape(-1, hop)**2, axis=1))
    threshold = max(float(np.percentile(rms, 95))*.035, .001)
    quiet = rms < threshold
    edges = np.diff(np.r_[False, quiet, False].astype(int))
    silences = [(int(a), int(b)) for a,b in zip(np.where(edges==1)[0], np.where(edges==-1)[0]) if b-a>=25]
    starts = [int(np.where(~quiet)[0][0])]
    ends = []
    for a,b in silences:
        if a>starts[-1]:
            ends.append(a)
            if b<len(rms): starts.append(b)
    if len(ends)<len(starts): ends.append(int(np.where(~quiet)[0][-1])+1)
    result={'source':path.name, 'duration':len(x)/sr, 'method':'10ms RMS; silence >=250ms; threshold 3.5% of p95 RMS',
            'threshold':threshold, 'silences':[{'start':a*.01,'end':b*.01} for a,b in silences],
            'regions':[{'start':round(a*.01,3),'end':round(b*.01,3)} for a,b in zip(starts,ends)]}
    (ROOT/'voiceover/envelope.json').write_text(json.dumps(result,indent=2))
    script=[s for s in (ROOT/'voiceover/script-v3.txt').read_text().splitlines() if s.strip()]
    # Paragraph boundaries mapped in script order to the measured speech islands.
    # Internal punctuation does not always create a 250ms pause.
    groups=[(0,3),(4,4),(5,6),(7,7),(8,10),(11,12),(13,13),(14,16),(17,18),(19,22)]
    lines=[]
    for i,(a,b) in enumerate(groups):
        lines.append({'id':i+1,'text':script[i],'start':result['regions'][a]['start'],
                      'end':result['regions'][b]['end'],'regions':list(range(a,b+1))})
    # Fine cues use local 60ms minima, selected near script-weight estimates.
    # These are envelope-aligned editorial cues, not claimed forced transcription.
    short=[(a*.01,b*.01) for a,b in zip(np.where(edges==1)[0],np.where(edges==-1)[0]) if b-a>=6]
    def near(t,window=.23):
        candidates=[b for a,b in short if abs(b-t)<window]
        return round(min(candidates,key=lambda v:abs(v-t)) if candidates else t,3)
    cues={'closet':1.19,'old_pc':2.45,'not_junk':3.94,'new_cloud':near(4.95),
          'photos':6.43,'files':near(7.45),'movies':near(8.45),'at_home':near(9.4),'elsewhere':near(10.55),
          'setup':12.96,'usb':13.99,'power':near(15.5),'scan':near(16.55),
          'no_keyboard':18.84,'no_commands':near(19.85),'no_account':near(20.86),
          'drives':22.6,'two_copies':near(24.35),'lose_drive':27.28,'nothing_lost':28.83,
          'updates':30.56,'second_system':near(31.7),'fails':near(33.3),'rolls_back':34.72,
          'store':36.22,'best_part':38.62,'no_paid':40.51,'no_disks':42.5,'no_users':near(43.7),
          'old_hardware':45.29,'landfill':48.3,'brand':51.39,'free':53.18,'open_source':54.68,'yours':56.94}
    output={**result,'lines':lines,'cues':cues,'cue_method':'Paragraph starts from >=250ms pauses; short interior cues from >=60ms envelope minima near script estimates. Review fine word sync in Premiere.'}
    (ROOT/'voiceover/lines.json').write_text(json.dumps(output,indent=2))
    print(json.dumps(result,indent=2))
    return result

def music(duration):
    path=next((p for p in (ROOT/'music/falling-apart.wav',ROOT/'music/falling-apart.mp3') if p.exists()),None)
    if path is None:
        beats=np.arange(0,duration+3,.625)
        result={'bpm':96,'offset':0,'beats':beats.tolist(),'downbeats':beats[::4].tolist(),
                'drop':float(beats[int(len(beats)*.7)//4*4]),'duration':duration,'placeholder':True,'section_start':0,
                'method':'96 BPM placeholder; no song file present'}
    else:
        x,sr=decode(path,22050); size=2048; hop=256
        frames=np.lib.stride_tricks.sliding_window_view(x,size)[::hop]
        spec=np.abs(np.fft.rfft(frames*np.hanning(size),axis=1))
        flux=np.r_[0,np.maximum(np.diff(np.log1p(spec),axis=0),0).mean(axis=1)]
        flux=np.maximum(flux-np.convolve(flux,np.ones(43)/43,'same'),0)
        rate=sr/hop; lo=int(rate*60/180); hi=int(rate*60/65)
        corr=np.array([np.dot(flux[:-k],flux[k:]) for k in range(lo,hi)])
        lag=lo+int(np.argmax(corr)); period=lag/rate; bpm=60/period
        phase=max(range(lag),key=lambda p:float(flux[p::lag].sum()))
        beats=np.arange(phase/rate,len(x)/sr,period)
        strength=np.interp(beats,np.arange(len(flux))/rate,flux)
        downphase=max(range(4),key=lambda p:float(strength[p::4].sum()))
        downbeats=beats[downphase::4]
        energy=np.sqrt(np.mean(frames**2,axis=1)); span=int(2*rate)
        sm=np.convolve(energy,np.ones(span)/span,'same')
        candidates=np.arange(max(span,int(len(sm)*.35)),len(sm)-span)
        jumps=sm[candidates+span//2]-sm[candidates-span//2]
        raw_drop=candidates[int(np.argmax(jumps))]/rate
        drop=float(min(downbeats,key=lambda t:abs(t-raw_drop)))
        desired=max(0,min(drop-duration*.65,len(x)/sr-duration))
        valid=downbeats[downbeats+duration<=len(x)/sr]
        if not len(valid): raise ValueError('Song is shorter than VO plus end card')
        section=float(min(valid,key=lambda t:abs(t-desired)))
        result={'bpm':float(bpm),'offset':float(beats[0]),'beats':beats.tolist(),'downbeats':downbeats.tolist(),
                'drop':drop,'duration':len(x)/sr,'placeholder':False,'section_start':section,'source':path.name,
                'method':'numpy log spectral flux STFT; autocorrelation tempo; best onset phase; strongest 4-beat phase; sustained RMS jump after 35%',
                'note':'Downbeat phase is an acoustic estimate; review musical phrasing in Premiere.'}
    (ROOT/'music/beats.json').write_text(json.dumps(result,indent=2))
    return result

if __name__=='__main__':
    data=speech()
    music(data['duration']+8)
