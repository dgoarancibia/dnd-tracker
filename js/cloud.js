/* ═══════════════════════════════════════════════════════
   cloud.js — Sincronización Firestore (modelo SAVEPOINT)
   Módulo ESM — importa firebase.js, exporta Cloud global

   MODELO: nada se sube ni baja automáticamente al iniciar sesión, y no hay
   listener en tiempo real. Esos mecanismos causaban que un dispositivo pisara
   silenciosamente los datos de otro. Ahora:
     - El guardado LOCAL es instantáneo en cada cambio (lo hace app.js/storage.js).
     - La subida a la nube es EXPLÍCITA: saveNow() (guardado manual / autosave
       controlado), y siempre verifica el timestamp de la nube antes de pisar.
     - La bajada es EXPLÍCITA: forcePullFromCloud() (botón "Sincronizar desde nube").
   ═══════════════════════════════════════════════════════ */
// Misma URL que importa app.html: con otra ?v= el módulo se evaluaba dos veces.
// Al subir la versión de firebase.js hay que cambiarla en ambos lados.
import './firebase.js?v=6';

const Cloud = (() => {
  let _uid     = null;    // UID del usuario autenticado
  let _pulling = false;   // true mientras un pull desde la nube está en curso —
                          // bloquea saves que podrían pisarlo con datos viejos en memoria

  /* ══════════════════════════════════════════════════════
     ESTADO DE SYNC
  ══════════════════════════════════════════════════════ */

  const SyncState = {
    IDLE:    'idle',
    SAVING:  'saving',
    SAVED:   'saved',
    ERROR:   'error',
    OFFLINE: 'offline'
  };

  let _syncState = SyncState.IDLE;

  function _setSyncState(state, extra) {
    _syncState = state;
    const el = document.getElementById('syncStatus');
    if (!el) return;

    el.className = 'sync-status sync-' + state;

    const icons = {
      idle:    '',
      saving:  '↑',
      saved:   '✓',
      error:   '⚠',
      offline: '○'
    };
    const labels = {
      idle:    '',
      saving:  'Guardando…',
      saved:   'Guardado',
      error:   'Error al guardar',
      offline: 'Sin conexión'
    };

    let text = labels[state] || '';
    if (state === SyncState.SAVED && extra) {
      const d = new Date(extra);
      const hm = d.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
      text += ` ${hm}`;
    }
    if (state === SyncState.ERROR && extra) {
      text += `: ${extra}`;
    }

    el.textContent = icons[state] ? `${icons[state]} ${text}` : text;
    el.style.display = state === SyncState.IDLE ? 'none' : 'flex';
  }

  /* ══════════════════════════════════════════════════════
     AUTH
  ══════════════════════════════════════════════════════ */

  function init() {
    if (!window.FirebaseApp) return;

    // MODELO SAVEPOINT: al iniciar sesión NO se baja ni sube nada automáticamente,
    // ni se abre un listener en tiempo real. El usuario decide explícitamente
    // cuándo bajar (Sincronizar desde nube) y cuándo subir (guardado manual /
    // autosave controlado con verificación de conflicto).
    FirebaseApp.onAuthChange(user => {
      _uid = user ? user.uid : null;
      _updateAuthUI(user);
      if (user) {
        // Solo limpiar de Firestore los personajes que el usuario eliminó.
        purgeDeletedFromCloud();
      }
    });

    // Detectar online/offline (incluye estado inicial)
    if (!navigator.onLine) _setSyncState(SyncState.OFFLINE);
    window.addEventListener('online',  () => { _setSyncState(SyncState.IDLE); });
    window.addEventListener('offline', () => _setSyncState(SyncState.OFFLINE));
  }

  function _updateAuthUI(user) {
    const loginBtn  = document.getElementById('loginBtn');
    const logoutBtn = document.getElementById('logoutBtn');
    const userLabel = document.getElementById('userLabel');

    if (!loginBtn) return;

    const cloudBtns = ['cloudSaveBtn', 'checkpointBtn', 'loadPointBtn']
      .map(id => document.getElementById(id)).filter(Boolean);
    if (user) {
      loginBtn.style.display  = 'none';
      logoutBtn.style.display = 'inline-flex';
      cloudBtns.forEach(b => b.style.display = 'inline-flex');
      if (userLabel) {
        userLabel.textContent = user.displayName || user.email || '';
        userLabel.style.display = 'inline';
      }
    } else {
      loginBtn.style.display  = 'inline-flex';
      logoutBtn.style.display = 'none';
      cloudBtns.forEach(b => b.style.display = 'none');
      if (userLabel) userLabel.style.display = 'none';
      _setSyncState(SyncState.IDLE);
    }
  }

  async function signIn() {
    try {
      await FirebaseApp.signIn();
    } catch (e) {
      console.error('Login error:', e);
      _setSyncState(SyncState.ERROR, 'No se pudo iniciar sesión');
    }
  }

  async function signOut() {
    try {
      await FirebaseApp.signOutUser();
    } catch (e) {
      console.error('Logout error:', e);
    }
  }

  function isLoggedIn() {
    return !!_uid;
  }

  // IDs borrados en esta sesión (en memoria, para respuesta inmediata)
  const _deletedIds = new Set();

  function markDeleted(id) {
    _deletedIds.add(id);
  }

  /* ══════════════════════════════════════════════════════
     VERSIÓN BASE (control de concurrencia optimista)
     Por cada personaje se recuerda el updatedAt de la versión de la nube
     de la que parte la copia local: la última que se subió o se bajó.
     Antes el conflicto se decidía comparando "quién editó último": un
     dispositivo con datos de hace una semana editaba algo, su updatedAt
     pasaba a ser "ahora" y pisaba en silencio la sesión del otro. Ahora la
     pregunta es "¿la nube cambió desde mi última sincronización?", que no
     depende de los relojes de cada dispositivo.
  ══════════════════════════════════════════════════════ */

  const _baseKey = id => 'dnd_cloud_base_' + id;
  function getBase(id) {
    try { return localStorage.getItem(_baseKey(id)) || null; } catch (e) { return null; }
  }
  function setBase(id, ts) {
    try {
      if (ts) localStorage.setItem(_baseKey(id), ts);
      else localStorage.removeItem(_baseKey(id));
    } catch (e) { /* sin storage: se cae a la comparación por fecha */ }
  }

  // ¿La nube tiene cambios que esta copia local no conoce?
  function nubeCambio(char, cloudChar) {
    if (!cloudChar) return false;
    if (cloudChar.updatedAt && cloudChar.updatedAt === char.updatedAt) return false;
    const base = getBase(char.id);
    if (base) return cloudChar.updatedAt !== base;
    // Sin base (primera vez con esta versión de la app): no se sabe de qué
    // versión parte la local, así que cualquier diferencia se decide una vez
    // con el usuario. Decidir por fecha era justamente lo que pisaba datos.
    return true;
  }

  // Firestore rechaza documentos de más de 1 MB; el personaje entero es uno.
  const LIMITE_BYTES = 1048576;
  function _tamano(char) {
    try {
      const { noteMentions, ...resto } = char;   // no viaja a la nube
      return new Blob([JSON.stringify(resto)]).size;
    } catch (e) { return 0; }
  }

  /* ══════════════════════════════════════════════════════
     GUARDADO A NUBE (explícito, con verificación de conflicto)
  ══════════════════════════════════════════════════════ */

  // scheduleSave ya NO sube a la nube en cada cambio. El guardado local lo hace
  // app.js/storage.js de forma instantánea. La subida a nube es explícita
  // (saveNow) o por autosave controlado. Se mantiene la firma para no romper
  // llamadas existentes, pero es un no-op respecto a la nube.
  function scheduleSave(char) { /* no-op: modelo savepoint, subida explícita */ }

  // Envuelve una promesa con timeout, para que un Firestore colgado no deje
  // la UI (overlay "Guardando…") pegada indefinidamente.
  function _withTimeout(promise, ms) {
    return Promise.race([
      promise,
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms))
    ]);
  }

  async function _doSave(char) {
    if (!_uid) return;
    try {
      await _withTimeout(FirebaseApp.saveCharCloud(_uid, char), 12000);
      _setSyncState(SyncState.SAVED, new Date().toISOString());
    } catch (e) {
      console.error('Cloud save error:', e);
      const msg = e.message === 'timeout' ? 'tiempo agotado' : (e.code === 'unavailable' ? 'sin conexión' : e.message);
      _setSyncState(SyncState.ERROR, msg);
    }
  }

  // Resultado de saveNow para que el llamador sepa qué pasó:
  //   'saved'    → subió correctamente
  //   'conflict' → la nube tiene algo más nuevo; NO se subió (el llamador decide)
  //   'skipped'  → sin sesión / sin conexión / pull en curso
  //   'error'    → falló la subida
  //   'toolarge' → supera el límite de 1 MB de Firestore; NO se subió
  async function saveNow(char, opts = {}) {
    if (!_uid || !navigator.onLine || _pulling) return 'skipped';
    // Verificación de conflicto: si la nube tiene un updatedAt posterior al del
    // char local, otro dispositivo guardó algo más nuevo. No pisar salvo que
    // el llamador fuerce (opts.force) tras confirmar con el usuario.
    if (!opts.force) {
      try {
        const cloudChar = await _withTimeout(FirebaseApp.loadCharCloud(_uid, char.id), 10000);
        if (nubeCambio(char, cloudChar)) return 'conflict';
      } catch (e) {
        // Si falla la verificación (ej. sin red o timeout), no arriesgar: reportar error.
        return 'error';
      }
    } else {
      // Sobreescritura forzada: sellar con timestamp fresco para que esta versión
      // quede como la MÁS NUEVA en la nube. Sin esto se subiría con el updatedAt
      // viejo del char local y una futura carga la vería como más antigua.
      char.updatedAt = new Date().toISOString();
      if (Storage.saveCharRaw) Storage.saveCharRaw(char); // reflejar el ts nuevo en local
    }
    const bytes = _tamano(char);
    if (bytes > LIMITE_BYTES * 0.97) {
      _setSyncState(SyncState.ERROR, 'personaje demasiado grande para la nube');
      return 'toolarge';
    }
    try {
      await _withTimeout(FirebaseApp.saveCharCloud(_uid, char), 12000);
      setBase(char.id, char.updatedAt);
      _setSyncState(SyncState.SAVED, new Date().toISOString());
      return 'saved';
    } catch (e) {
      console.error('Cloud saveNow error:', e);
      _setSyncState(SyncState.ERROR, e.message === 'timeout' ? 'tiempo agotado' : (e.code === 'unavailable' ? 'sin conexión' : e.message));
      return 'error';
    }
  }

  // Lee el char de la nube (para comparar versiones antes de abrir/guardar).
  async function loadCloudChar(id) {
    if (!_uid || !navigator.onLine) return null;
    try {
      return await FirebaseApp.loadCharCloud(_uid, id);
    } catch (e) {
      return null;
    }
  }

  /* ══════════════════════════════════════════════════════
     CHECKPOINTS (savepoints manuales con historial)
  ══════════════════════════════════════════════════════ */

  const CHECKPOINT_MAX = 15; // por personaje; los más viejos se podan

  // ── Cache local de checkpoints (para verlos/restaurarlos sin conexión) ──
  const _cpMetaKey = id => 'dnd_cp_meta_' + id;   // lista de metadata por personaje
  const _cpDataKey = (id, cp) => 'dnd_cp_' + id + '_' + cp; // char completo por checkpoint

  function _cacheCheckpointMeta(charId, list) {
    try { localStorage.setItem(_cpMetaKey(charId), JSON.stringify(list)); } catch (e) {}
  }
  function _getCachedCheckpointMeta(charId) {
    try { return JSON.parse(localStorage.getItem(_cpMetaKey(charId)) || '[]'); } catch (e) { return []; }
  }
  function _cacheCheckpointData(charId, cpId, char) {
    try { localStorage.setItem(_cpDataKey(charId, cpId), JSON.stringify(char)); } catch (e) {}
  }
  function _getCachedCheckpointData(charId, cpId) {
    try {
      const raw = localStorage.getItem(_cpDataKey(charId, cpId));
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }

  // Crea un checkpoint del char dado. cpId = ISO timestamp (ordenable/único).
  // Devuelve 'saved' | 'skipped' | 'error'.
  async function saveCheckpoint(char, label, cpId) {
    if (!_uid || !navigator.onLine) return 'skipped';
    try {
      await FirebaseApp.saveCheckpointCloud(_uid, char.id, cpId, label, char);
      _cacheCheckpointData(char.id, cpId, char); // cache local para restaurar offline
      // Podar los más viejos si se superó el máximo.
      const list = await FirebaseApp.listCheckpointsCloud(_uid, char.id);
      if (list.length > CHECKPOINT_MAX) {
        const extra = list.slice(CHECKPOINT_MAX); // ya viene ordenado más-nuevo-primero
        for (const cp of extra) {
          FirebaseApp.deleteCheckpointCloud(_uid, char.id, cp.id).catch(() => {});
          try { localStorage.removeItem(_cpDataKey(char.id, cp.id)); } catch (e) {}
        }
      }
      _cacheCheckpointMeta(char.id, list.slice(0, CHECKPOINT_MAX));
      return 'saved';
    } catch (e) {
      console.error('saveCheckpoint error:', e);
      return 'error';
    }
  }

  // Devuelve la lista de checkpoints. Si no hay conexión, cae al cache local.
  async function listCheckpoints(charId) {
    if (!_uid) return [];
    if (!navigator.onLine) return _getCachedCheckpointMeta(charId);
    try {
      const list = await FirebaseApp.listCheckpointsCloud(_uid, charId);
      _cacheCheckpointMeta(charId, list); // refrescar cache
      return list;
    } catch (e) {
      return _getCachedCheckpointMeta(charId); // fallback offline
    }
  }

  // Trae el char completo de un checkpoint. Si no hay conexión, cae al cache.
  async function loadCheckpoint(charId, cpId) {
    if (!_uid) return null;
    if (!navigator.onLine) return _getCachedCheckpointData(charId, cpId);
    try {
      const char = await FirebaseApp.loadCheckpointCloud(_uid, charId, cpId);
      if (char) _cacheCheckpointData(charId, cpId, char); // cachear al vuelo
      return char;
    } catch (e) {
      return _getCachedCheckpointData(charId, cpId); // fallback offline
    }
  }

  async function deleteCheckpoint(charId, cpId) {
    try { localStorage.removeItem(_cpDataKey(charId, cpId)); } catch (e) {}
    if (!_uid || !navigator.onLine) return;
    try {
      await FirebaseApp.deleteCheckpointCloud(_uid, charId, cpId);
      // Refrescar cache de metadata
      const list = await FirebaseApp.listCheckpointsCloud(_uid, charId);
      _cacheCheckpointMeta(charId, list);
    } catch (e) {}
  }

  /* ══════════════════════════════════════════════════════
     FORCE PULL — sobreescribe local con versión de nube
  ══════════════════════════════════════════════════════ */

  async function forcePullFromCloud() {
    // Si _uid aún no está listo (Firebase tardó en restaurar sesión), esperar hasta 5s
    if (!_uid) {
      if (!navigator.onLine) {
        if (window.App?.showToast) App.showToast('Sin conexión', 'error', 3000);
        _setSyncState(SyncState.ERROR, 'sin conexión');
        return;
      }
      if (window.App?.showToast) App.showToast('Esperando sesión…', 'info', 2000);
      await new Promise(resolve => {
        let tries = 0;
        const iv = setInterval(() => {
          tries++;
          if (_uid || tries >= 25) { clearInterval(iv); resolve(); }
        }, 200);
      });
      if (!_uid) {
        if (window.App?.showToast) App.showToast('No hay sesión activa — iniciá sesión primero', 'error', 4000);
        _setSyncState(SyncState.ERROR, 'sin sesión');
        return;
      }
    }
    // Bloquea saveNow mientras el pull corre, para que ningún guardado suba el
    // char viejo en memoria y pise lo que este pull está bajando.
    _pulling = true;
    _setSyncState(SyncState.SAVING);
    if (window.App?.showToast) App.showToast('Sincronizando desde nube…', 'info', 2000);
    try {
      const cloudChars = await FirebaseApp.loadAllCharsCloud(_uid);
      const persistedDeleted = Storage.getDeletedIds ? Storage.getDeletedIds() : new Set();
      const isBlocked = id => _deletedIds.has(id) || persistedDeleted.has(id);

      // Borrar de Firestore los que están en lista negra pero siguen en la nube
      for (const id of Object.keys(cloudChars)) {
        if (isBlocked(id)) {
          FirebaseApp.deleteCharCloud(_uid, id).catch(() => {});
          delete cloudChars[id];
        }
      }
      const count = Object.keys(cloudChars).length;
      for (const char of Object.values(cloudChars)) {
        const migrated = Storage.migrateChar ? Storage.migrateChar(char) : char;
        Storage.saveCharRaw(migrated);
        setBase(char.id, char.updatedAt);
      }
      const activeId = Storage.getActiveId();
      const rawFresh = activeId ? cloudChars[activeId] : null;
      const freshChar = rawFresh ? (Storage.migrateChar ? Storage.migrateChar(rawFresh) : rawFresh) : null;
      if (window.App && freshChar) {
        App.reloadChar(freshChar);
        if (window.App.showToast) App.showToast(`✓ Sincronizado (${count} chars)`, 'success', 4000);
      } else if (count > 0) {
        if (window.App && window.App.showToast) App.showToast(`✓ ${count} chars guardados. Recargando…`, 'success', 2000);
        setTimeout(() => window.location.reload(), 2000);
      } else {
        if (window.App?.showToast) App.showToast('⚠ Nube vacía — no hay datos', 'error', 5000);
      }
      _setSyncState(SyncState.SAVED, new Date().toISOString());
    } catch (e) {
      _setSyncState(SyncState.ERROR, e.message);
    } finally {
      _pulling = false;
    }
  }

  // Borra de Firestore todos los IDs que están en la lista negra local
  // Se llama al iniciar sesión para limpiar personajes eliminados que siguen en la nube
  async function purgeDeletedFromCloud() {
    if (!_uid || !navigator.onLine) return;
    const persistedDeleted = Storage.getDeletedIds ? Storage.getDeletedIds() : new Set();
    if (persistedDeleted.size === 0) return;
    try {
      const cloudChars = await FirebaseApp.loadAllCharsCloud(_uid);
      for (const id of Object.keys(cloudChars)) {
        if (persistedDeleted.has(id)) {
          await FirebaseApp.markDeletedCloud(_uid, id).catch(() => {});
          await FirebaseApp.deleteCharCloud(_uid, id).catch(() => {});
          console.log(`[Cloud] Purgado de Firestore: ${id}`);
        }
      }
    } catch (e) {
      console.warn('[Cloud] purgeDeletedFromCloud error:', e);
    }
  }

  /* ══════════════════════════════════════════════════════
     DELETE CHAR
  ══════════════════════════════════════════════════════ */

  async function deleteChar(charId) {
    _deletedIds.add(charId);
    if (!_uid || !navigator.onLine) return;   // la lista negra local lo subirá después
    try {
      await FirebaseApp.markDeletedCloud(_uid, charId);
      await FirebaseApp.deleteCharCloud(_uid, charId);
      setBase(charId, null);
    } catch (e) {
      console.error('Cloud delete error:', e);
    }
  }

  // Restaurado desde la papelera: quitar la marca para que vuelva a subirse.
  // Sin conexión queda pendiente: si no, la próxima sync vería la marca y lo
  // mandaría de nuevo a la papelera.
  const _RESTAURADOS_KEY = 'dnd_restaurados_pend';
  const _pendientes = () => { try { return new Set(JSON.parse(localStorage.getItem(_RESTAURADOS_KEY) || '[]')); } catch (e) { return new Set(); } };
  const _guardarPendientes = set => { try { localStorage.setItem(_RESTAURADOS_KEY, JSON.stringify([...set])); } catch (e) {} };

  async function restaurado(charId) {
    _deletedIds.delete(charId);
    setBase(charId, null);
    const pend = _pendientes(); pend.add(charId); _guardarPendientes(pend);
    if (!_uid || !navigator.onLine) return;
    try {
      await FirebaseApp.unmarkDeletedCloud(_uid, charId);
      pend.delete(charId); _guardarPendientes(pend);
    } catch (e) { /* queda pendiente para la próxima sync */ }
  }

  /* ══════════════════════════════════════════════════════
     SINCRONIZAR LA LISTA DE PERSONAJES
     Antes solo se bajaba la lista si el dispositivo no tenía NINGÚN
     personaje: un personaje creado en Windows nunca aparecía en el Mac, y
     al crearlo de nuevo quedaban dos. Ahora, en ambos sentidos:
       · en la nube y no aquí               → se baja
       · aquí y no en la nube                → se sube
       · cambió solo en la nube              → se actualiza aquí
       · cambió solo aquí                    → se sube
       · cambió en ambos / sin referencia    → no se toca; se pregunta al abrirlo
       · borrado en otro dispositivo (marca) → va a la papelera de este
     `excluir`: el personaje abierto en la app, que ya gestiona _verificarNube.
  ══════════════════════════════════════════════════════ */
  let _sincronizandoLista = false;

  // Compara lo que importa: sin fechas ni noteMentions (índice que no se sube),
  // y tratando igual un campo vacío/false que uno ausente, que es lo que
  // dejan las migraciones de distintas versiones de la app.
  const _IGNORAR = new Set(['updatedAt', '_syncedAt', '_dataVersion', 'noteMentions']);
  function _canon(v) {
    if (Array.isArray(v)) return v.map(_canon);
    if (v && typeof v === 'object') {
      const o = {};
      for (const k of Object.keys(v).sort()) {
        const x = _canon(v[k]);
        if (x === undefined || x === null || x === false || x === '' ||
            (Array.isArray(x) && !x.length) || (typeof x === 'object' && x && !Array.isArray(x) && !Object.keys(x).length)) continue;
        o[k] = x;
      }
      return o;
    }
    return v;
  }
  function contenidoDistinto(a, b) {
    if (!a || !b) return true;
    const limpio = o => {
      const c = { ...o };
      for (const k of _IGNORAR) delete c[k];
      return JSON.stringify(_canon(c));
    };
    return limpio(a) !== limpio(b);
  }

  async function sincronizarLista(opts = {}) {
    if (!_uid || !navigator.onLine || _pulling || _sincronizandoLista) return null;
    _sincronizandoLista = true;
    const r = { bajados: [], actualizados: [], subidos: [], borrados: [], conflictos: [], errores: 0 };
    try {
      const [nube, marcas] = await Promise.all([
        _withTimeout(FirebaseApp.loadAllCharsCloud(_uid), 15000),
        _withTimeout(FirebaseApp.loadDeletedCloud(_uid), 15000).catch(() => new Set()),
      ]);
      const listaNegra = Storage.getDeletedIds ? Storage.getDeletedIds() : new Set();
      // Restaurados de la papelera sin conexión: quitar su marca primero.
      const pend = _pendientes();
      for (const id of pend) {
        try { await FirebaseApp.unmarkDeletedCloud(_uid, id); marcas.delete(id); pend.delete(id); } catch (e) {}
      }
      _guardarPendientes(pend);
      const locales = Storage.getAllChars();
      const migrar = c => (Storage.migrateChar ? Storage.migrateChar(c) : c);

      // Borrados aquí sin conexión: subir la marca y quitar de la nube.
      for (const id of listaNegra) {
        if (!marcas.has(id)) { FirebaseApp.markDeletedCloud(_uid, id).catch(() => {}); marcas.add(id); }
        if (nube[id]) { FirebaseApp.deleteCharCloud(_uid, id).catch(() => {}); delete nube[id]; }
      }

      // Borrados en otro dispositivo.
      for (const id of marcas) {
        if (nube[id]) { FirebaseApp.deleteCharCloud(_uid, id).catch(() => {}); delete nube[id]; }
        if (locales[id] && id !== opts.excluir) {
          Storage.deleteChar(id);          // a la papelera: recuperable
          setBase(id, null);
          r.borrados.push(locales[id].name || id);
          delete locales[id];
        }
      }

      // Nube → este dispositivo.
      for (const [id, cloud] of Object.entries(nube)) {
        if (!cloud.id) cloud.id = id;
        if (id === opts.excluir || listaNegra.has(id)) continue;
        const local = locales[id];
        if (!local) {
          Storage.saveCharRaw(migrar(cloud));
          setBase(id, cloud.updatedAt);
          r.bajados.push(cloud.name || id);
          continue;
        }
        const base = getBase(id);
        if (local.updatedAt === cloud.updatedAt) { if (!base) setBase(id, cloud.updatedAt); continue; }
        // Sin base pero idénticos: misma versión con otra fecha (igual que al abrirlo).
        if (!base && !contenidoDistinto(local, migrar(JSON.parse(JSON.stringify(cloud))))) {
          Storage.saveCharRaw({ ...local, updatedAt: cloud.updatedAt });
          setBase(id, cloud.updatedAt);
          continue;
        }
        const cambioLocal = base ? local.updatedAt !== base : true;
        const cambioNube = base ? cloud.updatedAt !== base : true;
        if (base && !cambioLocal && cambioNube) {
          Storage.saveCharRaw(migrar(cloud));
          setBase(id, cloud.updatedAt);
          r.actualizados.push(cloud.name || id);
        } else if (base && cambioLocal && !cambioNube) {
          const res = await saveNow(local);
          if (res === 'saved') r.subidos.push(local.name || id); else r.errores++;
        } else {
          r.conflictos.push(id);
        }
      }

      // Este dispositivo → nube: lo que la nube no tiene.
      for (const [id, local] of Object.entries(locales)) {
        if (nube[id] || marcas.has(id) || listaNegra.has(id) || id === opts.excluir) continue;
        const res = await saveNow(local);
        if (res === 'saved') r.subidos.push(local.name || id); else r.errores++;
      }
      return r;
    } catch (e) {
      console.warn('[Cloud] sincronizarLista:', e);
      return null;
    } finally {
      _sincronizandoLista = false;
    }
  }

  return {
    init,
    signIn,
    signOut,
    isLoggedIn,
    scheduleSave,
    saveNow,
    loadCloudChar,
    getBase,
    setBase,
    nubeCambio,
    contenidoDistinto,
    tamano: _tamano,
    LIMITE_BYTES,
    markDeleted,
    deleteChar,
    restaurado,
    sincronizarLista,
    forcePullFromCloud,
    purgeDeletedFromCloud,
    saveCheckpoint,
    listCheckpoints,
    loadCheckpoint,
    deleteCheckpoint,
  };
})();

// Exponer globalmente (necesario porque cloud.js es módulo ESM — scope aislado)
window.Cloud = Cloud;

// Auto-inicializar
Cloud.init();
