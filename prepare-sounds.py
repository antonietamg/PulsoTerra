"""Prepare licensed recordings for the browser; sources retained in sound-research/."""
import json, pathlib, subprocess, shutil, wave, array

ROOT = pathlib.Path(__file__).resolve().parent
RESEARCH = ROOT / 'sound-research'
OUT = ROOT / 'dist' / 'assets' / 'audio'
FF = shutil.which('ffmpeg')
if not FF:
    raise RuntimeError('FFmpeg no se encontró en PATH.')
samples = []

def encode(source, target, seconds=None, normalize_preview=False):
    target.parent.mkdir(parents=True, exist_ok=True)
    args = [FF, '-v', 'error', '-y', '-i', str(source)]
    if seconds:
        args += ['-t', str(seconds), '-af', f'afade=t=out:st={max(0,seconds-.15)}:d=0.15']
    if normalize_preview:
        with wave.open(str(source),'rb') as wav:
            if wav.getsampwidth()!=2: raise ValueError('La preescucha debe ser PCM16.')
            preview_duration=wav.getnframes()/wav.getframerate()
            pcm=array.array('h',wav.readframes(wav.getnframes()))
        peak=max((abs(v) for v in pcm),default=0)/32768
        if peak>0: args += ['-af',f'volume={.8/peak:.8f},afade=t=out:st={max(0,preview_duration-.06):.5f}:d=0.06']
    args += ['-ar', '44100', '-codec:a', 'libmp3lame', '-b:a', '160k', str(target)]
    subprocess.run(args, check=True)

def add(source, id, instrument, midi=None, seconds=None):
    target = OUT / 'instruments' / (id + '.mp3')
    encode(source, target, seconds)
    samples.append(dict(id=id, instrument=instrument, midi=midi, url='assets/audio/instruments/'+target.name))

aliases = {'violin_section':'strings','cello_section':'cello','french_horn':'horn','acoustic_piano':'piano'}
for row in json.loads((RESEARCH/'orchestra/manifest.json').read_text(encoding='utf-8-sig')):
    instrument = aliases.get(row['instrument'], row['instrument'])
    if instrument == 'piano':
        continue  # Alimentos fue sustituido por Deshielo; el histórico queda en las fuentes.
    seconds = min(row['duration'], 5 if instrument=='harp' else 6)
    add(pathlib.Path(row['path']), row['id'], instrument, row['noteMidi'], seconds)

sordino = RESEARCH/'orchestra/bukvic-sordino/manifest.json'
for row in json.loads(sordino.read_text(encoding='utf-8-sig')):
    add(pathlib.Path(row['path']), row['id'], 'mutedstrings', row['noteMidi'], min(row['duration'],6))

nature = json.loads((RESEARCH/'nature-choir/manifest.json').read_text(encoding='utf-8-sig'))
for row in nature:
    id = {'choir-o-near-f':'choir-o','frog-single':'animal-frog','insect-singing':'animal-insect',
          'tawny-owl':'animal-owl','blackbird':'animal-blackbird'}[row['id']]
    add(RESEARCH/'nature-choir'/row['path'], id, 'choir' if id=='choir-o' else 'animal', 65 if id=='choir-o' else None)

industrial = [('heartbeat-cycle-treated.wav','heartbeat-real','heartbeat'),
              ('snare-f1.wav','snare-1','snare'),('snare-f2.wav','snare-2','snare'),
              ('bass-drum-ff.wav','bassdrum','bassdrum'),('anvil-hit.wav','anvil','anvil'),
              ('brake-drum-hammer.wav','brakedrum','brakedrum')]
for file,id,instrument in industrial:
    add(RESEARCH/'industrial-heart'/file,id,instrument)

ice_manifest = json.loads((RESEARCH/'ice/manifest.json').read_text(encoding='utf-8-sig'))
ice_samples = ice_manifest if isinstance(ice_manifest,list) else ice_manifest['samples']
for row in ice_samples:
    source_mp3 = RESEARCH/'ice/imported-mp3'/(row['id']+'.mp3')
    target = OUT/'instruments'/source_mp3.name
    target.parent.mkdir(parents=True,exist_ok=True)
    shutil.copyfile(source_mp3,target)
    samples.append(dict(id=row['id'],instrument=row['instrument'],midi=row.get('noteMidi',row.get('midi')),url='assets/audio/instruments/'+target.name))

previews = {
    'water': ('agua-violines', 'Agua · violines suaves con arco'),
    'biodiversity': ('biodiversidad-variedad','Biodiversidad · cuatro tipos de animales'),
    'biodiversityExtreme': ('biodiversidad-extremo','Biodiversidad extrema · sólo cárabo'),
    'forests': ('bosque-cuerdas-vientos','Bosques · cuerdas suaves y vientos'),
    'oceans': ('oceano-arpa-cuerdas-metales','Océanos · arpa, cuerdas y metales'),
    'marine': ('vida-marina-flauta-cello','Vida marina · flauta y violonchelo'),
    'humans': ('humanos-coro','Personas · voces humanas reales'),
    'ice': ('deshielo-gotas-hielo','Deshielo · gotas, hielo y campanillas'),
    'economy': ('economia-marcha-industrial','Economía · marcha industrial'),
    'heartbeat': ('latido-humano','Latido humano · grabación tratada')
}
if not (RESEARCH/'previews/economia-marcha-industrial.wav').exists():
    shutil.copyfile(RESEARCH/'industrial-heart/industrial-march-90bpm-preview.wav',RESEARCH/'previews/economia-marcha-industrial.wav')
if not (RESEARCH/'previews/latido-humano.wav').exists():
    shutil.copyfile(RESEARCH/'industrial-heart/heartbeat-60bpm-treated-preview.wav',RESEARCH/'previews/latido-humano.wav')
catalog = {}
for key,(filename,label) in previews.items():
    target = OUT/'previews'/(filename+'.mp3')
    if key == 'ice':
        target.parent.mkdir(parents=True,exist_ok=True)
        shutil.copyfile(RESEARCH/'ice/imported-mp3/deshielo-gotas-hielo.mp3',target)
    else:
        encode(RESEARCH/'previews'/(filename+'.wav'), target, normalize_preview=True)
    shutil.copyfile(target,RESEARCH/'previews'/target.name)
    catalog[key] = dict(label=label,url='assets/audio/previews/'+target.name)

bank = dict(version=3,samples=samples,previews=catalog,creditsUrl='assets/audio/CREDITOS.txt',
            licenseUrl='assets/audio/licencias.json')
(ROOT/'dist/sound-bank.js').write_text('window.AtlasSoundBank = '+json.dumps(bank,ensure_ascii=False,separators=(',',':'))+';\n',encoding='utf-8')
(OUT/'bank.json').write_text(json.dumps(bank,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(dict(samples=len(samples),previews=len(catalog),bytes=sum(p.stat().st_size for p in OUT.rglob('*.mp3')))))
