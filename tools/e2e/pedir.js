// Los datos que se piden (PG temporales, nombres…) usan el diálogo de la app,
// no el prompt() del navegador: aceptar con Enter, cancelar con Escape.
const puppeteer = require('puppeteer-core');
const { CHROME, URL_BASE } = require('./entorno');
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new' });
  const p = await browser.newPage();
  p.on('pageerror', e => console.log('ERROR:', e.message));
  let nativo = false;
  p.on('dialog', async d => { nativo = true; await d.dismiss(); });
  const res = [];
  const chk = (nombre, ok, dato) => { res.push(ok); console.log(ok ? 'OK ' : 'MAL', nombre, dato !== undefined ? JSON.stringify(dato) : ''); };
  await p.setViewport({ width: 1180, height: 820 });
  await p.goto(URL_BASE + '/index.html', { waitUntil: 'networkidle2' });
  await p.evaluate(() => { localStorage.setItem('dnd_guest', '1'); localStorage.setItem('dnd_vista', 'mesa');
    const c = Characters.createNew('Prueba Pedir', 'Explorador'); c.id = 'pp'; c.nivel = 3;
    Storage.saveChar(c); Storage.setActiveId('pp'); sessionStorage.setItem('dnd_playing', '1'); });
  await p.goto(URL_BASE + '/app.html', { waitUntil: 'networkidle2' }); await sleep(1500);

  p.evaluate(() => App.promptTempHP()); await sleep(300);
  const abierto = await p.evaluate(() => ({ show: document.getElementById('pedirModal').classList.contains('show'), titulo: document.getElementById('pedirTitulo').textContent,
    foco: document.activeElement && document.activeElement.id, tipo: document.getElementById('pedirInput').type }));
  await p.screenshot({ path: __dirname + '/out/pedir_temporales_1180.png' });
  await p.keyboard.type('7'); await p.keyboard.press('Enter'); await sleep(300);
  const temp = await p.evaluate(() => ({ temp: App.getActiveChar().hp.temp, show: document.getElementById('pedirModal').classList.contains('show') }));
  chk('PG temporales: diálogo de la app con foco en un campo numérico; Enter guarda 7', abierto.show && /temporales/i.test(abierto.titulo) && abierto.foco === 'pedirInput'
    && abierto.tipo === 'number' && temp.temp === 7 && !temp.show, { abierto, temp });

  p.evaluate(() => App.promptTempHP()); await sleep(300);
  await p.keyboard.type('3'); await p.keyboard.press('Escape'); await sleep(300);
  chk('Escape cancela sin cambiar nada', await p.evaluate(() => App.getActiveChar().hp.temp === 7 && !document.getElementById('pedirModal').classList.contains('show')));

  p.evaluate(() => App.marcarObjetivo()); await sleep(300);
  await p.keyboard.type('Ogro'); await p.evaluate(() => document.querySelector('#pedirModal .btn-gold').click()); await sleep(300);
  chk('un texto (objetivo marcado) se guarda con Aceptar', await p.evaluate(() => App.getActiveChar().markTarget === 'Ogro'));
  chk('nunca aparece la ventana nativa del navegador', !nativo);

  console.log(res.every(Boolean) ? 'TODO OK' : 'HAY FALLAS');
  await browser.close();
})();
