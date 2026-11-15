import pathlib, json, html, base64, zipfile
ROOT = pathlib.Path(__file__).resolve().parent
DIST = ROOT/'dist'
BANK = json.loads((DIST/'assets/audio/bank.json').read_text(encoding='utf-8'))
ROWS = [
 ('water','01 · Agua','Violines suaves con arco','Arcos suaves en un registro natural: el fluir consonante adquiere fricción y trémolo al aumentar la anomalía. Referencia expresiva: Vivaldi.'),
 ('biodiversity','02 · Biodiversidad','Mirlo, rana, cárabo e insecto','Cuatro tipos de animales en entradas sucesivas. Para −1,5 < ΔT < +1,5 °C se permite variedad. No representa abundancia medida.'),
 ('forests','03 · Bosques','Violín con sordina, flauta y clarinete','Violín auténtico con sordina, interpretado por Rena Ishii, junto a flauta y clarinete. Motivo original inspirado en el ambiente de Murmullos del bosque.'),
 ('oceans','04 · Océanos','Arpa, cuerdas y metales','Arpa ondulante, cuerdas sostenidas y amplitud de metales grabados. Referencia expresiva: La mer de Debussy.'),
 ('marine','05 · Vida marina','Flauta y violonchelo','Inflexiones lentas evocan una voz de ballena. Referencia de instrumentación: Vox Balaenae. No es una grabación de ballenas ni una ejecución de la obra.'),
 ('humans','06 · Personas','Voces humanas reales','Un grupo real canta la vocal O. La textura unida adquiere fricciones y frases entrecortadas con la anomalía. Es un grupo humano no profesional.'),
 ('ice','07 · Deshielo','Gotas, hielo y campana suave','La categoría Deshielo de Sun: gotas grabadas y campanas suaves cerca de la referencia; goteo más intenso y crujidos de hielo en anomalías extremas. Es una interpretación artística, no una medición de fusión.'),
 ('economy','08 · Economía','Marcha industrial en 4/4','Bombo, caja, redobles, yunque y tambor de freno grabados. Se conserva la marcha original; este ejemplo mantiene 90 BPM.'),
 ('biodiversityExtreme','Prueba del umbral','Un solo tipo de animal','Sólo cárabo para ΔT ≤ −1,5 °C o ΔT ≥ +1,5 °C. No se añaden otras especies ni notas sintetizadas.'),
 ('heartbeat','Prueba del latido','Grabación humana · 60 BPM','Un ciclo lub-dub real repetido a 60 BPM. EQ, compresión y normalización para dar presencia. En el mapa su velocidad es una metáfora climática.')
]
CSS='''
.sound-audition{border:1px solid var(--line);border-radius:14px;background:#fffefb;padding:16px 20px;display:flex;align-items:center;justify-content:space-between;gap:25px;margin-top:14px}.sound-audition strong{font-weight:600}.sound-audition p{font-size:12px;color:var(--muted);margin:4px 0}.sound-audition a{font-size:12px;color:var(--green)}.sound-audition audio{width:min(340px,100%);flex-shrink:0}.heart-audition{font-size:11px;margin:-2px 0 17px;color:var(--muted)}.heart-audition summary{cursor:pointer;color:var(--green)}.heart-audition audio{width:100%;height:36px}.heart-volume{margin-bottom:10px}.audio-intro{max-width:790px;padding:48px 0 32px}.audio-intro h1{font-size:44px}.audio-intro p{font-size:16px;color:var(--muted);max-width:680px}.audio-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px}.audio-card{border:1px solid var(--line);background:var(--white);padding:24px;border-radius:18px}.audio-card h2{font-size:22px;font-weight:500;margin:0 0 8px}.audio-card p{color:var(--muted);font-size:13px;min-height:61px}.audio-card audio{width:100%}.audio-card .download{display:inline-block;font-size:12px;color:var(--green);margin-top:10px}.audio-notes{padding:32px 0 40px;max-width:850px}.audio-notes p{color:var(--muted)}.gallery-actions{display:flex;flex-wrap:wrap;gap:20px;margin-top:22px;font-size:13px}.gallery-actions a{color:var(--green);font-weight:600}@media(max-width:700px){.sound-audition{display:block}.sound-audition audio{margin-top:14px;width:100%}.audio-grid{grid-template-columns:1fr}.audio-intro{padding:30px 0 20px}.audio-intro h1{font-size:34px}.audio-card p{min-height:0}}
'''
stylepath=DIST/'styles.css'
style=stylepath.read_text(encoding='utf-8')
existing_audio_css=style.split('/* RECORDED AUDIO */',1)[1].strip() if '/* RECORDED AUDIO */' in style else ''
if '/* RECORDED AUDIO */' in style: style=style.split('/* RECORDED AUDIO */')[0]
if existing_audio_css != CSS.strip():
    stylepath.write_text(style+'\n/* RECORDED AUDIO */\n'+CSS,encoding='utf-8')

