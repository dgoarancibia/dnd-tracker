#!/usr/bin/env python3
"""
D&D Tracker → Character Sheet PDF exporter
Uso: python3 export_to_pdf.py <personaje.json> [output.pdf]

El JSON de personaje lo exportás desde la app (botón "Exportar JSON").
El PDF de la hoja oficial (DnD_2024_Character-Sheet.pdf) debe estar en la
misma carpeta que este script, o podés pasarlo como tercer argumento.
"""

import sys
import os
import json
import math
from pypdf import PdfReader, PdfWriter
from pypdf.generic import NameObject
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
import io

# ─── Dimensiones del PDF oficial ───────────────────────────────────────────
PDF_W = 603.0
PDF_H = 774.0

# ─── Helpers ───────────────────────────────────────────────────────────────
def mod(score):
    return math.floor((score - 10) / 2)

def fmt_mod(score):
    m = mod(score)
    return f"+{m}" if m >= 0 else str(m)

def stat_val(char, stat):
    return char.get("stats", {}).get(stat, 10)

def prof_bonus(nivel):
    return math.ceil(nivel / 4) + 1

# Mapa de skills → stat
SKILL_STAT = {
    "acrobacia":     "des", "sigilo":        "des", "prestidigitacion": "des",
    "atletismo":     "for",
    "arcana":        "int", "historia":       "int", "investigacion":    "int",
    "naturaleza":    "int", "religion":       "int",
    "perspicacia":   "sab", "medicina":       "sab", "percepcion":       "sab",
    "supervivencia": "sab", "trato-animales": "sab",
    "engano":        "car", "intimidacion":   "car", "actuacion":        "car",
    "persuasion":    "car",
}

SKILL_LABELS_ES = {
    "acrobacia": "Acrobatics", "sigilo": "Stealth", "prestidigitacion": "Sleight of Hand",
    "atletismo": "Athletics",
    "arcana": "Arcana", "historia": "History", "investigacion": "Investigation",
    "naturaleza": "Nature", "religion": "Religion",
    "perspicacia": "Insight", "medicina": "Medicine", "percepcion": "Perception",
    "supervivencia": "Survival", "trato-animales": "Animal Handling",
    "engano": "Deception", "intimidacion": "Intimidation", "actuacion": "Performance",
    "persuasion": "Persuasion",
}

STAT_NAMES = {"for": "STR", "des": "DEX", "con": "CON", "int": "INT", "sab": "WIS", "car": "CHA"}

