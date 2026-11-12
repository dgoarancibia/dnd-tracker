/* ═══════════════════════════════════════════════════════
   maps.js — Mapas con anotaciones a mano
   IndexedDB para imágenes · Canvas para dibujo + texto
   Singleton global: Maps
   ═══════════════════════════════════════════════════════ */

const Maps = (() => {

  const DB_NAME    = 'dnd_maps_v1';
  const DB_VERSION = 1;
  const STORE_IMGS = 'images';
  const STORE_MAPS = 'maps';

  let _db          = null;
  let _charId      = null;
  let _maps        = [];
  let _searchQuery = '';

  // Canvas state
  let _activeMap   = null;
  let _canvas      = null;
  let _ctx         = null;
  let _drawing     = false;
  let _currentPath = [];
  let _tool        = 'pen';      // 'pen' | 'eraser' | 'text' | 'move' | 'pin' | 'linea' | 'flecha' | 'circulo'
  let _color       = '#e05c2a';
  let _size        = 4;
  let _fontSize    = 18;
  let _k           = 1;          // píxeles de pantalla por unidad del mapa
  let _annotations = [];         // path {pts} · text {x,y,text} · shape {forma,x1,y1,x2,y2} · pin {x,y,titulo,nota}

  // ── IndexedDB ──────────────────────────────────────────

  function _openDB() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = e => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(STORE_IMGS)) db.createObjectStore(STORE_IMGS, { keyPath: 'id' });
        if (!db.objectStoreNames.contains(STORE_MAPS)) db.createObjectStore(STORE_MAPS, { keyPath: 'id' });
      };
      req.onsuccess = e => { _db = e.target.result; resolve(); };
      req.onerror   = e => reject(e.target.error);
    });
  }

  function _dbPut(store, obj) {
    return new Promise((resolve, reject) => {
      const tx = _db.transaction(store, 'readwrite');
      tx.objectStore(store).put(obj).onsuccess = () => resolve();
      tx.onerror = e => reject(e.target.error);
    });
  }
  function _dbGet(store, key) {
    return new Promise((resolve, reject) => {
      const tx = _db.transaction(store, 'readonly');
      const req = tx.objectStore(store).get(key);
      req.onsuccess = e => resolve(e.target.result);
      req.onerror   = e => reject(e.target.error);
    });
  }
  function _dbGetAll(store) {
    return new Promise((resolve, reject) => {
      const tx = _db.transaction(store, 'readonly');
      const req = tx.objectStore(store).getAll();
      req.onsuccess = e => resolve(e.target.result);
      req.onerror   = e => reject(e.target.error);
    });
  }
  function _dbDelete(store, key) {
    return new Promise((resolve, reject) => {
      const tx = _db.transaction(store, 'readwrite');
      tx.objectStore(store).delete(key).onsuccess = () => resolve();
      tx.onerror = e => reject(e.target.error);
    });
  }

  // ── Init ──────────────────────────────────────────────

  async function init(charId) {
    _charId = charId;
    if (!_db) await _openDB();
    await _loadMaps();
    renderList();
    sincronizar();
  }

  async function _loadMaps() {
    const all = await _dbGetAll(STORE_MAPS);
    _maps = all.filter(m => m.charId === _charId)
               .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  }

  // ── Buscador ──────────────────────────────────────────

  function onSearch(val) {
    _searchQuery = val.trim().toLowerCase();
    renderList();
  }

  // ── Renderizar lista ──────────────────────────────────

  function renderList() {
    const container = document.getElementById('mapsListContainer');
    if (!container) return;

    const filtered = _searchQuery
      ? _maps.filter(m => m.name.toLowerCase().includes(_searchQuery))
      : _maps;

    if (_maps.length === 0) {
      container.innerHTML = `<div class="maps-empty">Sube tu primer mapa con el botón +</div>`;
      return;
    }
    if (filtered.length === 0) {
      container.innerHTML = `<div class="maps-empty">Sin resultados para "${_searchQuery}"</div>`;
      return;
    }

    container.innerHTML = filtered.map(m => `
      <div class="map-card" onclick="Maps.openMap('${m.id}')">
        <div class="map-card-thumb" id="thumb-${m.id}"></div>
        <div class="map-card-info">
          <span class="map-card-name">${m.name}</span>
          <span class="map-card-date">${new Date(m.createdAt).toLocaleDateString('es')}</span>
        </div>
        <button class="map-card-del" onclick="event.stopPropagation();Maps.deleteMap('${m.id}')" title="Eliminar">✕</button>
      </div>
    `).join('');

    filtered.forEach(m => _loadThumb(m));
  }

  async function _loadThumb(map) {
    const el = document.getElementById(`thumb-${map.id}`);
    if (!el) return;
    const imgRec = await _dbGet(STORE_IMGS, map.imgId);
    if (!imgRec) return;
    const url = URL.createObjectURL(imgRec.blob);
    el.style.backgroundImage    = `url(${url})`;
    el.style.backgroundSize     = 'cover';
    el.style.backgroundPosition = 'center';
  }

  // ── Agregar / Eliminar ────────────────────────────────

  function triggerAddMap() {
    document.getElementById('mapFileInput')?.click();
  }

  function triggerCamera() {
    document.getElementById('mapCameraInput')?.click();
  }

  async function handleFileSelect(input) {
    const file = input.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { alert('Solo se admiten imágenes'); return; }
    if (file.size > 20 * 1024 * 1024)   { alert('Imagen demasiado grande (máx 20 MB)'); return; }

    const name  = prompt('Nombre del mapa:', file.name.replace(/\.[^.]+$/, '')) || file.name;
    const id    = 'map-' + Date.now();
    const imgId = 'img-' + Date.now();

    await _dbPut(STORE_IMGS, { id: imgId, blob: file });
    const nuevo = { id, charId: _charId, name, imgId, annotations: [], lienzo: LIENZO, createdAt: new Date().toISOString() };
    await _dbPut(STORE_MAPS, nuevo);

    input.value = '';
    await _loadMaps();
    renderList();
    _subir(nuevo).then(() => _loadMaps());
  }

  async function deleteMap(id) {
    const m = _maps.find(x => x.id === id);
    if (!m) return;
    if (!confirm(`Eliminar "${m.name}"?`)) return;
    await _dbDelete(STORE_MAPS, id);
    await _dbDelete(STORE_IMGS, m.imgId);
    // Con sesión se borra también en la nube (si no hay conexión, queda pendiente)
    if (m.enNube || _uid()) { _pendientesBorrar(p => p.concat([{ id, trozos: m.trozos || 0 }])); _borrarPendientes(); }
    await _loadMaps();
    renderList();
  }

  // ── Abrir canvas ──────────────────────────────────────

  async function openMap(id) {
    const m = _maps.find(x => x.id === id);
    if (!m) return;
    _activeMap   = m;
    // Soporte retrocompatible: paths antiguo → annotations nuevo
    _annotations = (m.annotations || m.paths || []).map(a => ({ ...a, pts: a.pts ? [...a.pts] : undefined }));

    const imgRec = await _dbGet(STORE_IMGS, m.imgId);
    if (!imgRec) return;
    const imgUrl = URL.createObjectURL(imgRec.blob);

    document.getElementById('mapCanvasOverlay').classList.add('show');
    document.getElementById('mapCanvasTitle').textContent = m.name;

    // Resetear UI de herramientas
    setTool('pen');
    _iniciarHistorial();
    _estadoGuardado('Guardado');

    requestAnimationFrame(() => _initCanvas(imgUrl));
  }

  function closeMap() {
    document.getElementById('mapTextInput')?.blur();
    document.getElementById('mapPinPanel')?.remove();
    if (_timerGuardar) saveAnnotations();   // que no se pierda lo último
    document.getElementById('mapCanvasOverlay').classList.remove('show');
    _activeMap = null;
    _drawing   = false;
    _pinching  = false;
    resetZoom(); // que no quede escalado al abrir el próximo mapa
    _removeCanvasEvents();
  }

  // ── Canvas ────────────────────────────────────────────

  function _initCanvas(imgUrl) {
    _canvas = document.getElementById('mapCanvas');
    _ctx    = _canvas.getContext('2d');
    _removeCanvasEvents();

    const img = new Image();
    img.onload = () => {
      const wrap   = _canvas.parentElement;
      const scaleW = wrap.clientWidth  / img.naturalWidth;
      const scaleH = wrap.clientHeight / img.naturalHeight;
      const scale  = Math.min(scaleW, scaleH, 1);
      _canvas.width  = Math.round(img.naturalWidth  * scale);
      _canvas.height = Math.round(img.naturalHeight * scale);
      _canvas._img   = img;
      // Las anotaciones están en el espacio del mapa (`lienzo` de ancho), no en
      // píxeles de esta pantalla: así calzan en el iPad, el computador y con la
      // imagen comprimida de la nube. Mapas viejos: su lienzo es esta pantalla.
      if (!_activeMap.lienzo) _activeMap.lienzo = _canvas.width;
      _k = _canvas.width / _activeMap.lienzo;
      _redraw();
      _attachCanvasEvents();
    };
    img.src = imgUrl;
  }

  function _redraw(extra) {
    if (!_ctx || !_canvas._img) return;
    _ctx.clearRect(0, 0, _canvas.width, _canvas.height);
    _ctx.drawImage(_canvas._img, 0, 0, _canvas.width, _canvas.height);
    _ctx.save();
    _ctx.setTransform(_k, 0, 0, _k, 0, 0);
    _annotations.forEach(_drawAnotacion);
    if (extra) _drawAnotacion(extra);   // vista previa del trazo o forma en curso
    _ctx.restore();
  }

  function _drawAnotacion(a) {
    if (a.type === 'text') _drawText(a);
    else if (a.type === 'shape') _drawShape(a);
    else if (a.type === 'pin') _drawPin(a);
    else _drawPath(a);
  }

  function _drawPath(p) {
    if (!p.pts || p.pts.length < 2 || p.tool === 'eraser') return;   // los trazos de goma viejos ya no pintan
    _ctx.save();
    _ctx.strokeStyle = p.color || '#e05c2a';
    _ctx.lineWidth = p.size || 4;
    _ctx.lineCap   = 'round';
    _ctx.lineJoin  = 'round';
    _ctx.beginPath();
    _ctx.moveTo(p.pts[0], p.pts[1]);
    if (p.pts.length === 2) _ctx.lineTo(p.pts[0] + 0.01, p.pts[1]);   // un punto suelto también se ve
    for (let i = 2; i < p.pts.length; i += 2) _ctx.lineTo(p.pts[i], p.pts[i + 1]);
    _ctx.stroke();
    _ctx.restore();
  }

  function _drawText(t) {
    _ctx.save();
    _ctx.font         = `bold ${t.size || 18}px 'Jost', sans-serif`;
    _ctx.fillStyle    = t.color || '#f0c040';
    _ctx.strokeStyle  = 'rgba(0,0,0,0.7)';
    _ctx.lineWidth    = 3;
    _ctx.strokeText(t.text, t.x, t.y);
    _ctx.fillText(t.text, t.x, t.y);
    _ctx.restore();
  }

  // Línea, flecha y círculo
  function _drawShape(s) {
    _ctx.save();
    _ctx.strokeStyle = s.color || '#e05c2a';
    _ctx.fillStyle   = s.color || '#e05c2a';
    _ctx.lineWidth   = s.size || 4;
    _ctx.lineCap     = 'round';
    _ctx.lineJoin    = 'round';
    _ctx.beginPath();
    if (s.forma === 'circulo') {
      _ctx.arc(s.x1, s.y1, Math.hypot(s.x2 - s.x1, s.y2 - s.y1), 0, Math.PI * 2);
      _ctx.stroke();
    } else {
      _ctx.moveTo(s.x1, s.y1);
      _ctx.lineTo(s.x2, s.y2);
      _ctx.stroke();
      if (s.forma === 'flecha') {
        const ang = Math.atan2(s.y2 - s.y1, s.x2 - s.x1);
        const largo = Math.max(12, (s.size || 4) * 3.5);
        _ctx.beginPath();
        _ctx.moveTo(s.x2, s.y2);
        _ctx.lineTo(s.x2 - largo * Math.cos(ang - 0.45), s.y2 - largo * Math.sin(ang - 0.45));
        _ctx.lineTo(s.x2 - largo * Math.cos(ang + 0.45), s.y2 - largo * Math.sin(ang + 0.45));
        _ctx.closePath();
        _ctx.fill();
      }
    }
    _ctx.restore();
  }

  // Pin: gota con borde blanco y el título al lado
  const PIN_R = 11;
  function _drawPin(p) {
    _ctx.save();
    _ctx.fillStyle = p.color || '#e05c2a';
    _ctx.strokeStyle = '#fff';
    _ctx.lineWidth = 2.5;
    _ctx.beginPath();
    _ctx.moveTo(p.x, p.y);
    _ctx.bezierCurveTo(p.x - PIN_R * 1.3, p.y - PIN_R * 1.4, p.x - PIN_R, p.y - PIN_R * 2.6, p.x, p.y - PIN_R * 2.6);
    _ctx.bezierCurveTo(p.x + PIN_R, p.y - PIN_R * 2.6, p.x + PIN_R * 1.3, p.y - PIN_R * 1.4, p.x, p.y);
    _ctx.fill();
    _ctx.stroke();
    _ctx.fillStyle = '#fff';
    _ctx.beginPath();
    _ctx.arc(p.x, p.y - PIN_R * 1.75, 3.5, 0, Math.PI * 2);
    _ctx.fill();
    if (p.titulo) {
      _ctx.font = "bold 14px 'Jost', sans-serif";
      _ctx.strokeStyle = 'rgba(0,0,0,0.75)';
      _ctx.lineWidth = 3;
      _ctx.fillStyle = '#fff';
      _ctx.strokeText(p.titulo, p.x + PIN_R + 3, p.y - PIN_R * 1.5);
      _ctx.fillText(p.titulo, p.x + PIN_R + 3, p.y - PIN_R * 1.5);
    }
    _ctx.restore();
  }

  // ── Eventos canvas ────────────────────────────────────

  function _attachCanvasEvents() {
    _canvas.addEventListener('pointerdown',   _onDown,   { passive: false });
    _canvas.addEventListener('pointermove',   _onMove,   { passive: false });
    _canvas.addEventListener('pointerup',     _onUp,     { passive: false });
    _canvas.addEventListener('pointercancel', _onUp,     { passive: false });
    // Zoom con pellizco (2 dedos) — se escucha en el contenedor para poder
    // hacer pinch aunque los dedos caigan fuera del canvas.
    const wrap = _canvas.parentElement;
    if (wrap) {
      wrap.addEventListener('touchstart', _onTouchStart, { passive: false });
      wrap.addEventListener('touchmove',  _onTouchMove,  { passive: false });
      wrap.addEventListener('touchend',   _onTouchEnd,   { passive: false });
    }
  }

  function _removeCanvasEvents() {
    if (!_canvas) return;
    _canvas.removeEventListener('pointerdown',   _onDown);
    _canvas.removeEventListener('pointermove',   _onMove);
    _canvas.removeEventListener('pointerup',     _onUp);
    _canvas.removeEventListener('pointercancel', _onUp);
    const wrap = _canvas.parentElement;
    if (wrap) {
      wrap.removeEventListener('touchstart', _onTouchStart);
      wrap.removeEventListener('touchmove',  _onTouchMove);
      wrap.removeEventListener('touchend',   _onTouchEnd);
    }
  }

  /* ── Zoom con pellizco ──────────────────────────────────────────────────
     Se escala el canvas por CSS (transform), no el bitmap: el dibujo mantiene
     su resolución y _getPos sigue mapeando bien porque usa getBoundingClientRect.
  ── */
  let _zoom = 1, _zoomBase = 1, _pinchDist0 = 0, _pinching = false;

  function _distDedos(t) {
    return Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
  }

  function _aplicarZoom() {
    if (!_canvas) return;
    _canvas.style.transform = `scale(${_zoom})`;
    _canvas.style.transformOrigin = 'center center';
  }

  function _onTouchStart(e) {
    if (e.touches.length !== 2) return;
    e.preventDefault();
    _pinching   = true;
    _drawing    = false;   // cancelar cualquier trazo en curso
    _currentPath = [];
    _forma = null;
    _arrastre = null;
    _pinchDist0 = _distDedos(e.touches);
    _zoomBase   = _zoom;
    _redraw();
  }

  function _onTouchMove(e) {
    if (!_pinching || e.touches.length !== 2) return;
    e.preventDefault();
    const d = _distDedos(e.touches);
    if (_pinchDist0 > 0) {
      _zoom = Math.max(0.5, Math.min(4, _zoomBase * (d / _pinchDist0)));
      _aplicarZoom();
    }
  }

  function _onTouchEnd(e) {
    if (e.touches.length < 2) _pinching = false;
  }

  function resetZoom() {
    _zoom = 1;
    _aplicarZoom();
  }

  function _getPos(e) {
    const rect  = _canvas.getBoundingClientRect();
    const scaleX = _canvas.width  / rect.width;
    const scaleY = _canvas.height / rect.height;
    return [(e.clientX - rect.left) * scaleX / _k, (e.clientY - rect.top) * scaleY / _k];
  }

  // ── Geometría: qué anotación está bajo el dedo ─────────────────────────

  function _distPuntoSegmento(px, py, x1, y1, x2, y2) {
    const dx = x2 - x1, dy = y2 - y1;
    const largo2 = dx * dx + dy * dy;
    if (largo2 === 0) return Math.hypot(px - x1, py - y1);
    let t = ((px - x1) * dx + (py - y1) * dy) / largo2;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
  }

  function _cajaTexto(a) {
    _ctx.save();
    _ctx.font = `bold ${a.size || 18}px 'Jost', sans-serif`;
    const ancho = _ctx.measureText(a.text || '').width;
    _ctx.restore();
    return { x1: a.x, y1: a.y - (a.size || 18), x2: a.x + ancho, y2: a.y + 4 };
  }

  function _anotacionTocada(a, x, y, radio) {
    if (a.type === 'text') {
      const c = _cajaTexto(a);
      return x >= c.x1 - radio && x <= c.x2 + radio && y >= c.y1 - radio && y <= c.y2 + radio;
    }
    if (a.type === 'pin') return Math.hypot(x - a.x, y - (a.y - PIN_R * 1.6)) <= PIN_R * 1.6 + radio;
    if (a.type === 'shape') {
      const tol = radio + (a.size || 4) / 2;
      if (a.forma === 'circulo') return Math.abs(Math.hypot(x - a.x1, y - a.y1) - Math.hypot(a.x2 - a.x1, a.y2 - a.y1)) <= tol;
      return _distPuntoSegmento(x, y, a.x1, a.y1, a.x2, a.y2) <= tol;
    }
    const pts = a.pts || [];
    const tolerancia = radio + (a.size || 4) / 2;
    if (pts.length === 2) return Math.hypot(x - pts[0], y - pts[1]) <= tolerancia;
    for (let i = 0; i + 3 < pts.length; i += 2) {
      if (_distPuntoSegmento(x, y, pts[i], pts[i+1], pts[i+2], pts[i+3]) <= tolerancia) return true;
    }
    return false;
  }

  // La de más arriba (la última dibujada) bajo el punto
  function _anotacionEn(x, y, radio = 10) {
    for (let i = _annotations.length - 1; i >= 0; i--) if (_anotacionTocada(_annotations[i], x, y, radio)) return _annotations[i];
    return null;
  }

  /* ── Goma parcial ───────────────────────────────────────────────────────
     En un trazo a mano borra solo el trozo que toca: el trazo se corta en
     pedazos y se quedan los que están fuera del radio. Textos, pines y
     formas se borran enteros (no tienen "trozos"). */
  function _densificar(pts, paso) {
    const out = [pts[0], pts[1]];
    for (let i = 2; i < pts.length; i += 2) {
      const x0 = out[out.length - 2], y0 = out[out.length - 1], x1 = pts[i], y1 = pts[i + 1];
      const n = Math.floor(Math.hypot(x1 - x0, y1 - y0) / paso);
      for (let k = 1; k < n; k++) out.push(x0 + (x1 - x0) * k / n, y0 + (y1 - y0) * k / n);
      out.push(x1, y1);
    }
    return out;
  }

  function _borrarEn(x, y) {
    const radio = Math.max(8, _size * 2);
    let cambio = false;
    const nuevas = [];
    for (const a of _annotations) {
      if (!_anotacionTocada(a, x, y, radio)) { nuevas.push(a); continue; }
      cambio = true;
      if (a.type !== 'path' || !a.pts || a.pts.length < 4) continue;   // entero
      const tol = radio + (a.size || 4) / 2;
      const pts = _densificar(a.pts, Math.max(2, tol / 3));
      let tramo = [];
      for (let i = 0; i < pts.length; i += 2) {
        if (Math.hypot(pts[i] - x, pts[i + 1] - y) <= tol) {
          if (tramo.length >= 4) nuevas.push({ ...a, pts: tramo });
          tramo = [];
        } else tramo.push(pts[i], pts[i + 1]);
      }
      if (tramo.length >= 4) nuevas.push({ ...a, pts: tramo });
    }
    if (cambio) _annotations = nuevas;
    return cambio;
  }

  function _moverAnotacion(a, dx, dy) {
    if (a.type === 'text' || a.type === 'pin') { a.x += dx; a.y += dy; }
    else if (a.type === 'shape') { a.x1 += dx; a.y1 += dy; a.x2 += dx; a.y2 += dy; }
    else if (a.pts) for (let i = 0; i < a.pts.length; i += 2) { a.pts[i] += dx; a.pts[i + 1] += dy; }
  }

  // ── Puntero ───────────────────────────────────────────

  let _forma = null;      // forma en curso { x1, y1, x2, y2 }
  let _arrastre = null;   // { a, x, y, movio } con la herramienta Mover

  function _onDown(e) {
    e.preventDefault();
    if (_pinching) return;
    _canvas.setPointerCapture(e.pointerId);
    const [x, y] = _getPos(e);

    if (_tool === 'text') {
      // Tocar un texto existente lo edita; tocar vacío crea uno nuevo
      const t = _anotacionEn(x, y, 6);
      if (t && t.type === 'text') _editarTexto(t);
      else _showTextInput(x, y);
      return;
    }
    if (_tool === 'pin') {
      const p = _anotacionEn(x, y, 6);
      if (p && p.type === 'pin') _editarPin(p);
      else _editarPin(null, x, y);
      return;
    }
    if (_tool === 'move') {
      const a = _anotacionEn(x, y, 12);
      _arrastre = a ? { a, x, y, movio: false } : null;
      _drawing = !!a;
      return;
    }
    if (_tool === 'eraser') {
      _drawing = true;
      _borroAlgo = _borrarEn(x, y);
      if (_borroAlgo) _redraw();
      return;
    }
    if (FORMAS.includes(_tool)) {
      _drawing = true;
      _forma = { x1: x, y1: y, x2: x, y2: y };
      return;
    }
    _drawing     = true;
    _currentPath = [x, y];
  }

  let _borroAlgo = false;

  function _onMove(e) {
    e.preventDefault();
    if (!_drawing || _pinching) return;
    const [x, y] = _getPos(e);

    if (_tool === 'move' && _arrastre) {
      const dx = x - _arrastre.x, dy = y - _arrastre.y;
      if (!_arrastre.movio && Math.hypot(dx, dy) < 3) return;
      _arrastre.movio = true;
      _moverAnotacion(_arrastre.a, dx, dy);
      _arrastre.x = x; _arrastre.y = y;
      _redraw();
      return;
    }
    if (_tool === 'eraser') {
      if (_borrarEn(x, y)) { _borroAlgo = true; _redraw(); }
      return;
    }
    if (_forma) {
      _forma.x2 = x; _forma.y2 = y;
      _redraw({ type: 'shape', forma: _tool, ..._forma, color: _color, size: _size });
      return;
    }
    _currentPath.push(x, y);
    _redraw({ type: 'path', pts: _currentPath, color: _color, size: _size });
  }

  function _onUp() {
    if (!_drawing) return;
    _drawing = false;
    if (_tool === 'move') {
      const ar = _arrastre; _arrastre = null;
      if (!ar) return;
      if (ar.movio) _cambio();
      else if (ar.a.type === 'text') _editarTexto(ar.a);     // tocar sin arrastrar: editar
      else if (ar.a.type === 'pin') _editarPin(ar.a);
      return;
    }
    if (_tool === 'eraser') { if (_borroAlgo) _cambio(); _borroAlgo = false; _redraw(); return; }
    if (_forma) {
      const f = _forma; _forma = null;
      if (Math.hypot(f.x2 - f.x1, f.y2 - f.y1) >= 6) { _annotations.push({ type: 'shape', forma: _tool, ...f, color: _color, size: _size }); _cambio(); }
      _redraw();
      return;
    }
    if (_currentPath.length >= 2) {
      _annotations.push({ type: 'path', pts: _currentPath, color: _color, size: _size });
      _cambio();
    }
    _currentPath = [];
    _redraw();
  }

  // ── Texto: crear y editar ─────────────────────────────

  function _inputFlotante(canvasX, canvasY, valor, color, alListo) {
    document.getElementById('mapTextInput')?.remove();
    const rect   = _canvas.getBoundingClientRect();
    const sx = rect.width / _canvas.width * _k, sy = rect.height / _canvas.height * _k;
    const inp = document.createElement('input');
    inp.id = 'mapTextInput';
    inp.type = 'text';
    inp.placeholder = 'Escribe una etiqueta…';
    inp.className = 'map-text-input';
    inp.value = valor || '';
    inp.style.left  = `${rect.left + canvasX * sx}px`;
    inp.style.top   = `${rect.top + canvasY * sy - 28}px`;
    inp.style.color = color;
    document.body.appendChild(inp);
    inp.focus();
    inp.select();
    let hecho = false;
    const commit = (cancelar) => {
      if (hecho) return; hecho = true;
      const text = inp.value.trim();
      inp.remove();
      if (!cancelar) alListo(text);
    };
    inp.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); commit(false); }
      if (e.key === 'Escape') commit(true);
    });
    inp.addEventListener('blur', () => commit(false));
  }

  function _showTextInput(canvasX, canvasY) {
    _inputFlotante(canvasX, canvasY, '', _color, text => {
      if (!text) return;
      _annotations.push({ type: 'text', x: canvasX, y: canvasY, text, color: _color, size: _fontSize });
      _cambio(); _redraw();
    });
  }

  // Dejarlo vacío lo borra
  function _editarTexto(t) {
    _inputFlotante(t.x, t.y, t.text, t.color, text => {
      if (text === t.text) return;
      if (!text) _annotations = _annotations.filter(a => a !== t); else t.text = text;
      _cambio(); _redraw();
    });
  }

  // ── Pines con nota ────────────────────────────────────

  function _editarPin(pin, x, y) {
    document.getElementById('mapPinPanel')?.remove();
    const nuevo = !pin;
    const rect = _canvas.getBoundingClientRect();
    const sx = rect.width / _canvas.width * _k, sy = rect.height / _canvas.height * _k;
    const px = nuevo ? x : pin.x, py = nuevo ? y : pin.y;
    const panel = document.createElement('div');
    panel.id = 'mapPinPanel';
    panel.className = 'map-pin-panel';
    const esc = s => String(s || '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    panel.innerHTML = `
      <input class="map-pin-titulo" placeholder="Título (ej. Guarida del dragón)" value="${esc(pin && pin.titulo)}">
      <textarea class="map-pin-nota" rows="3" placeholder="Nota">${esc(pin && pin.nota)}</textarea>
      <div class="map-pin-acc">
        ${nuevo ? '' : '<button class="map-action-btn map-pin-borrar">Borrar</button>'}
        <button class="map-action-btn map-pin-cancelar">Cancelar</button>
        <button class="map-action-btn map-save-btn map-pin-ok">${nuevo ? 'Poner pin' : 'Guardar'}</button>
      </div>`;
    document.body.appendChild(panel);
    const ancho = 260;
    panel.style.left = `${Math.min(window.innerWidth - ancho - 8, Math.max(8, rect.left + px * sx - ancho / 2))}px`;
    panel.style.top  = `${Math.min(window.innerHeight - 190, Math.max(8, rect.top + py * sy + 10))}px`;
    const titulo = panel.querySelector('.map-pin-titulo'), nota = panel.querySelector('.map-pin-nota');
    titulo.focus();
    const cerrar = () => panel.remove();
    panel.querySelector('.map-pin-cancelar').onclick = cerrar;
    panel.querySelector('.map-pin-ok').onclick = () => {
      const t = titulo.value.trim(), n = nota.value.trim();
      if (nuevo) { if (!t && !n) { cerrar(); return; } _annotations.push({ type: 'pin', x: px, y: py, titulo: t, nota: n, color: _color }); }
      else { pin.titulo = t; pin.nota = n; }
      cerrar(); _cambio(); _redraw();
    };
    const borrar = panel.querySelector('.map-pin-borrar');
    if (borrar) borrar.onclick = () => { _annotations = _annotations.filter(a => a !== pin); cerrar(); _cambio(); _redraw(); };
  }

  // ── Herramientas UI ───────────────────────────────────

  const FORMAS = ['linea', 'flecha', 'circulo'];
  const BOTONES = { pen: 'mapBtnPen', text: 'mapBtnText', eraser: 'mapBtnEraser', move: 'mapBtnMove', pin: 'mapBtnPin',
    linea: 'mapBtnLinea', flecha: 'mapBtnFlecha', circulo: 'mapBtnCirculo' };

  function setTool(tool) {
    _tool = tool;
    Object.entries(BOTONES).forEach(([t, id]) => document.getElementById(id)?.classList.toggle('active', t === tool));
    if (_canvas) _canvas.style.cursor = tool === 'text' ? 'text' : tool === 'move' ? 'grab' : 'crosshair';
  }

  function setColor(color) {
    _color = color;
    if (_tool === 'eraser' || _tool === 'move') setTool('pen');
    document.querySelectorAll('.map-color-btn').forEach(b => b.classList.remove('active'));
    document.querySelector(`.map-color-btn[data-color="${color}"]`)?.classList.add('active');
  }

  function setSize(val) {
    _size     = parseInt(val) || 4;
    _fontSize = Math.max(12, _size * 3);   // texto escala con el slider
  }

  /* ── Historial (Deshacer / Rehacer) y guardado automático ───────────────
     Cada cambio deja una foto del estado; se guarda solo un momento después. */
  let _hist = [], _histIdx = -1, _timerGuardar = null;
  const _foto = () => JSON.stringify(_annotations);

  function _iniciarHistorial() {
    _hist = [_foto()];
    _histIdx = 0;
    _actualizarHistorialUI();
  }

  function _cambio() {
    _hist = _hist.slice(0, _histIdx + 1);
    _hist.push(_foto());
    if (_hist.length > 60) _hist.shift();
    _histIdx = _hist.length - 1;
    _actualizarHistorialUI();
    _programarGuardado();
  }

  function _actualizarHistorialUI() {
    const u = document.getElementById('mapBtnUndo'), r = document.getElementById('mapBtnRedo');
    if (u) u.disabled = _histIdx <= 0;
    if (r) r.disabled = _histIdx >= _hist.length - 1;
  }

  function undo() {
    if (_histIdx <= 0) return;
    _histIdx--;
    _annotations = JSON.parse(_hist[_histIdx]);
    _redraw(); _actualizarHistorialUI(); _programarGuardado();
  }

  function redo() {
    if (_histIdx >= _hist.length - 1) return;
    _histIdx++;
    _annotations = JSON.parse(_hist[_histIdx]);
    _redraw(); _actualizarHistorialUI(); _programarGuardado();
  }

  function clearAll() {
    if (!confirm('¿Borrar todas las anotaciones?')) return;
    _annotations = [];
    _cambio();
    _redraw();
  }

  function _programarGuardado() {
    _estadoGuardado('Guardando…');
    clearTimeout(_timerGuardar);
    _timerGuardar = setTimeout(() => saveAnnotations(), 500);
  }

  // ── Guardar ───────────────────────────────────────────

  async function saveAnnotations() {
    clearTimeout(_timerGuardar);
    _timerGuardar = null;
    if (!_activeMap) return;
    _activeMap.annotations = JSON.parse(_foto());
    _activeMap.updatedAt = new Date().toISOString();
    delete _activeMap.paths; // limpiar campo viejo
    await _dbPut(STORE_MAPS, _activeMap);
    const idx = _maps.findIndex(m => m.id === _activeMap.id);
    if (idx >= 0) _maps[idx] = _activeMap;
    _estadoGuardado('Guardado');
    const m = _activeMap;
    clearTimeout(_timerSubir);
    _timerSubir = setTimeout(() => _subir(m), 2000);
  }
  let _timerSubir = null;

  function _estadoGuardado(txt) {
    const el = document.getElementById('mapSaveState');
    if (el) el.textContent = txt;
  }

  /* ── Nube (Firestore) ────────────────────────────────────────────────────
     La imagen sube comprimida (máx. 1600 px, JPEG) en trozos; las anotaciones
     y el nombre van en el documento del mapa. Gana el más nuevo (updatedAt).
     Las lecturas van al servidor: si no hay conexión no se toca nada. */
  const LIENZO = 1000, TROZO = 800000;
  let _sincronizando = false;
  const _uid = () => { try { const u = window.FirebaseApp && FirebaseApp.getCurrentUser && FirebaseApp.getCurrentUser(); return u ? u.uid : null; } catch (e) { return null; } };
  const _nubeLista = () => !!(_uid() && navigator.onLine && window.FirebaseApp && FirebaseApp.listMapsCloud);

  async function _comprimir(blob) {
    const bmp = await createImageBitmap(blob);
    const f = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
    const cv = document.createElement('canvas');
    cv.width = Math.round(bmp.width * f); cv.height = Math.round(bmp.height * f);
    cv.getContext('2d').drawImage(bmp, 0, 0, cv.width, cv.height);
    const jpg = await new Promise(r => cv.toBlob(r, 'image/jpeg', 0.8));
    return new Promise(r => { const fr = new FileReader(); fr.onload = () => r(String(fr.result).split(',')[1]); fr.readAsDataURL(jpg); });
  }
  function _base64ABlob(b64) {
    const bin = atob(b64), u = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    return new Blob([u], { type: 'image/jpeg' });
  }
  const _metaNube = m => ({ id: m.id, charId: m.charId, name: m.name, createdAt: m.createdAt, updatedAt: m.updatedAt || m.createdAt,
    lienzo: m.lienzo || null, trozos: m.trozos || 0, annotations: JSON.stringify(m.annotations || []) });

  async function _subir(m) {
    if (!m || !_nubeLista()) return false;
    const uid = _uid();
    try {
      if (!m.trozos) {
        const rec = await _dbGet(STORE_IMGS, m.imgId);
        if (!rec) return false;
        const b64 = await _comprimir(rec.blob);
        const trozos = [];
        for (let i = 0; i < b64.length; i += TROZO) trozos.push(b64.slice(i, i + TROZO));
        await FirebaseApp.saveMapImgCloud(uid, m.id, trozos);
        m.trozos = trozos.length;
      }
      await FirebaseApp.saveMapMetaCloud(uid, _metaNube(m));
      m.enNube = true;
      // Releer antes de escribir: puede haber cambiado mientras subía
      const actual = await _dbGet(STORE_MAPS, m.id);
      if (actual) await _dbPut(STORE_MAPS, { ...actual, trozos: m.trozos, enNube: true });
      if (_activeMap && _activeMap.id === m.id) { _activeMap.trozos = m.trozos; _activeMap.enNube = true; }
      return true;
    } catch (e) { console.warn('[mapas] no se pudo subir', m.id, e); return false; }
  }

  function _pendientesBorrar(fn) {
    let l = [];
    try { l = JSON.parse(localStorage.getItem('dnd_maps_borrar') || '[]'); } catch (e) {}
    if (fn) { l = fn(l); try { localStorage.setItem('dnd_maps_borrar', JSON.stringify(l)); } catch (e) {} }
    return l;
  }
  async function _borrarPendientes() {
    if (!_nubeLista()) return;
    for (const b of _pendientesBorrar()) {
      try { await FirebaseApp.deleteMapCloud(_uid(), b.id, b.trozos); _pendientesBorrar(l => l.filter(x => x.id !== b.id)); }
      catch (e) { console.warn('[mapas] no se pudo borrar en la nube', b.id, e); }
    }
  }

  async function sincronizar() {
    if (_sincronizando || !_nubeLista() || !_charId) return;
    _sincronizando = true;
    try {
      if (!_db) await _openDB();
      await _borrarPendientes();
      const uid = _uid();
      const borrados = new Set(_pendientesBorrar().map(b => b.id));
      const nube = (await FirebaseApp.listMapsCloud(uid)).filter(x => x.charId === _charId && !borrados.has(x.id));
      await _loadMaps();
      const fecha = m => m.updatedAt || m.createdAt || '';
      for (const c of nube) {
        const l = _maps.find(m => m.id === c.id);
        if (!l) {
          // Mapa de otro dispositivo: bajar imagen y anotaciones
          const b64 = await FirebaseApp.loadMapImgCloud(uid, c.id, c.trozos);
          const imgId = 'img-' + c.id;
          await _dbPut(STORE_IMGS, { id: imgId, blob: _base64ABlob(b64) });
          await _dbPut(STORE_MAPS, { id: c.id, charId: c.charId, name: c.name, imgId, createdAt: c.createdAt, updatedAt: c.updatedAt,
            lienzo: c.lienzo || LIENZO, trozos: c.trozos, enNube: true, annotations: JSON.parse(c.annotations || '[]') });
        } else if (fecha(c) > fecha(l)) {
          if (_activeMap && _activeMap.id === l.id) continue;   // no pisar el que está abierto
          await _dbPut(STORE_MAPS, { ...l, name: c.name, updatedAt: c.updatedAt, lienzo: c.lienzo || l.lienzo, trozos: c.trozos, enNube: true,
            annotations: JSON.parse(c.annotations || '[]') });
        } else if (fecha(l) > fecha(c) || !l.enNube) {
          await _subir({ ...l, trozos: l.trozos || c.trozos });
        }
      }
      for (const l of _maps) {
        if (nube.some(c => c.id === l.id)) continue;
        if (l.enNube) {
          // Estaba en la nube y ya no: se borró en otro dispositivo
          if (_activeMap && _activeMap.id === l.id) continue;
          await _dbDelete(STORE_MAPS, l.id);
          await _dbDelete(STORE_IMGS, l.imgId);
        } else await _subir(l);
      }
      await _loadMaps();
      renderList();
    } catch (e) {
      console.warn('[mapas] sincronización', e);
    } finally {
      _sincronizando = false;
    }
  }


  /* Crea un mapa desde fuera (el diario), reusando la misma IndexedDB.
     Así la foto adjuntada a una nota aparece también en la pestaña Mapas
     y se puede anotar, en vez de vivir duplicada en otro lado. */
  async function addMapFromBlob(blob, name, charId) {
    if (!blob) return null;
    // Puede llamarse desde el diario sin haber abierto nunca la pestaña
    // Mapas, así que init() puede no haber corrido todavía.
    if (charId) _charId = charId;
    if (!_db) await _openDB();
    if (!_charId) return null;
    const id    = 'map-' + Date.now();
    const imgId = 'img-' + Date.now();
    await _dbPut(STORE_IMGS, { id: imgId, blob });
    const nuevo = {
      id, charId: _charId, name: name || 'Foto de sesión',
      imgId, annotations: [], lienzo: LIENZO, createdAt: new Date().toISOString(),
    };
    await _dbPut(STORE_MAPS, nuevo);
    await _loadMaps();
    renderList();
    _subir(nuevo).then(() => _loadMaps());
    return { id, imgId };
  }

  // Devuelve el blob de una imagen guardada, para previsualizarla.
  async function getImageBlob(imgId) {
    if (!_db) await _openDB();
    const rec = await _dbGet(STORE_IMGS, imgId);
    return rec ? rec.blob : null;
  }

  // ── API pública ───────────────────────────────────────

  return {
    init, renderList, onSearch,
    addMapFromBlob, getImageBlob,
    triggerAddMap, triggerCamera, handleFileSelect, deleteMap,
    openMap, closeMap,
    setTool, setColor, setSize,
    undo, redo, clearAll, saveAnnotations, resetZoom, sincronizar,
  };

})();
