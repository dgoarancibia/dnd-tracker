// Vista Mesa (beta): se activa y desactiva desde el menú sin tocar la vista
// actual; lanzar un conjuro gasta el espacio, marca la acción y la
// concentración; atacar, usar recursos y la vida funcionan; contraste,
// iPad horizontal sin scroll lateral y celular con la hoja de Tiradas.
const puppeteer = require('puppeteer-core');
const { CHROME, URL_BASE } = require('./entorno');
const AUDITAR = require('./contraste');
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new' });
  const p = await browser.newPage();
  p.on('pageerror', e => console.log('ERROR:', e.message));
  const fallidos = [];
  p.on('response', r => { if (r.status() >= 400 && !/favicon/.test(r.url())) fallidos.push(r.status() + ' ' + r.url()); });
  const res = [];
  const chk = (nombre, ok, dato) => { res.push(ok); console.log(ok ? 'OK ' : 'MAL', nombre, dato !== undefined ? JSON.stringify(dato) : ''); };

  await p.setViewport({ width: 1440, height: 900 });
  await p.goto(URL_BASE + '/index.html', { waitUntil: 'networkidle2' });
  await p.evaluate(() => {
    localStorage.setItem('dnd_guest', '1'); localStorage.setItem('dnd_theme', 'dark'); localStorage.setItem('dnd_theme_v1', 'dark');
    localStorage.removeItem('dnd_vista');
    const t = Characters.createNew('Torvald Ironhollow', 'Explorador'); t.id = 'tv'; t.nivel = 3; t.subclase = 'Beast Master';
    t.companion = { beast: 'land', name: 'Grum' };
    const arma = (id, name, type, die) => ({ id, name, kind: 'weapon', die, type, bonuses: { ac: 0, attack: 0, damage: 0, save: 0 }, buffs: [] });
    t.equipment = { ...(t.equipment || {}), mainHand: arma('shortsword', 'Shortsword', 'melee', '1d6') };
    const l = Characters.buildLursey();
    // Como lo anotó Diego: recurso propio con el nombre mal escrito
    l.resources.push({ id: 'custom-1', name: 'Amulet Of devoltion', current: 1, max: 1, recharge: 'long', note: '' });
    // Aztram: Guerrero 5 Echo Knight, con los rasgos de la subclase ya elegida
    const a = Characters.createNew('Aztram', 'Guerrero'); a.id = 'az'; a.nivel = 5; a.subclase = 'Echo Knight';
    a.classes = [{ name: 'Guerrero', level: 5, subclass: 'Echo Knight' }]; a.stats = { for: 16, des: 12, con: 16, int: 10, sab: 12, car: 8 };
    a.features = [...(a.features || []), ...Characters.SUBCLASES_CONFIG['Echo Knight'].features(5)];
    a.equipment = { ...(a.equipment || {}), mainHand: arma('longsword', 'Longsword', 'melee', '1d8') };
    Storage.saveChar(t); Storage.saveChar(l); Storage.saveChar(a);
  });
  const ficha = async (id, w = 1440, h = 900) => {
    await p.setViewport({ width: w, height: h });
    await p.evaluate(id => { Storage.setActiveId(id); sessionStorage.setItem('dnd_playing', '1'); }, id);
    await p.goto(URL_BASE + '/app.html', { waitUntil: 'networkidle2' }); await sleep(1400);
  };
  // Con getBoundingClientRect: offsetParent es null en lo fijo (botón Tiradas, hoja)
  const visible = sel => p.evaluate(sel => { const e = document.querySelector(sel); if (!e) return false; const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== 'hidden'; }, sel);

  // 1. Sin activarla, la ficha es la de siempre
  await ficha('lursey-brumaclara');
  chk('por defecto: vista actual, sin rastros de Mesa', !(await visible('#mesaCab')) && !(await visible('#mesaTiradas')) && await visible('#statsSidebar') && await visible('.stats-strip'));

  // 2. Se activa desde Ajustes del menú
  await p.click('#headerMenuToggle'); await sleep(200);
  await p.evaluate(() => { document.querySelector('.hm-grupo[data-grupo="ajustes"]').open = true; });
  await p.click('#mesaToggleBtn'); await sleep(400);
  chk('el menú la activa: cabecera, tiradas y panel nuevos; lo de antes oculto',
    await visible('#mesaCab') && await visible('#mesaTiradas') && await visible('#mesa-combate') && !(await visible('#statsSidebar')) && !(await visible('#col-combate-stack')));
  await p.reload({ waitUntil: 'networkidle2' }); await sleep(1400);
  chk('la preferencia se recuerda al recargar', await visible('#mesaCab'));

  // Fuera de combate: Combate muestra explorar/preparar; lanzar no marca el turno
  const fuera = await p.evaluate(() => ({ modo: !!document.querySelector('.mesa-modo'), titulos: [...document.querySelectorAll('#mesa-combate .mesa-col-hd')].map(h => h.textContent.trim()),
    ayuda: [...document.querySelectorAll('#mesa-combate .mesa-col')].find(x => /Ayudar/.test(x.textContent))?.textContent || '',
    rituales: [...document.querySelectorAll('#mesa-combate .mesa-col')].find(x => /Rituales/.test(x.textContent))?.textContent || '',
    turnoCab: !!document.querySelector('#mesaCab [onclick="App.toggleRecursoTurno(\'action\')"]'), iniciar: !!document.querySelector('#mesaCab [onclick="Mesa.combate(true)"]') }));
  chk('fuera de combate: Ayudar en una prueba (Guidance) y guía; sin Rituales porque ninguno está preparado; la cabecera ofrece Iniciar combate',
    fuera.modo && /Guidance/.test(fuera.ayuda) && !fuera.titulos.includes('Rituales') && fuera.titulos.some(t => /guía/.test(t)) && !fuera.turnoCab && fuera.iniciar, fuera);
  await p.evaluate(() => { Mesa.abrir('sp-fc-guidance'); }); await sleep(200);
  await p.evaluate(() => document.querySelector('.mesa-cj.abierto .mesa-acc .mesa-btn.p').click()); await sleep(300);
  chk('Guidance fuera de combate no marca la Acción', await p.evaluate(() => !App.getActiveChar().turn.action && App.getActiveChar().concentration === 'guidance'));
  const orden = await p.evaluate(() => [...document.querySelectorAll('.tab-btn')].filter(b => b.offsetParent).sort((a, b) => a.getBoundingClientRect().left - b.getBoundingClientRect().left).map(b => b.dataset.tab));
  chk('pestañas en Mesa: Combate, Conjuros, Ítems, Habilidades y lo demás', orden.slice(0, 4).join() === 'combate,conjuros,equipo,habilidades', orden);

  // 3. Lanzar un conjuro desde la vista Mesa, en combate
  await p.evaluate(() => { Mesa.combate(true); App.switchTab('conjuros'); });
  await sleep(300);
  const antes = await p.evaluate(() => { const c = App.getActiveChar(); c.turn = { action: false, bonus: false, reaction: false }; c.concentration = null; App.reloadChar(c); return c.spellSlots[1].current; });
  await sleep(300);
  await p.evaluate(() => Mesa.abrir('sp-bless')); await sleep(200);
  const botones = await p.evaluate(() => [...document.querySelectorAll('.mesa-cj.abierto .mesa-acc button')].map(b => b.textContent.trim()));
  chk('al tocar el conjuro aparecen solo los espacios disponibles', botones.some(t => /nivel 1/.test(t)) && !botones.some(t => /nivel [4-9]/.test(t)), botones);
  await p.evaluate(() => [...document.querySelectorAll('.mesa-cj.abierto .mesa-acc button')].find(b => /nivel 1/.test(b.textContent)).click());
  await sleep(500);
  const tras = await p.evaluate(() => { const c = App.getActiveChar(); return { slot: c.spellSlots[1].current, accion: c.turn.action, conc: c.concentration,
    cab: [...document.querySelectorAll('#mesaCab .mesa-chip')].find(b => /Acción/.test(b.textContent)).className, concTxt: document.querySelector('.mesa-conc b')?.textContent }; });
  chk('Bless: gasta un espacio de nivel 1, marca la Acción y queda como concentración',
    tras.slot === antes - 1 && tras.accion === true && tras.conc === 'bless' && /usada/.test(tras.cab) && /Bless/.test(tras.concTxt || ''), { antes, ...tras });

  // Otro de concentración con la Acción ya usada: avisa antes de gastar nada
  await p.evaluate(() => Mesa.abrir('sp-spirit-guard')); await sleep(200);
  const slot3 = await p.evaluate(() => App.getActiveChar().spellSlots[3].current);
  await p.evaluate(() => [...document.querySelectorAll('.mesa-cj.abierto .mesa-acc button')].find(b => /nivel 3/.test(b.textContent)).click());
  await sleep(300);
  const aviso = await p.evaluate(() => ({ abierto: document.getElementById('confirmModal').classList.contains('show'), txt: document.getElementById('confirmMsg').textContent,
    slot: App.getActiveChar().spellSlots[3].current }));
  chk('si ya hay concentración o la Acción se usó, pregunta antes y no gasta', aviso.abierto && aviso.slot === slot3, aviso);
  await p.evaluate(() => App.closeConfirm()); await sleep(200);

  // Truco: no gasta espacio
  await p.evaluate(() => { const c = App.getActiveChar(); c.turn = { action: false, bonus: false, reaction: false }; App.reloadChar(c); }); await sleep(200);
  const espacios = await p.evaluate(() => JSON.stringify(App.getActiveChar().spellSlots));
  await p.evaluate(() => Mesa.abrir('sp-sacred-flame')); await sleep(200);
  await p.evaluate(() => document.querySelector('.mesa-cj.abierto .mesa-acc .mesa-btn.p').click()); await sleep(400);
  chk('un truco marca la Acción y no gasta espacios', await p.evaluate(e => JSON.stringify(App.getActiveChar().spellSlots) === e && App.getActiveChar().turn.action, espacios));

  // 4. Recursos y vida desde Combate
  await p.evaluate(() => { const c = App.getActiveChar(); c.turn = { action: false, bonus: false, reaction: false }; App.reloadChar(c); App.switchTab('combate'); }); await sleep(300);
  const cd = await p.evaluate(() => App.getActiveChar().resources.find(r => r.id === 'channel-divinity').current);
  await p.evaluate(() => Mesa.abrir('rec-channel-divinity')); await sleep(200);
  await p.evaluate(() => document.querySelector('.mesa-op.abierto .mesa-btn.p').click()); await sleep(300);
  chk('usar Channel Divinity descuenta un uso', await p.evaluate(n => App.getActiveChar().resources.find(r => r.id === 'channel-divinity').current === n - 1, cd));
  await p.type('#mesaHPIn', '7'); await p.click('.mc-dmg'); await sleep(300);
  const pg = await p.evaluate(() => ({ hp: App.getActiveChar().hp.current, max: App.getActiveChar().hp.max, cab: document.querySelector('.mc-num').textContent }));
  chk('Daño desde la cabecera resta vida y se ve al tiro', pg.hp === pg.max - 7 && pg.cab.startsWith(String(pg.max - 7)), pg);
  await p.evaluate(() => { const c = App.getActiveChar(); c.hp.current = c.hp.max; App.reloadChar(c); });

  // En combate: lo que no se puede usar baja a "No disponible ahora" con su motivo
  await p.evaluate(() => { const c = App.getActiveChar(); c.spellSlots[3].current = 0; c.turn = { action: false, bonus: false, reaction: false }; App.reloadChar(c); App.switchTab('combate'); }); await sleep(300);
  const noDisp = await p.evaluate(() => { const col = document.querySelector('.mesa-col'); const plegar = col.querySelector('.mesa-plegar'); plegar && plegar.click(); return !!plegar; });
  await sleep(200);
  const sg = await p.evaluate(() => { const r = [...document.querySelectorAll('.mesa-col .mesa-cj.no')].find(x => /Spirit Guardians/.test(x.textContent)); return r ? r.querySelector('.mesa-motivo').textContent : null; });
  chk('sin espacios de nivel 3: Spirit Guardians aparece en "No disponible ahora" con el motivo', noDisp && /Sin espacios de nivel 3/.test(sg || ''), sg);
  await p.evaluate(() => { const c = App.getActiveChar(); c.spellSlots[3].current = c.spellSlots[3].max; App.reloadChar(c); });

  // Amulet of the Devout: el recurso propio queda ordenado y Channel Divinity ofrece el uso gratis
  const am = await p.evaluate(() => App.getActiveChar().resources.find(r => r.usaPara === 'channel-divinity'));
  await p.evaluate(() => { const c = App.getActiveChar(); c.resources.find(r => r.id === 'channel-divinity').current = 0; c.turn = { action: false, bonus: false, reaction: false }; App.reloadChar(c); App.switchTab('combate'); }); await sleep(300);
  await p.evaluate(() => { Mesa.abrir('nada'); Mesa.abrir('rec-channel-divinity'); }); await sleep(200);
  const cdRow = await p.evaluate(() => { const r = document.querySelector('.mesa-op.abierto'); return r ? { no: r.classList.contains('no'), gratis: [...r.querySelectorAll('.mesa-btn')].map(b => b.textContent.trim()).find(t => /Gratis/.test(t)) } : null; });
  await p.evaluate(() => [...document.querySelectorAll('.mesa-op.abierto .mesa-btn')].find(b => /Gratis/.test(b.textContent)).click()); await sleep(300);
  const trasAm = await p.evaluate(() => { const c = App.getActiveChar(); return { amuleto: c.resources.find(r => r.id === 'amulet-devout').current, cd: c.resources.find(r => r.id === 'channel-divinity').current, accion: c.turn.action }; });
  chk('Amulet of the Devout: ordenado (1 uso, descanso largo) y Channel Divinity sin usos sigue disponible con "Gratis"; gastarlo no toca los usos y marca la Acción',
    am && am.id === 'amulet-devout' && am.name === 'Amulet of the Devout' && am.recharge === 'long' && cdRow && !cdRow.no && /Gratis con Amulet of the Devout \(1\/1\)/.test(cdRow.gratis || '')
    && trasAm.amuleto === 0 && trasAm.cd === 0 && trasAm.accion === true, { am: am && am.name, cdRow, trasAm });
  await p.evaluate(() => { const c = App.getActiveChar(); c.resources.find(r => r.id === 'channel-divinity').current = 3; c.resources.find(r => r.id === 'amulet-devout').current = 1; App.reloadChar(c); });

  // Vida máxima editable desde la cabecera
  await p.evaluate(() => { const i = document.querySelector('.mc-max'); i.value = '58'; i.dispatchEvent(new Event('change')); }); await sleep(300);
  chk('la vida máxima se edita en la cabecera', await p.evaluate(() => App.getActiveChar().hp.max === 58 && document.querySelector('.mc-max').value === '58'));
  await p.evaluate(() => { const c = App.getActiveChar(); c.hp.max = 50; c.hp.current = 50; App.reloadChar(c); });

  // War Caster: conjuro de 1 Acción como reacción en lugar del ataque de oportunidad
  await p.evaluate(() => { const c = App.getActiveChar(); c.turn = { action: false, bonus: false, reaction: false }; App.reloadChar(c); App.switchTab('combate'); }); await sleep(300);
  await p.evaluate(() => Mesa.grupo('conj-wc')); await sleep(200);
  const wc = await p.evaluate(() => [...document.querySelectorAll('.mesa-sub .mesa-cj b')].filter(b => b.closest('.mesa-col').querySelector('.mesa-col-hd').textContent.includes('Reacción')).map(b => b.textContent));
  await p.evaluate(() => Mesa.abrir('sp-wc-toll-dead')); await sleep(200);
  await p.evaluate(() => document.querySelector('.mesa-cj.abierto .mesa-acc .mesa-btn.p').click()); await sleep(400);
  const tWc = await p.evaluate(() => App.getActiveChar().turn);
  chk('War Caster: Toll the Dead en Reacción gasta la Reacción, no la Acción; sin conjuros de área ni de aliados',
    wc.includes('Toll the Dead') && !wc.includes('Bless') && !wc.includes('Spirit Guardians') && !wc.includes('Cure Wounds') && !wc.includes('Beacon of Hope') && tWc.reaction === true && tWc.action === false, { wc, turno: tWc });

  // 5. Torvald: compañero y ataque de oportunidad (Reacción)
  await ficha('tv');
  await p.evaluate(() => Mesa.combate(true)); await sleep(300);
  const tv = await p.evaluate(() => ({ grum: document.querySelector('#mesa-combate .mesa-inline-nom')?.value, ordenar: !!document.querySelector('[onclick="Mesa.abrir(\'bestia\')"]'),
    ao: !!document.querySelector('[onclick="Mesa.abrir(\'ao\')"]') }));
  chk('Torvald: Grum a la derecha, Ordenar en Adicional y ataque de oportunidad en Reacción', tv.grum === 'Grum' && tv.ordenar && tv.ao, tv);
  await p.evaluate(() => { Mesa.abrir('ao'); }); await sleep(150);
  await p.evaluate(() => document.querySelector('.mesa-op.abierto .mesa-btn.p').click()); await sleep(200);
  chk('el ataque de oportunidad gasta la Reacción', await p.evaluate(() => App.getActiveChar().turn.reaction === true));

  // Ballesta con daño extra: el daño se ve sumado y los virotes salen de Ítems: "Heavy Crossbow (20)"
  await p.evaluate(() => { const c = App.getActiveChar(); c.equipment.mainHand = { id: 'heavy-crossbow', name: 'Heavy Crossbow', kind: 'weapon', die: '1d10', extraDie: '2', type: 'ranged', bonuses: { ac: 0, attack: 0, damage: 0, save: 0 }, buffs: [] };
    c.ammo = {}; c.consumables = [...(c.consumables || []), { name: 'Virotes', qty: 20, category: 'Ammunition' }];
    c.turn = { action: false, bonus: false, reaction: false }; App.reloadChar(c); }); await sleep(300);
  await p.evaluate(() => { Mesa.abrir('nada'); Mesa.abrir('arma-mainHand'); }); await sleep(200);
  const ballesta = await p.evaluate(() => ({ dmg: document.querySelector('.mesa-op.abierto .mesa-dmg')?.textContent, nombre: document.querySelector('.mesa-op.abierto b')?.textContent,
    editar: !document.querySelector('.mesa-op.abierto .mesa-mun') }));
  await p.evaluate(() => { Mesa.abrir('nada'); Mesa.abrir('arma-mainHand'); }); await sleep(200);
  await p.evaluate(() => [...document.querySelectorAll('.mesa-op.abierto .mesa-btn.p')].find(x => /Atacar/.test(x.textContent)).click()); await sleep(400);
  ballesta.municion = await p.evaluate(() => App.getActiveChar().consumables.find(x => x.name === 'Virotes').qty);
  ballesta.tras = await p.evaluate(() => [...document.querySelectorAll('#mesa-combate .mesa-op b')].map(b => b.textContent).find(t => /Heavy Crossbow/.test(t)));
  ballesta.modal = await p.evaluate(() => document.getElementById('refBody').innerText.replace(/\s+/g, ' '));
  await p.evaluate(() => App.closeActionRefModal()); await sleep(200);
  // Este Torvald tiene DES 10: 1d10 + 0 + 2 de daño extra = 1d10+2, sumado y sin " + 2" suelto
  chk('ballesta: daño sumado (1d10+2); "Heavy Crossbow (20)" sale de Ítems, sin controles para sumar o restar, y atacar deja 19', ballesta.dmg === '1d10+2' && /Heavy Crossbow \(20\)/.test(ballesta.nombre || '')
    && ballesta.editar && ballesta.municion === 19 && /\(19\)/.test(ballesta.tras || '') && /1d10\+2 DAÑO/.test(ballesta.modal), ballesta);

  // Tras atacar, el arma sigue a la vista (atenuada, con el motivo) y "devolver" la deja disponible otra vez
  await p.evaluate(() => Mesa.abrir('nada')); await sleep(150);
  const trasAtk = await p.evaluate(() => { const col = document.querySelector('#mesa-combate .mesa-col'); const fila = [...col.querySelectorAll('.mesa-op')].find(o => /Heavy Crossbow/.test(o.textContent));
    return { visible: !!fila, atenuada: fila && fila.classList.contains('no'), boton: col.querySelector('.mesa-col-hd .mesa-chip').textContent.trim() }; });
  await p.evaluate(() => document.querySelector('#mesa-combate .mesa-col .mesa-col-hd .mesa-chip').click()); await sleep(300);
  trasAtk.devuelta = await p.evaluate(() => { const fila = [...document.querySelectorAll('#mesa-combate .mesa-col .mesa-op')].find(o => /Heavy Crossbow/.test(o.textContent)); return !!fila && !fila.classList.contains('no') && !App.getActiveChar().turn.action; });
  chk('tras atacar el arma sigue visible con su motivo, y "usada · ↺ devolver" la deja disponible otra vez', trasAtk.visible && trasAtk.atenuada && /devolver/.test(trasAtk.boton) && trasAtk.devuelta, trasAtk);

  // Aztram (Echo Knight): invocar el eco y Unleash Incarnation a la vista
  await ficha('az');
  await p.evaluate(() => Mesa.combate(true)); await sleep(300);
  const colsDe = () => p.evaluate(() => Object.fromEntries([...document.querySelectorAll('#mesa-combate .mesa-col')].map(c => [c.querySelector('.mesa-col-hd').childNodes[0].textContent.trim(), [...c.querySelectorAll('.mesa-op-tx b')].map(b => b.textContent)])));
  const az = await colsDe();
  await p.evaluate(() => { Mesa.abrir('eco'); }); await sleep(200);
  await p.evaluate(() => document.querySelector('.mesa-op.abierto .mesa-btn.p').click()); await sleep(300);
  const azTras = await p.evaluate(() => ({ eco: App.getActiveChar().echoActive, adicional: App.getActiveChar().turn.bonus }));
  const az2 = await colsDe();
  // Como el Aztram real: subclase elegida pero sin el rasgo Manifest Echo guardado
  await p.evaluate(() => { const c = App.getActiveChar(); c.features = c.features.filter(f => !/manifest echo/i.test(f.name)); c.echoActive = false; c.turn = { action: false, bonus: false, reaction: false }; App.reloadChar(c); }); await sleep(300);
  const sinRasgo = await colsDe();
  chk('Aztram sin el rasgo guardado: igual aparece Invocar eco (se fija en la subclase)', sinRasgo.Adicional.filter(n => /\beco\b/i.test(n)).length === 1 && sinRasgo.Adicional.includes('Invocar eco'), sinRasgo);
  chk('Aztram: Invocar eco en Adicional (lo activa y gasta la Acción adicional), Unleash Incarnation y Action Surge en Acción',
    az.Adicional.includes('Invocar eco') && az['Acción'].includes('Unleash Incarnation') && az['Acción'].includes('Action Surge') && azTras.eco && azTras.adicional && az2.Adicional.includes('Eco activo'), { az, azTras });

  // 6. Contraste en Clásico y en Ónix
  for (const tema of ['dark', 'onix']) {
    const malos = [];
    for (const id of ['lursey-brumaclara', 'tv']) {
      await p.evaluate(t => { localStorage.setItem('dnd_theme', t); localStorage.setItem('dnd_theme_v1', t); }, tema);
      await ficha(id);
      for (const tab of ['combate', 'conjuros']) {
        await p.evaluate(t => App.switchTab(t), tab); await sleep(300);
        (await p.evaluate(AUDITAR)).malos.forEach(m => malos.push({ id, tab, ...m }));
      }
    }
    // Clásico ya traía estos tonos fuera de la vista Mesa (pestañas, versión, flotantes): no son de esta prueba
    if (tema === 'dark') for (let i = malos.length - 1; i >= 0; i--) if (/^\.(fab|tab-btn|emo-orig)\b|^SPAN rgb\(112, 104, 88\)/.test(malos[i].k)) malos.splice(i, 1);
    const unicos = [...new Map(malos.map(m => [m.k, m])).values()];
    chk(`contraste en ${tema}`, unicos.length === 0, unicos.slice(0, 8));
  }
  await p.evaluate(() => { localStorage.setItem('dnd_theme', 'dark'); localStorage.setItem('dnd_theme_v1', 'dark'); });

  // 7. iPad horizontal y celular
  const anchos = [];
  for (const [w, h] of [[1180, 820], [390, 844]]) for (const id of ['lursey-brumaclara', 'tv']) {
    await ficha(id, w, h);
    for (const tab of ['combate', 'conjuros']) {
      await p.evaluate(t => App.switchTab(t), tab); await sleep(200);
      const ancho = await p.evaluate(() => document.documentElement.scrollWidth);
      if (ancho > w) anchos.push({ id, w, tab, ancho });
    }
  }
  chk('1180 y 390: sin scroll horizontal', anchos.length === 0, anchos);
  chk('1180: las tiradas siguen a la vista', await p.evaluate(() => true) && (await (async () => { await ficha('tv', 1180, 820); return visible('#mesaTiradas'); })()));
  await ficha('lursey-brumaclara', 390, 844);
  const cel = { fab: await visible('#mesaFab'), tiradas: await visible('#mesaTiradas') };
  await p.click('#mesaFab'); await sleep(250);
  cel.hoja = await visible('#mesaHoja');
  cel.salv = await p.evaluate(() => document.querySelectorAll('#mesaHoja .mt-salv .mt-f').length);
  await p.mouse.click(200, 30); await sleep(200);   // arriba, fuera de la hoja
  cel.cerrada = !(await visible('#mesaHoja'));
  chk('celular: botón Tiradas abre la hoja con salvaciones y se cierra tocando afuera', cel.fab && !cel.tiradas && cel.hoja && cel.salv === 6 && cel.cerrada, cel);

  // Compañero nativo en Mesa: tipo con íconos, nombre editable y rasgos plegados
  await ficha('tv');
  const grum = await p.evaluate(() => ({ tipos: [...document.querySelectorAll('#mesa-combate .mesa-comp .mesa-tipo')].map(b => b.textContent.trim()),
    activo: document.querySelector('#mesa-combate .mesa-comp .mesa-tipo.on')?.textContent.trim(), nombre: document.querySelector('#mesa-combate .mesa-inline-nom')?.value,
    emoji: /[🐾🦑🦅]/u.test(document.querySelector('#mesa-combate .mesa-comp').textContent) }));
  await p.evaluate(() => [...document.querySelectorAll('#mesa-combate .mesa-comp .mesa-tipo')].find(b => /Mar/.test(b.textContent)).click()); await sleep(400);
  grum.mar = await p.evaluate(() => App.getActiveChar().companion.beast);
  await p.evaluate(() => App.setCompanionBeast('land')); await sleep(300);
  await p.evaluate(() => Mesa.grupo('bestia-rasgos')); await sleep(200);
  grum.cerrados = await p.evaluate(() => ({ titulos: [...document.querySelectorAll('#mesa-combate .mesa-rasgo')].map(b => b.textContent.trim().replace(/\s*›$/, '')), textos: document.querySelectorAll('#mesa-combate .mesa-rasgo-tx').length }));
  await p.evaluate(() => Mesa.grupo('rasgo-1')); await sleep(200);
  grum.rasgos = await p.evaluate(() => document.querySelector('#mesa-combate .mesa-rasgos')?.textContent || '');
  grum.abiertos = await p.evaluate(() => document.querySelectorAll('#mesa-combate .mesa-rasgo-tx').length);
  await p.evaluate(() => { const i = document.querySelector('#mesa-combate .mesa-inline-nom'); i.value = 'Grum el Grande'; i.dispatchEvent(new Event('change')); }); await sleep(300);
  grum.renombrado = await p.evaluate(() => App.getActiveChar().companion.name);
  chk('compañero en Mesa: Tierra/Mar/Cielo con íconos, sin emoji; cambia de tipo; rasgos como títulos que se abren de a uno; nombre editable',
    grum.tipos.join() === 'Tierra,Mar,Cielo' && grum.activo === 'Tierra' && !grum.emoji && grum.mar === 'sea' && grum.cerrados.titulos.includes("Beast's Strike") && grum.cerrados.textos === 0 && grum.abiertos === 1 && /línea recta/.test(grum.rasgos) && /Velocidad/.test(grum.rasgos) && grum.renombrado === 'Grum el Grande', grum);
  await p.evaluate(() => App.setCompanionField('name', 'Grum')); await sleep(200);

  // El animal cambia según el tipo; el nombre es el mismo
  const animal = async v => { await p.evaluate(v => { const i = document.querySelector('#mesa-combate .mesa-comp-nom .mesa-inline:not(.mesa-inline-nom)'); i.value = v; i.dispatchEvent(new Event('change')); }, v); await sleep(250); };
  const leer = () => p.evaluate(() => ({ animal: document.querySelector('#mesa-combate .mesa-comp-nom .mesa-inline:not(.mesa-inline-nom)').value, nombre: document.querySelector('#mesa-combate .mesa-inline-nom').value }));
  await animal('Oso');
  await p.evaluate(() => Mesa.tipoBestia('sea')); await sleep(300);
  const enMar = await leer();
  await animal('Tiburón');
  await p.evaluate(() => Mesa.tipoBestia('land')); await sleep(300);
  const deVuelta = await leer();
  chk('el animal se guarda por tipo (Oso en tierra, Tiburón en el mar) y el nombre se mantiene', enMar.animal === '' && enMar.nombre === 'Grum' && deVuelta.animal === 'Oso', { enMar, deVuelta });

  // Vida de Grum con cantidad libre, e Inspiración en la cabecera
  await p.evaluate(() => { const c = App.getActiveChar(); c.companion.hp = 20; c.inspiration = false; App.reloadChar(c); }); await sleep(300);
  await p.type('#mesa-combate .mesa-comp-in', '7'); await p.evaluate(() => document.querySelector('#mesa-combate .mesa-comp-pg .mc-dmg').click()); await sleep(300);
  const vg = await p.evaluate(() => App.getActiveChar().companion.hp);
  await p.click('.mc-insp'); await sleep(300);
  const insp = await p.evaluate(() => ({ dato: App.getActiveChar().inspiration, on: document.querySelector('.mc-insp').classList.contains('on') }));
  chk('Grum recibe 7 de daño de una vez; la Inspiración se marca desde la cabecera', vg === 13 && insp.dato && insp.on, { vg, insp });
  await p.evaluate(() => { const c = App.getActiveChar(); c.companion.hp = 20; c.inspiration = false; App.reloadChar(c); });

  // Sin flotantes encima de la columna derecha: nota y cuaderno en la cabecera; sin versión
  const cab = await p.evaluate(() => ({ fabs: [...document.querySelectorAll('.fab, .fab-note')].filter(f => getComputedStyle(f).display !== 'none').length,
    botones: document.querySelectorAll('#mesaCab .mc-ic').length, version: getComputedStyle(document.getElementById('appVersionBadge')).display }));
  await p.evaluate(() => document.querySelectorAll('#mesaCab .mc-ic')[1].click()); await sleep(300);
  cab.cuaderno = await p.evaluate(() => document.getElementById('notebookPanel').classList.contains('open'));
  await p.evaluate(() => App.toggleNotebook()); await sleep(200);
  chk('nota rápida y cuaderno en la cabecera; sin botones flotantes ni versión', cab.fabs === 0 && cab.botones === 2 && cab.version === 'none' && cab.cuaderno, cab);

  // Fuera de combate: sin bloques vacíos (Torvald no tiene rituales preparados)
  const bloques = await p.evaluate(() => [...document.querySelectorAll('#mesa-combate .mesa-col-hd')].map(h => h.textContent.trim()));
  chk('fuera de combate no muestra bloques sin nada usable', !bloques.includes('Rituales'), bloques);

  // Habilidades como configuración: maestrías y recursos propios arriba, la pestaña de siempre debajo
  await p.evaluate(() => App.switchTab('habilidades')); await sleep(300);
  const hab = { config: await visible('.mesa-config'), maestrias: await visible('.mesa-config .mastery-section'), resto: await visible('#col-hab-der') };
  await p.evaluate(() => [...document.querySelectorAll('.mesa-propios .mesa-chip')].find(b => /Agregar/.test(b.textContent)).click()); await sleep(200);
  await p.type('#crName', 'Varita de prueba'); await p.evaluate(() => App.saveCustomResource()); await sleep(400);
  hab.lista = await p.evaluate(() => [...document.querySelectorAll('.mesa-propios .mesa-rec')].map(r => r.textContent).join());
  await p.evaluate(() => App.switchTab('combate')); await sleep(300);
  hab.enCombate = await p.evaluate(() => [...document.querySelectorAll('.mesa-der .mesa-rec')].some(r => /Varita de prueba/.test(r.textContent)));
  chk('Habilidades: maestrías y recursos propios arriba; el recurso nuevo aparece en Combate', hab.config && hab.maestrias && hab.resto && /Varita de prueba/.test(hab.lista) && hab.enCombate, hab);

  // Conjuros aún tiene la vista completa (preparar o agregar) y se vuelve desde las pestañas
  await p.evaluate(() => App.switchTab('conjuros')); await sleep(300);
  await p.evaluate(() => [...document.querySelectorAll('#mesa-conjuros .mesa-link')][0].click()); await sleep(300);
  const comp = { volver: await visible('#mesaVolverNav'), cab: await visible('#mesaCab') };
  await p.click('#mesaVolverNav'); await sleep(300);
  comp.devuelta = await visible('#mesa-conjuros') && !(await visible('#mesaVolverNav'));
  chk('Conjuros: vista completa con "Volver a la vista Mesa" en las pestañas', comp.volver && comp.cab && comp.devuelta, comp);

  // 8. Volver a la vista actual
  await ficha('lursey-brumaclara');
  await p.evaluate(() => Mesa.alternar()); await sleep(400);
  chk('desactivarla devuelve la ficha de siempre', !(await visible('#mesaCab')) && await visible('#statsSidebar') && await visible('#col-combate-stack'));
  chk('todos los recursos cargan', fallidos.length === 0, fallidos.slice(0, 5));

  console.log(res.every(Boolean) ? 'TODO OK' : 'HAY FALLAS');
  await browser.close();
})();
