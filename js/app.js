/* ═══════════════════════════════════════════════════════
   app.js — Lógica principal de la app
   Depende de: storage.js, characters.js
   Singleton global: App
   ═══════════════════════════════════════════════════════ */

const App = (() => {

  let _char = null;         // personaje activo en memoria
  let _activeTab = 'combate';
  let _toastTimer = null;
  let _concAlertTimer = null;
  let _diaryOpen = false;
  let _iftttOpen = false;
  let _spellDetailOpen = false;

  // Combat round tracker (session-only, not persisted)
  let _combatRound = 0;
  let _combatTurn  = 0;   // turn counter within the current round
  let _combatActive = false;

  // HP history for smart chips (last 5 non-zero deltas)
  let _hpHistory = [];

  /* ── Undo stack (hasta 5 snapshots) ── */
  const UNDO_MAX = 5;
  let _undoStack = [];
  let _undoBtn   = null;

  /* ══════════════════════════════════════════════════════
     INICIALIZACIÓN
  ══════════════════════════════════════════════════════ */

  function init() {
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

    // Sincronizar datos maestros desde characters.js (spells/ifttt)
    // Preserva: spellSlots usados, preparedToday, cantidades de consumables
    if (_char.id === 'lursey-brumaclara') {
      const freshLursey = Characters.buildLursey();

      // Spells: merge preservando estado prepared del personaje guardado
      const savedPrepared = _char.preparedToday || [];
      _char.spells = freshLursey.spells.map(freshSpell => {
        const saved = (_char.spells || []).find(s => s.id === freshSpell.id);
        return { ...freshSpell, prepared: saved ? saved.prepared : freshSpell.prepared };
      });
      _char.preparedToday = savedPrepared;

      // Ifttt: siempre desde master (es solo texto/guía)
      _char.ifttt = freshLursey.ifttt;

      // Consumables: solo agregar los que no existen — respeta cantidades guardadas
      const savedCons = _char.consumables || [];
      freshLursey.consumables.forEach(fresh => {
        const exists = savedCons.find(s => s.id === fresh.id);
        if (!exists) savedCons.push(fresh);
        else {
          // Actualizar metadatos (name, desc, category) pero NO qty
          exists.name     = fresh.name;
          exists.desc     = fresh.desc;
          exists.category = fresh.category;
        }
      });
      _char.consumables = savedCons;

      Storage.saveChar(_char);
    }

    _renderHeader();
    _populateCharSelector();
    _updateBackupBtn();
    _renderActiveTab();
    _updateCombatHUD();
    _setupHPSwipe();

    // Botón undo
    _undoBtn = document.getElementById('undoBtn');
    if (_undoBtn) {
      _undoBtn.disabled = true;
      _undoBtn.addEventListener('click', undoLastChange);
    }

    // Cloud.init() se llama desde cloud.js al cargarse (después del módulo ESM)

    // Auto-backup y cloud save al salir
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        _saveChar();
        Storage.autoBackup();
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
    document.getElementById('headerCharSub').textContent =
      [_char.subclase || _char.clase, `Nvl ${_char.nivel}`,
       _char.raza, _char.deity].filter(Boolean).join(' · ');

    document.getElementById('hdrCA').textContent   = ca;
    document.getElementById('hdrCD').textContent   = cd !== null ? cd : '—';
    document.getElementById('hdrATQ').textContent  = atq !== null ? (atq >= 0 ? '+' : '') + atq : '—';
    document.getElementById('hdrINIT').textContent = (init >= 0 ? '+' : '') + init;
    const strMod = Characters.calcMod(_char.stats.for);
    const dexMod = Characters.calcMod(_char.stats.des);
    const physAtk = Math.max(strMod, dexMod) + prof;
    document.getElementById('hdrPROF').textContent = (physAtk >= 0 ? '+' : '') + physAtk;

    const inspBtn = document.getElementById('hdrInspBtn');
    if (inspBtn) inspBtn.classList.toggle('active', !!_char.inspiration);

    _updateHPDisplay();
    _updateTempHPDisplay();
  }

  function _updateHPDisplay() {
    if (!_char) return;
    const { current, max, temp } = _char.hp;
    const pct = max > 0 ? Math.min(100, (current / max) * 100) : 0;
    const col = pct > 50 ? '#4a8a5a' : pct > 25 ? '#a0802a' : '#8a3a3a';
    const textCol = pct <= 0 ? '#ff4040' : pct <= 25 ? '#e05050' : pct <= 50 ? '#e08050' : 'var(--red-light)';

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
      el.textContent = 'Sin backup';
      document.getElementById('backupBtn').classList.add('stale');
      return;
    }
    const diff = Date.now() - new Date(ts).getTime();
    const hours = Math.floor(diff / 3600000);
    const mins  = Math.floor(diff / 60000);
    if (mins < 1) el.textContent = 'Hace un momento';
    else if (mins < 60) el.textContent = `Hace ${mins} min`;
    else el.textContent = `Hace ${hours}h`;

    // Alerta si lleva más de 24h
    if (diff > 86400000) document.getElementById('backupBtn').classList.add('stale');
    else document.getElementById('backupBtn').classList.remove('stale');
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
    <div class="section-hd">⚔️ Combate</div>

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
      <div class="conc-header-row">
        <span class="conc-label">${c.concentration ? '◆ Concentración activa' : 'Concentración'}</span>
        <button class="conc-break-btn" id="concBreakBtn" onclick="App.setConc(null)" style="display:${c.concentration ? 'inline-flex' : 'none'}">Romper</button>
      </div>
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

    // DESCANSOS
    html += `
    <div class="rest-btns">
      <button class="rest-btn short" onclick="App.openShortRest()">↺ Descanso Corto</button>
      <button class="rest-btn long" onclick="App.longRest()">✦ Descanso Largo</button>
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

    // INSPIRACIÓN
    html += `
    <div class="inspiration-block ${c.inspiration ? 'active' : ''}" onclick="App.toggleInspiration()">
      <span class="insp-label">Inspiración Heroica</span>
      <span class="insp-icon">${c.inspiration ? '⭐' : '☆'}</span>
    </div>`;

    // RECURSOS CUSTOM
    html += `
    <div style="margin-top:4px;">
      <button class="btn btn-ghost" style="width:100%;" onclick="App.openCustomResource()">+ Agregar Recurso</button>
    </div>`;

    document.getElementById('col-combate-izq').innerHTML = html;
    _updateRoundDisplay();
    _updateConcBlock();
    _renderHPChips();
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

    let html = `<button class="conc-btn none ${!active ? 'active' : ''}" onclick="App.setConc(null)">— Ninguna</button>`;
    allConc.forEach(sp => {
      html += `<button class="conc-btn ${active === sp.id ? 'active' : ''}" onclick="App.setConc('${sp.id}')">${sp.name.replace(' ◆','').replace(' ●','')}</button>`;
    });
    return html;
  }

  function _renderCombateDer() {
    const c = _char;

    // Conjuros clave referencia
    const keySells = (c.spells || []).filter(s => s.level > 0 && (s.domain || (c.preparedToday||[]).includes(s.id)));

    let html = `
    <button class="btn btn-gold" style="width:100%;margin-bottom:10px;font-size:12px;padding:8px;" onclick="App.openIfttt()">⚔️ Guía de Combate</button>

    <div class="section-hd">✨ Conjuros de Referencia</div>`;

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
        html += `
        <div class="spell-card" onclick="App.openSpellDetail('${sp.id}')">
          <div class="spell-info">
            <div class="spell-top">
              <span class="spell-lvl">${sp.level === 0 ? 'C' : sp.level}</span>
              <span class="spell-name">${sp.name}</span>${tags}
            </div>
            <div class="spell-desc">${sp.desc}</div>
          </div>
        </div>`;
      });
    });

    // Prioridad de slots
    html += `
    <div class="section-hd" style="margin-top:16px;">🎯 Prioridad de Slots</div>
    <div class="prio-item"><span class="prio-num">1</span><span class="prio-text"><strong>Revivify</strong><small>Guardar hasta muerte real</small></span></div>
    <div class="prio-item"><span class="prio-num">2</span><span class="prio-text"><strong>Mass Healing Word</strong><small>Solo colapso total del grupo</small></span></div>
    <div class="prio-item"><span class="prio-num">3</span><span class="prio-text"><strong>Spirit Guard. / Beacon</strong><small>Ronda 1 vs jefe · elige según situación</small></span></div>
    <div class="prio-item"><span class="prio-num">4</span><span class="prio-text"><strong>Healing Word</strong><small>Reactivo cuando cae alguien</small></span></div>
    <div class="prio-item"><span class="prio-num">5</span><span class="prio-text"><strong>Resto — úsalos</strong><small>Command · Guiding Bolt · Lesser Restoration</small></span></div>`;

    // Notes de combate
    html += `
    <div class="note-block" style="margin-top:14px;">
      <strong>Bond activo + Bless = 2d4</strong> en ataques y saves · recuérdales cada combate
    </div>
    <div class="note-block">
      <strong>Posición ideal:</strong> 15-20 ft detrás del Paladín · alcanza con Balm of Peace y Spirit Guardians
    </div>`;

    document.getElementById('col-combate-der').innerHTML = html;
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

  function _renderConjurosTab() {
    const c = _char;
    const prepared = c.preparedToday || [];
    const preparedMax = Characters.getPreparedMax(c);
    const preparedCount = (c.spells || []).filter(s =>
      s.level > 0 && !s.domain && !s.mi && prepared.includes(s.id)
    ).length;

    // Columna izquierda: todos los conjuros
    const byLevel = {};
    (c.spells || []).forEach(s => {
      const key = s.level;
      if (!byLevel[key]) byLevel[key] = [];
      byLevel[key].push(s);
    });

    let htmlIzq = `
    <div class="section-hd" style="display:flex;justify-content:space-between;align-items:center;">
      <span>Todos los Conjuros</span>
      <span style="font-size:10px;color:var(--text-dim);font-family:'Crimson Pro',serif;font-style:italic;text-transform:none;letter-spacing:0;">Toca para preparar/despreprar</span>
    </div>`;

    Object.keys(byLevel).sort((a,b) => +a - +b).forEach(lv => {
      const label = +lv === 0 ? 'Cantrips — ∞' : `Nivel ${lv}`;
      htmlIzq += `<div class="spell-group-title">${label}</div>`;
      byLevel[lv].forEach(sp => {
        const isCantrip = sp.level === 0;
        const isDomain = sp.domain;
        const isMI = sp.mi;
        const isPrepared = prepared.includes(sp.id) || isDomain || isMI || isCantrip;
        const tags = _buildTagsHTML(sp);

        let checkClass = 'cantrip';
        if (!isCantrip && isDomain) checkClass = 'domain';
        else if (!isCantrip && isMI) checkClass = 'cantrip';
        else if (!isCantrip) checkClass = isPrepared ? 'checked' : '';

        const clickable = !isCantrip && !isDomain && !isMI;

        htmlIzq += `
        <div class="spell-card">
          <div class="spell-checkbox ${checkClass}" id="spchk-${sp.id}" ${clickable ? `onclick="App.toggleSpellPrepared('${sp.id}')"` : ''} style="${clickable?'cursor:pointer;':''}"></div>
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

    // Columna derecha: preparados hoy
    let htmlDer = `
    <div class="spells-prepared-header">
      <span class="prepared-label">Preparados hoy</span>
      <span class="prepared-count" id="preparedCount">${preparedCount}</span>
      <span class="prepared-max"> / ${preparedMax}</span>
    </div>
    <div class="section-hd">Dominio — siempre activos</div>`;

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

    htmlDer += `
    <div class="note-block" style="margin-top:12px;">
      <strong>Máx preparados:</strong> ${preparedMax} = SAB mod (${Characters.calcMod(c.stats.sab) >= 0 ? '+' : ''}${Characters.calcMod(c.stats.sab)}) + Nvl (${c.nivel})
    </div>`;

    document.getElementById('col-conjuros-izq').innerHTML = htmlIzq;
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

  function _itemCatBadge(cat) {
    const c = ITEM_CAT_COLORS[cat] || ITEM_CAT_COLORS['Other'];
    return `<span class="item-cat-badge" style="background:${c.bg};color:${c.color};border-color:${c.border};">${cat}</span>`;
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
        const magicBonus = parseInt(w.bonus) || 0;
        const statMod = (w.type === 'ranged') ? dexMod : strMod;
        const hitTotal = statMod + prof + magicBonus;
        const hitStr = (hitTotal >= 0 ? '+' : '') + hitTotal;
        const dmgBonus = statMod + magicBonus;
        const dmgStr = w.die !== '—'
          ? `${w.die}${dmgBonus !== 0 ? (dmgBonus > 0 ? '+' : '') + dmgBonus : ''}`
          : '—';
        htmlIzq += `
        <div class="item-row">
          <div class="item-row-left">
            <span class="item-name">${w.name}</span>
            ${w.notes ? `<span class="item-desc">${w.notes}</span>` : ''}
          </div>
          <div class="item-row-right">
            ${!isFocus ? `<span class="item-stat hit-badge">${hitStr} al golpe</span>` : ''}
            ${!isFocus ? `<span class="item-stat">${dmgStr}</span>` : ''}
            ${_itemCatBadge('Weapon')}
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
          <div style="font-size:15px;color:var(--text);font-weight:600;">${c.armor.name || 'Sin armadura'}</div>
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
    </div>`;

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
        htmlDer += `
        <div class="item-row">
          <div class="item-row-left">
            <div class="item-qty-name">
              <span class="item-qty">×${item.qty}</span>
              <span class="item-name">${item.name}</span>
            </div>
            ${item.desc ? `<span class="item-desc">${item.desc}</span>` : ''}
          </div>
          <div class="item-row-right">
            ${_itemCatBadge(cat)}
            <div class="qty-mini">
              <button class="qty-btn" onclick="App.adjustConsumable(${i},-1)">−</button>
              <span class="qty-val" id="cons-${i}">${item.qty}</span>
              <button class="qty-btn" onclick="App.adjustConsumable(${i},1)">+</button>
            </div>
            <button class="item-del" onclick="App.deleteConsumable(${i})">✕</button>
          </div>
        </div>`;
      });
    }

    htmlDer += `</div>

    <!-- DINERO -->
    <div class="equip-section">
      <div class="rc-name" style="margin-bottom:6px;">Dinero</div>
      <div class="currency-row">
        <div class="currency-field">
          <span class="currency-label" style="color:#e0d0ff;">PP</span>
          <input type="number" class="currency-input" value="${c.currency.pp||0}" min="0"
                 onchange="App.setCurrency('pp',parseInt(this.value)||0)">
        </div>
        <div class="currency-field">
          <span class="currency-label" style="color:var(--gold);">GP</span>
          <input type="number" class="currency-input" value="${c.currency.gp}" min="0"
                 onchange="App.setCurrency('gp',parseInt(this.value)||0)">
        </div>
        <div class="currency-field">
          <span class="currency-label" style="color:#c0c0c0;">SP</span>
          <input type="number" class="currency-input" value="${c.currency.sp}" min="0"
                 onchange="App.setCurrency('sp',parseInt(this.value)||0)">
        </div>
        <div class="currency-field">
          <span class="currency-label" style="color:#cd7f32;">CP</span>
          <input type="number" class="currency-input" value="${c.currency.cp}" min="0"
                 onchange="App.setCurrency('cp',parseInt(this.value)||0)">
        </div>
      </div>
    </div>`;

    document.getElementById('col-equipo-izq').innerHTML = htmlIzq;
    document.getElementById('col-equipo-der').innerHTML = htmlDer;
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
    let htmlIzq = `<div class="section-hd">🎲 Habilidades</div>
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
        ${hasProf ? `<span class="save-prof-icon">★</span>` : '<span style="width:14px;display:inline-block;"></span>'}
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
      htmlDer += `
      <div class="skill-row">
        <div class="skill-prof-btn ${hasProf || hasExp ? 'active' : ''}" onclick="App.toggleSkillProf('${skill.id}')" title="${hasExp ? 'Expertise' : hasProf ? 'Proficiente' : 'No proficiente'}"></div>
        <span class="skill-name">${skill.name}</span>
        <span class="skill-stat">(${STAT_LABELS[skill.stat]})</span>
        <span class="skill-val ${hasProf || hasExp ? 'prof' : ''}">${val >= 0 ? '+' : ''}${val}</span>
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

    (c.resistances || ['Veneno (Enano)']).forEach(r => {
      htmlDer += `<span class="resistance-tag">${r}</span>`;
    });

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
      <div class="passive-row">
        <span class="passive-label">Iniciativa</span>
        <div style="display:flex;align-items:center;gap:6px;">
          <span class="passive-val">${Characters.calcInit(c) >= 0 ? '+' : ''}${Characters.calcInit(c)}</span>
          <input type="number" class="bonus-input-sm" value="${(c.bonuses&&c.bonuses.init)||0}"
                 onchange="App.setBonus('init', this.value)" onclick="this.select()" title="Bonus extra a iniciativa">
        </div>
      </div>
      ${c.spellcastingStat ? `
      <div class="passive-row">
        <span class="passive-label">CD de Conjuros</span>
        <span class="passive-val">${Characters.calcCD(c)}</span>
      </div>
      <div class="passive-row">
        <span class="passive-label">Bonus Ataque</span>
        <div style="display:flex;align-items:center;gap:6px;">
          <span class="passive-val">+${Characters.calcAtaqueBonus(c)}</span>
          <input type="number" class="bonus-input-sm" value="${(c.bonuses&&c.bonuses.ataque)||0}"
                 onchange="App.setBonus('ataque', this.value)" onclick="this.select()" title="Bonus arma mágica">
        </div>
      </div>` : ''}
    </div>

    <!-- XP TRACKER -->
    <div class="xp-block">
      <div class="rc-header">
        <span class="rc-name">Experiencia (XP)</span>
      </div>
      <div class="xp-row">
        <input type="number" class="xp-current-input" id="xpInput" value="${c.xp}" min="0"
               onchange="App.setXP(parseInt(this.value)||0)">
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
      <button class="levelup-btn" onclick="App.openLevelUp()">✦ Subir de Nivel</button>
    </div>`;

    document.getElementById('col-hab-izq').innerHTML = htmlIzq;
    document.getElementById('col-hab-der').innerHTML = htmlDer;
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
    _updateCombatHUD();
    _flashHP(delta < 0 ? 'dmg' : 'heal');

    // Record delta in history for smart chips
    if (delta !== 0) {
      _hpHistory = [delta, ..._hpHistory.filter(v => v !== delta)].slice(0, 5);
      _renderHPChips();
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
          ? `<span class="hud-conc-dot"></span><span class="hud-conc-name">${concName}</span>
             <button class="hud-conc-break" onclick="App.setConc(null)" title="Romper concentración">✕</button>`
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

  function _renderHPChips() {
    const container = document.getElementById('hpChips');
    if (!container) return;
    container.innerHTML = _hpHistory.map(v => {
      const isDmg = v < 0;
      return `<button class="hp-chip ${isDmg ? 'dmg' : 'heal'}" onclick="App.adjustHP(${v})">${isDmg ? '' : '+'}${v}</button>`;
    }).join('');
  }

  /* ══════════════════════════════════════════════════════
     ROUND & TURN TRACKER
  ══════════════════════════════════════════════════════ */

  function startCombat() {
    _combatRound = 1;
    _combatTurn  = 1;
    _combatActive = true;
    _updateRoundDisplay();
    _updateCombatHUD();
    showToast('⚔️ Combate iniciado — Ronda 1');
  }

  function nextCombatTurn() {
    if (!_combatActive) { startCombat(); return; }
    _combatTurn++;
    _updateRoundDisplay();
    _updateCombatHUD();
    // End current turn actions
    endTurn();
  }

  function nextCombatRound() {
    if (!_combatActive) { startCombat(); return; }
    _combatRound++;
    _combatTurn = 1;
    _updateRoundDisplay();
    _updateCombatHUD();
    endTurn();
    showToast(`Ronda ${_combatRound}`);
  }

  function resetCombat() {
    _combatRound = 0;
    _combatTurn  = 0;
    _combatActive = false;
    _updateRoundDisplay();
    _updateCombatHUD();
    showToast('Combate terminado');
  }

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

  function setConc(spellId) {
    if (!_char) return;
    _char.concentration = spellId;
    _saveChar();
    // Actualizar botones
    document.querySelectorAll('.conc-btn').forEach(btn => {
      btn.classList.remove('active');
    });
    if (!spellId) {
      const noneBtn = document.querySelector('.conc-btn.none');
      if (noneBtn) noneBtn.classList.add('active');
    } else {
      const activeBtn = document.querySelector(`.conc-btn[onclick*="'${spellId}'"]`);
      if (activeBtn) activeBtn.classList.add('active');
    }
    // Update concentration block styling and HUD
    _updateConcBlock();
    _updateCombatHUD();
  }

  function _updateConcBlock() {
    if (!_char) return;
    const block = document.querySelector('.conc-block');
    if (!block) return;
    block.classList.toggle('conc-active', !!_char.concentration);

    // Update break button visibility
    const breakBtn = document.getElementById('concBreakBtn');
    if (breakBtn) breakBtn.style.display = _char.concentration ? 'inline-flex' : 'none';
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
    if (dotIndex === slot.current - 1) {
      slot.current = dotIndex;
    } else {
      slot.current = dotIndex + 1;
    }
    _saveChar(true);
    _refreshSlotDots(level);
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

  function toggleCondition(id) {
    if (!_char) return;
    const idx = _char.conditions.indexOf(id);
    if (idx >= 0) _char.conditions.splice(idx, 1);
    else _char.conditions.push(id);
    _saveChar(true);
    _renderCombateIzq();
  }

  function clearConditions() {
    if (!_char) return;
    _char.conditions = [];
    _saveChar();
    document.querySelectorAll('.cond-btn').forEach(b => b.classList.remove('active'));
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

  /* ══════════════════════════════════════════════════════
     EQUIPO
  ══════════════════════════════════════════════════════ */

  function openAddWeapon() {
    document.getElementById('awmName').value = '';
    document.getElementById('awmDie').value = '1d6';
    document.getElementById('awmBonus').value = '+0';
    document.getElementById('awmDesc').value = '';
    document.getElementById('addWeaponModal').classList.add('show');
  }

  function closeAddWeapon() {
    document.getElementById('addWeaponModal').classList.remove('show');
  }

  function saveAddWeapon() {
    const name = document.getElementById('awmName').value.trim();
    if (!name) return;
    const die   = document.getElementById('awmDie').value.trim() || '1d6';
    const bonus = document.getElementById('awmBonus').value.trim() || '+0';
    const notes = document.getElementById('awmDesc').value.trim();
    _char.weapons.push({ id:'w-'+Date.now(), name, die, bonus, type:'melee', notes });
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

  let _addItemSlot = 'bag';

  function openAddItem(slot) {
    _addItemSlot = slot || 'bag';
    document.getElementById('aimName').value = '';
    document.getElementById('aimDesc').value = '';
    document.getElementById('addItemModal').classList.add('show');
    const titleEl = document.getElementById('addItemModalTitle');
    if (titleEl) titleEl.textContent = slot === 'body' ? '+ Equipo del cuerpo' : '+ Agregar a mochila';
    // Body items default to Apparel category, bag items to Other
    document.getElementById('aimCategory').value = slot === 'body' ? 'Apparel' : 'Other';
    // Show/hide qty row — body items don't need qty
    const qtyField = document.getElementById('aimQtyField');
    if (qtyField) qtyField.style.display = slot === 'body' ? 'none' : '';
    document.getElementById('aimQty').value = '1';
  }

  function closeAddItem() {
    document.getElementById('addItemModal').classList.remove('show');
  }

  function saveAddItem() {
    const name = document.getElementById('aimName').value.trim();
    if (!name) return;
    const qty  = _addItemSlot === 'body' ? 1 : (parseInt(document.getElementById('aimQty').value) || 1);
    const category = document.getElementById('aimCategory').value;
    const desc = document.getElementById('aimDesc').value.trim();
    if (!_char.consumables) _char.consumables = [];
    _char.consumables.push({ id:'i-'+Date.now(), name, qty, category, desc, slot: _addItemSlot });
    _saveChar();
    closeAddItem();
    _renderEquipoTab();
  }

  function adjustConsumable(idx, delta) {
    _char.consumables[idx].qty = Math.max(0, _char.consumables[idx].qty + delta);
    _saveChar();
    const el = document.getElementById(`cons-${idx}`);
    if (el) el.textContent = _char.consumables[idx].qty;
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

  /* ══════════════════════════════════════════════════════
     BONUSES MANUALES
  ══════════════════════════════════════════════════════ */

  // setBonus('ca', 1) / setBonus('savesAll', 1) / setBonus('saves.sab', 1) / setBonus('skills.perspicacia', 1)
  function setBonus(key, val) {
    if (!_char) return;
    if (!_char.bonuses) _char.bonuses = { ca:0, savesAll:0, saves:{}, skills:{}, init:0, hpMax:0, ataque:0 };
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

  /* ══════════════════════════════════════════════════════
     HABILIDADES
  ══════════════════════════════════════════════════════ */

  function editStat(statKey) {
    const current = _char.stats[statKey];
    const label = Characters.STAT_NAMES[statKey] || statKey.toUpperCase();
    const val = prompt(`Nuevo valor para ${label} (actual: ${current}):`, current);
    if (val === null) return;
    const n = parseInt(val);
    if (isNaN(n) || n < 1 || n > 30) { showToast('Valor inválido (1-30)'); return; }
    _char.stats[statKey] = n;
    _saveChar();
    _renderHabilidadesTab();
    _renderHeader();
  }

  function toggleSkillProf(skillId) {
    if (!_char.skillProfs) _char.skillProfs = [];
    const idx = _char.skillProfs.indexOf(skillId);
    if (idx >= 0) _char.skillProfs.splice(idx, 1);
    else _char.skillProfs.push(skillId);
    _saveChar();
    _renderHabilidadesTab();
  }

  function setVelocidad(val) {
    _char.velocidad = val;
    _saveChar();
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

  /* ══════════════════════════════════════════════════════
     DESCANSOS
  ══════════════════════════════════════════════════════ */

  function openShortRest() {
    const max = _char.hitDice.current;
    document.getElementById('srMaxDice').textContent = max;
    document.getElementById('srDiceQty').max = max;
    document.getElementById('srDiceQty').value = Math.min(1, max);
    document.getElementById('srDiceResult').value = '';
    _updateShortRestPreview();
    document.getElementById('shortRestModal').classList.add('show');
  }

  function closeShortRest() {
    document.getElementById('shortRestModal').classList.remove('show');
  }

  function _updateShortRestPreview() {
    const qty = parseInt(document.getElementById('srDiceQty').value) || 0;
    const result = parseInt(document.getElementById('srDiceResult').value) || 0;
    const conMod = Characters.calcMod(_char.stats.con);
    const heal = result + (conMod * qty);
    document.getElementById('srPreview').innerHTML =
      `Dados usados: <strong>${qty}</strong> · Resultado tirada: <strong>${result}</strong><br>
       CON mod: <strong>${conMod >= 0 ? '+' : ''}${conMod}</strong> × ${qty} dados = <strong>${conMod * qty}</strong><br>
       <strong style="color:var(--gold-light);">Curación total: ${Math.max(0, heal)} HP</strong>`;
  }

  function applyShortRest() {
    const qty = parseInt(document.getElementById('srDiceQty').value) || 0;
    const result = parseInt(document.getElementById('srDiceResult').value) || 0;
    const conMod = Characters.calcMod(_char.stats.con);
    const heal = Math.max(0, result + conMod * qty);

    // Recargar Channel Divinity y recursos de descanso corto
    _char.resources.forEach(r => {
      if (r.recharge === 'short') r.current = r.max;
    });

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
    showToast(`Descanso corto · +${heal} HP · CD recargado`);
  }

  function longRest() {
    if (!confirm('¿Descanso largo? Se recargan todos los recursos, HP máximo y dados de golpe (mitad).')) return;

    // Recargar todos los recursos
    _char.resources.forEach(r => { r.current = r.max; });

    // Spell slots máximo
    for (let i = 1; i <= 9; i++) {
      if (_char.spellSlots[i]) _char.spellSlots[i].current = _char.spellSlots[i].max;
    }

    // Dados de golpe: recupera mitad redondeado hacia arriba
    const recover = Math.max(1, Math.ceil(_char.hitDice.max / 2));
    _char.hitDice.current = Math.min(_char.hitDice.max, _char.hitDice.current + recover);

    // HP máximo
    _char.hp.current = _char.hp.max;
    _char.hp.temp = 0;

    // Reset turno y concentración
    _char.turn = { action: false, bonus: false, reaction: false, movement: false };
    _char.concentration = null;

    // Limpiar condiciones
    _char.conditions = [];

    _saveChar(true);
    _renderHeader();
    _renderCombateTab();
    _updateCombatHUD();
    showToast('Descanso largo · Todo recargado ✦');
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

    const slots = Characters.getSlotsForClass(_char.clase, newLevel);
    const slotsStr = slots.map((n, i) => n > 0 ? `Nvl${i+1}: ${n}` : '').filter(Boolean).join(' · ');

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
    Characters.applyLevelUp(_char, newLevel, hpGained);
    _saveChar();
    closeLevelUp();
    _renderHeader();
    _renderCombateTab();
    _renderHabilidadesTab();
    showToast(`¡Nivel ${newLevel}! ✦`);
  }

  /* ══════════════════════════════════════════════════════
     DIARIO
  ══════════════════════════════════════════════════════ */

  function toggleDiary() {
    _diaryOpen = !_diaryOpen;
    document.getElementById('diaryPanel').classList.toggle('open', _diaryOpen);
    document.getElementById('overlayBackdrop').classList.toggle('show', _diaryOpen || _iftttOpen);
    if (_diaryOpen) _renderDiaryEntries();
  }

  function _renderDiaryEntries(filter = '') {
    const entries = (_char.diary || []).filter(e =>
      !filter || e.text.toLowerCase().includes(filter.toLowerCase())
    ).slice().reverse(); // más recientes primero

    const container = document.getElementById('diaryEntries');
    if (!container) return;

    if (entries.length === 0) {
      container.innerHTML = `<div class="empty-state"><div class="es-icon">📓</div><div class="es-title">Sin entradas</div><div class="es-text">${filter ? 'No se encontraron resultados.' : 'Escribe algo abajo para empezar.'}</div></div>`;
      return;
    }

    container.innerHTML = entries.map(e => {
      const d = new Date(e.timestamp);
      const ts = d.toLocaleDateString('es', { day:'2-digit', month:'2-digit', year:'numeric' }) +
                 ' ' + d.toLocaleTimeString('es', { hour:'2-digit', minute:'2-digit' });
      return `<div class="diary-entry">
        <div class="diary-entry-ts">${ts}</div>
        <div class="diary-entry-text">${e.text.replace(/</g,'&lt;').replace(/>/g,'&gt;')}</div>
        <div class="diary-entry-actions">
          <button class="diary-del-btn" onclick="App.deleteDiaryEntry('${e.id}')">Eliminar</button>
        </div>
      </div>`;
    }).join('');
  }

  function addDiaryEntry() {
    const textarea = document.getElementById('diaryInput');
    const text = textarea.value.trim();
    if (!text) return;

    const entry = {
      id: 'e-' + Date.now(),
      timestamp: new Date().toISOString(),
      text
    };

    if (!_char.diary) _char.diary = [];
    _char.diary.push(entry);
    _saveChar();
    textarea.value = '';
    _renderDiaryEntries(document.getElementById('diarySearch').value);
  }

  function deleteDiaryEntry(id) {
    if (!_char.diary) return;
    _confirm('¿Eliminar esta entrada del diario?', () => {
      _char.diary = _char.diary.filter(e => e.id !== id);
      _saveChar();
      _renderDiaryEntries(document.getElementById('diarySearch').value);
    });
  }

  function filterDiary(query) {
    _renderDiaryEntries(query);
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

    _spellDetailOpen = true;
    document.getElementById('spellDetailModal').classList.add('show');
    document.getElementById('overlayBackdrop').classList.add('show');
  }

  function closeSpellDetail() {
    _spellDetailOpen = false;
    document.getElementById('spellDetailModal').classList.remove('show');
    document.getElementById('overlayBackdrop').classList.toggle('show', _diaryOpen || _iftttOpen);
  }

  function _renderIftttBody() {
    const ifttt = _char.ifttt || [];
    const sections = [...new Set(ifttt.map(i => i.section))];
    let html = '';
    sections.forEach(sec => {
      html += `<div class="section-divider">${sec}</div>`;
      ifttt.filter(i => i.section === sec).forEach(item => {
        html += `
        <div class="ifttt-item">
          <span class="if-tag ${item.tag}">${item.tag === 'siempre' ? 'Siempre' : 'Si'}</span>
          <span class="ifttt-text"><em style="color:var(--text-mid);font-style:normal;">${item.trigger}</em> → ${item.action}</span>
        </div>`;
      });
    });

    if (!html) html = `<div style="padding:20px;color:var(--text-dim);font-style:italic;">No hay guía de combate configurada.</div>`;
    document.getElementById('iftttBody').innerHTML = html;
  }

  function closeAllOverlays() {
    if (_diaryOpen) toggleDiary();
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

  function importBackup(input) {
    const file = input.files[0];
    if (!file) return;
    Storage.importJSON(file,
      count => {
        input.value = '';
        _char = Storage.getActiveChar();
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
    setBonus, toggleShield,

    // Turn & Rounds
    toggleTurn, endTurn,
    startCombat, nextCombatTurn, nextCombatRound, resetCombat,

    // Concentración
    setConc, closeConcAlert,

    // Tiradas de muerte
    toggleDeathSave, resetDeathSaves,

    // Recursos
    adjustResource, toggleResourceDot, adjustSlot, toggleSlotDot, adjustHitDice, toggleHitDieDot,
    openCustomResource, closeCustomResource, saveCustomResource, deleteResource,

    // Condiciones
    toggleCondition, clearConditions,
    toggleInspiration,

    // Conjuros
    toggleSpellPrepared,

    // Equipo
    addWeapon, openAddWeapon, closeAddWeapon, saveAddWeapon, deleteWeapon,
    openAddItem, closeAddItem, saveAddItem,
    adjustConsumable, deleteConsumable, addConsumable,
    setCurrency, setAttunement,
    addMagicItem, deleteMagicItem,
    setNotes,

    // Habilidades
    editStat, toggleSkillProf, setVelocidad, setXP,

    // Descansos
    openShortRest, closeShortRest, applyShortRest, longRest,

    // Level up
    openLevelUp, closeLevelUp, applyLevelUp,

    // Diario
    toggleDiary, addDiaryEntry, deleteDiaryEntry, filterDiary, exportDiary,

    // IFTTT
    openIfttt, closeIfttt, closeAllOverlays, closeConfirm,

    // Detalle spell
    openSpellDetail, closeSpellDetail,

    // Backup
    doBackup, importBackup,

    // Toast
    showToast,

    // Cloud / Undo
    undoLastChange,
    reloadChar(char) {
      _char = char || Storage.getActiveChar();
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
