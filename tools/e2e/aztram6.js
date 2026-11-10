// Aztram (Guerrero 5 Echo Knight, Polearm Master, FUE 19) sube a nivel 6 por el
// asistente de la interfaz y toma Sentinel con +1 FUE: debe quedar FUE 20,
// PG +8, la dote guardada, sin elecciones de más y con sus rasgos intactos.
const puppeteer = require('puppeteer-core');
const { CHROME, URL_BASE } = require('./entorno');
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new' });
  const p = await browser.newPage();
  p.on('pageerror', e => console.log('ERROR:', e.message));
  p.on('dialog', d => d.accept());
  const res = [];
  const chk = (nombre, ok, dato) => { res.push(ok); console.log(ok ? 'OK ' : 'MAL', nombre, dato !== undefined ? JSON.stringify(dato) : ''); };
  await p.setViewport({ width: 1180, height: 820 });
  await p.goto(URL_BASE + '/index.html', { waitUntil: 'networkidle2' });
  await p.evaluate(() => {
    localStorage.setItem('dnd_guest', '1'); localStorage.setItem('dnd_vista', 'mesa');
    const c = Characters.createNew('Aztram', 'Guerrero'); c.id = 'az';
    Characters.applyRaza(c, 'Shadar-Kai');
    c.stats = { for: 18, des: 12, con: 15, int: 10, sab: 13, car: 8 };
    Characters.applyLevelUp(c, 5, 40);
    Characters.applyChoice(c, 'fighting-style', 'fs-defense');
    Characters.applyChoice(c, 'subclase-3', 'sub-echo-knight');
    Characters.applyChoice(c, 'asi-4', { mode: 'feat', featId: 'feat-polearm-master', asiStat: 'for' });
    c.hp.max = 48; c.hp.current = 48;
    c.bonuses = { ...(c.bonuses || {}), ca: 1 };   // Defense, como en su ficha
    c.equipment = { mainHand: { kind: 'weapon', name: "Dragon's Wrath Weapon (Polearm)", die: '1d6', mastery: 'Sap', statUsed: 'str', type: 'melee' },
      offHand: { kind: 'shield', name: 'Escudo' }, armor: { kind: 'armor', name: 'Media Armadura de Placas', base_ca: 15, add_dex: true } };
    Storage.saveChar(c); Storage.setActiveId('az'); sessionStorage.setItem('dnd_playing', '1');
  });
  await p.goto(URL_BASE + '/app.html', { waitUntil: 'networkidle2' }); await sleep(1500);
  await p.evaluate(() => { document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('show')); const o = document.getElementById('choiceModalOverlay'); if (o) o.style.display = 'none'; });

  const antes = await p.evaluate(() => { const c = App.getActiveChar();
    return { nv: c.nivel, for: c.stats.for, hp: c.hp.max, feats: c.features.map(f => f.name), pend: Characters.getPendingChoices(c, 5, 0).map(x => x.id), ca: Characters.calcCA(c) }; });
  chk('antes: nv5, FUE 19 con Polearm Master, CA 19, sin pendientes', antes.nv === 5 && antes.for === 19 && antes.feats.includes('Polearm Master') && antes.ca === 19 && !antes.pend.length, antes);

  // Asistente: nivel 6 con 8 PG (promedio fijo + CON)
  await p.evaluate(() => App.openLevelUp()); await sleep(300);
  const sugerido = await p.evaluate(() => ({ nv: document.getElementById('luNewLevel').value, hp: document.getElementById('luHPGained').value }));
  chk('asistente propone nivel 6 y 8 PG (6 + CON 2)', sugerido.nv === '6' && sugerido.hp === '8', sugerido);
  await p.evaluate(() => App.applyLevelUp()); await sleep(600);
  const modal = await p.evaluate(() => { const o = document.getElementById('choiceModalOverlay'); return o && getComputedStyle(o).display !== 'none' ? o.textContent.replace(/\s+/g, ' ').slice(0, 90) : null; });
  chk('pide la mejora de característica del nivel 6', /Ability Score|característica/i.test(modal || ''), modal);
  const sentinela = await p.evaluate(() => { App._setASIMode('feat');
    const b = document.querySelector('#asiPick-feat-sentinel .feat-asi-btn[data-stat="for"]');
    if (!b) return null; b.click(); return !!document.querySelector('[name="asiFeat"][value="feat-sentinel"]:checked'); });
  chk('Sentinel aparece en la lista y se elige con +1 FUE', sentinela === true, sentinela);
  await p.evaluate(() => App._saveChoice()); await sleep(600);
  const news = await p.evaluate(() => { const o = document.getElementById('levelUpNewsOverlay'); return o && getComputedStyle(o).display !== 'none' ? o.textContent.replace(/\s+/g, ' ').slice(0, 300) : null; });
  chk('al terminar muestra las Novedades del nivel 6', /Nivel 6/.test(news || ''), news);
  await p.evaluate(() => { const o = document.getElementById('levelUpNewsOverlay'); if (o) o.style.display = 'none'; });

  const desp = await p.evaluate(() => { const c = App.getActiveChar(); const a = Characters.calcArma(c, 'mainHand');
    return { nv: c.nivel, cls: c.classes.map(x => `${x.name} ${x.level} ${x.subclass}`), for: c.stats.for, hp: [c.hp.current, c.hp.max], dg: c.hitDice,
      feats: c.features.map(f => f.name), sent: c.features.find(f => f.name === 'Sentinel'), pend: Characters.getPendingChoices(c, 6, 0).map(x => x.id),
      ca: Characters.calcCA(c), atk: a && a.ataque, dmg: a && a.daño, pb: Characters.calcProfBonus(c.nivel),
      res: c.resources.filter(r => r.max > 0).map(r => `${r.name} ${r.current}/${r.max}`) }; });
  chk('nv6: FUE 20 (19 + Sentinel), PG 56, dados de golpe 6', desp.nv === 6 && desp.for === 20 && desp.hp[1] === 56 && desp.dg.max === 6, desp);
  chk('nv6: Sentinel guardada con el +1 en FUE; Polearm Master sigue', desp.sent && desp.sent.asiAplicado === 'for' && desp.feats.includes('Polearm Master'), desp.feats);
  chk('nv6: rasgos de Echo Knight intactos y nada pendiente', ['Manifest Echo', 'Unleash Incarnation', 'Action Surge', 'Second Wind'].every(n => desp.feats.some(f => f.startsWith(n))) && !desp.pend.length, desp);
  chk('nv6: lanza +8 al ataque (FUE 5 + BC 3), 1d6+5; CA 19', desp.atk === 8 && desp.dmg === '1d6+5' && desp.ca === 19, desp);

  // Mesa: reacciones de Polearm Master y Sentinel a la vista
  await p.evaluate(() => Mesa.combate(true)); await sleep(500);
  // Golpe con el extremo espera a que ataques: queda plegado en "No disponible ahora"
  await p.evaluate(() => [...document.querySelectorAll('#mesa-combate .mesa-plegar')].filter(b => /No disponible/.test(b.textContent) && /▸/.test(b.textContent)).forEach(b => b.click())); await sleep(200);
  const reac = await p.evaluate(() => { const col = [...document.querySelectorAll('#mesa-combate .mesa-col')].find(x => /Reacción/.test(x.querySelector('.mesa-col-hd').textContent));
    const adic = [...document.querySelectorAll('#mesa-combate .mesa-col')].find(x => /Adicional/.test(x.querySelector('.mesa-col-hd').textContent));
    return { reac: col ? [...col.querySelectorAll('.mesa-op b')].map(b => b.textContent) : [], reacTxt: col ? col.textContent.replace(/\s+/g, ' ') : '',
      adic: adic ? [...adic.querySelectorAll('.mesa-op b')].map(b => b.textContent) : [] }; });
  chk('Mesa: Ataque reactivo y Guardián (Sentinel) en Reacción; Golpe con el extremo en Adicional', ['Ataque de oportunidad', 'Ataque reactivo', 'Guardián (Sentinel)'].every(n => reac.reac.includes(n)) && reac.adic.includes('Golpe con el extremo'), reac);
  await p.screenshot({ path: __dirname + '/out/aztram6_1180.png' });
  console.log(res.every(Boolean) ? 'TODO OK' : 'HAY FALLAS');
  await browser.close();
})();
