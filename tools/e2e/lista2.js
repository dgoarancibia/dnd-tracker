const puppeteer = require('puppeteer-core');
const { CHROME, URL_BASE, salida } = require('./entorno');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const NUBE = {}; const MARCAS = new Set();
const PATCH = () => {
  let fa;
  Object.defineProperty(window, 'FirebaseApp', { configurable: true, get() { return fa; }, set(v) {
    fa = { ...v,
      onAuthChange: cb => { setTimeout(() => cb({ uid: 'test', email: 'diego@test' }), 50); return () => {}; },
      getCurrentUser: () => ({ uid: 'test' }),
      loadCharCloud: async (u, id) => JSON.parse(await window.__get(id) || 'null'),
      saveCharCloud: async (u, c) => { const { noteMentions, ...r } = c; await window.__put(c.id, JSON.stringify(r)); },
      loadAllCharsCloud: async () => JSON.parse(await window.__all()),
      deleteCharCloud: async (u, id) => { await window.__del(id); },
      markDeletedCloud: async (u, id) => { if (window.__sinPermiso) { const e = new Error('Missing or insufficient permissions.'); e.code = 'permission-denied'; throw e; } await window.__mark(id, true); },
      unmarkDeletedCloud: async (u, id) => { await window.__mark(id, false); },
      loadDeletedCloud: async () => { if (window.__sinPermiso) { const e = new Error('x'); e.code = 'permission-denied'; throw e; } return new Set(JSON.parse(await window.__marcas())); },
      listCheckpointsCloud: async () => [],
    };
  } });
};
async function dispositivo(browser, nombre) {
  const ctx = await browser.createBrowserContext();
  const p = await ctx.newPage();
  p.on('pageerror', e => console.log(`[${nombre}] ERROR:`, e.message));
  await p.exposeFunction('__get', id => NUBE[id] ? JSON.stringify(NUBE[id]) : null);
  await p.exposeFunction('__put', (id, j) => { NUBE[id] = JSON.parse(j); });
  await p.exposeFunction('__all', () => JSON.stringify(NUBE));
  await p.exposeFunction('__del', id => { delete NUBE[id]; });
  await p.exposeFunction('__mark', (id, on) => { on ? MARCAS.add(id) : MARCAS.delete(id); });
  await p.exposeFunction('__marcas', () => JSON.stringify([...MARCAS]));
  await p.evaluateOnNewDocument(PATCH);
  if (process.env.SINPERMISO) await p.evaluateOnNewDocument(() => { window.__sinPermiso = true; });
  p.on('console', m => { if (/⚠|permission/i.test(m.text())) console.log('  [log]', m.text().slice(0,120)); });
  await p.setViewport({ width: 1100, height: 800 });
  return p;
}
const inicio = async p => { await p.goto(URL_BASE + '/index.html?r=' + Date.now(), { waitUntil: 'networkidle2' }); await sleep(3500); };
const tarjetas = p => p.evaluate(() => [...document.querySelectorAll('.char-card')].map(c => c.querySelector('.char-card-name').innerText.replace(/\n/g, ' ') + (c.querySelector('.char-dup') ? ' [' + [...c.querySelectorAll('.char-dup')].map(d => d.textContent.slice(0, 22)).join('|') + ']' : '')));
const crear = (p, id, nombre, nivel) => p.evaluate((id, nombre, nivel) => { const c = Characters.createNew(nombre, 'Explorador'); c.id = id; c.nivel = nivel; c.createdAt = new Date().toISOString(); Storage.saveChar(c); }, id, nombre, nivel);
let ok = true; const chk = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) ok = false; };

(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new' });
  const win = await dispositivo(browser, 'Windows'), mac = await dispositivo(browser, 'Mac');

  console.log('— Windows crea Torvald; el Mac ya tenía otro personaje');
  await inicio(win); await crear(win, 'torv-win', 'Torvald', 2); await inicio(win);
  chk(!!NUBE['torv-win'], 'el Torvald de Windows se subió solo a la nube');
  await inicio(mac); await crear(mac, 'aztram', 'Aztram', 5); await inicio(mac);
  chk((await tarjetas(mac)).some(t => /Torvald/.test(t)), 'el Mac BAJÓ el Torvald de Windows (antes no aparecía)');

  console.log('— Tu caso: el Mac crea su propio Torvald → hay dos');
  await crear(mac, 'torv-mac', 'Torvald', 3); await inicio(mac);
  await inicio(win);
  const tw = await tarjetas(win);
  chk(tw.filter(t => /Torvald/.test(t)).length === 2, 'Windows ve los dos Torvald: ' + JSON.stringify(tw.filter(t => /Torvald/.test(t))));
  chk(tw.filter(t => /Torvald/.test(t)).every(t => /Nombre repetido/.test(t)), 'con fechas para distinguirlos');

  console.log('— Borrás el de Windows (desde Windows) → desaparece también en el Mac');
  await win.evaluate(() => { Storage.deleteChar('torv-win'); if (window.Cloud) Cloud.deleteChar('torv-win'); });
  await sleep(500);
  chk(!NUBE['torv-win'] && (process.env.SINPERMISO || MARCAS.has('torv-win')), 'fuera de la nube' + (process.env.SINPERMISO ? ' (marca bloqueada por permisos)' : ' y con marca de borrado'));
  await inicio(mac);
  const tm = await tarjetas(mac);
  chk(tm.filter(t => /Torvald/.test(t)).length === 1, 'el Mac queda con un solo Torvald: ' + JSON.stringify(tm));
  chk(await mac.evaluate(() => !!Storage.getTrash()['torv-win']), 'el borrado está en la papelera del Mac (recuperable)');
  await inicio(win);
  chk(!(await tarjetas(win)).some(t => /Torvald/.test(t) && /creado/.test(t)), 'Windows tampoco lo resucita');
  chk((await tarjetas(win)).filter(t => /Torvald/.test(t)).length === 1, 'Windows queda solo con el Torvald del Mac');

  if (process.env.SINPERMISO) { console.log(ok ? '\nTODO OK' : '\nHAY FALLAS'); await browser.close(); return; }
  console.log('— Restaurar desde la papelera vuelve a sincronizar');
  await mac.evaluate(() => Storage.restoreChar('torv-win')); await sleep(400); await inicio(mac);
  chk(!MARCAS.has('torv-win') && !!NUBE['torv-win'], 'sin marca y de vuelta en la nube');

  console.log(ok ? '\nTODO OK' : '\nHAY FALLAS');
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
