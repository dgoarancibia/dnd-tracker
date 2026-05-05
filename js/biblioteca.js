/* ═══════════════════════════════════════════════════════
   biblioteca.js — Lector y buscador de manuales PDF
   Usa pdf.js (CDN) + IndexedDB para almacenamiento local.
   Singleton global: Biblioteca
   ═══════════════════════════════════════════════════════ */

const Biblioteca = (() => {

  // ── Configuración ─────────────────────────────────────
  const PDFJS_CDN   = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.min.mjs';
  const WORKER_CDN  = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.worker.min.mjs';
  const DB_NAME     = 'dnd_biblioteca_v1';
  const DB_VERSION  = 1;
  const STORE_BOOKS = 'books';      // metadata + texto indexado
  const STORE_PDFS  = 'pdfs';       // ArrayBuffer del PDF original

  // ── Estado ────────────────────────────────────────────
  let _pdfjsLib     = null;         // módulo pdf.js cargado dinámicamente
  let _db           = null;         // IDBDatabase
  let _books        = [];           // [{ id, title, pages, addedAt }]
  let _currentBook  = null;         // { id, title, pages }  (libro activo en visor)
  let _pdfDoc       = null;         // PDFDocumentProxy de pdf.js
  let _currentPage  = 1;
  let _zoom         = 1.0;
  let _searchTimer  = null;
  let _rendering    = false;

  // Referencia rápida
  let _sideTab      = 'manuales';   // 'manuales' | 'referencia'
  let _refFilter    = 'all';        // 'all' | 'char' | 'spell' | 'feat'
  let _refQuery     = '';
  let _refTimer     = null;
  let _refItems     = [];           // índice construido de hechizos + features

  // ── Inicialización ────────────────────────────────────

  async function init() {
    try {
      await _openDB();
      await _loadBookList();
      _renderBookList();
      _setupFileInput();
      _showWelcome();
    } catch (e) {
      console.error('[Biblioteca] init error:', e);
    }
  }

  // ── IndexedDB ─────────────────────────────────────────

  function _openDB() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = e => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(STORE_BOOKS)) {
          db.createObjectStore(STORE_BOOKS, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORE_PDFS)) {
          db.createObjectStore(STORE_PDFS, { keyPath: 'id' });
        }
      };
      req.onsuccess = e => { _db = e.target.result; resolve(); };
      req.onerror   = e => reject(e.target.error);
    });
  }

  function _dbGet(store, key) {
    return new Promise((resolve, reject) => {
      const tx  = _db.transaction(store, 'readonly');
      const req = tx.objectStore(store).get(key);
      req.onsuccess = e => resolve(e.target.result);
      req.onerror   = e => reject(e.target.error);
    });
  }

  function _dbPut(store, obj) {
    return new Promise((resolve, reject) => {
      const tx  = _db.transaction(store, 'readwrite');
      const req = tx.objectStore(store).put(obj);
      req.onsuccess = () => resolve();
      req.onerror   = e => reject(e.target.error);
    });
  }

  function _dbDelete(store, key) {
    return new Promise((resolve, reject) => {
      const tx  = _db.transaction(store, 'readwrite');
      const req = tx.objectStore(store).delete(key);
      req.onsuccess = () => resolve();
      req.onerror   = e => reject(e.target.error);
    });
  }

  function _dbGetAll(store) {
    return new Promise((resolve, reject) => {
      const tx  = _db.transaction(store, 'readonly');
      const req = tx.objectStore(store).getAll();
      req.onsuccess = e => resolve(e.target.result);
      req.onerror   = e => reject(e.target.error);
    });
  }

  // ── Cargar lista de libros ─────────────────────────────

  async function _loadBookList() {
    const books = await _dbGetAll(STORE_BOOKS);
    _books = books.sort((a, b) => a.addedAt - b.addedAt);
  }

  // ── Cargar pdf.js dinámicamente ───────────────────────

  async function _loadPdfJs() {
    if (_pdfjsLib) return _pdfjsLib;
    try {
      const mod = await import(PDFJS_CDN);
      _pdfjsLib = mod;
      _pdfjsLib.GlobalWorkerOptions.workerSrc = WORKER_CDN;
      return _pdfjsLib;
    } catch (e) {
      throw new Error('No se pudo cargar pdf.js. Verificá la conexión a internet.');
    }
  }

  // ── Importar PDF ──────────────────────────────────────

  function _setupFileInput() {
    const input = document.getElementById('bibFileInput');
    if (!input) return;
    input.addEventListener('change', async e => {
      const files = Array.from(e.target.files || []);
      input.value = '';
      for (const file of files) {
        await _importFile(file);
      }
    });
  }

  async function _importFile(file) {
    if (!file || file.type !== 'application/pdf') {
      _toast('Solo se admiten archivos PDF', 'error');
      return;
    }
    const maxMB = 150;
    if (file.size > maxMB * 1024 * 1024) {
      _toast(`El archivo supera ${maxMB} MB`, 'error');
      return;
    }

    const id    = `book_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const title = file.name.replace(/\.pdf$/i, '').replace(/[_-]/g, ' ').trim();

    _showLoading(`Procesando "${title}"…`);

    try {
      const pdfjs = await _loadPdfJs();
      const buf   = await file.arrayBuffer();

      // Guardar PDF raw
      await _dbPut(STORE_PDFS, { id, data: buf });

      // Indexar texto de todas las páginas
      const loadingTask = pdfjs.getDocument({ data: buf.slice(0) });
      const pdf = await loadingTask.promise;
      const totalPages = pdf.numPages;

      const pages = [];
      for (let p = 1; p <= totalPages; p++) {
        _setLoadingProgress(p, totalPages, title);
        try {
          const page    = await pdf.getPage(p);
          const content = await page.getTextContent();
          const text    = content.items.map(it => it.str).join(' ')
            .replace(/\s+/g, ' ').trim();
          pages.push({ page: p, text });
        } catch (_) {
          pages.push({ page: p, text: '' });
        }
      }

      // Guardar metadata + índice
      const bookMeta = { id, title, totalPages, addedAt: Date.now(), pages };
      await _dbPut(STORE_BOOKS, bookMeta);

      _books.push(bookMeta);
      _renderBookList();
      _hideLoading();
      _toast(`"${title}" listo (${totalPages} pág.)`, 'ok');

      // Abrir automáticamente el libro recién cargado
      await openBook(id);

    } catch (e) {
      console.error('[Biblioteca] import error:', e);
      _hideLoading();
      _toast('Error al procesar el PDF: ' + e.message, 'error');
    }
  }

  // ── Render lista de libros ────────────────────────────

  function _renderBookList() {
    const list = document.getElementById('bibBookList');
    if (!list) return;

    if (_books.length === 0) {
      list.innerHTML = `
        <div class="bib-empty-state">
          <div class="bib-empty-icon">📖</div>
          <div class="bib-empty-title">Sin manuales</div>
          <div class="bib-empty-sub">Cargá un PDF con el botón<br>+ PDF para empezar</div>
        </div>`;
      return;
    }

    list.innerHTML = _books.map(b => `
      <div class="bib-book-item ${_currentBook && _currentBook.id === b.id ? 'active' : ''}"
           onclick="Biblioteca.openBook('${b.id}')">
        <div class="bib-book-icon">📕</div>
        <div class="bib-book-info">
          <div class="bib-book-name">${_esc(b.title)}</div>
          <div class="bib-book-meta">${b.totalPages} páginas</div>
        </div>
      </div>`).join('');
  }

  // ── Abrir libro en el visor ───────────────────────────

  async function openBook(id) {
    const meta = _books.find(b => b.id === id);
    if (!meta) return;

    _currentBook = meta;
    _currentPage = 1;
    _renderBookList();

    _showLoading('Abriendo manual…');
    try {
      const pdfjs   = await _loadPdfJs();
      const pdfData = await _dbGet(STORE_PDFS, id);
      if (!pdfData) throw new Error('PDF no encontrado en almacenamiento local');

      _pdfDoc = await pdfjs.getDocument({ data: pdfData.data.slice(0) }).promise;

      _hideLoading();
      _showViewer();
      _updateViewerMeta();
      await _renderPage(_currentPage);

    } catch (e) {
      console.error('[Biblioteca] openBook error:', e);
      _hideLoading();
      _toast('Error al abrir: ' + e.message, 'error');
    }
  }

  // ── Render de página PDF ──────────────────────────────

  async function _renderPage(pageNum) {
    if (!_pdfDoc || _rendering) return;
    _rendering = true;

    const wrap   = document.getElementById('bibCanvasWrap');
    const canvas = document.getElementById('bibCanvas');
    if (!canvas || !wrap) { _rendering = false; return; }

    try {
      const page     = await _pdfDoc.getPage(pageNum);
      const viewport = page.getViewport({ scale: _zoom });

      canvas.width  = viewport.width;
      canvas.height = viewport.height;

      const ctx = canvas.getContext('2d');
      await page.render({ canvasContext: ctx, viewport }).promise;

      _currentPage = pageNum;
      _updateViewerMeta();
    } catch (e) {
      console.error('[Biblioteca] renderPage error:', e);
    }
    _rendering = false;
  }

  function _updateViewerMeta() {
    const pn   = document.getElementById('bibPageNum');
    const pt   = document.getElementById('bibPageTotal');
    const tb   = document.getElementById('bibBookTitleBar');
    const zl   = document.getElementById('bibZoomLabel');
    if (pn)  pn.value    = _currentPage;
    if (pt)  pt.textContent = _pdfDoc ? _pdfDoc.numPages : '?';
    if (tb)  tb.textContent = _currentBook ? _currentBook.title : '';
    if (zl)  zl.textContent = Math.round(_zoom * 100) + '%';
  }

  // ── Navegación ────────────────────────────────────────

  async function prevPage() {
    if (_currentPage > 1) await _renderPage(_currentPage - 1);
  }

  async function nextPage() {
    if (_pdfDoc && _currentPage < _pdfDoc.numPages) await _renderPage(_currentPage + 1);
  }

  async function goToPage(n) {
    if (!_pdfDoc) return;
    const clamped = Math.max(1, Math.min(_pdfDoc.numPages, n || 1));
    await _renderPage(clamped);
  }

  function zoomIn() {
    _zoom = Math.min(3.0, _zoom + 0.25);
    if (_pdfDoc) _renderPage(_currentPage);
  }

  function zoomOut() {
    _zoom = Math.max(0.25, _zoom - 0.25);
    if (_pdfDoc) _renderPage(_currentPage);
  }

  function fitWidth() {
    const wrap = document.getElementById('bibCanvasWrap');
    if (!wrap || !_pdfDoc) return;
    _pdfDoc.getPage(_currentPage).then(page => {
      const vp  = page.getViewport({ scale: 1 });
      _zoom = (wrap.clientWidth - 32) / vp.width;
      _renderPage(_currentPage);
    });
  }

  // ── Búsqueda ──────────────────────────────────────────

  function onSearchInput(value) {
    clearTimeout(_searchTimer);
    const clear = document.getElementById('bibSearchClear');
    if (clear) clear.style.display = value ? 'flex' : 'none';
    if (!value.trim()) {
      _clearResults();
      if (_currentBook) _showViewer();
      else _showWelcome();
      return;
    }
    _searchTimer = setTimeout(() => _doSearch(value.trim()), 350);
  }

  function clearSearch() {
    const inp = document.getElementById('bibSearchInput');
    if (inp) inp.value = '';
    onSearchInput('');
  }

  // Palabras clave que indican una página con descripción real de hechizo/regla
  const _ENTRY_SIGNALS = [
    'tiempo de lanzamiento', 'casting time', 'tiempo de conjuro',
    'alcance:', 'range:', 'duración:', 'duration:',
    'componentes:', 'components:',
    'acción de bonus', 'bonus action',
  ];

  function _isEntryPage(text) {
    const t = text.toLowerCase();
    let hits = 0;
    for (const sig of _ENTRY_SIGNALS) {
      if (t.includes(sig)) hits++;
      if (hits >= 2) return true;  // 2+ señales = ficha real
    }
    return false;
  }

  function _doSearch(query) {
    const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
    const scope = _currentBook ? [_currentBook] : _books;

    const main  = [];  // páginas con ficha real
    const refs  = [];  // menciones secundarias

    for (const book of scope) {
      for (const pg of (book.pages || [])) {
        const textLow = pg.text.toLowerCase();
        if (!terms.every(t => textLow.includes(t))) continue;

        // Snippet: para fichas reales tomamos más contexto desde donde aparece el término
        const idx   = textLow.indexOf(terms[0]);
        const isEntry = _isEntryPage(pg.text);

        // Para fichas reales: mostrar desde el título hasta la descripción (más contexto)
        const start = isEntry ? Math.max(0, idx - 20) : Math.max(0, idx - 80);
        const end   = isEntry
          ? Math.min(pg.text.length, idx + 400)
          : Math.min(pg.text.length, idx + 160);

        let snippet = pg.text.slice(start, end).trim();
        if (start > 0) snippet = '…' + snippet;
        if (end < pg.text.length) snippet += '…';

        let highlighted = _esc(snippet);
        for (const t of terms) {
          highlighted = highlighted.replace(new RegExp(`(${_escRe(t)})`, 'gi'), '<mark>$1</mark>');
        }

        const r = { bookId: book.id, bookTitle: book.title, page: pg.page, snippet: highlighted, isEntry };
        if (isEntry) main.push(r); else refs.push(r);

        if (main.length + refs.length >= 200) break;
      }
      if (main.length + refs.length >= 200) break;
    }

    _renderResults(query, main, refs, scope.length > 1);
  }

  function _renderResults(query, main, refs, multiBook) {
    const header = document.getElementById('bibResultsHeader');
    const list   = document.getElementById('bibResultsList');
    if (!header || !list) return;

    const total = main.length + refs.length;
    const scopeLabel = multiBook
      ? 'todos los manuales'
      : `"${_currentBook ? _currentBook.title : ''}"`;

    header.innerHTML = total > 0
      ? `<span class="bib-res-count">${total}${total >= 200 ? '+' : ''} resultado${total !== 1 ? 's' : ''}</span>
         <span class="bib-res-scope">en ${scopeLabel}</span>`
      : `<span class="bib-res-none">Sin resultados para "<em>${_esc(query)}</em>" en ${scopeLabel}</span>`;

    let html = '';

    // Fichas reales primero
    if (main.length) {
      html += main.map(r => `
        <div class="bib-result-item bib-result-entry" onclick="Biblioteca.jumpToResult('${r.bookId}', ${r.page})">
          <div class="bib-res-header">
            <span class="bib-res-entry-badge">📖 Descripción</span>
            <span class="bib-res-book">${multiBook ? _esc(r.bookTitle) + ' · ' : ''}pág. ${r.page}</span>
          </div>
          <div class="bib-res-snippet">${r.snippet}</div>
        </div>`).join('');
    }

    // Menciones secundarias colapsadas
    if (refs.length) {
      const refId = 'bibRefs_' + Date.now();
      html += `
        <div class="bib-refs-toggle" onclick="
          var el=document.getElementById('${refId}');
          var btn=this.querySelector('.bib-refs-toggle-btn');
          var open=el.style.display!=='none';
          el.style.display=open?'none':'block';
          btn.textContent=open?'Ver ${refs.length} menciones ▾':'Ocultar menciones ▴';
        ">
          <span class="bib-refs-toggle-btn">Ver ${refs.length} mencion${refs.length !== 1 ? 'es' : ''} ▾</span>
        </div>
        <div id="${refId}" style="display:none">
          ${refs.map(r => `
            <div class="bib-result-item bib-result-ref" onclick="Biblioteca.jumpToResult('${r.bookId}', ${r.page})">
              <div class="bib-res-header">
                <span class="bib-res-book">${multiBook ? _esc(r.bookTitle) + ' · ' : ''}pág. ${r.page}</span>
              </div>
              <div class="bib-res-snippet">${r.snippet}</div>
            </div>`).join('')}
        </div>`;
    }

    list.innerHTML = html;
    _hideViewer();
    _hideWelcome();
    document.getElementById('bibResults').style.display = 'flex';
  }

  function _clearResults() {
    const res = document.getElementById('bibResults');
    if (res) res.style.display = 'none';
  }

  async function jumpToResult(bookId, page) {
    clearSearch();
    if (!_currentBook || _currentBook.id !== bookId) {
      await openBook(bookId);
    }
    await goToPage(page);
    _showViewer();
  }

  // ── Eliminar libro ────────────────────────────────────

  async function deleteCurrentBook() {
    if (!_currentBook) return;
    const title = _currentBook.title;
    if (!confirm(`¿Eliminar "${title}" de la biblioteca?\nEsto no puede deshacerse.`)) return;

    const id = _currentBook.id;
    await _dbDelete(STORE_BOOKS, id);
    await _dbDelete(STORE_PDFS, id);
    _books = _books.filter(b => b.id !== id);
    _currentBook = null;
    _pdfDoc = null;
    _renderBookList();
    _showWelcome();
    _hideViewer();
    _toast(`"${title}" eliminado`, 'ok');
  }

  // ── Mostrar/ocultar zonas ─────────────────────────────

  function _showWelcome() {
    _el('bibWelcome').style.display  = 'flex';
    _el('bibResults').style.display  = 'none';
    _el('bibViewer').style.display   = 'none';
    _el('bibLoading').style.display  = 'none';
  }

  function _showViewer() {
    _el('bibWelcome').style.display  = 'none';
    _el('bibResults').style.display  = 'none';
    _el('bibViewer').style.display   = 'flex';
    _el('bibLoading').style.display  = 'none';
  }

  function _hideViewer() {
    _el('bibViewer').style.display = 'none';
  }

  function _hideWelcome() {
    _el('bibWelcome').style.display = 'none';
  }

  function _showLoading(msg) {
    _el('bibLoadingText').textContent = msg || 'Cargando…';
    _el('bibLoadingBar').style.width  = '0%';
    _el('bibLoadingSub').textContent  = '';
    _el('bibWelcome').style.display   = 'none';
    _el('bibResults').style.display   = 'none';
    _el('bibViewer').style.display    = 'none';
    _el('bibLoading').style.display   = 'flex';
  }

  function _setLoadingProgress(current, total, label) {
    const pct = Math.round((current / total) * 100);
    _el('bibLoadingBar').style.width    = pct + '%';
    _el('bibLoadingSub').textContent    = `Pág. ${current} / ${total} — ${label}`;
  }

  function _hideLoading() {
    _el('bibLoading').style.display = 'none';
  }

  // ── Cuando el tab se activa ───────────────────────────

  function onTabActivated() {
    if (!_db) {
      init();
    } else {
      if (_currentBook && _pdfDoc) {
        setTimeout(() => fitWidth(), 100);
      }
    }
    // Reconstruir índice de referencia (puede haber cambiado el PJ activo)
    _buildRefIndex();
    if (_sideTab === 'referencia') _renderRef();
  }

  // ── REFERENCIA RÁPIDA ─────────────────────────────────

  function switchSideTab(tab) {
    _sideTab = tab;
    const btnM = document.getElementById('bibStabManuales');
    const btnR = document.getElementById('bibStabRef');
    const pM   = document.getElementById('bibSideManual');
    const pR   = document.getElementById('bibSideRef');
    const barP = document.getElementById('bibSearchBarPdf');
    const barR = document.getElementById('bibSearchBarRef');
    const refP = document.getElementById('bibRefPanel');

    if (tab === 'manuales') {
      btnM.classList.add('active');    btnR.classList.remove('active');
      pM.style.display   = '';         pR.style.display   = 'none';
      barP.style.display = '';         barR.style.display = 'none';
      refP.style.display = 'none';
      // Restaurar vista normal
      if (_currentBook && _pdfDoc) _showViewer();
      else _showWelcome();
    } else {
      btnR.classList.add('active');    btnM.classList.remove('active');
      pR.style.display   = '';         pM.style.display   = 'none';
      barR.style.display = '';         barP.style.display = 'none';
      _hideViewer(); _hideWelcome();
      _clearResults();
      refP.style.display = 'flex';
      _buildRefIndex();
      _renderRef();
    }
  }

  function setRefFilter(filter) {
    _refFilter = filter;
    document.querySelectorAll('.bib-ref-filter').forEach(b => {
      b.classList.toggle('active', b.dataset.filter === filter);
    });
    _renderRef();
  }

  function onRefInput(value) {
    clearTimeout(_refTimer);
    _refQuery = value.trim();
    const clearBtn = document.getElementById('bibRefClear');
    if (clearBtn) clearBtn.style.display = value ? 'flex' : 'none';
    _refTimer = setTimeout(_renderRef, 200);
  }

  function clearRef() {
    const inp = document.getElementById('bibRefInput');
    if (inp) inp.value = '';
    _refQuery = '';
    const clearBtn = document.getElementById('bibRefClear');
    if (clearBtn) clearBtn.style.display = 'none';
    _renderRef();
  }

  // Construye el índice combinando hechizos del PJ, CLASE_SPELLS y CLASE_FEATURES
  function _buildRefIndex() {
    _refItems = [];

    // ── Hechizos del personaje activo ─────────────────────
    if (typeof Storage !== 'undefined' && typeof Characters !== 'undefined') {
      const activeId = Storage.getActiveId ? Storage.getActiveId() : null;
      const char     = activeId ? Storage.getChar(activeId) : null;
      if (char) {
        const prepared = new Set(char.preparedToday || []);
        (char.spells || []).forEach(sp => {
          _refItems.push({
            id:       'char-' + sp.id,
            name:     sp.name || '',
            type:     'spell',
            section:  'char',
            sectionLabel: `${char.name} — ${sp.level === 0 ? 'Cantrip' : 'Nv ' + sp.level}`,
            level:    sp.level || 0,
            castTime: sp.castTime || sp.castingTime || '',
            range:    sp.range || '',
            duration: sp.duration || '',
            desc:     sp.desc || '',
            fullDesc: sp.fullDesc || '',
            isPrepared: prepared.has(sp.id) || sp.prepared,
            concentration: sp.concentration,
            ritual:   sp.ritual,
            clase:    char.clase,
          });
        });

        // Features/resources del personaje
        (char.features || []).forEach(f => {
          if (!f || !f.name) return;
          _refItems.push({
            id:       'charfeat-' + (f.id || f.name),
            name:     f.name,
            type:     'feat',
            section:  'char',
            sectionLabel: `${char.name} — Features`,
            source:   f.source || char.clase,
            desc:     f.desc || '',
            fullDesc: f.fullDesc || '',
            action:   f.action || '',
            range:    f.range || '',
            recharge: f.recharge || null,
          });
        });
      }
    }

    // ── Hechizos de todas las clases (CLASE_SPELLS) ──────
    if (typeof Characters !== 'undefined' && Characters.CLASE_SPELLS) {
      Object.entries(Characters.CLASE_SPELLS).forEach(([clase, spells]) => {
        (spells || []).forEach(sp => {
          // No duplicar si ya está en el personaje activo
          if (_refItems.find(x => x.id === 'char-' + sp.id)) return;
          _refItems.push({
            id:       clase + '-' + sp.id,
            name:     sp.name || '',
            type:     'spell',
            section:  'spell',
            sectionLabel: `${clase} — ${sp.level === 0 ? 'Cantrip' : 'Nv ' + sp.level}`,
            level:    sp.level || 0,
            castTime: sp.castTime || sp.castingTime || '',
            range:    sp.range || '',
            duration: sp.duration || '',
            desc:     sp.desc || '',
            fullDesc: sp.fullDesc || '',
            concentration: sp.concentration,
            ritual:   sp.ritual,
            clase,
          });
        });
      });
    }

    // ── Features de todas las clases (CLASE_FEATURES) ────
    if (typeof Characters !== 'undefined' && Characters.CLASE_FEATURES) {
      Object.entries(Characters.CLASE_FEATURES).forEach(([clase, cfg]) => {
        if (!cfg) return;
        const featFn = typeof cfg.features === 'function' ? cfg.features : null;
        const feats  = featFn ? featFn(1) : (cfg.features || []);
        feats.forEach(f => {
          if (!f || !f.name) return;
          if (_refItems.find(x => x.name === f.name && x.type === 'feat' && x.clase === clase)) return;
          _refItems.push({
            id:       'feat-' + clase + '-' + (f.id || f.name),
            name:     f.name,
            type:     'feat',
            section:  'feat',
            sectionLabel: `${clase} — Features`,
            source:   f.source || clase,
            desc:     f.desc || '',
            fullDesc: f.fullDesc || '',
            action:   f.action || '',
            range:    f.range || '',
            recharge: f.recharge || null,
            clase,
          });
        });
      });
    }
  }

  function _renderRef() {
    const list = document.getElementById('bibRefList');
    if (!list) return;

    const q = _refQuery.toLowerCase();

    // Filtrar por tipo y query
    let items = _refItems.filter(item => {
      if (_refFilter === 'char'  && item.section !== 'char')  return false;
      if (_refFilter === 'spell' && item.type !== 'spell')    return false;
      if (_refFilter === 'feat'  && item.type !== 'feat')     return false;
      if (!q) return true;
      return (item.name + ' ' + item.desc + ' ' + (item.sectionLabel||'')).toLowerCase().includes(q);
    });

    // Sin búsqueda y sin filtro: mostrar solo personaje activo para no saturar
    if (!q && _refFilter === 'all') {
      items = items.filter(x => x.section === 'char');
    }

    if (items.length === 0) {
      list.innerHTML = `
        <div class="bib-ref-empty">
          ${q ? `Sin resultados para "<strong>${_esc(q)}</strong>"` : 'Buscá una habilidad o hechizo arriba'}
        </div>`;
      return;
    }

    // Agrupar por sección
    const groups = {};
    items.forEach(item => {
      const k = item.sectionLabel || 'Otros';
      if (!groups[k]) groups[k] = [];
      groups[k].push(item);
    });

    // Ordenar: char primero, luego alfabético
    const sortedGroups = Object.entries(groups).sort(([a], [b]) => {
      const aChar = items.find(x => x.sectionLabel === a)?.section === 'char';
      const bChar = items.find(x => x.sectionLabel === b)?.section === 'char';
      if (aChar && !bChar) return -1;
      if (!aChar && bChar) return 1;
      return a.localeCompare(b);
    });

    list.innerHTML = sortedGroups.map(([label, groupItems]) => `
      <div class="bib-ref-group">
        <div class="bib-ref-group-title">${_esc(label)}</div>
        ${groupItems.map(item => _renderRefCard(item, q)).join('')}
      </div>
    `).join('');
  }

  function _renderRefCard(item, q) {
    const isSpell = item.type === 'spell';

    // Tags del hechizo
    const tags = [];
    if (isSpell) {
      if (item.castTime) tags.push(`<span class="ref-tag">${_esc(item.castTime)}</span>`);
      if (item.range)    tags.push(`<span class="ref-tag">${_esc(item.range)}</span>`);
      if (item.duration) tags.push(`<span class="ref-tag">${_esc(item.duration)}</span>`);
      if (item.concentration) tags.push(`<span class="ref-tag ref-tag--conc">Conc.</span>`);
      if (item.ritual)        tags.push(`<span class="ref-tag ref-tag--ritual">Ritual</span>`);
    } else {
      if (item.action)   tags.push(`<span class="ref-tag">${_esc(item.action)}</span>`);
      if (item.range)    tags.push(`<span class="ref-tag">${_esc(item.range)}</span>`);
      if (item.recharge) tags.push(`<span class="ref-tag ref-tag--recharge">${item.recharge === 'short' ? '↺ Corto' : '☀ Largo'}</span>`);
    }

    // Resaltar query en nombre y desc
    const name = q ? _highlight(item.name, q) : _esc(item.name);
    const desc = q ? _highlight(item.desc || '', q) : _esc(item.desc || '');

    const badge = isSpell
      ? `<span class="ref-badge ref-badge--spell">${item.level === 0 ? 'Truco' : 'Nv ' + item.level}</span>`
      : `<span class="ref-badge ref-badge--feat">Feature</span>`;

    const prepDot = item.isPrepared ? '<span class="ref-prepared-dot" title="Preparado">◆</span>' : '';

    return `
      <div class="bib-ref-card" onclick="this.classList.toggle('expanded')">
        <div class="bib-ref-card-header">
          <div class="bib-ref-card-name">${prepDot}${name}</div>
          <div class="bib-ref-card-badges">${badge}</div>
        </div>
        ${tags.length ? `<div class="bib-ref-card-tags">${tags.join('')}</div>` : ''}
        ${desc ? `<div class="bib-ref-card-desc">${desc}</div>` : ''}
        ${item.fullDesc ? `<div class="bib-ref-card-full">${_esc(item.fullDesc)}</div>` : ''}
      </div>`;
  }

  function _highlight(text, q) {
    const escaped = _esc(text);
    if (!q) return escaped;
    const re = new RegExp(`(${_escRe(q)})`, 'gi');
    return escaped.replace(re, '<mark>$1</mark>');
  }

  // ── Utilidades ────────────────────────────────────────

  function _el(id) {
    return document.getElementById(id) || { style: {}, textContent: '', innerHTML: '' };
  }

  function _esc(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function _escRe(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function _toast(msg, type) {
    const el = document.getElementById('toast');
    if (!el) return;
    el.textContent = msg;
    el.className   = 'toast show' + (type === 'error' ? ' toast-error' : '');
    clearTimeout(_toast._t);
    _toast._t = setTimeout(() => el.classList.remove('show'), 3000);
  }

  // ── API pública ───────────────────────────────────────

  return {
    init,
    openBook,
    prevPage,
    nextPage,
    goToPage,
    zoomIn,
    zoomOut,
    fitWidth,
    onSearchInput,
    clearSearch,
    jumpToResult,
    deleteCurrentBook,
    onTabActivated,
    switchSideTab,
    setRefFilter,
    onRefInput,
    clearRef,
  };

})();
