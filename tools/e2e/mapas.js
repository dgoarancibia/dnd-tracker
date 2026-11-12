// Editor de mapas: goma parcial, mover y editar texto, formas, pines,
// deshacer/rehacer y guardado automático (sin botón Guardar).
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
  await p.evaluate(() => { localStorage.setItem('dnd_guest', '1'); localStorage.setItem('dnd_vista', 'mesa');
    const c = Characters.createNew('Prueba Mapas', 'Explorador'); c.id = 'mp' + Date.now(); Storage.saveChar(c); Storage.setActiveId(c.id); sessionStorage.setItem('dnd_playing', '1'); });
  await p.goto(URL_BASE + '/app.html', { waitUntil: 'networkidle2' }); await sleep(1500);
  await p.evaluate(() => document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('show')));
  // Mapa de prueba: imagen gris de 800x500
  const id = await p.evaluate(async () => {
    App.abrirMapas();
    const cv = document.createElement('canvas'); cv.width = 800; cv.height = 500;
    const g = cv.getContext('2d'); g.fillStyle = '#556'; g.fillRect(0, 0, 800, 500);
    const blob = await new Promise(r => cv.toBlob(r, 'image/png'));
    const m = await Maps.addMapFromBlob(blob, 'Mazmorra', App.getActiveChar().id);
    await Maps.openMap(m.id); return m.id; });
  await sleep(800);
  const caja = await p.evaluate(() => { const r = document.getElementById('mapCanvas').getBoundingClientRect(); const c = document.getElementById('mapCanvas'); return { x: r.left, y: r.top, w: r.width, h: r.height, cw: c.width, ch: c.height }; });
  // Coordenadas del mapa (lienzo de 1000 de ancho) → pantalla
  const k = caja.cw / 1000;
  const en = (cx, cy) => [caja.x + cx * k * caja.w / caja.cw, caja.y + cy * k * caja.h / caja.ch];
  const arrastrar = async (a, b, pasos = 12) => { const [x1, y1] = en(...a), [x2, y2] = en(...b);
    await p.mouse.move(x1, y1); await p.mouse.down(); for (let i = 1; i <= pasos; i++) await p.mouse.move(x1 + (x2 - x1) * i / pasos, y1 + (y2 - y1) * i / pasos); await p.mouse.up(); await sleep(80); };
  const tocar = async pt => { const [x, y] = en(...pt); await p.mouse.click(x, y); await sleep(150); };
  const anots = () => p.evaluate(() => JSON.parse(JSON.stringify(Maps._debug ? Maps._debug() : null)));
  const guardado = id => p.evaluate(id => new Promise(res => { const rq = indexedDB.open('dnd_maps_v1'); rq.onsuccess = () => { const tx = rq.result.transaction('maps'); const g = tx.objectStore('maps').get(id); g.onsuccess = () => res(g.result.annotations); }; }), id);

  // Lápiz: una línea horizontal; la goma en el medio la corta en dos
  await p.evaluate(() => { Maps.setTool('pen'); Maps.setSize(4); });
  await arrastrar([100, 100], [300, 100], 20);
  await p.evaluate(() => Maps.setTool('eraser'));
  await tocar([200, 100]);
  await sleep(700);
  let g = await guardado(id);
  const trazos = g.filter(a => a.type === 'path');
  const extremos = trazos.map(t => [Math.round(t.pts[0]), Math.round(t.pts[t.pts.length - 2])]).sort((a, b) => a[0] - b[0]);
  chk('goma parcial: la línea queda en dos trozos, sin el medio (y se guardó sola)', trazos.length === 2 && extremos[0][0] <= 102 && extremos[0][1] < 195 && extremos[1][0] > 205 && extremos[1][1] >= 298, extremos);

  // Texto: crear, mover con Mover y editar tocándolo
  await p.evaluate(() => Maps.setTool('text'));
  await tocar([400, 300]);
  await p.keyboard.type('Puerta'); await p.keyboard.press('Enter'); await sleep(100);
  await p.evaluate(() => Maps.setTool('move'));
  await arrastrar([420, 295], [520, 345]);
  await sleep(700);
  g = await guardado(id);
  let txt = g.find(a => a.type === 'text');
  chk('mover texto: se desplaza ~100,50', txt && Math.round(txt.x) === 500 && Math.round(txt.y) === 350, txt);
  await tocar([520, 345]);
  await p.evaluate(() => { const i = document.getElementById('mapTextInput'); i.value = 'Puerta secreta'; });
  await p.keyboard.press('Enter'); await sleep(700);
  g = await guardado(id); txt = g.find(a => a.type === 'text');
  chk('tocar un texto con Mover lo edita', txt && txt.text === 'Puerta secreta', txt && txt.text);

  // Formas
  for (const [f, a, b] of [['flecha', [100, 400], [250, 380]], ['circulo', [600, 150], [650, 150]], ['linea', [50, 450], [150, 450]]]) {
    await p.evaluate(f => Maps.setTool(f), f); await arrastrar(a, b);
  }
  await sleep(700); g = await guardado(id);
  chk('formas: flecha, círculo y línea', ['flecha', 'circulo', 'linea'].every(f => g.some(a => a.type === 'shape' && a.forma === f)), g.filter(a => a.type === 'shape').map(a => a.forma));

  // Pin con nota
  await p.evaluate(() => Maps.setTool('pin'));
  await tocar([700, 400]);
  await p.evaluate(() => { const pn = document.getElementById('mapPinPanel'); pn.querySelector('.map-pin-titulo').value = 'Guarida'; pn.querySelector('.map-pin-nota').value = 'Dragón verde joven'; pn.querySelector('.map-pin-ok').click(); });
  await sleep(700); g = await guardado(id);
  const pin = g.find(a => a.type === 'pin');
  chk('pin con título y nota', pin && pin.titulo === 'Guarida' && pin.nota === 'Dragón verde joven', pin);
  await tocar([700, 385]);
  chk('tocar el pin lo abre con su nota', await p.evaluate(() => document.querySelector('#mapPinPanel .map-pin-nota')?.value === 'Dragón verde joven'));
  await p.evaluate(() => document.querySelector('#mapPinPanel .map-pin-cancelar').click());

  // Deshacer / Rehacer
  const n0 = (await guardado(id)).length;
  await p.evaluate(() => Maps.undo()); await sleep(700);
  const n1 = (await guardado(id)).length;
  await p.evaluate(() => Maps.redo()); await sleep(700);
  const n2 = (await guardado(id)).length;
  chk('deshacer quita el pin y rehacer lo devuelve (guardado solo)', n1 === n0 - 1 && n2 === n0, { n0, n1, n2 });

  await p.screenshot({ path: __dirname + '/out/mapas_1180.png' });
  // Cerrar y volver a abrir: está todo
  await p.evaluate(() => Maps.closeMap()); await sleep(300);
  await p.evaluate(id => Maps.openMap(id), id); await sleep(700);
  chk('al reabrir están todas las anotaciones', (await guardado(id)).length === n0);
  chk('sin botón Guardar; estado "Guardado"', await p.evaluate(() => !document.getElementById('mapBtnSave') && document.getElementById('mapSaveState').textContent === 'Guardado'));
  // ── Nube simulada (misma interfaz que FirebaseApp): subir, bajar, más nuevo gana, borrado ──
  await p.evaluate(() => Maps.closeMap()); await sleep(300);
  await p.evaluate(() => {
    const nube = window.__nube = { meta: {}, img: {} };
    window.FirebaseApp = Object.assign(window.FirebaseApp || {}, {
      getCurrentUser: () => ({ uid: 'u1' }),
      saveMapMetaCloud: async (uid, m) => { nube.meta[m.id] = JSON.parse(JSON.stringify(m)); },
      saveMapImgCloud: async (uid, id, t) => { nube.img[id] = t.slice(); },
      listMapsCloud: async () => Object.values(nube.meta).map(x => ({ ...x })),
      loadMapImgCloud: async (uid, id) => nube.img[id].join(''),
      deleteMapCloud: async (uid, id) => { delete nube.meta[id]; delete nube.img[id]; },
    });
  });
  const local = id => p.evaluate(id => new Promise(res => { const rq = indexedDB.open('dnd_maps_v1'); rq.onsuccess = () => { const g = rq.result.transaction('maps').objectStore('maps').get(id); g.onsuccess = () => res(g.result || null); }; }), id);
  const borrarLocal = id => p.evaluate(id => new Promise(res => { const rq = indexedDB.open('dnd_maps_v1'); rq.onsuccess = () => { const tx = rq.result.transaction('maps', 'readwrite'); tx.objectStore('maps').delete(id); tx.oncomplete = () => res(); }; }), id);
  await p.evaluate(() => Maps.sincronizar()); await sleep(800);
  const subido = await p.evaluate(id => { const m = window.__nube.meta[id]; return m && { anots: JSON.parse(m.annotations).length, trozos: m.trozos, img: (window.__nube.img[id] || []).join('').length, lienzo: m.lienzo }; }, id);
  chk('sube a la nube: imagen comprimida en trozos y las 7 anotaciones', subido && subido.anots === n0 && subido.trozos >= 1 && subido.img > 100 && subido.lienzo === 1000, subido);
  await borrarLocal(id);
  await p.evaluate(() => Maps.sincronizar()); await sleep(800);
  const bajado = await local(id);
  chk('otro dispositivo (sin el mapa local): lo baja con imagen y anotaciones', bajado && bajado.annotations.length === n0 && bajado.name === 'Mazmorra' && bajado.enNube, bajado && { n: bajado.annotations.length, enNube: bajado.enNube });
  await p.evaluate(id => { const m = window.__nube.meta[id]; m.annotations = JSON.stringify([{ type: 'text', x: 10, y: 20, text: 'Desde el PC', color: '#fff', size: 18 }]); m.updatedAt = '2099-01-01T00:00:00.000Z'; }, id);
  await p.evaluate(() => Maps.sincronizar()); await sleep(800);
  const nuevo = await local(id);
  chk('la nube más nueva reemplaza las anotaciones locales', nuevo && nuevo.annotations.length === 1 && nuevo.annotations[0].text === 'Desde el PC', nuevo && nuevo.annotations);
  await p.evaluate(id => { delete window.__nube.meta[id]; }, id);
  await p.evaluate(() => Maps.sincronizar()); await sleep(800);
  chk('borrado en otro dispositivo: desaparece del local', !(await local(id)));

  console.log(res.every(Boolean) ? 'TODO OK' : 'HAY FALLAS');
  await browser.close();
})();
