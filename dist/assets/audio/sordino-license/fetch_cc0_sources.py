"""Rebuild separate CC0 flute/clarinet inputs for the forest recipe.

Recipe supplied under the included Artistic License Version 2.0beta4.
The downloaded instrument source recordings remain CC0 1.0 Universal.
Requires Python 3, NumPy and FFmpeg in PATH. Preserves source/notice metadata.
"""
from pathlib import Path
import argparse,hashlib,json,shutil,subprocess,urllib.request,wave
import numpy as np

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--out',type=Path,default=Path('cc0-inputs'));a=p.parse_args()
    rows=json.loads((Path(__file__).resolve().parent/'cc0-inputs.json').read_text(encoding='utf-8'))
    a.out.mkdir(parents=True,exist_ok=True);originals=a.out/'originals';originals.mkdir(exist_ok=True)
    ff=shutil.which('ffmpeg')
    if not ff:raise RuntimeError('Install FFmpeg in PATH')
    for row in rows:
        req=urllib.request.Request(row['rawUrl'],headers={'User-Agent':'PulsoTierraSourceRebuild/1.0'})
        with urllib.request.urlopen(req,timeout=60) as r:data=r.read()
        assert hashlib.sha256(data).hexdigest()==row['sourceSha256'],'Source hash mismatch: '+row['id']
        original=originals/(row['id']+'.wav');original.write_bytes(data)
        raw=subprocess.check_output([ff,'-v','error','-i',str(original),'-ac','1','-ar','44100','-f','f32le','pipe:1'])
        f=np.frombuffer(raw,dtype='<f4').copy();peak=float(np.max(np.abs(f)))
        if peak>0:f*=.85/peak
        target=a.out/(row['id']+'.wav')
        with wave.open(str(target),'wb') as w:
            w.setnchannels(1);w.setsampwidth(2);w.setframerate(44100)
            w.writeframes(np.clip(f*32767,-32768,32767).astype('<i2').tobytes())
        digest=hashlib.sha256(target.read_bytes()).hexdigest()
        assert digest==row['preparedSha256'],'Prepared hash mismatch; inspect FFmpeg conversion versions: '+row['id']
        print(row['id'],digest)
