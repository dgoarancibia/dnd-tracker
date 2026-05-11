/* ═══════════════════════════════════════════════════════
   app.js — Lógica principal de la app
   Depende de: storage.js, characters.js
   Singleton global: App
   ═══════════════════════════════════════════════════════ */

const App = (() => {

  let _char = null;         // personaje activo en memoria

  // Recalcula features de clase según nivel desde CLASE_FEATURES (fuente de verdad).
  // Reemplaza COMPLETAMENTE las features de clase y conserva solo las de subclase.
  // Guarda en storage para que Firestore reciba la versión limpia en el próximo sync.
  function _refreshCharFeatures(c) {
    if (!c || c.id === 'lursey-brumaclara') return;
    const claseFeat = Characters.CLASE_FEATURES && Characters.CLASE_FEATURES[c.clase];
    if (!claseFeat || typeof claseFeat.features !== 'function') return;
    const nivel = c.nivel || 1;
    const rawFeats = claseFeat.features(nivel);
    const claseFeatList = rawFeats.map(f => {
      if (typeof f === 'object' && f !== null) return { ...f };
      const n = String(f);
      return { id: n.toLowerCase().replace(/[^a-z0-9]/g,'-').replace(/-+/g,'-'), name:n, source:c.clase, type:'passive', action:null, range:null, recharge:null, desc:'', fullDesc:'' };
    });
    // Solo conservar features cuyo source menciona explícitamente la subclase
    const subFeatures = (c.features || []).filter(f =>
      f.source && c.subclase && f.source.toLowerCase().includes(c.subclase.toLowerCase())
    );
    const subIds = new Set(subFeatures.map(f => f.id));
    c.features = [
      ...claseFeatList.filter(f => !subIds.has(f.id)),
      ...subFeatures,
    ];

    // Re-aplicar features derivadas de choices (feats tomados en ASI, metamagias elegidas)
    // Estas features no vienen de CLASE_FEATURES sino de decisiones del jugador.
    if (c.choices) {
      Object.entries(c.choices).forEach(([choiceId, val]) => {
        // Feats elegidos en ASI
        if (choiceId.startsWith('asi-') && val && val.mode === 'feat' && val.featId) {
          const featDef = Characters.GENERAL_FEATS && Characters.GENERAL_FEATS.find(f => f.id === val.featId);
          if (featDef) {
            const fId = val.featId + '-' + choiceId;
            if (!c.features.find(f => f.id === fId)) {
              c.features.push({ id:fId, name:featDef.name, source:`Feat · Nivel ${choiceId.replace('asi-','')}`, type:'passive', action:'Pasiva', range:'Personal', recharge:null, desc:featDef.desc, fullDesc:featDef.fullDesc || '' });
            }
          }
        }
        // Metamagias elegidas (pickMultiple)
        if (choiceId.startsWith('metamagic-') && Array.isArray(val)) {
          const levelNum = choiceId.replace('metamagic-', '');
          val.forEach(mmId => {
            const mmDef = Characters.METAMAGIC_OPTIONS && Characters.METAMAGIC_OPTIONS.find(m => m.id === mmId);
            if (!mmDef) return;
            const fId = mmId + '-' + choiceId;
            if (!c.features.find(f => f.id === fId)) {
              c.features.push({ id:fId, name:mmDef.name, source:`Metamagia · Nivel ${levelNum}`, type:'passive', action:'Pasiva', range:'Personal', recharge:null, desc:mmDef.desc, fullDesc:mmDef.desc });
            }
          });
        }
      });
    }
  }

  // Elimina duplicados de spells (por id) y recorta cantrips al máximo de la tabla.
  // Preserva cantrips de subclase (cantrip_subclass:true) fuera del límite.
  function _cleanSpells(c) {
    if (!c || !c.spells) return;
    let changed = false;

    // 1. Deduplicar por id (conservar primera aparición)
    const seen = new Set();
    const deduped = c.spells.filter(s => {
      if (seen.has(s.id)) { changed = true; return false; }
      seen.add(s.id); return true;
    });
    if (changed) c.spells = deduped;

    // 2. Recortar cantrips al máximo de la tabla (si aplica)
    const maxCantrips = Characters.getCantripsKnown(c);
    if (maxCantrips !== null) {
      const freeC = c.spells.filter(s => s.level === 0 && s.cantrip_subclass);
      const paidC = c.spells.filter(s => s.level === 0 && !s.cantrip_subclass);
      if (paidC.length > maxCantrips) {
        // Recortar a los primeros maxCantrips pagados
        const trimmed = paidC.slice(0, maxCantrips);
        c.spells = [
          ...freeC,
          ...trimmed,
          ...c.spells.filter(s => s.level > 0),
        ];
        changed = true;
      }
    }

    return changed;
  }

  let _activeTab = 'combate';
  let _toastTimer = null;
  let _concAlertTimer = null;
  let _diaryOpen = false;
  let _iftttOpen = false;
  let _spellDetailOpen = false;
  let _combatLogOpen = false;

  // Combat log — session only, max 200 entries
  const COMBAT_LOG_MAX = 200;
  let _combatLog = [];   // { id, round, text, type, ts }

  // Combat round tracker (session-only, not persisted)
  let _combatRound = 0;
  let _combatTurn  = 0;   // turn counter within the current round
  let _combatActive = false;

  // Initiative tracker — session only
  // combatants: [{ id, name, init, ac, hp, isPlayer, status:'ok'|'bloodied'|'dead', conditions:[] }]
  let _combatants   = [];
  let _activeTurnId = null;   // id del combatant con el turno activo
  let _combatantSeq = 0;
  // Legacy alias para compatibilidad con código existente
  let _enemies = [];
  let _enemyIdSeq = 0;

  // HP history for smart chips (last 5 non-zero deltas)
  let _hpHistory = [];

  /* ── Undo stack (hasta 5 snapshots) ── */
  const UNDO_MAX = 5;
  let _undoStack = [];
  let _undoBtn   = null;

  /* ══════════════════════════════════════════════════════
     INICIALIZACIÓN
  ══════════════════════════════════════════════════════ */

  async function init() {
    // Intentar restaurar desde IDB shadow backup si el localStorage quedó vacío
    // (pasa después de "Clear site data" para actualizar el SW)
    await Storage.restoreFromIDB();

    // Primer run: cargar Lursey
    if (Storage.isFirstRun()) {
      const lursey = Characters.buildLursey();
      Storage.saveChar(lursey);
      Storage.setActiveId(lursey.id);
    }

    _char = Storage.getActiveChar();
    if (!_char) {
      // Puede haber chars pero sin activeId — usar el primero disponible
      const all = Storage.getAllChars();
      const ids = Object.keys(all);
      if (ids.length > 0) {
        Storage.setActiveId(ids[0]);
        _char = Storage.getActiveChar();
      }
    }
    if (!_char) {
      window.location.href = 'index.html';
      return;
    }

    // ── Limpiar duplicados y excedentes de spells (corre siempre, todos los personajes) ──
    if (_cleanSpells(_char)) Storage.saveChar(_char);

    // ── Sincronizar datos maestros desde characters.js ──────────────────────
    // Preserva: spellSlots usados, preparedToday, cantidades de consumables
    // Aplica a TODOS los personajes (no solo Lursey)

    if (_char.id === 'lursey-brumaclara') {
      // Lursey tiene sync completo: spells, features, consumables, resources, slotPriority, combatTips
      const freshLursey = Characters.buildLursey();

      const savedPrepared = _char.preparedToday || [];
      _char.spells = freshLursey.spells.map(freshSpell => {
        const saved = (_char.spells || []).find(s => s.id === freshSpell.id);
        return { ...freshSpell, prepared: saved ? saved.prepared : freshSpell.prepared };
      });
      _char.preparedToday = savedPrepared;

      if (!_char.ifttt || _char.ifttt.length === 0) _char.ifttt = freshLursey.ifttt;
      _char.features     = freshLursey.features;
      _char.slotPriority = freshLursey.slotPriority;
      _char.combatTips   = freshLursey.combatTips;

      const savedCons = _char.consumables || [];
      freshLursey.consumables.forEach(fresh => {
        const exists = savedCons.find(s => s.id === fresh.id);
        if (!exists) savedCons.push(fresh);
        else { exists.name = fresh.name; exists.desc = fresh.desc; exists.category = fresh.category; }
      });
      _char.consumables = savedCons;

      freshLursey.resources.forEach(fresh => {
        const saved = (_char.resources || []).find(r => r.id === fresh.id);
        if (saved) {
          saved.name = fresh.name; saved.max = fresh.max; saved.note = fresh.note;
          if (saved.current > saved.max) saved.current = saved.max;
        }
      });

      Storage.saveChar(_char);

    } else {
      // Otros personajes: sync de catálogo de spells por clase
      // Solo añade conjuros de NIVEL 1+ que no existan aún — los cantrips los elige el jugador con el picker
      const catalog = (Characters.CLASE_SPELLS && Characters.CLASE_SPELLS[_char.clase]) || [];
      if (catalog.length > 0) {
        const savedPrepared = _char.preparedToday || [];
        const existingIds   = new Set((_char.spells || []).map(s => s.id));
        // Solo sincronizar hechizos de nivel 1+ (no cantrips) para no sobrepasar el límite de la tabla
        const newSpells = catalog.filter(s => s.level > 0 && !existingIds.has(s.id)).map(s => ({ ...s }));
        if (newSpells.length > 0) {
          _char.spells = [...(_char.spells || []), ...newSpells];
        }
        _char.preparedToday = savedPrepared;
      }
      Storage.saveChar(_char);

      // Sync de recursos por clase: actualizar max/note si el nivel escaló
      const claseFeat = Characters.CLASE_FEATURES && Characters.CLASE_FEATURES[_char.clase];
      if (claseFeat) {
        const freshResrcs = claseFeat.resources(_char.nivel || 1, _char.subclase || '');
        freshResrcs.forEach(fresh => {
          const saved = (_char.resources || []).find(r => r.id === fresh.id);
          if (saved) {
            if (fresh.max !== saved.max) {
              const gained = fresh.max - saved.max;
              saved.max = fresh.max;
              if (gained > 0) saved.current = Math.min(saved.current + gained, saved.max);
              if (fresh.note) saved.note = fresh.note;
            }
          } else {
            if (!_char.resources) _char.resources = [];
            _char.resources.push({ ...fresh });
          }
        });

      }
      _refreshCharFeatures(_char);
    }

    _applyTheme(localStorage.getItem('dnd_theme') || 'dark');
    _renderHeader();
    _populateCharSelector();
    _updateBackupBtn();
    _renderActiveTab();
    _updateCombatHUD();
    _setupHPSwipe();

    // Disparar elecciones pendientes si el personaje tiene elecciones sin resolver
    // (esperar un tick para que el DOM esté listo)
    setTimeout(() => {
      if (_char && _char.id !== 'lursey-brumaclara') {
        const pending = Characters.getPendingChoices(_char, _char.nivel || 1);
        if (pending.length > 0) {
          openChoicesQueue(pending, () => {
            _renderCombateTab();
            _renderHabilidadesTab();
          });
        }
      }
    }, 400);

    // Botón undo
    _undoBtn = document.getElementById('undoBtn');
    if (_undoBtn) {
      _undoBtn.disabled = true;
      _undoBtn.addEventListener('click', undoLastChange);
    }

    // Cerrar header menu al click fuera
    document.addEventListener('click', e => {
      if (_headerMenuOpen && !document.getElementById('headerMenuWrap')?.contains(e.target)) {
        closeHeaderMenu();
      }
    });

    // Cloud.init() se llama desde cloud.js al cargarse (después del módulo ESM)

    // Auto-backup y cloud save al salir
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        _saveChar();
        if (window.Cloud && Cloud.isLoggedIn()) Cloud.saveNow(_char);
      }
    });

    window.addEventListener('pagehide', () => {
      _saveChar();
      if (window.Cloud && Cloud.isLoggedIn() && _char) Cloud.saveNow(_char);
    });

    // Nivel sugerido en modal
    document.getElementById('luNewLevel').addEventListener('input', _updateLevelUpPreview);
    document.getElementById('luHPGained').addEventListener('input', _updateLevelUpPreview);
    document.getElementById('srDiceQty').addEventListener('input', _updateShortRestPreview);
    document.getElementById('srDiceResult').addEventListener('input', _updateShortRestPreview);
  }

  /* ══════════════════════════════════════════════════════
     GUARDAR
  ══════════════════════════════════════════════════════ */

  function _pushUndo() {
    if (!_char) return;
    _undoStack.push(JSON.parse(JSON.stringify(_char)));
    if (_undoStack.length > UNDO_MAX) _undoStack.shift();
    if (_undoBtn) _undoBtn.disabled = false;
  }

  function _saveChar(pushUndo = false) {
    if (!_char) return;
    if (pushUndo) _pushUndo();
    Storage.saveChar(_char);
    // Cloud autosave debounced
    if (window.Cloud && Cloud.isLoggedIn()) {
      Cloud.scheduleSave(_char);
    }
  }

  function undoLastChange() {
    if (_undoStack.length === 0) { showToast('Sin cambios para deshacer'); return; }
    const prev = _undoStack.pop();
    _char = prev;
    Storage.saveChar(_char);
    if (window.Cloud && Cloud.isLoggedIn()) Cloud.scheduleSave(_char);
    _renderHeader();
    _renderActiveTab();
    showToast('Cambio deshecho');
    if (_undoBtn) _undoBtn.disabled = _undoStack.length === 0;
  }

  /* ══════════════════════════════════════════════════════
     TEMA
  ══════════════════════════════════════════════════════ */

  /* ══════════════════════════════════════════════════════
     COMBAT LOG
  ══════════════════════════════════════════════════════ */

  function _logCombat(text, type = 'info') {
    const entry = {
      id: 'cl-' + Date.now() + '-' + Math.random().toString(36).slice(2,5),
      round: _combatActive ? _combatRound : 0,
      text,
      type,  // 'dmg' | 'heal' | 'spell' | 'resource' | 'cond' | 'rest' | 'info'
      ts: Date.now()
    };
    _combatLog.unshift(entry);
    if (_combatLog.length > COMBAT_LOG_MAX) _combatLog.pop();
    // Update badge
    const badge = document.getElementById('nbLogBadge');
    if (badge) badge.textContent = _combatLog.length > 0 ? _combatLog.length : '';
    // Live update if panel open
    if (_combatLogOpen) _renderCombatLog();
  }

  // Notebook state
  let _notebookOpen = false;
  let _notebookTab  = 'diary'; // 'diary' | 'log' | 'stats' | 'maps'
  let _diaryCatFilter = '';    // '' = todas las categorías
  let _diarySearch    = '';    // texto de búsqueda
  let _newDiaryCat    = '';    // categoría de la próxima entrada

  function toggleNotebook() {
    _notebookOpen = !_notebookOpen;
    const panel = document.getElementById('notebookPanel');
    if (panel) panel.classList.toggle('open', _notebookOpen);
    document.getElementById('overlayBackdrop').classList.toggle('show', _notebookOpen || _iftttOpen);
    if (_notebookOpen) {
      if (_notebookTab === 'diary') _renderDiaryEntries();
      else _renderCombatLog();
    }
  }

  function switchNotebookTab(tab) {
    _notebookTab = tab;
    document.getElementById('nbTabDiary')?.classList.toggle('active', tab === 'diary');
    document.getElementById('nbTabLog')?.classList.toggle('active',   tab === 'log');
    document.getElementById('nbTabStats')?.classList.toggle('active', tab === 'stats');
    document.getElementById('nbTabMaps')?.classList.toggle('active',  tab === 'maps');
    document.getElementById('nbPaneDiary').style.display  = tab === 'diary'  ? 'flex' : 'none';
    document.getElementById('nbPaneLog').style.display    = tab === 'log'    ? 'flex' : 'none';
    document.getElementById('nbPaneStats').style.display  = tab === 'stats'  ? 'flex' : 'none';
    document.getElementById('nbPaneMaps').style.display   = tab === 'maps'   ? 'flex' : 'none';
    if (tab === 'log')        _renderCombatLog();
    else if (tab === 'stats') _renderCampaignStats();
    else if (tab === 'maps')  { if (typeof Maps !== 'undefined' && _char) Maps.init(_char.id); }
    else _renderDiaryEntries();
  }

  // Legacy shims (used by closeAllOverlays etc.)
  function toggleCombatLog() { if (!_notebookOpen) toggleNotebook(); switchNotebookTab('log'); }
  function _renderCombatLog() {
    const container = document.getElementById('combatLogEntries');
    if (!container) return;
    if (_combatLog.length === 0) {
      container.innerHTML = `<div class="empty-state"><div class="es-icon">⚔️</div><div class="es-title">Sin eventos</div><div class="es-text">Las acciones de combate aparecerán aquí.</div></div>`;
      return;
    }
    container.innerHTML = _combatLog.map(e => {
      const d = new Date(e.ts);
      const ts = d.toLocaleTimeString('es', { hour:'2-digit', minute:'2-digit', second:'2-digit' });
      const rnd = e.round > 0 ? `<span class="cl-round">R${e.round}</span>` : '';
      return `<div class="cl-entry cl-${e.type}">
        <div class="cl-meta">${rnd}<span class="cl-ts">${ts}</span></div>
        <div class="cl-text">${e.text}</div>
      </div>`;
    }).join('');
  }

  function clearCombatLog() {
    _combatLog = [];
    const fab = document.getElementById('combatLogFab');
    if (fab) fab.setAttribute('data-count', '0');
    _renderCombatLog();
    showToast('Log limpiado');
  }

  function exportCombatLog() {
    if (_combatLog.length === 0) { showToast('Log vacío'); return; }
    const lines = _combatLog.slice().reverse().map(e => {
      const d = new Date(e.ts);
      const ts = d.toLocaleTimeString('es', { hour:'2-digit', minute:'2-digit', second:'2-digit' });
      const rnd = e.round > 0 ? `[R${e.round}] ` : '';
      return `${ts} ${rnd}${e.text}`;
    });
    const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `combat-log-${new Date().toISOString().slice(0,10)}.txt`;
    a.click();
  }

  function _applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('dnd_theme', theme);
    const btn = document.getElementById('themeToggleBtn');
    if (btn) btn.textContent = theme === 'light' ? '🌙 Modo oscuro' : '☀ Modo claro';
  }

  function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme') || 'dark';
    _applyTheme(current === 'dark' ? 'light' : 'dark');
  }

  /* ══════════════════════════════════════════════════════
     HEADER
  ══════════════════════════════════════════════════════ */

  function _renderHeader() {
    if (!_char) return;
    const prof = Characters.calcProfBonus(_char.nivel);
    const cd   = Characters.calcCD(_char);
    const atq  = Characters.calcAtaqueBonus(_char);
    const init = Characters.calcInit(_char);
    const ca   = Characters.calcCA(_char);

    document.getElementById('headerCharName').textContent = _char.name;

    // Subtítulo: "Clérigo 6" o "Clérigo 4 / Guerrero 2" si hay multiclase
    const subtitleEl = document.getElementById('headerCharSubtitle');
    if (subtitleEl) {
      const classes = _char.classes && _char.classes.length > 0 ? _char.classes : [{ name: _char.clase, level: _char.nivel }];
      subtitleEl.textContent = classes.map(c => `${c.name} ${c.level}`).join(' / ');
    }

    document.getElementById('hdrCA').textContent   = ca;
    const cdBonus  = (_char.bonuses && _char.bonuses.cd)     || 0;
    const atqBonus = (_char.bonuses && _char.bonuses.ataque) || 0;
    document.getElementById('hdrCD').textContent   = cd  !== null ? cd  : '—';
    document.getElementById('hdrATQ').textContent  = atq !== null ? (atq >= 0 ? '+' : '') + atq : '—';
    // Indicador de bonus activo en header
    const cdEl  = document.getElementById('hdrCD');
    const atqEl = document.getElementById('hdrATQ');
    if (cdEl)  cdEl.title  = cdBonus  ? `CD base + ${cdBonus} (ítem/rasgo) = ${cd}`  : 'CD de Conjuros';
    if (atqEl) atqEl.title = atqBonus ? `Ataque base + ${atqBonus} (ítem/rasgo) = ${atq >= 0 ? '+' : ''}${atq}` : 'Bonus Ataque Mágico';
    // Marcar visualmente si hay bonus
    const cdBox  = cdEl?.closest('.stat-box');
    const atqBox = atqEl?.closest('.stat-box');
    if (cdBox)  cdBox.classList.toggle('has-bonus',  !!cdBonus);
    if (atqBox) atqBox.classList.toggle('has-bonus', !!atqBonus);
    document.getElementById('hdrINIT').textContent = (init >= 0 ? '+' : '') + init;
    const strMod = Characters.calcMod(_char.stats.for);
    const dexMod = Characters.calcMod(_char.stats.des);
    const physAtk = Math.max(strMod, dexMod) + prof;
    document.getElementById('hdrPROF').textContent = (physAtk >= 0 ? '+' : '') + physAtk;

    const inspBtn = document.getElementById('hdrInspBtn');
    if (inspBtn) inspBtn.classList.toggle('active', !!_char.inspiration);

    _updateHPDisplay();
    _updateTempHPDisplay();
    _updateHeaderStatus();
  }

  function _updateHeaderStatus() {
    const el = document.getElementById('hdrStatus');
    if (!el || !_char) return;
    let html = '';
    // Concentración activa
    if (_char.concentration) {
      const sp = (_char.spells || []).find(s => s.id === _char.concentration);
      const name = sp ? sp.name : _char.concentration;
      const rounds = _concRoundsActive();
      const roundsStr = rounds ? ` · R${rounds}` : '';
      html += `<span class="hdr-status-chip conc" onclick="App.switchTab('combate')" title="Romper concentración · toca Combate">◆ ${name}${roundsStr}</span>`;
    }
    // Agotamiento activo
    if (_char.exhaustion > 0) {
      const exClass = _char.exhaustion >= 6 ? 'exhaustion-dead' : _char.exhaustion >= 3 ? 'exhaustion-warn' : 'exhaustion';
      html += `<span class="hdr-status-chip ${exClass}" onclick="App.switchTab('combate')" title="Agotamiento nivel ${_char.exhaustion}">😴 Ago. ${_char.exhaustion}</span>`;
    }
    // Condiciones activas (máx 3 visibles)
    const conds = (_char.conditions || []).slice(0, 3);
    conds.forEach(cid => {
      const labels = { caido:'Caído', envenenado:'Envenenado', aturdido:'Aturdido', asustado:'Asustado', paralizado:'Paralizado', incapacitado:'Incapac.' };
      html += `<span class="hdr-status-chip cond">${labels[cid] || cid}</span>`;
    });
    if ((_char.conditions || []).length > 3) {
      html += `<span class="hdr-status-chip cond">+${_char.conditions.length - 3}</span>`;
    }
    el.innerHTML = html;
    el.style.display = html ? 'flex' : 'none';
  }

  function _updateHPDisplay() {
    if (!_char) return;
    const { current, max, temp } = _char.hp;
    const pct = max > 0 ? Math.min(100, (current / max) * 100) : 0;
    const col = pct > 50 ? '#4a8a5a' : pct > 25 ? '#a0802a' : '#8a3a3a';
    const textCol = pct <= 0 ? '#ff4040' : pct <= 25 ? '#e05050' : pct <= 50 ? '#e08050' : 'var(--text)';

    const hdrHP = document.getElementById('hdrHP');
    if (hdrHP) { hdrHP.textContent = current; hdrHP.style.color = textCol; }

    const hdrMax = document.getElementById('hdrHPMax');
    if (hdrMax) hdrMax.value = max;

    const bar = document.getElementById('hdrHPBar');
    if (bar) { bar.style.width = pct + '%'; bar.style.background = col; }

    const tempEl = document.getElementById('hdrHPTemp');
    if (tempEl) {
      if (temp > 0) { tempEl.textContent = '+' + temp; tempEl.style.display = 'inline'; }
      else tempEl.style.display = 'none';
    }

    // Estado caído
    const header = document.getElementById('appHeader');
    if (header) header.classList.toggle('dying', current <= 0);

    let dyingBadge = document.getElementById('dyingBadge');
    if (current <= 0) {
      if (!dyingBadge) {
        dyingBadge = document.createElement('div');
        dyingBadge.id = 'dyingBadge';
        dyingBadge.className = 'dying-badge';
        dyingBadge.textContent = '☠ Caído · Tiradas de muerte';
        document.querySelector('.stats-strip').prepend(dyingBadge);
      }
    } else if (dyingBadge) {
      dyingBadge.remove();
    }
  }

  function _populateCharSelector() {
    const sel = document.getElementById('charSelector');
    sel.innerHTML = '';
    const chars = Storage.getAllCharsList();
    chars.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.id;
      opt.textContent = `${c.name} (Nvl ${c.nivel})`;
      if (c.id === _char.id) opt.selected = true;
      sel.appendChild(opt);
    });
  }

  function _updateBackupBtn() {
    const ts = Storage.getBackupTimestamp();
    const el = document.getElementById('backupTs');
    if (!ts) {
      if (el) el.textContent = 'Sin backup';
      return;
    }
    const diff = Date.now() - new Date(ts).getTime();
    const hours = Math.floor(diff / 3600000);
    const mins  = Math.floor(diff / 60000);
    if (el) {
      if (mins < 1) el.textContent = 'Hace un momento';
      else if (mins < 60) el.textContent = `Hace ${mins} min`;
      else el.textContent = `Hace ${hours}h`;
    }
  }

  let _headerMenuOpen = false;

  function toggleHeaderMenu() {
    _headerMenuOpen = !_headerMenuOpen;
    const dd = document.getElementById('headerMenuDropdown');
    if (dd) dd.classList.toggle('open', _headerMenuOpen);
  }

  function closeHeaderMenu() {
    _headerMenuOpen = false;
    const dd = document.getElementById('headerMenuDropdown');
    if (dd) dd.classList.remove('open');
  }

  /* ══════════════════════════════════════════════════════
     TABS
  ══════════════════════════════════════════════════════ */

  function switchTab(name) {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    document.querySelector(`[data-tab="${name}"]`).classList.add('active');
    document.getElementById(`tab-${name}`).classList.add('active');
    _activeTab = name;

    const renders = {
      combate: _renderCombateTab,
      conjuros: _renderConjurosTab,
      equipo: _renderEquipoTab,
      habilidades: _renderHabilidadesTab,
      biblioteca: () => { if (typeof Biblioteca !== 'undefined') Biblioteca.onTabActivated(); },
    };
    if (renders[name]) renders[name]();
  }

  function _renderActiveTab() {
    switchTab(_activeTab);
  }

  /* ══════════════════════════════════════════════════════
     TAB COMBATE
  ══════════════════════════════════════════════════════ */

  function _renderCombateTab() {
    _renderCombateIzq();
    _renderCombateDer();
  }

  function _renderCombateIzq() {
    const c = _char;
    const prof = Characters.calcProfBonus(c.nivel);
    const conMod = Characters.calcMod(c.stats.con);

    let html = `
    <!-- RONDAS Y TURNO -->
    <div id="roundDisplay"></div>

    <!-- ACCIONES DEL TURNO -->
    <div class="turn-block">
      <div class="turn-actions-grid">
        <button class="turn-action-btn ${c.turn.action ? 'used' : ''}" id="turnAction" onclick="App.toggleTurn('action')">Acción</button>
        <button class="turn-action-btn ${c.turn.bonus ? 'used' : ''}" id="turnBonus" onclick="App.toggleTurn('bonus')">Bonus Action</button>
        <button class="turn-action-btn reaction ${c.turn.reaction ? 'used' : ''}" id="turnReaction" onclick="App.toggleTurn('reaction')">Reacción</button>
        <button class="turn-action-btn ${c.turn.movement ? 'used' : ''}" id="turnMovement" onclick="App.toggleTurn('movement')">Movimiento</button>
      </div>
      <button class="turn-end-btn" onclick="App.endTurn()">↺ Fin de Turno</button>
    </div>

    <!-- TIRADAS DE MUERTE -->
    ${c.hp.current === 0 ? _buildDeathSavesHTML(c) : ''}

    <!-- CONCENTRACIÓN -->
    <div class="conc-block ${c.concentration ? 'conc-active' : ''}">
      <span class="conc-label">${c.concentration ? '◆ Concentración activa' : 'Concentración'}</span>
      <div class="conc-btns" id="concBtns">${_buildConcBtns(c)}</div>
    </div>

    <!-- RECURSOS CON CONTADORES -->
    <div class="section-hd" style="margin-top:12px;">Recursos</div>`;

    html += `<div class="resources-grid">`;

    // 1. SPELL SLOTS — ancho completo, primero
    html += `<div class="slots-card full-width-card"><div class="rc-top" style="margin-bottom:4px;"><span class="rc-name">Spell Slots</span><span class="rc-recharge">↺ Largo</span></div>`;
    for (let i = 1; i <= 9; i++) {
      const slot = c.spellSlots[i];
      if (!slot || slot.max === 0) continue;
      let dotsHtml = '';
      for (let d = 0; d < slot.max; d++) {
        const used = d >= slot.current;
        dotsHtml += `<div class="slot-dot${used ? ' used' : ''}" onclick="App.toggleSlotDot(${i},${d})"></div>`;
      }
      html += `<div class="slot-row"><span class="slot-lv">Nvl ${i}</span><div class="slot-dots" id="slot-dots-${i}">${dotsHtml}</div></div>`;
    }
    html += `</div>`;

    // 2. DADOS DE GOLPE — full width, todos juntos
    let hdDotsHtml = '';
    for (let d = 0; d < c.hitDice.max; d++) {
      const used = d >= c.hitDice.current;
      hdDotsHtml += `<div class="slot-dot${used ? ' used' : ''}" onclick="App.toggleHitDieDot(${d})"></div>`;
    }
    html += `<div class="resource-card full-width-card"><div class="rc-top"><span class="rc-name">Dados de Golpe (d${c.hitDie})</span><span class="rc-recharge">↺ Largo (mitad)</span></div><div class="slot-dots" id="hd-dots">${hdDotsHtml}</div></div>`;

    // 3. RECURSOS — grilla 2 columnas, al final
    c.resources.forEach(r => {
      const rechargeLabel = { short: '↺ Corto', long: '↺ Largo', dawn: '↺ Amanecer', never: '—' }[r.recharge] || r.recharge;
      const isCustom = !['channel-divinity','bond','guiding-bolt-mi'].includes(r.id);
      let dotsHtml = '';
      for (let d = 0; d < r.max; d++) {
        const used = d >= r.current;
        dotsHtml += `<div class="slot-dot${used ? ' used' : ''}" onclick="App.toggleResourceDot('${r.id}',${d})"></div>`;
      }
      html += `<div class="resource-card"><div class="rc-top"><span class="rc-name">${r.name}</span><span class="rc-recharge">${rechargeLabel}</span>${isCustom ? `<button class="btn-sm" style="color:var(--red-light);border-color:rgba(138,58,58,0.3);padding:1px 5px;min-height:20px;font-size:9px;" onclick="App.deleteResource('${r.id}')">✕</button>` : ''}</div><div class="slot-dots" id="rc-dots-${r.id}">${dotsHtml}</div></div>`;
    });

    html += `</div>`; // cierra resources-grid

    // DESCANSOS — en header, no duplicar aquí

    // AGOTAMIENTO (Exhaustion)
    const EXHAUSTION_EFFECTS = [
      null, // nivel 0 = sin efecto
      'Desventaja en pruebas de habilidad (D20 Tests)',
      'Velocidad reducida a la mitad',
      'Desventaja en tiradas de ataque y salvación',
      'Máximo de HP reducido a la mitad',
      'Velocidad reducida a 0',
      'Muerte',
    ];
    const exhaustion = c.exhaustion || 0;
    const exEffect   = exhaustion > 0 ? EXHAUSTION_EFFECTS[exhaustion] : null;

    html += `
    <div class="exhaustion-block">
      <div class="rc-header" style="margin-bottom:8px;">
        <span class="rc-name">Agotamiento</span>
        <div class="exh-controls">
          <button class="exh-btn minus" onclick="App.adjustExhaustion(-1)" ${exhaustion <= 0 ? 'disabled' : ''}>−</button>
          <span class="exh-level ${exhaustion > 0 ? (exhaustion >= 5 ? 'danger' : exhaustion >= 3 ? 'warning' : 'active') : ''}">${exhaustion}</span>
          <button class="exh-btn plus" onclick="App.adjustExhaustion(1)" ${exhaustion >= 6 ? 'disabled' : ''}>+</button>
        </div>
      </div>
      <div class="exh-pips">
        ${[1,2,3,4,5,6].map(n => `<div class="exh-pip ${n <= exhaustion ? (exhaustion >= 6 ? 'dead' : exhaustion >= 5 ? 'danger' : exhaustion >= 3 ? 'warning' : 'filled') : ''}" onclick="App.setExhaustion(${n === exhaustion ? 0 : n})" title="Nivel ${n}: ${EXHAUSTION_EFFECTS[n]}"></div>`).join('')}
      </div>
      ${exEffect ? `<div class="exh-effect">${exEffect}${exhaustion >= 2 ? '<br><span style="opacity:0.7;font-size:10px;">+ efectos anteriores acumulados</span>' : ''}</div>` : '<div class="exh-none">Sin agotamiento</div>'}
    </div>`;

    // CONDICIONES
    const CONDITIONS = [
      { id:'caido',         label:'Caído',         effect:'Desventaja en ataques · Ataques cuerpo a cuerpo contra ti con ventaja · Vel 0' },
      { id:'envenenado',    label:'Envenenado',     effect:'Desventaja en ataques y checks de habilidad' },
      { id:'aturdido',      label:'Aturdido',       effect:'Incapacitado · no puede moverse · falla STR/DEX saves · ataques contra ti con ventaja' },
      { id:'agarrado',      label:'Agarrado',       effect:'Velocidad 0 · termina si el agarrador queda incapacitado' },
      { id:'asustado',      label:'Asustado',       effect:'Desventaja en ataques y checks mientras vea la fuente · no puede acercarse a ella' },
      { id:'incapacitado',  label:'Incapacitado',   effect:'No puede realizar acciones ni reacciones' },
      { id:'cegado',        label:'Cegado',         effect:'Falla checks que requieran vista · desventaja en ataques · ventaja contra ti' },
      { id:'encantado',     label:'Encantado',      effect:'No puede atacar al encantador · el encantador tiene ventaja en checks sociales' },
      { id:'ensordecido',   label:'Ensordecido',    effect:'Falla checks que requieran oído' },
      { id:'invisible',     label:'Invisible',      effect:'Ventaja en ataques · desventaja en ataques contra ti · no se puede ver sin magia' },
      { id:'paralizado',    label:'Paralizado',     effect:'Incapacitado · falla STR/DEX saves · ataques con ventaja · golpes a 5ft son críticos' },
      { id:'apresado',      label:'Apresado',       effect:'Restringido: sin vel, sin reacciones · desventaja en ataques · ventaja contra ti' },
    ];

    html += `
    <div class="conditions-block">
      <div class="rc-header">
        <span class="rc-name">Condiciones</span>
        <button class="btn-sm" onclick="App.clearConditions()">Limpiar</button>
      </div>
      <div class="conditions-grid">`;

    CONDITIONS.forEach(cond => {
      const active = c.conditions.includes(cond.id);
      html += `<button class="cond-btn ${active ? 'active' : ''}" onclick="App.toggleCondition('${cond.id}')" title="${cond.effect}">${cond.label}</button>`;
    });

    html += `</div>`;

    // Efectos de condiciones activas
    const activeConditions = CONDITIONS.filter(cond => c.conditions.includes(cond.id));
    if (activeConditions.length > 0) {
      html += `<div class="cond-effects">`;
      activeConditions.forEach(cond => {
        html += `<div class="cond-effect-row"><span class="cond-effect-name">${cond.label}</span><span class="cond-effect-text">${cond.effect}</span></div>`;
      });
      html += `</div>`;
    }

    html += `</div>`;

    // RECURSOS CUSTOM
    html += `
    <div style="margin-top:4px;">
      <button class="btn btn-ghost" style="width:100%;" onclick="App.openCustomResource()">+ Agregar Recurso</button>
    </div>`;

    document.getElementById('col-combate-izq').innerHTML = html;
    _updateRoundDisplay();
    _updateConcBlock();
  }

  function _buildDeathSavesHTML(c) {
    if (!c.deathSaves) c.deathSaves = { successes: 0, failures: 0 };
    const { successes, failures } = c.deathSaves;

    let succDots = '';
    for (let i = 0; i < 3; i++) {
      succDots += `<div class="ds-dot success ${i < successes ? 'filled' : ''}" onclick="App.toggleDeathSave('success',${i})"></div>`;
    }
    let failDots = '';
    for (let i = 0; i < 3; i++) {
      failDots += `<div class="ds-dot failure ${i < failures ? 'filled' : ''}" onclick="App.toggleDeathSave('failure',${i})"></div>`;
    }

    const status = successes >= 3
      ? '<span class="ds-status stable">✦ Estable</span>'
      : failures >= 3
      ? '<span class="ds-status dead">☠ Muerto</span>'
      : '<span class="ds-status dying">⚠ Caído</span>';

    return `
    <div class="death-saves-block" id="deathSavesBlock">
      <div class="rc-header">
        <span class="rc-name">☠ Tiradas de Muerte</span>
        ${status}
        <button class="btn-sm" onclick="App.resetDeathSaves()">Resetear</button>
      </div>
      <div class="ds-row">
        <span class="ds-label success-label">Éxitos</span>
        <div class="ds-dots">${succDots}</div>
      </div>
      <div class="ds-row">
        <span class="ds-label failure-label">Fallos</span>
        <div class="ds-dots">${failDots}</div>
      </div>
    </div>`;
  }

  function _buildConcBtns(c) {
    const active = c.concentration;
    const spellsConc = (c.spells || []).filter(s => s.concentration && s.level > 0 && s.domain);
    const prepared = (c.preparedToday || []);
    const allConc = (c.spells || []).filter(s => s.concentration && s.level > 0 &&
      (s.domain || prepared.includes(s.id)));

    let html = active
      ? `<button class="conc-btn none conc-romper" onclick="App.setConc(null)">✕ Romper</button>`
      : ``;
    allConc.forEach(sp => {
      html += `<button class="conc-btn ${active === sp.id ? 'active' : ''}" onclick="App.setConc('${sp.id}')">${sp.name.replace(' ◆','').replace(' ●','')}</button>`;
    });
    return html;
  }

  function _renderCombateDer() {
    const c = _char;
    const colDer = document.getElementById('col-combate-der');
    if (!c || !colDer) return;

    // Conjuros clave referencia: cantrips de combate, MI, domain, o preparados hoy
    const keySells = (c.spells || []).filter(s =>
      (s.level === 0 && s.combat !== false) || s.mi || s.domain || (c.preparedToday||[]).includes(s.id));

    // Initiative tracker — solo visible en combate activo
    let html = '';
    if (_combatActive) {
      html = `<div class="section-hd" style="margin-bottom:6px;">⚔ Iniciativa</div>
    <div id="initTracker"></div>
    <div style="margin-bottom:10px;"></div>`;
    }

    html += `
    <button class="btn btn-gold" style="width:100%;margin-bottom:10px;font-size:12px;padding:8px;" onclick="App.openIfttt()">⚔️ Guía de Combate</button>`;

    // Primal Companion (Beast Master) — arriba del todo, debajo de Guía de Combate
    if (c.subclase === 'Beast Master') {
      html += _renderCompanionHTML(c);
    }

    html += `<div class="section-hd" style="margin-top:14px;">✨ Conjuros de Referencia</div>`;

    const byLevel = {};
    keySells.forEach(s => {
      const lv = s.level === 0 ? 'Cantrip' : `Nivel ${s.level}`;
      if (!byLevel[lv]) byLevel[lv] = [];
      byLevel[lv].push(s);
    });

    Object.keys(byLevel).sort().forEach(lv => {
      html += `<div class="spell-group-title">${lv}</div>`;
      byLevel[lv].forEach(sp => {
        const tags = _buildTagsHTML(sp);
        // Determine if castable / has slots
        let castable = true;
        let castLabel = 'Lanzar';
        if (sp.level > 0 && !sp.domain && !sp.mi) {
          let hasSlot = false;
          for (let i = sp.level; i <= 9; i++) {
            const s = _char.spellSlots && _char.spellSlots[i];
            if (s && s.current > 0) { hasSlot = true; break; }
          }
          if (!hasSlot) { castable = false; castLabel = 'Sin slots'; }
        }
        html += `
        <div class="spell-card">
          <div class="spell-info" onclick="App.openSpellDetail('${sp.id}')">
            <div class="spell-top">
              <span class="spell-lvl">${sp.level === 0 ? 'C' : sp.level}</span>
              <span class="spell-name">${sp.name}</span>${tags}
            </div>
            <div class="spell-desc">${sp.desc}</div>
          </div>
          <button class="cast-btn${castable ? '' : ' cast-btn-disabled'}" onclick="App.castSpell('${sp.id}')" ${castable ? '' : 'disabled'}>${castLabel}</button>
        </div>`;
      });
    });

    // Habilidades de clase
    const features = c.features || [];
    if (features.length) {
      html += `<div class="section-hd" style="margin-top:16px;">⚡ Habilidades de Clase</div>`;
      features.forEach(f => {
        const badge = f.type === 'passive'
          ? `<span class="feat-badge feat-passive">Pasiva</span>`
          : `<span class="feat-badge feat-active">Activa</span>`;

        // Si la feature tiene una elección asociada, mostrar la opción elegida
        let displayDesc = f.desc;
        let choiceBtn = '';
        const claseCfg = Characters.CHOICES_CONFIG[c.clase] || [];
        const linkedChoice = claseCfg.find(ch => ch.id === f.id || f.id.startsWith(ch.id.replace(/-\d+$/,'')));
        if (linkedChoice && linkedChoice.type === 'pick1') {
          const chosenId = c.choices && c.choices[linkedChoice.id];
          if (chosenId) {
            const opt = linkedChoice.options.find(o => o.id === chosenId);
            if (opt) {
              displayDesc = `<strong style="color:var(--gold-light);">${opt.name}</strong>${opt.desc ? ' — ' + opt.desc : ''}`;
            }
          } else {
            displayDesc = `<em style="color:var(--text-dim);">Sin elegir</em>`;
            choiceBtn = `<button class="btn-choice-inline" onclick="event.stopPropagation();App._promptChoice('${linkedChoice.id}')">Elegir</button>`;
          }
        }

        html += `<div class="feat-card" onclick="App.openFeatureDetail('${f.id}')">
          <div class="feat-top"><span class="feat-name">${f.name}</span>${badge}${choiceBtn}</div>
          <div class="feat-source">${f.source}</div>
          <div class="feat-desc">${displayDesc}</div>
        </div>`;
      });
    }

    // Battle Master maneuvers — mostrar las elegidas
    if (c.subclase === 'Battle Master' && c.maneuvers && c.maneuvers.length > 0) {
      const allSubs = Characters.SUBCLASES_CONFIG;
      const bmSub = allSubs && allSubs['Battle Master'];
      const allManeuverDefs = (bmSub && bmSub.maneuvers) || [];
      const nivel = c.nivel || 1;
      const diceCount = nivel >= 15 ? 6 : nivel >= 7 ? 5 : 4;
      const diceSide  = nivel >= 18 ? 12 : nivel >= 10 ? 10 : 8;
      html += `<div class="section-hd" style="margin-top:16px;">🗡 Maniobras (d${diceSide} × ${diceCount})</div>`;
      c.maneuvers.forEach(mId => {
        const mDef = allManeuverDefs.find(m => m.id === mId);
        if (!mDef) return;
        html += `<div class="feat-card">
          <div class="feat-top"><span class="feat-name">${mDef.name}</span><span class="feat-badge feat-active">1 dado</span></div>
          <div class="feat-desc">${mDef.desc}</div>
        </div>`;
      });
    }

    // Si es Battle Master pero no tiene maniobras elegidas aún
    if (c.subclase === 'Battle Master' && (!c.maneuvers || c.maneuvers.length === 0)) {
      html += `<div class="section-hd" style="margin-top:16px;">🗡 Maniobras</div>
        <div class="empty-state-mini">
          <div>Elige tus maniobras en Habilidades → Subclase</div>
          <button class="btn btn-gold" style="margin-top:8px;font-size:12px;padding:6px 14px;" onclick="App.openSubclaseModal()">Elegir maniobras</button>
        </div>`;
    }

    // Prioridad de slots
    const prio = c.slotPriority || [];
    if (prio.length > 0) {
      html += `<div class="section-hd" style="margin-top:16px;">🎯 Prioridad de Slots</div>`;
      prio.forEach((p, i) => {
        html += `<div class="prio-item"><span class="prio-num">${i+1}</span><span class="prio-text"><strong>${p.label}</strong><small>${p.note}</small></span></div>`;
      });
    }

    // Tips de combate
    const tips = c.combatTips || [];
    if (tips.length > 0) {
      html += `<div style="margin-top:14px;">`;
      tips.forEach(t => {
        html += `<div class="note-block">${t.text}</div>`;
      });
      html += `</div>`;
    }

    colDer.innerHTML = html;
    _renderInitTracker();
  }

  function _buildTagsHTML(sp) {
    let tags = '';
    if (sp.concentration) tags += '<span class="tag tag-c">Conc</span>';
    if (sp.bonus) tags += '<span class="tag tag-b">Bonus</span>';
    if (sp.domain) tags += '<span class="tag tag-d">Dom</span>';
    if (sp.mi) tags += '<span class="tag tag-mi">MI</span>';
    if (sp.ritual) tags += '<span class="tag tag-r">Ritual</span>';
    return tags;
  }

  /* ══════════════════════════════════════════════════════
     TAB CONJUROS
  ══════════════════════════════════════════════════════ */

  // Spell filter state
  let _spellFilter = { tag: 'all', level: null };

  function setSpellFilter(tag, level) {
    _spellFilter = { tag, level: level !== undefined ? level : null };
    _renderConjurosIzq();
    // Update chip active states
    document.querySelectorAll('.sf-chip').forEach(el => {
      const t = el.dataset.tag;
      const l = el.dataset.level !== undefined ? +el.dataset.level : null;
      el.classList.toggle('active', t === tag && (l === null ? level === undefined : l === level));
    });
  }

  function _renderConjurosIzq() {
    const c = _char;
    const prepared = c.preparedToday || [];
    const { tag, level } = _spellFilter;
    const isKnownCasterCtx = Characters.isKnownCaster(c);

    // Para known casters: mostrar catálogo completo de la clase
    // Para prepare casters: mostrar los conjuros guardados en char.spells
    const sourceSpells = isKnownCasterCtx
      ? (Characters.CLASE_SPELLS && Characters.CLASE_SPELLS[c.clase] || [])
      : (c.spells || []);

    const knownIds = new Set((c.spells || []).map(s => s.id));

    // Build filter chips from sourceSpells levels
    const levels = [...new Set(sourceSpells.filter(s => s.level > 0).map(s => s.level))].sort((a,b)=>a-b);

    const subLabel = isKnownCasterCtx
      ? 'Toca ★ para agregar/quitar de conocidos'
      : 'Toca para preparar/despreparar';

    let htmlIzq = `
    <div class="section-hd" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:6px;">
      <span>Todos los Conjuros</span>
      <span style="font-size:10px;color:var(--text-dim);font-family:'Crimson Pro',serif;font-style:italic;text-transform:none;letter-spacing:0;">${subLabel}</span>
    </div>
    <div class="sf-bar">
      <button class="sf-chip${tag==='all'?' active':''}" data-tag="all" onclick="App.setSpellFilter('all')">Todos</button>
      ${isKnownCasterCtx ? `<button class="sf-chip${tag==='known'?' active':''}" data-tag="known" onclick="App.setSpellFilter('known')">Conocidos</button>` : `<button class="sf-chip${tag==='prep'?' active':''}" data-tag="prep" onclick="App.setSpellFilter('prep')">Preparados</button>`}
      <button class="sf-chip${tag==='conc'?' active':''}" data-tag="conc" onclick="App.setSpellFilter('conc')">Conc</button>
      <button class="sf-chip${tag==='bonus'?' active':''}" data-tag="bonus" onclick="App.setSpellFilter('bonus')">Bonus</button>
      ${levels.map(l => `<button class="sf-chip sf-lvl${tag==='lvl'&&level===l?' active':''}" data-tag="lvl" data-level="${l}" onclick="App.setSpellFilter('lvl',${l})">Nvl ${l}</button>`).join('')}
    </div>`;

    // Apply filter
    let spells = sourceSpells;
    if (tag === 'known')  spells = spells.filter(s => knownIds.has(s.id));
    else if (tag === 'prep')   spells = spells.filter(s => s.level === 0 || s.domain || s.mi || prepared.includes(s.id));
    else if (tag === 'conc')   spells = spells.filter(s => s.concentration);
    else if (tag === 'bonus')  spells = spells.filter(s => s.bonus);
    else if (tag === 'lvl')    spells = spells.filter(s => s.level === level);

    const byLevel = {};
    spells.forEach(s => {
      if (!byLevel[s.level]) byLevel[s.level] = [];
      byLevel[s.level].push(s);
    });

    if (spells.length === 0) {
      htmlIzq += `<div style="padding:20px 0;color:var(--text-dim);font-style:italic;font-size:13px;">Sin conjuros con ese filtro.</div>`;
    } else {
      // Para el título de cantrips: mostrar conteo real vs máximo
      const maxC   = Characters.getCantripsKnown(c);
      const totalC = (c.spells || []).filter(s => s.level === 0).length;
      const freeC  = (c.spells || []).filter(s => s.level === 0 && s.cantrip_subclass).length;
      const paidC  = totalC - freeC;
      const cantripLabel = maxC !== null
        ? `Cantrips — ${paidC}/${maxC}${freeC > 0 ? ` +${freeC} subclase` : ''}`
        : `Cantrips — ${totalC}`;

      Object.keys(byLevel).sort((a,b) => +a - +b).forEach(lv => {
        const label = +lv === 0 ? cantripLabel : `Nivel ${lv}`;
        htmlIzq += `<div class="spell-group-title">${label}</div>`;
        byLevel[lv].forEach(sp => {
          const isCantrip  = sp.level === 0;
          const isDomain   = sp.domain;
          const isMI       = sp.mi;
          const isKnown    = knownIds.has(sp.id);
          const isPrepared = prepared.includes(sp.id) || isDomain || isMI || isCantrip;
          const tags = _buildTagsHTML(sp);

          let checkClass, checkClick, checkCursor, checkTitle;
          if (isCantrip) {
            checkClass  = sp.cantrip_subclass ? 'domain' : (isKnown ? 'cantrip' : '');
            checkClick  = `onclick="App.openCantripPicker()"`;
            checkCursor = 'cursor:pointer;';
            checkTitle  = 'Editar cantrips';
          } else if (isDomain || isMI) {
            checkClass  = 'domain';
            checkClick  = '';
            checkCursor = '';
            checkTitle  = '';
          } else if (isKnownCasterCtx) {
            // Known caster: ★ marcado si está en conocidos, click = toggle agregar/quitar
            checkClass  = isKnown ? 'known-always' : '';
            checkClick  = isKnown
              ? `onclick="App.removeKnownSpell('${sp.id}')"`
              : `onclick="App.addKnownSpell('${sp.id}')"`;
            checkCursor = 'cursor:pointer;';
            checkTitle  = isKnown ? 'Quitar de conocidos' : 'Agregar a conocidos';
          } else {
            checkClass  = isPrepared ? 'checked' : '';
            checkClick  = `onclick="App.toggleSpellPrepared('${sp.id}')"`;
            checkCursor = 'cursor:pointer;';
            checkTitle  = isPrepared ? 'Despreparar' : 'Preparar';
          }

          htmlIzq += `
          <div class="spell-card">
            <div class="spell-checkbox ${checkClass}" id="spchk-${sp.id}" ${checkClick} style="${checkCursor}" title="${checkTitle}"></div>
            <div class="spell-info" onclick="App.openSpellDetail('${sp.id}')" style="cursor:pointer;">
              <div class="spell-top">
                <span class="spell-lvl">${sp.level === 0 ? 'C' : sp.level}</span>
                <span class="spell-name">${sp.name}</span>${tags}
              </div>
              <div class="spell-desc">${sp.desc}</div>
            </div>
          </div>`;
        });
      });
    }

    document.getElementById('col-conjuros-izq').innerHTML = htmlIzq;
  }

  function _renderConjurosTab() {
    const c = _char;
    const cfg = Characters.CLASES_CONFIG[c.clase];

    // Empty state para clases sin magia (Bárbaro, Guerrero base, Pícaro base, Monje)
    if (!cfg || cfg.slotTable === null) {
      const noMagicMsg = {
        'Bárbaro':  'El Bárbaro no tiene magia. Sus recursos (Rage, etc.) aparecen en el tab Combate.',
        'Guerrero': 'El Guerrero base no tiene conjuros. Si eres Eldritch Knight, agrega la subclase en Habilidades para desbloquear magia.',
        'Pícaro':   'El Pícaro base no tiene conjuros. Si eres Arcane Trickster, agrega la subclase en Habilidades para desbloquear magia.',
        'Monje':    'El Monje no usa slots de conjuro. Sus puntos de Ki aparecen en el tab Combate.',
      };
      const msg = noMagicMsg[c.clase] || `${c.clase} no tiene conjuros en este nivel.`;
      const emptyHtml = `
        <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:40px 20px;gap:12px;color:var(--text-dim);text-align:center;">
          <div style="font-size:36px;opacity:0.4;">⚔️</div>
          <div style="font-family:'Cinzel',serif;font-size:13px;letter-spacing:2px;text-transform:uppercase;color:var(--text-mid);">Sin magia arcana</div>
          <div style="font-size:13px;line-height:1.5;max-width:280px;">${msg}</div>
        </div>`;
      document.getElementById('col-conjuros-izq').innerHTML = emptyHtml;
      document.getElementById('col-conjuros-der').innerHTML = '';
      return;
    }

    const isKnown   = Characters.isKnownCaster(c);
    const prepared  = c.preparedToday || [];
    const spellsMax = Characters.getPreparedMax(c);   // para known: spellsKnown[nivel-1]; para prepare: mod+nivel

    // Para known casters: contamos cuántos conjuros nv1+ tiene actualmente vs cuántos puede conocer
    const knownCount    = isKnown
      ? (c.spells || []).filter(s => s.level > 0 && !s.domain && !s.mi).length
      : null;
    // preparedCount: para known casters mostramos conocidos/máximo; para prepare: preparados/máximo
    const preparedCount = isKnown ? knownCount
      : (c.spells || []).filter(s => s.level > 0 && !s.domain && !s.mi && prepared.includes(s.id)).length;
    const knownOver     = isKnown && knownCount > spellsMax;

    // Cantrips: los de subclase (cantrip_subclass:true) no cuentan contra el límite
    const cantripsKnown = Characters.getCantripsKnown(c);
    const allCantrips   = (c.spells || []).filter(s => s.level === 0);
    const freeCantrips  = allCantrips.filter(s => s.cantrip_subclass);    // gratis por subclase
    const paidCantrips  = allCantrips.filter(s => !s.cantrip_subclass);   // cuentan contra el límite
    const cantripsCount = paidCantrips.length;

    // Aviso para half-casters en nivel 1 (sin slots aún)
    const totalSlots = Object.values(c.spellSlots || {}).reduce((s, v) => s + (v.max || 0), 0);
    const _noSlotsYet = totalSlots === 0 && cfg && cfg.slotTable === 'half' && c.nivel < 2;

    _renderConjurosIzq();

    // Columna derecha: etiqueta adaptada por tipo de caster
    const headerLabel    = isKnown ? 'Conjuros conocidos' : 'Preparados hoy';
    const headerSubLabel = isKnown
      ? `<span style="font-size:10px;color:var(--text-dim);display:block;margin-top:2px;">Todos siempre disponibles</span>`
      : '';

    let htmlDer = `
    <div class="spells-prepared-header">
      <span class="prepared-label">${headerLabel}${headerSubLabel}</span>
      <span class="prepared-count" id="preparedCount" style="${knownOver ? 'color:#e07070;' : ''}">${preparedCount}</span>
      <span class="prepared-max"> / ${spellsMax}${knownOver ? ' <span style="font-size:10px;color:#e07070;">⚠ excede</span>' : ''}</span>
      ${isKnown ? `<button onclick="App.clearAllKnownSpells()" style="margin-left:auto;font-size:10px;padding:3px 8px;background:var(--surface2);border:1px solid var(--border);border-radius:4px;color:var(--text-dim);cursor:pointer;" title="Limpiar todos los conjuros conocidos">🗑 Limpiar</button>` : ''}
    </div>`;

    // Cantrips conocidos — fila con contador + botón editar
    if (cantripsKnown !== null || (cfg && cfg.slotTable !== null)) {
      const over = cantripsKnown !== null && cantripsCount > cantripsKnown;
      const countText = cantripsKnown !== null
        ? `${cantripsCount} / ${cantripsKnown}${freeCantrips.length > 0 ? ` +${freeCantrips.length} subclase` : ''}`
        : `${allCantrips.length}`;
      htmlDer += `
    <div style="display:flex;align-items:center;justify-content:space-between;padding:6px 0 8px;border-bottom:1px solid var(--border);margin-bottom:10px;flex-wrap:wrap;gap:6px;">
      <span style="font-size:12px;color:var(--text-dim);">
        Cantrips: <strong style="color:${over ? '#e07070' : 'var(--text)'}">${countText}</strong>
        ${over ? '<span style="color:#e07070;margin-left:4px;">⚠ excede</span>' : ''}
      </span>
      <button onclick="App.openCantripPicker()" style="background:var(--surface2);border:1px solid var(--border);color:var(--text-mid);border-radius:6px;padding:4px 12px;font-size:11px;cursor:pointer;white-space:nowrap;">✎ Editar cantrips</button>
    </div>`;
    }

    htmlDer += `<div class="section-hd">Dominio — siempre activos</div>`;

    const domainSpells = (c.spells || []).filter(s => s.domain && s.level > 0);
    domainSpells.forEach(sp => {
      htmlDer += `
      <div class="spell-card">
        <div class="spell-checkbox domain"></div>
        <div class="spell-info" onclick="App.openSpellDetail('${sp.id}')" style="cursor:pointer;">
          <div class="spell-top">
            <span class="spell-lvl">${sp.level}</span>
            <span class="spell-name">${sp.name}</span>${_buildTagsHTML(sp)}
          </div>
          <div class="spell-desc">${sp.desc}</div>
        </div>
      </div>`;
    });

    if (isKnown) {
      // Known casters: lista de todos los conjuros nv1+ conocidos, siempre activos
      // El checkbox ★ actúa como "quitar de conocidos" al hacer click
      const knownList = (c.spells || []).filter(s => s.level > 0 && !s.domain && !s.mi);
      const sectionTitle = knownOver
        ? `Conjuros conocidos <span style="color:#e07070;font-size:11px;font-family:sans-serif;font-weight:400;">— tenés ${knownCount}, máximo ${spellsMax} · click ★ para quitar</span>`
        : `Conjuros conocidos <span style="font-size:11px;color:var(--text-dim);font-family:sans-serif;font-weight:400;">— click ★ para quitar</span>`;
      htmlDer += `<div class="section-hd" style="margin-top:14px;">${sectionTitle}</div>`;
      if (knownList.length === 0) {
        htmlDer += `<div style="font-size:13px;color:var(--text-dim);font-style:italic;padding:8px 0;">Aún no tenés conjuros. Agrupalos desde la lista de la izquierda.</div>`;
      } else {
        knownList.forEach(sp => {
          htmlDer += `
          <div class="spell-card">
            <div class="spell-checkbox known-always" onclick="App.removeKnownSpell('${sp.id}')" style="cursor:pointer;" title="Quitar de conocidos"></div>
            <div class="spell-info" onclick="App.openSpellDetail('${sp.id}')" style="cursor:pointer;">
              <div class="spell-top">
                <span class="spell-lvl">${sp.level}</span>
                <span class="spell-name">${sp.name}</span>${_buildTagsHTML(sp)}
              </div>
              <div class="spell-desc">${sp.desc}</div>
            </div>
          </div>`;
        });
      }
      const castStat  = c.spellcastingStat || 'car';
      const castMod   = Characters.calcMod(c.stats[castStat]);
      const profBonus = Characters.calcProfBonus(c.nivel);
      const attackStr = (profBonus + castMod) >= 0 ? `+${profBonus + castMod}` : `${profBonus + castMod}`;
      htmlDer += `
      <div class="note-block" style="margin-top:12px;">
        <strong>Conocés:</strong> ${knownCount} / ${spellsMax} conjuros (tabla Nivel ${c.nivel})<br>
        <span style="font-size:11px;color:var(--text-dim);">CD: ${8 + profBonus + castMod} · Ataque: ${attackStr}</span>
      </div>`;
    } else {
      // Prepare casters: lista de preparados hoy
      htmlDer += `<div class="section-hd" style="margin-top:14px;">Preparados — canjeables en descanso largo</div>`;
      const preparedList = (c.spells || []).filter(s =>
        s.level > 0 && !s.domain && !s.mi && prepared.includes(s.id)
      );
      if (preparedList.length === 0) {
        htmlDer += `<div style="font-size:13px;color:var(--text-dim);font-style:italic;padding:8px 0;">Toca los conjuros de la izquierda para marcarlos como preparados.</div>`;
      } else {
        preparedList.forEach(sp => {
          htmlDer += `
          <div class="spell-card">
            <div class="spell-checkbox checked" onclick="App.toggleSpellPrepared('${sp.id}')" style="cursor:pointer;"></div>
            <div class="spell-info" onclick="App.openSpellDetail('${sp.id}')" style="cursor:pointer;">
              <div class="spell-top">
                <span class="spell-lvl">${sp.level}</span>
                <span class="spell-name">${sp.name}</span>${_buildTagsHTML(sp)}
              </div>
              <div class="spell-desc">${sp.desc}</div>
            </div>
          </div>`;
        });
      }

      if (_noSlotsYet) {
        htmlDer += `
        <div class="note-block" style="margin-top:12px;border-color:rgba(201,151,58,0.4);background:rgba(201,151,58,0.07);">
          <strong style="color:var(--gold);">⚠ Nivel 1 — sin slots aún</strong><br>
          <span style="font-size:11px;color:var(--text-mid);">
            ${c.clase === 'Explorador' ? 'El Explorador' : 'El Paladín'} es un <em>half-caster</em>:
            obtiene sus primeros slots de conjuro al <strong>nivel 2</strong>.
          </span>
        </div>`;
      } else {
        const castStat     = c.spellcastingStat || 'sab';
        const castStatName = (Characters.STAT_NAMES[castStat] || castStat.toUpperCase());
        const castMod      = Characters.calcMod(c.stats[castStat]);
        htmlDer += `
        <div class="note-block" style="margin-top:12px;">
          <strong>Máx preparados:</strong> ${spellsMax} = ${castStatName} mod (${castMod >= 0 ? '+' : ''}${castMod}) + Nvl (${c.nivel})
        </div>`;
      }
    }

    document.getElementById('col-conjuros-der').innerHTML = htmlDer;
  }

  /* ══════════════════════════════════════════════════════
     TAB EQUIPO
  ══════════════════════════════════════════════════════ */

  // Colores por categoría de ítem
  const ITEM_CAT_COLORS = {
    // Armas
    'Weapon':                   { bg: 'rgba(200,100,60,0.15)',  color: '#d08050', border: 'rgba(200,100,60,0.3)' },
    'Weapon - simple melee':    { bg: 'rgba(200,100,60,0.15)',  color: '#d08050', border: 'rgba(200,100,60,0.3)' },
    'Weapon - martial melee':   { bg: 'rgba(200,60,60,0.15)',   color: '#d05050', border: 'rgba(200,60,60,0.3)' },
    'Weapon - simple ranged':   { bg: 'rgba(180,120,60,0.15)',  color: '#c89050', border: 'rgba(180,120,60,0.3)' },
    'Weapon - martial ranged':  { bg: 'rgba(160,80,40,0.15)',   color: '#c07040', border: 'rgba(160,80,40,0.3)' },
    'Ammo':                     { bg: 'rgba(200,80,80,0.12)',   color: '#d06060', border: 'rgba(200,80,80,0.3)' },
    // Consumibles
    'Potion':                   { bg: 'rgba(80,200,120,0.15)',  color: '#60c878', border: 'rgba(80,200,120,0.3)' },
    'Poison':                   { bg: 'rgba(100,180,60,0.15)',  color: '#80c040', border: 'rgba(100,180,60,0.3)' },
    'Food':                     { bg: 'rgba(200,160,80,0.15)',  color: '#c8a050', border: 'rgba(200,160,80,0.3)' },
    'Spell scroll':              { bg: 'rgba(100,140,220,0.15)', color: '#7090d8', border: 'rgba(100,140,220,0.3)' },
    // Equipo
    'Adventuring gear':         { bg: 'rgba(120,160,210,0.15)', color: '#7aa0d2', border: 'rgba(120,160,210,0.3)' },
    'Tool':                     { bg: 'rgba(140,140,100,0.15)', color: '#a8a870', border: 'rgba(140,140,100,0.3)' },
    'Apparel':                  { bg: 'rgba(180,120,180,0.15)', color: '#c080c0', border: 'rgba(180,120,180,0.3)' },
    'Equipment':                { bg: 'rgba(160,120,200,0.15)', color: '#a078c8', border: 'rgba(160,120,200,0.3)' },
    // Otros
    'Valuable':                 { bg: 'rgba(201,151,58,0.15)',  color: 'var(--gold)', border: 'var(--gold-dim)' },
    'Magic item':               { bg: 'rgba(160,80,220,0.15)',  color: '#b060e0', border: 'rgba(160,80,220,0.3)' },
    'Part':                     { bg: 'rgba(140,120,100,0.15)', color: '#9a8870', border: 'rgba(140,120,100,0.3)' },
    'Other':                    { bg: 'rgba(160,160,160,0.12)', color: '#aaa',    border: 'rgba(160,160,160,0.3)' },
  };

  const ITEM_CAT_LABELS = {
    'Weapon': 'Arma', 'Weapon - simple melee': 'Arma simple', 'Weapon - martial melee': 'Arma marcial',
    'Weapon - simple ranged': 'Arma distancia', 'Weapon - martial ranged': 'Arma marcial dist.',
    'Ammo': 'Munición', 'Potion': 'Poción', 'Poison': 'Veneno', 'Food': 'Comida',
    'Spell scroll': 'Pergamino', 'Adventuring gear': 'Equipo avent.', 'Tool': 'Herramienta',
    'Apparel': 'Indumentaria', 'Equipment': 'Equipamiento', 'Valuable': 'Valioso',
    'Magic item': 'Ítem mágico', 'Part': 'Material', 'Other': 'Otro',
  };

  function _itemCatBadge(cat) {
    const c = ITEM_CAT_COLORS[cat] || ITEM_CAT_COLORS['Other'];
    const label = ITEM_CAT_LABELS[cat] || cat;
    return `<span class="item-cat-badge" style="background:${c.bg};color:${c.color};border-color:${c.border};">${label}</span>`;
  }

  function _renderEquipoTab() {
    const c = _char;
    const ca = Characters.calcCA(c);

    // ── COLUMNA IZQUIERDA: Armas + Armadura + Ítems ──
    let htmlIzq = `<div class="section-hd">🎒 Ítems</div>

    <!-- ARMAS -->
    <div class="equip-section">
      <div class="rc-header">
        <span class="rc-name">Armas</span>
        <button class="btn-sm" onclick="App.openAddWeapon()">+ Agregar</button>
      </div>`;

    if ((c.weapons || []).length === 0) {
      htmlIzq += `<div class="equip-empty">Sin armas.</div>`;
    } else {
      const prof = Characters.calcProfBonus(c.nivel);
      const strMod = Characters.calcMod(c.stats.for);
      const dexMod = Characters.calcMod(c.stats.des);
      (c.weapons || []).forEach((w, i) => {
        const isFocus = w.type === 'focus';
        const hitStr = w.bonus && w.bonus !== '+0' ? w.bonus : '';
        const dmgStr = w.die !== '—' ? w.die : '—';
        htmlIzq += `
        <div class="item-row">
          <div class="item-row-left">
            <span class="item-name">${w.name}</span>
            ${w.notes ? `<span class="item-desc">${w.notes}</span>` : ''}
          </div>
          <div class="item-row-right">
            ${!isFocus && hitStr ? `<span class="item-stat hit-badge">${hitStr} al golpe</span>` : ''}
            ${!isFocus ? `<span class="item-stat">${dmgStr}</span>` : ''}
            <button class="item-edit" onclick="App.openEditWeapon(${i})" title="Editar">✎</button>
            <button class="item-del" onclick="App.deleteWeapon(${i})">✕</button>
          </div>
        </div>`;
      });
    }

    htmlIzq += `</div>

    <!-- CUERPO & ARMADURA (fusionado) -->
    <div class="equip-section">
      <div class="rc-header" style="margin-bottom:10px;">
        <span class="rc-name">🧥 Cuerpo & Armadura</span>
        <button class="btn-sm" onclick="App.openAddItem('body')">+ Agregar</button>
      </div>
      <!-- CA block compacto -->
      <div class="armor-row">
        <div class="armor-info">
          <div style="font-size:15px;color:var(--text);font-weight:600;display:flex;align-items:center;gap:8px;">
            ${c.armor.name || 'Sin armadura'}
            <button class="btn-edit-stats" style="font-size:10px;padding:2px 7px;"
              onclick="App.openArmorPicker()" title="Cambiar armadura">✎ Cambiar</button>
          </div>
          <div class="armor-formula">
            CA ${c.armor.base_ca}
            ${c.armor.add_dex ? ` + DES (${Characters.calcMod(c.stats.des) >= 0 ? '+' : ''}${Characters.calcMod(c.stats.des)})` : ''}
            ${c.armor.shield ? ` + Escudo +${c.armor.shield_bonus||2}` : ''}
            ${(c.bonuses&&c.bonuses.ca) ? ` + bonus +${c.bonuses.ca}` : ''}
            = <strong>${ca}</strong>
          </div>
          <div class="armor-controls">
            <button class="cond-btn ${c.armor.shield ? 'active' : ''}" onclick="App.toggleShield()" style="margin-top:6px;">
              🛡 Escudo ${c.armor.shield ? 'ON' : 'OFF'}
            </button>
            <div class="bonus-row" style="margin-top:8px;">
              <span class="bonus-label">Bonus CA</span>
              <input type="number" class="bonus-input" value="${(c.bonuses&&c.bonuses.ca)||0}"
                     onchange="App.setBonus('ca', this.value)" onclick="this.select()">
              <span class="bonus-hint">(ítems, hechizos)</span>
            </div>
          </div>
        </div>
        <div class="ca-display">
          <div class="ca-big">${ca}</div>
          <div class="ca-label">CA Total</div>
        </div>
      </div>
      <!-- Piezas equipadas -->
      <div class="body-items-list">`;

    const bodyItems = (c.consumables || []).filter(item => item.slot === 'body');
    if (bodyItems.length === 0) {
      htmlIzq += `<div class="equip-empty" style="margin-top:6px;">Sin ropa ni equipo equipado.</div>`;
    } else {
      (c.consumables || []).forEach((item, i) => {
        if (item.slot !== 'body') return;
        const cat = item.category || 'Other';
        htmlIzq += `
        <div class="item-row">
          <div class="item-row-left">
            <span class="item-name">${item.name}</span>
            ${item.desc ? `<span class="item-desc">${item.desc}</span>` : ''}
          </div>
          <div class="item-row-right">
            ${_itemCatBadge(cat)}
            <button class="item-edit" onclick="App.openEditItem(${i})" title="Editar">✎</button>
            <button class="item-del" onclick="App.deleteConsumable(${i})">✕</button>
          </div>
        </div>`;
      });
    }

    htmlIzq += `</div>
    </div>

    <!-- ÍTEMS MÁGICOS -->
    <div class="equip-section">
      <div class="rc-header">
        <span class="rc-name">Ítems Mágicos</span>
        <button class="btn-sm" onclick="App.addMagicItem()">+ Agregar</button>
      </div>
      <div id="magicItemsList">`;

    if ((c.magicItems || []).length === 0) {
      htmlIzq += `<div class="equip-empty">Sin ítems mágicos.</div>`;
    } else {
      (c.magicItems || []).forEach((item, i) => {
        htmlIzq += `
        <div class="item-row">
          <div class="item-row-left">
            <span class="item-name">${item.name}</span>
            ${item.desc ? `<span class="item-desc">${item.desc}</span>` : ''}
          </div>
          <div class="item-row-right">
            ${_itemCatBadge('Valuable')}
            <button class="item-del" onclick="App.deleteMagicItem(${i})">✕</button>
          </div>
        </div>`;
      });
    }

    htmlIzq += `</div></div>

    <!-- ATTUNEMENT -->
    <div class="equip-section">
      <div class="rc-name" style="margin-bottom:8px;">Attunement (máx 3)</div>
      <div class="attunement-slots">`;

    (c.attunement || ['','','']).forEach((slot, i) => {
      htmlIzq += `<input type="text" class="attunement-input"
        value="${slot.replace(/"/g,'&quot;')}"
        placeholder="Ítem sintonizado ${i+1}..."
        onchange="App.setAttunement(${i},this.value)">`;
    });

    htmlIzq += `</div></div>

    <!-- NOTAS DE SESIÓN -->
    <div class="equip-section">
      <div class="rc-header">
        <span class="rc-name">Notas de Sesión</span>
        <button class="btn-sm" onclick="document.getElementById('sessionNotesArea').value='';App.setNotes('');">Limpiar</button>
      </div>
      <textarea class="notes-area" id="sessionNotesArea"
                placeholder="NPCs encontrados, pistas, acuerdos, daño recibido..."
                oninput="App.setNotes(this.value)">${c.notes || ''}</textarea>
    </div>

    `;

    // ── COLUMNA DERECHA: Mochila + Dinero ──
    let htmlDer = `
    <!-- MOCHILA -->
    <div class="equip-section">
      <div class="rc-header">
        <span class="rc-name">🎒 Mochila</span>
        <button class="btn-sm" onclick="App.openAddItem('bag')">+ Agregar</button>
      </div>`;

    const bagItems = (c.consumables || []).filter(item => item.slot !== 'body');
    if (bagItems.length === 0) {
      htmlDer += `<div class="equip-empty">Mochila vacía.</div>`;
    } else {
      (c.consumables || []).forEach((item, i) => {
        if (item.slot === 'body') return;
        const cat = item.category || 'Other';
        const isEmpty = item.qty === 0;
        const isContainer = !!item.container;
        const maxQty = item.maxQty || item.qty || 1;
        const emptyClass = isEmpty ? ' item-row--empty' : '';
        const qtyControls = isContainer
          ? `<div class="qty-mini">
               <button class="qty-btn" onclick="App.adjustConsumable(${i},-1)">−</button>
               <span class="qty-val" id="cons-${i}">${item.qty}<span class="qty-max">/${maxQty}</span></span>
               <button class="qty-btn" onclick="App.adjustConsumable(${i},1)" ${item.qty >= maxQty ? 'disabled' : ''}>+</button>
               <button class="qty-btn qty-btn--refill" onclick="App.refillContainer(${i})" title="Rellenar">↺</button>
             </div>`
          : `<div class="qty-mini">
               <button class="qty-btn" onclick="App.adjustConsumable(${i},-1)">−</button>
               <span class="qty-val" id="cons-${i}">${item.qty}</span>
               <button class="qty-btn" onclick="App.adjustConsumable(${i},1)">+</button>
             </div>`;
        htmlDer += `
        <div class="item-row${emptyClass}" id="item-row-${i}">
          <div class="item-row-left">
            <span class="item-name">${item.name}</span>
            <div class="item-row-meta">${_itemCatBadge(cat)}${item.desc ? `<span class="item-desc">${item.desc}</span>` : ''}</div>
          </div>
          <div class="item-row-right">
            ${qtyControls}
            <div class="item-actions">
              <button class="item-edit" onclick="App.openEditItem(${i})" title="Editar">✎</button>
              <button class="item-del" onclick="App.deleteConsumable(${i})">✕</button>
            </div>
          </div>
        </div>`;
      });
    }

    htmlDer += `</div>

    <!-- DINERO -->
    ${_renderCurrencyHTML(c)}`;

    document.getElementById('col-equipo-izq').innerHTML = htmlIzq;
    document.getElementById('col-equipo-der').innerHTML = htmlDer;
  }

  // Todas las denominaciones — GP como unidad de referencia total
  const _COIN_ORDER = ['pp','gp','ep','sp','cp'];
  const _COIN_META  = {
    pp: { color:'#c8b8ff', name:'Platino',  rate:'1 pp = 10 gp' },
    gp: { color:'#c9973a', name:'Oro',      rate:'Unidad base'   },
    ep: { color:'#4ab8c4', name:'Electrum', rate:'2 ep = 1 gp'  },
    sp: { color:'#b0b0b0', name:'Plata',    rate:'10 sp = 1 gp' },
    cp: { color:'#cd7f32', name:'Cobre',    rate:'100 cp = 1 gp'},
  };

  function _totalInGP(cur) {
    return ((cur.pp||0)*10 + (cur.gp||0) + (cur.ep||0)/2 + (cur.sp||0)/10 + (cur.cp||0)/100);
  }

  function _renderCurrencyHTML(c) {
    const cur = c.currency || {};
    const totalGP = _totalInGP(cur);
    const totalStr = Number.isInteger(totalGP) ? totalGP.toLocaleString() : totalGP.toFixed(2);

    const coins = _COIN_ORDER.map(coin => {
      const m   = _COIN_META[coin];
      const val = cur[coin] || 0;
      return `
      <div class="currency-card" style="border-color:${m.color}33;">
        <div class="currency-card-top" style="background:${m.color}18;">
          <span class="currency-card-amount" style="color:${m.color};">${val}</span>
          <span class="currency-card-name" style="color:${m.color};">${m.name}</span>
          <span class="currency-card-rate">${m.rate}</span>
        </div>
        <div class="currency-card-btns">
          <input type="number" class="currency-card-input" placeholder="+/−" id="coinInput_${coin}"
                 onkeydown="if(event.key==='Enter'){App.addCoin('${coin}',0,this);}" onclick="this.select()">
          <button class="currency-btn-add" onclick="App.addCoin('${coin}',1,document.getElementById('coinInput_${coin}'))">+</button>
          <button class="currency-btn-sub" onclick="App.addCoin('${coin}',-1,document.getElementById('coinInput_${coin}'))">−</button>
        </div>
      </div>`;
    }).join('');

    return `
    <div class="equip-section">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
        <span class="rc-name">💰 Dinero</span>
        <div style="display:flex;align-items:center;gap:8px;">
          <span style="font-size:11px;color:var(--text-dim);">Total: <strong style="color:var(--gold);">${totalStr} gp</strong></span>
          <button class="btn-sm" onclick="App.consolidateCurrency()" title="Convierte todo a Oro">⇅ Todo a GP</button>
        </div>
      </div>
      <div class="currency-cards-grid">${coins}</div>
    </div>`;
  }

  // sign=0 → leer el signo del valor del input (+5 suma, -5 resta, 5 usa sign externo)
  // sign=1 → forzar suma  (botón +)
  // sign=-1 → forzar resta (botón −)
  function addCoin(coin, sign, inputEl) {
    const raw = parseInt(inputEl?.value);
    if (isNaN(raw) || raw === 0) return;
    let delta;
    if (sign === 0) {
      // Enter: el signo lo da el valor mismo (+5 → +5, -5 → -5, 5 → +5)
      delta = raw;
    } else {
      // Botón + o −: usa el valor absoluto y aplica el signo del botón
      delta = sign * Math.abs(raw);
    }
    _char.currency[coin] = Math.max(0, (_char.currency[coin] || 0) + delta);
    if (inputEl) inputEl.value = '';
    _saveChar();
    _renderEquipoTab();
  }

  function consolidateCurrency() {
    const cur = _char.currency || {};
    // Todo a CP → redistribuir en gp/sp/cp (sin PP ni EP)
    let totalCP = (cur.pp||0)*1000 + (cur.gp||0)*100 + (cur.ep||0)*50 + (cur.sp||0)*10 + (cur.cp||0);
    const gp = Math.floor(totalCP / 100); totalCP -= gp * 100;
    const sp = Math.floor(totalCP / 10);  totalCP -= sp * 10;
    const cp = totalCP;
    _char.currency = { pp:0, gp, ep:0, sp, cp };
    _saveChar();
    _renderEquipoTab();
  }

  /* ══════════════════════════════════════════════════════
     TAB HABILIDADES
  ══════════════════════════════════════════════════════ */

  function _renderHabilidadesTab() {
    const c = _char;
    const prof = Characters.calcProfBonus(c.nivel);

    const STATS = ['for','des','con','int','sab','car'];
    const STAT_LABELS = { for:'FUE',des:'DES',con:'CON',int:'INT',sab:'SAB',car:'CAR' };

    // ── COLUMNA IZQUIERDA: Stats + Saves (compacto arriba) ──
    let htmlIzq = `
    <div class="section-hd" style="display:flex;justify-content:space-between;align-items:center;">
      <span>🎲 Habilidades</span>
      <button class="btn-edit-stats" onclick="App.openEditStats()" title="Editar estadísticas">✎ Editar</button>
    </div>
    <div class="stats-grid">`;

    STATS.forEach(stat => {
      const val = c.stats[stat];
      const mod = Characters.calcMod(val);
      htmlIzq += `
      <div class="stat-block" onclick="App.editStat('${stat}')">
        <div class="stat-block-name">${STAT_LABELS[stat]}</div>
        <div class="stat-block-val" id="statVal-${stat}">${val}</div>
        <div class="stat-block-mod">${mod >= 0 ? '+' : ''}${mod}</div>
      </div>`;
    });

    htmlIzq += `</div>`;

    // Saving throws — compacto
    const bonusSavesAll = (c.bonuses && c.bonuses.savesAll) || 0;
    htmlIzq += `
    <div class="equip-section" style="margin-top:8px;">
      <div class="rc-header" style="margin-bottom:4px;">
        <span class="rc-name">Saving Throws</span>
        <div class="bonus-row" style="gap:4px;">
          <span class="bonus-label" style="font-size:10px;">+global</span>
          <input type="number" class="bonus-input" value="${bonusSavesAll}"
                 onchange="App.setBonus('savesAll', this.value)" onclick="this.select()"
                 title="Bonus a todos los saves">
        </div>
      </div>
      <div class="saves-grid">`;

    STATS.forEach(stat => {
      const save = Characters.calcSave(c, stat);
      const hasProf = c.savingThrows && c.savingThrows.includes(stat);
      const bonusStat = (c.bonuses && c.bonuses.saves && c.bonuses.saves[stat]) || 0;
      htmlIzq += `
      <div class="save-row">
        <button class="save-prof-toggle ${hasProf ? 'active' : ''}"
          onclick="App.toggleSavingThrow('${stat}')" title="${hasProf ? 'Quitar' : 'Agregar'} proficiencia">★</button>
        <span class="save-name">${STAT_LABELS[stat]}</span>
        <span class="save-val ${hasProf ? 'prof' : ''}">${save >= 0 ? '+' : ''}${save}</span>
        <input type="number" class="bonus-input-sm" value="${bonusStat}"
               onchange="App.setBonus('saves.${stat}', this.value)" onclick="this.select()"
               title="Bonus extra ${STAT_LABELS[stat]}">
      </div>`;
    });

    htmlIzq += `</div></div>`;

    // ── COLUMNA DERECHA: Skills prominentes arriba ──
    let htmlDer = `
    <div class="section-hd">Skills</div>
    <div class="skills-list">`;

    Characters.SKILLS_DEF.forEach(skill => {
      const val = Characters.calcSkill(c, skill.id);
      const hasProf = c.skillProfs && c.skillProfs.includes(skill.id);
      const hasExp  = c.skillExpertise && c.skillExpertise.includes(skill.id);
      const bonusSkill = (c.bonuses && c.bonuses.skills && c.bonuses.skills[skill.id]) || 0;
      const btnClass = hasExp ? 'expertise' : hasProf ? 'active' : '';
      const valClass = hasExp ? 'expertise' : hasProf ? 'prof' : '';
      const title    = hasExp ? 'Expertise (doble prof) — click para quitar' : hasProf ? 'Proficiente — click para Expertise' : 'Sin prof — click para agregar';
      htmlDer += `
      <div class="skill-row">
        <div class="skill-prof-btn ${btnClass}" onclick="App.toggleSkillProf('${skill.id}')" title="${title}"></div>
        <span class="skill-name">${skill.name}</span>
        <span class="skill-stat">(${STAT_LABELS[skill.stat]})</span>
        <span class="skill-val ${valClass}">${val >= 0 ? '+' : ''}${val}</span>
        <input type="number" class="bonus-input-sm" value="${bonusSkill}"
               onchange="App.setBonus('skills.${skill.id}', this.value)" onclick="this.select()"
               title="Bonus extra a ${skill.name}">
      </div>`;
    });

    htmlDer += `</div>`;

    // Info de personaje + XP al final
    const percPasiva = Characters.calcPercPasiva(c);
    const nextLevelXP = Characters.getNextLevelXP(c.nivel);
    const currentLevelXP = Characters.getXPForLevel(c.nivel);
    const xpPct = nextLevelXP
      ? Math.min(100, ((c.xp - currentLevelXP) / (nextLevelXP - currentLevelXP)) * 100)
      : 100;

    htmlDer += `
    <!-- INFO PASIVA -->
    <div class="equip-section" style="margin-top:14px;">
      <div class="rc-name" style="margin-bottom:6px;">Info de Personaje</div>
      <div class="passive-row">
        <span class="passive-label">Percepción Pasiva</span>
        <span class="passive-val">${percPasiva}</span>
      </div>
      <div class="passive-row">
        <span class="passive-label">Velocidad</span>
        <input type="number" class="speed-input" value="${Math.round(c.velocidad * 0.3)}" min="0" step="1.5"
               onchange="App.setVelocidad(Math.round(parseInt(this.value)/0.3))"> m
      </div>
      <div class="passive-row" style="flex-direction:column;align-items:flex-start;gap:4px;">
        <span class="passive-label">Resistencias</span>
        <div class="resistances-list" id="resList">`;

    const resArr = c.resistances && c.resistances.length ? c.resistances : [];
    if (resArr.length === 0) {
      htmlDer += `<span style="font-size:11px;color:var(--text-dim);font-style:italic;">Ninguna</span>`;
    } else {
      resArr.forEach(r => { htmlDer += `<span class="resistance-tag">${r}</span>`; });
    }

    htmlDer += `</div>
      </div>
    </div>

    <!-- PROFICIENCY BONUS -->
    <div class="equip-section">
      <div class="passive-row">
        <span class="passive-label">Proficiency Bonus</span>
        <span class="passive-val">+${prof}</span>
      </div>
      <div class="passive-row">
        <span class="passive-label">Nivel</span>
        <span class="passive-val">${c.nivel}</span>
      </div>
      ${c.raza ? `
      <div class="passive-row">
        <span class="passive-label">Raza</span>
        <span class="passive-val" style="font-size:12px;">${c.raza}${c.subraza ? ' · ' + c.subraza : ''}</span>
      </div>` : ''}
      ${c.trasfondo ? `
      <div class="passive-row">
        <span class="passive-label">Trasfondo</span>
        <span class="passive-val" style="font-size:12px;">${c.trasfondo}</span>
      </div>` : ''}
      ${c.deity ? `
      <div class="passive-row">
        <span class="passive-label">Deidad</span>
        <span class="passive-val" style="font-size:12px;">${c.deity}</span>
      </div>` : ''}
      <div class="passive-row" style="flex-direction:column;align-items:flex-start;gap:4px;">
        <div style="display:flex;justify-content:space-between;width:100%;align-items:center;">
          <span class="passive-label">Clase${(c.classes||[]).length > 1 ? 's' : ''}</span>
          <button class="btn-edit-stats" style="font-size:10px;padding:2px 6px;" onclick="App.openSubclaseModal()" title="Elegir subclase">Subclase</button>
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:2px;">
          ${(c.classes && c.classes.length ? c.classes : [{ name: c.clase, level: c.nivel, subclass: c.subclase || '' }])
            .map((cl, i) => `<span class="char-class-chip${i===0?' primary':''}">${cl.name} ${cl.level}${cl.subclass ? ' · ' + cl.subclass : ''}</span>`)
            .join('')}
        </div>
      </div>
      <div class="passive-row">
        <span class="passive-label">Iniciativa</span>
        <div style="display:flex;align-items:center;gap:4px;">
          ${(() => {
            const initBonus = (c.bonuses && c.bonuses.init) || 0;
            const initBase  = Characters.calcMod(c.stats.des);
            const initTotal = Characters.calcInit(c);
            const fmt = v => (v >= 0 ? '+' : '') + v;
            return `
              <span class="passive-val">${fmt(initBase)}</span>
              <span style="color:var(--text-dim);font-size:13px;">+</span>
              <input type="number" class="bonus-input-sm" value="${initBonus}"
                     onchange="App.setBonus('init', this.value)" onclick="this.select()" title="Bonus extra a iniciativa">
              ${initBonus ? `<span style="color:var(--text-dim);font-size:13px;">=</span><span class="passive-val" style="color:#c49bff;">${fmt(initTotal)}</span>` : ''}`;
          })()}
        </div>
      </div>
      <div class="passive-row">
        <span class="passive-label">CD de Conjuros</span>
        <div style="display:flex;align-items:center;gap:4px;">
          ${(() => {
            const cdBonus = (c.bonuses && c.bonuses.cd) || 0;
            const cdTotal = Characters.calcCD(c);
            const cdBase  = cdTotal !== null ? cdTotal - cdBonus : null;
            if (cdBase === null) return `<span class="passive-val">—</span><input type="number" class="bonus-input-sm" value="${cdBonus}" onchange="App.setBonus('cd', this.value)" onclick="this.select()">`;
            return `
              <span class="passive-val">${cdBase}</span>
              <span style="color:var(--text-dim);font-size:13px;">+</span>
              <input type="number" class="bonus-input-sm" value="${cdBonus}"
                     onchange="App.setBonus('cd', this.value)" onclick="this.select()" title="Bonus extra al CD (ítems, rasgos…)">
              ${cdBonus ? `<span style="color:var(--text-dim);font-size:13px;">=</span><span class="passive-val" style="color:#c49bff;">${cdTotal}</span>` : ''}`;
          })()}
        </div>
      </div>
      <div class="passive-row">
        <span class="passive-label">Bonus Ataque Mágico</span>
        <div style="display:flex;align-items:center;gap:4px;">
          ${(() => {
            const atkBonus = (c.bonuses && c.bonuses.ataque) || 0;
            const atkTotal = Characters.calcAtaqueBonus(c);
            const atkBase  = atkTotal !== null ? atkTotal - atkBonus : null;
            const fmt = v => (v >= 0 ? '+' : '') + v;
            if (atkBase === null) return `<span class="passive-val">—</span><input type="number" class="bonus-input-sm" value="${atkBonus}" onchange="App.setBonus('ataque', this.value)" onclick="this.select()">`;
            return `
              <span class="passive-val">${fmt(atkBase)}</span>
              <span style="color:var(--text-dim);font-size:13px;">+</span>
              <input type="number" class="bonus-input-sm" value="${atkBonus}"
                     onchange="App.setBonus('ataque', this.value)" onclick="this.select()" title="Bonus arma mágica">
              ${atkBonus ? `<span style="color:var(--text-dim);font-size:13px;">=</span><span class="passive-val" style="color:#c49bff;">${fmt(atkTotal)}</span>` : ''}`;
          })()}
        </div>
      </div>
    </div>

    <!-- RASGOS RACIALES -->
    ${_renderRacialTraitsHTML(c)}

    <!-- XP TRACKER -->
    <div class="xp-block">
      <div class="rc-header">
        <span class="rc-name">Experiencia (XP)</span>
      </div>
      <div class="xp-row">
        <div class="xp-add-row">
          <span class="xp-total-val">${c.xp.toLocaleString()}</span>
          <span class="xp-plus-sep">+</span>
          <input type="number" class="bonus-input-sm xp-add-input" id="xpAddInput"
                 placeholder="XP ganada" min="0"
                 onkeydown="if(event.key==='Enter'){App.addXP(this);}"
                 onclick="this.select()">
          <button class="xp-add-btn" onclick="App.addXP(document.getElementById('xpAddInput'))">Sumar</button>
        </div>
        <div class="xp-info">
          ${nextLevelXP
            ? `<strong style="color:var(--text);">Nivel ${c.nivel}</strong> → Nivel ${c.nivel+1}<br>Faltan <strong style="color:var(--gold-light);">${Math.max(0, nextLevelXP - c.xp).toLocaleString()}</strong> XP`
            : `<strong style="color:var(--gold-light);">¡Nivel máximo alcanzado!</strong>`
          }
        </div>
      </div>
      <div class="xp-bar">
        <div class="xp-bar-fill" style="width:${xpPct}%"></div>
      </div>
      ${c.nivel < 20 ? `<button class="levelup-btn" onclick="App.openLevelUp()">✦ Subir de Nivel</button>` : ''}
    </div>`;

    document.getElementById('col-hab-izq').innerHTML = htmlIzq;
    document.getElementById('col-hab-der').innerHTML = htmlDer;
  }

  // ── Primal Companion rendering ──────────────────────────────────────────────

  function _renderCompanionHTML(c) {
    const nivel = c.nivel;
    const pb    = Characters.calcProfBonus(nivel);
    const wisMod = Characters.calcMod(c.stats.sab);

    const companion = c.companion || {};
    const beastId   = companion.beast || null;
    const summoned  = companion.summoned !== false && beastId !== null; // true por defecto si hay bestia
    const beasts    = Characters.PRIMAL_COMPANION_BEASTS;

    // Selector de bestia (3 chips) — siempre visible
    let beastChips = Object.values(beasts).map(b => `
      <button class="companion-beast-chip ${beastId === b.id && summoned ? 'active' : ''}"
        onclick="App.setCompanionBeast('${b.id}')" title="${b.description}">
        ${b.emoji} ${b.name.replace('Beast of the ', '')}
      </button>`).join('');

    // Sin bestia elegida o desconjurada → solo chips
    if (!beastId || !summoned) {
      return `
      <div class="equip-section companion-section" style="margin-top:10px;">
        <div class="rc-header" style="margin-bottom:8px;">
          <span class="rc-name">🐾 Primal Companion</span>
          <span style="font-size:10px;color:var(--text-dim);">${!beastId ? 'Elige tu bestia' : 'Desconjurada'}</span>
        </div>
        <div class="companion-beast-chips">${beastChips}</div>
      </div>`;
    }

    const beast = beasts[beastId];
    const ac    = beast.calcAC(nivel);
    const maxHp = beast.calcMaxHP(nivel);
    const curHp = companion.hp != null ? companion.hp : maxHp;
    const hitBonus = wisMod + pb;
    const hitStr   = (hitBonus >= 0 ? '+' : '') + hitBonus;

    // Stats bar
    const STAT_LABELS = { for:'FUE', des:'DES', con:'CON', int:'INT', sab:'SAB', car:'CAR' };
    const statsHTML = Object.entries(beast.stats).map(([k, v]) => {
      const mod = Characters.calcMod(v);
      return `<div class="companion-stat">
        <div class="companion-stat-name">${STAT_LABELS[k]}</div>
        <div class="companion-stat-val">${v}</div>
        <div class="companion-stat-mod">${mod>=0?'+':''}${mod}</div>
      </div>`;
    }).join('');

    // Attacks
    const attacksHTML = beast.attacks.map(a => `
      <div class="companion-attack">
        <span class="companion-atk-name">${a.name}</span>
        <span class="companion-atk-bonus">${hitStr}</span>
        <span class="companion-atk-dmg">${a.damageDie}+${a.damageBonus + pb} ${a.damageType}</span>
      </div>`).join('');

    // Traits
    const traitsHTML = beast.traits.map(t => `
      <div class="companion-trait">
        <span class="companion-trait-name">${t.name}.</span>
        <span class="companion-trait-desc">${t.desc}</span>
      </div>`).join('');

    // HP bar percentage
    const hpPct  = Math.max(0, Math.min(100, (curHp / maxHp) * 100));
    const hpColor = hpPct > 60 ? '#4caf50' : hpPct > 25 ? '#f0c040' : '#e05c2a';

    return `
    <div class="equip-section companion-section" style="margin-top:14px;">
      <div class="rc-header" style="margin-bottom:6px;">
        <span class="rc-name">🐾 Primal Companion</span>
      </div>

      <!-- Beast selector chips — toca la activa para desconjurar, otra para cambiar -->
      <div class="companion-beast-chips" style="margin-bottom:8px;">${beastChips}</div>

      <!-- Header de la bestia -->
      <div class="companion-header">
        <div class="companion-title">
          <span class="companion-emoji">${beast.emoji}</span>
          <div>
            <div class="companion-name">${beast.name}</div>
            <div class="companion-meta">${beast.size} ${beast.type} · ${beast.speed}</div>
          </div>
        </div>
        <div class="companion-ac-badge">
          <div class="companion-ac-val">${ac}</div>
          <div class="companion-ac-lbl">CA</div>
        </div>
      </div>

      <!-- HP tracker -->
      <div class="companion-hp-row">
        <span class="companion-hp-label">HP</span>
        <input type="number" class="companion-hp-input" value="${curHp}" min="0" max="${maxHp}"
               onchange="App.setCompanionHP(parseInt(this.value)||0)"
               onclick="this.select()">
        <span class="companion-hp-sep">/</span>
        <span class="companion-hp-max">${maxHp}</span>
        <button class="companion-hp-btn" onclick="App.setCompanionHP(${maxHp})" title="Curar al máximo">♥</button>
        <button class="companion-hp-btn" onclick="App.setCompanionHP(0)" title="Derribar">☠</button>
      </div>
      <div class="companion-hp-bar">
        <div class="companion-hp-fill" style="width:${hpPct}%;background:${hpColor};"></div>
      </div>

      <!-- Stats -->
      <div class="companion-stats">${statsHTML}</div>

      <!-- Ataques -->
      <div class="companion-attacks-header">Ataques · Bono de golpe ${hitStr} (SAB+PB)</div>
      <div class="companion-attacks">${attacksHTML}</div>

      <!-- Rasgos -->
      <div class="companion-traits">${traitsHTML}</div>

      <!-- Notas del nivel -->
      <div class="companion-level-note">
        Nivel ${nivel} Explorador · PB +${pb}${nivel >= 7 ? ' · Ataques mágicos' : ''}${nivel >= 11 ? ' · Doble ataque' : ''}
      </div>
    </div>`;
  }

  function setCompanionBeast(beastId) {
    if (!_char) return;
    const beast   = Characters.PRIMAL_COMPANION_BEASTS[beastId];
    if (!beast) return;
    const companion = _char.companion || {};
    const currently = companion.beast;
    const summoned  = companion.summoned !== false && currently !== null;

    if (currently === beastId && summoned) {
      // Tap on active beast → desconjurar (collapse to chips only)
      _char.companion = { beast: beastId, hp: companion.hp, summoned: false };
    } else {
      // Tap on inactive or different beast → conjurar
      const maxHp = beast.calcMaxHP(_char.nivel);
      const hp = (currently === beastId && companion.hp != null) ? companion.hp : maxHp;
      _char.companion = { beast: beastId, hp, summoned: true };
    }
    _saveChar();
    _renderCombateDer();
  }

  function clearCompanionBeast() {
    if (!_char) return;
    _char.companion = { beast: null, hp: 0 };
    _saveChar();
    _renderCombateDer();
  }

  function setCompanionHP(val) {
    if (!_char || !_char.companion) return;
    const beast  = Characters.PRIMAL_COMPANION_BEASTS[_char.companion.beast];
    const maxHp  = beast ? beast.calcMaxHP(_char.nivel) : 0;
    _char.companion.hp = Math.max(0, Math.min(maxHp, val));
    _saveChar();
    _renderCombateDer();
  }

  function _renderRacialTraitsHTML(c) {
    if (!c.raza) return '';

    const razaCfg = Characters.RAZAS_CONFIG[c.raza];

    // Raza Custom o desconocida → textarea editable
    if (!razaCfg || c.raza === 'Custom') {
      return `
      <div class="equip-section" style="margin-top:14px;">
        <div class="rc-header" style="margin-bottom:6px;">
          <span class="rc-name">🧬 Rasgos Raciales — ${c.raza || 'Custom'}</span>
        </div>
        <textarea class="notes-area" style="min-height:80px;font-size:12px;"
          placeholder="Describí los rasgos especiales de tu raza…"
          oninput="App.setSpeciesTraits(this.value)">${c.speciesTraits || ''}</textarea>
      </div>`;
    }

    // Construir lista de traits: raza base + subraza
    const traits = [];

    // Darkvision como rasgo
    const dv = (c.subraza && razaCfg.subraces)
      ? (() => { const s = razaCfg.subraces.find(sr => sr.name === c.subraza); return (s && s.darkvision) || razaCfg.darkvision || 0; })()
      : razaCfg.darkvision || 0;
    if (dv > 0) {
      traits.push({ name: 'Visión en Penumbra', source: c.raza, desc: `Podés ver en penumbra hasta ${dv} m como si fuera luz tenue, y en oscuridad total como si fuera penumbra.` });
    }

    // Traits base de la raza
    (razaCfg.traits || []).forEach(t => {
      const [name, ...rest] = t.split(' — ');
      traits.push({ name: name.trim(), source: c.raza, desc: rest.join(' — ').trim() });
    });

    // Traits de subraza
    if (c.subraza && razaCfg.subraces) {
      const sub = razaCfg.subraces.find(sr => sr.name === c.subraza);
      if (sub && sub.traits) {
        sub.traits.forEach(t => {
          const [name, ...rest] = t.split(' — ');
          traits.push({ name: name.trim(), source: c.subraza, desc: rest.join(' — ').trim() });
        });
      }
    }

    if (traits.length === 0) return '';

    const razaEmoji = razaCfg.emoji || '🧬';
    const subLabel = c.subraza ? ` · ${c.subraza}` : '';

    return `
    <div class="equip-section" style="margin-top:14px;">
      <div class="rc-name" style="margin-bottom:8px;">${razaEmoji} ${c.raza}${subLabel}</div>
      ${traits.map(t => `
        <div style="margin-bottom:10px;padding:8px 10px;background:var(--surface2,rgba(255,255,255,0.04));border-radius:8px;border-left:3px solid var(--accent2,#7eb8c9);">
          <div style="font-weight:700;font-size:13px;margin-bottom:2px;">${t.name}</div>
          <div style="font-size:10px;color:var(--text-dim);margin-bottom:4px;">${t.source}</div>
          ${t.desc ? `<div style="font-size:12px;line-height:1.5;color:var(--text-muted,var(--text));">${t.desc}</div>` : ''}
        </div>
      `).join('')}
    </div>`;
  }

  /* ══════════════════════════════════════════════════════
     HP
  ══════════════════════════════════════════════════════ */

  function setHP(val) {
    if (!_char) return;
    const prev = _char.hp.current;
    _char.hp.current = Math.max(0, Math.min(_char.hp.max, val || 0));
    _saveChar(true);
    _updateHPDisplay();
    _updateCombatHUD();
    if ((prev === 0) !== (_char.hp.current === 0)) _renderCombateIzq();
  }

  function setHPMax(val) {
    if (!_char || isNaN(val) || val < 1) return;
    _char.hp.max = val;
    _char.hp.current = Math.min(_char.hp.current, val);
    _saveChar(true);
    _updateHPDisplay();
    showToast(`HP máximo → ${val}`);
  }

  function adjustHP(delta) {
    if (!_char) return;

    // Sync temp HP from input in case user typed but didn't blur
    const tempInput = document.getElementById('tempHPInput');
    if (tempInput) {
      const inputVal = parseInt(tempInput.value) || 0;
      if (inputVal !== _char.hp.temp) _char.hp.temp = Math.max(0, inputVal);
    }

    // HP temp absorben daño primero
    if (delta < 0 && _char.hp.temp > 0) {
      const absorbed = Math.min(_char.hp.temp, Math.abs(delta));
      _char.hp.temp -= absorbed;
      delta += absorbed;
      if (delta === 0) {
        showToast(`HP Temp absorbió ${absorbed} daño`);
        _saveChar(true);
        _updateHPDisplay();
        _updateTempHPDisplay();
        _updateCombatHUD();
        return;
      }
    }

    // Chequeo de concentración
    if (delta < 0) _checkConcAlert(Math.abs(delta));

    const prev = _char.hp.current;
    _char.hp.current = Math.max(0, Math.min(_char.hp.max, _char.hp.current + delta));
    _saveChar(true);
    _updateHPDisplay();
    _updateTempHPDisplay();
    _updateCombatHUD();
    _flashHP(delta < 0 ? 'dmg' : 'heal');

    // Combat log
    if (delta !== 0) {
      const actual = _char.hp.current - prev;
      if (actual < 0) _logCombat(`Recibió ${Math.abs(actual)} daño → ${_char.hp.current} HP`, 'dmg');
      else if (actual > 0) _logCombat(`Curado ${actual} HP → ${_char.hp.current} HP`, 'heal');
    }


    if ((prev === 0) !== (_char.hp.current === 0)) _renderCombateIzq();
  }

  function applyFreeHP() {
    const input = document.getElementById('hdrHPFree');
    if (!input) return;
    const val = parseInt(input.value);
    if (isNaN(val)) return;
    adjustHP(val);
    input.value = '';
    input.blur();
  }

  function applyFreeHPAs(sign) {
    const input = document.getElementById('hdrHPFree');
    if (!input) return;
    const val = parseInt(input.value);
    if (isNaN(val) || val <= 0) return;
    adjustHP(sign * val);
    input.value = '';
    input.blur();
  }

  function healFull() {
    if (!_char) return;
    _char.hp.current = _char.hp.max;
    _saveChar();
    _updateHPDisplay();
    showToast('HP al máximo ✦');
  }

  function setTempHP(val) {
    if (!_char) return;
    const newVal = Math.max(0, val || 0);
    _char.hp.temp = newVal;
    _saveChar();
    _updateTempHPDisplay();
    if (newVal > 0) showToast(`HP Temporales: ${newVal}`);
  }

  function adjustTempHP(delta) {
    if (!_char) return;
    const newVal = Math.max(0, (_char.hp.temp || 0) + delta);
    _char.hp.temp = newVal;
    _saveChar();
    _updateTempHPDisplay();
  }

  function promptTempHP() {
    const val = prompt(`HP Temporales actuales: ${_char.hp.temp}\n¿Cuántos HP temporales? (aplica solo el mayor)`, '0');
    if (val === null) return;
    const n = parseInt(val);
    if (!isNaN(n)) setTempHP(n);
  }

  function _updateTempHPDisplay() {
    const input = document.getElementById('tempHPInput');
    if (input && _char) input.value = _char.hp.temp;
    _updateHPDisplay();
  }

  /* ══════════════════════════════════════════════════════
     COMBAT HUD — barra fija siempre visible
  ══════════════════════════════════════════════════════ */

  function _updateCombatHUD() {
    const hud = document.getElementById('combatHUD');
    if (!hud || !_char) return;

    const { current, max, temp } = _char.hp;
    const pct = max > 0 ? Math.min(100, (current / max) * 100) : 0;
    const hpColor = pct <= 0 ? '#ff4040' : pct <= 25 ? '#e05050' : pct <= 50 ? '#e08050' : 'var(--green-light)';
    const barColor = pct > 50 ? 'var(--green)' : pct > 25 ? '#a0802a' : '#8a3a3a';

    // Concentration
    const concSpell = _char.concentration
      ? (_char.spells || []).find(s => s.id === _char.concentration)
      : null;
    const concName = concSpell ? concSpell.name.replace(/\s*[◆†●]/g,'') : null;

    // Key resources (first 2 non-zero resources)
    const keyResources = (_char.resources || []).filter(r => r.max > 0).slice(0, 2);

    // Slots — first non-exhausted level
    let firstSlot = null;
    for (let i = 1; i <= 9; i++) {
      const s = _char.spellSlots && _char.spellSlots[i];
      if (s && s.max > 0) { firstSlot = { level: i, ...s }; break; }
    }

    hud.innerHTML = `
      <div class="hud-hp" id="hudHP">
        <span class="hud-hp-num" style="color:${hpColor}">${current}</span>
        <span class="hud-hp-sep">/</span>
        <span class="hud-hp-max">${max}</span>
        ${temp > 0 ? `<span class="hud-hp-temp">+${temp}</span>` : ''}
        <div class="hud-hp-bar"><div class="hud-hp-bar-fill" style="width:${pct}%;background:${barColor}"></div></div>
      </div>
      <div class="hud-divider"></div>
      <div class="hud-conc ${concName ? 'active' : ''}">
        ${concName
          ? (() => {
              const rounds = _concRoundsActive();
              const roundsTag = rounds ? `<span class="hud-conc-rounds">R${rounds}</span>` : '';
              return `<span class="hud-conc-dot"></span><span class="hud-conc-name">${concName}</span>${roundsTag}
                      <button class="hud-conc-break" onclick="App.setConc(null)" title="Romper concentración">✕</button>`;
            })()
          : `<span class="hud-conc-none">Sin conc</span>`
        }
      </div>
      <div class="hud-divider"></div>
      <div class="hud-resources">
        ${keyResources.map(r =>
          `<div class="hud-res"><span class="hud-res-name">${r.name.split(' ')[0]}</span><span class="hud-res-val ${r.current === 0 ? 'empty' : ''}">${r.current}/${r.max}</span></div>`
        ).join('')}
        ${firstSlot ? `<div class="hud-res"><span class="hud-res-name">Nvl${firstSlot.level}</span><span class="hud-res-val ${firstSlot.current === 0 ? 'empty' : ''}">${firstSlot.current}/${firstSlot.max}</span></div>` : ''}
      </div>
      ${_combatActive ? `
      <div class="hud-divider"></div>
      <div class="hud-round">
        <span class="hud-round-label">Ronda</span>
        <span class="hud-round-num">${_combatRound}</span>
      </div>` : ''}`;
  }

  /* ══════════════════════════════════════════════════════
     HP SWIPE + CHIPS
  ══════════════════════════════════════════════════════ */

  function _setupHPSwipe() {
    const el = document.getElementById('hdrHP');
    if (!el) return;

    let startX = 0, startY = 0, moved = false;

    el.addEventListener('touchstart', e => {
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      moved = false;
    }, { passive: true });

    el.addEventListener('touchmove', e => {
      moved = true;
    }, { passive: true });

    el.addEventListener('touchend', e => {
      if (!moved) return;
      const dx = e.changedTouches[0].clientX - startX;
      const dy = Math.abs(e.changedTouches[0].clientY - startY);
      if (Math.abs(dx) < 40 || dy > 60) return;

      const val = parseInt(document.getElementById('hdrHPFree').value);
      if (!val || val <= 0) { showToast('Ingresa un valor primero'); return; }

      if (dx < 0) {
        // Swipe left = daño
        adjustHP(-val);
        document.getElementById('hdrHPFree').value = '';
        _flashHP('dmg');
      } else {
        // Swipe right = curación
        adjustHP(val);
        document.getElementById('hdrHPFree').value = '';
        _flashHP('heal');
      }
    });
  }

  function _flashHP(type) {
    const el = document.getElementById('hdrHP');
    if (!el) return;
    el.classList.remove('hp-flash-dmg', 'hp-flash-heal');
    // Force reflow
    void el.offsetWidth;
    el.classList.add(type === 'dmg' ? 'hp-flash-dmg' : 'hp-flash-heal');
    setTimeout(() => el.classList.remove('hp-flash-dmg', 'hp-flash-heal'), 600);
  }

  /* ══════════════════════════════════════════════════════
     ROUND & TURN TRACKER
  ══════════════════════════════════════════════════════ */

  function startCombat() {
    _combatRound = 1;
    _combatTurn  = 1;
    _combatActive = true;
    // Agregar PJ al tracker si no está ya
    if (!_combatants.find(x => x.isPlayer)) {
      _combatants.push({
        id: 'player', name: _char.name || 'PJ',
        init: null, ac: Characters.calcCA(_char),
        isPlayer: true, status: 'ok', conditions: [],
      });
      _sortCombatants();
      _activeTurnId = _combatants[0]?.id ?? null;
    }
    _updateRoundDisplay();
    _updateCombatHUD();
    _renderCombateDer();
    _logCombat('⚔ Combate iniciado', 'info');
    showToast('⚔ Combate iniciado — Ronda 1');
  }

  function nextCombatTurn() {
    if (!_combatActive) { startCombat(); return; }
    _combatTurn++;
    _advanceInitTurn();
    _updateRoundDisplay();
    _updateCombatHUD();
    endTurn();
  }

  function nextCombatRound() {
    if (!_combatActive) { startCombat(); return; }
    _combatRound++;
    _combatTurn = 1;
    _updateRoundDisplay();
    _updateCombatHUD();
    _updateConcBlock();
    endTurn();
    // Avisar si la concentración está por vencer
    if (_char && _char.concentration) {
      const sp = (_char.spells || []).find(s => s.id === _char.concentration);
      const maxRounds = _spellDurationToRounds(sp);
      const rounds = _concRoundsActive();
      if (maxRounds && rounds) {
        const left = maxRounds - rounds + 1;
        if (left === 0) showToast(`◇ ${sp ? sp.name : 'Concentración'} terminó (${maxRounds} rondas)`, 'warn');
        else if (left <= 2) showToast(`⚠ ${sp ? sp.name : 'Conc'} — quedan ${left} ronda${left > 1 ? 's' : ''}`, 'warn');
        else showToast(`Ronda ${_combatRound} · ◆ R${rounds}`);
      } else {
        showToast(`Ronda ${_combatRound} · ◆ R${rounds || '?'}`);
      }
    } else {
      showToast(`Ronda ${_combatRound}`);
    }
  }

  function resetCombat() {
    _combatRound = 0;
    _combatTurn  = 0;
    _combatActive = false;
    _enemies = [];
    _combatants = [];
    _activeTurnId = null;
    _updateRoundDisplay();
    _updateCombatHUD();
    _renderCombateDer();
    showToast('Combate terminado');
  }

  /* ── Enemy Tracker ── */
  function addEnemy() {
    const nameEl = document.getElementById('enemyNameInput');
    const acEl   = document.getElementById('enemyACInput');
    const name = nameEl.value.trim() || `Enemigo ${_enemies.length + 1}`;
    const ac   = parseInt(acEl.value) || 0;
    _enemies.push({ id: ++_enemyIdSeq, name, ac, status: 'ok' });
    nameEl.value = '';
    acEl.value   = '';
    nameEl.focus();
    _renderEnemyTracker();
  }

  function moveEnemy(id, dir) {
    const idx = _enemies.findIndex(x => x.id === id);
    if (idx < 0) return;
    const swapIdx = idx + dir;
    if (swapIdx < 0 || swapIdx >= _enemies.length) return;
    [_enemies[idx], _enemies[swapIdx]] = [_enemies[swapIdx], _enemies[idx]];
    _renderEnemyTracker();
  }

  function toggleEnemyBleeding(id) {
    const e = _enemies.find(x => x.id === id);
    if (!e) return;
    e.status = e.status === 'bleeding' ? 'ok' : 'bleeding';
    _renderEnemyTracker();
  }

  function removeEnemy(id) {
    _enemies = _enemies.filter(x => x.id !== id);
    _renderEnemyTracker();
  }

  function editEnemyAC(id) {
    const e = _enemies.find(x => x.id === id);
    if (!e) return;
    const el = document.getElementById(`et-ac-${id}`);
    if (!el) return;
    el.outerHTML = `<input type="number" id="et-ac-edit-${id}" class="et-ac-edit" value="${e.ac}" min="0" max="40"
      onblur="App._saveEnemyAC(${id})" onkeydown="if(event.key==='Enter'||event.key==='Escape') this.blur()" style="width:46px;">`;
    setTimeout(() => { const i = document.getElementById(`et-ac-edit-${id}`); if(i){i.focus();i.select();} }, 20);
  }

  function _saveEnemyAC(id) {
    const e = _enemies.find(x => x.id === id);
    const input = document.getElementById(`et-ac-edit-${id}`);
    if (!e || !input) return;
    e.ac = Math.max(0, parseInt(input.value) || 0);
    _renderEnemyTracker();
  }

  // ── Initiative Tracker ───────────────────────────────────────────────────

  function _sortCombatants() {
    // Orden ascendente: 1 = primero, 2 = segundo, etc.
    // Combatientes sin orden (init=0 o null) van al final
    _combatants.sort((a, b) => {
      const oa = a.init || 99;
      const ob = b.init || 99;
      return oa - ob;
    });
  }

  function _advanceInitTurn() {
    if (!_combatants.length) return;
    const alive = _combatants.filter(x => x.status !== 'dead');
    if (!alive.length) return;
    const idx = alive.findIndex(x => x.id === _activeTurnId);
    const next = alive[(idx + 1) % alive.length];
    _activeTurnId = next.id;
    _renderInitTracker();
    // Si volvemos al primero → nueva ronda
    if (idx >= alive.length - 1) {
      // La nueva ronda ya la maneja nextCombatRound o el propio ciclo
    }
  }

  function _renderInitTracker() {
    const container = document.getElementById('initTracker');
    if (!container) return;

    let html = '';

    // Lista de combatientes
    _combatants.forEach((c) => {
      const isActive    = c.id === _activeTurnId && _combatActive;
      const isDead      = c.status === 'dead';
      const isBlood     = c.status === 'bloodied';
      const statusClass = isDead ? ' it-dead' : isBlood ? ' it-bloodied' : '';
      const activeClass = isActive ? ' it-active' : '';
      const statusIcon  = isDead ? '☠' : isBlood ? '🩸' : '⚪';

      html += `
      <div class="it-row${statusClass}${activeClass}" id="it-row-${c.id}"
           draggable="true"
           ondragstart="App._itDragStart(event,'${c.id}')"
           ondragover="App._itDragOver(event)"
           ondrop="App._itDrop(event,'${c.id}')"
           ondragend="App._itDragEnd()">
        <div class="it-row-main">
          ${isActive ? '<span class="it-turn-arrow">▶</span>' : '<span class="it-turn-spacer"></span>'}
          <span class="it-drag-handle">⠿</span>
          <input type="number" class="it-inline-num" value="${c.init ?? ''}" min="1" max="99"
                 placeholder="?" title="Orden de turno"
                 onchange="App.setCombatantInit('${c.id}',this.value)"
                 onclick="this.select()">
          <span class="it-name ${c.isPlayer ? 'it-player' : ''}">${c.name}</span>
          <input type="number" class="it-inline-num it-inline-ca" value="${c.ac || ''}" min="0" max="40"
                 placeholder="CA" title="Clase de Armadura"
                 onchange="App.setCombatantAC('${c.id}',this.value)"
                 onclick="this.select()">
          <div class="it-actions">
            <button class="it-status-btn" onclick="App.cycleCombatantStatus('${c.id}')" title="Estado">${statusIcon}</button>
            <button class="it-del-btn" onclick="App.removeCombatant('${c.id}')">✕</button>
          </div>
        </div>
      </div>`;
    });

    // Fila para agregar — al final
    html += `
    <div class="it-add-row">
      <input type="text"   id="itNameInput"  class="it-input"        placeholder="Nombre enemigo"  maxlength="24"
             onkeydown="if(event.key==='Enter')App.addCombatant()">
      <button class="it-add-btn" onclick="App.addCombatant()" title="Agregar">+</button>
    </div>`;

    container.innerHTML = html;
  }

  const _COND_ICON = {
    'Poisoned':'🤢','Blinded':'🙈','Frightened':'😨','Paralyzed':'⚡',
    'Restrained':'🕸','Stunned':'💫','Prone':'⬇','Invisible':'👻',
    'Charmed':'💜','Exhaustion':'😴',
  };

  function addCombatant() {
    const name = document.getElementById('itNameInput')?.value.trim() || `Enemigo ${_combatants.length + 1}`;
    const id   = 'c' + (++_combatantSeq);
    _combatants.push({ id, name, init: null, ac: 0, isPlayer: false, status: 'ok', conditions: [] });
    _sortCombatants();
    if (!_activeTurnId && _combatants.length) _activeTurnId = _combatants[0].id;
    // Limpiar inputs
    ['itNameInput'].forEach(id => {
      const el = document.getElementById(id); if (el) el.value = '';
    });
    document.getElementById('itNameInput')?.focus();
    _renderInitTracker();
  }

  function removeCombatant(id) {
    _combatants = _combatants.filter(x => x.id !== id);
    if (_activeTurnId === id) _activeTurnId = _combatants[0]?.id ?? null;
    _renderInitTracker();
  }

  function cycleCombatantStatus(id) {
    const c = _combatants.find(x => x.id === id);
    if (!c) return;
    const cycle = { ok: 'bloodied', bloodied: 'dead', dead: 'ok' };
    c.status = cycle[c.status] || 'ok';
    _renderInitTracker();
  }

  function editCombatantInit(id) { /* legacy — ahora se edita inline */ }

  function setCombatantInit(id, val) {
    const c = _combatants.find(x => x.id === id);
    if (!c) return;
    const n = parseInt(val);
    c.init = isNaN(n) ? null : Math.max(1, n);
    _sortCombatants();
    _renderInitTracker();
  }

  function setCombatantAC(id, val) {
    const c = _combatants.find(x => x.id === id);
    if (!c) return;
    const n = parseInt(val);
    c.ac = isNaN(n) ? 0 : Math.max(0, n);
    _renderInitTracker();
  }

  function editCombatantHP(id) {
    const c = _combatants.find(x => x.id === id);
    if (!c) return;
    const val = prompt(`HP de ${c.name}:`, c.hp ?? '');
    if (val === null) return;
    const n = parseInt(val);
    if (!isNaN(n)) {
      c.hp = Math.max(0, n);
      if (!c.maxHp) c.maxHp = n;
      if (c.hp === 0) c.status = 'dead';
      else if (c.maxHp && c.hp <= c.maxHp / 2) c.status = 'bloodied';
      else c.status = 'ok';
      _renderInitTracker();
    }
  }

  // Avanzar turno al combatiente del tracker (click en flecha)
  function setActiveTurn(id) {
    _activeTurnId = id;
    _renderInitTracker();
  }

  // Drag & drop del tracker
  let _itDragId = null;
  function _itDragStart(e, id) {
    _itDragId = id;
    e.currentTarget.classList.add('it-dragging');
    e.dataTransfer.effectAllowed = 'move';
  }
  function _itDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    e.currentTarget.classList.add('it-drag-over');
  }
  function _itDrop(e, targetId) {
    e.preventDefault();
    if (!_itDragId || _itDragId === targetId) return;
    const from = _combatants.findIndex(x => x.id === _itDragId);
    const to   = _combatants.findIndex(x => x.id === targetId);
    if (from < 0 || to < 0) return;
    const [moved] = _combatants.splice(from, 1);
    _combatants.splice(to, 0, moved);
    _itDragId = null;
    _renderInitTracker();
  }
  function _itDragEnd() {
    _itDragId = null;
    document.querySelectorAll('.it-row').forEach(r => r.classList.remove('it-dragging','it-drag-over'));
  }

  // Legacy — mantener compatibilidad con funciones antiguas que pueden llamarse
  function addEnemy() { addCombatant(); }
  function removeEnemy(id) { removeCombatant(id); }
  function toggleEnemyBleeding(id) { cycleCombatantStatus(id); }
  function editEnemyAC(id) { editCombatantInit(id); }
  function _saveEnemyAC(id) {}
  function moveEnemy() {}
  let _etDragId = null;
  function _etDragStart() {} function _etDragOver() {} function _etDrop() {} function _etDragEnd() {}

  function _updateRoundDisplay() {
    const el = document.getElementById('roundDisplay');
    if (!el) return;
    if (!_combatActive) {
      el.innerHTML = `<button class="round-start-btn" onclick="App.startCombat()">⚔️ Iniciar combate</button>`;
    } else {
      el.innerHTML = `
        <div class="round-tracker">
          <div class="round-info">
            <span class="round-label">Ronda</span>
            <span class="round-num">${_combatRound}</span>
            <span class="round-label" style="margin-left:10px;">Turno</span>
            <span class="round-num" style="color:var(--text-mid);">${_combatTurn}</span>
          </div>
          <div class="round-btns">
            <button class="round-btn" onclick="App.nextCombatTurn()" title="Siguiente turno (fin del tuyo)">Siguiente turno</button>
            <button class="round-btn gold" onclick="App.nextCombatRound()" title="Nueva ronda">+ Ronda</button>
            <button class="round-btn danger" onclick="App.resetCombat()">Fin</button>
          </div>
        </div>`;
    }
  }

  /* ══════════════════════════════════════════════════════
     TURN TRACKER
  ══════════════════════════════════════════════════════ */

  function toggleTurn(action) {
    if (!_char) return;
    _char.turn[action] = !_char.turn[action];
    _saveChar();
    const btn = document.getElementById('turn' + action.charAt(0).toUpperCase() + action.slice(1));
    if (btn) {
      btn.classList.toggle('used', _char.turn[action]);
    }
  }

  function endTurn() {
    if (!_char) return;
    _char.turn = { action: false, bonus: false, reaction: false, movement: false };
    _saveChar();
    ['Action','Bonus','Reaction','Movement'].forEach(a => {
      const btn = document.getElementById('turn' + a);
      if (btn) btn.classList.remove('used');
    });
    if (_combatActive) showToast(`↺ Turno ${_combatTurn} terminado`);
    else showToast('Turno reiniciado');
  }

  /* ══════════════════════════════════════════════════════
     CONCENTRACIÓN
  ══════════════════════════════════════════════════════ */

  function _concRoundsActive() {
    if (!_char.concentration || !_char.concentrationRound || !_combatActive) return null;
    return Math.max(0, _combatRound - _char.concentrationRound) + 1;
  }

  function setConc(spellId) {
    if (!_char) return;
    if (spellId) {
      const sp = (_char.spells || []).find(s => s.id === spellId);
      _logCombat(`◆ Concentración: ${sp ? sp.name : spellId}`, 'spell');
      _char.concentrationRound = _combatActive ? _combatRound : 0;
    } else if (_char.concentration) {
      _logCombat('◇ Concentración rota', 'cond');
      _char.concentrationRound = 0;
    }
    _char.concentration = spellId;
    _saveChar();
    // Re-render completo del bloque (más simple y correcto)
    const concBtns = document.getElementById('concBtns');
    if (concBtns) concBtns.innerHTML = _buildConcBtns(_char);
    // Update concentration block styling and HUD
    _updateConcBlock();
    _updateCombatHUD();
    _updateHeaderStatus();
  }

  function _updateConcBlock() {
    if (!_char) return;
    const block = document.querySelector('.conc-block');
    if (!block) return;
    block.classList.toggle('conc-active', !!_char.concentration);

    const label = block.querySelector('.conc-label');
    if (label) {
      if (_char.concentration) {
        const rounds = _concRoundsActive();
        const sp = (_char.spells || []).find(s => s.id === _char.concentration);
        // Intentar parsear duración máxima del hechizo (ej: "1 minuto" = 10 rondas)
        const maxRounds = _spellDurationToRounds(sp);
        const roundsLeft = maxRounds ? maxRounds - (rounds || 0) + 1 : null;
        let labelText = '◆ Concentración activa';
        if (rounds) {
          labelText += `  ·  R${rounds}`;
          if (maxRounds) {
            labelText += `/${maxRounds}`;
            if (roundsLeft <= 2) labelText += ' ⚠';
          }
        }
        label.textContent = labelText;
      } else {
        label.textContent = 'Concentración';
      }
    }
  }

  function _spellDurationToRounds(sp) {
    if (!sp || !sp.duration) return null;
    const d = sp.duration.toLowerCase();
    if (d.includes('1 minuto') || d.includes('1 minute')) return 10;
    if (d.includes('10 minutos') || d.includes('10 minutes')) return 100;
    if (d.includes('1 hora') || d.includes('1 hour')) return 600;
    if (d.includes('1 round') || d.includes('1 ronda')) return 1;
    return null;
  }

  /* ══════════════════════════════════════════════════════
     CAST SPELL (Epic 1)
  ══════════════════════════════════════════════════════ */

  function castSpell(spellId, slotLevel) {
    if (!_char) return;
    const sp = (_char.spells || []).find(s => s.id === spellId);
    if (!sp) return;

    // Cantrip — no slot needed
    if (sp.level === 0) {
      _finalizeCast(sp, 0);
      return;
    }

    // Domain or MI spells — free cast (no slot consumed), but only if current ≥ 1
    if (sp.domain || sp.mi) {
      // Find a resource matching the spell name or a slot if forced
      _finalizeCast(sp, sp.level);
      return;
    }

    // Leveled spell — need a slot
    if (slotLevel === undefined) {
      // Find lowest available slot at or above sp.level
      let found = null;
      for (let i = sp.level; i <= 9; i++) {
        const slot = _char.spellSlots[i];
        if (slot && slot.current > 0) { found = i; break; }
      }
      if (found === null) {
        showToast(`Sin slots disponibles para ${sp.name}`);
        return;
      }
      // If spell can be upcast and there are higher slots, show picker
      const availSlots = [];
      for (let i = sp.level; i <= 9; i++) {
        const slot = _char.spellSlots[i];
        if (slot && slot.current > 0) availSlots.push(i);
      }
      if (availSlots.length > 1 && sp.upcast) {
        _openCastPicker(sp, availSlots);
        return;
      }
      slotLevel = found;
    }

    // Consume slot
    const slot = _char.spellSlots[slotLevel];
    if (!slot || slot.current <= 0) {
      showToast(`Sin slots de nivel ${slotLevel}`);
      return;
    }
    slot.current -= 1;
    _finalizeCast(sp, slotLevel);
    _refreshSlotDots(slotLevel);
  }

  function _finalizeCast(sp, slotLevel) {
    _saveChar(true);

    // Auto-concentration
    if (sp.concentration) {
      if (_char.concentration && _char.concentration !== sp.id) {
        const prev = (_char.spells || []).find(s => s.id === _char.concentration);
        const prevName = prev ? prev.name : _char.concentration;
        showToast(`◆ ${sp.name} activo (rompe ${prevName})`);
      } else {
        showToast(`◆ ${sp.name} lanzado${slotLevel > 0 ? ` · slot ${slotLevel}` : ''}`);
      }
      setConc(sp.id);
    } else {
      showToast(`✨ ${sp.name}${slotLevel > 0 ? ` · slot ${slotLevel}` : ''}`);
    }

    // Log to diary
    const slotNote = slotLevel > 0 ? ` (slot ${slotLevel})` : '';
    const concNote = sp.concentration ? ' [Concentración]' : '';
    const parts = [sp.name];
    if (slotLevel > 0) parts.push(`slot ${slotLevel}`);
    if (sp.concentration) parts.push('Conc');
    const logLine = parts.join(' · ');
    _logCombat(`✨ ${logLine}`, 'spell');

    // Refresh right column to show updated slot dots
    _renderCombateDer();
  }

  // Slot picker modal for upcasting
  let _castPickerSpell = null;

  function _openCastPicker(sp, availSlots) {
    _castPickerSpell = sp;
    const modal = document.getElementById('castPickerModal');
    const btns  = document.getElementById('castPickerBtns');
    document.getElementById('castPickerName').textContent = sp.name;
    btns.innerHTML = availSlots.map(lv =>
      `<button class="btn btn-ghost cast-picker-btn" onclick="App.confirmCastAtLevel('${sp.id}',${lv})">Slot ${lv}</button>`
    ).join('');
    modal.classList.add('show');
    document.getElementById('overlayBackdrop').classList.add('show');
  }

  function confirmCastAtLevel(spellId, slotLevel) {
    closeCastPicker();
    castSpell(spellId, slotLevel);
  }

  function closeCastPicker() {
    _castPickerSpell = null;
    const modal = document.getElementById('castPickerModal');
    if (modal) modal.classList.remove('show');
    document.getElementById('overlayBackdrop').classList.toggle('show', _diaryOpen || _iftttOpen || _spellDetailOpen);
  }

  function _checkConcAlert(damage) {
    if (!_char || !_char.concentration) return;
    const spell = (_char.spells || []).find(s => s.id === _char.concentration);
    const name = spell ? spell.name : _char.concentration;
    const dc = Math.max(10, Math.floor(damage / 2));
    document.getElementById('concAlertText').textContent =
      `Recibiste ${damage} daño. Tienes ${name} activo.`;
    document.getElementById('concAlertDC').textContent = `Save CON DC ${dc}`;
    const alert = document.getElementById('concAlert');
    alert.classList.add('show');
    clearTimeout(_concAlertTimer);
    _concAlertTimer = setTimeout(() => alert.classList.remove('show'), 8000);
  }

  function closeConcAlert() {
    document.getElementById('concAlert').classList.remove('show');
  }

  /* ══════════════════════════════════════════════════════
     TIRADAS DE MUERTE
  ══════════════════════════════════════════════════════ */

  function toggleDeathSave(type, index) {
    if (!_char) return;
    if (!_char.deathSaves) _char.deathSaves = { successes: 0, failures: 0 };
    const current = _char.deathSaves[type === 'success' ? 'successes' : 'failures'];
    // Si toco uno que ya está lleno (index < current) lo borro, si está vacío lo lleno
    if (index < current) {
      _char.deathSaves[type === 'success' ? 'successes' : 'failures'] = index;
    } else {
      _char.deathSaves[type === 'success' ? 'successes' : 'failures'] = index + 1;
    }
    _saveChar();
    _renderCombateIzq();
  }

  function resetDeathSaves() {
    if (!_char) return;
    _char.deathSaves = { successes: 0, failures: 0 };
    _saveChar();
    _renderCombateIzq();
    showToast('Tiradas de muerte reseteadas');
  }

  /* ══════════════════════════════════════════════════════
     RECURSOS
  ══════════════════════════════════════════════════════ */

  function adjustResource(id, delta) {
    if (!_char) return;
    const r = _char.resources.find(r => r.id === id);
    if (!r) return;
    r.current = Math.max(0, Math.min(r.max, r.current + delta));
    _saveChar(true);
    _refreshResourceDots(id);
  }

  function toggleResourceDot(id, dotIndex) {
    if (!_char) return;
    const r = _char.resources.find(r => r.id === id);
    if (!r) return;
    if (dotIndex === r.current - 1) {
      r.current = dotIndex;
    } else {
      r.current = dotIndex + 1;
    }
    _saveChar(true);
    _refreshResourceDots(id);
  }

  function _refreshResourceDots(id) {
    const r = _char.resources.find(r => r.id === id);
    if (!r) return;
    const container = document.getElementById(`rc-dots-${id}`);
    if (!container) return;
    container.querySelectorAll('.slot-dot').forEach((dot, d) => {
      dot.classList.toggle('used', d >= r.current);
    });
  }

  function adjustSlot(level, delta) {
    if (!_char) return;
    const slot = _char.spellSlots[level];
    if (!slot) return;
    slot.current = Math.max(0, Math.min(slot.max, slot.current + delta));
    _saveChar(true);
    _refreshSlotDots(level);
  }

  function toggleSlotDot(level, dotIndex) {
    if (!_char) return;
    const slot = _char.spellSlots[level];
    if (!slot) return;
    const prev = slot.current;
    if (dotIndex === slot.current - 1) {
      slot.current = dotIndex;
    } else {
      slot.current = dotIndex + 1;
    }
    _saveChar(true);
    _refreshSlotDots(level);
    if (slot.current < prev) _logCombat(`Slot Nvl ${level} gastado manualmente (${slot.current}/${slot.max})`, 'spell');
    else if (slot.current > prev) _logCombat(`Slot Nvl ${level} recuperado (${slot.current}/${slot.max})`, 'info');
  }

  function _refreshSlotDots(level) {
    const slot = _char.spellSlots[level];
    if (!slot) return;
    const container = document.getElementById(`slot-dots-${level}`);
    if (!container) return;
    const dots = container.querySelectorAll('.slot-dot');
    dots.forEach((dot, d) => {
      dot.classList.toggle('used', d >= slot.current);
    });
  }

  function adjustHitDice(delta) {
    if (!_char) return;
    _char.hitDice.current = Math.max(0, Math.min(_char.hitDice.max, _char.hitDice.current + delta));
    _saveChar(true);
    _refreshHitDiceDots();
  }

  function toggleHitDieDot(dotIndex) {
    if (!_char) return;
    if (dotIndex === _char.hitDice.current - 1) {
      _char.hitDice.current = dotIndex;
    } else {
      _char.hitDice.current = dotIndex + 1;
    }
    _saveChar(true);
    _refreshHitDiceDots();
  }

  function _refreshHitDiceDots() {
    const container = document.getElementById('hd-dots');
    if (!container || !_char) return;
    container.querySelectorAll('.slot-dot').forEach((dot, d) => {
      dot.classList.toggle('used', d >= _char.hitDice.current);
    });
  }

  function openCustomResource() {
    document.getElementById('crName').value = '';
    document.getElementById('crMax').value = '3';
    document.getElementById('crNote').value = '';
    document.getElementById('customResourceModal').classList.add('show');
  }

  function closeCustomResource() {
    document.getElementById('customResourceModal').classList.remove('show');
  }

  function saveCustomResource() {
    const name = document.getElementById('crName').value.trim();
    const max  = parseInt(document.getElementById('crMax').value) || 1;
    const recharge = document.getElementById('crRecharge').value;
    const note = document.getElementById('crNote').value.trim();
    if (!name) { showToast('Ingresa un nombre'); return; }

    const id = 'custom-' + Date.now();
    _char.resources.push({ id, name, current: max, max, recharge, note });
    _saveChar();
    closeCustomResource();
    _renderCombateTab();
    showToast(`Recurso "${name}" agregado`);
  }

  function deleteResource(id) {
    if (!_char) return;
    _char.resources = _char.resources.filter(r => r.id !== id);
    _saveChar();
    _renderCombateTab();
    showToast('Recurso eliminado');
  }

  /* ══════════════════════════════════════════════════════
     CONDICIONES
  ══════════════════════════════════════════════════════ */

  function adjustExhaustion(delta) {
    if (!_char) return;
    const prev = _char.exhaustion || 0;
    const next = Math.max(0, Math.min(6, prev + delta));
    if (next === prev) return;
    _char.exhaustion = next;
    _saveChar(true);
    const labels = ['sin agotamiento','nivel 1','nivel 2','nivel 3','nivel 4','nivel 5','☠ nivel 6 — muerte'];
    _logCombat(delta > 0
      ? `⚠ Agotamiento aumenta a ${labels[next]}`
      : `✦ Agotamiento reduce a ${labels[next]}`, 'cond');
    _renderCombateIzq();
    _updateHeaderStatus();
  }

  function setExhaustion(level) {
    if (!_char) return;
    _char.exhaustion = Math.max(0, Math.min(6, level));
    _saveChar(true);
    _renderCombateIzq();
    _updateHeaderStatus();
  }

  function toggleCondition(id) {
    if (!_char) return;
    const idx = _char.conditions.indexOf(id);
    if (idx >= 0) {
      _char.conditions.splice(idx, 1);
      _logCombat(`Condición quitada: ${id}`, 'cond');
    } else {
      _char.conditions.push(id);
      _logCombat(`⚠ Condición: ${id}`, 'cond');
    }
    _saveChar(true);
    _renderCombateIzq();
    _updateHeaderStatus();
  }

  function clearConditions() {
    if (!_char) return;
    _char.conditions = [];
    _saveChar();
    document.querySelectorAll('.cond-btn').forEach(b => b.classList.remove('active'));
    _updateHeaderStatus();
    showToast('Condiciones limpiadas');
  }

  /* ══════════════════════════════════════════════════════
     INSPIRACIÓN
  ══════════════════════════════════════════════════════ */

  function toggleInspiration() {
    if (!_char) return;
    _char.inspiration = !_char.inspiration;
    _saveChar();
    const block = document.querySelector('.inspiration-block');
    if (block) {
      block.classList.toggle('active', _char.inspiration);
      const icon = block.querySelector('.insp-icon');
      if (icon) icon.textContent = _char.inspiration ? '⭐' : '☆';
    }
    const inspBtn = document.getElementById('hdrInspBtn');
    if (inspBtn) inspBtn.classList.toggle('active', _char.inspiration);
    showToast(_char.inspiration ? '⭐ Inspiración activada' : 'Inspiración usada');
  }

  /* ══════════════════════════════════════════════════════
     CONJUROS PREPARADOS
  ══════════════════════════════════════════════════════ */

  function toggleSpellPrepared(id) {
    if (!_char) return;
    const spell = (_char.spells || []).find(s => s.id === id);
    if (!spell || spell.level === 0 || spell.domain || spell.mi) return;

    const prepared = _char.preparedToday || [];
    const idx = prepared.indexOf(id);
    const preparedMax = Characters.getPreparedMax(_char);
    const preparedCount = prepared.filter(pid => {
      const s = _char.spells.find(sp => sp.id === pid);
      return s && !s.domain && !s.mi;
    }).length;

    if (idx >= 0) {
      _char.preparedToday = prepared.filter(p => p !== id);
    } else {
      if (preparedCount >= preparedMax) {
        showToast(`Máximo ${preparedMax} conjuros preparados`);
        return;
      }
      _char.preparedToday = [...prepared, id];
    }

    _saveChar();

    // Actualizar checkbox visual sin re-render completo
    const chk = document.getElementById(`spchk-${id}`);
    if (chk) {
      const nowPrepared = _char.preparedToday.includes(id);
      chk.className = `spell-checkbox ${nowPrepared ? 'checked' : ''}`;
    }

    // Actualizar contador
    const newCount = _char.preparedToday.filter(pid => {
      const s = _char.spells.find(sp => sp.id === pid);
      return s && !s.domain && !s.mi;
    }).length;
    const countEl = document.getElementById('preparedCount');
    if (countEl) countEl.textContent = newCount;
  }

  // Quita un conjuro de la lista de "conocidos" (solo para known casters: Hechicero, Bardo, Brujo)
  function removeKnownSpell(id) {
    if (!_char) return;
    const spell = (_char.spells || []).find(s => s.id === id);
    if (!spell || spell.level === 0 || spell.domain || spell.mi) return;
    // Confirmar si excede el máximo (para que sea fácil limpiar)
    _char.spells = _char.spells.filter(s => s.id !== id);
    // También limpiar de preparedToday por si acaso
    if (_char.preparedToday) _char.preparedToday = _char.preparedToday.filter(p => p !== id);
    _saveChar();
    _renderConjurosIzq();
    _renderConjurosTab();
    showToast(`${spell.name} quitado de conjuros conocidos`);
  }

  // Limpia todos los conjuros conocidos nv1+ (con confirmación)
  function clearAllKnownSpells() {
    if (!_char) return;
    const count = (_char.spells || []).filter(s => s.level > 0 && !s.domain && !s.mi).length;
    if (count === 0) { showToast('No tenés conjuros conocidos para limpiar.'); return; }
    _confirm(
      `¿Seguro que querés limpiar los ${count} conjuros conocidos? Los cantrips y conjuros de dominio/MI no se borran.`,
      () => {
        _char.spells = (_char.spells || []).filter(s => s.level === 0 || s.domain || s.mi);
        if (_char.preparedToday) _char.preparedToday = [];
        _saveChar();
        _renderConjurosIzq();
        _renderConjurosTab();
        showToast('Conjuros conocidos limpiados.');
      }
    );
  }

  // Agrega un conjuro a la lista de "conocidos" (solo para known casters)
  function addKnownSpell(id) {
    if (!_char) return;
    // Buscar en catálogo
    const catalog = (Characters.CLASE_SPELLS && Characters.CLASE_SPELLS[_char.clase]) || [];
    const spell = catalog.find(s => s.id === id);
    if (!spell) return;
    // Verificar límite de conjuros conocidos (no cantrips)
    const maxKnown = Characters.getPreparedMax(_char);
    const currentKnown = (_char.spells || []).filter(s => s.level > 0 && !s.domain && !s.mi).length;
    if (currentKnown >= maxKnown) {
      showToast(`Máximo ${maxKnown} conjuros conocidos. Quita uno primero.`);
      return;
    }
    if (!_char.spells) _char.spells = [];
    if (!_char.spells.find(s => s.id === id)) {
      _char.spells.push(spell);
    }
    _saveChar();
    _renderConjurosIzq();
    _renderConjurosTab();
    showToast(`${spell.name} agregado a conjuros conocidos`);
  }

  /* ══════════════════════════════════════════════════════
     EQUIPO
  ══════════════════════════════════════════════════════ */

  function openAddWeapon() {
    _editWeaponIdx = null;
    document.getElementById('awmModalTitle').textContent = '+ Agregar Arma';
    document.getElementById('awmName').value = '';
    document.getElementById('awmDie').value = '1d6';
    document.getElementById('awmBonus').value = '';
    document.getElementById('awmType').value = 'melee';
    document.getElementById('awmDesc').value = '';
    document.getElementById('addWeaponModal').classList.add('show');
  }

  function openEditWeapon(idx) {
    const w = (_char.weapons || [])[idx];
    if (!w) return;
    _editWeaponIdx = idx;
    document.getElementById('awmModalTitle').textContent = '✎ Editar Arma';
    document.getElementById('awmName').value = w.name || '';
    document.getElementById('awmDie').value = w.die || '1d6';
    document.getElementById('awmBonus').value = w.bonus || '';
    document.getElementById('awmType').value = w.type || 'melee';
    document.getElementById('awmDesc').value = w.notes || '';
    document.getElementById('addWeaponModal').classList.add('show');
  }

  function closeAddWeapon() {
    document.getElementById('addWeaponModal').classList.remove('show');
  }

  function saveAddWeapon() {
    const name = document.getElementById('awmName').value.trim();
    if (!name) return;
    const die      = document.getElementById('awmDie').value.trim() || '1d6';
    const bonusRaw = document.getElementById('awmBonus').value.trim();
    const bonus    = bonusRaw ? (bonusRaw.startsWith('+') || bonusRaw.startsWith('-') ? bonusRaw : '+' + bonusRaw) : '';
    const type     = document.getElementById('awmType').value || 'melee';
    const notes    = document.getElementById('awmDesc').value.trim();
    if (_editWeaponIdx !== null) {
      const w = _char.weapons[_editWeaponIdx];
      Object.assign(w, { name, die, bonus, type, notes });
    } else {
      _char.weapons.push({ id:'w-'+Date.now(), name, die, bonus, type, notes });
    }
    _saveChar();
    closeAddWeapon();
    _renderEquipoTab();
  }

  function addWeapon() { openAddWeapon(); }

  function deleteWeapon(idx) {
    const name = _char.weapons[idx]?.name || 'esta arma';
    _confirm(`¿Eliminar "${name}"?`, () => {
      _char.weapons.splice(idx, 1);
      _saveChar();
      _renderEquipoTab();
    });
  }

  let _editWeaponIdx = null;

  let _addItemSlot = 'bag';
  let _editItemIdx = null;  // null = crear nuevo, number = editar existente

  function _setContainerBtn(val) {
    const input = document.getElementById('aimContainer');
    const btn   = document.getElementById('aimContainerBtn');
    const icon  = document.getElementById('aimContainerIcon');
    if (input) input.value = val ? '1' : '0';
    if (btn)  btn.style.borderColor  = val ? 'var(--gold)' : 'var(--border)';
    if (btn)  btn.style.background   = val ? 'rgba(201,151,58,0.12)' : 'var(--bg2)';
    if (btn)  btn.style.color        = val ? 'var(--gold-light)' : 'var(--text-dim)';
    if (icon) icon.textContent       = val ? '☑' : '☐';
  }

  function toggleContainerBtn() {
    const input = document.getElementById('aimContainer');
    _setContainerBtn(input?.value !== '1');
  }

  function openEditItem(idx) {
    const item = (_char.consumables || [])[idx];
    if (!item) return;
    _editItemIdx = idx;
    _addItemSlot = item.slot || 'bag';
    document.getElementById('aimName').value = item.name || '';
    document.getElementById('aimDesc').value = item.desc || '';
    document.getElementById('aimQty').value  = item.qty !== undefined ? item.qty : 1;
    document.getElementById('aimCategory').value = item.category || 'Other';
    _setContainerBtn(!!item.container);
    const titleEl = document.getElementById('addItemModalTitle');
    if (titleEl) titleEl.textContent = '✎ Editar ítem';
    const saveBtn = document.getElementById('aimSaveBtn');
    if (saveBtn) saveBtn.textContent = 'Guardar';
    const qtyField = document.getElementById('aimQtyField');
    if (qtyField) qtyField.style.display = item.slot === 'body' ? 'none' : '';
    const containerRow = document.getElementById('aimContainerRow');
    if (containerRow) containerRow.style.display = item.slot === 'body' ? 'none' : '';
    document.getElementById('addItemModal').classList.add('show');
  }

  function openAddItem(slot) {
    _editItemIdx = null;
    _addItemSlot = slot || 'bag';
    document.getElementById('aimName').value = '';
    document.getElementById('aimDesc').value = '';
    _setContainerBtn(false);
    document.getElementById('addItemModal').classList.add('show');
    const titleEl = document.getElementById('addItemModalTitle');
    if (titleEl) titleEl.textContent = slot === 'body' ? '+ Equipo del cuerpo' : '+ Agregar a mochila';
    const saveBtn = document.getElementById('aimSaveBtn');
    if (saveBtn) saveBtn.textContent = 'Agregar';
    document.getElementById('aimCategory').value = slot === 'body' ? 'Apparel' : 'Other';
    const qtyField = document.getElementById('aimQtyField');
    if (qtyField) qtyField.style.display = slot === 'body' ? 'none' : '';
    const containerRow = document.getElementById('aimContainerRow');
    if (containerRow) containerRow.style.display = slot === 'body' ? 'none' : '';
    document.getElementById('aimQty').value = '1';
  }

  function closeAddItem() {
    document.getElementById('addItemModal').classList.remove('show');
  }

  function saveAddItem() {
    const name = document.getElementById('aimName').value.trim();
    if (!name) return;
    const qtyRaw = parseInt(document.getElementById('aimQty').value);
    const qty  = _addItemSlot === 'body' ? 1 : (isNaN(qtyRaw) ? 1 : qtyRaw);
    const category = document.getElementById('aimCategory').value;
    const desc = document.getElementById('aimDesc').value.trim();
    if (!_char.consumables) _char.consumables = [];

    const isContainer = document.getElementById('aimContainer')?.value === '1';

    if (_editItemIdx !== null) {
      const item = _char.consumables[_editItemIdx];
      if (item) {
        item.name = name;
        item.desc = desc;
        item.qty  = qty;
        item.category  = category;
        item.container = isContainer || undefined;
        if (isContainer) item.maxQty = qty > 0 ? qty : (item.maxQty || 1);
      }
    } else {
      _char.consumables.push({ id:'i-'+Date.now(), name, qty, category, desc, slot: _addItemSlot,
        container: isContainer || undefined, maxQty: isContainer ? qty : undefined });
    }

    _saveChar();
    closeAddItem();
    _renderEquipoTab();
  }

  function adjustConsumable(idx, delta) {
    const item = _char.consumables[idx];
    if (!item) return;
    const maxQty = item.container ? (item.maxQty || item.qty || 1) : Infinity;
    item.qty = Math.min(maxQty, Math.max(0, item.qty + delta));
    _saveChar();
    _renderEquipoTab();
  }

  function refillContainer(idx) {
    const item = _char.consumables[idx];
    if (!item) return;
    item.qty = item.maxQty || 1;
    _saveChar();
    _renderEquipoTab();
    showToast(`${item.name} rellenado`);
  }

  function deleteConsumable(idx) {
    const name = _char.consumables[idx]?.name || 'este ítem';
    _confirm(`¿Eliminar "${name}"?`, () => {
      _char.consumables.splice(idx, 1);
      _saveChar();
      _renderEquipoTab();
    });
  }

  function addConsumable() { openAddItem(); }

  function setCurrency(coin, val) {
    _char.currency[coin] = Math.max(0, val);
    _saveChar();
  }

  function setAttunement(idx, val) {
    if (!_char.attunement) _char.attunement = ['','',''];
    _char.attunement[idx] = val;
    _saveChar();
  }

  function addMagicItem() {
    const name = prompt('Nombre del ítem mágico:');
    if (!name) return;
    const desc = prompt('Descripción breve (opcional):', '') || '';
    _char.magicItems.push({ name, desc });
    _saveChar();
    _renderEquipoTab();
  }

  function deleteMagicItem(idx) {
    const name = _char.magicItems[idx]?.name || 'este ítem';
    _confirm(`¿Eliminar "${name}"?`, () => {
      _char.magicItems.splice(idx, 1);
      _saveChar();
      _renderEquipoTab();
    });
  }

  function setNotes(val) {
    _char.notes = val;
    _saveChar();
  }

  function setSpeciesTraits(val) {
    _char.speciesTraits = val;
    _saveChar();
  }

  /* ══════════════════════════════════════════════════════
     BONUSES MANUALES
  ══════════════════════════════════════════════════════ */

  // setBonus('ca', 1) / setBonus('savesAll', 1) / setBonus('saves.sab', 1) / setBonus('skills.perspicacia', 1)
  function setBonus(key, val) {
    if (!_char) return;
    if (!_char.bonuses) _char.bonuses = { ca:0, savesAll:0, saves:{}, skills:{}, init:0, hpMax:0, ataque:0, cd:0 };
    const n = parseInt(val);
    if (isNaN(n)) return;
    if (key.includes('.')) {
      const [group, sub] = key.split('.');
      if (!_char.bonuses[group]) _char.bonuses[group] = {};
      _char.bonuses[group][sub] = n;
    } else {
      _char.bonuses[key] = n;
    }
    _saveChar();
    _renderHeader();
    if (_activeTab === 'habilidades') _renderHabilidadesTab();
    if (_activeTab === 'combate') _renderCombateTab();
    if (_activeTab === 'equipo') _renderEquipoTab();
  }

  function toggleShield() {
    if (!_char) return;
    _char.armor.shield = !_char.armor.shield;
    _saveChar();
    _renderHeader();
    if (_activeTab === 'equipo') _renderEquipoTab();
    if (_activeTab === 'combate') _renderCombateTab();
    showToast(_char.armor.shield ? 'Escudo equipado' : 'Escudo quitado');
  }

  /* ── ARMOR PICKER ── */

  function openArmorPicker() {
    const catalog = Characters.ARMOR_CATALOG;
    const current = (_char && _char.armor) ? _char.armor : {};
    const groups  = { light: 'aprLight', medium: 'aprMedium', heavy: 'aprHeavy', none: 'aprOther', custom: 'aprOther' };

    Object.values(groups).forEach(id => {
      const el = document.getElementById(id);
      if (el) el.innerHTML = '';
    });

    catalog.forEach(a => {
      const containerId = groups[a.type] || 'aprOther';
      const container   = document.getElementById(containerId);
      if (!container) return;

      const isSelected = current.name === a.name;
      const caLabel    = a.add_dex
        ? `CA ${a.base_ca} + DES${a.max_dex != null ? ` (máx +${a.max_dex})` : ''}`
        : `CA ${a.base_ca} fijo`;
      const noteLabel  = a.stealth_dis ? '⚠ Desventaja sigilo' : '';

      const chip = document.createElement('button');
      chip.className = `armor-picker-chip${isSelected ? ' selected' : ''}`;
      chip.type = 'button';
      chip.innerHTML = `
        <span class="apc-name">${a.emoji} ${a.name}</span>
        <span class="apc-ca">${caLabel}</span>
        ${noteLabel ? `<span class="apc-note">${noteLabel}</span>` : ''}`;
      chip.onclick = () => selectArmorType(a.id);
      container.appendChild(chip);
    });

    document.getElementById('armorPickerModal').classList.add('show');
  }

  function closeArmorPicker() {
    document.getElementById('armorPickerModal').classList.remove('show');
  }

  function selectArmorType(armorId) {
    if (!_char) return;
    const a = Characters.ARMOR_CATALOG.find(x => x.id === armorId);
    if (!a) return;

    if (armorId === 'custom') {
      // Para custom, solo cerrar y dejar que el usuario edite el Bonus CA manual
      closeArmorPicker();
      showToast('Usa "Bonus CA" para ajustar tu CA personalizada');
      return;
    }

    if (armorId === 'none') {
      _char.armor.name    = '';
      _char.armor.base_ca = 10;
      _char.armor.add_dex = true;
    } else {
      _char.armor.name    = a.name;
      _char.armor.base_ca = a.base_ca;
      _char.armor.add_dex = a.add_dex;
    }

    _saveChar();
    closeArmorPicker();
    _renderHeader();
    _renderEquipoTab();
    showToast(`✓ ${a.name} equipada · CA ${Characters.calcCA(_char)}`);
  }

  /* ══════════════════════════════════════════════════════
     CANTRIP PICKER
  ══════════════════════════════════════════════════════ */

  function openCantripPicker() {
    if (!_char) return;
    const modal = document.getElementById('cantripPickerModal');
    if (!modal) return;
    _renderCantripPickerBody();
    modal.style.display = 'flex';
  }

  function closeCantripPicker() {
    const modal = document.getElementById('cantripPickerModal');
    if (modal) modal.style.display = 'none';
  }

  function _renderCantripPickerBody() {
    const c       = _char;
    const body    = document.getElementById('cantripPickerBody');
    const cfg     = Characters.CLASES_CONFIG[c.clase];
    const maxKnown= Characters.getCantripsKnown(c);  // null = sin límite fijo

    // Catálogo: todos los cantrips de la clase (level === 0) más los que ya tiene el personaje
    const catalog = (Characters.CLASE_SPELLS && Characters.CLASE_SPELLS[c.clase] || []).filter(s => s.level === 0);
    // Cantrips que ya tiene guardados
    const existing= (c.spells || []).filter(s => s.level === 0);
    // Unir: catálogo + los que el personaje ya tiene y no están en el catálogo
    const allOptions = [...catalog];
    existing.forEach(e => {
      if (!allOptions.find(o => o.id === e.id)) allOptions.push(e);
    });

    const existingIds      = new Set(existing.map(s => s.id));
    const freeIds          = new Set(existing.filter(s => s.cantrip_subclass).map(s => s.id));
    const paidCount        = existing.filter(s => !s.cantrip_subclass).length;

    const limitNote = maxKnown !== null
      ? `<div style="font-size:12px;color:var(--text-dim);margin-bottom:12px;">
          Podés conocer <strong style="color:var(--text);">${maxKnown}</strong> cantrips según tu nivel.
          ${freeIds.size > 0 ? `Los de subclase (🎁) son <em>adicionales</em> y no cuentan.` : ''}
         </div>`
      : `<div style="font-size:12px;color:var(--text-dim);margin-bottom:12px;">Sin límite fijo. Marcá los que querés usar.</div>`;

    const optionsHTML = allOptions.map(opt => {
      const isChecked = existingIds.has(opt.id);
      const isFree    = freeIds.has(opt.id);
      return `
      <label class="choice-option${isChecked ? ' selected' : ''}${isFree ? ' cantrip-free' : ''}" style="gap:10px;">
        <input type="checkbox" name="cantripPick" value="${opt.id}"
               ${isChecked ? 'checked' : ''}
               ${isFree ? 'disabled checked' : ''}
               onchange="App._onCantripCheck(this, ${maxKnown !== null ? maxKnown : 999})">
        <div class="choice-opt-content" style="flex:1;">
          <div style="display:flex;align-items:center;gap:6px;">
            <strong>${opt.name}</strong>
            ${isFree ? '<span style="font-size:10px;color:var(--gold);background:rgba(201,151,58,0.15);padding:1px 6px;border-radius:10px;">🎁 subclase</span>' : ''}
          </div>
          <span class="choice-opt-desc">${opt.desc || ''}</span>
        </div>
      </label>`;
    }).join('');

    body.innerHTML = limitNote + `<div class="choice-options-list">${optionsHTML}</div>`;
  }

  function _onCantripCheck(checkbox, max) {
    if (max >= 999) return; // sin límite
    // Contar checked no-disabled (= cantrips pagados, no los de subclase)
    const checked = document.querySelectorAll('[name="cantripPick"]:checked:not(:disabled)');
    if (checked.length > max) {
      checkbox.checked = false;
      checkbox.closest('.choice-option')?.classList.remove('selected');
      showToast(`Máximo ${max} cantrips para tu nivel`);
      return;
    }
    checkbox.closest('.choice-option')?.classList.toggle('selected', checkbox.checked);
  }

  function saveCantripPicker() {
    if (!_char) return;
    const c = _char;

    // IDs seleccionados (non-disabled = los pagados)
    const selectedPaid = new Set(
      Array.from(document.querySelectorAll('[name="cantripPick"]:checked:not(:disabled)')).map(el => el.value)
    );
    // IDs de subclase (siempre se mantienen)
    const freeIds = new Set((c.spells || []).filter(s => s.level === 0 && s.cantrip_subclass).map(s => s.id));

    // Construir nueva lista de cantrips:
    //   - Cantrips de subclase: siempre incluidos tal cual
    //   - Cantrips pagados: solo los seleccionados
    const keepFree    = (c.spells || []).filter(s => s.level === 0 && freeIds.has(s.id));
    const catalog     = (Characters.CLASE_SPELLS && Characters.CLASE_SPELLS[c.clase] || []).filter(s => s.level === 0);
    const existingPaid= (c.spells || []).filter(s => s.level === 0 && !freeIds.has(s.id));

    // Para cada ID seleccionado: buscar en spells existentes (preserva cambios manuales),
    // si no existe buscarlo en catálogo, y si tampoco existe mantener el existente tal cual.
    const newPaid = [];
    selectedPaid.forEach(id => {
      const existing = existingPaid.find(s => s.id === id);
      if (existing) { newPaid.push(existing); return; }
      const fromCatalog = catalog.find(s => s.id === id);
      if (fromCatalog) { newPaid.push({ ...fromCatalog }); return; }
    });

    // Reemplazar solo los cantrips; mantener todos los demás (level > 0)
    c.spells = [
      ...keepFree,
      ...newPaid,
      ...(c.spells || []).filter(s => s.level > 0),
    ];

    _saveChar();
    closeCantripPicker();
    _renderConjurosIzq();
    _renderConjurosTab();
    showToast(`Cantrips guardados (${newPaid.length + keepFree.length} total)`);
  }

  /* ══════════════════════════════════════════════════════
     HABILIDADES
  ══════════════════════════════════════════════════════ */

  function editStat(statKey) { openEditStats(); }

  function openEditStats() {
    const c = _char;
    const STATS = ['for','des','con','int','sab','car'];

    STATS.forEach(s => {
      const el = document.getElementById(`es-stat-${s}`);
      if (el) el.value = c.stats[s];
    });
    document.getElementById('es-nivel').value     = c.nivel;
    document.getElementById('es-hp-max').value    = c.hp.max;
    document.getElementById('es-name').value      = c.name      || '';
    document.getElementById('es-trasfondo').value = c.trasfondo || '';
    document.getElementById('es-deity').value     = c.deity     || '';

    document.getElementById('editStatsModal').classList.add('show');
  }

  function saveEditStats() {
    const STATS = ['for','des','con','int','sab','car'];
    let changed = false;

    STATS.forEach(s => {
      const el = document.getElementById(`es-stat-${s}`);
      if (!el) return;
      const n = Math.max(1, Math.min(30, parseInt(el.value) || 10));
      if (_char.stats[s] !== n) { _char.stats[s] = n; changed = true; }
    });

    const nivel     = Math.max(1, Math.min(20, parseInt(document.getElementById('es-nivel').value) || _char.nivel));
    const hpMax     = Math.max(1, parseInt(document.getElementById('es-hp-max').value) || _char.hp.max);
    const name      = document.getElementById('es-name').value.trim()      || _char.name;
    const trasfondo = document.getElementById('es-trasfondo').value.trim();
    const deity     = document.getElementById('es-deity').value.trim();

    if (_char.nivel !== nivel)        { _char.nivel      = nivel;      changed = true; }
    if (_char.hp.max !== hpMax)       { _char.hp.max     = hpMax;
                                        if (_char.hp.current > hpMax) _char.hp.current = hpMax;
                                        changed = true; }
    if (_char.name      !== name)      { _char.name      = name;      changed = true; }
    if (_char.trasfondo !== trasfondo) { _char.trasfondo = trasfondo; changed = true; }
    if (_char.deity     !== deity)     { _char.deity     = deity;     changed = true; }

    document.getElementById('editStatsModal').classList.remove('show');

    if (changed) {
      _saveChar();
      _renderHeader();
      _renderHabilidadesTab();
      showToast('✓ Personaje actualizado');
    }
  }

  function closeEditStats() {
    document.getElementById('editStatsModal').classList.remove('show');
  }

  function toggleSkillProf(skillId) {
    if (!_char.skillProfs)      _char.skillProfs      = [];
    if (!_char.skillExpertise)  _char.skillExpertise  = [];

    const hasProf = _char.skillProfs.includes(skillId);
    const hasExp  = _char.skillExpertise.includes(skillId);

    if (hasExp) {
      // expertise → ninguno
      _char.skillExpertise = _char.skillExpertise.filter(id => id !== skillId);
      _char.skillProfs     = _char.skillProfs.filter(id => id !== skillId);
    } else if (hasProf) {
      // prof → expertise
      _char.skillExpertise.push(skillId);
    } else {
      // ninguno → prof
      _char.skillProfs.push(skillId);
    }
    _saveChar();
    _renderHabilidadesTab();
  }

  function toggleSavingThrow(stat) {
    if (!_char.savingThrows) _char.savingThrows = [];
    const idx = _char.savingThrows.indexOf(stat);
    if (idx >= 0) _char.savingThrows.splice(idx, 1);
    else _char.savingThrows.push(stat);
    _saveChar();
    _renderHabilidadesTab();
  }

  function setVelocidad(val) {
    _char.velocidad = val;
    _saveChar();
  }

  /* ══════════════════════════════════════════════════════
     SUBCLASE MODAL
  ══════════════════════════════════════════════════════ */

  function openSubclaseModal() {
    if (!_char) return;
    const clase = _char.clase;
    // Obtener subclases disponibles para esta clase
    const allSubs = Characters.SUBCLASES_CONFIG || {};
    const available = Object.keys(allSubs).filter(k => allSubs[k].clase === clase);

    if (available.length === 0) {
      showToast('No hay subclases registradas para ' + clase);
      return;
    }

    const current = _char.subclase || '';
    const hasBM = current === 'Battle Master';

    // Construir HTML del modal
    let chipsHTML = available.map(name => `
      <button class="subclase-chip ${name === current ? 'selected' : ''}"
              onclick="App._selectSubclaseChip(this, '${name.replace(/'/g, "\\'")}')">${name}</button>
    `).join('');

    // Battle Master maneuvers section (mostrar si ya es BM o si se seleccionó BM)
    const bmSub = allSubs['Battle Master'];
    const allManeuvers = bmSub ? bmSub.maneuvers : [];
    const selectedManeuvers = _char.maneuvers || [];
    const nivel = _char.nivel || 1;
    const maxManeuvers = nivel >= 15 ? 6 : nivel >= 10 ? 5 : nivel >= 7 ? 4 : 3;

    let maneuversHTML = '';
    if (allManeuvers.length > 0) {
      maneuversHTML = `
      <div id="bmManeuversSection" style="display:${current === 'Battle Master' ? 'block' : 'none'};margin-top:14px;">
        <div class="form-label" style="margin-bottom:6px;">Maniobras elegidas (máx ${maxManeuvers} a nivel ${nivel})</div>
        <div class="maneuvers-grid">
          ${allManeuvers.map(m => `
            <label class="maneuver-option ${selectedManeuvers.includes(m.id) ? 'selected' : ''}">
              <input type="checkbox" value="${m.id}" ${selectedManeuvers.includes(m.id) ? 'checked' : ''}
                     onchange="App._toggleManeuver(this, ${maxManeuvers})" style="display:none;">
              <strong>${m.name}</strong>
              <span class="maneuver-desc">${m.desc}</span>
            </label>
          `).join('')}
        </div>
      </div>`;
    }

    const overlay = document.getElementById('subclaseModalOverlay');
    if (!overlay) {
      // Crear el modal dinámicamente si no existe
      const div = document.createElement('div');
      div.id = 'subclaseModalOverlay';
      div.className = 'modal-overlay';
      div.style.cssText = 'display:flex;align-items:flex-start;overflow-y:auto;';
      div.innerHTML = `
        <div class="modal" style="max-height:90vh;overflow-y:auto;">
          <div class="modal-header">
            <span id="subclaseModalTitle">Subclase de ${clase}</span>
          </div>
          <div class="modal-body" id="subclaseModalBody"></div>
          <div class="modal-footer">
            <button class="btn-secondary" onclick="App.closeSubclaseModal()">Cancelar</button>
            <button class="btn-primary" onclick="App.saveSubclase()">Aplicar</button>
          </div>
        </div>`;
      document.body.appendChild(div);
    }

    const titleEl = document.getElementById('subclaseModalTitle');
    const bodyEl  = document.getElementById('subclaseModalBody');
    if (titleEl) titleEl.textContent = `Subclase de ${clase}`;
    if (bodyEl) {
      bodyEl.innerHTML = `
        <div class="form-label" style="margin-bottom:8px;">Elige tu subclase:</div>
        <div class="subclase-chips">${chipsHTML}</div>
        ${maneuversHTML}
      `;
    }

    // Guardar la selección actual temporalmente
    window._pendingSubclase = current;

    document.getElementById('subclaseModalOverlay').style.display = 'flex';
  }

  function _selectSubclaseChip(el, name) {
    document.querySelectorAll('.subclase-chip').forEach(c => c.classList.remove('selected'));
    el.classList.add('selected');
    window._pendingSubclase = name;
    // Mostrar/ocultar sección de maniobras BM
    const bmSection = document.getElementById('bmManeuversSection');
    if (bmSection) {
      bmSection.style.display = name === 'Battle Master' ? 'block' : 'none';
    }
  }

  function _toggleManeuver(checkbox, maxCount) {
    const label = checkbox.closest('.maneuver-option');
    if (checkbox.checked) {
      // Contar cuántas están seleccionadas
      const checked = document.querySelectorAll('.maneuver-option input[type=checkbox]:checked');
      if (checked.length > maxCount) {
        checkbox.checked = false;
        showToast(`Máximo ${maxCount} maniobras a este nivel`);
        return;
      }
      label && label.classList.add('selected');
    } else {
      label && label.classList.remove('selected');
    }
  }

  function saveSubclase() {
    const newSubclase = window._pendingSubclase;
    if (!newSubclase || !_char) {
      closeSubclaseModal();
      return;
    }

    // Aplicar subclase
    Characters.applySubclase(_char, newSubclase);

    // Para Battle Master: guardar maniobras elegidas
    if (newSubclase === 'Battle Master') {
      const checked = document.querySelectorAll('#bmManeuversSection input[type=checkbox]:checked');
      _char.maneuvers = Array.from(checked).map(cb => cb.value);
    }

    _saveChar();
    closeSubclaseModal();

    // Refrescar UI — renderizar tab activo
    _renderHabilidadesTab();
    if (_activeTab === 'combate') _renderCombateTab();

    showToast(`Subclase "${newSubclase}" aplicada`);
  }

  function closeSubclaseModal() {
    const overlay = document.getElementById('subclaseModalOverlay');
    if (overlay) overlay.style.display = 'none';
  }

  /* ══════════════════════════════════════════════════════
     SISTEMA DE ELECCIONES GENÉRICO
     Maneja: pick1, asi, pickSkills
  ══════════════════════════════════════════════════════ */

  // Cola de elecciones pendientes
  let _choiceQueue = [];
  let _choiceQueueCallback = null;

  // Punto de entrada: recibe lista de choices pendientes y un callback final
  function openChoicesQueue(pendingChoices, onComplete) {
    _choiceQueue = [...pendingChoices];
    _choiceQueueCallback = onComplete || null;
    _processNextChoice();
  }

  function _processNextChoice() {
    if (_choiceQueue.length === 0) {
      // Cola vacía — ejecutar callback
      if (_choiceQueueCallback) _choiceQueueCallback();
      _choiceQueueCallback = null;
      return;
    }
    const choice = _choiceQueue.shift();
    _openChoiceModal(choice);
  }

  function _openChoiceModal(choice) {
    // Crear overlay si no existe
    let overlay = document.getElementById('choiceModalOverlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'choiceModalOverlay';
      overlay.className = 'modal-overlay';
      overlay.style.cssText = 'display:flex;align-items:flex-start;overflow-y:auto;z-index:1100;';
      overlay.innerHTML = `
        <div class="modal" style="max-height:90vh;overflow-y:auto;min-width:320px;">
          <div class="modal-header">
            <span id="choiceModalTitle"></span>
          </div>
          <div class="modal-body" id="choiceModalBody"></div>
          <div class="modal-footer">
            <button class="btn-secondary" id="choiceSkipBtn" onclick="App._skipChoice()">Omitir</button>
            <button class="btn-primary" id="choiceSaveBtn" onclick="App._saveChoice()">Confirmar</button>
          </div>
        </div>`;
      document.body.appendChild(overlay);
    }

    const titleEl = document.getElementById('choiceModalTitle');
    const bodyEl  = document.getElementById('choiceModalBody');
    window._currentChoice = choice;

    titleEl.textContent = choice.label;

    if (choice.type === 'pick1') {
      _renderPick1(bodyEl, choice);
    } else if (choice.type === 'asi') {
      _renderASI(bodyEl, choice);
    } else if (choice.type === 'pickSkills') {
      _renderPickSkills(bodyEl, choice);
    } else if (choice.type === 'pickMultiple') {
      _renderPickMultiple(bodyEl, choice);
    }

    overlay.style.display = 'flex';
  }

  function _renderPick1(bodyEl, choice) {
    const current = _char && _char.choices && _char.choices[choice.id];
    bodyEl.innerHTML = `
      <p class="choice-prompt">${choice.prompt || 'Elegí una opción:'}</p>
      <div class="choice-options-list">
        ${choice.options.map(opt => `
          <label class="choice-option ${current === opt.id ? 'selected' : ''}">
            <input type="radio" name="pick1" value="${opt.id}"
                   ${current === opt.id ? 'checked' : ''}
                   onchange="App._onPick1Change(this)">
            <div class="choice-opt-content">
              <strong>${opt.name}</strong>
              ${opt.desc ? `<span class="choice-opt-desc">${opt.desc}</span>` : ''}
            </div>
          </label>
        `).join('')}
      </div>`;
  }

  function _renderASI(bodyEl, choice) {
    const STAT_LABELS = { for:'FUE', des:'DES', con:'CON', int:'INT', sab:'SAB', car:'CAR' };
    const stats = _char ? _char.stats : { for:10, des:10, con:10, int:10, sab:10, car:10 };

    // Feats agrupados por categoría
    const feats    = Characters.GENERAL_FEATS || [];
    const cats     = [...new Set(feats.map(f => f.category))];
    const featHTML = cats.map(cat => {
      const list = feats.filter(f => f.category === cat);
      return `
        <div style="font-size:10px;text-transform:uppercase;letter-spacing:1px;color:var(--text-dim);margin:10px 0 4px;">${cat}</div>
        ${list.map(f => `
          <label class="choice-option feat-pick-option">
            <input type="radio" name="asiFeat" value="${f.id}" onchange="App._onASIFeatChange(this)">
            <div class="choice-opt-content">
              <strong>${f.name}</strong>
              ${f.prereq ? `<span style="font-size:10px;color:var(--gold-dim);display:block;">Req: ${f.prereq}</span>` : ''}
              <span class="choice-opt-desc">${f.desc}</span>
            </div>
          </label>`).join('')}`;
    }).join('');

    bodyEl.innerHTML = `
      <p class="choice-prompt">Ganás +2 a un atributo, +1/+1 a dos, o tomás un <strong>Feat</strong>.<br>
      <span style="font-size:11px;color:var(--text-dim);">Máximo 20 por atributo.</span></p>
      <div class="asi-mode-toggle">
        <button class="asi-mode-btn active" id="asiMode-single" onclick="App._setASIMode('single')">+2 a uno</button>
        <button class="asi-mode-btn" id="asiMode-split"  onclick="App._setASIMode('split')">+1 / +1</button>
        <button class="asi-mode-btn" id="asiMode-feat"   onclick="App._setASIMode('feat')">🎓 Feat</button>
      </div>

      <div id="asiSingleSection">
        <div class="choice-options-list asi-grid">
          ${Object.keys(STAT_LABELS).map(s => {
            const cur  = stats[s] || 10;
            const next = Math.min(20, cur + 2);
            const atMax = cur >= 20;
            const gain  = next - cur;
            const note  = atMax ? '✓ ya en 20' : `${cur} → ${next}${gain < 2 ? ' (máx)' : ''}`;
            return `
            <label class="choice-option asi-option${atMax ? ' disabled' : ''}">
              <input type="radio" name="asiSingle" value="${s}"
                     ${atMax ? 'disabled' : ''}
                     onchange="App._onASISingleChange(this)">
              <div class="choice-opt-content">
                <strong>${STAT_LABELS[s]}</strong>
                <span class="choice-opt-desc" style="${atMax ? 'color:var(--text-dim)' : ''}">${note}</span>
              </div>
            </label>`;
          }).join('')}
        </div>
      </div>

      <div id="asiSplitSection" style="display:none;">
        <p style="font-size:12px;color:var(--text-dim);margin-bottom:8px;">Elegí dos atributos distintos:</p>
        <div class="choice-options-list asi-grid" id="asiSplitGrid">
          ${Object.keys(STAT_LABELS).map(s => {
            const cur  = stats[s] || 10;
            const next = Math.min(20, cur + 1);
            const atMax = cur >= 20;
            const note  = atMax ? '✓ ya en 20' : `${cur} → ${next}`;
            return `
            <label class="choice-option asi-option${atMax ? ' disabled' : ''}">
              <input type="checkbox" name="asiSplit" value="${s}"
                     ${atMax ? 'disabled' : ''}
                     onchange="App._onASISplitChange(this)">
              <div class="choice-opt-content">
                <strong>${STAT_LABELS[s]}</strong>
                <span class="choice-opt-desc" style="${atMax ? 'color:var(--text-dim)' : ''}">${note}</span>
              </div>
            </label>`;
          }).join('')}
        </div>
      </div>

      <div id="asiFeatSection" style="display:none;">
        <p style="font-size:12px;color:var(--text-dim);margin-bottom:6px;">Elegí un feat — aparecerá en tu pestaña Habilidades:</p>
        <div class="choice-options-list" style="max-height:280px;overflow-y:auto;">
          ${featHTML}
        </div>
      </div>`;

    window._asiMode = 'single';
  }

  function _renderPickSkills(bodyEl, choice) {
    const count = choice.count || 2;
    const alreadyExpert = (_char && _char.skillExpertise) || [];
    bodyEl.innerHTML = `
      <p class="choice-prompt">${choice.prompt || `Elegí ${count} skills:`} (elegí ${count})</p>
      <div class="choice-options-list">
        ${Characters.SKILLS_DEF.map(sk => {
          const isExpert = alreadyExpert.includes(sk.id);
          return `
          <label class="choice-option ${isExpert ? 'disabled' : ''}">
            <input type="checkbox" name="pickSkill" value="${sk.id}"
                   ${isExpert ? 'disabled checked' : ''}
                   onchange="App._onPickSkillChange(this, ${count})">
            <div class="choice-opt-content">
              <strong>${sk.name}</strong>
              ${isExpert ? '<span class="choice-opt-desc">Ya tenés Expertise</span>' : ''}
            </div>
          </label>`;
        }).join('')}
      </div>`;
  }

  function _renderPickMultiple(bodyEl, choice) {
    const count   = choice.count || 1;
    const options = choice.options || [];
    // Collect already chosen in previous pickMultiple rounds for this class
    const alreadyChosen = new Set();
    if (_char && _char.choices) {
      Object.entries(_char.choices).forEach(([cid, val]) => {
        if (cid !== choice.id && cid.startsWith(choice.id.replace(/-\d+$/, '-')) && Array.isArray(val)) {
          val.forEach(v => alreadyChosen.add(v));
        }
      });
    }
    bodyEl.innerHTML = `
      <p class="choice-prompt">${choice.prompt || `Elegí ${count} opciones:`} (elegí ${count})</p>
      <div class="choice-options-list">
        ${options.map(opt => {
          const taken = alreadyChosen.has(opt.id);
          return `
          <label class="choice-option ${taken ? 'disabled' : ''}">
            <input type="checkbox" name="pickMultiple" value="${opt.id}"
                   ${taken ? 'disabled checked' : ''}
                   onchange="App._onPickMultipleChange(this, ${count})">
            <div class="choice-opt-content">
              <strong>${opt.name}</strong>
              <span class="choice-opt-desc">${opt.desc || ''}</span>
            </div>
          </label>`;
        }).join('')}
      </div>`;
  }

  function _onPick1Change(radio) {
    document.querySelectorAll('#choiceModalBody .choice-option').forEach(el => el.classList.remove('selected'));
    radio.closest('.choice-option').classList.add('selected');
  }

  function _setASIMode(mode) {
    window._asiMode = mode;
    document.getElementById('asiMode-single')?.classList.toggle('active', mode === 'single');
    document.getElementById('asiMode-split')?.classList.toggle('active',  mode === 'split');
    document.getElementById('asiMode-feat')?.classList.toggle('active',   mode === 'feat');
    const single = document.getElementById('asiSingleSection');
    const split  = document.getElementById('asiSplitSection');
    const feat   = document.getElementById('asiFeatSection');
    if (single) single.style.display = mode === 'single' ? 'block' : 'none';
    if (split)  split.style.display  = mode === 'split'  ? 'block' : 'none';
    if (feat)   feat.style.display   = mode === 'feat'   ? 'block' : 'none';
    // Deselect all
    document.querySelectorAll('[name="asiSingle"],[name="asiSplit"],[name="asiFeat"]').forEach(i => {
      i.checked = false;
      i.closest('.choice-option')?.classList.remove('selected');
    });
  }

  function _onASIFeatChange(radio) {
    document.querySelectorAll('#asiFeatSection .choice-option').forEach(el => el.classList.remove('selected'));
    radio.closest('.choice-option').classList.add('selected');
  }

  function _onASISingleChange(radio) {
    document.querySelectorAll('#asiSingleSection .choice-option').forEach(el => el.classList.remove('selected'));
    radio.closest('.choice-option').classList.add('selected');
  }

  function _onASISplitChange(checkbox) {
    const checked = document.querySelectorAll('[name="asiSplit"]:checked');
    if (checked.length > 2) {
      checkbox.checked = false;
      showToast('Solo podés elegir 2 atributos');
      return;
    }
    checkbox.closest('.choice-option').classList.toggle('selected', checkbox.checked);
  }

  function _onPickSkillChange(checkbox, max) {
    const checked = document.querySelectorAll('[name="pickSkill"]:checked:not(:disabled)');
    if (checked.length > max) {
      checkbox.checked = false;
      showToast(`Solo podés elegir ${max} skills`);
      return;
    }
    checkbox.closest('.choice-option').classList.toggle('selected', checkbox.checked);
  }

  function _onPickMultipleChange(checkbox, max) {
    const checked = document.querySelectorAll('[name="pickMultiple"]:checked:not(:disabled)');
    if (checked.length > max) {
      checkbox.checked = false;
      showToast(`Solo podés elegir ${max} opciones`);
      return;
    }
    checkbox.closest('.choice-option').classList.toggle('selected', checkbox.checked);
  }

  function _saveChoice() {
    const choice = window._currentChoice;
    if (!choice || !_char) { _processNextChoice(); return; }

    let value = null;

    if (choice.type === 'pick1') {
      const radio = document.querySelector('[name="pick1"]:checked');
      if (!radio) { showToast('Elegí una opción'); return; }
      value = radio.value;
    } else if (choice.type === 'asi') {
      const mode = window._asiMode || 'single';
      if (mode === 'single') {
        const radio = document.querySelector('[name="asiSingle"]:checked');
        if (!radio) { showToast('Elegí un atributo'); return; }
        value = { mode:'single', stat: radio.value };
      } else if (mode === 'split') {
        const checks = Array.from(document.querySelectorAll('[name="asiSplit"]:checked'));
        if (checks.length !== 2) { showToast('Elegí exactamente 2 atributos'); return; }
        value = { mode:'split', stat1: checks[0].value, stat2: checks[1].value };
      } else if (mode === 'feat') {
        const radio = document.querySelector('[name="asiFeat"]:checked');
        if (!radio) { showToast('Elegí un feat'); return; }
        value = { mode:'feat', featId: radio.value };
      }
    } else if (choice.type === 'pickSkills') {
      const checks = Array.from(document.querySelectorAll('[name="pickSkill"]:checked:not(:disabled)'));
      const count = choice.count || 2;
      if (checks.length !== count) { showToast(`Elegí exactamente ${count} skills`); return; }
      value = checks.map(c => c.value);
    } else if (choice.type === 'pickMultiple') {
      const checks = Array.from(document.querySelectorAll('[name="pickMultiple"]:checked:not(:disabled)'));
      const count = choice.count || 1;
      if (checks.length !== count) { showToast(`Elegí exactamente ${count} opción${count > 1 ? 'es' : ''}`); return; }
      value = checks.map(c => c.value);
    }

    if (value !== null) {
      Characters.applyChoice(_char, choice.id, value);
      _saveChar();
    }

    // Cerrar modal y procesar la siguiente elección
    document.getElementById('choiceModalOverlay').style.display = 'none';
    _processNextChoice();
  }

  function _skipChoice() {
    document.getElementById('choiceModalOverlay').style.display = 'none';
    _processNextChoice();
  }

  // Abre una elección puntual (desde botón "Elegir" en feature card)
  function _promptChoice(choiceId) {
    if (!_char) return;
    const claseCfg = Characters.CHOICES_CONFIG[_char.clase] || [];
    const choice = claseCfg.find(c => c.id === choiceId);
    if (!choice) return;
    openChoicesQueue([choice], () => {
      _renderCombateTab();
      _renderHabilidadesTab();
    });
  }

  function setXP(val) {
    const newXP = Math.max(0, val);
    _char.xp = newXP;
    _saveChar();
    // Verificar si subió de nivel
    const newLevel = Characters.getLevelFromXP(newXP);
    if (newLevel > _char.nivel) {
      showToast(`¡Puedes subir al nivel ${newLevel}! Usa "Subir de Nivel".`);
    }
    _renderHabilidadesTab();
  }

  function addXP(inputEl) {
    const gain = parseInt(inputEl.value) || 0;
    if (gain <= 0) return;
    inputEl.value = '';
    setXP((_char.xp || 0) + gain);
    showToast(`+${gain.toLocaleString()} XP`);
  }

  /* ══════════════════════════════════════════════════════
     DESCANSOS
  ══════════════════════════════════════════════════════ */

  function openShortRest() {
    const max = _char.hitDice.current;
    document.getElementById('srMaxDice').textContent = max > 0 ? max : '0 (sin dados)';
    document.getElementById('srDiceQty').max = max;
    document.getElementById('srDiceQty').value = Math.min(1, max);
    document.getElementById('srDiceResult').value = '';
    _updateShortRestPreview();
    document.getElementById('shortRestModal').classList.add('show');
  }

  function srAdjustQty(delta) {
    const input = document.getElementById('srDiceQty');
    const max = _char.hitDice.current;
    input.value = Math.max(0, Math.min(max, (parseInt(input.value) || 0) + delta));
    _updateShortRestPreview();
  }

  function closeShortRest() {
    document.getElementById('shortRestModal').classList.remove('show');
  }

  function _updateShortRestPreview() {
    const qty = parseInt(document.getElementById('srDiceQty').value) || 0;
    const result = parseInt(document.getElementById('srDiceResult').value) || 0;
    const conMod = Characters.calcMod(_char.stats.con);
    const conBonus = conMod * qty;
    const heal = Math.max(0, result + conBonus);
    const die = `d${_char.hitDie || 8}`;

    // Update hint
    const hint = document.getElementById('srDiceHint');
    if (hint) hint.textContent = qty === 0 ? 'Sin dados — solo se recargan recursos.' : `Tira ${qty}${die} y suma los resultados`;

    // Build preview
    let previewHtml = '';
    if (qty === 0) {
      previewHtml = `<span style="color:var(--text-mid);">Se recargarán recursos de descanso corto. Sin curación.</span>`;
    } else {
      const conStr = conMod >= 0 ? `+${conMod}` : `${conMod}`;
      previewHtml = `
        <div class="sr-formula">
          <span class="sr-f-item"><span class="sr-f-label">Dados</span><span class="sr-f-val">${result || '?'}</span></span>
          <span class="sr-f-op">+</span>
          <span class="sr-f-item"><span class="sr-f-label">CON ${conStr} × ${qty}</span><span class="sr-f-val">${conBonus >= 0 ? '+' : ''}${conBonus}</span></span>
          <span class="sr-f-op">=</span>
          <span class="sr-f-item sr-f-total"><span class="sr-f-label">Curación</span><span class="sr-f-val">${result ? heal : '?'} HP</span></span>
        </div>`;
    }
    document.getElementById('srPreview').innerHTML = previewHtml;
  }

  function applyShortRest() {
    const qty = parseInt(document.getElementById('srDiceQty').value) || 0;
    const result = parseInt(document.getElementById('srDiceResult').value) || 0;
    const conMod = Characters.calcMod(_char.stats.con);
    const heal = Math.max(0, result + conMod * qty);

    // Recargar recursos de descanso corto (Rage, Ki, Channel Divinity, etc.)
    (_char.resources || []).forEach(r => {
      if (r.recharge === 'short') r.current = r.max;
    });

    // Brujo: Pact Magic — todos sus spell slots recargan en descanso corto
    const hasWarlock = (_char.classes || []).some(c => c.name === 'Brujo');
    if (hasWarlock) {
      const warlockLevel = ((_char.classes || []).find(c => c.name === 'Brujo') || {}).level || _char.nivel;
      const pactLevel    = Characters.WARLOCK_SLOT_LEVEL
        ? Characters.WARLOCK_SLOT_LEVEL[warlockLevel] || 1
        : (warlockLevel >= 9 ? 5 : warlockLevel >= 7 ? 4 : warlockLevel >= 5 ? 3 : warlockLevel >= 3 ? 2 : 1);
      const pactCount    = (Characters.WARLOCK_SLOTS || {})[warlockLevel]?.[0] || 0;
      if (_char.spellSlots && pactCount > 0) {
        const cur = _char.spellSlots[pactLevel] || { current: 0, max: pactCount };
        _char.spellSlots[pactLevel] = {
          current: Math.min(cur.max, cur.current + pactCount),
          max: cur.max,
        };
      }
    }

    // Consumir dados
    _char.hitDice.current = Math.max(0, _char.hitDice.current - qty);

    // Curar
    if (heal > 0) adjustHP(heal);

    // Reset turno
    _char.turn = { action: false, bonus: false, reaction: false, movement: false };

    _saveChar(true);
    closeShortRest();
    _renderCombateTab();
    _updateCombatHUD();
    _logCombat(`↺ Descanso corto · +${heal} HP`, 'rest');
    // Mensaje: listar qué recursos recargados (máx 2 nombres)
    const recharged = (_char.resources || []).filter(r => r.recharge === 'short' && r.max > 0).map(r => r.name);
    const rechargeLabel = recharged.length
      ? ` · ${recharged.slice(0, 2).join(', ')} recargado${recharged.length > 1 ? 's' : ''}`
      : '';
    showToast(`Descanso corto · +${heal} HP${rechargeLabel}`);
  }

  function longRest() {
    // Build preview of what will be recovered
    const c = _char;
    const hpRecover = c.hp.max - c.hp.current;
    const hdRecover = Math.max(1, Math.ceil(c.hitDice.max / 2));
    const hdNew = Math.min(c.hitDice.max, c.hitDice.current + hdRecover);

    // Slots that will be recovered
    const slotLines = [];
    for (let i = 1; i <= 9; i++) {
      const s = c.spellSlots[i];
      if (s && s.max > 0 && s.current < s.max) {
        slotLines.push(`Nvl ${i}: ${s.current}→${s.max}`);
      }
    }

    // Resources that will recover
    const resLines = c.resources
      .filter(r => r.current < r.max)
      .map(r => `${r.name}: ${r.current}→${r.max}`);

    let summaryHtml = '';
    if (hpRecover > 0)
      summaryHtml += `<div class="lr-row lr-hp"><span class="lr-icon">♥</span><span>HP <strong>${c.hp.current} → ${c.hp.max}</strong>${c.hp.temp > 0 ? ' · tmp eliminados' : ''}</span></div>`;
    else
      summaryHtml += `<div class="lr-row lr-ok"><span class="lr-icon">♥</span><span>HP ya en máximo <strong>${c.hp.max}</strong></span></div>`;

    summaryHtml += `<div class="lr-row"><span class="lr-icon">⬡</span><span>Dados de golpe <strong>${c.hitDice.current} → ${hdNew}</strong> / ${c.hitDice.max}</span></div>`;

    if (slotLines.length)
      summaryHtml += `<div class="lr-row lr-slots"><span class="lr-icon">✦</span><span>Slots: <strong>${slotLines.join(' · ')}</strong></span></div>`;
    else
      summaryHtml += `<div class="lr-row lr-ok"><span class="lr-icon">✦</span><span>Slots ya en máximo</span></div>`;

    if (resLines.length)
      summaryHtml += `<div class="lr-row"><span class="lr-icon">↺</span><span>${resLines.join(' · ')}</span></div>`;

    if (c.conditions && c.conditions.length)
      summaryHtml += `<div class="lr-row lr-cond"><span class="lr-icon">✕</span><span>Condiciones eliminadas</span></div>`;
    if (c.concentration)
      summaryHtml += `<div class="lr-row lr-cond"><span class="lr-icon">◆</span><span>Concentración rota</span></div>`;
    if (c.exhaustion > 0) {
      const newEx = Math.max(0, c.exhaustion - 1);
      summaryHtml += `<div class="lr-row lr-cond"><span class="lr-icon">😴</span><span>Agotamiento ${c.exhaustion} → ${newEx}</span></div>`;
    }

    document.getElementById('lrSummary').innerHTML = summaryHtml;
    document.getElementById('longRestModal').classList.add('show');
  }

  function closeLongRest() {
    document.getElementById('longRestModal').classList.remove('show');
  }

  function applyLongRest() {
    const c = _char;

    // Build result summary for log
    const hpBefore = c.hp.current;
    const hdBefore = c.hitDice.current;
    const slotsBefore = {};
    for (let i = 1; i <= 9; i++) {
      if (c.spellSlots[i] && c.spellSlots[i].max > 0) slotsBefore[i] = c.spellSlots[i].current;
    }

    // Apply rest
    c.resources.forEach(r => { r.current = r.max; });
    for (let i = 1; i <= 9; i++) {
      if (c.spellSlots[i]) c.spellSlots[i].current = c.spellSlots[i].max;
    }
    const hdRecover = Math.max(1, Math.ceil(c.hitDice.max / 2));
    c.hitDice.current = Math.min(c.hitDice.max, c.hitDice.current + hdRecover);
    c.hp.current = c.hp.max;
    c.hp.temp = 0;
    c.turn = { action: false, bonus: false, reaction: false, movement: false };
    c.concentration = null;
    c.conditions = [];
    // Descanso largo reduce exhaustion en 1 (PHB 2024)
    if (c.exhaustion > 0) c.exhaustion = Math.max(0, c.exhaustion - 1);

    closeLongRest();
    _saveChar(true);
    _renderHeader();
    _renderCombateTab();
    _updateCombatHUD();
    _logCombat(`✦ Descanso largo · HP ${hpBefore}→${c.hp.max} · Slots recargados`, 'rest');
    showToast('✦ Descanso largo — Todo recargado');
  }

  /* ══════════════════════════════════════════════════════
     LEVEL UP
  ══════════════════════════════════════════════════════ */

  function openLevelUp() {
    document.getElementById('luNewLevel').value = Math.min(20, _char.nivel + 1);
    document.getElementById('luNewLevel').min = _char.nivel + 1;
    document.getElementById('luHPGained').value = Math.floor(_char.hitDie / 2) + 1;
    _updateLevelUpPreview();
    document.getElementById('levelUpModal').classList.add('show');
  }

  function closeLevelUp() {
    document.getElementById('levelUpModal').classList.remove('show');
  }

  function _updateLevelUpPreview() {
    const newLevel = parseInt(document.getElementById('luNewLevel').value) || _char.nivel + 1;
    const hpGained = parseInt(document.getElementById('luHPGained').value) || 0;
    const newProf = Characters.calcProfBonus(newLevel);
    const oldProf = Characters.calcProfBonus(_char.nivel);
    const newCD = _char.spellcastingStat
      ? 8 + newProf + Characters.calcMod(_char.stats[_char.spellcastingStat])
      : null;

    // Calcular slots usando multiclase (actualizar nivel de clase principal)
    const previewClasses = (_char.classes && _char.classes.length
      ? _char.classes.map((cl, i) => i === 0 ? { ...cl, level: newLevel } : cl)
      : [{ name: _char.clase, level: newLevel, subclass: '' }]);
    const newSlots = Characters.calcMulticlassSlots(previewClasses);
    const slotsStr = Object.entries(newSlots)
      .filter(([, v]) => v.max > 0)
      .map(([k, v]) => `Nvl${k}: ${v.max}`)
      .join(' · ');

    document.getElementById('luPreview').innerHTML =
      `Nivel: <strong>${_char.nivel} → ${newLevel}</strong><br>
       Prof Bonus: <strong>+${oldProf} → +${newProf}</strong>
       ${newCD ? `· CD Conjuros: <strong>${newCD}</strong>` : ''}<br>
       HP: <strong>+${hpGained} (${_char.hp.max} → ${_char.hp.max + hpGained})</strong><br>
       Spell Slots: <strong>${slotsStr || 'Sin cambios'}</strong>`;
  }

  function applyLevelUp() {
    const newLevel = parseInt(document.getElementById('luNewLevel').value);
    const hpGained = parseInt(document.getElementById('luHPGained').value) || 0;
    if (newLevel <= _char.nivel) { showToast('El nivel debe ser mayor al actual'); return; }

    const oldLevel = _char.nivel;
    Characters.applyLevelUp(_char, newLevel, hpGained);
    _saveChar();
    closeLevelUp();
    _renderHeader();
    _renderCombateTab();
    _renderHabilidadesTab();
    showToast(`¡Nivel ${newLevel}! ✦`);

    // Calcular features nuevas (las que corresponden a niveles entre oldLevel+1 y newLevel)
    const newFeatures = _getNewFeaturesForLevel(oldLevel, newLevel);

    // Disparar elecciones pendientes, y al final mostrar novedades
    const pending = Characters.getPendingChoices(_char, newLevel);
    const afterChoices = () => {
      _renderCombateTab();
      _renderHabilidadesTab();
      if (newFeatures.length > 0) _showLevelUpNews(newLevel, newFeatures);
    };
    if (pending.length > 0) {
      openChoicesQueue(pending, afterChoices);
    } else {
      afterChoices();
    }
  }

  // Devuelve las features que se ganan al pasar de oldLevel a newLevel
  function _getNewFeaturesForLevel(oldLevel, newLevel) {
    const claseCfg = Characters.CLASE_FEATURES[_char.clase];
    if (!claseCfg) return [];
    const allNew  = claseCfg.features(newLevel);
    const allOld  = claseCfg.features(oldLevel);
    const oldIds  = new Set(allOld.map(f => f.id));
    const classFeatures = allNew.filter(f => !oldIds.has(f.id));

    // Features de subclase también
    let subFeatures = [];
    if (_char.subclase) {
      const subCfg = Characters.SUBCLASES_CONFIG && Characters.SUBCLASES_CONFIG[_char.subclase];
      if (subCfg && typeof subCfg.features === 'function') {
        const subNew = subCfg.features(newLevel);
        const subOld = subCfg.features(oldLevel);
        const subOldIds = new Set(subOld.map(f => f.id));
        subFeatures = subNew.filter(f => !subOldIds.has(f.id));
      }
    }

    return [...classFeatures, ...subFeatures];
  }

  // Modal de novedades al subir de nivel
  function _showLevelUpNews(newLevel, features) {
    let overlay = document.getElementById('levelUpNewsOverlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'levelUpNewsOverlay';
      overlay.className = 'modal-overlay';
      overlay.style.cssText = 'display:flex;align-items:flex-start;overflow-y:auto;z-index:1200;';
      overlay.innerHTML = `
        <div class="modal" style="max-width:480px;max-height:85vh;overflow-y:auto;">
          <div class="modal-header">
            <span id="levelUpNewsTitle"></span>
          </div>
          <div class="modal-body" id="levelUpNewsBody"></div>
          <div class="modal-footer">
            <button class="btn-primary" onclick="document.getElementById('levelUpNewsOverlay').style.display='none'">¡Entendido!</button>
          </div>
        </div>`;
      document.body.appendChild(overlay);
    }

    document.getElementById('levelUpNewsTitle').textContent = `✦ Nivel ${newLevel} — Novedades`;
    document.getElementById('levelUpNewsBody').innerHTML = features.map(f => `
      <div style="margin-bottom:14px;padding:10px 12px;background:var(--surface2,rgba(255,255,255,0.05));border-radius:8px;border-left:3px solid var(--accent,#c9a84c);">
        <div style="font-weight:700;font-size:14px;margin-bottom:4px;">${f.name}</div>
        <div style="font-size:11px;color:var(--text-dim);margin-bottom:6px;">${f.source || ''}</div>
        <div style="font-size:13px;line-height:1.5;">${f.desc || ''}</div>
      </div>
    `).join('');

    overlay.style.display = 'flex';
  }

  /* ══════════════════════════════════════════════════════
     DIARIO
  ══════════════════════════════════════════════════════ */

  function toggleDiary() {
    toggleNotebook();
  }

  const _DIARY_CAT_EMOJI = { combate:'🗡️', lugar:'📍', historia:'📖', npc:'🧑', nota:'💡', item:'🎒', quest:'⚔️', '':'📝' };
  const _DIARY_CAT_COLOR = {
    combate:  'rgba(200,80,80,0.18)',
    lugar:    'rgba(80,160,200,0.18)',
    historia: 'rgba(180,120,60,0.18)',
    npc:      'rgba(140,100,200,0.18)',
    nota:     'rgba(80,180,120,0.18)',
    item:     'rgba(201,151,58,0.18)',
    quest:    'rgba(220,140,40,0.18)',
    '':       'transparent',
  };

  // Shortcuts /xxx → categoría
  const _DIARY_SHORTCUTS = {
    '/npc':      'npc',
    '/mapa':     'lugar',
    '/map':      'lugar',
    '/lugar':    'lugar',
    '/combate':  'combate',
    '/batalla':  'combate',
    '/historia': 'historia',
    '/lore':     'historia',
    '/nota':     'nota',
    '/note':     'nota',
    '/item':     'item',
    '/objeto':   'item',
    '/quest':    'quest',
    '/misión':   'quest',
    '/mision':   'quest',
  };

  function _renderDiaryEntries() {
    let entries = (_char.diary || []).slice(); // cronológico, más antiguo primero

    // Filtrar por categoría
    if (_diaryCatFilter) {
      entries = entries.filter(e => (e.cat || '') === _diaryCatFilter);
    }
    // Filtrar por búsqueda
    if (_diarySearch) {
      const q = _diarySearch.toLowerCase();
      entries = entries.filter(e => e.text.toLowerCase().includes(q));
    }

    const container = document.getElementById('diaryEntries');
    if (!container) return;

    if ((_char.diary || []).length === 0) {
      container.innerHTML = `<div class="empty-state"><div class="es-icon">📓</div><div class="es-title">Sin notas aún</div><div class="es-text">Escribe algo y presiona Enter para guardar.</div></div>`;
      return;
    }
    if (entries.length === 0) {
      container.innerHTML = `<div class="empty-state"><div class="es-icon">🔍</div><div class="es-title">Sin resultados</div><div class="es-text">Prueba con otro filtro o búsqueda.</div></div>`;
      return;
    }

    let html = '';
    let lastDay = '';
    entries.forEach(e => {
      const d = new Date(e.timestamp);
      const day = d.toLocaleDateString('es', { weekday:'long', day:'2-digit', month:'long', year:'numeric' });
      const time = d.toLocaleTimeString('es', { hour:'2-digit', minute:'2-digit' });
      if (day !== lastDay) {
        html += `<div class="diary-day-sep"><span>${day}</span></div>`;
        lastDay = day;
      }
      const cat   = e.cat || '';
      const emoji = _DIARY_CAT_EMOJI[cat] || '📝';
      const catBg = _DIARY_CAT_COLOR[cat]  || 'transparent';
      const catTag = cat
        ? `<span class="diary-cat-tag" style="background:${catBg}">${emoji} ${cat}</span>`
        : '';

      // Highlight búsqueda
      let textHtml = e.text.replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br>');
      if (_diarySearch) {
        const re = new RegExp(`(${_diarySearch.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')})`, 'gi');
        textHtml = textHtml.replace(re, '<mark class="diary-highlight">$1</mark>');
      }

      html += `<div class="diary-bubble" data-id="${e.id}" style="${catBg !== 'transparent' ? `border-left:3px solid ${catBg.replace('0.18','0.6')}` : ''}">
        ${catTag}
        <div class="diary-bubble-text">${textHtml}</div>
        <div class="diary-bubble-meta">
          <span class="diary-bubble-time">${time}</span>
          <button class="diary-del-btn" onclick="App.deleteDiaryEntry('${e.id}')">✕</button>
        </div>
      </div>`;
    });
    container.innerHTML = html;
    // Auto-scroll al fondo (más reciente) solo si no hay filtros activos
    if (!_diaryCatFilter && !_diarySearch) container.scrollTop = container.scrollHeight;
  }

  function onDiaryInput(el) {
    // Auto-resize
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';

    // Detectar shortcut al inicio del texto
    const val = el.value;
    const hint = document.getElementById('diaryShortcutHint');
    const matched = Object.keys(_DIARY_SHORTCUTS).find(k => val.toLowerCase().startsWith(k + ' ') || val.toLowerCase() === k);
    if (matched) {
      const cat = _DIARY_SHORTCUTS[matched];
      const emoji = _DIARY_CAT_EMOJI[cat] || '📝';
      // Activar categoría visualmente
      document.querySelectorAll('.diary-new-cat-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.cat === cat);
      });
      _newDiaryCat = cat;
      if (hint) {
        hint.textContent = `${emoji} Categoría: ${cat}  —  borra "${matched}" o escribe el resto`;
        hint.style.display = 'block';
      }
    } else {
      if (hint) hint.style.display = 'none';
    }
  }

  function addDiaryEntry() {
    const textarea = document.getElementById('diaryInput');
    let text = textarea.value.trim();
    if (!text) return;

    // Remover shortcut del inicio si lo hay
    const matched = Object.keys(_DIARY_SHORTCUTS).find(k => text.toLowerCase().startsWith(k + ' ') || text.toLowerCase() === k);
    if (matched) {
      text = text.slice(matched.length).trimStart();
      // Si solo pusieron el shortcut sin texto, no guardar
      if (!text) { showToast('Escribe algo después del shortcut'); return; }
    }

    const entry = {
      id: 'e-' + Date.now(),
      timestamp: new Date().toISOString(),
      text,
      cat: _newDiaryCat || '',
    };

    if (!_char.diary) _char.diary = [];
    _char.diary.push(entry);
    _saveChar();
    textarea.value = '';
    textarea.style.height = 'auto';
    // Resetear categoría y hint
    const hint = document.getElementById('diaryShortcutHint');
    if (hint) hint.style.display = 'none';
    _newDiaryCat = '';
    document.querySelectorAll('.diary-new-cat-btn').forEach(b => b.classList.toggle('active', b.dataset.cat === ''));
    _renderDiaryEntries();
  }

  function filterDiarySearch(query) {
    _diarySearch = query.trim();
    _renderDiaryEntries();
  }

  function selectDiaryCat(el, cat) {
    _diaryCatFilter = cat;
    document.querySelectorAll('#diaryCatBar .diary-cat-chip').forEach(c => c.classList.remove('active'));
    el.classList.add('active');
    _renderDiaryEntries();
  }

  function setNewDiaryCat(el, cat) {
    _newDiaryCat = cat;
    document.querySelectorAll('.diary-new-cat-btn').forEach(c => c.classList.remove('active'));
    el.classList.add('active');
  }

  function deleteDiaryEntry(id) {
    if (!_char.diary) return;
    _confirm('¿Eliminar esta nota?', () => {
      _char.diary = _char.diary.filter(e => e.id !== id);
      _saveChar();
      _renderDiaryEntries();
    });
  }

  function filterDiary() { /* no-op, kept for compat */ }

  /* ══════════════════════════════════════════════════════
     NOTA RÁPIDA (FAB)
  ══════════════════════════════════════════════════════ */
  let _qnCat = '';

  function openQuickNote() {
    _qnCat = '';
    const modal = document.getElementById('quickNoteModal');
    const backdrop = document.getElementById('qnBackdrop');
    const input = document.getElementById('qnInput');
    const hint = document.getElementById('qnHint');
    if (!modal) return;
    // Reset estado
    input.value = '';
    input.style.height = 'auto';
    if (hint) hint.style.display = 'none';
    document.querySelectorAll('.qn-cat').forEach(b => b.classList.toggle('active', b.dataset.cat === ''));
    modal.classList.add('show');
    if (backdrop) backdrop.classList.add('show');
    setTimeout(() => input.focus(), 80);
  }

  function closeQuickNote() {
    const modal = document.getElementById('quickNoteModal');
    const backdrop = document.getElementById('qnBackdrop');
    if (modal) modal.classList.remove('show');
    if (backdrop) backdrop.classList.remove('show');
  }

  function setQNCat(el, cat) {
    _qnCat = cat;
    document.querySelectorAll('.qn-cat').forEach(b => b.classList.toggle('active', b.dataset.cat === cat));
  }

  function onQNInput(el) {
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 160) + 'px';
    // Reusar la misma lógica de shortcuts del diario
    const val = el.value;
    const hint = document.getElementById('qnHint');
    const matched = Object.keys(_DIARY_SHORTCUTS).find(k => val.toLowerCase().startsWith(k + ' ') || val.toLowerCase() === k);
    if (matched) {
      const cat = _DIARY_SHORTCUTS[matched];
      const emoji = _DIARY_CAT_EMOJI[cat] || '📝';
      document.querySelectorAll('.qn-cat').forEach(b => b.classList.toggle('active', b.dataset.cat === cat));
      _qnCat = cat;
      if (hint) { hint.textContent = `${emoji} ${cat}`; hint.style.display = 'block'; }
    } else {
      if (hint) hint.style.display = 'none';
    }
  }

  function saveQuickNote() {
    const input = document.getElementById('qnInput');
    if (!input) return;
    let text = input.value.trim();
    if (!text) return;
    // Remover shortcut del inicio
    const matched = Object.keys(_DIARY_SHORTCUTS).find(k => text.toLowerCase().startsWith(k + ' ') || text.toLowerCase() === k);
    if (matched) {
      text = text.slice(matched.length).trimStart();
      if (!text) { showToast('Escribe algo después del shortcut'); return; }
    }
    if (!_char.diary) _char.diary = [];
    _char.diary.push({
      id: 'e-' + Date.now(),
      timestamp: new Date().toISOString(),
      text,
      cat: _qnCat || '',
    });
    _saveChar();
    closeQuickNote();
    const emoji = _DIARY_CAT_EMOJI[_qnCat] || '📝';
    showToast(`${emoji} Nota guardada`);
  }

  /* ── Stats de Campaña ── */
  function _renderCampaignStats() {
    const panel = document.getElementById('statsPanel');
    if (!panel || !_char) return;

    const c = _char;
    const diary   = c.diary   || [];
    const log     = _combatLog;
    const spells  = c.spells  || [];
    const weapons = c.weapons || [];

    // Días desde creación
    const created  = new Date(c.createdAt || Date.now());
    const now      = new Date();
    const daysSince = Math.floor((now - created) / (1000 * 60 * 60 * 24));

    // Entradas de diario por categoría
    const catCounts = { combate:0, lugar:0, historia:0, npc:0, nota:0, '':0 };
    diary.forEach(e => { catCounts[e.cat || '']++; });

    // Hechizos más lanzados (desde el combat log)
    const spellUsage = {};
    log.forEach(e => {
      if (e.type === 'spell' && e.text) {
        const match = e.text.match(/🔮\s+(.+?)\s+\(/);
        if (match) spellUsage[match[1]] = (spellUsage[match[1]] || 0) + 1;
      }
    });
    const topSpells = Object.entries(spellUsage).sort((a,b) => b[1]-a[1]).slice(0, 3);

    // HP total perdido (desde log)
    let totalDmg = 0;
    log.forEach(e => {
      if (e.type === 'damage') {
        const m = e.text.match(/−(\d+)/);
        if (m) totalDmg += parseInt(m[1]);
      }
    });

    // HP total curado
    let totalHeal = 0;
    log.forEach(e => {
      if (e.type === 'heal') {
        const m = e.text.match(/\+(\d+)/);
        if (m) totalHeal += parseInt(m[1]);
      }
    });

    // Slots gastados (estimado desde log)
    let slotsUsed = 0;
    log.forEach(e => { if (e.type === 'spell') slotsUsed++; });

    // Recursos usados
    let resourcesUsed = 0;
    log.forEach(e => { if (e.type === 'resource') resourcesUsed++; });

    // Rounds de combate jugados (aprox)
    const combatRounds = Math.max(_combatRound, 0);

    const totalNotes = diary.length;

    // Construir HTML
    const statCard = (icon, label, value, sub='') => `
      <div class="cs-card">
        <div class="cs-icon">${icon}</div>
        <div class="cs-body">
          <div class="cs-value">${value}</div>
          <div class="cs-label">${label}</div>
          ${sub ? `<div class="cs-sub">${sub}</div>` : ''}
        </div>
      </div>`;

    let html = `<div class="cs-section-title">Aventura</div>
    <div class="cs-grid">
      ${statCard('📅', 'Días aventurando', daysSince > 0 ? daysSince : '< 1')}
      ${statCard('📓', 'Notas totales', totalNotes, totalNotes > 0 ? `${catCounts.combate} combate · ${catCounts.historia} historia · ${catCounts.lugar} lugar` : '')}
      ${statCard('⚔️', 'Rounds de combate', combatRounds)}
    </div>`;

    html += `<div class="cs-section-title">Combate</div>
    <div class="cs-grid">
      ${statCard('💔', 'Daño recibido', totalDmg > 0 ? totalDmg + ' HP' : '0 HP')}
      ${statCard('💚', 'Curación total', totalHeal > 0 ? '+' + totalHeal + ' HP' : '—')}
      ${statCard('✨', 'Slots usados', slotsUsed > 0 ? slotsUsed : '0')}
      ${statCard('⚡', 'Recursos usados', resourcesUsed > 0 ? resourcesUsed : '0')}
    </div>`;

    if (topSpells.length > 0) {
      html += `<div class="cs-section-title">Hechizos más usados</div>
      <div class="cs-spell-list">
        ${topSpells.map(([name, count], i) =>
          `<div class="cs-spell-row">
            <span class="cs-spell-rank">#${i+1}</span>
            <span class="cs-spell-name">${name}</span>
            <span class="cs-spell-count">${count}×</span>
          </div>`).join('')}
      </div>`;
    }

    // Distribución del diario por categoría
    if (totalNotes > 0) {
      const cats = [
        { key:'combate',  emoji:'🗡️', label:'Combate' },
        { key:'historia', emoji:'📖', label:'Historia' },
        { key:'lugar',    emoji:'📍', label:'Lugar' },
        { key:'npc',      emoji:'🧑', label:'NPC' },
        { key:'nota',     emoji:'💡', label:'Notas' },
        { key:'',         emoji:'📝', label:'Sin categoría' },
      ].filter(c => catCounts[c.key] > 0);

      if (cats.length > 0) {
        html += `<div class="cs-section-title">Diario por categoría</div>
        <div class="cs-cat-dist">
          ${cats.map(c => `
            <div class="cs-cat-row">
              <span class="cs-cat-emoji">${c.emoji}</span>
              <span class="cs-cat-label">${c.label}</span>
              <div class="cs-cat-bar-wrap">
                <div class="cs-cat-bar-fill" style="width:${Math.round(catCounts[c.key]/totalNotes*100)}%"></div>
              </div>
              <span class="cs-cat-num">${catCounts[c.key]}</span>
            </div>`).join('')}
        </div>`;
      }
    }

    if (totalDmg === 0 && slotsUsed === 0 && totalNotes === 0) {
      html = `<div class="empty-state" style="margin-top:40px;">
        <div class="es-icon">📊</div>
        <div class="es-title">Sin datos aún</div>
        <div class="es-text">Las estadísticas se acumularán a medida que juegues.</div>
      </div>`;
    }

    panel.innerHTML = html;
  }

  function exportDiary() {
    Storage.exportDiaryTxt(_char);
    showToast('Diario exportado');
  }

  /* ══════════════════════════════════════════════════════
     PANEL IFTTT
  ══════════════════════════════════════════════════════ */

  function openIfttt() {
    _iftttOpen = true;
    _renderIftttBody();
    document.getElementById('iftttOverlay').classList.add('open');
    document.getElementById('overlayBackdrop').classList.add('show');
  }

  function closeIfttt() {
    _iftttOpen = false;
    document.getElementById('iftttOverlay').classList.remove('open');
    document.getElementById('overlayBackdrop').classList.toggle('show', _diaryOpen);
  }

  /* ══════════════════════════════════════════════════════
     MODAL DETALLE SPELL
  ══════════════════════════════════════════════════════ */

  function openSpellDetail(spellId) {
    const sp = (_char.spells || []).find(s => s.id === spellId);
    if (!sp) return;

    const levelLabel = sp.level === 0 ? 'Truco' : `Nivel ${sp.level}`;
    const badgeClass = sp.domain ? 'sdm-badge-dom' : sp.mi ? 'sdm-badge-mi' : sp.level === 0 ? 'sdm-badge-cantrip' : 'sdm-badge-spell';

    document.getElementById('sdmBadge').textContent = levelLabel;
    document.getElementById('sdmBadge').className = `sdm-level-badge ${badgeClass}`;
    document.getElementById('sdmName').textContent = sp.name.replace(/\s*[◆†]/g, '');
    document.getElementById('sdmCastTime').textContent = sp.castTime || '—';
    document.getElementById('sdmDuration').textContent = sp.duration || '—';
    document.getElementById('sdmRange').textContent = sp.range || '—';

    const damageWrap = document.getElementById('sdmDamageWrap');
    if (sp.damage) {
      document.getElementById('sdmDamage').textContent = sp.damage;
      damageWrap.style.display = '';
    } else {
      damageWrap.style.display = 'none';
    }

    document.getElementById('sdmDesc').textContent = sp.fullDesc || sp.desc || '';

    const upcastWrap = document.getElementById('sdmUpcastWrap');
    if (sp.upcast) {
      document.getElementById('sdmUpcast').textContent = sp.upcast;
      upcastWrap.style.display = '';
    } else {
      upcastWrap.style.display = 'none';
    }

    // "Lanzar" button — show for castable spells, hide for cantrips cast-from-combat-tab
    const castBtn = document.getElementById('sdmCastBtn');
    if (castBtn) {
      castBtn.style.display = '';
      castBtn.onclick = () => { closeSpellDetail(); castSpell(sp.id); };
    }

    _spellDetailOpen = true;
    document.getElementById('spellDetailModal').classList.add('show');
    document.getElementById('overlayBackdrop').classList.add('show');
  }

  function closeSpellDetail() {
    _spellDetailOpen = false;
    document.getElementById('spellDetailModal').classList.remove('show');
    document.getElementById('overlayBackdrop').classList.toggle('show', _diaryOpen || _iftttOpen);
  }

  /* ── Feature Detail Modal ── */
  function openFeatureDetail(featId) {
    const f = (_char.features || []).find(f => f.id === featId);
    if (!f) return;

    const badge = f.type === 'passive'
      ? `<span class="feat-badge feat-passive" style="font-size:11px;padding:2px 8px;">Pasiva</span>`
      : `<span class="feat-badge feat-active" style="font-size:11px;padding:2px 8px;">Activa</span>`;

    document.getElementById('fdmBadge').innerHTML = badge;
    document.getElementById('fdmName').textContent = f.name;
    document.getElementById('fdmSource').textContent = f.source;

    // Stats row: Acción + Distancia + Recarga
    let statsHtml = '';
    if (f.action) statsHtml += `<div class="fdm-stat"><div class="fdm-stat-label">Acción</div><div class="fdm-stat-val">${f.action}</div></div>`;
    if (f.range)  statsHtml += `<div class="fdm-stat"><div class="fdm-stat-label">Distancia</div><div class="fdm-stat-val">${f.range}</div></div>`;
    if (f.recharge) statsHtml += `<div class="fdm-stat"><div class="fdm-stat-label">Recarga</div><div class="fdm-stat-val">↺ ${f.recharge}</div></div>`;
    document.getElementById('fdmStatsRow').innerHTML = statsHtml;

    document.getElementById('fdmSummary').textContent = f.desc;
    // fullDesc with newlines rendered as <br><br>
    document.getElementById('fdmFull').innerHTML = (f.fullDesc || '')
      .replace(/</g,'&lt;').replace(/>/g,'&gt;')
      .replace(/\n\n/g,'</p><p>').replace(/\n/g,'<br>');
    document.getElementById('fdmFull').innerHTML =
      '<p>' + document.getElementById('fdmFull').innerHTML + '</p>';

    document.getElementById('featureDetailModal').classList.add('show');
  }

  function closeFeatureDetail() {
    document.getElementById('featureDetailModal').classList.remove('show');
  }

  function _renderIftttBody() {
    const ifttt = _char.ifttt || [];
    const sections = [...new Set(ifttt.map(i => i.section))];
    let html = '';

    const _tagLabel = t => {
      if (t === 'siempre') return 'Siempre';
      if (t === 'tip')     return 'Tip';
      if (t === 'feat')    return 'Feat';
      if (t === 'subclase') return 'Subclase';
      return 'Si';
    };

    sections.forEach(sec => {
      html += `<div class="section-divider">${_esc(sec)}</div>`;
      ifttt.filter(i => i.section === sec).forEach((item, _idx) => {
        const idx = ifttt.indexOf(item);
        html += `
        <div class="ifttt-item">
          <span class="if-tag ${item.tag || 'si'}">${_tagLabel(item.tag)}</span>
          <span class="ifttt-text">
            <em style="color:var(--text-mid);font-style:normal;">${_esc(item.trigger)}</em>
            ${item.trigger ? ' → ' : ''}${_esc(item.action)}
          </span>
          <span class="ifttt-item-actions">
            <button class="ifttt-edit-btn" onclick="App.openIftttForm(${idx})" title="Editar">✎</button>
            <button class="ifttt-del-btn"  onclick="App.deleteIftttEntry(${idx})" title="Eliminar">✕</button>
          </span>
        </div>`;
      });
    });

    if (!html) html = `<div class="ifttt-empty">No hay entradas todavía. Pulsa <strong>＋</strong> para agregar tips, feats o reglas de combate.</div>`;
    document.getElementById('iftttBody').innerHTML = html;
  }

  let _iftttEditIdx = null; // null = nueva entrada

  function openIftttForm(idx) {
    _iftttEditIdx = (idx !== undefined) ? idx : null;
    const entry = (idx !== undefined) ? (_char.ifttt || [])[idx] : null;
    document.getElementById('iftttFormTitle').textContent = entry ? 'Editar entrada' : 'Nueva entrada';
    document.getElementById('ifSection').value = entry ? (entry.section || '') : '';
    document.getElementById('ifTrigger').value = entry ? (entry.trigger || '') : '';
    document.getElementById('ifAction').value  = entry ? (entry.action  || '') : '';
    // Tag buttons
    const tag = entry ? (entry.tag || 'siempre') : 'siempre';
    document.querySelectorAll('#ifTagGroup .if-tag-btn').forEach(b => {
      b.classList.toggle('selected', b.dataset.tag === tag);
    });
    document.getElementById('iftttFormModal').classList.add('show');
  }

  function closeIftttForm() {
    document.getElementById('iftttFormModal').classList.remove('show');
    _iftttEditIdx = null;
  }

  function selectIftttTag(el) {
    document.querySelectorAll('#ifTagGroup .if-tag-btn').forEach(b => b.classList.remove('selected'));
    el.classList.add('selected');
  }

  function saveIftttForm() {
    const section = document.getElementById('ifSection').value.trim();
    const trigger = document.getElementById('ifTrigger').value.trim();
    const action  = document.getElementById('ifAction').value.trim();
    const tagBtn  = document.querySelector('#ifTagGroup .if-tag-btn.selected');
    const tag     = tagBtn ? tagBtn.dataset.tag : 'siempre';

    if (!action) { document.getElementById('ifAction').focus(); return; }
    if (!section) { document.getElementById('ifSection').focus(); return; }

    if (!_char.ifttt) _char.ifttt = [];
    const entry = { section, trigger, action, tag };

    if (_iftttEditIdx !== null && _iftttEditIdx >= 0) {
      _char.ifttt[_iftttEditIdx] = entry;
    } else {
      _char.ifttt.push(entry);
    }
    _saveChar();
    closeIftttForm();
    _renderIftttBody();
    showToast((_iftttEditIdx !== null) ? 'Entrada actualizada' : 'Entrada agregada');
  }

  function deleteIftttEntry(idx) {
    if (!_char.ifttt || idx < 0 || idx >= _char.ifttt.length) return;
    _char.ifttt.splice(idx, 1);
    _saveChar();
    _renderIftttBody();
    showToast('Entrada eliminada');
  }

  function _esc(str) {
    return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function closeAllOverlays() {
    if (_notebookOpen) toggleNotebook();
    if (_iftttOpen) closeIfttt();
    if (_spellDetailOpen) closeSpellDetail();
  }

  /* ══════════════════════════════════════════════════════
     CONFIRM MODAL
  ══════════════════════════════════════════════════════ */

  let _confirmCallback = null;

  function _confirm(msg, onOk) {
    _confirmCallback = onOk;
    document.getElementById('confirmMsg').textContent = msg;
    document.getElementById('confirmOkBtn').onclick = () => { closeConfirm(); onOk(); };
    document.getElementById('confirmModal').classList.add('show');
  }

  function closeConfirm() {
    document.getElementById('confirmModal').classList.remove('show');
    _confirmCallback = null;
  }

  /* ══════════════════════════════════════════════════════
     BACKUP
  ══════════════════════════════════════════════════════ */

  function doBackup() {
    const ok = Storage.exportJSON();
    if (ok) {
      _updateBackupBtn();
      showToast('Backup guardado ☁');
    } else {
      showToast('Error al exportar backup');
    }
  }

  async function exportCharForPDF() {
    if (!_char) { showToast('No hay personaje activo'); return; }
    if (typeof ExportPDF === 'undefined') {
      showToast('Módulo PDF no cargado, intentá de nuevo');
      return;
    }
    showToast('Generando PDF…');
    try {
      await ExportPDF.downloadPDF(_char);
      showToast('PDF descargado');
    } catch (e) {
      console.error('PDF export error:', e);
      showToast('Error generando PDF: ' + e.message);
    }
  }

  function importBackup(input) {
    const file = input.files[0];
    if (!file) return;
    Storage.importJSON(file,
      count => {
        input.value = '';
        _char = Storage.getActiveChar();
        _refreshCharFeatures(_char);
        _populateCharSelector();
        _renderHeader();
        _renderActiveTab();
        showToast(`✓ ${count} personaje(s) importado(s)`);
      },
      err => {
        showToast('Error al importar: ' + err);
        input.value = '';
      }
    );
  }

  /* ══════════════════════════════════════════════════════
     CAMBIAR PERSONAJE
  ══════════════════════════════════════════════════════ */

  function switchChar(id) {
    if (!id || id === _char.id) return;
    _saveChar();
    Storage.setActiveId(id);
    _char = Storage.getActiveChar();
    _refreshCharFeatures(_char);
    _renderHeader();
    _renderActiveTab();
    showToast(`Personaje: ${_char.name}`);
  }

  /* ══════════════════════════════════════════════════════
     TOAST
  ══════════════════════════════════════════════════════ */

  function showToast(msg) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(_toastTimer);
    _toastTimer = setTimeout(() => t.classList.remove('show'), 2400);
  }

  /* ══════════════════════════════════════════════════════
     EXPORTS
  ══════════════════════════════════════════════════════ */

  return {
    init,
    switchTab,
    switchChar,

    // HP
    setHP, adjustHP, applyFreeHP, applyFreeHPAs, healFull, setHPMax,
    setTempHP, adjustTempHP, promptTempHP,
    setBonus, toggleShield, openArmorPicker, closeArmorPicker, selectArmorType,

    // Turn & Rounds
    toggleTurn, endTurn,
    startCombat, nextCombatTurn, nextCombatRound, resetCombat,
    addEnemy, moveEnemy, toggleEnemyBleeding, removeEnemy, editEnemyAC, _saveEnemyAC,
    _etDragStart, _etDragOver, _etDrop, _etDragEnd,
    addCombatant, removeCombatant, cycleCombatantStatus,
    editCombatantInit, setCombatantInit, setCombatantAC, editCombatantHP, setActiveTurn,
    _itDragStart, _itDragOver, _itDrop, _itDragEnd,

    // Concentración
    setConc, closeConcAlert,

    // Tiradas de muerte
    toggleDeathSave, resetDeathSaves,

    // Recursos
    adjustResource, toggleResourceDot, adjustSlot, toggleSlotDot, adjustHitDice, toggleHitDieDot,
    openCustomResource, closeCustomResource, saveCustomResource, deleteResource,

    // Condiciones
    toggleCondition, clearConditions,
    adjustExhaustion, setExhaustion,
    toggleInspiration,

    // Conjuros
    toggleSpellPrepared, removeKnownSpell, addKnownSpell, clearAllKnownSpells, setSpellFilter,
    castSpell, confirmCastAtLevel, closeCastPicker,
    openCantripPicker, closeCantripPicker, saveCantripPicker, _onCantripCheck,

    // Equipo
    addWeapon, openAddWeapon, openEditWeapon, closeAddWeapon, saveAddWeapon, deleteWeapon,
    openAddItem, openEditItem, closeAddItem, saveAddItem, toggleContainerBtn,
    adjustConsumable, deleteConsumable, addConsumable, refillContainer,
    setCurrency, setAttunement,
    addMagicItem, deleteMagicItem,
    setNotes, setSpeciesTraits,

    // Habilidades
    editStat, openEditStats, saveEditStats, closeEditStats, toggleSkillProf, toggleSavingThrow, setVelocidad, setXP, addXP,

    // Companion (Beast Master)
    setCompanionBeast, clearCompanionBeast, setCompanionHP,

    // Subclase
    openSubclaseModal, _selectSubclaseChip, _toggleManeuver, saveSubclase, closeSubclaseModal,

    // Elecciones de personaje
    openChoicesQueue, _processNextChoice, _saveChoice, _skipChoice, _promptChoice,
    _onPick1Change, _setASIMode, _onASISingleChange, _onASISplitChange, _onASIFeatChange, _onPickSkillChange, _onPickMultipleChange, _renderPickMultiple,

    // Descansos
    openShortRest, closeShortRest, applyShortRest, srAdjustQty,
    longRest, closeLongRest, applyLongRest,

    // Level up
    openLevelUp, closeLevelUp, applyLevelUp,

    // Notebook (diario + log + stats)
    toggleNotebook, switchNotebookTab,
    toggleDiary, addDiaryEntry, onDiaryInput, deleteDiaryEntry, filterDiary, exportDiary,
    openQuickNote, closeQuickNote, setQNCat, onQNInput, saveQuickNote,
    filterDiarySearch, selectDiaryCat, setNewDiaryCat,
    toggleCombatLog, clearCombatLog, exportCombatLog,

    // IFTTT
    openIfttt, closeIfttt, openIftttForm, closeIftttForm,
    selectIftttTag, saveIftttForm, deleteIftttEntry,
    closeAllOverlays, closeConfirm,

    // Detalle spell
    openSpellDetail, closeSpellDetail,
    openFeatureDetail, closeFeatureDetail,

    // Monedas
    addCoin, consolidateCurrency,

    // Backup / Export
    doBackup, importBackup, exportCharForPDF,

    // Toast
    showToast,

    // Header menu
    toggleHeaderMenu, closeHeaderMenu,

    // Cloud / Undo
    undoLastChange, toggleTheme,
    reloadChar(char) {
      _char = char || Storage.getActiveChar();
      if (_char && _char.id !== 'lursey-brumaclara') {
        const before = JSON.stringify(_char.features);
        _refreshCharFeatures(_char);
        const after = JSON.stringify(_char.features);
        if (before !== after) {
          // Features cambiaron — guardar localmente y subir a Firestore
          // para que la próxima sync ya traiga datos limpios
          Storage.saveCharRaw(_char);
          if (window.Cloud && Cloud.isLoggedIn()) Cloud.saveNow(_char);
        }
      }
      if (_char) {
        _renderHeader();
        _renderActiveTab();
        _updateTempHPDisplay();
        _populateCharSelector();
        _updateCombatHUD();
      }
    },
  };
})();

// INICIO
document.addEventListener('DOMContentLoaded', App.init);
