// Economía del turno: Atacar descuenta ataques, la mano secundaria usa la
// Acción adicional (salvo Nick) y usar un recurso marca su activación.
const puppeteer = require('puppeteer-core');
const { CHROME, URL_BASE } = require('./entorno');
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new' });
  const p = await browser.newPage();
  p.on('pageerror', e => console.log('ERROR:', e.message));
  await p.setViewport({ width: 1440, height: 900 });
  await p.goto(URL_BASE + '/index.html', { waitUntil: 'networkidle2' }); await sleep(1500);
  await p.evaluate(() => {
    localStorage.setItem('dnd_guest', '1');
    const t = Characters.createNew('Prueba', 'Guerrero'); t.id = 'turno'; t.nivel = 5;
    t.features = [...(t.features || []), { id: 'ea', name: 'Extra Attack' }];
    const arma = (id, name) => ({ id, name, kind: 'weapon', die: '1d6', type: 'melee',
      bonuses: { ac: 0, attack: 0, damage: 0, save: 0 }, buffs: [] });
    t.equipment = { ...(t.equipment || {}), mainHand: arma('shortsword', 'Shortsword'), offHand: arma('scimitar', 'Scimitar') };
    t.weaponMasteries = [];
    t.resources = [...(t.resources || []), { id: 'sc', name: 'Stonecunning', current: 2, max: 2, recharge: 'long', action: 'Acción bonus' }];
    Storage.saveChar(t); Storage.setActiveId('turno'); sessionStorage.setItem('dnd_playing', '1');
  });
  await p.goto(URL_BASE + '/app.html', { waitUntil: 'networkidle2' }); await sleep(2500);
  const turno = () => p.evaluate(() => JSON.parse(JSON.stringify(Storage.getChar('turno').turn || {})));
  const res = [];
  const chk = (nombre, ok, dato) => { res.push(ok); console.log(ok ? 'OK ' : 'MAL', nombre, dato !== undefined ? JSON.stringify(dato) : ''); };

  // Fuera de combate no se cuenta nada.
  await p.evaluate(() => App.attackWithWeapon('mainHand')); await sleep(200);
  let t = await turno();
  chk('fuera de combate no gasta', !t.attacksUsed, t);

  await p.evaluate(() => { App.startCombat(); App.nuevoTurno(); }); await sleep(300);
  await p.evaluate(() => App.attackWithWeapon('mainHand')); await sleep(200);
  await p.evaluate(() => App.attackWithWeapon('mainHand')); await sleep(200);
  t = await turno();
  chk('2 ataques gastados', t.attacksUsed === 2 && t.action === true, t);

  await p.evaluate(() => App.attackWithWeapon('mainHand')); await sleep(300);
  const aviso = await p.evaluate(() => document.getElementById('confirmMsg').textContent);
  t = await turno();
  chk('3er ataque pregunta y no gasta', /2 ataques/.test(aviso) && t.attacksUsed === 2, aviso);
  await p.evaluate(() => document.getElementById('confirmOkBtn').click()); await sleep(300);

  await p.evaluate(() => App.attackWithWeapon('offHand')); await sleep(200);
  t = await turno();
  chk('mano secundaria usa Adicional', t.bonus === true, t);

  // Con Nick, el ataque extra va dentro de la acción de Ataque.
  await p.evaluate(() => { App.nuevoTurno(); App.toggleMastery('scimitar'); }); await sleep(200);
  await p.evaluate(() => App.attackWithWeapon('offHand')); await sleep(200);
  t = await turno();
  chk('con Nick no gasta Adicional', t.bonus === false && t.action === true, t);

  await p.evaluate(() => App.nuevoTurno()); await sleep(200);
  await p.evaluate(() => App.adjustResource('sc', -1)); await sleep(200);
  t = await turno();
  chk('recurso Acción bonus marca Adicional', t.bonus === true, t);
  await p.evaluate(() => App.adjustResource('sc', 1)); await sleep(200);
  t = await turno();
  chk('devolver un uso no marca nada nuevo', t.bonus === true && !t.action, t);

  const ok = res.every(Boolean);
  console.log(ok ? 'TODO OK' : 'HAY FALLAS');
  await browser.close();
  process.exit(ok ? 0 : 1);
})();
