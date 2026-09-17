/* ═══════════════════════════════════════════════════════
   export_resumen.js — Hoja resumen en PDF, generada desde cero.

   A diferencia de export_pdf.js, que rellena la plantilla oficial de
   D&D (13,7 MB y solo 11 espacios de conjuro), esta se dibuja con
   pdf-lib sin plantilla: pesa unos pocos KB y muestra TODO lo que el
   personaje tiene — habilidades con su cálculo, slots por nivel,
   conjuros preparados agrupados y recursos.

   Está pensada para entender la ficha de un vistazo, no para jugar
   escribiendo encima.
   ═══════════════════════════════════════════════════════ */

const ExportResumen = (() => {

  // Carta: 612 x 792 pt.
  const W = 612, H = 792;
  const M = 40;                       // margen
  const COL = (W - M * 2 - 18) / 2;   // ancho de columna (2 columnas)

  // Paleta sobria: se imprime bien en blanco y negro.
  const TINTA   = [0.13, 0.12, 0.11];
  const SUAVE   = [0.42, 0.40, 0.37];
  const ORO     = [0.55, 0.40, 0.12];
  const LINEA   = [0.78, 0.76, 0.72];
  const FONDO   = [0.96, 0.95, 0.93];

  const fmt = (n) => (n >= 0 ? '+' : '') + n;

  async function _init(doc) {
    const { StandardFonts } = PDFLib;
    return {
      reg:  await doc.embedFont(StandardFonts.Helvetica),
      bold: await doc.embedFont(StandardFonts.HelveticaBold),
      obl:  await doc.embedFont(StandardFonts.HelveticaOblique),
    };
  }

  /* ── Primitivas de dibujo ──────────────────────────────────────── */

  // Las fuentes estándar de PDF usan WinAnsi, que no codifica símbolos como
  // ◆ ■ † ni emoji. Los nombres de conjuros y rasgos vienen de los datos, así
  // que se limpian antes de dibujar: sin esto, un solo carácter raro hace
  // fallar la generación entera.
  function limpia(s) {
    return String(s == null ? '' : s)
      .normalize('NFC')
      .replace(/[\u2018\u2019]/g, "'")
      .replace(/[\u201C\u201D]/g, '"')
      .replace(/[\u2013\u2014]/g, '-')
      .replace(/\u2026/g, '...')
      .replace(/[^\x20-\x7E\xA0-\xFF]/g, '');
  }

  function txt(page, s, x, y, size, font, color) {
    page.drawText(limpia(s), {
      x, y, size, font, color: _rgb(color || TINTA),
    });
  }

  let _rgbFn = null;
  function _rgb(c) { return _rgbFn(c[0], c[1], c[2]); }

  // Corta el texto para que no se salga del ancho dado.
  function recorta(s, font, size, maxW) {
    s = limpia(s);
    if (font.widthOfTextAtSize(s, size) <= maxW) return s;
    while (s.length > 1 && font.widthOfTextAtSize(s + '…', size) > maxW) {
      s = s.slice(0, -1);
    }
    return s + '…';
  }

  // Parte un texto largo en líneas que entren en maxW.
  function envuelve(s, font, size, maxW) {
    const palabras = limpia(s).split(/\s+/);
    const lineas = [];
    let linea = '';
    for (const p of palabras) {
      const probar = linea ? linea + ' ' + p : p;
      if (font.widthOfTextAtSize(probar, size) <= maxW) linea = probar;
      else { if (linea) lineas.push(linea); linea = p; }
    }
    if (linea) lineas.push(linea);
    return lineas;
  }

  function titulo(page, s, x, y, f, ancho) {
    txt(page, s.toUpperCase(), x, y, 8.5, f.bold, ORO);
    page.drawLine({
      start: { x, y: y - 4 }, end: { x: x + ancho, y: y - 4 },
      thickness: 0.6, color: _rgb(LINEA),
    });
    return y - 15;
  }

  function caja(page, x, y, w, h) {
    page.drawRectangle({
      x, y, width: w, height: h,
      color: _rgb(FONDO), borderColor: _rgb(LINEA), borderWidth: 0.6,
    });
  }

  /* ── Secciones ─────────────────────────────────────────────────── */

  function cabecera(page, c, f, C) {
    let y = H - M;
    txt(page, c.name || c.nombre || 'Sin nombre', M, y - 16, 20, f.bold);
    y -= 32;
    const linea = [c.raza || c.especie, c.subraza, c.clase, c.subclase,
                   c.nivel ? 'Nivel ' + c.nivel : '', c.trasfondo]
      .filter(Boolean).join('  ·  ');
    txt(page, recorta(linea, f.reg, 9.5, W - M * 2), M, y, 9.5, f.reg, SUAVE);
    y -= 10;
    page.drawLine({
      start: { x: M, y }, end: { x: W - M, y },
      thickness: 1.2, color: _rgb(ORO),
    });
    return y - 20;
  }

  // Fila de características con su modificador — lo que más se consulta.
  function caracteristicas(page, c, f, C, y) {
    const stats = [['for', 'FUE'], ['des', 'DES'], ['con', 'CON'],
                   ['int', 'INT'], ['sab', 'SAB'], ['car', 'CAR']];
    const w = (W - M * 2 - 5 * 6) / 6;
    stats.forEach(([k, nom], i) => {
      const x = M + i * (w + 6);
      const v = (c.stats || {})[k];
      caja(page, x, y - 44, w, 44);
      const cx = x + w / 2;
      const cen = (s, size, font) => cx - font.widthOfTextAtSize(String(s), size) / 2;
      txt(page, nom, cen(nom, 7.5, f.bold), y - 12, 7.5, f.bold, SUAVE);
      const val = v != null ? String(v) : '—';
      txt(page, val, cen(val, 17, f.bold), y - 31, 17, f.bold);
      const m = v != null ? fmt(C.calcMod(v)) : '';
      txt(page, m, cen(m, 9, f.reg), y - 41, 9, f.reg, ORO);
    });
    return y - 58;
  }

  // Los números que se usan todo el tiempo en la mesa.
  function combate(page, c, f, C, y) {
    const datos = [
      ['CA', C.calcCA(c)],
      ['PG', `${(c.hp || {}).current ?? '—'}/${(c.hp || {}).max ?? '—'}`],
      ['Iniciativa', fmt(C.calcInit(c))],
      ['Velocidad', (c.velocidad || 30) + ' pies'],
      ['Competencia', fmt(C.calcProfBonus(c.nivel || 1))],
      ['Perc. pasiva', C.calcPercPasiva(c)],
    ];
    const w = (W - M * 2 - 5 * 6) / 6;
    datos.forEach(([nom, val], i) => {
      const x = M + i * (w + 6);
      caja(page, x, y - 32, w, 32);
      const cx = x + w / 2;
      const cen = (s, size, font) => cx - font.widthOfTextAtSize(String(s), size) / 2;
      const etiqueta = recorta(nom, f.reg, 6.5, w - 4);
      txt(page, etiqueta, cen(etiqueta, 6.5, f.reg), y - 11, 6.5, f.reg, SUAVE);
      const v = String(val);
      const size = v.length > 6 ? 9 : 12;
      txt(page, v, cen(v, size, f.bold), y - 26, size, f.bold);
    });
    return y - 46;
  }

  // Habilidades: marca con ● la competencia y con ◆ la pericia, y muestra
  // de qué característica sale cada una. Es lo que hace falta para saber
  // "¿con qué tiro esto?".
  function habilidades(page, c, f, C, x, y, ancho) {
    y = titulo(page, 'Habilidades', x, y, f, ancho);
    const profs = c.skillProfs || [];
    const exps  = c.skillExpertise || [];
    for (const sk of C.SKILLS_DEF) {
      const bono = C.calcSkill(c, sk.id);
      // WinAnsi (fuentes estándar) no codifica ○●◆, así que se usan
      // marcas ASCII: X pericia, x competencia, punto medio para el resto.
      const marca = exps.includes(sk.id) ? 'X' : (profs.includes(sk.id) ? 'x' : '-');
      const color = exps.includes(sk.id) ? ORO : (profs.includes(sk.id) ? TINTA : SUAVE);
      txt(page, marca, x, y, 7.5, f.reg, color);
      txt(page, sk.name, x + 11, y, 8, profs.includes(sk.id) ? f.bold : f.reg,
          profs.includes(sk.id) ? TINTA : SUAVE);
      const st = (C.STAT_NAMES || {})[sk.stat] || sk.stat.toUpperCase();
      txt(page, st, x + ancho - 46, y, 6.5, f.reg, SUAVE);
      const b = fmt(bono);
      txt(page, b, x + ancho - f.bold.widthOfTextAtSize(b, 8.5), y, 8.5, f.bold);
      y -= 12.2;
    }
    return y - 6;
  }

  function salvaciones(page, c, f, C, x, y, ancho) {
    y = titulo(page, 'Tiradas de salvación', x, y, f, ancho);
    const stats = [['for', 'Fuerza'], ['des', 'Destreza'], ['con', 'Constitución'],
                   ['int', 'Inteligencia'], ['sab', 'Sabiduría'], ['car', 'Carisma']];
    const profs = c.savingThrows || [];
    for (const [k, nom] of stats) {
      const tiene = profs.includes(k);
      txt(page, tiene ? 'x' : '-', x, y, 7.5, f.reg, tiene ? TINTA : SUAVE);
      txt(page, nom, x + 11, y, 8, tiene ? f.bold : f.reg, tiene ? TINTA : SUAVE);
      const b = fmt(C.calcSave(c, k));
      txt(page, b, x + ancho - f.bold.widthOfTextAtSize(b, 8.5), y, 8.5, f.bold);
      y -= 12.2;
    }
    return y - 6;
  }

  // Slots por nivel, que la hoja oficial muestra como casilleros sueltos.
  function slots(page, c, f, C, x, y, ancho) {
    const hay = [];
    for (let i = 1; i <= 9; i++) {
      const s = (c.spellSlots || {})[i];
      if (s && s.max > 0) hay.push([i, s.current != null ? s.current : s.max, s.max]);
    }
    if (!hay.length) return y;
    y = titulo(page, 'Espacios de conjuro', x, y, f, ancho);
    const w = (ancho - (hay.length - 1) * 4) / hay.length;
    hay.forEach(([nivel, cur, max], i) => {
      const bx = x + i * (w + 4);
      caja(page, bx, y - 26, w, 26);
      const cx = bx + w / 2;
      const cen = (s, size, font) => cx - font.widthOfTextAtSize(String(s), size) / 2;
      txt(page, 'N' + nivel, cen('N' + nivel, 6.5, f.reg), y - 9, 6.5, f.reg, SUAVE);
      const v = `${cur}/${max}`;
      txt(page, v, cen(v, 9.5, f.bold), y - 21, 9.5, f.bold);
    });
    return y - 38;
  }

  function recursos(page, c, f, C, x, y, ancho) {
    const res = (c.resources || []).filter(r => r.max > 0);
    if (!res.length) return y;
    y = titulo(page, 'Recursos', x, y, f, ancho);
    for (const r of res) {
      const nom = recorta(r.name || r.id, f.reg, 8, ancho - 40);
      txt(page, nom, x, y, 8, f.reg);
      const v = `${r.current != null ? r.current : r.max}/${r.max}`;
      txt(page, v, x + ancho - f.bold.widthOfTextAtSize(v, 8), y, 8, f.bold, ORO);
      y -= 12;
    }
    return y - 6;
  }

  // Conjuros agrupados por nivel, marcando los preparados. La hoja
  // oficial solo tiene 11 renglones; acá entran todos.
  function conjuros(page, c, f, C, x, y, ancho, doc) {
    const spells = c.spells || [];
    if (!spells.length) return { y, page };
    const prep = new Set(c.preparedToday || []);

    y = titulo(page, 'Conjuros', x, y, f, ancho);
    if (c.spellcastingStat) {
      const info = `CD ${C.calcCD(c)}  ·  Ataque ${fmt(C.calcAtaqueBonus(c))}  ·  ${(C.STAT_NAMES || {})[c.spellcastingStat] || ''}`;
      txt(page, info, x, y, 7.5, f.obl, SUAVE);
      y -= 13;
    }

    const porNivel = {};
    for (const sp of spells) (porNivel[sp.level || 0] = porNivel[sp.level || 0] || []).push(sp);

    for (const nivel of Object.keys(porNivel).map(Number).sort((a, b) => a - b)) {
      if (y < M + 40) {
        page = doc.addPage([W, H]);
        y = H - M;
      }
      const etiqueta = nivel === 0 ? 'Trucos' : 'Nivel ' + nivel;
      txt(page, etiqueta, x, y, 7.5, f.bold, SUAVE);
      y -= 11;
      for (const sp of porNivel[nivel].sort((a, b) => (a.name || '').localeCompare(b.name || ''))) {
        if (y < M + 20) {
          page = doc.addPage([W, H]);
          y = H - M;
        }
        // Los trucos siempre están disponibles; el resto se marca si está preparado.
        const activo = nivel === 0 || prep.has(sp.id) || sp.domain || sp.mi;
        txt(page, activo ? '*' : '-', x + 4, y, 7, f.reg, activo ? ORO : SUAVE);
        let nom = sp.name || '';
        if (sp.domain) nom += ' [Dom]';
        if (sp.mi) nom += ' [MI]';
        if (sp.concentration) nom += ' (C)';
        txt(page, recorta(nom, f.reg, 8, ancho - 18), x + 15, y, 8,
            activo ? f.reg : f.reg, activo ? TINTA : SUAVE);
        y -= 11;
      }
      y -= 3;
    }
    return { y, page };
  }

  function rasgos(page, c, f, C, x, y, ancho, doc) {
    const feats = (c.features || []).filter(ft => ft && ft.name);
    if (!feats.length) return { y, page };
    y = titulo(page, 'Rasgos y aptitudes', x, y, f, ancho);
    for (const ft of feats) {
      if (y < M + 30) { page = doc.addPage([W, H]); y = H - M; }
      txt(page, recorta(ft.name, f.bold, 8, ancho), x, y, 8, f.bold);
      y -= 10;
      if (ft.desc) {
        for (const ln of envuelve(ft.desc, f.reg, 7, ancho).slice(0, 3)) {
          if (y < M + 16) { page = doc.addPage([W, H]); y = H - M; }
          txt(page, ln, x + 6, y, 7, f.reg, SUAVE);
          y -= 8.6;
        }
      }
      y -= 4;
    }
    return { y, page };
  }

  function pie(page, f) {
    const s = 'Generado con D&D Tracker · ' + new Date().toLocaleDateString('es');
    txt(page, s, M, 22, 6.5, f.reg, SUAVE);
  }

  /* ── Generación ────────────────────────────────────────────────── */

  async function generate(char) {
    if (typeof PDFLib === 'undefined') throw new Error('pdf-lib no está cargado');
    const { PDFDocument, rgb } = PDFLib;
    _rgbFn = rgb;
    const C = Characters;

    const doc = await PDFDocument.create();
    doc.setTitle((char.name || 'Personaje') + ' — hoja resumen');
    const f = await _init(doc);

    let page = doc.addPage([W, H]);

    let y = cabecera(page, char, f, C);
    y = caracteristicas(page, char, f, C, y);
    y = combate(page, char, f, C, y);

    // Dos columnas: izquierda habilidades/salvaciones, derecha el resto.
    const xIzq = M, xDer = M + COL + 18;
    const yTop = y;

    let yI = habilidades(page, char, f, C, xIzq, yTop, COL);
    yI = salvaciones(page, char, f, C, xIzq, yI, COL);

    let yD = slots(page, char, f, C, xDer, yTop, COL);
    yD = recursos(page, char, f, C, xDer, yD, COL);

    // Los conjuros siguen en la columna más libre y desbordan de página
    // solos si hacen falta.
    const seguir = Math.min(yI, yD);
    let r = conjuros(page, char, f, C, xIzq, seguir - 8, W - M * 2, doc);
    r = rasgos(r.page, char, f, C, xIzq, r.y - 8, W - M * 2, doc);

    for (const p of doc.getPages()) pie(p, f);
    return await doc.save();
  }

  async function download(char) {
    const bytes = await generate(char);
    const blob = new Blob([bytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const safe = (char.name || 'personaje')
      .replace(/[^a-zA-Z0-9_\-áéíóúñ ]/g, '').replace(/\s+/g, '_');
    a.href = url;
    a.download = `${safe}_lvl${char.nivel || 1}_resumen.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return { generate, download };
})();
