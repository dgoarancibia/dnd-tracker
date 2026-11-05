# Contexto del proyecto (para retomar en otra sesión, PC o cuenta)

Tracker de personajes D&D **2024** (PHB 2024 + SRD 5.2) hecho como PWA en JS vanilla, sin build.
Publicado en https://dgoarancibia.github.io/dnd-tracker/ (GitHub Pages desde `main`).
Diego lo usa en iPad (split view), Mac y Windows. Juega online con Roll20 y dos pantallas.

## Personajes de Diego

| Personaje | Clase | Notas |
|---|---|---|
| Torvald Ironhollow | Explorador 3, Beast Master | Compañero Grum (bestia de tierra) |
| Lursey Brumaclara | Clérigo 7, Dominio de la Paz | Se reconstruye desde `Characters.buildLursey()` |
| Aztram | Guerrero 5, Echo Knight | |

## Archivos

| Archivo | Qué es |
|---|---|
| `index.html` | Inicio: lista de personajes, sync con la nube, diagnóstico de sync |
| `app.html` + `js/app.js` | Ficha jugable (pestañas, modales, Roll20) |
| `js/characters.js` | Datos de reglas: clases, subclases, rasgos, conjuros (`CLASE_SPELLS`), dotes, `calcArma`, `buildLursey` |
| `js/storage.js` | localStorage, papelera |
| `js/cloud.js` + `js/firebase.js` | Sync con Firestore (`users/{uid}/characters`, tombstones en `users/{uid}/deleted`) |
| `js/roll20_es.js` | Diccionario inglés→español solo para lo que se copia a Roll20 |
| `js/bastion.js` | Pestaña Bastión (DMG 2024): instalaciones, órdenes, turnos, Charms como recursos, Storehouse. Datos en `c.bastion`; la pestaña solo aparece si existe |
| `js/tema.js` + `css/tema.css` | Selector de Apariencia (Clásico `dark`, Pizarra y latón `slate-brass`, Pergamino `light`). Se carga en `<head>` de index y app para pintar ya con tema. Guarda en `dnd_theme` y `dnd_theme_v1` (antes cada página usaba una; al leer gana `dnd_theme`). Inválido → Clásico. `ficha.html` (ficha compartida con el DM) conserva su paleta propia |
| `css/pergamino.css` + `assets/pergamino/` | Tema Pergamino (bitácora): papel miel con grano, cuero con costura y remaches, granate en acciones primarias y pestaña activa, grabados de armas (`.arma-ic[data-grabado]`, `_grabadoArma`), medallón del compañero (`.companion-emoji[data-bestia]`) y motivos de cabecera ≥1280px: estandarte para todos, montañas + huella solo si `html[data-clase="Explorador"]`. Solo colores y adornos: no cambia tamaños ni posiciones |
| `css/onix.css` + `assets/onix/` + `js/iconos.js` + `assets/iconos/` | Tema Ónix y granate (estilo D&D Beyond): marcos con chaflán por `border-image` (no cambian tamaños), características con modificador grande y puntaje en óvalo, CA en escudo, emblema de clase de fondo. `iconos.js` agrega íconos grabados de game-icons.net (CC BY 3.0, créditos en `assets/iconos/CREDITOS.md`) junto a los emoji (`.emo-orig` + `.ico`); cada tema decide cuál se ve (hoy solo Ónix muestra los íconos). |
| `js/mesa.js` + `css/mesa.css` | Vista **Mesa (beta)**, opcional: menú ⋯ → Ajustes → "Ficha: Actual / Mesa" (`localStorage dnd_vista`, por dispositivo; `html[data-vista="mesa"]`). Agrega cabecera en una franja (PG, Daño/Curar, CA, INIC, VEL, COMP, CD, turno y descansos), columna fija de tiradas (características, salvaciones, 18 habilidades, pasivas; clic en escritorio copia a Roll20) y paneles nuevos de Combate (por Acción / Adicional / Reacción) y Conjuros (espacios, filtros, lista; tocar abre cómo lanzarlo). Lo de siempre queda en el DOM, oculto; Ítems, Habilidades, Bastión y Biblioteca se ven igual. Toda acción llama a `App.*` (`castSpell`, `castOptions`, `attackWithWeapon`, `adjustResource`…), así que las reglas son las mismas. `app.js` llama `Mesa.render()` al guardar, al cambiar de pestaña y al pintar la cabecera |
| `js/hojas.js` | Notetaker "Hojas" (TipTap empaquetado en `js/vendor/`, fuente en `tools/tiptap/`) |
| `sw.js` | Service worker (caché offline) |
| `firestore.rules` | Reglas de Firestore: se publican a mano en la consola Firebase |

