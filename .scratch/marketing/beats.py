#!/usr/bin/env python3
"""Analyze a cleared audio track. JSON only on stdout; diagnostics on stderr.
pip install librosa soundfile
python beats.py song.mp3 > beats.json
"""
import argparse
import json
import sys


def analyze(filename):
    import librosa
    import numpy as np

    audio, sr = librosa.load(filename, sr=22050, mono=True)
    if len(audio) < sr * 10 or not np.isfinite(audio).all():
        raise ValueError("Use a finite audio track at least ten seconds long.")
    onset = librosa.onset.onset_strength(y=audio, sr=sr, hop_length=512)
    tempo, frames = librosa.beat.beat_track(onset_envelope=onset, sr=sr, hop_length=512, trim=False)
    frames = np.asarray(frames, dtype=int)
    if len(frames) < 69 or not np.any(onset > 0):
        raise ValueError("The trailer needs at least 69 detected beats. Use a longer, rhythmic track.")
    times = librosa.frames_to_time(frames, sr=sr, hop_length=512)
    # Strongest of four metrical phases, averaged to avoid endpoint bias.
    energy = np.array([np.max(onset[max(0, f-1):min(len(onset), f+2)]) for f in frames])
    phase = int(np.argmax([np.mean(energy[p::4]) for p in range(4)]))
    # A drop is the largest sustained onset-energy increase after 40%.
    window = max(1, int(sr / 512 * .75))
    smooth = np.convolve(onset, np.ones(window) / window, mode="same")
    previous = np.concatenate((np.zeros(window), smooth[:-window]))
    jump = smooth - previous
    first = int(len(onset) * .4)
    drop_frame = first + int(np.argmax(jump[first:]))
    drop = min(float(times[-1]), float(librosa.frames_to_time(drop_frame, sr=sr, hop_length=512)))
    return {"bpm": round(float(np.asarray(tempo).reshape(-1)[0]), 6),
            "offset": round(float(times[0]), 6),
            "beats": [round(float(t), 6) for t in times],
            "downbeats": [round(float(t), 6) for t in times[phase::4]],
            "drop": round(drop, 6)}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("audio", help="An audio file you have permission to use")
    args = parser.parse_args()
    try:
        print(json.dumps(analyze(args.audio), indent=2))
    except (ImportError, ValueError, OSError) as error:
        print(f"beats.py: {error}", file=sys.stderr)
        sys.exit(1)
