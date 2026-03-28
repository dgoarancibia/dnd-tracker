/* ═══════════════════════════════════════════════════════
   storage.js — localStorage + backup JSON
   Sin dependencias de DOM. Singleton global: Storage
   ═══════════════════════════════════════════════════════ */

const Storage = (() => {
  const CHARS_KEY    = 'dnd_chars_v1';
  const ACTIVE_KEY   = 'dnd_active_v1';
  const BACKUP_TS    = 'dnd_backup_ts_v1';

  function _get(key) {
    try { return JSON.parse(localStorage.getItem(key)); }
    catch { return null; }
  }

  function _set(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); return true; }
    catch (e) { console.error('Storage error:', e); return false; }
  }

  /* ── CHARS ── */

  function getAllChars() {
    return _get(CHARS_KEY) || {};
  }

  function getChar(id) {
    const all = getAllChars();
    return all[id] || null;
  }

  function saveChar(char) {
    const all = getAllChars();
    char.updatedAt = new Date().toISOString();
    all[char.id] = char;
    _set(CHARS_KEY, all);
  }

  function deleteChar(id) {
    const all = getAllChars();
    delete all[id];
    _set(CHARS_KEY, all);
    // Si era el activo, limpiar
    if (getActiveId() === id) {
      const remaining = Object.keys(all);
      _set(ACTIVE_KEY, remaining.length ? remaining[0] : null);
    }
  }

  function getAllCharsList() {
    const all = getAllChars();
    return Object.values(all).sort((a, b) =>
      new Date(a.createdAt) - new Date(b.createdAt)
    );
  }

  /* ── ACTIVO ── */

  function getActiveId() {
    return _get(ACTIVE_KEY);
  }

  function setActiveId(id) {
    _set(ACTIVE_KEY, id);
  }

  function getActiveChar() {
    const id = getActiveId();
    if (!id) return null;
    return getChar(id);
  }

  /* ── PATCH CHAR (actualizar campo sin reescribir todo) ── */

  function patchChar(id, patchFn) {
    const char = getChar(id);
    if (!char) return;
    patchFn(char);
    saveChar(char);
  }

  /* ── BACKUP ── */

  function getBackupTimestamp() {
    return _get(BACKUP_TS);
  }

  function setBackupTimestamp() {
    _set(BACKUP_TS, new Date().toISOString());
  }

  function exportJSON() {
    try {
      const data = {
        version: 1,
        exportedAt: new Date().toISOString(),
        characters: getAllChars()
      };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      a.href = url;
      a.download = `dnd-backup-${ts}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setBackupTimestamp();
      return true;
    } catch (e) {
      console.error('Export error:', e);
      return false;
    }
  }

  function exportDiaryTxt(char) {
    try {
      const lines = (char.diary || []).map(e => {
        const d = new Date(e.timestamp);
        const ts = d.toLocaleDateString('es') + ' ' + d.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
        return `[${ts}]\n${e.text}\n`;
      });
      const content = `DIARIO — ${char.name}\n${'═'.repeat(40)}\n\n` + lines.join('\n');
      const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `diario-${char.name.replace(/\s+/g, '-').toLowerCase()}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Diary export error:', e);
    }
  }

  function importJSON(file, onSuccess, onError) {
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const data = JSON.parse(e.target.result);
        // Validación básica
        if (!data.characters || typeof data.characters !== 'object') {
          onError('Archivo inválido: falta la clave "characters"');
          return;
        }
        const chars = data.characters;
        const valid = Object.values(chars).filter(c => c.id && c.name && c.clase);
        if (valid.length === 0) {
          onError('No se encontraron personajes válidos en el archivo');
          return;
        }
        // Merge: no sobreescribir existentes por defecto, pero actualizar
        const existing = getAllChars();
        valid.forEach(c => { existing[c.id] = c; });
        _set(CHARS_KEY, existing);
        // Activar el primer personaje importado si no hay activo
        if (!getActiveId() && valid.length > 0) {
          setActiveId(valid[0].id);
        }
        onSuccess(valid.length);
      } catch (err) {
        onError('Error al leer el archivo: ' + err.message);
      }
    };
    reader.onerror = () => onError('No se pudo leer el archivo');
    reader.readAsText(file);
  }

  function autoBackup() {
    // Intento silencioso — en iOS puede ser bloqueado fuera de gesture
    try { exportJSON(); } catch (_) {}
  }

  /* ── PRIMER RUN ── */

  function isFirstRun() {
    const chars = getAllChars();
    return Object.keys(chars).length === 0;
  }

  return {
    getAllChars,
    getChar,
    saveChar,
    deleteChar,
    getAllCharsList,
    getActiveId,
    setActiveId,
    getActiveChar,
    patchChar,
    getBackupTimestamp,
    setBackupTimestamp,
    exportJSON,
    exportDiaryTxt,
    importJSON,
    autoBackup,
    isFirstRun
  };
})();
