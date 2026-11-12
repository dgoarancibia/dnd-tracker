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
  - `druida.js`: Druida Warforged del Círculo de la Tierra: nv1, Primal Order, terrenos, Land's Aid y Wild Shape (termina en `TODO OK`).
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
- **Mesa, munición y turno** (nov-2026): la munición es el ítem de la mochila (Ítems) cuyo nombre la nombra ("Virotes", "Crossbow Bolts"…; no el carcaj ni el estuche), salvo que el arma tenga uno asignado en Ítems → tocar el arma → Munición (`w.municion`, id o nombre del ítem; así sirve "Carcaj"). Se agrega o quita solo en Ítems; Mesa la muestra en el nombre del arma, "Heavy Crossbow (10)". Atacar resta 1 a ese ítem; `c.ammo[key].spent` solo cuenta lo disparado para recuperar la mitad. "Virotes (20)" con cantidad 1 se convierte en "Virotes" ×20 al cargar. Lo bloqueado solo porque ya usaste esa acción queda a la vista (atenuado, con el motivo); "usada · ↺ devolver" la devuelve y, si es la Acción, también los ataques (`Mesa.turno`).
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
- **Loading no se aplica** (nov-2026): con Extra Attack la app da los 2 ataques aunque el arma tenga Loading (2024: un disparo por acción salvo Crossbow Expert; verificado en D&D Beyond free rules 2024 y dnd2024.wikidot). Decisión de Diego: queda libre y lo restringe él en la mesa; Torvald va a tomar Crossbow Expert.
- **Conjuros en Mesa: espacio y efecto** (nov-2026): cada conjuro muestra el espacio que gasta ("Nv 3"; "Nv 2↑" si se acabaron los de su nivel y usa uno más alto; "Gratis") y su daño o curación grande ("2d8", "♥ 2d4+4", "+1d4" para bonos) con cuánto escala ("+2d8/nv", "+1 objetivo/nv"). Cualquier conjuro se puede lanzar con un espacio superior aunque no tenga mejora (regla PHB): sin espacios de su nivel sigue disponible si quedan más altos; sin ninguno se pliega en "No disponible ahora". Los trucos raciales (Spare the Dying de Lursey) no cuentan para el límite de trucos.
- **Druida 2024 + Círculo de la Tierra + Warforged** (nov-2026, para el nuevo PJ de Diego): rasgos del Druida reescritos a 2024 (Wild Shape desde nv2 con 2/3/4 usos y recarga `short1`, subclase en nv3, Primal Order como elección `primal-order` de nv1 — Mago suma un truco en `getCantripsKnown` —, Wild Companion, Wild Resurgence, Elemental Fury `elemental-fury` en nv7, Archdruid 2024). Speak with Animals siempre preparado por Druidic (sync en `_syncCharData`, como Hunter's Mark). Círculo de la Tierra 2024: `c.landType` (`arid`/`polar`/`temperate`/`tropical`, `TERRENOS_TIERRA`), `subclassSpells(nivel, c)` arma los conjuros del terreno con `buscarConjuroPorNombre` (marcados `land`, se quitan al cambiar) y `App.setLandType`. Como en el PHB, el terreno se cambia solo al terminar un descanso largo: el modal del descanso trae los chips (`lrElegirTerreno`) y Mesa solo muestra el terreno elegido (los botones aparecen únicamente si aún no hay ninguno); Land's Aid y Nature's Sanctuary son rasgos con `usa:'wild-shape'` que Mesa muestra con el daño grande y el botón que descuenta el uso sin marcar la Acción adicional (`adjustResource(id, -1, true)`). Warforged de *Forge of the Artificer* (2025): Constructo, `acBonus: 1` sumado en `calcCA`, resistencia a veneno. Catálogo de Druida completo (135 conjuros PHB 2024; 15 entradas de 2014 corregidas). Wild Shape: `c.wildShape = { conocidas, activa }`, 36 bestias del SRD 5.2.1 en `BESTIAS_WILD_SHAPE` (VD ≤ 1; Águila/Búho gigantes son Celestiales en 2024, no sirven), límites por nivel en `limiteWildShape`; en forma la CA es la de la bestia, se suman PG temporales = nivel de Druida y los conjuros quedan bloqueados (salvo nv18). Equipo inicial 2024 del Druida (A o 50 po).
- **Pícaro 2024** (nov-2026, para un PJ próximo de Diego, subclase sin decidir): rasgos de clase reescritos a 2024 (Cunning Strike nv5 con `GOLPES_ASTUTOS`, Reliable Talent y Evasion en nv7, Improved Cunning Strike nv11, Devious Strikes nv14, Slippery Mind nv15 —el sync agrega SAB y CAR a las salvaciones—, Stroke of Luck nv20 como recurso de descanso corto). Subclases del PHB 2024 reescritas o creadas: Arcane Trickster, Assassin, Soulknife (`psionic-energy`, recarga `short1`) y Thief; las de Xanathar's/Tasha's quedan como estaban (decisión de Diego). Equipo inicial 2024 (A o 100 po). El Pícaro ya no tiene `spellcastingStat`: solo el Arcane Trickster lanza (INT, lista de Mago sin escuelas vía `CLASE_SPELLS['Pícaro'] = CLASE_SPELLS['Mago']`, `esArcaneTrickster`, `AT_PREPARADOS`/`AT_TRUCOS`, Mage Hand gratis como `subclassSpells`); `calcMulticlassSlots` trata Arcane Trickster y Eldritch Knight como tercio de lanzador (monoclase redondea hacia arriba) y `getMaxSpellLevel(clase, nivel, char)` recibe el personaje. En Mesa: tarjeta de Ataque furtivo arriba a la derecha (dados que quedan tras elegir efectos de Cunning Strike, CD, 1 vez por turno con `c.turn.furtivo` vía `App.marcarFurtivo`), Cunning Action como chips en la columna Adicional (Fast Hands del Thief suma dos), Hojas psíquicas del Soulknife como filas de ataque. Catálogo de Mago completo en niveles 0–4 (151 conjuros PHB 2024, 29 entradas de 2014 corregidas; 5–9 sigue incompleto). `_baseArma` reconoce armas por su nombre en español (Roll20Es): antes una "Daga" no era Sutil y atacaba con FUE.
  - `picaro.js`: nv1, Thief nv5 (furtivo, Cunning Strike, chips), nv7/14/15, Arcane Trickster nv7, Soulknife nv5 y Assassin nv3 (termina en `TODO OK`).
- **Aztram a nivel 6 con Sentinel** (nov-2026): Polearm Master, Sentinel y Shield Master pasados a su texto 2024. En Mesa, con un arma cuerpo a cuerpo en la mano principal: Polearm Master agrega "Golpe con el extremo" (Adicional, d4 + el mismo bono fijo; espera a que ataques) y "Ataque reactivo" (Reacción); Sentinel agrega "Guardián (Sentinel)" en Reacción y la nota de velocidad 0 en el ataque de oportunidad. No se valida el tipo de arma (lanza/bastón/Pesada+Alcance): lo controla Diego. Bug corregido en el asistente: tocar directo el botón de característica de una dote la seleccionaba pero borraba el +1.
  - `aztram6.js`: Aztram nv5 (Polearm Master, FUE 19) sube a nv6 por el asistente con Sentinel +1 FUE (termina en `TODO OK`).
- **Tiradas de muerte y Eco en Mesa** (nov-2026): con 0 PG, Mesa muestra arriba de la columna derecha la tarjeta de tiradas de muerte (3 éxitos / 3 fallos sobre `c.deathSaves`, botones por resultado del d20; nat 20 cura 1 PG y limpia), minimizable con `st.grupos 'muerte'` y que vuelve abierta en la siguiente caída. Echo Knight: tarjeta morada "Eco" en la columna derecha (invocar de un toque, activo con CA 14 + BC, 1 PG, 9 m, Unleash Incarnation, Intercambiar, Descartar; el botón dice solo "Invocar"; la tabla de Larry se eliminó a pedido de Diego), distintivo "Eco" con ícono `assets/iconos/eco.svg` (sin emojis) junto al nombre y la fila del eco teñida (`.mesa-op[data-id="eco"]`). En armas, el dado ignora texto como "+FUE" escrito a mano (el modificador ya lo suma `calcArma`).
  - `muerte.js` y `eco.js` (terminan en `TODO OK`).
- **Guerrero 2024 en Mesa** (nov-2026): Mente Táctica va bajo las tiradas ("Si fallas una prueba"), con un chip que gasta 1 Second Wind sin marcar la Adicional (solo si la prueba pasó con el 1d10); la fila de Second Wind recuerda Tactical Shift (½ velocidad sin ataques de oportunidad). En Mesa no se usan emojis como íconos: van SVG de `assets/iconos` (tienen que estar en el precache de `sw.js`).
- **Mesa sin modo "fuera de combate" separado** (nov-2026, decisión de Diego): las columnas Acción / Adicional / Reacción se ven siempre, porque fuera de combate también se usan cosas (Second Wind, eco, pruebas). "Iniciar combate" solo activa el control del turno (chips disponible/usada en cada columna, ataques 0/N, Fin de turno). Fuera de combate se agregan debajo de las columnas Ayudar en una prueba, Otros rasgos (recursos que no están en las columnas), Rituales, Preparación y utilidad y la guía (`_fuera(c, enColumnas)` devuelve `{ arriba, abajo }`).
- **Aztram: Unleash Incarnation, maestría y Raven Queen** (nov-2026): `App.usarUnleash` gasta un uso (solo con el eco activo) y suma `c.turn.ataquesEco`, que `_ataquesDelTurno` agrega al máximo de la acción de Ataque (la fila del arma muestra "ataques 0/3 (incluye 1 extra de Unleash)"). Atacar desde el eco (`Mesa.atacarDesdeEco`, botón en la fila del arma con el eco activo) gasta uno de los ataques normales: solo cambia el origen. La fila de cada arma recuerda su maestría ("Sap · si aciertas: …") vía `App.maestriaArma`: la elegida en `c.weaponMasteries` o, si no eligió ninguna y tiene el rasgo `weapon-mastery*`, la `mastery` del arma (armas propias como la Dragon's Wrath). `App.usarBendicionCuervo` (Shadar-Kai) gasta un uso y la Adicional; desde nv3 pone `c.resistTodo`: chip "½ daño ✕" en la cabecera, `adjustHP` aplica la mitad del daño y se quita al segundo "Fin de turno" (no hay evento de inicio de turno), al terminar el combate o tocando el chip.
  - `aztram_extras.js` (termina en `TODO OK`).
- **PG al subir de nivel** (nov-2026, decisión de Diego): el campo del asistente es el resultado del dado (o la suma de dados si sube varios niveles), prellenado con el valor fijo; `_luHPTotal` suma mod CON y bonus de especie por nivel (mínimo 1 por nivel) y la ayuda muestra la cuenta ("7 (dado) + 2 (CON) = 9 PG"). Antes se sumaba tal cual lo escrito y si ponía solo el dado se perdía la CON.
