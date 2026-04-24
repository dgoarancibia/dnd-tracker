/* ═══════════════════════════════════════════════════════
   storage.js — localStorage + backup JSON
   Sin dependencias de DOM. Singleton global: Storage
   ═══════════════════════════════════════════════════════ */

const Storage = (() => {
  const CHARS_KEY    = 'dnd_chars_v1';
  const ACTIVE_KEY   = 'dnd_active_v1';
  const BACKUP_TS    = 'dnd_backup_ts_v1';
  const DATA_VERSION = 6;   // Incrementar al cambiar el esquema

  /* ── Migrations ── */
  function _migrate(char) {
    const v = char._dataVersion || 1;
    if (v < 2) {
      // v1 → v2: asegurar campos requeridos
      if (!char.hitDice) char.hitDice = { current: char.nivel || 1, max: char.nivel || 1 };
      if (!char.currency) char.currency = { pp: 0, gp: 0, sp: 0, cp: 0 };
      if (!Array.isArray(char.diary)) char.diary = [];
      if (!Array.isArray(char.ifttt)) char.ifttt = [];
      char._dataVersion = 2;
    }
    if (char._dataVersion < 3) {
      // v2 → v3: agregar campo classes[] para soporte multi-clase
      if (!char.classes || !Array.isArray(char.classes) || char.classes.length === 0) {
        char.classes = [{
          name:     char.clase    || 'Guerrero',
          level:    char.nivel    || 1,
          subclass: char.subclase || '',
        }];
      }
      char._dataVersion = 3;
    }
    if (char._dataVersion < 4) {
      // v3 → v4: rellenar hechizos base para clases que tienen catálogo pero el personaje fue
      //          creado antes de que buildDefaultChar los añadiera automáticamente.
      //          Solo se aplica si el array de spells está completamente vacío.
      if (!Array.isArray(char.spells) || char.spells.length === 0) {
        const catalog = (typeof Characters !== 'undefined' && Characters.CLASE_SPELLS)
          ? Characters.CLASE_SPELLS[char.clase] || []
          : [];
        if (catalog.length > 0) {
          char.spells = catalog.map(s => ({ ...s }));
        }
      }
      char._dataVersion = 4;
    }
    if (char._dataVersion < 5) {
      // v4 → v5: agregar campo exhaustion
      if (typeof char.exhaustion !== 'number') char.exhaustion = 0;
      char._dataVersion = 5;
    }
    if (char._dataVersion < 6) {
      // v5 → v6: agregar campo subraza
      if (typeof char.subraza !== 'string') char.subraza = '';
      char._dataVersion = 6;
    }
    return char;
  }

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
    const char = all[id];
    return char ? _migrate(char) : null;
  }

  function saveChar(char) {
    const all = getAllChars();
    char.updatedAt = new Date().toISOString();
    char._dataVersion = DATA_VERSION;
    all[char.id] = char;
    _set(CHARS_KEY, all);
  }

  /* Guardar sin modificar updatedAt (usado por cloud sync) */
  function saveCharRaw(char) {
    const all = getAllChars();
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

  // Exporta solo el personaje activo en formato compatible con export_to_pdf.py
  function exportCharJSON(char) {
    try {
      const blob = new Blob([JSON.stringify(char, null, 2)], { type: 'application/json' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      const safeName = (char.name || 'personaje').replace(/[^a-zA-Z0-9_\-áéíóúñ ]/g, '').replace(/\s+/g, '_');
      a.href     = url;
      a.download = `${safeName}_lvl${char.nivel || 1}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      return true;
    } catch (e) {
      console.error('Export char error:', e);
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

  function importJSON(file, onSuccess, onError, onPreview) {
    if (!file || file.size > 5 * 1024 * 1024) {
      onError('Archivo demasiado grande (máx 5 MB)');
      return;
    }
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const data = JSON.parse(e.target.result);

        // Estructura esperada: { version, exportedAt, characters: { [id]: char } }
        if (!data || typeof data !== 'object') {
          onError('Archivo inválido: no es JSON válido');
          return;
        }
        if (!data.characters || typeof data.characters !== 'object' || Array.isArray(data.characters)) {
          onError('Archivo inválido: falta la clave "characters"');
          return;
        }

        const chars = data.characters;
        const valid = Object.values(chars).filter(c =>
          c && typeof c === 'object' &&
          typeof c.id === 'string' && c.id.length > 0 &&
          typeof c.name === 'string' && c.name.length > 0 &&
          typeof c.clase === 'string'
        ).map(c => _migrate(c));

        if (valid.length === 0) {
          onError('No se encontraron personajes válidos en el archivo');
          return;
        }

        // Si hay onPreview, pedir confirmación antes de sobreescribir
        if (typeof onPreview === 'function') {
          onPreview(valid, () => _doImport(valid, onSuccess));
          return;
        }

        _doImport(valid, onSuccess);
      } catch (err) {
        onError('Error al leer el archivo: ' + err.message);
      }
    };
    reader.onerror = () => onError('No se pudo leer el archivo');
    reader.readAsText(file);
  }

  function _doImport(validChars, onSuccess) {
    const existing = getAllChars();
    validChars.forEach(c => { existing[c.id] = c; });
    _set(CHARS_KEY, existing);
    if (!getActiveId() && validChars.length > 0) {
      setActiveId(validChars[0].id);
    }
    onSuccess(validChars.length);
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
    saveCharRaw,
    deleteChar,
    getAllCharsList,
    getActiveId,
    setActiveId,
    getActiveChar,
    patchChar,
    getBackupTimestamp,
    setBackupTimestamp,
    exportJSON,
    exportCharJSON,
    exportDiaryTxt,
    importJSON,
    autoBackup,
    isFirstRun
  };
})();
