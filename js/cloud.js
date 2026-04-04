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
      if (Object.keys(cloudChars).length === 0) {
        // Primera vez en nube — subir todos los locales
        const local = Storage.getAllChars();
        for (const char of Object.values(local)) {
          await FirebaseApp.saveCharCloud(uid, char);
        }
        return; // finally limpia _syncing
      }

      // Merge: si nube más reciente, usar nube; si local más reciente, mantener local
      const local = Storage.getAllChars();
      let changed = false;
      for (const [id, cloudChar] of Object.entries(cloudChars)) {
        const localChar = local[id];
        if (!localChar) {
          // Personaje solo en nube — traer a local
          local[id] = cloudChar;
          changed = true;
        } else {
          const cloudTs = new Date(cloudChar.updatedAt || 0).getTime();
          const localTs = new Date(localChar.updatedAt || 0).getTime();
          if (cloudTs > localTs) {
            local[id] = cloudChar;
            changed = true;
          }
        }
      }

      if (changed) {
        // Guardar merge en localStorage
        for (const char of Object.values(local)) {
          Storage.saveCharRaw(char);
        }
        // Notificar a app para re-render si está inicializada
        if (window.App && typeof App.reloadChar === 'function') {
          App.reloadChar();
        }
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

  function _applyCloudChars(cloudChars) {
    const local = Storage.getAllChars();
    let changed = false;

    for (const [id, cloudChar] of Object.entries(cloudChars)) {
      const localChar = local[id];
      const cloudTs = new Date(cloudChar.updatedAt || 0).getTime();
      const localTs = new Date(localChar ? localChar.updatedAt || 0 : 0).getTime();

      if (cloudTs > localTs) {
        local[id] = cloudChar;
        changed = true;
      }
    }

    if (changed) {
      for (const char of Object.values(local)) {
        Storage.saveCharRaw(char);
      }
      if (window.App && typeof App.reloadChar === 'function') {
        App.reloadChar();
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
      for (const char of Object.values(cloudChars)) {
        Storage.saveCharRaw(char);
      }
      if (window.App && typeof App.reloadChar === 'function') {
        App.reloadChar();
      }
      _setSyncState(SyncState.SAVED, new Date().toISOString());
    } catch (e) {
      _setSyncState(SyncState.ERROR, e.message);
    }
  }

  /* ══════════════════════════════════════════════════════
     DELETE CHAR
  ══════════════════════════════════════════════════════ */

  async function deleteChar(charId) {
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
    forcePullFromCloud
  };
})();

// Exponer globalmente (necesario porque cloud.js es módulo ESM — scope aislado)
window.Cloud = Cloud;

// Auto-inicializar
Cloud.init();
