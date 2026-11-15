"""Rebuild Pulso Tierra's modified Bukvic con-sordino sample package.

Copyright Ivica Ico Bukvic 2005 (original SoundFont); violinist Rena Ishii.
Changes/recipe prepared for Pulso Tierra, November 2026.
This modified package and recipe are distributed under the included
Artistic License Version 2.0beta4, October 2000, NOT Artistic 2.0 final.
Recipients are permitted and encouraged to make these modifications Freely
Available under the same included license. See SOURCE-AND-CHANGES.txt.

Requirements: Python 3, NumPy; FFmpeg in PATH only for MP3 conversion.
Run: python rebuild_samples.py --archive violin_sordino.tar.bz2 --out rebuilt
"""
from pathlib import Path
import argparse, hashlib, json, shutil, struct, subprocess, tarfile, wave
import numpy as np

ARCHIVE_SHA='7c396a5c7f4abf74a3fefbf9a5f4e36e18c5230ea4c2127973d10a53782f0948'
SF2_SHA='10816a83b64a236141dcc59b219db843e40b8e27c38893d58cea4a7073b13c6b'
SELECT=[('G3',55,'g3'),('Bb3',58,'bb3'),('C#4',61,'cs4'),('D4',62,'d4'),('A4',69,'a4')]

def chunks(data,start,end):
    while start+8<=end:
        tag=data[start:start+4];size=struct.unpack_from('<I',data,start+4)[0]
        yield tag,start+8,start+8+size
        start+=8+size+(size%2)

def rebuild(archive,out,mp3=True):
    assert hashlib.sha256(archive.read_bytes()).hexdigest()==ARCHIVE_SHA,'Archive hash mismatch'
    with tarfile.open(archive,'r:bz2') as t:
        # Read only the known regular file: no filesystem archive extraction.
        data=t.extractfile('violin_sordino/violin_sordino.sf2').read()
    assert hashlib.sha256(data).hexdigest()==SF2_SHA,'SF2 hash mismatch'
    smpl=None;headers=[]
    for tag,s,e in chunks(data,12,len(data)):
        if tag!=b'LIST':continue
        for sub,a,b in chunks(data,s+4,e):
            if data[s:s+4]==b'sdta' and sub==b'smpl':smpl=np.frombuffer(data[a:b],dtype='<i2')
            if data[s:s+4]==b'pdta' and sub==b'shdr':
                for pos in range(a,b-45,46):
                    row=struct.unpack_from('<20sIIIIIBbHH',data,pos)
                    name=row[0].split(b'\0')[0].decode('ascii','replace')
                    headers.append(dict(name=name,start=row[1],end=row[2],sampleRate=row[5]))
    assert smpl is not None
    out.mkdir(parents=True,exist_ok=True);records=[]
    for name,midi,suffix in SELECT:
        h=next(x for x in headers if x['name']==name)
        raw=smpl[h['start']:h['end']].copy();f=raw.astype(float)/32768
        peak=float(np.max(np.abs(f)));scaled=f*.85/peak
        pcm=np.clip(scaled*32767,-32768,32767).astype('<i2')
        ident='muted_violin_'+suffix;wav=out/(ident+'.wav')
        with wave.open(str(wav),'wb') as w:
            w.setnchannels(1);w.setsampwidth(2);w.setframerate(h['sampleRate']);w.writeframes(pcm.tobytes())
        if mp3:
            ff=shutil.which('ffmpeg')
            if not ff:raise RuntimeError('Install FFmpeg or pass --wav-only')
            # Browser variant: first six seconds, same mono 44.1 kHz source,
            # final 150 ms fade and MP3 at 160 kbit/s, matching the app recipe.
            subprocess.run([ff,'-v','error','-y','-i',str(wav),'-t','6','-af','afade=t=out:st=5.85:d=0.15','-ar','44100','-ac','1','-codec:a','libmp3lame','-b:a','160k',str(out/(ident+'.mp3'))],check=True)
        records.append(dict(id=ident,instrument='mutedstrings',midi=midi,sourceSample=name,sampleRate=h['sampleRate'],durationSeconds=len(raw)/h['sampleRate'],wavSha256=hashlib.sha256(wav.read_bytes()).hexdigest()))
    (out/'rebuilt-manifest.json').write_text(json.dumps(records,indent=2),encoding='utf-8')
    return records

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--archive',type=Path,default=Path('violin_sordino.tar.bz2'));p.add_argument('--out',type=Path,default=Path('rebuilt'));p.add_argument('--wav-only',action='store_true');a=p.parse_args()
    print(json.dumps(rebuild(a.archive,a.out,not a.wav_only),indent=2))
