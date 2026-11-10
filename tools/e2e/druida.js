// Druida Warforged del Círculo de la Tierra (PHB 2024 + Forge of the Artificer):
// nivel 1 sin Wild Shape, Primal Order pendiente, Speak with Animals siempre
// preparado, +1 CA del Warforged; nivel 3 con terreno, Land's Aid y Wild Shape.
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
    const c = Characters.createNew('Prueba Druida', 'Druida'); c.id = 'dr';
    Characters.applyRaza(c, 'Warforged'); Characters.applySubraza(c, 'Mediano');
    c.stats = { for: 10, des: 14, con: 14, int: 10, sab: 16, car: 8 };
    Storage.saveChar(c); Storage.setActiveId('dr'); sessionStorage.setItem('dnd_playing', '1');
  });
  await p.goto(URL_BASE + '/app.html', { waitUntil: 'networkidle2' }); await sleep(1500);

  const nv1 = await p.evaluate(() => {
    const c = App.getActiveChar();
    const modal = [...document.querySelectorAll('.modal-overlay')].filter(m => getComputedStyle(m).display !== 'none').map(m => m.textContent.replace(/\s+/g, ' ').slice(0, 60));
    return { ca: Characters.calcCA(c), ws: (c.resources || []).filter(r => /wild/i.test(r.id)).map(r => r.max),
      feats: (c.features || []).map(f => f.id), swa: (c.spells || []).find(s => /speak with animals/i.test(s.name)),
      pend: Characters.getPendingChoices(c, 1, 0).map(x => x.id), modal, trucos: Characters.getCantripsKnown(c), traits: c.speciesTraits };
  });
  chk('nv1: CA 13 (10 + DES 2 + 1 Warforged)', nv1.ca === 13, nv1.ca);
  chk('nv1: sin Wild Shape todavía (llega a nv2)', !nv1.ws.some(m => m > 0), nv1.ws);
  chk('nv1: Druidic, Primal Order y Spellcasting; nada de subclase', ['druidic', 'primal-order', 'spellcasting-druid'].every(x => nv1.feats.includes(x)) && !nv1.feats.includes('druid-subclass'), nv1.feats);
  chk('nv1: Speak with Animals siempre preparado (Druidic)', !!nv1.swa && nv1.swa.domain && nv1.swa.alwaysLabel === 'Druidic');
  chk('nv1: Primal Order pendiente de elegir', nv1.pend.includes('primal-order') && !nv1.pend.includes('subclase-2'), nv1.pend);
  chk('Warforged: rasgos 2025 (Constructo, Tireless) y resistencia a veneno', /Constructo/.test(nv1.traits) && /Tireless/.test(nv1.traits));

  // Primal Order Mago: un truco más
  const trucos = await p.evaluate(() => { const c = App.getActiveChar(); c.choices = { ...(c.choices || {}), 'primal-order': 'magician' }; return Characters.getCantripsKnown(c); });
  chk('Primal Order Mago: 3 trucos en nv1 (2 + 1)', trucos === 3 && nv1.trucos === 2, { antes: nv1.trucos, despues: trucos });

  // Subir a nivel 3 con Círculo de la Tierra
  await p.evaluate(() => { document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('show'));
    const c = App.getActiveChar(); Characters.applyLevelUp(c, 3, 9);
    Characters.applyChoice(c, 'subclase-2', 'sub-circle-land'); App.reloadChar(c); }); await sleep(600);
  const nv3 = await p.evaluate(() => { const c = App.getActiveChar();
    return { ws: (c.resources || []).filter(r => /wild/i.test(r.id)).map(r => `${r.id}:${r.current}/${r.max}:${r.recharge}`), feats: (c.features || []).map(f => f.id),
      land: (c.spells || []).filter(s => s.land).length, terreno: !!document.querySelector('.mesa-terreno') }; });
  chk('nv3: Wild Shape 2/2 con recarga de 1 en corto, sin duplicado del círculo', nv3.ws.length === 1 && nv3.ws[0] === 'wild-shape:2/2:short1', nv3.ws);
  chk("nv3: Land's Aid y Circle Spells; sin conjuros de terreno hasta elegirlo; aparece el selector", nv3.feats.includes('land-aid') && nv3.feats.includes('land-circle-spells') && nv3.land === 0 && nv3.terreno, nv3);

  await p.evaluate(() => App.setLandType('arid')); await sleep(400);
  const arido = await p.evaluate(() => App.getActiveChar().spells.filter(s => s.land).map(s => `${s.name}:${s.level}:${s.domain}`));
  await p.evaluate(() => App.setLandType('polar')); await sleep(400);
  const polar = await p.evaluate(() => App.getActiveChar().spells.filter(s => s.land).map(s => s.name));
  chk('terreno Árido: Blur, Burning Hands y Fire Bolt siempre preparados', arido.length === 3 && arido.every(x => /:true$/.test(x)) && arido.some(x => /^Fire Bolt:0/.test(x)), arido);
  chk('cambiar a Polar quita los de Árido y pone Fog Cloud, Hold Person, Ray of Frost', polar.length === 3 && polar.includes('Hold Person') && !polar.includes('Blur'), polar);

  // Land's Aid en combate: está en Acción, muestra 2d6 y gasta un Wild Shape
  await p.evaluate(() => Mesa.combate(true)); await sleep(400);
  const fila = await p.evaluate(() => { const f = [...document.querySelectorAll('#mesa-combate .mesa-op')].find(o => /Land's Aid/.test(o.textContent)); return f ? { dmg: f.querySelector('.mesa-dmg')?.textContent, sub: f.querySelector('small')?.textContent } : null; });
  await p.evaluate(() => { Mesa.abrir('rasgo-land-aid'); }); await sleep(200);
  await p.evaluate(() => [...document.querySelectorAll('.mesa-op.abierto .mesa-btn.p')].find(b => /gasta 1/.test(b.textContent)).click()); await sleep(300);
  const tras = await p.evaluate(() => ({ ws: App.getActiveChar().resources.find(r => r.id === 'wild-shape').current, accion: App.getActiveChar().turn.action }));
  chk("Land's Aid: en Acción con 2d6 grande; usarlo gasta 1 Wild Shape y la Acción", fila && fila.dmg === '2d6' && /gasta 1 Wild Shape/.test(fila.sub) && tras.ws === 1 && tras.accion, { fila, tras });
  await p.screenshot({ path: __dirname + '/out/druida_tierra_1180.png' });

  console.log(res.every(Boolean) ? 'TODO OK' : 'HAY FALLAS');
  await browser.close();
})();
