(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var data = window.NASA_DATA;
  var categories = window.PixelAnalysis && window.PixelAnalysis.CATEGORIES;
  var engine;
  var frames = [];
  var models = new Map();
  var pictures = new Map();
  var state = { mode: 'explore', selected: null, ready: false, playing: false, duration: 18, progress: 0, col: -1, row: -1, scan: -1, start: 0, token: 0, lastColumn: -1 };
  var animation = 0;
  var timer = 0;
  var motifStop = null;
  var lastDrag = 0;
  var dragging = false;
  var overlay = $('mapOverlay');
  var ctx = overlay.getContext('2d');
  var currentImage = $('mapImage');
  var noteNames = ['Do3', 'Sol3', 'Do4', 'Mi4', 'Do5'];

  function message(text) { $('status').textContent = text; }
  function error(text) { $('errorMessage').textContent = text; $('errorMessage').hidden = false; }
  function time(seconds) { return '00:' + String(Math.max(0, Math.round(seconds))).padStart(2, '0'); }
  function selectedFrame() { return frames.find(function (f) { return f.id === state.selected; }); }
  function model() { return models.get(state.selected); }
  function sourceImage(frame) { return frame.imageDataUrl || frame.dataUrl || frame.image; }
  function updateProgress(value) {
    state.progress = Math.max(0, Math.min(1, value));
    $('progressBar').style.width = state.progress * 100 + '%';
    $('timeReadout').textContent = time(state.duration * state.progress) + ' / ' + time(state.duration);
  }
  function updatePlay() {
    $('playButton').disabled = !state.ready;
    $('playButton').classList.toggle('playing', state.playing);
    $('playIcon').textContent = state.playing ? 'Ⅱ' : '▶';
    $('playLabel').textContent = state.playing ? 'Pausar' : state.mode === 'explore' ? 'Escuchar mapa' : 'Escuchar comparación';
    $('liveBadge').hidden = !state.playing;
    $('mapHint').hidden = state.playing || state.mode === 'compare';
  }
  function stop(reset) {
    state.token++;
    cancelAnimationFrame(animation);
    clearTimeout(timer);
    if (motifStop) { motifStop(); motifStop = null; }
    if (engine) engine.stop();
    state.playing = false;
    state.scan = -1;
    if (reset) { state.col = -1; state.row = -1; state.lastColumn = -1; updateProgress(0); }
    updatePlay();
    drawOverlay();
  }
  function drawOverlay() {
    var w = overlay.width, h = overlay.height, m = model();
    ctx.clearRect(0, 0, w, h);
    if (!m) return;
    if (state.scan >= 0) {
      var x = state.scan * w;
      var grad = ctx.createLinearGradient(Math.max(0, x - w * .05), 0, x, 0);
      grad.addColorStop(0, 'rgba(232,244,216,0)'); grad.addColorStop(1, 'rgba(232,244,216,.19)');
      ctx.fillStyle = grad; ctx.fillRect(x - w * .05, 0, w * .05, h);
      ctx.strokeStyle = '#eff8df'; ctx.lineWidth = Math.max(1.5, w / 500);
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
      [3,6,9,12].forEach(function (row) {
        var c = m.cells[row * m.columns + Math.min(m.columns - 1, Math.floor(state.scan * m.columns))];
        if (!c || c.category < 0) return;
        ctx.fillStyle = categories[c.category].color;
        ctx.beginPath(); ctx.arc(x, (row + .5) / m.rows * h, w / 180, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#fff'; ctx.lineWidth = w / 800; ctx.stroke();
      });
    }
    if (state.col >= 0 && state.row >= 0 && state.scan < 0) {
      var cw = w / m.columns, ch = h / m.rows;
      ctx.fillStyle = 'rgba(255,255,255,.16)';
      ctx.fillRect(state.col * cw, state.row * ch, cw, ch);
      ctx.strokeStyle = '#f5f2d9'; ctx.lineWidth = Math.max(2, w / 500);
      ctx.strokeRect(state.col * cw + 1, state.row * ch + 1, cw - 2, ch - 2);
    }
  }
  function distribution(m) {
    var bar = $('distributionBar'); bar.replaceChildren();
    m.histogram.forEach(function (part, i) {
      var seg = document.createElement('span'); seg.style.width = part * 100 + '%'; seg.style.background = categories[i].color;
      seg.title = categories[i].label + ': ' + Math.round(part * 100) + ' %'; bar.append(seg);
    });
    var cold = m.histogram[0] + m.histogram[1], warm = m.histogram[3] + m.histogram[4];
    $('distributionText').textContent = Math.round(cold * 100) + ' % tonos fríos · ' + Math.round(m.histogram[2] * 100) + ' % cerca de referencia · ' + Math.round(warm * 100) + ' % tonos cálidos. Proporciones de píxeles válidos.';
    $('pixelCount').textContent = Math.round(m.validCount / 1000) + ' mil píxeles';
  }
  function selectFrame(id, keepPlaying) {
    if (!keepPlaying) { stop(true); message('Mapa listo para escuchar'); }
    state.selected = id;
    var f = selectedFrame(), img = pictures.get(id);
    currentImage.src = sourceImage(f);
    currentImage.alt = 'Imagen NASA de anomalías de temperatura, fotograma ' + f.label + ', promedio móvil de 24 meses';
    $('mapYear').textContent = f.label;
    $('mapStage').style.aspectRatio = img.naturalWidth + ' / ' + img.naturalHeight;
    overlay.width = img.naturalWidth; overlay.height = img.naturalHeight;
    $('mapStage').setAttribute('aria-label', 'Mapa de ' + f.label + '. Flechas para explorar; Enter para escuchar una celda.');
    document.querySelectorAll('.frame-button').forEach(function (b) { b.classList.toggle('selected', b.dataset.id === id); b.setAttribute('aria-pressed', String(b.dataset.id === id)); var l = b.querySelector('.frame-state'); l.textContent = b.dataset.id === id ? 'Seleccionada' : 'Escuchar'; });
    distribution(model());
    if (!keepPlaying) $('cellReadout').textContent = 'Selecciona una zona del mapa';
    drawOverlay();
  }
  function cellReadout(cell) {
    if (!cell || cell.category < 0) { $('cellReadout').textContent = 'Zona sin píxeles válidos · silencio'; return; }
    $('cellReadout').textContent = categories[cell.category].label + ' · ' + noteNames[cell.category];
  }
  async function listenCell() {
    if (!state.ready || state.mode !== 'explore') return;
    var m = model(), c = m.cells[state.row * m.columns + state.col];
    if (state.playing) stop(false);
    var requestedToken = state.token;
    try {
      await engine.unlock();
      if (requestedToken !== state.token || state.mode !== 'explore') return;
      if (c && c.category >= 0) engine.playCell(c.category, state.col / (m.columns - 1) * 1.4 - .7, .28, .7);
      cellReadout(c); message(c && c.category >= 0 ? 'Escuchando la zona seleccionada' : 'Zona sin datos sonoros');
    } catch (e) { error('No se pudo activar el audio. Revisa los permisos de sonido de este navegador.'); }
  }
  function movePointer(event) {
    if (!state.ready || state.mode !== 'explore' || (state.playing && !dragging)) return;
    var rect = $('mapStage').getBoundingClientRect(), m = model();
    state.col = Math.max(0, Math.min(m.columns - 1, Math.floor((event.clientX - rect.left) / rect.width * m.columns)));
    state.row = Math.max(0, Math.min(m.rows - 1, Math.floor((event.clientY - rect.top) / rect.height * m.rows)));
    cellReadout(m.cells[state.row * m.columns + state.col]); drawOverlay();
  }
  function playScan() {
    if (state.progress >= .999) updateProgress(0);
    var from = state.progress, start = performance.now(), token = state.token;
    state.lastColumn = -1;
    state.start = start;
    function tick(now) {
      if (!state.playing || token !== state.token) return;
      var progress = from + (now - start) / (state.duration * 1000);
      if (progress >= 1) { stop(false); updateProgress(1); message('Recorrido terminado'); return; }
      updateProgress(progress); state.scan = progress;
      var m = model(), col = Math.min(m.columns - 1, Math.floor(progress * m.columns));
      if (col !== state.lastColumn) {
        state.lastColumn = col;
        var sounding = [];
        [3,6,9,12].forEach(function (row, i) {
          var c = m.cells[row * m.columns + col];
          if (c && c.category >= 0) {
            engine.playCell(c.category, (col / (m.columns - 1) - .5) * 1.3, Math.max(.16, state.duration / m.columns * .8), .26);
            sounding.push(c.category);
          }
        });
        $('cellReadout').textContent = 'Columna ' + (col + 1) + ' de ' + m.columns + ' · ' + (sounding.length ? sounding.length + ' zonas sonoras' : 'sin píxeles válidos');
      }
      drawOverlay(); animation = requestAnimationFrame(tick);
    }
    message('Explorando el espacio del mapa'); animation = requestAnimationFrame(tick);
  }
  function playComparison() {
    var token = state.token, started = performance.now(), each = state.duration / frames.length;
    updateProgress(0);
    function progressTick(now) {
      if (!state.playing || token !== state.token) return;
      updateProgress((now - started) / (state.duration * 1000));
      animation = requestAnimationFrame(progressTick);
    }
    function next(index) {
      if (!state.playing || token !== state.token) return;
      if (index >= frames.length) { stop(false); updateProgress(1); message('Comparación terminada'); $('cellReadout').textContent = 'Cinco fechas · una misma escala sonora'; return; }
      selectFrame(frames[index].id, true);
      message('Comparando ' + (index + 1) + ' de ' + frames.length + ' · ' + frames[index].label);
      motifStop = engine.playMotif(model().histogram, { duration: each, onStep: function (step, category) {
        if (!state.playing || token !== state.token) return;
        $('cellReadout').textContent = categories[category].label + ' · ' + noteNames[category] + ' · nota ' + (step + 1) + '/16';
      }, onEnd: function () { next(index + 1); } });
    }
    animation = requestAnimationFrame(progressTick); next(0);
  }
  async function play() {
    if (!state.ready) return;
    if (state.playing) { stop(false); message(state.mode === 'explore' ? 'En pausa · continúa el recorrido' : 'En pausa · al reproducir empieza la comparación'); return; }
    var requestedToken = state.token;
    try {
      await engine.unlock();
      if (requestedToken !== state.token) return;
      state.playing = true; state.token++; updatePlay();
      if (state.mode === 'explore') playScan(); else playComparison();
    } catch (e) { stop(false); error('No se pudo iniciar el sonido. Pulsa de nuevo Escuchar y comprueba el volumen del dispositivo.'); }
  }
  function setMode(mode) {
    stop(true); state.mode = mode;
    document.querySelector('.step-mark').textContent = mode === 'explore' ? '01 / 02' : '02 / 02';
    $('exploreMode').classList.toggle('active', mode === 'explore'); $('exploreMode').setAttribute('aria-pressed', String(mode === 'explore'));
    $('compareMode').classList.toggle('active', mode === 'compare'); $('compareMode').setAttribute('aria-pressed', String(mode === 'compare'));
    $('modeDescription').textContent = mode === 'explore' ? 'Una barra recorre el mapa de izquierda a derecha. Las zonas frías suenan graves y las cálidas, agudas.' : 'Escucha las cinco fechas en orden. Cada imagen genera un motivo según sus proporciones de colores.';
    $('timelineHelp').textContent = mode === 'explore' ? 'Selecciona una imagen para explorarla.' : 'La reproducción recorre todas las fechas, de 1900 a 2023.';
    $('exportButton').hidden = mode !== 'compare';
    $('mapHint').hidden = mode !== 'explore';
    $('cellReadout').textContent = mode === 'explore' ? 'Selecciona una zona del mapa' : 'Una composición por imagen · orden cronológico';
    updatePlay(); message('Modo ' + (mode === 'explore' ? 'exploración espacial' : 'comparación entre fechas'));
  }
  function renderFrames() {
    var parent = $('timeline'); parent.replaceChildren();
    frames.forEach(function (f) {
      var b = document.createElement('button'); b.className = 'frame-button'; b.dataset.id = f.id;
      b.setAttribute('aria-label', 'Seleccionar mapa de ' + f.label); b.setAttribute('aria-pressed', 'false');
      var image = document.createElement('img'); image.src = sourceImage(f); image.className = 'frame-thumb'; image.alt = ''; image.loading = 'lazy';
      var row = document.createElement('span'); row.className = 'frame-label-row';
      var label = document.createElement('strong'); label.textContent = f.label;
      var desc = document.createElement('span'); desc.className = 'frame-state'; desc.textContent = 'Escuchar'; row.append(label, desc);
      b.append(image, row); b.addEventListener('click', function () { selectFrame(f.id, false); }); parent.append(b);
    });
  }
  function renderLegend() {
    categories.forEach(function (c, i) {
      var b = document.createElement('button'); b.title = c.label + ' · ' + c.range + ' aproximados · ' + noteNames[i];
      b.setAttribute('aria-label', 'Escuchar ' + c.label + ', ' + noteNames[i]);
      var swatch = document.createElement('span'); swatch.className = 'legend-swatch'; swatch.style.background = c.color;
      var label = document.createElement('span'); label.textContent = noteNames[i]; b.append(swatch, label);
      b.addEventListener('click', async function () {
        stop(false);
        var requestedToken = state.token;
        try { await engine.unlock(); if (requestedToken !== state.token) return; engine.playLegend(i); $('cellReadout').textContent = c.label + ' · ' + noteNames[i]; message('Leyenda sonora · ' + c.shortLabel); }
        catch (e) { error('El navegador no permitió activar el audio.'); }
      }); $('legend').append(b);
    });
  }
  async function boot() {
    if (!data || !Array.isArray(data.frames) || !data.frames.length || !window.PixelAnalysis || !window.SonificationEngine) throw new Error('No se encontraron los mapas o los componentes de audio. Abre el archivo completo de la app.');
    frames = data.frames.slice();
    engine = new window.SonificationEngine(); engine.setVolume(.45); engine.setTimbre('triangle');
    window.PixelAnalysis.configurePalette(data.palette);
    renderLegend(); renderFrames();
    for (var i = 0; i < frames.length; i++) {
      var f = frames[i];
      message('Analizando imagen ' + (i + 1) + ' de ' + frames.length);
      var img = await new Promise(function (resolve, reject) { var image = new Image(); image.onload = function () { resolve(image); }; image.onerror = function () { reject(new Error('No se pudo cargar una imagen NASA.')); }; image.src = sourceImage(f); });
      pictures.set(f.id, img);
      var canvas = document.createElement('canvas'); canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
      var imageContext = canvas.getContext('2d', { willReadFrequently: true }); imageContext.drawImage(img, 0, 0);
      var analyzed = window.PixelAnalysis.processImageData(imageContext.getImageData(0, 0, canvas.width, canvas.height), { columns: 32, rows: 16 });
      if (!analyzed.validCount) throw new Error('La imagen no contiene colores válidos con la paleta configurada.');
      models.set(f.id, analyzed);
      await new Promise(function (resolve) { setTimeout(resolve, 0); });
    }
    state.ready = true; $('loading').hidden = true; selectFrame(frames[frames.length - 1].id, false); updatePlay();
    // Read-only diagnostic state supports reproducible verification of the image pipeline.
    window.PulsoTierra = { frames: frames.map(function (f) { return { id: f.id, label: f.label }; }), getAnalysis: function (id) { return models.get(id); }, getState: function () { return Object.assign({}, state); } };
  }
  $('playButton').addEventListener('click', play);
  $('resetButton').addEventListener('click', function () { stop(true); message('Recorrido reiniciado'); $('cellReadout').textContent = 'Selecciona una zona del mapa'; });
  $('exploreMode').addEventListener('click', function () { if (state.ready) setMode('explore'); });
  $('compareMode').addEventListener('click', function () { if (state.ready) setMode('compare'); });
  $('duration').addEventListener('input', function () { stop(true); state.duration = Number(this.value); $('durationOutput').textContent = this.value + ' s'; updateProgress(0); message('Duración actualizada'); });
  $('volume').addEventListener('input', function () { $('volumeOutput').textContent = this.value + ' %'; if (engine) engine.setVolume(Number(this.value) / 100); });
  $('timbre').addEventListener('change', function () { if (engine) engine.setTimbre(this.value); });
  $('mapStage').addEventListener('pointermove', function (event) { movePointer(event); if (dragging && performance.now() - lastDrag > 110) { lastDrag = performance.now(); listenCell(); } });
  $('mapStage').addEventListener('pointerdown', function (event) { if (state.mode !== 'explore') return; if (state.playing) stop(false); dragging = true; movePointer(event); this.setPointerCapture(event.pointerId); listenCell(); });
  $('mapStage').addEventListener('pointerup', function () { dragging = false; });
  $('mapStage').addEventListener('pointercancel', function () { dragging = false; });
  $('mapStage').addEventListener('keydown', function (event) {
    if (!state.ready || state.mode !== 'explore') return;
    var m = model(); if (!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Enter',' '].includes(event.key)) return;
    event.preventDefault(); if (state.playing) stop(false);
    if (state.col < 0) state.col = 15; if (state.row < 0) state.row = 7;
    if (event.key === 'ArrowLeft') state.col = Math.max(0, state.col - 1);
    if (event.key === 'ArrowRight') state.col = Math.min(m.columns - 1, state.col + 1);
    if (event.key === 'ArrowUp') state.row = Math.max(0, state.row - 1);
    if (event.key === 'ArrowDown') state.row = Math.min(m.rows - 1, state.row + 1);
    cellReadout(m.cells[state.row * m.columns + state.col]); drawOverlay();
    if (event.key === 'Enter' || event.key === ' ') listenCell();
  });
  $('exportButton').addEventListener('click', async function () {
    if (!state.ready) return;
    var button = this; stop(false); button.disabled = true; button.textContent = 'Preparando WAV…'; message('Generando audio sin conexión');
    try {
      var blob = await engine.exportWav(frames.map(function (f) { return models.get(f.id).histogram; }), { durationPerFrame: state.duration / frames.length, gap: 0 });
      var url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url; a.download = 'Pulso-Tierra-comparacion-NASA.wav'; a.click(); setTimeout(function () { URL.revokeObjectURL(url); }, 60000); message('Comparación descargada en WAV');
    } catch (e) { error('No se pudo exportar el audio en este navegador. La reproducción sigue disponible.'); }
    finally { button.disabled = false; button.textContent = '↓ Descargar comparación en WAV'; }
  });
  function openInfo() { $('infoDialog').showModal(); }
  $('aboutButton').addEventListener('click', openInfo); $('sourcesButton').addEventListener('click', openInfo);
  $('closeDialog').addEventListener('click', function () { $('infoDialog').close(); });
  $('infoDialog').addEventListener('click', function (event) { if (event.target === this) this.close(); });
  document.addEventListener('visibilitychange', function () { if (document.hidden && state.playing) { stop(false); message('En pausa al salir de la ventana'); } });
  window.addEventListener('pagehide', function () { stop(false); });
  boot().catch(function (e) { message('No se pudo cargar el prototipo'); $('loading').textContent = 'No se pudieron preparar las imágenes'; error(e.message); });
})();
