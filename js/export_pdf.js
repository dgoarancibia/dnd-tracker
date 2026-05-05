/* ═══════════════════════════════════════════════════════
   export_pdf.js — Genera la character sheet PDF en el browser
   Usa pdf-lib (cargado via CDN en app.html)
   Todos los campos se llenan por nombre — sin coordenadas XY.
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

  // ── Helpers seguros ───────────────────────────────────────────────────────
  function _set(form, name, value) {
    try {
      form.getTextField(name).setText(String(value ?? ''));
    } catch (_) {}
  }

  function _check(form, name, checked) {
    try {
      const cb = form.getCheckBox(name);
      if (checked) cb.check(); else cb.uncheck();
    } catch (_) {}
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
    _set(form, 'Text Box 1', char.name || '');
    _set(form, 'Text Box 2', char.trasfondo || '');
    _set(form, 'Text Box 3', char.clase || '');
    _set(form, 'Text Box 4', char.raza || '');
    _set(form, 'Text Box 5', char.subclase || '');
    _set(form, 'Level',      String(nivel));
    _set(form, 'XP',         String(char.xp || 0));

    // ── CA / HP / Hit Dice ───────────────────────────────────────────────
    const caTotal = Characters ? Characters.calcCA(char) : (char.armor?.base_ca || 10);
    _set(form, 'AC',            String(caTotal));
    _set(form, 'Current HP',    String(char.hp?.current || 0));
    _set(form, 'Max HP',        String(char.hp?.max     || 0));
    _set(form, 'Temp HP',       String(char.hp?.temp    || 0));
    const hitDie = char.hitDie || 8;
    const hdCur  = char.hitDice?.current ?? nivel;
    _set(form, 'Hit Dice Spent', `${hdCur}d${hitDie}`);
    _set(form, 'Hit Dice Max',   String(nivel));

    // ── Prof / Speed / Init / Passive Perc ───────────────────────────────
    _set(form, 'Prof Bonus',         `+${prof}`);
    _set(form, 'Speed',              `${char.velocidad || 30} ft`);
    _set(form, 'Text Box 59',        fmt(mod(stats.des || 10)));  // Initiative
    _set(form, 'Passive Perception',
      String(10 + mod(stats.sab || 10) + (skP.includes('percepcion') ? prof : 0)));

    // ── Stats scores ─────────────────────────────────────────────────────
    _set(form, 'Numeric Field 3', String(stats.for || 10));  // STR
    _set(form, 'Numeric Field 4', String(stats.des || 10));  // DEX
    _set(form, 'Numeric Field 6', String(stats.con || 10));  // CON
    _set(form, 'Numeric Field 2', String(stats.int || 10));  // INT
    _set(form, 'Numeric Field 5', String(stats.sab || 10));  // WIS
    _set(form, 'Numeric Field 7', String(stats.car || 10));  // CHA

    // ── Stats modifiers ───────────────────────────────────────────────────
    _set(form, 'Strength Mod', fmt(mod(stats.for || 10)));  // STR mod
    _set(form, 'Text Box 27',  fmt(mod(stats.des || 10)));  // DEX mod
    _set(form, 'Text Box 34',  fmt(mod(stats.con || 10)));  // CON mod
    _set(form, 'Text Box 6',   fmt(mod(stats.int || 10)));  // INT mod
    _set(form, 'Text Box 20',  fmt(mod(stats.sab || 10)));  // WIS mod
    _set(form, 'Text Box 28',  fmt(mod(stats.car || 10)));  // CHA mod — usa Text Box 28 no Text Box 33

    // ── Saving Throws ─────────────────────────────────────────────────────
    _set(form, 'Text Box 13', fmt(calcSave('for', stats, svP, prof)));  // STR save
    _set(form, 'Text Box 14', fmt(calcSave('des', stats, svP, prof)));  // DEX save
    _set(form, 'Text Box 19', fmt(calcSave('con', stats, svP, prof)));  // CON save
    _set(form, 'Text Box 7',  fmt(calcSave('int', stats, svP, prof)));  // INT save
    _set(form, 'Text Box 26', fmt(calcSave('sab', stats, svP, prof)));  // WIS save
    _set(form, 'Text Box 28', fmt(calcSave('car', stats, svP, prof)));  // CHA save

    // Saving throw proficiency checkboxes
    _check(form, 'Check Box 8',  svP.includes('for'));
    _check(form, 'Check Box 9',  svP.includes('des'));
    _check(form, 'Check Box 13', svP.includes('con'));
    _check(form, 'Check Box 14', svP.includes('int'));
    _check(form, 'Int Saving Throw Proficiency', svP.includes('int'));
    _check(form, 'Check Box 17', svP.includes('sab'));
    _check(form, 'Check Box 24', svP.includes('car'));

    // ── Skills ────────────────────────────────────────────────────────────
    _set(form, 'Text Box 15', fmt(calcSkill('atletismo',        stats, skP, skE, prof)));
    _set(form, 'Text Box 16', fmt(calcSkill('acrobacia',        stats, skP, skE, prof)));
    _set(form, 'Text Box 17', fmt(calcSkill('prestidigitacion', stats, skP, skE, prof)));
    _set(form, 'Text Box 18', fmt(calcSkill('sigilo',           stats, skP, skE, prof)));
    _set(form, 'Text Box 19', fmt(calcSkill('atletismo',        stats, skP, skE, prof)));  // backup
    _set(form, 'Text Box 8',  fmt(calcSkill('arcana',           stats, skP, skE, prof)));
    _set(form, 'Text Box 9',  fmt(calcSkill('historia',         stats, skP, skE, prof)));
    _set(form, 'Text Box 12', fmt(calcSkill('investigacion',    stats, skP, skE, prof)));
    _set(form, 'Text Box 10', fmt(calcSkill('naturaleza',       stats, skP, skE, prof)));
    _set(form, 'Text Box 11', fmt(calcSkill('religion',         stats, skP, skE, prof)));
    _set(form, 'Text Box 21', fmt(calcSkill('trato-animales',   stats, skP, skE, prof)));
    _set(form, 'Text Box 22', fmt(calcSkill('perspicacia',      stats, skP, skE, prof)));
    _set(form, 'Text Box 23', fmt(calcSkill('medicina',         stats, skP, skE, prof)));
    _set(form, 'Text Box 24', fmt(calcSkill('supervivencia',    stats, skP, skE, prof)));
    _set(form, 'Text Box 25', fmt(calcSkill('percepcion',       stats, skP, skE, prof)));
    _set(form, 'Text Box 29', fmt(calcSkill('engano',           stats, skP, skE, prof)));
    _set(form, 'Text Box 30', fmt(calcSkill('intimidacion',     stats, skP, skE, prof)));
    _set(form, 'Text Box 31', fmt(calcSkill('interpretacion',   stats, skP, skE, prof)));
    _set(form, 'Text Box 32', fmt(calcSkill('actuacion',        stats, skP, skE, prof)));
    _set(form, 'Text Box 33', fmt(calcSkill('persuasion',       stats, skP, skE, prof)));

    // Skill proficiency checkboxes
    _check(form, 'Check Box 15',              skP.includes('atletismo'));
    _check(form, 'Check Box 16',              skP.includes('acrobacia'));
    _check(form, 'Check Box 1',               skP.includes('historia'));
    _check(form, 'History Proficiency',       skP.includes('historia'));
    _check(form, 'Check Box 10',              skP.includes('religion'));
    _check(form, 'Religion Proficiency',      skP.includes('religion'));
    _check(form, 'Arcana Proficiency',        skP.includes('arcana'));
    _check(form, 'Investigation Proficiency', skP.includes('investigacion'));
    _check(form, 'Nature Proficiency',        skP.includes('naturaleza'));
    _check(form, 'Check Box 18',              skP.includes('perspicacia'));
    _check(form, 'Check Box 19',              skP.includes('medicina'));
    _check(form, 'Check Box 20',              skP.includes('perspicacia'));
    _check(form, 'Check Box 21',              skP.includes('percepcion'));
    _check(form, 'Check Box 22',              skP.includes('supervivencia'));
    _check(form, 'Check Box 23',              skP.includes('sigilo'));
    _check(form, 'Check Box 25',              skP.includes('engano'));
    _check(form, 'Check Box 26',              skP.includes('intimidacion'));
    _check(form, 'Check Box 27',              skP.includes('persuasion'));
    _check(form, 'Check Box 28',              skP.includes('prestidigitacion'));
    _check(form, 'Inspiration',               !!char.inspiration);

    // ── Weapons ───────────────────────────────────────────────────────────
    const weapons = char.weapons || [];
    const wNameF  = ['Text Box 35','Text Box 36','Text Box 37','Text Box 38','Text Box 39','Text Box 40'];
    const wNoteF  = ['Text Box 41','Text Box 42','Text Box 43','Text Box 44','Text Box 45','Text Box 46'];
    const wDmgF   = ['Text Box 47','Text Box 48','Text Box 49','Text Box 50','Text Box 51','Text Box 52'];
    const wBonF   = ['Text Box 53','Text Box 54','Text Box 55','Text Box 56','Text Box 57','Text Box 58'];
    for (let i = 0; i < 6; i++) {
      const w = weapons[i] || {};
      _set(form, wNameF[i], w.name  || '');
      _set(form, wNoteF[i], w.notes || w.type || '');
      _set(form, wDmgF[i],  w.die   || '');
      _set(form, wBonF[i],  w.bonus || '');
    }

    // ── Weapon/Tool profs ─────────────────────────────────────────────────
    _set(form, 'Weapon Profs', (char.weaponProfs || []).join(', ') || 'Armas simples, armas marciales');
    _set(form, 'Tool Profs',   char.toolProfs || '');

    // ── Armor ─────────────────────────────────────────────────────────────
    const armorName = (char.armor?.name || '').toLowerCase();
    _check(form, 'Medium Armor', /cota|malla|escamas/.test(armorName));

    // ── Class Features ────────────────────────────────────────────────────
    const features  = char.features || [];
    const featLines = features.map(f => {
      if (typeof f !== 'object') return String(f);
      const name = f.name || '';
      const src  = f.source || '';
      const desc = f.desc || '';
      if (desc) return `${name}${src ? ' ('+src+')' : ''}: ${desc}`;
      if (src)  return `${name} — ${src}`;
      return name;
    });
    _set(form, 'Class Features 1', featLines.slice(0, 6).join('\n'));

    const resources  = char.resources || [];
    const resLines   = resources.map(r =>
      typeof r === 'object' ? `${r.name}: ${r.current}/${r.max}  ${r.note || ''}` : String(r)
    );
    let f2 = featLines.slice(6).join('\n');
    if (resLines.length) f2 += (f2 ? '\n\n' : '') + 'RECURSOS\n' + resLines.join('\n');
    _set(form, 'Class Features 2', f2);

    // ── Species Traits ────────────────────────────────────────────────────
    const traitsText = typeof char.speciesTraits === 'object'
      ? Object.entries(char.speciesTraits).map(([k, v]) => `${k}: ${v}`).join('\n')
      : (char.speciesTraits || '');
    _set(form, 'Species Traits', traitsText);

    // ── Feats ─────────────────────────────────────────────────────────────
    _set(form, 'Feats', (char.feats || []).map(f =>
      typeof f === 'object' ? (f.desc ? `${f.name}: ${f.desc}` : f.name) : String(f)
    ).join('\n'));

    // ── Languages ─────────────────────────────────────────────────────────
    _set(form, 'Languages Field', (char.languages || []).join(', ') || 'Común, Enano');

    // ── Size ──────────────────────────────────────────────────────────────
    _set(form, 'Size Field', char.size || 'Mediano');

    // ── Backstory / Personality ───────────────────────────────────────────
    _set(form, 'Alignment Box', char.alignment || '');
    const backParts = [];
    if (char.deity) backParts.push(`Deidad: ${char.deity}`);
    if (char.notes) backParts.push(char.notes);
    _set(form, 'Backstory and Personality Field', backParts.join('\n'));
    _set(form, 'Text2', backParts.join('\n'));  // fallback

    // ── Equipment ─────────────────────────────────────────────────────────
    const equipLines = (char.consumables || []).map(item => {
      const qty = item.qty || 1;
      return qty > 1 ? `×${qty} ${item.name}` : item.name;
    });
    _set(form, 'Equipment Box', equipLines.join('\n'));
    _set(form, 'Text5', equipLines.join('\n'));  // fallback

    // ── Magic Items ───────────────────────────────────────────────────────
    const magicItems = (char.magicItems || []).filter(m => m.slot !== 'body');
    for (let i = 0; i < 3; i++) {
      const m = magicItems[i];
      _set(form, `Magic Item ${i + 1}`, m ? m.name : '');
      _check(form, `Magic Item ${i + 1} Attunement`, m ? !!m.attunement : false);
    }

    // ── Monedas ───────────────────────────────────────────────────────────
    const cur = char.currency || {};
    _set(form, 'Copper Coins',   String(cur.cp || 0));
    _set(form, 'Silver Coins',   String(cur.sp || 0));
    _set(form, 'Electrum Coins', String(cur.ep || 0));
    _set(form, 'Gold Coins',     String(cur.gp || 0));
    _set(form, 'Platinum Coins', String(cur.pp || 0));
    // Campos Coinage.N (duplicados en algunas páginas)
    _set(form, 'Coinage.0', String(cur.cp || 0));
    _set(form, 'Coinage.1', String(cur.sp || 0));
    _set(form, 'Coinage.2', String(cur.ep || 0));
    _set(form, 'Coinage.3', String(cur.gp || 0));
    _set(form, 'Coinage.4', String(cur.pp || 0));

    // ── Spellcasting ──────────────────────────────────────────────────────
    const spStatKey = char.spellcastingStat || 'sab';
    const spMod     = mod(stats[spStatKey] || 10);
    const spDc      = 8 + prof + spMod;
    const spAtk     = prof + spMod;
    // Spellcasting.0 = mod, .1 = DC, .2 = ataque
    _set(form, 'Spellcasting.0', fmt(spMod));
    _set(form, 'Spellcasting.1', String(spDc));
    _set(form, 'Spellcasting.2', fmt(spAtk));

    // ── Spell Slots — checkboxes por nivel ────────────────────────────────
    // Spell Slot N.0, N.1, N.2 = casillas de slot (marcar las usadas)
    const spellSlots = char.spellSlots || {};
    function slotMax(lvl) {
      const s = spellSlots[String(lvl)] || spellSlots[lvl] || {};
      return typeof s === 'object' ? (s.max || 0) : (Number(s) || 0);
    }
    function slotCur(lvl) {
      const s = spellSlots[String(lvl)] || spellSlots[lvl] || {};
      return typeof s === 'object' ? (s.current ?? slotMax(lvl)) : slotMax(lvl);
    }
    // Spell Level.N.0/1/2 = texto de slots por nivel (total/usado)
    for (let lvl = 1; lvl <= 3; lvl++) {
      const mx = slotMax(lvl);
      const cu = slotCur(lvl);
      _set(form, `Spell Level.${lvl - 1}.0`, mx > 0 ? String(mx)  : '');
      _set(form, `Spell Level.${lvl - 1}.1`, mx > 0 ? String(cu)  : '');
      _set(form, `Spell Level.${lvl - 1}.2`, mx > 0 ? String(mx - cu) : '');
    }
    // Marcar checkboxes de slots usados (Spell Slot N.0 = primer slot, etc.)
    for (let lvl = 1; lvl <= 9; lvl++) {
      const mx   = slotMax(lvl);
      const used = slotMax(lvl) - slotCur(lvl);
      // Hasta 3 checkboxes por nivel (el template tiene .0, .1, .2 hasta nivel 5)
      for (let s = 0; s < 3; s++) {
        const name = lvl <= 7 ? `Spell Slot ${lvl}.${s}` : `Spell Slot ${lvl}`;
        _check(form, name, s < used);
      }
    }

    // ── Hechizos ──────────────────────────────────────────────────────────
    // El template tiene dos grupos de campos:
    //   Cantrips: Spell 1 Name ... Spell 11 Name  (y Spell 5 Name aparte)
    //   Hechizos: Spell Name.0 ... Spell Name.4.24.1
    //             Spell's Level.0 ... .29
    //             Spell Casting Time.0 ... .29
    //             Spell Notes.0 ... .29
    //   También: Spell 1 Level ... Spell 31 Level (niveles alternativos)

    const spells   = char.spells || [];
    const prepared = new Set(char.preparedToday || []);
    const isPrepared = sp => prepared.has(sp.id) || (sp.prepared === true);

    const cantrips = spells.filter(s => (s.level || 0) === 0);
    const leveled  = spells.filter(s => (s.level || 0) > 0 && isPrepared(s))
                           .sort((a, b) => (a.level || 0) - (b.level || 0));

    // Cantrips → Spell 1 Name ... Spell 4 Name (primeros 4)
    const cantripNames = ['Spell 1 Name','Spell 2 Name','Spell 3 Name','Spell 4 Name',
                          'Spell 5 Name','Spell 6 Name','Spell 7 Name','Spell 8 Name',
                          'Spell 9 Name','Spell 10 Name','Spell 11 Name'];
    cantrips.slice(0, 11).forEach((sp, i) => {
      _set(form, cantripNames[i], sp.name || '');
    });

    // Hechizos nivelados → Spell Name.0 ... Spell Name.4.24.1 (26 slots)
    // Spell's Level.N = nivel del hechizo
    // Spell Casting Time.N = tiempo de lanzamiento
    // Spell Notes.N = notas / rango / duración
    const spellNameFields = [
      'Spell Name.0','Spell Name.1','Spell Name.2','Spell Name.3',
      'Spell Name.4.0','Spell Name.4.1','Spell Name.4.2','Spell Name.4.3',
      'Spell Name.4.4','Spell Name.4.5','Spell Name.4.6','Spell Name.4.7',
      'Spell Name.4.8','Spell Name.4.9','Spell Name.4.10','Spell Name.4.11',
      'Spell Name.4.12','Spell Name.4.13','Spell Name.4.14','Spell Name.4.15',
      'Spell Name.4.16','Spell Name.4.17','Spell Name.4.18','Spell Name.4.19',
      'Spell Name.4.20','Spell Name.4.21','Spell Name.4.22','Spell Name.4.23',
      'Spell Name.4.24.0','Spell Name.4.24.1',
    ];

    leveled.slice(0, 30).forEach((sp, i) => {
      _set(form, spellNameFields[i] || `Spell Name.4.${i}`, sp.name || '');
      _set(form, `Spell's Level.${i}`,      String(sp.level || ''));
      _set(form, `Spell Casting Time.${i}`, sp.castTime || sp.castingTime || sp.action || '');
      const notes = [sp.range || '', sp.duration || '', sp.desc || ''].filter(Boolean).join(' · ');
      _set(form, `Spell Notes.${i}`, notes.slice(0, 60));
      // También Spell N Level (campos alternativos)
      _set(form, `Spell ${i + 1} Level`, String(sp.level || ''));
    });

    // Spell 1 Notes (solo hay uno en el template)
    if (leveled[0]) {
      _set(form, 'Spell 1 Notes', leveled[0].desc || '');
    }

    // ── Borrar AP streams y activar NeedAppearances ───────────────────────
    const pN = PDFLib.PDFName.of.bind(PDFLib.PDFName);
    for (const page of pdfDoc.getPages()) {
      let annotsArr = null;
      try {
        const raw = page.node.get(pN('Annots'));
        if (raw) annotsArr = pdfDoc.context.lookup(raw);
      } catch (_) {}
      if (!annotsArr || typeof annotsArr.size !== 'function') continue;
      for (let i = 0; i < annotsArr.size(); i++) {
        try {
          const ref   = annotsArr.lookup(i);
          const annot = pdfDoc.context.lookup(ref);
          if (annot && typeof annot.delete === 'function') annot.delete(pN('AP'));
        } catch (_) {}
      }
    }
    try {
      const acroFormRaw = pdfDoc.catalog.get(pN('AcroForm'));
      if (acroFormRaw) {
        const acroForm = pdfDoc.context.lookup(acroFormRaw);
        if (acroForm?.set) acroForm.set(pN('NeedAppearances'), PDFLib.PDFBool.True);
      }
    } catch (_) {}

    return await pdfDoc.save({ updateFieldAppearances: false });
  }

  // ── Descarga el PDF en el browser ────────────────────────────────────────
  async function downloadPDF(char) {
    let bytes;
    try {
      bytes = await generate(char);
    } catch (e) {
      alert('❌ Error generando PDF:\n' + e.message);
      console.error('[PDF] generate() error:', e);
      throw e;
    }

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
