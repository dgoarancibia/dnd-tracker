/* ═══════════════════════════════════════════════════════
   cloud.js — Sincronización Firestore + estado de sync
   Módulo ESM — importa firebase.js, exporta Cloud global
   ═══════════════════════════════════════════════════════ */
import './firebase.js';

const Cloud = (() => {
  let _uid        = null;   // UID del usuario autenticado
  let _debTimer   = null;   // timer para debounce de autosave
  let _unsubListen = null;  // unsub del onSnapshot listener
  const DEBOUNCE_MS = 2000;

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

    // onAuthStateChanged detecta cambios Y la sesión activa al inicializar
    // El redirect result ya fue procesado en firebase.js con top-level await
    FirebaseApp.onAuthChange(user => {
      _uid = user ? user.uid : null;
      _updateAuthUI(user);
      if (user) {
        _syncOnLogin(user.uid);
        _startListener(user.uid);
        // Limpiar de Firestore los personajes en lista negra que siguen en la nube
        purgeDeletedFromCloud();
      } else {
        _stopListener();
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

    const forcePullBtn = document.getElementById('forcePullBtn');
    if (user) {
      loginBtn.style.display  = 'none';
      logoutBtn.style.display = 'inline-flex';
      if (forcePullBtn) forcePullBtn.style.display = 'inline-flex';
      if (userLabel) {
        userLabel.textContent = user.displayName || user.email || '';
        userLabel.style.display = 'inline';
      }
    } else {
      loginBtn.style.display  = 'inline-flex';
      logoutBtn.style.display = 'none';
      if (forcePullBtn) forcePullBtn.style.display = 'none';
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

  /* ══════════════════════════════════════════════════════
     SYNC AL LOGIN — trae chars de nube más recientes
  ══════════════════════════════════════════════════════ */

  let _syncing = false;
  async function _syncOnLogin(uid) {
    if (!navigator.onLine || _syncing) return;
    _syncing = true;
    _setSyncState(SyncState.SAVING);
    try {
      const timeout = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('timeout')), 10000));
      const cloudChars = await Promise.race([
        FirebaseApp.loadAllCharsCloud(uid),
        timeout
      ]);

      // Lista negra: IDs que el usuario eliminó (no restaurar ni subir nunca)
      const persistedDeleted = Storage.getDeletedIds ? Storage.getDeletedIds() : new Set();
      const isBlocked = id => _deletedIds.has(id) || persistedDeleted.has(id);

      // Borrar de Firestore los bloqueados que siguen en la nube
      for (const id of Object.keys(cloudChars)) {
        if (isBlocked(id)) {
          FirebaseApp.deleteCharCloud(uid, id).catch(() => {});
          delete cloudChars[id];
        }
      }

      // Limpiar también del localStorage cualquier bloqueado que haya vuelto antes del fix
      const local = Storage.getAllChars();
      for (const id of Object.keys(local)) {
        if (isBlocked(id)) delete local[id];
      }

      if (Object.keys(cloudChars).length === 0) {
        // Nube vacía — subir todos los locales no bloqueados
        for (const char of Object.values(local)) {
          await FirebaseApp.saveCharCloud(uid, char);
        }
        return; // finally limpia _syncing
      }

      // Merge bidireccional: para cada personaje, gana el más reciente (updatedAt)
      const merged = { ...local };
      const toUpload = [];

      for (const [id, cloudChar] of Object.entries(cloudChars)) {
        if (isBlocked(id)) continue;
        const localChar = local[id];
        if (!localChar) {
          // Solo en nube → restaurar a local
          merged[id] = Storage.migrateChar ? Storage.migrateChar(cloudChar) : cloudChar;
        } else {
          // Existe en ambos → gana el más reciente por updatedAt
          const cloudTs = new Date(cloudChar.updatedAt  || 0).getTime();
          const localTs = new Date(localChar.updatedAt  || 0).getTime();
          if (cloudTs >= localTs) {
            merged[id] = Storage.migrateChar ? Storage.migrateChar(cloudChar) : cloudChar;
          } else {
            toUpload.push(localChar);
          }
        }
      }

      // Personajes solo en local (no están en nube) → subir
      for (const [id, localChar] of Object.entries(local)) {
        if (!cloudChars[id] && !isBlocked(id)) toUpload.push(localChar);
      }

      // Guardar merge en localStorage
      for (const char of Object.values(merged)) {
        Storage.saveCharRaw(char);
      }

      // Subir a nube los que hacen falta
      for (const char of toUpload) {
        await FirebaseApp.saveCharCloud(uid, char);
      }

      // Notificar a app para re-render
      // index.html: re-renderizar la grilla de personajes (sync llegó después del primer render)
      if (typeof renderGrid === 'function') {
        renderGrid();
      }
      // app.html: re-inicializar la app
      if (window.App && typeof App.init === 'function') {
        App.init();
      }

      _setSyncState(SyncState.SAVED, new Date().toISOString());
    } catch (e) {
      console.error('Sync on login error:', e);
      _setSyncState(SyncState.ERROR, e.message === 'timeout' ? 'tiempo de espera agotado' : e.message);
    } finally {
      _syncing = false;
    }
  }

  /* ══════════════════════════════════════════════════════
     LISTENER EN TIEMPO REAL
  ══════════════════════════════════════════════════════ */

  let _listenerReady = false;

  function _startListener(uid) {
    _stopListener();
    _listenerReady = false;

    _unsubListen = FirebaseApp.listenCharsCloud(uid, cloudChars => {
      // Primer disparo: es el estado inicial de Firestore — úsalo directamente
      // igual que _syncOnLogin pero sin bloquear por _syncing
      if (!_listenerReady) {
        _listenerReady = true;
        // Si _syncing aún corre, dejar que _syncOnLogin maneje este primer estado
        if (_syncing) return;
        // Si _syncOnLogin ya terminó, aplicar estado de nube directo
        _applyCloudChars(cloudChars);
        return;
      }

      // Disparos posteriores: cambio real desde otro dispositivo
      _applyCloudChars(cloudChars);
    });
  }

  // IDs borrados en esta sesión (en memoria, para respuesta inmediata)
  const _deletedIds = new Set();

  function markDeleted(id) {
    _deletedIds.add(id);
  }

  function _applyCloudChars(cloudChars) {
    // Lista negra: en memoria (sesión actual) + localStorage (sesiones anteriores)
    const persistedDeleted = Storage.getDeletedIds ? Storage.getDeletedIds() : new Set();
    const isBlocked = id => _deletedIds.has(id) || persistedDeleted.has(id);

    // Partir de localStorage, pero ya eliminando los que están en lista negra
    // (pueden haber sido restaurados por Firebase en syncs anteriores al fix)
    const local = Storage.getAllChars();
    let changed = false;

    // Limpiar del localStorage cualquier char que esté en lista negra
    for (const id of Object.keys(local)) {
      if (isBlocked(id)) {
        delete local[id];
        changed = true;
      }
    }

    // Merge de chars de Firebase, filtrando los bloqueados
    for (const [id, cloudChar] of Object.entries(cloudChars)) {
      if (isBlocked(id)) continue;
      local[id] = Storage.migrateChar ? Storage.migrateChar(cloudChar) : cloudChar;
      changed = true;
    }

    if (changed) {
      // Reescribir localStorage completo con el resultado limpio
      for (const char of Object.values(local)) {
        Storage.saveCharRaw(char);
      }
      // Recargar el personaje activo directamente con los datos frescos
      const activeId = Storage.getActiveId();
      const freshChar = activeId ? local[activeId] : null;
      if (window.App && freshChar) {
        App.reloadChar(freshChar);
      }
      _setSyncState(SyncState.SAVED, new Date().toISOString());
    }
  }

  function _stopListener() {
    if (_unsubListen) {
      _unsubListen();
      _unsubListen = null;
    }
  }

  /* ══════════════════════════════════════════════════════
     AUTOSAVE (debounced)
  ══════════════════════════════════════════════════════ */

  function scheduleSave(char) {
    if (!_uid || !navigator.onLine) return;

    clearTimeout(_debTimer);
    _setSyncState(SyncState.SAVING);

    _debTimer = setTimeout(async () => {
      await _doSave(char);
    }, DEBOUNCE_MS);
  }

  async function _doSave(char) {
    if (!_uid) return;
    try {
      await FirebaseApp.saveCharCloud(_uid, char);
      _setSyncState(SyncState.SAVED, new Date().toISOString());
    } catch (e) {
      console.error('Cloud save error:', e);
      const msg = e.code === 'unavailable' ? 'sin conexión' : e.message;
      _setSyncState(SyncState.ERROR, msg);
    }
  }

  /* Forzar guardado inmediato (para pagehide) */
  async function saveNow(char) {
    if (!_uid || !navigator.onLine) return;
    clearTimeout(_debTimer);
    await _doSave(char);
  }

  /* ══════════════════════════════════════════════════════
     FORCE PULL — sobreescribe local con versión de nube
  ══════════════════════════════════════════════════════ */

  async function forcePullFromCloud() {
    if (!_uid || !navigator.onLine) {
      _setSyncState(SyncState.ERROR, 'sin conexión');
      return;
    }
    _setSyncState(SyncState.SAVING);
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
      for (const char of Object.values(cloudChars)) {
        const migrated = Storage.migrateChar ? Storage.migrateChar(char) : char;
        Storage.saveCharRaw(migrated);
      }
      const activeId = Storage.getActiveId();
      const freshChar = activeId ? (Storage.migrateChar ? Storage.migrateChar(cloudChars[activeId]) : cloudChars[activeId]) : null;
      if (window.App && freshChar) {
        App.reloadChar(freshChar);
      }
      _setSyncState(SyncState.SAVED, new Date().toISOString());
    } catch (e) {
      _setSyncState(SyncState.ERROR, e.message);
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
    // Marcar como borrado ANTES del await para que el listener no lo restaure
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
    deleteChar,
    forcePullFromCloud,
    purgeDeletedFromCloud,
  };
})();

// Exponer globalmente (necesario porque cloud.js es módulo ESM — scope aislado)
window.Cloud = Cloud;

// Auto-inicializar
Cloud.init();
