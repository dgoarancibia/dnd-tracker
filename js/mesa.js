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
  const st = { abierto: null, grupos: new Set(), filtro: 'preparados', tipo: null, buscar: '', original: {}, hoja: false };

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
      <div class="mc-quien"><b>${esc(c.name)}</b><small>${esc(clases)}${c.subclase ? ' · ' + esc(c.subclase) : ''}</small></div>
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
    const pastilla = (campo, txt) => `<button class="mesa-chip ${t[campo] ? 'usada' : 'on'}" onclick="App.toggleRecursoTurno('${campo}')"
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
    return `
      <div class="mt-stats">${stats}</div>
      <div class="mesa-sec">Salvaciones</div>
      <div class="mt-filas mt-salv">${salv}</div>
      <div class="mesa-sec">Habilidades <small>● competente · ◉ pericia</small></div>
      <div class="mt-filas">${skills}</div>
      <div class="mesa-sec">Pasivas</div>
      <div class="mt-pasivas"><span class="mesa-chip">Percepción ${Characters.calcPercPasiva(c)}</span><span class="mesa-chip">Perspicacia ${pasiva('perspicacia')}</span><span class="mesa-chip">Investigación ${pasiva('investigacion')}</span></div>`;
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
    if (sp.level > 0) {
      const op = App.castOptions(sp.id) || { free: false, slots: [] };
      if (!op.free && !op.slots.length) return `Sin espacios de nivel ${sp.level}${sp.upcast ? ' o más' : ''}`;
    }
    return _turnoUsado(c, via || Characters.getActivation(sp));
  }
  // Recurso que da un uso gratis de otro (Amulet of the Devout → Channel Divinity)
  const _gratisPara = (c, r) => (c.resources || []).find(x => x.usaPara === r.id && x.current > 0);
  function _motivoRecurso(c, r) {
    if (r.current <= 0 && !_gratisPara(c, r)) return `Sin usos · vuelve con ${DESCANSO(r)}`;
    return _turnoUsado(c, Characters.getActivation(r));
  }

  // Lista de una columna: lo que se puede usar arriba; lo demás junto al final
  function _columnaItems(items, grupo) {
    const si = items.filter(x => !x.no), no = items.filter(x => x.no);
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
      col[tipo].push({ no, html: _fila({
        id: 'arma-' + slot, icono: _iconoArma(w), nombre: w.name, num: sg(a.ataque), no,
        sub: `${a.daño}${a.extra ? ' + ' + a.extra : ''}${maxAtq > 1 && slot === 'mainHand' ? ` · ataques ${usados}/${maxAtq}` : ''}${a.notas.length ? ' · ' + a.notas.join(' · ') : ''}`,
        det: `${w.notes ? `<p>${esc(w.notes)}</p>` : ''}<div class="mesa-acc"><button class="mesa-btn p" onclick="event.stopPropagation();App.attackWithWeapon('${slot}')">⚔ Atacar</button></div>`,
      }) });
      // Ataque de oportunidad: con la primera arma cuerpo a cuerpo equipada (principal o secundaria)
      if (!a.aDistancia && !col.reaction.some(x => x.ao)) {
        const no2 = t.reaction ? 'Ya usaste tu Reacción' : '';
        col.reaction.push({ ao: true, no: no2, html: _fila({
          id: 'ao', icono: _iconoArma(w), nombre: 'Ataque de oportunidad', num: sg(a.ataque), sub: `${w.name} · ${a.daño}`, no: no2,
          det: `<p>Cuando una criatura hostil que puedes ver sale de tu alcance.</p><div class="mesa-acc"><button class="mesa-btn p" onclick="event.stopPropagation();Mesa.oportunidad()">⚔ Atacar</button></div>`,
        }) });
      }
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

    // Rasgos con usos (Channel Divinity, Hunter's Mark gratis…)
    (c.resources || []).forEach(r => {
      const tipo = Characters.getActivation(r);
      if (!col[tipo] || !r.max) return;
      col[tipo].push(_filaRecurso(c, r));
    });

    const columna = (tipo, titulo, campo) => `
      <section class="mesa-card mesa-col">
        <div class="mesa-col-hd">${titulo}<button class="mesa-chip ${t[campo] ? '' : 'on'}" onclick="App.toggleRecursoTurno('${campo}')">${t[campo] ? 'usada' : 'disponible'}</button></div>
        <div class="mesa-col-bd">${_columnaItems(col[tipo], 'no-' + tipo) || '<p class="mesa-vacio">Nada que usar aquí.</p>'}
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

  function _filaRecurso(c, r) {
    const no = _motivoRecurso(c, r);
    return { no, html: _fila({
      id: 'rec-' + r.id, icono: 'iconos/recursos', nombre: r.name, num: '', no,
      sub: `${r.current}/${r.max} usos${r.note ? ' · ' + r.note : ''}`,
      det: `<p>${esc(r.desc || '')}</p><div class="mesa-acc"><button class="mesa-btn p" ${r.current > 0 ? '' : 'disabled'} onclick="event.stopPropagation();App.adjustResource('${r.id}',-1)">Usar (${r.current}/${r.max})</button>
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

  function _fila({ id, icono, nombre, num, sub, det, tags = '', no = '' }) {
    const ab = st.abierto === id;
    return `<div class="mesa-op ${ab ? 'abierto' : ''} ${no ? 'no' : ''}" onclick="Mesa.abrir('${id}')">
      <span class="mesa-t"><i class="mesa-ico" style="--m:url(../assets/${icono}.svg)"></i></span>
      <div class="mesa-op-tx"><b>${esc(limpio(nombre))}</b><small>${num ? `<span class="mesa-num">${num}</span> · ` : ''}${esc(sub)}</small>${no ? `<em class="mesa-motivo">${esc(no)}</em>` : ''}</div>
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
    const bloqueBestia = c.companion ? `<section><div class="mesa-sec">Compañero</div>${_tarjetaBestia(c, bestia)}</section>` : '';

    // Primero lo que define al personaje: el compañero en un Beast Master, la concentración en un lanzador
    if (bloqueBestia) bloques.push(bloqueBestia, bloqueConc); else bloques.push(bloqueConc);

    const puntos = (n, total, fn) => `<span class="mesa-pts">${Array.from({ length: total }, (_, i) =>
      `<i class="${i < n ? '' : 'u'}" onclick="${fn(i)}"></i>`).join('')}</span>`;
    const recs = (c.resources || []).filter(r => r.max > 0).map(r => `<div class="mesa-rec"><div>${esc(limpio(r.name))}<small>${esc(r.action || '')}</small></div>
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
  function _filaConjuro(c, sp, { conPrep = false, via, ritual = false } = {}) {
    const act = Characters.getActivation(sp);
    const v = via ? `,'${via}'` : '';
    const corta = { action: 'ACC.', bonusAction: 'ADIC.', reaction: 'REAC.' }[via === 'reaction' ? 'reaction' : act] || '';
    const nivel = sp.level === 0 ? 'TRUCO' : `NV ${sp.level}`;
    const tags = [`<span class="mesa-tg">${nivel}</span>`, sp.concentration ? '<span class="mesa-tg">CONC</span>' : '',
      sp.domain ? `<span class="mesa-tg d">◆ ${/Cl[ée]rigo/.test(c.clase || '') ? 'DOMINIO' : 'SIEMPRE'}</span>` : '',
      sp.mi ? '<span class="mesa-tg d">GRATIS</span>' : '', sp.ritual ? '<span class="mesa-tg">RITUAL</span>' : '', corta ? `<span class="mesa-tg a">${corta}</span>` : ''].join('');
    const id = (via === 'reaction' ? 'sp-wc-' : via === 'other' ? 'sp-fc-' : 'sp-') + sp.id, ab = st.abierto === id;
    const prep = preparado(c, sp);
    const no = ritual ? (prep ? '' : 'No preparado') : _motivoConjuro(c, sp, via);
    // Aviso de concentración: no impide, pero conviene saberlo antes
    const conc = sp.concentration && c.concentration && c.concentration !== sp.id
      ? (c.spells || []).find(x => x.id === c.concentration) : null;
    const efecto = sp.damage || (sp.desc || '').split(' · ').slice(2, 4).join(' · ');
    let det = '';
    if (ab) {
      const op = App.castOptions(sp.id) || { free: false, slots: [] };
      const btns = [];
      if (ritual && prep) btns.push(`<button class="mesa-btn p" onclick="App.castSpell('${sp.id}',0,'other')">Como ritual · +10 min, sin espacio</button>`);
      if (sp.level === 0) btns.push(`<button class="mesa-btn p" onclick="App.castSpell('${sp.id}',0${v})">✨ Lanzar</button>`);
      else {
        if (op.free) btns.push(`<button class="mesa-btn p" onclick="App.castSpell('${sp.id}',0${v})">✦ Gratis, sin espacio</button>`);
        op.slots.forEach(lv => btns.push(`<button class="mesa-btn ${op.free || ritual ? '' : 'p'}" onclick="App.castSpell('${sp.id}',${lv}${v})">Lanzar con espacio de nivel ${lv}</button>`));
        if (!op.free && !op.slots.length) btns.push(`<span class="mesa-vacio">Sin espacios de nivel ${sp.level}${sp.upcast ? ' o más' : ''}</span>`);
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
      <div class="mesa-op-tx"><b>${esc(limpio(sp.name))}</b><small>${esc([sp.castTime, sp.range && App.fmtDist(sp.range), efecto].filter(Boolean).join(' · '))}</small>
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

  return { activo, alternar, render, vida, vidaBestia, animal, tipoBestia, hoja, abrir, grupo, combate, gratis, filtrar, buscar, original, oportunidad };
})();
window.Mesa = Mesa;   // const no queda en window: app.js lo busca ahí
