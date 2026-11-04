# Encargo de pruebas para Codex

Objetivo: **probar** el tracker y entregar un reporte de bugs. No corrijas código salvo que Diego lo pida; si corriges, hazlo en una rama y sin push.

## 1. Qué es

PWA en JS vanilla, sin build ni framework, para D&D **2024** (PHB 2024 + DMG 2024 + SRD 5.2). Se usa en iPad (split view), Mac y Windows, junto a Roll20.
- Repo público: https://github.com/dgoarancibia/dnd-tracker (rama `main`)
- Producción: https://dgoarancibia.github.io/dnd-tracker/
- Arquitectura y decisiones: `agent_docs/CONTEXTO.md` (léelo entero antes de empezar).

Módulos (todos son IIFE globales, cargados con `<script>` en `app.html`):

| Global | Archivo | Rol |
|---|---|---|
| `Characters` | `js/characters.js` | Datos de reglas: clases, subclases, rasgos, conjuros, dotes, armas (`calcArma`), `buildLursey` |
| `Storage` | `js/storage.js` | localStorage (`dnd_chars_v1`, `dnd_active_v1`), papelera, backups |
| `Cloud` / Firebase | `js/cloud.js`, `js/firebase.js` | Sync con Firestore (módulo ES desde gstatic). Opcional: la app funciona como invitado |
| `App` | `js/app.js` | Ficha jugable: pestañas, modales, combate, descansos, Roll20 |
| `Bastion` | `js/bastion.js` | Pestaña Bastión (DMG 2024 cap. 8) |
| `Hojas` | `js/hojas.js` | Notetaker con TipTap (`js/vendor/tiptap.min.js`) |
| `Biblioteca`, `Maps` | `js/biblioteca.js`, `js/maps.js` | Biblioteca de reglas y mapas |
| `R20ES` | `js/roll20_es.js` | Traducción EN→ES de lo que se copia a Roll20 |

Pantallas: `index.html` (lista de personajes, login, diagnóstico de sync) → `app.html` (ficha). Pestañas de la ficha: combate, habilidades, conjuros, equipo, bastión (solo si `c.bastion` existe), biblioteca.

## 2. Levantarla

```bash
npm install
node serve.js            # http://localhost:5500
```

- Sin cuenta: en `index.html` entra como invitado, o pon `localStorage.dnd_guest='1'`.
- Para abrir la ficha directo: guarda el personaje con `Storage.saveChar(c)`, luego `Storage.setActiveId(id)` y `sessionStorage.dnd_playing='1'`, y navega a `/app.html`.
- Personaje de referencia: `Characters.buildLursey()` (Clérigo 7, Paz, con bastión). También puedes crear uno con `Characters.createNew(nombre, clase)`.
- Sin red, Firebase no carga y la app debe seguir funcionando local. Eso también es algo que probar.

## 3. Pruebas automáticas existentes

Usan `puppeteer-core` con el Chrome instalado. Si Chrome está en otra ruta, usa `CHROME_PATH=/ruta/chrome`. Si no hay Chrome, instálalo con `npx @puppeteer/browsers install chrome@stable` y apunta `CHROME_PATH` a ese binario. Para correr contra otro servidor, usa `APP_URL=...`.

Estas deben terminar en `TODO OK`:

```bash
for t in lista lista2 lista_tarde conflicto paquetes stonecunning competencia municion bastion turno tema pergamino menu onix; do echo "== $t"; node tools/e2e/$t.js | tail -3; done
```

Estas imprimen resultados para revisar a ojo y dejan capturas en `tools/e2e/out/`: `r20`, `es`, `rasgos`, `lursey`, `potente` y `stats`.

Chequeos estáticos (salen con código 1 si hay error):

```bash
node tools/check_sw.js      # todo archivo usado está en el precache del SW
node tools/check_rules.js   # invariantes de reglas
```

## 4. Qué probar a mano / con scripts nuevos

Prioridad alta, porque es lo más reciente:

