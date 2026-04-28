/* ═══════════════════════════════════════════════════════
   export_pdf.js — Genera la character sheet PDF en el browser
   Usa pdf-lib (cargado via CDN en app.html)
   ═══════════════════════════════════════════════════════ */

const ExportPDF = (() => {

  const TEMPLATE_URL = './CharacterSheet_template.pdf';

  // ── Helpers ──────────────────────────────────────────────────────────────
  function mod(s)       { return Math.floor((s - 10) / 2); }
  function fmt(n)       { return (n >= 0 ? '+' : '') + n; }
  function profBonus(n) { return Math.ceil(n / 4) + 1; }

  const SKILL_STAT = {
    acrobacia: 'des', sigilo: 'des', prestidigitacion: 'des',
    atletismo: 'for',
    arcana: 'int', historia: 'int', investigacion: 'int',
    naturaleza: 'int', religion: 'int',
    perspicacia: 'sab', medicina: 'sab', percepcion: 'sab',
    supervivencia: 'sab', 'trato-animales': 'sab',
    interpretacion: 'car', engano: 'car', intimidacion: 'car',
    actuacion: 'car', persuasion: 'car',
  };

  function calcSkill(skId, stats, skP, skE, prof) {
    const stat  = SKILL_STAT[skId] || 'int';
    const isExp = skE.includes(skId);
    const isP   = skP.includes(skId) || isExp;
    const mult  = isExp ? 2 : isP ? 1 : 0;
    return mod(stats[stat] || 10) + prof * mult;
  }

  function calcSave(statKey, stats, svP, prof) {
    return mod(stats[statKey] || 10) + (svP.includes(statKey) ? prof : 0);
  }

  // ── Carga y cachea el PDF template ───────────────────────────────────────
  let _templateCache = null;

  async function _loadTemplate() {
    if (_templateCache) return _templateCache;
    const resp = await fetch(TEMPLATE_URL);
    if (!resp.ok) throw new Error('No se pudo descargar la plantilla PDF: ' + TEMPLATE_URL);
    _templateCache = await resp.arrayBuffer();
    return _templateCache;
  }

  // ── API de alto nivel: setText seguro ─────────────────────────────────────
  function _setText(form, name, value) {
    try { form.getTextField(name).setText(String(value ?? '')); } catch (_) {}
  }

  function _setCheck(form, name, checked) {
    try {
      const cb = form.getCheckBox(name);
      if (checked) cb.check(); else cb.uncheck();
    } catch (_) {}
  }

  // ── Loop de anotaciones — solo para campos posicionales ──────────────────
  // Itera todas las anotaciones de todas las páginas y aplica valores
  // basados en coordenadas XY. Usado para hechizos, slots y monedas.
  // xyEntries: [{ t, xMin, xMax, yMin, yMax, value }]
  async function _fillByXY(pdfDoc, xyEntries) {
    if (!xyEntries || !xyEntries.length) return;

    const pages = pdfDoc.getPages();
    for (const page of pages) {
      // Obtener array de anotaciones — puede ser PDFRef o PDFArray directa
      let annotsArr = null;
      try {
        const raw = page.node.get(PDFLib.PDFName.of('Annots'));
        if (!raw) continue;
        // context.lookup funciona tanto en PDFRef como en PDFArray
        annotsArr = pdfDoc.context.lookup(raw);
      } catch (_) { continue; }
      if (!annotsArr || typeof annotsArr.size !== 'function') continue;

      for (let i = 0; i < annotsArr.size(); i++) {
        let annot;
        try {
          const ref = annotsArr.lookup(i);
          annot = pdfDoc.context.lookup(ref);
        } catch (_) { continue; }
        if (!annot || typeof annot.get !== 'function') continue;

        // Nombre del campo (/T)
        let t = '';
        try {
          const tObj = annot.get(PDFLib.PDFName.of('T'));
          if (tObj) t = tObj.decodeText ? tObj.decodeText() : tObj.toString().replace(/^[(]|[)]$/g, '');
        } catch (_) {}

        // Tipo de campo (/FT)
        let ft = '';
        try {
          const ftObj = annot.get(PDFLib.PDFName.of('FT'));
          if (ftObj) ft = ftObj.toString();
        } catch (_) {}

        // Posición (/Rect) — necesitamos xMin (ax) e yMin (ay)
        let ax = -1, ay = -1;
        try {
          const rectRaw = annot.get(PDFLib.PDFName.of('Rect'));
          if (rectRaw) {
            const rect = pdfDoc.context.lookup(rectRaw);
            if (rect && typeof rect.lookup === 'function') {
              ax = rect.lookup(0).asNumber();
              ay = rect.lookup(1).asNumber();
            }
          }
        } catch (_) {}
        if (ax < 0) continue;

        // Buscar si alguna entrada XY coincide
        for (const e of xyEntries) {
          if (e.t !== t) continue;
          if (ax < e.xMin || ax > e.xMax) continue;
          if (ay < e.yMin || ay > e.yMax) continue;

          // Aplicar valor
          try {
            if (ft === '/Btn') {
              const onVal = e.value === '/Yes' || e.value === 'Yes' || e.value === 'true';
              const v = PDFLib.PDFName.of(onVal ? 'Yes' : 'Off');
              annot.set(PDFLib.PDFName.of('V'),  v);
              annot.set(PDFLib.PDFName.of('AS'), v);
            } else {
              annot.set(PDFLib.PDFName.of('V'), PDFLib.PDFString.of(String(e.value ?? '')));
              annot.delete(PDFLib.PDFName.of('AP'));
            }
          } catch (_) {}
          break;
        }
      }
    }
  }

  // ── Función principal ─────────────────────────────────────────────────────
  async function generate(char) {
    if (typeof PDFLib === 'undefined') {
      throw new Error('pdf-lib no está cargado. Revisa la conexión a internet.');
    }

    const templateBytes = await _loadTemplate();
    const pdfDoc = await PDFLib.PDFDocument.load(templateBytes.slice(0), { ignoreEncryption: true });
    const form   = pdfDoc.getForm();

    const nivel  = char.nivel || 1;
    const prof   = profBonus(nivel);
    const stats  = char.stats || {};
    const skP    = char.skillProfs || [];
    const skE    = char.skillExpertise || [];
    const svP    = char.savingThrows || [];

    // ── Cabecera ─────────────────────────────────────────────────────────
    _setText(form, 'Text Box 1', char.name || '');
    _setText(form, 'Text Box 2', char.trasfondo || '');
    _setText(form, 'Text Box 3', char.clase || '');
    _setText(form, 'Text Box 4', char.raza || '');
    _setText(form, 'Text Box 5', char.subclase || '');
    _setText(form, 'Level',      String(nivel));
    _setText(form, 'XP',         String(char.xp || 0));

    // ── CA ───────────────────────────────────────────────────────────────
    const armor  = char.armor || {};
    const baseCa = armor.base_ca || 10;
    const dexAdd = armor.add_dex ? mod(stats.des || 10) : 0;
    const shield = armor.shield  ? (armor.shield_bonus || 2) : 0;
    _setText(form, 'AC', String(baseCa + dexAdd + shield));

    // ── HP ───────────────────────────────────────────────────────────────
    const hp = char.hp || {};
    _setText(form, 'Current HP', String(hp.current || 0));
    _setText(form, 'Max HP',     String(hp.max || 0));
    _setText(form, 'Temp HP',    String(hp.temp || 0));

    // ── Hit Dice ─────────────────────────────────────────────────────────
    const hd     = char.hitDice || {};
    const hitDie = char.hitDie  || 8;
    _setText(form, 'Hit Dice Spent', `${hd.current || nivel}d${hitDie}`);
    _setText(form, 'Hit Dice Max',   String(nivel));

    // ── Prof / Speed / Init / Passive Perc ───────────────────────────────
    _setText(form, 'Prof Bonus',         `+${prof}`);
    _setText(form, 'Speed',              `${char.velocidad || 30} ft`);
    _setText(form, 'Passive Perception', String(10 + mod(stats.sab || 10) + (skP.includes('percepcion') ? prof : 0)));
    _setText(form, 'Text Box 59',        fmt(mod(stats.des || 10))); // Initiative

    // ── Stats scores ─────────────────────────────────────────────────────
    _setText(form, 'Numeric Field 2', String(stats.int || 10));  // INT
    _setText(form, 'Numeric Field 3', String(stats.for || 10));  // STR
    _setText(form, 'Numeric Field 4', String(stats.des || 10));  // DEX
    _setText(form, 'Numeric Field 5', String(stats.sab || 10));  // WIS
    _setText(form, 'Numeric Field 6', String(stats.con || 10));  // CON
    _setText(form, 'Numeric Field 7', String(stats.car || 10));  // CHA

    // ── Stats modifiers ───────────────────────────────────────────────────
    _setText(form, 'Text Box 6',   fmt(mod(stats.int || 10)));  // INT mod
    _setText(form, 'Strength Mod', fmt(mod(stats.for || 10)));  // STR mod
    _setText(form, 'Text Box 20',  fmt(mod(stats.sab || 10)));  // WIS mod
    _setText(form, 'Text Box 27',  fmt(mod(stats.des || 10)));  // DEX mod
    _setText(form, 'Text Box 34',  fmt(mod(stats.con || 10)));  // CON mod

    // ── Saving Throws ─────────────────────────────────────────────────────
    _setText(form, 'Text Box 13', fmt(calcSave('for', stats, svP, prof)));
    _setText(form, 'Text Box 14', fmt(calcSave('des', stats, svP, prof)));
    _setText(form, 'Text Box 19', fmt(calcSave('con', stats, svP, prof)));
    _setText(form, 'Text Box 7',  fmt(calcSave('int', stats, svP, prof)));
    _setText(form, 'Text Box 26', fmt(calcSave('sab', stats, svP, prof)));
    _setText(form, 'Text Box 28', fmt(calcSave('car', stats, svP, prof)));

    // ── Skills ────────────────────────────────────────────────────────────
    _setText(form, 'Text Box 15', fmt(calcSkill('atletismo',        stats, skP, skE, prof)));
    _setText(form, 'Text Box 16', fmt(calcSkill('acrobacia',        stats, skP, skE, prof)));
    _setText(form, 'Text Box 17', fmt(calcSkill('prestidigitacion', stats, skP, skE, prof)));
    _setText(form, 'Text Box 18', fmt(calcSkill('sigilo',           stats, skP, skE, prof)));
    _setText(form, 'Text Box 8',  fmt(calcSkill('arcana',           stats, skP, skE, prof)));
    _setText(form, 'Text Box 9',  fmt(calcSkill('historia',         stats, skP, skE, prof)));
    _setText(form, 'Text Box 12', fmt(calcSkill('investigacion',    stats, skP, skE, prof)));
    _setText(form, 'Text Box 10', fmt(calcSkill('naturaleza',       stats, skP, skE, prof)));
    _setText(form, 'Text Box 11', fmt(calcSkill('religion',         stats, skP, skE, prof)));
    _setText(form, 'Text Box 21', fmt(calcSkill('trato-animales',   stats, skP, skE, prof)));
    _setText(form, 'Text Box 22', fmt(calcSkill('perspicacia',      stats, skP, skE, prof)));
    _setText(form, 'Text Box 23', fmt(calcSkill('medicina',         stats, skP, skE, prof)));
    _setText(form, 'Text Box 24', fmt(calcSkill('supervivencia',    stats, skP, skE, prof)));
    _setText(form, 'Text Box 25', fmt(calcSkill('percepcion',       stats, skP, skE, prof)));
    _setText(form, 'Text Box 29', fmt(calcSkill('engano',           stats, skP, skE, prof)));
    _setText(form, 'Text Box 30', fmt(calcSkill('intimidacion',     stats, skP, skE, prof)));
    _setText(form, 'Text Box 31', fmt(calcSkill('interpretacion',   stats, skP, skE, prof)));
    _setText(form, 'Text Box 32', fmt(calcSkill('actuacion',        stats, skP, skE, prof)));
    _setText(form, 'Text Box 33', fmt(calcSkill('persuasion',       stats, skP, skE, prof)));

    // ── Proficiency checkboxes ────────────────────────────────────────────
    _setCheck(form, 'History Proficiency',          skP.includes('historia'));
    _setCheck(form, 'Religion Proficiency',         skP.includes('religion'));
    _setCheck(form, 'Arcana Proficiency',           skP.includes('arcana'));
    _setCheck(form, 'Investigation Proficiency',    skP.includes('investigacion'));
    _setCheck(form, 'Nature Proficiency',           skP.includes('naturaleza'));
    _setCheck(form, 'Int Saving Throw Proficiency', svP.includes('int'));
    _setCheck(form, 'Inspiration',                  !!char.inspiration);
    _setCheck(form, 'Check Box 1',  skP.includes('historia'));
    _setCheck(form, 'Check Box 10', skP.includes('religion'));
    _setCheck(form, 'Check Box 20', skP.includes('perspicacia'));
    _setCheck(form, 'Check Box 17', svP.includes('sab'));
    _setCheck(form, 'Check Box 24', svP.includes('car'));
    _setCheck(form, 'Check Box 27', skP.includes('persuasion'));

    // ── Armor ─────────────────────────────────────────────────────────────
    _setCheck(form, 'Medium Armor', /cota|malla|escamas/.test((armor.name || '').toLowerCase()));

    // ── Weapons ───────────────────────────────────────────────────────────
    const weapons  = char.weapons || [];
    const nameFs   = ['Text Box 35','Text Box 36','Text Box 37','Text Box 38','Text Box 39','Text Box 40'];
    const bonusFs  = ['Text Box 53','Text Box 54','Text Box 55','Text Box 56','Text Box 57','Text Box 58'];
    const dmgFs    = ['Text Box 47','Text Box 48','Text Box 49','Text Box 50','Text Box 51','Text Box 52'];
    const noteFs   = ['Text Box 41','Text Box 42','Text Box 43','Text Box 44','Text Box 45','Text Box 46'];
    for (let i = 0; i < 6; i++) {
      const w = weapons[i] || {};
      _setText(form, nameFs[i],  w.name  || '');
      _setText(form, bonusFs[i], w.bonus || '');
      _setText(form, dmgFs[i],   w.die   || '');
      _setText(form, noteFs[i],  w.notes || '');
    }

    // ── Weapon profs / Tool profs ─────────────────────────────────────────
    _setText(form, 'Weapon Profs', (char.weaponProfs || []).join(', ') || 'Armas simples, armas marciales');
    _setText(form, 'Tool Profs',   char.toolProfs || '');

    // ── Class Features ────────────────────────────────────────────────────
    const features  = char.features || [];
    const featLines = features.map(f => {
      if (typeof f === 'object') {
        const name = f.name || '';
        const src  = f.source || '';
        const desc = f.desc || '';
        if (desc) return `${name} (${src}): ${desc}`;
        if (src)  return `${name} — ${src}`;
        return name;
      }
      return String(f);
    });
    _setText(form, 'Class Features 1', featLines.slice(0, 6).join('\n'));

    // Resources en Class Features 2
    const resources = char.resources || [];
    const resLines  = resources.map(r => {
      if (typeof r === 'object') return `${r.name}: ${r.current}/${r.max}  ${r.note || ''}`;
      return String(r);
    });
    let f2 = featLines.slice(6).join('\n');
    if (resLines.length) f2 += (f2 ? '\n\n' : '') + 'RECURSOS\n' + resLines.join('\n');
    _setText(form, 'Class Features 2', f2);

    // ── Species Traits ────────────────────────────────────────────────────
    _setText(form, 'Species Traits', char.speciesTraits ||
      'Resistencia enana · Visión en la penumbra 18 m · Comp. armas enanas · Resistencia a venenos');

    // ── Feats ─────────────────────────────────────────────────────────────
    _setText(form, 'Feats', (char.feats || []).map(f =>
      typeof f === 'object' ? (f.desc ? `${f.name}: ${f.desc}` : f.name) : String(f)
    ).join('\n'));

    // ── Languages ────────────────────────────────────────────────────────
    _setText(form, 'Languages Field', (char.languages || []).join(', ') || 'Común, Enano');

    // ── Size ─────────────────────────────────────────────────────────────
    _setText(form, 'Size Field', char.size || 'Mediano');

    // ── Backstory → Text2 ────────────────────────────────────────────────
    const backParts = [];
    if (char.deity)     backParts.push(`Deidad: ${char.deity}`);
    if (char.alignment) backParts.push(`Alineamiento: ${char.alignment}`);
    if (char.notes)     backParts.push(char.notes);
    _setText(form, 'Text2', backParts.join('\n'));

    // ── Equipment → Text5 ────────────────────────────────────────────────
    _setText(form, 'Text5', [...(char.consumables || []), ...(char.magicItems || [])].map(item => {
      if (typeof item === 'object') {
        const qty = item.qty || 1;
        return qty > 1 ? `×${qty} ${item.name}` : item.name;
      }
      return String(item);
    }).join('\n'));

    // ── Spellcasting stats ────────────────────────────────────────────────
    const spStatKey = char.spellcastingStat || 'sab';
    const spMod     = mod(stats[spStatKey] || 10);
    const spDc      = 8 + prof + spMod;
    const spAtk     = prof + spMod;

    // ── Campos posicionales (XY) — hechizos, slots, monedas, spellcasting ─
    // Estos campos tienen nombres duplicados o sin nombre; se identifican por posición.
    const xy = [];

    // Spellcasting Mod / DC / Atk (campos t='0','1','2' en x≈23)
    xy.push({ t: '0', xMin: 19, xMax: 50, yMin: 715, yMax: 745, value: fmt(spMod) });
    xy.push({ t: '1', xMin: 19, xMax: 50, yMin: 687, yMax: 715, value: String(spDc)  });
    xy.push({ t: '2', xMin: 19, xMax: 50, yMin: 659, yMax: 687, value: fmt(spAtk) });

    // Spell Slots (t='0' en x≈187, filas 1-3)
    const spellSlots = char.spellSlots || {};
    function slotVal(lvl) {
      const s = spellSlots[String(lvl)] || spellSlots[lvl] || {};
      return typeof s === 'object' ? (s.max || 0) : (Number(s) || 0);
    }
    const slotRows = [
      { yMin: 690, yMax: 706, lvl: 1 },
      { yMin: 675, yMax: 691, lvl: 2 },
      { yMin: 661, yMax: 677, lvl: 3 },
    ];
    for (const s of slotRows) {
      const v = slotVal(s.lvl);
      xy.push({ t: '0', xMin: 183, xMax: 205, yMin: s.yMin, yMax: s.yMax, value: v > 0 ? String(v) : '' });
    }

    // Hechizos (30 filas)
    const spellRowsNombre = [596,576,556,536,516,496,476,457,436,417,397,377,358,338,318,298,278,259,239,219,199,179,158,139,119,99,80,60,41,21];
    const spellRowsNivel  = [595,576,556,536,517,497,477,457,437,417,397,377,358,338,317,297,278,258,239,219,200,180,159,139,119,99,79,60,40,20];
    const spellRowsCast   = [595,575,556,536,516,497,477,457,437,417,397,377,358,338,319,299,280,258,238,218,199,179,158,139,119,99,80,60,41,21];
    const spellRowsNotas  = [595,576,555,536,515,496,476,457,436,417,397,377,357,338,319,298,278,258,239,219,199,179,159,139,120,99,80,61,40,20];

    const spells   = char.spells || [];
    const prepared = new Set(char.preparedToday || []);
    const isPrepared = s => prepared.has(s.id) || (s.name||'').includes('◆') || (s.name||'').includes('†');
    const cantrips  = spells.filter(s => (s.level || 0) === 0);
    const leveled   = spells.filter(s => (s.level || 0) > 0 && isPrepared(s))
                            .sort((a, b) => (a.level||0) - (b.level||0));
    const allSpells = [...cantrips, ...leveled];

    allSpells.slice(0, 30).forEach((sp, i) => {
      // Nombre: cantrips (i<4) → t='0'-'3'; niveles (i≥4) → reinicia en t='0'
      const nameT = i < 4 ? String(i) : String(i - 4);
      const yn  = spellRowsNombre[i];
      const ynv = spellRowsNivel[i];
      const yc  = spellRowsCast[i];
      const yn2 = spellRowsNotas[i];
      const ct  = sp.castTime || sp.castingTime || sp.action || '';

      xy.push({ t: nameT,     xMin:  42, xMax: 157, yMin: yn  - 5, yMax: yn  + 15, value: sp.name || '' });
      xy.push({ t: String(i), xMin:  20, xMax:  42, yMin: ynv - 5, yMax: ynv + 15, value: (sp.level||0) > 0 ? String(sp.level) : '' });
      xy.push({ t: String(i), xMin: 156, xMax: 238, yMin: yc  - 5, yMax: yc  + 15, value: ct });
      xy.push({ t: String(i), xMin: 307, xMax: 400, yMin: yn2 - 5, yMax: yn2 + 15, value: sp.range || '' });
    });

    // Monedas (campos t='' sin nombre en página 2)
    const cur = char.currency || {};
    xy.push({ t: '', xMin: 202, xMax: 212, yMin: 692, yMax: 704, value: String(cur.cp || 0) });
    xy.push({ t: '', xMin: 291, xMax: 301, yMin: 692, yMax: 704, value: String(cur.sp || 0) });
    xy.push({ t: '', xMin: 371, xMax: 381, yMin: 692, yMax: 704, value: '' });
    xy.push({ t: '', xMin: 202, xMax: 212, yMin: 677, yMax: 690, value: String(cur.gp || 0) });
    xy.push({ t: '', xMin: 291, xMax: 301, yMin: 677, yMax: 690, value: String(cur.pp || 0) });
    xy.push({ t: '', xMin: 371, xMax: 381, yMin: 677, yMax: 690, value: '' });

    await _fillByXY(pdfDoc, xy);

    // ── NeedAppearances — fuerza re-render de todos los campos ────────────
    try {
      form.acroForm.set(PDFLib.PDFName.of('NeedAppearances'), PDFLib.PDFBool.True);
    } catch (_) {}

    return await pdfDoc.save({ updateFieldAppearances: false });
  }

  // ── Descarga el PDF en el browser ────────────────────────────────────────
  async function downloadPDF(char) {
    const bytes    = await generate(char);
    const blob     = new Blob([bytes], { type: 'application/pdf' });
    const url      = URL.createObjectURL(blob);
    const a        = document.createElement('a');
    const safeName = (char.name || 'personaje').replace(/[^a-zA-Z0-9_\-áéíóúñ ]/g, '').replace(/\s+/g, '_');
    a.href         = url;
    a.download     = `${safeName}_lvl${char.nivel || 1}_sheet.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return { generate, downloadPDF };
})();
