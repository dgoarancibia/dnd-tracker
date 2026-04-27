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

  // ── RAZAS_CONFIG (D&D 2024) ────────────────────────────────────────────────
  // bonus: [+2, +1] a stats libres elegidos por el jugador (2024)
  // traits: rasgos clave de la raza
  // speed: velocidad en pies (por defecto 30)
  // resistances: resistencias a tipos de daño
  // languages: idiomas que habla
  // skillProfs: proficiencias de habilidad que otorga
  // weaponProfs: proficiencias de armas
  // darkvision: alcance en metros (0 = sin darkvision)
  const RAZAS_CONFIG = {
    'Humano': {
      emoji: '👤', speed: 30, darkvision: 0,
      traits: [
        'Versatile — proficiencia en una habilidad a elección',
        'Heroic Inspiration — 1 vez por descanso largo, tirar dado de ventaja',
      ],
      resistances: [], languages: ['Común', 'Un idioma a elección'],
      skillProfs: [], weaponProfs: [],
    },
    'Elfo': {
      emoji: '🧝', speed: 30, darkvision: 18,
      traits: [
        'Fey Ancestry — ventaja en saves contra ser encantado, inmune a dormir mágico',
        'Keen Senses — proficiencia en Percepción',
        'Trance — solo necesita 4 h de meditación en vez de 8 h de sueño',
      ],
      resistances: [], languages: ['Común', 'Élfico'],
      skillProfs: ['percepcion'], weaponProfs: [],
      subraces: [
        {
          name: 'Alto Elfo', emoji: '✨',
          traits: ['High Elf Cantrip — conocés un cantrip de Mago (INT)', 'Elf Weapon Training — prof espadas largas, espadas cortas, arcos cortos y largos'],
          skillProfs: [], weaponProfs: ['Espada larga', 'Espada corta', 'Arco corto', 'Arco largo'],
        },
        {
          name: 'Elfo de Bosque', emoji: '🌲',
          traits: ['Fleet of Foot — velocidad 35 ft (10,5 m)', 'Mask of the Wild — puedes intentar esconderte cuando estés en terreno natural'],
          speed: 35, skillProfs: [], weaponProfs: ['Espada larga', 'Espada corta', 'Arco corto', 'Arco largo'],
        },
        {
          name: 'Drow', emoji: '🕷️',
          traits: ['Superior Darkvision — visión en penumbra 36 m', 'Sunlight Sensitivity — desventaja en ataques y Percepción con luz solar', 'Drow Magic — Dancing Lights cantrip; Faerie Fire (nv3); Darkness (nv5)'],
          darkvision: 36, skillProfs: [], weaponProfs: ['Rapiera', 'Espada corta', 'Ballesta de mano'],
        },
      ],
    },
    'Enano': {
      emoji: '⛏️', speed: 30, darkvision: 18,
      traits: [
        'Dwarven Resilience — ventaja en saves contra veneno, resistencia a daño de veneno',
        'Stonecunning — Tremorsense 18 m en piedra sin pulir (Sabiduría, bonus acción)',
      ],
      resistances: ['Veneno'], languages: ['Común', 'Enano'],
      skillProfs: [], weaponProfs: ['Hacha de batalla', 'Hacha de mano', 'Martillo ligero', 'Martillo de guerra'],
      subraces: [
        {
          name: 'Enano de las Colinas', emoji: '🌾',
          traits: ['Dwarven Toughness — HP máximo +1 por nivel', 'Dwarven Wisdom — proficiencia en Perspicacia'],
          skillProfs: ['perspicacia'],
        },
        {
          name: 'Enano de las Montañas', emoji: '⛰️',
          traits: ['Dwarven Armor Training — proficiencia con armaduras ligeras y medias', 'Dwarven Strength — proficiencia en Atletismo'],
          skillProfs: ['atletismo'],
        },
      ],
    },
    'Halfling': {
      emoji: '🦶', speed: 30, darkvision: 0,
      traits: [
        'Brave — ventaja en saves contra el estado Asustado',
        'Halfling Nimbleness — puede moverse a través del espacio de criaturas más grandes',
        'Luck — cuando saca 1 en ataque, check o save, puede tirar de nuevo',
      ],
      resistances: [], languages: ['Común'], skillProfs: [], weaponProfs: [],
      subraces: [
        {
          name: 'Pies Ligeros', emoji: '🐾',
          traits: ['Naturally Stealthy — puede intentar esconderse tras criaturas de tamaño Mediano o mayor'],
          skillProfs: [],
        },
        {
          name: 'Robusto', emoji: '🛡️',
          traits: ['Sturdy — +1 HP por nivel', 'Resilience — ventaja en saves contra veneno, resistencia a veneno'],
          resistances: ['Veneno'], skillProfs: [],
        },
      ],
    },
    'Dragonborn': {
      emoji: '🐉', speed: 30, darkvision: 0,
      traits: [
        'Breath Weapon — acción bonus, área según tipo, save DEX/CON, daño escala con nivel',
        'Draconic Flight (nv5) — acción bonus para volar 10 m hasta fin del turno',
      ],
      resistances: [], languages: ['Común', 'Dracónico'], skillProfs: [], weaponProfs: [],
      subraces: [
        { name: 'Linaje de Fuego',    emoji: '🔥', traits: ['Draconic Ancestry: Fuego — Breath Weapon cono 15ft, save DEX'], resistances: ['Fuego'] },
        { name: 'Linaje de Frío',     emoji: '❄️', traits: ['Draconic Ancestry: Frío — Breath Weapon línea 30ft, save CON'],  resistances: ['Frío'] },
        { name: 'Linaje de Ácido',    emoji: '🟢', traits: ['Draconic Ancestry: Ácido — Breath Weapon línea 30ft, save DEX'], resistances: ['Ácido'] },
        { name: 'Linaje de Rayo',     emoji: '⚡', traits: ['Draconic Ancestry: Rayo — Breath Weapon línea 30ft, save DEX'],  resistances: ['Relámpago'] },
        { name: 'Linaje de Veneno',   emoji: '☠️', traits: ['Draconic Ancestry: Veneno — Breath Weapon cono 15ft, save CON'], resistances: ['Veneno'] },
        { name: 'Linaje de Trueno',   emoji: '💥', traits: ['Draconic Ancestry: Trueno — Breath Weapon cono 15ft, save CON'], resistances: ['Trueno'] },
        { name: 'Linaje de Psíquico', emoji: '🔮', traits: ['Draconic Ancestry: Psíquico — Breath Weapon línea 30ft, save INT'], resistances: ['Psíquico'] },
      ],
    },
    'Gnomo': {
      emoji: '🔧', speed: 30, darkvision: 18,
      traits: ['Gnomish Cunning — ventaja en saves de INT, SAB y CAR contra magia'],
      resistances: [], languages: ['Común', 'Gnómico'], skillProfs: [], weaponProfs: [],
      subraces: [
        {
          name: 'Gnomo de Roca', emoji: '⚙️',
          traits: ['Artificer\'s Lore — doble prof en Arcanos con herramientas', 'Tinker — crear pequeños dispositivos con herramientas de artesano'],
          skillProfs: [],
        },
        {
          name: 'Gnomo de Bosque', emoji: '🌿',
          traits: ['Natural Illusionist — conocés el cantrip Minor Illusion (INT)', 'Speak with Small Beasts — comunicación básica con animales pequeños'],
          skillProfs: [],
        },
      ],
    },
    'Tiefling': {
      emoji: '😈', speed: 30, darkvision: 18,
      traits: ['Otherworldly Presence — conocés el cantrip Thaumaturgy (SAB, INT o CAR)'],
      resistances: [], languages: ['Común', 'Infernal'], skillProfs: [], weaponProfs: [],
      subraces: [
        {
          name: 'Linaje Infernal', emoji: '🔱',
          traits: ['Hellish Resistance — resistencia a daño de Fuego', 'Infernal Legacy — Hellish Rebuke (nv3), Darkness (nv5)'],
          resistances: ['Fuego'],
        },
        {
          name: 'Linaje Abisal', emoji: '🌀',
          traits: ['Abyssal Fortitude — +1 HP por nivel', 'Abyssal Arcana — conjuros de la lista Abismal (cambian por nivel)'],
          resistances: [],
        },
        {
          name: 'Linaje Ctónico', emoji: '💀',
          traits: ['Necrotic Resistance — resistencia a daño necrótico', 'Chthonic Legacy — Spare the Dying cantrip; False Life (nv3); Ray of Enfeeblement (nv5)'],
          resistances: ['Necrótico'],
        },
      ],
    },
    'Aasimar': {
      emoji: '😇', speed: 30, darkvision: 18,
      traits: [
        'Celestial Resistance — resistencia a daño necrótico y radiante',
        'Healing Hands — acción: toca criatura y cura nº de PV = prof bonus (Long Rest)',
        'Light Bearer — conocés el cantrip Light',
      ],
      resistances: ['Necrótico', 'Radiante'], languages: ['Común', 'Celestial'],
      skillProfs: [], weaponProfs: [],
      subraces: [
        {
          name: 'Protector', emoji: '🕊️',
          traits: ['Radiant Soul (nv3) — alas, velocidad de vuelo = velocidad caminando, daño radiante extra = prof bonus'],
        },
        {
          name: 'Caído', emoji: '🌑',
          traits: ['Necrotic Shroud (nv3) — alas esqueléticas, criaturas cercanas hacen save CAR o quedan Asustadas; daño necrótico extra'],
        },
        {
          name: 'Scourge', emoji: '☀️',
          traits: ['Radiant Consumption (nv3) — luz intensa 3 m, daño radiante a ti y cercanos, daño radiante extra = prof bonus'],
        },
      ],
    },
    'Goliath': {
      emoji: '🏔️', speed: 35, darkvision: 0,
      traits: [
        'Large Form (nv5) — acción bonus: tamaño Grande por 10 min, 1 vez por Long Rest',
        'Powerful Build — cuenta como tamaño Grande para cargar/empujar/arrastrar',
      ],
      resistances: [], languages: ['Común', 'Gigante'], skillProfs: [], weaponProfs: [],
      subraces: [
        { name: 'Linaje de Nube',    emoji: '☁️',  traits: ['Cloud\'s Jaunt — teletransportación 9 m como acción bonus (Prof Bonus/día)'] },
        { name: 'Linaje de Fuego',   emoji: '🔥',  traits: ['Fire\'s Burn — +1d10 daño de fuego al golpear (Prof Bonus/día)'], resistances: ['Fuego'] },
        { name: 'Linaje de Escarcha',emoji: '❄️',  traits: ['Frost\'s Chill — objetivo velocidad −9 m hasta tu próximo turno (Prof Bonus/día)'], resistances: ['Frío'] },
        { name: 'Linaje de Colina',  emoji: '🌄',  traits: ['Hill\'s Tumble — empuja objetivo Grande o menor a tierra (Prof Bonus/día)'] },
        { name: 'Linaje de Piedra',  emoji: '🪨',  traits: ['Stone\'s Endurance — reducís daño recibido en 1d12+CON mod (Prof Bonus/día)'] },
        { name: 'Linaje de Tormenta',emoji: '⛈️', traits: ['Storm\'s Thunder — daño trueno 1d8 a atacante (Prof Bonus/día)'], resistances: ['Relámpago'] },
      ],
    },
    'Orco': {
      speed: 30, darkvision: 18,
      traits: [
        'Adrenaline Rush — acción bonus para Dash, gana PV temporales = prof bonus',
        'Relentless Endurance — 1 vez por Long Rest: al caer a 0 HP, quedás en 1 HP',
        'Powerful Build — cuenta como Grande para cargar/empujar',
      ],
      resistances: [], languages: ['Común', 'Orco'], skillProfs: [], weaponProfs: [],
    },
    'Custom': {
      speed: 30, darkvision: 0,
      traits: [],
      resistances: [], languages: ['Común'], skillProfs: [], weaponProfs: [],
    },
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
    const prof  = calcProfBonus(char.nivel);
    const mod   = calcMod(char.stats[char.spellcastingStat]);
    const bonus = (char.bonuses && char.bonuses.cd) || 0;
    return 8 + prof + mod + bonus;
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
    const hasPercepcion = char.skillProfs && char.skillProfs.includes('percepcion');
    const hasExp        = char.skillExpertise && char.skillExpertise.includes('percepcion');
    return 10 + mod + (hasExp ? prof * 2 : hasPercepcion ? prof : 0);
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
    const desMod = calcMod(char.stats.des);
    const conMod = calcMod(char.stats.con);
    const sabMod = calcMod(char.stats.sab);
    const bonus  = (char.bonuses && char.bonuses.ca) || 0;

    // Unarmored Defense: solo aplica cuando el personaje no lleva armadura
    // (armor.base_ca == 10 y add_dex == true → sin armadura real)
    const isUnarmored = !armor || (armor.base_ca === 10 && armor.add_dex && !armor.name);

    if (isUnarmored) {
      if (char.clase === 'Bárbaro') {
        // Bárbaro: 10 + DES + CON (sin escudo cambia la fórmula, pero escudo sí suma)
        const shield = (armor && armor.shield) ? (armor.shield_bonus || 2) : 0;
        return 10 + desMod + conMod + shield + bonus;
      }
      if (char.clase === 'Monje') {
        // Monje: 10 + DES + SAB (sin escudo — Monje no puede usar escudo)
        return 10 + desMod + sabMod + bonus;
      }
    }

    // Armadura normal (o clase sin Unarmored Defense)
    if (!armor) return 10 + bonus;
    let ca = armor.base_ca || 10;
    if (armor.add_dex) ca += desMod;
    if (armor.shield)  ca += armor.shield_bonus || 2;
    ca += bonus;
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
    { id:'toll-dead',    name:'Toll the Dead',    level:0, concentration:false, domain:false, mi:false, bonus:false, ritual:false, combat:true,
      castTime:'Acción', range:'18 m', duration:'Instantáneo', damage:'1d8 necrótico (2d12 si ya tiene daño)', upcast:null,
      desc:'Acción · 18 m · save WIS · 1d8 necrótico (2d12 si el objetivo ya tiene daño) · sin slot · sin ataque', tags:[],
      fullDesc:'Haces sonar una campana fúnebre invisible. La criatura hace save WIS o recibe 1d8 necrótico. Si ya le faltan HP al castear, el dado aumenta a 1d12. Escala a 2d8/2d12 a nivel 5, 3d8/3d12 a nivel 11, 4d8/4d12 a nivel 17.' },
    { id:'sacred-flame', name:'Sacred Flame',     level:0, concentration:false, domain:false, mi:false, bonus:false, ritual:false, combat:true,
      castTime:'Acción', range:'18 m', duration:'Instantáneo', damage:'1d8 radiante', upcast:null,
      desc:'Acción · 18 m · save DEX (ignora cobertura) · 1d8 radiante · escala con nivel del lanzador · ideal vs enemigos que se cubren', tags:[],
      fullDesc:'Llamas divinas caen sobre una criatura a 18 m. Hace save DEX — ignora completamente cualquier cobertura — o recibe 1d8 radiante. Escala a 2d8 a nivel 5, 3d8 a nivel 11, 4d8 a nivel 17.' },
    { id:'guidance',     name:'Guidance',         level:0, concentration:true,  domain:false, mi:false, bonus:false, ritual:false, combat:false,
      castTime:'Acción', range:'Toque', duration:'Concentración (1 min)', damage:null, upcast:null,
      desc:'Acción · toque · conc 1 min · +1d4 a 1 check de habilidad antes de tirar · solo fuera de combate', tags:['conc'],
      fullDesc:'Tocas a una criatura voluntaria. Antes de que termine la concentración puede añadir 1d4 al resultado de un check de habilidad de su elección. Usa el dado antes o después de tirar. Ideal fuera de combate.' },
    { id:'thaumaturgy',  name:'Thaumaturgy',      level:0, concentration:false, domain:false, mi:false, bonus:false, ritual:false, combat:false,
      castTime:'Acción', range:'9 m', duration:'1 minuto', damage:null, upcast:null,
      desc:'Acción · 9 m · efectos menores (voz, llamas, temblor, ojos) · duración 1 min · puro roleplay', tags:[],
      fullDesc:'Manifiestas un pequeño milagro: voz que retumba 3× más fuerte, llamas en colores, temblor leve, truenos lejanos, puertas que se abren solas, o tus ojos brillan. Hasta 3 efectos activos a la vez, cada uno dura 1 minuto.' },
    { id:'spare-dying',  name:'Spare the Dying',  level:0, concentration:false, domain:false, mi:false, bonus:false, ritual:false, combat:true,
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
      castTime:'Acción de bonus', range:'18 m', duration:'Instantáneo', damage:null, upcast:'+2d4 HP adicionales por nivel de slot sobre 1.',
      desc:'Bonus action · 18 m · 2d4+4 HP · levanta aliados caídos sin gastar la acción principal · imprescindible', tags:['bonus'],
      fullDesc:'Una criatura visible a 18 m recupera 2d4+4 HP. Acción de bonus — puedes curar y actuar en el mismo turno. Al upcastear: slot 2 = 4d4+4, slot 3 = 6d4+4, etc.' },
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
      castTime:'Acción de bonus', range:'18 m', duration:'Instantáneo', damage:null, upcast:'+2d4 HP adicionales por nivel de slot sobre 3.',
      desc:'Bonus action · 18 m · hasta 6 criaturas · 2d4+4 HP cada una · levanta a todo el grupo · SIN concentración · solo para emergencias masivas', tags:['bonus'],
      fullDesc:'Hasta 6 criaturas a 18 m recuperan 2d4+4 HP cada una. Acción de bonus, sin concentración — ideal cuando varios aliados caen en el mismo turno. Slot 4 = 4d4+4, slot 5 = 6d4+4.' },
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
    { section:'Cualquier turno', trigger:'Si varios aliados bajos en posiciones distintas', action:'<strong>Balm of Peace</strong> — muévete entre ellos, 2d6+4 a cada uno a 1,5 m, sin oportunidad de ataque', tag:'si' },
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
          current: 3, max: 3,
          recharge: 'long',
          note: '1d4 en ataque/save/check · 9 m · 10 min · max = prof bonus'
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
      currency: { pp: 0, gp: 0, sp: 0, cp: 0 },
      notes: '',

      bonuses: {
        ca: 0,           // ítems mágicos, hechizos (+1 Shield, etc.)
        savesAll: 0,     // bonus global a todos los saves (Aura Paladín, Cloak of Protection)
        saves: {},       // bonus por stat específico { sab: 1, ... }
        skills: {},      // bonus por skill { perspicacia: 1, ... }
        init: 0,         // Alert feat, ítems
        hpMax: 0,        // Tough feat, ítems permanentes (≠ temp HP)
        ataque: 0,       // arma mágica +1/+2/+3
        cd: 0,           // bonus extra al CD de conjuros (Bloodwell Vial, Arcane Grimoire, etc.)
      },

      diary: [],

      features: [
        {
          id: 'emboldening-bond',
          name: 'Emboldening Bond',
          source: 'Dominio de la Paz · Nivel 1',
          type: 'active',
          recharge: 'Largo',
          action: 'Acción',
          range: '9 m',
          desc: 'Crea un vínculo entre hasta Prof.Bonus criaturas (3 a nivel 6).',
          fullDesc: 'Como acción, eliges hasta tu Bono de Competencia (3) en criaturas que puedas ver a 9 m de ti, incluido tú mismo. Las criaturas vinculadas añaden 1d4 a todas sus tiradas de ataque, checks de habilidad y tiradas de salvación mientras permanezcan a 9 m entre sí. El efecto dura 10 minutos. Cada criatura solo puede estar vinculada una vez a la vez. Se recarga con descanso largo.'
        },
        {
          id: 'cd-balm',
          name: 'Balm of Peace',
          source: 'Channel Divinity · Dominio de la Paz',
          type: 'active',
          recharge: 'Corto/Largo',
          action: 'Acción',
          range: 'Movimiento',
          desc: 'Muévete sin provocar OA y cura a cada aliado que pases a 1,5 m.',
          fullDesc: 'Usas tu acción y gastas un uso de Channel Divinity. Hasta el final de tu turno, tu movimiento no provoca ataques de oportunidad. Cuando te mueves a 1,5 m de cualquier criatura durante este movimiento, puedes curarla por 2d6 + tu modificador de Sabiduría (+4) HP. Solo puedes curar a cada criatura una vez por uso. No requiere que las criaturas estén inconscientes ni que sean aliadas — puedes elegir a quién curar al moverte.'
        },
        {
          id: 'cd-spark',
          name: 'Divine Spark',
          source: 'Channel Divinity · Clérigo base',
          type: 'active',
          recharge: 'Corto/Largo',
          action: 'Acción',
          range: '18 m',
          desc: 'Cura o daña a una criatura por MOD SAB dados (d8).',
          fullDesc: 'Usas tu acción y gastas un uso de Channel Divinity. Apuntas a una criatura a 18 m que puedas ver. Lanzas un número de dados igual a tu modificador de Sabiduría (+4), usando d8. Puedes elegir curar a la criatura por ese total, o infligirle daño radiante o necrótico por ese total (tu elección al activar). A nivel 7 el número de dados aumenta en 1 (total 5d8). A nivel 11 aumenta otros 2 (total 7d8).'
        },
        {
          id: 'cd-undead',
          name: 'Turn Undead',
          source: 'Channel Divinity · Clérigo base',
          type: 'active',
          recharge: 'Corto/Largo',
          action: 'Acción',
          range: '9 m (área)',
          desc: 'Expulsa no-muertos cercanos que fallen su save de SAB.',
          fullDesc: 'Usas tu acción y gastas un uso de Channel Divinity. Cada no-muerto que puedas ver a 9 m de ti debe hacer una tirada de salvación de Sabiduría contra tu CD de conjuro (15). Si falla, queda Expulsado durante 1 minuto. Un no-muerto expulsado debe usar su movimiento para alejarse de ti lo máximo posible, no puede acercarse voluntariamente a ti, y no puede realizar reacciones. Solo puede usar la acción Dash o intentar escapar de un efecto que le impida moverse. Si no tiene adonde huir, puede usar la acción Dodge. A nivel 5 (Destroy Undead), no-muertos de CR 1/2 o menos son destruidos directamente.'
        },
        {
          id: 'protective-bond',
          name: 'Protective Bond',
          source: 'Dominio de la Paz · Nivel 6',
          type: 'active',
          recharge: null,
          action: 'Reacción',
          range: '9 m',
          desc: 'Un aliado vinculado puede teletransportarse para recibir el daño en tu lugar.',
          fullDesc: 'A nivel 6, el Emboldening Bond se vuelve más poderoso con Protective Bond.\n\nCuando una criatura vinculada por tu Emboldening Bond va a recibir daño, otra criatura vinculada que esté a 9 m o menos puede usar su reacción para teletransportarse al espacio de la primera criatura y recibir todo el daño en su lugar.\n\nCondiciones:\n1. Ambas criaturas deben estar actualmente vinculadas por tu Emboldening Bond.\n2. La criatura que interviene debe estar a 9 m o menos de quien va a recibir el daño.\n3. La criatura que interviene debe poder ver a la criatura objetivo.\n4. La criatura que interviene usa su reacción.\n\nEsto convierte el bond en una herramienta de protección activa — los aliados vinculados pueden literalmente interponerse por los demás.'
        },
        {
          id: 'servirse-poder-divino',
          name: 'Servirse del Poder Divino',
          source: 'Clérigo base · Nivel 2',
          type: 'active',
          recharge: 'Largo',
          action: 'Acción adicional',
          range: 'Personal',
          desc: 'Gasta un uso de Channel Divinity para recuperar un slot gastado (máx nivel 2 a nivel 6).',
          fullDesc: 'Como acción adicional, tocas tu símbolo sagrado, pronuncias una oración y recuperas un espacio de conjuro gastado, cuyo nivel no puede ser superior a la mitad de tu bonificador por competencia redondeando hacia arriba.\n\nA nivel 6 con Prof.Bonus +3: puedes recuperar slots de hasta nivel 2 (mitad de 3 = 1,5 → redondeado arriba = 2).\n\nUsos por descanso largo:\n· Nivel 2: 1 uso\n· Nivel 6: 2 usos ← actual\n· Nivel 18: 3 usos\n\nMuy útil para recuperar un slot de nivel 2 después de un encuentro corto sin necesitar descanso largo.'
        },
        {
          id: 'versatilidad-trucos',
          name: 'Versatilidad de Trucos',
          source: 'Clérigo base · Nivel 4',
          type: 'passive',
          recharge: null,
          action: 'Pasiva',
          range: 'Personal',
          desc: 'Al obtener una Mejora de Característica puedes cambiar un cantrip por otro de la lista de clérigo.',
          fullDesc: 'Cuando alcanzas un nivel en esta clase que otorga el rasgo Mejora de Característica (niveles 4, 8, 12, 16, 19), puedes sustituir un truco que hayas aprendido con el rasgo Lanzamiento de Conjuros de esta clase por otro truco de la lista de conjuros de clérigo.\n\nEsto te permite adaptar tus cantrips a medida que la campaña avanza. Por ejemplo, si Toll the Dead deja de ser útil en algún momento, puedes cambiarlo por Guidance o Sacred Flame en el siguiente nivel con Mejora de Característica.'
        },
        {
          id: 'war-caster',
          name: 'War Caster',
          source: 'Dote · Pasiva',
          type: 'passive',
          recharge: null,
          action: 'Pasiva / Reacción',
          range: 'Personal',
          desc: 'Ventaja en CON saves para concentración, Toll the Dead como OA.',
          fullDesc: 'Este dote otorga tres beneficios:\n\n1. Tienes ventaja en las tiradas de salvación de Constitución para mantener la concentración en un conjuro cuando recibes daño.\n\n2. Puedes realizar los componentes somáticos de los conjuros incluso cuando tienes una o dos manos ocupadas sosteniendo armas o escudos.\n\n3. Cuando una criatura provoca un ataque de oportunidad, puedes usar tu reacción para lanzar un conjuro con tiempo de casteo de 1 acción en lugar del ataque de oportunidad normal. El conjuro debe tener como objetivo solo esa criatura — Toll the Dead es la opción ideal (save SAB, 1d8 necrótico o 1d12 si ya tiene daño).'
        }
      ],

      ifttt: LURSEY_IFTTT,

      slotPriority: [
        { label: 'Revivify',                  note: 'Guardar hasta muerte real' },
        { label: 'Mass Healing Word',          note: 'Solo colapso total del grupo' },
        { label: 'Spirit Guard. / Beacon',     note: 'Ronda 1 vs jefe · elige según situación' },
        { label: 'Healing Word',               note: 'Reactivo cuando cae alguien' },
        { label: 'Resto — úsalos',             note: 'Command · Guiding Bolt · Lesser Restoration' }
      ],

      combatTips: [
        { text: '<strong>Bond activo + Bless = 2d4</strong> en ataques y saves · recuérdales cada combate' },
        { text: '<strong>Posición ideal:</strong> 4,5-6 m detrás del Paladín · alcanza con Balm of Peace y Spirit Guardians' }
      ],

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
      currency: { pp: 0, gp: 0, sp: 0, cp: 0 },
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

  /* ══════════════════════════════════════════════════════
     CATÁLOGOS POR CLASE
  ══════════════════════════════════════════════════════ */

  // ── CLASE_FEATURES: recursos y features descriptivas por clase ─────────────
  const CLASE_FEATURES = {
    'Clérigo': {
      resources: (nivel) => [
        { id:'channel-divinity', name:'Channel Divinity',
          current: nivel >= 6 ? 3 : nivel >= 2 ? 2 : 1,
          max:     nivel >= 6 ? 3 : nivel >= 2 ? 2 : 1,
          recharge:'short', note:'Turn Undead · Divine Spark · Balm of Peace' }
      ],
      features: [
        'Spellcasting (SAB)', 'Channel Divinity', 'Subclase (nv3)',
        'Ability Score Improvement (nv4)', 'Destroy Undead (nv5)',
        'Divine Intervention (nv10)',
      ],
    },
    'Bárbaro': {
      resources: (nivel) => [
        { id:'rage', name:'Rage',
          current: nivel>=17?6:nivel>=12?5:nivel>=9?4:nivel>=6?3:2,
          max:     nivel>=17?6:nivel>=12?5:nivel>=9?4:nivel>=6?3:2,
          recharge:'long', note:'Ventaja STR · Resistencia físico · +daño' }
      ],
      features: [
        'Rage', 'Unarmored Defense (CA = 10 + DES + CON)', 'Reckless Attack',
        'Danger Sense (ventaja saves DES)', 'Extra Attack (nv5)',
        'Fast Movement (nv5, +10 ft)', 'Feral Instinct (nv7)',
        'Brutal Critical (nv9)', 'Relentless Rage (nv11)',
        'Persistent Rage (nv15)', 'Indomitable Might (nv18)',
        'Primal Champion (nv20, +4 STR/CON)',
      ],
    },
    'Bardo': {
      resources: (nivel) => [
        { id:'bardic-inspiration', name:'Bardic Inspiration',
          current: Math.max(1, Math.floor((nivel-10)/2)+5 > 0 ? nivel >= 5 ? Math.floor((Math.max(0,nivel-10)/2)+4) : 1 : 1),
          max: nivel >= 20 ? 6 : nivel >= 15 ? 5 : nivel >= 10 ? 4 : nivel >= 5 ? 3 : 1,
          recharge: nivel >= 5 ? 'short' : 'long',
          note: `d${nivel>=15?12:nivel>=10?10:nivel>=5?8:6} · ${nivel>=5?'Short':'Long'} rest` }
      ],
      features: [
        'Bardic Inspiration', 'Jack of All Trades', 'Song of Rest (nv2)',
        'Expertise (x2 nv3)', 'Countercharm (nv6)', 'Magical Secrets (nv10)',
        'Superior Inspiration (nv20)',
      ],
    },
    'Druida': {
      resources: (nivel) => [
        { id:'wild-shape', name:'Wild Shape',
          current: 2, max: 2, recharge:'short',
          note: nivel>=18?'Bestia CR sin límite':nivel>=8?`CR ${nivel>=8?1:0.5}`:'CR 1/4' }
      ],
      features: [
        'Druidic (idioma secreto)', 'Spellcasting (SAB)', 'Wild Shape',
        'Timeless Body (nv18, no envejece)', 'Beast Spells (nv18)',
        'Archdruid (nv20, Wild Shape ilimitado)',
      ],
    },
    'Explorador': {
      resources: (nivel) => [
        { id:'hunters-mark-uses', name:"Hunter's Mark",
          current: nivel >= 17 ? 3 : nivel >= 9 ? 2 : 1,
          max:     nivel >= 17 ? 3 : nivel >= 9 ? 2 : 1,
          recharge:'long',
          note:'Lanzalo sin gastar slot (usos por Long Rest)' },
      ],
      features: (nivel) => [
        {
          id: 'favored-enemy', name: "Favored Enemy",
          source: 'Explorador · Nivel 1', type: 'passive', action: 'Pasiva', range: 'Personal', recharge: null,
          desc: 'Elegís un tipo de enemigo favorito. Ventaja en checks de SAB (Supervivencia) para rastrearlo y en checks de INT para recordar información sobre él.',
          fullDesc: 'A nivel 1 elegís un tipo de criatura favorita: Aberraciones, Bestias, Celestiales, Constructos, Dragones, Elementales, Feéricos, Fiends, Gigantes, Humanoides (elige 2 razas), Muertos Vivientes, Monstruosidades, Limos u Plantas.\n\nBeneficios:\n• Ventaja en tiradas de SAB (Supervivencia) para rastrear a tus enemigos favoritos.\n• Ventaja en tiradas de INT para recordar información sobre ellos.\n• Aprendés un idioma adicional hablado por uno de tus tipos de enemigo favoritos.\n\nA nivel 6 elegís un enemigo favorito adicional y aprendés otro idioma.\n\n2024 PHB: Esta habilidad fue rediseñada. El Ranger ahora tiene Favored Enemy como parte de su subclase (Hunter) o como habilidad base más general. Consultá con tu DM qué versión usan.',
        },
        {
          id: 'natural-explorer', name: 'Natural Explorer',
          source: 'Explorador · Nivel 1', type: 'passive', action: 'Pasiva', range: 'Personal', recharge: null,
          desc: 'Sos experto en un tipo de terreno. Beneficios de movimiento, rastreo y forrajeo en ese terreno.',
          fullDesc: 'Elegís un tipo de terreno favorito: Ártico, Costa, Desierto, Bosque, Pradera, Montaña, Pantano o el Underdark.\n\nCuando hacés un check de INT o SAB relacionado con tu terreno favorito, tu Prof Bonus se duplica.\n\nAdicional en tu terreno favorito (de viaje con grupo):\n• Terreno difícil no ralentiza el viaje del grupo.\n• El grupo no puede perderse salvo por medios mágicos.\n• Incluso cuando te distraés, sos igual de alerta.\n• Si viajás solo, podés moverse sigilosamente a paso normal.\n• Cuando buscás comida, encontrás el doble de lo normal.\n• Al rastrear criaturas, sabés su número exacto, tamaño y tiempo que llevan ahí.\n\nA niveles 6 y 10 elegís terrenos favoritos adicionales.',
        },
        {
          id: 'ranger-fighting-style', name: 'Fighting Style',
          source: 'Explorador · Nivel 2', type: 'passive', action: 'Pasiva', range: 'Personal', recharge: null,
          desc: 'Estilo de combate especializado. El Ranger tiene acceso a un subconjunto de estilos.',
          fullDesc: 'A nivel 2 adoptás un estilo de combate especializado. Las opciones disponibles para el Ranger son:\n\n• Archery — +2 a tiradas de ataque con armas a distancia.\n• Blind Fighting — Visión ciega 3 m. Podés ver criaturas invisibles no ocultas.\n• Defense — +1 CA mientras llevás armadura.\n• Druidic Warrior — Aprendés dos cantrips de la lista del Druida (SAB como stat de conjuro). Cuentan como conjuros de Ranger.\n• Dueling — +2 al daño con arma de una mano sin otra arma en la otra mano.\n• Thrown Weapon Fighting — +2 al daño con armas arrojadizas; podés sacarlas como parte del ataque.\n• Two-Weapon Fighting — Sumás el mod de stat al daño del ataque con la mano secundaria.',
        },
        {
          id: 'ranger-spellcasting', name: 'Spellcasting (SAB)',
          source: 'Explorador · Nivel 2', type: 'active', action: 'Varía', range: 'Varía', recharge: null,
          desc: 'Lanzás conjuros de Ranger usando SAB. Half-caster: slots empiezan en nv2.',
          fullDesc: 'A nivel 2 aprendés a usar la magia de la naturaleza.\n\nStat de conjuro: Sabiduría (SAB)\nCD de conjuros: 8 + Prof Bonus + mod SAB\nBonus de ataque: Prof Bonus + mod SAB\n\nConjuros conocidos: empezás con 2 conjuros de nivel 1. Aprendés más al subir de nivel (siempre según la tabla del Ranger).\n\nSlots: Half-caster. No tenés slots en nivel 1, empezás con 2 slots de nivel 1 en nivel 2. Los slots aumentan más lento que los full-casters.\n\nHunter\'s Mark: Desde el PHB 2024, Hunter\'s Mark es parte de la habilidad de clase del Ranger y puede lanzarse sin gastar slot un número de veces por Long Rest (igual a tu mod SAB mínimo 1).',
        },
        {
          id: 'primeval-awareness', name: 'Primeval Awareness',
          source: 'Explorador · Nivel 3', type: 'active', action: 'Acción', range: 'Varía', recharge: null,
          desc: 'Gastás un slot para detectar tipos de criaturas en un radio según el nivel del slot.',
          fullDesc: 'A nivel 3, podés usar tu acción y gastar un slot de conjuro de Ranger para enfocar tu conciencia en la región circundante.\n\nDurante 1 minuto por nivel del slot gastado, podés sentir si los siguientes tipos de criaturas están presentes en un radio de 1,5 km (6 km en terreno favorito): Aberraciones, Celestiales, Dragones, Elementales, Feéricos, Fiends o Muertos Vivientes.\n\nNo sabés la ubicación ni el número, solo si están presentes o no dentro del radio.',
        },
        {
          id: 'extra-attack-ranger', name: 'Extra Attack',
          source: 'Explorador · Nivel 5', type: 'passive', action: 'Pasiva', range: 'Personal', recharge: null,
          desc: 'Al usar la acción Atacar, atacás dos veces en lugar de una.',
          fullDesc: 'A partir del nivel 5, cada vez que tomás la acción Atacar podés atacar dos veces en lugar de una.\n\nEsto se aplica a todos los ataques de arma. Hunter\'s Mark te permite añadir 1d6 de daño a cada ataque que conecte contra el objetivo marcado.',
        },
        {
          id: 'lands-stride', name: "Land's Stride",
          source: 'Explorador · Nivel 8', type: 'passive', action: 'Pasiva', range: 'Personal', recharge: null,
          desc: 'El terreno difícil no mágico no te ralentiza. Ventaja en saves contra plantas mágicas que obstaculizan.',
          fullDesc: 'A partir del nivel 8, moverte a través de terreno difícil no mágico no te cuesta movimiento extra.\n\nAdemás, tenés ventaja en las tiradas de salvación contra plantas que estén creadas o manipuladas mágicamente para impedir el movimiento (como las creadas por el conjuro Entangle o Spike Growth).\n\nTambién podés atravesar plantas no mágicas sin que te ralenticen y sin recibir daño de ellas si tienen espinas, agujas u otro tipo de peligro similar.',
        },
        {
          id: 'hide-in-plain-sight', name: 'Hide in Plain Sight',
          source: 'Explorador · Nivel 10', type: 'active', action: '1 minuto de preparación', range: 'Personal', recharge: null,
          desc: 'Podés camuflarte quedándote inmóvil hasta quedar casi invisible (+10 a Sigilo).',
          fullDesc: 'A partir del nivel 10, podés pasar 1 minuto creando camuflaje para vos mismo. Debés tener acceso a barro, suciedad, plantas, hollín u otros materiales naturales con los que crear el camuflaje.\n\nUna vez camuflado de esta manera, podés intentar esconderte presionándote contra una superficie sólida como un árbol o una pared que sea al menos tan alta y ancha como vos.\n\nObtenes un +10 a las tiradas de Sigilo siempre que no te muevas. Si te movés, el camuflaje pierde efectividad y pierdes este beneficio.',
        },
        {
          id: 'vanish', name: 'Vanish',
          source: 'Explorador · Nivel 14', type: 'active', action: 'Acción bonus', range: 'Personal', recharge: null,
          desc: 'Podés usar Hide como acción bonus. No podés ser rastreado por medios no mágicos.',
          fullDesc: 'A partir del nivel 14, podés usar la acción Esconderse como acción adicional en tu turno.\n\nAdemás, no podés ser rastreado por medios no mágicos, salvo que elijas dejar rastro.',
        },
        {
          id: 'feral-senses', name: 'Feral Senses',
          source: 'Explorador · Nivel 18', type: 'passive', action: 'Pasiva', range: 'Personal', recharge: null,
          desc: 'Sentidos sobrehumanos: no tenés desventaja atacando criaturas invisibles si podés oírlas.',
          fullDesc: 'A partir del nivel 18, ganás sentidos sobrenaturales que te ayudan a combatir criaturas que no podés ver.\n\nCuando atacás a una criatura que no podés ver, tu incapacidad para verla no impone desventaja en tus tiradas de ataque contra ella, siempre que puedas oírla y no estés cegado ni ensordecido.\n\nAdemás, sos consciente de la ubicación de cualquier criatura invisible a 9 m de vos, siempre que la criatura no esté oculta de vos y no estés incapacitado.',
        },
        {
          id: 'foe-slayer', name: 'Foe Slayer',
          source: 'Explorador · Nivel 20', type: 'passive', action: 'Pasiva', range: 'Personal', recharge: null,
          desc: 'Una vez por turno podés sumar tu mod SAB a la tirada de ataque o de daño contra tu Favored Enemy.',
          fullDesc: 'Al nivel 20 te convertís en un cazador sin par contra tus enemigos.\n\nUna vez en cada uno de tus turnos, podés sumar tu modificador de Sabiduría a la tirada de ataque o a la tirada de daño de un ataque que hagas contra uno de tus enemigos favoritos.\n\nPodés elegir usar este beneficio antes o después de la tirada, pero antes de que el DM determine si el ataque impacta o falla.',
        },
      ],
    },
    'Guerrero': {
      resources: (nivel) => [
        { id:'action-surge', name:'Action Surge',
          current: nivel >= 17 ? 2 : 1, max: nivel >= 17 ? 2 : 1,
          recharge:'short', note:'Turno extra de acciones' },
        { id:'second-wind', name:'Second Wind',
          current: 1, max: 1, recharge:'short',
          note:`Recupera 1d10+${nivel} HP como acción bonus` },
      ],
      features: (nivel) => [
        {
          id: 'fighting-style', name: 'Fighting Style',
          source: 'Guerrero · Nivel 1', type: 'passive', action: 'Pasiva', range: 'Personal', recharge: null,
          desc: 'Elige un estilo de combate especializado que te da un beneficio pasivo permanente.',
          fullDesc: 'Adoptas un estilo de combate particular como especialidad. Elige una de las siguientes opciones (no puedes tomar la misma opción dos veces):\n\n• Archery — +2 a tiradas de ataque con armas a distancia.\n• Blind Fighting — Tienes visión ciega en 3 m. Puedes ver criaturas invisibles que no estén ocultas.\n• Defense — +1 CA mientras llevas armadura.\n• Dueling — +2 al daño con arma de una mano cuando no llevas otra arma (escudo sí está permitido).\n• Great Weapon Fighting — Cuando sacás 1 o 2 en un dado de daño con arma de dos manos o versátil (dos manos), volvés a tirar ese dado y usás el nuevo resultado.\n• Interception — Reacción: reducís el daño de un aliado cercano en 1d10 + Prof Bonus.\n• Protection — Reacción: imponés desventaja en el ataque de un enemigo visible a un aliado a 1,5 m. Requiere escudo.\n• Superior Technique — Aprendés una maniobra de Battle Master (1 Superiority Die d6, recarga Short Rest).\n• Thrown Weapon Fighting — +2 al daño con armas arrojadizas; podés sacar un arma arrojadiza como parte del ataque.\n• Two-Weapon Fighting — Al atacar con arma ligera en la mano secundaria, podés sumar el mod de stat al daño.\n• Unarmed Fighting — Ataques desarmados hacen 1d6 de daño (1d8 si las dos manos libres). Agarras → 1d4 daño al inicio del turno.',
        },
        {
          id: 'second-wind', name: 'Second Wind',
          source: 'Guerrero · Nivel 1', type: 'active', action: 'Acción bonus', range: 'Personal', recharge: 'short',
          desc: 'Recuperás 1d10 + nivel de Guerrero HP como acción bonus.',
          fullDesc: 'Tenés una reserva de resistencia que podés usar para protegerte del daño.\n\nComo acción adicional, recuperás puntos de golpe iguales a 1d10 + tu nivel de Guerrero.\n\nUna vez que usás esta habilidad, debés terminar un descanso corto o largo para poder usarla de nuevo.\n\nEscala: el bonus fijo (nivel de Guerrero) crece con cada nivel, haciéndolo más valioso a medida que subís.',
        },
        {
          id: 'action-surge', name: 'Action Surge',
          source: `Guerrero · Nivel 2${nivel >= 17 ? ' (×2)' : ''}`, type: 'active', action: 'Sin acción', range: 'Personal', recharge: 'short',
          desc: `Tomás una acción adicional completa en tu turno. ${nivel >= 17 ? '2 usos por descanso.' : '1 uso por descanso corto/largo.'}`,
          fullDesc: 'A partir del nivel 2, podés esforzarte más allá de tus límites normales por un momento.\n\nEn tu turno podés tomar una acción adicional encima de tu acción normal y posible acción adicional.\n\nUna vez que usás esta habilidad, debés terminar un descanso corto o largo antes de poder usarla de nuevo. A partir del nivel 17, podés usarla dos veces antes de necesitar descanso, pero solo una vez por turno.\n\nNo otorga una acción adicional extra — podés usar la nueva acción para Atacar (incluyendo Extra Attack), Lanzar Hechizo, Dash, Disengage, Dodge, Help, Hide, Search o Use Object.',
        },
        {
          id: 'extra-attack', name: `Extra Attack${nivel >= 20 ? ' (×4)' : nivel >= 11 ? ' (×3)' : nivel >= 5 ? ' (×2)' : ''}`,
          source: `Guerrero · Nivel ${nivel >= 20 ? 20 : nivel >= 11 ? 11 : 5}`, type: 'passive', action: 'Pasiva', range: 'Personal', recharge: null,
          desc: `Al usar la acción Atacar, podés atacar ${nivel >= 20 ? 4 : nivel >= 11 ? 3 : 2} veces.`,
          fullDesc: 'A partir del nivel 5, cada vez que tomás la acción Atacar podés atacar dos veces, en lugar de una.\n\nEl número de ataques aumenta a tres cuando alcanzás el nivel 11 en esta clase, y a cuatro cuando alcanzás el nivel 20.\n\nNota: esto se suma a cualquier ataque adicional de Action Surge. Un Guerrero de nivel 11 con Action Surge puede hacer 6 ataques en un turno (3 + 3).',
        },
        {
          id: 'indomitable', name: 'Indomitable',
          source: 'Guerrero · Nivel 9', type: 'active', action: 'Ninguna (reacción implícita)', range: 'Personal', recharge: 'long',
          desc: 'Podés repetir una tirada de salvación fallida (1 uso/Long Rest; 2 usos nv13; 3 usos nv17).',
          fullDesc: 'A partir del nivel 9, podés volver a tirar una tirada de salvación fallida. Si lo hacés, debés usar el nuevo resultado.\n\nPodés usar esta habilidad una vez entre descansos largos. A nivel 13 podés usarla dos veces, y a nivel 17 tres veces.\n\nClave: se usa después de ver el resultado fallido, antes de que el efecto se aplique. No tiene costo de acción — simplemente declarás que re-tirás.',
        },
      ],
    },
    'Hechicero': {
      resources: (nivel) => [
        { id:'sorcery-points', name:'Sorcery Points',
          current: nivel, max: nivel, recharge:'long',
          note:'Metamagic · Flexible Casting' }
      ],
      features: [
        'Spellcasting (CAR)', 'Sorcerous Origin',
        'Font of Magic (nv2)', 'Metamagic (nv3)',
        'Ability Score Improvement (nv4)', 'Sorcerous Restoration (nv20)',
      ],
    },
    'Mago': {
      resources: (nivel) => [
        { id:'arcane-recovery', name:'Arcane Recovery',
          current: 1, max: 1, recharge:'long',
          note:`Recupera hasta ${Math.ceil(nivel/2)} niveles de slots (Short Rest · 1/día)` }
      ],
      features: [
        'Spellcasting (INT)', 'Arcane Recovery', 'Arcane Tradition (nv2)',
        'Ability Score Improvement (nv4)', 'Spell Mastery (nv18)',
        'Signature Spells (nv20)',
      ],
    },
    'Monje': {
      resources: (nivel) => [
        { id:'ki', name:'Ki', current: nivel, max: nivel,
          recharge:'short', note:'Flurry of Blows · Patient Defense · Step of the Wind' },
        { id:'stunning-strike', name:'Stunning Strike', current: 0, max: 0,
          recharge:'short', note:'Gasta 1 Ki después de golpear → Save CON o aturdido' },
      ],
      features: [
        'Unarmored Defense (CA = 10 + DES + SAB)', 'Martial Arts',
        'Ki (nv2)', 'Unarmored Movement (nv2)', 'Deflect Missiles (nv3)',
        'Slow Fall (nv4)', 'Extra Attack (nv5)', 'Stunning Strike (nv5)',
        'Ki-Empowered Strikes (nv6)', 'Evasion (nv7)',
        'Diamond Soul (nv14, prof todos los saves)', 'Timeless Body (nv15)',
        'Empty Body (nv18)', 'Perfect Self (nv20)',
      ],
    },
    'Paladín': {
      resources: (nivel) => [
        { id:'lay-on-hands', name:'Lay on Hands',
          current: nivel * 5, max: nivel * 5,
          recharge:'long', note:`${nivel*5} HP de pool · 5 HP para curar · 1 HP para curar enfermedad` },
        { id:'channel-divinity', name:'Channel Divinity',
          current: 1, max: 1, recharge:'short', note:'Sacred Weapon · Turn the Unholy' },
        { id:'divine-smite', name:'Divine Smite', current: 0, max: 0,
          recharge:'never', note:'Gasta slots después de golpear para +2d8 daño radiante' },
      ],
      features: [
        'Lay on Hands', 'Divine Sense', 'Fighting Style (nv2)',
        'Spellcasting (CAR, nv2)', 'Divine Smite (nv2)',
        'Channel Divinity (nv3)', 'Sacred Oath (nv3)',
        'Extra Attack (nv5)', 'Aura of Protection (nv6, +CAR saves)',
        'Aura of Courage (nv10)', 'Cleansing Touch (nv14)',
      ],
    },
    'Pícaro': {
      resources: (nivel) => [
        { id:'cunning-action', name:'Cunning Action', current: 0, max: 0,
          recharge:'never', note:'Bonus action: Dash · Disengage · Hide' },
        { id:'uncanny-dodge', name:'Uncanny Dodge', current: 0, max: 0,
          recharge:'never', note:'Reacción: mitad de daño de un ataque visible' },
      ],
      features: (nivel) => [
        `Sneak Attack (${Math.ceil(nivel/2)}d6)`, 'Thieves\' Cant',
        'Cunning Action (nv2)', 'Uncanny Dodge (nv5)',
        'Evasion (nv7)', 'Reliable Talent (nv11)',
        'Blindsense (nv14)', 'Slippery Mind (nv15)',
        'Elusive (nv18)', 'Stroke of Luck (nv20)',
      ],
    },
    'Brujo': {
      resources: (nivel) => {
        const wSlots = WARLOCK_SLOTS[nivel] || [2];
        const maxSlots = wSlots[0] || 2;
        return [
          { id:'pact-slots', name:'Pact Magic Slots',
            current: maxSlots, max: maxSlots,
            recharge:'short', note:`Slot nivel ${nivel>=9?5:nivel>=7?4:nivel>=5?3:nivel>=3?2:1} · Short/Long rest` },
          { id:'eldritch-invocations', name:'Eldritch Invocations', current: 0, max: 0,
            recharge:'never', note:'Poderes especiales de Pact' },
        ];
      },
      features: [
        'Otherworldly Patron', 'Pact Magic', 'Eldritch Invocations (nv2)',
        'Pact Boon (nv3)', 'Ability Score Improvement (nv4)',
        'Mystic Arcanum (nv11+)', 'Eldritch Master (nv20)',
      ],
    },
  };

  // ── SUBCLASES_CONFIG: recursos y features adicionales por subclase ──────────
  // Estructura: { 'NombreSubclase': { clase, resources(nivel), features[] } }
  const SUBCLASES_CONFIG = {

    // ── GUERRERO ──────────────────────────────────────────────────────────────
    'Battle Master': {
      clase: 'Guerrero',
      resources: (nivel) => {
        // Superiority Dice: d8 a d10(nv10) a d12(nv18), cantidad 4→5(nv7)→6(nv15)
        const diceCount = nivel >= 15 ? 6 : nivel >= 7 ? 5 : 4;
        const diceSide  = nivel >= 18 ? 12 : nivel >= 10 ? 10 : 8;
        return [
          { id:'superiority-dice', name:'Superiority Dice',
            current: diceCount, max: diceCount, recharge:'short',
            note:`d${diceSide} · Gasta 1 por maniobra · CD = 8+prof+FUE/DES` },
        ];
      },
      features: (nivel) => [
        { id:'bm-combat-superiority', name:'Combat Superiority',
          source:'Battle Master · Nv3', type:'active', action:'Varía', range:'Varía', recharge:'Short Rest',
          desc:`${nivel>=15?6:nivel>=7?5:4} Superiority Dice (d${nivel>=18?12:nivel>=10?10:8}). Gasta 1 dado al usar una maniobra.`,
          fullDesc:'Tus maniobras funcionan adicionando el dado de superioridad al daño, saves del enemigo u otros efectos. El CD es 8 + Prof + mod FUE o DES.\n\nSe recargan con descanso corto o largo.' },
        { id:'bm-know-your-enemy', name:'Know Your Enemy',
          source:'Battle Master · Nv7', type:'passive', action:'Pasiva', range:'Personal', recharge:null,
          desc:'Tras observar 1 min a una criatura, el DM te dice si es superior/inferior/igual a ti en 2 características.',
          fullDesc:'Si pasas al menos 1 minuto observando o interactuando con otra criatura fuera de combate, puedes aprender cierta información sobre sus capacidades comparadas con las tuyas. El DM te dice si la criatura es superior, inferior o aproximadamente igual en cuanto a 2 de las siguientes características: FUE, DES, CON, CA, puntos de golpe actuales, nivel de clase total (si es que tiene alguno).' },
        { id:'bm-improved-combat-superiority', name:'Improved Combat Superiority',
          source:`Battle Master · ${nivel>=18?'Nv18':'Nv10'}`, type:'passive', action:'Pasiva', range:'Personal', recharge:null,
          desc:`Tus Superiority Dice son d${nivel>=18?12:10} (mejorado desde d${nivel>=18?10:8}).`,
          fullDesc:'A nivel 10 tus dados de superioridad se convierten en d10. A nivel 18 se convierten en d12.' },
        { id:'bm-relentless', name:'Relentless',
          source:'Battle Master · Nv15', type:'passive', action:'Pasiva', range:'Personal', recharge:null,
          desc:'Si no te quedan Superiority Dice al tirar iniciativa, recuperas 1.',
          fullDesc:'A partir del nivel 15, cuando tiras iniciativa y no tienes dados de superioridad restantes, recuperas 1 dado de superioridad.' },
      ],
      // Maniobras: el usuario elige 3(nv3)+1(nv7)+1(nv10)+1(nv15) = hasta 6
      maneuvers: [
        { id:'mn-commander-strike',   name:"Commander's Strike",   desc:'Acción bonus: un aliado usa su reacción para atacar.' },
        { id:'mn-disarming-attack',   name:'Disarming Attack',      desc:'+1d8 daño; save FUE o suelta un objeto.' },
        { id:'mn-distracting-strike', name:'Distracting Strike',    desc:'+1d8 daño; siguiente ataque contra el objetivo tiene ventaja.' },
        { id:'mn-evasive-footwork',   name:'Evasive Footwork',      desc:'+1d8 a CA mientras te mueves.' },
        { id:'mn-feinting-attack',    name:'Feinting Attack',       desc:'Acción bonus: ventaja en siguiente ataque + 1d8 daño.' },
        { id:'mn-goading-attack',     name:'Goading Attack',        desc:'+1d8 daño; save SAB o desventaja en ataques a otros.' },
        { id:'mn-lunging-attack',     name:'Lunging Attack',        desc:'+1,5m alcance melee + 1d8 daño.' },
        { id:'mn-maneuvering-attack', name:'Maneuvering Attack',    desc:'+1d8 daño; aliado se mueve sin ataques de oportunidad.' },
        { id:'mn-menacing-attack',    name:'Menacing Attack',       desc:'+1d8 daño; save SAB o Asustado hasta fin de tu turno.' },
        { id:'mn-parry',              name:'Parry',                  desc:'Reacción: reduce daño recibido en 1d8+DES.' },
        { id:'mn-precision-attack',   name:'Precision Attack',      desc:'Antes de tirar: +1d8 al ataque.' },
        { id:'mn-pushing-attack',     name:'Pushing Attack',        desc:'+1d8 daño; save FUE o empujado 4,5m.' },
        { id:'mn-rally',              name:'Rally',                  desc:'Acción bonus: aliado gana 1d8+CAR HP temporales.' },
        { id:'mn-riposte',            name:'Riposte',               desc:'Reacción al fallar enemigo: ataca con +1d8 daño.' },
        { id:'mn-sweeping-attack',    name:'Sweeping Attack',       desc:'Si golpeas: 1d8 daño a otra criatura adyacente (sin tirada).' },
        { id:'mn-trip-attack',        name:'Trip Attack',           desc:'+1d8 daño; save FUE o tumbado (Prone).' },
      ],
    },

    'Champion': {
      clase: 'Guerrero',
      resources: () => [],
      features: () => [
        { id:'champ-improved-critical', name:'Improved Critical',
          source:'Champion · Nv3', type:'passive', action:'Pasiva', range:'Personal', recharge:null,
          desc:'Tus ataques son críticos con 19-20 (en lugar de solo 20).',
          fullDesc:'Tus tiradas de ataque con armas hacen un golpe crítico con un resultado de 19 o 20 en el dado.' },
        { id:'champ-remarkable-athlete', name:'Remarkable Athlete',
          source:'Champion · Nv7', type:'passive', action:'Pasiva', range:'Personal', recharge:null,
          desc:'Suma la mitad de tu Prof Bonus a checks de FUE/DES/CON sin proficiencia. Salto largo +FUE mod.',
          fullDesc:'Puedes añadir la mitad de tu bonificador de competencia (redondeando hacia arriba) a cualquier tirada de características de Fuerza, Destreza o Constitución que no use tu bonificador de competencia. Además, cuando haces un salto largo, la distancia que puedes cubrir aumenta en un número de pies igual a tu modificador de Fuerza.' },
        { id:'champ-superior-critical', name:'Superior Critical',
          source:'Champion · Nv15', type:'passive', action:'Pasiva', range:'Personal', recharge:null,
          desc:'Tus ataques son críticos con 18-20.',
          fullDesc:'A nivel 15, tus tiradas de ataque con armas hacen un golpe crítico con un resultado de 18, 19 o 20.' },
        { id:'champ-survivor', name:'Survivor',
          source:'Champion · Nv18', type:'passive', action:'Pasiva', range:'Personal', recharge:null,
          desc:'Al inicio de tu turno, si tienes entre 1 y la mitad de tu HP máx, recuperas 5 + CON mod HP.',
          fullDesc:'Alcanzas la cúspide de la resiliencia en combate. Al inicio de cada uno de tus turnos, recuperas puntos de golpe iguales a 5 + tu modificador de Constitución si no tienes más de la mitad de tus puntos de golpe. No ganas este beneficio si tienes 0 puntos de golpe.' },
      ],
    },

    'Eldritch Knight': {
      clase: 'Guerrero',
      resources: (nivel) => {
        // EK usa slots de tercio-caster (floor(nivel/3))
        const ekLevel = Math.floor(nivel / 3);
        return []; // Los slots van en spellSlots directamente
      },
      features: () => [
        { id:'ek-spellcasting', name:'Spellcasting (INT)',
          source:'Eldritch Knight · Nv3', type:'active', action:'Varía', range:'Varía', recharge:null,
          desc:'Lanzas conjuros de Mago usando INT. Slots de tercio-caster (nivel 3+).',
          fullDesc:'A nivel 3 puedes lanzar conjuros de la lista del Mago. Usas Inteligencia como stat de conjuro.\n\nSlots: Nv3→2 slots nv1 · Nv4→3 · Nv7→4 + 1nv2 · Nv10→4/2/0 · Nv13→4/3 · Nv16→4/3/2 · Nv19→4/3/3/1' },
        { id:'ek-war-magic', name:'War Magic',
          source:'Eldritch Knight · Nv7', type:'active', action:'Acción bonus', range:'Personal', recharge:null,
          desc:'Al lanzar un cantrip, puedes atacar con arma como acción bonus.',
          fullDesc:'Cuando usas tu acción para lanzar un cantrip, puedes hacer un ataque con arma como acción adicional.' },
        { id:'ek-eldritch-strike', name:'Eldritch Strike',
          source:'Eldritch Knight · Nv10', type:'passive', action:'Pasiva', range:'Personal', recharge:null,
          desc:'Cuando golpeas a un enemigo, desventaja en su save contra tu próximo conjuro.',
          fullDesc:'Cuando golpeas a una criatura con un ataque de arma, esa criatura tiene desventaja en la siguiente tirada de salvación que haga contra un conjuro que lanzas antes del final de tu siguiente turno.' },
      ],
    },

    // ── CLÉRIGO ───────────────────────────────────────────────────────────────
    'Dominio de la Paz': {
      clase: 'Clérigo',
      resources: (nivel) => [
        { id:'channel-divinity', name:'Channel Divinity',
          current: nivel >= 18 ? 3 : nivel >= 6 ? 2 : 1,
          max:     nivel >= 18 ? 3 : nivel >= 6 ? 2 : 1,
          recharge:'short',
          note:'Balm of Peace · Emboldening Bond · Turn Undead' },
        { id:'bond', name:'Emboldening Bond',
          current: nivel >= 9 ? 4 : nivel >= 5 ? 3 : nivel >= 2 ? 2 : 1,
          max:     nivel >= 9 ? 4 : nivel >= 5 ? 3 : nivel >= 2 ? 2 : 1,
          recharge:'long',
          note:'1d4 en ataque/save/check · 9m · max = prof bonus' },
      ],
      features: () => [],
    },

    // ── DRUIDA ────────────────────────────────────────────────────────────────
    'Círculo de la Luna': {
      clase: 'Druida',
      resources: (nivel) => [
        { id:'wild-shape', name:'Wild Shape',
          current: 2, max: 2, recharge:'short',
          note:`CR máx ${nivel>=18?'sin límite':nivel>=9?3:nivel>=6?2:1} · Elementales (nv10)` },
      ],
      features: () => [
        { id:'moon-combat-wild-shape', name:'Combat Wild Shape',
          source:'Círculo de la Luna · Nv2', type:'active', action:'Acción bonus', range:'Personal', recharge:'Short Rest',
          desc:'Transforma usando acción bonus. Gasta slots para curar 1d8 HP por nivel del slot.',
          fullDesc:'Cuando estás en forma salvaje, puedes usar una acción adicional para gastar un espacio de conjuro y recuperar 1d8 puntos de golpe por nivel del espacio gastado.' },
        { id:'moon-elemental-wild-shape', name:'Elemental Wild Shape',
          source:'Círculo de la Luna · Nv10', type:'active', action:'Acción', range:'Personal', recharge:'Short Rest',
          desc:'Gasta 2 usos de Wild Shape para transformarte en un elemental (aire, tierra, fuego, agua).',
          fullDesc:'Puedes gastar dos usos de Wild Shape al mismo tiempo para transformarte en un elemental de aire, tierra, fuego o agua.' },
      ],
    },

    // ── PÍCARO ────────────────────────────────────────────────────────────────
    'Arcane Trickster': {
      clase: 'Pícaro',
      resources: () => [],
      features: () => [
        { id:'at-spellcasting', name:'Spellcasting (INT)',
          source:'Arcane Trickster · Nv3', type:'active', action:'Varía', range:'Varía', recharge:null,
          desc:'Conjuros de Mago usando INT. Slots de tercio-caster.',
          fullDesc:'Usas Inteligencia como stat de conjuro. Accedes a una lista limitada de conjuros de Mago, principalmente de las escuelas de Encantamiento e Ilusión.' },
        { id:'at-misdirection', name:'Misdirection',
          source:'Arcane Trickster · Nv13', type:'active', action:'Acción bonus', range:'9m', recharge:null,
          desc:'Haz que una criatura mire a otro lado — otorgas ventaja a tus aliados para esconderse.',
          fullDesc:'Puedes usar una acción adicional para redirigir la atención de una criatura que puedas ver y que esté a 9 metros.' },
      ],
    },

    // ── MONJE ─────────────────────────────────────────────────────────────────
    'Way of the Open Hand': {
      clase: 'Monje',
      resources: () => [],
      features: () => [
        { id:'woh-open-hand-technique', name:'Open Hand Technique',
          source:'Way of the Open Hand · Nv3', type:'active', action:'Acción (Flurry)', range:'Melee', recharge:null,
          desc:'Al usar Flurry of Blows: tumba, empuja 4,5m o niega reacciones hasta fin de su turno.',
          fullDesc:'Cuando golpeas con Flurry of Blows, puedes imponer uno de estos efectos: el objetivo debe superar un save de DES o caer Prone; el objetivo debe superar un save de FUE o ser empujado hasta 4,5 metros; el objetivo no puede hacer reacciones hasta el inicio de tu próximo turno.' },
        { id:'woh-wholeness-of-body', name:'Wholeness of Body',
          source:'Way of the Open Hand · Nv6', type:'active', action:'Acción bonus', range:'Personal', recharge:'Long Rest',
          desc:'Recupera HP iguales a 3 × tu nivel de Monje (1/Long Rest).',
          fullDesc:'Ganas la capacidad de curarte a ti mismo. Como acción adicional, puedes recuperar puntos de golpe iguales a tres veces tu nivel de monje. Debes terminar un descanso largo antes de poder usar esta habilidad de nuevo.' },
      ],
    },

    // ── BÁRBARO ───────────────────────────────────────────────────────────────
    'Path of the Berserker': {
      clase: 'Bárbaro',
      resources: () => [],
      features: () => [
        { id:'berserk-frenzy', name:'Frenzy',
          source:'Path of the Berserker · Nv3', type:'active', action:'Acción bonus (en Rage)', range:'Melee', recharge:'Long Rest',
          desc:'Mientras estás en Rage, puedes atacar como acción bonus en cada turno. Al terminar el Rage, sufres 1 nivel de agotamiento.',
          fullDesc:'Puedes entrar en un frenesí cuando rages. Si lo haces, mientras dure tu rage puedes hacer un ataque adicional con arma como acción adicional en cada uno de tus turnos. Al terminar el rage, sufres un nivel de agotamiento.' },
        { id:'berserk-mindless-rage', name:'Mindless Rage',
          source:'Path of the Berserker · Nv6', type:'passive', action:'Pasiva', range:'Personal', recharge:null,
          desc:'No puedes ser Encantado ni Asustado mientras estás en Rage. Si lo estás al comenzar, el efecto se suspende.',
          fullDesc:'No puedes ser encantado ni asustado mientras estás en furia. Si estás encantado o asustado cuando comienzas tu furia, el efecto queda suspendido durante la furia.' },
      ],
    },

    // ── PALADÍN ───────────────────────────────────────────────────────────────
    'Oath of Devotion': {
      clase: 'Paladín',
      resources: (nivel) => [
        { id:'channel-divinity-pal', name:'Channel Divinity',
          current: 1, max: 1, recharge:'short',
          note:'Sacred Weapon · Turn the Unholy' },
      ],
      features: () => [
        { id:'dev-sacred-weapon', name:'Sacred Weapon',
          source:'Oath of Devotion · Nv3', type:'active', action:'Acción bonus', range:'Personal', recharge:'Short/Long Rest',
          desc:'Canal: arma brilla (20ft luz), +CAR mod a tiradas de ataque por 1 min.',
          fullDesc:'Como acción adicional, puedes imbuid un arma que sostienes con energía positiva, usando tu Canalizar Divinidad. Durante 1 minuto, añades tu modificador de Carisma a las tiradas de ataque hechas con esa arma (mínimo +1). El arma también emite luz brillante en un radio de 6 metros y luz tenue 6 metros más. Si el arma ya está mágica, los bonificadores se acumulan.' },
      ],
    },
  };

  // ── CLASE_SPELLS: hechizos base por clase ─────────────────────────────────
  // Catálogo representativo para empezar. El usuario puede agregar más después.
  const CLASE_SPELLS = {

    'Clérigo': [], // Lursey ya define sus propios; nuevo clérigo empieza sin lista fija

    'Druida': [
      { id:'shillelagh',  name:'Shillelagh',      level:0, castTime:'Acción bonus', range:'Toque', duration:'1 min',    concentration:false, combat:true,  desc:'Arma de madera usa SAB en vez de FUE, daño 1d8.' },
      { id:'guidance',    name:'Guidance',         level:0, castTime:'Acción',       range:'Toque', duration:'1 min',    concentration:true,  combat:false, desc:'Otorga 1d4 a una tirada de habilidad.' },
      { id:'produce-flame', name:'Produce Flame',  level:0, castTime:'Acción',       range:'Uno mismo', duration:'10 min', concentration:false, combat:true, desc:'Llama en la mano: ilumina 10ft o 1d8 fuego al lanzar.' },
      { id:'entangle',    name:'Entangle',          level:1, castTime:'Acción',       range:'27 m', duration:'1 min',    concentration:true,  combat:true,  desc:'Save FUE o restringido en área de plantas (18ft²).' },
      { id:'healing-word-d', name:'Healing Word',  level:1, castTime:'Acción bonus', range:'18 m', duration:'Inst.',    concentration:false, combat:false, desc:'1d4+SAB HP. Escala +1d4 por nivel superior.' },
      { id:'faerie-fire', name:'Faerie Fire',       level:1, castTime:'Acción',       range:'18 m', duration:'1 min',    concentration:true,  combat:true,  desc:'Save DES o brillan → ventaja en ataques contra ellos.' },
      { id:'thunderwave-d', name:'Thunderwave',    level:1, castTime:'Acción',       range:'Uno mismo (15ft)', duration:'Inst.', concentration:false, combat:true, desc:'Cubo 15ft · save CON · 2d8 trueno y empuja 10ft.' },
      { id:'spike-growth',name:'Spike Growth',     level:2, castTime:'Acción',       range:'45 m', duration:'10 min',   concentration:true,  combat:true,  desc:'Área difícil 20ft radio · 2d4 perforante por 5ft caminados.' },
      { id:'moonbeam',    name:'Moonbeam',          level:2, castTime:'Acción',       range:'36 m', duration:'1 min',    concentration:true,  combat:true,  desc:'Cilindro 5ft · save CON · 2d10 radiante por turno.' },
      { id:'flaming-sphere', name:'Flaming Sphere', level:2, castTime:'Acción',      range:'18 m', duration:'1 min',    concentration:true,  combat:true,  desc:'Esfera 5ft · 2d6 fuego save DES · movible bonus action.' },
    ],

    'Bardo': [
      { id:'vicious-mockery', name:'Vicious Mockery', level:0, castTime:'Acción', range:'18 m', duration:'Inst.', concentration:false, combat:true,  desc:'Save SAB o 1d4 psíquico + desventaja en próximo ataque.' },
      { id:'minor-illusion',  name:'Minor Illusion',  level:0, castTime:'Acción', range:'9 m',  duration:'1 min', concentration:false, combat:false, desc:'Sonido o imagen inanimada de cubo 5ft.' },
      { id:'prestidigitation-b', name:'Prestidigitation', level:0, castTime:'Acción', range:'3 m', duration:'Hasta 1h', concentration:false, combat:false, desc:'Truco menor: limpiar, encender, sabor, etc.' },
      { id:'healing-word-b',  name:'Healing Word',    level:1, castTime:'Acción bonus', range:'18 m', duration:'Inst.', concentration:false, combat:false, desc:'1d4+CAR HP · como bonus action.' },
      { id:'thunderwave-b',   name:'Thunderwave',     level:1, castTime:'Acción', range:'Uno mismo (15ft)', duration:'Inst.', concentration:false, combat:true, desc:'Cubo 15ft · save CON · 2d8 trueno y empuja 10ft.' },
      { id:'dissonant-whispers', name:'Dissonant Whispers', level:1, castTime:'Acción', range:'18 m', duration:'Inst.', concentration:false, combat:true, desc:'Save SAB o 3d6 psíquico y huye. Escala +1d6 por nivel.' },
      { id:'hold-person-b',   name:'Hold Person',     level:2, castTime:'Acción', range:'18 m', duration:'1 min', concentration:true,  combat:true,  desc:'Save SAB o paralizado. Repite save c/turno.' },
      { id:'suggestion',      name:'Suggestion',      level:2, castTime:'Acción', range:'9 m',  duration:'8 h',   concentration:true,  combat:false, desc:'Save SAB o sigue sugerencia razonable.' },
      { id:'shatter',         name:'Shatter',         level:2, castTime:'Acción', range:'18 m', duration:'Inst.', concentration:false, combat:true,  desc:'Esfera 10ft · save CON · 3d8 trueno. +1d8 por nivel.' },
    ],

    'Hechicero': [
      { id:'fire-bolt-s',   name:'Fire Bolt',      level:0, castTime:'Acción', range:'36 m', duration:'Inst.', concentration:false, combat:true,  desc:'Ataque a distancia · 1d10 fuego. (2d10 nv5, 3d10 nv11).' },
      { id:'ray-of-frost',  name:'Ray of Frost',   level:0, castTime:'Acción', range:'18 m', duration:'Inst.', concentration:false, combat:true,  desc:'Ataque a distancia · 1d8 frío · vel -10ft hasta tu turno.' },
      { id:'mage-hand-s',   name:'Mage Hand',      level:0, castTime:'Acción', range:'9 m',  duration:'1 min', concentration:false, combat:false, desc:'Mano espectral puede manipular objetos hasta 5 kg.' },
      { id:'burning-hands', name:'Burning Hands',  level:1, castTime:'Acción', range:'Cono 15ft', duration:'Inst.', concentration:false, combat:true, desc:'Save DES · 3d6 fuego. +1d6 por nivel superior.' },
      { id:'chromatic-orb', name:'Chromatic Orb',  level:1, castTime:'Acción', range:'27 m', duration:'Inst.', concentration:false, combat:true,  desc:'Ataque a distancia · 3d8 de tipo elegido. +1d8 por nivel.' },
      { id:'magic-missile-s', name:'Magic Missile', level:1, castTime:'Acción', range:'36 m', duration:'Inst.', concentration:false, combat:true, desc:'3 dardos infalibles · 1d4+1 fuerza c/u. +1 dardo por nivel.' },
      { id:'scorching-ray', name:'Scorching Ray',  level:2, castTime:'Acción', range:'36 m', duration:'Inst.', concentration:false, combat:true,  desc:'3 ataques a distancia · 2d6 fuego c/u. +1 rayo por nivel.' },
      { id:'mirror-image',  name:'Mirror Image',   level:2, castTime:'Acción', range:'Uno mismo', duration:'1 min', concentration:false, combat:true, desc:'3 duplicados ilusorios. Ataques pueden golpear duplicado.' },
      { id:'misty-step-s',  name:'Misty Step',     level:2, castTime:'Acción bonus', range:'Uno mismo', duration:'Inst.', concentration:false, combat:true, desc:'Teleportación 9 m a lugar visible.' },
    ],

    'Mago': [
      { id:'fire-bolt',     name:'Fire Bolt',      level:0, castTime:'Acción', range:'36 m', duration:'Inst.', concentration:false, combat:true,  desc:'Ataque a distancia · 1d10 fuego. Escala con nivel.' },
      { id:'mage-hand',     name:'Mage Hand',      level:0, castTime:'Acción', range:'9 m',  duration:'1 min', concentration:false, combat:false, desc:'Mano espectral manipula objetos hasta 5 kg.' },
      { id:'prestidigitation', name:'Prestidigitation', level:0, castTime:'Acción', range:'3 m', duration:'Hasta 1h', concentration:false, combat:false, desc:'Trucos menores: limpiar, encender, sabor...' },
      { id:'minor-illusion-m', name:'Minor Illusion', level:0, castTime:'Acción', range:'9 m', duration:'1 min', concentration:false, combat:false, desc:'Imagen o sonido pequeño.' },
      { id:'magic-missile', name:'Magic Missile',  level:1, castTime:'Acción', range:'36 m', duration:'Inst.', concentration:false, combat:true,  desc:'3 dardos infalibles · 1d4+1 fuerza c/u. +1 dardo por nivel.' },
      { id:'shield',        name:'Shield',          level:1, castTime:'Reacción', range:'Uno mismo', duration:'1 ronda', concentration:false, combat:true, desc:'Reacción · +5 CA hasta inicio de tu próximo turno.' },
      { id:'thunderwave-m', name:'Thunderwave',    level:1, castTime:'Acción', range:'Uno mismo (15ft)', duration:'Inst.', concentration:false, combat:true, desc:'Cubo 15ft · save CON · 2d8 trueno y empuja 10ft.' },
      { id:'detect-magic',  name:'Detect Magic',   level:1, castTime:'Acción', range:'Uno mismo', duration:'10 min', concentration:true, combat:false, ritual:true, desc:'Detecta magia en 9 m · ritual.' },
      { id:'misty-step',    name:'Misty Step',     level:2, castTime:'Acción bonus', range:'Uno mismo', duration:'Inst.', concentration:false, combat:true, desc:'Teleportación 9 m a lugar visible.' },
      { id:'mirror-image-m', name:'Mirror Image',  level:2, castTime:'Acción', range:'Uno mismo', duration:'1 min', concentration:false, combat:true, desc:'3 duplicados ilusorios desvían ataques.' },
      { id:'web',           name:'Web',             level:2, castTime:'Acción', range:'18 m', duration:'1 h',   concentration:true,  combat:true,  desc:'Tela 4.5m cubo · restringido · save DES o atrapado.' },
      { id:'fireball',      name:'Fireball',        level:3, castTime:'Acción', range:'45 m', duration:'Inst.', concentration:false, combat:true,  desc:'Esfera 20ft · save DES · 8d6 fuego. +1d6 por nivel.' },
      { id:'counterspell',  name:'Counterspell',   level:3, castTime:'Reacción', range:'18 m', duration:'Inst.', concentration:false, combat:true, desc:'Cancela un hechizo de nv3 o menos. Superior: check INT.' },
      { id:'fly',           name:'Fly',             level:3, castTime:'Acción', range:'Toque', duration:'10 min', concentration:true, combat:false, desc:'Velocidad vuelo 18 m a criatura voluntaria.' },
    ],

    'Brujo': [
      { id:'eldritch-blast', name:'Eldritch Blast', level:0, castTime:'Acción', range:'36 m', duration:'Inst.', concentration:false, combat:true,  desc:'Rayo de fuerza · 1d10 · +1 rayo a nv5/11/17.' },
      { id:'toll-dead-w',    name:'Toll the Dead',  level:0, castTime:'Acción', range:'18 m', duration:'Inst.', concentration:false, combat:true,  desc:'Save SAB · 1d8 necrótico (1d12 si ya herido).' },
      { id:'minor-illusion-w', name:'Minor Illusion', level:0, castTime:'Acción', range:'9 m', duration:'1 min', concentration:false, combat:false, desc:'Sonido o imagen estática cubo 5ft.' },
      { id:'hex',            name:'Hex',             level:1, castTime:'Acción bonus', range:'27 m', duration:'1 h', concentration:true, combat:true, desc:'Maldición: +1d6 necrótico en ataques · desventaja en check elegido.' },
      { id:'arms-of-hadar',  name:'Arms of Hadar',   level:1, castTime:'Acción', range:'Uno mismo (10ft)', duration:'Inst.', concentration:false, combat:true, desc:'Save FUE · 2d6 necrótico · no puede tomar reacciones hasta su turno.' },
      { id:'hellish-rebuke', name:'Hellish Rebuke',  level:1, castTime:'Reacción', range:'18 m', duration:'Inst.', concentration:false, combat:true, desc:'Reacción al ser golpeado · save DES · 2d10 fuego. +1d10 por nivel.' },
      { id:'misty-step-w',   name:'Misty Step',      level:2, castTime:'Acción bonus', range:'Uno mismo', duration:'Inst.', concentration:false, combat:true, desc:'Teleportación 9 m.' },
      { id:'hold-person-w',  name:'Hold Person',     level:2, castTime:'Acción', range:'18 m', duration:'1 min', concentration:true, combat:true, desc:'Save SAB o paralizado (humanoides). Repite save c/turno.' },
    ],

    'Paladín': [
      { id:'bless',          name:'Bless',           level:1, castTime:'Acción', range:'9 m', duration:'1 min', concentration:true, combat:true, desc:'Hasta 3 criaturas: +1d4 en ataques y saves.' },
      { id:'cure-wounds-p',  name:'Cure Wounds',     level:1, castTime:'Acción', range:'Toque', duration:'Inst.', concentration:false, combat:false, desc:'1d8+CAR HP. +1d8 por nivel superior.' },
      { id:'divine-favor',   name:'Divine Favor',    level:1, castTime:'Acción bonus', range:'Uno mismo', duration:'1 min', concentration:true, combat:true, desc:'Ataques de arma: +1d4 radiante hasta fin.' },
      { id:'shield-of-faith', name:'Shield of Faith', level:1, castTime:'Acción bonus', range:'18 m', duration:'10 min', concentration:true, combat:true, desc:'+2 CA a criatura elegida.' },
      { id:'thunderous-smite', name:'Thunderous Smite', level:1, castTime:'Acción bonus', range:'Uno mismo', duration:'1 min', concentration:true, combat:true, desc:'Primer golpe: +2d6 trueno · save FUE o empujado 10ft.' },
      { id:'aid',            name:'Aid',              level:2, castTime:'Acción', range:'9 m', duration:'8 h', concentration:false, combat:false, desc:'3 aliados: HP max y actual +5. +5 por nivel superior.' },
      { id:'branding-smite', name:'Branding Smite',  level:2, castTime:'Acción bonus', range:'Uno mismo', duration:'1 min', concentration:true, combat:true, desc:'Golpe: +2d6 radiante · objetivo brillante · no puede ser invisible.' },
      { id:'misty-step-p',   name:'Misty Step',      level:2, castTime:'Acción bonus', range:'Uno mismo', duration:'Inst.', concentration:false, combat:true, desc:'Teleportación 9 m.' },
      { id:'daylight',       name:'Daylight',         level:3, castTime:'Acción', range:'18 m', duration:'1 h', concentration:false, combat:false, desc:'Esfera de luz brillante 18 m de radio.' },
      { id:'revivify-p',     name:'Revivify',         level:3, castTime:'Acción', range:'Toque', duration:'Inst.', concentration:false, combat:false, desc:'Revive criatura muerta hace <1 min con 1 HP.' },
    ],

    'Explorador': [
      { id:'hunters-mark',   name:'Hunter\'s Mark',  level:1, castTime:'Acción bonus', range:'27 m', duration:'1 h', concentration:true, combat:true, desc:'Presa: +1d6 daño en ataques · ventaja en percepción/sigilo vs ella.' },
      { id:'ensnaring-strike', name:'Ensnaring Strike', level:1, castTime:'Acción bonus', range:'Uno mismo', duration:'1 min', concentration:true, combat:true, desc:'Golpe: save FUE o atrapado. 1d6 perforante por turno atrapado.' },
      { id:'hail-of-thorns', name:'Hail of Thorns',  level:1, castTime:'Acción bonus', range:'Uno mismo', duration:'Inst.', concentration:true, combat:true, desc:'Golpe a distancia: +1d10 perforante al objetivo y adyacentes (save DES mitad).' },
      { id:'pass-without-trace', name:'Pass Without Trace', level:2, castTime:'Acción', range:'Uno mismo', duration:'1 h', concentration:true, combat:false, desc:'+10 sigilo a tus compañeros en 9 m · no dejan rastro.' },
      { id:'spike-growth-r', name:'Spike Growth',    level:2, castTime:'Acción', range:'45 m', duration:'10 min', concentration:true, combat:true, desc:'Área difícil 20ft · 2d4 perforante por cada 5ft.' },
    ],
  };

  // Nivel de slot de Pact Magic según nivel de Brujo (PHB)
  const WARLOCK_SLOT_LEVEL = {
    1:1, 2:1, 3:2, 4:2, 5:3, 6:3, 7:4, 8:4, 9:5,
    10:5, 11:5, 12:5, 13:5, 14:5, 15:5, 16:5, 17:5, 18:5, 19:5, 20:5
  };

  // ── calcMulticlassSlots: tabla oficial PHB de multiclase ──────────────────
  function calcMulticlassSlots(classes) {
    let casterLevels = 0;
    let warlockLevel = 0;

    for (const c of classes) {
      const cfg = CLASES_CONFIG[c.name];
      if (!cfg) continue;
      if (cfg.slotTable === 'full')    casterLevels += c.level;
      if (cfg.slotTable === 'half')    casterLevels += Math.floor(c.level / 2);
      if (cfg.slotTable === 'warlock') warlockLevel = Math.max(warlockLevel, c.level);
    }

    const baseRow = FULL_CASTER_SLOTS[casterLevels] || Array(9).fill(0);
    const result = {};
    for (let i = 1; i <= 9; i++) {
      result[i] = { current: baseRow[i-1] || 0, max: baseRow[i-1] || 0 };
    }

    // Pact Magic del Brujo: slots separados que se añaden a su nivel de slot correspondiente
    // PHB: Warlock pact slots no se mezclan con los slots de multiclase para recuperación,
    // pero sí comparten el pool de slots disponibles del mismo nivel
    if (warlockLevel > 0) {
      const pactCount = (WARLOCK_SLOTS[warlockLevel] || [1])[0] || 0;
      const pactLevel = WARLOCK_SLOT_LEVEL[warlockLevel] || 1;
      // Sumar los Pact Slots al nivel correspondiente
      result[pactLevel] = {
        current: (result[pactLevel]?.current || 0) + pactCount,
        max:     (result[pactLevel]?.max     || 0) + pactCount,
      };
    }
    return result;
  }

  // ── applyRaza: aplica rasgos de raza al objeto personaje ─────────────────
  // razaNombre: string, statBonus2/statBonus1: claves de stat (ej: 'con', 'des')
  function applyRaza(char, razaNombre, statBonus2, statBonus1) {
    const cfg = RAZAS_CONFIG[razaNombre];
    if (!cfg) return char;

    char.raza    = razaNombre;
    char.subraza = char.subraza || '';

    // Aplicar bonus +2 / +1 a los stats elegidos
    if (statBonus2 && char.stats[statBonus2] !== undefined) {
      char.stats[statBonus2] += 2;
    }
    if (statBonus1 && char.stats[statBonus1] !== undefined && statBonus1 !== statBonus2) {
      char.stats[statBonus1] += 1;
    }

    // Velocidad
    char.velocidad = cfg.speed || 30;

    // Resistencias
    if (cfg.resistances && cfg.resistances.length) {
      char.resistances = [...new Set([...(char.resistances || []), ...cfg.resistances])];
    }

    // Proficiencias de habilidad
    if (cfg.skillProfs && cfg.skillProfs.length) {
      char.skillProfs = [...new Set([...(char.skillProfs || []), ...cfg.skillProfs])];
    }

    // Darkvision + rasgos base
    const traits = [];
    if (cfg.darkvision > 0) traits.push(`Visión en penumbra ${cfg.darkvision} m`);
    if (cfg.traits) traits.push(...cfg.traits);
    char.speciesTraits = traits.join('\n');

    // Idiomas
    char.languages = cfg.languages || ['Común'];

    return char;
  }

  // ── applySubraza: aplica rasgos de subraza encima de la raza base ──────────
  function applySubraza(char, subrazaNombre) {
    if (!subrazaNombre || !char.raza) return char;
    const razaCfg = RAZAS_CONFIG[char.raza];
    if (!razaCfg || !razaCfg.subraces) return char;

    const sub = razaCfg.subraces.find(s => s.name === subrazaNombre);
    if (!sub) return char;

    char.subraza = subrazaNombre;

    // Sobreescribir velocidad si la subraza la cambia
    if (sub.speed) char.velocidad = sub.speed;

    // Sobreescribir darkvision si la subraza la mejora
    if (sub.darkvision) {
      const existing = char.speciesTraits || '';
      char.speciesTraits = existing.replace(/Visión en penumbra \d+ m/, `Visión en penumbra ${sub.darkvision} m`);
      if (!char.speciesTraits.includes('Visión en penumbra')) {
        char.speciesTraits = `Visión en penumbra ${sub.darkvision} m\n` + char.speciesTraits;
      }
    }

    // Agregar resistencias de subraza
    if (sub.resistances && sub.resistances.length) {
      char.resistances = [...new Set([...(char.resistances || []), ...sub.resistances])];
    }

    // Agregar proficiencias de habilidad de subraza
    if (sub.skillProfs && sub.skillProfs.length) {
      char.skillProfs = [...new Set([...(char.skillProfs || []), ...sub.skillProfs])];
    }

    // Agregar proficiencias de armas de subraza
    if (sub.weaponProfs && sub.weaponProfs.length) {
      char.weaponProfs = [...new Set([...(char.weaponProfs || []), ...sub.weaponProfs])];
    }

    // Agregar rasgos de subraza a speciesTraits
    if (sub.traits && sub.traits.length) {
      const existing = char.speciesTraits || '';
      char.speciesTraits = existing + (existing ? '\n' : '') + sub.traits.join('\n');
    }

    return char;
  }

  // ── applySubclase: aplica recursos y features de subclase al personaje ─────
  function applySubclase(char, subclaseName) {
    if (!subclaseName) return char;
    const sub = SUBCLASES_CONFIG[subclaseName];
    if (!sub) return char;

    char.subclase = subclaseName;

    // Actualizar classes[0].subclass también
    if (char.classes && char.classes.length > 0) {
      char.classes[0].subclass = subclaseName;
    }

    // Aplicar recursos de subclase (merge: actualizar existentes, agregar nuevos)
    const nivel = char.nivel || 1;
    const newResrcs = sub.resources(nivel);
    newResrcs.forEach(r => {
      const existing = (char.resources || []).find(e => e.id === r.id);
      if (existing) {
        // Actualizar max si cambió
        const gained = r.max - existing.max;
        existing.max = r.max;
        if (gained > 0) existing.current = Math.min(existing.current + gained, r.max);
        if (r.note) existing.note = r.note;
      } else {
        if (!char.resources) char.resources = [];
        char.resources.push({ ...r });
      }
    });

    // Aplicar features de subclase (solo agregar las que no existen por id)
    const newFeats = typeof sub.features === 'function' ? sub.features(nivel) : (sub.features || []);
    newFeats.forEach(f => {
      if (!char.features) char.features = [];
      if (!char.features.find(e => e.id === f.id)) {
        char.features.push({ ...f });
      }
    });

    // Para Battle Master: inicializar maneuvers elegidas (vacías) si no existen
    if (sub.maneuvers && !char.maneuvers) {
      char.maneuvers = [];
    }

    return char;
  }

  // ── buildDefaultChar: crea personaje con features y hechizos por clase ────
  // razaOpts: { name, statBonus2, statBonus1 } — opcional
  function buildDefaultChar(name, claseNombre, nivel, razaOpts) {
    nivel = nivel || 1;
    const cfg    = CLASES_CONFIG[claseNombre] || CLASES_CONFIG['Guerrero'];
    const slots  = calcMulticlassSlots([{ name: claseNombre, level: nivel }]);
    const feats  = CLASE_FEATURES[claseNombre];
    const resrcs = feats ? feats.resources(nivel) : [];
    // features puede ser array de strings o función que devuelve strings/objects
    const rawFeats = feats ? (typeof feats.features === 'function' ? feats.features(nivel) : (feats.features || [])) : [];
    // Normalizar: convertir strings a objetos de feature compatibles con el renderer
    const featList = rawFeats.map(f => {
      if (typeof f === 'object' && f !== null) return f; // ya es objeto completo
      // string → objeto mínimo
      const name = String(f);
      return {
        id:     name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-'),
        name,
        source: claseNombre,
        type:   'passive',
        action: null,
        range:  null,
        recharge: null,
        desc:   '',
        fullDesc: '',
      };
    });
    const spells = (CLASE_SPELLS[claseNombre] || []).map(s => ({ ...s }));

    // HP correcto según nivel: dado1 + promedio*(nivel-1) + CON mod * nivel
    // Con CON 10 (mod 0) es simplemente dado1 + (floor(die/2)+1)*(nivel-1)
    const hpMax = cfg.hitDie + (nivel - 1) * (Math.floor(cfg.hitDie / 2) + 1);

    const char = {
      id: 'char-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7),
      name,
      clase:            claseNombre,
      classes:          [{ name: claseNombre, level: nivel, subclass: '' }],
      subclase:         '',
      raza:             '',
      subraza:          '',
      trasfondo:        '',
      deity:            '',
      alignment:        '',
      nivel,
      xp:               0,

      stats: { for:10, des:10, con:10, int:10, sab:10, car:10 },

      hp:    { current: hpMax, max: hpMax, temp: 0 },
      velocidad: 30,

      savingThrows:    cfg.savingThrows || [],
      skillProfs:      [],
      skillExpertise:  [],

      spellcastingStat: cfg.spellcastingStat,
      hitDie:           cfg.hitDie,
      spellSlots:       slots,
      hitDice:          { current: nivel, max: nivel },

      features:         featList,
      resources:        resrcs,
      turn:             { action: false, bonus: false, reaction: false, movement: false },
      concentration:    null,
      conditions:       [],
      exhaustion:       0,
      inspiration:      false,

      spells,
      preparedToday:    [],

      weapons:          [],
      armor:            { name: '', base_ca: 10, add_dex: true, shield: false, shield_bonus: 2 },
      attunement:       ['', '', ''],
      magicItems:       [],
      consumables:      [],
      currency:         { pp: 0, gp: 0, sp: 0, cp: 0 },
      notes:            '',

      bonuses: { ca: 0, savesAll: 0, saves: {}, skills: {}, init: 0, hpMax: 0, ataque: 0, cd: 0 },

      diary:            [],
      ifttt:            [],

      _dataVersion: 8,
      createdAt:    new Date().toISOString(),
      updatedAt:    new Date().toISOString(),
    };

    // Aplicar raza si se proveyó
    if (razaOpts && razaOpts.name) {
      applyRaza(char, razaOpts.name, razaOpts.statBonus2 || null, razaOpts.statBonus1 || null);
    }

    return char;
  }

  /* ── LEVEL UP ── */

  function applyLevelUp(char, newLevel, hpGained) {
    char.nivel = newLevel;
    char.hp.max += hpGained;
    char.hp.current = Math.min(char.hp.current + hpGained, char.hp.max);
    char.hitDice.max = newLevel;
    char.hitDice.current = Math.min(char.hitDice.current + 1, newLevel);

    // Sincronizar classes[0].level con el nivel principal
    if (!char.classes || !char.classes.length) {
      char.classes = [{ name: char.clase, level: newLevel, subclass: char.subclase || '' }];
    } else {
      char.classes[0].level = newLevel;
    }

    // Actualizar spell slots (usa multiclase si hay varias clases)
    const newSlots = calcMulticlassSlots(char.classes);
    for (let i = 1; i <= 9; i++) {
      const newMax = newSlots[i]?.max || 0;
      const old    = char.spellSlots[i] || { current: 0, max: 0 };
      if (newMax > old.max) {
        char.spellSlots[i] = { current: old.current + (newMax - old.max), max: newMax };
      } else {
        char.spellSlots[i] = { current: Math.min(old.current, newMax), max: newMax };
      }
    }

    // Actualizar recursos de clase que escalan por nivel (Rage, Ki, Channel Divinity, etc.)
    const feats = CLASE_FEATURES[char.clase];
    if (feats) {
      const newResrcs = feats.resources(newLevel, char.subclase || '');
      // Merge: actualizar max de recursos existentes y agregar recursos nuevos
      newResrcs.forEach(newR => {
        const existing = (char.resources || []).find(r => r.id === newR.id);
        if (existing) {
          const gained = newR.max - existing.max;
          existing.max = newR.max;
          if (gained > 0) existing.current = Math.min(existing.current + gained, newR.max);
          // Actualizar nota (puede cambiar con nivel/subclase)
          if (newR.note) existing.note = newR.note;
        } else {
          // Recurso nuevo desbloqueado con este nivel
          if (!char.resources) char.resources = [];
          char.resources.push({ ...newR });
        }
      });

      // Actualizar features (lista puede crecer con el nivel)
      const rawNewFeats = typeof feats.features === 'function'
        ? feats.features(newLevel)
        : (feats.features || []);
      // Normalizar strings → objetos
      const newFeatList = rawNewFeats.map(f => {
        if (typeof f === 'object' && f !== null) return f;
        const name = String(f);
        return {
          id:     name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-'),
          name, source: char.clase, type:'passive',
          action:null, range:null, recharge:null, desc:'', fullDesc:'',
        };
      });
      // Agregar features nuevas que no existan aún (por id)
      newFeatList.forEach(f => {
        if (!char.features) char.features = [];
        if (!char.features.find(e => e.id === f.id)) {
          char.features.push({ ...f });
        }
      });
    }

    return char;
  }

  /* ── EXPORTS PÚBLICOS ── */

  return {
    PROF_BONUS,
    XP_THRESHOLDS,
    CLASES_CONFIG,
    CLASE_FEATURES,
    CLASE_SPELLS,
    SUBCLASES_CONFIG,
    RAZAS_CONFIG,
    SKILLS_DEF,
    STAT_NAMES,
    LURSEY_IFTTT,
    WARLOCK_SLOTS,
    WARLOCK_SLOT_LEVEL,
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
    calcMulticlassSlots,
    getPreparedMax,
    getXPForLevel,
    getNextLevelXP,
    getLevelFromXP,
    createNew,
    buildDefaultChar,
    applyRaza,
    applySubraza,
    applySubclase,
    buildLursey,
    applyLevelUp,
  };
})();
