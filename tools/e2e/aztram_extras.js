// Aztram (Echo Knight Shadar-Kai): Unleash Incarnation suma un ataque desde el eco,
// la maestría del arma se recuerda en su fila y Blessing of the Raven Queen da resistencia.
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
    const c = Characters.createNew('Prueba Aztram', 'Guerrero'); c.id = 'az';
    c.stats = { for: 20, des: 12, con: 15, int: 10, sab: 13, car: 8 };
    c.choices = { 'fighting-style': 'fs-defense' };
    Characters.applyLevelUp(c, 6, 56); c.subclase = 'Echo Knight';
    c.equipment = { mainHand: { kind: 'weapon', name: "Dragon's Wrath Weapon (Polearm)", die: '1d6', mastery: 'Sap', statUsed: 'str', type: 'melee' } };
    c.resources = (c.resources || []).filter(r => !['echo-unleash', 'raven-queen-blessing'].includes(r.id)).concat([
      { id: 'echo-unleash', name: 'Unleash Incarnation', max: 2, current: 2, recharge: 'long', action: 'Ninguna (en tu turno)', desc: 'Al realizar la acción de Ataque, 1 ataque cuerpo a cuerpo adicional desde la posición del eco.' },
      { id: 'raven-queen-blessing', name: 'Blessing of the Raven Queen', max: 3, current: 3, recharge: 'long', action: 'Acción bonus', desc: 'Te teletransportas 9 m.' }]);
    Storage.saveChar(c); Storage.setActiveId('az'); sessionStorage.setItem('dnd_playing', '1');
  });
  await p.goto(URL_BASE + '/app.html', { waitUntil: 'networkidle2' }); await sleep(1500);
  const cerrar = () => p.evaluate(() => document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('show')));
  await cerrar();
  const arma = () => p.evaluate(() => { const f = document.querySelector('#mesa-combate [data-id="arma-mainHand"] small'); return f ? f.textContent : ''; });

  chk('maestría Sap en la fila del arma', /Sap · si aciertas: desventaja en su próximo ataque/.test(await arma()), await arma());
  await p.evaluate(() => App.usarUnleash()); await sleep(200);
  chk('Unleash sin eco: no gasta', await p.evaluate(() => App.getActiveChar().resources.find(r => r.id === 'echo-unleash').current === 2));

  await p.evaluate(() => { Mesa.combate(true); }); await sleep(300); await cerrar();
  await p.evaluate(() => Mesa.eco(true)); await sleep(300);
  await p.evaluate(() => [...document.querySelectorAll('.mesa-eco .mesa-btn')].find(b => /\+1 ataque/.test(b.textContent)).click()); await sleep(400);
  const un = await p.evaluate(() => ({ cur: App.getActiveChar().resources.find(r => r.id === 'echo-unleash').current, max: App.ataquesDelTurno(), eco: App.getActiveChar().turn.ataquesEco }));
  chk('Unleash con eco: gasta 1 y el turno pasa a 3 ataques', un.cur === 1 && un.max === 3 && un.eco === 1, un);
  chk('la fila del arma dice ataques 0/3 (1 desde el eco)', /ataques 0\/3 \(1 desde el eco\)/.test(await arma()), await arma());

  // Raven Queen
  await p.evaluate(() => App.nuevoTurno()); await sleep(200);
  await p.evaluate(() => { Mesa.abrir('rec-raven-queen-blessing'); }); await sleep(200);
  await p.evaluate(() => [...document.querySelectorAll('.mesa-op.abierto .mesa-btn.p')].find(b => /Teletransportarse/.test(b.textContent)).click()); await sleep(400);
  const rq = await p.evaluate(() => { const c = App.getActiveChar(); return { cur: c.resources.find(r => r.id === 'raven-queen-blessing').current, bonus: c.turn.bonus, resist: !!c.resistTodo, chip: !!document.querySelector('#mesaCab .mc-resist'), ataquesEco: c.turn.ataquesEco || 0 }; });
  chk('Raven Queen: gasta 1, marca la Adicional, resistencia y aviso en la cabecera; el turno nuevo limpió el ataque del eco', rq.cur === 2 && rq.bonus && rq.resist && rq.chip && rq.ataquesEco === 0, rq);
  await p.evaluate(() => { document.getElementById('mesaHPIn').value = '9'; Mesa.vida(-1); }); await sleep(300);
  const hp = await p.evaluate(() => App.getActiveChar().hp); chk('daño 9 con resistencia: baja 4', hp.current === hp.max - 4, hp);
  await p.evaluate(() => App.nuevoTurno()); await sleep(200);
  chk('sigue durante los turnos de los demás', await p.evaluate(() => !!App.getActiveChar().resistTodo));
  await p.evaluate(() => App.nuevoTurno()); await sleep(200);
  chk('se va al cerrar tu turno siguiente', await p.evaluate(() => !App.getActiveChar().resistTodo && !document.querySelector('#mesaCab .mc-resist')));
  await p.evaluate(() => App.usarBendicionCuervo()); await sleep(300);
  await p.evaluate(() => document.querySelector('#mesaCab .mc-resist').click()); await sleep(300);
  chk('tocar el aviso la quita', await p.evaluate(() => !App.getActiveChar().resistTodo));
  await cerrar(); await p.screenshot({ path: __dirname + '/out/aztram_extras_1180.png' });
  console.log(res.every(Boolean) ? 'TODO OK' : 'HAY FALLAS');
  await browser.close();
})();