cards=[]
for key,title,instruments,description in ROWS:
    url=BANK['previews'][key]['url']
    cards.append(f'<article class="audio-card"><p class="eyebrow" id="sound-{key}">{html.escape(title)}</p><h2>{html.escape(instruments)}</h2><p>{html.escape(description)}</p><audio controls preload="none" aria-label="Escuchar {html.escape(title)}"><source src="{url}" type="audio/mpeg"></audio><a class="download" id="download-{key}" aria-labelledby="sound-{key} download-{key}" href="{url}" download>↓ Descargar este ejemplo MP3</a></article>')

doc='''<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>PulsoTerra · Banco de sonidos</title><link rel="stylesheet" href="styles.css"></head><body>
<a class="skip-link" href="#soundGallery">Saltar al banco de sonidos</a><header class="shell site-header"><a class="brand" href="index.html">Pulso<span class="brand-light">Terra</span></a><a href="index.html" class="text-button">Volver al mapa ↗</a></header><main class="shell" id="soundGallery"><section class="audio-intro"><p class="eyebrow">BANCO DE SONIDOS · GRABACIONES REALES</p><h1>Ocho temas.<br>Escucha sus voces.</h1><p>Estos ejemplos permiten comparar la selección de sonidos sin el recorrido del mapa ni el latido de fondo. Las referencias musicales orientan el carácter y la instrumentación; los motivos son originales.</p><div class="gallery-actions"><button type="button" id="pauseAllSounds">Pausar todo el audio</button><a href="assets/audio/Pulso-Tierra-sonidos.zip" download="PulsoTerra-sonidos.zip">↓ Descargar los diez ejemplos y créditos</a><a href="assets/audio/CREDITOS.txt">Ver fuentes y licencias</a></div></section><section class="audio-grid" aria-label="Preescuchas de las ocho categorías y dos pruebas">'''+''.join(cards)+'''</section><section class="audio-notes"><h2>De estas grabaciones al mapa</h2><p>Las preescuchas son ejemplos fijos. El recorrido por filas utiliza las mismas muestras para cambiar notas, modo y ritmo según el color. Los animales mantienen sus llamadas naturales y la percusión industrial mantiene su sonido sin afinación melódica. El latido tiene un control de presencia independiente.</p><p>Las imágenes de todas las categorías representan anomalías de temperatura. Son mapas temáticos con interpretación sonora, no mediciones de estos ocho impactos.</p><p>Fuentes instrumentales: <a href="https://github.com/sgossner/VSCO-2-CE">VSCO 2 CE</a> y <a href="https://github.com/sgossner/VCSL">VCSL</a>, CC0. Animales: <a href="https://lasonotheque.org/licences.html">LaSonotheque / Joseph Sardin</a>, CC0. Voces: <a href="https://freesound.org/people/ShangusBurger/sounds/764230/">Shane Vincent y participantes de GameSoundCon 2024</a>, CC0. Latido: <a href="https://commons.wikimedia.org/wiki/File:Human_heart_beating_at_61_bpm_(Cc-by-3.0).ogg">Benboncan / Natural Philo</a>, <a href="https://creativecommons.org/licenses/by/3.0/">CC BY 3.0</a>; recortado y tratado por PulsoTerra.</p></section></main><script>function pauseAll(){document.querySelectorAll('audio').forEach(a=>a.pause());}document.getElementById('pauseAllSounds').addEventListener('click',pauseAll);document.addEventListener('keydown',event=>{if(event.key==='Escape')pauseAll();});document.querySelectorAll('audio').forEach(a=>a.addEventListener('play',()=>document.querySelectorAll('audio').forEach(b=>{if(a!==b)b.pause();})));document.addEventListener('visibilitychange',()=>{if(document.hidden)document.querySelectorAll('audio').forEach(a=>a.pause());});</script></body></html>'''
doc=doc.replace('Estos ejemplos permiten comparar la selección de sonidos sin el recorrido del mapa ni el latido de fondo. Las referencias musicales orientan el carácter y la instrumentación; los motivos son originales.', 'Estas preescuchas se generan con el mismo motor del mapa. En seis temas la anomalía de prueba avanza de 0 a +2 °C, desde consonancia hasta tensión. Biodiversidad muestra variedad y un extremo por separado; Economía conserva su marcha. Los temas se escuchan sin latido de fondo.')
doc=doc.replace('Las preescuchas son ejemplos fijos. El recorrido por filas utiliza las mismas muestras para cambiar notas, modo y ritmo según el color.', 'Los ejemplos usan valores locales de prueba, no escenarios globales ni impactos calculados. El recorrido por filas utiliza el mismo motor para cambiar notas, modo, ritmo y tensión según el color. Las preescuchas están normalizadas en conjunto por archivo para facilitar la comparación de timbres; el mapa conserva su mezcla con el latido.')
doc=doc.replace('</section></main>', '<p>Violín con sordina: Rena Ishii / Ivica Ico Bukvic, copyright 2005, bajo el texto original Artistic License 2.0beta4 incluido. <a href="assets/audio/sordino-source.zip" download>Descargar fuente completa, licencia y cambios</a>. Los derivados de esta grabación, incluida la mezcla de Bosques, conservan esa licencia.</p></section></main>')
doc=doc.replace('<link rel="stylesheet" href="styles.css">','<link rel="stylesheet" href="styles.css"><link rel="stylesheet" href="alien-theme.css"><link rel="stylesheet" href="accessibility.css">')
doc=doc.replace('</head>','<script src="i18n-content.js"></script><script src="i18n-gallery.js"></script><script src="i18n-app.js"></script><script src="accessibility-content.js"></script><script src="i18n.js"></script><script src="font-preference.js"></script><script src="accessibility-preferences.js"></script></head>')
font_button='<button class="font-preference" type="button" data-font-preference aria-pressed="false" title="Usar OpenDyslexic"><span data-font-mark aria-hidden="true">Aa</span> Tipografía para dislexia</button>'
font_button='<details class="accessibility-options"><summary>Accesibilidad</summary><div class="accessibility-menu">'+font_button+'<button type="button" data-high-contrast aria-pressed="false">Alto contraste</button><button type="button" data-large-text aria-pressed="false">Texto grande</button></div></details>'
back_link='<a href="index.html" class="text-button">Volver al mapa ↗</a>'
language_switch='<label class="language-switch"><span class="sr-only">Idioma</span><select data-language-select aria-label="Idioma"><option value="en">English</option><option value="es">Español</option></select></label>'
doc=doc.replace(back_link,'<div class="header-right">'+language_switch+font_button+back_link+'</div>')
(DIST/'sonidos.html').write_text(doc,encoding='utf-8')
offline=doc.replace('<link rel="stylesheet" href="styles.css">','<style>'+style+CSS+'</style>')
offline=offline.replace('<link rel="stylesheet" href="alien-theme.css">','<style>'+(DIST/'alien-theme.css').read_text(encoding='utf-8')+'</style>')
offline=offline.replace('<script src="font-preference.js"></script>','<script>'+(DIST/'font-preference.js').read_text(encoding='utf-8')+'</script>')
offline=offline.replace('<link rel="stylesheet" href="accessibility.css">','<style>'+(DIST/'accessibility.css').read_text(encoding='utf-8')+'</style>')
for script in ['i18n-content.js','i18n-gallery.js','i18n-app.js','accessibility-content.js','i18n.js','accessibility-preferences.js']:
    offline=offline.replace('<script src="'+script+'"></script>','<script>'+(DIST/script).read_text(encoding='utf-8').replace('</script','<\\/script')+'</script>')
