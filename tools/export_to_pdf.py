#!/usr/bin/env python3
"""
D&D Tracker → Character Sheet PDF exporter (campos llenables)
Uso: python3 export_to_pdf.py <personaje.json> [output.pdf] [plantilla.pdf]

Exportá el JSON desde la app: Menú ⋯ → Exportar hoja PDF.
La plantilla Lursey.pdf (con campos llenables) debe estar en la misma carpeta,
o pasarla como tercer argumento.
"""

import sys, os, json, math
from pypdf import PdfReader, PdfWriter
from pypdf.generic import NameObject, create_string_object, BooleanObject

# ── Helpers ──────────────────────────────────────────────────────────────────
def mod(s):        return math.floor((s - 10) / 2)
def fmt(n):        return f"+{n}" if n >= 0 else str(n)
def prof_bonus(n): return math.ceil(n / 4) + 1

SKILL_STAT = {
    "acrobacia":        "des",
    "sigilo":           "des",
    "prestidigitacion": "des",
    "atletismo":        "for",
    "arcana":           "int",
    "historia":         "int",
    "investigacion":    "int",
    "naturaleza":       "int",
    "religion":         "int",
    "perspicacia":      "sab",
    "medicina":         "sab",
    "percepcion":       "sab",
    "supervivencia":    "sab",
    "trato-animales":   "sab",
    "interpretacion":   "car",
    "engano":           "car",
    "intimidacion":     "car",
    "actuacion":        "car",
    "persuasion":       "car",
}


# ── Parchear campos directamente ─────────────────────────────────────────────
def patch_fields(reader, field_values, xy_values=None, xy_rename=None):
    """
    1. Limpia TODOS los campos del PDF (borra valores previos del template)
    2. Llena los campos usando dos mecanismos:
       - xy_values: list de (field_name, x_min, x_max, y_min, y_max, value)
         Siempre se evalúa por posición exacta — funciona con campos duplicados
         y también con campos sin nombre (field_name='')
       - field_values: dict {field_name: value} — fallback para campos con nombre único
    3. xy_rename: list de (field_name, x_min, x_max, y_min, y_max, new_name, value)
       Renombra el /T del campo a new_name (para evitar colisiones de nombre en el AcroForm)
    Modifica el reader in-place.
    """
    if xy_values is None:
        xy_values = []
    if xy_rename is None:
        xy_rename = []

    cleared = 0
    patched = 0

    for page in reader.pages:
        annots_obj = page.get("/Annots")
        if not annots_obj:
            continue
        annots = annots_obj.get_object()
        for annot_ref in list(annots):
            annot = annot_ref.get_object()
            t_raw = annot.get("/T")
            t     = str(t_raw) if t_raw is not None else ""
            ft_raw = annot.get("/FT")
            ft     = str(ft_raw) if ft_raw else ""

            # Obtener posición
            rect = annot.get("/Rect")
            ax, ay = 0, 0
            if rect:
                try:
                    r = rect.get_object()
                    ax = float(str(r[0]))
                    ay = float(str(r[1]))
                except Exception:
                    pass

            # 0) Renombrar campo si coincide con xy_rename (ANTES de limpiar/llenar)
            for (fname, xmin, xmax, ymin, ymax, new_name, new_val) in xy_rename:
                if t == fname and xmin <= ax <= xmax and ymin <= ay <= ymax:
                    annot[NameObject("/T")] = create_string_object(new_name)
                    t = new_name  # usar nuevo nombre para el resto del procesamiento
                    # Agregar como xy_value para llenado posterior
                    xy_values = list(xy_values) + [(new_name, xmin, xmax, ymin, ymax, new_val)]
                    break

            # 1) Limpiar siempre (solo campos con tipo de campo definido o con /T)
            if ft or t:
                if ft == "/Btn":
                    annot[NameObject("/V")]  = NameObject("/Off")
                    annot[NameObject("/AS")] = NameObject("/Off")
                elif ft == "/Tx":
                    annot[NameObject("/V")] = create_string_object("")
                    if "/AP" in annot:
                        del annot[NameObject("/AP")]
                cleared += 1

            # 2) Buscar valor por posición (prioridad alta — cubre campos con nombre duplicado y sin nombre)
            matched_val = None
            for (fname, xmin, xmax, ymin, ymax, val) in xy_values:
                if t == fname and xmin <= ax <= xmax and ymin <= ay <= ymax:
                    matched_val = val
                    break

            # 3) Fallback a field_values por nombre (solo si tiene nombre)
            if matched_val is None and t and t in field_values:
                matched_val = field_values[t]

            if matched_val is not None:
                val_str = str(matched_val)
                if ft == "/Btn":
                    v = NameObject(val_str if val_str.startswith("/") else "/Off")
                    annot[NameObject("/V")]  = v
                    annot[NameObject("/AS")] = v
                else:
                    annot[NameObject("/V")] = create_string_object(val_str)
                    if "/AP" in annot:
                        del annot[NameObject("/AP")]
                patched += 1

    return cleared, patched


