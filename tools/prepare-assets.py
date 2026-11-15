from pathlib import Path
import urllib.request, json, base64, hashlib, sys
from PIL import Image
from concurrent.futures import ThreadPoolExecutor
import numpy as np

ROOT=Path(__file__).resolve().parents[1]
ASSETS=ROOT/'dist'/'assets'
ASSETS.mkdir(parents=True,exist_ok=True)
SOURCES=ROOT/'sources'
SOURCES.mkdir(parents=True,exist_ok=True)
QA=ROOT/'qa'/'map-assets'

def map_geometry(reference):
    """Trace only the exterior of the original Robinson map, never its colors.

    The centered map is the longest nonblack run through the middle of the
    frame. The right rim is free of the legend and timeline. Mirror that rim
    about the center measured from the unobstructed upper half of the map.
    Every interior row is one solid span, including gray basemap and coastlines.
    """
    image=np.asarray(reference.convert('RGB'))
    height,width=image.shape[:2]
    ys=np.flatnonzero(np.any(image[:,width//2-20:width//2+20].max(2)>0,axis=1))
    runs=np.split(ys,np.flatnonzero(np.diff(ys)>1)+1)
    run=max(runs,key=len)
    top,bottom=int(run[0]),int(run[-1])+1
    if bottom-top<height*.7:
        raise ValueError('No se pudo separar el mapa Robinson de las anotaciones.')
    rows=[]; centers=[]
    for y in range(top,bottom):
        xs=np.flatnonzero(image[y].max(1)>0)
        right=int(xs[xs>width//2][-1])
        if y<(top+bottom)//2: centers.append((int(xs[0])+right)/2)
        rows.append((y,right))
    center=float(np.median(centers))
    mask=np.zeros((height,width),dtype=np.uint8)
    lefts=[]
    for y,right in rows:
        left=round(2*center-right)
        lefts.append(left)
        mask[y,left:right+1]=255
    crop=(min(lefts),top,max(right for _,right in rows)+1,bottom)
    # NASA's map has no black exterior inside this span. Keep even the faint
    # antialiased rim; do not erode the map to conceal a segmentation error.
    if np.any(image[mask>0].max(1)==0):
        raise ValueError('La máscara Robinson incluye fondo negro o anotaciones.')
    return mask,crop,center

def map_image(original,mask,crop,size):
    rgba=original.convert('RGBA')
    rgba.putalpha(Image.fromarray(mask))
    return rgba.crop(crop).resize(size,Image.Resampling.NEAREST)

def make_palette(image):
    # An odd number includes the legend's native midpoint. The former even
    # 256 samples assigned the two middle colors +/-0.007843, never zero.
    neutral=list(image.getpixel((160,round((635+36)/2))))
    palette=[]
    for n in range(257):
        y=round(635-n*599/256)
        rgb=list(image.getpixel((160,y)))
        value=round(-2+n*4/256,6)
        if rgb==neutral and value!=0: continue
        palette.append({'rgb':rgb,'value':value})
    # NASA describes the baseline as white. Pure/near white must not receive a
    # warm anomaly merely because the rendered legend midpoint is off-white.
    if neutral!=[255,255,255]:palette.append({'rgb':[255,255,255],'value':0})
    return palette

def write_frame(item,mask,crop,size):
    year=item['year']; ix=item['index']
    source=SOURCES/f'nasa-original-{year}.png'
    original=Image.open(source).convert('RGB')
    output=map_image(original,mask,crop,size)
    filename=f'temperature-{year}.png'; target=ASSETS/filename
    previous=Image.open(target).convert('RGBA') if target.exists() else None
    QA.mkdir(parents=True,exist_ok=True)
    if year in (1890,1950,2023):
        original.crop(crop).resize(size,Image.Resampling.NEAREST).save(QA/f'{year}-original-crop.png')
        if previous and not (QA/f'{year}-before-composited.png').exists():
            canvas=Image.new('RGB',size,'white');canvas.paste(previous,mask=previous.getchannel('A'));canvas.save(QA/f'{year}-before-composited.png')
        canvas=Image.new('RGB',size,'white');canvas.paste(output,mask=output.getchannel('A'));canvas.save(QA/f'{year}-after-composited.png')
    expected=np.asarray(original.crop(crop).resize(size,Image.Resampling.NEAREST))
    expected_alpha=np.asarray(Image.fromarray(mask).crop(crop).resize(size,Image.Resampling.NEAREST))
    actual=np.asarray(output)
    old=np.asarray(previous) if previous and previous.size==size else None
    audit={'year':year,'sourceSha256':hashlib.sha256(source.read_bytes()).hexdigest(),
        'opaquePixels':int(np.count_nonzero(actual[:,:,3])),
        'rgbDifferencesFromOriginalNearestNeighbor':int(np.count_nonzero(np.any(actual[:,:,:3]!=expected,axis=2))),
        'repairedTransparentInteriorPixels':int(np.count_nonzero((old[:,:,3]==0)&(actual[:,:,3]==255))) if old is not None else None,
        'interiorTransparentPixels':int(np.count_nonzero((expected_alpha>0)&(actual[:,:,3]==0))),
        'opaqueLegendPixels':int(np.count_nonzero(mask[1560:,:285]))}
    if audit['rgbDifferencesFromOriginalNearestNeighbor'] or audit['opaqueLegendPixels']:
        raise ValueError('La imagen procesada alteró RGB NASA o incluyó la leyenda.')
    output.save(target,optimize=True)
    encoded=base64.b64encode(target.read_bytes()).decode()
    frame={'id':str(year),'label':str(year),'date':str(year),'year':year,
        'image':f'assets/{filename}','imageDataUrl':'data:image/png;base64,'+encoded,
        'sourceUrl':item['url'],'frameIndex':ix,'sourceSha256':audit['sourceSha256'],
        'imageSha256':hashlib.sha256(target.read_bytes()).hexdigest(),
        'description':f'Fotograma NASA rotulado {year}; promedio móvil de 24 meses, referencia 1951–1980.'}
    return frame,audit

def fetch(url):
    return urllib.request.urlopen(url,timeout=60).read()

if __name__=='__main__':
    url='https://svs.gsfc.nasa.gov/vis/a000000/a005200/a005207/time.txt'
    # --offline rebuilds the verified local source files without a NASA request.
    times=(ASSETS/'time.txt').read_bytes() if '--offline' in sys.argv else fetch(url)
    if '--offline' not in sys.argv:(ASSETS/'time.txt').write_bytes(times)
    labels=times.decode().splitlines()
    print('labels',len(labels))
    # NASA time.txt has one line per frame. Use middle of each labelled year,
    # and inspect the printed frame labels before publishing the manifest.
    chosen=[]
    for year in [1900,1950,1980,2000,2023]:
        indices=[i for i,y in enumerate(labels) if y.strip()==str(year)]
        ix=indices[len(indices)//2] if year!=2023 else 899
        chosen.append((year,ix))
    print('selected',chosen)
    def download(item):
        year,ix=item
        url=f'https://svs.gsfc.nasa.gov/vis/a000000/a005200/a005207/frames/3840x2160_16x9_30p/GISTEMP_Map_4K{ix:03d}.png'
        path=SOURCES/f'nasa-original-{year}.png'
        if not path.exists(): path.write_bytes(fetch(url))
        im=Image.open(path)
        print(year,ix,im.size,len(path.read_bytes()))
        thumb=im.copy(); thumb.thumbnail((1280,720)); thumb.save(SOURCES/f'inspect-{year}.png')
        return {'year':year,'index':ix,'url':url}
    selected=list(ThreadPoolExecutor(max_workers=5).map(download,chosen))
    (SOURCES/'selection.json').write_text(json.dumps(selected,indent=2),encoding='utf8')
    mask,crop,center=map_geometry(Image.open(SOURCES/'nasa-original-2023.png'))
    left,top,right,bottom=crop
    width=1024; height=round((bottom-top)/(right-left)*width)
    print('crop',crop,'output',width,height)
    QA.mkdir(parents=True,exist_ok=True)
    Image.fromarray(mask).crop(crop).resize((width,height),Image.Resampling.NEAREST).save(QA/'robinson-mask.png')
    frames=[];audits=[]
    for item in selected:
        f,audit=write_frame(item,mask,crop,(width,height));frames.append(f);audits.append(audit)
    palette_image=Image.open(ASSETS/'nasa-palette.png').convert('RGB')
    palette=make_palette(palette_image)
    manifest={
        'frames':frames, 'palette':palette, 'width':width,'height':height,
        'projection':'Robinson','source':'NASA Scientific Visualization Studio · GISTEMP v4',
        'sourceUrl':'https://svs.gsfc.nasa.gov/5207/',
        'paletteUrl':'https://svs.gsfc.nasa.gov/vis/a000000/a005200/a005207/giss_navy_anomaly_Vertical-both.png',
        'timeUrl':url,'baseline':'1951–1980','smoothing':'Promedio móvil de 24 meses',
        'unit':'°C de anomalía aproximada por color','paletteRange':[-2,2],
        'crop':list(crop),'originalSize':[3840,2160],
        'maskMethod':'Borde exterior Robinson medido en NASA 2023 y reflejado por fila; sin agujeros interiores.',
        'mapCenterOriginalX':center,'neutralReference':{'value':0,'rgb':[point['rgb'] for point in palette if point['value']==0],'meaning':'Referencia 1951–1980; blanco y punto central nativo de la paleta.'},
        'notes':[
            'Las fechas son los rótulos de NASA time.txt y se verificaron en cada imagen original.',
            'Los cinco fotogramas comparten la misma paleta y proyección Robinson.',
            'Mapa recortado sin leyenda ni cronología; redimensionado por vecino más cercano para conservar RGB.',
            'Alpha cero sólo fuera del borde real Robinson. Todo RGB interior de NASA, incluidos blancos, grises y costas, se conserva.',
            'El análisis interpreta el blanco de referencia como cero; los grises oscuros de base y costas siguen sin dato, sin perforar la imagen.',
            'La escala satura en ±2 °C; la temperatura exacta no puede reconstruirse desde estos colores.',
            'Las proporciones visuales de píxeles no son medias globales ponderadas por superficie.',
            'NASA/SVS visualización; datos proporcionados por Robert B. Schmunk NASA/GSFC GISS.'
        ]
    }
    (ASSETS/'manifest.js').write_text('window.NASA_DATA = '+json.dumps(manifest,ensure_ascii=False,separators=(',',':'))+';\n',encoding='utf8')
    # The metadata JSON omits the embedded copies for easy inspection.
    manifest_clean={**manifest,'frames':[{k:v for k,v in f.items() if k!='imageDataUrl'} for f in frames]}
    (ASSETS/'sources.json').write_text(json.dumps(manifest_clean,ensure_ascii=False,indent=2),encoding='utf8')
    (QA/'base-audit.json').write_text(json.dumps({'crop':list(crop),'outputSize':[width,height],'mapCenterOriginalX':center,'frames':audits},indent=2),encoding='utf8')
    print('manifest',len((ASSETS/'manifest.js').read_bytes()),'bytes')
