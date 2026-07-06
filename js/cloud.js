/* ═══════════════════════════════════════════════════════
   cloud.js — Sincronización Firestore + estado de sync
   Módulo ESM — importa firebase.js, exporta Cloud global
   ═══════════════════════════════════════════════════════ */
import './firebase.js';

const Cloud = (() => {
  let _uid        = null;   // UID del usuario autenticado
  let _unsubListen = null;  // unsub del onSnapshot listener
  let _pulling    = false;  // true mientras un pull desde la nube está en curso —
                             // bloquea saves que podrían pisarlo con datos en memoria desactualizados

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
    if (_syncing) {
      // Si ya está sincronizando, esperar hasta 12s a que termine y luego renderizar
      const waited = Date.now();
      while (_syncing && Date.now() - waited < 12000) {
        await new Promise(r => setTimeout(r, 300));
      }
      if (typeof renderGrid === 'function') renderGrid();
      return;
    }
    if (!navigator.onLine) {
      // Sin conexión — renderizar lo que haya en local (puede ser vacío)
      if (typeof renderGrid === 'function') renderGrid();
      if (window.App && typeof App.init === 'function') App.init();
      return;
    }
    _syncing = true;
    _pulling = true;
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
            const winner = Storage.migrateChar ? Storage.migrateChar(cloudChar) : cloudChar;
            // Preservar avatar local si la nube no lo tiene (puede que aún no se haya subido)
            if (!winner.avatar && localChar.avatar) winner.avatar = localChar.avatar;
            merged[id] = winner;
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
      // En timeout: reintentar después de 15s (máx 3 veces)
      if (e.message === 'timeout' && (_syncRetries || 0) < 3) {
        _syncRetries = (_syncRetries || 0) + 1;
        setTimeout(() => _syncOnLogin(uid), 15000);
      }
    } finally {
      _syncing = false;
      _pulling = false;
      // Aplicar snapshot pendiente que llegó mientras _syncOnLogin corría
      if (_pendingCloudState) {
        const pending = _pendingCloudState;
        _pendingCloudState = null;
        _applyCloudChars(pending);
      }
    }
  }

  let _syncRetries = 0;

  /* ══════════════════════════════════════════════════════
     LISTENER EN TIEMPO REAL
  ══════════════════════════════════════════════════════ */

  let _listenerReady = false;
  let _pendingCloudState = null;  // snapshot recibido mientras _syncing estaba activo
  let _listenerRetries = 0;

  function _startListener(uid) {
    _stopListener();
    _listenerReady = false;
    _pendingCloudState = null;

    _unsubListen = FirebaseApp.listenCharsCloud(uid, cloudChars => {
      if (!_listenerReady) {
        _listenerReady = true;
        if (_syncing) {
          // _syncOnLogin todavía corre — guardar snapshot para aplicar cuando termine
          _pendingCloudState = cloudChars;
          return;
        }
        _applyCloudChars(cloudChars);
        return;
      }
      // Disparos posteriores: cambio real desde otro dispositivo
      _applyCloudChars(cloudChars);
    }, err => {
      // onSnapshot murió (iOS background, cambio de red, etc.) — reintentar
      console.warn('[Cloud] listener caído, reintentando…', err);
      _listenerReady = false;
      _listenerRetries++;
      const delay = Math.min(5000 * _listenerRetries, 30000);
      setTimeout(() => {
        if (_uid) _startListener(_uid);
      }, delay);
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
      const migrated = Storage.migrateChar ? Storage.migrateChar(cloudChar) : cloudChar;
      // Preservar avatar local si la nube no lo tiene
      if (!migrated.avatar && local[id]?.avatar) migrated.avatar = local[id].avatar;
      if (!migrated.avatar) {
        const lsAvatar = localStorage.getItem('dnd_avatar_' + id);
        if (lsAvatar) migrated.avatar = lsAvatar;
      }
      // Solo marcar changed si el contenido realmente cambió (evita re-render de echo)
      // Excluimos _syncedAt porque siempre varía aunque el contenido sea igual
      const _strip = o => { if (!o) return o; const c = {...o}; delete c._syncedAt; return c; };
      if (JSON.stringify(_strip(migrated)) !== JSON.stringify(_strip(local[id]))) {
        local[id] = migrated;
        changed = true;
      }
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
     AUTOSAVE (inmediato)
  ══════════════════════════════════════════════════════ */

  function scheduleSave(char) {
    if (!_uid || !navigator.onLine || _pulling) return;

    // Sin debounce: iOS puede suspender la app apenas pasa a background
    // (bloqueo de pantalla, cambio de app) y un timer pendiente nunca dispara,
    // perdiendo el guardado a nube por completo. Se guarda de inmediato.
    _setSyncState(SyncState.SAVING);
    _doSave(char);
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

  /* Forzar guardado inmediato (para pagehide) — bloqueado durante un pull:
     el pagehide dispara con el _char en memoria, que puede seguir siendo
     la versión vieja si el pull todavía no terminó de actualizarlo,
     pisando en Firestore los datos recién bajados de otro dispositivo. */
  async function saveNow(char) {
    if (!_uid || !navigator.onLine || _pulling) return;
    await _doSave(char);
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
    // Bloquea saveNow/scheduleSave hasta que el pull termine: si el usuario
    // cambia de pestaña o la app se recarga mientras esto corre, pagehide/
    // visibilitychange no deben subir el _char viejo que aún está en memoria
    // y pisar en Firestore lo que este pull está bajando.
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
