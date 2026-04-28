/* ═══════════════════════════════════════════════════════
   export_pdf.js — Genera la character sheet PDF en el browser
   Usa pdf-lib (cargado via CDN en app.html)
   Traducción fiel de tools/export_to_pdf.py
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

  // ── patch_fields — equivalente al Python ─────────────────────────────────
  // Recorre TODAS las anotaciones del PDF, limpia cada campo y luego:
  // 1) si hay entrada en xyValues que coincide por nombre+posición → usa ese valor
  // 2) si hay entrada en xyRename que coincide → renombra el /T y asigna valor
  // 3) si el nombre está en fieldValues → usa ese valor
  async function _patchFields(pdfDoc, fieldValues, xyValues, xyRename) {
    // xyValues : [{ t, xMin, xMax, yMin, yMax, value }]
    // xyRename : [{ t, xMin, xMax, yMin, yMax, newName, value }]
    xyValues = xyValues || [];
    xyRename = xyRename || [];

    const pages = pdfDoc.getPages();
    for (const page of pages) {
      const annotsRef = page.node.lookupMaybe(
        PDFLib.PDFName.of('Annots'), PDFLib.PDFArray
      );
      if (!annotsRef) continue;

      for (let i = 0; i < annotsRef.size(); i++) {
        const ref   = annotsRef.lookup(i);
        const annot = (ref instanceof PDFLib.PDFDict)
          ? ref
          : pdfDoc.context.lookup(ref);
        if (!annot || !(annot instanceof PDFLib.PDFDict)) continue;

        // Obtener nombre de campo (/T)
        const tObj = annot.lookupMaybe(PDFLib.PDFName.of('T'));
        let   t    = tObj ? (tObj.decodeText ? tObj.decodeText() : tObj.toString().replace(/[()]/g,'')) : '';

        // Obtener tipo de campo (/FT)
        const ftObj = annot.lookupMaybe(PDFLib.PDFName.of('FT'));
        const ft    = ftObj ? ftObj.toString() : '';

        // Obtener posición (/Rect)
        const rectArr = annot.lookupMaybe(PDFLib.PDFName.of('Rect'), PDFLib.PDFArray);
        let ax = 0, ay = 0;
        if (rectArr) {
          try {
            ax = rectArr.lookup(0).asNumber();
            ay = rectArr.lookup(1).asNumber();
          } catch (_) {}
        }

        // 0) Renombrar si coincide con xyRename
        for (const r of xyRename) {
          if (t === r.t && ax >= r.xMin && ax <= r.xMax && ay >= r.yMin && ay <= r.yMax) {
            annot.set(PDFLib.PDFName.of('T'), PDFLib.PDFString.of(r.newName));
            t = r.newName;
            xyValues = [...xyValues, { t: r.newName, xMin: r.xMin, xMax: r.xMax, yMin: r.yMin, yMax: r.yMax, value: r.value }];
            break;
          }
        }

        // 1) Limpiar campo
        if (ft || t) {
          if (ft === '/Btn') {
            annot.set(PDFLib.PDFName.of('V'),  PDFLib.PDFName.of('Off'));
            annot.set(PDFLib.PDFName.of('AS'), PDFLib.PDFName.of('Off'));
          } else {
            annot.set(PDFLib.PDFName.of('V'), PDFLib.PDFString.of(''));
            annot.delete(PDFLib.PDFName.of('AP'));
          }
        }

        // 2) Buscar por posición en xyValues
        let matchedVal = null;
        for (const xy of xyValues) {
          if (t === xy.t && ax >= xy.xMin && ax <= xy.xMax && ay >= xy.yMin && ay <= xy.yMax) {
            matchedVal = xy.value;
            break;
          }
        }

        // 3) Fallback a fieldValues por nombre
        if (matchedVal === null && t && t in fieldValues) {
          matchedVal = fieldValues[t];
        }

        // 4) Aplicar valor
        if (matchedVal !== null) {
          const valStr = String(matchedVal ?? '');
          if (ft === '/Btn') {
            const v = PDFLib.PDFName.of(valStr.startsWith('/') ? valStr.slice(1) : 'Off');
            annot.set(PDFLib.PDFName.of('V'),  v);
            annot.set(PDFLib.PDFName.of('AS'), v);
          } else {
            annot.set(PDFLib.PDFName.of('V'), PDFLib.PDFString.of(valStr));
            annot.delete(PDFLib.PDFName.of('AP'));
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
    const pdfDoc = await PDFLib.PDFDocument.load(templateBytes.slice(0), { ignoreEncryption: true });

    const nivel  = char.nivel || 1;
    const prof   = profBonus(nivel);
    const stats  = char.stats || {};
    const skP    = char.skillProfs || [];
    const skE    = char.skillExpertise || [];
    const svP    = char.savingThrows || [];

    const fv = {};  // field_values — campos por nombre
    const xy = [];  // xyValues — campos por posición
    const xyRename = []; // renombrar campos duplicados

    // ── Cabecera ─────────────────────────────────────────────────────────
    fv['Text Box 1'] = char.name || '';
    fv['Text Box 2'] = char.trasfondo || '';
    fv['Text Box 3'] = char.clase || '';
    fv['Text Box 4'] = char.raza || '';
    fv['Text Box 5'] = char.subclase || '';
    fv['Level']      = String(nivel);
    fv['XP']         = String(char.xp || 0);

    // ── CA ───────────────────────────────────────────────────────────────
    const armor  = char.armor || {};
    const baseCa = armor.base_ca || 10;
    const dexAdd = armor.add_dex ? mod(stats.des || 10) : 0;
    const shield = armor.shield  ? (armor.shield_bonus || 2) : 0;
    fv['AC'] = String(baseCa + dexAdd + shield);

    // ── HP ───────────────────────────────────────────────────────────────
    const hp = char.hp || {};
    fv['Current HP'] = String(hp.current || 0);
    fv['Max HP']     = String(hp.max || 0);
    fv['Temp HP']    = String(hp.temp || 0);

    // ── Hit Dice ─────────────────────────────────────────────────────────
    const hd     = char.hitDice || {};
    const hitDie = char.hitDie  || 8;
    fv['Hit Dice Spent'] = `${hd.current || nivel}d${hitDie}`;
    fv['Hit Dice Max']   = String(nivel);

    // ── Prof / Speed / Init / Passive Perc ───────────────────────────────
    fv['Prof Bonus']         = `+${prof}`;
    fv['Speed']              = `${char.velocidad || 30} ft`;
    fv['Passive Perception'] = String(10 + mod(stats.sab || 10) + (skP.includes('percepcion') ? prof : 0));
    fv['Text Box 59']        = fmt(mod(stats.des || 10)); // Initiative

    // ── Stats scores ─────────────────────────────────────────────────────
    fv['Numeric Field 2'] = String(stats.int || 10);  // INT
    fv['Numeric Field 3'] = String(stats.for || 10);  // STR
    fv['Numeric Field 4'] = String(stats.des || 10);  // DEX
    fv['Numeric Field 5'] = String(stats.sab || 10);  // WIS
    fv['Numeric Field 6'] = String(stats.con || 10);  // CON
    fv['Numeric Field 7'] = String(stats.car || 10);  // CHA

    // ── Stats modifiers ───────────────────────────────────────────────────
    fv['Text Box 6']   = fmt(mod(stats.int || 10));  // INT mod
    fv['Strength Mod'] = fmt(mod(stats.for || 10));  // STR mod
    fv['Text Box 20']  = fmt(mod(stats.sab || 10));  // WIS mod
    fv['Text Box 27']  = fmt(mod(stats.des || 10));  // DEX mod
    fv['Text Box 34']  = fmt(mod(stats.con || 10));  // CON mod
    fv['Text Box 28']  = fmt(mod(stats.car || 10));  // CHA mod (sobrescrito por save)

    // ── Saving Throws ─────────────────────────────────────────────────────
    fv['Text Box 13'] = fmt(calcSave('for', stats, svP, prof));
    fv['Text Box 14'] = fmt(calcSave('des', stats, svP, prof));
    fv['Text Box 19'] = fmt(calcSave('con', stats, svP, prof));
    fv['Text Box 7']  = fmt(calcSave('int', stats, svP, prof));
    fv['Text Box 26'] = fmt(calcSave('sab', stats, svP, prof));  // WIS save (sobrescribe mod)
    fv['Text Box 28'] = fmt(calcSave('car', stats, svP, prof));  // CHA save (sobrescribe mod)

    // ── Skills ────────────────────────────────────────────────────────────
    fv['Text Box 15'] = fmt(calcSkill('atletismo',        stats, skP, skE, prof));
    fv['Text Box 16'] = fmt(calcSkill('acrobacia',        stats, skP, skE, prof));
    fv['Text Box 17'] = fmt(calcSkill('prestidigitacion', stats, skP, skE, prof));
    fv['Text Box 18'] = fmt(calcSkill('sigilo',           stats, skP, skE, prof));
    fv['Text Box 8']  = fmt(calcSkill('arcana',           stats, skP, skE, prof));
    fv['Text Box 9']  = fmt(calcSkill('historia',         stats, skP, skE, prof));
    fv['Text Box 12'] = fmt(calcSkill('investigacion',    stats, skP, skE, prof));
    fv['Text Box 10'] = fmt(calcSkill('naturaleza',       stats, skP, skE, prof));
    fv['Text Box 11'] = fmt(calcSkill('religion',         stats, skP, skE, prof));
    fv['Text Box 21'] = fmt(calcSkill('trato-animales',   stats, skP, skE, prof));
    fv['Text Box 22'] = fmt(calcSkill('perspicacia',      stats, skP, skE, prof));
    fv['Text Box 23'] = fmt(calcSkill('medicina',         stats, skP, skE, prof));
    fv['Text Box 24'] = fmt(calcSkill('supervivencia',    stats, skP, skE, prof));
    fv['Text Box 25'] = fmt(calcSkill('percepcion',       stats, skP, skE, prof));
    fv['Text Box 29'] = fmt(calcSkill('engano',           stats, skP, skE, prof));
    fv['Text Box 30'] = fmt(calcSkill('intimidacion',     stats, skP, skE, prof));
    fv['Text Box 31'] = fmt(calcSkill('interpretacion',   stats, skP, skE, prof));
    fv['Text Box 32'] = fmt(calcSkill('actuacion',        stats, skP, skE, prof));
    fv['Text Box 33'] = fmt(calcSkill('persuasion',       stats, skP, skE, prof));

    // ── Proficiency checkboxes ────────────────────────────────────────────
    fv['History Proficiency']          = skP.includes('historia')      ? '/Yes' : '/Off';
    fv['Religion Proficiency']         = skP.includes('religion')      ? '/Yes' : '/Off';
    fv['Arcana Proficiency']           = skP.includes('arcana')        ? '/Yes' : '/Off';
    fv['Investigation Proficiency']    = skP.includes('investigacion') ? '/Yes' : '/Off';
    fv['Nature Proficiency']           = skP.includes('naturaleza')    ? '/Yes' : '/Off';
    fv['Int Saving Throw Proficiency'] = svP.includes('int')           ? '/Yes' : '/Off';
    fv['Inspiration']                  = char.inspiration              ? '/Yes' : '/Off';
    fv['Check Box 1']  = skP.includes('historia')   ? '/Yes' : '/Off';
    fv['Check Box 10'] = skP.includes('religion')   ? '/Yes' : '/Off';
    fv['Check Box 20'] = skP.includes('perspicacia') ? '/Yes' : '/Off';
    fv['Check Box 17'] = svP.includes('sab')        ? '/Yes' : '/Off';
    fv['Check Box 24'] = svP.includes('car')        ? '/Yes' : '/Off';
    fv['Check Box 27'] = skP.includes('persuasion') ? '/Yes' : '/Off';

    // ── Armor ─────────────────────────────────────────────────────────────
    const armorLower = (armor.name || '').toLowerCase();
    fv['Medium Armor'] = /cota|malla|escamas/.test(armorLower) ? '/Yes' : '/Off';

    // ── Weapons ───────────────────────────────────────────────────────────
    const weapons  = char.weapons || [];
    const nameFs   = ['Text Box 35','Text Box 36','Text Box 37','Text Box 38','Text Box 39','Text Box 40'];
    const bonusFs  = ['Text Box 53','Text Box 54','Text Box 55','Text Box 56','Text Box 57','Text Box 58'];
    const dmgFs    = ['Text Box 47','Text Box 48','Text Box 49','Text Box 50','Text Box 51','Text Box 52'];
    const noteFs   = ['Text Box 41','Text Box 42','Text Box 43','Text Box 44','Text Box 45','Text Box 46'];
    for (let i = 0; i < 6; i++) {
      const w = weapons[i] || {};
      fv[nameFs[i]]  = w.name  || '';
      fv[bonusFs[i]] = w.bonus || '';
      fv[dmgFs[i]]   = w.die   || '';
      fv[noteFs[i]]  = w.notes || '';
    }

    // ── Weapon profs / Tool profs ─────────────────────────────────────────
    fv['Weapon Profs'] = (char.weaponProfs || []).join(', ') || 'Armas simples, armas marciales';
    fv['Tool Profs']   = char.toolProfs || '';

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
    fv['Class Features 1'] = featLines.slice(0, 6).join('\n');
    fv['Class Features 2'] = featLines.slice(6).join('\n');

    // ── Species Traits ────────────────────────────────────────────────────
    fv['Species Traits'] = char.speciesTraits ||
      'Resistencia enana · Visión en la penumbra 18 m · Comp. armas enanas · Resistencia a venenos';

    // ── Feats ─────────────────────────────────────────────────────────────
    const feats = char.feats || [];
    fv['Feats'] = feats.map(f =>
      typeof f === 'object' ? (f.desc ? `${f.name}: ${f.desc}` : f.name) : String(f)
    ).join('\n');

    // ── Languages ────────────────────────────────────────────────────────
    const langs = char.languages || [];
    fv['Languages Field'] = langs.length ? langs.join(', ') : 'Común, Enano';

    // ── Backstory → Text2 ────────────────────────────────────────────────
    const backParts = [];
    if (char.deity)     backParts.push(`Deidad: ${char.deity}`);
    if (char.alignment) backParts.push(`Alineamiento: ${char.alignment}`);
    if (char.notes)     backParts.push(char.notes);
    fv['Text2'] = backParts.join('\n');

    // ── Equipment → Text5 ────────────────────────────────────────────────
    const eqLines = [...(char.consumables || []), ...(char.magicItems || [])].map(item => {
      if (typeof item === 'object') {
        const qty = item.qty || 1;
        return qty > 1 ? `×${qty} ${item.name}` : item.name;
      }
      return String(item);
    });
    fv['Text5'] = eqLines.join('\n');

    // ── Size ─────────────────────────────────────────────────────────────
    fv['Size Field'] = char.size || 'Mediano';

    // ── Resources en Class Features 2 ────────────────────────────────────
    const resources = char.resources || [];
    const resLines  = resources.map(r => {
      if (typeof r === 'object') {
        return `${r.name}: ${r.current}/${r.max}  ${r.note || ''}`;
      }
      return String(r);
    });
    if (resLines.length) {
      const existing = fv['Class Features 2'] || '';
      const sep = existing ? '\n\n' : '';
      fv['Class Features 2'] = existing + sep + 'RECURSOS\n' + resLines.join('\n');
    }

    // ── Spellcasting stats ────────────────────────────────────────────────
    const spStatKey = char.spellcastingStat || 'sab';
    const spMod     = mod(stats[spStatKey] || 10);
    const spDc      = 8 + prof + spMod;
    const spAtk     = prof + spMod;

    // ── Spellcasting ability — xy_rename (igual que Python) ──────────────
    // Los campos t='0','1','2' en x=23 y=720,691,663 son Spellcasting Mod/DC/Atk
    xyRename.push({ t: '0', xMin: 19, xMax: 50, yMin: 715, yMax: 745, newName: '__sp_mod__', value: fmt(spMod) });
    xyRename.push({ t: '1', xMin: 19, xMax: 50, yMin: 687, yMax: 715, newName: '__sp_dc__',  value: String(spDc) });
    xyRename.push({ t: '2', xMin: 19, xMax: 50, yMin: 659, yMax: 687, newName: '__sp_atk__', value: fmt(spAtk) });
    // Campos fantasma en x≈423-525 (limpiar también)
    xyRename.push({ t: '0', xMin: 419, xMax: 452, yMin: 50, yMax: 75, newName: '__sp_mod2__', value: '' });
    xyRename.push({ t: '1', xMin: 455, xMax: 490, yMin: 50, yMax: 75, newName: '__sp_dc2__',  value: '' });
    xyRename.push({ t: '2', xMin: 490, xMax: 525, yMin: 50, yMax: 75, newName: '__sp_atk2__', value: '' });

    // ── Spell Slots (niveles 1-3 en x≈187) ───────────────────────────────
    const spellSlots = char.spellSlots || {};
    function slotVal(lvl, field) {
      const s = spellSlots[String(lvl)] || spellSlots[lvl] || {};
      if (typeof s === 'object') return s[field] || 0;
      return Number(s) || 0;
    }
    const slotMap = [
      { t: '0', xMin: 183, xMax: 205, yMin: 690, yMax: 706, lvl: 1 },
      { t: '0', xMin: 183, xMax: 205, yMin: 675, yMax: 691, lvl: 2 },
      { t: '0', xMin: 183, xMax: 205, yMin: 661, yMax: 677, lvl: 3 },
    ];
    for (const s of slotMap) {
      const maxV = slotVal(s.lvl, 'max');
      if (maxV > 0) {
        xy.push({ t: s.t, xMin: s.xMin, xMax: s.xMax, yMin: s.yMin, yMax: s.yMax, value: String(maxV) });
      }
    }

    // ── Spells (30 filas) ─────────────────────────────────────────────────
    // Y exactas de cada fila (confirmadas del análisis de Lursey.pdf):
    const spellRowsNombre = [596,576,556,536,516,496,476,457,436,417,397,377,358,338,318,298,278,259,239,219,199,179,158,139,119,99,80,60,41,21];
    const spellRowsNivel  = [595,576,556,536,517,497,477,457,437,417,397,377,358,338,317,297,278,258,239,219,200,180,159,139,119,99,79,60,40,20];
    const spellRowsCast   = [595,575,556,536,516,497,477,457,437,417,397,377,358,338,319,299,280,258,238,218,199,179,158,139,119,99,80,60,41,21];
    const spellRowsNotas  = [595,576,555,536,515,496,476,457,436,417,397,377,357,338,319,298,278,258,239,219,199,179,159,139,120,99,80,61,40,20];

    const spells   = char.spells || [];
    const prepared = new Set(char.preparedToday || []);
    const isPrepared = s => prepared.has(s.id) || (s.name || '').includes('◆') || (s.name || '').includes('†');

    const cantrips  = spells.filter(s => (s.level || 0) === 0);
    const leveled   = spells
      .filter(s => (s.level || 0) > 0 && isPrepared(s))
      .sort((a, b) => (a.level || 0) - (b.level || 0));
    const allSpells = [...cantrips, ...leveled];

    allSpells.slice(0, 30).forEach((sp, i) => {
      // Nombre: grupo cantrip (i<4) → t='0'-'3'; grupo nivel (i≥4) → reinicia en '0'
      const nameT = i < 4 ? String(i) : String(i - 4);
      const yn    = spellRowsNombre[i];
      xy.push({ t: nameT, xMin: 42, xMax: 157, yMin: yn - 5, yMax: yn + 15, value: sp.name || '' });

      // Nivel: índice continuo '0'-'29'
      const ynv = spellRowsNivel[i];
      xy.push({ t: String(i), xMin: 20, xMax: 42, yMin: ynv - 5, yMax: ynv + 15,
        value: (sp.level || 0) > 0 ? String(sp.level) : '' });

      // Casting time: índice continuo
      const yc = spellRowsCast[i];
      const ct = sp.castTime || sp.castingTime || sp.action || '';
      xy.push({ t: String(i), xMin: 156, xMax: 238, yMin: yc - 5, yMax: yc + 15, value: ct });

      // Notas/rango: índice continuo
      const yn2 = spellRowsNotas[i];
      xy.push({ t: String(i), xMin: 307, xMax: 400, yMin: yn2 - 5, yMax: yn2 + 15, value: sp.range || '' });
    });

    // ── Monedas (campos sin nombre en página 2) ───────────────────────────
    const cur = char.currency || {};
    xy.push({ t: '', xMin: 202, xMax: 212, yMin: 692, yMax: 704, value: String(cur.cp || 0) }); // CP
    xy.push({ t: '', xMin: 291, xMax: 301, yMin: 692, yMax: 704, value: String(cur.sp || 0) }); // SP
    xy.push({ t: '', xMin: 371, xMax: 381, yMin: 692, yMax: 704, value: '' });                   // EP
    xy.push({ t: '', xMin: 202, xMax: 212, yMin: 677, yMax: 690, value: String(cur.gp || 0) }); // GP
    xy.push({ t: '', xMin: 291, xMax: 301, yMin: 677, yMax: 690, value: String(cur.pp || 0) }); // PP
    xy.push({ t: '', xMin: 371, xMax: 381, yMin: 677, yMax: 690, value: '' });
    xy.push({ t: '', xMin: 202, xMax: 212, yMin: 663, yMax: 675, value: '' });
    xy.push({ t: '', xMin: 291, xMax: 301, yMin: 663, yMax: 675, value: '' });
    xy.push({ t: '', xMin: 371, xMax: 381, yMin: 663, yMax: 675, value: '' });

    // ── Aplicar todos los cambios ─────────────────────────────────────────
    await _patchFields(pdfDoc, fv, xy, xyRename);

    // ── NeedAppearances ───────────────────────────────────────────────────
    try {
      const acroForm = pdfDoc.catalog.lookupMaybe(
        PDFLib.PDFName.of('AcroForm'), PDFLib.PDFDict
      );
      if (acroForm) {
        acroForm.set(PDFLib.PDFName.of('NeedAppearances'), PDFLib.PDFBool.True);
      }
    } catch (_) {}

    const outBytes = await pdfDoc.save({ updateFieldAppearances: false });
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
