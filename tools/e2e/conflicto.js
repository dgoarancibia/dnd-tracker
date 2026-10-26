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
      markDeletedCloud: async (u, id) => { await window.__mark(id, true); },
      unmarkDeletedCloud: async (u, id) => { await window.__mark(id, false); },
      loadDeletedCloud: async () => new Set(JSON.parse(await window.__marcas())),
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
  await p.setViewport({ width: 1100, height: 800 });
  return p;
}
const inicio = async p => { await p.goto(URL_BASE + '/index.html?r=' + Date.now(), { waitUntil: 'networkidle2' }); await sleep(3500); };
const tarjetas = p => p.evaluate(() => [...document.querySelectorAll('.char-card')].map(c => c.querySelector('.char-card-name').innerText.replace(/\n/g, ' ') + (c.querySelector('.char-dup') ? ' [' + [...c.querySelectorAll('.char-dup')].map(d => d.textContent.slice(0, 22)).join('|') + ']' : '')));
const crear = (p, id, nombre, nivel) => p.evaluate((id, nombre, nivel) => { const c = Characters.createNew(nombre, 'Explorador'); c.id = id; c.nivel = nivel; c.createdAt = new Date().toISOString(); Storage.saveChar(c); }, id, nombre, nivel);
let ok = true; const chk = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) ok = false; };

const jugar = async (p, id) => { await inicio(p); await p.evaluate(id => { Storage.setActiveId(id); playChar(id); }, id); await p.waitForFunction(() => typeof App !== 'undefined' && window.Cloud && Cloud.isLoggedIn() && document.querySelector('.skill-row'), { timeout: 20000 }); await sleep(2500); await p.evaluate(() => { const o = document.getElementById('choiceModalOverlay'); if (o) o.style.display = 'none'; }); };
const hp = p => p.evaluate(() => App.getActiveChar().hp.current);
const dialogo = p => p.evaluate(() => document.getElementById('confirmModal').classList.contains('show') ? document.getElementById('confirmTitle').textContent : null);
const danio = (p, n) => p.evaluate(n => { document.getElementById('hdrHPFree').value = n; App.applyFreeHPAs(-1); }, n);
(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new' });
  const ipad = await dispositivo(browser, 'iPad'), desk = await dispositivo(browser, 'desktop');
  await inicio(ipad); await crear(ipad, 'torv', 'Torvald', 3); await inicio(ipad);
  await inicio(desk);                                   // el desktop baja a Torvald
  const hp0 = NUBE['torv'].hp.current;
  console.log('— Conflicto: el iPad juega y guarda; el desktop desactualizado edita');
  await jugar(ipad, 'torv'); await danio(ipad, 5); await ipad.evaluate(() => App.saveToCloud()); await sleep(800);
  chk(NUBE['torv'].hp.current === hp0 - 5, 'nube con la sesión del iPad');
  await jugar(desk, 'torv'); await sleep(500);
  await desk.evaluate(() => { if (document.getElementById('confirmModal').classList.contains('show')) document.querySelector('#confirmModal .btn-ghost').click(); });
  chk(await hp(desk) === hp0 - 5, `el desktop (sin cambios locales) tomó solo la versión del iPad: ${await hp(desk)} HP`);
  await danio(ipad, 3); await ipad.evaluate(() => App.saveToCloud()); await sleep(800);   // iPad: hp0-8
  await danio(desk, 1); await desk.evaluate(() => App.saveToCloud()); await sleep(1200);    // desktop: hp0-6, sin conocer el último cambio
  chk(NUBE['torv'].hp.current === hp0 - 8, 'el desktop NO pisó la nube');
  chk(!!(await dialogo(desk)), 'el desktop pregunta: ' + await dialogo(desk));
  console.log(ok ? '\nTODO OK' : '\nHAY FALLAS');
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
