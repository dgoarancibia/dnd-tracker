/* ═══════════════════════════════════════════════════════
   cloud.js — Sincronización Firestore + estado de sync
   Módulo ESM — importa firebase.js, exporta Cloud global
   ═══════════════════════════════════════════════════════ */
import './firebase.js';

const Cloud = (() => {
  let _uid      = null;   // UID del usuario autenticado
  let _debTimer = null;   // timer para debounce de autosave
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

    // Manejar resultado del redirect de Google
    FirebaseApp.handleRedirectResult().catch(() => {});

    // onAuthStateChanged detecta cambios Y la sesión activa al inicializar
    // No duplicar con getCurrentUser — onAuthChange ya cubre ese caso
    FirebaseApp.onAuthChange(user => {
      _uid = user ? user.uid : null;
      _updateAuthUI(user);
      if (user) _syncOnLogin(user.uid);
    });

    // Detectar online/offline
    window.addEventListener('online',  () => { if (_uid) _setSyncState(SyncState.IDLE); });
    window.addEventListener('offline', () => _setSyncState(SyncState.OFFLINE));
  }

  function _updateAuthUI(user) {
    const loginBtn  = document.getElementById('loginBtn');
    const logoutBtn = document.getElementById('logoutBtn');
    const userLabel = document.getElementById('userLabel');

    if (!loginBtn) return;

    if (user) {
      loginBtn.style.display  = 'none';
      logoutBtn.style.display = 'inline-flex';
      if (userLabel) {
        userLabel.textContent = user.displayName || user.email || '';
        userLabel.style.display = 'inline';
      }
    } else {
      loginBtn.style.display  = 'inline-flex';
      logoutBtn.style.display = 'none';
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
    try {
      const cloudChars = await FirebaseApp.loadAllCharsCloud(uid);
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
    } catch (e) {
      console.error('Sync on login error:', e);
    } finally {
      _syncing = false;
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
    deleteChar
  };
})();

// Exponer globalmente (necesario porque cloud.js es módulo ESM — scope aislado)
window.Cloud = Cloud;

// Auto-inicializar
Cloud.init();