## Cómo publicar un cambio

1. `./bump.sh` sube la versión del SW (`sw.js`, `_SW_EXPECTED` en app.html/index.html, manifest).
2. Subir a mano los `?v=` en `app.html` / `index.html` de cada JS/CSS que cambió (si no, iPad sirve la versión vieja).
3. Si agregas un archivo nuevo, añádelo al precache de `sw.js` y corre `node tools/check_sw.js`.
4. `node tools/check_rules.js` valida invariantes de reglas (sale 1 si hay error).
5. Commit en español, corto. **Push solo cuando Diego lo pida.**

## Pruebas

- Servidor local: `node serve.js` → http://localhost:5500 (configurado en `.claude/launch.json`).
- `npm install` una vez (instala `puppeteer-core`). Usan el Chrome instalado; si no está en la ruta por defecto: `CHROME_PATH=... node tools/e2e/<x>.js`.
- **Sync (Firebase simulado, dos "dispositivos")**, deben terminar en `TODO OK`:
  - `lista.js`: crear, bajar, duplicados, borrar y restaurar entre dispositivos.
  - `lista2.js`: lo mismo con tombstones sin permiso (`SINPERMISO=1`).
  - `lista_tarde.js`: Firebase carga tarde (caso Safari).
  - `conflicto.js`: conflicto de versiones al abrir.
- **Funciones** (imprimen resultados para revisar a ojo; capturas en `tools/e2e/out/`):
  - `r20.js` y `es.js`: copias para Roll20 en español; botones solo en desktop.
  - `rasgos.js`: rasgos de los 3 personajes.
  - `lursey.js`: Lursey en nivel 6 vs 7.
  - `potente.js`: trucos con Potent Spellcasting.
  - `stats.js`: el popup de stats refresca la ficha.
  - `paquetes.js`: la mochila cerrada de Torvald se abre en objetos (solo él) y el wizard muestra el contenido de los paquetes (termina en `TODO OK`).
  - `stonecunning.js`: Stonecunning como recurso del Enano con usos = BC, también en Lursey (termina en `TODO OK`).
  - `competencia.js`: un arma sin competencia no suma BC al ataque; Lursey (Protector) sí (termina en `TODO OK`).
  - `municion.js`: atacar con un arco equipado desde la mochila descuenta flechas (termina en `TODO OK`).
  - `bastion.js`: bastión de Lursey: cupos por nivel, Storehouse con recargo, turno registrado y Charm del Sanctuary (termina en `TODO OK`).
  - `tema.js`: preferencias viejas, persistencia inicio→ficha, cambio en vivo sin perder pestaña/scroll, teclado, iPad 600px y auditoría de contraste WCAG en Pizarra (Lursey y Torvald, todas las pestañas, vida crítica, combate, aviso y diálogo). Capturas `tema_*.png` (termina en `TODO OK`).
  - `pergamino.js`: contraste sobre el papel más oscuro (`#C4A47C`) en todas las pestañas y estados, adornos sin interceptar toques, grabados/medallón, ficha sin arma ni compañero, 375/480/560 px, recursos offline (termina en `TODO OK`). `pergamino_capturas.js [carpeta]` saca las capturas de revisión. `contraste.js` es la auditoría WCAG compartida con `tema.js`.
  - `menu.js`: menú ⋯ de la ficha con grupos plegables (Partida, Guardado y respaldo, Ajustes) que recuerdan su estado (`dnd_menu_grupos`), altura limitada con scroll en 1440×600/600/375, flotantes escondidos con el menú abierto y Deshacer = un cambio (termina en `TODO OK`).
  - `onix.js`: tema Ónix: contraste en todas las pestañas y estados, íconos en lugar de emoji y vuelta atrás al cambiar de tema, características estilo D&D Beyond, CA en escudo, menú con 4 temas, 600/375 sin scroll horizontal, offline (termina en `TODO OK`).
  - `contraste.js` trata un símbolo suelto (★ ● + −) como ícono de control (3:1) y, con `peorFondo`, usa ese color en lugar del fondo del body. Antes tenía un bug: con un hex devolvía siempre 0 problemas.
  - `mesa.js`: vista Mesa: por defecto no aparece; el menú la activa y se recuerda; lanzar Bless gasta espacio, marca la Acción y la concentración; otro de concentración pregunta antes sin gastar; truco sin espacio; Channel Divinity y Daño; Torvald con Grum y ataque de oportunidad (Reacción); contraste en Clásico y Ónix; 1180 y 390 sin scroll lateral; botón Tiradas en celular; desactivarla devuelve la ficha de siempre (termina en `TODO OK`).
  - `hojas_diario.js`: el cuaderno abre en Hojas; el diario de chat pasa a hojas por sesión con hora y menciones enlazadas, sin duplicar; Notas rápidas sigue (termina en `TODO OK`).
  - `turno.js`: en combate, Atacar descuenta ataques; la mano secundaria usa la Acción adicional salvo con Nick; usar un recurso marca su activación (termina en `TODO OK`).
