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
    Storage.saveChar(t); Storage.saveChar(Characters.buildLursey());
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

  // 3. Lanzar un conjuro desde la vista Mesa
  await p.evaluate(() => { App.switchTab('conjuros'); });
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

  // 5. Torvald: compañero y ataque de oportunidad (Reacción)
  await ficha('tv');
  const tv = await p.evaluate(() => ({ grum: document.querySelector('.mesa-comp b')?.textContent, ordenar: !!document.querySelector('[onclick="Mesa.abrir(\'bestia\')"]'),
    ao: !!document.querySelector('[onclick="Mesa.abrir(\'ao\')"]') }));
  chk('Torvald: Grum a la derecha, Ordenar en Adicional y ataque de oportunidad en Reacción', tv.grum === 'Grum' && tv.ordenar && tv.ao, tv);
  await p.evaluate(() => { Mesa.abrir('ao'); }); await sleep(150);
  await p.evaluate(() => document.querySelector('.mesa-op.abierto .mesa-btn.p').click()); await sleep(200);
  chk('el ataque de oportunidad gasta la Reacción', await p.evaluate(() => App.getActiveChar().turn.reaction === true));

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

  // Ficha completa de Grum dentro de la vista Mesa (sin volver a la vista de siempre)
  await ficha('tv');
  chk('Combate ya no tiene el enlace a la vista completa', await p.evaluate(() => ![...document.querySelectorAll('#mesa-combate .mesa-link')].length));
  await p.evaluate(() => [...document.querySelectorAll('.mesa-comp .mesa-btn')].find(b => /Ficha completa/.test(b.textContent)).click()); await sleep(300);
  const grum = { ficha: await visible('.mesa-ficha-bestia .companion-section'), mesa: await visible('#mesa-combate'), vieja: await visible('#col-combate-stack') };
  await p.evaluate(() => [...document.querySelectorAll('.mesa-ficha-bestia .companion-beast-chip')].find(b => /Sea/.test(b.textContent)).click()); await sleep(300);
  grum.mar = await p.evaluate(() => App.getActiveChar().companion.beast);
  grum.sigue = await visible('.mesa-ficha-bestia .companion-section');
  await p.evaluate(() => App.setCompanionBeast('land')); await sleep(200);
  chk('Grum: la ficha completa se abre en Mesa y Land/Sea/Sky funciona ahí', grum.ficha && grum.mesa && !grum.vieja && grum.mar === 'sea' && grum.sigue, grum);

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
