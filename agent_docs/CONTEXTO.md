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
  - `municion.js`: atacar con un arco equipado desde la mochila descuenta flechas (termina en `TODO OK`).
- Ojo: el autosave pisa ediciones al recargar; para recargar un personaje modificado usa `App.reloadChar(c)`.

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

- **CD de conjuros 16**: el +1 del Arcane Grimoire es solo para Mago, pero el DM lo permite.
- **Blessed Strikes (nv7)**: eligió Potent Spellcasting (`choices['blessed-strikes']='bs-potent-spellcasting'`). La app suma SAB al daño de trucos y escala trucos ×2/×3/×4 en niveles 5/11/17.
- **Servirse del poder divino** y **Versatilidad de trucos** (Tasha's, no existen en 2024) quedan como **regla de mesa**, marcadas en el texto.
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
- **Modelar la competencia con armas** (hoy no se valida).
- **Backlog del Ranger** (HU-17 a HU-47), en 7 fases en este orden. Las fases 1 y 2 son prerequisito.
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
  - El diario actual no se toca hasta que Diego confirme que Hojas lo reemplaza. Verificar teclado y selección en iPad.
  - Fases:
    1. Editor, `@`, página de entidad, renombrar.
    2. `/` de entidades, sesión, búsqueda, pegar markdown.
    3. Relaciones, referencias no vinculadas, IA con confirmación.