# ── Cálculos ─────────────────────────────────────────────────────────────────
def calc_skill(sk_id, stats, sk_p, sk_e, prof):
    s_stat = SKILL_STAT.get(sk_id, "int")
    is_exp = sk_id in sk_e
    is_p   = sk_id in sk_p or is_exp
    mult   = 2 if is_exp else (1 if is_p else 0)
    return mod(stats.get(s_stat, 10)) + prof * mult


def calc_save(stat_key, stats, sv_p, prof):
    is_p = stat_key in sv_p
    return mod(stats.get(stat_key, 10)) + (prof if is_p else 0)


# ── Fill PDF ─────────────────────────────────────────────────────────────────
def fill_pdf(char, template_path, output_path):
    reader = PdfReader(template_path)

    nivel  = char.get("nivel", 1)
    prof   = prof_bonus(nivel)
    stats  = char.get("stats", {})
    sk_p   = char.get("skillProfs", []) or []
    sk_e   = char.get("skillExpertise", []) or []
    sv_p   = char.get("savingThrows", []) or []

    fv = {}   # field_values a llenar

    # ── CABECERA ─────────────────────────────────────────────────────────────
    fv["Text Box 1"] = char.get("name", "")
    fv["Text Box 2"] = char.get("trasfondo", "") or ""
    fv["Text Box 3"] = char.get("clase", "")
    fv["Text Box 4"] = char.get("raza", "") or ""
    fv["Text Box 5"] = char.get("subclase", "") or ""
    fv["Level"]      = str(nivel)
    fv["XP"]         = str(char.get("xp", 0) or 0)

    # ── CA ───────────────────────────────────────────────────────────────────
    armor   = char.get("armor", {}) or {}
    base_ca = armor.get("base_ca", 10)
    dex_add = mod(stats.get("des", 10)) if armor.get("add_dex") else 0
    shield  = armor.get("shield_bonus", 0) if armor.get("shield") else 0
    ca      = base_ca + dex_add + shield
    fv["AC"] = str(ca)

    # ── HP ───────────────────────────────────────────────────────────────────
    hp = char.get("hp", {}) or {}
    fv["Current HP"] = str(hp.get("current", 0))
    fv["Max HP"]     = str(hp.get("max", 0))
    fv["Temp HP"]    = str(hp.get("temp", 0) or 0)

    # ── HIT DICE ─────────────────────────────────────────────────────────────
    hd      = char.get("hitDice", {}) or {}
    hit_die = char.get("hitDie", 8)
    fv["Hit Dice Spent"] = f"{hd.get('current', nivel)}d{hit_die}"
    fv["Hit Dice Max"]   = str(nivel)

    # ── PROF / SPEED / PASSIVE PERCEPTION / INITIATIVE ───────────────────────
    fv["Prof Bonus"]         = f"+{prof}"
    fv["Speed"]              = f"{char.get('velocidad', 30) or 30} ft"
    perc_p = "percepcion" in sk_p
    fv["Passive Perception"] = str(10 + mod(stats.get("sab", 10)) + (prof if perc_p else 0))
    fv["Text Box 59"]        = fmt(mod(stats.get("des", 10)))   # Initiative

    # ── STATS: scores ─────────────────────────────────────────────────────────
    # Numeric Field positions (confirmadas del PDF real):
    # NF2 (x=170, y=669) = INT   NF3 (x=65, y=585) = STR   NF4 (x=65, y=457) = DEX
    # NF5 (x=170, y=479) = WIS   NF6 (x=65, y=298) = CON   NF7 (x=170, y=292) = CHA
    fv["Numeric Field 2"] = str(stats.get("int", 10))
    fv["Numeric Field 3"] = str(stats.get("for", 10))
    fv["Numeric Field 4"] = str(stats.get("des", 10))
    fv["Numeric Field 5"] = str(stats.get("sab", 10))   # WIS (right col, y=479)
    fv["Numeric Field 6"] = str(stats.get("con", 10))   # CON (left col, y=298)
    fv["Numeric Field 7"] = str(stats.get("car", 10))   # CHA (right col, y=292)

    # ── STATS: modifiers ──────────────────────────────────────────────────────
    # Confirmados por análisis posicional del PDF:
    # Text Box 6    (x=138, y=673) = INT mod
    # Strength Mod  (x=34,  y=591) = STR mod
    # Text Box 20   (x=138, y=486) = WIS mod  ← NO es WIS save (eso es Text Box 26)
    # Text Box 27   (x=34,  y=305) = DEX mod  (template val=2 con DEX=14 ✓)
    # Text Box 34   (x=133, y=205) = CON mod
    # Text Box 26   (x=133, y=364) = WIS save (sobrescrito abajo en saving throws)
    # Text Box 28   (x=28,  y=264) = CHA save (sobrescrito abajo en saving throws)
    fv["Text Box 6"]   = fmt(mod(stats.get("int", 10)))
    fv["Strength Mod"] = fmt(mod(stats.get("for", 10)))
    fv["Text Box 20"]  = fmt(mod(stats.get("sab", 10)))   # WIS mod (junto a NF5=WIS)
    fv["Text Box 27"]  = fmt(mod(stats.get("des", 10)))   # DEX mod
    fv["Text Box 34"]  = fmt(mod(stats.get("con", 10)))   # CON mod
    # TB26 = WIS save → se asigna en sección Saving Throws (sobrescribe si hay)
    fv["Text Box 28"]  = fmt(mod(stats.get("car", 10)))   # CHA mod (sobreescrito por CHA save)

    # ── SAVING THROWS ─────────────────────────────────────────────────────────
    # Col izquierda (x<60): STR=TB13(y=551), DEX=TB14(y=531), CON=TB19(y=372)
    # Col derecha (x~133):  INT=TB7(y=634),  WIS=TB26(y=364), CHA=TB28(y=264)
    # NOTA: TB20(y=486)=WIS MOD, TB26(y=364)=WIS SAVE (junto a Check Box 17)
    fv["Text Box 13"] = fmt(calc_save("for", stats, sv_p, prof))
    fv["Text Box 14"] = fmt(calc_save("des", stats, sv_p, prof))
    fv["Text Box 19"] = fmt(calc_save("con", stats, sv_p, prof))
    fv["Text Box 7"]  = fmt(calc_save("int", stats, sv_p, prof))
    fv["Text Box 26"] = fmt(calc_save("sab", stats, sv_p, prof))  # WIS save (TB26, y=364)
    fv["Text Box 28"] = fmt(calc_save("car", stats, sv_p, prof))  # CHA save (sobrescribe mod)

    # ── SKILLS ────────────────────────────────────────────────────────────────
    # Col izquierda (STR/DEX):
    fv["Text Box 15"] = fmt(calc_skill("atletismo",        stats, sk_p, sk_e, prof))
    fv["Text Box 16"] = fmt(calc_skill("acrobacia",        stats, sk_p, sk_e, prof))
    fv["Text Box 17"] = fmt(calc_skill("prestidigitacion", stats, sk_p, sk_e, prof))
    fv["Text Box 18"] = fmt(calc_skill("sigilo",           stats, sk_p, sk_e, prof))
    # Col derecha (INT):
    fv["Text Box 8"]  = fmt(calc_skill("arcana",           stats, sk_p, sk_e, prof))
    fv["Text Box 9"]  = fmt(calc_skill("historia",         stats, sk_p, sk_e, prof))
    fv["Text Box 12"] = fmt(calc_skill("investigacion",    stats, sk_p, sk_e, prof))
    fv["Text Box 10"] = fmt(calc_skill("naturaleza",       stats, sk_p, sk_e, prof))
    fv["Text Box 11"] = fmt(calc_skill("religion",         stats, sk_p, sk_e, prof))
    # Col derecha (WIS):
    fv["Text Box 21"] = fmt(calc_skill("trato-animales",   stats, sk_p, sk_e, prof))
    fv["Text Box 22"] = fmt(calc_skill("perspicacia",      stats, sk_p, sk_e, prof))
    fv["Text Box 23"] = fmt(calc_skill("medicina",         stats, sk_p, sk_e, prof))
    fv["Text Box 24"] = fmt(calc_skill("supervivencia",    stats, sk_p, sk_e, prof))
    fv["Text Box 25"] = fmt(calc_skill("percepcion",       stats, sk_p, sk_e, prof))
    # Col derecha (CHA):
    fv["Text Box 29"] = fmt(calc_skill("engano",           stats, sk_p, sk_e, prof))
    fv["Text Box 30"] = fmt(calc_skill("intimidacion",     stats, sk_p, sk_e, prof))
    fv["Text Box 31"] = fmt(calc_skill("interpretacion",   stats, sk_p, sk_e, prof))
    fv["Text Box 32"] = fmt(calc_skill("actuacion",        stats, sk_p, sk_e, prof))
    fv["Text Box 33"] = fmt(calc_skill("persuasion",       stats, sk_p, sk_e, prof))

    # ── PROFICIENCY CHECKBOXES ────────────────────────────────────────────────
    # Named buttons (confirmados en el PDF)
    fv["History Proficiency"]          = "/Yes" if "historia"      in sk_p else "/Off"
    fv["Religion Proficiency"]         = "/Yes" if "religion"      in sk_p else "/Off"
    fv["Arcana Proficiency"]           = "/Yes" if "arcana"        in sk_p else "/Off"
    fv["Investigation Proficiency"]    = "/Yes" if "investigacion" in sk_p else "/Off"
    fv["Nature Proficiency"]           = "/Yes" if "naturaleza"    in sk_p else "/Off"
    fv["Int Saving Throw Proficiency"] = "/Yes" if "int"           in sv_p else "/Off"
    fv["Inspiration"]                  = "/Yes" if char.get("inspiration") else "/Off"

    # Check Boxes (posición confirmada del análisis PDF de Lursey):
    # Derecha WIS area (y desc): CB20(y=444)=1ª WIS skill, CB21(y=424)=2ª...
    # Template /Yes: CB20=Perspicacia(Insight), CB17=WIS save, CB24=CHA save, CB27=Persuasion
    # Izquierda STR/DEX: CB8(y=549)=STR save, CB9(y=528)=DEX save, CB16(y=369)=CON save
    skill_cb_map = {
        # Named buttons (tienen nombre descriptivo)
        "Check Box 1":  ("skill", "historia"),
        "Check Box 10": ("skill", "religion"),
        # WIS skills (col derecha, de arriba a abajo): perspicacia primero según template
        "Check Box 20": ("skill", "perspicacia"),  # y=444 → 1ª WIS skill (Insight/Perspicacia)
        # WIS save: Check Box 17 (y=362, junto a TB26)
        "Check Box 17": ("save",  "sab"),
        # CHA skills/saves: Check Box 24=Deception area, CB27=Persuasion
        "Check Box 24": ("save",  "car"),          # y=256 → CHA save
        "Check Box 27": ("skill", "persuasion"),   # y=189 → Persuasion
    }
    for cb, (tipo, key) in skill_cb_map.items():
        lista = sv_p if tipo == "save" else sk_p
        fv[cb] = "/Yes" if key in lista else "/Off"

    # ── ARMOR PROFICIENCY ────────────────────────────────────────────────────
    armor_name_lower = armor.get("name", "").lower()
    fv["Medium Armor"] = "/Yes" if any(x in armor_name_lower for x in ("cota","malla","escamas")) else "/Off"

    # ── ARMAS ────────────────────────────────────────────────────────────────
    # Mapeo confirmado del PDF:
    # Text Box 35-40 = nombre del arma (35=1ª, 36=2ª ...)
    # Text Box 53-58 = bono de ataque
    # Text Box 47-52 = daño (die)
    # Text Box 41-46 = notas
    weapons = char.get("weapons", []) or []
    name_fields  = ["Text Box 35", "Text Box 36", "Text Box 37",
                    "Text Box 38", "Text Box 39", "Text Box 40"]
    bonus_fields = ["Text Box 53", "Text Box 54", "Text Box 55",
                    "Text Box 56", "Text Box 57", "Text Box 58"]
    dmg_fields   = ["Text Box 47", "Text Box 48", "Text Box 49",
                    "Text Box 50", "Text Box 51", "Text Box 52"]
    note_fields  = ["Text Box 41", "Text Box 42", "Text Box 43",
                    "Text Box 44", "Text Box 45", "Text Box 46"]

    for i in range(6):
        if i < len(weapons):
            w = weapons[i]
            fv[name_fields[i]]  = w.get("name", "")
            fv[bonus_fields[i]] = w.get("bonus", "") or ""
            fv[dmg_fields[i]]   = w.get("die", "") or ""
            fv[note_fields[i]]  = w.get("notes", "") or ""
        else:
            fv[name_fields[i]]  = ""
            fv[bonus_fields[i]] = ""
            fv[dmg_fields[i]]   = ""
            fv[note_fields[i]]  = ""

    # ── WEAPON & TOOL PROFS ───────────────────────────────────────────────────
    fv["Weapon Profs"] = char.get("weaponProfs", "") or "Armas simples, armas marciales"
    fv["Tool Profs"]   = char.get("toolProfs", "") or ""

    # ── CLASS FEATURES ────────────────────────────────────────────────────────
    features = char.get("features", []) or []
    feat_lines = []
    for f in features:
        if isinstance(f, dict):
            name = f.get("name", "")
            src  = f.get("source", "")
            desc = f.get("desc", "")
            if desc:
                feat_lines.append(f"{name} ({src}): {desc}")
            elif src:
                feat_lines.append(f"{name} — {src}")
            else:
                feat_lines.append(name)
        else:
            feat_lines.append(str(f))
    fv["Class Features 1"] = "\n".join(feat_lines[:6])
    fv["Class Features 2"] = "\n".join(feat_lines[6:])

    # ── SPECIES TRAITS ────────────────────────────────────────────────────────
    fv["Species Traits"] = char.get("speciesTraits", "") or \
        "Resistencia enana · Visión en la penumbra 18 m · Comp. armas enanas · Resistencia a venenos"

    # ── FEATS ────────────────────────────────────────────────────────────────
    feats = char.get("feats", []) or []
    feat_text_parts = []
    for f in feats:
        if isinstance(f, dict):
            t = f.get("name", "")
            d = f.get("desc", "")
            feat_text_parts.append(f"{t}: {d}" if d else t)
        else:
            feat_text_parts.append(str(f))
    fv["Feats"] = "\n".join(feat_text_parts) if feat_text_parts else ""

    # ── EQUIPMENT (página 2) ──────────────────────────────────────────────────
    # Text1 y Text2 se llenan más abajo, junto con los conjuros (en xy)

    # ── IDIOMAS ──────────────────────────────────────────────────────────────
    langs = char.get("languages", []) or []
    fv["Languages Field"] = ", ".join(langs) if langs else "Común, Enano"

    # ── BACKSTORY → va en Text2 (y=690, campo pequeño arriba pág 2) ──────────
    # Text5 (y=194, campo grande) = EQUIPMENT
    back_parts = []
    if char.get("deity"):     back_parts.append(f"Deidad: {char['deity']}")
    if char.get("alignment"): back_parts.append(f"Alineamiento: {char['alignment']}")
    if char.get("notes"):     back_parts.append(char["notes"])
    fv["Text2"] = "\n".join(back_parts)

    # ── EQUIPMENT → va en Text5 (y=194-371, campo grande pág 2) ─────────────
    consumables = char.get("consumables", []) or []
    magic_items = char.get("magicItems", []) or []
    eq_lines = []
    for item in consumables + magic_items:
        if isinstance(item, dict):
            name = item.get("name", "")
            qty  = item.get("qty", 1) or 1
            eq_lines.append(f"×{qty} {name}" if qty > 1 else name)
        else:
            eq_lines.append(str(item))
    fv["Text5"] = "\n".join(eq_lines)

    # ── TAMAÑO ───────────────────────────────────────────────────────────────
    fv["Size Field"] = char.get("size", "") or "Mediano"

    # ── SPELLCASTING ─────────────────────────────────────────────────────────
    # Página 2, y=56: campos '0','1','2','3','4' en x=423,459,495,531,567
    # '0'=Spell Mod, '1'=Save DC, '2'=Attack Bonus
    sp_stat_key = char.get("spellcastingStat", "sab") or "sab"
    sp_mod = mod(stats.get(sp_stat_key, 10))
    sp_dc  = 8 + prof + sp_mod
    sp_atk = prof + sp_mod

    # ── CONJUROS ─────────────────────────────────────────────────────────────
    # Mapa exacto de columnas (confirmado del análisis):
    #   Nombre  x=46-153:   30 filas, PERO dos grupos de índices:
    #                       grupo A (cantrips) y=596,576,556,536 → idx '0'-'3'
    #                       grupo B (lvl 1+)  y=516,496,...,21  → idx '0'-'23' (reinicia)
    #   Nivel   x=24-37:    30 filas continuas idx '0'-'29' → y=595,576,...,20
    #   Casting x=160-234:  30 filas continuas idx '0'-'29'
    #   Notas   x=311-396:  30 filas continuas idx '0'-'29'
    # SOLUCIÓN: usar posición Y para identificar cada celda — ignorar idx

    # Y exactas de cada fila (confirmadas del análisis):
    # Nivel  (x=24): 595,576,556,536,517,497,477,457,437,417,397,377,358,338,317,297,278,258,239,219,200,180,159,139,119,99,79,60,40,20
    # Nombre (x=46): 596,576,556,536,516,496,476,457,436,417,397,377,358,338,318,298,278,259,239,219,199,179,158,139,119,99,80,60,41,21
    # (casi iguales ±2px)

    spell_rows_nivel  = [595,576,556,536,517,497,477,457,437,417,397,377,358,338,317,297,278,258,239,219,200,180,159,139,119,99,79,60,40,20]
    spell_rows_nombre = [596,576,556,536,516,496,476,457,436,417,397,377,358,338,318,298,278,259,239,219,199,179,158,139,119,99,80,60,41,21]
    spell_rows_cast   = [595,575,556,536,516,497,477,457,437,417,397,377,358,338,319,299,280,258,238,218,199,179,158,139,119,99,80,60,41,21]
    spell_rows_notas  = [595,576,555,536,515,496,476,457,436,417,397,377,357,338,319,298,278,258,239,219,199,179,159,139,120,99,80,61,40,20]

    spells   = char.get("spells", []) or []
    prepared = set(char.get("preparedToday", []) or [])

    def is_prepared(s):
        sid  = s.get("id", "")
        name = s.get("name", "")
        return sid in prepared or "◆" in name or "†" in name

    cantrips = [s for s in spells if s.get("level", 1) == 0]
    leveled  = sorted(
        [s for s in spells if s.get("level", 1) > 0 and is_prepared(s)],
        key=lambda s: s.get("level", 1)
    )
    all_spells = cantrips + leveled

    xy = []

    for i, sp in enumerate(all_spells[:30]):
        name = sp.get("name", "")
        lvl  = sp.get("level", 0)
        ct   = sp.get("castTime", "") or sp.get("castingTime", "") or sp.get("action", "") or ""
        rng  = sp.get("range", "") or ""

        # Nombre (x=46): usar y exacta de esa fila ±5
        yn = spell_rows_nombre[i]
        xy.append(("", 42, 157, yn - 5, yn + 15, name))   # campo sin nombre? No — tiene nombre numérico
        # En realidad tiene nombre numérico pero reinicia. Usamos campo con nombre '' NO.
        # Los campos de nombre TIENEN /T numérico. Usamos posición Y para desambiguar.
        # El campo tiene t='0','1','2' etc — usamos cualquier nombre que coincida con y
        # Para el grupo cantrip (filas 0-3): t='0','1','2','3'
        # Para el grupo nivel (filas 4+): t='0','1',... (reinicia desde 0)
        # Entonces la entrada xy debe usar el t correcto:
        if i < 4:
            name_t = str(i)          # cantrip grupo: t='0'-'3'
        else:
            name_t = str(i - 4)     # nivel grupo: t='0'-'25' (reinicia)

        # Reemplazar la entrada que acabamos de agregar con la correcta
        xy.pop()
        xy.append((name_t, 42, 157, yn - 5, yn + 15, name))

        # Nivel (x=24): índice continuo
        ynv = spell_rows_nivel[i]
        xy.append((str(i), 20, 42, ynv - 5, ynv + 15, str(lvl) if lvl > 0 else ""))

        # Casting time (x=160): índice continuo
        yc = spell_rows_cast[i]
        xy.append((str(i), 156, 238, yc - 5, yc + 15, ct))

        # Notas/rango (x=311): índice continuo
        yn2 = spell_rows_notas[i]
        xy.append((str(i), 307, 400, yn2 - 5, yn2 + 15, rng))

    # ── SPELL SLOTS ──────────────────────────────────────────────────────────
    # Layout confirmado del análisis del template:
    #   Fila 1 (y=695-704, top=88):  t='0'@x=187 = Nv1 slots, t='1'@x=276 y t='2'@x=356 = marcadores
    #   Fila 2 (y=680-690, top=102): t='0'@x=187 = Nv2 slots
    #   Fila 3 (y=666-676, top=116): t='0'@x=187 = Nv3 slots
    #   Template: Nv1=4, Nv2=3, Nv3=3 (coincide con Lursey nivel 6 max)
    # Los campos t='0','1','2' en x=23 top=52/81/109 son Spellcasting Mod/DC/Atk (se manejan en xy_rename)
    spell_slots = char.get("spellSlots", {}) or {}

    def _slot_val(key, field):
        s = spell_slots.get(str(key), {})
        if isinstance(s, dict):
            return s.get(field, 0) or 0
        return int(s or 0)

    # Usar xy para slots: cada fila = un nivel de slot, t='0' x=187 = el count
    # Fila 1 = Nv1, Fila 2 = Nv2, Fila 3 = Nv3 (renombramos t='0' por posición)
    slot_map = [
        ("0", 183, 205, 690, 706, _slot_val(1, "max")),   # Nv1
        ("0", 183, 205, 675, 691, _slot_val(2, "max")),   # Nv2
        ("0", 183, 205, 661, 677, _slot_val(3, "max")),   # Nv3
    ]
    for fname, xmin, xmax, ymin, ymax, val in slot_map:
        if val > 0:
            xy.append((fname, xmin, xmax, ymin, ymax, str(val)))

    # ── SPELLCASTING ABILITY (x=23) ──────────────────────────────────────────
    # NOTA: los campos t='0','1','2' en x=23 y=720,691,663 son los de Spellcasting
    # Modifier/DC/Atk. Se manejan via xy_rename más abajo.

    # ── MONEDAS ──────────────────────────────────────────────────────────────
    # Campos sin nombre (t='') en pág 2. Coordenadas EXACTAS del análisis plantilla:
    #   Columna izq  x=202.9-211.0: y=694(top), y=680(mid), y=665(bot)
    #   Columna mid  x=291.7-299.8: y=694(top), y=680(mid), y=665(bot)
    #   Columna der  x=371.3-379.4: y=694(top), y=680(mid), y=665(bot)
    # Orden visual D&D (confirmado por imagen): CP(izq-top), SP(mid-top), GP(izq-mid), PP(mid-mid)
    cur = char.get("currency", {}) or {}
    xy.extend([
        # Fila top (y≈694)
        ("", 202, 212, 692, 704, str(cur.get("cp", 0) or 0)),   # CP izq
        ("", 291, 301, 692, 704, str(cur.get("sp", 0) or 0)),   # SP mid
        ("", 371, 381, 692, 704, ""),                             # EP der
        # Fila mid (y≈680)
        ("", 202, 212, 677, 690, str(cur.get("gp", 0) or 0)),   # GP izq
        ("", 291, 301, 677, 690, str(cur.get("pp", 0) or 0)),   # PP mid
        ("", 371, 381, 677, 690, ""),                             # der
        # Fila bot (y≈665)
        ("", 202, 212, 663, 675, ""),
        ("", 291, 301, 663, 675, ""),
        ("", 371, 381, 663, 675, ""),
    ])

    # ── RESOURCES (en Class Features 2 si sobra espacio) ─────────────────────
    resources = char.get("resources", []) or []
    res_lines = []
    for r in resources:
        if isinstance(r, dict):
            name = r.get("name", "")
            curr = r.get("current", 0)
            maxv = r.get("max", 0)
            note = r.get("note", "")
            res_lines.append(f"{name}: {curr}/{maxv}  {note}")
    if res_lines:
        existing_f2 = fv.get("Class Features 2", "")
        separator = "\n\n" if existing_f2 else ""
        fv["Class Features 2"] = existing_f2 + separator + "RECURSOS\n" + "\n".join(res_lines)

    # ── SPELLCASTING ABILITY (x=23, top=52/81/109) ───────────────────────────
    # Confirmado del análisis: los campos t='0','1','2' en x=23 son los campos
    # VISIBLES de Spellcasting Ability (Modifier, DC, Attack Bonus).
    # Se distinguen de otros campos '0','1','2' por su posición y=720,691,663
    # RENOMBRARLOS para que no choquen con los spell level fields (x=24) y spell name fields
    xy_rename = [
        # Spellcasting Ability (x=23 y=720,691,663): los campos VISIBLES de la zona superior
        ("0", 19, 50, 715, 745, "__sp_mod__", fmt(sp_mod)),    # Spellcasting Modifier
        ("1", 19, 50, 687, 715, "__sp_dc__",  str(sp_dc)),     # Spell Save DC
        ("2", 19, 50, 659, 687, "__sp_atk__", fmt(sp_atk)),    # Spell Attack Bonus
        # Los campos fantasma x=423,459,495 también los renombramos para limpiarlos
        ("0", 419, 452, 50, 75, "__sp_mod2__", ""),
        ("1", 455, 490, 50, 75, "__sp_dc2__",  ""),
        ("2", 490, 525, 50, 75, "__sp_atk2__", ""),
    ]

    # ── PARCHEAR Y ESCRIBIR ───────────────────────────────────────────────────
    cleared, patched = patch_fields(reader, fv, xy, xy_rename)

    writer = PdfWriter()
    writer.append(reader)

    # ── Forzar regeneración de apariencias ────────────────────────────────────
    # NeedAppearances=True (booleano PDF real) obliga al visor a re-renderizar
    # los campos desde /V en lugar de usar los /AP streams del template
    try:
        root = writer._root_object
        if "/AcroForm" in root:
            acroform = root["/AcroForm"].get_object()
            acroform[NameObject("/NeedAppearances")] = BooleanObject(True)
    except Exception:
        pass

    # ── Eliminar /AP y generar streams de apariencia para campos críticos ─────
    # Algunos visores (Safari/Preview en iPad) ignoran NeedAppearances y
    # muestran el /AP stream pre-existente o el /V original del template.
    # Solución: borrar todos los /AP Y además inyectar un /AP stream propio
    # para los campos de spellcasting (los más problemáticos).
    from pypdf.generic import (
        ArrayObject, DictionaryObject, DecodedStreamObject, FloatObject,
        IndirectObject, RectangleObject
    )

    # Primero recolectar los campos que necesitan /AP custom
    sp_ap_fields = {}   # t_name → (rect, value_str, font_size)
    for page in writer.pages:
        annots_obj = page.get("/Annots")
        if not annots_obj:
            continue
        for aref in annots_obj.get_object():
            a = aref.get_object()
            t = str(a.get("/T", ""))
            if t in ("__sp_mod__", "__sp_dc__", "__sp_atk__"):
                rect = a.get("/Rect")
                v    = a.get("/V")
                da   = str(a.get("/DA", "/Helvetica 16 Tf 0 g"))
                if rect and v:
                    r = rect.get_object()
                    w = float(str(r[2])) - float(str(r[0]))
                    h = float(str(r[3])) - float(str(r[1]))
                    val_str = str(v)
                    # Extraer font size de DA (ej: "/Immortal 16 Tf 0 g" → 16)
                    font_size = 16
                    try:
                        parts = da.split()
                        for idx, p in enumerate(parts):
                            if p == "Tf" and idx >= 2:
                                font_size = float(parts[idx - 1])
                                break
                    except Exception:
                        pass
                    sp_ap_fields[t] = (w, h, val_str, font_size, da)

    # Generar /AP stream para esos campos y re-asignarlo
    for page in writer.pages:
        annots_obj = page.get("/Annots")
        if not annots_obj:
            continue
        for aref in annots_obj.get_object():
            a = aref.get_object()
            t = str(a.get("/T", ""))
            # Eliminar /AP de TODOS los campos
            if "/AP" in a:
                del a[NameObject("/AP")]
            # Inyectar /AP propio para los campos de spellcasting
            if t in sp_ap_fields:
                w, h, val_str, font_size, da = sp_ap_fields[t]
                # Calcular posición centrada del texto
                # y_pos: baseline aproximada (25% del alto)
                y_pos = h * 0.25
                # Ancho estimado del texto (heurística: font_size * 0.6 por char)
                text_w = len(val_str) * font_size * 0.55
                x_pos = max(1.0, (w - text_w) / 2)
                # Contenido del stream: BT ... ET centrado
                stream_content = (
                    f"BT\n"
                    f"{da}\n"
                    f"{x_pos:.2f} {y_pos:.2f} Td\n"
                    f"({val_str}) Tj\n"
                    f"ET\n"
                ).encode("latin-1")
                ap_stream = DecodedStreamObject()
                ap_stream.set_data(stream_content)
                ap_stream[NameObject("/Type")]    = NameObject("/XObject")
                ap_stream[NameObject("/Subtype")] = NameObject("/Form")
                ap_stream[NameObject("/BBox")]    = ArrayObject([
                    FloatObject(0), FloatObject(0),
                    FloatObject(w), FloatObject(h)
                ])
                ap_dict = DictionaryObject()
                ap_dict[NameObject("/N")] = writer._add_object(ap_stream)
                a[NameObject("/AP")] = ap_dict

    # ── SINCRONIZAR AcroForm con los valores ya parchados en anotaciones ─────
    # El AcroForm tiene 147 campos con nombres únicos. Los campos con nombres
    # duplicados ('0','1','2') son widgets huérfanos sin entrada en AcroForm.
    # Aun así, algunos viewers leen el /V del AcroForm field entry cuando hay
    # un field con ese nombre. Actualizamos el AcroForm para que coincida con
    # los /V de las anotaciones individuales (usando el primero encontrado
    # por cada nombre).
    try:
        root = writer._root_object
        if "/AcroForm" in root:
            acroform = root["/AcroForm"].get_object()
            fields = acroform.get("/Fields", [])
            # Construir mapa nombre→valor desde las anotaciones ya parchadas
            annot_vals = {}
            for page in writer.pages:
                annots_obj = page.get("/Annots")
                if not annots_obj:
                    continue
                for aref in annots_obj.get_object():
                    a = aref.get_object()
                    t = str(a.get("/T", ""))
                    v = a.get("/V")
                    if t and v is not None and t not in annot_vals:
                        annot_vals[t] = v
            # Actualizar cada AcroForm field
            for fref in fields:
                f = fref.get_object()
                t = str(f.get("/T", ""))
                if t in annot_vals:
                    f[NameObject("/V")] = annot_vals[t]
    except Exception as e:
        print(f"  (AcroForm sync skipped: {e})")

    with open(output_path, "wb") as f:
        writer.write(f)

    print(f"  Campos limpiados : {cleared}")
    print(f"  Campos llenados  : {patched}")
    return patched


