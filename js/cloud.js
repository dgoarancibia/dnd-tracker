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
import './firebase.js';

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
  async function saveNow(char, opts = {}) {
    if (!_uid || !navigator.onLine || _pulling) return 'skipped';
    // Verificación de conflicto: si la nube tiene un updatedAt posterior al del
    // char local, otro dispositivo guardó algo más nuevo. No pisar salvo que
    // el llamador fuerce (opts.force) tras confirmar con el usuario.
    if (!opts.force) {
      try {
        const cloudChar = await _withTimeout(FirebaseApp.loadCharCloud(_uid, char.id), 10000);
        if (cloudChar) {
          const cloudTs = new Date(cloudChar.updatedAt || 0).getTime();
          const localTs = new Date(char.updatedAt || 0).getTime();
          if (cloudTs > localTs) return 'conflict';
        }
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
    try {
      await _withTimeout(FirebaseApp.saveCharCloud(_uid, char), 12000);
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
    if (!_uid || !navigator.onLine) return;
    try {
      await FirebaseApp.deleteCharCloud(_uid, charId);
    } catch (e) {
      console.error('Cloud delete error:', e);
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
    markDeleted,
    deleteChar,
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
