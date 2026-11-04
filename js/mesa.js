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
    for (const tab of ['combate', 'conjuros']) {
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
        <div class="mc-pg-top"><span class="mesa-lbl">PG</span><span class="mc-num mc-${nivelVida}">${current}<small> / ${max}</small></span>
          <button class="mesa-chip" onclick="App.promptTempHP()" title="PG temporales">TMP ${temp || 0}</button></div>
        <div class="mesa-barra mc-${nivelVida}">${Array.from({ length: segs }, (_, i) => `<i class="${i < llenos ? '' : 'v'}"></i>`).join('')}</div>
      </div>
      <div class="mc-pg-ctl">
        <input id="mesaHPIn" type="number" inputmode="numeric" min="0" placeholder="0" onkeydown="if(event.key==='Enter')Mesa.vida(-1)">
        <button class="mesa-btn mc-dmg" onclick="Mesa.vida(-1)">Daño</button>
        <button class="mesa-btn mc-heal" onclick="Mesa.vida(1)">Curar</button>
      </div>
      <span class="mc-sep"></span>
      <div class="mc-ca"><span class="mesa-escudo">${ca}</span><span class="mesa-lbl">CA</span></div>
      <div class="mc-vit">
        <div><b>${sg(init)}</b><span class="mesa-lbl">Inic.</span></div>
        <div><b>${esc(vel)}</b><span class="mesa-lbl">Vel.</span></div>
        <div><b>${sg(pb)}</b><span class="mesa-lbl">Comp.</span></div>
        ${cd != null ? `<div><b>${cd}</b><span class="mesa-lbl">CD</span></div>` : ''}
      </div>
      <span class="mc-esp"></span>
      <div class="mc-turno">${_turno(c, false)}</div>`;
  }

  // Acción / Adicional / Reacción + fin de turno y descansos
  function _turno(c, enLinea) {
    const t = c.turn || {};
    const pastilla = (campo, txt) => `<button class="mesa-chip ${t[campo] ? 'usada' : 'on'}" onclick="App.toggleRecursoTurno('${campo}')"
      title="${t[campo] ? 'Usada — toca para devolverla' : 'Disponible — toca para marcarla'}">${t[campo] ? '' : '✓ '}${txt}</button>`;
    const fila1 = pastilla('action', 'Acción') + pastilla('bonus', 'Adicional') + pastilla('reaction', 'Reacción');
    const fila2 = `<button class="mesa-chip" onclick="App.nuevoTurno()">Fin de turno ▸</button>
      <button class="mesa-chip" onclick="App.openShortRest()">↺ Corto</button>
      <button class="mesa-chip" onclick="App.longRest()">☾ Largo</button>`;
    return enLinea ? fila1 + '<span class="mesa-vsep"></span>' + fila2
      : `<div class="mc-fila">${fila1}</div><div class="mc-fila">${fila2}</div>`;
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

  function _combate(c) {
    const t = c.turn || {};
    const col = { action: [], bonusAction: [], reaction: [] };
    const eq = c.equipment || {};

    // Ataques con las armas equipadas
    [['mainHand', 'action'], ['offHand', 'bonusAction']].forEach(([slot, tipo]) => {
      const w = eq[slot];
      const a = w && w.kind === 'weapon' ? Characters.calcArma(c, slot) : null;
      if (!a) return;
      col[tipo].push(_fila({
        id: 'arma-' + slot, icono: _iconoArma(w), nombre: w.name, num: sg(a.ataque),
        sub: `${a.daño}${a.extra ? ' + ' + a.extra : ''}${a.notas.length ? ' · ' + a.notas.join(' · ') : ''}`,
        det: `${w.notes ? `<p>${esc(w.notes)}</p>` : ''}<div class="mesa-acc"><button class="mesa-btn p" onclick="event.stopPropagation();App.attackWithWeapon('${slot}')">⚔ Atacar</button></div>`,
      }));
      // Cualquier arma cuerpo a cuerpo de la mano principal sirve para el ataque de oportunidad
      if (slot === 'mainHand' && !a.aDistancia) col.reaction.push(_fila({
        id: 'ao', icono: _iconoArma(w), nombre: 'Ataque de oportunidad', num: sg(a.ataque), sub: `${w.name} · ${a.daño}`,
        det: `<p>Cuando una criatura hostil que puedes ver sale de tu alcance.</p><div class="mesa-acc"><button class="mesa-btn p" onclick="event.stopPropagation();Mesa.oportunidad()">⚔ Atacar</button></div>`,
      }));
    });

    // Compañero (Beast Master): ordenarle cuesta la Acción adicional
    const bestia = _bestia(c);
    if (bestia) col.bonusAction.push(_fila({
      id: 'bestia', icono: 'iconos/companero', nombre: `Ordenar a ${c.companion.name || 'tu compañero'}`,
      num: sg(bestia.golpe), sub: `${bestia.ataque.name} · ${bestia.daño}`,
      det: `<p>${esc(bestia.ataque.desc)}</p><div class="mesa-acc"><button class="mesa-btn p" onclick="event.stopPropagation();App.comandarBestia('bonus')">Ordenar con Acción adicional</button>
        <button class="mesa-btn" onclick="event.stopPropagation();App.comandarBestia('attack')">Sacrificando un ataque</button></div>`,
    }));

    // Conjuros preparados que se usan en combate: con más de dos, quedan
    // juntos en una fila que se despliega, para que no tapen los ataques
    const porTipo = { action: [], bonusAction: [], reaction: [] };
    (c.spells || []).filter(sp => preparado(c, sp) && sp.combat !== false).forEach(sp => {
      const tipo = Characters.getActivation(sp);
      if (porTipo[tipo]) porTipo[tipo].push(sp);
    });
    Object.entries(porTipo).forEach(([tipo, lista]) => {
      if (lista.length <= 2) { lista.forEach(sp => col[tipo].push(_filaConjuro(c, sp))); return; }
      const g = 'conj-' + tipo, ab = st.grupos.has(g);
      col[tipo].push(`<div class="mesa-op ${ab ? 'abierto' : ''}" onclick="Mesa.grupo('${g}')">
        <span class="mesa-t"><i class="mesa-ico" style="--m:url(../assets/iconos/conjuros.svg)"></i></span>
        <div class="mesa-op-tx"><b>Lanzar un conjuro</b><small>${esc(lista.slice(0, 3).map(sp => limpio(sp.name)).join(' · '))}${lista.length > 3 ? ' …' : ''}</small></div>
        <span class="mesa-tg a">${lista.length}</span><span class="mesa-mas">›</span></div>`
        + (ab ? `<div class="mesa-sub">${lista.map(sp => _filaConjuro(c, sp)).join('')}</div>` : ''));
    });

    // Rasgos con usos (Channel Divinity, Hunter's Mark gratis…)
    (c.resources || []).forEach(r => {
      const tipo = Characters.getActivation(r);
      if (!col[tipo] || !r.max) return;
      col[tipo].push(_fila({
        id: 'rec-' + r.id, icono: 'iconos/recursos', nombre: r.name, num: '', sub: `${r.current}/${r.max} usos${r.note ? ' · ' + r.note : ''}`,
        det: `<p>${esc(r.desc || '')}</p><div class="mesa-acc"><button class="mesa-btn p" ${r.current > 0 ? '' : 'disabled'} onclick="event.stopPropagation();App.adjustResource('${r.id}',-1)">Usar (${r.current}/${r.max})</button></div>`,
      }));
    });

    const columna = (tipo, titulo, campo) => `
      <section class="mesa-card mesa-col ${t[campo] ? 'gastada' : ''}">
        <div class="mesa-col-hd">${titulo}<button class="mesa-chip ${t[campo] ? '' : 'on'}" onclick="App.toggleRecursoTurno('${campo}')">${t[campo] ? 'usada' : 'disponible'}</button></div>
        <div class="mesa-col-bd">${col[tipo].join('') || '<p class="mesa-vacio">Nada que usar aquí.</p>'}
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
          <button class="mesa-link" onclick="Mesa.original('combate')">Abrir la vista completa de Combate (iniciativa, maestrías, compañero) ▸</button>
        </div>
        <aside class="mesa-der">${_apoyo(c, 'combate')}</aside>
      </div>`;
  }

  function _fila({ id, icono, nombre, num, sub, det, tags = '' }) {
    const ab = st.abierto === id;
    return `<div class="mesa-op ${ab ? 'abierto' : ''}" onclick="Mesa.abrir('${id}')">
      <span class="mesa-t"><i class="mesa-ico" style="--m:url(../assets/${icono}.svg)"></i></span>
      <div class="mesa-op-tx"><b>${esc(limpio(nombre))}</b><small>${num ? `<span class="mesa-num">${num}</span> · ` : ''}${esc(sub)}</small></div>
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

  // Beast Master (PHB 2024): CA 13 + SAB, golpe = SAB + BC, daño + SAB
  function _bestia(c) {
    const comp = c.companion;
    const b = comp && comp.beast && comp.summoned !== false ? Characters.PRIMAL_COMPANION_BEASTS[comp.beast] : null;
    if (!b) return null;
    const sab = Characters.calcMod(c.stats.sab), pb = Characters.calcProfBonus(c.nivel);
    const nivel = c.classes && c.classes.length ? ((c.classes.find(x => x.name === 'Explorador') || {}).level || 0) : c.nivel;
    const max = b.calcMaxHP(nivel);
    const a = b.attacks[0];
    return { b, ca: 13 + sab, max, pg: comp.hp != null ? comp.hp : max, golpe: sab + pb, ataque: a,
      daño: `${a.damageDie}+${a.damageBonus + sab}${nivel >= 11 ? ' ×2' : ''}` };
  }

  /* ══ Columna derecha: bloques según lo que tenga el personaje ══ */
  function _apoyo(c, tab) {
    const bloques = [];
    const conc = c.concentration ? (c.spells || []).find(s => s.id === c.concentration) : null;
    const lanzador = (c.spells || []).length > 0;
    const bloqueConc = lanzador ? `<section><div class="mesa-sec">Concentración</div><div class="mesa-card mesa-conc">
      ${conc || c.concentration ? `<span class="mesa-lbl">Activa</span><b>${esc(limpio(conc ? conc.name : c.concentration))}</b>
        ${conc ? `<small>${esc([conc.range, conc.duration].filter(Boolean).join(' · '))}</small>` : ''}
        <button class="mesa-btn" onclick="App.setConc(null)">Terminar</button>` : '<span class="mesa-vacio">Ninguna</span>'}</div></section>` : '';

    const bestia = _bestia(c);
    const bloqueBestia = bestia ? `<section><div class="mesa-sec">Compañero</div><div class="mesa-card mesa-comp">
      <div class="mesa-comp-top"><span class="mesa-med"><i class="mesa-ico" style="--m:url(../assets/iconos/companero.svg)"></i></span>
        <div><b>${esc(c.companion.name || 'Compañero')}</b><small>${esc(bestia.b.name)}</small></div></div>
      <div class="mesa-comp-pg"><span class="mesa-lbl">PG</span><b>${bestia.pg} / ${bestia.max}</b><span class="mc-esp"></span>
        <button class="mesa-chip" onclick="App.adjustCompanionHP(-1)">−1</button><button class="mesa-chip" onclick="App.adjustCompanionHP(1)">+1</button></div>
      <div class="mesa-barra mc-ok">${Array.from({ length: 10 }, (_, i) => `<i class="${i < Math.round(bestia.pg / bestia.max * 10) ? '' : 'v'}"></i>`).join('')}</div>
      <div class="mesa-mini"><div><b>${bestia.ca}</b><span class="mesa-lbl">CA</span></div><div><b>${sg(bestia.golpe)}</b><span class="mesa-lbl">Ataque</span></div><div><b>${esc(bestia.daño)}</b><span class="mesa-lbl">Daño</span></div></div>
    </div></section>` : '';

    // Primero lo que define al personaje: el compañero en un Beast Master, la concentración en un lanzador
    if (bestia) bloques.push(bloqueBestia, bloqueConc); else bloques.push(bloqueConc);

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
    bloques.push(`<section><div class="mesa-sec">Condiciones</div><div class="mesa-card mesa-conds"><div class="mesa-rapidas">${
      CONDICIONES.filter(([id]) => tab === 'combate' || conds.includes(id)).map(([id, n]) =>
        `<button class="mesa-chip ${conds.includes(id) ? 'on' : ''}" onclick="App.toggleCondition('${id}')">${n}</button>`).join('') || '<span class="mesa-vacio">Ninguna</span>'}</div></div></section>`);
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
    return niveles.map(lv => `<div class="mesa-grupo"><div class="mesa-sec">${lv === 0 ? 'Trucos <small>sin espacio</small>' : `Nivel ${lv}`}</div>
      <div class="mesa-hz">${lista.filter(sp => sp.level === lv).map(sp => _filaConjuro(c, sp, true)).join('')}</div></div>`).join('');
  }

  function _filaConjuro(c, sp, conPrep) {
    const act = Characters.getActivation(sp);
    const corta = { action: 'ACC.', bonusAction: 'ADIC.', reaction: 'REAC.' }[act] || '';
    const tags = [sp.concentration ? '<span class="mesa-tg">CONC</span>' : '', sp.domain ? `<span class="mesa-tg d">◆ ${/Cl[ée]rigo/.test(c.clase || '') ? 'DOMINIO' : 'SIEMPRE'}</span>` : '',
      sp.mi ? '<span class="mesa-tg d">GRATIS</span>' : '', sp.ritual ? '<span class="mesa-tg">RITUAL</span>' : '', corta ? `<span class="mesa-tg a">${corta}</span>` : ''].join('');
    const id = 'sp-' + sp.id, ab = st.abierto === id;
    const prep = preparado(c, sp);
    const efecto = sp.damage || (sp.desc || '').split(' · ').slice(2, 4).join(' · ');
    let det = '';
    if (ab) {
      const op = App.castOptions(sp.id) || { free: false, slots: [] };
      const btns = [];
      if (sp.level === 0) btns.push(`<button class="mesa-btn p" onclick="App.castSpell('${sp.id}',0)">✨ Lanzar</button>`);
      else {
        if (op.free) btns.push(`<button class="mesa-btn p" onclick="App.castSpell('${sp.id}',0)">✦ Gratis, sin espacio</button>`);
        op.slots.forEach(lv => btns.push(`<button class="mesa-btn ${op.free ? '' : 'p'}" onclick="App.castSpell('${sp.id}',${lv})">Lanzar con espacio de nivel ${lv}</button>`));
        if (!btns.length) btns.push('<span class="mesa-vacio">Sin espacios disponibles</span>');
      }
      if (esEscritorio()) btns.push(`<button class="mesa-btn" onclick="App.copiarRoll20('conjuro','${sp.id}')">Enviar a Roll20</button>`);
      btns.push(`<button class="mesa-btn" onclick="App.castSpell('${sp.id}')">Ficha completa</button>`);
      const gasta = { action: 'tu Acción', bonusAction: 'tu Acción adicional', reaction: 'tu Reacción' }[act];
      det = `<div class="mesa-det" onclick="event.stopPropagation()">
        <div class="mesa-meta">${[sp.castTime, sp.range && App.fmtDist(sp.range), sp.duration].filter(Boolean).map(esc).join(' · ')}</div>
        <p>${esc(sp.desc || '')}</p>
        ${gasta || sp.concentration ? `<p class="mesa-aviso">Al lanzarlo ${[gasta ? 'se marca ' + gasta : '', sp.concentration ? 'pasa a ser tu concentración' : ''].filter(Boolean).join(' y ')}.</p>` : ''}
        <div class="mesa-acc">${btns.join('')}</div></div>`;
    }
    return `<div class="mesa-cj ${ab ? 'abierto' : ''}" onclick="Mesa.abrir('${id}')">
      ${conPrep ? `<span class="mesa-pr ${prep ? 'on' : ''}" ${sp.level === 0 || sp.domain ? 'title="Siempre preparado"' : `onclick="event.stopPropagation();App.toggleSpellPrepared('${sp.id}')" title="${prep ? 'Despreparar' : 'Preparar'}"`}></span>`
        : '<span class="mesa-t"><i class="mesa-ico" style="--m:url(../assets/iconos/conjuros.svg)"></i></span>'}
      <div class="mesa-op-tx"><b>${esc(limpio(sp.name))}</b><small>${esc([sp.castTime, sp.range && App.fmtDist(sp.range), efecto].filter(Boolean).join(' · '))}</small></div>
      <span class="mesa-tags">${tags}</span>${det}</div>`;
  }

  /* ── Interacciones de la vista ── */
  function abrir(id) { st.abierto = st.abierto === id ? null : id; _pintar(); }
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

  return { activo, alternar, render, vida, hoja, abrir, grupo, filtrar, buscar, original, oportunidad };
})();
window.Mesa = Mesa;   // const no queda en window: app.js lo busca ahí
