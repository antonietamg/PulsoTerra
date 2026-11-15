"""Add 1890 and 1920 NASA frames without modifying the existing manifest."""
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
import urllib.request, json, importlib.util
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / 'dist' / 'assets'
SOURCES = ROOT / 'sources'
META = json.loads((ASSETS / 'sources.json').read_text(encoding='utf-8'))
LABELS = (ASSETS / 'time.txt').read_text().splitlines()
CHOSEN = [(1890, 57), (1920, 237)]
spec=importlib.util.spec_from_file_location('prepare_assets',ROOT/'tools'/'prepare-assets.py')
shared=importlib.util.module_from_spec(spec);spec.loader.exec_module(shared)

def fetch(item):
    year, ix = item
    assert LABELS[ix].strip() == str(year)
    url = f'https://svs.gsfc.nasa.gov/vis/a000000/a005200/a005207/frames/3840x2160_16x9_30p/GISTEMP_Map_4K{ix:03d}.png'
    original = SOURCES / f'nasa-original-{year}.png'
    if not original.exists():
        original.write_bytes(urllib.request.urlopen(url, timeout=60).read())
    image = Image.open(original).convert('RGB')
    assert list(image.size) == META['originalSize']
    thumb = image.copy(); thumb.thumbnail((1280,720))
    thumb.save(SOURCES / f'inspect-{year}.png')
    return year, ix, url, image

mask,crop,center=shared.map_geometry(Image.open(SOURCES/'nasa-original-2023.png'))
assert list(crop)==META['crop']

frames = [];audits=[]
for year, ix, url, original in ThreadPoolExecutor(max_workers=2).map(fetch, CHOSEN):
    frame,audit=shared.write_frame({'year':year,'index':ix,'url':url},mask,crop,(META['width'],META['height']))
    frames.append(frame);audits.append(audit)

(ASSETS / 'extra-frames.js').write_text('window.EXTRA_NASA_FRAMES = '+json.dumps(frames,ensure_ascii=False,separators=(',',':'))+';\n',encoding='utf-8')
(ASSETS / 'extra-sources.json').write_text(json.dumps([{k:v for k,v in f.items() if k!='imageDataUrl'} for f in frames],ensure_ascii=False,indent=2),encoding='utf-8')
(shared.QA/'extra-audit.json').write_text(json.dumps({'crop':list(crop),'outputSize':[META['width'],META['height']],'mapCenterOriginalX':center,'frames':audits},indent=2),encoding='utf8')
print([(f['year'],f['frameIndex']) for f in frames])
print('Wrote extra-frames.js; existing manifest.js unchanged')
