/* ═══════════════════════════════════════════════════════
   hojas.js — Notetaker contextual (pestaña Hojas)

   Editor de bloques (TipTap / ProseMirror, en js/vendor) con:
   · atajos markdown que se convierten al escribir (# , - , 1. , [] , > , ---)
   · @ para mencionar o crear entidades sin salir de la nota
   · / para comandos (bloques y entidades: /lugar, /mision, /objeto…)
   · página propia por entidad, con todas sus menciones y su contexto

   Datos, dentro del personaje:
   · c.pages        notas   { id, doc, sessionId, createdAt, updatedAt }
   · c.entities     compartido con el Codex; se agregan doc/updatedAt
   · c.noteMentions índice { id, entityId, noteId, noteKind, sessionId,
                             pos, context, createdAt }

   Las menciones apuntan SIEMPRE por entityId: el nombre visible se lee
   de la entidad al pintar, así renombrar no rompe nada. El índice se
   reconstruye al guardar cada nota, y abrir una entidad solo lo lee.

   No toca c.diary: el diario sigue igual hasta que Hojas lo reemplace.
   Singleton global: Hojas. Se inicializa desde app.js con Hojas.init(ctx).
   ═══════════════════════════════════════════════════════ */

const Hojas = (() => {

  /* ── Tipos de entidad ────────────────────────────────────────────────
     Se mantienen los ids que ya usa el Codex (npc, quest, lugar) para no
     romper el diario; los demás son nuevos. */
  const TIPOS = {
    npc:      { label: 'Persona',  emoji: '👤' },
    pj:       { label: 'PJ',       emoji: '⚔️' },
    lugar:    { label: 'Lugar',    emoji: '📍' },
    quest:    { label: 'Misión',   emoji: '📜' },
    item:     { label: 'Objeto',   emoji: '🎒' },
    faccion:  { label: 'Facción',  emoji: '🛡️' },
    criatura: { label: 'Criatura', emoji: '🐉' },
    otro:     { label: 'Otro',     emoji: '🔹' },
  };

  /* ── Comandos / ──────────────────────────────────────────────────────
     Español con alias en inglés. Los de entidad piden un nombre a
     continuación ("/lugar Puerto Palos"). */
  const COMANDOS = [
    { id: 'texto',     label: 'Texto',          icon: '¶',  alias: ['text', 'parrafo'],        kind: 'block' },
    { id: 'titulo1',   label: 'Título 1',       icon: 'H1', alias: ['h1', 'heading1'],         kind: 'block' },
    { id: 'titulo2',   label: 'Título 2',       icon: 'H2', alias: ['h2', 'heading2'],         kind: 'block' },
    { id: 'titulo3',   label: 'Título 3',       icon: 'H3', alias: ['h3', 'heading3'],         kind: 'block' },
    { id: 'lista',     label: 'Lista',          icon: '•',  alias: ['bullet', 'viñetas'],      kind: 'block' },
    { id: 'numerada',  label: 'Lista numerada', icon: '1.', alias: ['numbered', 'ordenada'],   kind: 'block' },
    { id: 'pendiente', label: 'Pendiente',      icon: '☐',  alias: ['todo', 'checklist', 'tarea'], kind: 'block' },
    { id: 'cita',      label: 'Cita',           icon: '❝',  alias: ['quote'],                  kind: 'block' },
    { id: 'separador', label: 'Separador',      icon: '—',  alias: ['divider', 'linea'],       kind: 'block' },
    { id: 'importante',label: 'Importante',     icon: '★',  alias: ['star', 'destacar'],       kind: 'block' },
    { id: 'persona',   label: 'Persona',        icon: '👤', alias: ['npc', 'person'],          kind: 'entity', tipo: 'npc' },
    { id: 'lugar',     label: 'Lugar',          icon: '📍', alias: ['map', 'location', 'sitio'], kind: 'entity', tipo: 'lugar' },
    { id: 'mision',    label: 'Misión',         icon: '📜', alias: ['quest', 'misión'],        kind: 'entity', tipo: 'quest' },
    { id: 'objeto',    label: 'Objeto',         icon: '🎒', alias: ['item'],                   kind: 'entity', tipo: 'item' },
    { id: 'faccion',   label: 'Facción',        icon: '🛡️', alias: ['faction', 'facción'],     kind: 'entity', tipo: 'faccion' },
    { id: 'criatura',  label: 'Criatura',       icon: '🐉', alias: ['creature', 'monstruo'],   kind: 'entity', tipo: 'criatura' },
  ];

  let _ctx = null;           // puente con app.js
  let _editor = null;        // editor TipTap activo (uno a la vez)
  let _vista = { kind: 'index' };   // index | page | entity
  let _pila = [];            // historial para "‹ Volver"
  let _buscar = '';
  let _timer = null;         // guardado pendiente
  let _enfocar = false;
  let _saltarA = null;       // posición a la que ir al abrir una nota
  let _pop = null;           // estado del menú de sugerencias

  const C = () => (_ctx ? _ctx.getChar() : null);
  const ahora = () => new Date().toISOString();
  const nuevoId = (p) => p + '-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const esc = (t) => String(t == null ? '' : t)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  // Comparación sin mayúsculas ni tildes: "alcalde" encuentra "Álcalde".
  const norm = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

  function _pages()    { const c = C(); if (!Array.isArray(c.pages)) c.pages = []; return c.pages; }
  function _entities() { const c = C(); if (!Array.isArray(c.entities)) c.entities = []; return c.entities; }
  function _mentions() { const c = C(); if (!Array.isArray(c.noteMentions)) c.noteMentions = []; return c.noteMentions; }
  function _entidad(id) { return _entities().find(e => e.id === id) || null; }
  function _tipo(t)    { return TIPOS[t] || TIPOS.otro; }

  /* ══════════════════════════════════════════════════════
     DOCUMENTOS (ProseMirror JSON)
  ══════════════════════════════════════════════════════ */

  const DOC_VACIO_NOTA = () => ({ type: 'doc', content: [{ type: 'heading', attrs: { level: 1 } }] });
  const DOC_VACIO = () => ({ type: 'doc', content: [{ type: 'paragraph' }] });

  // Texto plano de un nodo, con las menciones como su nombre actual.
  function _textoDe(node) {
    if (!node) return '';
    if (node.type === 'text') return node.text || '';
    if (node.type === 'mention') {
      const e = _entidad(node.attrs && node.attrs.id);
      return e ? e.name : ((node.attrs && node.attrs.label) || '');
    }
    if (node.type === 'hardBreak') return '\n';
    return (node.content || []).map(_textoDe).join('');
  }

  function _tituloDe(page) {
    const bloques = (page.doc && page.doc.content) || [];
    const primero = bloques.find(b => _textoDe(b).trim());
    return primero ? _textoDe(primero).trim().slice(0, 80) : 'Sin título';
  }

  function _textoPlano(doc) {
    return ((doc && doc.content) || []).map(_textoDe).join('\n');
  }

  /* ══════════════════════════════════════════════════════
     ÍNDICE DE MENCIONES
     Se reconstruye por nota al guardarla. Las posiciones se calculan
     sobre el JSON con las mismas reglas que ProseMirror (cada nodo no
     hoja abre y cierra con +1; texto cuenta sus caracteres; los átomos
     inline como la mención cuentan 1), para poder volver a ese punto.
  ══════════════════════════════════════════════════════ */

  // Oración completa alrededor de un desplazamiento dentro de un bloque.
  function _oracion(texto, offset) {
    let ini = 0, fin = texto.length;
    for (let i = offset - 1; i >= 0; i--) {
      if (/[.!?¡¿\n]/.test(texto[i])) { ini = i + 1; break; }
    }
    for (let i = offset; i < texto.length; i++) {
      if (/[.!?\n]/.test(texto[i])) { fin = i + 1; break; }
    }
    return texto.slice(ini, fin).trim().slice(0, 280);
  }

  function _reindexar(noteId, noteKind, doc, sessionId) {
    const c = C();
    if (!c) return;
    const previas = _mentions().filter(m => m.noteId === noteId);
    const fechaPrevia = {};
    previas.forEach(m => { fechaPrevia[m.entityId + '@' + m.pos] = m.createdAt; });
    const resto = _mentions().filter(m => m.noteId !== noteId);
    const nuevas = [];

    // Recorre un bloque de texto: arma su texto y ubica cada mención.
    const bloqueTexto = (node, posInicio) => {
      let texto = '';
      const encontradas = [];
      let pos = posInicio;
      (node.content || []).forEach(h => {
        if (h.type === 'text') { texto += h.text || ''; pos += (h.text || '').length; }
        else if (h.type === 'mention') {
          const e = _entidad(h.attrs && h.attrs.id);
          const nombre = e ? e.name : ((h.attrs && h.attrs.label) || '');
          encontradas.push({ entityId: h.attrs.id, offset: texto.length, pos });
          texto += nombre;
          pos += 1;
        } else if (h.type === 'hardBreak') { texto += '\n'; pos += 1; }
        else { pos += 1; }
      });
      encontradas.forEach(f => {
        if (!f.entityId) return;
        nuevas.push({
          id: nuevoId('mn'),
          entityId: f.entityId,
          noteId, noteKind,
          sessionId: sessionId || null,
          pos: f.pos,
          context: _oracion(texto, f.offset),
          createdAt: fechaPrevia[f.entityId + '@' + f.pos] || ahora(),
        });
      });
    };

    // Devuelve el tamaño del nodo en posiciones ProseMirror.
    const recorrer = (node, pos) => {
      if (node.type === 'text') return (node.text || '').length;
      const hijos = node.content || [];
      const esTextblock = hijos.some(h => h.type === 'text' || h.type === 'mention' || h.type === 'hardBreak')
        || ['paragraph', 'heading'].includes(node.type);
      if (esTextblock) {
        bloqueTexto(node, pos + 1);
        let t = 2;
        hijos.forEach(h => { t += h.type === 'text' ? (h.text || '').length : 1; });
        return t;
      }
      if (!hijos.length) return ['horizontalRule', 'hardBreak', 'mention'].includes(node.type) ? 1 : 2;
      let t = 1;
      hijos.forEach(h => { t += recorrer(h, pos + t); });
      return t + 1;
    };
    ((doc && doc.content) || []).reduce((pos, n) => pos + recorrer(n, pos), 0);

    c.noteMentions = resto.concat(nuevas);
  }

  function _reindexarTodo() {
    _pages().forEach(p => p.doc && _reindexar(p.id, 'page', p.doc, p.sessionId));
    _entities().forEach(e => e.doc && _reindexar(e.id, 'entity', e.doc, null));
  }

  /* ══════════════════════════════════════════════════════
     ENTIDADES
  ══════════════════════════════════════════════════════ */

  function _crearEntidad(nombre, tipo) {
    const n = String(nombre || '').trim().slice(0, 60);
    if (!n) return null;
    const e = { id: nuevoId('ent'), type: tipo || 'npc', name: n, createdAt: ahora(), updatedAt: ahora() };
    if (e.type === 'quest') e.status = 'active';
    _entities().push(e);
    return e;
  }

  // Otros PJs guardados: se ofrecen al escribir @ aunque no sean entidad aún.
  function _otrosPJs() {
    const c = C();
    try {
      return Object.values(_ctx.getAllChars() || {})
        .filter(x => x && x.id !== c.id && (x.nombre || x.name))
        .map(x => (x.nombre || x.name).trim());
    } catch (e) { return []; }
  }

  /* Sugerencias ordenadas para no crear duplicados (Historia 7):
     exacta → empieza con → contiene. Sin mayúsculas ni tildes. */
  function _sugerirEntidades(query, tipo) {
    const q = norm(query);
    const candidatas = _entities().filter(e => !tipo || e.type === tipo);
    const puntaje = (nombre) => {
      const n = norm(nombre);
      if (!q) return 3;
      if (n === q) return 0;
      if (n.startsWith(q)) return 1;
      if (n.split(/\s+/).some(w => w.startsWith(q))) return 2;
      if (n.includes(q)) return 3;
      return -1;
    };
    const items = candidatas
      .map(e => ({ e, s: puntaje(e.name) }))
      .filter(x => x.s >= 0)
      .sort((a, b) => a.s - b.s || (b.e.updatedAt || '').localeCompare(a.e.updatedAt || ''))
      .slice(0, 6)
      .map(x => ({ kind: 'entity', entity: x.e }));

    // PJs que todavía no son entidad (solo en @ sin tipo forzado)
    if (!tipo) {
      const ya = new Set(_entities().map(e => norm(e.name)));
      _otrosPJs()
        .filter(n => !ya.has(norm(n)) && (!q || norm(n).includes(q)))
        .slice(0, 3)
        .forEach(n => items.push({ kind: 'pj', name: n }));
    }

    const texto = String(query || '').trim();
    const exacta = items.some(i => i.kind === 'entity' && norm(i.entity.name) === q);
    if (texto && texto.length <= 60) {
      items.push({ kind: 'create', name: texto, tipo: tipo || 'npc', forzado: exacta });
    }
    return items;
  }

  /* ══════════════════════════════════════════════════════
     MENÚ DE SUGERENCIAS (compartido por @ y /)
     Se dibuja debajo de la barra del panel, no junto al cursor: en el
     iPad el teclado tapa la mitad inferior y el cursor puede quedar
     debajo; la parte alta del panel siempre está a la vista.
  ══════════════════════════════════════════════════════ */

  function _popEl() { return document.getElementById('hjPop'); }

  function _popMostrar(items, onElegir, titulo) {
    const el = _popEl();
    if (!el) return;
    if (!items.length) { _popCerrar(); return; }
    _pop = { items, onElegir, sel: 0 };
    el.innerHTML = (titulo ? `<div class="hj-pop-hd">${esc(titulo)}</div>` : '') +
      items.map((it, i) => `<button class="hj-pop-item${i === 0 ? ' sel' : ''}" data-i="${i}"
        onmousedown="event.preventDefault()" onclick="Hojas._elegir(${i})">${_popItemHTML(it)}</button>`).join('');
    el.style.display = 'block';
  }

  function _popItemHTML(it) {
    if (it.kind === 'entity') {
      const t = _tipo(it.entity.type);
      return `<span class="hj-pi-ic">${t.emoji}</span><span class="hj-pi-tx">${esc(it.entity.name)}</span><span class="hj-pi-meta">${t.label}</span>`;
    }
    if (it.kind === 'pj') return `<span class="hj-pi-ic">⚔️</span><span class="hj-pi-tx">${esc(it.name)}</span><span class="hj-pi-meta">PJ</span>`;
    if (it.kind === 'create') {
      const t = _tipo(it.tipo);
      return `<span class="hj-pi-ic">＋</span><span class="hj-pi-tx">${it.forzado ? 'Crear otro' : 'Crear'} «${esc(it.name)}»</span><span class="hj-pi-meta">${t.emoji} ${t.label}</span>`;
    }
    if (it.kind === 'cmd') {
      return `<span class="hj-pi-ic hj-pi-cmd">${esc(it.cmd.icon)}</span><span class="hj-pi-tx">${esc(it.cmd.label)}</span><span class="hj-pi-meta">/${esc(it.cmd.id)}</span>`;
    }
    return '';
  }

  function _popMover(delta) {
    if (!_pop) return;
    _pop.sel = (_pop.sel + delta + _pop.items.length) % _pop.items.length;
    const el = _popEl();
    el.querySelectorAll('.hj-pop-item').forEach((b, i) => b.classList.toggle('sel', i === _pop.sel));
    const s = el.querySelector('.hj-pop-item.sel');
    if (s) s.scrollIntoView({ block: 'nearest' });
  }

  function _popCerrar() {
    _pop = null;
    const el = _popEl();
    if (el) { el.style.display = 'none'; el.innerHTML = ''; }
  }

  function _elegir(i) {
    if (!_pop) return;
    const it = _pop.items[i];
    const fn = _pop.onElegir;
    _popCerrar();
    if (it && fn) fn(it);
  }

  // Teclado compartido: ↑ ↓ navegan, Enter/Tab eligen, Escape cierra.
  function _popTeclas(props) {
    if (!_pop) return false;
    const k = props.event.key;
    if (k === 'ArrowDown') { _popMover(1); return true; }
    if (k === 'ArrowUp')   { _popMover(-1); return true; }
    if (k === 'Enter' || k === 'Tab') { _elegir(_pop.sel); return true; }
    if (k === 'Escape')    { _popCerrar(); return true; }
    return false;
  }

  function _render(itemsDe, titulo) {
    return () => ({
      onStart: (props) => _popMostrar(itemsDe(props), (it) => props.command(it), titulo && titulo(props)),
      onUpdate: (props) => _popMostrar(itemsDe(props), (it) => props.command(it), titulo && titulo(props)),
      onKeyDown: (props) => _popTeclas(props),
      onExit: () => _popCerrar(),
    });
  }

  /* ══════════════════════════════════════════════════════
     EXTENSIONES DEL EDITOR
  ══════════════════════════════════════════════════════ */

  // Inserta una mención a la entidad y un espacio para seguir escribiendo.
  function _insertarMencion(editor, range, entidad) {
    editor.chain().focus().insertContentAt(range, [
      { type: 'mention', attrs: { id: entidad.id, label: entidad.name, etype: entidad.type } },
      { type: 'text', text: ' ' },
    ]).run();
  }

  // Resuelve lo elegido en el menú a una entidad (existente o nueva).
  function _entidadDeItem(it) {
    if (it.kind === 'entity') return it.entity;
    if (it.kind === 'pj') return _crearEntidad(it.name, 'pj');
    if (it.kind === 'create') return _crearEntidad(it.name, it.tipo);
    return null;
  }

  /* Un nombre se da por terminado con puntuación o tras 4 palabras sin
     coincidencias: así "@Grak nos atacó" no queda eternamente abierto. */
  function _queryValida(q) {
    if (/[.,;:!?()]/.test(q)) return false;
    return q.split(/\s+/).filter(Boolean).length <= 4;
  }

  function _mencionExt() {
    return TT.Mention.extend({
      addAttributes() {
        return {
          ...this.parent?.(),
          etype: {
            default: 'npc',
            parseHTML: el => el.getAttribute('data-etype') || 'npc',
            renderHTML: a => ({ 'data-etype': a.etype }),
          },
        };
      },
    }).configure({
      deleteTriggerWithBackspace: true,   // Backspace borra la mención entera
      renderText({ node }) {
        const e = _entidad(node.attrs.id);
        return e ? e.name : (node.attrs.label || '');
      },
      renderHTML({ node, options }) {
        const e = _entidad(node.attrs.id);
        const tipo = e ? e.type : (node.attrs.etype || 'npc');
        const t = _tipo(tipo);
        const nombre = e ? e.name : (node.attrs.label || '?');
        return ['span', TT.mergeAttributes({
          class: 'hj-ref' + (e ? '' : ' rota'),
          'data-type': 'mention',
          'data-id': node.attrs.id,
          'data-etype': tipo,
          title: `${t.label}: ${nombre}`,
        }, options.HTMLAttributes), `${t.emoji} ${nombre}`];
      },
      suggestion: {
        char: '@',
        allowSpaces: true,
        pluginKey: new TT.PluginKey('hjArroba'),
        items: ({ query }) => (_queryValida(query) ? _sugerirEntidades(query, null) : []),
        command: ({ editor, range, props }) => {
          const e = _entidadDeItem(props);
          if (e) _insertarMencion(editor, range, e);
        },
        render: _render(p => p.items),
      },
    });
  }

  function _ejecutarBloque(editor, range, id) {
    const ch = editor.chain().focus().deleteRange(range);
    switch (id) {
      case 'texto':     ch.setParagraph().run(); break;
      case 'titulo1':   ch.setHeading({ level: 1 }).run(); break;
      case 'titulo2':   ch.setHeading({ level: 2 }).run(); break;
      case 'titulo3':   ch.setHeading({ level: 3 }).run(); break;
      case 'lista':     ch.toggleBulletList().run(); break;
      case 'numerada':  ch.toggleOrderedList().run(); break;
      case 'pendiente': ch.toggleTaskList().run(); break;
      case 'cita':      ch.toggleBlockquote().run(); break;
      case 'separador': ch.setHorizontalRule().run(); break;
      case 'importante':ch.run(); _alternarImportante(editor); break;
      default:          ch.run();
    }
  }

  function _comandoPorPalabra(palabra) {
    const p = norm(palabra);
    return COMANDOS.find(c => norm(c.id) === p || c.alias.some(a => norm(a) === p)) || null;
  }

  /* /comando  → lista de comandos.
     /lugar Puerto Palos → lugares que coinciden + crear, y el resultado
     queda como mención (no como sintaxis). */
  function _slashExt() {
    return TT.Extension.create({
      name: 'hjSlash',
      addProseMirrorPlugins() {
        return [TT.Suggestion({
          editor: this.editor,
          char: '/',
          allowSpaces: true,
          pluginKey: new TT.PluginKey('hjSlash'),
          items: ({ query }) => {
            const m = String(query || '').match(/^(\S*)(?:\s+([\s\S]*))?$/);
            const palabra = m ? m[1] : '';
            const resto = m ? m[2] : undefined;
            if (resto === undefined) {
              const p = norm(palabra);
              return COMANDOS
                .filter(c => !p || norm(c.id).startsWith(p) || norm(c.label).startsWith(p) || c.alias.some(a => norm(a).startsWith(p)))
                .map(c => ({ kind: 'cmd', cmd: c }));
            }
            const cmd = _comandoPorPalabra(palabra);
            if (!cmd || cmd.kind !== 'entity' || !_queryValida(resto)) return [];
            return _sugerirEntidades(resto, cmd.tipo);
          },
          command: ({ editor, range, props }) => {
            if (props.kind === 'cmd') {
              if (props.cmd.kind === 'block') { _ejecutarBloque(editor, range, props.cmd.id); return; }
              // Comando de entidad: se deja "/lugar " escrito para pedir el nombre.
              editor.chain().focus().insertContentAt(range, `/${props.cmd.id} `).run();
              return;
            }
            const e = _entidadDeItem(props);
            if (e) _insertarMencion(editor, range, e);
          },
          render: _render(p => p.items, (p) => {
            const m = String(p.query || '').match(/^(\S*)\s/);
            const cmd = m && _comandoPorPalabra(m[1]);
            return cmd && cmd.kind === 'entity' ? `${cmd.icon} ${cmd.label}: escribí el nombre` : '';
          }),
        })];
      },
    });
  }

  // ★ Importante: atributo sobre párrafos y títulos, no un bloque nuevo.
  function _importanteExt() {
    return TT.Extension.create({
      name: 'hjImportante',
      addGlobalAttributes() {
        return [{
          types: ['paragraph', 'heading'],
          attributes: {
            star: {
              default: false,
              parseHTML: el => el.getAttribute('data-star') === 'true',
              renderHTML: a => (a.star ? { 'data-star': 'true' } : {}),
            },
          },
        }];
      },
    });
  }

  function _alternarImportante(editor) {
    const { $from } = editor.state.selection;
    const nodo = $from.parent;
    if (!['paragraph', 'heading'].includes(nodo.type.name)) return;
    editor.chain().focus().updateAttributes(nodo.type.name, { star: !nodo.attrs.star }).run();
  }

  /* "[] " o "[ ] " al inicio de un ítem de lista con viñetas: el
     TaskItem de TipTap solo lo reconoce en un párrafo suelto, así que
     "- [ ] " terminaba como una tarea anidada dentro de la viñeta. */
  function _checklistEnListaExt() {
    return TT.Extension.create({
      name: 'hjChecklistEnLista',
      addInputRules() {
        return [new TT.InputRule({
          find: /^\s*\[([ xX]?)\]\s$/,
          handler: ({ state, range, match, chain }) => {
            const $from = state.doc.resolve(range.from);
            if ($from.depth < 2 || $from.node(-1).type.name !== 'listItem') return null;
            const marcado = /x/i.test(match[1] || '');
            chain().deleteRange(range).liftListItem('listItem').toggleTaskList()
              .updateAttributes('taskItem', { checked: marcado }).run();
          },
        })];
      },
    });
  }

  /* ══════════════════════════════════════════════════════
     EDITOR
  ══════════════════════════════════════════════════════ */

  function _destruirEditor() {
    _popCerrar();
    if (_editor) { try { _editor.destroy(); } catch (e) { /* ya destruido */ } }
    _editor = null;
  }

  function _objetivoActual() {
    if (_vista.kind === 'page')   return _pages().find(p => p.id === _vista.id) || null;
    if (_vista.kind === 'entity') return _entidad(_vista.id);
    return null;
  }

  function _montarEditor(el, doc, placeholderTitulo, placeholderTexto) {
    _destruirEditor();
    _editor = new TT.Editor({
      element: el,
      content: doc,
      extensions: [
        TT.StarterKit.configure({
          heading: { levels: [1, 2, 3] },
          link: false,
          codeBlock: false,
          dropcursor: false,
        }),
        TT.TaskList,
        TT.TaskItem.configure({ nested: true }),
        TT.Placeholder.configure({
          includeChildren: false,
          placeholder: ({ node, pos }) =>
            (placeholderTitulo && pos === 0 && node.type.name === 'heading') ? placeholderTitulo : placeholderTexto,
        }),
        _importanteExt(),
        _checklistEnListaExt(),
        _mencionExt(),
        _slashExt(),
      ],
      editorProps: {
        attributes: { class: 'hj-doc', spellcheck: 'true', autocapitalize: 'sentences' },
        // Tocar una mención abre su entidad; el texto no se modifica.
        handleClickOn: (view, pos, node) => {
          if (node.type.name === 'mention' && node.attrs.id) {
            flush();
            abrirEntidad(node.attrs.id);
            return true;
          }
          return false;
        },
      },
      onUpdate: () => _alCambiar(),
      onBlur: () => flush(),
    });
  }

  // TipTap guarda en cada mención qué tecla la creó (@ o /): no se usa y
  // pesa. El personaje entero es un documento de Firestore de máximo 1 MB.
  function _compactar(doc) {
    (function limpiar(n) {
      if (n.type === 'mention' && n.attrs) delete n.attrs.mentionSuggestionChar;
      if (n.attrs && n.attrs.star === false) delete n.attrs.star;
      (n.content || []).forEach(limpiar);
    })(doc);
    return doc;
  }

  function _alCambiar() {
    const obj = _objetivoActual();
    if (!obj || !_editor) return;
    obj.doc = _compactar(_editor.getJSON());
    obj.updatedAt = ahora();
    clearTimeout(_timer);
    _timer = setTimeout(() => { _timer = null; _persistir(); }, 500);
  }

  // Guarda la nota o entidad abierta y reindexa sus menciones.
  function _persistir() {
    const obj = _objetivoActual();
    if (obj && obj.doc) {
      if (_vista.kind === 'page')   _reindexar(obj.id, 'page', obj.doc, obj.sessionId);
      if (_vista.kind === 'entity') _reindexar(obj.id, 'entity', obj.doc, null);
    }
    _ctx.save(true);
  }

  function flush() {
    if (!_timer) return;
    clearTimeout(_timer);
    _timer = null;
    if (C()) _persistir();
  }

  // Posiciona el cursor cerca de una mención y la resalta un momento.
  function _irA(pos) {
    if (!_editor || pos == null) return;
    const max = _editor.state.doc.content.size;
    const p = Math.max(0, Math.min(pos, max));
    try {
      _editor.commands.setTextSelection(p);
      const dom = _editor.view.nodeDOM(p) || _editor.view.domAtPos(p).node;
      const el = dom && (dom.nodeType === 1 ? dom : dom.parentElement);
      if (el) {
        el.scrollIntoView({ block: 'center' });
        el.classList.add('hj-flash');
        setTimeout(() => el.classList.remove('hj-flash'), 1600);
      }
    } catch (e) { /* posición fuera de rango tras editar: no pasa nada */ }
  }

  /* ══════════════════════════════════════════════════════
     VISTAS
  ══════════════════════════════════════════════════════ */

  function _barra() {
    const back = document.getElementById('pgBack');
    const buscador = document.getElementById('pgSearch');
    const deshacer = document.getElementById('hjUndo');
    const enIndice = _vista.kind === 'index';
    if (back) back.style.display = enIndice ? 'none' : '';
    if (buscador) buscador.style.display = enIndice ? '' : 'none';
    if (deshacer) deshacer.style.display = enIndice ? 'none' : '';
  }

  function _sesionLabel(sessionId) {
    return sessionId && _ctx.sessionLabel ? _ctx.sessionLabel(sessionId) : '';
  }

  function render() {
    const body = document.getElementById('pgBody');
    const c = C();
    if (!body || !c) return;
    if (typeof TT === 'undefined') {
      body.innerHTML = `<div class="pg-empty">No se pudo cargar el editor. Recargá la app.</div>`;
      return;
    }
    _migrar();
    // El índice no viaja a la nube: tras cargar desde Firestore se rearma.
    if (!Array.isArray(c.noteMentions) && _pages().some(p => p.doc)) _reindexarTodo();
    _barra();
    if (_vista.kind === 'page')   return _renderNota(body);
    if (_vista.kind === 'entity') return _renderEntidad(body);
    _destruirEditor();
    _renderIndice(body);
  }

  function _renderIndice(body) {
    const q = norm(_buscar);
    let notas = _pages().slice();
    if (q) notas = notas.filter(p => norm(_textoPlano(p.doc)).includes(q));
    notas.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));

    // Búsqueda: también entidades y el contexto de sus menciones.
    let entHTML = '';
    if (q) {
      const ents = _entities().filter(e => norm(e.name).includes(q)).slice(0, 8);
      const ctxs = _mentions().filter(m => norm(m.context).includes(q)).slice(0, 8);
      if (ents.length) {
        entHTML += `<div class="hj-sec-hd">Entidades</div><div class="hj-chips">` +
          ents.map(e => `<button class="hj-chip" onclick="Hojas.abrirEntidad('${e.id}')">${_tipo(e.type).emoji} ${esc(e.name)}</button>`).join('') +
          `</div>`;
      }
      if (ctxs.length) {
        entHTML += `<div class="hj-sec-hd">En menciones</div>` + ctxs.map(m => _itemMencionHTML(m, true)).join('');
      }
    }

    if (!notas.length && !entHTML) {
      body.innerHTML = `<div class="pg-empty">${q ? 'Nada coincide.'
        : 'Sin notas todavía.<br><br>Escribí con <code>#</code> para títulos, <code>-</code> para listas, <code>@</code> para mencionar y <code>/</code> para comandos.<br>El diario de siempre sigue intacto en su pestaña.'}</div>`;
      return;
    }

    body.innerHTML = entHTML + (notas.length ? (q ? `<div class="hj-sec-hd">Notas</div>` : '') + `<div class="pg-list">` + notas.map(p => {
      const fecha = p.updatedAt ? new Date(p.updatedAt).toLocaleDateString('es', { day: '2-digit', month: '2-digit' }) : '';
      const bloques = (p.doc && p.doc.content) || [];
      const prev = bloques.map(_textoDe).filter(t => t.trim()).slice(1, 2).join(' ');
      const n = _mentions().filter(m => m.noteId === p.id).length;
      const ses = _sesionLabel(p.sessionId);
      return `<div class="pg-card" onclick="Hojas.abrirNota('${p.id}')">
        <div class="pg-card-hd">
          <span class="pg-card-title">${esc(_tituloDe(p))}</span>
          <span class="pg-card-date">${fecha}</span>
        </div>
        ${prev ? `<div class="pg-card-prev">${esc(prev.slice(0, 100))}</div>` : ''}
        ${(n || ses) ? `<div class="pg-card-meta">${ses ? esc(ses) : ''}${ses && n ? ' · ' : ''}${n ? `${n} ${n === 1 ? 'mención' : 'menciones'}` : ''}</div>` : ''}
      </div>`;
    }).join('') + `</div>` : '');
  }

  function _renderNota(body) {
    const p = _pages().find(x => x.id === _vista.id);
    if (!p) { _vista = { kind: 'index' }; return render(); }
    if (!p.doc) p.doc = DOC_VACIO_NOTA();
    const ses = _sesionLabel(p.sessionId);
    body.innerHTML = `
      ${ses ? `<div class="hj-ses">${esc(ses)}</div>` : ''}
      <div class="hj-editor" id="hjEditor"></div>
      <button class="pg-del" onclick="Hojas.borrarNota('${p.id}')">Borrar nota</button>`;
    _montarEditor(document.getElementById('hjEditor'), p.doc, 'Título de la nota',
      'Escribí… @ para mencionar, / para comandos');
    _despuesDeMontar();
  }

  function _renderEntidad(body) {
    const e = _entidad(_vista.id);
    if (!e) { _vista = { kind: 'index' }; return render(); }
    const t = _tipo(e.type);
    const opciones = Object.entries(TIPOS).map(([k, v]) =>
      `<option value="${k}"${k === e.type ? ' selected' : ''}>${v.emoji} ${v.label}</option>`).join('');

    body.innerHTML = `
      <div class="hj-ent-hd">
        <span class="hj-ent-ic">${t.emoji}</span>
        <input class="hj-ent-name" id="hjEntName" value="${esc(e.name)}" maxlength="60"
          onchange="Hojas.renombrar('${e.id}', this.value)" onkeydown="if(event.key==='Enter'){this.blur()}">
        <select class="hj-ent-type" onchange="Hojas.cambiarTipo('${e.id}', this.value)">${opciones}</select>
      </div>
      <div class="hj-editor hj-editor-ent" id="hjEditor"></div>
      <div id="hjEntRefs">${_refsEntidadHTML(e)}</div>`;
    _montarEditor(document.getElementById('hjEditor'), e.doc || DOC_VACIO(), null,
      `Lo que sabés de ${e.name}…`);
    _despuesDeMontar();
  }

  function _despuesDeMontar() {
    if (_saltarA != null) { const p = _saltarA; _saltarA = null; setTimeout(() => _irA(p), 30); }
    else if (_enfocar) { _enfocar = false; setTimeout(() => _editor && _editor.commands.focus('end'), 30); }
  }

  function _itemMencionHTML(m, conEntidad) {
    const e = _entidad(m.entityId);
    let origen = '';
    if (m.noteKind === 'page') {
      const p = _pages().find(x => x.id === m.noteId);
      origen = p ? _tituloDe(p) : 'Nota';
    } else {
      const o = _entidad(m.noteId);
      origen = o ? `${_tipo(o.type).emoji} ${o.name}` : 'Entidad';
    }
    const ses = _sesionLabel(m.sessionId);
    let ctx = esc(m.context || '');
    if (e && e.name) {
      const re = new RegExp(esc(e.name).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
      ctx = ctx.replace(re, x => `<strong>${x}</strong>`);
    }
    return `<div class="hj-ref-item" onclick="Hojas._abrirMencion('${m.id}')">
      <div class="hj-ref-meta">${conEntidad && e ? `${_tipo(e.type).emoji} ${esc(e.name)} · ` : ''}${ses ? esc(ses) + ' · ' : ''}${esc(origen)}</div>
      <div class="hj-ref-ctx">${ctx || '<em>(sin texto)</em>'}</div>
    </div>`;
  }

  // Menciones de la entidad (más recientes primero) + las del diario.
  function _refsEntidadHTML(e) {
    const refs = _mentions().filter(m => m.entityId === e.id)
      .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    const c = C();
    const delDiario = (c.diary || []).filter(d => (d.mentions || []).some(m => m.id === e.id))
      .sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''));

    let html = `<div class="hj-sec-hd">Menciones <span class="hj-count">${refs.length}</span></div>`;
    html += refs.length ? refs.map(m => _itemMencionHTML(m, false)).join('')
      : `<div class="hj-vacio">Todavía nadie la mencionó. Escribí <code>@${esc(e.name)}</code> en una nota.</div>`;

    if (delDiario.length) {
      html += `<div class="hj-sec-hd">En el diario <span class="hj-count">${delDiario.length}</span></div>` +
        delDiario.map(d => `<div class="hj-ref-item diario">
          <div class="hj-ref-meta">${esc(_sesionLabel(d.sessionId) || 'Diario')}</div>
          <div class="hj-ref-ctx">${esc(d.text || '')}</div></div>`).join('');
    }

    const rel = (e.relatedTo || []).map(r => _entidad(r.id)).filter(Boolean);
    if (rel.length) {
      html += `<div class="hj-sec-hd">Relacionado</div><div class="hj-chips">` +
        rel.map(o => `<button class="hj-chip" onclick="Hojas.abrirEntidad('${o.id}')">${_tipo(o.type).emoji} ${esc(o.name)}</button>`).join('') + `</div>`;
    }
    return html;
  }

  /* ══════════════════════════════════════════════════════
     NAVEGACIÓN Y ACCIONES
  ══════════════════════════════════════════════════════ */

  // Una nota que se abrió y se dejó sin escribir nada no queda como basura.
  function _limpiarSiVacia() {
    if (_vista.kind !== 'page') return;
    const p = _pages().find(x => x.id === _vista.id);
    if (!p || _textoPlano(p.doc).trim()) return;
    const c = C();
    c.pages = _pages().filter(x => x !== p);
    c.noteMentions = _mentions().filter(m => m.noteId !== p.id);
    _pila = _pila.filter(v => !(v.kind === 'page' && v.id === p.id));
    _ctx.save(true);
  }

  function _ir(vista) {
    flush();
    _limpiarSiVacia();
    _pila.push(_vista);
    if (_pila.length > 40) _pila.shift();
    _vista = vista;
    render();
    const body = document.getElementById('pgBody');
    if (body && _saltarA == null) body.scrollTop = 0;
  }

  function nuevaNota() {
    const c = C();
    if (!c) return;
    const ses = _ctx.openSession ? _ctx.openSession() : null;
    const p = { id: nuevoId('pg'), doc: DOC_VACIO_NOTA(), sessionId: ses ? ses.id : null, createdAt: ahora(), updatedAt: ahora() };
    _pages().push(p);
    _ctx.save(true);
    _enfocar = true;
    _ir({ kind: 'page', id: p.id });
  }

  function abrirNota(id, pos) {
    _saltarA = pos == null ? null : pos;
    _ir({ kind: 'page', id });
  }

  function abrirEntidad(id) {
    if (!_entidad(id)) return;
    _ir({ kind: 'entity', id });
  }

  function volver() {
    flush();
    _limpiarSiVacia();
    _vista = _pila.pop() || { kind: 'index' };
    render();
  }

  function _abrirMencion(mentionId) {
    const m = _mentions().find(x => x.id === mentionId);
    if (!m) return;
    if (m.noteKind === 'page') abrirNota(m.noteId, m.pos);
    else { _saltarA = m.pos; _ir({ kind: 'entity', id: m.noteId }); }
  }

  function borrarNota(id) {
    _ctx.confirm('¿Borrar esta nota? Sus menciones desaparecen de las entidades.', () => {
      const c = C();
      clearTimeout(_timer); _timer = null;
      _destruirEditor();
      c.pages = _pages().filter(p => p.id !== id);
      c.noteMentions = _mentions().filter(m => m.noteId !== id);
      _vista = { kind: 'index' };
      _pila = [];
      _ctx.save();
      render();
      _ctx.toast('Nota borrada');
    });
  }

  /* Renombrar: las menciones apuntan por id, así que solo cambia el
     nombre. Se actualiza la etiqueta guardada (para copiar/pegar fuera
     de la app) y se reindexa porque los contextos llevan el nombre. */
  function renombrar(id, nombre) {
    const e = _entidad(id);
    const n = String(nombre || '').trim().slice(0, 60);
    if (!e || !n || n === e.name) return;
    e.name = n;
    e.updatedAt = ahora();
    const tocar = (node) => {
      if (!node) return;
      if (node.type === 'mention' && node.attrs && node.attrs.id === id) node.attrs.label = n;
      (node.content || []).forEach(tocar);
    };
    _pages().forEach(p => tocar(p.doc));
    _entities().forEach(x => tocar(x.doc));
    _reindexarTodo();
    _ctx.save();
    const refs = document.getElementById('hjEntRefs');
    if (refs) refs.innerHTML = _refsEntidadHTML(e);
    _ctx.toast('Renombrada');
  }

  function cambiarTipo(id, tipo) {
    const e = _entidad(id);
    if (!e || !TIPOS[tipo]) return;
    e.type = tipo;
    if (tipo === 'quest' && !e.status) e.status = 'active';
    e.updatedAt = ahora();
    const tocar = (node) => {
      if (!node) return;
      if (node.type === 'mention' && node.attrs && node.attrs.id === id) node.attrs.etype = tipo;
      (node.content || []).forEach(tocar);
    };
    _pages().forEach(p => tocar(p.doc));
    _entities().forEach(x => tocar(x.doc));
    _ctx.save();
    render();
  }

  function buscar(v) {
    _buscar = String(v || '').trim();
    render();
  }

  function deshacer() { if (_editor) _editor.chain().focus().undo().run(); }
  function rehacer()  { if (_editor) _editor.chain().focus().redo().run(); }

  /* ══════════════════════════════════════════════════════
     MIGRACIÓN de la beta anterior (texto plano con @ y [[ ]])
     Se convierte a bloques una sola vez. Una hoja cuyo título coincide
     con una entidad mencionada pasa a ser la página de esa entidad.
  ══════════════════════════════════════════════════════ */

  function _entidadPorNombre(nombre, tipo) {
    return _entities().find(e => norm(e.name) === norm(nombre)) || _crearEntidad(nombre, tipo);
  }

  function _inlineDesdeTexto(t) {
    const out = [];
    const re = /\[\[([^\]\n]+)\]\]|(^|[\s(,;:¡¿"'])@(?:\[([^\]\n]+)\]|([\wáéíóúñüÁÉÍÓÚÑÜ'-]+))|\*\*([^*]+)\*\*/g;
    let ultimo = 0, m;
    const texto = (s, marks) => { if (s) out.push(marks ? { type: 'text', text: s, marks } : { type: 'text', text: s }); };
    while ((m = re.exec(t))) {
      const prefijo = m[2] || '';
      const ini = m.index + prefijo.length;
      texto(t.slice(ultimo, ini));
      if (m[5]) texto(m[5], [{ type: 'bold' }]);
      else {
        const nombre = (m[1] || m[3] || m[4] || '').trim();
        const e = _entidadPorNombre(nombre, m[1] ? 'otro' : 'npc');
        if (e) out.push({ type: 'mention', attrs: { id: e.id, label: e.name, etype: e.type } });
      }
      ultimo = re.lastIndex;
    }
    texto(t.slice(ultimo));
    return out;
  }

  function _docDesdeTexto(texto) {
    const content = [];
    let lista = null;
    const cerrar = () => { if (lista) { content.push(lista); lista = null; } };
    const item = (tipoLista, tipoItem, txt, attrs) => {
      if (!lista || lista.type !== tipoLista) { cerrar(); lista = { type: tipoLista, content: [] }; }
      const it = { type: tipoItem, content: [{ type: 'paragraph', content: _inlineDesdeTexto(txt) }] };
      if (attrs) it.attrs = attrs;
      lista.content.push(it);
    };
    String(texto || '').split('\n').forEach(l => {
      const s = l.trimEnd();
      let m;
      if (!s.trim()) { cerrar(); return; }
      if ((m = s.match(/^(#{1,3})\s+(.*)$/))) { cerrar(); content.push({ type: 'heading', attrs: { level: m[1].length }, content: _inlineDesdeTexto(m[2]) }); return; }
      if ((m = s.match(/^\s*[-*]\s+\[([ xX])\]\s+(.*)$/))) { item('taskList', 'taskItem', m[2], { checked: /x/i.test(m[1]) }); return; }
      if ((m = s.match(/^\s*[-*]\s+(.*)$/))) { item('bulletList', 'listItem', m[1]); return; }
      if ((m = s.match(/^\s*\d+[.)]\s+(.*)$/))) { item('orderedList', 'listItem', m[1]); return; }
      cerrar();
      if ((m = s.match(/^>\s?(.*)$/))) { content.push({ type: 'blockquote', content: [{ type: 'paragraph', content: _inlineDesdeTexto(m[1]) }] }); return; }
      if (/^(-{3,}|\*{3,})$/.test(s.trim())) { content.push({ type: 'horizontalRule' }); return; }
      content.push({ type: 'paragraph', content: _inlineDesdeTexto(s) });
    });
    cerrar();
    // Los nodos sin contenido no llevan "content" vacío en ProseMirror.
    content.forEach(function limpiar(n) { if (n.content && !n.content.length) delete n.content; else (n.content || []).forEach(limpiar); });
    return { type: 'doc', content: content.length ? content : [{ type: 'paragraph' }] };
  }

  function _migrar() {
    const c = C();
    const viejas = _pages().filter(p => !p.doc && typeof p.text === 'string');
    if (!viejas.length) return;
    viejas.forEach(p => { p.doc = _docDesdeTexto(p.text); p.textoBeta = p.text; delete p.text; });
    // Hoja "Grum" + entidad Grum mencionada → el contenido va a la entidad.
    viejas.slice().forEach(p => {
      const titulo = _tituloDe(p);
      const e = _entities().find(x => norm(x.name) === norm(titulo));
      if (!e || e.doc) return;
      const cuerpo = (p.doc.content || []).slice(1);
      e.doc = { type: 'doc', content: cuerpo.length ? cuerpo : [{ type: 'paragraph' }] };
      c.pages = _pages().filter(x => x !== p);
    });
    _reindexarTodo();
    _ctx.save(true);
  }

  /* ══════════════════════════════════════════════════════
     INIT
  ══════════════════════════════════════════════════════ */

  function init(ctx) {
    _ctx = ctx;
    document.addEventListener('visibilitychange', () => { if (document.hidden) flush(); });
    window.addEventListener('pagehide', () => flush());
  }

  // Al cerrar el cuaderno o cambiar de pestaña: guardar y no dejar una
  // nota vacía abandonada (volver() ya lo hacía, cerrar el panel no).
  function salir() {
    flush();
    if (!C()) return;
    const eraNota = _vista.kind === 'page';
    _limpiarSiVacia();
    if (eraNota && !_pages().some(p => p.id === _vista.id)) {
      _destruirEditor();
      _vista = _pila.pop() || { kind: 'index' };
    }
  }

  // Al cambiar de personaje: la vista abierta ya no aplica.
  function reset() {
    flush();
    if (C()) _limpiarSiVacia();
    _destruirEditor();
    _vista = { kind: 'index' };
    _pila = [];
    _buscar = '';
  }

  return {
    init, render, reset, flush, salir,
    nuevaNota, abrirNota, abrirEntidad, volver, borrarNota,
    renombrar, cambiarTipo, buscar, deshacer, rehacer,
    _elegir, _abrirMencion,
    // Expuesto para pruebas y para el Codex
    TIPOS, _reindexar, _docDesdeTexto,
  };
})();
