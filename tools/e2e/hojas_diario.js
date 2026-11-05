// Hojas como diario definitivo: el cuaderno abre en Hojas, el diario de chat
// pasa a hojas (una por sesión, con hora y menciones) sin duplicar, y las
// notas rápidas siguen en su pestaña.
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
    localStorage.setItem('dnd_guest', '1'); localStorage.removeItem('dnd_vista');
    const c = Characters.createNew('Prueba Diario', 'Clérigo'); c.id = 'pd';
    c.sessions = [{ id: 's1', startedAt: '2026-10-01T22:00:00.000Z' }, { id: 's2', startedAt: '2026-10-15T22:00:00.000Z' }];
    c.entities = [{ id: 'ent-kaleen', type: 'npc', name: 'Kaleen Giaco' }];
    c.diary = [
      { id: 'e-1', timestamp: '2026-10-01T22:10:00.000Z', text: 'Llegamos a Puerto Palos', sessionId: 's1', mentions: [] },
      { id: 'e-2', timestamp: '2026-10-01T22:40:00.000Z', text: 'Kaleen nos pide escoltar la carreta\nPaga 50 po', sessionId: 's1', mentions: [{ type: 'npc', id: 'ent-kaleen', name: 'Kaleen Giaco' }] },
      { id: 'e-3', timestamp: '2026-10-15T23:00:00.000Z', text: 'Emboscada en el puente', sessionId: 's2', mentions: [] },
      { id: 'e-4', timestamp: '2026-10-20T12:00:00.000Z', text: 'Comprar flechas', sessionId: null, mentions: [] },
    ];
    Storage.saveChar(c); Storage.setActiveId('pd'); sessionStorage.setItem('dnd_playing', '1');
  });
  await p.goto(URL_BASE + '/app.html', { waitUntil: 'networkidle2' }); await sleep(1400);

  await p.evaluate(() => App.toggleNotebook()); await sleep(400);
  const inicio = await p.evaluate(() => ({
    pestaña: document.querySelector('.nb-tab.active')?.id, primera: document.querySelector('.nb-tabs .nb-tab')?.textContent.trim(),
    hojas: getComputedStyle(document.getElementById('nbPanePages')).display, chat: getComputedStyle(document.getElementById('nbPaneDiary')).display,
    beta: !!document.querySelector('#nbTabPages .nb-beta'), aviso: document.querySelector('.hj-importar')?.textContent.replace(/\s+/g, ' ').trim() }));
  chk('el cuaderno abre en Hojas, primera pestaña y sin "beta"', inicio.pestaña === 'nbTabPages' && /Hojas/.test(inicio.primera) && inicio.hojas !== 'none' && inicio.chat === 'none' && !inicio.beta, inicio);
  chk('avisa cuántas notas del chat faltan pasar', /4 notas/.test(inicio.aviso || ''), inicio.aviso);

  await p.click('.hj-importar-btn'); await sleep(500);
  const tras = await p.evaluate(() => {
    const c = App.getActiveChar();
    const plano = d => JSON.stringify(d);
    const s1 = c.pages.find(x => x.sessionId === 's1');
    return { hojas: c.pages.length, sesiones: c.pages.map(x => x.sessionId), s1: s1 && plano(s1.doc),
      menciones: (c.noteMentions || []).filter(m => m.entityId === 'ent-kaleen').length, aviso: !!document.querySelector('.hj-importar'),
      tarjetas: [...document.querySelectorAll('.pg-card-title')].map(t => t.textContent) };
  });
  chk('una hoja por sesión y otra por el día sin sesión', tras.hojas === 3 && tras.sesiones.includes('s1') && tras.sesiones.includes('s2') && tras.sesiones.includes(null), tras.sesiones);
  chk('cada entrada con su hora y sus dos líneas; la mención queda enlazada a Kaleen',
    /Llegamos a Puerto Palos/.test(tras.s1) && /Paga 50 po/.test(tras.s1) && /"bold"/.test(tras.s1) && /"mention"/.test(tras.s1) && tras.menciones >= 1, { menciones: tras.menciones });
  chk('los títulos dicen la sesión; el aviso desaparece', tras.tarjetas.some(t => /Diario · Sesión 1/.test(t)) && !tras.aviso, tras.tarjetas);

  // Una nota rápida nueva aparece como pendiente y no se duplica lo ya pasado
  await p.evaluate(() => { const c = App.getActiveChar(); c.diary.push({ id: 'e-5', timestamp: new Date().toISOString(), text: 'Nota nueva', mentions: [] }); App.reloadChar(c); });
  await p.evaluate(() => App.switchNotebookTab('pages')); await sleep(300);
  const n = await p.evaluate(() => document.querySelector('.hj-importar')?.textContent.replace(/\s+/g, ' '));
  await p.click('.hj-importar-btn'); await sleep(400);
  chk('una nota rápida nueva queda pendiente y al traerla no duplica las anteriores', /1 nota/.test(n || '') && await p.evaluate(() => App.getActiveChar().pages.length === 4), n);

  await p.evaluate(() => App.switchNotebookTab('diary')); await sleep(300);
  chk('Notas rápidas sigue mostrando el chat', await p.evaluate(() => getComputedStyle(document.getElementById('nbPaneDiary')).display !== 'none' && /Notas rápidas/.test(document.getElementById('nbTabDiary').textContent)));

  console.log(res.every(Boolean) ? 'TODO OK' : 'HAY FALLAS');
  await browser.close();
})();
