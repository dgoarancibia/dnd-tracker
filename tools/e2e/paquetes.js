// La mochila cerrada de Torvald se abre en sus objetos al abrir la ficha;
// la de otro personaje no se toca. El wizard muestra el contenido del paquete.
const puppeteer = require('puppeteer-core');
const { CHROME, URL_BASE } = require('./entorno');
const sleep = ms => new Promise(r => setTimeout(r, ms));
let ok = true; const chk = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) ok = false; };
(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new' });
  const p = await browser.newPage();
  p.on('pageerror', e => console.log('ERROR:', e.message));
  await p.setViewport({ width: 1440, height: 900 });
  await p.goto(URL_BASE + '/index.html', { waitUntil: 'networkidle2' }); await sleep(1500);
  const vista = await p.evaluate(() => _conContenidoPaquete('Mochila de mazmorrero'));
  chk(/Abrojos/.test(vista) && /10× Antorcha/.test(vista), 'el wizard muestra el contenido: ' + vista.replace(/<[^>]+>/g, ''));
  await p.evaluate(() => {
    localStorage.setItem('dnd_guest', '1');
    const mk = (id, nombre) => {
      const c = Characters.createNew(nombre, 'Explorador'); c.id = id; c.nivel = 3;
      c.consumables = [{ id: 'r', name: 'Raciones (1 día)', qty: 2, category: 'Food', slot: 'bag' },
        { id: 'm', name: 'Mochila de mazmorrero', qty: 1, category: 'Other', slot: 'bag' }];
      Storage.saveChar(c);
    };
    mk('tv', 'Torvald Ironhollow'); mk('az', 'Aztram');
    Storage.setActiveId('tv'); sessionStorage.setItem('dnd_playing', '1');
  });
  await p.goto(URL_BASE + '/app.html', { waitUntil: 'networkidle2' }); await sleep(2500);
  const tv = await p.evaluate(() => Storage.getChar('tv').consumables.map(i => `${i.qty}× ${i.name}`));
  console.log('   Torvald:', tv.join(' | '));
  chk(!tv.some(n => /Mochila de/.test(n)), 'Torvald ya no tiene la mochila cerrada');
  chk(tv.includes('12× Raciones (1 día)'), 'las raciones se suman a las que ya tenía (2 + 10)');
  chk(tv.includes('1× Palanca') && tv.includes('10× Antorcha') && tv.includes('1× Mochila'), 'quedan palanca, antorchas y la mochila');
  await p.evaluate(() => App.reloadChar(Storage.getChar('tv'))); await sleep(500);
  chk((await p.evaluate(() => Storage.getChar('tv').consumables.length)) === tv.length, 'recargar no duplica nada');
  const az = await p.evaluate(() => Storage.getChar('az').consumables.map(i => i.name));
  chk(az.includes('Mochila de mazmorrero'), 'Aztram no se toca');
  console.log(ok ? '\nTODO OK' : '\nHAY FALLAS');
  await browser.close();
  process.exit(ok ? 0 : 1);
})();
