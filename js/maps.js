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
  let _tool        = 'pen';      // 'pen' | 'eraser' | 'text'
  let _color       = '#e05c2a';
  let _size        = 4;
  let _fontSize    = 18;
  let _annotations = [];         // [ {type:'path',...} | {type:'text', x, y, text, color, size} ]

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
    await _dbPut(STORE_MAPS, { id, charId: _charId, name, imgId, annotations: [], createdAt: new Date().toISOString() });

    input.value = '';
    await _loadMaps();
    renderList();
  }

  async function deleteMap(id) {
    const m = _maps.find(x => x.id === id);
    if (!m) return;
    if (!confirm(`Eliminar "${m.name}"?`)) return;
    await _dbDelete(STORE_MAPS, id);
    await _dbDelete(STORE_IMGS, m.imgId);
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

    requestAnimationFrame(() => _initCanvas(imgUrl));
  }

  function closeMap() {
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
      _redraw();
      _attachCanvasEvents();
    };
    img.src = imgUrl;
  }

  function _redraw() {
    if (!_ctx || !_canvas._img) return;
    _ctx.clearRect(0, 0, _canvas.width, _canvas.height);
    _ctx.drawImage(_canvas._img, 0, 0, _canvas.width, _canvas.height);
    _annotations.forEach(a => {
      if (a.type === 'text') _drawText(a);
      else                   _drawPath(a);
    });
  }

  function _drawPath(p) {
    if (!p.pts || p.pts.length < 2) return;
    _ctx.save();
    if (p.tool === 'eraser') {
      _ctx.globalCompositeOperation = 'destination-out';
      _ctx.strokeStyle = 'rgba(0,0,0,1)';
    } else {
      _ctx.globalCompositeOperation = 'source-over';
      _ctx.strokeStyle = p.color || '#e05c2a';
    }
    _ctx.lineWidth = p.size || 4;
    _ctx.lineCap   = 'round';
    _ctx.lineJoin  = 'round';
    _ctx.beginPath();
    _ctx.moveTo(p.pts[0], p.pts[1]);
    for (let i = 2; i < p.pts.length; i += 2) _ctx.lineTo(p.pts[i], p.pts[i + 1]);
    _ctx.stroke();
    _ctx.restore();
  }

  function _drawText(t) {
    _ctx.save();
    _ctx.globalCompositeOperation = 'source-over';
    _ctx.font         = `bold ${t.size || 18}px 'Jost', sans-serif`;
    _ctx.fillStyle    = t.color || '#f0c040';
    _ctx.strokeStyle  = 'rgba(0,0,0,0.7)';
    _ctx.lineWidth    = 3;
    _ctx.strokeText(t.text, t.x, t.y);
    _ctx.fillText(t.text, t.x, t.y);
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
    return [(e.clientX - rect.left) * scaleX, (e.clientY - rect.top) * scaleY];
  }

  // ── Goma: borra ANOTACIONES, no píxeles ────────────────────────────────
  // Antes usaba destination-out, que agujereaba también la imagen del mapa.
  // Ahora elimina las anotaciones que el trazo de goma toca, dejando el mapa
  // intacto — comportamiento de goma real.

  // Distancia mínima de un punto a un segmento (para saber si la goma lo tocó)
  function _distPuntoSegmento(px, py, x1, y1, x2, y2) {
    const dx = x2 - x1, dy = y2 - y1;
    const largo2 = dx * dx + dy * dy;
    if (largo2 === 0) return Math.hypot(px - x1, py - y1);
    let t = ((px - x1) * dx + (py - y1) * dy) / largo2;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
  }

  function _anotacionTocada(a, x, y, radio) {
    if (a.type === 'text') {
      // Caja aproximada del texto (el origen del fillText es la baseline)
      const ancho = (a.text || '').length * (a.size || 18) * 0.55;
      const alto  = (a.size || 18);
      return x >= a.x - radio && x <= a.x + ancho + radio &&
             y >= a.y - alto - radio && y <= a.y + radio;
    }
    const pts = a.pts || [];
    const tolerancia = radio + (a.size || 4) / 2;
    for (let i = 0; i + 3 < pts.length; i += 2) {
      if (_distPuntoSegmento(x, y, pts[i], pts[i+1], pts[i+2], pts[i+3]) <= tolerancia) return true;
    }
    return false;
  }

  function _borrarEn(x, y) {
    const radio = Math.max(8, _size * 2); // área de borrado del dedo/puntero
    const antes = _annotations.length;
    _annotations = _annotations.filter(a => !_anotacionTocada(a, x, y, radio));
    return _annotations.length !== antes;
  }

  function _onDown(e) {
    e.preventDefault();
    _canvas.setPointerCapture(e.pointerId);
    const [x, y] = _getPos(e);

    if (_tool === 'text') {
      _showTextInput(x, y, e);
      return;
    }

    if (_tool === 'eraser') {
      _drawing = true;
      if (_borrarEn(x, y)) _redraw();
      return;
    }

    _drawing     = true;
    _currentPath = [x, y];
  }

  function _onMove(e) {
    e.preventDefault();
    if (!_drawing || _tool === 'text') return;
    const [x, y] = _getPos(e);

    if (_tool === 'eraser') {
      if (_borrarEn(x, y)) _redraw();
      return;
    }

    _currentPath.push(x, y);
    _redraw();
    _drawPath({ pts: _currentPath, color: _color, size: _size, tool: _tool });
  }

  function _onUp(e) {
    if (!_drawing) return;
    _drawing = false;
    if (_tool === 'eraser') { _redraw(); return; } // se guarda con el botón, igual que el pincel
    if (_currentPath.length >= 4) {
      _annotations.push({ type: 'path', pts: _currentPath, color: _color, size: _size, tool: _tool });
    }
    _currentPath = [];
    _redraw();
  }

  // ── Herramienta de texto ──────────────────────────────

  function _showTextInput(canvasX, canvasY, pointerEvent) {
    // Crear input flotante sobre el canvas en la posición del toque
    const existing = document.getElementById('mapTextInput');
    if (existing) existing.remove();

    const rect   = _canvas.getBoundingClientRect();
    const scaleX = rect.width  / _canvas.width;
    const scaleY = rect.height / _canvas.height;

    // Posición en pantalla
    const screenX = rect.left + canvasX * scaleX;
    const screenY = rect.top  + canvasY * scaleY;

    const inp = document.createElement('input');
    inp.id          = 'mapTextInput';
    inp.type        = 'text';
    inp.placeholder = 'Escribe una etiqueta…';
    inp.className   = 'map-text-input';
    inp.style.left  = `${screenX}px`;
    inp.style.top   = `${screenY - 28}px`;   // un poco arriba del toque
    inp.style.color = _color;

    document.body.appendChild(inp);
    inp.focus();

    const commit = () => {
      const text = inp.value.trim();
      inp.remove();
      if (!text) return;
      _annotations.push({ type: 'text', x: canvasX, y: canvasY, text, color: _color, size: _fontSize });
      _redraw();
    };

    inp.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); commit(); }
      if (e.key === 'Escape') { inp.remove(); }
    });
    inp.addEventListener('blur', commit);
  }

  // ── Herramientas UI ───────────────────────────────────

  function setTool(tool) {
    _tool = tool;
    document.getElementById('mapBtnPen')?.classList.toggle('active',    tool === 'pen');
    document.getElementById('mapBtnEraser')?.classList.toggle('active', tool === 'eraser');
    document.getElementById('mapBtnText')?.classList.toggle('active',   tool === 'text');
    if (_canvas) _canvas.style.cursor = tool === 'text' ? 'text' : 'crosshair';
  }

  function setColor(color) {
    _color = color;
    if (_tool === 'eraser') setTool('pen');
    document.querySelectorAll('.map-color-btn').forEach(b => b.classList.remove('active'));
    document.querySelector(`.map-color-btn[data-color="${color}"]`)?.classList.add('active');
  }

  function setSize(val) {
    _size     = parseInt(val) || 4;
    _fontSize = Math.max(12, _size * 3);   // texto escala con el slider
  }

  function undo() {
    if (_annotations.length === 0) return;
    _annotations.pop();
    _redraw();
  }

  function clearAll() {
    if (!confirm('¿Borrar todas las anotaciones?')) return;
    _annotations = [];
    _redraw();
  }

  // ── Guardar ───────────────────────────────────────────

  async function saveAnnotations() {
    if (!_activeMap) return;
    _activeMap.annotations = _annotations.map(a => ({ ...a, pts: a.pts ? [...a.pts] : undefined }));
    delete _activeMap.paths; // limpiar campo viejo
    await _dbPut(STORE_MAPS, _activeMap);
    const idx = _maps.findIndex(m => m.id === _activeMap.id);
    if (idx >= 0) _maps[idx] = _activeMap;
    _showSaveFlash();
  }

  function _showSaveFlash() {
    const btn = document.getElementById('mapBtnSave');
    if (!btn) return;
    const orig = btn.textContent;
    btn.textContent = '✓ Guardado';
    btn.style.color = '#4caf50';
    setTimeout(() => { btn.textContent = orig; btn.style.color = ''; }, 1500);
  }

  // ── API pública ───────────────────────────────────────

  return {
    init, renderList, onSearch,
    triggerAddMap, triggerCamera, handleFileSelect, deleteMap,
    openMap, closeMap,
    setTool, setColor, setSize,
    undo, clearAll, saveAnnotations, resetZoom,
  };

})();
