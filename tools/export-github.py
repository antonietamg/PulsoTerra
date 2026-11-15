"""Create a clean public source snapshot without private hosting history."""
import argparse
import shutil
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('destination',type=Path)
args=parser.parse_args()
target=args.destination.resolve()
if target.exists():raise SystemExit('Destination must be a new directory; existing work is never overwritten.')
if target==ROOT or ROOT in target.parents:raise SystemExit('Use a separate export directory outside the source checkout.')
target.mkdir(parents=True)
for directory in ['dist','docs','tests','tools']:
    shutil.copytree(ROOT/directory,target/directory,ignore=shutil.ignore_patterns('__pycache__','*.pyc'))
for name in ['README.md','AUTHORS.md','LICENSE.md','CONTRIBUTING.md','SECURITY.md','serve.mjs','build-offline.mjs','build-sound-gallery.py','prepare-vivaldi.py','prepare-sounds.py']:
    shutil.copy2(ROOT/name,target/name)
(target/'.gitignore').write_text('.openai/\nqa/\nsources/\nsound-research/\n__pycache__/\n*.pyc\n*.tar.gz\n*.zip\n!dist/assets/audio/*.zip\nPulsoTerra-sin-internet.html\nEscuchar-sonidos-PulsoTerra.html\n.env\n.env.*\n',encoding='utf-8')
print('Public source snapshot:',target)
print('Files:',sum(1 for p in target.rglob('*') if p.is_file()))