# ─── Clase de dibujo ────────────────────────────────────────────────────────
class SheetFiller:
    def __init__(self, char):
        self.char = char
        self.nivel = char.get("nivel", 1)
        self.prof = prof_bonus(self.nivel)

    def _txt(self, c, text, x, y, size=8, bold=False):
        """Dibuja texto. y en coordenadas PDF (0=abajo)."""
        font = "Helvetica-Bold" if bold else "Helvetica"
        c.setFont(font, size)
        c.setFillColorRGB(0, 0, 0)
        c.drawString(x, y, str(text))

    def _center(self, c, text, x, y, size=9, bold=False, width=30):
        font = "Helvetica-Bold" if bold else "Helvetica"
        c.setFont(font, size)
        c.setFillColorRGB(0, 0, 0)
        c.drawCentredString(x + width / 2, y, str(text))

    def _checkbox(self, c, x, y, checked, size=5):
        if checked:
            c.setFont("Helvetica-Bold", size)
            c.setFillColorRGB(0, 0, 0)
            c.drawString(x, y, "●")

    def build_page1(self):
        buf = io.BytesIO()
        c = canvas.Canvas(buf, pagesize=(PDF_W, PDF_H))
        char = self.char
        stats = char.get("stats", {})
        nivel = self.nivel
        prof = self.prof

        # ── Cabecera ──────────────────────────────────────────────────────
        self._txt(c, char.get("name", ""), 25, PDF_H - 45, size=10, bold=True)
        self._txt(c, char.get("trasfondo", ""), 25, PDF_H - 60, size=8)
        self._txt(c, char.get("clase", ""), 149, PDF_H - 60, size=8)
        self._txt(c, str(nivel), 275, PDF_H - 57, size=9, bold=True)
        self._txt(c, char.get("raza", ""), 25, PDF_H - 80, size=8)
        self._txt(c, char.get("subclase", ""), 149, PDF_H - 80, size=8)
        self._txt(c, str(char.get("xp", 0)), 272, PDF_H - 76, size=8)

        # ── AC / HP / Hit Dice ────────────────────────────────────────────
        armor = char.get("armor", {})
        base_ca = armor.get("base_ca", 10)
        add_dex = armor.get("add_dex", False)
        shield = armor.get("shield_bonus", 0) if armor.get("shield") else 0
        dex_mod = mod(stats.get("des", 10)) if add_dex else 0
        ca_total = base_ca + dex_mod + shield + char.get("bonuses", {}).get("ca", 0)

        self._center(c, str(ca_total), 318, PDF_H - 28, size=14, bold=True, width=40)

        hp = char.get("hp", {})
        self._center(c, str(hp.get("current", 0)), 390, PDF_H - 37, size=12, bold=True, width=50)
        self._center(c, str(hp.get("max", 0)), 430, PDF_H - 37, size=10, width=30)
        if hp.get("temp", 0):
            self._center(c, str(hp.get("temp", 0)), 432, PDF_H - 55, size=9, width=30)

        # Hit dice
        self._txt(c, f"{nivel}d{char.get('hitDie', 8)}", 497, PDF_H - 30, size=9, bold=True)
        hd = char.get("hitDice", {})
        self._txt(c, f"{hd.get('current', nivel)}/{nivel}", 493, PDF_H - 52, size=8)

        # Death saves
        death = char.get("deathSaves", {"successes": 0, "failures": 0})
        for i in range(death.get("successes", 0)):
            self._checkbox(c, 548 + i * 9, PDF_H - 53, True)
        for i in range(death.get("failures", 0)):
            self._checkbox(c, 548 + i * 9, PDF_H - 63, True)

        # ── Stats principales ─────────────────────────────────────────────
        # STR
        self._center(c, fmt_mod(stats.get("for", 10)), 14, PDF_H - 250, size=14, bold=True, width=35)
        self._center(c, str(stats.get("for", 10)), 19, PDF_H - 242, size=9, width=25)

        # DEX
        self._center(c, fmt_mod(stats.get("des", 10)), 14, PDF_H - 320, size=14, bold=True, width=35)
        self._center(c, str(stats.get("des", 10)), 19, PDF_H - 312, size=9, width=25)

        # CON
        self._center(c, fmt_mod(stats.get("con", 10)), 14, PDF_H - 467, size=14, bold=True, width=35)
        self._center(c, str(stats.get("con", 10)), 19, PDF_H - 459, size=9, width=25)

        # INT
        self._center(c, fmt_mod(stats.get("int", 10)), 120, PDF_H - 130, size=14, bold=True, width=35)
        self._center(c, str(stats.get("int", 10)), 125, PDF_H - 122, size=9, width=25)

        # WIS
        self._center(c, fmt_mod(stats.get("sab", 10)), 120, PDF_H - 300, size=14, bold=True, width=35)
        self._center(c, str(stats.get("sab", 10)), 125, PDF_H - 292, size=9, width=25)

        # CHA
        self._center(c, fmt_mod(stats.get("car", 10)), 120, PDF_H - 475, size=14, bold=True, width=35)
        self._center(c, str(stats.get("car", 10)), 125, PDF_H - 467, size=9, width=25)

        # ── Prof bonus / Init / Speed / Passive Perc ──────────────────────
        self._center(c, f"+{prof}", 14, PDF_H - 130, size=11, bold=True, width=35)

        init_val = mod(stats.get("des", 10)) + char.get("bonuses", {}).get("init", 0)
        self._center(c, fmt_mod(stats.get("des", 10)), 225, PDF_H - 130, size=11, bold=True, width=35)

        speed = char.get("velocidad", 30)
        self._center(c, str(speed), 320, PDF_H - 130, size=11, bold=True, width=40)

        # Passive perception = 10 + WIS mod + prof (si es proficient)
        perc_prof = "percepcion" in char.get("skillProfs", [])
        passive_perc = 10 + mod(stats.get("sab", 10)) + (prof if perc_prof else 0)
        self._center(c, str(passive_perc), 493, PDF_H - 130, size=11, bold=True, width=40)

        # Inspiration
        if char.get("inspiration"):
            self._checkbox(c, 28, PDF_H - 575, True, size=8)

        # ── Saving Throws (INT column) ─────────────────────────────────────
        save_stats = char.get("savingThrows", [])
        save_y_start = PDF_H - 195  # INT save top
        saves_order = ["int", "sab", "car"]  # columna derecha (INT section)
        for i, stat in enumerate(saves_order):
            is_prof = stat in save_stats
            sv_val = mod(stats.get(stat, 10)) + (prof if is_prof else 0)
            bonuses_all = char.get("bonuses", {}).get("savesAll", 0)
            sv_val += bonuses_all
            y_pos = save_y_start - i * 14
            self._checkbox(c, 131, y_pos + 1, is_prof, size=5)
            self._txt(c, fmt_mod_num(sv_val), 140, y_pos, size=8)

        # STR / DEX / CON saves (columna izquierda)
        str_save_y = PDF_H - 268
        left_saves = ["for", "des"]
        for i, stat in enumerate(left_saves):
            is_prof = stat in save_stats
            sv_val = mod(stats.get(stat, 10)) + (prof if is_prof else 0)
            sv_val += char.get("bonuses", {}).get("savesAll", 0)
            y_pos = str_save_y - i * 90
            self._checkbox(c, 26, y_pos + 1, is_prof, size=5)
            self._txt(c, fmt_mod_num(sv_val), 35, y_pos, size=8)

        # CON save
        con_is_prof = "con" in save_stats
        con_sv = mod(stats.get("con", 10)) + (prof if con_is_prof else 0)
        self._checkbox(c, 26, PDF_H - 535, con_is_prof, size=5)
        self._txt(c, fmt_mod_num(con_sv), 35, PDF_H - 535, size=8)

        # ── Skills (columna INT/WIS/CHA) ───────────────────────────────────
        skill_profs = char.get("skillProfs", [])
        skill_expert = char.get("skillExpertise", [])

        # Skills de la columna derecha (INT+WIS+CHA)
        int_skills = [
            ("arcana",     PDF_H - 207),
            ("historia",   PDF_H - 221),
            ("investigacion", PDF_H - 235),
            ("naturaleza",    PDF_H - 249),
            ("religion",      PDF_H - 263),
        ]
        wis_skills = [
            ("trato-animales", PDF_H - 381),
            ("perspicacia",    PDF_H - 395),
            ("medicina",       PDF_H - 409),
            ("percepcion",     PDF_H - 423),
            ("supervivencia",  PDF_H - 437),
        ]
        cha_skills = [
            ("engano",        PDF_H - 555),
            ("intimidacion",  PDF_H - 569),
            ("actuacion",     PDF_H - 583),
            ("persuasion",    PDF_H - 597),
        ]

        for sk_list in [int_skills, wis_skills, cha_skills]:
            for skill, y_pos in sk_list:
                s_stat = SKILL_STAT.get(skill, "int")
                is_prof = skill in skill_profs
                is_exp  = skill in skill_expert
                mult = 2 if is_exp else (1 if is_prof else 0)
                sv_val = mod(stats.get(s_stat, 10)) + prof * mult
                self._checkbox(c, 131, y_pos + 1, is_prof or is_exp, size=5)
                self._txt(c, fmt_mod_num(sv_val), 140, y_pos, size=8)

        # Skills de la columna izquierda (STR/DEX)
        str_skills = [("atletismo", PDF_H - 284)]
        dex_skills = [
            ("acrobacia",        PDF_H - 402),
            ("prestidigitacion", PDF_H - 416),
            ("sigilo",           PDF_H - 430),
        ]
        for sk_list in [str_skills, dex_skills]:
            for skill, y_pos in sk_list:
                s_stat = SKILL_STAT.get(skill, "des")
                is_prof = skill in skill_profs
                mult = 1 if is_prof else 0
                sv_val = mod(stats.get(s_stat, 10)) + prof * mult
                self._checkbox(c, 26, y_pos + 1, is_prof, size=5)
                self._txt(c, fmt_mod_num(sv_val), 35, y_pos, size=8)

        # ── Weapons ────────────────────────────────────────────────────────
        weapons = char.get("weapons", [])
        wy = PDF_H - 198
        for w in weapons[:6]:
            self._txt(c, w.get("name", "")[:22], 228, wy, size=7)
            self._txt(c, w.get("bonus", ""), 330, wy, size=7)
            self._txt(c, f"{w.get('die','—')} {w.get('type','')}".strip(), 380, wy, size=7)
            wy -= 19

        # ── Class Features (texto compacto) ────────────────────────────────
        features = char.get("features", [])
        feat_text = ""
        for f in features[:12]:
            name = f.get("name", "")
            src  = f.get("source", "")
            feat_text += f"• {name}"
            if src:
                feat_text += f" ({src})"
            feat_text += "\n"

        c.setFont("Helvetica", 6.5)
        c.setFillColorRGB(0, 0, 0)
        text_obj = c.beginText(337, PDF_H - 348)
        text_obj.setFont("Helvetica", 6.5)
        text_obj.setLeading(9)
        lines = feat_text.strip().split("\n")
        for line in lines[:28]:
            if len(line) > 52:
                line = line[:50] + "…"
            text_obj.textLine(line)
        c.drawText(text_obj)

        # ── Species Traits ─────────────────────────────────────────────────
        species_traits = char.get("speciesTraits", "Resistencia enana · Velocidad enana (30 ft con armadura pesada) · Competencia con armas enanas · Visión en la oscuridad 18 m")
        c.setFont("Helvetica", 6.5)
        text_obj2 = c.beginText(272, PDF_H - 590)
        text_obj2.setFont("Helvetica", 6.5)
        text_obj2.setLeading(9)
        for line in _wrap_text(species_traits, 32):
            text_obj2.textLine(line)
        c.drawText(text_obj2)

        # ── Equipment / Consumables ────────────────────────────────────────
        items = char.get("consumables", [])
        eq_y = PDF_H - 640
        c.setFont("Helvetica", 7)
        for item in items[:8]:
            name = item.get("name", "")
            qty  = item.get("qty", 1)
            c.drawString(16, eq_y, f"× {qty}  {name}")
            eq_y -= 10

        # Currency
        cur = char.get("currency", {})
        self._center(c, str(cur.get("cp", 0)), 16,  PDF_H - 760, size=8, width=30)
        self._center(c, str(cur.get("sp", 0)), 46,  PDF_H - 760, size=8, width=30)
        self._center(c, str(cur.get("gp", 0)), 76,  PDF_H - 760, size=8, width=30)
        self._center(c, str(cur.get("pp", 0)), 106, PDF_H - 760, size=8, width=30)

        # ── Armor name / shield ────────────────────────────────────────────
        self._txt(c, armor.get("name", ""), 16, PDF_H - 650, size=7)
        if armor.get("shield"):
            self._txt(c, f"+{armor.get('shield_bonus',2)} Escudo", 16, PDF_H - 660, size=7)

        # Feats (columna derecha baja)
        feats = char.get("feats", [])
        feat_y = PDF_H - 590
        for feat in feats[:4]:
            self._txt(c, f"• {feat.get('name', feat) if isinstance(feat, dict) else feat}", 488, feat_y, size=7)
            feat_y -= 10

        c.save()
        buf.seek(0)
        return buf

    def build_page2(self):
        buf = io.BytesIO()
        c = canvas.Canvas(buf, pagesize=(PDF_W, PDF_H))
        char = self.char
        stats = char.get("stats", {})
        nivel = self.nivel
        prof = self.prof

        sab = stats.get("sab", 10)
        spell_mod = mod(sab)
        spell_save_dc = 8 + prof + spell_mod
        spell_atk = prof + spell_mod

        # ── Spellcasting info ──────────────────────────────────────────────
        self._txt(c, "Sabiduría", 25, PDF_H - 38, size=8)
        self._center(c, fmt_mod_num(spell_mod), 38, PDF_H - 68, size=12, bold=True, width=30)
        self._center(c, str(spell_save_dc), 38, PDF_H - 98, size=12, bold=True, width=30)
        self._center(c, fmt_mod_num(spell_atk), 38, PDF_H - 128, size=11, bold=True, width=30)

        # ── Spell slots ────────────────────────────────────────────────────
        spell_slots = char.get("spellSlots", {})
        # Posiciones de los niveles de slot (basado en el PDF layout)
        slot_positions = {
            1: (155, PDF_H - 95),
            2: (155, PDF_H - 109),
            3: (155, PDF_H - 123),
            4: (243, PDF_H - 95),
            5: (243, PDF_H - 109),
            6: (243, PDF_H - 123),
            7: (321, PDF_H - 95),
            8: (321, PDF_H - 109),
            9: (321, PDF_H - 123),
        }
        for lvl in range(1, 10):
            slot_key = str(lvl)
            slot = spell_slots.get(slot_key, spell_slots.get(lvl, {}))
            if isinstance(slot, dict):
                total = slot.get("max", 0)
                spent = total - slot.get("current", total)
            else:
                total = slot
                spent = 0
            if total > 0:
                x, y = slot_positions[lvl]
                self._txt(c, f"T:{total}  E:{spent}", x + 30, y, size=7)

        # ── Spells list ────────────────────────────────────────────────────
        spells = char.get("spells", [])
        prepared = set(char.get("preparedToday", []))

        # Separar cantrips y spells por nivel
        cantrips  = [s for s in spells if s.get("level", 1) == 0]
        by_level  = {}
        for s in spells:
            lv = s.get("level", 1)
            if lv > 0:
                by_level.setdefault(lv, []).append(s)

        # Cantrips / prepared spells — lista conjunta de la hoja
        all_listed = cantrips[:]
        for lv in sorted(by_level.keys()):
            all_listed.extend(by_level[lv])

        spell_y = PDF_H - 182
        c.setFont("Helvetica", 6.5)
        for spell in all_listed[:30]:
            is_prep = spell.get("id") in prepared or spell.get("level", 1) == 0
            lv  = spell.get("level", 0)
            name = spell.get("name", "")
            cast = spell.get("castingTime", "")
            rng  = spell.get("range", "")
            conc = "●" if spell.get("concentration") else " "
            rit  = "●" if spell.get("ritual") else " "

            # Nivel
            c.setFont("Helvetica", 6.5)
            c.drawString(19, spell_y, "C" if lv == 0 else str(lv))
            # Preparado
            if is_prep:
                c.setFont("Helvetica-Bold", 6.5)
            else:
                c.setFont("Helvetica", 6.5)
            c.drawString(42, spell_y, name[:30])
            c.setFont("Helvetica", 6.5)
            c.drawString(155, spell_y, cast[:10])
            c.drawString(189, spell_y, rng[:12])
            c.drawString(249, spell_y, conc)
            c.drawString(271, spell_y, rit)
            spell_y -= 19.5
            if spell_y < PDF_H - 755:
                break

        # ── Backstory / notes ──────────────────────────────────────────────
        notes = char.get("notes", "")
        deity = char.get("deity", "")
        alignment = char.get("alignment", "")

        backstory_text = f"Deidad: {deity}\nAlineamiento: {alignment}\n"
        if notes:
            backstory_text += f"\nNotas:\n{notes}"

        c.setFont("Helvetica", 7)
        text_obj = c.beginText(413, PDF_H - 135)
        text_obj.setFont("Helvetica", 7)
        text_obj.setLeading(9)
        for line in _wrap_text(backstory_text, 28):
            text_obj.textLine(line)
        c.drawText(text_obj)

        # ── Languages ─────────────────────────────────────────────────────
        langs = char.get("languages", ["Común", "Enano"])
        c.setFont("Helvetica", 7)
        lang_y = PDF_H - 340
        for lang in langs[:6]:
            c.drawString(413, lang_y, f"• {lang}")
            lang_y -= 10

        # ── Equipment (items) en columna derecha ────────────────────────────
        all_items = char.get("consumables", []) + char.get("magicItems", [])
        att = char.get("attunement", [])
        eq_y = PDF_H - 408
        c.setFont("Helvetica", 7)
        for item in all_items[:12]:
            name = item.get("name", item) if isinstance(item, dict) else str(item)
            qty  = item.get("qty", 1) if isinstance(item, dict) else 1
            line = f"× {qty}  {name}" if qty > 1 else f"• {name}"
            c.drawString(413, eq_y, line[:30])
            eq_y -= 10

        # Attunement slots
        att_y = PDF_H - 600
        c.setFont("Helvetica", 7)
        for i, slot in enumerate(att[:3]):
            label = slot if slot else f"[Slot {i+1} libre]"
            c.drawString(413, att_y - i * 10, f"⊙ {label}")

        # Currency (segunda página también tiene coins)
        cur = char.get("currency", {})
        self._center(c, str(cur.get("cp", 0)), 415, PDF_H - 700, size=8, width=20)
        self._center(c, str(cur.get("sp", 0)), 451, PDF_H - 700, size=8, width=20)
        self._center(c, str(cur.get("gp", 0)), 487, PDF_H - 700, size=8, width=20)
        self._center(c, str(cur.get("pp", 0)), 557, PDF_H - 700, size=8, width=20)

        c.save()
        buf.seek(0)
        return buf