for font in (DIST/'assets/fonts/opendyslexic').glob('*.woff'):
    offline=offline.replace('assets/fonts/opendyslexic/'+font.name,'data:font/woff;base64,'+base64.b64encode(font.read_bytes()).decode())
for key,info in BANK['previews'].items():
    offline=offline.replace(info['url'],'data:audio/mpeg;base64,'+base64.b64encode((DIST/info['url']).read_bytes()).decode())
offline=offline.replace('href="index.html"','href="PulsoTerra-sin-internet.html"')
offline=offline.replace('href="assets/audio/Pulso-Tierra-sonidos.zip"','href="PulsoTerra-sonidos.zip"')
offline=offline.replace('href="assets/audio/CREDITOS.txt"','href="sound-research/CATALOGO_Y_LICENCIAS.txt"')
(ROOT/'Escuchar-sonidos-PulsoTerra.html').write_text(offline,encoding='utf-8')
credits=ROOT/'sound-research/CATALOGO_Y_LICENCIAS.txt'
if credits.exists():
    with zipfile.ZipFile(ROOT/'PulsoTerra-sonidos.zip','w',zipfile.ZIP_DEFLATED) as z:
        for info in BANK['previews'].values(): z.write(DIST/info['url'],'preescuchas/'+pathlib.Path(info['url']).name)
        z.write(credits,'CATALOGO_Y_LICENCIAS.txt')
        z.write(DIST/'assets/audio/licencias.json','licencias.json')
        if (DIST/'assets/audio/sordino-source.zip').exists(): z.write(DIST/'assets/audio/sordino-source.zip','fuentes/sordino-source.zip')
    (DIST/'assets/audio/Pulso-Tierra-sonidos.zip').write_bytes((ROOT/'PulsoTerra-sonidos.zip').read_bytes())
print('Catálogo: 10 preescuchas; público y autónomo sin conexión.')
