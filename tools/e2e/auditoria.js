// HU-19: indicador de auditoría en el inicio + arma sin competencia no suma BC.
const puppeteer = require('puppeteer-core');
const { CHROME, URL_BASE, salida } = require('./entorno');
const sleep = ms => new Promise(r => setTimeout(r, ms));
let ok = true; const chk = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) ok = false; };
(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new' });
  const p = await browser.newPage();
  p.on('pageerror', e => console.log('ERROR:', e.message));
  await p.setViewport({ width: 1100, height: 900 });
  await p.goto(URL_BASE + '/index.html', { waitUntil: 'networkidle2' }); await sleep(1200);
  await p.evaluate(() => {
    localStorage.setItem('dnd_guest', '1');
    const l = Characters.buildLursey(); l.nivel = 7; l.languages = ['Común', 'Enano', 'Celestial']; Storage.saveChar(l);
    const k = Characters.buildLursey(); k.id = 'cleriga'; k.name = 'Clériga sin Protector'; k.languages = l.languages;
    delete k.choices['divine-order']; Storage.saveChar(k);
  });
  await p.goto(URL_BASE + '/index.html?r=' + Date.now(), { waitUntil: 'networkidle2' }); await sleep(1500);
  await p.evaluate(() => { if (typeof skipLogin === 'function') skipLogin(); }); await sleep(500);
  const pills = await p.evaluate(() => [...document.querySelectorAll('.char-card')].map(c =>
    c.querySelector('.char-card-name').innerText.replace(/\n/g, ' ') + ' → ' + ((c.querySelector('.stat-pill.audit') || {}).innerText || '—')));
  console.log('   ' + pills.join('\n   '));
  chk(pills.some(t => /Lursey.*Completo/.test(t)), 'Lursey (Protector) queda ✓ Completo');
  chk(pills.some(t => /Clériga.*error/.test(t)), 'la clériga sin Protector marca errores');
  await p.evaluate(() => openAuditModal('cleriga')); await sleep(300);
  const lista = await p.evaluate(() => document.getElementById('auditList').innerText);
  console.log('   ' + lista.replace(/\n+/g, ' | '));
  chk(/Maza de Guerra \+1: sin competencia/.test(lista), 'el detalle incluye el arma sin competencia');
  const nPill = parseInt(pills.find(t => /Clériga/.test(t)).match(/(\d+) error/)[1]);
  chk(nPill === (lista.match(/⛔/g) || []).length, `el número de la tarjeta (${nPill}) coincide con el detalle`);
  await p.screenshot({ path: salida('auditoria.png') });
  const atq = await p.evaluate(() => [Characters.calcArma(Storage.getChar('lursey-brumaclara'), 'mainHand'), Characters.calcArma(Storage.getChar('cleriga'), 'mainHand')]
    .map(a => a.ataque + ' ' + (a.sinCompetencia ? 'sin comp' : 'comp')));
  chk(atq[0] !== atq[1] && /sin comp/.test(atq[1]), 'sin competencia el ataque baja (no suma BC): ' + atq.join(' vs '));
  console.log(ok ? '\nTODO OK' : '\nHAY FALLAS');
  await browser.close();
  process.exit(ok ? 0 : 1);
})();
