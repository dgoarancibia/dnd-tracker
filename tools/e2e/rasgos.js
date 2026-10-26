const puppeteer = require('puppeteer-core');
const { CHROME, URL_BASE, salida } = require('./entorno');
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new' });
  const p = await browser.newPage();
  p.on('pageerror', e => console.log('ERROR:', e.message));
  await p.setViewport({ width: 1440, height: 900 });
  await p.goto(URL_BASE + '/index.html', { waitUntil: 'networkidle2' }); await sleep(1500);
  await p.evaluate(() => {
    localStorage.setItem('dnd_guest', '1');
    const t = Characters.createNew('Torvald Ironhollow', 'Explorador'); t.id = 'tv'; t.nivel = 3; t.subclase = 'Beast Master';
    t.features = [...(t.features||[]), { id:'bm-ranger-companion', name:'Primal Companion', source:'Beast Master · Nivel 3', type:'passive', desc:'VIEJO', fullDesc:'VIEJO' }];
    t.companion = { beast: 'land', name: 'Grum' };
    t.resources = [{ id:'second-wind', name:'x', current:1, max:2, recharge:'short' }];
    Storage.saveChar(t); { const x = Storage.getChar('tv'); const sp = (x.spells||[]).find(s => s.id === 'ensnaring-strike'); if (sp) { sp.desc = 'VIEJO'; sp.fullDesc = 'VIEJO'; } Storage.saveCharRaw(x); }
    const a = Characters.createNew('Aztram', 'Guerrero'); a.id = 'az'; a.nivel = 5; a.subclase = 'Echo Knight';
    a.features = [{ id:'ek-manifest-echo', name:'Manifest Echo', source:'Echo Knight · Nivel 3', type:'active', desc:'VIEJO', fullDesc:'VIEJO' }];
    Storage.saveChar(a);
    const l = Characters.buildLursey(); Storage.saveChar(l);
  });
  for (const id of ['tv', 'az', 'lursey-brumaclara']) {
    await p.evaluate(id => { Storage.setActiveId(id); sessionStorage.setItem('dnd_playing', '1'); }, id);
    await p.goto(URL_BASE + '/app.html', { waitUntil: 'networkidle2' }); await sleep(2500);
    const r = await p.evaluate(() => {
      const c = Storage.getChar(Storage.getActiveId());
      const f = id => { const x = (c.features||[]).find(x => x.id === id); return x ? x.desc.slice(0, 90) : '—'; };
      const res = id => { const x = (c.resources||[]).find(x => x.id === id); return x ? `${x.current}/${x.max} ${x.recharge}` : '—'; };
      return { nombre: c.name, bm: f('bm-ranger-companion'), echo: f('ek-manifest-echo'), sw: res('second-wind'), cd: res('channel-divinity'), cdf: f('channel-divinity'), bond: res('bond'), maestria: Characters.getWeaponMasteryCount(c),
        feats: document.querySelectorAll('.feat-name').length, ens: ((c.spells||[]).find(s => s.id === 'ensnaring-strike')||{}).desc, nsp: (c.spells||[]).length, conUpcast: (c.spells||[]).filter(s => s.upcast).length };
    });
    console.log(JSON.stringify(r));
    if (id==='az') console.log(await p.evaluate(() => { const c = Storage.getChar('az'); return JSON.stringify({sub: c.subclase, classes: c.classes, ids: c.features.map(f=>f.id+':'+(f.source||'')).slice(-6)}); }));
  }
  await browser.close();
})();
