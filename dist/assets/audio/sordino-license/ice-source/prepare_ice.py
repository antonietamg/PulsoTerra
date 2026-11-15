"""Prepare Sun's real CC0 droplets, ice cracks and soft recorded glockenspiel."""
from pathlib import Path
import urllib.request, urllib.parse, hashlib, json, subprocess, shutil, wave
import numpy as np

ROOT=Path(__file__).resolve().parent
OUT=ROOT/'prepared';OUT.mkdir(exist_ok=True)
FF=shutil.which('ffmpeg')
SHA='c1ea7bcc3c7309650ab0da9d15c9cd1fbc4a4c7e'
rows=[]
def read(path):
    raw=subprocess.check_output([FF,'-v','error','-i',str(path),'-ac','1','-ar','44100','-f','f32le','-'])
    return np.frombuffer(raw,dtype='<f4').astype(float)
def save(id,x,fade_in=.004,fade_out=.06):
    if len(x)==0:raise ValueError('Audio vacío')
    n=min(int(44100*fade_in),len(x)//3);m=min(int(44100*fade_out),len(x)//3)
    x=x.copy()
    if n:x[:n]*=np.linspace(0,1,n)
    if m:x[-m:]*=np.linspace(1,0,m)
    x*=.80/max(np.max(np.abs(x)),1e-12)
    path=OUT/(id+'.wav')
    with wave.open(str(path),'wb') as w:
        w.setnchannels(1);w.setsampwidth(2);w.setframerate(44100);w.writeframes(np.round(x*32767).astype('<i2').tobytes())
    return path,len(x)/44100
def register(id,instrument,source,path,duration,source_url,creator,midi=None,processing='',**extra):
    rows.append(dict(id=id,instrument=instrument,midi=midi,noteMidi=midi,path=str(path.resolve()),relativePath=path.relative_to(ROOT).as_posix(),duration=duration,sampleRate=44100,channels=1,bitsPerSample=16,sourceUrl=source_url,creator=creator,license='CC0 1.0 Universal',licenseUrl='https://creativecommons.org/publicdomain/zero/1.0/',processing=processing,sourceSha256=hashlib.sha256(source.read_bytes()).hexdigest(),sha256=hashlib.sha256(path.read_bytes()).hexdigest(),**extra))

drops=ROOT/'originals/drops-1386.wav';x=read(drops)
for id,center in [('sun-drop-1',1.60),('sun-drop-2',3.04)]:
    local_start=int((center-.08)*44100);local_end=int((center+.08)*44100)
    peak=local_start+int(np.argmax(np.abs(x[local_start:local_end])))
    start=max(0,peak-int(.018*44100));segment=x[start:start+int(.62*44100)]
    p,d=save(id,segment,.002,.08)
    register(id,'waterdrop',drops,p,d,'https://lasonotheque.org/gouttes-eau-3-s1386.html','Joseph SARDIN / LaSonotheque',processing='Recorte de una gota real; mono PCM16 44.1 kHz, fades 2/80 ms y pico0.8; sin síntesis ni transposición.',sourceStartSeconds=start/44100,downloadUrl='https://lasonotheque.org/UPLOAD/bwf-fr/1386.wav',notes='Agua real grabada cayendo en un plato; no grabación de glaciar.')

for number,sourceid in [(1,2205),(2,2207)]:
    source=ROOT/'originals'/f'ice-{sourceid}.wav';x=read(source)
    above=np.flatnonzero(np.abs(x)>np.max(np.abs(x))*.005)
    start=max(0,int(above[0]) - int(.008*44100));end=min(len(x),int(above[-1])+int(.05*44100))
    p,d=save(f'sun-ice-crack-{number}',x[start:end],.002,.05)
    page=f'https://lasonotheque.org/glace-qui-craque-{1 if number==1 else 3}-s{sourceid}.html'
    register(f'sun-ice-crack-{number}','icecrack',source,p,d,page,'Joseph SARDIN / LaSonotheque',processing='Recorte de silencio periférico, mono PCM16 44.1 kHz, fades 2/50 ms y pico0.8; no se añadió síntesis.',sourceStartSeconds=start/44100,downloadUrl=f'https://lasonotheque.org/UPLOAD/bwf-fr/{sourceid}.wav',notes='Hielo real: bloque de hielo aplastado en estudio por el autor. Efecto Foley, no crujido de glaciar en campo.')

for filename,id,midi,frequency in [('glock_soft_G4_01.wav','sun-glock-g5',79,787.82),('glock_soft_C5_02.wav','sun-glock-c6',84,1053.81),('glock_soft_G5_01.wav','sun-glock-g6',91,1579.19)]:
    source=ROOT/'originals'/filename;x=read(source)
    target=440*2**((midi-69)/12);ratio=target/frequency
    x=np.interp(np.arange(0,len(x)-1,ratio),np.arange(len(x)),x)
    p,d=save(id,x,.001,.16)
    rel='Idiophones/Struck Idiophones/Glockenspiel/'+filename
    url='https://github.com/sgossner/VCSL/blob/'+SHA+'/'+urllib.parse.quote(rel)
    register(id,'glockenspiel',source,p,d,url,'Versilian Studios LLC / Sam Gossner',midi=midi,processing='Glockenspiel real soft. Mono PCM16 44.1kHz, afinación leve por remuestreo al MIDI indicado, fades1/160ms y pico0.8. Sin osciladores.',sourceFilename=filename,originalFundamentalHz=frequency,preparedFundamentalTargetHz=target,tuningCentsApplied=1200*np.log2(ratio),sourceCommit=SHA,downloadUrl='https://raw.githubusercontent.com/sgossner/VCSL/'+SHA+'/'+urllib.parse.quote(rel),notes='Los nombres de octava de estos WAV VCSL están una octava por debajo del audio medido; MIDI se basa en la frecuencia real.')

(ROOT/'manifest.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2),encoding='utf-8')
(ROOT/'CREDITOS.txt').write_text('PULSO TIERRA — SUN: DESHIELO\n\nGotas e hielo: Joseph SARDIN / LaSonotheque, CC0. Gotas reales en plato; bloque de hielo aplastado en estudio. No se presentan como grabaciones de un glaciar.\nGlockenspiel suave: VCSL, Versilian Studios LLC / Sam Gossner, CC0. Tres notas grabadas, afinadas ligeramente al temperamento igual.\n\nLicencia: https://creativecommons.org/publicdomain/zero/1.0/\n\nFuentes, hashes, recortes y procesamiento exactos: manifest.json. Los originales y páginas de licencia se conservan en esta carpeta.\nEstos materiales se usan como interpretación artística sobre mapas de anomalía local, no como medición de fusión de hielo o nivel del mar.\n',encoding='utf-8')
print(json.dumps([dict(id=r['id'],instrument=r['instrument'],midi=r['midi'],duration=round(r['duration'],3)) for r in rows],ensure_ascii=False))