1. **Bastión** (`js/bastion.js`, personaje Lursey):
   - Especiales por nivel: 2/4/5/6 en niveles 5/9/13/17. No permite instalaciones de nivel mayor. Las únicas repetibles son Barrack, Garden, Stable y Training Area.
   - Maintain es una orden para todo el bastión: desactiva las órdenes de cada instalación y queda registrado en el historial.
   - "Registrar turno" guarda el turno y limpia las órdenes. Aviso de Neglect: tantos turnos seguidos sin órdenes como el nivel del personaje.
   - Storehouse:
     - Tope de compra: 500 / 2.000 / 5.000 GP en niveles 5 / 9 / 13.
     - Recargo de venta: +10 / 20 / 50 / 100 % en niveles 5 / 9 / 13 / 17.
   - "Descanso largo en el bastión" crea los Charms como recursos (`charm-<tipo>`, 1 uso). No duplica un Charm que todavía tiene usos.
   - Instalaciones básicas: costos de agregar (Cramped 500/20 días, Roomy 1.000/45, Vast 3.000/125) y de agrandar (Cramped→Roomy 500/25, Roomy→Vast 2.000/80).
   - Verifica contra el DMG 2024 cap. 8 con dos fuentes (5etools `book-xdmg.json` / `bastions.json` y dnd2024.wikidot). Si una regla está mal, cita la fuente.
2. **Economía del turno en combate** (`_gastarAtaque`, `_costoAtaque` y `_gastarActivacionRecurso` en app.js):
   - Fuera de combate no se descuenta nada.
   - Con Extra Attack hay 2 ataques. El tercero pide confirmación.
   - La mano secundaria usa la Acción adicional, salvo con la maestría Nick.
   - Gastar un recurso marca su activación (acción, acción adicional o reacción). Devolver un uso no marca nada.
3. **Botón de combate**:
   - El ⚔️ flotante solo aparece en combate.
   - El botón ⚔️ del header inicia el combate y abre el panel, y muestra la ronda.
   - Mientras escribes en un campo, los botones flotantes se ocultan (`body.escribiendo`).
   - Los botones flotantes no tapan contenido al final de cada pestaña (padding inferior de 96px).

Regresión general:

4. **Persistencia y sync**: crear, editar, borrar, papelera y restaurar. Recargar no pierde datos. Ojo: el autosave pisa ediciones hechas por consola al recargar, así que usa `App.reloadChar(c)`.
5. **Descansos** corto y largo: recursos según `recharge`, espacios de conjuro, dados de golpe y concentración.
6. **Conjuros**:
   - Preparados del día.
   - CD 16 en Lursey: es regla de mesa, no la corrijas.
   - Trucos con Potent Spellcasting (+SAB, ×2 en nivel 5).
7. **Equipo**:
   - Ataque y daño de armas.
   - Sin competencia no se suma el BC.
   - La munición se descuenta.
   - Los paquetes de la mochila se abren.
8. **Roll20**:
   - Las copias van solo en español.
   - Los botones solo aparecen en desktop (`.solo-desktop`); en móvil (375px) no deben verse ni ocupar espacio.
9. **Responsive**: iPad en split view (~500-700px de ancho), iPad completo (1024) y desktop (1440). Que no haya scroll horizontal.
10. **Service worker / offline**: tras la primera carga, la app funciona sin red. `_SW_EXPECTED` coincide con la versión de `sw.js`.
11. **Hojas**: crear página, menciones `@` y comandos `/` en español (`/lugar`, `/mision`, `/objeto`, `/faccion`, `/pendiente`, `/importante`).
12. **Consola**: sin errores (`pageerror`) en ninguna pestaña.

## 5. No son bugs (decisiones de Diego)

- La app **no tira dados** a propósito. Genera comandos para Roll20 (`[[1d20+5]]`, `&{template:default}`).
- Lursey:
  - CD 16.
  - Potent Spellcasting.
  - "Servirse del poder divino" y "Versatilidad de trucos", marcadas como regla de mesa.
  - Divine Order Protector.
- Los nombres en la app van en inglés con el español entre paréntesis.
- No hay contador obligatorio de rondas ni temporizadores. El Turn Assistant informa, no recomienda.
- El catálogo de conjuros está incompleto para Mago, Druida, Bardo y Brujo (ya se sabe; ver CONTEXTO.md).
- Los eventos del bastión los tira el DM, no la app.

## 6. Formato del reporte

Un archivo `agent_docs/REPORTE_CODEX.md` con una tabla por severidad:

| # | Severidad (crítica/alta/media/baja) | Área | Pasos para reproducir | Esperado | Obtenido | Archivo:línea probable |
|---|---|---|---|---|---|---|

Además:
- La salida de las pruebas automáticas, con cuáles pasaron y cuáles fallaron.
- Si escribiste scripts nuevos, déjalos en `tools/e2e/` con el mismo estilo (puppeteer-core, `require('./entorno')`, que terminen en `TODO OK`).
- Para bugs de reglas, la cita de las dos fuentes.
