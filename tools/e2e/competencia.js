// Un arma sin competencia no suma el BC al ataque; Lursey (Divine Order Protector) sí.
const puppeteer = require('puppeteer-core');
const { CHROME, URL_BASE } = require('./entorno');
const sleep = ms => new Promise(r => setTimeout(r, ms));
let ok = true; const chk = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) ok = false; };
(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new' });
  const p = await browser.newPage();
  p.on('pageerror', e => console.log('ERROR:', e.message));
  await p.goto(URL_BASE + '/index.html', { waitUntil: 'networkidle2' }); await sleep(1200);
  const r = await p.evaluate(() => {
    const l = Characters.buildLursey();
    const k = Characters.buildLursey(); delete k.choices['divine-order'];
    const pic = Characters.createNew('P', 'Pícaro');
    const arma = n => ({ id: '', name: n, kind: 'weapon' });
    return {
      lursey: Characters.calcArma(l, 'mainHand'), sinOrden: Characters.calcArma(k, 'mainHand'),
      picaro: ['Rapier', 'Longsword', 'Espada larga', 'Daga'].map(n => Characters.competenteConArma(pic, arma(n))),
    };
  });
  chk(!r.lursey.sinCompetencia && r.lursey.prof > 0, 'Lursey (Protector) suma BC con la Maza de Guerra');
  chk(r.sinOrden.sinCompetencia && r.sinOrden.ataque === r.lursey.ataque - r.lursey.prof, `sin Protector no suma BC (${r.lursey.ataque} → ${r.sinOrden.ataque})`);
  chk(JSON.stringify(r.picaro) === '[true,false,false,true]', 'Pícaro: estoque y daga sí, espada larga no');
  console.log(ok ? '\nTODO OK' : '\nHAY FALLAS');
  await browser.close();
  process.exit(ok ? 0 : 1);
})();
