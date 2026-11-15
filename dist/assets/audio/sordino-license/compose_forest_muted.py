"""Rebuild Pulso Tierra's 16-second forest preview from real recorded instruments.

Portable recipe. Requires Python + NumPy, five prepared Bukvic con-sordino WAVs
and three prepared VSCO CC0 WAVs. No synthesizer, SF2 player or FFmpeg is needed
for this mixing step. The muted violin derivatives and this recipe are made
available under the exact Artistic License 2.0beta4, October 2000, distributed
in Bukvic's source package. Preserve its License.txt and copyright notices.

Copyright Ivica Ico Bukvic 2005 (source SoundFont); Rena Ishii (violinist).
Pulso Tierra modifications: extract and normalize samples, resample pitches,
apply envelopes/panning, layer instruments, add quiet room reflections, write
PCM16 stereo WAV. The flute/clarinet source recordings are CC0 (VSCO 2 CE).
Original musical gesture, not a transcription or recording of Wagner.
"""
from pathlib import Path
import argparse,math,wave,io,hashlib
import numpy as np

SR=44100;N=16*SR
BASE=Path(__file__).resolve().parent
parser=argparse.ArgumentParser()
parser.add_argument('--muted-dir',type=Path,default=BASE/'bukvic-sordino'/'prepared')
parser.add_argument('--cc0-dir',type=Path,default=BASE/'prepared')
parser.add_argument('--out',type=Path,default=BASE.parent/'previews'/'bosque-cuerdas-vientos.wav')
parser.add_argument('--verify',type=Path,help='Compare the reconstructed WAV bytes with this file instead of writing.')
args=parser.parse_args()

palette={
    'muted_violin':[(55,'muted_violin_g3'),(58,'muted_violin_bb3'),(61,'muted_violin_cs4'),(62,'muted_violin_d4'),(69,'muted_violin_a4')],
    'flute':[(69,'flute_a4')],
    'clarinet':[(53,'clarinet_f3'),(58,'clarinet_bb3')]
}
audio={}
for instrument,entries in palette.items():
    folder=args.muted_dir if instrument=='muted_violin' else args.cc0_dir
    for midi,ident in entries:
        with wave.open(str(folder/(ident+'.wav')),'rb') as w:
            assert w.getnchannels()==1 and w.getsampwidth()==2 and w.getframerate()==SR,ident
            audio[ident]=np.frombuffer(w.readframes(w.getnframes()),dtype='<i2').astype(float)/32768

mix=np.zeros((N,2))
def add(instrument,pitch,start,duration,gain,pan,attack,release):
    midi,ident=min(palette[instrument],key=lambda p:abs(p[0]-pitch))
    source=audio[ident];length=int(duration*SR)
    ratio=2**((pitch-midi)/12)
    rates=ratio*2**(np.linspace(0,0,length)/12)
    positions=np.cumsum(rates)+.03*SR
    assert positions[-1]<len(source)-2,('Insufficient source duration',ident)
    y=np.interp(positions,np.arange(len(source)),source)
    a=min(length,int(attack*SR));r=min(length-a,int(release*SR))
    if a>0:y[:a]*=np.sin(np.linspace(0,np.pi/2,a))**2
    if r>0:y[-r:]*=np.cos(np.linspace(0,np.pi/2,r))**2
    y*=gain
    begin=max(0,int(start*SR));count=min(len(y),N-begin)
    angle=(pan+1)*math.pi/4
    mix[begin:begin+count,0]+=y[:count]*math.cos(angle)
    mix[begin:begin+count,1]+=y[:count]*math.sin(angle)

# Authentically muted violin, two gently overlapping layers.
for t,p in ((0,55),(3.5,60),(7,57),(10.5,62)):
    add('muted_violin',p,t,5.2,.27,-.3,1.0,1.0)
    add('muted_violin',p+7,t+.4,4.5,.15,.3,.9,.9)
# Flute: short rising/falling calls.
for t,p,d in ((1,72,1.6),(2.1,76,1.3),(4.7,74,1.5),(5.8,72,1.7),(8.2,76,1.7),(9.5,74,1.5),(12.1,79,1.5),(13.3,76,1.7)):
    add('flute',p,t,d,.28,.3,.16,.36)
# Clarinet: warm, lower and longer responses.
for t,p,d in ((.5,55,2.6),(4,60,2.7),(7.5,57,2.8),(11,62,3.5)):
    add('clarinet',p,t,d,.20,-.25,.4,.7)

dry=mix.copy()
for delay,gain in ((.067,.09),(.103,.06),(.149,.035)):
    d=int(delay*SR);mix[d:]+=dry[:-d,::-1]*gain
fade=int(.45*SR)
mix[:fade]*=np.linspace(0,1,fade)[:,None]
mix[-fade:]*=np.linspace(1,0,fade)[:,None]
mix*=.91/max(float(np.max(np.abs(mix))),1e-6)
stream=io.BytesIO()
with wave.open(stream,'wb') as w:
    w.setnchannels(2);w.setsampwidth(2);w.setframerate(SR)
    w.writeframes((mix*32767).astype('<i2').tobytes())
wav_bytes=stream.getvalue();digest=hashlib.sha256(wav_bytes).hexdigest()
if args.verify:
    actual=hashlib.sha256(args.verify.read_bytes()).hexdigest()
    assert digest==actual,('Reproduction mismatch',digest,actual)
    print('Verified byte-identical WAV:',digest)
else:
    args.out.parent.mkdir(parents=True,exist_ok=True);args.out.write_bytes(wav_bytes)
    print('Created',args.out,'16 s stereo PCM16 44.1 kHz; SHA256',digest)
