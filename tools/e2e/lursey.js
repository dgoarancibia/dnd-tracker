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
  const r = await p.evaluate(() => {
    const out = {};
    for (const nv of [1, 2, 3]) {
      const f = Characters.SUBCLASES_CONFIG['Dominio de la Paz'].features(nv).map(x => x.id);
      const cf = Characters.CLASE_FEATURES['Clérigo'].features(nv).map(x => x.id).filter(x => /channel/.test(x));
      const rs = Characters.SUBCLASES_CONFIG['Dominio de la Paz'].resources(nv).map(x => x.id + ':' + x.max);
      out['nv' + nv] = { paz: f, cdClase: cf, recursos: rs };
    }
    out.eleccionSub = Characters.CHOICES_CONFIG['Clérigo'].find(x => x.id === 'subclase-1').level;
    const div = { clase: 'Clérigo', nivel: 7, choices: { 'blessed-strikes': 'bs-divine-strike' } };
    out.divine = Characters.getPassiveDamageBonuses(div, 'weapon').map(b => b.label + ' ' + b.dice + ' ' + b.damageType);
    out.divineSpell = Characters.getPassiveDamageBonuses(div, 'spell').length;
    return out;
  });
  console.log(JSON.stringify(r, null, 0));
  await browser.close();
})();
