/* ═══════════════════════════════════════════════════════════
   mesa.js — Vista "Mesa" (beta): otra forma de ver la ficha, a elección.
   No reemplaza nada: agrega su propia cabecera, una columna fija de tiradas
   y paneles nuevos para Combate y Conjuros. Lo de siempre queda en el DOM
   (oculto por css/mesa.css) y sigue funcionando; Ítems, Habilidades,
   Bastión y Biblioteca se ven como hoy. Toda acción llama a App.*, así que
   las reglas (espacios, concentración, economía del turno) son las mismas.
   Preferencia por dispositivo en localStorage 'dnd_vista'.
   ═══════════════════════════════════════════════════════════ */
const Mesa = (() => {
  const CLAVE = 'dnd_vista';
  const leer = () => { try { return localStorage.getItem(CLAVE) === 'mesa'; } catch (e) { return false; } };
  // Se aplica en <head> para pintar ya con la vista elegida
  if (leer()) document.documentElement.dataset.vista = 'mesa';

  const STATS = ['for', 'des', 'con', 'int', 'sab', 'car'];
  const ABREV = { for: 'FUE', des: 'DES', con: 'CON', int: 'INT', sab: 'SAB', car: 'CAR' };
  const NOMBRE = { for: 'Fuerza', des: 'Destreza', con: 'Constitución', int: 'Inteligencia', sab: 'Sabiduría', car: 'Carisma' };
  // Mismos ids que CONDITIONS en app.js
  const CONDICIONES = [['caido', 'Caído'], ['envenenado', 'Envenenado'], ['aturdido', 'Aturdido'], ['agarrado', 'Agarrado'], ['asustado', 'Asustado'],
    ['incapacitado', 'Incapacitado'], ['cegado', 'Cegado'], ['encantado', 'Encantado'], ['ensordecido', 'Ensordecido'], ['invisible', 'Invisible'],
    ['paralizado', 'Paralizado'], ['apresado', 'Apresado']];
  const CAMPO = { action: 'action', bonusAction: 'bonus', reaction: 'reaction' };

  // Estado de la vista (no se guarda en el personaje)
  const st = { abierto: null, golpes: new Set(), grupos: new Set(), filtro: 'preparados', tipo: null, buscar: '', original: {}, hoja: false };

  const esc = t => String(t == null ? '' : t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
  const sg = n => (n >= 0 ? '+' : '') + n;
  const limpio = n => String(n || '').replace(/\s*[◆†○●]\s*/g, '').trim();
  const $ = id => document.getElementById(id);
  // Roll20 solo en escritorio: en la vista Mesa nunca hay botón en las filas,
  // solo dentro del detalle, y en táctil ni eso (misma regla que .solo-desktop).
  const esEscritorio = () => matchMedia('(hover: hover) and (pointer: fine)').matches;

  const activo = () => document.documentElement.dataset.vista === 'mesa';

  function alternar() {
    const nuevo = !activo();
    try { localStorage.setItem(CLAVE, nuevo ? 'mesa' : 'actual'); } catch (e) {}
    if (nuevo) document.documentElement.dataset.vista = 'mesa';
    else delete document.documentElement.dataset.vista;
    _etiqueta();
    if (nuevo) render();
    else if (typeof App !== 'undefined' && App.getActiveChar()) App.reloadChar(App.getActiveChar());
  }

  function _etiqueta() {
    const el = $('mesaLabel');
    if (el) el.textContent = activo() ? 'Mesa (beta)' : 'Actual';
  }

  /* ── Contenedores: se agregan una vez, junto a los de siempre ── */
  function _montar() {
    const cab = $('appHeader');
    if (cab && !$('mesaCab')) cab.insertAdjacentHTML('afterbegin', '<div class="mesa-cab" id="mesaCab"></div>');
    const split = document.querySelector('.app-content-split');
    if (split && !$('mesaTiradas')) split.insertAdjacentHTML('afterbegin', '<aside class="mesa-tiradas" id="mesaTiradas"></aside>');
    for (const tab of ['combate', 'conjuros', 'habilidades']) {
      const p = $('tab-' + tab);
      if (p && !$('mesa-' + tab)) p.insertAdjacentHTML('afterbegin', `<div class="mesa-panel" id="mesa-${tab}"></div>
        <button class="mesa-volver" onclick="Mesa.original('${tab}')">◂ Volver a la vista Mesa</button>`);
    }
    const nav = document.querySelector('.tab-nav');
    if (nav && !$('mesaTurnoNav')) nav.insertAdjacentHTML('beforeend', '<button class="mesa-volver-nav" id="mesaVolverNav" onclick="Mesa.original()">◂ Volver a la vista Mesa</button><div class="mesa-turno-nav" id="mesaTurnoNav"></div>');
    if (!$('mesaFab')) {
      document.body.insertAdjacentHTML('beforeend', `
        <button class="mesa-fab" id="mesaFab" onclick="Mesa.hoja(true)"><i class="mesa-ico" style="--m:url(../assets/iconos/d20.svg)"></i>Tiradas</button>
        <div class="mesa-velo" id="mesaVelo" onclick="Mesa.hoja(false)"></div>
        <div class="mesa-hoja" id="mesaHoja"></div>`);
    }
  }

  /* ── Repintado: lo piden App al guardar, al cambiar de pestaña y al
     cargar. Se agrupa en un frame para no repintar varias veces seguidas. ── */
  let _pendiente = false;
  function render() {
    if (!activo() || _pendiente) return;
    _pendiente = true;
    requestAnimationFrame(() => { _pendiente = false; _pintar(); });
  }

  function _pintar() {
    if (!activo() || typeof App === 'undefined') return;
    const c = App.getActiveChar();
    if (!c) return;
    _montar();
    _etiqueta();
    if (c.hp && c.hp.current > 0) st.grupos.delete('muerte');
    $('mesaCab').innerHTML = _cabecera(c);
    $('mesaTurnoNav').innerHTML = _turno(c, true);
    const tiradas = _tiradas(c);
    $('mesaTiradas').innerHTML = tiradas;
    $('mesaHoja').innerHTML = '<div class="mesa-asa"></div>' + tiradas;
    document.body.classList.toggle('mesa-hoja-abierta', st.hoja);
    for (const tab of ['combate', 'conjuros']) {
      const panel = $('tab-' + tab);
      if (panel) panel.classList.toggle('mesa-ver-original', !!st.original[tab]);
    }
    $('mesa-combate').innerHTML = _combate(c);
    $('mesa-conjuros').innerHTML = _conjuros(c);
    $('mesa-habilidades').innerHTML = _configuracion(c);
    const tabActiva = document.querySelector('.tab-btn.active');
    const tab = tabActiva ? tabActiva.dataset.tab : '';
    document.documentElement.dataset.mesaTab = tab;
    // Con la vista completa abierta, el botón para volver va también en la barra de pestañas
    document.documentElement.toggleAttribute('data-mesa-original', !!st.original[tab]);
  }

  /* ══ Cabecera: identidad, vida, defensas y el turno en una franja ══ */
  function _cabecera(c) {
    const { current, max, temp } = c.hp;
    const segs = Math.min(20, Math.max(8, max));
    const llenos = max > 0 ? Math.round(Math.max(0, current) / max * segs) : 0;
    const pct = max > 0 ? current / max : 0;
    const nivelVida = pct <= 0.25 ? 'crit' : pct <= 0.5 ? 'mid' : 'ok';
    const ca = Characters.calcCA(c), init = Characters.calcInit(c), cd = Characters.calcCD(c);
    const pb = Characters.calcProfBonus(c.nivel);
    const clases = (c.classes && c.classes.length ? c.classes : [{ name: c.clase, level: c.nivel }])
      .map(x => `${x.name} ${x.level}`).join(' / ');
    const img = $('charAvatarImg');
    const foto = img && img.style.display !== 'none' && img.src ? `<img src="${img.src}" alt="">` : esc((c.name || '?')[0]);
    // Velocidad en pies → metros de mesa (5 ft = 1,5 m); App.fmtDist respeta la unidad elegida
    const vel = App.fmtDist(`${String((c.velocidad || 30) / 5 * 1.5).replace('.', ',')} m`);
    return `
      <div class="mc-avatar" onclick="document.getElementById('avatarFileInput').click()" title="Cambiar foto">${foto}</div>
      <div class="mc-quien"><b>${esc(c.name)}${c.echoActive && _esEcoKnight(c) ? ' <span class="mc-eco" title="Eco activo"><i class="mesa-ico" style="--m:url(../assets/iconos/eco.svg)"></i>Eco</span>' : ''}</b><small>${esc(clases)}${c.subclase ? ' · ' + esc(c.subclase) : ''}</small></div>
      <span class="mc-sep"></span>
      <div class="mc-pg">
        <div class="mc-pg-top"><span class="mesa-lbl">PG</span><span class="mc-num mc-${nivelVida}">${current}<small> / </small></span><input class="mc-max" type="number" min="1" max="999" value="${max}"
          title="PG máximos — toca para editar" onclick="this.select()" onchange="App.setHPMax(parseInt(this.value))" onkeydown="if(event.key==='Enter')this.blur()">
          <button class="mesa-chip" onclick="App.promptTempHP()" title="PG temporales">TMP ${temp || 0}</button></div>
        <div class="mesa-barra mc-${nivelVida}">${Array.from({ length: segs }, (_, i) => `<i class="${i < llenos ? '' : 'v'}"></i>`).join('')}</div>
      </div>
      <div class="mc-pg-ctl">
        <input id="mesaHPIn" type="number" inputmode="numeric" min="0" placeholder="0" onkeydown="if(event.key==='Enter')Mesa.vida(-1)">
        <button class="mesa-btn mc-dmg" onclick="Mesa.vida(-1)">Daño</button>
        <button class="mesa-btn mc-heal" onclick="Mesa.vida(1)">Curar</button>
      </div>
      <span class="mc-sep"></span>
      <div class="mc-ca" title="Clase de Armadura"><span class="mesa-escudo">${ca}</span></div>
      <div class="mc-vit">
        <div><b>${sg(init)}</b><span class="mesa-lbl">Inic.</span></div>
        <div><b>${esc(vel)}</b><span class="mesa-lbl">Vel.</span></div>
        <div><b>${sg(pb)}</b><span class="mesa-lbl">Comp.</span></div>
        ${cd != null ? `<div><b>${cd}</b><span class="mesa-lbl">CD</span></div>` : ''}
        <button class="mc-insp ${c.inspiration ? 'on' : ''}" onclick="App.toggleInspiration()" title="${c.inspiration ? 'Tienes Inspiración Heroica: toca para usarla' : 'Sin Inspiración Heroica: toca para ganarla'}">
          <b>${c.inspiration ? '★' : '☆'}</b><span class="mesa-lbl">Insp.</span></button>
      </div>
      <span class="mc-esp"></span>
      <div class="mc-turno">${_turno(c, false)}</div>
      <div class="mc-herr">
        <button class="mc-ic" onclick="App.openQuickNote()" title="Nota rápida"><i class="mesa-ico" style="--m:url(../assets/iconos/nota.svg)"></i></button>
        <button class="mc-ic" onclick="App.toggleNotebook()" title="Cuaderno: Hojas, notas rápidas, log"><i class="mesa-ico" style="--m:url(../assets/iconos/cuaderno.svg)"></i></button>
      </div>`;
  }

  // Acción / Adicional / Reacción + fin de turno y descansos
  function _turno(c, enLinea) {
    const t = c.turn || {};
    if (!App.enCombate()) {
      const fuera = `<button class="mesa-chip on" onclick="Mesa.combate(true)">⚔ Iniciar combate</button>`;
      const desc = `<button class="mesa-chip" onclick="App.openShortRest()">↺ Corto</button><button class="mesa-chip" onclick="App.longRest()">☾ Largo</button>`;
      return enLinea ? fuera + '<span class="mesa-vsep"></span>' + desc : `<div class="mc-fila">${fuera}</div><div class="mc-fila">${desc}</div>`;
    }
    const pastilla = (campo, txt) => `<button class="mesa-chip ${t[campo] ? 'usada' : 'on'}" onclick="Mesa.turno('${campo}')"
      title="${t[campo] ? 'Usada — toca para devolverla' : 'Disponible — toca para marcarla'}">${t[campo] ? '' : '✓ '}${txt}</button>`;
    const fila1 = pastilla('action', 'Acción') + pastilla('bonus', 'Adicional') + pastilla('reaction', 'Reacción');
    const fila2 = `<button class="mesa-chip" onclick="App.nuevoTurno()">Fin de turno ▸</button>
      <button class="mesa-chip" onclick="Mesa.combate(false)">✕ Terminar combate</button>`;
    return enLinea ? fila1 + '<span class="mesa-vsep"></span>' + fila2
      : `<div class="mc-fila">${fila1}</div><div class="mc-fila">${fila2}</div>`;
  }

  // Daño o curación al compañero con la cantidad escrita (vacío = 1)
  function vidaBestia(el, signo) {
    const inp = el.closest('.mesa-comp-pg').querySelector('.mesa-comp-in');
    const v = parseInt(inp && inp.value, 10) || 1;
    App.adjustCompanionHP(signo * Math.max(1, v));
  }

  function vida(signo) {
    const inp = $('mesaHPIn');
    const v = parseInt(inp && inp.value, 10);
    if (!v || v <= 0) { if (inp) inp.focus(); return; }
    App.adjustHP(signo * v);
  }

  /* ══ Tiradas: características, salvaciones, habilidades y pasivas ══ */
  function _tiradas(c) {
    const r20 = esEscritorio();
    const fila = (tipo, id, contenido, titulo) => r20
      ? `<div class="mt-f mt-r20" onclick="App.copiarRoll20('${tipo}','${id}')" title="${esc(titulo)} · clic: copiar tirada para Roll20">${contenido}</div>`
      : `<div class="mt-f">${contenido}</div>`;
    const stats = STATS.map(s => {
      const mod = Characters.calcMod(c.stats[s]);
      return `<div onclick="App.editStat('${s}')" title="Editar ${NOMBRE[s]}"><small>${ABREV[s]}</small><b>${sg(mod)}</b><small>${c.stats[s]}</small></div>`;
    }).join('');
    const salv = STATS.map(s => {
      const p = (c.savingThrows || []).includes(s);
      return fila('save', s, `<u class="${p ? 'p' : ''}"></u><span class="largo">${NOMBRE[s]}</span><span class="corto">${ABREV[s]}</span><b>${sg(Characters.calcSave(c, s))}</b>`, 'Salvación de ' + NOMBRE[s]);
    }).join('');
    const skills = Characters.SKILLS_DEF.map(k => {
      const exp = (c.skillExpertise || []).includes(k.id), p = (c.skillProfs || []).includes(k.id);
      return fila('skill', k.id, `<u class="${exp ? 'e' : p ? 'p' : ''}"></u>${esc(k.name)} <small>${ABREV[k.stat]}</small><b>${sg(Characters.calcSkill(c, k.id))}</b>`, k.name);
    }).join('');
    const pasiva = id => 10 + Characters.calcSkill(c, id);
    // Guerrero 2024: Mente Táctica junto a las pruebas, que es donde se usa
    const sw = (c.features || []).some(f => f.id === 'tactical-mind') && (c.resources || []).find(r => r.id === 'second-wind');
    const mente = sw ? `<div class="mesa-sec">Si fallas una prueba</div>
      <div class="mt-tm"><div><b>Mente Táctica</b><small>Tira 1d10 y súmalo. Si con eso pasa, gasta 1 Second Wind; si sigue fallando, no gasta nada.</small></div>
        <button class="mesa-chip ${sw.current > 0 ? 'on' : ''}" ${sw.current > 0 ? '' : 'disabled'} onclick="App.adjustResource('second-wind',-1,true);App.showToast('Mente Táctica · 1 Second Wind')">Pasó · gastar 1 <small>(${sw.current}/${sw.max})</small></button></div>` : '';
    return `
      <div class="mt-stats">${stats}</div>
      <div class="mesa-sec">Salvaciones</div>
      <div class="mt-filas mt-salv">${salv}</div>
      <div class="mesa-sec">Habilidades <small>● competente · ◉ pericia</small></div>
      <div class="mt-filas">${skills}</div>
      <div class="mesa-sec">Pasivas</div>
      <div class="mt-pasivas"><span class="mesa-chip">Percepción ${Characters.calcPercPasiva(c)}</span><span class="mesa-chip">Perspicacia ${pasiva('perspicacia')}</span><span class="mesa-chip">Investigación ${pasiva('investigacion')}</span></div>${mente}`;
  }

  function hoja(abrir) {
    st.hoja = !!abrir;
    document.body.classList.toggle('mesa-hoja-abierta', st.hoja);
  }

  /* ══ Combate: lo que puedes hacer este turno, por tipo de acción ══ */
  const preparado = (c, sp) => sp.level === 0 || sp.domain || sp.mi || (c.preparedToday || []).includes(sp.id);

  /* ── ¿Se puede usar ahora? Devuelve el motivo si no (o '' si sí).
     Solo informa: lanzar o usar igual sigue pidiendo confirmación en App. ── */
  const ETQ = { action: 'tu Acción', bonusAction: 'tu Acción adicional', reaction: 'tu Reacción' };
  const DESCANSO = r => /short/.test(r.recharge || '') ? 'descanso corto' : /long/.test(r.recharge || '') ? 'descanso largo' : 'descanso';
  function _turnoUsado(c, tipo) {
    if (!App.enCombate()) return '';
    const t = c.turn || {};
    return CAMPO[tipo] && t[CAMPO[tipo]] ? `Ya usaste ${ETQ[tipo]}` : '';
  }
  function _motivoConjuro(c, sp, via) {
    if (Characters.formaWildShapeActiva(c) && _nivelDruida(c) < 18) return 'En Wild Shape no puedes lanzar conjuros';
    if (sp.level > 0) {
      const op = App.castOptions(sp.id) || { free: false, slots: [] };
      if (!op.free && !op.slots.length) return `Sin espacios de nivel ${sp.level} o más`;
    }
    return _turnoUsado(c, via || Characters.getActivation(sp));
  }
  // Recurso que da un uso gratis de otro (Amulet of the Devout → Channel Divinity)
  const _gratisPara = (c, r) => (c.resources || []).find(x => x.usaPara === r.id && x.current > 0);
  function _motivoRecurso(c, r) {
    if (r.current <= 0 && !_gratisPara(c, r)) return `Sin usos · vuelve con ${DESCANSO(r)}`;
    return _turnoUsado(c, Characters.getActivation(r));
  }

  /* Lista de una columna: lo que se puede usar arriba; lo que no se puede
     por falta de espacios o usos, plegado al final. Lo que solo está bloqueado
     porque ya usaste esa acción en el turno sigue a la vista (atenuado): si te
     equivocaste, devuelves la acción y vuelve a estar disponible. */
  const _porTurno = x => /^Ya /.test(x.no || '');
  function _columnaItems(items, grupo) {
    const si = items.filter(x => !x.no || _porTurno(x)), no = items.filter(x => x.no && !_porTurno(x));
    const ab = st.grupos.has(grupo);
    return si.map(x => x.html).join('')
      + (no.length ? `<button class="mesa-plegar" onclick="Mesa.grupo('${grupo}')">${ab ? '▾' : '▸'} No disponible ahora (${no.length})</button>`
        + (ab ? no.map(x => x.html).join('') : '') : '');
  }

  function _combate(c) {
    if (!App.enCombate()) return _fuera(c);
    const t = c.turn || {};
    const col = { action: [], bonusAction: [], reaction: [] };
    const eq = c.equipment || {};
    const maxAtq = App.ataquesDelTurno(), usados = t.attacksUsed || 0;

    // Ataques con las armas equipadas
    [['mainHand', 'action'], ['offHand', 'bonusAction']].forEach(([slot, tipo]) => {
      const w = eq[slot];
      const a = w && w.kind === 'weapon' ? Characters.calcArma(c, slot) : null;
      if (!a) return;
      const no = slot === 'offHand' ? (t.bonus ? 'Ya usaste tu Acción adicional' : '')
        : usados >= maxAtq ? (maxAtq > 1 ? `Ya hiciste tus ${maxAtq} ataques` : 'Ya atacaste este turno')
        : t.action && !usados ? 'Ya usaste tu Acción en otra cosa' : '';
      const daño = App.sumarDaño(a.daño + (a.extra ? ' + ' + a.extra : ''));
      const mun = _municion(c, w);
      const sinMun = mun && mun.qty === 0;
      const noArma = no || (sinMun ? `Sin ${mun.label.toLowerCase()}` : '');
      col[tipo].push({ no: noArma, html: _fila({
        id: 'arma-' + slot, icono: _iconoArma(w), nombre: mun && mun.qty != null ? `${w.name} (${mun.qty})` : w.name, num: sg(a.ataque), dmg: daño, no: noArma,
        sub: [mun && mun.qty == null ? `Sin ${mun.label.toLowerCase()} en Ítems` : '', maxAtq > 1 && slot === 'mainHand' ? `ataques ${usados}/${maxAtq}` : '',
          _nivelPicaro(c) && (a.sutil || a.aDistancia) ? (t.furtivo ? 'furtivo ya usado' : `+ furtivo ${Math.ceil(_nivelPicaro(c) / 2)}d6`) : '', ...a.notas].filter(Boolean).join(' · '),
        det: `${w.notes ? `<p>${esc(w.notes)}</p>` : ''}${mun ? _controlMunicion(mun) : ''}<div class="mesa-acc"><button class="mesa-btn p" onclick="event.stopPropagation();App.attackWithWeapon('${slot}')">⚔ Atacar</button></div>`,
      }) });
      // Ataque de oportunidad: con la primera arma cuerpo a cuerpo equipada (principal o secundaria)
      if (!a.aDistancia && !col.reaction.some(x => x.ao)) {
        const no2 = t.reaction ? 'Ya usaste tu Reacción' : '';
        col.reaction.push({ ao: true, no: no2, html: _fila({
          id: 'ao', icono: _iconoArma(w), nombre: 'Ataque de oportunidad', num: sg(a.ataque), sub: `${w.name} · ${a.daño}`, no: no2,
          det: `<p>Cuando una criatura hostil que puedes ver sale de tu alcance.</p>${_tieneDote(c, 'Sentinel') ? '<p>Sentinel: si impactas, su velocidad queda en 0 este turno.</p>' : ''}<div class="mesa-acc"><button class="mesa-btn p" onclick="event.stopPropagation();Mesa.oportunidad()">⚔ Atacar</button></div>`,
        }) });
      }
    });

    // Polearm Master y Sentinel (PHB 2024) con el arma cuerpo a cuerpo principal
    const am = eq.mainHand && eq.mainHand.kind === 'weapon' ? Characters.calcArma(c, 'mainHand') : null;
    if (am && !am.aDistancia) {
      const arma = eq.mainHand.name, noR = t.reaction ? 'Ya usaste tu Reacción' : '';
      const halt = _tieneDote(c, 'Sentinel') ? ' Si impactas, su velocidad queda en 0 este turno (Sentinel).' : '';
      if (_tieneDote(c, 'Polearm Master')) {
        const noB = t.bonus ? 'Ya usaste tu Acción adicional' : !usados ? 'Primero ataca con la acción de Ataque' : '';
        const d4 = '1d4' + (am.dañoFijo > 0 ? '+' + am.dañoFijo : am.dañoFijo < 0 ? String(am.dañoFijo) : '');
        col.bonusAction.push({ no: noB, html: _fila({ id: 'pam-extremo', icono: _iconoArma(eq.mainHand), nombre: 'Golpe con el extremo', num: sg(am.ataque), dmg: d4, no: noB,
          sub: `${arma} · contundente · Polearm Master`,
          det: `<p>Justo después de atacar con la acción de Ataque, con el otro extremo del arma.</p><div class="mesa-acc"><button class="mesa-btn p" onclick="event.stopPropagation();Mesa.usarRasgo('bonusAction','pam-extremo')">⚔ Atacar · Acción adicional</button></div>` }) });
        col.reaction.push({ no: noR, html: _fila({ id: 'pam-reactivo', icono: _iconoArma(eq.mainHand), nombre: 'Ataque reactivo', num: sg(am.ataque), dmg: App.sumarDaño(am.daño), no: noR,
          sub: `Entra en tu alcance · Polearm Master`,
          det: `<p>Cuando una criatura entra en el alcance que tienes con el arma.</p><div class="mesa-acc"><button class="mesa-btn p" onclick="event.stopPropagation();Mesa.oportunidad()">⚔ Atacar · Reacción</button></div>` }) });
      }
      if (_tieneDote(c, 'Sentinel')) {
        col.reaction.push({ no: noR, html: _fila({ id: 'sentinel', icono: _iconoArma(eq.mainHand), nombre: 'Guardián (Sentinel)', num: sg(am.ataque), dmg: App.sumarDaño(am.daño), no: noR,
          sub: 'A 1,5 m: se destraba o golpea a otro',
          det: `<p>Ataque de oportunidad justo después de que una criatura a 1,5 m de ti se destrabe o impacte a un objetivo que no seas tú.${halt}</p><div class="mesa-acc"><button class="mesa-btn p" onclick="event.stopPropagation();Mesa.oportunidad()">⚔ Atacar · Reacción</button></div>` }) });
      }
    }

    // Soulknife: Hojas psíquicas (1d6 con la acción de Ataque; 1d4 con la Adicional)
    if (_subPicaro(c) === 'Soulknife' && _nivelPicaro(c) >= 3) {
      const mod = Math.max(Characters.calcMod(c.stats.des), Characters.calcMod(c.stats.for));
      const golpe = mod + Characters.calcProfBonus(c.nivel), dmg = d => `${d}${mod ? (mod > 0 ? '+' : '') + mod : ''}`;
      const noA = usados >= maxAtq ? (maxAtq > 1 ? `Ya hiciste tus ${maxAtq} ataques` : 'Ya atacaste este turno') : t.action && !usados ? 'Ya usaste tu Acción en otra cosa' : '';
      const noB = t.bonus ? 'Ya usaste tu Acción adicional' : !usados ? 'Primero ataca con la primera hoja' : '';
      const tx = 'psíquico · Sutil · Arrojadiza 18/36 m · Vex';
      col.action.push({ no: noA, html: _fila({ id: 'sk-hoja', icono: 'iconos/habilidades', nombre: 'Hoja psíquica', num: sg(golpe), dmg: dmg('1d6'), no: noA,
        sub: [tx, maxAtq > 1 ? `ataques ${usados}/${maxAtq}` : '', t.furtivo ? 'furtivo ya usado' : `+ furtivo ${Math.ceil(_nivelPicaro(c) / 2)}d6`].filter(Boolean).join(' · '),
        det: `<p>Necesitas una mano libre. La hoja desaparece tras impactar o fallar.</p><div class="mesa-acc"><button class="mesa-btn p" onclick="event.stopPropagation();App.usarAtaque(1);App.showToast('Hoja psíquica: ${sg(golpe)} · ${dmg('1d6')} psíquico')">⚔ Atacar</button></div>` }) });
      col.bonusAction.push({ no: noB, html: _fila({ id: 'sk-hoja2', icono: 'iconos/habilidades', nombre: 'Segunda hoja psíquica', num: sg(golpe), dmg: dmg('1d4'), no: noB,
        sub: `${tx} · tras atacar con la primera`,
        det: `<p>Con la otra mano libre, después de atacar con la primera hoja.</p><div class="mesa-acc"><button class="mesa-btn p" onclick="event.stopPropagation();Mesa.usarRasgo('bonusAction','sk-psychic-blades')">⚔ Atacar · Acción adicional</button></div>` }) });
    }

    // Wild Shape: los ataques de la forma activa (usan la acción de Ataque)
    const forma = Characters.formaWildShapeActiva(c);
    if (forma) (forma.ataques || []).forEach((a, i) => {
      const no = usados >= maxAtq ? (maxAtq > 1 ? `Ya hiciste tus ${maxAtq} ataques` : 'Ya atacaste este turno') : t.action && !usados ? 'Ya usaste tu Acción en otra cosa' : '';
      col.action.push({ no, html: _fila({ id: 'forma-atk-' + i, icono: 'iconos/companero', nombre: `${a.nombre} (${forma.nombre})`, num: sg(a.golpe), dmg: a.daño, no,
        sub: [a.tipo, a.alcance, maxAtq > 1 ? `ataques ${usados}/${maxAtq}` : ''].filter(Boolean).join(' · '),
        det: `${a.efecto ? `<p>${esc(a.efecto)}</p>` : ''}<div class="mesa-acc"><button class="mesa-btn p" onclick="event.stopPropagation();App.usarAtaque(1);App.showToast('${esc(a.nombre).replace(/'/g, '’')}: ${sg(a.golpe)} · ${esc(a.daño)}')">⚔ Atacar</button></div>` }) });
    });

    // Compañero (Beast Master): ordenarle cuesta la Acción adicional
    const bestia = _bestia(c);
    if (bestia) {
      const no = t.bonus ? 'Ya usaste tu Acción adicional (puedes sacrificar un ataque)' : '';
      col.bonusAction.push({ no, html: _fila({
        id: 'bestia', icono: 'iconos/companero', nombre: `Ordenar a ${c.companion.name || 'tu compañero'}`, no,
        num: sg(bestia.golpe), sub: `${bestia.ataque.name} · ${bestia.daño}`,
        det: `<p>${esc(bestia.ataque.desc)}</p><div class="mesa-acc"><button class="mesa-btn p" onclick="event.stopPropagation();App.comandarBestia('bonus')">Ordenar con Acción adicional</button>
          <button class="mesa-btn" onclick="event.stopPropagation();App.comandarBestia('attack')">Sacrificando un ataque</button></div>`,
      }) });
    }

    // Conjuros preparados que se usan en combate, todos a la vista
    (c.spells || []).filter(sp => preparado(c, sp) && sp.combat !== false)
      .sort((x, y) => x.level - y.level)
      .forEach(sp => {
        const tipo = Characters.getActivation(sp);
        if (col[tipo]) col[tipo].push({ no: _motivoConjuro(c, sp), html: _filaConjuro(c, sp) });
      });

    // War Caster (PHB 2024, Reactive Spell): cuando una criatura sale de tu
    // alcance, en vez del ataque de oportunidad puedes gastar la Reacción en
    // un conjuro de 1 Acción que tenga como objetivo solo a esa criatura.
    if ((c.features || []).some(f => /war caster/i.test(f.name || ''))) {
      const area = /criaturas|esfera|cono|cubo|l[ií]nea|emanaci|radio|cilindro|aliad|autocentrado|personal/i;
      const aptos = (c.spells || []).filter(sp => preparado(c, sp) && sp.combat !== false && Characters.getActivation(sp) === 'action'
        // Daño o salvación contra la criatura; los de aliados (ventaja, curación) no sirven
        && (sp.damage || (/salv|save|ataque|attack/i.test(sp.desc || '') && !/ventaja en|curaci|cura /i.test(sp.desc || '')))
        && !area.test(`${sp.range || ''} ${sp.desc || ''}`));
      if (aptos.length) {
        const g = 'conj-wc', ab = st.grupos.has(g);
        const no = t.reaction ? 'Ya usaste tu Reacción' : '';
        col.reaction.push({ no, html: `<div class="mesa-op ${ab ? 'abierto' : ''} ${no ? 'no' : ''}" onclick="Mesa.grupo('${g}')">
          <span class="mesa-t"><i class="mesa-ico" style="--m:url(../assets/iconos/conjuros.svg)"></i></span>
          <div class="mesa-op-tx"><b>Conjuro de oportunidad</b><small>War Caster · ${esc(aptos.slice(0, 3).map(sp => limpio(sp.name)).join(' · '))}${aptos.length > 3 ? ' …' : ''}</small>
            ${no ? `<em class="mesa-motivo">${no}</em>` : ''}</div>
          <span class="mesa-tg a">${aptos.length}</span><span class="mesa-mas">›</span></div>`
          + (ab ? `<div class="mesa-sub"><p class="mesa-vacio">Cuando una criatura sale de tu alcance. De 1 Acción y solo contra esa criatura; gasta tu Reacción.</p>${aptos.map(sp => _filaConjuro(c, sp, { via: 'reaction' })).join('')}</div>` : '') });
      }
    }

    // Rasgos con usos (Channel Divinity, Hunter's Mark gratis…). Los que se usan
    // "al hacer la acción de Ataque" (Unleash Incarnation) van en Acción.
    const conAtaque = r => /acci[oó]n de ataque|attack action/i.test(`${r.desc || ''} ${r.fullDesc || ''}`);
    (c.resources || []).forEach(r => {
      const tipo = Characters.getActivation(r);
      if (!r.max) return;
      if (col[tipo]) col[tipo].push(_filaRecurso(c, r));
      else if (conAtaque(r)) col.action.push(_filaRecurso(c, r, 'Al hacer la acción de Ataque'));
      // Action Surge: no cuesta acción, te da una más
      else if (/sin acci[oó]n/i.test(r.action || '')) col.action.push(_filaRecurso(c, r, 'Sin acción'));
    });

    // Rasgos activos sin usos (Manifest Echo…): antes no aparecían en Mesa
    const norm = t => String(t || '').toLowerCase().replace(/\(.*?\)/g, '').trim();
    const conRecurso = new Set((c.resources || []).map(r => norm(r.name)));
    // Las opciones de Channel Divinity (Balm of Peace, Divine Spark…) van dentro de su fila: gastan un uso de él
    (c.features || []).filter(f => f.type === 'active' && !conRecurso.has(norm(f.name)) && !/^channel divinity/i.test(f.source || '')).forEach(f => {
      const tipo = Characters.getActivation(f);
      if (!col[tipo]) return;
      if (f.id === 'cunning-action') return;
      if (/manifest echo/i.test(f.name || '')) { if (!col[tipo].some(x => x.eco)) col[tipo].push(_filaEco(c, f)); return; }
      // Rasgos que gastan usos de otro recurso (Land's Aid gasta Wild Shape)
      const paga = f.usa && (c.resources || []).find(r => r.id === f.usa);
      if (paga) { col[tipo].push(_filaPagada(c, f, paga, tipo)); return; }
      const no = _turnoUsado(c, tipo);
      col[tipo].push({ no, html: _fila({ id: 'rasgo-' + f.id, icono: 'iconos/habilidades', nombre: f.name, num: '', no,
        sub: [f.range, f.desc].filter(Boolean).join(' · '),
        det: `<p>${esc(f.desc || '')}</p><div class="mesa-acc"><button class="mesa-btn p" onclick="event.stopPropagation();Mesa.usarRasgo('${tipo}','${f.id}')">Usar · ${ETQ[tipo]}</button>
          <button class="mesa-btn" onclick="event.stopPropagation();App.openFeatureDetail && App.openFeatureDetail('${f.id}')">Ficha completa</button></div>` }) });
    });

    // Echo Knight: el eco va aunque el personaje no tenga guardado el rasgo (como la vista de siempre,
    // que se fija en la subclase); el texto sale del catálogo
    const esEco = c.subclase === 'Echo Knight' || (c.classes || []).some(x => x && x.subclass === 'Echo Knight');
    if (esEco && !col.bonusAction.some(x => x.eco)) {
      const sub = Characters.SUBCLASES_CONFIG && Characters.SUBCLASES_CONFIG['Echo Knight'];
      const f = sub && sub.features ? sub.features(c.nivel || 3).find(x => x.id === 'ek-manifest-echo') : null;
      col.bonusAction.push(_filaEco(c, f || { desc: '' }));
    }

    const columna = (tipo, titulo, campo) => `
      <section class="mesa-card mesa-col">
        <div class="mesa-col-hd">${titulo}<button class="mesa-chip ${t[campo] ? 'devolver' : 'on'}" onclick="Mesa.turno('${campo}')"
          title="${t[campo] ? 'Te equivocaste o te arrepentiste: devuelve la acción' : 'Marcarla como usada'}">${t[campo] ? 'usada · ↺ devolver' : 'disponible'}</button></div>
        <div class="mesa-col-bd">${_columnaItems(col[tipo], 'no-' + tipo) || '<p class="mesa-vacio">Nada que usar aquí.</p>'}
          ${tipo === 'bonusAction' && _nivelPicaro(c) >= 2 ? `<div class="mesa-rapidas" title="Cunning Action">${[
            'Correr', 'Destrabarse', 'Esconderse', ...(_subPicaro(c) === 'Thief' && _nivelPicaro(c) >= 3 ? ['Juego de manos', 'Usar objeto'] : [])].map(n =>
            `<button class="mesa-chip" onclick="App.usarRecursoTurno('bonusAction')?App.showToast('${n} · Acción adicional'):App.showToast('Ya usaste tu Acción adicional')">${n}</button>`).join('')}</div>` : ''}
          ${tipo === 'action' ? `<div class="mesa-rapidas">${['Correr', 'Destrabarse', 'Esquivar', 'Ayudar', 'Esconderse', 'Influir', 'Buscar'].map(n =>
            `<button class="mesa-chip" onclick="App.usarRecursoTurno('action')||App.showToast('Ya usaste tu Acción')">${n}</button>`).join('')}</div>` : ''}
        </div>
      </section>`;

    return `
      <div class="mesa-grid">
        <div class="mesa-centro">
          <div class="mesa-acciones">
            ${columna('action', 'Acción', 'action')}
            <div class="mesa-pila">${columna('bonusAction', 'Adicional', 'bonus')}${columna('reaction', 'Reacción', 'reaction')}</div>
          </div>
        </div>
        <aside class="mesa-der">${_apoyo(c, 'combate')}</aside>
      </div>`;
  }

  // Rasgo que se paga con un uso de otro recurso: muestra el daño grande y cuántos usos quedan
  function _filaPagada(c, f, r, tipo) {
    const hayEspacio = f.oEspacio && Object.values(c.spellSlots || {}).some(x => x && x.current > 0);
    const no = r.current <= 0 && !hayEspacio ? `Sin usos de ${r.name} · vuelve con ${DESCANSO(r)}` : _turnoUsado(c, tipo);
    const dmg = f.damage ? String(f.damage).split(' ')[0] : '';
    return { no, html: _fila({ id: 'rasgo-' + f.id, icono: 'iconos/habilidades', nombre: f.name, num: '', no, dmg,
      sub: [`gasta 1 ${r.name} (${r.current}/${r.max})`, f.curacion ? `cura ${f.curacion}` : '', f.range].filter(Boolean).join(' · '),
      det: `<p>${esc(f.desc || '')}</p><div class="mesa-acc"><button class="mesa-btn p" ${r.current > 0 ? '' : 'disabled'} onclick="event.stopPropagation();Mesa.usarPagado('${tipo}','${f.id}','${r.id}')">Usar · ${ETQ[tipo]} · gasta 1 ${esc(r.name)}</button>
        ${f.oEspacio ? `<button class="mesa-btn" onclick="event.stopPropagation();Mesa.usarPagado('${tipo}','${f.id}','espacio')">Usar · gasta un espacio de conjuro</button>` : ''}
        <button class="mesa-btn" onclick="event.stopPropagation();App.openFeatureDetail && App.openFeatureDetail('${f.id}')">Ficha completa</button></div>` }) };
  }

  // Circle of the Land: el terreno elegido tras el descanso largo
  function _terreno(c) {
    const esTierra = c.subclase === 'Circle of the Land' || (c.classes || []).some(x => x && x.subclass === 'Circle of the Land');
    if (!esTierra || (c.nivel || 1) < 3) return '';
    const T = Characters.TERRENOS_TIERRA, actual = T[c.landType];
    // Ya elegido: solo se informa; se cambia al terminar un descanso largo.
    if (actual) return `<div class="mesa-card mesa-terreno"><span class="mesa-lbl">Terreno</span>
      <span class="mesa-chip on">${actual.nombre}</span>
      <small>Se cambia al terminar un descanso largo${(c.nivel || 1) >= 10 ? ` · resistencia a ${actual.resistencia.toLowerCase()}` : ''}</small></div>`;
    return `<div class="mesa-card mesa-terreno"><span class="mesa-lbl">Terreno</span>
      ${Object.entries(T).map(([k, t]) => `<button class="mesa-chip" onclick="App.setLandType('${k}')">${t.nombre}</button>`).join('')}
      <small>Elige uno: sus conjuros quedan siempre preparados</small></div>`;
  }

  function _filaRecurso(c, r, etiqueta) {
    const no = _motivoRecurso(c, r);
    return { no, html: _fila({
      id: 'rec-' + r.id, icono: 'iconos/recursos', nombre: r.name, num: '', no,
      sub: `${etiqueta ? etiqueta + ' · ' : ''}${r.current}/${r.max} usos${r.note ? ' · ' + r.note : ''}${
        r.id === 'second-wind' && (c.features || []).some(f => f.id === 'tactical-shift') ? ' · y te mueves ½ velocidad sin provocar ataques de oportunidad' : ''}`,
      det: `<p>${esc(r.desc || '')}</p><div class="mesa-acc">${(opciones => opciones.length
          ? opciones.map(f => `<button class="mesa-btn p" ${r.current > 0 ? '' : 'disabled'} onclick="event.stopPropagation();App.adjustResource('${r.id}',-1);App.showToast('${esc(f.name).replace(/'/g, '’')}')" title="${esc(f.desc || '')}">${esc(f.name)}</button>`).join('')
          : `<button class="mesa-btn p" ${r.current > 0 ? '' : 'disabled'} onclick="event.stopPropagation();App.adjustResource('${r.id}',-1)">Usar (${r.current}/${r.max})</button>`)(
          /channel divinity/i.test(r.name || '') ? (c.features || []).filter(f => /^channel divinity/i.test(f.source || '')) : [])}
        ${(g => g ? `<button class="mesa-btn" onclick="event.stopPropagation();Mesa.gratis('${g.id}','${r.id}')">✦ Gratis con ${esc(g.name)} (${g.current}/${g.max})</button>` : '')(_gratisPara(c, r))}</div>`,
    }) };
  }

  /* ══ Fuera de combate: explorar, hablar, preparar y descansar ══ */
  function _fuera(c) {
    const prep = (c.spells || []).filter(sp => preparado(c, sp));
    const usados = new Set();
    const toma = (lista) => lista.filter(sp => !usados.has(sp.id) && usados.add(sp.id));
    const fila = sp => ({ no: _motivoConjuro(c, sp, 'other'), html: _filaConjuro(c, sp, { via: 'other' }) });

    // Ayudar en una prueba: lo que suma a pruebas, ataques o salvaciones de otros
    // Solo lo que SUMA a pruebas (Guidance +1d4, Enhance Ability ventaja), no lo que obliga a
    // hacer una (Entangle: "escapa con prueba de Atletismo")
    const SUMA = /(1d4|ventaja)[^·.]*(prueba|check)/i;
    const ayuda = toma(prep.filter(sp => !sp.damage && SUMA.test(sp.desc || ''))).map(fila)
      .concat((c.resources || []).filter(r => r.max && SUMA.test(`${r.desc || ''} ${r.note || ''}`)).map(r => _filaRecurso(c, r)));
    // Rituales: sin espacio si está preparado (+10 min)
    const rituales = toma((c.spells || []).filter(sp => sp.ritual && sp.level > 0)).map(sp => ({
      no: preparado(c, sp) ? '' : 'No preparado: prepáralo para lanzarlo como ritual', html: _filaConjuro(c, sp, { via: 'other', ritual: true }) }));
    // Preparación y utilidad: lo que se lanza antes de pelear o lleva más de un turno
    const utiles = toma(prep.filter(sp => sp.combat === false || Characters.getActivation(sp) === 'other'
      || (!sp.concentration && /\b\d+ ?h\b|hora/i.test(sp.duration || '')))).map(fila);
    const rasgos = (c.resources || []).filter(r => r.max && !ayuda.some(x => x.html.includes(`rec-${r.id}'`))).map(r => _filaRecurso(c, r));
    const guia = (c.ifttt || []).filter(x => /pre-?combate|antes/i.test(x.section || ''));
    const limpiar = h => esc(String(h || '').replace(/<[^>]+>/g, ''));

    // Si no hay nada que se pueda usar, el bloque no aparece (Torvald sin rituales preparados)
    const bloque = (titulo, items, grupo) => items.some(x => !x.no) ? `<section class="mesa-card mesa-col">
      <div class="mesa-col-hd">${titulo}</div>
      <div class="mesa-col-bd">${_columnaItems(items, grupo)}</div></section>` : '';

    const bestia = _bestia(c);
    return `
      <div class="mesa-grid">
        <div class="mesa-centro">
          <div class="mesa-modo">Fuera de combate · lo que puedes hacer al explorar, hablar o prepararte. <button class="mesa-chip on" onclick="Mesa.combate(true)">⚔ Iniciar combate</button></div>
          ${_terreno(c)}
          ${[ayuda, rasgos, rituales, utiles].some(l => l.some(x => !x.no)) || guia.length ? '' : '<p class="mesa-vacio mesa-nada">Nada especial que usar fuera de combate. Tus tiradas están a la izquierda y tus recursos a la derecha.</p>'}
          <div class="mesa-fuera">
              ${bloque('Ayudar en una prueba', ayuda, 'no-ayuda')}
              ${bloque('Rasgos', rasgos, 'no-rasgos')}
              ${bloque('Rituales', rituales, 'no-rituales')}
              ${bloque('Preparación y utilidad', utiles, 'no-utiles')}
              ${guia.length ? `<section class="mesa-card mesa-col"><div class="mesa-col-hd">Tu guía antes de pelear</div><div class="mesa-col-bd mesa-guia">${
                guia.map(x => `<div><small>${limpiar(x.trigger)}</small>${limpiar(x.action)}</div>`).join('')}</div></section>` : ''}
          </div>
        </div>
        <aside class="mesa-der">${_apoyo(c, 'combate')}</aside>
      </div>`;
  }

  function _fila({ id, icono, nombre, num, sub, det, tags = '', no = '', dmg = '' }) {
    const ab = st.abierto === id;
    return `<div data-id="${id}" class="mesa-op ${ab ? 'abierto' : ''} ${no ? 'no' : ''}" onclick="Mesa.abrir('${id}')">
      <span class="mesa-t"><i class="mesa-ico" style="--m:url(../assets/${icono}.svg)"></i></span>
      <div class="mesa-op-tx"><b>${esc(limpio(nombre))}</b>${dmg ? `<span class="mesa-golpe"><span class="mesa-num">${num}</span><span class="mesa-dmg">${esc(dmg)}</span></span>` : ''}<small>${num && !dmg ? `<span class="mesa-num">${num}</span> · ` : ''}${esc(sub)}</small>${no ? `<em class="mesa-motivo">${esc(no)}</em>` : ''}</div>
      ${tags}<span class="mesa-mas">›</span>
      ${ab ? `<div class="mesa-det" onclick="event.stopPropagation()">${det}</div>` : ''}
    </div>`;
  }

  function _iconoArma(w) {
    const n = `${w.id || ''} ${w.name || ''}`;
    if (/bow|crossbow|arco|ballesta/i.test(n)) return 'pergamino/arma-arco';
    if (/axe|hacha/i.test(n)) return 'pergamino/arma-hacha';
    if (/mace|maza|hammer|martillo|club|garrote/i.test(n)) return 'pergamino/arma-maza';
    if (/dagger|daga/i.test(n)) return 'pergamino/arma-daga';
    if (/spear|lanza|javelin|jabalina|staff|bast[oó]n/i.test(n)) return 'pergamino/arma-lanza';
    if (/sword|espada|scimitar|cimitarra|rapier|estoque/i.test(n)) return 'pergamino/arma-espada';
    return 'iconos/ataques';
  }

  /* Munición del arma (flechas, virotes…): la cantidad es la del ítem en
     la mochila y se ve en el nombre del arma. Se agrega o quita en Ítems;
     aquí solo se recupera la mitad tras pelear. */
  function _municion(c, w) {
    const tipo = Characters.getAmmoType && Characters.getAmmoType(w);
    if (!tipo) return null;
    const enMochila = Characters.getAmmoItem(c, tipo, w);
    return { key: tipo.key, label: tipo.label, qty: enMochila ? (parseInt(enMochila.item.qty) || 0) : null, spent: ((c.ammo || {})[tipo.key] || {}).spent || 0 };
  }
  function _controlMunicion(m) {
    return m.spent > 0 ? `<div class="mesa-mun" onclick="event.stopPropagation()"><button class="mesa-chip" onclick="App.recuperarMunicion('${m.key}')" title="Tras el combate recuperas la mitad de lo disparado">↺ Recuperar ${Math.floor(m.spent / 2)} ${esc(m.label.toLowerCase())}</button></div>` : '';
  }

  /* Marcar o devolver una acción del turno. Devolver la Acción también
     devuelve los ataques hechos con ella (si no, el arma seguía bloqueada). */
  function turno(campo) {
    const c = App.getActiveChar();
    const t = (c && c.turn) || {};
    if (campo === 'action' && t.action && t.attacksUsed) App.usarAtaque(-t.attacksUsed);
    App.toggleRecursoTurno(campo);
  }

  // El ataque de oportunidad gasta la Reacción, no un ataque de la acción
  function oportunidad() {
    if (!App.usarRecursoTurno('reaction')) { App.showToast('Ya usaste tu Reacción este turno'); return; }
    App.showToast('Reacción marcada');
  }

  /* Tarjeta del compañero (Beast Master): tipo, vida, números y, plegados,
     sus rasgos. Todo llama a App: mismas reglas que la vista de siempre. */
  const ICONO_BESTIA = { land: 'iconos/companero', sea: 'iconos/bestia-mar', sky: 'iconos/bestia-cielo' };
  const NOMBRE_BESTIA = { land: 'Tierra', sea: 'Mar', sky: 'Cielo' };
  // "40 ft · Trepa 40 ft" → metros de mesa (5 ft = 1,5 m); App.fmtDist respeta la unidad elegida
  const _ftAm = t => App.fmtDist(String(t || '').replace(/(\d+)\s*ft/g, (_, n) => `${String(n / 5 * 1.5).replace('.', ',')} m`));
  /* ══ Wild Shape (Druida): tus formas conocidas y la forma activa ══ */
  function _nivelDruida(c) {
    if (Array.isArray(c.classes) && c.classes.length) return (c.classes.find(x => x && x.name === 'Druida') || {}).level || 0;
    return c.clase === 'Druida' ? (c.nivel || 1) : 0;
  }
  const _vels = b => [b.vel, b.nadar && `nadar ${b.nadar}`, b.trepar && `trepar ${b.trepar}`, b.volar && `volar ${b.volar}`, b.excavar && `excavar ${b.excavar}`].filter(Boolean).join(' · ');
  function _tarjetaForma(c) {
    const forma = Characters.formaWildShapeActiva(c);
    const r = (c.resources || []).find(x => x.id === 'wild-shape');
    const usos = r ? `${r.current}/${r.max} usos` : '';
    if (forma) {
      const ab = st.grupos.has('forma-rasgos');
      return `<div class="mesa-card mesa-comp mesa-forma">
        <div class="mesa-comp-top"><span class="mesa-med"><i class="mesa-ico" style="--m:url(../assets/iconos/companero.svg)"></i></span>
          <div class="mesa-comp-nom"><b>${esc(forma.nombre)}</b><small>VD ${esc(forma.vd)} · ${esc(forma.tamano || '')} · ${usos}</small></div></div>
        <div class="mesa-mini"><div><b>${forma.ca}</b><span class="mesa-lbl">CA</span></div><div><b>${forma.for}</b><span class="mesa-lbl">FUE</span></div>
          <div><b>${forma.des}</b><span class="mesa-lbl">DES</span></div><div><b>${forma.con}</b><span class="mesa-lbl">CON</span></div></div>
        <p class="mesa-forma-vel">${esc(_vels(forma))}</p>
        ${(forma.ataques || []).map(a => `<div class="mesa-forma-atk"><span>${esc(a.nombre)}</span><span class="mesa-golpe"><span class="mesa-num">${sg(a.golpe)}</span><span class="mesa-dmg">${esc(a.daño)}</span></span></div>`).join('')}
        <button class="mesa-plegar" onclick="Mesa.grupo('forma-rasgos')">${ab ? '▾' : '▸'} Sentidos, habilidades y rasgos</button>
        ${ab ? `<div class="mesa-rasgos"><p><b>Sentidos</b> ${esc(forma.sentidos || '—')}</p>${forma.habilidades ? `<p><b>Habilidades</b> ${esc(forma.habilidades)}</p>` : ''}
          ${(forma.rasgos || []).map(t => `<p>${esc(t)}</p>`).join('')}
          <p class="mesa-vacio">Conservas tus PG, INT, SAB, CAR, rasgos de clase y dotes. No puedes lanzar conjuros.</p></div>` : ''}
        <button class="mesa-btn mesa-ancho" onclick="App.wildShapeTerminar()">Terminar forma · Acción adicional</button>
      </div>`;
    }
    const conocidas = ((c.wildShape && c.wildShape.conocidas) || []).map(id => Characters.BESTIAS_WILD_SHAPE.find(b => b.id === id)).filter(Boolean);
    const sinUsos = !r || r.current <= 0;
    return `<div class="mesa-card mesa-comp mesa-forma">
      <div class="mesa-forma-hd"><span class="mesa-lbl">Tus formas</span><small>${usos} · Acción adicional</small></div>
      ${conocidas.length ? `<div class="mesa-forma-lista">${conocidas.map(b => `<button class="mesa-btn ${sinUsos ? '' : 'p'}" ${sinUsos ? 'disabled' : ''} onclick="App.wildShapeTransformar('${b.id}')">${esc(b.nombre)}<small>CA ${b.ca} · VD ${esc(b.vd)}</small></button>`).join('')}</div>`
        : '<p class="mesa-vacio">Elige tus formas conocidas en Habilidades.</p>'}
      <button class="mesa-link" onclick="App.switchTab('habilidades')">Elegir formas (${conocidas.length}/${Characters.formasConocidasWildShape(_nivelDruida(c))}) ▸</button>
    </div>`;
  }
  // Configuración: qué formas conoces (las disponibles según tu nivel)
  function _formasConfig(c) {
    const nv = _nivelDruida(c);
    if (nv < 2) return '';
    const max = Characters.formasConocidasWildShape(nv), lim = Characters.limiteWildShape(nv);
    const conocidas = (c.wildShape && c.wildShape.conocidas) || [];
    const lista = Characters.formasWildShapeDisponibles(nv);
    return `<div class="mesa-card mesa-propios mesa-formas-cfg">
      <div class="mesa-col-hd">Formas de Wild Shape · ${conocidas.length}/${max}<small>VD ≤ ${lim.vd === 0.25 ? '1/4' : lim.vd === 0.5 ? '1/2' : '1'}${lim.vuelo ? '' : ' · sin vuelo'} · cambias una tras un descanso largo</small></div>
      <div class="mesa-formas-grid">${lista.map(b => `<button class="mesa-chip ${conocidas.includes(b.id) ? 'on' : ''}" onclick="App.wildShapeConocida('${b.id}');Mesa.render()" title="${esc(_vels(b))}">${esc(b.nombre)} <small>VD ${esc(b.vd)}</small></button>`).join('')
        || '<p class="mesa-vacio">No hay fichas de bestias cargadas.</p>'}</div></div>`;
  }

  function _tarjetaBestia(c, bestia) {
    const comp = c.companion || {};
    const tipos = Object.keys(NOMBRE_BESTIA).map(id => `<button class="mesa-tipo ${bestia && comp.beast === id ? 'on' : ''}" onclick="Mesa.tipoBestia('${id}')">
      <i class="mesa-ico" style="--m:url(../assets/${ICONO_BESTIA[id]}.svg)"></i>${NOMBRE_BESTIA[id]}</button>`).join('');
    if (!bestia) return `<div class="mesa-card mesa-comp"><p class="mesa-vacio">${comp.beast ? 'Desconjurado.' : 'Elige a tu compañero.'}</p><div class="mesa-tipos">${tipos}</div></div>`;
    const pct = bestia.max ? bestia.pg / bestia.max : 0;
    const abierto = st.grupos.has('bestia-rasgos');
    const caido = bestia.pg <= 0;
    return `<div class="mesa-card mesa-comp">
      <div class="mesa-comp-top"><span class="mesa-med"><i class="mesa-ico" style="--m:url(../assets/${ICONO_BESTIA[comp.beast] || 'iconos/companero'}.svg)"></i></span>
        <div class="mesa-comp-nom">
          <input class="mesa-inline mesa-inline-nom" value="${esc(comp.name || '')}" placeholder="Nombre" onchange="App.setCompanionField('name', this.value)" onkeydown="if(event.key==='Enter')this.blur()">
          <input class="mesa-inline" value="${esc(_animal(comp))}" placeholder="${{ land: 'Animal (oso, lobo…)', sea: 'Animal (tiburón, pulpo…)', sky: 'Animal (águila, búho…)' }[comp.beast] || 'Animal'}"
            onchange="Mesa.animal(this.value)" onkeydown="if(event.key==='Enter')this.blur()">
        </div></div>
      <div class="mesa-tipos">${tipos}</div>
      <div class="mesa-comp-pg"><span class="mesa-lbl">PG</span><b>${bestia.pg} / ${bestia.max}</b><span class="mc-esp"></span>
        <div class="mesa-comp-ctl"><input class="mesa-comp-in" type="number" inputmode="numeric" min="1" placeholder="0" onkeydown="if(event.key==='Enter')Mesa.vidaBestia(this,-1)">
        <button class="mesa-btn mc-dmg" onclick="Mesa.vidaBestia(this,-1)">Daño</button><button class="mesa-btn mc-heal" onclick="Mesa.vidaBestia(this,1)">Curar</button></div></div>
      <div class="mesa-barra ${pct <= 0.25 ? 'mc-crit' : pct <= 0.5 ? 'mc-mid' : 'mc-ok'}">${Array.from({ length: 10 }, (_, i) => `<i class="${i < Math.round(pct * 10) ? '' : 'v'}"></i>`).join('')}</div>
      ${caido ? `<button class="mesa-btn p mesa-ancho" onclick="App.openCompanionRevive()">Revivir a ${esc(comp.name || 'tu compañero')}</button>` : ''}
      <div class="mesa-mini"><div><b>${bestia.ca}</b><span class="mesa-lbl">CA</span></div><div><b>${sg(bestia.golpe)}</b><span class="mesa-lbl">Ataque</span></div>
        <div><b>${esc(bestia.daño)}</b><span class="mesa-lbl">Daño</span></div></div>
      <button class="mesa-plegar" onclick="Mesa.grupo('bestia-rasgos')">${abierto ? '▾' : '▸'} Rasgos de ${esc(comp.name || 'tu compañero')}</button>
      ${abierto ? `<div class="mesa-rasgos">
        <p><b>Velocidad</b> ${esc(_ftAm(bestia.b.speed))}</p><p><b>Sentidos</b> ${esc(bestia.b.senses || '')}</p>
        ${[bestia.ataque, ...(bestia.b.traits || [])].map((t, i) => {
          // Solo el título; el texto se abre al tocarlo, uno a la vez si quieres
          const k = 'rasgo-' + i, ab = st.grupos.has(k);
          return `<button class="mesa-rasgo ${ab ? 'abierto' : ''}" onclick="Mesa.grupo('${k}')"><span>${esc(t.name)}</span><span class="mesa-mas">›</span></button>
            ${ab ? `<p class="mesa-rasgo-tx">${esc(t.desc || '')}</p>` : ''}`;
        }).join('')}
        ${bestia.nivel >= 7 ? `<button class="mesa-chip ${comp.forceDamage ? 'on' : ''}" onclick="App.toggleCompanionForceDamage()">Daño de fuerza (Exceptional Training)</button>` : ''}
      </div>` : ''}
    </div>`;
  }

  /* El nombre es uno solo, pero el animal depende del tipo: un oso en
     tierra, un tiburón en el mar, un águila en el cielo. Se guarda por tipo
     (companion.kind_land / kind_sea / kind_sky); el de tierra hereda el
     "kind" que ya existía. */
  const _animal = comp => comp[`kind_${comp.beast}`] ?? (comp.beast === 'land' ? comp.kind || '' : '');
  // Cambiar de tipo trae el animal guardado para ese tipo
  function tipoBestia(id) {
    App.setCompanionBeast(id);
    const c = App.getActiveChar();
    if (c && c.companion && c.companion.beast === id) App.setCompanionField('kind', _animal(c.companion));
  }
  function animal(valor) {
    const c = App.getActiveChar();
    if (!c || !c.companion || !c.companion.beast) return;
    App.setCompanionField(`kind_${c.companion.beast}`, valor);
    App.setCompanionField('kind', valor);   // la vista de siempre muestra el del tipo actual
  }

  // Beast Master (PHB 2024): CA 13 + SAB, golpe = SAB + BC, daño + SAB
  function _bestia(c) {
    const comp = c.companion;
    const b = comp && comp.beast && comp.summoned !== false ? Characters.PRIMAL_COMPANION_BEASTS[comp.beast] : null;
    if (!b) return null;
    const sab = Characters.calcMod(c.stats.sab), pb = Characters.calcProfBonus(c.nivel);
    const nivel = c.classes && c.classes.length ? ((c.classes.find(x => x.name === 'Explorador') || {}).level || 0) : c.nivel;
    const max = b.calcMaxHP(nivel);
    const a = b.attacks[0];
    return { b, nivel, ca: 13 + sab, max, pg: comp.hp != null ? comp.hp : max, golpe: sab + pb, ataque: a,
      daño: `${a.damageDie}+${a.damageBonus + sab}${nivel >= 11 ? ' ×2' : ''}` };
  }

  /* ══ Columna derecha: bloques según lo que tenga el personaje ══ */
  function _apoyo(c, tab) {
    const bloques = [];
    const conc = c.concentration ? (c.spells || []).find(s => s.id === c.concentration) : null;
    const lanzador = (c.spells || []).length > 0;
    const bloqueConc = lanzador ? `<section><div class="mesa-sec">Concentración</div><div class="mesa-card mesa-conc">
      ${conc || c.concentration ? `<span class="mesa-lbl">Activa</span><b>${esc(limpio(conc ? conc.name : c.concentration))}</b>
        ${conc && conc.duration ? `<small>${esc(conc.duration.replace(/^Concentraci[oó]n\s*\(?|\)$/gi, ''))}</small>` : ''}
        <button class="mesa-btn" onclick="App.setConc(null)">Terminar</button>` : '<span class="mesa-vacio">Ninguna</span>'}</div></section>` : '';

    const bestia = _bestia(c);
    const bloqueBestia = c.companion ? `<section><div class="mesa-sec">Compañero</div>${_tarjetaBestia(c, bestia)}</section>`
      : _nivelDruida(c) >= 2 ? `<section><div class="mesa-sec">Wild Shape</div>${_tarjetaForma(c)}</section>` : '';

    // Primero lo que define al personaje: el furtivo del Pícaro, el compañero en un Beast Master, la concentración en un lanzador
    // Caído a 0 PG: las tiradas de muerte van antes que todo (se pueden plegar)
    const bloqueMuerte = _muerte(c);
    if (bloqueMuerte) bloques.push(bloqueMuerte);
    const bloqueFurtivo = tab === 'combate' ? _furtivo(c) : '';
    if (bloqueFurtivo) bloques.push(bloqueFurtivo);
    const bloqueEco = tab === 'combate' ? _tarjetaEco(c) : '';
    if (bloqueEco) bloques.push(bloqueEco);
    if (bloqueBestia) bloques.push(bloqueBestia, bloqueConc); else bloques.push(bloqueConc);

    const puntos = (n, total, fn) => `<span class="mesa-pts">${Array.from({ length: total }, (_, i) =>
      `<i class="${i < n ? '' : 'u'}" onclick="${fn(i)}"></i>`).join('')}</span>`;
    const recs = (c.resources || []).filter(r => r.max > 0 && !(bloqueEco && r.id === 'echo-unleash')).map(r => `<div class="mesa-rec"><div>${esc(limpio(r.name))}<small>${esc(r.action || '')}</small></div>
      ${puntos(r.current, r.max, i => `App.toggleResourceDot('${r.id}',${i})`)}</div>`);
    if (tab === 'combate') {
      for (let lv = 1; lv <= 9; lv++) {
        const s = c.spellSlots && c.spellSlots[lv];
        if (s && s.max > 0) recs.push(`<div class="mesa-rec"><div>Espacios nivel ${lv}</div>${puntos(s.current, s.max, i => `App.toggleSlotDot(${lv},${i})`)}</div>`);
      }
    }
    if (c.hitDice && c.hitDice.max) recs.push(`<div class="mesa-rec"><div>Dados de golpe d${c.hitDie || ''}</div>${puntos(c.hitDice.current, c.hitDice.max, i => `App.toggleHitDieDot(${i})`)}</div>`);
    if (recs.length) bloques.push(`<section><div class="mesa-sec">Recursos</div><div class="mesa-card">${recs.join('')}</div></section>`);

    if (tab === 'conjuros' && (c.slotPriority || []).length) bloques.push(`<section><div class="mesa-sec">Prioridad de espacios</div><div class="mesa-card mesa-prio">${
      c.slotPriority.map(p => `<div>${esc(p.label)}<small>${esc(p.note || '')}</small></div>`).join('')}</div></section>`);

    const conds = c.conditions || [];
    const todas = st.grupos.has('conds');
    const chips = CONDICIONES.filter(([id]) => todas || conds.includes(id)).map(([id, n]) =>
      `<button class="mesa-chip ${conds.includes(id) ? 'on' : ''}" onclick="App.toggleCondition('${id}')">${n}</button>`).join('');
    bloques.push(`<section><div class="mesa-sec">Condiciones</div><div class="mesa-card mesa-conds"><div class="mesa-rapidas">${chips || '<span class="mesa-vacio">Ninguna</span>'}</div>
      <button class="mesa-plegar" onclick="Mesa.grupo('conds')">${todas ? '▾ Ocultar las demás' : '▸ Agregar condición'}</button></div></section>`);
    return bloques.join('');
  }

  /* ── Tiradas de salvación contra la muerte (PHB 2024) ───────────────── */
  function _muerte(c) {
    if (!c.hp || c.hp.current > 0) return '';
    const ds = c.deathSaves || { successes: 0, failures: 0 };
    const ex = Math.min(3, ds.successes || 0), fa = Math.min(3, ds.failures || 0);
    const estado = fa >= 3 ? 'Muerto' : ex >= 3 ? 'Estable' : 'Caído';
    const puntos = (n, tipo) => Array.from({ length: 3 }, (_, i) =>
      `<i class="${tipo} ${i < n ? 'on' : ''}" onclick="App.toggleDeathSave('${tipo}',${i})"></i>`).join('');
    const marcador = `<span class="mesa-ds"><span title="Éxitos">✓ ${puntos(ex, 'success')}</span><span title="Fallos">✗ ${puntos(fa, 'failure')}</span></span>`;
    if (st.grupos.has('muerte')) return `<section><div class="mesa-card mesa-muerte min">
      <button class="mesa-plegar" onclick="Mesa.grupo('muerte')">▸ ☠ ${estado}</button>${marcador}</div></section>`;
    const fin = fa >= 3 || ex >= 3;
    return `<section><div class="mesa-sec">Tiradas de muerte</div><div class="mesa-card mesa-muerte ${fa >= 3 ? 'muerto' : ex >= 3 ? 'estable' : ''}">
      <div class="mesa-muerte-hd"><b>☠ ${estado}</b>${marcador}<button class="mesa-plegar" onclick="Mesa.grupo('muerte')">▾ Minimizar</button></div>
      ${fin ? `<small class="mesa-furtivo-req">${fa >= 3 ? 'Tres fallos: el personaje muere.' : 'Tres éxitos: quedas Estable a 0 PG, sin tirar más. Recuperas 1 PG en 1d4 horas.'}</small>`
        : `<div class="mesa-rapidas">
        <button class="mesa-chip" onclick="Mesa.muerte('exito')">10–19 · éxito</button>
        <button class="mesa-chip" onclick="Mesa.muerte('fallo')">2–9 · fallo</button>
        <button class="mesa-chip" onclick="Mesa.muerte('nat1')">1 natural · 2 fallos</button>
        <button class="mesa-chip on" onclick="Mesa.muerte('nat20')">20 natural · 1 PG</button></div>
      <small class="mesa-furtivo-req">Al inicio de tu turno tiras d20, sin modificadores. Si recibes daño a 0 PG es 1 fallo (2 si es crítico); si el daño iguala tus PG máximos, mueres.</small>`}
      <div class="mesa-acc"><button class="mesa-btn" onclick="App.resetDeathSaves()">Reiniciar</button></div>
    </div></section>`;
  }
  function muerte(tipo) {
    const c = App.getActiveChar();
    if (!c) return;
    if (tipo === 'nat20') { App.adjustHP(1); return; }   // recuperar PG limpia las tiradas
    const ds = c.deathSaves || { successes: 0, failures: 0 };
    if (tipo === 'exito') App.toggleDeathSave('success', Math.min(2, ds.successes || 0));
    else {
      const n = Math.min(3, (ds.failures || 0) + (tipo === 'nat1' ? 2 : 1));
      App.toggleDeathSave('failure', n - 1);
    }
  }

  const _tieneDote = (c, nombre) => (c.features || []).some(f => f.name === nombre);

  /* ── Pícaro: Ataque furtivo y Cunning Strike ─────────────────────────── */
  function _nivelPicaro(c) {
    const cl = (c.classes || []).find(x => x && x.name === 'Pícaro');
    return cl ? (cl.level || 0) : c.clase === 'Pícaro' ? (c.nivel || 1) : 0;
  }
  function _subPicaro(c) {
    const cl = (c.classes || []).find(x => x && x.name === 'Pícaro');
    return (cl && cl.subclass) || (c.clase === 'Pícaro' ? c.subclase || '' : '');
  }
  // Dados que quedan tras pagar los efectos elegidos de Cunning Strike
  function _calcFurtivo(c) {
    const nv = _nivelPicaro(c), sub = _subPicaro(c), dados = Math.ceil(nv / 2);
    const ops = (Characters.GOLPES_ASTUTOS || []).filter(g => nv >= g.nivel && (!g.sub || g.sub === sub));
    const sel = ops.filter(g => st.golpes.has(g.id));
    return { nv, sub, dados, ops, sel, quedan: dados - sel.reduce((n, g) => n + g.costo, 0), maxEf: nv >= 11 ? 2 : 1,
      cd: 8 + Characters.calcMod(c.stats.des) + Characters.calcProfBonus(c.nivel) };
  }
  function _furtivo(c) {
    if (!_nivelPicaro(c)) return '';
    const { nv, sub, dados, ops, sel, quedan, maxEf, cd } = _calcFurtivo(c);
    const usado = !!(c.turn && c.turn.furtivo);
    const notas = [];
    if (sub === 'Assassin' && nv >= 3) notas.push(`1.ª ronda: ventaja contra quien no ha actuado y +${nv} de daño (Assassinate)${nv >= 17 ? ` · Death Strike: TS CON CD ${cd} o daño doble` : ''}`);
    if (sub === 'Soulknife' && nv >= 17) notas.push(`Con Hoja psíquica: Rend Mind, TS SAB CD ${cd} o Aturdido`);
    const chips = ops.map(g => {
      const on = st.golpes.has(g.id), no = !on && (sel.length >= maxEf || g.costo > quedan);
      return `<button class="mesa-chip ${on ? 'on' : ''}" ${no ? 'disabled' : ''} onclick="Mesa.golpe('${g.id}')">${g.nombre} −${g.costo}d6</button>`;
    }).join('');
    const efectos = sel.map(g => `<li><b>${g.nombre}</b>${g.ts ? ` · TS ${g.ts} CD ${cd}` : ''}: ${esc(g.efecto)}${g.id === 'poison' && sub === 'Assassin' && nv >= 13 ? ' Además 2d6 de veneno cada vez que falla (Envenom Weapons).' : ''}</li>`).join('');
    return `<section><div class="mesa-sec">Ataque furtivo</div><div class="mesa-card mesa-furtivo ${usado ? 'usado' : ''}">
      <div class="mesa-furtivo-hd"><b class="mesa-dmg">${quedan > 0 ? quedan + 'd6' : '—'}</b>
        <small>${quedan < dados ? `de ${dados}d6 · ` : ''}1 vez por turno</small>
        <button class="mesa-chip ${usado ? 'devolver' : 'on'}" onclick="App.marcarFurtivo(${!usado})">${usado ? 'usado · ↺ devolver' : 'disponible'}</button></div>
      <small class="mesa-furtivo-req">Arma sutil o a distancia, con ventaja; o con un aliado a 1,5 m del objetivo y sin desventaja.</small>
      ${notas.map(x => `<small class="mesa-furtivo-req">${esc(x)}</small>`).join('')}
      ${ops.length ? `<span class="mesa-lbl">Cunning Strike${maxEf > 1 ? ' · hasta 2' : ''} · CD ${cd}</span><div class="mesa-rapidas">${chips}</div>${efectos ? `<ul class="mesa-golpes">${efectos}</ul>` : ''}` : ''}
      ${usado ? '' : `<div class="mesa-acc"><button class="mesa-btn p" onclick="Mesa.furtivo()">Aplicar furtivo${quedan > 0 ? ` · ${quedan}d6` : ''}</button></div>`}
    </div></section>`;
  }
  function golpe(id) { if (st.golpes.has(id)) st.golpes.delete(id); else st.golpes.add(id); _pintar(); }
  function furtivo() {
    const c = App.getActiveChar();
    if (!c) return;
    const { quedan, sel } = _calcFurtivo(c);
    st.golpes.clear();
    App.marcarFurtivo(true);
    App.showToast(`Furtivo ${quedan > 0 ? quedan + 'd6' : 'sin dados'}${sel.length ? ' · ' + sel.map(g => g.nombre).join(' + ') : ''}`);
  }

  /* ══ Conjuros: espacios, filtros y lista; tocar uno abre cómo lanzarlo ══ */
  function _conjuros(c) {
    const spells = c.spells || [];
    if (!spells.length) return `<div class="mesa-grid"><div class="mesa-centro"><p class="mesa-vacio">Este personaje no tiene conjuros.</p></div><aside class="mesa-der">${_apoyo(c, 'conjuros')}</aside></div>`;
    const slots = [];
    for (let lv = 1; lv <= 9; lv++) {
      const s = c.spellSlots && c.spellSlots[lv];
      if (s && s.max > 0) slots.push(`<span class="mesa-nv"><b>${lv}</b><span class="mesa-pts">${Array.from({ length: s.max }, (_, i) =>
        `<i class="${i < s.current ? '' : 'u'}" onclick="App.toggleSlotDot(${lv},${i})"></i>`).join('')}</span></span>`);
    }
    const cd = Characters.calcCD(c), atq = Characters.calcAtaqueBonus(c);
    const chip = (grupo, val, txt) => `<button class="mesa-chip ${st[grupo] === val ? 'on' : ''}" onclick="Mesa.filtrar('${grupo}','${val}')">${txt}</button>`;
    const n = spells.filter(sp => preparado(c, sp)).length;
    return `
      <div class="mesa-grid">
        <div class="mesa-centro">
          ${_terreno(c)}
          <div class="mesa-card mesa-espacios"><span class="mesa-lbl">Espacios</span>${slots.join('') || '<span class="mesa-vacio">Sin espacios</span>'}
            <span class="mc-esp"></span>${cd != null ? `<span class="mesa-lbl">CD</span><b class="mesa-gr">${cd}</b>` : ''}${atq != null ? `<span class="mesa-lbl">Ataque</span><b class="mesa-gr">${sg(atq)}</b>` : ''}</div>
          <div class="mesa-filtros">
            ${chip('filtro', 'preparados', `Preparados (${n})`)}${chip('filtro', 'todos', `Todos (${spells.length})`)}<span class="mesa-vsep"></span>
            ${chip('tipo', 'action', 'Acción')}${chip('tipo', 'bonusAction', 'Adicional')}${chip('tipo', 'reaction', 'Reacción')}${chip('tipo', 'conc', 'Concentración')}${chip('tipo', 'ritual', 'Ritual')}
            <span class="mc-esp"></span><input class="mesa-buscar" id="mesaBuscar" placeholder="Buscar conjuro…" value="${esc(st.buscar)}" oninput="Mesa.buscar(this.value)">
          </div>
          <div id="mesaLista">${_lista(c)}</div>
          <button class="mesa-link" onclick="Mesa.original('conjuros')">Abrir la vista completa de Conjuros (preparar o agregar) ▸</button>
        </div>
        <aside class="mesa-der">${_apoyo(c, 'conjuros')}</aside>
      </div>`;
  }

  function _lista(c) {
    const q = st.buscar.trim().toLowerCase();
    const lista = (c.spells || []).filter(sp => {
      if (st.filtro === 'preparados' && !preparado(c, sp)) return false;
      if (st.tipo === 'conc' && !sp.concentration) return false;
      if (st.tipo === 'ritual' && !sp.ritual) return false;
      if (CAMPO[st.tipo] && Characters.getActivation(sp) !== st.tipo) return false;
      return !q || sp.name.toLowerCase().includes(q);
    });
    if (!lista.length) return '<p class="mesa-vacio">Ningún conjuro con ese filtro.</p>';
    const niveles = [...new Set(lista.map(sp => sp.level))].sort((a, b) => a - b);
    const espacios = lv => { const sl = c.spellSlots && c.spellSlots[lv]; return sl && sl.max ? ` <small>${'●'.repeat(sl.current)}${'○'.repeat(sl.max - sl.current)} · ${sl.current} de ${sl.max}</small>` : ''; };
    return niveles.map(lv => `<div class="mesa-grupo"><div class="mesa-sec">${lv === 0 ? 'Trucos <small>sin espacio</small>' : `Nivel ${lv}${espacios(lv)}`}</div>
      <div class="mesa-hz">${lista.filter(sp => sp.level === lv).map(sp => _filaConjuro(c, sp, { conPrep: true, via: App.enCombate() ? undefined : 'other' })).join('')}</div></div>`).join('');
  }

  /* Fila de un conjuro. `via`: qué gasta al lanzarlo si no es lo de su
     tiempo de lanzamiento ('reaction' con War Caster; 'other' fuera de
     combate, que no marca el turno). `ritual`: ofrece lanzarlo como ritual. */
  /* Daño o curación de un conjuro para verlo de un vistazo: "3d8", "2d8+4"
     (el mod de lanzamiento ya sumado) y, si escala, "+1d8/nv". Los trucos
     suben de dados con el nivel del personaje (5, 11, 17). */
  function _efectoConjuro(c, sp) {
    const textos = [sp.damage, sp.desc].filter(Boolean).join(' · ');
    const m = textos.match(/(\d+d\d+)(?:\s*\+\s*(SAB|INT|CAR|mod\b|\d+)(?:\s*mod\b)?)?/i);
    if (!m) return null;
    let [, dados, extra] = m;
    if (sp.level === 0) {
      const nv = c.nivel || 1;
      const tramos = [...(sp.desc || '').matchAll(/(\d+d\d+)\s*nv\s*(\d+)/gi)].filter(t => nv >= +t[2]);
      if (tramos.length) dados = tramos[tramos.length - 1][1];
      else if (!/\(d\d+\s*nv/i.test(sp.desc || '')) {
        const n = nv >= 17 ? 4 : nv >= 11 ? 3 : nv >= 5 ? 2 : 1;
        dados = dados.replace(/^(\d+)/, x => +x * n);
      }
    }
    let fijo = '';
    if (extra) {
      const stat = /^\d+$/.test(extra) ? null : (/SAB/i.test(extra) ? 'sab' : /INT/i.test(extra) ? 'int' : /CAR/i.test(extra) ? 'car' : c.spellcastingStat);
      const val = stat ? Characters.calcMod((c.stats || {})[stat] || 10) : +extra;
      fijo = val ? (val > 0 ? `+${val}` : `${val}`) : '';
    }
    const sube = [sp.upcast, (sp.desc || '').match(/Escala\s*\+\s*[^.·]*/i)?.[0]].filter(Boolean).join(' ');
    const esc_ = sube.match(/\+\s*(\d+d\d+)/);
    const escala = sp.level === 0 ? '' : esc_ ? `+${esc_[1]}/nv` : /criatura|objetivo/i.test(sube) ? '+1 objetivo/nv' : '';
    const cura = !sp.damage && /\b(HP|PG)\b|cura|recupera/i.test(sp.desc || '');
    // Un bono a tiradas (Bless: +1d4) se muestra con su signo, no como daño
    const bono = !sp.damage && !cura && new RegExp('\\+\\s*' + m[1]).test(textos);
    return { base: (bono ? '+' : '') + dados + fijo, escala, cura };
  }

  function _filaConjuro(c, sp, { conPrep = false, via, ritual = false } = {}) {
    const act = Characters.getActivation(sp);
    const v = via ? `,'${via}'` : '';
    const corta = { action: 'ACC.', bonusAction: 'ADIC.', reaction: 'REAC.' }[via === 'reaction' ? 'reaction' : act] || '';
    const nivel = sp.level === 0 ? 'TRUCO' : `NV ${sp.level}`;
    const tags = [sp.level === 0 ? `<span class="mesa-tg">${nivel}</span>` : '', sp.concentration ? '<span class="mesa-tg">CONC</span>' : '',
      sp.domain ? `<span class="mesa-tg d">◆ ${/Cl[ée]rigo/.test(c.clase || '') ? 'DOMINIO' : 'SIEMPRE'}</span>` : '',
      sp.mi ? '<span class="mesa-tg d">GRATIS</span>' : '', sp.ritual ? '<span class="mesa-tg">RITUAL</span>' : '', corta ? `<span class="mesa-tg a">${corta}</span>` : ''].join('');
    const id = (via === 'reaction' ? 'sp-wc-' : via === 'other' ? 'sp-fc-' : 'sp-') + sp.id, ab = st.abierto === id;
    const prep = preparado(c, sp);
    const no = ritual ? (prep ? '' : 'No preparado') : _motivoConjuro(c, sp, via);
    // Aviso de concentración: no impide, pero conviene saberlo antes
    const conc = sp.concentration && c.concentration && c.concentration !== sp.id
      ? (c.spells || []).find(x => x.id === c.concentration) : null;
    const ef = _efectoConjuro(c, sp);
    // Qué espacio gasta: el de su nivel o, si se acabaron, el siguiente que quede (↑)
    const opEsp = sp.level > 0 ? (App.castOptions(sp.id) || { free: false, slots: [] }) : null;
    const espacio = !opEsp ? '' : opEsp.free ? 'Gratis'
      : opEsp.slots.length ? `Nv ${opEsp.slots[0]}${opEsp.slots[0] > sp.level ? '↑' : ''}` : `Nv ${sp.level}`;
    const efecto = ef ? '' : (sp.desc || '').split(' · ').slice(2, 4).join(' · ');
    let det = '';
    if (ab) {
      const op = App.castOptions(sp.id) || { free: false, slots: [] };
      const btns = [];
      if (ritual && prep) btns.push(`<button class="mesa-btn p" onclick="App.castSpell('${sp.id}',0,'other')">Como ritual · +10 min, sin espacio</button>`);
      if (sp.level === 0) btns.push(`<button class="mesa-btn p" onclick="App.castSpell('${sp.id}',0${v})">✨ Lanzar</button>`);
      else {
        if (op.free) btns.push(`<button class="mesa-btn p" onclick="App.castSpell('${sp.id}',0${v})">✦ Gratis, sin espacio</button>`);
        op.slots.forEach(lv => btns.push(`<button class="mesa-btn ${op.free || ritual ? '' : 'p'}" onclick="App.castSpell('${sp.id}',${lv}${v})">Lanzar con espacio de nivel ${lv}</button>`));
        if (!op.free && !op.slots.length) btns.push(`<span class="mesa-vacio">Sin espacios de nivel ${sp.level} o más</span>`);
      }
      if (esEscritorio()) btns.push(`<button class="mesa-btn" onclick="App.copiarRoll20('conjuro','${sp.id}')">Enviar a Roll20</button>`);
      btns.push(`<button class="mesa-btn" onclick="App.castSpell('${sp.id}')">Ficha completa</button>`);
      const gasta = via === 'other' ? '' : ETQ[via || act];
      det = `<div class="mesa-det" onclick="event.stopPropagation()">
        <div class="mesa-meta">${[sp.castTime, sp.range && App.fmtDist(sp.range), sp.duration].filter(Boolean).map(esc).join(' · ')}</div>
        <p>${esc(sp.desc || '')}</p>
        ${gasta || sp.concentration ? `<p class="mesa-aviso">Al lanzarlo ${[gasta ? 'se marca ' + gasta : '', sp.concentration ? 'pasa a ser tu concentración' : ''].filter(Boolean).join(' y ')}.</p>` : ''}
        <div class="mesa-acc">${btns.join('')}</div></div>`;
    }
    return `<div class="mesa-cj ${ab ? 'abierto' : ''} ${no ? 'no' : ''}" onclick="Mesa.abrir('${id}')">
      ${conPrep ? `<span class="mesa-pr ${prep ? 'on' : ''}" ${sp.level === 0 || sp.domain ? 'title="Siempre preparado"' : `onclick="event.stopPropagation();App.toggleSpellPrepared('${sp.id}')" title="${prep ? 'Despreparar' : 'Preparar'}"`}></span>`
        : '<span class="mesa-t"><i class="mesa-ico" style="--m:url(../assets/iconos/conjuros.svg)"></i></span>'}
      <div class="mesa-op-tx"><b>${esc(limpio(sp.name))}</b>${ef || espacio ? `<span class="mesa-golpe">${espacio ? `<span class="mesa-esp ${/↑/.test(espacio) ? 'sube' : ''}" title="Espacio que gasta">${espacio}</span>` : ''}${ef ? `<span class="mesa-dmg ${ef.cura ? 'cura' : ''}">${ef.cura ? '♥ ' : ''}${esc(ef.base)}</span>${ef.escala ? `<span class="mesa-escala">${esc(ef.escala)}</span>` : ''}` : ''}</span>` : ''}<small>${esc([sp.castTime, sp.range && App.fmtDist(sp.range), efecto].filter(Boolean).join(' · '))}</small>
        ${no ? `<em class="mesa-motivo">${esc(no)}</em>` : conc ? `<em class="mesa-motivo aviso">Rompe tu concentración en ${esc(limpio(conc.name))}</em>` : ''}</div>
      <span class="mesa-tags">${tags}</span>${det}</div>`;
  }

  /* ══ Habilidades: arriba, la configuración del personaje (maestrías y
     recursos propios); debajo sigue la pestaña de siempre ══ */
  function _configuracion(c) {
    const maestrias = App.mesaHTML.maestrias();
    const propios = (c.resources || []).filter(r => String(r.id).startsWith('custom-'));
    return `<div class="mesa-config">
      <div class="mesa-sec">Configuración del personaje</div>
      <div class="mesa-config-grid">
        ${maestrias ? `<div class="mesa-config-maestrias">${maestrias}</div>` : ''}
        ${_formasConfig(c)}
        <div class="mesa-card mesa-propios">
          <div class="mesa-col-hd">Recursos propios<button class="mesa-chip on" onclick="App.openCustomResource()">+ Agregar</button></div>
          ${propios.map(r => `<div class="mesa-rec"><div>${esc(r.name)}<small>${r.max} usos · ${esc({ short: 'descanso corto', long: 'descanso largo' }[r.recharge] || r.recharge || '')}${r.note ? ' · ' + esc(r.note) : ''}</small></div>
            <button class="mesa-chip" onclick="App.deleteResource('${r.id}')" title="Eliminar">✕</button></div>`).join('')
            || '<p class="mesa-vacio" style="padding:10px 12px">Agrega usos que la app no trae (un objeto con cargas, un favor del DM…). Aparecen en Recursos, a la derecha de Combate y Conjuros.</p>'}
        </div>
      </div>
    </div>`;
  }

  /* ── Interacciones de la vista ── */
  function abrir(id) { st.abierto = st.abierto === id ? null : id; _pintar(); }
  // Entrar o salir de combate cambia lo que muestra la pestaña Combate
  function combate(on) {
    if (on) { if (!App.enCombate()) { App.nuevoTurno(); App.startCombat(); } }
    else if (App.enCombate()) App.resetCombat();
    st.abierto = null;
    render();
  }
  /* Manifest Echo (Echo Knight): invocar o descartar el eco cuesta la
     Acción adicional; con el eco activo, intercambiar posición también. */
  function _filaEco(c, f) {
    const activo = !!c.echoActive;
    const ca = 14 + Characters.calcProfBonus(c.nivel);
    const no = activo ? '' : _turnoUsado(c, 'bonusAction');
    return { eco: true, no, html: _fila({ id: 'eco', icono: 'iconos/eco', nombre: activo ? 'Eco activo' : 'Invocar eco', num: '', no,
      sub: activo ? `CA ${ca} · 1 PG · se mueve 9 m gratis · ataca desde su lugar` : `Manifest Echo · a 4,5 m · CA ${ca}, 1 PG`,
      tags: activo ? '<span class="mesa-tags"><span class="mesa-tg d">ACTIVO</span></span>' : '',
      det: `<p>${esc(f.desc || '')}</p><div class="mesa-acc">
        ${activo ? `<button class="mesa-btn p" onclick="event.stopPropagation();Mesa.usarRasgo('bonusAction','intercambio-eco')">Intercambiar posición · Acción adicional</button>
          <button class="mesa-btn" onclick="event.stopPropagation();Mesa.eco(false)">Descartar eco</button>`
          : `<button class="mesa-btn p" onclick="event.stopPropagation();Mesa.eco(true)">Invocar eco · Acción adicional</button>`}</div>` }) };
  }
  const _esEcoKnight = c => c.subclase === 'Echo Knight' || (c.classes || []).some(x => x && x.subclass === 'Echo Knight');
  // Tarjeta morada del eco en la columna derecha: invocarlo de un toque y, activo, sus datos a la vista
  function _tarjetaEco(c) {
    if (!_esEcoKnight(c)) return '';
    const activo = !!c.echoActive;
    const ca = 14 + Characters.calcProfBonus(c.nivel);
    const sinAdicional = App.enCombate() && _turnoUsado(c, 'bonusAction');
    const un = (c.resources || []).find(r => r.id === 'echo-unleash');
    const puntosUn = un && un.max > 0 ? `<div class="mesa-rec"><div>Unleash Incarnation<small>+1 ataque desde el eco al usar Atacar</small></div><span class="mesa-pts">${
      Array.from({ length: un.max }, (_, i) => `<i class="${i < un.current ? '' : 'u'}" onclick="App.toggleResourceDot('echo-unleash',${i})"></i>`).join('')}</span></div>` : '';
    if (!activo) return `<section><div class="mesa-sec">Eco</div><div class="mesa-card mesa-eco">
      <div class="mesa-eco-hd"><i class="mesa-ico mesa-eco-ic" style="--m:url(../assets/iconos/eco.svg)"></i><div><b>Eco sin invocar</b><small>Acción adicional · a 4,5 m · CA ${ca}, 1 PG</small></div></div>
      <button class="mesa-btn mesa-eco-btn" ${sinAdicional ? 'disabled' : ''} onclick="Mesa.eco(true)" title="Manifest Echo · gasta la Acción adicional">Invocar</button>
      ${sinAdicional ? `<small class="mesa-motivo">${esc(sinAdicional)}</small>` : ''}
    </div></section>`;
    return `<section><div class="mesa-sec">Eco</div><div class="mesa-card mesa-eco on">
      <div class="mesa-eco-hd"><i class="mesa-ico mesa-eco-ic" style="--m:url(../assets/iconos/eco.svg)"></i><div><b>Eco activo</b><small>Inmune a condiciones · se destruye si termina tu turno a más de 9 m</small></div></div>
      <div class="mesa-eco-stats"><div><b>${ca}</b><span class="mesa-lbl">CA</span></div><div><b>1</b><span class="mesa-lbl">PG</span></div><div><b>${esc(App.fmtDist('9 m'))}</b><span class="mesa-lbl">Mov. gratis</span></div></div>
      <ul class="mesa-eco-lista"><li>Tus ataques de Atacar pueden salir desde el eco</li><li>Ataque de oportunidad si alguien se aleja de él</li></ul>
      ${puntosUn}
      <div class="mesa-acc"><button class="mesa-btn mesa-eco-btn" ${sinAdicional ? 'disabled' : ''} onclick="Mesa.usarRasgo('bonusAction','intercambio-eco')">⇄ Intercambiar</button>
        <button class="mesa-btn" onclick="Mesa.eco(false)">Descartar</button>
        <button class="mesa-btn" onclick="App.larryRoll()" title="Tabla de Larry">Larry</button></div>
    </div></section>`;
  }
  function eco(invocar) {
    const c = App.getActiveChar();
    if (!c || !!c.echoActive === invocar) return;
    if (App.enCombate()) App.usarRecursoTurno('bonusAction', true);
    App.toggleEcho();
  }
  // Rasgo sin usos: solo marca lo que gasta del turno
  // Rasgo pagado con un uso de otro recurso: marca la acción del turno y descuenta el uso
  function usarPagado(tipo, id, recurso) {
    const f = (App.getActiveChar().features || []).find(x => x.id === id);
    if (recurso === 'espacio' && !Object.values(App.getActiveChar().spellSlots || {}).some(x => x && x.current > 0)) { App.showToast('No te quedan espacios'); return; }
    if (App.enCombate() && !App.usarRecursoTurno(tipo)) { App.showToast(`Ya usaste ${ETQ[tipo]} este turno`); return; }
    if (recurso === 'espacio') { if (App.gastarEspacioMasBajo() == null) return; }
    else App.adjustResource(recurso, -1, true);
    App.showToast(`${f ? f.name : 'Rasgo'}${App.enCombate() ? ` · ${ETQ[tipo]} marcada` : ''}`);
  }

  function usarRasgo(tipo, id) {
    // Por id: un nombre con apóstrofo rompería el onclick
    const f = (App.getActiveChar().features || []).find(x => x.id === id);
    const nombre = id === 'intercambio-eco' ? 'Intercambio con el eco' : f ? f.name : 'Rasgo';
    if (App.enCombate() && !App.usarRecursoTurno(tipo)) { App.showToast(`Ya usaste ${ETQ[tipo]} este turno`); return; }
    App.showToast(`${nombre}${App.enCombate() ? ` · ${ETQ[tipo]} marcada` : ''}`);
  }

  // Usa el uso gratis (no gasta el recurso principal) y marca la acción que pide
  function gratis(idGratis, idRecurso) {
    const c = App.getActiveChar();
    const r = c && (c.resources || []).find(x => x.id === idRecurso);
    App.adjustResource(idGratis, -1);
    const act = r ? Characters.getActivation(r) : null;
    if (App.enCombate() && CAMPO[act]) App.usarRecursoTurno(act, true);
    App.showToast(`${r ? r.name : 'Rasgo'} sin gastar uso`);
  }
  function grupo(g) { if (st.grupos.has(g)) st.grupos.delete(g); else st.grupos.add(g); _pintar(); }
  function filtrar(grupo, val) { st[grupo] = st[grupo] === val && grupo === 'tipo' ? null : val; _pintar(); }
  function buscar(v) {
    st.buscar = v;
    const c = App.getActiveChar();
    const lista = $('mesaLista');
    if (c && lista) lista.innerHTML = _lista(c);   // solo la lista: el campo conserva el foco
  }
  // Muestra la pestaña de siempre (para lo que la vista Mesa aún no cubre)
  function original(tab) {
    tab = tab || document.documentElement.dataset.mesaTab;
    st.original[tab] = !st.original[tab];
    _pintar();
    if (st.original[tab]) window.scrollTo({ top: 0 });
  }

  document.addEventListener('DOMContentLoaded', () => {
    _etiqueta();
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && st.hoja) hoja(false); });
  });

  return { activo, alternar, render, turno, vida, vidaBestia, animal, tipoBestia, eco, usarRasgo, usarPagado, hoja, abrir, grupo, combate, gratis, filtrar, buscar, original, oportunidad, golpe, furtivo, muerte };
})();
window.Mesa = Mesa;   // const no queda en window: app.js lo busca ahí
