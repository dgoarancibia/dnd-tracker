/* ═══════════════════════════════════════════════════════
   bastion.js — Bastión (DMG 2024, cap. 8)

   Datos, dentro del personaje (c.bastion):
   · nombre, notas
   · basicas    [{ id, tipo, tamano }]           tipo ∈ BASICAS
   · especiales [{ id, tipo, orden, nota }]       tipo ∈ ESPECIALES
   · defensores número de Bastion Defenders
   · almacen    [{ id, nombre, valor, cant }]     mercadería del Storehouse
   · turnos     [{ fecha, ordenes: [{ tipo, orden, nota }], nota }]

   El nivel del bastión es el del personaje: define cuántas instalaciones
   especiales tienes y cuáles puedes elegir. La app no tira dados (eventos
   del bastión, Gaming Hall…): eso lo resuelve el DM en la mesa.

   Singleton global: Bastion. Se inicializa desde app.js con Bastion.init(ctx).
   ═══════════════════════════════════════════════════════ */

const Bastion = (() => {

  let ctx = null;

  /* ── Reglas (DMG 2024, verificadas con 5etools XDMG y dnd2024.wikidot) ── */

  // Instalaciones especiales según nivel del personaje.
  function cuposEspeciales(nivel) {
    if (nivel >= 17) return 6;
    if (nivel >= 13) return 5;
    if (nivel >= 9) return 4;
    if (nivel >= 5) return 2;
    return 0;
  }

  const HITOS = [5, 9, 13, 17];

  const TAMANOS = {
    cramped: { label: 'Cramped (Estrecha)', casillas: 4,  costo: 500,  dias: 20 },
    roomy:   { label: 'Roomy (Amplia)',     casillas: 16, costo: 1000, dias: 45 },
    vast:    { label: 'Vast (Enorme)',      casillas: 36, costo: 3000, dias: 125 },
  };
  // Agrandar una instalación básica.
  const AGRANDAR = {
    cramped: { a: 'roomy', costo: 500,  dias: 25 },
    roomy:   { a: 'vast',  costo: 2000, dias: 80 },
  };

  const BASICAS = {
    bedroom:  'Bedroom (Dormitorio)',
    courtyard:'Courtyard (Patio)',
    dining:   'Dining Room (Comedor)',
    kitchen:  'Kitchen (Cocina)',
    parlor:   'Parlor (Salón)',
    storage:  'Storage (Depósito)',
  };

  const ORDENES = {
    craft:    'Craft (Fabricar)',
    empower:  'Empower (Potenciar)',
    harvest:  'Harvest (Cosechar)',
    recruit:  'Recruit (Reclutar)',
    research: 'Research (Investigar)',
    trade:    'Trade (Comerciar)',
    maintain: 'Maintain (Mantener)',
  };

  /* Instalaciones especiales del DMG. `charm` = conjuro gratis que se gana
     tras un Descanso Largo en el bastión (dura 7 días o hasta usarlo). */
  const ESPECIALES = {
    'arcane-study':  { name: 'Arcane Study', es: 'Estudio arcano', nivel: 5, espacio: 'roomy', emp: 1, ordenes: ['craft'],
      prereq: 'Poder usar un foco arcano o una herramienta como foco de lanzamiento',
      charm: { conjuro: 'Identify', accion: 'Ritual', extra: 'sin componentes materiales' },
      resumen: 'Craft: un foco arcano (gratis) o un libro en blanco (10 GP), 7 días. Desde nivel 9, un objeto mágico Arcana común o infrecuente.' },
    'armory':        { name: 'Armory', es: 'Armería', nivel: 5, espacio: 'roomy', emp: 1, ordenes: ['trade'],
      resumen: 'Trade: abastecerla cuesta 100 GP + 100 GP por defensor (la mitad con Smithy). Abastecida, los defensores tiran d8 en vez de d6 al ver si mueren en un ataque.' },
    'barrack':       { name: 'Barrack', es: 'Barracón', nivel: 5, espacio: 'roomy', emp: 1, ordenes: ['recruit'],
      multiple: true,
      resumen: 'Recruit: hasta 4 Bastion Defenders gratis por orden. Aloja 12 (25 si la agrandas a Vast por 2.000 GP).' },
    'garden':        { name: 'Garden', es: 'Jardín', nivel: 5, espacio: 'roomy', emp: 1, ordenes: ['harvest'],
      multiple: true,
      resumen: 'Harvest (7 días, gratis) según su tipo: decorativo (10 ramos, perfumes o velas), comida (100 días de raciones), hierbas (10 Healer\'s Kit o 1 Potion of Healing) o veneno (2 Antitoxin o 1 Basic Poison).' },
    'library':       { name: 'Library', es: 'Biblioteca', nivel: 5, espacio: 'roomy', emp: 1, ordenes: ['research'],
      resumen: 'Research: 7 días investigando un tema; el empleado te trae hasta 3 datos que no sabías (los decide el DM).' },
    'sanctuary':     { name: 'Sanctuary', es: 'Santuario', nivel: 5, espacio: 'roomy', emp: 1, ordenes: ['craft'],
      prereq: 'Poder usar un símbolo sagrado o un foco druídico como foco de lanzamiento',
      charm: { conjuro: 'Healing Word', accion: 'Acción bonus', extra: 'sin gastar espacio de conjuro' },
      resumen: 'Craft: un símbolo sagrado o un foco druídico (vara), 7 días, gratis. Queda en el bastión hasta que lo retires.' },
    'smithy':        { name: 'Smithy', es: 'Herrería', nivel: 5, espacio: 'roomy', emp: 2, ordenes: ['craft'],
      resumen: 'Craft: lo que se fabrica con Smith\'s Tools. Desde nivel 9, un objeto mágico Armament común o infrecuente.' },
    'storehouse':    { name: 'Storehouse', es: 'Almacén', nivel: 5, espacio: 'roomy', emp: 1, ordenes: ['trade'],
      resumen: 'Trade: 7 días comprando mercadería no mágica (tope según nivel) o vendiendo lo guardado con recargo.' },
    'workshop':      { name: 'Workshop', es: 'Taller', nivel: 5, espacio: 'roomy', emp: 3, ordenes: ['craft'],
      resumen: 'Craft con sus 6 herramientas de artesano. Desde nivel 9, un objeto mágico Implement común o infrecuente. Un Descanso Corto aquí da Heroic Inspiration (1 vez por Descanso Largo).' },
    'gaming-hall':   { name: 'Gaming Hall', es: 'Salón de juegos', nivel: 9, espacio: 'vast', emp: 4, ordenes: ['trade'],
      resumen: 'Trade: 7 días como casa de apuestas; el DM tira tu parte de las ganancias.' },
    'greenhouse':    { name: 'Greenhouse', es: 'Invernadero', nivel: 9, espacio: 'roomy', emp: 1, ordenes: ['harvest'],
      resumen: '3 frutos diarios con Lesser Restoration. Harvest (7 días, gratis): una Potion of Greater Healing o un veneno (Assassin\'s Blood, Malice, Pale Tincture o Truth Serum).' },
    'laboratory':    { name: 'Laboratory', es: 'Laboratorio', nivel: 9, espacio: 'roomy', emp: 1, ordenes: ['craft'],
      resumen: 'Craft: lo que se fabrica con Alchemist\'s Supplies, o un veneno (Burnt Othur Fumes, Essence of Ether o Torpor) pagando la mitad de su costo.' },
    'sacristy':      { name: 'Sacristy', es: 'Sacristía', nivel: 9, espacio: 'roomy', emp: 1, ordenes: ['craft'],
      prereq: 'Poder usar un símbolo sagrado o un foco druídico como foco de lanzamiento',
      resumen: 'Craft: Holy Water (gratis; +1d8 de daño por cada 100 GP, hasta 500) o un objeto mágico Relic común o infrecuente. Un Descanso Corto aquí recupera 1 espacio de nivel ≤5 (1 vez por Descanso Largo).' },
    'scriptorium':   { name: 'Scriptorium', es: 'Escritorio', nivel: 9, espacio: 'roomy', emp: 1, ordenes: ['craft'],
      resumen: 'Craft: copia de un libro, un Spell Scroll de Clérigo o Mago de nivel ≤3 (pagas su costo) o hasta 50 copias de un panfleto (1 GP c/u).' },
    'stable':        { name: 'Stable', es: 'Establo', nivel: 9, espacio: 'roomy', emp: 1, ordenes: ['trade'],
      multiple: true,
      resumen: 'Viene con 1 caballo o camello y 2 ponis o mulas. Trade: comprar monturas a precio normal o venderlas con +20% (+50% en nivel 13, +100% en 17).' },
    'teleportation-circle': { name: 'Teleportation Circle', es: 'Círculo de teletransporte', nivel: 9, espacio: 'roomy', emp: 1, ordenes: ['recruit'],
      resumen: 'Recruit: invitas a un lanzador amistoso (el DM tira si acepta). Si viene, te lanza un conjuro de Mago de nivel ≤4 (≤8 en nivel 17) y se queda 14 días.' },
    'theater':       { name: 'Theater', es: 'Teatro', nivel: 9, espacio: 'vast', emp: 4, ordenes: ['empower'],
      resumen: 'Empower: 14 días de ensayo y luego funciones. Si gana la mayoría de pruebas de CAR (Performance) CD 15, cada participante gana un Theater die (d6) para sumar a una prueba d20.' },
    'training-area': { name: 'Training Area', es: 'Área de entrenamiento', nivel: 9, espacio: 'vast', emp: 4, ordenes: ['empower'],
      multiple: true,
      resumen: 'Empower: 7 días entrenando 8 h diarias con el experto elegido (batalla, habilidades, herramientas, desarmado o armas); su beneficio dura 7 días.' },
    'trophy-room':   { name: 'Trophy Room', es: 'Sala de trofeos', nivel: 9, espacio: 'roomy', emp: 1, ordenes: ['research'],
      resumen: 'Research: hasta 3 datos sobre un tema, o buscar una baratija (el DM tira; con suerte, un objeto mágico Implement común).' },
    'archive':       { name: 'Archive', es: 'Archivo', nivel: 13, espacio: 'roomy', emp: 1, ordenes: ['research'],
      resumen: 'Research: Legend Lore a través del empleado. Incluye un libro de referencia con beneficio.' },
    'meditation-chamber': { name: 'Meditation Chamber', es: 'Cámara de meditación', nivel: 13, espacio: 'cramped', emp: 1, ordenes: ['empower'],
      resumen: 'Empower: tiras dos veces el próximo evento del bastión. Meditar 7 días da ventaja en 2 salvaciones por 7 días.' },
    'menagerie':     { name: 'Menagerie', es: 'Casa de fieras', nivel: 13, espacio: 'vast', emp: 2, ordenes: ['recruit'],
      resumen: 'Recruit: compras una criatura que cuenta como defensor.' },
    'observatory':   { name: 'Observatory', es: 'Observatorio', nivel: 13, espacio: 'roomy', emp: 1, ordenes: ['empower'],
      prereq: 'Poder usar un foco de lanzamiento de conjuros',
      charm: { conjuro: 'Contact Other Plane', accion: 'Ritual', extra: 'sin gastar espacio de conjuro' },
      resumen: 'Empower: 7 noches estudiando las estrellas; el DM tira y, si sale impar, ganas un Charm (Darkvision, Heroism o Vitality). El Charm de Contact Other Plane se gana con un Descanso Largo en el Observatory.' },
    'pub':           { name: 'Pub', es: 'Taberna', nivel: 13, espacio: 'roomy', emp: 1, ordenes: ['research'],
      resumen: 'Research: los espías del tabernero averiguan lo que pasa a 10 millas y ubican criaturas conocidas a 50 millas. Tiene una bebida mágica de la casa.' },
    'reliquary':     { name: 'Reliquary', es: 'Relicario', nivel: 13, espacio: 'cramped', emp: 1, ordenes: ['harvest'],
      prereq: 'Poder usar un símbolo sagrado o un foco druídico como foco de lanzamiento',
      charm: { conjuro: 'Greater Restoration', accion: 'Acción', extra: 'sin componentes materiales' },
      resumen: 'Harvest: un talismán que reemplaza componentes de hasta 1.000 GP.' },
    'demiplane':     { name: 'Demiplane', es: 'Semiplano', nivel: 17, espacio: 'vast', emp: 1, ordenes: ['empower'],
      prereq: 'Poder usar un foco arcano o una herramienta como foco de lanzamiento',
      resumen: 'Empower: PG temporales = 5 × tu nivel tras un Descanso Largo allí. Puedes fabricar objetos no mágicos.' },
    'guildhall':     { name: 'Guildhall', es: 'Sede del gremio', nivel: 17, espacio: 'vast', emp: 1, ordenes: ['recruit'],
      prereq: 'Expertise en una habilidad',
      resumen: 'Recruit: encargos a los ~50 miembros de tu gremio.' },
    'sanctum':       { name: 'Sanctum', es: 'Sanctasanctórum', nivel: 17, espacio: 'roomy', emp: 4, ordenes: ['empower'],
      prereq: 'Poder usar un símbolo sagrado o un foco druídico como foco de lanzamiento',
      charm: { conjuro: 'Heal', accion: 'Acción', extra: 'sin gastar espacio de conjuro' },
      resumen: 'Empower: PG temporales = tu nivel en cada Descanso Largo por 7 días. Siempre tienes Word of Recall preparado.' },
    'war-room':      { name: 'War Room', es: 'Sala de guerra', nivel: 17, espacio: 'vast', emp: 2, ordenes: ['recruit'],
      prereq: 'Fighting Style o Unarmored Defense',
      resumen: 'Recruit: lugartenientes o un ejército. Cada lugarteniente reduce las bajas en un ataque.' },
  };

  // Storehouse: tope de compra y recargo de venta por nivel.
  function almacenReglas(nivel) {
    return {
      tope:    nivel >= 13 ? 5000 : nivel >= 9 ? 2000 : 500,
      recargo: nivel >= 17 ? 100 : nivel >= 13 ? 50 : nivel >= 9 ? 20 : 10,
    };
  }

  /* ── Estado ──────────────────────────────────────────────────────────── */

  function nuevo() {
    return { nombre: '', notas: '', basicas: [], especiales: [], defensores: 0, almacen: [], turnos: [] };
  }

  function _b() {
    const c = ctx && ctx.getChar();
    if (!c) return null;
    if (!c.bastion) return null;
    const b = c.bastion;
    ['basicas', 'especiales', 'almacen', 'turnos'].forEach(k => { if (!Array.isArray(b[k])) b[k] = []; });
    if (typeof b.defensores !== 'number') b.defensores = 0;
    return b;
  }

  const _id = p => `${p}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
  const _esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
  const _gp = n => `${Number(n || 0).toLocaleString('es')} GP`;

  function _guardar() { ctx.save(true); render(); }

  /* ── Acciones ────────────────────────────────────────────────────────── */

  function setCampo(campo, valor) {
    const b = _b(); if (!b) return;
    b[campo] = campo === 'defensores' ? Math.max(0, parseInt(valor) || 0) : valor;
    ctx.save(true);
    if (campo === 'defensores') render();
  }

  function ajustarDefensores(delta) {
    const b = _b(); if (!b) return;
    b.defensores = Math.max(0, b.defensores + delta);
    _guardar();
  }

  function agregarEspecial(tipo) {
    const b = _b(); if (!b || !ESPECIALES[tipo]) return;
    const nivel = ctx.getChar().nivel || 1;
    if (b.especiales.length >= cuposEspeciales(nivel)) { ctx.toast('No te quedan instalaciones especiales a este nivel'); return; }
    if (ESPECIALES[tipo].nivel > nivel) { ctx.toast(`${ESPECIALES[tipo].name} pide nivel ${ESPECIALES[tipo].nivel}`); return; }
    if (!ESPECIALES[tipo].multiple && b.especiales.some(e => e.tipo === tipo)) { ctx.toast(`Solo puedes tener un ${ESPECIALES[tipo].name}`); return; }
    b.especiales.push({ id: _id('esp'), tipo, orden: '', nota: '' });
    _guardar();
  }

  function quitarEspecial(id) {
    const b = _b(); if (!b) return;
    const e = b.especiales.find(x => x.id === id);
    if (!e) return;
    ctx.confirm(`¿Quitar ${(ESPECIALES[e.tipo] || {}).name || 'la instalación'} del bastión?`, () => {
      b.especiales = b.especiales.filter(x => x.id !== id);
      _guardar();
    });
  }

  function setEspecial(id, campo, valor) {
    const b = _b(); if (!b) return;
    const e = b.especiales.find(x => x.id === id);
    if (!e) return;
    e[campo] = valor;
    ctx.save(true);
  }

  function agregarBasica(tipo, tamano) {
    const b = _b(); if (!b || !BASICAS[tipo] || !TAMANOS[tamano]) return;
    b.basicas.push({ id: _id('bas'), tipo, tamano });
    _guardar();
  }

  function agrandarBasica(id) {
    const b = _b(); if (!b) return;
    const f = b.basicas.find(x => x.id === id);
    const up = f && AGRANDAR[f.tamano];
    if (!up) return;
    ctx.confirm(`Agrandar ${BASICAS[f.tipo]} a ${TAMANOS[up.a].label} cuesta ${_gp(up.costo)} y ${up.dias} días. ¿Marcarla como agrandada?`, () => {
      f.tamano = up.a;
      _guardar();
    });
  }

  function quitarBasica(id) {
    const b = _b(); if (!b) return;
    const f = b.basicas.find(x => x.id === id);
    if (!f) return;
    ctx.confirm(`¿Quitar ${BASICAS[f.tipo]} del bastión?`, () => {
      b.basicas = b.basicas.filter(x => x.id !== id);
      _guardar();
    });
  }

  function agregarMercaderia() {
    const b = _b(); if (!b) return;
    const nombreEl = document.getElementById('bstMercNombre');
    const valorEl = document.getElementById('bstMercValor');
    const cantEl = document.getElementById('bstMercCant');
    const nombre = (nombreEl && nombreEl.value || '').trim();
    if (!nombre) { ctx.toast('Ponle nombre a la mercadería'); return; }
    b.almacen.push({ id: _id('mer'), nombre, valor: Math.max(0, parseFloat(valorEl && valorEl.value) || 0),
                     cant: Math.max(1, parseInt(cantEl && cantEl.value) || 1) });
    _guardar();
  }

  function setMercaderia(id, campo, valor) {
    const b = _b(); if (!b) return;
    const m = b.almacen.find(x => x.id === id);
    if (!m) return;
    m[campo] = campo === 'nombre' ? valor : Math.max(campo === 'cant' ? 0 : 0, parseFloat(valor) || 0);
    _guardar();
  }

  function quitarMercaderia(id) {
    const b = _b(); if (!b) return;
    b.almacen = b.almacen.filter(x => x.id !== id);
    _guardar();
  }

  /* Cierra el turno de bastión (7 días): guarda en el historial las
     órdenes dadas y las limpia para el siguiente. */
  function cerrarTurno() {
    const b = _b(); if (!b) return;
    const notaEl = document.getElementById('bstTurnoNota');
    const nota = (notaEl && notaEl.value || '').trim();
    const ordenes = b.maintain ? [] : b.especiales.filter(e => e.orden)
      .map(e => ({ tipo: e.tipo, orden: e.orden, nota: e.nota || '' }));
    b.turnos.unshift({ fecha: new Date().toISOString(), maintain: !!b.maintain, ordenes, nota });
    b.especiales.forEach(e => { e.orden = ''; e.nota = ''; });
    b.maintain = false;
    _guardar();
    ctx.toast(b.turnos[0].maintain ? 'Turno registrado con Maintain: el DM tira un evento'
      : ordenes.length ? 'Turno de bastión registrado' : 'Turno registrado sin órdenes');
  }

  /* Maintain se da al bastión entero: mientras está activo no hay órdenes
     a instalaciones. También es lo que pasa si no estás en el bastión. */
  function toggleMaintain() {
    const b = _b(); if (!b) return;
    b.maintain = !b.maintain;
    if (b.maintain) b.especiales.forEach(e => { e.orden = ''; });
    _guardar();
  }

  function borrarTurno(i) {
    const b = _b(); if (!b || !b.turnos[i]) return;
    ctx.confirm('¿Borrar este turno del historial?', () => { b.turnos.splice(i, 1); _guardar(); });
  }

  /* Descanso Largo en el bastión: cada instalación con Charm lo entrega
     como recurso de 1 uso. No se puede tener dos veces el mismo. */
  function descansoEnBastion() {
    const b = _b(); if (!b) return;
    const c = ctx.getChar();
    if (!Array.isArray(c.resources)) c.resources = [];
    const ganados = [];
    b.especiales.forEach(e => {
      const def = ESPECIALES[e.tipo];
      if (!def || !def.charm) return;
      const rid = `charm-${e.tipo}`;
      const r = c.resources.find(x => x.id === rid);
      if (r && r.current > 0) return;   // todavía lo tienes
      const charm = {
        id: rid, name: `${def.name} Charm`, current: 1, max: 1, recharge: 'never',
        action: def.charm.accion, range: '',
        desc: `${def.charm.conjuro} una vez, ${def.charm.extra}. Dura 7 días o hasta usarlo.`,
        fullDesc: `Charm del ${def.name} de tu bastión: lanzas ${def.charm.conjuro} una vez ${def.charm.extra}. ` +
          'Dura 7 días o hasta que lo uses, y no lo puedes volver a ganar mientras lo tengas (DMG 2024).',
      };
      if (r) Object.assign(r, charm); else c.resources.push(charm);
      ganados.push(def.name);
    });
    ctx.save(true);
    render();
    ctx.refresh();
    ctx.toast(ganados.length ? `Charm ganado: ${ganados.join(', ')}` : 'Ya tienes tus Charms (o no hay instalaciones con Charm)');
  }

  /* ── Render ──────────────────────────────────────────────────────────── */

  function _siguienteHito(nivel, b) {
    const prox = HITOS.find(h => h > nivel);
    if (!prox) return 'Ya tienes el máximo de instalaciones especiales.';
    const partes = [`${cuposEspeciales(prox)} instalaciones especiales y se habilitan las de nivel ${prox}`];
    if (b.especiales.some(e => e.tipo === 'storehouse')) {
      const r = almacenReglas(prox), a = almacenReglas(nivel);
      if (r.tope !== a.tope) partes.push(`Storehouse compra hasta ${_gp(r.tope)}`);
      if (r.recargo !== a.recargo) partes.push(`vende con +${r.recargo}%`);
    }
    return `En nivel ${prox}: ${partes.join(' · ')}.`;
  }

  /* Neglect: si pasan tantos turnos seguidos sin órdenes como tu nivel,
     los empleados abandonan el bastión. Maintain sí cuenta como orden. */
  function _turnosSinOrdenes(b) {
    let n = 0;
    for (const t of b.turnos) { if (t.maintain || (t.ordenes && t.ordenes.length)) break; n++; }
    return n;
  }

  function _cardEspecial(e, c) {
    const def = ESPECIALES[e.tipo];
    if (!def) return '';
    const opciones = def.ordenes.map(o =>
      `<option value="${o}" ${e.orden === o ? 'selected' : ''}>${ORDENES[o]}</option>`).join('');
    let extra = '';
    if (def.charm) {
      const r = (c.resources || []).find(x => x.id === `charm-${e.tipo}`);
      const activo = r && r.current > 0;
      extra += `<div class="bst-charm ${activo ? 'activo' : ''}">✦ Charm: ${_esc(def.charm.conjuro)} ${_esc(def.charm.extra)} ·
        ${activo ? '<b>lo tienes</b> (en Recursos)' : 'se gana con un Descanso Largo en el bastión'}</div>`;
    }
    if (e.tipo === 'storehouse') extra += _bloqueAlmacen(c);
    return `
      <div class="bst-card">
        <div class="bst-card-top">
          <span class="bst-card-name">${_esc(def.name)} <span class="nm-es">(${_esc(def.es)})</span></span>
          <span class="bst-tag">Nv ${def.nivel}</span>
          <span class="bst-tag">${TAMANOS[def.espacio].label.split(' ')[0]}</span>
          <span class="bst-tag">${def.emp} empleado${def.emp > 1 ? 's' : ''}</span>
          <button class="bst-x" onclick="Bastion.quitarEspecial('${e.id}')" title="Quitar">✕</button>
        </div>
        <div class="bst-resumen">${_esc(def.resumen)}</div>
        ${def.prereq ? `<div class="bst-prereq">Requisito: ${_esc(def.prereq)}</div>` : ''}
        ${extra}
        <div class="bst-orden">
          <label>Orden este turno</label>
          <select onchange="Bastion.setEspecial('${e.id}','orden',this.value)" ${_b().maintain ? 'disabled' : ''}>
            <option value="">— Sin orden —</option>${opciones}
          </select>
          <input type="text" placeholder="Detalle (qué fabrica, qué investiga…)" value="${_esc(e.nota)}"
                 onchange="Bastion.setEspecial('${e.id}','nota',this.value)" ${_b().maintain ? 'disabled' : ''}>
        </div>
      </div>`;
  }

  function _bloqueAlmacen(c) {
    const b = _b();
    const reg = almacenReglas(c.nivel || 1);
    const total = b.almacen.reduce((s, m) => s + (m.valor || 0) * (m.cant || 0), 0);
    const filas = b.almacen.map(m => {
      const sub = (m.valor || 0) * (m.cant || 0);
      return `
        <tr>
          <td><input type="text" value="${_esc(m.nombre)}" onchange="Bastion.setMercaderia('${m.id}','nombre',this.value)"></td>
          <td><input type="number" min="0" value="${m.cant}" onchange="Bastion.setMercaderia('${m.id}','cant',this.value)"></td>
          <td><input type="number" min="0" step="0.01" value="${m.valor}" onchange="Bastion.setMercaderia('${m.id}','valor',this.value)"></td>
          <td class="bst-num">${_gp(sub)}</td>
          <td class="bst-num bst-venta">${_gp(Math.round(sub * (100 + reg.recargo)) / 100)}</td>
          <td><button class="bst-x" onclick="Bastion.quitarMercaderia('${m.id}')">✕</button></td>
        </tr>`;
    }).join('');
    return `
      <div class="bst-almacen">
        <div class="bst-almacen-reglas">Compra hasta <b>${_gp(reg.tope)}</b> por turno · vende con <b>+${reg.recargo}%</b> sobre el precio normal</div>
        <table class="bst-tabla">
          <thead><tr><th>Mercadería</th><th>Cant.</th><th>Valor c/u</th><th>Valor</th><th>Venta</th><th></th></tr></thead>
          <tbody>${filas || '<tr><td colspan="6" class="bst-vacio">Sin mercadería guardada</td></tr>'}</tbody>
          ${b.almacen.length ? `<tfoot><tr><td colspan="3">Total</td><td class="bst-num">${_gp(total)}</td>
            <td class="bst-num bst-venta">${_gp(Math.round(total * (100 + reg.recargo)) / 100)}</td><td></td></tr></tfoot>` : ''}
        </table>
        <div class="bst-add-row">
          <input type="text" id="bstMercNombre" placeholder="Mercadería">
          <input type="number" id="bstMercCant" placeholder="Cant." min="1" value="1">
          <input type="number" id="bstMercValor" placeholder="GP c/u" min="0" step="0.01">
          <button class="btn-sm" onclick="Bastion.agregarMercaderia()">+ Agregar</button>
        </div>
      </div>`;
  }

  function render() {
    const cont = document.getElementById('col-bastion');
    if (!cont || !ctx) return;
    const c = ctx.getChar();
    const b = _b();
    if (!c || !b) { cont.innerHTML = ''; return; }
    const nivel = c.nivel || 1;
    const cupos = cuposEspeciales(nivel);
    const libres = cupos - b.especiales.length;

    const elegidas = new Set(b.especiales.map(e => e.tipo));
    const disponibles = Object.entries(ESPECIALES)
      .filter(([k, d]) => d.nivel <= nivel && (d.multiple || !elegidas.has(k)))
      .sort((a, b2) => a[1].nivel - b2[1].nivel || a[1].name.localeCompare(b2[1].name))
      .map(([k, d]) => `<option value="${k}">${_esc(d.name)} (${_esc(d.es)}) · nv ${d.nivel}${d.prereq ? ' · requisito' : ''}</option>`).join('');

    const basicas = b.basicas.map(f => {
      const up = AGRANDAR[f.tamano];
      return `
        <div class="bst-basica">
          <span>${_esc(BASICAS[f.tipo] || f.tipo)}</span>
          <span class="bst-tag">${TAMANOS[f.tamano].label}</span>
          ${up ? `<button class="btn-sm" onclick="Bastion.agrandarBasica('${f.id}')" title="${_gp(up.costo)} · ${up.dias} días">Agrandar</button>` : ''}
          <button class="bst-x" onclick="Bastion.quitarBasica('${f.id}')">✕</button>
        </div>`;
    }).join('');

    const turnos = b.turnos.slice(0, 12).map((t, i) => `
      <div class="bst-turno">
        <div class="bst-turno-top"><b>${new Date(t.fecha).toLocaleDateString('es', { day: '2-digit', month: '2-digit', year: '2-digit' })}</b>
          <button class="bst-x" onclick="Bastion.borrarTurno(${i})">✕</button></div>
        ${t.maintain ? '<div>· Maintain (todo el bastión) — el DM tiró un evento</div>' : ''}
        ${!t.maintain && !t.ordenes.length ? '<div>· Sin órdenes</div>' : ''}
        ${t.ordenes.map(o => `<div>· ${_esc((ESPECIALES[o.tipo] || {}).name || o.tipo)}: ${_esc(ORDENES[o.orden] || o.orden)}${o.nota ? ` — ${_esc(o.nota)}` : ''}</div>`).join('')}
        ${t.nota ? `<div class="bst-turno-nota">${_esc(t.nota)}</div>` : ''}
      </div>`).join('');

    const hayCharm = b.especiales.some(e => (ESPECIALES[e.tipo] || {}).charm);

    cont.innerHTML = `
      <div class="bst-head">
        <input class="bst-nombre" type="text" placeholder="Nombre del bastión" value="${_esc(b.nombre)}"
               onchange="Bastion.setCampo('nombre',this.value)">
        <div class="bst-nivel">Nivel ${nivel} · Especiales <b>${b.especiales.length}/${cupos}</b></div>
        <div class="bst-hito">${_esc(_siguienteHito(nivel, b))} Cada vez que subes de nivel puedes cambiar una instalación especial por otra.</div>
        ${_turnosSinOrdenes(b) ? `<div class="bst-aviso">⚠ ${_turnosSinOrdenes(b)} turno(s) seguido(s) sin órdenes: con ${nivel} los empleados abandonan el bastión.</div>` : ''}
        ${hayCharm ? `<button class="btn-sm bst-descanso" onclick="Bastion.descansoEnBastion()">✦ Descanso Largo en el bastión (gana Charms)</button>` : ''}
      </div>

      <div class="section-hd">Instalaciones especiales</div>
      ${b.especiales.map(e => _cardEspecial(e, c)).join('') || '<div class="bst-vacio">Todavía no eliges instalaciones especiales.</div>'}
      ${libres > 0 ? `
        <div class="bst-add-row">
          <select id="bstNuevaEsp"><option value="">Elegir instalación (${libres} libre${libres > 1 ? 's' : ''})…</option>${disponibles}</select>
          <button class="btn-sm" onclick="Bastion.agregarEspecial(document.getElementById('bstNuevaEsp').value)">+ Agregar</button>
        </div>` : ''}

      <div class="section-hd">Turno de bastión</div>
      <div class="bst-ayuda">Cada 7 días de juego (o lo que fije el DM). Estando en el bastión, das órdenes a las instalaciones que quieras, o <b>Maintain</b> a todo el bastión; Maintain impide otras órdenes y el DM tira un evento. Si no estás en el bastión, cuenta como Maintain (salvo que uses Sending o algo parecido).</div>
      <label class="bst-maintain"><input type="checkbox" ${b.maintain ? 'checked' : ''} onchange="Bastion.toggleMaintain()"> Maintain este turno (todo el bastión)</label>
      <div class="bst-add-row">
        <input type="text" id="bstTurnoNota" placeholder="Qué pasó este turno (evento, resultado…)">
        <button class="btn-sm" onclick="Bastion.cerrarTurno()">Registrar turno</button>
      </div>
      ${turnos ? `<div class="bst-turnos">${turnos}</div>` : ''}

      <div class="section-hd">Instalaciones básicas</div>
      ${basicas || '<div class="bst-vacio">Empiezas con 2 gratis: una Cramped y una Roomy.</div>'}
      <div class="bst-add-row">
        <select id="bstNuevaBas">${Object.entries(BASICAS).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select>
        <select id="bstNuevaBasTam">${Object.entries(TAMANOS).map(([k, t]) => `<option value="${k}">${t.label} · ${_gp(t.costo)} · ${t.dias} días</option>`).join('')}</select>
        <button class="btn-sm" onclick="Bastion.agregarBasica(document.getElementById('bstNuevaBas').value, document.getElementById('bstNuevaBasTam').value)">+ Agregar</button>
      </div>

      <div class="section-hd">Defensores</div>
      <div class="bst-defensores">
        <button class="btn-sm" onclick="Bastion.ajustarDefensores(-1)">−</button>
        <b>${b.defensores}</b>
        <button class="btn-sm" onclick="Bastion.ajustarDefensores(1)">+</button>
        <span class="bst-ayuda">Bastion Defenders (se reclutan con Barrack u otras instalaciones).</span>
      </div>

      <details class="bst-reglas">
        <summary>Reglas del bastión (DMG 2024)</summary>
        <ul>
          <li>Lo ganas en nivel 5 con 2 instalaciones básicas gratis (una Cramped y una Roomy) y 2 especiales para las que cumplas el requisito.</li>
          <li>Especiales: 2 en nivel 5, 4 en nivel 9, 5 en nivel 13, 6 en nivel 17. No se compran; cada una se elige una sola vez, salvo Barrack, Garden, Stable y Training Area.</li>
          <li>Cada especial trae sus empleados y genera lo justo para pagarles.</li>
          <li>Las básicas no tienen efecto de juego. Agregar: Cramped 500 GP / 20 días, Roomy 1.000 GP / 45 días, Vast 3.000 GP / 125 días. Agrandar: Cramped→Roomy 500 GP / 25 días, Roomy→Vast 2.000 GP / 80 días. No necesitas estar en el bastión.</li>
          <li>Muralla defensiva: 250 GP y 10 días por casilla de 1,5 m. Si rodea todo el bastión, en un ataque se tiran 2 dados menos para ver cuántos defensores mueren.</li>
          <li>Los eventos del bastión solo ocurren con Maintain, y los tira el DM.</li>
          <li>Neglect: si no das órdenes durante tantos turnos seguidos como tu nivel, los empleados se van y el bastión se pierde.</li>
        </ul>
      </details>

      <div class="section-hd">Notas</div>
      <textarea class="bst-notas" rows="3" placeholder="Empleados, ubicación, deudas…"
                onchange="Bastion.setCampo('notas',this.value)">${_esc(b.notas)}</textarea>`;
  }

  function init(c) { ctx = c; }

  return {
    init, render, nuevo,
    cuposEspeciales, almacenReglas, ESPECIALES, BASICAS,
    setCampo, ajustarDefensores,
    agregarEspecial, quitarEspecial, setEspecial,
    agregarBasica, agrandarBasica, quitarBasica,
    agregarMercaderia, setMercaderia, quitarMercaderia,
    cerrarTurno, borrarTurno, descansoEnBastion, toggleMaintain,
  };
})();