# ── Main ─────────────────────────────────────────────────────────────────────
def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)

    char_json  = sys.argv[1]
    script_dir = os.path.dirname(os.path.abspath(__file__))

    if len(sys.argv) >= 4:
        tpl = sys.argv[3]
    else:
        candidates = [
            os.path.join(script_dir, "Lursey.pdf"),
            os.path.join(script_dir, "CharacterSheet_fillable.pdf"),
            os.path.expanduser("~/Downloads/Lursey.pdf"),
        ]
        tpl = next((p for p in candidates if os.path.exists(p)), None)
        if not tpl:
            print("ERROR: No se encontró la plantilla PDF con campos llenables.")
            for p in candidates:
                print(f"  {p}")
            sys.exit(1)

    out = sys.argv[2] if len(sys.argv) >= 3 else \
          os.path.join(os.path.dirname(char_json),
                       os.path.splitext(os.path.basename(char_json))[0] + "_sheet.pdf")

    print(f"Personaje : {char_json}")
    print(f"Plantilla : {tpl}")
    print(f"Output    : {out}")
    print()

    with open(char_json, encoding="utf-8") as f:
        char = json.load(f)

    n = fill_pdf(char, tpl, out)
    print(f"\n✓ PDF generado: {out}  ({n} campos llenados)")


if __name__ == "__main__":
    main()
