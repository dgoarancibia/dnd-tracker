// Pícaro PHB 2024: rasgos de clase, equipo, Ataque furtivo con Cunning Strike
// en Mesa, Cunning Action como chips, Arcane Trickster (tercio de lanzador con
// la lista de Mago), Soulknife (Hojas psíquicas) y Assassin.
const puppeteer = require('puppeteer-core');
const { CHROME, URL_BASE } = require('./entorno');
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new' });
  const p = await browser.newPage();
  p.on('pageerror', e => console.log('ERROR:', e.message));
  const res = [];
  const chk = (nombre, ok, dato) => { res.push(ok); console.log(ok ? 'OK ' : 'MAL', nombre, dato !== undefined ? JSON.stringify(dato) : ''); };
  await p.setViewport({ width: 1180, height: 820 });
  await p.goto(URL_BASE + '/index.html', { waitUntil: 'networkidle2' });
  await p.evaluate(() => {
    localStorage.setItem('dnd_guest', '1'); localStorage.setItem('dnd_vista', 'mesa');
    const c = Characters.createNew('Prueba Pícaro', 'Pícaro'); c.id = 'pi';
    c.stats = { for: 8, des: 16, con: 14, int: 14, sab: 12, car: 10 };
    c.equipment = { ...(c.equipment || {}), mainHand: { kind: 'weapon', name: 'Daga', die: '1d4' } };
    Storage.saveChar(c); Storage.setActiveId('pi'); sessionStorage.setItem('dnd_playing', '1');
  });
  await p.goto(URL_BASE + '/app.html', { waitUntil: 'networkidle2' }); await sleep(1500);
  await p.evaluate(() => document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('show')));

  const nv1 = await p.evaluate(() => { const c = App.getActiveChar();
    return { feats: (c.features || []).map(f => f.id), stat: c.spellcastingStat || null, slots: Object.values(c.spellSlots || {}).reduce((n, s) => n + (s.max || 0), 0),
      spells: (c.spells || []).length, max: Characters.getMaxSpellLevel('Pícaro', 1, c) }; });
  chk('nv1: Sneak Attack, Expertise, Thieves\' Cant y Weapon Mastery; sin magia', ['sneak-attack', 'expertise-rogue', 'thieves-cant', 'weapon-mastery-rogue'].every(x => nv1.feats.includes(x)) && !nv1.stat && !nv1.slots && !nv1.spells, nv1);

  // Nivel 5 Thief: Cunning Strike, Uncanny Dodge, furtivo 3d6
  await p.evaluate(() => { const c = App.getActiveChar(); Characters.applyLevelUp(c, 5, 25);
    Characters.applyChoice(c, 'subclase-3', 'sub-thief'); App.reloadChar(c); }); await sleep(600);
  await p.evaluate(() => { document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('show')); Mesa.combate(true); }); await sleep(500);
  const nv5 = await p.evaluate(() => { const c = App.getActiveChar();
    const card = document.querySelector('.mesa-furtivo');
    const daga = [...document.querySelectorAll('#mesa-combate .mesa-op')].find(o => /^Daga/.test(o.querySelector('b')?.textContent || ''));
    const chips = [...document.querySelectorAll('.mesa-furtivo .mesa-chip')].map(b => b.textContent.trim());
    const adic = [...document.querySelectorAll('#mesa-combate .mesa-col')].find(x => /Adicional/.test(x.querySelector('.mesa-col-hd').textContent));
    return { feats: c.features.map(f => f.id), dmg: card && card.querySelector('.mesa-dmg').textContent, chips,
      daga: daga && daga.querySelector('small').textContent, rapidas: adic ? [...adic.querySelectorAll('.mesa-rapidas .mesa-chip')].map(b => b.textContent) : [],
      ca: adic && /Cunning Action/.test(adic.textContent) }; });
  chk('nv5: Cunning Strike, Uncanny Dodge y Fast Hands', ['cunning-strike', 'uncanny-dodge', 'thief-fast-hands', 'steady-aim'].every(x => nv5.feats.includes(x)) && !nv5.feats.includes('reliable-talent'), nv5.feats);
  chk('Mesa: tarjeta Ataque furtivo 3d6 con Envenenar, Derribar y Retirarse', nv5.dmg === '3d6' && ['Envenenar', 'Derribar', 'Retirarse'].every(n => nv5.chips.some(x => x.startsWith(n))), nv5);
  chk('Mesa: la daga avisa el furtivo', /furtivo 3d6/.test(nv5.daga || ''), nv5.daga);
  chk('Mesa: Cunning Action como chips en Adicional (+ Fast Hands del Thief)', ['Correr', 'Destrabarse', 'Esconderse', 'Juego de manos'].every(n => nv5.rapidas.includes(n)) && !nv5.ca, nv5.rapidas);

  // Elegir Derribar: quedan 2d6 y aparece la CD 8 + 3 + 3 = 14; solo 1 efecto en nv5
  await p.evaluate(() => Mesa.golpe('trip')); await sleep(200);
  const trip = await p.evaluate(() => ({ dmg: document.querySelector('.mesa-furtivo .mesa-dmg').textContent, ef: document.querySelector('.mesa-golpes')?.textContent,
    dis: [...document.querySelectorAll('.mesa-furtivo .mesa-chip[disabled]')].map(b => b.textContent.trim()) }));
  chk('Derribar: 2d6, TS DES CD 14 y los demás bloqueados (1 efecto en nv5)', trip.dmg === '2d6' && /TS DES CD 14/.test(trip.ef) && trip.dis.length >= 2, trip);
  await p.evaluate(() => Mesa.furtivo()); await sleep(300);
  const usado = await p.evaluate(() => ({ t: App.getActiveChar().turn.furtivo, btn: !!document.querySelector('.mesa-furtivo .mesa-btn.p'),
    daga: [...document.querySelectorAll('#mesa-combate .mesa-op')].find(o => /^Daga/.test(o.querySelector('b')?.textContent || ''))?.querySelector('small').textContent }));
  chk('Aplicar furtivo: queda usado este turno y la daga lo dice', usado.t === true && !usado.btn && /furtivo ya usado/.test(usado.daga), usado);
  await p.evaluate(() => App.nuevoTurno()); await sleep(300);
  const nuevo = await p.evaluate(() => !!App.getActiveChar().turn.furtivo);
  chk('Nuevo turno: el furtivo vuelve a estar disponible', nuevo === false);
  await p.evaluate(() => { const adic = [...document.querySelectorAll('#mesa-combate .mesa-col')].find(x => /Adicional/.test(x.querySelector('.mesa-col-hd').textContent));
    [...adic.querySelectorAll('.mesa-rapidas .mesa-chip')].find(b => b.textContent === 'Esconderse').click(); }); await sleep(200);
  chk('Esconderse marca la Acción adicional', await p.evaluate(() => App.getActiveChar().turn.bonus === true));

  // Nivel 7: Reliable Talent y Evasion (2024: nv7)
  const nv7 = await p.evaluate(() => Characters.CLASE_FEATURES['Pícaro'].features(7).map(f => f.id));
  chk('nv7: Reliable Talent y Evasion', nv7.includes('reliable-talent') && nv7.includes('evasion-rogue'), nv7);
  const nv15 = await p.evaluate(() => { const c = App.getActiveChar(); c.nivel = 15; c.classes[0].level = 15; App.reloadChar(c); return App.getActiveChar().savingThrows; }); await sleep(300);
  chk('nv15: Slippery Mind da salvaciones de SAB y CAR', ['sab', 'car'].every(k => nv15.includes(k)), nv15);
  const nv14 = await p.evaluate(() => { Mesa.combate(true); return [...document.querySelectorAll('.mesa-furtivo .mesa-chip')].map(b => b.textContent.trim()); }); await sleep(200);
  chk('nv14+: Desorientar, Cegar, Noquear y Ataque sigiloso del Thief', ['Desorientar', 'Cegar', 'Noquear', 'Ataque sigiloso'].every(n => nv14.some(x => x.startsWith(n))), nv14);

  // Arcane Trickster nv7: INT, espacios 4/2, nivel máx 2, 5 preparados, Mage Hand gratis + 2 trucos
  await p.evaluate(() => { const c = App.getActiveChar(); c.nivel = 7; c.classes = [{ name: 'Pícaro', level: 7, subclass: '' }]; c.subclase = '';
    c.features = c.features.filter(f => !/^Thief/.test(f.source || '')); c.savingThrows = ['des', 'int']; c.choices = {};
    Characters.applyChoice(c, 'subclase-3', 'sub-arcane-trickster'); App.reloadChar(c); }); await sleep(600);
  const at = await p.evaluate(() => { const c = App.getActiveChar();
    return { stat: c.spellcastingStat, slots: [1, 2, 3].map(i => c.spellSlots[i] && c.spellSlots[i].max), max: Characters.getMaxSpellLevel('Pícaro', 7, c),
      prep: Characters.getPreparedMax(c), trucos: Characters.getCantripsKnown(c), mano: (c.spells || []).find(s => s.id === 'mage-hand'),
      niveles: [...new Set((c.spells || []).map(s => s.level))].sort(), cd: Characters.calcCD(c) }; });
  chk('Arcane Trickster nv7: INT, espacios 4 de nv1 y 2 de nv2', at.stat === 'int' && at.slots[0] === 4 && at.slots[1] === 2 && !at.slots[2], at);
  chk('Arcane Trickster nv7: hasta nivel 2, 5 preparados, 2 trucos + Mage Hand gratis', at.max === 2 && at.prep === 5 && at.trucos === 2 && at.mano && at.mano.cantrip_subclass, at);
  chk('Arcane Trickster: la lista de Mago llega hasta nivel 2 y la CD es 8 + 3 + 2 = 13', at.niveles.includes(1) && at.niveles.includes(2) && !at.niveles.some(n => n > 2) && at.cd === 13, at);

  // Soulknife nv5: dados 6d8, Hojas psíquicas en Acción y Adicional
  await p.evaluate(() => { const c = App.getActiveChar(); c.nivel = 5; c.classes = [{ name: 'Pícaro', level: 5, subclass: '' }]; c.subclase = '';
    c.features = c.features.filter(f => !/^Arcane Trickster/.test(f.source || '')); c.spells = []; c.spellcastingStat = null; c.spellSlots = {}; c.choices = {};
    Characters.applyChoice(c, 'subclase-3', 'sub-soulknife'); App.reloadChar(c); }); await sleep(600);
  await p.evaluate(() => { App.nuevoTurno(); Mesa.combate(true); }); await sleep(400);
  await p.evaluate(() => [...document.querySelectorAll('#mesa-combate .mesa-plegar')].filter(b => /No disponible/.test(b.textContent) && /▸/.test(b.textContent)).forEach(b => b.click())); await sleep(200);
  const sk = await p.evaluate(() => { const c = App.getActiveChar();
    const ops = [...document.querySelectorAll('#mesa-combate .mesa-op')];
    const h1 = ops.find(o => /^Hoja psíquica/.test(o.querySelector('b')?.textContent || '')), h2 = ops.find(o => /Segunda hoja/.test(o.textContent));
    return { dados: (c.resources.find(r => r.id === 'psionic-energy') || {}), h1: h1 && [h1.querySelector('.mesa-num')?.textContent, h1.querySelector('.mesa-dmg')?.textContent],
      h2: h2 && [h2.querySelector('.mesa-dmg')?.textContent, h2.querySelector('.mesa-motivo')?.textContent] }; });
  chk('Soulknife nv5: 6 dados d8 de energía psiónica (recarga short1)', sk.dados.max === 6 && /d8/.test(sk.dados.name) && sk.dados.recharge === 'short1', sk.dados);
  chk('Soulknife: Hoja psíquica +6 · 1d6+3 en Acción; segunda hoja 1d4+3 pide atacar antes', sk.h1 && sk.h1[0] === '+6' && sk.h1[1] === '1d6+3' && sk.h2 && sk.h2[0] === '1d4+3' && /Primero/.test(sk.h2[1] || ''), sk);

  // Assassin nv3: nota de Assassinate en la tarjeta
  await p.evaluate(() => { const c = App.getActiveChar(); c.nivel = 3; c.classes = [{ name: 'Pícaro', level: 3, subclass: '' }]; c.subclase = '';
    c.features = c.features.filter(f => !/^Soulknife/.test(f.source || '')); c.resources = c.resources.filter(r => r.id !== 'psionic-energy'); c.choices = {};
    Characters.applyChoice(c, 'subclase-3', 'sub-assassin'); App.reloadChar(c); }); await sleep(600);
  const as = await p.evaluate(() => { Mesa.combate(true); const card = document.querySelector('.mesa-furtivo'); return { txt: card && card.textContent.replace(/\s+/g, ' '), feats: App.getActiveChar().features.map(f => f.id) }; });
  chk('Assassin nv3: 2d6, nota de 1.ª ronda con +3 de daño, sin Cunning Strike todavía', /2d6/.test(as.txt) && /\+3 de daño/.test(as.txt) && !/Cunning Strike/.test(as.txt) && as.feats.includes('as-assassinate'), as);

  await p.screenshot({ path: __dirname + '/out/picaro_1180.png' });
  console.log(res.every(Boolean) ? 'TODO OK' : 'HAY FALLAS');
  await browser.close();
})();
