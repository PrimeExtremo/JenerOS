"""PROMPT-5 entry point. Original PRO builder is preserved in build_trailer_pro.py."""
from pathlib import Path
exec(compile(Path(__file__).with_name('build_v3.py').read_text(encoding='utf-8'), str(Path(__file__).with_name('build_v3.py')), 'exec'))