- Ojo: el autosave pisa ediciones al recargar; para recargar un personaje modificado usa `App.reloadChar(c)`.

## Incidente de sincronización (2026-11-05)

En el iPad, con la conexión lenta, Torvald y Aztram se fueron a la papelera como "borrados en otro dispositivo". Causa: `getDocs` devolvía sin error lo que Firestore tenía en memoria (solo Lursey, recién guardada) y `sincronizarLista` tomó a los demás como faltantes en la nube. Arreglo: `loadAllCharsCloud`, `loadDeletedCloud` y `loadCharCloud` usan `getDocsFromServer`/`getDocFromServer` (fallan si no llegan al servidor y la sincronización no toca nada); `tools/check_sw.js` lo verifica. El diagnóstico ya no dice "falta en la nube" cuando la nube no respondió. Se recuperaron desde la papelera.

## Reglas que no se negocian (decisiones de Diego)

- **Nunca tirar dados en la app**: su DM no lo permite. Roll20 recibe comandos (`&{template:default}`, `[[1d20+5]]`, `&{tracker}`) y tira allá.
- Botones de Roll20 **solo en desktop** (`.solo-desktop`); no ocupar espacio en móvil.
- La app muestra nombres en inglés con el español entre paréntesis (`_nmEs`). Las copias a Roll20 van **solo en español**.
- Cambios responsive: solo responsive. Antes de cambios de UX/UI, preguntar.
- Sin contador obligatorio de rondas ni temporizadores reales. El Turn Assistant informa qué es legal, nunca recomienda.
- Español latino (nada de "vosotros"). Términos oficiales del SRD en español: Grappled = **Agarrado**, Restrained = **Apresado**.

## Fuentes de reglas

