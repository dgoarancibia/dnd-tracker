/* ═══════════════════════════════════════════════════════
   maps.js — Mapas con anotaciones a mano
   IndexedDB para imágenes · Canvas para dibujo
   Singleton global: Maps
   ═══════════════════════════════════════════════════════ */

const Maps = (() => {

  const DB_NAME    = 'dnd_maps_v1';
  const DB_VERSION = 1;
  const STORE_IMGS = 'images';   // { id, blob }
  const STORE_MAPS = 'maps';     // { id, charId, name, imgId, paths, createdAt }

  let _db         = null;
  let _charId     = null;        // personaje activo
  let _maps       = [];          // lista de mapas del personaje
  let _activeMap  = null;        // mapa abierto en el canvas
  let _canvas     = null;
  let _ctx        = null;
  let _drawing    = false;
  let _currentPath = [];
  let _tool       = 'pen';       // 'pen' | 'eraser'
  let _color      = '#e05c2a';   // rojo ladrillo por defecto
  let _size       = 4;
  let _paths      = [];          // paths guardados del mapa activo
  let _undoStack  = [];

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
    _maps = all.filter(m => m.charId === _charId).sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  }

  // ── Renderizar lista ──────────────────────────────────

  function renderList() {
    const container = document.getElementById('mapsListContainer');
    if (!container) return;

    if (_maps.length === 0) {
      container.innerHTML = `<div class="maps-empty">Sube un mapa con el botón +</div>`;
      return;
    }

    container.innerHTML = _maps.map(m => `
      <div class="map-card" onclick="Maps.openMap('${m.id}')">
        <div class="map-card-thumb" id="thumb-${m.id}"></div>
        <div class="map-card-info">
          <span class="map-card-name">${m.name}</span>
          <span class="map-card-date">${new Date(m.createdAt).toLocaleDateString('es')}</span>
        </div>
        <button class="map-card-del" onclick="event.stopPropagation();Maps.deleteMap('${m.id}')" title="Eliminar">✕</button>
      </div>
    `).join('');

    // Cargar thumbnails
    _maps.forEach(m => _loadThumb(m));
  }

  async function _loadThumb(map) {
    const el = document.getElementById(`thumb-${map.id}`);
    if (!el) return;
    const imgRec = await _dbGet(STORE_IMGS, map.imgId);
    if (!imgRec) return;
    const url = URL.createObjectURL(imgRec.blob);
    el.style.backgroundImage = `url(${url})`;
    el.style.backgroundSize = 'cover';
    el.style.backgroundPosition = 'center';
  }

  // ── Agregar mapa ──────────────────────────────────────

  function triggerAddMap() {
    const input = document.getElementById('mapFileInput');
    if (input) input.click();
  }

  async function handleFileSelect(input) {
    const file = input.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { alert('Solo se admiten imágenes'); return; }
    if (file.size > 20 * 1024 * 1024) { alert('Imagen demasiado grande (máx 20 MB)'); return; }

    const name = prompt('Nombre del mapa:', file.name.replace(/\.[^.]+$/, '')) || file.name;
    const id    = 'map-' + Date.now();
    const imgId = 'img-' + Date.now();

    await _dbPut(STORE_IMGS, { id: imgId, blob: file });
    await _dbPut(STORE_MAPS, { id, charId: _charId, name, imgId, paths: [], createdAt: new Date().toISOString() });

    input.value = '';
    await _loadMaps();
    renderList();
  }

  // ── Eliminar mapa ─────────────────────────────────────

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
    _activeMap = m;
    _paths     = (m.paths || []).map(p => ({ ...p, pts: [...p.pts] }));
    _undoStack = [];

    const imgRec = await _dbGet(STORE_IMGS, m.imgId);
    if (!imgRec) return;
    const imgUrl = URL.createObjectURL(imgRec.blob);

    // Mostrar overlay
    const overlay = document.getElementById('mapCanvasOverlay');
    overlay.classList.add('show');
    document.getElementById('mapCanvasTitle').textContent = m.name;

    // Esperar a que el canvas esté visible
    requestAnimationFrame(() => _initCanvas(imgUrl));
  }

  function closeMap() {
    const overlay = document.getElementById('mapCanvasOverlay');
    overlay.classList.remove('show');
    _activeMap = null;
    _drawing   = false;
    if (_canvas) {
      _canvas.removeEventListener('pointerdown', _onDown);
      _canvas.removeEventListener('pointermove', _onMove);
      _canvas.removeEventListener('pointerup',   _onUp);
      _canvas.removeEventListener('pointercancel', _onUp);
    }
  }

  function _initCanvas(imgUrl) {
    _canvas = document.getElementById('mapCanvas');
    _ctx    = _canvas.getContext('2d');

    const img = new Image();
    img.onload = () => {
      // Ajustar canvas al tamaño del contenedor
      const wrap = _canvas.parentElement;
      const maxW = wrap.clientWidth;
      const maxH = wrap.clientHeight;
      const scale = Math.min(maxW / img.naturalWidth, maxH / img.naturalHeight, 1);
      _canvas.width  = img.naturalWidth  * scale;
      _canvas.height = img.naturalHeight * scale;
      _canvas._img   = img;
      _canvas._scale = scale;
      _redraw();
      _attachEvents();
    };
    img.src = imgUrl;
  }

  function _redraw() {
    if (!_ctx || !_canvas._img) return;
    _ctx.clearRect(0, 0, _canvas.width, _canvas.height);
    _ctx.drawImage(_canvas._img, 0, 0, _canvas.width, _canvas.height);
    _paths.forEach(p => _drawPath(p));
  }

  function _drawPath(path) {
    if (!path.pts || path.pts.length < 2) return;
    _ctx.save();
    if (path.tool === 'eraser') {
      _ctx.globalCompositeOperation = 'destination-out';
      _ctx.strokeStyle = 'rgba(0,0,0,1)';
    } else {
      _ctx.globalCompositeOperation = 'source-over';
      _ctx.strokeStyle = path.color || '#e05c2a';
    }
    _ctx.lineWidth   = path.size || 4;
    _ctx.lineCap     = 'round';
    _ctx.lineJoin    = 'round';
    _ctx.beginPath();
    _ctx.moveTo(path.pts[0], path.pts[1]);
    for (let i = 2; i < path.pts.length - 1; i += 2) {
      _ctx.lineTo(path.pts[i], path.pts[i + 1]);
    }
    _ctx.stroke();
    _ctx.restore();
  }

  // ── Eventos de dibujo ─────────────────────────────────

  function _attachEvents() {
    _canvas.addEventListener('pointerdown',  _onDown,  { passive: false });
    _canvas.addEventListener('pointermove',  _onMove,  { passive: false });
    _canvas.addEventListener('pointerup',    _onUp,    { passive: false });
    _canvas.addEventListener('pointercancel',_onUp,    { passive: false });
  }

  function _getPos(e) {
    const rect = _canvas.getBoundingClientRect();
    const scaleX = _canvas.width  / rect.width;
    const scaleY = _canvas.height / rect.height;
    return [(e.clientX - rect.left) * scaleX, (e.clientY - rect.top) * scaleY];
  }

  function _onDown(e) {
    e.preventDefault();
    _canvas.setPointerCapture(e.pointerId);
    _drawing = true;
    const [x, y] = _getPos(e);
    _currentPath = [x, y];
  }

  function _onMove(e) {
    e.preventDefault();
    if (!_drawing) return;
    const [x, y] = _getPos(e);
    _currentPath.push(x, y);
    // Dibujo en tiempo real — redibuja todo + trazo actual
    _redraw();
    _drawPath({ pts: _currentPath, color: _color, size: _size, tool: _tool });
  }

  function _onUp(e) {
    if (!_drawing) return;
    _drawing = false;
    if (_currentPath.length >= 4) {
      const path = { pts: _currentPath, color: _color, size: _size, tool: _tool };
      _paths.push(path);
      _undoStack.push(_paths.length - 1);
    }
    _currentPath = [];
    _redraw();
  }

  // ── Herramientas ──────────────────────────────────────

  function setTool(tool) {
    _tool = tool;
    document.getElementById('mapBtnPen')?.classList.toggle('active',     tool === 'pen');
    document.getElementById('mapBtnEraser')?.classList.toggle('active',  tool === 'eraser');
  }

  function setColor(color) {
    _color = color;
    _tool  = 'pen';
    setTool('pen');
    // Actualizar botón activo de color
    document.querySelectorAll('.map-color-btn').forEach(b => b.classList.remove('active'));
    document.querySelector(`.map-color-btn[data-color="${color}"]`)?.classList.add('active');
  }

  function setSize(val) {
    _size = parseInt(val) || 4;
  }

  function undo() {
    if (_paths.length === 0) return;
    _paths.pop();
    _redraw();
  }

  function clearAll() {
    if (!confirm('¿Borrar todas las anotaciones?')) return;
    _paths = [];
    _redraw();
  }

  // ── Guardar ───────────────────────────────────────────

  async function saveAnnotations() {
    if (!_activeMap) return;
    _activeMap.paths = _paths.map(p => ({ ...p, pts: [...p.pts] }));
    await _dbPut(STORE_MAPS, _activeMap);
    // Actualizar lista local
    const idx = _maps.findIndex(m => m.id === _activeMap.id);
    if (idx >= 0) _maps[idx] = _activeMap;
    _showSaveFlash();
  }

  function _showSaveFlash() {
    const btn = document.getElementById('mapBtnSave');
    if (!btn) return;
    btn.textContent = '✓ Guardado';
    btn.style.color = '#4caf50';
    setTimeout(() => { btn.textContent = 'Guardar'; btn.style.color = ''; }, 1500);
  }

  // ── API pública ───────────────────────────────────────

  return {
    init,
    renderList,
    triggerAddMap,
    handleFileSelect,
    openMap,
    closeMap,
    deleteMap,
    setTool,
    setColor,
    setSize,
    undo,
    clearAll,
    saveAnnotations,
  };

})();
