/* ═══════════════════════════════════════════════════════
   characters.js — Datos D&D, Lursey, cálculos
   Sin dependencias de DOM. Singleton global: Characters
   ═══════════════════════════════════════════════════════ */

const Characters = (() => {

  /* ── TABLAS ── */

  const PROF_BONUS = [2,2,2,2, 3,3,3,3, 4,4,4,4, 5,5,5,5, 6,6,6,6];

  const XP_THRESHOLDS = [
    0,       // nvl 1
    300,     // nvl 2
    900,     // nvl 3
    2700,    // nvl 4
    6500,    // nvl 5
    14000,   // nvl 6
    23000,   // nvl 7
    34000,   // nvl 8
    48000,   // nvl 9
    64000,   // nvl 10
    85000,   // nvl 11
    100000,  // nvl 12
    120000,  // nvl 13
    140000,  // nvl 14
    165000,  // nvl 15
    195000,  // nvl 16
    225000,  // nvl 17
    265000,  // nvl 18
    305000,  // nvl 19
    355000   // nvl 20
  ];

  // Spell slots por nivel de personaje — Clérigo/Druida/Paladín (full casters)
  // [nvl1, nvl2, nvl3, nvl4, nvl5, nvl6, nvl7, nvl8, nvl9]
  const FULL_CASTER_SLOTS = {
    1:  [2, 0, 0, 0, 0, 0, 0, 0, 0],
    2:  [3, 0, 0, 0, 0, 0, 0, 0, 0],
    3:  [4, 2, 0, 0, 0, 0, 0, 0, 0],
    4:  [4, 3, 0, 0, 0, 0, 0, 0, 0],
    5:  [4, 3, 2, 0, 0, 0, 0, 0, 0],
    6:  [4, 3, 3, 0, 0, 0, 0, 0, 0],
    7:  [4, 3, 3, 1, 0, 0, 0, 0, 0],
    8:  [4, 3, 3, 2, 0, 0, 0, 0, 0],
    9:  [4, 3, 3, 3, 1, 0, 0, 0, 0],
    10: [4, 3, 3, 3, 2, 0, 0, 0, 0],
    11: [4, 3, 3, 3, 2, 1, 0, 0, 0],
    12: [4, 3, 3, 3, 2, 1, 0, 0, 0],
    13: [4, 3, 3, 3, 2, 1, 1, 0, 0],
    14: [4, 3, 3, 3, 2, 1, 1, 0, 0],
    15: [4, 3, 3, 3, 2, 1, 1, 1, 0],
    16: [4, 3, 3, 3, 2, 1, 1, 1, 0],
    17: [4, 3, 3, 3, 2, 1, 1, 1, 1],
    18: [4, 3, 3, 3, 3, 1, 1, 1, 1],
    19: [4, 3, 3, 3, 3, 2, 1, 1, 1],
    20: [4, 3, 3, 3, 3, 2, 2, 1, 1],
  };

  // Half casters (Paladín, Explorador — empieza nvl 2)
  const HALF_CASTER_SLOTS = {
    1:  [0, 0, 0, 0, 0, 0, 0, 0, 0],
    2:  [2, 0, 0, 0, 0, 0, 0, 0, 0],
    3:  [3, 0, 0, 0, 0, 0, 0, 0, 0],
    4:  [3, 0, 0, 0, 0, 0, 0, 0, 0],
    5:  [4, 2, 0, 0, 0, 0, 0, 0, 0],
    6:  [4, 2, 0, 0, 0, 0, 0, 0, 0],
    7:  [4, 3, 0, 0, 0, 0, 0, 0, 0],
    8:  [4, 3, 0, 0, 0, 0, 0, 0, 0],
    9:  [4, 3, 2, 0, 0, 0, 0, 0, 0],
    10: [4, 3, 2, 0, 0, 0, 0, 0, 0],
    11: [4, 3, 3, 0, 0, 0, 0, 0, 0],
    12: [4, 3, 3, 0, 0, 0, 0, 0, 0],
    13: [4, 3, 3, 1, 0, 0, 0, 0, 0],
    14: [4, 3, 3, 1, 0, 0, 0, 0, 0],
    15: [4, 3, 3, 2, 0, 0, 0, 0, 0],
    16: [4, 3, 3, 2, 0, 0, 0, 0, 0],
    17: [4, 3, 3, 3, 1, 0, 0, 0, 0],
    18: [4, 3, 3, 3, 1, 0, 0, 0, 0],
    19: [4, 3, 3, 3, 2, 0, 0, 0, 0],
    20: [4, 3, 3, 3, 2, 0, 0, 0, 0],
  };

  // Warlock (pact magic — solo slots de 1 tipo)
  const WARLOCK_SLOTS = {
    1:[1],2:[2],3:[2],4:[2],5:[3],6:[3],7:[4],8:[4],9:[4],10:[4],
    11:[4],12:[4],13:[4],14:[4],15:[4],16:[4],17:[4],18:[4],19:[4],20:[4]
  };

  const CLASES_CONFIG = {
    'Clérigo':      { hitDie: 8,  spellcastingStat: 'sab', savingThrows: ['sab', 'car'], slotTable: 'full' },
    'Druida':       { hitDie: 8,  spellcastingStat: 'sab', savingThrows: ['int', 'sab'], slotTable: 'full' },
    'Bardo':        { hitDie: 8,  spellcastingStat: 'car', savingThrows: ['des', 'car'], slotTable: 'full' },
    'Hechicero':    { hitDie: 6,  spellcastingStat: 'car', savingThrows: ['con', 'car'], slotTable: 'full' },
    'Mago':         { hitDie: 6,  spellcastingStat: 'int', savingThrows: ['int', 'sab'], slotTable: 'full' },
    'Brujo':        { hitDie: 8,  spellcastingStat: 'car', savingThrows: ['sab', 'car'], slotTable: 'warlock' },
    'Paladín':      { hitDie: 10, spellcastingStat: 'car', savingThrows: ['sab', 'car'], slotTable: 'half' },
    'Explorador':   { hitDie: 10, spellcastingStat: 'sab', savingThrows: ['fue', 'des'], slotTable: 'half' },
    'Guerrero':     { hitDie: 10, spellcastingStat: null,  savingThrows: ['fue', 'con'], slotTable: null },
    'Bárbaro':      { hitDie: 12, spellcastingStat: null,  savingThrows: ['fue', 'con'], slotTable: null },
    'Monje':        { hitDie: 8,  spellcastingStat: 'sab', savingThrows: ['fue', 'des'], slotTable: null },
    'Pícaro':       { hitDie: 8,  spellcastingStat: 'int', savingThrows: ['des', 'int'], slotTable: null },
  };

  const STAT_NAMES = {
    for: 'FUE', des: 'DES', con: 'CON', int: 'INT', sab: 'SAB', car: 'CAR'
  };

  const SKILLS_DEF = [
    { id: 'acrobacias',       name: 'Acrobacias',       stat: 'des' },
    { id: 'arcanos',          name: 'Arcanos',           stat: 'int' },
    { id: 'atletismo',        name: 'Atletismo',         stat: 'for' },
    { id: 'engano',           name: 'Engaño',            stat: 'car' },
    { id: 'historia',         name: 'Historia',          stat: 'int' },
    { id: 'intimidacion',     name: 'Intimidación',      stat: 'car' },
    { id: 'interpretacion',   name: 'Interpretación',    stat: 'car' },
    { id: 'investigacion',    name: 'Investigación',     stat: 'int' },
    { id: 'juegomanos',       name: 'Juego de Manos',    stat: 'des' },
    { id: 'manejoanim',       name: 'Manejo Animales',   stat: 'sab' },
    { id: 'medicina',         name: 'Medicina',          stat: 'sab' },
    { id: 'naturaleza',       name: 'Naturaleza',        stat: 'int' },
    { id: 'percepcion',       name: 'Percepción',        stat: 'sab' },
    { id: 'perspicacia',      name: 'Perspicacia',       stat: 'sab' },
    { id: 'persuasion',       name: 'Persuasión',        stat: 'car' },
    { id: 'religion',         name: 'Religión',          stat: 'int' },
    { id: 'sigilo',           name: 'Sigilo',            stat: 'des' },
    { id: 'supervivencia',    name: 'Supervivencia',     stat: 'sab' },
  ];

  /* ── CÁLCULOS ── */

  function calcMod(stat) {
    return Math.floor((stat - 10) / 2);
  }

  function calcProfBonus(nivel) {
    const n = Math.max(1, Math.min(20, nivel));
    return PROF_BONUS[n - 1];
  }

  function calcCD(char) {
    if (!char.spellcastingStat) return null;
    const prof = calcProfBonus(char.nivel);
    const mod  = calcMod(char.stats[char.spellcastingStat]);
    return 8 + prof + mod;
  }

  function calcAtaqueBonus(char) {
    if (!char.spellcastingStat) return null;
    const prof = calcProfBonus(char.nivel);
    const mod  = calcMod(char.stats[char.spellcastingStat]);
    const bonus = (char.bonuses && char.bonuses.ataque) || 0;
    return prof + mod + bonus;
  }

  function calcInit(char) {
    const bonus = (char.bonuses && char.bonuses.init) || 0;
    return calcMod(char.stats.des) + bonus;
  }

  function calcHPMax(char) {
    const bonus = (char.bonuses && char.bonuses.hpMax) || 0;
    return char.hp.max + bonus;
  }

  function calcPercPasiva(char) {
    const mod  = calcMod(char.stats.sab);
    const prof = calcProfBonus(char.nivel);
    const hasPerspicacia = char.skillProfs && char.skillProfs.includes('perspicacia');
    return 10 + mod + (hasPerspicacia ? prof : 0);
  }

  function calcSkill(char, skillId) {
    const skill = SKILLS_DEF.find(s => s.id === skillId);
    if (!skill) return 0;
    const mod  = calcMod(char.stats[skill.stat]);
    const prof = calcProfBonus(char.nivel);
    const hasProf = char.skillProfs && char.skillProfs.includes(skillId);
    const hasExp  = char.skillExpertise && char.skillExpertise.includes(skillId);
    const bonusSkill = (char.bonuses && char.bonuses.skills && char.bonuses.skills[skillId]) || 0;
    return mod + (hasExp ? prof * 2 : hasProf ? prof : 0) + bonusSkill;
  }

  function calcSave(char, statKey) {
    const mod  = calcMod(char.stats[statKey]);
    const prof = calcProfBonus(char.nivel);
    const hasProf = char.savingThrows && char.savingThrows.includes(statKey);
    const bonusGlobal = (char.bonuses && char.bonuses.savesAll) || 0;
    const bonusStat   = (char.bonuses && char.bonuses.saves && char.bonuses.saves[statKey]) || 0;
    return mod + (hasProf ? prof : 0) + bonusGlobal + bonusStat;
  }

  function calcHPMaxSuggested(char) {
    const conMod = calcMod(char.stats.con);
    return char.hitDie + (char.nivel - 1) * (Math.floor(char.hitDie / 2) + 1) + conMod * char.nivel;
  }

  function calcCA(char) {
    const { armor } = char;
    if (!armor) return 10;
    let ca = armor.base_ca || 10;
    if (armor.add_dex) ca += calcMod(char.stats.des);
    if (armor.shield) ca += armor.shield_bonus || 2;
    ca += (char.bonuses && char.bonuses.ca) || 0;
    return ca;
  }

  function getSlotsForLevel(char, targetLevel) {
    const cfg = CLASES_CONFIG[char.clase];
    if (!cfg || !cfg.slotTable) return Array(9).fill(0);
    let table;
    if (cfg.slotTable === 'full') table = FULL_CASTER_SLOTS;
    else if (cfg.slotTable === 'half') table = HALF_CASTER_SLOTS;
    else if (cfg.slotTable === 'warlock') {
      // Warlock: 1 tipo de slot hasta nivel 5
      const wSlots = WARLOCK_SLOTS[targetLevel] || [0];
      return [wSlots[0] || 0, 0, 0, 0, 0, 0, 0, 0, 0];
    }
    return (table[targetLevel] || Array(9).fill(0));
  }

  function getPreparedMax(char) {
    if (!char.spellcastingStat) return 0;
    const mod = calcMod(char.stats[char.spellcastingStat]);
    return Math.max(1, mod + char.nivel);
  }

  function getXPForLevel(nivel) {
    return XP_THRESHOLDS[Math.min(nivel - 1, 19)] || 0;
  }

  function getNextLevelXP(nivel) {
    return XP_THRESHOLDS[Math.min(nivel, 19)] || null;
  }

  function getLevelFromXP(xp) {
    let lvl = 1;
    for (let i = 1; i < XP_THRESHOLDS.length; i++) {
      if (xp >= XP_THRESHOLDS[i]) lvl = i + 1;
      else break;
    }
    return Math.min(lvl, 20);
  }

  /* ── SPELLS DE LURSEY ── */

  const LURSEY_SPELLS = [
    // ── CANTRIPS ──
    { id:'toll-dead',    name:'Toll the Dead',    level:0, concentration:false, domain:false, mi:false, bonus:false, ritual:false,
      castTime:'Acción', range:'18 m', duration:'Instantáneo', damage:'1d8 necrótico (2d12 si ya tiene daño)', upcast:null,
      desc:'Acción · 18 m · save WIS · 1d8 necrótico (2d12 si el objetivo ya tiene daño) · sin slot · sin ataque', tags:[],
      fullDesc:'Haces sonar una campana fúnebre invisible. La criatura hace save WIS o recibe 1d8 necrótico. Si ya le faltan HP al castear, el dado aumenta a 1d12. Escala a 2d8/2d12 a nivel 5, 3d8/3d12 a nivel 11, 4d8/4d12 a nivel 17.' },
    { id:'sacred-flame', name:'Sacred Flame',     level:0, concentration:false, domain:false, mi:false, bonus:false, ritual:false,
      castTime:'Acción', range:'18 m', duration:'Instantáneo', damage:'2d8 radiante', upcast:null,
      desc:'Acción · 18 m · save DEX (ignora cobertura) · 2d8 radiante · ideal vs enemigos que se cubren', tags:[],
      fullDesc:'Llamas divinas caen sobre una criatura a 18 m. Hace save DEX — ignora completamente cualquier cobertura — o recibe 2d8 radiante. Escala a 2d8 a nivel 5, 3d8 a nivel 11, 4d8 a nivel 17.' },
    { id:'guidance',     name:'Guidance',         level:0, concentration:true,  domain:false, mi:false, bonus:false, ritual:false,
      castTime:'Acción', range:'Toque', duration:'Concentración (1 min)', damage:null, upcast:null,
      desc:'Acción · toque · conc 1 min · +1d4 a 1 check de habilidad antes de tirar · solo fuera de combate', tags:['conc'],
      fullDesc:'Tocas a una criatura voluntaria. Antes de que termine la concentración puede añadir 1d4 al resultado de un check de habilidad de su elección. Usa el dado antes o después de tirar. Ideal fuera de combate.' },
    { id:'thaumaturgy',  name:'Thaumaturgy',      level:0, concentration:false, domain:false, mi:false, bonus:false, ritual:false,
      castTime:'Acción', range:'9 m', duration:'1 minuto', damage:null, upcast:null,
      desc:'Acción · 9 m · efectos menores (voz, llamas, temblor, ojos) · duración 1 min · puro roleplay', tags:[],
      fullDesc:'Manifiestas un pequeño milagro: voz que retumba 3× más fuerte, llamas en colores, temblor leve, truenos lejanos, puertas que se abren solas, o tus ojos brillan. Hasta 3 efectos activos a la vez, cada uno dura 1 minuto.' },
    { id:'spare-dying',  name:'Spare the Dying',  level:0, concentration:false, domain:false, mi:false, bonus:false, ritual:false,
      castTime:'Acción', range:'Toque', duration:'Instantáneo', damage:null, upcast:null,
      desc:'Acción · toque · estabiliza a criatura en 0 HP · no gasta slot · sin curación · solo detiene la muerte', tags:[],
      fullDesc:'Tocas a una criatura viva con 0 HP. Queda estabilizada automáticamente. No cura nada, solo detiene las tiradas de muerte. No funciona en construcciones ni muertos vivientes.' },
    // ── NVL 1 DOMINIO ──
    { id:'heroism',      name:'Heroism ◆',        level:1, concentration:true,  domain:true,  mi:false, bonus:false, ritual:false,
      castTime:'Acción', range:'Toque', duration:'Concentración (1 min)', damage:null, upcast:'Una criatura adicional por nivel de slot sobre 1.',
      desc:'Acción · toque · conc 1 min · inmunidad al miedo + gana Prof mod HP temporales al inicio de cada turno · ideal vs jefes', tags:['conc','dom'],
      fullDesc:'Tocas a una criatura voluntaria. Mientras dure la concentración: es inmune a la condición asustado y gana HP temporales iguales a tu modificador de Sabiduría (+4) al inicio de cada uno de sus turnos. Al upcastear afectas a una criatura adicional por nivel de slot extra.' },
    { id:'sanctuary',    name:'Sanctuary ◆',      level:1, concentration:false, domain:true,  mi:false, bonus:false, ritual:false,
      castTime:'Acción de bonus', range:'9 m', duration:'1 minuto', damage:null, upcast:null,
      desc:'Bonus action · 9 m · 1 min · quien ataque al objetivo debe pasar save WIS o cambiar blanco · SIN concentración · muy eficiente', tags:['dom'],
      fullDesc:'Proteges a una criatura visible a 9 m. Cualquier criatura que la ataque o le lance un hechizo dañino debe superar save WIS (CD 15) o elegir otro blanco; si no puede, pierde el ataque. Termina si el objetivo ataca o lanza un hechizo perjudicial. Sin concentración.' },
    // ── NVL 1 PREPARADOS ──
    { id:'bless',        name:'Bless',            level:1, concentration:true,  domain:false, mi:false, bonus:false, ritual:false,
      castTime:'Acción', range:'9 m', duration:'Concentración (1 min)', damage:null, upcast:'Una criatura adicional por nivel de slot sobre 1.',
      desc:'Acción · 9 m · conc 1 min · hasta 3 criaturas ganan +1d4 a tiradas de ataque y saves · tu buff más poderoso por slot', tags:['conc'],
      fullDesc:'Hasta 3 criaturas a 9 m añaden 1d4 a todas sus tiradas de ataque y saves mientras dure la concentración. Al upcastear puedes afectar a una criatura adicional por nivel de slot extra.' },
    { id:'heal-word',    name:'Healing Word',     level:1, concentration:false, domain:false, mi:false, bonus:true,  ritual:false,
      castTime:'Acción de bonus', range:'18 m', duration:'Instantáneo', damage:null, upcast:'1d4 HP adicionales por nivel de slot sobre 1.',
      desc:'Bonus action · 18 m · 1d4+4 HP · levanta aliados caídos sin gastar la acción principal · imprescindible', tags:['bonus'],
      fullDesc:'Una criatura visible a 18 m recupera 1d4+4 HP. Acción de bonus — puedes curar y actuar en el mismo turno. Al upcastear: slot 2 = 2d4+4, slot 3 = 3d4+4, etc.' },
    { id:'command',      name:'Command',          level:1, concentration:false, domain:false, mi:false, bonus:false, ritual:false,
      castTime:'Acción', range:'18 m', duration:'1 turno', damage:null, upcast:'Una criatura adicional por nivel de slot sobre 1.',
      desc:'Acción · 18 m · save WIS · 1 turno · 1 palabra: Huye / Detente / Cae / Acércate / Suéltalo · upcasteable a más objetivos', tags:[],
      fullDesc:'Das una orden de una palabra a una criatura visible a 18 m. Save WIS (CD 15) o cumple la orden en su siguiente turno. Opciones: Acércate, Huye (Dash), Cae (al suelo), Detente (no actúa), Suéltalo (suelta lo que sostiene). No funciona en muertos vivientes ni inmunes a encantamientos.' },
    { id:'cure-wounds',  name:'Cure Wounds',      level:1, concentration:false, domain:false, mi:false, bonus:false, ritual:false,
      castTime:'Acción', range:'Toque', duration:'Instantáneo', damage:null, upcast:'1d8 HP adicionales por nivel de slot sobre 1.',
      desc:'Acción · toque · 1d8+4 HP · curación directa · peor que Healing Word en combate pero más HP totales', tags:[],
      fullDesc:'Tocas a una criatura y curas 1d8+4 HP. No funciona en construcciones ni muertos vivientes. Inferior a Healing Word en combate (consume acción principal), pero por slot cura más HP en promedio.' },
    { id:'detect-magic', name:'Detect Magic',     level:1, concentration:true,  domain:false, mi:false, bonus:false, ritual:true,
      castTime:'Acción (o Ritual +10 min)', range:'Autocentrado (9 m)', duration:'Concentración (10 min)', damage:null, upcast:null,
      desc:'Acción (ritual) · conc 10 min · 9 m · detecta magia y su escuela · sin gastar slot como ritual', tags:['conc','ritual'],
      fullDesc:'Percibes la presencia de magia a 9 m. Puedes usar tu acción para ver el aura de criaturas/objetos mágicos y conocer la escuela de magia. Puede lanzarse como ritual (10 min extra, sin gastar slot).' },
    { id:'identify',     name:'Identify',         level:1, concentration:false, domain:false, mi:false, bonus:false, ritual:true,
      castTime:'1 minuto (o Ritual +10 min)', range:'Toque', duration:'Instantáneo', damage:null, upcast:null,
      desc:'1 min (ritual) · toque · identifica propiedades mágicas y attuning de un objeto · sin slot como ritual', tags:['ritual'],
      fullDesc:'Tocas un objeto mágico y aprendes sus propiedades, cómo usarlas, si requiere sintonización y cuántas cargas le quedan. También descubres hechizos activos sobre el objeto. Puede lanzarse como ritual.' },
    { id:'inflict-wounds',name:'Inflict Wounds',  level:1, concentration:false, domain:false, mi:false, bonus:false, ritual:false,
      castTime:'Acción', range:'Toque', duration:'Instantáneo', damage:'3d10 necrótico', upcast:'1d10 adicional por nivel de slot sobre 1.',
      desc:'Acción · toque · ataque de conjuro (+7) · 3d10 necrótico · daño enorme pero requiere estar cuerpo a cuerpo (1,5 m)', tags:[],
      fullDesc:'Ataque de conjuro cuerpo a cuerpo (+7). Si impactas: 3d10 necrótico. Uno de los daños más altos por slot de nivel 1, pero exige estar a 1,5 m. Slot 2 = 4d10, slot 3 = 5d10.' },
    { id:'protect-evil', name:'Protection from Evil/Good', level:1, concentration:true, domain:false, mi:false, bonus:false, ritual:false,
      castTime:'Acción', range:'Toque', duration:'Concentración (10 min)', damage:null, upcast:null,
      desc:'Acción · toque · conc 10 min · vs aberraciones/celestiales/elementales/feéricos/muertos · desventaja en ataques contra el objetivo', tags:['conc'],
      fullDesc:'Tocas a una criatura voluntaria. Aberraciones, celestiales, elementales, feéricos, infernales y muertos vivientes tienen desventaja en sus ataques contra el objetivo, y el objetivo no puede ser encantado, asustado ni poseído por ellas.' },
    { id:'shield-faith', name:'Shield of Faith',  level:1, concentration:true,  domain:false, mi:false, bonus:false, ritual:false,
      castTime:'Acción de bonus', range:'18 m', duration:'Concentración (10 min)', damage:null, upcast:null,
      desc:'Bonus action · 18 m · conc 10 min · +2 CA · excelente en aliado frente-a-frente o en ti misma', tags:['conc'],
      fullDesc:'Un campo de energía protectora rodea a una criatura a 18 m, otorgándole +2 CA mientras dure la concentración. Acción de bonus, muy eficiente. Ideal para el aliado de primera línea.' },
    // ── NVL 1 MAGIC INITIATE ──
    { id:'guiding-bolt', name:'Guiding Bolt †',   level:1, concentration:false, domain:false, mi:true,  bonus:false, ritual:false,
      castTime:'Acción', range:'36 m', duration:'1 turno', damage:'4d6 radiante', upcast:'1d6 adicional por nivel de slot sobre 1.',
      desc:'Acción · 36 m · ataque de conjuro (+7) · 4d6 radiante · el próximo ataque vs ese enemigo tiene ventaja · gratis 1×/día, luego slot 1', tags:['mi'],
      fullDesc:'Ataque de conjuro a distancia (+7). Si impacta: 4d6 radiante y el objetivo queda iluminado — el primer ataque contra él antes de tu próximo turno tiene ventaja. Gratis 1×/día largo (Magic Initiate); usos extra consumen slot 1. Slot 2 = 5d6, slot 3 = 6d6.' },
    // ── NVL 2 DOMINIO ──
    { id:'aid',          name:'Aid ◆',            level:2, concentration:false, domain:true,  mi:false, bonus:false, ritual:false,
      castTime:'Acción', range:'9 m', duration:'8 horas', damage:null, upcast:'+5 HP adicionales por nivel de slot sobre 2.',
      desc:'Acción · 9 m · 8h · hasta 3 criaturas +5 HP máximos y +5 HP actuales · SIN concentración · lanzar al inicio del día', tags:['dom'],
      fullDesc:'Hasta 3 criaturas a 9 m ganan +5 HP máximos y +5 HP actuales por 8 horas. Sin concentración. Al upcastear: slot 3 = +10, slot 4 = +15, slot 5 = +20. Lanzar al inicio del día junto con slots de dominio.' },
    { id:'warding-bond', name:'Warding Bond ◆',   level:2, concentration:true,  domain:true,  mi:false, bonus:false, ritual:false,
      castTime:'Acción', range:'Toque', duration:'Concentración (1 hora)', damage:null, upcast:null,
      desc:'Acción · toque · conc 1h · aliado recibe +1 CA, +1 saves, resistencia a todos los daños · tú recibes el mismo daño que él · caro pero poderoso', tags:['conc','dom'],
      fullDesc:'Tocas a otra criatura voluntaria (requiere anillos de plata/hierro para cada uno). El objetivo gana +1 CA, +1 saves, y resistencia a todos los daños. Cada vez que recibe daño, tú también lo recibes. Termina si te alejas más de 18 m, si cualquiera cae inconsciente, o si pierdes concentración.' },
    // ── NVL 2 PREPARADOS ──
    { id:'lesser-rest',  name:'Lesser Restoration', level:2, concentration:false, domain:false, mi:false, bonus:true, ritual:false,
      castTime:'Acción', range:'Toque', duration:'Instantáneo', damage:null, upcast:null,
      desc:'Acción · toque · quita 1 enfermedad o condición: cegado, ensordecido, paralizado, envenenado · sin concentración · utilísimo', tags:['bonus'],
      fullDesc:'Tocas a una criatura y terminas una enfermedad o condición: cegado, ensordecido, paralizado o envenenado. Sin concentración, instantáneo. Esencial para sacar aliados de condiciones debilitantes.' },
    { id:'hold-person',  name:'Hold Person',       level:2, concentration:true,  domain:false, mi:false, bonus:false, ritual:false,
      castTime:'Acción', range:'18 m', duration:'Concentración (1 min)', damage:null, upcast:'Un humanoide adicional por nivel de slot sobre 2.',
      desc:'Acción · 18 m · conc 1 min · save WIS cada turno · paraliza a 1 humanoide · ataques cuerpo a cuerpo automáticamente crítico · muy poderoso', tags:['conc'],
      fullDesc:'Save WIS (CD 15) o el humanoide queda paralizado. Puede repetir el save al final de cada turno. Paralizado: incapacitado, no puede moverse ni hablar, falla saves STR/DEX, ataques con ventaja, cualquier impacto desde 1,5 m es crítico automático. Solo humanoides.' },
    { id:'prayer-healing',name:'Prayer of Healing',level:2, concentration:false, domain:false, mi:false, bonus:false, ritual:false,
      castTime:'10 minutos', range:'9 m', duration:'Instantáneo', damage:null, upcast:'1d8 adicional por nivel de slot sobre 2.',
      desc:'10 minutos · 9 m · hasta 6 aliados · 2d8+4 HP cada uno · sin concentración · solo entre combates, mucho tiempo de casteo', tags:[],
      fullDesc:'Hasta 6 criaturas a 9 m recuperan 2d8+4 HP cada una. El casteo toma 10 minutos — inútil en combate, pero extremadamente eficiente entre encuentros. Sin concentración.' },
    { id:'silence',      name:'Silence',           level:2, concentration:true,  domain:false, mi:false, bonus:false, ritual:true,
      castTime:'Acción (o Ritual +10 min)', range:'36 m', duration:'Concentración (10 min)', damage:null, upcast:null,
      desc:'Acción (ritual) · 36 m · conc 10 min · esfera 6 m · ningún sonido ni conjuro verbal dentro · anula a magos/cléricos enemigos', tags:['conc','ritual'],
      fullDesc:'Esfera de 6 m de silencio absoluto centrada a 36 m. Ningún sonido puede crearse ni pasar dentro. Criaturas dentro: inmunes a daño de trueno, no pueden lanzar hechizos con componente verbal. Clave para neutralizar magos y cléricos enemigos.' },
    { id:'spiritual-weapon',name:'Spiritual Weapon',level:2, concentration:false, domain:false, mi:false, bonus:true, ritual:false,
      castTime:'Acción de bonus', range:'18 m', duration:'1 minuto', damage:'1d8+4 radiante', upcast:'1d8 adicional por 2 niveles de slot sobre 2.',
      desc:'Bonus action · 18 m · 1 min · arma espectral bonus action cada turno · 1d8+4 radiante · SIN concentración · excelente con Bless activo', tags:['bonus'],
      fullDesc:'Creas un arma espectral a 18 m. Como acción de bonus cada turno puedes moverla 6 m y atacar: +7 al ataque, 1d8+4 radiante. Sin concentración — compatible con Bless. Slot 3/4 = 2d8+4, slot 5/6 = 3d8+4.' },
    { id:'enhance-ability',name:'Enhance Ability', level:2, concentration:true,  domain:false, mi:false, bonus:false, ritual:false,
      castTime:'Acción', range:'Toque', duration:'Concentración (1 hora)', damage:null, upcast:'Una criatura adicional por nivel de slot sobre 2.',
      desc:'Acción · toque · conc 1h · elige stat: ventaja en checks · Bear (CON +2d6 HP temp), Cat (DES sin daño caída), Eagle (CAR ventaja), etc.', tags:['conc'],
      fullDesc:'Otorgas una mejora mágica: Fuerza del Oso (STR, ventaja + 2d6 HP temp), Gracia del Gato (DEX, ventaja + sin daño de caída), Resistencia del Oso (CON, ventaja), Brillantez del Águila (INT), Astucia del Zorro (WIS), Presencia del Águila (CHA). Al upcastear afectas a una criatura adicional por nivel extra.' },
    // ── NVL 3 DOMINIO ──
    { id:'beacon',       name:'Beacon of Hope ◆', level:3, concentration:true,  domain:true,  mi:false, bonus:false, ritual:false,
      castTime:'Acción', range:'9 m', duration:'Concentración (1 min)', damage:null, upcast:null,
      desc:'Acción · 9 m · conc 1 min · ventaja en saves WIS y tiradas de muerte · curación siempre al máximo · usar con Warding Bond', tags:['conc','dom'],
      fullDesc:'Cualquier número de criaturas a 9 m obtienen: ventaja en saves WIS y tiradas de muerte, y toda curación recupera el máximo posible de HP. Con Healing Word o Mass Healing Word, la curación es siempre máxima.' },
    { id:'sending',      name:'Sending ◆',        level:3, concentration:false, domain:true,  mi:false, bonus:false, ritual:false,
      castTime:'Acción', range:'Ilimitado', duration:'1 turno', damage:null, upcast:null,
      desc:'Acción · ilimitado · envía mensaje de 25 palabras a cualquier criatura en cualquier plano · puede responder · esencial para coordinación', tags:['dom'],
      fullDesc:'Envías un mensaje de hasta 25 palabras a una criatura familiar. La escucha en su mente y puede responder con hasta 25 palabras. Funciona a través de cualquier distancia e incluso entre planos de existencia.' },
    // ── NVL 3 PREPARADOS ──
    { id:'spirit-guard', name:'Spirit Guardians', level:3, concentration:true,  domain:false, mi:false, bonus:false, ritual:false,
      castTime:'Acción', range:'Autocentrado (4,5 m)', duration:'Concentración (10 min)', damage:'3d8 radiante o frío', upcast:'1d8 adicional por nivel de slot sobre 3.',
      desc:'Acción · auto · conc 10 min · radio 4,5 m · 3d8 rad o frío a todo enemigo que entre o empiece turno dentro · velocidad ÷2 · tu hechizo más dañino', tags:['conc'],
      fullDesc:'Espíritus en radio 4,5 m. El área es terreno difícil para enemigos. Cuando un enemigo entra o empieza su turno en el área: save WIS (CD 15), fallo = 3d8 radiante o frío, éxito = la mitad. Slot 4 = 4d8, slot 5 = 5d8. Tu hechizo ofensivo más eficiente en combate prolongado.' },
    { id:'mass-heal-w',  name:'Mass Healing Word',level:3, concentration:false, domain:false, mi:false, bonus:true,  ritual:false,
      castTime:'Acción de bonus', range:'18 m', duration:'Instantáneo', damage:null, upcast:'1d4 adicional por nivel de slot sobre 3.',
      desc:'Bonus action · 18 m · hasta 6 criaturas · 1d4+4 HP cada una · levanta a todo el grupo · SIN concentración · solo para emergencias masivas', tags:['bonus'],
      fullDesc:'Hasta 6 criaturas a 18 m recuperan 1d4+4 HP cada una. Acción de bonus, sin concentración — ideal cuando varios aliados caen en el mismo turno.' },
    { id:'revivify',     name:'Revivify',         level:3, concentration:false, domain:false, mi:false, bonus:false, ritual:false,
      castTime:'Acción', range:'Toque', duration:'Instantáneo', damage:null, upcast:null,
      desc:'Acción · toque · 300gp de diamante · resucita criatura muerta en el último minuto con 1 HP · SIEMPRE tener diamante · prioridad máxima', tags:[],
      fullDesc:'Tocas a una criatura muerta hace menos de 1 minuto. Vuelve a la vida con 1 HP. Requiere diamante de 300 gp que se consume. No funciona si la criatura no desea revivir. Siempre tener un diamante encima.' },
    { id:'dispel-magic', name:'Dispel Magic',     level:3, concentration:false, domain:false, mi:false, bonus:false, ritual:false,
      castTime:'Acción', range:'36 m', duration:'Instantáneo', damage:null, upcast:'Con slot igual al nivel del hechizo objetivo, lo termina automáticamente sin check.',
      desc:'Acción · 36 m · termina automáticamente conjuros nivel 3 o menos · vs nivel 4+ requiere check (CD = 10 + nivel del hechizo) · esencial', tags:[],
      fullDesc:'Elige una criatura, objeto o efecto mágico a 36 m. Hechizos de nivel 3 o menos terminan automáticamente. Para nivel 4+: check de habilidad con MOD SAB contra CD 10 + nivel del hechizo. Al upcastear con slot del mismo nivel, termina automáticamente.' },
    { id:'remove-curse', name:'Remove Curse',     level:3, concentration:false, domain:false, mi:false, bonus:false, ritual:false,
      castTime:'Acción', range:'Toque', duration:'Instantáneo', damage:null, upcast:null,
      desc:'Acción · toque · termina todas las maldiciones en una criatura o rompe attunement de ítem maldito · situacional pero necesario', tags:[],
      fullDesc:'Tocas a una criatura y terminas todas las maldiciones que la afecten. Si tocas un objeto maldito, la maldición permanece en el objeto pero rompe la sintonía del portador para que pueda quitárselo.' },
    { id:'speak-dead',   name:'Speak with Dead',  level:3, concentration:false, domain:false, mi:false, bonus:false, ritual:false,
      castTime:'Acción', range:'3 m', duration:'10 minutos', damage:null, upcast:null,
      desc:'Acción · 10 minutos · cadáver hace 5 preguntas · limitado a lo que sabía en vida · no está obligado a decir la verdad · muy útil en investigación', tags:[],
      fullDesc:'Concedes semblanza de vida a un cadáver a 3 m. Puede responder hasta 5 preguntas sobre lo que sabía en vida. Las respuestas son breves y crípticas. No está obligado a decir la verdad. No funciona si se usó el hechizo en el cadáver en los últimos 10 días.' },
    { id:'animate-dead', name:'Animate Dead',     level:3, concentration:false, domain:false, mi:false, bonus:false, ritual:false,
      castTime:'1 minuto', range:'Toque', duration:'Instantáneo', damage:null, upcast:'2 muertos vivientes adicionales por nivel de slot sobre 3.',
      desc:'1 minuto · toque · crea esqueleto o zombi de cadáver medio/pequeño · obedece órdenes · 24h (renovable) · ético cuestionable para Clérigo de Paz', tags:[],
      fullDesc:'Animas huesos o un cadáver mediano/pequeño convirtiéndolo en esqueleto o zombi bajo tu control. Obedece órdenes verbales. Puedes controlar hasta 3 creados con este hechizo. Relanzarlo en los últimas 24h renueva el control. Éticamente cuestionable para un Clérigo de Paz.' },
    { id:'water-walk',   name:'Water Walk',       level:3, concentration:false, domain:false, mi:false, bonus:false, ritual:true,
      castTime:'Acción (o Ritual +10 min)', range:'9 m', duration:'1 hora', damage:null, upcast:null,
      desc:'Acción (ritual) · 9 m · 1h · hasta 10 criaturas caminan sobre agua/ácido/lodo/nieve · sin concentración · muy útil en exploración', tags:['ritual'],
      fullDesc:'Hasta 10 criaturas a 9 m caminan sobre cualquier superficie líquida (agua, ácido, barro, nieve, lava) como si fuera terreno sólido. Sin concentración. Muy útil en exploración. Puede lanzarse como ritual.' },
  ];

  /* ── IFTTT DE LURSEY ── */

  const LURSEY_IFTTT = [
    // Pre-combate
    { section:'Pre-combate', trigger:'Siempre', action:'Emboldening Bond al grupo completo', tag:'siempre' },
    { section:'Pre-combate', trigger:'Siempre', action:'Aid al inicio del día — +5 HP máx a todos (sin concentración)', tag:'siempre' },
    // Ronda 1
    { section:'Ronda 1', trigger:'Si pocos enemigos o jefe', action:'<strong>Bless</strong> al Paladín + Druid + Warlock', tag:'si' },
    { section:'Ronda 1', trigger:'Si muchos enemigos o te rodean', action:'<strong>Spirit Guardians</strong> — ralentiza y quema', tag:'si' },
    { section:'Ronda 1', trigger:'Si saves CON peligrosos o dragón', action:'<strong>Beacon of Hope</strong> — ventaja saves + curación máxima', tag:'si' },
    // Cualquier turno
    { section:'Cualquier turno', trigger:'Si aliado cae a 0 HP', action:'<em>Healing Word</em> como <strong>bonus action</strong> — no gastes la acción', tag:'si' },
    { section:'Cualquier turno', trigger:'Si focalizan al Warlock/Mago', action:'<strong>Sanctuary</strong> — sin concentración, busca otro objetivo', tag:'si' },
    { section:'Cualquier turno', trigger:'Si varios aliados bajos en posiciones distintas', action:'<strong>Balm of Peace</strong> — muévete entre ellos, 2d6+4 a cada uno a 5 ft, sin oportunidad de ataque', tag:'si' },
    { section:'Cualquier turno', trigger:'Si enemigo sale de tu rango', action:'<em>War Caster:</em> <strong>Toll the Dead</strong> de oportunidad', tag:'si' },
    { section:'Cualquier turno', trigger:'Si alguien muere', action:'<strong>Revivify</strong> inmediato, no esperes', tag:'si' },
    // Turno libre
    { section:'Turno libre', trigger:'Si enemigo con daño', action:'<strong>Toll the Dead</strong> — 2d12 necrótico, save WIS', tag:'si' },
    { section:'Turno libre', trigger:'Si enemigo intacto', action:'<strong>Sacred Flame</strong> — 2d8 rad, save DEX, ignora cobertura', tag:'si' },
    { section:'Turno libre', trigger:'Si enemigo peligroso sin tocar', action:'<strong>Guiding Bolt</strong> gratis — 4d6 + ventaja al Paladín', tag:'si' },
    // Gestión
    { section:'Gestión', trigger:'Si 2+ combates sin Channel Divinity', action:'Úsalo ya, no lo guardes', tag:'si' },
    { section:'Gestión', trigger:'Si Bond expiró (+10 min)', action:'Relanzar Emboldening Bond antes del próximo encuentro', tag:'si' },
    { section:'Gestión', trigger:'Bond + Bless activos', action:'= 2d4 en ataques y saves · recuérdales cada combate', tag:'siempre' },
    { section:'Gestión', trigger:'Entre combates sin descanso largo', action:'Considera <strong>Prayer of Healing</strong> — curación masiva sin concentración, 10 min casting', tag:'si' },
  ];

  /* ── OBJETO LURSEY COMPLETO ── */

  function buildLursey() {
    const slotsFull5 = FULL_CASTER_SLOTS[5]; // [4,3,2,0,...]
    const spellSlots = {};
    for (let i = 1; i <= 9; i++) {
      const max = slotsFull5[i-1] || 0;
      spellSlots[i] = { current: max, max };
    }

    return {
      id: 'lursey-brumaclara',
      name: 'Lursey Brumaclara',
      clase: 'Clérigo',
      subclase: 'Dominio de la Paz',
      raza: 'Enano de las Montañas',
      trasfondo: 'Acólito',
      deity: 'Clangeddin Barbablanca',
      alignment: 'LB',
      nivel: 5,
      xp: 6500,

      stats: { for:10, des:14, con:14, int:9, sab:19, car:14 },

      hp: { current: 44, max: 44, temp: 0 },
      velocidad: 30,

      savingThrows: ['sab', 'car'],
      skillProfs: ['perspicacia', 'historia', 'persuasion', 'religion'],
      skillExpertise: [],

      spellcastingStat: 'sab',
      hitDie: 8,
      spellSlots,

      hitDice: { current: 5, max: 5 },

      resources: [
        {
          id: 'channel-divinity',
          name: 'Channel Divinity',
          current: 2, max: 2,
          recharge: 'short',
          note: 'Balm of Peace · Divine Spark · Turn Undead'
        },
        {
          id: 'bond',
          name: 'Emboldening Bond',
          current: 1, max: 1,
          recharge: 'long',
          note: '1d4 en ataque/save/check · 30 ft · 10 min'
        },
        {
          id: 'guiding-bolt-mi',
          name: 'Guiding Bolt (MI)',
          current: 1, max: 1,
          recharge: 'long',
          note: '4d6 rad + ventaja al siguiente ataque'
        }
      ],

      turn: { action: false, bonus: false, reaction: false, movement: false },
      concentration: null,
      conditions: [],
      inspiration: false,

      spells: LURSEY_SPELLS,
      preparedToday: [
        'bless', 'heal-word', 'command', 'lesser-rest',
        'spirit-guard', 'mass-heal-w', 'revivify'
      ],

      weapons: [
        { id:'maza', name:'Maza de Guerra', die:'1d6', bonus:'+3', type:'melee', notes:'Afinidad con armas enanas' },
        { id:'simbolo', name:'Símbolo Sagrado', die:'—', bonus:'—', type:'focus', notes:'Foco arcano para conjuros' }
      ],
      armor: {
        name: 'Cota de Malla',
        base_ca: 16,
        add_dex: false,
        shield: true,
        shield_bonus: 2
      },
      attunement: ['', '', ''],
      magicItems: [],
      consumables: [
        { id:'pocion-cur', name:'Poción de Curación', qty: 2, category:'Potion', desc:'2d4+2 HP' }
      ],
      currency: { gp: 0, sp: 0, cp: 0 },
      notes: '',

      bonuses: {
        ca: 0,           // ítems mágicos, hechizos (+1 Shield, etc.)
        savesAll: 0,     // bonus global a todos los saves (Aura Paladín, Cloak of Protection)
        saves: {},       // bonus por stat específico { sab: 1, ... }
        skills: {},      // bonus por skill { perspicacia: 1, ... }
        init: 0,         // Alert feat, ítems
        hpMax: 0,        // Tough feat, ítems permanentes (≠ temp HP)
        ataque: 0,       // arma mágica +1/+2/+3
      },

      diary: [],

      ifttt: LURSEY_IFTTT,

      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  }

  /* ── NUEVO PERSONAJE VACÍO ── */

  function createNew(name, claseNombre) {
    const cfg = CLASES_CONFIG[claseNombre] || CLASES_CONFIG['Guerrero'];
    const nivel = 1;
    const slotRow = getSlotsForClass(claseNombre, nivel);
    const spellSlots = {};
    for (let i = 1; i <= 9; i++) {
      const max = slotRow[i-1] || 0;
      spellSlots[i] = { current: max, max };
    }

    return {
      id: 'char-' + Date.now() + '-' + Math.random().toString(36).slice(2,7),
      name,
      clase: claseNombre,
      subclase: '',
      raza: '',
      trasfondo: '',
      deity: '',
      alignment: '',
      nivel: 1,
      xp: 0,

      stats: { for:10, des:10, con:10, int:10, sab:10, car:10 },

      hp: { current: cfg.hitDie, max: cfg.hitDie, temp: 0 },
      velocidad: 30,

      savingThrows: cfg.savingThrows || [],
      skillProfs: [],
      skillExpertise: [],

      spellcastingStat: cfg.spellcastingStat,
      hitDie: cfg.hitDie,
      spellSlots,

      hitDice: { current: 1, max: 1 },

      resources: [],
      turn: { action: false, bonus: false, reaction: false, movement: false },
      concentration: null,
      conditions: [],
      inspiration: false,

      spells: [],
      preparedToday: [],

      weapons: [],
      armor: { name: '', base_ca: 10, add_dex: true, shield: false, shield_bonus: 2 },
      attunement: ['', '', ''],
      magicItems: [],
      consumables: [],
      currency: { gp: 0, sp: 0, cp: 0 },
      notes: '',

      bonuses: {
        ca: 0, savesAll: 0, saves: {}, skills: {}, init: 0, hpMax: 0, ataque: 0,
      },

      diary: [],
      ifttt: [],

      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  }

  function getSlotsForClass(claseNombre, nivel) {
    const cfg = CLASES_CONFIG[claseNombre];
    if (!cfg || !cfg.slotTable) return Array(9).fill(0);
    if (cfg.slotTable === 'full') return FULL_CASTER_SLOTS[nivel] || Array(9).fill(0);
    if (cfg.slotTable === 'half') return HALF_CASTER_SLOTS[nivel] || Array(9).fill(0);
    if (cfg.slotTable === 'warlock') {
      const s = WARLOCK_SLOTS[nivel] || [0];
      return [s[0] || 0, 0, 0, 0, 0, 0, 0, 0, 0];
    }
    return Array(9).fill(0);
  }

  /* ── LEVEL UP ── */

  function applyLevelUp(char, newLevel, hpGained) {
    char.nivel = newLevel;
    char.hp.max += hpGained;
    char.hp.current = Math.min(char.hp.current + hpGained, char.hp.max);
    char.hitDice.max = newLevel;
    char.hitDice.current = Math.min(char.hitDice.current + 1, newLevel);

    // Actualizar spell slots
    const newSlotRow = getSlotsForClass(char.clase, newLevel);
    for (let i = 1; i <= 9; i++) {
      const newMax = newSlotRow[i-1] || 0;
      const old = char.spellSlots[i] || { current: 0, max: 0 };
      if (newMax > old.max) {
        // Slots nuevos empiezan llenos
        char.spellSlots[i] = { current: old.current + (newMax - old.max), max: newMax };
      } else {
        char.spellSlots[i] = { current: Math.min(old.current, newMax), max: newMax };
      }
    }
  }

  /* ── EXPORTS PÚBLICOS ── */

  return {
    PROF_BONUS,
    XP_THRESHOLDS,
    CLASES_CONFIG,
    SKILLS_DEF,
    STAT_NAMES,
    LURSEY_IFTTT,
    calcMod,
    calcProfBonus,
    calcCD,
    calcAtaqueBonus,
    calcInit,
    calcHPMax,
    calcPercPasiva,
    calcSkill,
    calcSave,
    calcHPMaxSuggested,
    calcCA,
    getSlotsForClass,
    getPreparedMax,
    getXPForLevel,
    getNextLevelXP,
    getLevelFromXP,
    createNew,
    buildLursey,
    applyLevelUp,
  };
})();