- **No usar aidedd.org**: sirve contenido 2014 con URLs de 2024 (falló 3 veces: Primal Companion, Favored Enemy, Hunter's Mark).
- Verificar siempre con **dos** fuentes:
  - SRD 5.2.1 (EN/ES).
  - JSON XPHB de 5etools: `raw.githubusercontent.com/5etools-mirror-3/5etools-src`.
  - `dnd2024.wikidot.com`, solo páginas individuales.
  - Compendio de Roll20 2024.
  - rpgbot 2024.
- Si las fuentes discrepan, decírselo a Diego; no promediar.

## Decisiones de mesa de Lursey (no "corregir" a RAW)

- **CD de conjuros 16 y ataque de conjuros +8**: el +1 a ambos es del **Amulet of the Devout +1** (Tasha's, Clérigo/Paladín; verificado en 5etools y dnd5e.wikidot). Antes figuraba como "Arcane Grimoire": era una etiqueta equivocada, Lursey no tiene grimorio (Diego, 2026-11-05). El amuleto además da 1 Channel Divinity gratis por día (vuelve al amanecer). En la app: `_normalizarAmuletoDevoto` (app.js, al abrir la ficha) convierte el recurso propio que lo anotaba en `amulet-devout` (1 uso, descanso largo, `usaPara: 'channel-divinity'`); en Mesa, Channel Divinity ofrece "✦ Gratis con Amulet of the Devout" y sigue disponible aunque no le queden usos.
- **Blessed Strikes (nv7)**: eligió Potent Spellcasting (`choices['blessed-strikes']='bs-potent-spellcasting'`). La app suma SAB al daño de trucos y escala trucos ×2/×3/×4 en niveles 5/11/17.
- **Servirse del poder divino** y **Versatilidad de trucos** (Tasha's, no existen en 2024) quedan como **regla de mesa**, marcadas en el texto.
- **Divine Order: Protector** (`choices['divine-order']='protector'`): competente con armas marciales y armadura pesada (Maza de Guerra +1, Cota de malla).
- **Bastión** (agregado a la mesa en 2026-11): Lursey tiene `c.bastion` (se crea vacío en su sync). La app no tira eventos del bastión: los tira el DM. Reglas auditadas contra el DMG 2024 cap. 8 (5etools `book-xdmg.json` + `bastions.json`, y dnd2024.wikidot): Maintain es para todo el bastión y excluye otras órdenes; ausente = Maintain; Barrack/Garden/Stable/Training Area son repetibles.
- **Temas**: Pizarra y latón se ajusta solo en `css/tema.css` con `:root[data-theme="slate-brass"]`; Clásico y Pergamino no se tocan. Colores fijos en JS que deban variar en Pizarra usan `var(--x, colorClásico)` (p. ej. `--hp-crit`, `--gratis`).
- **Pergamino, sistema de controles** (auditoría UX, nov-2026): plano, sin bisel. Granate lleno solo para la acción principal y lo elegido (pestaña, chip, Land/Sea/Sky); lo secundario es un velo de tinta sin borde (`--velo`); campos en línea (nombre del compañero, HP máx) son una línea, no una caja. Texto secundario `#4F3626` (el `#634630` original no llegaba a 4.5:1 en la viñeta, Diego lo aprobó). Los emoji se tiñen de tinta: `js/tema.js` los envuelve en `.emo` con un MutationObserver solo en Pergamino. Colores fijos en JS usan `var(--x, colorClásico)` (`--moneda-*`, `--con-bonus`, `--hp-bar-*`). Ningún texto bajo 10px (bloque al final de style.css).
- **Vista Mesa** (nov-2026, en prueba): Diego la pidió como modo aparte "por si no me gusta"; la vista actual no se toca. Diseño elegido en `tools/e2e/out/mockup6/` (tema Clásico): tres columnas, tiradas siempre a la vista, el combate ordenado por tipo de acción. Roll20 nunca en las filas: solo dentro del detalle que se abre al tocar, y solo en escritorio. Una sola pantalla para todos los personajes: se arma con los datos (armas equipadas, conjuros por tiempo de lanzamiento, recursos por su `action`, compañero si existe); por clase solo cambia el orden de los bloques. Diego usa el iPad en horizontal (1180×820): ahí el turno pasa a la barra de pestañas. Primera entrega: Combate y Conjuros; las otras pestañas, después. Decidido después (nov-2026): en Mesa no va la iniciativa; Habilidades es la "configuración del personaje" (maestrías de arma y recursos propios arriba, la pestaña de siempre debajo); la ficha completa de la bestia se abre dentro de Combate (`App.mesaHTML.companion()`), sin volver a la vista de siempre. Conjuros aún enlaza a su vista completa para preparar o agregar.
- **Vista Mesa, dos modos** (nov-2026): la pestaña Combate cambia según `App.enCombate()`. Fuera de combate muestra Ayudar en una prueba, Rasgos, Rituales (sin espacio si está preparado), Preparación y utilidad y "Tu guía antes de pelear" (de `c.ifttt`); lanzar ahí usa `via 'other'` y no marca el turno. En combate, las columnas por tipo de acción con todos los conjuros a la vista; lo que no se puede usar baja a "No disponible ahora" con el motivo (sin espacios, ya usaste tu Acción…). Solo informa: usarlo igual sigue pidiendo confirmación. Pestañas en Mesa: Combate, Conjuros, Ítems, Habilidades y lo demás.
- **Mesa, auditoría de Torvald** (nov-2026): compañero nativo (Tierra/Mar/Cielo con íconos `bestia-mar`/`bestia-cielo`, nombre y animal editables, rasgos plegados, Revivir si cae) en lugar del bloque antiguo con emoji; nota rápida y cuaderno pasan a la cabecera (sin flotantes en Mesa); versión oculta y guardado en chico; fuera de combate no muestra bloques sin nada usable; "Ayudar en una prueba" solo lo que suma (1d4 o ventaja a pruebas), no lo que obliga a hacer una (Entangle); ataque de oportunidad con cualquier arma cuerpo a cuerpo equipada; condiciones: solo las activas, el resto al desplegar.
- **Mesa, rasgos sin usos y Echo Knight** (nov-2026): los rasgos activos sin recurso (`type: 'active'`) aparecen en su columna con "Usar" que marca el turno; Manifest Echo es "Invocar eco" / "Eco activo" (`App.toggleEcho`, gasta la Acción adicional; CA 14 + BC). Recursos que se usan "al hacer la acción de Ataque" (Unleash Incarnation) van en Acción con la marca CON ATAQUE, y los "sin acción" (Action Surge) con SIN ACCIÓN. Las opciones de Channel Divinity (rasgos con `source` "Channel Divinity…") no van sueltas: son botones dentro de la fila de Channel Divinity y cada una gasta un uso.
- **Daño sumado** (nov-2026): `App.sumarDaño` junta dados iguales y números ("1d10+4 + 2" → "1d10+6"); lo usan el popup de ataque y Mesa. Lo que lleva tipo ("1d6 fuego") queda aparte.
- **Mesa, munición y turno** (nov-2026): la munición es el ítem de la mochila (Ítems) cuyo nombre la nombra ("Virotes", "Crossbow Bolts"…; no el carcaj ni el estuche). Se agrega o quita solo en Ítems; Mesa la muestra en el nombre del arma, "Heavy Crossbow (10)". Atacar resta 1 a ese ítem; `c.ammo[key].spent` solo cuenta lo disparado para recuperar la mitad. "Virotes (20)" con cantidad 1 se convierte en "Virotes" ×20 al cargar. Lo bloqueado solo porque ya usaste esa acción queda a la vista (atenuado, con el motivo); "usada · ↺ devolver" la devuelve y, si es la Acción, también los ataques (`Mesa.turno`).
- **Ónix sin rosado** (nov-2026): el acento de texto pasó de granate claro `#EC7C83` (se veía rosado) a oro viejo `#D9AE62`; el granate (`--granate-vivo`) queda para lo relleno.
- **War Caster (Lursey)**: Reactive Spell del PHB 2024 (verificado en 5etools XPHB y dnd2024.wikidot): cuando una criatura sale de tu alcance, en vez del ataque de oportunidad gastas la Reacción en un conjuro de 1 Acción que tenga como objetivo solo a esa criatura (truco o con espacio). `App.castSpell(id, nivel, 'reaction')` gasta la Reacción en lugar de la Acción. En Mesa sale en Reacción como "Conjuro de oportunidad", sin conjuros de área ni de aliados.
- Dominio de la Paz: reglas de clase 2024 con subclase Tasha's. Para clérigos nuevos, la subclase y sus rasgos llegan en nv3.

## Pendientes conocidos

- **Catálogo de conjuros incompleto** frente al PHB 2024 (conteo de 2026-09):

  | Clase | En la app | PHB 2024 aprox. |
  |---|---|---|
  | Mago | 80 | ~180 |
  | Druida | 38 | ~110 |
  | Bardo | 35 | ~110 |
  | Brujo | 27 | ~70 |

  Clérigo y Hechicero tienen de más. Faltan conjuros SRD de Druida: Elementalism, Message, Spare the Dying, Ice Knife, Protection from Evil and Good y Purify Food and Drink. Si Diego crea un personaje de esas clases, avisarle.
- **Backlog del Ranger** (HU-17 a HU-47), en 7 fases en este orden. Fases 1 a 4 hechas (2026-11-02; HU-19 auditoría descartada por Diego). Quedan la 5 (Turn Assistant), la 6 salvo HU-35/38 y la 7 salvo HU-40.
  1. Integridad: HU-17 a HU-19.
  2. Motor de turno: HU-20, HU-21, HU-44 (metadata de activación) y HU-45 (estado por turno).
  3. Combate Beast Master: HU-22 a HU-27.
  4. Hunter's Mark: HU-28 a HU-32.
  5. Turn Assistant: HU-33, HU-34, HU-46 y HU-47.
  6. Descansos y conjuros: HU-35 a HU-39.
  7. Inmersión: HU-40 a HU-43.
- **Épica Hojas** (notetaker estilo Notion):
  - Diseño:
    - Editor TipTap empaquetado, sin CDN.
    - Entidades compartidas con el Codex (`c.entities`, tipos `npc`/`quest`/`lugar`).
    - Comandos `/` en español con alias en inglés (`/lugar`=`/map`, `/mision`=`/quest`, `/objeto`=`/item`, `/faccion`=`/faction`, `/pendiente`=`/todo`, `/importante`=`/star`).
    - El índice de menciones se reconstruye al guardar.
  - **Hojas es el diario definitivo** (Diego, nov-2026): el cuaderno abre en Hojas, sin "beta". El chat quedó como pestaña "Notas rápidas" (el 📝 flotante sigue escribiendo ahí). `Hojas.importarDiario()` pasa las entradas del chat a hojas, una por sesión (o por día), con la hora en negrita y las menciones como @menciones; recuerda las pasadas en `c.diarioEnHojas` para no duplicar. Verificar teclado y selección en iPad.
  - Fases:
    1. Editor, `@`, página de entidad, renombrar.
    2. `/` de entidades, sesión, búsqueda, pegar markdown.
    3. Relaciones, referencias no vinculadas, IA con confirmación.
