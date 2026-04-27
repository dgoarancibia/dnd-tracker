/* ═══════════════════════════════════════════════════════
   export_pdf.js — Genera la character sheet PDF en el browser
   Usa pdf-lib (cargado via CDN en app.html)
   Llena los mismos campos que export_to_pdf.py
   ═══════════════════════════════════════════════════════ */

const ExportPDF = (() => {

  const TEMPLATE_URL = './DnD_2024_Character-Sheet.pdf';

  // ── helpers ──────────────────────────────────────────────────────────────
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
    if (!resp.ok) throw new Error('No se pudo descargar la plantilla PDF');
    _templateCache = await resp.arrayBuffer();
    return _templateCache;
  }

  // ── Helpers de pdf-lib ────────────────────────────────────────────────────

  function _setField(form, name, value) {
    try {
      const field = form.getTextField(name);
      field.setText(String(value ?? ''));
    } catch (_) { /* campo no encontrado — ignorar */ }
  }

  function _setCheck(form, name, checked) {
    try {
      const field = form.getCheckBox(name);
      if (checked) field.check(); else field.uncheck();
    } catch (_) { /* ignorar */ }
  }

  // ── Llenar campos por posición XY usando anotaciones crudas ──────────────
  // pdf-lib no expone campos duplicados por nombre, necesitamos iterar
  // las anotaciones directamente para los campos con nombre repetido ('0','1'...)
  async function _fillByPosition(pdfDoc, xyEntries) {
    // xyEntries: [{ fieldName, xMin, xMax, yMin, yMax, value }]
    const pages = pdfDoc.getPages();
    for (const page of pages) {
      const annots = page.node.lookupMaybe(
        PDFLib.PDFName.of('Annots'), PDFLib.PDFArray
      );
      if (!annots) continue;

      for (let i = 0; i < annots.size(); i++) {
        const annotRef = annots.lookup(i);
        const annot    = annotRef instanceof PDFLib.PDFDict
          ? annotRef
          : pdfDoc.context.lookup(annotRef);
        if (!annot) continue;

        const tObj  = annot.lookupMaybe(PDFLib.PDFName.of('T'));
        const t     = tObj ? tObj.decodeText() : '';
        const rect  = annot.lookupMaybe(PDFLib.PDFName.of('Rect'), PDFLib.PDFArray);
        if (!rect) continue;

        let ax, ay;
        try {
          ax = rect.lookup(0).asNumber();
          ay = rect.lookup(1).asNumber();
        } catch (_) { continue; }

        for (const entry of xyEntries) {
          if (
            t === entry.fieldName &&
            ax >= entry.xMin && ax <= entry.xMax &&
            ay >= entry.yMin && ay <= entry.yMax
          ) {
            // Setear /V
            annot.set(
              PDFLib.PDFName.of('V'),
              PDFLib.PDFString.of(String(entry.value ?? ''))
            );
            // Limpiar /AP para forzar re-render
            annot.delete(PDFLib.PDFName.of('AP'));
            break;
          }
        }
      }
    }
  }

  // ── Función principal ─────────────────────────────────────────────────────
  async function generate(char) {
    if (typeof PDFLib === 'undefined') {
      throw new Error('pdf-lib no está cargado');
    }

    const templateBytes = await _loadTemplate();
    // Hacemos una copia para no mutar el cache
    const pdfBytes = templateBytes.slice(0);
    const pdfDoc   = await PDFLib.PDFDocument.load(pdfBytes, { ignoreEncryption: true });
    const form     = pdfDoc.getForm();

    const nivel  = char.nivel || 1;
    const prof   = profBonus(nivel);
    const stats  = char.stats || {};
    const skP    = char.skillProfs || [];
    const skE    = char.skillExpertise || [];
    const svP    = char.savingThrows || [];

    // ── Cabecera ─────────────────────────────────────────────────────────
    _setField(form, 'Text Box 1', char.name || '');
    _setField(form, 'Text Box 2', char.trasfondo || '');
    _setField(form, 'Text Box 3', char.clase || '');
    _setField(form, 'Text Box 4', char.raza || '');
    _setField(form, 'Text Box 5', char.subclase || '');
    _setField(form, 'Level',      String(nivel));
    _setField(form, 'XP',         String(char.xp || 0));

    // ── CA ───────────────────────────────────────────────────────────────
    const armor  = char.armor || {};
    const baseCa = armor.base_ca || 10;
    const dexAdd = armor.add_dex ? mod(stats.des || 10) : 0;
    const shield = armor.shield  ? (armor.shield_bonus || 2) : 0;
    _setField(form, 'AC', String(baseCa + dexAdd + shield));

    // ── HP ───────────────────────────────────────────────────────────────
    const hp = char.hp || {};
    _setField(form, 'Current HP', String(hp.current || 0));
    _setField(form, 'Max HP',     String(hp.max || 0));
    _setField(form, 'Temp HP',    String(hp.temp || 0));

    // ── Hit Dice ─────────────────────────────────────────────────────────
    const hd     = char.hitDice || {};
    const hitDie = char.hitDie  || 8;
    _setField(form, 'Hit Dice Spent', `${hd.current || nivel}d${hitDie}`);
    _setField(form, 'Hit Dice Max',   String(nivel));

    // ── Prof / Speed / Init / Passive Perc ───────────────────────────────
    _setField(form, 'Prof Bonus',         `+${prof}`);
    _setField(form, 'Speed',              `${char.velocidad || 30} ft`);
    _setField(form, 'Passive Perception', String(10 + mod(stats.sab || 10) + (skP.includes('percepcion') ? prof : 0)));
    _setField(form, 'Text Box 59',        fmt(mod(stats.des || 10))); // Initiative

    // ── Stats scores ─────────────────────────────────────────────────────
    _setField(form, 'Numeric Field 2', String(stats.int || 10));
    _setField(form, 'Numeric Field 3', String(stats.for || 10));
    _setField(form, 'Numeric Field 4', String(stats.des || 10));
    _setField(form, 'Numeric Field 5', String(stats.sab || 10));
    _setField(form, 'Numeric Field 6', String(stats.con || 10));
    _setField(form, 'Numeric Field 7', String(stats.car || 10));

    // ── Stats modifiers ───────────────────────────────────────────────────
    _setField(form, 'Text Box 6',   fmt(mod(stats.int || 10)));  // INT mod
    _setField(form, 'Strength Mod', fmt(mod(stats.for || 10)));  // STR mod
    _setField(form, 'Text Box 20',  fmt(mod(stats.sab || 10)));  // WIS mod
    _setField(form, 'Text Box 27',  fmt(mod(stats.des || 10)));  // DEX mod
    _setField(form, 'Text Box 34',  fmt(mod(stats.con || 10)));  // CON mod

    // ── Saving Throws ─────────────────────────────────────────────────────
    _setField(form, 'Text Box 13', fmt(calcSave('for', stats, svP, prof)));
    _setField(form, 'Text Box 14', fmt(calcSave('des', stats, svP, prof)));
    _setField(form, 'Text Box 19', fmt(calcSave('con', stats, svP, prof)));
    _setField(form, 'Text Box 7',  fmt(calcSave('int', stats, svP, prof)));
    _setField(form, 'Text Box 26', fmt(calcSave('sab', stats, svP, prof)));
    _setField(form, 'Text Box 28', fmt(calcSave('car', stats, svP, prof)));

    // ── Skills ────────────────────────────────────────────────────────────
    _setField(form, 'Text Box 15', fmt(calcSkill('atletismo',        stats, skP, skE, prof)));
    _setField(form, 'Text Box 16', fmt(calcSkill('acrobacia',        stats, skP, skE, prof)));
    _setField(form, 'Text Box 17', fmt(calcSkill('prestidigitacion', stats, skP, skE, prof)));
    _setField(form, 'Text Box 18', fmt(calcSkill('sigilo',           stats, skP, skE, prof)));
    _setField(form, 'Text Box 8',  fmt(calcSkill('arcana',           stats, skP, skE, prof)));
    _setField(form, 'Text Box 9',  fmt(calcSkill('historia',         stats, skP, skE, prof)));
    _setField(form, 'Text Box 12', fmt(calcSkill('investigacion',    stats, skP, skE, prof)));
    _setField(form, 'Text Box 10', fmt(calcSkill('naturaleza',       stats, skP, skE, prof)));
    _setField(form, 'Text Box 11', fmt(calcSkill('religion',         stats, skP, skE, prof)));
    _setField(form, 'Text Box 21', fmt(calcSkill('trato-animales',   stats, skP, skE, prof)));
    _setField(form, 'Text Box 22', fmt(calcSkill('perspicacia',      stats, skP, skE, prof)));
    _setField(form, 'Text Box 23', fmt(calcSkill('medicina',         stats, skP, skE, prof)));
    _setField(form, 'Text Box 24', fmt(calcSkill('supervivencia',    stats, skP, skE, prof)));
    _setField(form, 'Text Box 25', fmt(calcSkill('percepcion',       stats, skP, skE, prof)));
    _setField(form, 'Text Box 29', fmt(calcSkill('engano',           stats, skP, skE, prof)));
    _setField(form, 'Text Box 30', fmt(calcSkill('intimidacion',     stats, skP, skE, prof)));
    _setField(form, 'Text Box 31', fmt(calcSkill('interpretacion',   stats, skP, skE, prof)));
    _setField(form, 'Text Box 32', fmt(calcSkill('actuacion',        stats, skP, skE, prof)));
    _setField(form, 'Text Box 33', fmt(calcSkill('persuasion',       stats, skP, skE, prof)));

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
    const armorLower = (armor.name || '').toLowerCase();
    _setCheck(form, 'Medium Armor', /cota|malla|escamas/.test(armorLower));

    // ── Weapons ───────────────────────────────────────────────────────────
    const weapons    = char.weapons || [];
    const nameFs  = ['Text Box 35','Text Box 36','Text Box 37','Text Box 38','Text Box 39','Text Box 40'];
    const bonusFs = ['Text Box 53','Text Box 54','Text Box 55','Text Box 56','Text Box 57','Text Box 58'];
    const dmgFs   = ['Text Box 47','Text Box 48','Text Box 49','Text Box 50','Text Box 51','Text Box 52'];
    const noteFs  = ['Text Box 41','Text Box 42','Text Box 43','Text Box 44','Text Box 45','Text Box 46'];
    for (let i = 0; i < 6; i++) {
      const w = weapons[i] || {};
      _setField(form, nameFs[i],  w.name  || '');
      _setField(form, bonusFs[i], w.bonus || '');
      _setField(form, dmgFs[i],   w.die   || '');
      _setField(form, noteFs[i],  w.notes || '');
    }

    // ── Weapon profs / Tool profs ─────────────────────────────────────────
    _setField(form, 'Weapon Profs', (char.weaponProfs || []).join(', ') || 'Armas simples, armas marciales');
    _setField(form, 'Tool Profs',   char.toolProfs || '');

    // ── Class Features ────────────────────────────────────────────────────
    const features   = char.features || [];
    const featLines  = features.map(f => {
      if (typeof f === 'object') {
        return f.desc ? `${f.name} (${f.source}): ${f.desc}` : f.source ? `${f.name} — ${f.source}` : f.name;
      }
      return String(f);
    });
    _setField(form, 'Class Features 1', featLines.slice(0, 6).join('\n'));

    // Resources en Class Features 2
    const resources  = char.resources || [];
    const resLines   = resources.map(r =>
      `${r.name}: ${r.current}/${r.max}  ${r.note || ''}`
    );
    const f2Parts = [...featLines.slice(6)];
    if (resLines.length) f2Parts.push('', 'RECURSOS', ...resLines);
    _setField(form, 'Class Features 2', f2Parts.join('\n'));

    // ── Species Traits ────────────────────────────────────────────────────
    _setField(form, 'Species Traits', char.speciesTraits || '');

    // ── Feats ─────────────────────────────────────────────────────────────
    const feats = char.feats || [];
    _setField(form, 'Feats', feats.map(f =>
      typeof f === 'object' ? (f.desc ? `${f.name}: ${f.desc}` : f.name) : String(f)
    ).join('\n'));

    // ── Languages ────────────────────────────────────────────────────────
    _setField(form, 'Languages Field', (char.languages || []).join(', ') || 'Común');

    // ── Size ─────────────────────────────────────────────────────────────
    _setField(form, 'Size Field', char.size || 'Mediano');

    // ── Backstory / Notes ─────────────────────────────────────────────────
    const backParts = [];
    if (char.deity)     backParts.push(`Deidad: ${char.deity}`);
    if (char.alignment) backParts.push(`Alineamiento: ${char.alignment}`);
    if (char.notes)     backParts.push(char.notes);
    _setField(form, 'Text2', backParts.join('\n'));

    // ── Equipment ────────────────────────────────────────────────────────
    const eqLines = [...(char.consumables || []), ...(char.magicItems || [])].map(item => {
      if (typeof item === 'object') {
        const qty = item.qty || 1;
        return qty > 1 ? `×${qty} ${item.name}` : item.name;
      }
      return String(item);
    });
    _setField(form, 'Text5', eqLines.join('\n'));

    // ── Spellcasting stats ────────────────────────────────────────────────
    const spStatKey = char.spellcastingStat || 'sab';
    const spMod     = mod(stats[spStatKey] || 10);
    const spDc      = 8 + prof + spMod;
    const spAtk     = prof + spMod;

    // ── XY-positional fields (conjuros, slots, monedas, spellcasting) ────
    const xy = [];

    // Spellcasting ability (via xy_rename en Python, aquí via posición)
    xy.push({ fieldName: '0', xMin: 19, xMax: 50, yMin: 715, yMax: 745, value: fmt(spMod) });  // Mod
    xy.push({ fieldName: '1', xMin: 19, xMax: 50, yMin: 687, yMax: 715, value: String(spDc) }); // DC
    xy.push({ fieldName: '2', xMin: 19, xMax: 50, yMin: 659, yMax: 687, value: fmt(spAtk) });  // Atk

    // Spell slots (Nv1-3)
    const spellSlots = char.spellSlots || {};
    const slotMap = [
      { fieldName: '0', xMin: 183, xMax: 205, yMin: 690, yMax: 706, slotLvl: 1 },
      { fieldName: '0', xMin: 183, xMax: 205, yMin: 675, yMax: 691, slotLvl: 2 },
      { fieldName: '0', xMin: 183, xMax: 205, yMin: 661, yMax: 677, slotLvl: 3 },
    ];
    for (const s of slotMap) {
      const slot = spellSlots[s.slotLvl] || {};
      const maxV = typeof slot === 'object' ? (slot.max || 0) : (slot || 0);
      if (maxV > 0) xy.push({ ...s, value: String(maxV) });
    }

    // Spells (30 filas)
    const spellRowsNombre = [596,576,556,536,516,496,476,457,436,417,397,377,358,338,318,298,278,259,239,219,199,179,158,139,119,99,80,60,41,21];
    const spellRowsNivel  = [595,576,556,536,517,497,477,457,437,417,397,377,358,338,317,297,278,258,239,219,200,180,159,139,119,99,79,60,40,20];
    const spellRowsCast   = [595,575,556,536,516,497,477,457,437,417,397,377,358,338,319,299,280,258,238,218,199,179,158,139,119,99,80,60,41,21];
    const spellRowsNotas  = [595,576,555,536,515,496,476,457,436,417,397,377,357,338,319,298,278,258,239,219,199,179,159,139,120,99,80,61,40,20];

    const spells   = char.spells   || [];
    const prepared = new Set(char.preparedToday || []);
    const isPrepared = s => prepared.has(s.id) || (s.name || '').includes('◆') || (s.name || '').includes('†');

    const cantrips = spells.filter(s => (s.level || 0) === 0);
    const leveled  = spells
      .filter(s => (s.level || 0) > 0 && isPrepared(s))
      .sort((a, b) => (a.level || 0) - (b.level || 0));
    const allSpells = [...cantrips, ...leveled];

    allSpells.slice(0, 30).forEach((sp, i) => {
      const nameT = i < 4 ? String(i) : String(i - 4);  // grupo cantrip vs nivel (reinicia)
      const yn    = spellRowsNombre[i];
      const ynv   = spellRowsNivel[i];
      const yc    = spellRowsCast[i];
      const yn2   = spellRowsNotas[i];

      xy.push({ fieldName: nameT, xMin: 42,  xMax: 157, yMin: yn  - 5, yMax: yn  + 15, value: sp.name || '' });
      xy.push({ fieldName: String(i), xMin: 20, xMax: 42,  yMin: ynv - 5, yMax: ynv + 15, value: sp.level > 0 ? String(sp.level) : '' });
      xy.push({ fieldName: String(i), xMin: 156, xMax: 238, yMin: yc  - 5, yMax: yc  + 15, value: sp.castTime || '' });
      xy.push({ fieldName: String(i), xMin: 307, xMax: 400, yMin: yn2 - 5, yMax: yn2 + 15, value: sp.range    || '' });
    });

    // Monedas
    const cur = char.currency || {};
    xy.push({ fieldName: '', xMin: 202, xMax: 212, yMin: 692, yMax: 704, value: String(cur.cp || 0) });
    xy.push({ fieldName: '', xMin: 291, xMax: 301, yMin: 692, yMax: 704, value: String(cur.sp || 0) });
    xy.push({ fieldName: '', xMin: 202, xMax: 212, yMin: 677, yMax: 690, value: String(cur.gp || 0) });
    xy.push({ fieldName: '', xMin: 291, xMax: 301, yMin: 677, yMax: 690, value: String(cur.pp || 0) });

    await _fillByPosition(pdfDoc, xy);

    // NeedAppearances para que los visores re-rendericen los campos
    try {
      const acroForm = pdfDoc.catalog.lookupMaybe(
        PDFLib.PDFName.of('AcroForm'), PDFLib.PDFDict
      );
      if (acroForm) {
        acroForm.set(PDFLib.PDFName.of('NeedAppearances'), PDFLib.PDFBool.True);
      }
    } catch (_) {}

    const outBytes = await pdfDoc.save({ updateFieldAppearances: true });
    return outBytes;
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
