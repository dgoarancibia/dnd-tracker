/* ═══════════════════════════════════════════════════════
   storage.js — localStorage + backup JSON
   Sin dependencias de DOM. Singleton global: Storage
   ═══════════════════════════════════════════════════════ */

const Storage = (() => {
  const CHARS_KEY    = 'dnd_chars_v1';
  const ACTIVE_KEY   = 'dnd_active_v1';
  const BACKUP_TS    = 'dnd_backup_ts_v1';
  const DELETED_KEY  = 'dnd_deleted_ids_v1'; // IDs eliminados — persiste en localStorage
  const TRASH_KEY    = 'dnd_trash_v1';        // Papelera — personajes borrados recuperables
  const DATA_VERSION = 15;  // Incrementar al cambiar el esquema
  const LURSEY_ID    = 'lursey-brumaclara'; // personaje de demo — sus features vienen de buildLursey()

  // ── IndexedDB shadow backup ──────────────────────────────────────────────
  // Se escribe en cada saveChar/saveCharRaw. Sobrevive al Clear site data del SW.
  // Se usa para recuperar personajes si el localStorage queda vacío.
  // IDB v2 agrega el store 'deleted' para recordar IDs eliminados intencionalmente.
  const IDB_NAME    = 'dnd_shadow_v1';
  const IDB_STORE   = 'chars';
  const IDB_DELETED = 'deleted'; // store de IDs eliminados
  let   _idb        = null;

  function _openIDB() {
    if (_idb) return Promise.resolve(_idb);
    return new Promise((resolve) => {
      // Versión 2: agrega store 'deleted'
      const req = indexedDB.open(IDB_NAME, 2);
      req.onupgradeneeded = e => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(IDB_STORE)) {
          db.createObjectStore(IDB_STORE, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(IDB_DELETED)) {
          db.createObjectStore(IDB_DELETED, { keyPath: 'id' });
        }
      };
      req.onsuccess  = e => { _idb = e.target.result; resolve(_idb); };
      req.onerror    = (e) => {
        console.warn('[Storage] IDB no disponible:', e.target?.error?.message || 'error desconocido');
        resolve(null);
      };
    });
  }

  function _idbPut(char) {
    _openIDB().then(db => {
      if (!db) return;
      try {
        const tx = db.transaction(IDB_STORE, 'readwrite');
        tx.objectStore(IDB_STORE).put(char);
      } catch (_) {}
    });
  }

  // Marca un ID como eliminado en IDB y lo borra del store de chars
  function _idbMarkDeleted(id) {
    _openIDB().then(db => {
      if (!db) return;
      try {
        // Guardar en 'deleted' con timestamp
        const tx1 = db.transaction(IDB_DELETED, 'readwrite');
        tx1.objectStore(IDB_DELETED).put({ id, deletedAt: new Date().toISOString() });
        // Quitar del store de chars
        const tx2 = db.transaction(IDB_STORE, 'readwrite');
        tx2.objectStore(IDB_STORE).delete(id);
      } catch (_) {}
    });
  }

  function _idbGetAll() {
    return _openIDB().then(db => {
      if (!db) return [];
      return new Promise(resolve => {
        try {
          const req = db.transaction(IDB_STORE, 'readonly').objectStore(IDB_STORE).getAll();
          req.onsuccess = e => resolve(e.target.result || []);
          req.onerror   = ()  => resolve([]);
        } catch (_) { resolve([]); }
      });
    });
  }

  // Devuelve el Set de IDs que fueron eliminados intencionalmente
  function _idbGetDeletedIds() {
    return _openIDB().then(db => {
      if (!db) return new Set();
      return new Promise(resolve => {
        try {
          const req = db.transaction(IDB_DELETED, 'readonly').objectStore(IDB_DELETED).getAll();
          req.onsuccess = e => resolve(new Set((e.target.result || []).map(r => r.id)));
          req.onerror   = ()  => resolve(new Set());
        } catch (_) { resolve(new Set()); }
      });
    });
  }

  // Restaura desde IDB al localStorage si localStorage está vacío (ej: después de clear site data)
  async function _maybeRestoreFromIDB() {
    const existing = _get(CHARS_KEY);
    // Solo restaurar si localStorage quedó vacío o solo tiene Lursey
    const ids = Object.keys(existing || {});
    const missingNonLursey = ids.filter(id => id !== LURSEY_ID).length === 0;
    if (!missingNonLursey) return 0; // ya hay personajes, no tocar

    const [shadow, idbDeleted] = await Promise.all([_idbGetAll(), _idbGetDeletedIds()]);

    // Si IDB también está vacío, disparar evento para sugerir restore desde cloud
    if (shadow.length === 0) {
      document.dispatchEvent(new CustomEvent('storage:idb-empty-on-restore'));
      return 0;
    }
    // Lista negra: combinar IDB + localStorage (localStorage es más rápido y siempre disponible)
    const lsDeleted = getDeletedIds();
    const deletedIds = new Set([...idbDeleted, ...lsDeleted]);
    // Filtrar: no restaurar Lursey ni los que fueron eliminados intencionalmente
    const toRestore = shadow.filter(c => c.id !== LURSEY_ID && !deletedIds.has(c.id));
    if (toRestore.length === 0) return 0;

    // Restaurar al localStorage
    const all = existing || {};
    let restored = 0;
    for (const char of toRestore) {
      all[char.id] = char;
      restored++;
    }
    _set(CHARS_KEY, all);
    console.info(`[Storage] Restaurados ${restored} personaje(s) desde IDB shadow backup`);
    return restored;
  }

  /* ── Rellena choices vacías en personajes ya construidos ─────────────────
     Se ejecuta al final de _migrate() SIEMPRE, sin importar _dataVersion.
     Cubre personajes importados desde JSONs externos que ya traen el nivel
     correcto pero no tienen el campo choices (o lo tienen vacío).
  ── */
  function _ensureChoicesFilled(char) {
    if (char.id === LURSEY_ID) return false; // Lursey tiene sus propios datos
    if (typeof Characters === 'undefined') return false; // characters.js aún no cargado

    const nivel = char.nivel || 1;
    // Solo actuar si el personaje es "ya construido": nivel > 1, tiene subclase o features
    const isBuiltChar = nivel > 1 &&
      (char.subclase || (Array.isArray(char.features) && char.features.length > 0));
    if (!isBuiltChar) return false;

    // Verificar que tenga choices pendientes reales (no basta con que el objeto exista vacío)
    // Calculamos cuántas choices estáticas hay hasta su nivel
    const classCfg = Characters.CHOICES_CONFIG
      ? (Characters.CHOICES_CONFIG[char.clase] || [])
      : [];
    const staticChoices = classCfg.filter(c => c.level <= nivel);

    if (!char.choices) char.choices = {};

    const missingStatic = staticChoices.filter(c => !char.choices[c.id]);
    const clasesCfg = Characters.CLASES_CONFIG ? Characters.CLASES_CONFIG[char.clase] : null;
    const isKnownCaster = clasesCfg && clasesCfg.knownCaster;

    // Si ya tiene todas las choices resueltas, no hacer nada
    if (missingStatic.length === 0 && !isKnownCaster) return false;

    // Hay choices pendientes → rellenar como __imported__
    missingStatic.forEach(ch => {
      if (ch.appliesSubclass && char.subclase) {
        const opt = (ch.options || []).find(o =>
          o.name === char.subclase || o.id === char.subclase
        );
        char.choices[ch.id] = opt ? opt.id : '__imported__';
      } else {
        char.choices[ch.id] = '__imported__';
      }
    });

    // Marcar picks de hechizos para casters de lista conocida
    if (isKnownCaster) {
      for (let lvl = 1; lvl <= nivel; lvl++) {
        if (!char.choices[`spellPick-${lvl}`])   char.choices[`spellPick-${lvl}`]   = '__imported__';
        if (!char.choices[`cantripPick-${lvl}`]) char.choices[`cantripPick-${lvl}`] = '__imported__';
        if (!char.choices[`spellPick-${lvl}-1`]) char.choices[`spellPick-${lvl}-1`] = '__imported__';
        if (!char.choices[`spellPick-${lvl}-2`]) char.choices[`spellPick-${lvl}-2`] = '__imported__';
      }
    }
    return true; // indica que se modificó el char
  }

  /* ── Migración de especies al PHB 2024 ───────────────────────────────────
     En el PHB 2024 el Enano y el Halfling se unificaron: sus subrazas de 2014
     (Colinas/Montañas, Pies Ligeros/Robusto) dejaron de existir. Los personajes
     guardados con esas subrazas quedarían apuntando a algo que ya no está en
     RAZAS_CONFIG, así que se limpia el campo `subraza`.

     La app es fiel al PHB 2024: las especies unificadas NO otorgan las skill
     profs que daban sus subrazas de 2014 (el Enano 2024 tiene skillProfs: []).
     Por eso la migración solo limpia el campo `subraza` y NO hereda skills —
     agregarlas sería mezclar reglas de dos ediciones.

     IMPORTANTE: esta migración NO toca hp.max ni hp.current. El bonus de
     Dwarven Toughness ya fue aplicado manualmente por el usuario a sus
     personajes existentes; recalcularlo acá lo duplicaría. El campo hpPerLevel
     de RAZAS_CONFIG solo aplica hacia adelante, al subir de nivel.
  ── */
  const _SUBRAZAS_ELIMINADAS_2024 = {
    'Enano':    ['Enano de las Colinas', 'Enano de las Montañas'],
    'Halfling': ['Pies Ligeros', 'Robusto'],
  };

  function _migrateSpecies2024(char) {
    if (!char || !char.subraza) return false;
    const subrazasDeLaRaza = _SUBRAZAS_ELIMINADAS_2024[char.raza];
    if (!subrazasDeLaRaza) return false;
    if (!subrazasDeLaRaza.includes(char.subraza)) return false; // no reconocida: no tocar

    const subrazaVieja = char.subraza;
    char.subraza = '';

    console.info(
      `[migración especies 2024] "${char.name || char.id}": ${char.raza} — ` +
      `se eliminó la subraza "${subrazaVieja}" (no existe en el PHB 2024). ` +
      `Skills y HP sin cambios (${char.hp ? char.hp.max : '?'} máx).`
    );
    return true;
  }

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
    if (char._dataVersion < 7) {
      // v6 → v7: rellenar features vacías para personajes creados antes del fix
      // Lursey tiene sus features desde buildLursey(); solo aplica a non-Lursey
      if (char.id !== LURSEY_ID && (!Array.isArray(char.features) || char.features.length === 0)) {
        const claseFeat = (typeof Characters !== 'undefined' && Characters.CLASE_FEATURES)
          ? Characters.CLASE_FEATURES[char.clase]
          : null;
        if (claseFeat) {
          const rawFeats = typeof claseFeat.features === 'function'
            ? claseFeat.features(char.nivel || 1)
            : (claseFeat.features || []);
          char.features = rawFeats.map(f => {
            if (typeof f === 'object' && f !== null) return { ...f };
            const name = String(f);
            return {
              id:     name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-'),
              name, source: char.clase, type:'passive',
              action:null, range:null, recharge:null, desc:'', fullDesc:'',
            };
          });
        } else {
          char.features = char.features || [];
        }
      }
      char._dataVersion = 7;
    }
    if (char._dataVersion < 8) {
      // v7 → v8: corregir savingThrows desde CLASES_CONFIG
      // Solo aplica si el array tiene menos throws de los esperados (datos incompletos)
      if (char.id !== LURSEY_ID) {
        const cfg = (typeof Characters !== 'undefined' && Characters.CLASES_CONFIG)
          ? Characters.CLASES_CONFIG[char.clase]
          : null;
        if (cfg && Array.isArray(cfg.savingThrows)) {
          // Combinar: mantener los que ya tenía + agregar los del catálogo que falten
          const existing = new Set(char.savingThrows || []);
          cfg.savingThrows.forEach(s => existing.add(s));
          char.savingThrows = Array.from(existing);
        }
      }
      char._dataVersion = 8;
    }
    if (char._dataVersion < 9) {
      // v8 → v9: aplicar subclase si char.subclase está seteado pero los recursos/features
      // de la subclase no existen aún (personajes creados antes del sistema de subclases)
      if (char.subclase && typeof Characters !== 'undefined' && Characters.applySubclase) {
        const sub = Characters.SUBCLASES_CONFIG && Characters.SUBCLASES_CONFIG[char.subclase];
        if (sub) {
          // Solo aplicar si no hay features ni recursos de la subclase ya
          const hasSubFeature = (char.features || []).some(f =>
            f.source && f.source.toLowerCase().includes(char.subclase.toLowerCase())
          );
          if (!hasSubFeature) {
            Characters.applySubclase(char, char.subclase);
          }
        }
      }
      // Asegurar campo maneuvers existe para Battle Master
      if (char.subclase === 'Battle Master' && !char.maneuvers) {
        char.maneuvers = [];
      }
      char._dataVersion = 9;
    }
    if (char._dataVersion < 10) {
      // v9 → v10: regenerar features filtrando por nivel actual del personaje.
      // Las versiones anteriores guardaban TODAS las features (de todos los niveles)
      // sin filtrar por el nivel del personaje. Ahora CLASE_FEATURES filtra por nivel.
      // No tocar Lursey (tiene features manuales).
      if (char.id !== LURSEY_ID && typeof Characters !== 'undefined' && Characters.CLASE_FEATURES) {
        const claseFeat = Characters.CLASE_FEATURES[char.clase];
        if (claseFeat && typeof claseFeat.features === 'function') {
          const rawFeats = claseFeat.features(char.nivel || 1);
          // Conservar features de subclase (no tocarlas)
          const subFeatures = (char.features || []).filter(f =>
            f.source && char.subclase && f.source.toLowerCase().includes(char.subclase.toLowerCase())
          );
          const claseFeatList = rawFeats.map(f => {
            if (typeof f === 'object' && f !== null) return { ...f };
            const name = String(f);
            return { id: name.toLowerCase().replace(/[^a-z0-9]/g,'-').replace(/-+/g,'-'), name, source: char.clase, type:'passive', action:null, range:null, recharge:null, desc:'', fullDesc:'' };
          });
          // Merge: features de clase filtradas por nivel + features de subclase
          const subIds = new Set(subFeatures.map(f => f.id));
          char.features = [
            ...claseFeatList.filter(f => !subIds.has(f.id)),
            ...subFeatures,
          ];
        }
      }
      char._dataVersion = 10;
    }
    if (char._dataVersion < 11) {
      // v10 → v11: re-forzar regeneración de features por nivel.
      // Algunos personajes creados con characters.js viejo pueden tener features
      // de niveles superiores al actual. Volvemos a correr la misma lógica que v10
      // para asegurar que queden correctas con el catálogo actualizado.
      // No tocar Lursey.
      if (char.id !== LURSEY_ID && typeof Characters !== 'undefined' && Characters.CLASE_FEATURES) {
        const claseFeat = Characters.CLASE_FEATURES[char.clase];
        if (claseFeat && typeof claseFeat.features === 'function') {
          const rawFeats = claseFeat.features(char.nivel || 1);
          const subFeatures = (char.features || []).filter(f =>
            f.source && char.subclase && f.source.toLowerCase().includes(char.subclase.toLowerCase())
          );
          const claseFeatList = rawFeats.map(f => {
            if (typeof f === 'object' && f !== null) return { ...f };
            const name = String(f);
            return { id: name.toLowerCase().replace(/[^a-z0-9]/g,'-').replace(/-+/g,'-'), name, source: char.clase, type:'passive', action:null, range:null, recharge:null, desc:'', fullDesc:'' };
          });
          const subIds = new Set(subFeatures.map(f => f.id));
          char.features = [
            ...claseFeatList.filter(f => !subIds.has(f.id)),
            ...subFeatures,
          ];
        }
      }
      char._dataVersion = 11;
    }
    if (char._dataVersion < 12) {
      // v11 → v12: agregar campo ep (Electrum) a currency si no existe
      if (char.currency && char.currency.ep === undefined) {
        char.currency.ep = 0;
      }
      char._dataVersion = 12;
    }
    if (char._dataVersion < 13) {
      // v12 → v13: agregar campo ep (Electrum) a currency si no existe (se movió de v12 a acá)
      // Las choices ahora se manejan en _ensureChoicesFilled() que corre siempre.
      char._dataVersion = 13;
    }
    if (char._dataVersion < 14) {
      // v13 → v14: unificar weapons[]/armor{}/attunement[]/magicItems[] en un
      // sistema de slots equipables (equipment{}). Ver diseño en README del cambio.
      if (!char.equipment) {
        const oldWeapons  = Array.isArray(char.weapons) ? char.weapons : [];
        const oldArmor    = char.armor || null;
        const oldAttune   = Array.isArray(char.attunement) ? char.attunement : [];
        const oldMagic    = Array.isArray(char.magicItems) ? char.magicItems : [];

        const equipment = { mainHand: null, offHand: null, armor: null, head: null, eyes: null, neck: null, cloak: null, hands: null, belt: null, feet: null, ring: null, misc: null };

        // weapons[0] → mainHand
        if (oldWeapons[0]) {
          const w = oldWeapons[0];
          equipment.mainHand = {
            id: w.id || ('w-' + Math.random().toString(36).slice(2, 7)),
            name: w.name || 'Arma',
            kind: 'weapon',
            die: w.die || '1d6',
            bonus: w.bonus || '',
            type: w.type || 'melee',
            statUsed: w.statUsed || 'str',
            mastery: w.mastery || '',
            extraDie: w.extraDie || '',
            extraType: w.extraType || '',
            notes: w.notes || '',
            bonuses: { ac: 0, attack: 0, damage: 0, save: 0 },
            buffs: [],
          };
        }

        // armor viejo → equipment.armor (+ shield viejo → offHand tipo shield).
        // El escudo tiene prioridad sobre weapons[1] para el slot offHand: un
        // personaje no puede llevar escudo Y un arma en la mano secundaria a la
        // vez, y el escudo es más relevante para el cálculo de CA.
        if (oldArmor) {
          equipment.armor = {
            id: 'armor-' + Math.random().toString(36).slice(2, 7),
            name: oldArmor.name || '',
            kind: 'armor',
            base_ca: oldArmor.base_ca != null ? oldArmor.base_ca : 10,
            add_dex: oldArmor.add_dex !== false,
            bonuses: { ac: 0, attack: 0, damage: 0, save: 0 },
            buffs: [],
          };
          if (oldArmor.shield) {
            equipment.offHand = {
              id: 'shield-' + Math.random().toString(36).slice(2, 7),
              name: 'Escudo',
              kind: 'shield',
              shield_bonus: oldArmor.shield_bonus || 2,
              bonuses: { ac: 0, attack: 0, damage: 0, save: 0 },
              buffs: [],
            };
          }
        }

        // weapons[1] → offHand si es razonable (arma liviana/foco) y el slot
        // sigue libre (el escudo, si había, ya lo ocupó arriba); si no, queda
        // como ítem no equipado en la mochila (consumables) para no perder el dato.
        if (oldWeapons[1]) {
          const w = oldWeapons[1];
          const asOffHand = w.type === 'focus' || w.die === '—';
          if (asOffHand && !equipment.offHand) {
            equipment.offHand = {
              id: w.id || ('w-' + Math.random().toString(36).slice(2, 7)),
              name: w.name || 'Arma',
              kind: 'weapon',
              die: w.die || '—',
              bonus: w.bonus || '',
              type: w.type || 'melee',
              notes: w.notes || '',
              bonuses: { ac: 0, attack: 0, damage: 0, save: 0 },
              buffs: [],
            };
          } else {
            if (!Array.isArray(char.consumables)) char.consumables = [];
            char.consumables.push({
              id: 'i-' + Date.now() + '-w1',
              name: w.name || 'Arma',
              qty: 1,
              category: 'Weapon - martial melee',
              desc: w.notes || '',
            });
            if (asOffHand) {
              console.warn(`[migración v14] Personaje "${char.name || char.id}": "${w.name}" (weapons[1]) no se equipó en mano secundaria porque el escudo tenía prioridad — quedó en la mochila.`);
            }
          }
        }

        // attunement[] viejo (texto libre, sin estructura) → no hay forma de
        // mapearlo a un slot real. Se descarta, pero se deja rastro en consola.
        const nonEmptyAttune = oldAttune.filter(s => (s || '').trim() !== '').length;
        if (nonEmptyAttune > 0) {
          console.warn(`[migración v14] Personaje "${char.name || char.id}": se descartaron ${nonEmptyAttune} entrada(s) de attunement de texto libre (sin forma de mapear a un slot real).`);
        }

        // magicItems[] (si tenía contenido real) → consumables con categoría 'Ítem mágico'
        oldMagic.forEach(item => {
          if (!item || !item.name) return;
          if (!Array.isArray(char.consumables)) char.consumables = [];
          char.consumables.push({
            id: 'i-' + Date.now() + '-' + Math.random().toString(36).slice(2, 5),
            name: item.name,
            qty: 1,
            category: 'Ítem mágico',
            desc: item.desc || '',
          });
        });

        char.equipment = equipment;
      }
      // Limpiar campos viejos incondicionalmente (aunque char.equipment ya
      // existiera de antes, ej. Lursey reconstruida por buildLursey()).
      delete char.weapons;
      delete char.armor;
      delete char.attunement;
      delete char.magicItems;
      if (!char.statBuffs) {
        char.statBuffs = { ca: [], attack: [], save: [], spellDc: [] };
      }
      char._dataVersion = 14;
    }
    if (char._dataVersion < 15) {
      // v14 → v15: alinear especies con el PHB 2024. Enano y Halfling se
      // unificaron (ya no tienen subrazas), así que los personajes guardados con
      // una subraza eliminada quedarían apuntando a algo inexistente.
      // La lógica real vive en _migrateSpecies2024(), que corre SIEMPRE (abajo)
      // para alcanzar también a los personajes que ya venían con _dataVersion
      // alto desde un JSON importado y se saltearon esta migración.
      char._dataVersion = 15;
    }

    // ── Siempre: migración de especies al PHB 2024 ─────────────────────────────
    // Corre INDEPENDIENTEMENTE de la versión (mismo motivo que los bloques de
    // abajo: los JSONs importados llegan con _dataVersion ya alto).
    const _speciesFixed = _migrateSpecies2024(char);

    // ── Siempre: campos estructurales obligatorios ─────────────────────────────
    // Corre INDEPENDIENTEMENTE de la versión. Cubre JSONs importados con
    // _dataVersion ya alto que saltearon las migraciones anteriores.
    let _structFixed = _speciesFixed;
    function _fixField(condition, fix) { if (condition) { fix(); _structFixed = true; } }
    _fixField(!char.hitDice,               () => { char.hitDice = { current: char.nivel || 1, max: char.nivel || 1 }; });
    _fixField(!char.currency,              () => { char.currency = { pp:0, gp:0, ep:0, sp:0, cp:0 }; });
    _fixField(!Array.isArray(char.diary),  () => { char.diary = []; });
    _fixField(!Array.isArray(char.ifttt),  () => { char.ifttt = []; });
    _fixField(!Array.isArray(char.conditions), () => { char.conditions = []; });
    _fixField(!char.equipment, () => { char.equipment = { mainHand:null, offHand:null, armor:null, head:null, eyes:null, neck:null, cloak:null, hands:null, belt:null, feet:null, ring:null, misc:null }; });
    // Personajes que ya migraron a `equipment` antes de que existieran las
    // categorías de cuerpo del DMG (head/eyes/cloak/hands/belt/feet) — completar
    // las claves nuevas sin tocar lo que ya tenían equipado.
    ['head','eyes','cloak','hands','belt','feet'].forEach(k => {
      if (char.equipment && !(k in char.equipment)) { char.equipment[k] = null; _structFixed = true; }
    });
    _fixField(!char.statBuffs, () => { char.statBuffs = { ca:[], attack:[], save:[], spellDc:[] }; });
    _fixField(typeof char.exhaustion !== 'number', () => { char.exhaustion = 0; });
    _fixField(!char.turn, () => { char.turn = { movement:false, action:false, reaction:false, bonus:false }; });
    // consumables con el viejo sistema container/maxQty (ej. Cantimplora)
    // → unificar al nuevo charges{current,max}: misma UI de pips para todo
    // ítem recargable en vez de dos sistemas paralelos sin conectar. Corre
    // siempre (no solo en la migración v14) para alcanzar chars que ya
    // pasaron por esa versión antes de que este fix existiera.
    (char.consumables || []).forEach(item => {
      if (item.container && !item.charges) {
        const max = item.maxQty || item.qty || 1;
        item.charges = { current: item.qty || 0, max };
        item.qty = 1;
        delete item.container;
        delete item.maxQty;
        _structFixed = true;
      }
    });
    if (!char.bonuses) { char.bonuses = {}; _structFixed = true; }
    ['init','ataque','hpMax','ca','cd','savesAll'].forEach(k => {
      if (char.bonuses[k] === undefined) { char.bonuses[k] = 0; _structFixed = true; }
    });
    if (!char.bonuses.skills) { char.bonuses.skills = {}; _structFixed = true; }
    if (!char.bonuses.saves)  { char.bonuses.saves  = {}; _structFixed = true; }

    // ── Siempre: rellenar choices vacías en personajes ya construidos ──────────
    // Corre INDEPENDIENTEMENTE de la versión. Cubre personajes importados con
    // _dataVersion ya correcto pero sin campo choices (ej: JSONs generados por IA).
    char._choicesFilled = _ensureChoicesFilled(char) || _structFixed; // true si se modificó

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
    if (!char) return null;
    const migrated = _migrate(char);
    // Si _ensureChoicesFilled rellenó choices (o la versión cambió), persiste inmediatamente
    // para que la próxima lectura no vuelva a ver el char sin choices.
    if (migrated._choicesFilled || (migrated._dataVersion !== (char._dataVersion || 1))) {
      delete migrated._choicesFilled; // campo temporal, no persistir
      const snapshot = getAllChars();
      snapshot[id] = migrated;
      _set(CHARS_KEY, snapshot);
      _idbPut(migrated);
    } else {
      delete migrated._choicesFilled;
    }
    return migrated;
  }

  function saveChar(char) {
    const all = getAllChars();
    // updatedAt solo avanza si el contenido realmente cambió. Guardados
    // triviales (pagehide, re-renders) no deben inflar el timestamp: el merge
    // entre dispositivos decide por updatedAt, y un timestamp inflado hace que
    // datos viejos "ganen" contra cambios genuinos hechos en otro dispositivo.
    const prev = all[char.id];
    const _strip = o => {
      if (!o) return o;
      const c = { ...o };
      delete c.updatedAt; delete c._syncedAt; delete c._dataVersion;
      return c;
    };
    const changed = !prev || JSON.stringify(_strip(char)) !== JSON.stringify(_strip(prev));
    if (changed) char.updatedAt = new Date().toISOString();
    else if (prev.updatedAt) char.updatedAt = prev.updatedAt;
    char._dataVersion = DATA_VERSION;
    all[char.id] = char;
    _set(CHARS_KEY, all);
    _idbPut(char); // shadow backup en IDB
  }

  /* Guardar sin modificar updatedAt (usado por cloud sync) */
  function saveCharRaw(char) {
    const all = getAllChars();
    all[char.id] = char;
    _set(CHARS_KEY, all);
    _idbPut(char); // shadow backup en IDB
  }

  /* ── Lista negra de IDs eliminados (persiste en localStorage) ─────────────
     Cloud.js la usa para no restaurar desde Firestore lo que el usuario borró.
     También la usa _maybeRestoreFromIDB para el IDB shadow backup.
  ── */
  function getDeletedIds() {
    return new Set(_get(DELETED_KEY) || []);
  }

  // Elimina del localStorage activo cualquier char que esté en la lista negra.
  // Se llama al arrancar la app para limpiar personajes que Firebase restauró
  // en sesiones anteriores al fix.
  function purgeDeletedFromLocal() {
    const deletedIds = getDeletedIds();
    if (deletedIds.size === 0) return 0;
    const all = getAllChars();
    const trash = getTrash();
    let removed = 0;
    for (const id of Object.keys(all)) {
      if (deletedIds.has(id)) {
        // Mover a papelera si no está ya ahí
        if (!trash[id]) {
          trash[id] = { ...all[id], _deletedAt: all[id]._deletedAt || new Date().toISOString() };
        }
        delete all[id];
        removed++;
      }
    }
    if (removed > 0) {
      _set(CHARS_KEY, all);
      _set(TRASH_KEY, trash);
      // Si el activo era uno de los eliminados, apuntar al primero disponible
      const activeId = getActiveId();
      if (activeId && deletedIds.has(activeId)) {
        const remaining = Object.keys(all);
        _set(ACTIVE_KEY, remaining.length ? remaining[0] : null);
      }
      console.info(`[Storage] Purgados ${removed} personaje(s) → papelera`);
    }
    return removed;
  }

  function addDeletedId(id) {
    const ids = getDeletedIds();
    ids.add(id);
    _set(DELETED_KEY, Array.from(ids));
  }

  function isDeleted(id) {
    return getDeletedIds().has(id);
  }

  /* ── PAPELERA ─────────────────────────────────────────────────────────────
     deleteChar mueve el personaje a la papelera en vez de borrarlo directo.
     Desde la papelera se puede recuperar (restoreChar) o eliminar permanente
     (permanentDeleteChar). emptyTrash vacía toda la papelera.
  ── */

  function getTrash() {
    return _get(TRASH_KEY) || {};
  }

  function getTrashList() {
    return Object.values(getTrash()).sort((a, b) =>
      new Date(b._deletedAt || 0) - new Date(a._deletedAt || 0)
    );
  }

  function deleteChar(id) {
    const all = getAllChars();
    const char = all[id];
    if (char) {
      // Mover a papelera con timestamp
      const trash = getTrash();
      trash[id] = { ...char, _deletedAt: new Date().toISOString() };
      _set(TRASH_KEY, trash);
    }
    delete all[id];
    _set(CHARS_KEY, all);
    // Registrar como eliminado (bloquea restauración desde Firebase/IDB)
    addDeletedId(id);
    _idbMarkDeleted(id);
    // Si era el activo, limpiar
    if (getActiveId() === id) {
      const remaining = Object.keys(all);
      _set(ACTIVE_KEY, remaining.length ? remaining[0] : null);
    }
  }

  function restoreChar(id) {
    const trash = getTrash();
    const char = trash[id];
    if (!char) return false;
    // Quitar de papelera
    delete trash[id];
    _set(TRASH_KEY, trash);
    // Quitar de lista negra para que Firebase/IDB no lo bloqueen
    const ids = getDeletedIds();
    ids.delete(id);
    _set(DELETED_KEY, Array.from(ids));
    // Restaurar a chars (sin _deletedAt)
    delete char._deletedAt;
    const all = getAllChars();
    all[id] = char;
    _set(CHARS_KEY, all);
    _idbPut(char);
    return true;
  }

  function permanentDeleteChar(id) {
    // Borra definitivamente de papelera (ya está en lista negra de IDs)
    const trash = getTrash();
    delete trash[id];
    _set(TRASH_KEY, trash);
    // Borrar de Firestore si está logueado
    if (window.Cloud && Cloud.isLoggedIn && Cloud.isLoggedIn()) {
      Cloud.deleteChar(id).catch(() => {});
    }
  }

  function emptyTrash() {
    const trash = getTrash();
    // Borrar cada uno de Firestore
    Object.keys(trash).forEach(id => {
      if (window.Cloud && Cloud.isLoggedIn && Cloud.isLoggedIn()) {
        Cloud.deleteChar(id).catch(() => {});
      }
    });
    _set(TRASH_KEY, {});
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

        if (!data || typeof data !== 'object') {
          onError('Archivo inválido: no es JSON válido');
          return;
        }

        // ── Detectar formato: backup completo vs personaje individual ──────────
        // Backup:     { version, exportedAt, characters: { [id]: char } }
        // Individual: { id, name, clase, ... } (objeto de personaje directo)
        let rawChars = [];

        if (data.characters && typeof data.characters === 'object' && !Array.isArray(data.characters)) {
          // Formato backup
          rawChars = Object.values(data.characters);
        } else if (
          typeof data.id === 'string' && data.id.length > 0 &&
          typeof data.name === 'string' && data.name.length > 0 &&
          typeof data.clase === 'string'
        ) {
          // Formato personaje individual — asegurar que tiene id
          rawChars = [data];
        } else if (Array.isArray(data)) {
          // Array de personajes
          rawChars = data;
        } else {
          onError('Archivo inválido: formato no reconocido. Debe ser un backup de D&D Tracker o un JSON de personaje individual.');
          return;
        }

        const valid = rawChars.filter(c =>
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

  function _normalizeImportedChar(c) {
    // Normalizar magicItems: la app usa { name, desc }
    // JSONs externos pueden traer { id, name, rarity, attunement, desc }
    if (Array.isArray(c.magicItems)) {
      c.magicItems = c.magicItems.map(item => ({
        name: item.name || '',
        desc: item.desc || (item.rarity ? `${item.rarity}${item.attunement ? ' · Attunement' : ''}` : ''),
      })).filter(item => item.name);
    }
    // Normalizar weapons: asegurar campos mínimos
    if (Array.isArray(c.weapons)) {
      c.weapons = c.weapons.map(w => ({
        id:           w.id || ('w-' + Math.random().toString(36).slice(2,7)),
        name:         w.name || 'Arma',
        attackBonus:  typeof w.attackBonus === 'number' ? w.attackBonus : 0,
        damage:       w.damage || '1d6',
        damageType:   w.damageType || '',
        range:        w.range || '',
        notes:        w.notes || '',
      }));
    }
    // Normalizar currency: asegurar todos los campos
    if (!c.currency) c.currency = { pp:0, gp:0, ep:0, sp:0, cp:0 };
    ['pp','gp','ep','sp','cp'].forEach(k => { if (typeof c.currency[k] !== 'number') c.currency[k] = 0; });
    // Normalizar bonuses: campos esperados por la app
    if (!c.bonuses) c.bonuses = {};
    const bDefs = { init:0, ataque:0, hpMax:0, ca:0, cd:0, savesAll:0, skills:{}, saves:{} };
    Object.entries(bDefs).forEach(([k,v]) => { if (c.bonuses[k] === undefined) c.bonuses[k] = v; });
    // Normalizar hitDice: puede faltar en JSONs externos con _dataVersion alto
    if (!c.hitDice) c.hitDice = { current: c.nivel || 1, max: c.nivel || 1 };
    // Normalizar campos requeridos por el motor de combate
    if (!c.turn) c.turn = { movement: false, action: false, reaction: false, bonus: false };
    if (!Array.isArray(c.conditions)) c.conditions = [];
    if (typeof c.exhaustion !== 'number') c.exhaustion = 0;
    if (!c.hp) c.hp = { max: c.hitDie || 8, current: c.hitDie || 8, temp: 0 };
    return c;
  }

  function _doImport(validChars, onSuccess) {
    const existing = getAllChars();
    validChars.forEach(c => {
      _normalizeImportedChar(c);
      existing[c.id] = c;
    });
    _set(CHARS_KEY, existing);
    // Siempre activar el primer personaje importado
    setActiveId(validChars[0].id);
    onSuccess(validChars.length, validChars[0].id);
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
    isFirstRun,
    migrateChar: _migrate,        // expuesto para cloud.js
    restoreFromIDB: _maybeRestoreFromIDB, // recuperación post-clear
    getDeletedIds,         // expuesto para cloud.js — lista negra de IDs eliminados
    isDeleted,             // expuesto para cloud.js
    purgeDeletedFromLocal, // limpia localStorage al arrancar
    getTrash,
    getTrashList,
    restoreChar,
    permanentDeleteChar,
    emptyTrash,
  };
})();