# ─── Utilidades ─────────────────────────────────────────────────────────────
def fmt_mod_num(n):
    return f"+{n}" if n >= 0 else str(n)

def _wrap_text(text, max_chars):
    lines = []
    for raw_line in text.split("\n"):
        if len(raw_line) <= max_chars:
            lines.append(raw_line)
        else:
            words = raw_line.split()
            current = ""
            for word in words:
                if len(current) + len(word) + 1 <= max_chars:
                    current = current + " " + word if current else word
                else:
                    if current:
                        lines.append(current)
                    current = word
            if current:
                lines.append(current)
    return lines


# ─── Main ────────────────────────────────────────────────────────────────────
def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)

    char_json_path = sys.argv[1]
    script_dir     = os.path.dirname(os.path.abspath(__file__))

    # PDF oficial: buscar junto al script o en Downloads
    if len(sys.argv) >= 4:
        template_path = sys.argv[3]
    else:
        candidates = [
            os.path.join(script_dir, "DnD_2024_Character-Sheet.pdf"),
            os.path.expanduser("~/Downloads/DnD_2024_Character-Sheet.pdf"),
        ]
        template_path = next((p for p in candidates if os.path.exists(p)), None)
        if not template_path:
            print("ERROR: No se encontró DnD_2024_Character-Sheet.pdf.")
            print("Cópialo junto a este script o pásalo como tercer argumento.")
            sys.exit(1)

    # Nombre output
    if len(sys.argv) >= 3:
        output_path = sys.argv[2]
    else:
        base = os.path.splitext(os.path.basename(char_json_path))[0]
        output_path = os.path.join(os.path.dirname(char_json_path), f"{base}_sheet.pdf")

    print(f"Leyendo personaje: {char_json_path}")
    print(f"Usando plantilla:  {template_path}")
    print(f"Generando PDF:     {output_path}")

    with open(char_json_path, encoding="utf-8") as f:
        char = json.load(f)

    filler = SheetFiller(char)
    p1_buf = filler.build_page1()
    p2_buf = filler.build_page2()

    # Leer el PDF plantilla
    template = PdfReader(template_path)
    writer   = PdfWriter()

    for page_idx, overlay_buf in enumerate([p1_buf, p2_buf]):
        if page_idx >= len(template.pages):
            break
        base_page    = template.pages[page_idx]
        overlay_pdf  = PdfReader(overlay_buf)
        overlay_page = overlay_pdf.pages[0]
        base_page.merge_page(overlay_page)
        writer.add_page(base_page)

    with open(output_path, "wb") as f:
        writer.write(f)

    print(f"\n✓ PDF generado: {output_path}")
    print("  Ábrelo con Preview o Adobe Reader para verificar.")


if __name__ == "__main__":
    main()
