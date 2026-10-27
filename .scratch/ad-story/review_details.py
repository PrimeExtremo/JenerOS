"""Extra QA stills for the short actions between the default preview pairs."""
from pathlib import Path
import runpy
import sys

script = Path(__file__).with_name('make_ad.py')
sys.argv = [str(script), '--', '--still', '7', '--frame', '1550']
ad = runpy.run_path(str(script), run_name='__main__')
for beat, frame in [(7, 1625), (4, 790), (3, 640), (8, 1880), (9, 2396)]:
    ad['stills'](beat, frame)
