const puppeteer = require('puppeteer-core');
const { CHROME, URL_BASE, salida } = require('./entorno');
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new' });
  const p = await browser.newPage();
  p.on('pageerror', e => console.log('ERROR:', e.message));
  await p.setViewport({ width: 1440, height: 900 });
  await p.goto(URL_BASE + '/index.html', { waitUntil: 'networkidle2' }); await sleep(1500);
  for (const nivel of [6, 7]) {
    await p.evaluate(nivel => {
      localStorage.setItem('dnd_guest', '1');
      const l = Characters.buildLursey(); l.nivel = nivel; l.classes[0].level = nivel; l.xp = nivel === 7 ? 23000 : 14000; delete l.choices; Storage.saveChar(l);
      Storage.setActiveId(l.id); sessionStorage.setItem('dnd_playing', '1');
    }, nivel);
    await p.goto(URL_BASE + '/app.html', { waitUntil: 'networkidle2' }); await sleep(2000);
    await p.evaluate(nivel => { const c = Storage.getChar('lursey-brumaclara'); c.nivel = nivel; c.classes[0].level = nivel; c.xp = nivel === 7 ? 23000 : 14000; Storage.saveCharRaw(c); App.reloadChar(c); }, nivel);
    await p.reload({ waitUntil: 'networkidle2' }); await sleep(2500);
    console.log('Lursey nv' + nivel, JSON.stringify(await p.evaluate(() => {
      const c = Storage.getChar('lursey-brumaclara');
      return { nivel: c.nivel, nf: c.features.length, potent: !!c.features.find(f => f.id === 'lursey-potent-spellcasting'), choice: c.choices && c.choices['blessed-strikes'],
        pasivos: Characters.getPassiveDamageBonuses(c, 'weapon').map(b => b.label), servirse: (c.features.find(f => f.id === 'servirse-poder-divino') || {}).source };
    })));
  }
  await p.evaluate(() => { window.__c = []; navigator.clipboard.writeText = async t => window.__c.push(t); });
  const cantrips = await p.evaluate(() => {
    const c = Storage.getChar('lursey-brumaclara');
    return c.spells.filter(s => s.level === 0).map(s => ({ id: s.id, name: s.name, dmg: s.damage, desc: (s.desc||'').slice(0,60), mi: s.mi }));
  });
  console.log(JSON.stringify(cantrips));
  for (const cp of cantrips) await p.evaluate(id => App.copiarRoll20('conjuro', id), cp.id);
  await sleep(300);
  console.log((await p.evaluate(() => window.__c)).join('\n'));
  console.log(await p.evaluate(() => [...document.querySelectorAll('.tag-quick[style*=gold]')].map(e => e.querySelector('.t-full') ? e.querySelector('.t-full').textContent + ' / ' + e.querySelector('.t-short').textContent : e.textContent).join(' | ')));
  await browser.close();
})();
