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

  // knownCaster: true → conjuros conocidos (tabla fija), siempre disponibles, no se "preparan"
  // preparesCaster: true → preparan de una lista (mod+nivel), como Clérigo/Druida/Mago/Paladín
  const CLASES_CONFIG = {
    'Clérigo':      { hitDie: 8,  spellcastingStat: 'sab', savingThrows: ['sab', 'car'], slotTable: 'full',    preparesCaster: true },
    'Druida':       { hitDie: 8,  spellcastingStat: 'sab', savingThrows: ['int', 'sab'], slotTable: 'full',    preparesCaster: true },
    'Bardo':        { hitDie: 8,  spellcastingStat: 'car', savingThrows: ['des', 'car'], slotTable: 'full',    knownCaster: true,
      // cantrips conocidos por nivel: [nv1..20]
      cantripsKnown: [2,2,2,3,3,3,3,3,3,4,4,4,4,4,4,4,4,4,4,4],
      spellsKnown:   [4,5,6,7,8,9,10,11,12,14,15,15,16,18,19,19,20,22,22,22] },
    'Hechicero':    { hitDie: 6,  spellcastingStat: 'car', savingThrows: ['con', 'car'], slotTable: 'full',    knownCaster: true,
      cantripsKnown: [4,4,4,5,5,5,6,6,6,6,6,6,6,6,6,6,6,6,6,6],
      spellsKnown:   [2,3,4,5,6,7,8,9,10,11,12,12,13,13,14,14,15,15,15,15] },
    'Brujo':        { hitDie: 8,  spellcastingStat: 'car', savingThrows: ['sab', 'car'], slotTable: 'warlock', knownCaster: true,
      cantripsKnown: [2,2,2,3,3,3,3,3,3,4,4,4,4,4,4,4,4,4,4,4],
      spellsKnown:   [2,3,4,5,6,7,8,9,10,10,11,11,12,12,13,13,14,14,14,15] },
    'Mago':         { hitDie: 6,  spellcastingStat: 'int', savingThrows: ['int', 'sab'], slotTable: 'full',    preparesCaster: true },
    'Paladín':      { hitDie: 10, spellcastingStat: 'car', savingThrows: ['sab', 'car'], slotTable: 'half',    preparesCaster: true },
    'Explorador':   { hitDie: 10, spellcastingStat: 'sab', savingThrows: ['fue', 'des'], slotTable: 'half',    preparesCaster: true },
    'Guerrero':     { hitDie: 10, spellcastingStat: null,  savingThrows: ['fue', 'con'], slotTable: null },
    'Bárbaro':      { hitDie: 12, spellcastingStat: null,  savingThrows: ['fue', 'con'], slotTable: null },
    'Monje':        { hitDie: 8,  spellcastingStat: 'sab', savingThrows: ['fue', 'des'], slotTable: null },
    'Pícaro':       { hitDie: 8,  spellcastingStat: 'int', savingThrows: ['des', 'int'], slotTable: null },
  };

  const STAT_NAMES = {
    for: 'FUE', des: 'DES', con: 'CON', int: 'INT', sab: 'SAB', car: 'CAR'
  };

  // ── TRASFONDOS_CONFIG (D&D 2024 PHB) ─────────────────────────────────────
  // skillProfs: skills que otorga el trasfondo
  // toolProfs: herramientas / vehículos / kits
  // feat: feat de origen que otorga
  // feature: nombre del rasgo narrativo del trasfondo
  // featureDesc: descripción breve del rasgo
  const TRASFONDOS_CONFIG = {
    'Acólito': {
      emoji: '⛪', skillProfs: ['perspicacia', 'religion'],
      toolProfs: [],
      feat: 'Magic Initiate (Clérigo)',
      feature: 'Shelter of the Faithful',
      featureDesc: 'Podés recibir curación y cuidado en templos de tu fe. Vos y tus compañeros pueden descansar allí gratuitamente.',
    },
    'Artesano': {
      emoji: '🔨', skillProfs: ['perspicacia', 'persuasion'],
      toolProfs: ['Herramientas de artesano (a elección)'],
      feat: 'Crafter',
      feature: 'Maker\'s Eye',
      featureDesc: 'Podés identificar el valor, calidad y procedencia de objetos manufacturados con solo examinarlos.',
    },
    'Charlatán': {
      emoji: '🃏', skillProfs: ['engano', 'juegomanos'],
      toolProfs: ['Kit de disfraz', 'Kit de falsificación'],
      feat: 'Skilled',
      feature: 'False Identity',
      featureDesc: 'Tenés una identidad falsa documentada. También podés falsificar documentos con el kit correspondiente.',
    },
    'Criminal': {
      emoji: '🗡️', skillProfs: ['engano', 'sigilo'],
      toolProfs: ['Herramientas de ladrón', 'Un juego de azar'],
      feat: 'Alert',
      feature: 'Criminal Contact',
      featureDesc: 'Tenés un contacto en el mundo criminal que actúa como enlace con la red de ladrones locales.',
    },
    'Erudito': {
      emoji: '📚', skillProfs: ['arcanos', 'historia'],
      toolProfs: [],
      feat: 'Magic Initiate (Mago)',
      feature: 'Researcher',
      featureDesc: 'Cuando no sabés algo, sabés dónde ir a buscarlo: bibliotecas, guildas académicas, otros eruditos.',
    },
    'Héroe del Pueblo': {
      emoji: '🌾', skillProfs: ['manejoanim', 'supervivencia'],
      toolProfs: ['Herramientas de artesano (a elección)', 'Vehículos terrestres'],
      feat: 'Tough',
      feature: 'Rustic Hospitality',
      featureDesc: 'Las personas comunes te dan refugio y comida. Pueden ocultarte de quienes te busquen.',
    },
    'Noble': {
      emoji: '👑', skillProfs: ['historia', 'persuasion'],
      toolProfs: ['Un juego de azar'],
      feat: 'Skilled',
      feature: 'Position of Privilege',
      featureDesc: 'La gente de alta alcurnia te respeta. Tenés acceso a la alta sociedad y la nobleza.',
    },
    'Forajido': {
      emoji: '🏕️', skillProfs: ['atletismo', 'supervivencia'],
      toolProfs: ['Instrumento musical (a elección)', 'Herramientas de cartógrafo'],
      feat: 'Lucky',
      feature: 'Wanderer',
      featureDesc: 'Tenés una memoria excelente para mapas y geografía. Siempre podés recordar el camino de vuelta.',
    },
    'Soldado': {
      emoji: '⚔️', skillProfs: ['atletismo', 'intimidacion'],
      toolProfs: ['Vehículos terrestres', 'Un juego de azar'],
      feat: 'Savage Attacker',
      feature: 'Military Rank',
      featureDesc: 'Tenés rango militar reconocido. Soldados inferiores obedecen tus órdenes; accedés a equipamiento y campamentos.',
    },
    'Entretenido': {
      emoji: '🎭', skillProfs: ['acrobacias', 'interpretacion'],
      toolProfs: ['Kit de disfraz', 'Instrumento musical (a elección)'],
      feat: 'Musician',
      feature: 'By Popular Demand',
      featureDesc: 'Siempre podés encontrar alojamiento y comida en tabernas o teatros a cambio de actuar.',
    },
    'Marinero': {
      emoji: '⚓', skillProfs: ['atletismo', 'percepcion'],
      toolProfs: ['Herramientas de navegante', 'Vehículos acuáticos'],
      feat: 'Tavern Brawler',
      feature: 'Ship\'s Passage',
      featureDesc: 'Podés asegurar pasaje gratuito en barco para vos y compañeros a cambio de trabajo durante el viaje.',
    },
    'Sabio Callejero': {
      emoji: '🏚️', skillProfs: ['engano', 'perspicacia'],
      toolProfs: ['Herramientas de ladrón', 'Un juego de azar'],
      feat: 'Lucky',
      feature: 'City Secrets',
      featureDesc: 'Conocés los pasajes secretos y callejones de la ciudad. Podés moverte entre dos puntos el doble de rápido.',
    },
    'Ermitaño': {
      emoji: '🌿', skillProfs: ['medicina', 'religion'],
      toolProfs: ['Kit de herbolario'],
      feat: 'Healer',
      feature: 'Discovery',
      featureDesc: 'Tu soledad te reveló un secreto único sobre el cosmos, los dioses o las fuerzas del mundo.',
    },
    'Guía': {
      emoji: '🧭', skillProfs: ['atletismo', 'supervivencia'],
      toolProfs: ['Herramientas de cartógrafo', 'Instrumento musical (a elección)'],
      feat: 'Magic Initiate (Druida)',
      feature: 'Wanderer',
      featureDesc: 'Tenés una memoria excelente para mapas y geografía. Siempre podés recordar el camino de vuelta y encontrás doble comida al buscar en tu terreno natural.',
    },
    'Mercader': {
      emoji: '⚖️', skillProfs: ['perspicacia', 'persuasion'],
      toolProfs: ['Herramientas de navegante', 'Un idioma adicional'],
      feat: 'Lucky',
      feature: 'Merchant\'s Eye',
      featureDesc: 'Conocés los precios y mercados. Podés fijar el valor de objetos y encontrás vendedores en cualquier ciudad.',
    },
    'Granjero': {
      emoji: '🌾', skillProfs: ['manejoanim', 'naturaleza'],
      toolProfs: ['Herramientas de artesano (a elección)', 'Vehículos terrestres'],
      feat: 'Tough',
      feature: 'Homesteader',
      featureDesc: 'Gente rural te da techo y comida de buena voluntad. Conocés las rutas y costumbres del campo.',
    },
    'Custom': {
      emoji: '✏️', skillProfs: [],
      toolProfs: [],
      feat: '',
      feature: '',
      featureDesc: '',
    },
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
    const bonus = (char.bonuses && char.bonuses.cd) || 0;
    if (!char.spellcastingStat) return bonus ? 8 + bonus : null;
    const prof  = calcProfBonus(char.nivel);
    const mod   = calcMod(char.stats[char.spellcastingStat]);
    return 8 + prof + mod + bonus;
  }

  function calcAtaqueBonus(char) {
    const bonus = (char.bonuses && char.bonuses.ataque) || 0;
    if (!char.spellcastingStat) return bonus ? bonus : null;
    const prof = calcProfBonus(char.nivel);
    const mod  = calcMod(char.stats[char.spellcastingStat]);
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
    const cfg = CLASES_CONFIG[char.clase];
    const nivel = char.nivel || 1;

    // Known casters (Hechicero, Bardo, Brujo): usan tabla fija de conjuros conocidos
    if (cfg && cfg.knownCaster && cfg.spellsKnown) {
      return cfg.spellsKnown[Math.min(nivel - 1, 19)];
    }

    // Prepare casters (Clérigo, Druida, Mago, Paladín, Explorador): mod + nivel
    const mod = calcMod(char.stats[char.spellcastingStat]);
    return Math.max(1, mod + nivel);
  }

  // Retorna cantidad de cantrips que puede conocer según clase y nivel
  function getCantripsKnown(char) {
    const cfg = CLASES_CONFIG[char.clase];
    if (!cfg || !cfg.cantripsKnown) return null; // null = sin límite fijo
    const nivel = char.nivel || 1;
    return cfg.cantripsKnown[Math.min(nivel - 1, 19)];
  }

  // true si la clase conoce conjuros (no los prepara)
  function isKnownCaster(char) {
    const cfg = CLASES_CONFIG[char.clase];
    return !!(cfg && cfg.knownCaster);
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
    const slotsFull6 = FULL_CASTER_SLOTS[6]; // [4,3,3,0,...]
    const spellSlots = {};
    for (let i = 1; i <= 9; i++) {
      const max = slotsFull6[i-1] || 0;
      spellSlots[i] = { current: max, max };
    }

    return {
      id: 'lursey-brumaclara',
      name: 'Lursey Brumaclara',
      clase: 'Clérigo',
      subclase: 'Dominio de la Paz',
      raza: 'Enano',
      subraza: 'Enano de las Montañas',
      trasfondo: 'Acólito',
      deity: 'Clangeddin Barbablanca',
      alignment: 'LB',
      nivel: 6,
      xp: 14000,
      classes: [{ name: 'Clérigo', level: 6, subclass: 'Dominio de la Paz' }],

      stats: { for:10, des:14, con:14, int:9, sab:19, car:14 },

      // nv6 Clérigo: 8 + 5×(4+2) + 6×CON = 8+30+12 = 50 (tomando promedio 5 por nv2-6)
      hp: { current: 50, max: 50, temp: 0 },
      velocidad: 30,

      savingThrows: ['sab', 'car'],
      skillProfs: ['perspicacia', 'historia', 'persuasion', 'religion'],
      skillExpertise: [],

      spellcastingStat: 'sab',
      hitDie: 8,
      spellSlots,

      hitDice: { current: 6, max: 6 },

      // Rasgos raciales PHB 2024 — Enano de las Montañas
      speciesTraits: [
        '⛏️ Dwarven Resilience — ventaja en saves contra veneno, resistencia a daño de veneno',
        '🔭 Darkvision 18 m — ves en penumbra como si fuera luz brillante, en oscuridad como penumbra',
        '🪨 Stonecunning — Tremorsense 18 m en piedra sin pulir (Sabiduría, acción bonus, 10 min)',
        '⚔️ Dwarven Armor Training — proficiencia con armaduras ligeras y medias (Montañas)',
        '💪 Dwarven Strength — proficiencia en Atletismo (Enano de las Montañas)',
        '🔨 Weapon Proficiency — Hacha de batalla, Hacha de mano, Martillo ligero, Martillo de guerra',
      ].join('\n'),

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
          note: '1d4 en ataque/save/check · 9 m · 10 min · hasta 3 criaturas'
        },
        {
          id: 'guiding-bolt-mi',
          name: 'Guiding Bolt (MI)',
          current: 1, max: 1,
          recharge: 'long',
          note: '4d6 rad + ventaja al siguiente ataque'
        },
        {
          id: 'servirse-poder-divino',
          name: 'Servirse del Poder Divino',
          current: 2, max: 2,
          recharge: 'long',
          note: 'Recupera 1 slot gastado (máx nv2) · acción bonus'
        },
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
        { id:'maza', name:'Maza de Guerra +1', die:'1d8', bonus:'+5', type:'melee', notes:'Arma mágica · +1 ataque y daño' },
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
      currency: { pp: 0, gp: 218, ep: 0, sp: 0, cp: 0 },
      notes: '',

      bonuses: {
        ca: 0,           // ítems mágicos, hechizos (+1 Shield, etc.)
        savesAll: 0,     // bonus global a todos los saves (Aura Paladín, Cloak of Protection)
        saves: {},       // bonus por stat específico { sab: 1, ... }
        skills: {},      // bonus por skill { perspicacia: 1, ... }
        init: 0,         // Alert feat, ítems
        hpMax: 0,        // Tough feat, ítems permanentes (≠ temp HP)
        ataque: 1,       // arma mágica +1 (Maza de Guerra +1)
        cd: 1,           // Arcane Grimoire +1 (ítem mágico)
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

      _dataVersion: 12,
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
      currency: { pp: 0, gp: 0, ep: 0, sp: 0, cp: 0 },
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
  // Cada features: (nivel) => [...] filtra por nivel para solo mostrar
  // las habilidades que el personaje ya desbloqueó.
  const CLASE_FEATURES = {
    'Clérigo': {
      resources: (nivel) => [
        { id:'channel-divinity', name:'Channel Divinity',
          current: nivel >= 6 ? 3 : nivel >= 2 ? 2 : 1,
          max:     nivel >= 6 ? 3 : nivel >= 2 ? 2 : 1,
          recharge:'short', note:'Turn Undead · Divine Spark · Balm of Peace' }
      ],
      features: (nivel) => [
        { id:'cleric-spellcasting', name:'Spellcasting (SAB)', source:'Clérigo · Nivel 1', type:'passive', action:'Varía', range:'Varía', recharge:null,
          desc:'Lanzás conjuros divinos usando Sabiduría como stat de conjuro.', fullDesc:'' },
        { id:'channel-divinity', name:'Channel Divinity', source:`Clérigo · Nivel 1 (${nivel>=6?3:nivel>=2?2:1} usos)`, type:'active', action:'Acción', range:'Varía', recharge:'short',
          desc:`${nivel>=6?3:nivel>=2?2:1} uso${nivel>=6?'s':nivel>=2?'s':''} por Short Rest. Turn Undead · Divine Spark.`, fullDesc:'' },
        ...(nivel >= 2 ? [{ id:'harness-divine-power', name:'Harness Divine Power', source:'Clérigo · Nivel 2', type:'active', action:'Acción bonus', range:'Personal', recharge:'long',
          desc:'Recuperás un slot de conjuro gastado (máx nivel = mitad Prof Bonus). 1 uso/Long Rest.', fullDesc:'' }] : []),
        ...(nivel >= 3 ? [{ id:'cleric-subclass', name:'Subclase (Divine Order)', source:'Clérigo · Nivel 3', type:'passive', action:'Pasiva', range:'Personal', recharge:null,
          desc:'Elegís tu dominio divino que otorga features adicionales.', fullDesc:'' }] : []),
        ...(nivel >= 4 ? [{ id:'cleric-asi-4', name:'Ability Score Improvement', source:'Clérigo · Nivel 4', type:'passive', action:'Pasiva', range:'Personal', recharge:null,
          desc:'+2 a un stat o +1 a dos stats. Podés tomar un Feat en su lugar.', fullDesc:'' }] : []),
        ...(nivel >= 5 ? [{ id:'destroy-undead', name:'Destroy Undead', source:'Clérigo · Nivel 5', type:'passive', action:'Pasiva', range:'Personal', recharge:null,
          desc:`Turn Undead destruye automáticamente no-muertos con CR ≤ ${nivel>=17?4:nivel>=14?3:nivel>=11?2:nivel>=8?1:0.5}.`, fullDesc:'' }] : []),
        ...(nivel >= 6 ? [{ id:'channel-divinity-2', name:'Channel Divinity (3 usos)', source:'Clérigo · Nivel 6', type:'passive', action:'Pasiva', range:'Personal', recharge:null,
          desc:'Channel Divinity ahora tiene 3 usos por Short Rest.', fullDesc:'' }] : []),
        ...(nivel >= 7 ? [{ id:'blessed-strikes', name:'Blessed Strikes', source:'Clérigo · Nivel 7', type:'passive', action:'Pasiva', range:'Personal', recharge:null,
          desc:'Cuando causás daño con conjuro o ataque de arma: +1d8 daño radiante (1 vez por turno).', fullDesc:'' }] : []),
        ...(nivel >= 8 ? [{ id:'cleric-asi-8', name:'Ability Score Improvement', source:'Clérigo · Nivel 8', type:'passive', action:'Pasiva', range:'Personal', recharge:null,
          desc:'+2 a un stat o +1 a dos stats. Podés tomar un Feat en su lugar.', fullDesc:'' }] : []),
        ...(nivel >= 10 ? [{ id:'divine-intervention', name:'Divine Intervention', source:'Clérigo · Nivel 10', type:'active', action:'Acción', range:'Personal', recharge:'long',
          desc:'Invocás la ayuda directa de tu deidad. Siempre funciona a nivel 20.', fullDesc:'' }] : []),
        ...(nivel >= 12 ? [{ id:'cleric-asi-12', name:'Ability Score Improvement', source:'Clérigo · Nivel 12', type:'passive', action:'Pasiva', range:'Personal', recharge:null,
          desc:'+2 a un stat o +1 a dos stats.', fullDesc:'' }] : []),
        ...(nivel >= 14 ? [{ id:'improved-blessed-strikes', name:'Improved Blessed Strikes', source:'Clérigo · Nivel 14', type:'passive', action:'Pasiva', range:'Personal', recharge:null,
          desc:'Blessed Strikes mejora: +2d8 daño radiante en lugar de +1d8.', fullDesc:'' }] : []),
        ...(nivel >= 16 ? [{ id:'cleric-asi-16', name:'Ability Score Improvement', source:'Clérigo · Nivel 16', type:'passive', action:'Pasiva', range:'Personal', recharge:null,
          desc:'+2 a un stat o +1 a dos stats.', fullDesc:'' }] : []),
        ...(nivel >= 19 ? [{ id:'cleric-asi-19', name:'Epic Boon', source:'Clérigo · Nivel 19', type:'passive', action:'Pasiva', range:'Personal', recharge:null,
          desc:'Ganás un Epic Boon feat.', fullDesc:'' }] : []),
        ...(nivel >= 20 ? [{ id:'greater-divine-intervention', name:'Greater Divine Intervention', source:'Clérigo · Nivel 20', type:'active', action:'Acción', range:'Personal', recharge:'long',
          desc:'Divine Intervention siempre tiene éxito y no requiere Long Rest para volver a usarse.', fullDesc:'' }] : []),
      ],
    },
    'Bárbaro': {
      resources: (nivel) => [
        { id:'rage', name:'Rage',
          current: nivel>=17?6:nivel>=12?5:nivel>=9?4:nivel>=6?3:2,
          max:     nivel>=17?6:nivel>=12?5:nivel>=9?4:nivel>=6?3:2,
          recharge:'long', note:'Ventaja STR · Resistencia físico · +daño' }
      ],
      features: (nivel) => [
        { id:'rage', name:`Rage (${nivel>=17?6:nivel>=12?5:nivel>=9?4:nivel>=6?3:2} usos)`, source:'Bárbaro · Nivel 1', type:'active', action:'Acción bonus', range:'Personal', recharge:'long',
          desc:`Entrás en furia. Ventaja en checks STR, resistencia a daño físico, +${nivel>=16?4:nivel>=9?3:2} al daño con armas cuerpo a cuerpo. Dura 1 minuto.`, fullDesc:'' },
        { id:'unarmored-defense-barb', name:'Unarmored Defense', source:'Bárbaro · Nivel 1', type:'passive', action:'Pasiva', range:'Personal', recharge:null,
          desc:'Sin armadura: CA = 10 + mod DES + mod CON.', fullDesc:'' },
        ...(nivel >= 2 ? [{ id:'reckless-attack', name:'Reckless Attack', source:'Bárbaro · Nivel 2', type:'active', action:'Ninguna (parte del ataque)', range:'Personal', recharge:null,
          desc:'Ventaja en ataques cuerpo a cuerpo con STR este turno, pero los ataques contra vos tienen ventaja hasta tu próximo turno.', fullDesc:'' }] : []),
        ...(nivel >= 2 ? [{ id:'danger-sense', name:'Danger Sense', source:'Bárbaro · Nivel 2', type:'passive', action:'Pasiva', range:'Personal', recharge:null,
          desc:'Ventaja en saves de DES contra efectos que podés ver (trampas, conjuros). No funciona si estás cegado, ensordecido o incapacitado.', fullDesc:'' }] : []),
        ...(nivel >= 3 ? [{ id:'barb-subclass', name:'Primal Path (Subclase)', source:'Bárbaro · Nivel 3', type:'passive', action:'Pasiva', range:'Personal', recharge:null,
          desc:'Elegís tu Primal Path que define tu estilo de furia.', fullDesc:'' }] : []),
        ...(nivel >= 4 ? [{ id:'barb-asi-4', name:'Ability Score Improvement', source:'Bárbaro · Nivel 4', type:'passive', action:'Pasiva', range:'Personal', recharge:null,
          desc:'+2 a un stat o +1 a dos stats.', fullDesc:'' }] : []),
        ...(nivel >= 5 ? [{ id:'extra-attack-barb', name:'Extra Attack', source:'Bárbaro · Nivel 5', type:'passive', action:'Pasiva', range:'Personal', recharge:null,
          desc:'Al usar la acción Atacar, podés atacar dos veces.', fullDesc:'' }] : []),
        ...(nivel >= 5 ? [{ id:'fast-movement', name:'Fast Movement', source:'Bárbaro · Nivel 5', type:'passive', action:'Pasiva', range:'Personal', recharge:null,
          desc:'+10 ft de velocidad cuando no llevás armadura pesada.', fullDesc:'' }] : []),
        ...(nivel >= 7 ? [{ id:'feral-instinct', name:'Feral Instinct', source:'Bárbaro · Nivel 7', type:'passive', action:'Pasiva', range:'Personal', recharge:null,
          desc:'Ventaja en tiradas de Iniciativa. Si sos sorprendido y estás en Rage al inicio del combate, podés actuar normalmente.', fullDesc:'' }] : []),
        ...(nivel >= 7 ? [{ id:'instinctive-pounce', name:'Instinctive Pounce', source:'Bárbaro · Nivel 7', type:'passive', action:'Pasiva', range:'Personal', recharge:null,
          desc:'Al entrar en Rage podés moverte hasta mitad de tu velocidad como parte de la Acción Bonus.', fullDesc:'' }] : []),
        ...(nivel >= 8 ? [{ id:'barb-asi-8', name:'Ability Score Improvement', source:'Bárbaro · Nivel 8', type:'passive', action:'Pasiva', range:'Personal', recharge:null,
          desc:'+2 a un stat o +1 a dos stats.', fullDesc:'' }] : []),
        ...(nivel >= 9 ? [{ id:'brutal-strike', name:'Brutal Strike', source:'Bárbaro · Nivel 9', type:'active', action:'Ninguna (parte del ataque)', range:'Personal', recharge:null,
          desc:'Cuando usás Reckless Attack, podés renunciar a la ventaja en un ataque para activar un Brutal Strike: +1d10 daño + efecto adicional según tu Primal Path.', fullDesc:'' }] : []),
        ...(nivel >= 11 ? [{ id:'relentless-rage', name:'Relentless Rage', source:'Bárbaro · Nivel 11', type:'active', action:'Ninguna (salva automática)', range:'Personal', recharge:null,
          desc:'Si caés a 0 HP en Rage, hacés save CON (CD 10, +5 por cada uso adicional). Si pasás, quedás con 1 HP.', fullDesc:'' }] : []),
        ...(nivel >= 12 ? [{ id:'barb-asi-12', name:'Ability Score Improvement', source:'Bárbaro · Nivel 12', type:'passive', action:'Pasiva', range:'Personal', recharge:null,
          desc:'+2 a un stat o +1 a dos stats.', fullDesc:'' }] : []),
        ...(nivel >= 15 ? [{ id:'persistent-rage', name:'Persistent Rage', source:'Bárbaro · Nivel 15', type:'passive', action:'Pasiva', range:'Personal', recharge:null,
          desc:'Tu Rage ya no termina prematuramente al final del turno si no atacaste. Solo termina si elegís terminarlo o quedás inconsciente.', fullDesc:'' }] : []),
        ...(nivel >= 16 ? [{ id:'barb-asi-16', name:'Ability Score Improvement', source:'Bárbaro · Nivel 16', type:'passive', action:'Pasiva', range:'Personal', recharge:null,
          desc:'+2 a un stat o +1 a dos stats.', fullDesc:'' }] : []),
        ...(nivel >= 17 ? [{ id:'improved-brutal-strike', name:'Improved Brutal Strike', source:'Bárbaro · Nivel 17', type:'passive', action:'Pasiva', range:'Personal', recharge:null,
          desc:'Brutal Strike mejora: +2d10 daño adicional y podés elegir dos efectos de Brutal Strike.', fullDesc:'' }] : []),
        ...(nivel >= 18 ? [{ id:'indomitable-might', name:'Indomitable Might', source:'Bárbaro · Nivel 18', type:'passive', action:'Pasiva', range:'Personal', recharge:null,
          desc:'En checks de STR usás mínimo tu puntuación de STR (no el modificador).', fullDesc:'' }] : []),
        ...(nivel >= 19 ? [{ id:'barb-asi-19', name:'Epic Boon', source:'Bárbaro · Nivel 19', type:'passive', action:'Pasiva', range:'Personal', recharge:null,
          desc:'Ganás un Epic Boon feat.', fullDesc:'' }] : []),
        ...(nivel >= 20 ? [{ id:'primal-champion', name:'Primal Champion', source:'Bárbaro · Nivel 20', type:'passive', action:'Pasiva', range:'Personal', recharge:null,
          desc:'+4 a STR, +4 a CON. Tus máximos para estas stats aumentan a 24.', fullDesc:'' }] : []),
      ],
    },
    'Bardo': {
      resources: (nivel) => [
        { id:'bardic-inspiration', name:'Bardic Inspiration',
          current: nivel >= 20 ? 6 : nivel >= 15 ? 5 : nivel >= 10 ? 4 : nivel >= 5 ? 3 : 1,
          max:     nivel >= 20 ? 6 : nivel >= 15 ? 5 : nivel >= 10 ? 4 : nivel >= 5 ? 3 : 1,
          recharge: nivel >= 5 ? 'short' : 'long',
          note: `d${nivel>=15?12:nivel>=10?10:nivel>=5?8:6} · ${nivel>=5?'Short':'Long'} rest` }
      ],
      features: (nivel) => [
        { id:'bardic-inspiration', name:`Bardic Inspiration (d${nivel>=15?12:nivel>=10?10:nivel>=5?8:6})`, source:'Bardo · Nivel 1', type:'active', action:'Acción bonus', range:'60 ft', recharge: nivel>=5?'short':'long',
          desc:`Dás inspiración a un aliado: +d${nivel>=15?12:nivel>=10?10:nivel>=5?8:6} a una tirada en los próximos 10 min. ${nivel>=5?3:1} usos por ${nivel>=5?'Short':'Long'} Rest.`, fullDesc:'' },
        { id:'spellcasting-bard', name:'Spellcasting (CAR)', source:'Bardo · Nivel 1', type:'passive', action:'Varía', range:'Varía', recharge:null,
          desc:'Lanzás conjuros de Bardo usando Carisma. Full caster.', fullDesc:'' },
        ...(nivel >= 2 ? [{ id:'jack-of-all-trades', name:'Jack of All Trades', source:'Bardo · Nivel 2', type:'passive', action:'Pasiva', range:'Personal', recharge:null,
          desc:'Agregás la mitad de tu Prof Bonus a cualquier check de habilidad donde no tenés proficiencia.', fullDesc:'' }] : []),
        ...(nivel >= 2 ? [{ id:'song-of-rest', name:`Song of Rest (d${nivel>=17?12:nivel>=13?10:nivel>=9?8:nivel>=5?8:6})`, source:'Bardo · Nivel 2', type:'passive', action:'Pasiva', range:'30 ft', recharge:null,
          desc:'Durante un Short Rest, vos y aliados que puedan oírte recuperan HP extra al gastar Hit Dice.', fullDesc:'' }] : []),
        ...(nivel >= 3 ? [{ id:'bard-subclass', name:'Colegio de Bardo (Subclase)', source:'Bardo · Nivel 3', type:'passive', action:'Pasiva', range:'Personal', recharge:null,
          desc:'Elegís tu Colegio de Bardo que define tu estilo.', fullDesc:'' }] : []),
        ...(nivel >= 3 ? [{ id:'expertise-bard', name:'Expertise (×2)', source:'Bardo · Nivel 3', type:'passive', action:'Pasiva', range:'Personal', recharge:null,
          desc:'Elegís 2 habilidades con proficiencia: tu Prof Bonus se duplica para ellas.', fullDesc:'' }] : []),
        ...(nivel >= 4 ? [{ id:'bard-asi-4', name:'Ability Score Improvement', source:'Bardo · Nivel 4', type:'passive', action:'Pasiva', range:'Personal', recharge:null,
          desc:'+2 a un stat o +1 a dos stats.', fullDesc:'' }] : []),
        ...(nivel >= 5 ? [{ id:'font-of-inspiration', name:'Font of Inspiration', source:'Bardo · Nivel 5', type:'passive', action:'Pasiva', range:'Personal', recharge:null,
          desc:'Bardic Inspiration recarga en Short Rest en lugar de Long Rest. Los dados son d8.', fullDesc:'' }] : []),
        ...(nivel >= 6 ? [{ id:'countercharm', name:'Countercharm', source:'Bardo · Nivel 6', type:'active', action:'Acción', range:'30 ft', recharge:null,
          desc:'Hasta el final de tu próximo turno, vos y aliados que te oigan tienen ventaja en saves contra encantamientos y miedo.', fullDesc:'' }] : []),
        ...(nivel >= 7 ? [{ id:'bard-asi-8', name:'Ability Score Improvement', source:'Bardo · Nivel 8', type:'passive', action:'Pasiva', range:'Personal', recharge:null,
          desc:'+2 a un stat o +1 a dos stats.', fullDesc:'' }] : []),
        ...(nivel >= 10 ? [{ id:'magical-secrets', name:'Magical Secrets', source:'Bardo · Nivel 10', type:'passive', action:'Pasiva', range:'Personal', recharge:null,
          desc:'Aprendés 2 conjuros de cualquier clase (repetible a nv14 y nv18).', fullDesc:'' }] : []),
        ...(nivel >= 10 ? [{ id:'expertise-bard-2', name:'Expertise (×2 adicional)', source:'Bardo · Nivel 10', type:'passive', action:'Pasiva', range:'Personal', recharge:null,
          desc:'Elegís 2 habilidades más con proficiencia para duplicar el Prof Bonus.', fullDesc:'' }] : []),
        ...(nivel >= 20 ? [{ id:'words-of-creation', name:'Words of Creation', source:'Bardo · Nivel 20', type:'passive', action:'Pasiva', range:'Personal', recharge:null,
          desc:'Siempre tenés preparados Power Word Heal y Power Word Kill. Lanzarlos no gasta spell slots.', fullDesc:'' }] : []),
      ],
    },
    'Druida': {
      resources: (nivel) => [
        { id:'wild-shape', name:'Wild Shape',
          current: 2, max: 2, recharge:'short',
          note: nivel>=18?'Bestia CR sin límite':nivel>=8?'CR 1':'CR 1/4 (nv2 CR 1/4, nv4 CR 1/2)' }
      ],
      features: (nivel) => [
        { id:'druidic', name:'Druidic', source:'Druida · Nivel 1', type:'passive', action:'Pasiva', range:'Personal', recharge:null,
          desc:'Conocés Druidic, el idioma secreto de los druidas. Podés dejar mensajes ocultos que solo otros druidas pueden ver.', fullDesc:'' },
        { id:'spellcasting-druid', name:'Spellcasting (SAB)', source:'Druida · Nivel 1', type:'passive', action:'Varía', range:'Varía', recharge:null,
          desc:'Lanzás conjuros de Druida usando Sabiduría. Full caster.', fullDesc:'' },
        { id:'primal-order', name:'Primal Order', source:'Druida · Nivel 1', type:'passive', action:'Pasiva', range:'Personal', recharge:null,
          desc:'Elegís un Primal Order: Magician (cantrip extra + INT tools) o Warden (armas marciales + armadura media).', fullDesc:'' },
        ...(nivel >= 2 ? [{ id:'wild-shape', name:`Wild Shape (CR ${nivel>=18?'ilimitado':nivel>=8?1:nivel>=4?'1/2':'1/4'})`, source:'Druida · Nivel 2', type:'active', action:'Acción bonus', range:'Personal', recharge:'short',
          desc:`2 usos por Short Rest. Tomás la forma de una bestia CR ≤ ${nivel>=18?'cualquiera':nivel>=8?1:nivel>=4?'0.5':'0.25'}.`, fullDesc:'' }] : []),
        ...(nivel >= 2 ? [{ id:'druid-subclass', name:'Círculo Druídico (Subclase)', source:'Druida · Nivel 2', type:'passive', action:'Pasiva', range:'Personal', recharge:null,
          desc:'Elegís tu Círculo Druídico.', fullDesc:'' }] : []),
        ...(nivel >= 4 ? [{ id:'druid-asi-4', name:'Ability Score Improvement', source:'Druida · Nivel 4', type:'passive', action:'Pasiva', range:'Personal', recharge:null,
          desc:'+2 a un stat o +1 a dos stats.', fullDesc:'' }] : []),
        ...(nivel >= 4 ? [{ id:'wild-shape-2', name:'Wild Shape mejorado (CR 1/2)', source:'Druida · Nivel 4', type:'passive', action:'Pasiva', range:'Personal', recharge:null,
          desc:'Podés tomar formas con natación o vuelo (dependiendo del círculo).', fullDesc:'' }] : []),
        ...(nivel >= 5 ? [{ id:'wild-resurgence', name:'Wild Resurgence', source:'Druida · Nivel 5', type:'active', action:'Ninguna', range:'Personal', recharge:'long',
          desc:'Una vez por Long Rest, podés recuperar un uso de Wild Shape gastando un slot de nivel 1.', fullDesc:'' }] : []),
        ...(nivel >= 7 ? [{ id:'elemental-fury', name:'Elemental Fury', source:'Druida · Nivel 7', type:'passive', action:'Pasiva', range:'Personal', recharge:null,
          desc:'Elegís Potent Spellcasting (+SAB al daño de cantrips) o Primal Strike (ataques en Wild Shape son mágicos).', fullDesc:'' }] : []),
        ...(nivel >= 8 ? [{ id:'druid-asi-8', name:'Ability Score Improvement', source:'Druida · Nivel 8', type:'passive', action:'Pasiva', range:'Personal', recharge:null,
          desc:'+2 a un stat o +1 a dos stats.', fullDesc:'' }] : []),
        ...(nivel >= 12 ? [{ id:'druid-asi-12', name:'Ability Score Improvement', source:'Druida · Nivel 12', type:'passive', action:'Pasiva', range:'Personal', recharge:null,
          desc:'+2 a un stat o +1 a dos stats.', fullDesc:'' }] : []),
        ...(nivel >= 16 ? [{ id:'druid-asi-16', name:'Ability Score Improvement', source:'Druida · Nivel 16', type:'passive', action:'Pasiva', range:'Personal', recharge:null,
          desc:'+2 a un stat o +1 a dos stats.', fullDesc:'' }] : []),
        ...(nivel >= 18 ? [{ id:'beast-spells', name:'Beast Spells', source:'Druida · Nivel 18', type:'passive', action:'Pasiva', range:'Personal', recharge:null,
          desc:'Podés lanzar conjuros en Wild Shape (sin componentes materiales).', fullDesc:'' }] : []),
        ...(nivel >= 18 ? [{ id:'timeless-body-druid', name:'Timeless Body', source:'Druida · Nivel 18', type:'passive', action:'Pasiva', range:'Personal', recharge:null,
          desc:'Envejecés 10 veces más lento de lo normal y sos inmune a envejecimiento mágico.', fullDesc:'' }] : []),
        ...(nivel >= 19 ? [{ id:'druid-asi-19', name:'Epic Boon', source:'Druida · Nivel 19', type:'passive', action:'Pasiva', range:'Personal', recharge:null,
          desc:'Ganás un Epic Boon feat.', fullDesc:'' }] : []),
        ...(nivel >= 20 ? [{ id:'archdruid', name:'Archdruid', source:'Druida · Nivel 20', type:'passive', action:'Pasiva', range:'Personal', recharge:null,
          desc:'Wild Shape ilimitado. Podés ignorar los componentes verbales y somáticos de tus conjuros de Druida.', fullDesc:'' }] : []),
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
          id: 'favored-enemy', name: 'Favored Enemy',
          source: 'Explorador · Nivel 1', type: 'passive', action: 'Pasiva', range: 'Personal', recharge: null,
          desc: 'Hunter\'s Mark no requiere concentración y podés lanzarlo sin slot (usos por Long Rest).',
          fullDesc: 'D&D 2024: Favored Enemy ya no es una lista de tipos para elegir. En su lugar, el Explorador tiene Hunter\'s Mark integrado:\n\n• Lanzás Hunter\'s Mark sin gastar slot de conjuro.\n• Usos gratuitos por Long Rest: 1 (nv1), 2 (nv9), 3 (nv17).\n• A nivel 1: Hunter\'s Mark no requiere concentración.\n• El daño extra (+1d6) se aplica a cualquier criatura que marques, sin restricción de tipo.',
        },
        ...(nivel >= 2 ? [{
          id: 'expertise-ranger', name: 'Expertise',
          source: 'Explorador · Nivel 2', type: 'passive', action: 'Pasiva', range: 'Personal', recharge: null,
          desc: 'Elegís 2 habilidades con proficiencia: tu Prof Bonus se duplica para ellas.',
          fullDesc: 'D&D 2024: El Explorador obtiene Expertise a nivel 2.\n\nElegís 2 habilidades en las que tenés proficiencia. Tu Bono de Competencia se duplica para esas habilidades.\n\nIdeal para: Sigilo, Supervivencia, Percepción, Naturaleza o Atletismo según tu estilo de juego.',
        }] : []),
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
          fullDesc: 'Tenés una reserva de resistencia que podés usar para protegerte del daño.\n\nComo acción adicional, recuperás puntos de golpe iguales a 1d10 + tu nivel de Guerrero.\n\nUna vez que usás esta habilidad, debés terminar un descanso corto o largo para poder usarla de nuevo.',
        },
        ...(nivel >= 2 ? [{
          id: 'action-surge', name: `Action Surge${nivel >= 17 ? ' (×2)' : ''}`,
          source: `Guerrero · Nivel 2`, type: 'active', action: 'Sin acción', range: 'Personal', recharge: 'short',
          desc: `Tomás una acción adicional completa en tu turno. ${nivel >= 17 ? '2 usos por descanso.' : '1 uso por descanso corto/largo.'}`,
          fullDesc: 'A partir del nivel 2, podés tomar una acción adicional en tu turno. 1 uso por Short/Long rest (2 usos desde nv17).',
        }] : []),
        ...(nivel >= 3 ? [{ id:'fighter-subclass', name:'Martial Archetype (Subclase)', source:'Guerrero · Nivel 3', type:'passive', action:'Pasiva', range:'Personal', recharge:null, desc:'Elegís tu Martial Archetype que define tu estilo de combate.', fullDesc:'' }] : []),
        ...(nivel >= 4 ? [{ id:'fighter-asi-4', name:'Ability Score Improvement', source:'Guerrero · Nivel 4', type:'passive', action:'Pasiva', range:'Personal', recharge:null, desc:'+2 a un stat o +1 a dos stats.', fullDesc:'' }] : []),
        ...(nivel >= 5 ? [{
          id: 'extra-attack', name: `Extra Attack${nivel >= 20 ? ' (×4)' : nivel >= 11 ? ' (×3)' : ' (×2)'}`,
          source: `Guerrero · Nivel 5`, type: 'passive', action: 'Pasiva', range: 'Personal', recharge: null,
          desc: `Al usar la acción Atacar, podés atacar ${nivel >= 20 ? 4 : nivel >= 11 ? 3 : 2} veces.`,
          fullDesc: 'A partir del nivel 5, atacás dos veces al usar Atacar. Aumenta a 3 en nv11 y 4 en nv20.',
        }] : []),
        ...(nivel >= 6 ? [{ id:'fighter-asi-6', name:'Ability Score Improvement', source:'Guerrero · Nivel 6', type:'passive', action:'Pasiva', range:'Personal', recharge:null, desc:'+2 a un stat o +1 a dos stats.', fullDesc:'' }] : []),
        ...(nivel >= 8 ? [{ id:'fighter-asi-8', name:'Ability Score Improvement', source:'Guerrero · Nivel 8', type:'passive', action:'Pasiva', range:'Personal', recharge:null, desc:'+2 a un stat o +1 a dos stats.', fullDesc:'' }] : []),
        ...(nivel >= 9 ? [{
          id: 'indomitable', name: `Indomitable (${nivel>=17?3:nivel>=13?2:1} uso${nivel>=13?'s':''})`,
          source: 'Guerrero · Nivel 9', type: 'active', action: 'Ninguna', range: 'Personal', recharge: 'long',
          desc: `Repetís una tirada de salvación fallida. ${nivel>=17?3:nivel>=13?2:1} uso${nivel>=13?'s':''} por Long Rest.`,
          fullDesc: 'A partir del nivel 9, podés volver a tirar una tirada de salvación fallida. 1 uso (nv9), 2 usos (nv13), 3 usos (nv17).',
        }] : []),
        ...(nivel >= 12 ? [{ id:'fighter-asi-12', name:'Ability Score Improvement', source:'Guerrero · Nivel 12', type:'passive', action:'Pasiva', range:'Personal', recharge:null, desc:'+2 a un stat o +1 a dos stats.', fullDesc:'' }] : []),
        ...(nivel >= 14 ? [{ id:'fighter-asi-14', name:'Ability Score Improvement', source:'Guerrero · Nivel 14', type:'passive', action:'Pasiva', range:'Personal', recharge:null, desc:'+2 a un stat o +1 a dos stats.', fullDesc:'' }] : []),
        ...(nivel >= 16 ? [{ id:'fighter-asi-16', name:'Ability Score Improvement', source:'Guerrero · Nivel 16', type:'passive', action:'Pasiva', range:'Personal', recharge:null, desc:'+2 a un stat o +1 a dos stats.', fullDesc:'' }] : []),
        ...(nivel >= 19 ? [{ id:'fighter-asi-19', name:'Epic Boon', source:'Guerrero · Nivel 19', type:'passive', action:'Pasiva', range:'Personal', recharge:null, desc:'Ganás un Epic Boon feat.', fullDesc:'' }] : []),
      ],
    },
    'Hechicero': {
      resources: (nivel) => [
        { id:'sorcery-points', name:'Sorcery Points',
          current: nivel, max: nivel, recharge:'long',
          note:'Metamagic · Flexible Casting' }
      ],
      features: (nivel) => [
        { id:'spellcasting-sorc', name:'Spellcasting (CAR)', source:'Hechicero · Nivel 1', type:'passive', action:'Varía', range:'Varía', recharge:null, desc:'Lanzás conjuros usando Carisma. Full caster.', fullDesc:'' },
        { id:'sorc-subclass', name:'Sorcerous Origin (Subclase)', source:'Hechicero · Nivel 1', type:'passive', action:'Pasiva', range:'Personal', recharge:null, desc:'Elegís tu origen mágico que define tus poderes.', fullDesc:'' },
        ...(nivel >= 2 ? [{ id:'font-of-magic', name:'Font of Magic', source:'Hechicero · Nivel 2', type:'passive', action:'Pasiva', range:'Personal', recharge:null, desc:`${nivel} Sorcery Points. Convertís slots ↔ Sorcery Points. Base para Metamagic.`, fullDesc:'' }] : []),
        ...(nivel >= 3 ? [{ id:'metamagic', name:'Metamagic (×2 opciones)', source:'Hechicero · Nivel 3', type:'passive', action:'Varía', range:'Varía', recharge:null, desc:'Elegís 2 opciones de Metamagic para modificar tus conjuros.', fullDesc:'' }] : []),
        ...(nivel >= 4 ? [{ id:'sorc-asi-4', name:'Ability Score Improvement', source:'Hechicero · Nivel 4', type:'passive', action:'Pasiva', range:'Personal', recharge:null, desc:'+2 a un stat o +1 a dos stats.', fullDesc:'' }] : []),
        ...(nivel >= 5 ? [{ id:'sorc-innate-magic', name:'Sorcerous Restoration', source:'Hechicero · Nivel 5', type:'active', action:'Ninguna', range:'Personal', recharge:'short', desc:'Recuperás 4 Sorcery Points en Short Rest (1/día).', fullDesc:'' }] : []),
        ...(nivel >= 7 ? [{ id:'sorc-asi-7', name:'Ability Score Improvement', source:'Hechicero · Nivel 7', type:'passive', action:'Pasiva', range:'Personal', recharge:null, desc:'+2 a un stat o +1 a dos stats.', fullDesc:'' }] : []),
        ...(nivel >= 10 ? [{ id:'sorc-metamagic-extra-10', name:'Metamagic (+2 opciones)', source:'Hechicero · Nivel 10', type:'passive', action:'Pasiva', range:'Personal', recharge:null, desc:'Aprendés 2 opciones adicionales de Metamagic (total 4).', fullDesc:'' }] : []),
        ...(nivel >= 11 ? [{ id:'sorc-asi-11', name:'Ability Score Improvement', source:'Hechicero · Nivel 11', type:'passive', action:'Pasiva', range:'Personal', recharge:null, desc:'+2 a un stat o +1 a dos stats.', fullDesc:'' }] : []),
        ...(nivel >= 17 ? [{ id:'sorc-metamagic-extra-17', name:'Metamagic (+2 opciones)', source:'Hechicero · Nivel 17', type:'passive', action:'Pasiva', range:'Personal', recharge:null, desc:'Aprendés 2 opciones adicionales de Metamagic (total 6).', fullDesc:'' }] : []),
        ...(nivel >= 19 ? [{ id:'sorc-asi-19', name:'Epic Boon', source:'Hechicero · Nivel 19', type:'passive', action:'Pasiva', range:'Personal', recharge:null, desc:'Ganás un Epic Boon feat.', fullDesc:'' }] : []),
        ...(nivel >= 20 ? [{ id:'arcane-apotheosis', name:'Arcane Apotheosis', source:'Hechicero · Nivel 20', type:'passive', action:'Pasiva', range:'Personal', recharge:null, desc:'Una vez por turno podés usar Metamagic sin gastar Sorcery Points.', fullDesc:'' }] : []),
      ],
    },
    'Mago': {
      resources: (nivel) => [
        { id:'arcane-recovery', name:'Arcane Recovery',
          current: 1, max: 1, recharge:'long',
          note:`Recupera hasta ${Math.ceil(nivel/2)} niveles de slots (Short Rest · 1/día)` }
      ],
      features: (nivel) => [
        { id:'spellcasting-wiz', name:'Spellcasting (INT)', source:'Mago · Nivel 1', type:'passive', action:'Varía', range:'Varía', recharge:null, desc:'Lanzás conjuros usando Inteligencia. Full caster. Libro de hechizos.', fullDesc:'' },
        { id:'arcane-recovery', name:`Arcane Recovery (${Math.ceil(nivel/2)} niveles)`, source:'Mago · Nivel 1', type:'active', action:'Ninguna', range:'Personal', recharge:'long', desc:`1 vez por día en Short Rest: recuperás slots cuya suma ≤ ${Math.ceil(nivel/2)} (no slot nv6+).`, fullDesc:'' },
        ...(nivel >= 2 ? [{ id:'wiz-subclass', name:'Arcane Tradition (Subclase)', source:'Mago · Nivel 2', type:'passive', action:'Pasiva', range:'Personal', recharge:null, desc:'Elegís tu tradición arcana (escuela de magia) que define tus poderes.', fullDesc:'' }] : []),
        ...(nivel >= 4 ? [{ id:'wiz-asi-4', name:'Ability Score Improvement', source:'Mago · Nivel 4', type:'passive', action:'Pasiva', range:'Personal', recharge:null, desc:'+2 a un stat o +1 a dos stats.', fullDesc:'' }] : []),
        ...(nivel >= 8 ? [{ id:'wiz-asi-8', name:'Ability Score Improvement', source:'Mago · Nivel 8', type:'passive', action:'Pasiva', range:'Personal', recharge:null, desc:'+2 a un stat o +1 a dos stats.', fullDesc:'' }] : []),
        ...(nivel >= 12 ? [{ id:'wiz-asi-12', name:'Ability Score Improvement', source:'Mago · Nivel 12', type:'passive', action:'Pasiva', range:'Personal', recharge:null, desc:'+2 a un stat o +1 a dos stats.', fullDesc:'' }] : []),
        ...(nivel >= 16 ? [{ id:'wiz-asi-16', name:'Ability Score Improvement', source:'Mago · Nivel 16', type:'passive', action:'Pasiva', range:'Personal', recharge:null, desc:'+2 a un stat o +1 a dos stats.', fullDesc:'' }] : []),
        ...(nivel >= 18 ? [{ id:'spell-mastery', name:'Spell Mastery', source:'Mago · Nivel 18', type:'passive', action:'Pasiva', range:'Personal', recharge:null, desc:'Elegís 1 conjuro nv1 y 1 nv2: los lanzás sin gastar slots.', fullDesc:'' }] : []),
        ...(nivel >= 19 ? [{ id:'wiz-asi-19', name:'Epic Boon', source:'Mago · Nivel 19', type:'passive', action:'Pasiva', range:'Personal', recharge:null, desc:'Ganás un Epic Boon feat.', fullDesc:'' }] : []),
        ...(nivel >= 20 ? [{ id:'signature-spells', name:'Signature Spells', source:'Mago · Nivel 20', type:'passive', action:'Pasiva', range:'Personal', recharge:null, desc:'Elegís 2 conjuros nv3: siempre preparados y lanzables sin slot 1/Short Rest c/u.', fullDesc:'' }] : []),
      ],
    },
    'Monje': {
      resources: (nivel) => [
        { id:'ki', name:'Ki', current: nivel, max: nivel,
          recharge:'short', note:'Flurry of Blows · Patient Defense · Step of the Wind' },
        ...(nivel >= 5 ? [{ id:'stunning-strike', name:'Stunning Strike', current: 0, max: 0,
          recharge:'short', note:'Gasta 1 Ki después de golpear → Save CON o aturdido' }] : []),
      ],
      features: (nivel) => [
        { id:'unarmored-defense-monk', name:'Unarmored Defense', source:'Monje · Nivel 1', type:'passive', action:'Pasiva', range:'Personal', recharge:null, desc:'Sin armadura ni escudo: CA = 10 + mod DES + mod SAB.', fullDesc:'' },
        { id:'martial-arts', name:`Martial Arts (d${nivel>=17?10:nivel>=11?8:nivel>=5?6:4})`, source:'Monje · Nivel 1', type:'passive', action:'Pasiva', range:'Personal', recharge:null, desc:`Ataques desarmados y armas monk hacen d${nivel>=17?10:nivel>=11?8:nivel>=5?6:4} de daño. Usás DES o STR. Ataque adicional desarmado como Bonus Action.`, fullDesc:'' },
        ...(nivel >= 2 ? [{ id:'ki', name:`Ki (${nivel} puntos)`, source:'Monje · Nivel 2', type:'active', action:'Varía', range:'Personal', recharge:'short', desc:'Flurry of Blows (2 Ki: 2 ataques adicionales), Patient Defense (1 Ki: Dodge), Step of the Wind (1 Ki: Dash/Disengage).', fullDesc:'' }] : []),
        ...(nivel >= 2 ? [{ id:'unarmored-movement', name:`Unarmored Movement (+${nivel>=18?30:nivel>=14?25:nivel>=10?20:nivel>=6?15:10} ft)`, source:'Monje · Nivel 2', type:'passive', action:'Pasiva', range:'Personal', recharge:null, desc:`+${nivel>=18?30:nivel>=14?25:nivel>=10?20:nivel>=6?15:10} ft de velocidad sin armadura ni escudo.`, fullDesc:'' }] : []),
        ...(nivel >= 3 ? [{ id:'monk-subclass', name:'Monastic Tradition (Subclase)', source:'Monje · Nivel 3', type:'passive', action:'Pasiva', range:'Personal', recharge:null, desc:'Elegís tu tradición monástica.', fullDesc:'' }] : []),
        ...(nivel >= 3 ? [{ id:'deflect-missiles', name:'Deflect Missiles', source:'Monje · Nivel 3', type:'active', action:'Reacción', range:'Personal', recharge:null, desc:'Reducís el daño de proyectil en 1d10+DES+nivel. Si lo reduces a 0 podés devolverlo (1 Ki).', fullDesc:'' }] : []),
        ...(nivel >= 4 ? [{ id:'monk-asi-4', name:'Ability Score Improvement', source:'Monje · Nivel 4', type:'passive', action:'Pasiva', range:'Personal', recharge:null, desc:'+2 a un stat o +1 a dos stats.', fullDesc:'' }] : []),
        ...(nivel >= 4 ? [{ id:'slow-fall', name:'Slow Fall', source:'Monje · Nivel 4', type:'active', action:'Reacción', range:'Personal', recharge:null, desc:'Reducís daño de caída en 5×nivel Monje.', fullDesc:'' }] : []),
        ...(nivel >= 5 ? [{ id:'extra-attack-monk', name:'Extra Attack', source:'Monje · Nivel 5', type:'passive', action:'Pasiva', range:'Personal', recharge:null, desc:'Al usar la acción Atacar, atacás dos veces.', fullDesc:'' }] : []),
        ...(nivel >= 5 ? [{ id:'stunning-strike', name:'Stunning Strike', source:'Monje · Nivel 5', type:'active', action:'Ninguna (post-golpe)', range:'Personal', recharge:'short', desc:'Gasta 1 Ki después de golpear: el objetivo hace Save CON (CD = 8+Prof+SAB) o queda Stunned hasta tu próximo turno.', fullDesc:'' }] : []),
        ...(nivel >= 6 ? [{ id:'ki-empowered', name:'Ki-Empowered Strikes', source:'Monje · Nivel 6', type:'passive', action:'Pasiva', range:'Personal', recharge:null, desc:'Tus ataques desarmados se consideran mágicos para resistencias.', fullDesc:'' }] : []),
        ...(nivel >= 7 ? [{ id:'evasion-monk', name:'Evasion', source:'Monje · Nivel 7', type:'passive', action:'Pasiva', range:'Personal', recharge:null, desc:'Cuando un efecto de área pide save DES: si pasás no recibís daño; si fallás, recibís la mitad.', fullDesc:'' }] : []),
        ...(nivel >= 7 ? [{ id:'stillness-of-mind', name:'Stillness of Mind', source:'Monje · Nivel 7', type:'active', action:'Acción', range:'Personal', recharge:null, desc:'Terminás cualquier efecto que te tenga Encantado o Asustado.', fullDesc:'' }] : []),
        ...(nivel >= 8 ? [{ id:'monk-asi-8', name:'Ability Score Improvement', source:'Monje · Nivel 8', type:'passive', action:'Pasiva', range:'Personal', recharge:null, desc:'+2 a un stat o +1 a dos stats.', fullDesc:'' }] : []),
        ...(nivel >= 10 ? [{ id:'self-restoration', name:'Self-Restoration', source:'Monje · Nivel 10', type:'passive', action:'Pasiva', range:'Personal', recharge:null, desc:'Al terminar un Short Rest: fin de Poisoned y Frightened. 3 Ki: fin de Paralysis o Stunned.', fullDesc:'' }] : []),
        ...(nivel >= 12 ? [{ id:'monk-asi-12', name:'Ability Score Improvement', source:'Monje · Nivel 12', type:'passive', action:'Pasiva', range:'Personal', recharge:null, desc:'+2 a un stat o +1 a dos stats.', fullDesc:'' }] : []),
        ...(nivel >= 13 ? [{ id:'deflect-energy', name:'Deflect Energy', source:'Monje · Nivel 13', type:'active', action:'Reacción', range:'Personal', recharge:null, desc:'Deflect Missiles ahora también funciona contra daño de energía (fuego, rayo, etc).', fullDesc:'' }] : []),
        ...(nivel >= 14 ? [{ id:'diamond-soul', name:'Diamond Soul', source:'Monje · Nivel 14', type:'passive', action:'Pasiva', range:'Personal', recharge:null, desc:'Proficiencia en todos los Saving Throws. Gastando 1 Ki repetís una tirada de salvación fallida.', fullDesc:'' }] : []),
        ...(nivel >= 15 ? [{ id:'timeless-body-monk', name:'Timeless Body', source:'Monje · Nivel 15', type:'passive', action:'Pasiva', range:'Personal', recharge:null, desc:'No envejecés por medios mágicos. No necesitás comida ni agua.', fullDesc:'' }] : []),
        ...(nivel >= 16 ? [{ id:'monk-asi-16', name:'Ability Score Improvement', source:'Monje · Nivel 16', type:'passive', action:'Pasiva', range:'Personal', recharge:null, desc:'+2 a un stat o +1 a dos stats.', fullDesc:'' }] : []),
        ...(nivel >= 18 ? [{ id:'empty-body', name:'Empty Body', source:'Monje · Nivel 18', type:'active', action:'Acción bonus', range:'Personal', recharge:'short', desc:'4 Ki: Invisible por 1 minuto con resistencia a todo daño excepto fuerza. 8 Ki: Astral Projection sin gastar slot.', fullDesc:'' }] : []),
        ...(nivel >= 19 ? [{ id:'monk-asi-19', name:'Epic Boon', source:'Monje · Nivel 19', type:'passive', action:'Pasiva', range:'Personal', recharge:null, desc:'Ganás un Epic Boon feat.', fullDesc:'' }] : []),
        ...(nivel >= 20 ? [{ id:'perfect-self', name:'Perfect Self', source:'Monje · Nivel 20', type:'passive', action:'Pasiva', range:'Personal', recharge:null, desc:'Si al inicio del combate tenés 0 Ki, recuperás 4 puntos de Ki.', fullDesc:'' }] : []),
      ],
    },
    'Paladín': {
      resources: (nivel) => [
        { id:'lay-on-hands', name:'Lay on Hands',
          current: nivel * 5, max: nivel * 5,
          recharge:'long', note:`${nivel*5} HP de pool · 5 HP para curar · 1 HP para curar enfermedad` },
        ...(nivel >= 3 ? [{ id:'channel-divinity', name:'Channel Divinity',
          current: nivel >= 11 ? 3 : nivel >= 6 ? 2 : 1, max: nivel >= 11 ? 3 : nivel >= 6 ? 2 : 1,
          recharge:'short', note:'Sacred Weapon · Turn the Unholy' }] : []),
        { id:'divine-smite', name:'Divine Smite', current: 0, max: 0,
          recharge:'never', note:'Gasta slots después de golpear para +2d8 daño radiante' },
      ],
      features: (nivel) => [
        { id:'lay-on-hands', name:`Lay on Hands (${nivel*5} HP)`, source:'Paladín · Nivel 1', type:'active', action:'Acción', range:'Contacto', recharge:'long', desc:`Pool de ${nivel*5} HP. Gastás cualquier cantidad para curar. 5 HP para curar enfermedad/veneno.`, fullDesc:'' },
        { id:'divine-sense', name:'Divine Sense', source:'Paladín · Nivel 1', type:'active', action:'Acción', range:'60 ft', recharge:'long', desc:`Detectás Celestiales, Fiends y Muertos Vivientes a 60 ft (no ocultos). ${Math.max(1,1+Math.floor((stats&&stats.car||10-10)/2))} usos/Long Rest.`, fullDesc:'' },
        ...(nivel >= 2 ? [{ id:'fighting-style-pal', name:'Fighting Style', source:'Paladín · Nivel 2', type:'passive', action:'Pasiva', range:'Personal', recharge:null, desc:'Estilo de combate especializado (Defense, Dueling, Great Weapon Fighting, Protection, Blessed Warrior, Interception).', fullDesc:'' }] : []),
        ...(nivel >= 2 ? [{ id:'spellcasting-pal', name:'Spellcasting (CAR)', source:'Paladín · Nivel 2', type:'passive', action:'Varía', range:'Varía', recharge:null, desc:'Lanzás conjuros divinos usando Carisma. Half-caster (slots desde nv2).', fullDesc:'' }] : []),
        ...(nivel >= 2 ? [{ id:'divine-smite', name:'Divine Smite', source:'Paladín · Nivel 2', type:'active', action:'Ninguna (post-golpe)', range:'Personal', recharge:null, desc:'Después de golpear gastás 1+ slots: +2d8 daño radiante (por nv del slot), +1d8 extra vs Muertos Vivientes/Fiends.', fullDesc:'' }] : []),
        ...(nivel >= 3 ? [{ id:'divine-health', name:'Divine Health', source:'Paladín · Nivel 3', type:'passive', action:'Pasiva', range:'Personal', recharge:null, desc:'Sos inmune a enfermedades.', fullDesc:'' }] : []),
        ...(nivel >= 3 ? [{ id:'channel-divinity-pal', name:`Channel Divinity (${nivel>=11?3:nivel>=6?2:1} uso${nivel>=6?'s':''})`, source:'Paladín · Nivel 3', type:'active', action:'Acción', range:'Varía', recharge:'short', desc:'Sacred Weapon: +CAR al ataque. Turn the Unholy: ahuyentás Fiends/Muertos Vivientes.', fullDesc:'' }] : []),
        ...(nivel >= 3 ? [{ id:'sacred-oath', name:'Sacred Oath (Subclase)', source:'Paladín · Nivel 3', type:'passive', action:'Pasiva', range:'Personal', recharge:null, desc:'Elegís tu Juramento que define tus poderes divinos.', fullDesc:'' }] : []),
        ...(nivel >= 4 ? [{ id:'pal-asi-4', name:'Ability Score Improvement', source:'Paladín · Nivel 4', type:'passive', action:'Pasiva', range:'Personal', recharge:null, desc:'+2 a un stat o +1 a dos stats.', fullDesc:'' }] : []),
        ...(nivel >= 5 ? [{ id:'extra-attack-pal', name:'Extra Attack', source:'Paladín · Nivel 5', type:'passive', action:'Pasiva', range:'Personal', recharge:null, desc:'Al usar la acción Atacar, podés atacar dos veces.', fullDesc:'' }] : []),
        ...(nivel >= 5 ? [{ id:'faithful-steed', name:'Faithful Steed', source:'Paladín · Nivel 5', type:'active', action:'Acción', range:'30 ft', recharge:'long', desc:'Conjurás un corcel (caballo, pony, mastín...) que comparte tu alineación. Se puede resumir tras morir.', fullDesc:'' }] : []),
        ...(nivel >= 6 ? [{ id:'aura-of-protection', name:'Aura of Protection', source:'Paladín · Nivel 6', type:'passive', action:'Pasiva', range:'10 ft', recharge:null, desc:`Vos y aliados a 10 ft suman +${Math.max(1,Math.floor(((0)-10)/2))} (mod CAR) a todos los Saving Throws.`, fullDesc:'' }] : []),
        ...(nivel >= 8 ? [{ id:'pal-asi-8', name:'Ability Score Improvement', source:'Paladín · Nivel 8', type:'passive', action:'Pasiva', range:'Personal', recharge:null, desc:'+2 a un stat o +1 a dos stats.', fullDesc:'' }] : []),
        ...(nivel >= 9 ? [{ id:'abjure-foes', name:'Abjure Foes', source:'Paladín · Nivel 9', type:'active', action:'Acción', range:'60 ft', recharge:'long', desc:`${Math.max(1,1)} criaturas (máx tu mod CAR) hacen save SAB o quedan Asustadas/Incapacitadas por 1 min. 1 uso/Long Rest.`, fullDesc:'' }] : []),
        ...(nivel >= 10 ? [{ id:'aura-of-courage', name:'Aura of Courage', source:'Paladín · Nivel 10', type:'passive', action:'Pasiva', range:'10 ft', recharge:null, desc:'Vos y aliados a 10 ft son inmunes al estado Frightened mientras estés consciente.', fullDesc:'' }] : []),
        ...(nivel >= 11 ? [{ id:'radiant-strikes', name:'Radiant Strikes', source:'Paladín · Nivel 11', type:'passive', action:'Pasiva', range:'Personal', recharge:null, desc:'+1d8 daño radiante a tus ataques de arma y ataques desarmados.', fullDesc:'' }] : []),
        ...(nivel >= 12 ? [{ id:'pal-asi-12', name:'Ability Score Improvement', source:'Paladín · Nivel 12', type:'passive', action:'Pasiva', range:'Personal', recharge:null, desc:'+2 a un stat o +1 a dos stats.', fullDesc:'' }] : []),
        ...(nivel >= 14 ? [{ id:'cleansing-touch', name:'Cleansing Touch', source:'Paladín · Nivel 14', type:'active', action:'Acción', range:'Contacto', recharge:'long', desc:`Terminás un conjuro activo en una criatura (con su consentimiento). ${Math.max(1,1)} usos/Long Rest.`, fullDesc:'' }] : []),
        ...(nivel >= 16 ? [{ id:'pal-asi-16', name:'Ability Score Improvement', source:'Paladín · Nivel 16', type:'passive', action:'Pasiva', range:'Personal', recharge:null, desc:'+2 a un stat o +1 a dos stats.', fullDesc:'' }] : []),
        ...(nivel >= 19 ? [{ id:'pal-asi-19', name:'Epic Boon', source:'Paladín · Nivel 19', type:'passive', action:'Pasiva', range:'Personal', recharge:null, desc:'Ganás un Epic Boon feat.', fullDesc:'' }] : []),
        ...(nivel >= 20 ? [{ id:'sacred-oath-capstone', name:'Sacred Oath Capstone', source:'Paladín · Nivel 20', type:'passive', action:'Pasiva', range:'Personal', recharge:null, desc:'Habilidad final de tu Sacred Oath (varía por subclase).', fullDesc:'' }] : []),
      ],
    },
    'Pícaro': {
      resources: (nivel) => [
        { id:'cunning-action', name:'Cunning Action', current: 0, max: 0,
          recharge:'never', note:'Bonus action: Dash · Disengage · Hide' },
        ...(nivel >= 5 ? [{ id:'uncanny-dodge', name:'Uncanny Dodge', current: 0, max: 0,
          recharge:'never', note:'Reacción: mitad de daño de un ataque visible' }] : []),
      ],
      features: (nivel) => [
        { id:'sneak-attack', name:`Sneak Attack (${Math.ceil(nivel/2)}d6)`, source:'Pícaro · Nivel 1', type:'passive', action:'1/turno', range:'Personal', recharge:null, desc:`+${Math.ceil(nivel/2)}d6 daño 1 vez/turno si tenés ventaja o un aliado adyacente al objetivo.`, fullDesc:'' },
        { id:'thieves-cant', name:"Thieves' Cant", source:'Pícaro · Nivel 1', type:'passive', action:'Pasiva', range:'Personal', recharge:null, desc:'Conocés el lenguaje secreto de los ladrones. Podés ocultar mensajes en conversaciones normales.', fullDesc:'' },
        { id:'expertise-rogue', name:'Expertise (×2)', source:'Pícaro · Nivel 1', type:'passive', action:'Pasiva', range:'Personal', recharge:null, desc:'Elegís 2 habilidades con proficiencia para duplicar tu Prof Bonus.', fullDesc:'' },
        ...(nivel >= 2 ? [{ id:'cunning-action', name:'Cunning Action', source:'Pícaro · Nivel 2', type:'active', action:'Acción bonus', range:'Personal', recharge:null, desc:'Acción bonus para Dash, Disengage o Hide.', fullDesc:'' }] : []),
        ...(nivel >= 3 ? [{ id:'rogue-subclass', name:'Roguish Archetype (Subclase)', source:'Pícaro · Nivel 3', type:'passive', action:'Pasiva', range:'Personal', recharge:null, desc:'Elegís tu arquetipo de Pícaro.', fullDesc:'' }] : []),
        ...(nivel >= 3 ? [{ id:'steady-aim', name:'Steady Aim', source:'Pícaro · Nivel 3', type:'active', action:'Acción bonus', range:'Personal', recharge:null, desc:'Ganás ventaja en tu próximo ataque este turno si no te moviste.', fullDesc:'' }] : []),
        ...(nivel >= 4 ? [{ id:'rogue-asi-4', name:'Ability Score Improvement', source:'Pícaro · Nivel 4', type:'passive', action:'Pasiva', range:'Personal', recharge:null, desc:'+2 a un stat o +1 a dos stats.', fullDesc:'' }] : []),
        ...(nivel >= 5 ? [{ id:'uncanny-dodge', name:'Uncanny Dodge', source:'Pícaro · Nivel 5', type:'active', action:'Reacción', range:'Personal', recharge:null, desc:'Cuando un atacante visible te golpea, usás la reacción para reducir el daño a la mitad.', fullDesc:'' }] : []),
        ...(nivel >= 6 ? [{ id:'expertise-rogue-2', name:'Expertise (×2 adicional)', source:'Pícaro · Nivel 6', type:'passive', action:'Pasiva', range:'Personal', recharge:null, desc:'Elegís 2 habilidades más para duplicar tu Prof Bonus.', fullDesc:'' }] : []),
        ...(nivel >= 7 ? [{ id:'evasion-rogue', name:'Evasion', source:'Pícaro · Nivel 7', type:'passive', action:'Pasiva', range:'Personal', recharge:null, desc:'Saves de DES contra efectos de área: si pasás, no recibís daño; si fallás, solo la mitad.', fullDesc:'' }] : []),
        ...(nivel >= 7 ? [{ id:'reliable-talent-note', name:'Reliable Talent (próximo nv11)', source:'Pícaro · Nivel 7', type:'passive', action:'Pasiva', range:'Personal', recharge:null, desc:'A nv11: en checks donde tenés proficiencia, tratas resultados de 1-9 como si hubieras sacado 10.', fullDesc:'' }] : []),
        ...(nivel >= 8 ? [{ id:'rogue-asi-8', name:'Ability Score Improvement', source:'Pícaro · Nivel 8', type:'passive', action:'Pasiva', range:'Personal', recharge:null, desc:'+2 a un stat o +1 a dos stats.', fullDesc:'' }] : []),
        ...(nivel >= 10 ? [{ id:'rogue-asi-10', name:'Ability Score Improvement', source:'Pícaro · Nivel 10', type:'passive', action:'Pasiva', range:'Personal', recharge:null, desc:'+2 a un stat o +1 a dos stats.', fullDesc:'' }] : []),
        ...(nivel >= 11 ? [{ id:'reliable-talent', name:'Reliable Talent', source:'Pícaro · Nivel 11', type:'passive', action:'Pasiva', range:'Personal', recharge:null, desc:'En checks de habilidad donde tenés proficiencia, tratás resultados 1-9 como si fuera 10.', fullDesc:'' }] : []),
        ...(nivel >= 12 ? [{ id:'rogue-asi-12', name:'Ability Score Improvement', source:'Pícaro · Nivel 12', type:'passive', action:'Pasiva', range:'Personal', recharge:null, desc:'+2 a un stat o +1 a dos stats.', fullDesc:'' }] : []),
        ...(nivel >= 14 ? [{ id:'blindsense', name:'Subtle Strikes', source:'Pícaro · Nivel 14', type:'passive', action:'Pasiva', range:'Personal', recharge:null, desc:'Cuando atacás a alguien que tenga al menos un aliado tuyo adyacente, tenés ventaja en la tirada.', fullDesc:'' }] : []),
        ...(nivel >= 15 ? [{ id:'slippery-mind', name:'Slippery Mind', source:'Pícaro · Nivel 15', type:'passive', action:'Pasiva', range:'Personal', recharge:null, desc:'Ganás proficiencia en Wisdom saves. Si ya la tenés, ganás proficiencia en Charisma saves.', fullDesc:'' }] : []),
        ...(nivel >= 16 ? [{ id:'rogue-asi-16', name:'Ability Score Improvement', source:'Pícaro · Nivel 16', type:'passive', action:'Pasiva', range:'Personal', recharge:null, desc:'+2 a un stat o +1 a dos stats.', fullDesc:'' }] : []),
        ...(nivel >= 18 ? [{ id:'elusive', name:'Elusive', source:'Pícaro · Nivel 18', type:'passive', action:'Pasiva', range:'Personal', recharge:null, desc:'Los ataques contra vos nunca tienen ventaja mientras no estés incapacitado.', fullDesc:'' }] : []),
        ...(nivel >= 19 ? [{ id:'rogue-asi-19', name:'Epic Boon', source:'Pícaro · Nivel 19', type:'passive', action:'Pasiva', range:'Personal', recharge:null, desc:'Ganás un Epic Boon feat.', fullDesc:'' }] : []),
        ...(nivel >= 20 ? [{ id:'stroke-of-luck', name:'Stroke of Luck', source:'Pícaro · Nivel 20', type:'active', action:'Ninguna', range:'Personal', recharge:'short', desc:'Convertís un ataque fallido en impacto, o un check fallido en 20. 1 uso/Short Rest.', fullDesc:'' }] : []),
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
      features: (nivel) => [
        { id:'otherworldly-patron', name:'Otherworldly Patron (Subclase)', source:'Brujo · Nivel 1', type:'passive', action:'Pasiva', range:'Personal', recharge:null, desc:'Elegís tu Patrón que otorga poderes y conjuros adicionales.', fullDesc:'' },
        { id:'pact-magic', name:`Pact Magic (nv${nivel>=9?5:nivel>=7?4:nivel>=5?3:nivel>=3?2:1} slot)`, source:'Brujo · Nivel 1', type:'passive', action:'Varía', range:'Varía', recharge:'short', desc:`Lanzás conjuros con slots de nivel ${nivel>=9?5:nivel>=7?4:nivel>=5?3:nivel>=3?2:1} que recargan en Short/Long Rest.`, fullDesc:'' },
        ...(nivel >= 2 ? [{ id:'eldritch-invocations', name:`Eldritch Invocations (${nivel>=17?8:nivel>=15?7:nivel>=12?6:nivel>=9?5:nivel>=7?4:nivel>=5?3:nivel>=3?2:2} opciones)`, source:'Brujo · Nivel 2', type:'passive', action:'Pasiva', range:'Varía', recharge:null, desc:'Poderes especiales que modifican Eldritch Blast u otorgan habilidades únicas.', fullDesc:'' }] : []),
        ...(nivel >= 3 ? [{ id:'pact-boon', name:'Pact Boon', source:'Brujo · Nivel 3', type:'passive', action:'Pasiva', range:'Personal', recharge:null, desc:'Pact of the Blade (arma mágica), Chain (familiar especial) o Tome (libro de conjuros extra).', fullDesc:'' }] : []),
        ...(nivel >= 4 ? [{ id:'warlock-asi-4', name:'Ability Score Improvement', source:'Brujo · Nivel 4', type:'passive', action:'Pasiva', range:'Personal', recharge:null, desc:'+2 a un stat o +1 a dos stats.', fullDesc:'' }] : []),
        ...(nivel >= 5 ? [{ id:'warlock-slots-3', name:'Pact Magic mejora (nv3 slots)', source:'Brujo · Nivel 5', type:'passive', action:'Pasiva', range:'Personal', recharge:null, desc:'Los slots de Pact Magic suben al nivel 3.', fullDesc:'' }] : []),
        ...(nivel >= 8 ? [{ id:'warlock-asi-8', name:'Ability Score Improvement', source:'Brujo · Nivel 8', type:'passive', action:'Pasiva', range:'Personal', recharge:null, desc:'+2 a un stat o +1 a dos stats.', fullDesc:'' }] : []),
        ...(nivel >= 11 ? [{ id:'mystic-arcanum-6', name:'Mystic Arcanum (nv6)', source:'Brujo · Nivel 11', type:'active', action:'Ninguna', range:'Varía', recharge:'long', desc:'Lanzás un conjuro de nivel 6 sin gastar slot (1 vez/Long Rest).', fullDesc:'' }] : []),
        ...(nivel >= 12 ? [{ id:'warlock-asi-12', name:'Ability Score Improvement', source:'Brujo · Nivel 12', type:'passive', action:'Pasiva', range:'Personal', recharge:null, desc:'+2 a un stat o +1 a dos stats.', fullDesc:'' }] : []),
        ...(nivel >= 13 ? [{ id:'mystic-arcanum-7', name:'Mystic Arcanum (nv7)', source:'Brujo · Nivel 13', type:'active', action:'Ninguna', range:'Varía', recharge:'long', desc:'Lanzás un conjuro de nivel 7 sin gastar slot (1 vez/Long Rest).', fullDesc:'' }] : []),
        ...(nivel >= 15 ? [{ id:'mystic-arcanum-8', name:'Mystic Arcanum (nv8)', source:'Brujo · Nivel 15', type:'active', action:'Ninguna', range:'Varía', recharge:'long', desc:'Lanzás un conjuro de nivel 8 sin gastar slot (1 vez/Long Rest).', fullDesc:'' }] : []),
        ...(nivel >= 16 ? [{ id:'warlock-asi-16', name:'Ability Score Improvement', source:'Brujo · Nivel 16', type:'passive', action:'Pasiva', range:'Personal', recharge:null, desc:'+2 a un stat o +1 a dos stats.', fullDesc:'' }] : []),
        ...(nivel >= 17 ? [{ id:'mystic-arcanum-9', name:'Mystic Arcanum (nv9)', source:'Brujo · Nivel 17', type:'active', action:'Ninguna', range:'Varía', recharge:'long', desc:'Lanzás un conjuro de nivel 9 sin gastar slot (1 vez/Long Rest).', fullDesc:'' }] : []),
        ...(nivel >= 19 ? [{ id:'warlock-asi-19', name:'Epic Boon', source:'Brujo · Nivel 19', type:'passive', action:'Pasiva', range:'Personal', recharge:null, desc:'Ganás un Epic Boon feat.', fullDesc:'' }] : []),
        ...(nivel >= 20 ? [{ id:'eldritch-master', name:'Eldritch Master', source:'Brujo · Nivel 20', type:'active', action:'1 minuto', range:'Personal', recharge:'long', desc:'1 vez/Long Rest podés pasar 1 minuto rogándole a tu Patrón para recuperar todos los Pact Magic slots.', fullDesc:'' }] : []),
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
        ...(nivel >= 7 ? [{ id:'bm-know-your-enemy', name:'Know Your Enemy',
          source:'Battle Master · Nv7', type:'passive', action:'Pasiva', range:'Personal', recharge:null,
          desc:'Tras observar 1 min a una criatura, el DM te dice si es superior/inferior/igual a ti en 2 características.',
          fullDesc:'Si pasas al menos 1 minuto observando o interactuando con otra criatura fuera de combate, puedes aprender cierta información sobre sus capacidades comparadas con las tuyas.' }] : []),
        ...(nivel >= 10 ? [{ id:'bm-improved-combat-superiority', name:'Improved Combat Superiority',
          source:`Battle Master · ${nivel>=18?'Nv18':'Nv10'}`, type:'passive', action:'Pasiva', range:'Personal', recharge:null,
          desc:`Tus Superiority Dice son d${nivel>=18?12:10} (mejorado desde d${nivel>=18?10:8}).`,
          fullDesc:'A nivel 10 tus dados de superioridad se convierten en d10. A nivel 18 se convierten en d12.' }] : []),
        ...(nivel >= 15 ? [{ id:'bm-relentless', name:'Relentless',
          source:'Battle Master · Nv15', type:'passive', action:'Pasiva', range:'Personal', recharge:null,
          desc:'Si no te quedan Superiority Dice al tirar iniciativa, recuperas 1.',
          fullDesc:'A partir del nivel 15, cuando tiras iniciativa y no tienes dados de superioridad restantes, recuperas 1 dado de superioridad.' }] : []),
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
      features: (nivel) => [
        { id:'champ-improved-critical', name:'Improved Critical',
          source:'Champion · Nv3', type:'passive', action:'Pasiva', range:'Personal', recharge:null,
          desc:'Tus ataques son críticos con 19-20 (en lugar de solo 20).',
          fullDesc:'Tus tiradas de ataque con armas hacen un golpe crítico con un resultado de 19 o 20 en el dado.' },
        ...(nivel >= 7 ? [{ id:'champ-remarkable-athlete', name:'Remarkable Athlete',
          source:'Champion · Nv7', type:'passive', action:'Pasiva', range:'Personal', recharge:null,
          desc:'Suma la mitad de tu Prof Bonus a checks de FUE/DES/CON sin proficiencia. Salto largo +FUE mod.',
          fullDesc:'Puedes añadir la mitad de tu bonificador de competencia (redondeando hacia arriba) a cualquier tirada de características de Fuerza, Destreza o Constitución que no use tu bonificador de competencia.' }] : []),
        ...(nivel >= 15 ? [{ id:'champ-superior-critical', name:'Superior Critical',
          source:'Champion · Nv15', type:'passive', action:'Pasiva', range:'Personal', recharge:null,
          desc:'Tus ataques son críticos con 18-20.',
          fullDesc:'A nivel 15, tus tiradas de ataque con armas hacen un golpe crítico con un resultado de 18, 19 o 20.' }] : []),
        ...(nivel >= 18 ? [{ id:'champ-survivor', name:'Survivor',
          source:'Champion · Nv18', type:'passive', action:'Pasiva', range:'Personal', recharge:null,
          desc:'Al inicio de tu turno, si tienes entre 1 y la mitad de tu HP máx, recuperas 5 + CON mod HP.',
          fullDesc:'Al inicio de cada uno de tus turnos, recuperas puntos de golpe iguales a 5 + tu modificador de Constitución si no tienes más de la mitad de tus puntos de golpe.' }] : []),
      ],
    },

    'Eldritch Knight': {
      clase: 'Guerrero',
      resources: () => [],
      features: (nivel) => [
        { id:'ek-spellcasting', name:'Spellcasting (INT)',
          source:'Eldritch Knight · Nv3', type:'active', action:'Varía', range:'Varía', recharge:null,
          desc:'Lanzas conjuros de Mago usando INT. Slots de tercio-caster (nivel 3+).',
          fullDesc:'A nivel 3 puedes lanzar conjuros de la lista del Mago. Usas Inteligencia como stat de conjuro.\n\nSlots: Nv3→2 slots nv1 · Nv4→3 · Nv7→4 + 1nv2 · Nv10→4/2/0 · Nv13→4/3 · Nv16→4/3/2 · Nv19→4/3/3/1' },
        ...(nivel >= 7 ? [{ id:'ek-war-magic', name:'War Magic',
          source:'Eldritch Knight · Nv7', type:'active', action:'Acción bonus', range:'Personal', recharge:null,
          desc:'Al lanzar un cantrip, puedes atacar con arma como acción bonus.',
          fullDesc:'Cuando usas tu acción para lanzar un cantrip, puedes hacer un ataque con arma como acción adicional.' }] : []),
        ...(nivel >= 10 ? [{ id:'ek-eldritch-strike', name:'Eldritch Strike',
          source:'Eldritch Knight · Nv10', type:'passive', action:'Pasiva', range:'Personal', recharge:null,
          desc:'Cuando golpeas a un enemigo, desventaja en su save contra tu próximo conjuro.',
          fullDesc:'Cuando golpeas a una criatura con un ataque de arma, esa criatura tiene desventaja en la siguiente tirada de salvación que haga contra un conjuro que lanzas antes del final de tu siguiente turno.' }] : []),
        ...(nivel >= 15 ? [{ id:'ek-arcane-charge', name:'Arcane Charge',
          source:'Eldritch Knight · Nv15', type:'active', action:'Acción libre (Action Surge)', range:'Personal', recharge:null,
          desc:'Cuando usás Action Surge, podés teleportarte hasta 9 m a un lugar que puedas ver.',
          fullDesc:'A nivel 15, cuando usas tu Action Surge puedes teleportarte hasta 9 metros a un espacio desocupado que puedas ver, antes o después de la acción adicional.' }] : []),
      ],
    },

    // ── GUERRERO adicionales ──────────────────────────────────────────────────
    'Samurai': {
      clase: 'Guerrero',
      resources: (nivel) => [
        { id:'fighting-spirit', name:'Fighting Spirit',
          current: 3, max: 3, recharge:'long',
          note:`+${nivel >= 15 ? 10 : 5} HP temp · ventaja en ataques 1 ronda` },
      ],
      features: (nivel) => [
        { id:'sam-bonus-proficiency', name:'Bonus Proficiency',
          source:'Samurai · Nv3', type:'passive', action:'Pasiva', range:'Personal', recharge:null,
          desc:'Ganás proficiencia en Historia, Perspicacia, Actuación o Persuasión.',
          fullDesc:'Cuando eliges este arquetipo al nivel 3, ganas proficiencia en una de estas habilidades: Historia, Perspicacia, Actuación o Persuasión.' },
        { id:'sam-fighting-spirit', name:'Fighting Spirit',
          source:'Samurai · Nv3', type:'active', action:'Acción bonus', range:'Personal', recharge:'Long Rest',
          desc:`3/Long Rest · acción bonus: ventaja en todos los ataques este turno + ${nivel >= 15 ? 10 : 5} HP temporales.`,
          fullDesc:'A partir de nivel 3, la intensidad del combate te potencia. Como acción adicional puedes darte ventaja en todas las tiradas de ataque con arma hasta el final del turno. Cuando haces esto, también ganas puntos de golpe temporales (5 a nivel 3, 10 a nivel 15). Puedes usar esta habilidad tres veces. Recuperas todos los usos después de un descanso largo.' },
        ...(nivel >= 7 ? [{ id:'sam-elegant-courtier', name:'Elegant Courtier',
          source:'Samurai · Nv7', type:'passive', action:'Pasiva', range:'Personal', recharge:null,
          desc:'Sumás SAB mod a saves de SAB. Proficiencia en Persuasión (ya contada).',
          fullDesc:'Tu entrenamiento y disciplina te han refinado. Puedes añadir tu modificador de Sabiduría a cualquier tirada de salvación de Sabiduría que hagas que no use ya tu modificador de Sabiduría. Además, ganas proficiencia en Persuasión si no la tenías.' }] : []),
        ...(nivel >= 10 ? [{ id:'sam-tireless-spirit', name:'Tireless Spirit',
          source:'Samurai · Nv10', type:'passive', action:'Pasiva', range:'Personal', recharge:null,
          desc:'Si tirás iniciativa sin usos de Fighting Spirit, recuperás 1 uso.',
          fullDesc:'A partir del nivel 10, cuando tiras iniciativa y no te quedan usos de Fighting Spirit, recuperas 1 uso.' }] : []),
        ...(nivel >= 15 ? [{ id:'sam-rapid-strike', name:'Rapid Strike',
          source:'Samurai · Nv15', type:'active', action:'Ninguna (en tu turno)', range:'Melee', recharge:null,
          desc:'Cambiás ventaja en un ataque por un ataque extra (sin acción).',
          fullDesc:'Aprendes a intercambiar precisión por velocidad de ataque. Si tienes ventaja en una tirada de ataque con arma durante tu turno, puedes renunciar a esa ventaja para hacer un ataque adicional con esa arma como parte de la misma acción. No puedes usar esta característica más de una vez por turno.' }] : []),
        ...(nivel >= 18 ? [{ id:'sam-strength-before-death', name:'Strength Before Death',
          source:'Samurai · Nv18', type:'active', action:'Reacción', range:'Personal', recharge:'Long Rest',
          desc:'1/Long Rest: si caés a 0 HP, hacés un turno extra inmediato antes de caer inconsciente.',
          fullDesc:'Tu espíritu de guerrero puede retener brevemente el velo de la muerte. Si caes a 0 puntos de golpe y no mueres directamente, puedes retrasar el caer inconsciente. Inmediatamente después del ataque o efecto que te redujo a 0 puntos de golpe, tomas un turno especial adicional. Mientras dura ese turno, otros no pueden caer inconscientes o morir por daño, y tú eres inmune a efectos que te incapaciten. Después de ese turno, caes inconsciente. Una vez usas esta habilidad, no puedes volver a usarla hasta terminar un descanso largo.' }] : []),
      ],
    },

    'Rune Knight': {
      clase: 'Guerrero',
      resources: (nivel) => [
        { id:'giant-might', name:'Giant\'s Might',
          current: nivel >= 15 ? 2 : 1, max: nivel >= 15 ? 2 : 1, recharge:'long',
          note:`Grande (Large) · +${nivel >= 18 ? Math.ceil(nivel/4)*2 : nivel >= 10 ? '1d8':'1d6'} daño · ventaja FUE/CON` },
      ],
      features: (nivel) => [
        { id:'rk-rune-shaping', name:'Rune Carver',
          source:'Rune Knight · Nv3', type:'passive', action:'Pasiva', range:'Personal', recharge:null,
          desc:`Podés tallar ${nivel >= 7 ? nivel >= 10 ? nivel >= 15 ? 5 : 4 : 3 : 2} runas en armas/armadura/ropa. Cada runa tiene un efecto pasivo y uno activo.`,
          fullDesc:'Puedes usar un descanso largo para tallar runas mágicas en armas, armaduras o prendas de vestir. El número de runas que puedes conocer y tallar aumenta: 2 a nivel 3, 3 a nivel 7, 4 a nivel 10, 5 a nivel 15.' },
        { id:'rk-giants-might', name:"Giant's Might",
          source:'Rune Knight · Nv3', type:'active', action:'Acción bonus', range:'Personal', recharge:'Long Rest',
          desc:`${nivel >= 15 ? 2 : 1}/Long Rest · crecés a tamaño Large · ventaja en FUE · +1d${nivel >= 18 ? 10 : nivel >= 10 ? 8 : 6} daño durante 1 min.`,
          fullDesc:'Como acción adicional, puedes invocar el poder de los gigantes para crecer de tamaño. Durante 1 minuto, tienes tamaño Grande (si el espacio lo permite), ventaja en las tiradas de Fuerza y ganas un dado de daño extra en ataques con arma.' },
        ...(nivel >= 7 ? [{ id:'rk-runic-shield', name:'Runic Shield',
          source:'Rune Knight · Nv7', type:'active', action:'Reacción', range:'18 m', recharge:null,
          desc:'Cuando un aliado que podés ver es golpeado, forzás al atacante a tirar de nuevo.',
          fullDesc:'A nivel 7, aprendes a invocar runas para proteger a tus aliados. Cuando una criatura que puedas ver golpea a otra criatura a 18 metros de ti con una tirada de ataque, puedes usar tu reacción para invocar tu escudo rúnico. El atacante debe tirar de nuevo la tirada de ataque y usar el resultado más bajo.' }] : []),
        ...(nivel >= 10 ? [{ id:'rk-great-stature', name:'Great Stature',
          source:'Rune Knight · Nv10', type:'passive', action:'Pasiva', range:'Personal', recharge:null,
          desc:'Crecés permanentemente 3-12 cm. Tus ataques con Giant\'s Might hacen +1d8 en lugar de +1d6.',
          fullDesc:'A nivel 10, las runas que tallaste en ti han ampliado tu forma. Tu altura aumenta entre 3 y 12 cm (tira 1d4 × 2.5 cm). Además, el dado de daño extra otorgado por Giant\'s Might aumenta a 1d8.' }] : []),
        ...(nivel >= 15 ? [{ id:'rk-runic-juggernaut', name:'Runic Juggernaut',
          source:'Rune Knight · Nv15', type:'passive', action:'Pasiva', range:'Personal', recharge:null,
          desc:'Giant\'s Might: podés crecer a tamaño Huge. Dado de daño extra aumenta a 1d10. Tirada 2/Long Rest.',
          fullDesc:'A nivel 15, aprendes a amplificar tus runas para crecer aún más. Cuando usas Giant\'s Might, puedes elegir crecer a tamaño Enorme (si el espacio lo permite). El dado de daño extra también aumenta a 1d10.' }] : []),
        ...(nivel >= 18 ? [{ id:'rk-master-of-runes', name:'Master of Runes',
          source:'Rune Knight · Nv18', type:'passive', action:'Pasiva', range:'Personal', recharge:null,
          desc:'Podés invocar los efectos de cada runa dos veces por descanso corto/largo (antes 1 vez).',
          fullDesc:'A nivel 18, puedes invocar los efectos de tus runas dos veces por cada descanso corto o largo, en lugar de una vez.' }] : []),
      ],
    },

    // ── EXPLORADOR ────────────────────────────────────────────────────────────
    'Hunter': {
      clase: 'Explorador',
      resources: () => [],
      features: (nivel) => [
        { id:'hunter-prey', name:'Hunter\'s Prey',
          source:'Hunter · Nv3', type:'passive', action:'Pasiva', range:'Personal', recharge:null,
          desc:'Elegís una presa: Colossus Slayer (+1d8 si herido), Giant Killer (reacción al fallar), o Horde Breaker (atacar criatura extra adyacente).',
          fullDesc:'Al nivel 3 ganas una de estas ventajas:\n\n• Colossus Slayer: cuando golpeas a una criatura que ya está herida, haces +1d8 de daño adicional (1/turno).\n• Giant Killer: cuando una criatura de tamaño Grande+ adyacente a ti falla un ataque, puedes usar tu reacción para atacarla.\n• Horde Breaker: una vez por turno, cuando hagas un ataque, puedes hacer otro ataque sin coste de acción contra una criatura diferente dentro de alcance y adyacente al objetivo original.' },
        ...(nivel >= 7 ? [{ id:'hunter-defensive', name:'Defensive Tactics',
          source:'Hunter · Nv7', type:'passive', action:'Pasiva', range:'Personal', recharge:null,
          desc:'Elegís: Escape the Horde (sin ataques de oportunidad en Disengage), Multiattack Defense (+4 CA contra misma criatura que ya atacó), o Steel Will (ventaja en saves contra Miedo).',
          fullDesc:'A nivel 7 ganas una de estas tácticas defensivas:\n\n• Escape the Horde: los ataques de oportunidad contra ti tienen desventaja.\n• Multiattack Defense: si una criatura te golpea, ganas +4 CA contra todos sus ataques posteriores en ese turno.\n• Steel Will: ventaja en tiradas de salvación para no ser Asustado.' }] : []),
        ...(nivel >= 11 ? [{ id:'hunter-multiattack', name:'Multiattack',
          source:'Hunter · Nv11', type:'active', action:'Acción', range:'Varía', recharge:null,
          desc:'Elegís: Volley (ataques a distancia en área 10ft radio) o Whirlwind Attack (ataques melee a todas criaturas adyacentes).',
          fullDesc:'A nivel 11 ganas una de estas versiones de Multiattack:\n\n• Volley: puedes usar tu acción para disparar a cualquier número de criaturas dentro de un radio de 3 metros a un punto elegido dentro de tu alcance. Cada criatura debe superar un save de DES o recibir el daño de uno de tus ataques normales.\n• Whirlwind Attack: puedes usar tu acción para hacer un ataque cuerpo a cuerpo contra cualquier número de criaturas dentro de tu alcance, con una tirada de ataque separada para cada una.' }] : []),
        ...(nivel >= 15 ? [{ id:'hunter-superior-defense', name:'Superior Hunter\'s Defense',
          source:'Hunter · Nv15', type:'passive', action:'Pasiva', range:'Personal', recharge:null,
          desc:'Elegís: Evasion (sin daño en saves de DES exitosos), Stand Against the Tide (enemigo falla save FUE → ataca a otro), o Uncanny Dodge (reacción para reducir daño a la mitad).',
          fullDesc:'A nivel 15 ganas una de estas defensas superiores:\n\n• Evasion: cuando haces una tirada de salvación de Destreza exitosa para evitar daño, no recibes daño (y la mitad si fallas).\n• Stand Against the Tide: cuando un enemigo falla un ataque contra ti, puedes usar tu reacción para forzarlo a atacar a otra criatura de tu elección.\n• Uncanny Dodge: cuando un atacante visible te golpea, usas tu reacción para reducir el daño a la mitad.' }] : []),
      ],
    },

    'Beast Master': {
      clase: 'Explorador',
      resources: () => [],
      features: (nivel) => [
        { id:'bm-ranger-companion', name:'Ranger\'s Companion',
          source:'Beast Master · Nv3', type:'passive', action:'Pasiva', range:'Personal', recharge:null,
          desc:'Tenés una bestia compañera que actúa en tu iniciativa. Puede atacar usando tu acción bonus.',
          fullDesc:'A nivel 3 ganas la servicio de una bestia. Elige un animal CR ≤ 1/4 con velocidad de vuelo, o CR ≤ 1/2 sin ella. Añade tu Prof Bonus a sus tiradas de ataque, daño, saves y percepción. La bestia actúa en tu turno. Puedes usar tu acción bonus para ordenarle que ataque.' },
        ...(nivel >= 7 ? [{ id:'bm-exceptional-training', name:'Exceptional Training',
          source:'Beast Master · Nv7', type:'active', action:'Acción bonus', range:'Personal', recharge:null,
          desc:'Como bonus action, puedes ordenarle a tu compañero que haga Dash, Disengage, Dodge o Help.',
          fullDesc:'A nivel 7, en cualquiera de tus turnos cuando tu compañero no ataque, puedes usar una acción adicional para ordenarle que haga la acción Dash, Disengage, Dodge o Help. Además los ataques de tu compañero ahora cuentan como mágicos.' }] : []),
        ...(nivel >= 11 ? [{ id:'bm-bestial-fury', name:'Bestial Fury',
          source:'Beast Master · Nv11', type:'passive', action:'Pasiva', range:'Personal', recharge:null,
          desc:'Tu compañero puede hacer dos ataques cuando vos usás tu acción para ordenarle que ataque.',
          fullDesc:'A nivel 11, tu compañero puede atacar dos veces cuando usas tu acción para ordenarle que realice el ataque de la acción Atacar.' }] : []),
        ...(nivel >= 15 ? [{ id:'bm-share-spells', name:'Share Spells',
          source:'Beast Master · Nv15', type:'passive', action:'Pasiva', range:'Personal', recharge:null,
          desc:'Cuando te lanzás un conjuro a vos mismo, puede afectar también a tu compañero si está a 9 m.',
          fullDesc:'A nivel 15, cuando lanzas un conjuro que solo te afecta a ti, puedes hacer que también afecte a tu compañero bestial si está a 9 metros.' }] : []),
      ],
    },

    'Gloom Stalker': {
      clase: 'Explorador',
      subclassSpells: (nivel) => [
        { id:'gs-disguise-self',  name:'Disguise Self ◆',      level:1, castTime:'Acción',       range:'Uno mismo', duration:'1 h',     concentration:false, combat:false, domain:true, desc:'Cambia apariencia visual. Siempre preparado.' },
        ...(nivel >= 5 ? [{ id:'gs-rope-trick',   name:'Rope Trick ◆',          level:2, castTime:'Acción',       range:'Toque', duration:'1 h',         concentration:false, combat:false, domain:true, desc:'Espacio extradimensional en extremo de cuerda. Siempre preparado.' }] : []),
        ...(nivel >= 9 ? [{ id:'gs-fear',         name:'Fear ◆',                level:3, castTime:'Acción',       range:'Cono 9m', duration:'Conc. 1 min', concentration:true, combat:true, domain:true, desc:'Save SAB o asustado + huye. Siempre preparado.' }] : []),
        ...(nivel >= 13 ? [{ id:'gs-greater-invis',name:'Greater Invisibility ◆', level:4, castTime:'Acción',    range:'Toque', duration:'Conc. 1 min',   concentration:true, combat:true, domain:true, desc:'Invisible incluso al atacar o lanzar. Siempre preparado.' }] : []),
        ...(nivel >= 17 ? [{ id:'gs-seeming',     name:'Seeming ◆',              level:5, castTime:'Acción',      range:'9 m',   duration:'8 h',           concentration:false, combat:false, domain:true, desc:'Hasta 6 criaturas cambian apariencia. Siempre preparado.' }] : []),
      ],
      resources: (nivel) => [
        { id:'dread-ambusher', name:'Dread Ambusher',
          current: 1, max: 1, recharge:'long',
          note:'Primeras 2 rondas de combate: velocidad +3m, ataque extra +1d8 daño' },
      ],
      features: (nivel) => [
        { id:'gs-umbral-sight', name:'Umbral Sight',
          source:'Gloom Stalker · Nv3', type:'passive', action:'Pasiva', range:'Personal', recharge:null,
          desc:'Visión en oscuridad total (no requiere Darkvision). Criaturas con Darkvision no pueden verte en oscuridad.',
          fullDesc:'A nivel 3 adquieres visión en la oscuridad total hasta 18 metros. Si ya tienes Darkvision, su alcance aumenta 18 metros. Las criaturas con Darkvision no tienen ventaja especial para detectarte en oscuridad.' },
        { id:'gs-dread-ambusher', name:'Dread Ambusher',
          source:'Gloom Stalker · Nv3', type:'active', action:'Iniciativa', range:'Personal', recharge:'Long Rest',
          desc:'Primeras 2 rondas de combate: velocidad +3 m. En la primera ronda: 1 ataque extra que hace +1d8 daño.',
          fullDesc:'A nivel 3 dominas las emboscadas. En la primera ronda de cada combate tu velocidad aumenta 3 metros. Si atacas antes de que tu objetivo tome su primer turno: un ataque extra que hace 1d8 de daño adicional. A partir de nivel 11 también puedes aturdir a la criatura.' },
        ...(nivel >= 7 ? [{ id:'gs-iron-mind', name:'Iron Mind',
          source:'Gloom Stalker · Nv7', type:'passive', action:'Pasiva', range:'Personal', recharge:null,
          desc:'Proficiencia en saves de SAB. Si ya la tenés, en saves de INT o CAR.',
          fullDesc:'A nivel 7 has aprendido a armarte contra efectos mentales. Ganas proficiencia en las tiradas de salvación de Sabiduría. Si ya tienes esa proficiencia, ganas proficiencia en tiradas de salvación de Inteligencia o Carisma (tu elección).' }] : []),
        ...(nivel >= 11 ? [{ id:'gs-stalkers-flurry', name:'Stalker\'s Flurry',
          source:'Gloom Stalker · Nv11', type:'passive', action:'Pasiva', range:'Personal', recharge:null,
          desc:'Una vez por turno, si fallás un ataque, podés hacer otro ataque inmediatamente.',
          fullDesc:'A nivel 11 aprendes a atacar con rapidez despiadada. Una vez en cada uno de tus turnos cuando falles un ataque con arma, puedes hacer otro ataque con arma como parte de la misma acción.' }] : []),
        ...(nivel >= 15 ? [{ id:'gs-shadowy-dodge', name:'Shadowy Dodge',
          source:'Gloom Stalker · Nv15', type:'active', action:'Reacción', range:'Personal', recharge:null,
          desc:'Cuando alguien te ataca: podés usar reacción para imponerle desventaja en esa tirada.',
          fullDesc:'A nivel 15, puedes usar tu reacción para esquivar más eficazmente. Cuando una criatura hace una tirada de ataque contra ti y aún no puedes verla, puedes usar tu reacción para imponer desventaja en esa tirada.' }] : []),
      ],
    },

    // ── BARDO ─────────────────────────────────────────────────────────────────
    'College of Lore': {
      clase: 'Bardo',
      resources: () => [],
      features: (nivel) => [
        { id:'lore-bonus-proficiencies', name:'Bonus Proficiencies',
          source:'College of Lore · Nv3', type:'passive', action:'Pasiva', range:'Personal', recharge:null,
          desc:'Ganás proficiencia en 3 habilidades de tu elección.',
          fullDesc:'Al nivel 3, ganás proficiencia en tres habilidades de tu elección.' },
        { id:'lore-cutting-words', name:'Cutting Words',
          source:'College of Lore · Nv3', type:'active', action:'Reacción (1 Bardic Inspiration)', range:'18 m', recharge:'Short/Long Rest',
          desc:'Gastás 1 Bardic Inspiration: cuando una criatura a 18 m hace una tirada de ataque, check de habilidad o de daño, le restás 1d6 (+ el tipo de dado que corresponda al nivel).',
          fullDesc:'Al nivel 3, aprendés a usar tu ingenio para distraer, confundir y socavar la confianza de los demás. Cuando una criatura que puedes ver a 18 metros hace una tirada de ataque, check de habilidad o tirada de daño, puedes usar tu reacción para gastar uno de tus dados de Bardic Inspiration, tirar el dado y restarlo del resultado de la criatura.' },
        ...(nivel >= 6 ? [{ id:'lore-additional-magical-secrets', name:'Additional Magical Secrets',
          source:'College of Lore · Nv6', type:'passive', action:'Pasiva', range:'Personal', recharge:null,
          desc:'Aprendés 2 conjuros de cualquier clase (no solo bardo). Cuentan como conjuros de bardo para vos.',
          fullDesc:'Al nivel 6, has robado conocimiento mágico de una amplia gama de disciplinas. Eliges dos conjuros de cualquier clase. Un conjuro elegido debe ser de un nivel que puedas lanzar. Los conjuros elegidos cuentan como conjuros de bardo para vos, pero no cuentan para el número de conjuros de bardo que conocés.' }] : []),
        ...(nivel >= 14 ? [{ id:'lore-peerless-skill', name:'Peerless Skill',
          source:'College of Lore · Nv14', type:'active', action:'Ninguna (al hacer check)', range:'Personal', recharge:null,
          desc:'Cuando hacés un check de habilidad y te falta, podés gastar 1 Bardic Inspiration y agregar el dado al resultado.',
          fullDesc:'Al nivel 14, cuando hacés un check de habilidad, podés gastar un dado de Bardic Inspiration. Tirá el dado y agregá el resultado al check. Podés elegir usar esta feature después de hacer la tirada inicial pero antes de que el DM diga si resultó exitosa.' }] : []),
      ],
    },

    'College of Valor': {
      clase: 'Bardo',
      resources: () => [],
      features: (nivel) => [
        { id:'valor-bonus-proficiencies', name:'Bonus Proficiencies',
          source:'College of Valor · Nv3', type:'passive', action:'Pasiva', range:'Personal', recharge:null,
          desc:'Ganás proficiencia con armadura mediana, escudos y armas marciales.',
          fullDesc:'Al nivel 3, ganás proficiencia con armadura mediana, escudos y armas marciales.' },
        { id:'valor-combat-inspiration', name:'Combat Inspiration',
          source:'College of Valor · Nv3', type:'passive', action:'Pasiva', range:'Personal', recharge:null,
          desc:'Tus dados de Bardic Inspiration también pueden usarse para agregar al daño de un ataque o a la CA contra un ataque (reacción).',
          fullDesc:'Al nivel 3, aprendés a inspirar a otros para luchar más eficazmente. Una criatura que tiene un dado de Bardic Inspiration tuyo puede usar ese dado de dos maneras adicionales: cuando hace una tirada de daño con arma, puede gastar el dado y agregar el resultado; o cuando es atacada, puede usar su reacción para gastar el dado y agregarlo a su CA contra ese ataque.' },
        ...(nivel >= 6 ? [{ id:'valor-extra-attack', name:'Extra Attack',
          source:'College of Valor · Nv6', type:'passive', action:'Pasiva', range:'Personal', recharge:null,
          desc:'Podés atacar dos veces en lugar de una cuando usás la acción de Ataque.',
          fullDesc:'Al nivel 6, puedes atacar dos veces en lugar de una cuando tomas la acción de Ataque en tu turno.' }] : []),
        ...(nivel >= 14 ? [{ id:'valor-battle-magic', name:'Battle Magic',
          source:'College of Valor · Nv14', type:'passive', action:'Pasiva', range:'Personal', recharge:null,
          desc:'Cuando usás tu acción para lanzar un conjuro de bardo, podés hacer un ataque con arma como acción bonus.',
          fullDesc:'Al nivel 14, has dominado el arte de mezclar conjuros y combate físico. Cuando usas tu acción para lanzar cualquier conjuro de bardo, puedes hacer un ataque con arma como acción adicional.' }] : []),
      ],
    },

    'College of Eloquence': {
      clase: 'Bardo',
      resources: () => [],
      features: (nivel) => [
        { id:'elo-silver-tongue', name:'Silver Tongue',
          source:'College of Eloquence · Nv3', type:'passive', action:'Pasiva', range:'Personal', recharge:null,
          desc:'Cuando hacés un check de Persuasión o Engaño, un resultado de 9 o menos en el dado cuenta como 10.',
          fullDesc:'Al nivel 3, eres un maestro del lenguaje. Cuando haces un check de Persuasión o Engaño, un resultado de 9 o menos en el dado d20 cuenta como 10.' },
        { id:'elo-unsettling-words', name:'Unsettling Words',
          source:'College of Eloquence · Nv3', type:'active', action:'Acción bonus (1 Bardic Inspiration)', range:'18 m', recharge:null,
          desc:'Gastás 1 Bardic Inspiration: la criatura objetivo resta el dado de su próximo saving throw antes del final de tu próximo turno.',
          fullDesc:'Al nivel 3, puedes tejer magia en tus palabras para desestabilizar a un objetivo. Como acción adicional, eliges una criatura que puedas ver a 18 metros y gastas uno de tus dados de Bardic Inspiration. Tirá el dado. La criatura debe restar el resultado de su próximo saving throw antes del final de tu próximo turno.' },
        ...(nivel >= 6 ? [{ id:'elo-unfailing-inspiration', name:'Unfailing Inspiration',
          source:'College of Eloquence · Nv6', type:'passive', action:'Pasiva', range:'Personal', recharge:null,
          desc:'Cuando una criatura usa tu Bardic Inspiration y falla la tirada, no pierde el dado de Inspiración.',
          fullDesc:'Al nivel 6, tus palabras inspiradoras son tan poderosas que los demás se sienten impulsados incluso si fallan. Cuando una criatura usa tu dado de Bardic Inspiration y falla la tirada (de ataque, check o save), no gasta el dado.' }] : []),
        ...(nivel >= 6 ? [{ id:'elo-universal-speech', name:'Universal Speech',
          source:'College of Eloquence · Nv6', type:'active', action:'Acción', range:'18 m', recharge:'Long Rest',
          desc:'Podés hacer que hasta CAR mod criaturas te entiendan (aunque no hablen tu idioma) durante 1 hora.',
          fullDesc:'Al nivel 6, aprendes a comunicarte con cualquier criatura. Como acción, eliges hasta un número de criaturas igual a tu modificador de Carisma (mínimo 1) a 18 metros que puedan verte. Durante 1 hora, pueden entenderte sin importar el idioma que hables, aunque no puedan responderte.' }] : []),
        ...(nivel >= 14 ? [{ id:'elo-infectious-inspiration', name:'Infectious Inspiration',
          source:'College of Eloquence · Nv14', type:'active', action:'Reacción', range:'18 m', recharge:null,
          desc:'Cuando una criatura usa con éxito tu Bardic Inspiration, podés usar reacción para dar otro dado a otra criatura a 18 m sin gastar usos adicionales.',
          fullDesc:'Al nivel 14, cuando una criatura usa exitosamente un dado de Bardic Inspiration tuyo, puedes usar tu reacción para otorgar un dado de Bardic Inspiration a otra criatura diferente a 18 metros que puedas ver. Esta otorgación no gasta uno de tus usos de Bardic Inspiration. Podés usarlo CAR mod veces por Long Rest.' }] : []),
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
      subclassSpells: () => [
        { id:'heroism',        name:'Heroism ◆',             level:1, castTime:'Acción',       range:'Toque',  duration:'Conc. 1 min', concentration:true,  combat:true,  domain:true, desc:'Inmune a Asustado + HP temp = SAB mod/turno. Siempre preparado.' },
        { id:'sanctuary',      name:'Sanctuary ◆',           level:1, castTime:'Acción bonus', range:'9 m',    duration:'1 min',       concentration:false, combat:false, domain:true, desc:'Criaturas hostiles deben superar save SAB para atacar al objetivo. Siempre preparado.' },
        { id:'aid',            name:'Aid ◆',                 level:2, castTime:'Acción',       range:'9 m',    duration:'8 h',         concentration:false, combat:false, domain:true, desc:'Hasta 3 criaturas +5 HP máximos y actuales. Siempre preparado.' },
        { id:'warding-bond',   name:'Warding Bond ◆',        level:2, castTime:'Acción',       range:'Toque',  duration:'Conc. 1 h',   concentration:true,  combat:false, domain:true, desc:'+1 CA, +1 saves, resist al daño. Receptor recibe mitad del daño que vos. Siempre preparado.' },
        { id:'beacon-of-hope', name:'Beacon of Hope ◆',      level:3, castTime:'Acción',       range:'9 m',    duration:'Conc. 1 min', concentration:true,  combat:false, domain:true, desc:'Ventaja en SAB saves y saves de muerte + máximo en dados de curación. Siempre preparado.' },
        { id:'slow',           name:'Slow ◆',                level:3, castTime:'Acción',       range:'36 m',   duration:'Conc. 1 min', concentration:true,  combat:true,  domain:true, desc:'Hasta 6 criaturas · save SAB · vel÷2, -2 CA/DES saves, 1 acción/turno. Siempre preparado.' },
        { id:'aura-of-purity', name:'Aura of Purity ◆',      level:4, castTime:'Acción',       range:'9 m',    duration:'Conc. 10 min',concentration:true,  combat:false, domain:true, desc:'Vos y aliados: inmunes a enfermedades + ventaja en saves de múltiples condiciones. Siempre preparado.' },
        { id:'otiluke-sphere',  name:"Otiluke's Resilient Sphere ◆", level:4, castTime:'Acción',range:'9 m',   duration:'Conc. 1 min', concentration:true,  combat:true,  domain:true, desc:'Esfera impenetrable alrededor de criatura · save DES. Inmune al daño y fuerza aérea. Siempre preparado.' },
        { id:'greater-restoration', name:'Greater Restoration ◆', level:5, castTime:'Acción',  range:'Toque',  duration:'Inst.',       concentration:false, combat:false, domain:true, desc:'Reduce agotamiento, elimina encantamiento/maldición/petrificación, restaura HP max. Siempre preparado.' },
        { id:'rary-telepathic-bond', name:"Rary's Telepathic Bond ◆", level:5, castTime:'Acción',range:'9 m', duration:'1 h',         concentration:false, combat:false, domain:true, desc:'Hasta 8 criaturas se comunican telepáticamente sin concentración. Siempre preparado.' },
      ],
      features: () => [],
    },

    'Life Domain': {
      clase: 'Clérigo',
      subclassSpells: () => [
        { id:'ld-bless',        name:'Bless ◆',              level:1, castTime:'Acción',       range:'9 m',   duration:'Conc. 1 min', concentration:true,  combat:true,  domain:true, desc:'Hasta 3 criaturas +1d4 en ataques y saves. Siempre preparado.' },
        { id:'ld-cure-wounds',  name:'Cure Wounds ◆',        level:1, castTime:'Acción',       range:'Toque', duration:'Inst.',       concentration:false, combat:false, domain:true, desc:'1d8+SAB mod HP curados. Siempre preparado.' },
        { id:'ld-lesser-rest',  name:'Lesser Restoration ◆', level:2, castTime:'Acción',       range:'Toque', duration:'Inst.',       concentration:false, combat:false, domain:true, desc:'Elimina enfermedad o condición (cegado, sordo, paralizado, envenenado). Siempre preparado.' },
        { id:'ld-spiritual-weapon', name:'Spiritual Weapon ◆', level:2, castTime:'Acción bonus',range:'18 m', duration:'1 min',       concentration:false, combat:true,  domain:true, desc:'Arma espectral: ataque con acción bonus, 1d8+SAB daño. Siempre preparado.' },
        { id:'ld-beacon-hope',  name:'Beacon of Hope ◆',     level:3, castTime:'Acción',       range:'9 m',   duration:'Conc. 1 min', concentration:true,  combat:false, domain:true, desc:'Ventaja en SAB saves y de muerte + máximo en curación. Siempre preparado.' },
        { id:'ld-revivify',     name:'Revivify ◆',           level:3, castTime:'Acción',       range:'Toque', duration:'Inst.',       concentration:false, combat:true,  domain:true, desc:'Revive criatura muerta hace ≤1 min con 1 HP. Siempre preparado.' },
        { id:'ld-death-ward',   name:'Death Ward ◆',         level:4, castTime:'Acción',       range:'Toque', duration:'8 h',         concentration:false, combat:false, domain:true, desc:'Criatura sobrevive 1 vez a muerte cayendo a 1 HP en su lugar. Siempre preparado.' },
        { id:'ld-guardian-faith',name:'Guardian of Faith ◆', level:4, castTime:'Acción',       range:'9 m',   duration:'8 h',         concentration:false, combat:true,  domain:true, desc:'Guardián espectral: 20 radiante a hostilas en 3m (save DES mitad). Siempre preparado.' },
        { id:'ld-mass-cure',    name:'Mass Cure Wounds ◆',   level:5, castTime:'Acción',       range:'18 m',  duration:'Inst.',       concentration:false, combat:false, domain:true, desc:'Hasta 6 criaturas en 9m radio curan 3d8+SAB. Siempre preparado.' },
        { id:'ld-raise-dead',   name:'Raise Dead ◆',         level:5, castTime:'1 h',          range:'Toque', duration:'Inst.',       concentration:false, combat:false, domain:true, desc:'Revive muerto hace ≤10 días (sin veneno ni tiempo). Siempre preparado.' },
      ],
      resources: (nivel) => [
        { id:'channel-divinity-life', name:'Channel Divinity',
          current: nivel >= 18 ? 3 : nivel >= 6 ? 2 : 1,
          max:     nivel >= 18 ? 3 : nivel >= 6 ? 2 : 1,
          recharge:'short',
          note:'Preserve Life · Turn Undead' },
      ],
      features: (nivel) => [
        { id:'life-disciple', name:'Disciple of Life',
          source:'Life Domain · Nv1', type:'passive', action:'Pasiva', range:'Personal', recharge:null,
          desc:'Cuando lanzás un conjuro de curación de nivel 1+, el objetivo recupera HP extra iguales a 2 + el nivel del slot.',
          fullDesc:'A nivel 1, tus conjuros de curación son más efectivos. Cuando usas un conjuro de nivel 1 o mayor para restaurar HP a una criatura, esta recupera HP adicionales iguales a 2 + el nivel del espacio de conjuro utilizado.' },
        { id:'life-bonus-proficiency', name:'Bonus Proficiency (Armadura Pesada)',
          source:'Life Domain · Nv1', type:'passive', action:'Pasiva', range:'Personal', recharge:null,
          desc:'Ganás proficiencia con armadura pesada.',
          fullDesc:'A nivel 1 cuando elegís este dominio, ganás proficiencia con armaduras pesadas.' },
        { id:'life-preserve-life', name:'Preserve Life',
          source:'Life Domain · Nv2', type:'active', action:'Acción', range:'9 m', recharge:'Short/Long Rest',
          desc:'Canal: distribuís hasta 5×nivel HP de curación entre criaturas a 9 m (máx mitad de HP máximo por criatura).',
          fullDesc:'A nivel 2, puedes usar tu Channel Divinity para sanar a los gravemente heridos. Como acción, presentas tu símbolo sagrado y evocas energía curativa que puede restaurar puntos de golpe iguales a cinco veces tu nivel de clérigo. Elegís las criaturas vivientes a 9 metros, distribuyendo esos HP entre ellas. No puedes restaurar más de la mitad del máximo de HP de una criatura con esta feature.' },
        ...(nivel >= 6 ? [{ id:'life-blessed-healer', name:'Blessed Healer',
          source:'Life Domain · Nv6', type:'passive', action:'Pasiva', range:'Personal', recharge:null,
          desc:'Cuando lanzás un conjuro de curación en otro, vos también recuperás 2 + nivel del slot HP.',
          fullDesc:'A nivel 6, los conjuros de curación que lanzas en otros también te curan a vos. Cuando lanzas un conjuro de nivel 1 o mayor que restaura HP a una criatura distinta a vos, recuperas HP iguales a 2 + el nivel del slot utilizado.' }] : []),
        ...(nivel >= 8 ? [{ id:'life-divine-strike', name:'Divine Strike',
          source:'Life Domain · Nv8', type:'passive', action:'Pasiva', range:'Melee', recharge:null,
          desc:`1/turno: +${nivel >= 14 ? '2d8' : '1d8'} daño radiante en un ataque con arma.`,
          fullDesc:'A nivel 8, ganas la capacidad de infundir tus ataques con energía divina. Una vez por turno, cuando golpeas a una criatura con un ataque con arma, puedes causar daño radiante adicional de 1d8. A nivel 14, el daño extra aumenta a 2d8.' }] : []),
        ...(nivel >= 17 ? [{ id:'life-supreme-healing', name:'Supreme Healing',
          source:'Life Domain · Nv17', type:'passive', action:'Pasiva', range:'Personal', recharge:null,
          desc:'Cuando tirás dados para curar, usás el valor máximo posible en lugar de tirar.',
          fullDesc:'A nivel 17, cuando normalmente tirarías uno o más dados para restaurar HP con un conjuro, en cambio usas el número más alto posible para cada dado.' }] : []),
      ],
    },

    'Light Domain': {
      clase: 'Clérigo',
      subclassSpells: () => [
        { id:'ltd-burning-hands', name:'Burning Hands ◆',     level:1, castTime:'Acción',       range:'Cono 4,5m', duration:'Inst.',      concentration:false, combat:true,  domain:true, desc:'Save DES · 3d6 fuego. +1d6 por nivel. Siempre preparado.' },
        { id:'ltd-faerie-fire',   name:'Faerie Fire ◆',       level:1, castTime:'Acción',       range:'18 m',  duration:'Conc. 1 min', concentration:true,  combat:true,  domain:true, desc:'Objetos/criaturas en cubo 6m brillan · ataques con ventaja vs ellos. Siempre preparado.' },
        { id:'ltd-flaming-sphere',name:'Flaming Sphere ◆',   level:2, castTime:'Acción',       range:'18 m',  duration:'Conc. 1 min', concentration:true,  combat:true,  domain:true, desc:'Esfera de fuego 1,5m · 2d6 fuego (save DES). Siempre preparado.' },
        { id:'ltd-scorching-ray', name:'Scorching Ray ◆',    level:2, castTime:'Acción',       range:'36 m',  duration:'Inst.',       concentration:false, combat:true,  domain:true, desc:'3 ataques a distancia · 2d6 fuego c/u. +1 rayo por nivel. Siempre preparado.' },
        { id:'ltd-daylight',      name:'Daylight ◆',          level:3, castTime:'Acción',       range:'18 m',  duration:'1 h',         concentration:false, combat:false, domain:true, desc:'Esfera luz brillante 18m radius. Siempre preparado.' },
        { id:'ltd-fireball',      name:'Fireball ◆',          level:3, castTime:'Acción',       range:'45 m',  duration:'Inst.',       concentration:false, combat:true,  domain:true, desc:'Esfera 20ft · save DES · 8d6 fuego. Siempre preparado.' },
        { id:'ltd-guardian-faith',name:'Guardian of Faith ◆',level:4, castTime:'Acción',       range:'9 m',   duration:'8 h',         concentration:false, combat:true,  domain:true, desc:'Guardián espectral: 20 radiante a hostiles en 3m. Siempre preparado.' },
        { id:'ltd-wall-of-fire',  name:'Wall of Fire ◆',      level:4, castTime:'Acción',       range:'36 m',  duration:'Conc. 1 min', concentration:true,  combat:true,  domain:true, desc:'Muro 18m · 5d8 fuego al otro lado. Siempre preparado.' },
        { id:'ltd-flame-strike',  name:'Flame Strike ◆',      level:5, castTime:'Acción',       range:'18 m',  duration:'Inst.',       concentration:false, combat:true,  domain:true, desc:'Columna de fuego divino 4d6 fuego + 4d6 radiante (save DES). Siempre preparado.' },
        { id:'ltd-scrying',       name:'Scrying ◆',           level:5, castTime:'10 min',       range:'Uno mismo', duration:'Conc. 10 min', concentration:true, combat:false, domain:true, desc:'Ves/oyes a una criatura conocida en otro lugar (save SAB negación). Siempre preparado.' },
      ],
      resources: (nivel) => [
        { id:'channel-divinity-light', name:'Channel Divinity',
          current: nivel >= 18 ? 3 : nivel >= 6 ? 2 : 1,
          max:     nivel >= 18 ? 3 : nivel >= 6 ? 2 : 1,
          recharge:'short',
          note:'Radiance of the Dawn · Turn Undead' },
      ],
      features: (nivel) => [
        { id:'light-warding-flare', name:'Warding Flare',
          source:'Light Domain · Nv1', type:'active', action:'Reacción', range:'9 m', recharge:null,
          desc:`${nivel >= 6 ? 'SAB mod' : 'SAB mod'} usos/Long Rest: cuando te atacan, imponés desventaja en esa tirada de ataque.`,
          fullDesc:'A nivel 1, puedes interponer luz divina entre vos y un atacante. Cuando eres atacado por una criatura a 9 metros que puedas ver, puedes usar tu reacción para imponer desventaja en la tirada de ataque, haciendo destellar luz ante el atacante. Puedes usar esta feature tantas veces como tu modificador de Sabiduría (mínimo 1) por Long Rest.' },
        { id:'light-radiance-dawn', name:'Radiance of the Dawn',
          source:'Light Domain · Nv2', type:'active', action:'Acción', range:'9 m', recharge:'Short/Long Rest',
          desc:'Canal: disipás magia de oscuridad, y las criaturas en 9 m reciben 2d10+nivel daño radiante (save CON mitad).',
          fullDesc:'A nivel 2 puedes usar tu Channel Divinity para aprovechar la luz del sol. Como acción, presentas tu símbolo sagrado y cualquier oscuridad mágica en 9 metros es disipada. Además, cada criatura hostil a 9 metros debe hacer un save de CON. Con falla, recibe 2d10 + tu nivel de clérigo en daño radiante; si lo supera, la mitad.' },
        ...(nivel >= 6 ? [{ id:'light-improved-flare', name:'Improved Flare',
          source:'Light Domain · Nv6', type:'passive', action:'Pasiva', range:'9 m', recharge:null,
          desc:'Podés usar Warding Flare cuando ataquen a otra criatura (no solo a vos) dentro de 9 m.',
          fullDesc:'A nivel 6, puedes usar Warding Flare también cuando una criatura a 9 metros que puedas ver es atacada.' }] : []),
        ...(nivel >= 8 ? [{ id:'light-potent-spellcasting', name:'Potent Spellcasting',
          source:'Light Domain · Nv8', type:'passive', action:'Pasiva', range:'Personal', recharge:null,
          desc:'Agregás tu modificador de SAB al daño de tus cantrips de clérigo.',
          fullDesc:'A nivel 8, añades tu modificador de Sabiduría al daño que causas con cualquier cantrip de clérigo.' }] : []),
        ...(nivel >= 17 ? [{ id:'light-corona-of-light', name:'Corona of Light',
          source:'Light Domain · Nv17', type:'active', action:'Acción', range:'Personal', recharge:'Long Rest',
          desc:'Activás un aura de luz solar (1 min): luz brillante 18 m, tenue 18 m más. Los enemigos tienen desventaja en saves contra tus conjuros de fuego y luz.',
          fullDesc:'A nivel 17, puedes usar tu acción para activar un aura de luz solar que dura 1 minuto o hasta que la desactives. Emites luz brillante en 18 metros y luz tenue en 18 metros más. Las criaturas hostiles en la luz brillante tienen desventaja en tiradas de salvación contra conjuros que causen daño de fuego o radiante.' }] : []),
      ],
    },

    'War Domain': {
      clase: 'Clérigo',
      subclassSpells: () => [
        { id:'wd-divine-favor',  name:'Divine Favor ◆',       level:1, castTime:'Acción bonus', range:'Uno mismo', duration:'Conc. 1 min', concentration:true, combat:true, domain:true, desc:'+1d4 radiante en cada ataque con arma. Siempre preparado.' },
        { id:'wd-shield-faith',  name:'Shield of Faith ◆',    level:1, castTime:'Acción bonus', range:'18 m',  duration:'Conc. 10 min', concentration:true, combat:false, domain:true, desc:'+2 CA a una criatura. Siempre preparado.' },
        { id:'wd-magic-weapon',  name:'Magic Weapon ◆',       level:2, castTime:'Acción bonus', range:'Toque', duration:'1 h',          concentration:true, combat:true, domain:true, desc:'Arma +1 (o más alto con slots altos). Siempre preparado.' },
        { id:'wd-spiritual-weapon',name:'Spiritual Weapon ◆', level:2, castTime:'Acción bonus', range:'18 m', duration:'1 min',        concentration:false, combat:true, domain:true, desc:'Arma espectral: ataque con acción bonus, 1d8+SAB daño. Siempre preparado.' },
        { id:'wd-crusaders-mantle',name:"Crusader's Mantle ◆",level:3, castTime:'Acción',       range:'9 m',   duration:'Conc. 1 min', concentration:true, combat:true, domain:true, desc:'Aliados en 9m +1d4 daño en ataques. Siempre preparado.' },
        { id:'wd-spirit-guardians',name:'Spirit Guardians ◆', level:3, castTime:'Acción',       range:'Uno mismo (4,5m)', duration:'Conc. 10 min', concentration:true, combat:true, domain:true, desc:'Criaturas hostiles en 3m radio: vel÷2 + 3d8 radiante/necrótico (save SAB mitad). Siempre preparado.' },
        { id:'wd-freedom-movement',name:'Freedom of Movement ◆', level:4, castTime:'Acción',   range:'Toque', duration:'1 h',          concentration:false, combat:true, domain:true, desc:'Inmune a terreno difícil mágico, parálisis, reducción velocidad. Siempre preparado.' },
        { id:'wd-stoneskin',     name:'Stoneskin ◆',          level:4, castTime:'Acción',       range:'Toque', duration:'Conc. 1 h',   concentration:true, combat:true, domain:true, desc:'Resistencia a daño no mágico B/P/S. Siempre preparado.' },
        { id:'wd-flame-strike',  name:'Flame Strike ◆',       level:5, castTime:'Acción',       range:'18 m',  duration:'Inst.',        concentration:false, combat:true, domain:true, desc:'4d6 fuego + 4d6 radiante (save DES). Siempre preparado.' },
        { id:'wd-hold-monster',  name:'Hold Monster ◆',       level:5, castTime:'Acción',       range:'18 m',  duration:'Conc. 1 min', concentration:true, combat:true, domain:true, desc:'Save SAB o paralizado (cualquier criatura). Siempre preparado.' },
      ],
      resources: (nivel) => [
        { id:'channel-divinity-war', name:'Channel Divinity',
          current: nivel >= 18 ? 3 : nivel >= 6 ? 2 : 1,
          max:     nivel >= 18 ? 3 : nivel >= 6 ? 2 : 1,
          recharge:'short',
          note:'Guided Strike · War God\'s Blessing' },
        { id:'war-priest-attacks', name:'War Priest',
          current: Math.max(1, Math.floor((nivel || 1) / 2)),
          max:     Math.max(1, Math.floor((nivel || 1) / 2)),
          recharge:'long',
          note:'Ataque extra como acción bonus (SAB mod/Long Rest)' },
      ],
      features: (nivel) => [
        { id:'war-bonus-prof', name:'Bonus Proficiency (Armadura Pesada + Armas Marciales)',
          source:'War Domain · Nv1', type:'passive', action:'Pasiva', range:'Personal', recharge:null,
          desc:'Ganás proficiencia con armadura pesada y armas marciales.',
          fullDesc:'A nivel 1 cuando elegís este dominio, ganás proficiencia con armaduras pesadas y armas marciales.' },
        { id:'war-war-priest', name:'War Priest',
          source:'War Domain · Nv1', type:'active', action:'Acción bonus', range:'Personal', recharge:'Long Rest',
          desc:'SAB mod veces/Long Rest: cuando atacás con arma, podés hacer un ataque adicional como acción bonus.',
          fullDesc:'Tu dios te otorga destellos de inspiración cuando te encuentras en combate. Cuando usas la acción de Ataque, puedes hacer un ataque con arma como acción adicional. Puedes usar esta feature tantas veces como tu modificador de SAB (mínimo 1) por Long Rest.' },
        { id:'war-guided-strike', name:'Guided Strike',
          source:'War Domain · Nv2', type:'active', action:'Reacción', range:'Personal', recharge:'Short/Long Rest',
          desc:'Canal: +10 a una tirada de ataque (después de ver el dado, antes del resultado).',
          fullDesc:'A nivel 2, puedes usar tu Channel Divinity para golpear con una precisión sobrenatural. Cuando hacés una tirada de ataque, podés usar tu Channel Divinity para ganar +10 a la tirada. Puedes elegir usar esta feature después de ver la tirada inicial pero antes de que el DM diga si el ataque impacta o falla.' },
        ...(nivel >= 6 ? [{ id:'war-gods-blessing', name:"War God's Blessing",
          source:'War Domain · Nv6', type:'active', action:'Reacción', range:'9 m', recharge:'Short/Long Rest',
          desc:'Canal: cuando un aliado a 9 m ataca, le otorgás +10 a la tirada de ataque.',
          fullDesc:'A nivel 6, cuando una criatura a 9 metros de vos hace una tirada de ataque, podés usar tu reacción para otorgarle +10 a esa tirada usando tu Channel Divinity. Podés elegir usarlo después de ver la tirada.' }] : []),
        ...(nivel >= 8 ? [{ id:'war-divine-strike', name:'Divine Strike',
          source:'War Domain · Nv8', type:'passive', action:'Pasiva', range:'Melee', recharge:null,
          desc:`1/turno: +${nivel >= 14 ? '2d8' : '1d8'} daño del tipo de tu dios en un ataque con arma.`,
          fullDesc:'A nivel 8, ganas la capacidad de infundir tus ataques con energía divina. Una vez por turno, cuando golpeas a una criatura con un ataque con arma, puedes causar 1d8 de daño adicional (tipo acorde al dios de guerra). A nivel 14, el daño extra aumenta a 2d8.' }] : []),
        ...(nivel >= 17 ? [{ id:'war-avatar-of-battle', name:'Avatar of Battle',
          source:'War Domain · Nv17', type:'passive', action:'Pasiva', range:'Personal', recharge:null,
          desc:'Resistencia a daño contundente, cortante y perforante de armas no mágicas.',
          fullDesc:'A nivel 17, ganas resistencia al daño contundente, cortante y perforante de ataques no mágicos.' }] : []),
      ],
    },

    'Trickery Domain': {
      clase: 'Clérigo',
      subclassSpells: () => [
        { id:'td-charm-person',  name:'Charm Person ◆',       level:1, castTime:'Acción',       range:'9 m',   duration:'1 h',         concentration:false, combat:false, domain:true, desc:'Save SAB o encantado. Siempre preparado.' },
        { id:'td-disguise-self', name:'Disguise Self ◆',      level:1, castTime:'Acción',       range:'Uno mismo', duration:'1 h',      concentration:false, combat:false, domain:true, desc:'Cambia apariencia visual. Siempre preparado.' },
        { id:'td-mirror-image',  name:'Mirror Image ◆',       level:2, castTime:'Acción',       range:'Uno mismo', duration:'1 min',    concentration:false, combat:true,  domain:true, desc:'3 duplicados ilusorios desvían ataques. Siempre preparado.' },
        { id:'td-pass-without-trace', name:'Pass Without Trace ◆', level:2, castTime:'Acción',  range:'Uno mismo', duration:'Conc. 1 h', concentration:true, combat:false, domain:true, desc:'+10 a Stealth y no se puede rastrear por magia. Siempre preparado.' },
        { id:'td-blink',         name:'Blink ◆',              level:3, castTime:'Acción',       range:'Uno mismo', duration:'1 min',    concentration:false, combat:true,  domain:true, desc:'50% prob de ir al plano etéreo al fin de cada turno. Siempre preparado.' },
        { id:'td-dispel-magic',  name:'Dispel Magic ◆',       level:3, castTime:'Acción',       range:'36 m',  duration:'Inst.',        concentration:false, combat:true,  domain:true, desc:'Termina conjuros automáticamente nv3 o menos. Siempre preparado.' },
        { id:'td-dimension-door',name:'Dimension Door ◆',     level:4, castTime:'Acción',       range:'150 m', duration:'Inst.',        concentration:false, combat:true,  domain:true, desc:'Teleportación vos + 1 aliado a hasta 150m. Siempre preparado.' },
        { id:'td-polymorph',     name:'Polymorph ◆',          level:4, castTime:'Acción',       range:'18 m',  duration:'Conc. 1 h',   concentration:true,  combat:true,  domain:true, desc:'Save SAB o transformado en bestia. Siempre preparado.' },
        { id:'td-dominate-person',name:'Dominate Person ◆',   level:5, castTime:'Acción',       range:'18 m',  duration:'Conc. 1 min', concentration:true,  combat:true,  domain:true, desc:'Save SAB o humanoide bajo tu control. Siempre preparado.' },
        { id:'td-modify-memory', name:'Modify Memory ◆',      level:5, castTime:'Acción',       range:'9 m',   duration:'Conc. 1 min', concentration:true,  combat:false, domain:true, desc:'Save SAB o podés alterar el recuerdo de un evento. Siempre preparado.' },
      ],
      resources: (nivel) => [
        { id:'channel-divinity-trick', name:'Channel Divinity',
          current: nivel >= 18 ? 3 : nivel >= 6 ? 2 : 1,
          max:     nivel >= 18 ? 3 : nivel >= 6 ? 2 : 1,
          recharge:'short',
          note:'Invoke Duplicity · Cloak of Shadows' },
      ],
      features: (nivel) => [
        { id:'trick-blessing', name:'Blessing of the Trickster',
          source:'Trickery Domain · Nv1', type:'active', action:'Acción', range:'Toque', recharge:'Long Rest',
          desc:'Otorgás ventaja en checks de Sigilo a otra criatura durante 1 hora.',
          fullDesc:'A nivel 1, puedes usar tu acción para tocar a una criatura voluntaria que no seas vos. Esa criatura tiene ventaja en checks de Sigilo durante 1 hora.' },
        { id:'trick-invoke-duplicity', name:'Invoke Duplicity',
          source:'Trickery Domain · Nv2', type:'active', action:'Acción', range:'9 m', recharge:'Short/Long Rest',
          desc:'Canal: creás un duplicado ilusorio tuyo (concentración 1 min). Podés moverte a 6 m de él por turno. Ventaja en ataques si el enemigo está adyacente al duplicado.',
          fullDesc:'A nivel 2, puedes usar tu Channel Divinity para crear una ilusión perfecta de vos mismo. Como acción, creás una copia ilusoria tuya a 9 metros, que dura 1 minuto (concentración). Como acción bonus, podés mover la ilusión hasta 9 metros. Tenés ventaja en tiradas de ataque contra criaturas a 1,5 metros del duplicado si podés verlas.' },
        ...(nivel >= 6 ? [{ id:'trick-cloak-of-shadows', name:'Cloak of Shadows',
          source:'Trickery Domain · Nv6', type:'active', action:'Acción', range:'Personal', recharge:'Short/Long Rest',
          desc:'Canal: te volvés Invisible hasta el inicio de tu próximo turno.',
          fullDesc:'A nivel 6, puedes usar tu Channel Divinity para desvanecerte. Como acción, te volvés invisible hasta el inicio de tu próximo turno. La invisibilidad termina si atacás, lanzás un conjuro o dañás a una criatura.' }] : []),
        ...(nivel >= 8 ? [{ id:'trick-divine-strike', name:'Divine Strike',
          source:'Trickery Domain · Nv8', type:'passive', action:'Pasiva', range:'Melee', recharge:null,
          desc:`1/turno: +${nivel >= 14 ? '2d8' : '1d8'} daño de veneno en un ataque con arma.`,
          fullDesc:'A nivel 8, ganas la capacidad de infundir tus ataques con veneno divino. Una vez por turno, cuando golpeas con un arma, causas 1d8 de daño de veneno adicional. A nivel 14, el daño aumenta a 2d8.' }] : []),
        ...(nivel >= 17 ? [{ id:'trick-improved-duplicity', name:'Improved Duplicity',
          source:'Trickery Domain · Nv17', type:'passive', action:'Pasiva', range:'Personal', recharge:null,
          desc:'Podés crear hasta cuatro duplicados ilusorios a la vez con Invoke Duplicity, y podés lanzar conjuros desde su posición.',
          fullDesc:'A nivel 17, puedes crear hasta cuatro duplicados ilusorios cuando usas Invoke Duplicity. Como acción bonus, podés mover cualquier cantidad de ellos hasta 9 metros. Además, cuando lanzás un conjuro, podés hacerlo como si estuvieras en el espacio de cualquier duplicado activo.' }] : []),
      ],
    },

    'Knowledge Domain': {
      clase: 'Clérigo',
      subclassSpells: () => [
        { id:'kd-command',       name:'Command ◆',            level:1, castTime:'Acción',       range:'18 m',  duration:'1 turno',     concentration:false, combat:true,  domain:true, desc:'Save SAB · 1 palabra: Huye/Detente/Cae/Acércate/Suéltalo. Siempre preparado.' },
        { id:'kd-identify',      name:'Identify ◆',           level:1, castTime:'1 min',        range:'Toque', duration:'Inst.',        concentration:false, combat:false, domain:true, desc:'Ritual. Identifica propiedades mágicas de objeto. Siempre preparado.' },
        { id:'kd-augury',        name:'Augury ◆',             level:2, castTime:'1 min',        range:'Uno mismo', duration:'Inst.',    concentration:false, combat:false, domain:true, desc:'Ritual. Presagio sobre acción en los próximos 30 min (bien/mal/ambas/ninguna). Siempre preparado.' },
        { id:'kd-suggestion',    name:'Suggestion ◆',         level:2, castTime:'Acción',       range:'9 m',   duration:'Conc. 8 h',   concentration:true,  combat:false, domain:true, desc:'Save SAB o sigue sugerencia razonable. Siempre preparado.' },
        { id:'kd-nondetection',  name:'Nondetection ◆',       level:3, castTime:'Acción',       range:'Toque', duration:'8 h',         concentration:false, combat:false, domain:true, desc:'Criatura/objeto indetectable por magia de adivinación. Siempre preparado.' },
        { id:'kd-speak-dead',    name:'Speak with Dead ◆',    level:3, castTime:'Acción',       range:'3 m',   duration:'10 min',      concentration:false, combat:false, domain:true, desc:'Cadáver responde 5 preguntas. Siempre preparado.' },
        { id:'kd-arcane-eye',    name:'Arcane Eye ◆',         level:4, castTime:'Acción',       range:'9 m',   duration:'Conc. 1 h',   concentration:true,  combat:false, domain:true, desc:'Ojo mágico invisible que podés mover. Siempre preparado.' },
        { id:'kd-confusion',     name:'Confusion ◆',          level:4, castTime:'Acción',       range:'27 m',  duration:'Conc. 1 min', concentration:true,  combat:true,  domain:true, desc:'Save SAB en área 3m o acción aleatoria. Siempre preparado.' },
        { id:'kd-legend-lore',   name:'Legend Lore ◆',        level:5, castTime:'10 min',       range:'Uno mismo', duration:'Inst.',   concentration:false, combat:false, domain:true, desc:'Información legendaria sobre persona, lugar u objeto. Siempre preparado.' },
        { id:'kd-scrying',       name:'Scrying ◆',            level:5, castTime:'10 min',       range:'Uno mismo', duration:'Conc. 10 min', concentration:true, combat:false, domain:true, desc:'Ves/oyes a criatura conocida (save SAB negación). Siempre preparado.' },
      ],
      resources: (nivel) => [
        { id:'channel-divinity-know', name:'Channel Divinity',
          current: nivel >= 18 ? 3 : nivel >= 6 ? 2 : 1,
          max:     nivel >= 18 ? 3 : nivel >= 6 ? 2 : 1,
          recharge:'short', note:'Knowledge of the Ages · Read Thoughts · Turn Undead' },
      ],
      features: (nivel) => [
        { id:'know-blessings', name:'Blessings of Knowledge',
          source:'Knowledge Domain · Nv1', type:'passive', action:'Pasiva', range:'Personal', recharge:null,
          desc:'Aprendés 2 idiomas y ganás expertise en 2 de estas skills: Arcana, Historia, Naturaleza o Religión.',
          fullDesc:'A nivel 1, aprendes dos idiomas de tu elección y ganas proficiencia en dos de las siguientes skills: Arcana, Historia, Naturaleza o Religión. Tu bono de proficiencia se duplica en los checks que hagas con esas dos skills.' },
        { id:'know-knowledge-of-ages', name:'Knowledge of the Ages',
          source:'Knowledge Domain · Nv2', type:'active', action:'Acción', range:'Personal', recharge:'Short/Long Rest',
          desc:'Canal: ganás proficiencia en una skill o herramienta de tu elección durante 10 minutos.',
          fullDesc:'A nivel 2, puedes usar tu Channel Divinity para acceder a un pozo de conocimiento divino. Como acción, elijes una skill o herramienta. Durante 10 minutos, tienes proficiencia con esa skill o herramienta.' },
        { id:'know-read-thoughts', name:'Read Thoughts',
          source:'Knowledge Domain · Nv2', type:'active', action:'Acción', range:'18 m', recharge:'Short/Long Rest',
          desc:'Canal: lees la mente superficial de una criatura (save SAB). Si falla, podés lanzar Suggestion sin gastar slot.',
          fullDesc:'A nivel 2, puedes usar tu Channel Divinity para leer los pensamientos de una criatura. Como acción, elijes una criatura a 18 metros. La criatura debe hacer un save de SAB. Con falla, puedes leer sus pensamientos superficiales durante 1 minuto. Durante ese tiempo, puedes lanzar Suggestion en la criatura sin usar un espacio de conjuro.' },
        ...(nivel >= 6 ? [{ id:'know-potent-spellcasting', name:'Potent Spellcasting',
          source:'Knowledge Domain · Nv6 (alt)', type:'passive', action:'Pasiva', range:'Personal', recharge:null,
          desc:'Agregás tu modificador de SAB al daño de tus cantrips de clérigo.',
          fullDesc:'A nivel 6 (en la variante 2024), añades tu modificador de Sabiduría al daño de tus cantrips de clérigo.' }] : []),
        ...(nivel >= 8 ? [{ id:'know-visions-of-past', name:'Visions of the Past',
          source:'Knowledge Domain · Nv8', type:'active', action:'Acción', range:'Personal', recharge:'Short/Long Rest',
          desc:'Meditás 1 min para ver visiones del pasado reciente de un lugar u objeto que sostenés.',
          fullDesc:'A nivel 8, puedes llamar visiones del pasado reciente mirando a tu alrededor o sosteniendo un objeto. Meditas durante 1 minuto e inundas tu mente con visiones del pasado cercano relacionadas al área o el objeto.' }] : []),
        ...(nivel >= 17 ? [{ id:'know-mind-over-matter', name:'Mind over Matter (Nv17)',
          source:'Knowledge Domain · Nv17', type:'passive', action:'Pasiva', range:'Personal', recharge:null,
          desc:'Podés lanzar Astral Projection para vos solo sin gastar slot ni material.',
          fullDesc:'A nivel 17, puedes lanzar el conjuro Astral Projection para vos solo sin gastar un espacio de conjuro ni componentes materiales.' }] : []),
      ],
    },

    'Nature Domain': {
      clase: 'Clérigo',
      subclassSpells: () => [
        { id:'nd-animal-friendship',name:'Animal Friendship ◆',level:1, castTime:'Acción',      range:'9 m',   duration:'24 h',        concentration:false, combat:false, domain:true, desc:'Save SAB o bestia con INT ≤3 encantada 24h. Siempre preparado.' },
        { id:'nd-speak-animals', name:'Speak with Animals ◆',  level:1, castTime:'Acción',      range:'Uno mismo', duration:'10 min',  concentration:false, combat:false, domain:true, desc:'Ritual. Comunicación verbal con bestias. Siempre preparado.' },
        { id:'nd-barkskin',      name:'Barkskin ◆',            level:2, castTime:'Acción',      range:'Toque', duration:'Conc. 1 h',   concentration:true,  combat:false, domain:true, desc:'CA mínima 17 mientras dure. Siempre preparado.' },
        { id:'nd-spike-growth',  name:'Spike Growth ◆',        level:2, castTime:'Acción',      range:'45 m',  duration:'Conc. 10 min',concentration:true,  combat:true,  domain:true, desc:'Área 4,5m radio: terreno difícil + 2d4 perforante por 1,5m. Siempre preparado.' },
        { id:'nd-plant-growth',  name:'Plant Growth ◆',        level:3, castTime:'Acción/8 h',  range:'45 m',  duration:'Inst.',       concentration:false, combat:true,  domain:true, desc:'Vegetación enloquecida: terreno 4× difícil en 30m. Siempre preparado.' },
        { id:'nd-wind-wall',     name:'Wind Wall ◆',           level:3, castTime:'Acción',      range:'36 m',  duration:'Conc. 1 min', concentration:true,  combat:true,  domain:true, desc:'Muro de viento: bloquea proyectiles + 3d8 contundente a criaturas. Siempre preparado.' },
        { id:'nd-dominate-beast',name:'Dominate Beast ◆',      level:4, castTime:'Acción',      range:'18 m',  duration:'Conc. 1 min', concentration:true,  combat:true,  domain:true, desc:'Save SAB o bestia bajo control. Siempre preparado.' },
        { id:'nd-grasping-vine', name:'Grasping Vine ◆',       level:4, castTime:'Acción bonus', range:'9 m',  duration:'Conc. 1 min', concentration:true,  combat:true,  domain:true, desc:'Enredadera conjurada: mueve criatura 4,5m hacia ella (save DES). Siempre preparado.' },
        { id:'nd-insect-plague', name:'Insect Plague ◆',       level:5, castTime:'Acción',      range:'90 m',  duration:'Conc. 10 min',concentration:true,  combat:true,  domain:true, desc:'Esfera 6m radio: terreno difícil + 4d10 perforante/turno (save CON mitad). Siempre preparado.' },
        { id:'nd-tree-stride',   name:'Tree Stride ◆',         level:5, castTime:'Acción',      range:'Uno mismo', duration:'Conc. 1 min', concentration:true, combat:false, domain:true, desc:'Teleportación entre árboles del mismo tipo en 150m. Siempre preparado.' },
      ],
      resources: (nivel) => [
        { id:'channel-divinity-nature', name:'Channel Divinity',
          current: nivel >= 18 ? 3 : nivel >= 6 ? 2 : 1,
          max:     nivel >= 18 ? 3 : nivel >= 6 ? 2 : 1,
          recharge:'short', note:'Charm Animals & Plants · Turn Undead' },
      ],
      features: (nivel) => [
        { id:'nature-acolyte', name:'Acolyte of Nature',
          source:'Nature Domain · Nv1', type:'passive', action:'Pasiva', range:'Personal', recharge:null,
          desc:'Aprendés un cantrip de Druida. Ganás proficiencia en una de: Animal Handling, Nature o Survival.',
          fullDesc:'A nivel 1, aprendes un cantrip de la lista de Druida. También ganas proficiencia en una de las siguientes skills: Manejo de Animales, Naturaleza o Supervivencia.' },
        { id:'nature-heavy-armor', name:'Bonus Proficiency (Armadura Pesada)',
          source:'Nature Domain · Nv1', type:'passive', action:'Pasiva', range:'Personal', recharge:null,
          desc:'Ganás proficiencia con armadura pesada.',
          fullDesc:'A nivel 1 cuando eliges este dominio, ganas proficiencia con armaduras pesadas.' },
        { id:'nature-charm-animals', name:'Charm Animals and Plants',
          source:'Nature Domain · Nv2', type:'active', action:'Acción', range:'9 m', recharge:'Short/Long Rest',
          desc:'Canal: encantas bestias y plantas en 9 m hasta el final de tu próximo turno (save SAB niega).',
          fullDesc:'A nivel 2, puedes usar tu Channel Divinity para encantar animales y plantas. Como acción, presentas tu símbolo sagrado y cada bestia o planta a 9 metros que pueda verte debe hacer un save de SAB. Con falla, queda encantada hasta el final de tu próximo turno.' },
        ...(nivel >= 6 ? [{ id:'nature-dampen-elements', name:'Dampen Elements',
          source:'Nature Domain · Nv6', type:'active', action:'Reacción', range:'9 m', recharge:null,
          desc:'Cuando vos u otra criatura en 9 m recibís daño de ácido, frío, fuego, rayo o trueno, podés otorgar resistencia con tu reacción.',
          fullDesc:'A nivel 6, cuando vos u otra criatura a 9 metros recibes daño de ácido, frío, fuego, rayo o trueno, puedes usar tu reacción para otorgar resistencia a ese daño.' }] : []),
        ...(nivel >= 8 ? [{ id:'nature-divine-strike-nature', name:'Divine Strike',
          source:'Nature Domain · Nv8', type:'passive', action:'Pasiva', range:'Melee', recharge:null,
          desc:`1/turno: +${nivel >= 14 ? '2d8' : '1d8'} daño de frío, fuego o rayo en un ataque con arma.`,
          fullDesc:'A nivel 8, infundes tus ataques con poder elemental. Una vez por turno, cuando golpeas con un arma, causas 1d8 de daño adicional (frío, fuego o rayo, tu elección). A nivel 14 aumenta a 2d8.' }] : []),
        ...(nivel >= 17 ? [{ id:'nature-master-of-nature', name:'Master of Nature',
          source:'Nature Domain · Nv17', type:'active', action:'Acción bonus', range:'18 m', recharge:null,
          desc:'Podés comandar criaturas encantadas por tus conjuros o Channel Divinity con una acción bonus.',
          fullDesc:'A nivel 17, ganas la capacidad de comandar animales y plantas. Las criaturas encantadas por tus conjuros o Channel Divinity obedecen tus órdenes sin necesitar concentración adicional.' }] : []),
      ],
    },

    'Tempest Domain': {
      clase: 'Clérigo',
      subclassSpells: () => [
        { id:'tmd-fog-cloud',    name:'Fog Cloud ◆',           level:1, castTime:'Acción',       range:'27 m',  duration:'Conc. 1 h',   concentration:true,  combat:true,  domain:true, desc:'Esfera niebla 6m radio: visibilidad nula. Siempre preparado.' },
        { id:'tmd-thunderwave',  name:'Thunderwave ◆',         level:1, castTime:'Acción',       range:'Uno mismo (4,5m)', duration:'Inst.', concentration:false, combat:true, domain:true, desc:'Cubo 15ft · save CON · 2d8 trueno + empuja 3m. Siempre preparado.' },
        { id:'tmd-gust-of-wind', name:'Gust of Wind ◆',        level:2, castTime:'Acción',       range:'Uno mismo (18m)', duration:'Conc. 1 min', concentration:true, combat:true, domain:true, desc:'Línea de viento 18m: criaturas deben usar el doble de movimiento. Siempre preparado.' },
        { id:'tmd-shatter',      name:'Shatter ◆',             level:2, castTime:'Acción',       range:'18 m',  duration:'Inst.',        concentration:false, combat:true,  domain:true, desc:'Esfera 3m · save CON · 3d8 trueno. +1d8 por nivel. Siempre preparado.' },
        { id:'tmd-call-lightning',name:'Call Lightning ◆',     level:3, castTime:'Acción',       range:'27 m',  duration:'Conc. 10 min',concentration:true,  combat:true,  domain:true, desc:'Nube de tormenta: acción bonus = rayo 3d10 en 9m área. Siempre preparado.' },
        { id:'tmd-sleet-storm',  name:'Sleet Storm ◆',         level:3, castTime:'Acción',       range:'45 m',  duration:'Conc. 1 min', concentration:true,  combat:true,  domain:true, desc:'Tormenta helada 6m radio: terreno difícil, concentración en desventaja. Siempre preparado.' },
        { id:'tmd-control-water',name:'Control Water ◆',       level:4, castTime:'Acción',       range:'90 m',  duration:'Conc. 10 min',concentration:true,  combat:false, domain:true, desc:'Controla agua: diluvio, remolino, corriente, inundación. Siempre preparado.' },
        { id:'tmd-ice-storm',    name:'Ice Storm ◆',           level:4, castTime:'Acción',       range:'90 m',  duration:'Inst.',        concentration:false, combat:true,  domain:true, desc:'Cilindro 6m radio: 2d8 contundente + 4d6 frío (save DES mitad). Siempre preparado.' },
        { id:'tmd-destructive-wave',name:'Destructive Wave ◆', level:5, castTime:'Acción',       range:'9 m',   duration:'Inst.',        concentration:false, combat:true,  domain:true, desc:'Onda 9m radio: 5d6 trueno + 5d6 radiante/necrótico (save CON) · derriba. Siempre preparado.' },
        { id:'tmd-insect-plague2',name:'Insect Plague ◆',      level:5, castTime:'Acción',       range:'90 m',  duration:'Conc. 10 min',concentration:true,  combat:true,  domain:true, desc:'Esfera 6m: terreno difícil + 4d10 perforante/turno. Siempre preparado.' },
      ],
      resources: (nivel) => [
        { id:'channel-divinity-tempest', name:'Channel Divinity',
          current: nivel >= 18 ? 3 : nivel >= 6 ? 2 : 1,
          max:     nivel >= 18 ? 3 : nivel >= 6 ? 2 : 1,
          recharge:'short', note:'Destructive Wrath · Turn Undead' },
        { id:'wrath-of-storm', name:'Wrath of the Storm',
          current: Math.max(1, Math.floor(((nivel||1) + 2) / 4) * 2 - (nivel >= 5 ? 0 : 0)),
          max: (nivel >= 14 ? 6 : nivel >= 9 ? 5 : nivel >= 5 ? 4 : nivel >= 3 ? 3 : 2),
          recharge:'long', note:'Reacción: 2d8 rayo/trueno cuando te pegan (save DES mitad)' },
      ],
      features: (nivel) => [
        { id:'tempest-heavy-armor', name:'Bonus Proficiency (Armadura Pesada + Armas Marciales)',
          source:'Tempest Domain · Nv1', type:'passive', action:'Pasiva', range:'Personal', recharge:null,
          desc:'Ganás proficiencia con armadura pesada y armas marciales.',
          fullDesc:'A nivel 1 cuando eliges este dominio, ganas proficiencia con armaduras pesadas y armas marciales.' },
        { id:'tempest-wrath-storm', name:'Wrath of the Storm',
          source:'Tempest Domain · Nv1', type:'active', action:'Reacción', range:'Personal', recharge:'Long Rest',
          desc:'SAB mod veces/Long Rest: cuando una criatura te impacta, le infligís 2d8 daño de rayo o trueno (save DES mitad).',
          fullDesc:'A nivel 1, puedes fulminar a los atacantes con poder tormentoso. Cuando una criatura a 1,5 metros te golpea con un ataque, puedes usar tu reacción para causar 2d8 de daño de rayo o trueno (tu elección). La criatura puede hacer un save de Destreza para recibir solo la mitad del daño. Puedes usar esta feature tantas veces como tu modificador de SAB (mínimo 1) por Long Rest.' },
        { id:'tempest-destructive-wrath', name:'Destructive Wrath',
          source:'Tempest Domain · Nv2', type:'active', action:'Ninguna', range:'Personal', recharge:'Short/Long Rest',
          desc:'Canal: cuando hagas daño de rayo o trueno, podés reemplazar la tirada por el máximo posible.',
          fullDesc:'A nivel 2, puedes usar tu Channel Divinity para empuñar el poder de la tormenta con fuerza implacable. Cuando tiras daño de rayo o trueno, puedes usar tu Channel Divinity para reemplazar los dados por el máximo resultado posible.' },
        ...(nivel >= 6 ? [{ id:'tempest-thunderbolt-strike', name:'Thunderbolt Strike',
          source:'Tempest Domain · Nv6', type:'passive', action:'Pasiva', range:'Personal', recharge:null,
          desc:'Cuando infligís daño de rayo a una criatura Grande o menor, la empujás hasta 3 m.',
          fullDesc:'A nivel 6, cuando causas daño de rayo a una criatura de tamaño Grande o menor, también puedes empujarla hasta 3 metros de distancia.' }] : []),
        ...(nivel >= 8 ? [{ id:'tempest-divine-strike-thunder', name:'Divine Strike',
          source:'Tempest Domain · Nv8', type:'passive', action:'Pasiva', range:'Melee', recharge:null,
          desc:`1/turno: +${nivel >= 14 ? '2d8' : '1d8'} daño de trueno en un ataque con arma.`,
          fullDesc:'A nivel 8, infundes tus ataques con poder tormentoso. Una vez por turno, al golpear con un arma, causas 1d8 de daño de trueno adicional. A nivel 14 aumenta a 2d8.' }] : []),
        ...(nivel >= 17 ? [{ id:'tempest-stormborn', name:'Stormborn',
          source:'Tempest Domain · Nv17', type:'passive', action:'Pasiva', range:'Personal', recharge:null,
          desc:'Ganás velocidad de vuelo igual a tu velocidad de caminar cuando estás al aire libre.',
          fullDesc:'A nivel 17, tienes velocidad de vuelo igual a tu velocidad de movimiento terrestre cuando no estás bajo techo.' }] : []),
      ],
    },

    // ── DRUIDA ────────────────────────────────────────────────────────────────
    'Círculo de la Luna': {
      clase: 'Druida',
      resources: (nivel) => [
        { id:'wild-shape', name:'Wild Shape',
          current: 2, max: 2, recharge:'short',
          note:`CR máx ${nivel>=18?'sin límite':nivel>=9?3:nivel>=6?2:1} · Elementales (nv10)` },
      ],
      features: (nivel) => [
        { id:'moon-combat-wild-shape', name:'Combat Wild Shape',
          source:'Círculo de la Luna · Nv2', type:'active', action:'Acción bonus', range:'Personal', recharge:'Short Rest',
          desc:'Transforma usando acción bonus. Gasta slots para curar 1d8 HP por nivel del slot.',
          fullDesc:'Cuando estás en forma salvaje, puedes usar una acción adicional para gastar un espacio de conjuro y recuperar 1d8 puntos de golpe por nivel del espacio gastado.' },
        ...(nivel >= 6 ? [{ id:'moon-primal-strike', name:'Primal Strike',
          source:'Círculo de la Luna · Nv6', type:'passive', action:'Pasiva', range:'Personal', recharge:null,
          desc:'Tus ataques en Wild Shape cuentan como mágicos para resistencias/inmunidades.',
          fullDesc:'A nivel 6, tus ataques en forma de bestia cuentan como mágicos a efectos de superar resistencias e inmunidades a daño no mágico.' }] : []),
        ...(nivel >= 10 ? [{ id:'moon-elemental-wild-shape', name:'Elemental Wild Shape',
          source:'Círculo de la Luna · Nv10', type:'active', action:'Acción', range:'Personal', recharge:'Short Rest',
          desc:'Gasta 2 usos de Wild Shape para transformarte en un elemental (aire, tierra, fuego, agua).',
          fullDesc:'Puedes gastar dos usos de Wild Shape al mismo tiempo para transformarte en un elemental de aire, tierra, fuego o agua.' }] : []),
        ...(nivel >= 14 ? [{ id:'moon-thousand-forms', name:'Thousand Forms',
          source:'Círculo de la Luna · Nv14', type:'active', action:'Acción', range:'Personal', recharge:null,
          desc:'Podés lanzar Alter Self a voluntad sin gastar slot.',
          fullDesc:'A nivel 14, has aprendido a usar la magia para alterar tu forma de maneras más sutiles. Puedes lanzar el conjuro Alter Self a voluntad.' }] : []),
      ],
    },

    'Circle of the Land': {
      clase: 'Druida',
      resources: (nivel) => [
        { id:'wild-shape-land', name:'Wild Shape',
          current: 2, max: 2, recharge:'short',
          note:`CR máx ${nivel>=8?1:0.5} · Solo bestias terrestres` },
      ],
      features: (nivel) => [
        { id:'land-bonus-cantrip', name:'Bonus Cantrip',
          source:'Circle of the Land · Nv2', type:'passive', action:'Pasiva', range:'Personal', recharge:null,
          desc:'Aprendés un cantrip de druida adicional de tu elección.',
          fullDesc:'A nivel 2, aprendés un cantrip de druida adicional de tu elección.' },
        { id:'land-natural-recovery', name:'Natural Recovery',
          source:'Circle of the Land · Nv2', type:'active', action:'Short Rest', range:'Personal', recharge:'Long Rest',
          desc:'1/Long Rest: durante un Short Rest, recuperás slots gastados cuyo nivel total no supere la mitad de tu nivel (redondeado arriba, máx nivel 5).',
          fullDesc:'A nivel 2, puedes recuperar parte de tu energía mágica descansando en la naturaleza. Una vez por día al terminar un Short Rest, eliges espacio de conjuro gastados cuya suma de niveles sea igual o menor a la mitad de tu nivel de druida (redondeado arriba). No puedes recuperar slots de nivel 6 o mayor.' },
        { id:'land-circle-spells', name:'Circle Spells',
          source:'Circle of the Land · Nv3', type:'passive', action:'Pasiva', range:'Personal', recharge:null,
          desc:'Tu círculo te otorga acceso a conjuros adicionales (terreno elegido: Ártico, Costa, Desierto, Bosque, Pradera, Montaña, Pantano o Underdark).',
          fullDesc:'A nivel 3, la tierra que te conecta te permite acceder a conjuros que de otro modo no formarían parte de tu lista. Los conjuros de círculo están siempre preparados y no cuentan para el número de conjuros que puedes preparar.' },
        ...(nivel >= 6 ? [{ id:'land-lands-stride', name:"Land's Stride",
          source:'Circle of the Land · Nv6', type:'passive', action:'Pasiva', range:'Personal', recharge:null,
          desc:'Te movés por terreno difícil no mágico sin coste extra. La vegetación mágica tampoco te ralentiza ni te daña.',
          fullDesc:'A nivel 6, moverse a través de terreno difícil no mágico no te cuesta movimiento extra. También puedes pasar a través de plantas no mágicas sin ser ralentizado y sin recibir daño. Puedes pasar a través de plantas mágicas sin sufrir efectos si superas el save pertinente.' }] : []),
        ...(nivel >= 10 ? [{ id:'land-natures-ward', name:"Nature's Ward",
          source:'Circle of the Land · Nv10', type:'passive', action:'Pasiva', range:'Personal', recharge:null,
          desc:'Inmune a veneno, enfermedad y a ser Encantado o Asustado por Elementales y Fey.',
          fullDesc:'A nivel 10, no puedes ser envenenado ni enfermarte con enfermedades naturales o mágicas. Además, las criaturas feéricas y los elementales no pueden encantarte ni asustarte.' }] : []),
        ...(nivel >= 14 ? [{ id:'land-natures-sanctuary', name:"Nature's Sanctuary",
          source:'Circle of the Land · Nv14', type:'passive', action:'Pasiva', range:'Personal', recharge:null,
          desc:'Las bestias y plantas deben superar un save de SAB o no pueden atacarte. Las afectadas se vuelven inmunes a este efecto 24 hs.',
          fullDesc:'A nivel 14, las criaturas del mundo natural sienten tu vínculo con la naturaleza y dudan en atacarte. Cuando una bestia o planta te ataca, debe superar un save de SAB contra tu DC de conjuros o elegir un objetivo diferente. Si supera el save, es inmune al efecto durante 24 horas.' }] : []),
      ],
      // Circle Spells varían por terreno. Cargamos los del Bosque (Forest) como base — ajustar según terreno elegido.
      subclassSpells: (nivel) => [
        // Nv3 (Bosque/Forest — siempre preparados)
        { id:'barkskin', name:'Barkskin', level:2, castTime:'1 acción', range:'Toque',
          duration:'1 hora', concentration:true, combat:false,
          desc:'La CA del objetivo no puede bajar de 16 mientras dure el conjuro.', domain:true },
        { id:'spider-climb', name:'Spider Climb', level:2, castTime:'1 acción', range:'Toque',
          duration:'1 hora', concentration:true, combat:false,
          desc:'Una criatura puede escalar superficies difíciles, incluso techos, con velocidad de escalar.', domain:true },
        // Nv5
        ...(nivel >= 5 ? [
          { id:'call-lightning', name:'Call Lightning', level:3, castTime:'1 acción', range:'36 m',
            duration:'10 minutos', concentration:true, combat:true,
            desc:'Convocas tormenta. Cada turno (acción): rayo de 3d10 rayos en cilindro de 1.5 m. Doble daño en tormenta real.', domain:true },
          { id:'plant-growth', name:'Plant Growth', level:3, castTime:'1 acción / 8 hs', range:'45 m',
            duration:'Instantáneo', concentration:false, combat:true,
            desc:'Las plantas en un radio de 30 m se espigan: terreno difícil. O revitalizas la tierra para que sea más fértil.', domain:true },
        ] : []),
        // Nv7
        ...(nivel >= 7 ? [
          { id:'divination', name:'Divination', level:4, castTime:'1 acción', range:'Personal',
            duration:'Instantáneo', concentration:false, combat:false,
            desc:'Recibes una respuesta breve y verídica sobre un evento en 7 días. Ritual disponible.', domain:true },
          { id:'freedom-of-movement', name:'Freedom of Movement', level:4, castTime:'1 acción', range:'Toque',
            duration:'1 hora', concentration:false, combat:false,
            desc:'Ignorás terreno difícil mágico/no mágico, no podés ser paralizado ni restringido por conjuros.', domain:true },
        ] : []),
        // Nv9
        ...(nivel >= 9 ? [
          { id:'commune-with-nature', name:'Commune with Nature', level:5, castTime:'1 minuto', range:'Personal',
            duration:'Instantáneo', concentration:false, combat:false,
            desc:'Ritual: te sintonizás con la tierra en 4.5 km (o 90 m bajo tierra). Obtenés 3 hechos sobre el área.', domain:true },
          { id:'tree-stride', name:'Tree Stride', level:5, castTime:'1 acción', range:'Personal',
            duration:'1 minuto', concentration:true, combat:false,
            desc:'Podés entrar en un árbol y salir desde otro árbol del mismo tipo a 150 m. 1 vez/turno.', domain:true },
        ] : []),
      ],
    },

    'Circle of Spores': {
      clase: 'Druida',
      resources: (nivel) => [
        { id:'wild-shape-spores', name:'Wild Shape',
          current: 2, max: 2, recharge:'short',
          note:`CR máx ${nivel>=8?1:0.5}` },
        { id:'symbiotic-entity', name:'Symbiotic Entity',
          current: 1, max: 1, recharge:'short',
          note:`${4 * (nivel || 1)} temp HP · +1d6 necrótico en ataques` },
      ],
      features: (nivel) => [
        { id:'spores-halo', name:'Halo of Spores',
          source:'Circle of Spores · Nv2', type:'active', action:'Reacción', range:'3 m', recharge:null,
          desc:`Cuando una criatura en 3 m termina su turno, podés usar reacción para infligirle ${nivel>=10?'3d4':nivel>=6?'2d4':'1d4'} daño necrótico (save CON negación).`,
          fullDesc:'A nivel 2, estás rodeado de esporas que pueden infectar y matar. Cuando una criatura que puedas ver entra en un espacio a 3 metros de vos o termina su turno ahí, podés usar tu reacción para infligirle daño necrótico (1d4 nv2-5, 2d4 nv6-9, 3d4 nv10+). Save CON contra tu DC de conjuros para negarlo.' },
        { id:'spores-symbiotic-entity', name:'Symbiotic Entity',
          source:'Circle of Spores · Nv2', type:'active', action:'Acción (Wild Shape)', range:'Personal', recharge:'Short Rest',
          desc:`Gastás un uso de Wild Shape: ${4 * (nivel||1)} temp HP, Halo of Spores inflige el doble, tus ataques cuerpo a cuerpo infligen +1d6 necrótico.`,
          fullDesc:'A nivel 2, puedes canalizar las esporas que llevas dentro. En vez de transformarte, gastas un uso de Wild Shape para despertar esas esporas. Ganas temp HP iguales a 4 × tu nivel de druida y el daño de Halo of Spores se duplica. Además, tus ataques cuerpo a cuerpo infligen 1d6 de daño necrótico adicional. Dura 10 minutos o hasta que pierdas los temp HP.' },
        ...(nivel >= 6 ? [{ id:'spores-fungal-infestation', name:'Fungal Infestation',
          source:'Circle of Spores · Nv6', type:'active', action:'Reacción', range:'9 m', recharge:null,
          desc:'SAB mod veces/Long Rest: cuando una bestia o humanoide a 9 m muere, podés animarla como zombi que obedece tus órdenes durante 1 hora.',
          fullDesc:'A nivel 6, tus esporas pueden animar cadáveres. Cuando una bestia o humanoide de tamaño Mediano o menor muere a 9 metros, puedes usar tu reacción para hacer que las esporas lo animen. Se convierte en un zombi que obedece tus órdenes verbales durante 1 hora o hasta que muera. Usable SAB mod veces por Long Rest.' }] : []),
        ...(nivel >= 10 ? [{ id:'spores-spreading-spores', name:'Spreading Spores',
          source:'Circle of Spores · Nv10', type:'active', action:'Acción bonus', range:'9 m', recharge:null,
          desc:'Cuando Symbiotic Entity está activo, podés colocar una zona de esporas de 3×3 m (concentración). Las criaturas que entren activan Halo of Spores automáticamente sin gastar reacción.',
          fullDesc:'A nivel 10, puedes sembrar tus esporas a distancia. Como acción adicional mientras Symbiotic Entity está activo, lanzás una nube de esporas que ocupa un cubo de 3 metros centrado en un punto a 9 metros. La nube dura 1 minuto o hasta que el Symbiotic Entity termine. Cualquier criatura que entre en el cubo o comience su turno ahí activa automáticamente el efecto de Halo of Spores sin necesitar tu reacción.' }] : []),
        ...(nivel >= 14 ? [{ id:'spores-fungal-body', name:'Fungal Body',
          source:'Circle of Spores · Nv14', type:'passive', action:'Pasiva', range:'Personal', recharge:null,
          desc:'Inmune a estados: Blinded, Deafened, Frightened, Poisoned. Ataques críticos contra vos se vuelven golpes normales.',
          fullDesc:'A nivel 14, las esporas de tu cuerpo te protegen de varios peligros. Eres inmune a las condiciones Blinded, Deafened, Frightened y Poisoned. Además, cualquier golpe crítico contra vos se convierte en un golpe normal.' }] : []),
      ],
      subclassSpells: (nivel) => [
        // Cantrip libre
        { id:'chill-touch', name:'Chill Touch', level:0, castTime:'1 acción', range:'18 m',
          duration:'1 ronda', concentration:false, combat:true,
          desc:'Ataque de conjuro a distancia: 1d10 necrótico. El objetivo no puede recuperar HP hasta el inicio de tu próximo turno.',
          cantrip_subclass:true },
        // Nv2 (Tasha's: siempre preparados desde que se elige la subclase)
        { id:'blindness-deafness', name:'Blindness/Deafness', level:2, castTime:'1 acción', range:'27 m',
          duration:'1 minuto', concentration:false, combat:true,
          desc:'Save CON: ciega o ensordece a una criatura. Puede repetir el save al final de cada turno.', domain:true },
        { id:'gentle-repose', name:'Gentle Repose', level:2, castTime:'1 acción', range:'Toque',
          duration:'10 días', concentration:false, combat:false,
          desc:'Preserva un cadáver de putrefacción. Los muertos protegidos no pueden ser animados.', domain:true },
        // Nv3
        ...(nivel >= 3 ? [
          { id:'animate-dead', name:'Animate Dead', level:3, castTime:'1 minuto', range:'3 m',
            duration:'24 horas', concentration:false, combat:false,
            desc:'Animas un montón de huesos o cadáver como zombi o esqueleto bajo tu control (24 hs, renovable).', domain:true },
          { id:'gaseous-form', name:'Gaseous Form', level:3, castTime:'1 acción', range:'Toque',
            duration:'1 hora', concentration:true, combat:false,
            desc:'Transformas a una criatura voluntaria en una nube de gas. Puede volar 3 m, es resistente a varios daños.', domain:true },
        ] : []),
        // Nv5
        ...(nivel >= 5 ? [
          { id:'blight', name:'Blight', level:4, castTime:'1 acción', range:'27 m',
            duration:'Instantáneo', concentration:false, combat:true,
            desc:'8d8 necrótico (save CON mitad). Las plantas no hacen save y reciben daño máximo.', domain:true },
          { id:'confusion', name:'Confusion', level:4, castTime:'1 acción', range:'27 m',
            duration:'1 minuto', concentration:true, combat:true,
            desc:'Save SAB: criaturas en esfera de 3 m actúan aleatoriamente. Pueden repetir al final de cada turno.', domain:true },
        ] : []),
        // Nv7
        ...(nivel >= 7 ? [
          { id:'contagion', name:'Contagion', level:5, castTime:'1 acción', range:'Toque',
            duration:'7 días', concentration:false, combat:true,
            desc:'Ataque de conjuro cuerpo a cuerpo: infecta con una de 6 enfermedades (Blinding Sickness, Filth Fever, etc.).', domain:true },
          { id:'insect-plague', name:'Insect Plague', level:5, castTime:'1 acción', range:'90 m',
            duration:'10 minutos', concentration:true, combat:true,
            desc:'Esfera de 6 m de langostas picadoras: 4d10 perforante (save CON mitad). Terreno difícil.', domain:true },
        ] : []),
        // Nv9
        ...(nivel >= 9 ? [
          { id:'animate-objects', name:'Animate Objects', level:5, castTime:'1 acción', range:'36 m',
            duration:'1 minuto', concentration:true, combat:true,
            desc:'Animas hasta 10 objetos pequeños o menos pero más grandes. Actúan en tu turno.', domain:true },
          { id:'cloudkill', name:'Cloudkill', level:5, castTime:'1 acción', range:'27 m',
            duration:'10 minutos', concentration:true, combat:true,
            desc:'Nube venenosa de 6 m: 5d8 veneno (save CON mitad). Se mueve 3 m/turno.', domain:true },
        ] : []),
      ],
    },

    'Circle of Stars': {
      clase: 'Druida',
      resources: (nivel) => [
        { id:'wild-shape-stars', name:'Wild Shape',
          current: 2, max: 2, recharge:'short',
          note:`CR máx ${nivel>=8?1:0.5}` },
        { id:'starry-form', name:'Starry Form',
          current: Math.max(1, Math.floor((nivel||1)/2)),
          max:     Math.max(1, Math.floor((nivel||1)/2)),
          recharge:'long',
          note:'Archer · Chalice · Dragon — SAB mod/Long Rest' },
      ],
      features: (nivel) => [
        { id:'stars-star-map', name:'Star Map',
          source:'Circle of Stars · Nv2', type:'passive', action:'Pasiva', range:'Personal', recharge:null,
          desc:'Tenés un mapa estelar que funciona como foco druídico. Podés lanzar Guidance a voluntad y preparás Guiding Bolt gratis. SAB mod veces/Long Rest podés lanzarlo sin slot.',
          fullDesc:'A nivel 2, has creado un mapa estelar. Funciona como foco druídico. Puedes lanzar Guidance sin gastar slot como cantrip. Guiding Bolt siempre está preparado y no cuenta para tu límite. Puedes lanzar Guiding Bolt sin gastar un slot un número de veces igual a tu modificador de SAB por Long Rest.' },
        { id:'stars-starry-form', name:'Starry Form',
          source:'Circle of Stars · Nv2', type:'active', action:'Acción bonus (Wild Shape)', range:'Personal', recharge:'Long Rest',
          desc:'Gastás un uso de Wild Shape: te bañás en luz estelar (brillás) y elegís una constelación: Archer (Guiding Bolt bonus), Chalice (curación bonus al lanzar conjuros), Dragon (ventaja en Concentración).',
          fullDesc:'A nivel 2, puedes hacer brillar tu cuerpo con luz estelar. Cuando usas Wild Shape, en vez de transformarte (o además), puedes gastar un uso para asumir la Starry Form durante 10 minutos. Emites luz tenue en 3 metros y elegís una constelación: Archer — cuando lanzás un hechizo, como acción adicional hacés un ataque de conjuro con 1d8+SAB daño radiante a 18 m. Chalice — cuando lanzas un conjuro de curación, podés tirar 1d8+SAB y curar a una criatura a 9 m. Dragon — haces tiradas de Concentración con ventaja y tienes mínimo de 10 en tiradas de SAB.' },
        ...(nivel >= 6 ? [{ id:'stars-cosmic-omen', name:'Cosmic Omen',
          source:'Circle of Stars · Nv6', type:'active', action:'Ninguna (Long Rest)', range:'9 m', recharge:'Long Rest',
          desc:'Al descansar tirás 1d6: impar = Weal (reacción para +1d6 a tirada aliado), par = Woe (reacción para -1d6 a tirada enemigo). SAB mod veces/Long Rest.',
          fullDesc:'A nivel 6, puedes auscultar los cielos para presagiar el futuro. Al terminar un Long Rest, tirás 1d6. Si es impar tenés Weal, si es par tenés Woe. Tienes tantos usos como tu modificador de SAB. Weal — como reacción, cuando una criatura a 9 m hace una tirada, le agregás 1d6. Woe — como reacción, cuando una criatura a 9 m hace una tirada, le restás 1d6.' }] : []),
        ...(nivel >= 10 ? [{ id:'stars-twinkling-constellations', name:'Twinkling Constellations',
          source:'Circle of Stars · Nv10', type:'passive', action:'Pasiva', range:'Personal', recharge:null,
          desc:'Las constelaciones de Starry Form mejoran: Archer dispara dos rayos, Chalice cura también a vos, Dragon otorga vuelo 6 m/turno.',
          fullDesc:'A nivel 10, las constelaciones de tu Starry Form brillan más. Archer — el ataque dispara dos rayos de luz (cada uno 1d8+SAB). Chalice — la curación también te sana a vos por la misma cantidad. Dragon — obtienes velocidad de vuelo de 6 metros al inicio de cada turno (movimiento de viento).' }] : []),
        ...(nivel >= 14 ? [{ id:'stars-full-of-stars', name:'Full of Stars',
          source:'Circle of Stars · Nv14', type:'passive', action:'Pasiva', range:'Personal', recharge:null,
          desc:'Mientras Starry Form está activa, eres incorpóreo: resistencia a daño contundente, cortante y perforante de ataques no mágicos.',
          fullDesc:'A nivel 14, mientras tu Starry Form está activa, te vuelves parcialmente incorpóreo. Tienes resistencia al daño contundente, cortante y perforante de ataques no mágicos.' }] : []),
      ],
      subclassSpells: () => [
        // Guiding Bolt: siempre preparado (Star Map feature a nv2). No ocupa cupo de preparación.
        { id:'guiding-bolt', name:'Guiding Bolt', level:1, castTime:'1 acción', range:'36 m',
          duration:'1 ronda', concentration:false, combat:true,
          desc:'Ataque de conjuro a distancia: 4d6 radiante. El próximo ataque contra el objetivo tiene ventaja.',
          domain:true },
        // Guidance: disponible como cantrip libre (Star Map). Cantrip extra, no ocupa cupo.
        { id:'guidance', name:'Guidance', level:0, castTime:'1 acción', range:'Toque',
          duration:'Concentración, hasta 1 min', concentration:true, combat:false,
          desc:'Una criatura voluntaria puede tirar 1d4 y sumar el resultado a una prueba de habilidad.',
          cantrip_subclass:true },
      ],
    },

    // ── PÍCARO ────────────────────────────────────────────────────────────────
    'Arcane Trickster': {
      clase: 'Pícaro',
      resources: () => [],
      features: (nivel) => [
        { id:'at-spellcasting', name:'Spellcasting (INT)',
          source:'Arcane Trickster · Nv3', type:'active', action:'Varía', range:'Varía', recharge:null,
          desc:'Conjuros de Mago usando INT. Slots de tercio-caster.',
          fullDesc:'Usas Inteligencia como stat de conjuro. Accedes a una lista limitada de conjuros de Mago, principalmente de las escuelas de Encantamiento e Ilusión.' },
        ...(nivel >= 9 ? [{ id:'at-magical-ambush', name:'Magical Ambush',
          source:'Arcane Trickster · Nv9', type:'passive', action:'Pasiva', range:'Personal', recharge:null,
          desc:'Si estás oculto al lanzar un conjuro, el objetivo tiene desventaja en el save.',
          fullDesc:'A nivel 9, si estás oculto de una criatura cuando le lanzas un conjuro, tiene desventaja en la tirada de salvación que haga contra ese conjuro este turno.' }] : []),
        ...(nivel >= 13 ? [{ id:'at-misdirection', name:'Misdirection',
          source:'Arcane Trickster · Nv13', type:'active', action:'Acción bonus', range:'9m', recharge:null,
          desc:'Haz que una criatura mire a otro lado — otorgás ventaja a tus aliados para esconderse.',
          fullDesc:'Puedes usar una acción adicional para redirigir la atención de una criatura que puedas ver y que esté a 9 metros.' }] : []),
        ...(nivel >= 17 ? [{ id:'at-spell-thief', name:'Spell Thief',
          source:'Arcane Trickster · Nv17', type:'active', action:'Reacción', range:'9m', recharge:'Long Rest',
          desc:'1/Long Rest: si una criatura falla un save contra un conjuro tuyo, le robás ese conjuro por 8 h.',
          fullDesc:'A nivel 17 puedes robar el conocimiento de cómo lanzar un conjuro de otro lanzador. Inmediatamente después de que una criatura lance un conjuro que te tenga a ti como objetivo o te incluya en su área, puedes usar tu reacción para forzar a la criatura a hacer un save de CAR. Si falla, niegas los efectos del conjuro contra ti y robas el conocimiento del conjuro si es de un nivel que puedas lanzar. Puedes lanzarlo una vez en las próximas 8 horas usando tus slots.' }] : []),
      ],
    },

    'Thief': {
      clase: 'Pícaro',
      resources: () => [],
      features: (nivel) => [
        { id:'thief-fast-hands', name:'Fast Hands',
          source:'Thief · Nv3', type:'active', action:'Acción bonus', range:'Varía', recharge:null,
          desc:'Usás Cunning Action para también hacer: Sleight of Hand, usar herramientas de ladrón, o interactuar con un objeto.',
          fullDesc:'A nivel 3 puedes usar la acción adicional que te otorga Cunning Action para hacer una prueba de Destreza (Juego de Manos), usar tus herramientas de ladrón para desactivar una trampa o abrir una cerradura, o tomar la acción de Uso de Objeto.' },
        { id:'thief-second-story', name:'Second-Story Work',
          source:'Thief · Nv3', type:'passive', action:'Pasiva', range:'Personal', recharge:null,
          desc:'Escalada sin penalización de velocidad. Salto largo y alto usando DES en lugar de FUE.',
          fullDesc:'A nivel 3 ganas la habilidad de escalar más rápido que lo normal; trepar ya no cuesta movimiento adicional. Además cuando haces un salto largo, la distancia que recorres aumenta en un número de pies igual a tu modificador de Destreza.' },
        ...(nivel >= 9 ? [{ id:'thief-supreme-sneak', name:'Supreme Sneak',
          source:'Thief · Nv9', type:'passive', action:'Pasiva', range:'Personal', recharge:null,
          desc:'Podés intentar esconderte como acción bonus si te moviste no más de la mitad de tu velocidad.',
          fullDesc:'A nivel 9, puedes usar una acción adicional para intentar esconderte. Si te mueves no más de la mitad de tu velocidad en el mismo turno, haces la prueba de Sigilo con ventaja.' }] : []),
        ...(nivel >= 13 ? [{ id:'thief-use-magic-device', name:'Use Magic Device',
          source:'Thief · Nv13', type:'passive', action:'Pasiva', range:'Personal', recharge:null,
          desc:'Podés usar objetos mágicos que normalmente requieren ser de una clase específica, raza u otro requisito.',
          fullDesc:'A nivel 13 has aprendido suficiente sobre el funcionamiento de la magia que puedes improvisar el uso de elementos para los que no fuiste entrenado. Ignoras todos los requisitos de clase, raza y nivel para el uso de objetos mágicos.' }] : []),
        ...(nivel >= 17 ? [{ id:'thief-thief-reflexes', name:'Thief\'s Reflexes',
          source:'Thief · Nv17', type:'passive', action:'Pasiva', range:'Personal', recharge:null,
          desc:'En la primera ronda de cada combate, podés tomar dos turnos (al inicio y al final de la ronda).',
          fullDesc:'A nivel 17 te vuelves especialmente bueno en emboscadas y actuaciones rápidas. Puedes tomar dos turnos durante la primera ronda de cualquier combate. Tomas tu primer turno con tu iniciativa normal y tu segundo turno con tu iniciativa menos 10.' }] : []),
      ],
    },

    'Phantom': {
      clase: 'Pícaro',
      resources: (nivel) => [
        { id:'tokens-of-the-departed', name:'Tokens of the Departed',
          current: nivel >= 9 ? 2 : 1, max: nivel >= 9 ? 2 : 1, recharge:'long',
          note:'Token de alma · +1d8 daño necrótico · proficiencia temporal' },
      ],
      features: (nivel) => [
        { id:'ph-whispers-dead', name:'Whispers of the Dead',
          source:'Phantom · Nv3', type:'passive', action:'Pasiva', range:'Personal', recharge:'Short/Long Rest',
          desc:'Tras un descanso corto/largo, ganás proficiencia en una habilidad o herramienta hasta el próximo descanso.',
          fullDesc:'A nivel 3 los susurros de los muertos que te rodean pueden otorgarte conocimiento. Cuando terminas un descanso corto o largo, ganas proficiencia en una habilidad o herramienta de tu elección hasta que uses esta característica de nuevo.' },
        { id:'ph-wails-from-grave', name:'Wails from the Grave',
          source:'Phantom · Nv3', type:'active', action:'Sneak Attack', range:'18 m', recharge:'Long Rest',
          desc:`Inmediatamente después de aplicar Sneak Attack a un humanoide vivo, hacés ${Math.ceil(nivel/2)}d6 daño necrótico a una segunda criatura a 9 m.`,
          fullDesc:'A nivel 3 puedes canalizar el dolor de los muertos. Inmediatamente después de hacer daño de Sneak Attack en tu turno, puedes hacer que un segundo objetivo dentro de 9 metros sufra la mitad del daño de Sneak Attack (redondeado hacia abajo) en daño necrótico, sin tirada de ataque. Puedes usar esta habilidad un número de veces igual a tu Prof Bonus por descanso largo.' },
        ...(nivel >= 9 ? [{ id:'ph-tokens-departed', name:'Tokens of the Departed',
          source:'Phantom · Nv9', type:'active', action:'Reacción', range:'18 m', recharge:'Long Rest',
          desc:'Cuando una criatura a 18 m muere, podés crear un token de su alma. Gasta el token: +1d8 necrótico al daño, o proficiencia en una habilidad/herramienta que tenía el muerto.',
          fullDesc:'A nivel 9, cuando una criatura muere a 18 metros de ti puedes usar tu reacción para crear un pequeño token de su alma. Este token se mantiene durante 10 minutos. Puedes gastar el token para añadir 1d8 de daño necrótico extra a tu Sneak Attack, o para ganar proficiencia en una habilidad o herramienta que tuviera la criatura.' }] : []),
        ...(nivel >= 13 ? [{ id:'ph-ghost-walk', name:'Ghost Walk',
          source:'Phantom · Nv13', type:'active', action:'Acción bonus', range:'Personal', recharge:'Long Rest',
          desc:'1/Long Rest: te volvés incorpóreo hasta por 10 min. Podés pasar a través de objetos/criaturas, sos resistente a no-mágicos, ignorás terreno difícil.',
          fullDesc:'A nivel 13 puedes asumir una forma etérea parecida a un fantasma. Como acción adicional puedes volverte incorpóreo hasta 10 minutos (hasta 1 hora a nivel 17). Mientras sos incorpóreo: puedes mover a través de otras criaturas y objetos como terreno difícil; sufres 1d10 de fuerza si terminás el turno dentro de un objeto; resistencia a daño de ataques no mágicos; no puedes ser Agarrado, Prone, Restringido, Aturdido. Puedes terminar antes con bonus action.' }] : []),
        ...(nivel >= 17 ? [{ id:'ph-death-knell', name:'Death\'s Friend',
          source:'Phantom · Nv17', type:'passive', action:'Pasiva', range:'Personal', recharge:null,
          desc:'Wails from the Grave ya no cuesta un uso. Cuando hacés Sneak Attack, una de tus Sneak Attack dice puede ser necrótico en lugar del tipo normal.',
          fullDesc:'A nivel 17 los muertos y tú son verdaderos aliados. Ganas estas ventajas:\n\n• Puedes usar Wails from the Grave sin gastar ningún uso.\n• Cuando haces daño de Sneak Attack, un dado del daño de Sneak Attack puede ser necrótico en lugar del tipo de daño normal del arma.' }] : []),
      ],
    },

    'Swashbuckler': {
      clase: 'Pícaro',
      resources: () => [],
      features: (nivel) => [
        { id:'sw-fancy-footwork', name:'Fancy Footwork',
          source:'Swashbuckler · Nv3', type:'passive', action:'Pasiva', range:'Personal', recharge:null,
          desc:'Si atacás a una criatura en melee durante tu turno, no te hace ataque de oportunidad ese turno.',
          fullDesc:'A nivel 3 aprendes a maniobrar ágilmente. Durante tu turno, si haces un ataque cuerpo a cuerpo contra una criatura, esa criatura no puede hacer ataques de oportunidad contra ti por el resto de tu turno.' },
        { id:'sw-rakish-audacity', name:'Rakish Audacity',
          source:'Swashbuckler · Nv3', type:'passive', action:'Pasiva', range:'Personal', recharge:null,
          desc:'Podés hacer Sneak Attack si sos el único enemigo adyacente al objetivo (no necesitás ventaja). Sumás CAR mod a tiradas de iniciativa.',
          fullDesc:'A nivel 3 tu confianza en combate aumenta tu agilidad mental. Ganas estos beneficios:\n\n• Tu modificador de Carisma se suma a las tiradas de iniciativa.\n• No necesitas ventaja para hacer Sneak Attack si solo tú estás adyacente al objetivo y nadie te tiene Desventaja.' },
        ...(nivel >= 9 ? [{ id:'sw-panache', name:'Panache',
          source:'Swashbuckler · Nv9', type:'active', action:'Acción bonus', range:'9 m', recharge:null,
          desc:'Acción bonus: desafío a una criatura. Enemigo: tiene desventaja en ataques a otros y no puede moverte como parte de su acción. Aliado/neutral: Encantado mientras permanezca a 18m.',
          fullDesc:'A nivel 9 tu desenvoltura en batalla puede influir sobre los demás. Como acción adicional, puedes hacer una prueba de Carisma (Persuasión) contra la Perspicacia pasiva de una criatura que pueda oírte y que esté a 18 metros.\n\n• Si la criatura es hostil y fallas: sin efecto.\n• Si la criatura es hostil y tienes éxito: tiene desventaja en tiradas de ataque contra criaturas que no seas tú, y no puede moverte como parte de su movimiento.\n• Si la criatura no es hostil: está Encantada por ti durante 1 minuto o hasta que tú o tus compañeros le hagáis daño.' }] : []),
        ...(nivel >= 13 ? [{ id:'sw-elegant-maneuver', name:'Elegant Maneuver',
          source:'Swashbuckler · Nv13', type:'active', action:'Acción bonus', range:'Personal', recharge:null,
          desc:'Acción bonus: ventaja en el próximo check de Atletismo o Acrobacias de este turno.',
          fullDesc:'A nivel 13 puedes usar una acción adicional en tu turno para tener ventaja en la siguiente prueba de Atletismo o Acrobacias que hagas en ese mismo turno.' }] : []),
        ...(nivel >= 17 ? [{ id:'sw-master-duelist', name:'Master Duelist',
          source:'Swashbuckler · Nv17', type:'active', action:'Ninguna', range:'Personal', recharge:'Short/Long Rest',
          desc:'1/Short Rest: si fallás un ataque, podés tirar de nuevo con ventaja.',
          fullDesc:'A nivel 17 tu maestría en duelos es incomparable. Si fallas una tirada de ataque, puedes tirar de nuevo con ventaja. Una vez que uses esta habilidad, debes terminar un descanso corto o largo antes de volver a usarla.' }] : []),
      ],
    },

    // ── MONJE ─────────────────────────────────────────────────────────────────
    'Way of the Open Hand': {
      clase: 'Monje',
      resources: () => [],
      features: (nivel) => [
        { id:'woh-open-hand-technique', name:'Open Hand Technique',
          source:'Way of the Open Hand · Nv3', type:'active', action:'Acción (Flurry)', range:'Melee', recharge:null,
          desc:'Al usar Flurry of Blows: tumba, empuja 4,5m o niega reacciones hasta fin de su turno.',
          fullDesc:'Cuando golpeas con Flurry of Blows, puedes imponer uno de estos efectos: el objetivo debe superar un save de DES o caer Prone; el objetivo debe superar un save de FUE o ser empujado hasta 4,5 metros; el objetivo no puede hacer reacciones hasta el inicio de tu próximo turno.' },
        ...(nivel >= 6 ? [{ id:'woh-wholeness-of-body', name:'Wholeness of Body',
          source:'Way of the Open Hand · Nv6', type:'active', action:'Acción bonus', range:'Personal', recharge:'Long Rest',
          desc:'Recupera HP iguales a 3 × tu nivel de Monje (1/Long Rest).',
          fullDesc:'Ganas la capacidad de curarte a ti mismo. Como acción adicional, puedes recuperar puntos de golpe iguales a tres veces tu nivel de monje. Debes terminar un descanso largo antes de poder usar esta habilidad de nuevo.' }] : []),
        ...(nivel >= 11 ? [{ id:'woh-tranquility', name:'Tranquility',
          source:'Way of the Open Hand · Nv11', type:'active', action:'Descanso largo', range:'Personal', recharge:'Long Rest',
          desc:'Al final de un Long Rest, ganás el efecto de Sanctuary hasta que ataques o lances un conjuro.',
          fullDesc:'A nivel 11, puedes entrar en un estado de meditación profunda. Al final de un descanso largo, obtienes el efecto del conjuro Sanctuary hasta el comienzo de tu próximo descanso largo, hasta que causes daño, o hasta que obligues a una criatura a hacer una tirada de salvación. Cualquier criatura que intente atacarte debe hacer un save de SAB.' }] : []),
        ...(nivel >= 17 ? [{ id:'woh-quivering-palm', name:'Quivering Palm',
          source:'Way of the Open Hand · Nv17', type:'active', action:'Ataque (1 Ki)', range:'Melee', recharge:null,
          desc:'1 Ki: al golpear, siembras vibraciones. Después podés usar acción para reducir al objetivo a 0 HP (save CON negación).',
          fullDesc:'A nivel 17 puedes establecer vibraciones letales dentro del cuerpo de alguien. Cuando golpeas a una criatura con un ataque desarmado, puedes gastar 3 puntos de ki para comenzar estas vibraciones imperceptibles que duran un número de días igual a tu nivel de monje. Las vibraciones son inofensivas a menos que uses tu acción para terminarlas. Para ello, tú y el objetivo deben estar en el mismo plano. Puedes hacerlo reduciendo al objetivo a 0 HP automáticamente, o el objetivo hace un save de CON (DC = 8 + Prof + SAB); si falla, cae a 0 HP.' }] : []),
      ],
    },

    'Way of Shadow': {
      clase: 'Monje',
      resources: () => [],
      features: (nivel) => [
        { id:'shadow-arts', name:'Shadow Arts',
          source:'Way of Shadow · Nv3', type:'active', action:'Acción (Ki)', range:'60 m', recharge:null,
          desc:'Gastás 2 Ki para lanzar Darkness, Darkvision, Pass Without Trace, o Silence sin componentes. Podés ver en tu propia Darkness.',
          fullDesc:'Al nivel 3 podés usar tu ki para duplicar los efectos de ciertos conjuros. Como acción podés gastar 2 puntos de ki para lanzar Darkness, Darkvision, Pass Without Trace o Silence sin necesitar componentes de conjuro. También podés gastar 1 punto de ki para lanzar Minor Illusion. Cuando lanzás Darkness con esta feature, podés ver dentro de la oscuridad que creás.' },
        ...(nivel >= 6 ? [{ id:'shadow-step', name:'Shadow Step',
          source:'Way of Shadow · Nv6', type:'active', action:'Acción bonus', range:'18 m', recharge:null,
          desc:'Teletransportate entre dos zonas de penumbra u oscuridad a 18 m. Tenés ventaja en el primer ataque del turno.',
          fullDesc:'Al nivel 6 ganás la habilidad de moverte de sombra en sombra. Cuando estás en penumbra u oscuridad, como acción adicional podés teletransportarte hasta 18 metros a un espacio desocupado que también esté en penumbra u oscuridad. Después, tenés ventaja en el primer ataque cuerpo a cuerpo que hagas antes del fin del turno.' }] : []),
        ...(nivel >= 11 ? [{ id:'shadow-cloak', name:'Cloak of Shadows',
          source:'Way of Shadow · Nv11', type:'active', action:'Acción', range:'Personal', recharge:null,
          desc:'En penumbra u oscuridad, podés volverte Invisible usando una acción. La invisibilidad termina si atacás o lanzás un conjuro.',
          fullDesc:'Al nivel 11, cuando estás en un área de penumbra u oscuridad, podés usar tu acción para volverte invisible. La invisibilidad dura hasta que realices un ataque, lances un conjuro o estés en un área de luz brillante.' }] : []),
        ...(nivel >= 17 ? [{ id:'shadow-opportunist', name:'Opportunist',
          source:'Way of Shadow · Nv17', type:'active', action:'Reacción', range:'1,5 m', recharge:null,
          desc:'Cuando una criatura adyacente es golpeada por otro atacante, podés usar tu reacción para atacarla.',
          fullDesc:'Al nivel 17 podés explotar el momento en que un oponente es golpeado. Cuando una criatura que está a 1,5 metros de ti es golpeada por un ataque de otra criatura, podés usar tu reacción para hacer un ataque cuerpo a cuerpo contra esa criatura.' }] : []),
      ],
    },

    'Way of the Four Elements': {
      clase: 'Monje',
      resources: () => [],
      features: (nivel) => [
        { id:'4e-disciple', name:'Disciple of the Elements',
          source:'Way of the Four Elements · Nv3', type:'passive', action:'Pasiva', range:'Personal', recharge:null,
          desc:'Aprendés Elemental Attunement (cantrip gratuito) y dos Elemental Disciplines. Podés lanzar conjuros elementales gastando Ki.',
          fullDesc:'Al nivel 3 aprendés disciplinas mágicas que canalizan el poder de los cuatro elementos. Conocés Elemental Attunement (sin costo de Ki) y elegís 2 disciplinas elementales adicionales. Cada vez que subís de nivel podés reemplazar una disciplina por otra. Las disciplinas requieren gastar puntos de Ki para activarse (costo equivalente al nivel del conjuro).' },
        ...(nivel >= 6 ? [{ id:'4e-extra-discipline', name:'Extra Elemental Discipline (Nv6)',
          source:'Way of the Four Elements · Nv6', type:'passive', action:'Pasiva', range:'Personal', recharge:null,
          desc:'Aprendés una disciplina elemental adicional. También podés usar disciplinas de nivel más alto (hasta nv3 de conjuro con 3 Ki).',
          fullDesc:'Al nivel 6 aprendés una disciplina elemental adicional. Algunas disciplinas avanzadas requieren nivel mínimo de monje para aprenderse (indicado en la descripción de cada una). A este nivel ya podés acceder a las disciplinas que lanzan conjuros de nivel 2 y 3.' }] : []),
        ...(nivel >= 11 ? [{ id:'4e-extra-discipline-11', name:'Extra Elemental Discipline (Nv11)',
          source:'Way of the Four Elements · Nv11', type:'passive', action:'Pasiva', range:'Personal', recharge:null,
          desc:'Aprendés una tercera disciplina adicional. Podés acceder a disciplinas que requieren nivel 11 (conjuros de hasta nv4 con 4 Ki).',
          fullDesc:'Al nivel 11 aprendés otra disciplina elemental adicional y podés acceder a las disciplinas que requieren ser al menos nivel 11 de monje. A este nivel podés gastar hasta 4 Ki para lanzar conjuros elementales de nivel 4.' }] : []),
        ...(nivel >= 17 ? [{ id:'4e-extra-discipline-17', name:'Extra Elemental Discipline (Nv17)',
          source:'Way of the Four Elements · Nv17', type:'passive', action:'Pasiva', range:'Personal', recharge:null,
          desc:'Aprendés una cuarta disciplina adicional. Podés acceder a disciplinas que requieren nivel 17 (conjuros de hasta nv5 con 5 Ki).',
          fullDesc:'Al nivel 17 aprendés otra disciplina elemental y podés acceder a las disciplinas más poderosas del camino. Podés gastar hasta 5 Ki para lanzar conjuros elementales de nivel 5.' }] : []),
      ],
    },

    'Way of the Astral Self': {
      clase: 'Monje',
      resources: () => [],
      features: (nivel) => [
        { id:'astral-arms', name:'Arms of the Astral Self',
          source:'Way of the Astral Self · Nv3', type:'active', action:'Acción bonus (1 Ki)', range:'3 m', recharge:null,
          desc:'Convocás brazos astrales que duran 10 min. Podés usar SAB en ataques desarmados y atacar a distancia (3 m). Los ataques usan el dado Martial Arts.',
          fullDesc:'Al nivel 3, podés gastar 1 punto de ki (acción adicional) para hacer surgir los brazos de tu yo astral. Estos brazos están a 3 metros y duran 10 minutos. Mientras estén activos: podés usar tu modificador de SAB en lugar de FUE/DES en tiradas de ataque y daño con ataques desarmados; los ataques desarmados tienen un alcance de 3 metros; si un ataque daña a alguien puede aplicar tu dado de Martial Arts.' },
        ...(nivel >= 6 ? [{ id:'astral-visage', name:'Visage of the Astral Self',
          source:'Way of the Astral Self · Nv6', type:'active', action:'Acción bonus (1 Ki)', range:'Personal', recharge:null,
          desc:'Convocás el rostro astral: ventaja en Intimidación/Perspicacia basadas en SAB, visión en oscuridad 24 m, y entendés todos los idiomas.',
          fullDesc:'Al nivel 6, podés gastar 1 punto de ki como acción adicional para hacer surgir el rostro de tu yo astral. El rostro dura 10 minutos. Mientras esté activo: tenés ventaja en checks de Intimidación y Perspicacia que usen SAB; tenés visión en la oscuridad hasta 24 metros; entendés todos los idiomas escritos y hablados.' }] : []),
        ...(nivel >= 11 ? [{ id:'astral-body', name:'Body of the Astral Self',
          source:'Way of the Astral Self · Nv11', type:'passive', action:'Pasiva (cuando Arms activos)', range:'Personal', recharge:null,
          desc:'Cuando los Arms of the Astral Self están activos: resistencia a daño contundente/cortante/perforante, y podés usar reacción para reducir daño recibido en 1d10+SAB.',
          fullDesc:'Al nivel 11, cuando tus Arms of the Astral Self están activos, tu yo astral protege tu cuerpo. Tenés resistencia a daño contundente, cortante y perforante. Además, cuando vos u otra criatura a 1,5 metros que podés ver recibís daño, podés usar tu reacción para reducir ese daño en 1d10 + tu modificador de SAB (mínimo 0).' }] : []),
        ...(nivel >= 17 ? [{ id:'astral-complete', name:'Awakened Astral Self',
          source:'Way of the Astral Self · Nv17', type:'active', action:'Acción bonus (5 Ki)', range:'Personal', recharge:null,
          desc:'Convocás la forma astral completa durante 10 min: beneficios de Arms + Visage, AC +2, ataque extra con los brazos astrales en Ataque total.',
          fullDesc:'Al nivel 17 podés gastar 5 puntos de ki como acción adicional para hacer surgir la forma completa de tu yo astral. Dura 10 minutos. Obtenés los beneficios de Arms of the Astral Self y Visage of the Astral Self sin gastar ki en ellos. Tu AC aumenta en 2. Cuando usás la acción de Ataque en tu turno, podés hacer dos ataques adicionales con los Arms of the Astral Self.' }] : []),
      ],
    },

    // ── BÁRBARO ───────────────────────────────────────────────────────────────
    'Path of the Berserker': {
      clase: 'Bárbaro',
      resources: () => [],
      features: (nivel) => [
        { id:'berserk-frenzy', name:'Frenzy',
          source:'Path of the Berserker · Nv3', type:'active', action:'Acción bonus (en Rage)', range:'Melee', recharge:'Long Rest',
          desc:'Mientras estás en Rage, puedes atacar como acción bonus en cada turno. Al terminar el Rage, sufres 1 nivel de agotamiento.',
          fullDesc:'Puedes entrar en un frenesí cuando rages. Si lo haces, mientras dure tu rage puedes hacer un ataque adicional con arma como acción adicional en cada uno de tus turnos. Al terminar el rage, sufres un nivel de agotamiento.' },
        ...(nivel >= 6 ? [{ id:'berserk-mindless-rage', name:'Mindless Rage',
          source:'Path of the Berserker · Nv6', type:'passive', action:'Pasiva', range:'Personal', recharge:null,
          desc:'No podés ser Encantado ni Asustado mientras estás en Rage. Si lo estás al comenzar, el efecto se suspende.',
          fullDesc:'No puedes ser encantado ni asustado mientras estás en furia. Si estás encantado o asustado cuando comienzas tu furia, el efecto queda suspendido durante la furia.' }] : []),
        ...(nivel >= 10 ? [{ id:'berserk-intimidating-presence', name:'Intimidating Presence',
          source:'Path of the Berserker · Nv10', type:'active', action:'Acción', range:'9m', recharge:'Long Rest',
          desc:'Aterrorizás a una criatura que puedas ver en 9 m (save SAB o Asustada 1 turno).',
          fullDesc:'A nivel 10 puedes usar tu acción para aterrorizar a otros. Elige una criatura que puedas ver dentro de 9 metros. Debe superar un save de SAB (DC = 8 + Prof + CAR) o quedará Asustada de ti hasta el final de tu próximo turno. En los turnos siguientes puedes usar tu acción para extender el efecto.' }] : []),
        ...(nivel >= 14 ? [{ id:'berserk-retaliation', name:'Retaliation',
          source:'Path of the Berserker · Nv14', type:'active', action:'Reacción', range:'Melee', recharge:null,
          desc:'Cuando recibís daño de una criatura en 1,5 m, podés usar tu reacción para atacarla.',
          fullDesc:'A nivel 14, cuando recibes daño de una criatura que está a 1,5 metros de ti, puedes usar tu reacción para hacer un ataque cuerpo a cuerpo contra esa criatura.' }] : []),
      ],
    },

    'Path of the Totem Warrior': {
      clase: 'Bárbaro',
      resources: () => [],
      features: (nivel) => [
        { id:'totem-spirit', name:'Totem Spirit',
          source:'Path of the Totem Warrior · Nv3', type:'passive', action:'Pasiva', range:'Personal', recharge:null,
          desc:'Elegís un tótem animal (Oso, Águila o Lobo) que te otorga un beneficio especial mientras estás en Rage.',
          fullDesc:'Al nivel 3 adoptás el espíritu de un animal tótem. Oso: vos y las criaturas adyacentes tienen resistencia a todo daño excepto psíquico mientras rageás. Águila: podés Dash como acción bonus y los ataques de oportunidad contra vos tienen desventaja. Lobo: los aliados cercanos tienen ventaja en ataques cuerpo a cuerpo contra cualquier enemigo adyacente a vos.' },
        ...(nivel >= 6 ? [{ id:'totem-aspect', name:'Aspect of the Beast',
          source:'Path of the Totem Warrior · Nv6', type:'passive', action:'Pasiva', range:'Personal', recharge:null,
          desc:'Ganás un aspecto permanente de tu animal tótem: Oso (cargás el doble), Águila (visión de larga distancia), Lobo (rastreás a ritmo rápido).',
          fullDesc:'Al nivel 6 ganás un beneficio pasivo de tu tótem. Oso: podés cargar el doble del peso normal. Águila: podés ver hasta 1,5 km sin dificultad, y en condiciones de luz normal podés discernir detalles finos. Lobo: podés rastrear a un ritmo rápido y moverse en sigilo a un ritmo normal.' }] : []),
        ...(nivel >= 10 ? [{ id:'totem-attunement', name:'Totemic Attunement',
          source:'Path of the Totem Warrior · Nv10', type:'passive', action:'Pasiva', range:'Personal', recharge:null,
          desc:'Tercer beneficio de tu tótem durante Rage: Oso (criaturas adyacentes con desventaja vs aliados), Águila (vuelo igual a tu velocidad), Lobo (tumbar enemigos con ataques cuerpo a cuerpo).',
          fullDesc:'Al nivel 10 ganás un tercer aspecto de tu tótem. Oso: mientras rageás, las criaturas tienen desventaja en ataques contra aliados tuyos que estén a 1,5 m de vos. Águila: podés volar a tu velocidad de movimiento mientras rageás. Lobo: puedes usar tu acción bonus para tumbar a una criatura Grande o menor que hayas golpeado en ese turno.' }] : []),
        ...(nivel >= 14 ? [{ id:'totem-warrior-14', name:'Totemic Attunement (Nv14)',
          source:'Path of the Totem Warrior · Nv14', type:'passive', action:'Pasiva', range:'Personal', recharge:null,
          desc:'El vínculo con tu espíritu tótem se profundiza; podés comunicarte con animales de tu tipo en rituales especiales.',
          fullDesc:'Al nivel 14 podés completar un ritual de 1 hora en el Plano Etéreo para cambiar de animal tótem. También podés lanzar Beast Sense y Speak with Animals como rituales sin gastar slots.' }] : []),
      ],
    },

    'Path of the Zealot': {
      clase: 'Bárbaro',
      resources: () => [],
      features: (nivel) => [
        { id:'zealot-divine-fury', name:'Divine Fury',
          source:'Path of the Zealot · Nv3', type:'passive', action:'Pasiva', range:'Melee', recharge:null,
          desc:'Mientras estás en Rage, el primer golpe de cada turno inflige 1d6 + mitad de nivel extra de daño radiante o necrótico.',
          fullDesc:'Al nivel 3, mientras estás en Rage, el primer ataque que golpees en cada turno de combate inflige daño extra igual a 1d6 + la mitad de tu nivel de bárbaro. El tipo es radiante o necrótico (lo elegís al tomar esta subclase).' },
        { id:'zealot-warrior-of-gods', name:'Warrior of the Gods',
          source:'Path of the Zealot · Nv3', type:'passive', action:'Pasiva', range:'Personal', recharge:null,
          desc:'Los hechizos de resurrección sobre vos no necesitan material costoso. Tu alma está disponible para ser llamada.',
          fullDesc:'Al nivel 3, tu alma está marcada para la batalla eterna. Los hechizos como Raise Dead, Resurrection o True Resurrection no necesitan componentes materiales costosos cuando se usan en vos.' },
        ...(nivel >= 6 ? [{ id:'zealot-fanatical-focus', name:'Fanatical Focus',
          source:'Path of the Zealot · Nv6', type:'active', action:'Ninguna (al fallar save)', range:'Personal', recharge:'Rage',
          desc:'Cuando fallás un saving throw durante Rage, podés retirar para lanzarlo de nuevo. Usable una vez por Rage.',
          fullDesc:'Al nivel 6, el fervor que te impulsa a luchar puede protegerte de la magia. Si fallás un saving throw mientras estás en Rage, podés retirar el dado. Debés usar el segundo resultado. Solo podés usar esta feature una vez por Rage.' }] : []),
        ...(nivel >= 10 ? [{ id:'zealot-zealous-presence', name:'Zealous Presence',
          source:'Path of the Zealot · Nv10', type:'active', action:'Acción bonus', range:'18 m', recharge:'Long Rest',
          desc:'Lanzás un grito de batalla que otorga ventaja en ataques y saving throws a hasta 10 aliados durante 1 turno.',
          fullDesc:'Al nivel 10 podés inspirar a tus aliados con un rugido de batalla. Como acción bonus podés elegir hasta 10 criaturas (incluyéndote) a 18 m. Hasta el inicio de tu próximo turno, esas criaturas tienen ventaja en tiradas de ataque y saving throws.' }] : []),
        ...(nivel >= 14 ? [{ id:'zealot-rage-beyond-death', name:'Rage Beyond Death',
          source:'Path of the Zealot · Nv14', type:'passive', action:'Pasiva', range:'Personal', recharge:null,
          desc:'Mientras estás en Rage no podés morir por caer a 0 HP. El Rage termina si quedás incapacitado, y entonces sí podés morir normalmente.',
          fullDesc:'Al nivel 14, el poder divino que te impulsa permite que te mantengas en pie. Mientras estás en Rage, caer a 0 puntos de golpe no te hace caer inconsciente. Pero si el Rage termina mientras estás a 0 HP, seguís las reglas normales de muerte. Morís si recibís suficiente daño como para matarte instantáneamente.' }] : []),
      ],
    },

    'Path of Wild Magic': {
      clase: 'Bárbaro',
      resources: () => [],
      features: (nivel) => [
        { id:'wildmagic-surge', name:'Magic Awareness',
          source:'Path of Wild Magic · Nv3', type:'active', action:'Acción', range:'30 m', recharge:'Long Rest',
          desc:'Podés detectar hechizos activos y objetos mágicos en 30 m durante 1 minuto.',
          fullDesc:'Al nivel 3 podés usar tu acción para abrir tu mente a las corrientes de magia. Hasta el inicio de tu próximo turno, sabés si hay hechizos activos o objetos mágicos a 30 m. Usable una vez por Long Rest.' },
        { id:'wildmagic-wild-surge', name:'Wild Surge',
          source:'Path of Wild Magic · Nv3', type:'passive', action:'Pasiva (al entrar en Rage)', range:'Personal', recharge:null,
          desc:'Cada vez que entrás en Rage, un efecto mágico aleatorio surge de vos (tabla de 8 resultados: escudos de fuerza, teletransporte, daño necrótico, etc.).',
          fullDesc:'Al nivel 3, la energía mágica descontrolada explota cuando entras en Rage. Tirá un d8 y consultá la tabla de Wild Surge para determinar el efecto. Los efectos duran hasta el fin del Rage salvo que se indique lo contrario.' },
        ...(nivel >= 6 ? [{ id:'wildmagic-bolstering-magic', name:'Bolstering Magic',
          source:'Path of Wild Magic · Nv6', type:'active', action:'Acción', range:'Toque', recharge:null,
          desc:'Podés otorgar a una criatura (incluyéndote) +1d3 a tiradas de ataque y checks de habilidad por 10 minutos, O restaurarle un slot gastado (hasta nivel 3). Usable POD veces por Long Rest.',
          fullDesc:'Al nivel 6 podés canalizar magia en los aliados. Como acción tocás a una criatura y elegís uno de estos efectos: 1) Por los próximos 10 minutos, puede tirar 1d3 y agregar el resultado a las tiradas de ataque o checks de habilidad que haga. 2) Recupera un slot de hechizo gastado de nivel 3 o menor. Podés usar esta feature tantas veces como tu modificador de POD por Long Rest.' }] : []),
        ...(nivel >= 10 ? [{ id:'wildmagic-unstable-backlash', name:'Unstable Backlash',
          source:'Path of Wild Magic · Nv10', type:'active', action:'Reacción', range:'Personal', recharge:null,
          desc:'Cuando recibís daño o fallás un saving throw durante Rage, podés usar tu reacción para causar otro Wild Surge inmediatamente.',
          fullDesc:'Al nivel 10, mientras estás en Rage, cuando recibís daño o fallás un saving throw podés usar tu reacción para causar inmediatamente un efecto de Wild Surge (tira en la tabla). El efecto activo de Wild Surge actual termina.' }] : []),
        ...(nivel >= 14 ? [{ id:'wildmagic-controlled-surge', name:'Controlled Surge',
          source:'Path of Wild Magic · Nv14', type:'passive', action:'Pasiva', range:'Personal', recharge:null,
          desc:'Cuando tiras en la tabla de Wild Surge, podés tirar el dado dos veces y elegir cuál de los dos efectos aplicar.',
          fullDesc:'Al nivel 14, podés aprovechar la magia salvaje con mayor control. Cada vez que tiras en la tabla de Wild Surge, tirá el d8 dos veces y elegí cuál de los dos efectos ocurre. Si los dos resultados son iguales, ignorá la tabla y elegí vos el efecto.' }] : []),
      ],
    },

    // ── PALADÍN ───────────────────────────────────────────────────────────────
    'Oath of Devotion': {
      clase: 'Paladín',
      subclassSpells: (nivel) => [
        { id:'od-protection-evil',name:'Protection from Evil ◆', level:1, castTime:'Acción',    range:'Toque', duration:'Conc. 10 min',concentration:true, combat:true, domain:true, desc:'Desventaja en ataques de aberraciones/celestiales/elementales/fey/fiends/muertos. Siempre preparado.' },
        { id:'od-sanctuary',     name:'Sanctuary ◆',             level:1, castTime:'Acción bonus',range:'9 m', duration:'1 min',       concentration:false,combat:false,domain:true, desc:'Criaturas deben superar save SAB para atacar al objetivo. Siempre preparado.' },
        ...(nivel >= 5 ? [{ id:'od-lesser-rest',name:'Lesser Restoration ◆', level:2, castTime:'Acción', range:'Toque', duration:'Inst.', concentration:false, combat:false, domain:true, desc:'Elimina enfermedad o condición. Siempre preparado.' }] : []),
        ...(nivel >= 5 ? [{ id:'od-zone-truth', name:'Zone of Truth ◆',       level:2, castTime:'Acción', range:'18 m',  duration:'10 min',concentration:false,combat:false, domain:true, desc:'Esfera 4,5m: criaturas no pueden mentir conscientemente. Siempre preparado.' }] : []),
        ...(nivel >= 9 ? [{ id:'od-beacon-hope',name:'Beacon of Hope ◆',      level:3, castTime:'Acción', range:'9 m',   duration:'Conc. 1 min', concentration:true, combat:false, domain:true, desc:'Ventaja SAB saves y muerte + max en curación. Siempre preparado.' }] : []),
        ...(nivel >= 9 ? [{ id:'od-dispel-magic',name:'Dispel Magic ◆',       level:3, castTime:'Acción', range:'36 m',  duration:'Inst.',       concentration:false, combat:true, domain:true, desc:'Termina conjuros nv3 o menos automáticamente. Siempre preparado.' }] : []),
        ...(nivel >= 13 ? [{ id:'od-freedom-mov',name:'Freedom of Movement ◆',level:4, castTime:'Acción', range:'Toque', duration:'1 h',         concentration:false, combat:true, domain:true, desc:'Inmune terreno difícil mágico y parálisis. Siempre preparado.' }] : []),
        ...(nivel >= 13 ? [{ id:'od-guardian-faith',name:'Guardian of Faith ◆',level:4,castTime:'Acción', range:'9 m',   duration:'8 h',         concentration:false, combat:true, domain:true, desc:'Guardián espectral: 20 radiante a hostiles. Siempre preparado.' }] : []),
        ...(nivel >= 17 ? [{ id:'od-commune',    name:'Commune ◆',             level:5, castTime:'1 min',  range:'Uno mismo',duration:'1 min',      concentration:false, combat:false, domain:true, desc:'Ritual. 3 preguntas sí/no a tu deidad. Siempre preparado.' }] : []),
        ...(nivel >= 17 ? [{ id:'od-flame-strike',name:'Flame Strike ◆',      level:5, castTime:'Acción',  range:'18 m',  duration:'Inst.',       concentration:false, combat:true, domain:true, desc:'4d6 fuego + 4d6 radiante (save DES). Siempre preparado.' }] : []),
      ],
      resources: (nivel) => [
        { id:'channel-divinity-pal', name:'Channel Divinity',
          current: 1, max: 1, recharge:'short',
          note:'Sacred Weapon · Turn the Unholy' },
      ],
      features: (nivel) => [
        { id:'dev-sacred-weapon', name:'Sacred Weapon',
          source:'Oath of Devotion · Nv3', type:'active', action:'Acción bonus', range:'Personal', recharge:'Short/Long Rest',
          desc:'Canal: arma brilla (20ft luz), +CAR mod a tiradas de ataque por 1 min.',
          fullDesc:'Como acción adicional, puedes imbuir un arma que sostienes con energía positiva. Durante 1 minuto, añades tu modificador de Carisma a las tiradas de ataque hechas con esa arma (mínimo +1). El arma también emite luz brillante en un radio de 6 metros.' },
        ...(nivel >= 7 ? [{ id:'dev-aura-of-devotion', name:'Aura of Devotion',
          source:'Oath of Devotion · Nv7', type:'passive', action:'Pasiva', range:'3 m (9m nv18)', recharge:null,
          desc:`Vos y aliados a ${nivel >= 18 ? 9 : 3} m no podés ser Encantados mientras estés consciente.`,
          fullDesc:'A nivel 7, tú y las criaturas amistosas a 3 metros no pueden ser encantadas mientras estés consciente. A nivel 18, el radio aumenta a 9 metros.' }] : []),
        ...(nivel >= 15 ? [{ id:'dev-purity-of-spirit', name:'Purity of Spirit',
          source:'Oath of Devotion · Nv15', type:'passive', action:'Pasiva', range:'Personal', recharge:null,
          desc:'Siempre tenés el efecto de Protection from Evil and Good activo.',
          fullDesc:'A nivel 15, estás siempre bajo el efecto del conjuro Protection from Evil and Good.' }] : []),
        ...(nivel >= 20 ? [{ id:'dev-holy-nimbus', name:'Holy Nimbus',
          source:'Oath of Devotion · Nv20', type:'active', action:'Acción', range:'Personal', recharge:'Long Rest',
          desc:'Aura de 9 m: 10 radiante a enemigos por turno. Ventaja en saves contra conjuros de fiends/muertos.',
          fullDesc:'A nivel 20, como acción puedes emanar un aura de luz solar. Durante 1 minuto, luz brillante en 9 m y tenue 9 m más. Los enemigos que inicien su turno en la luz brillante reciben 10 daño radiante. Además, tienes ventaja en tiradas de salvación contra conjuros lanzados por fiends o muertos vivientes.' }] : []),
      ],
    },

    'Oath of the Ancients': {
      clase: 'Paladín',
      subclassSpells: (nivel) => [
        { id:'oa-ensnaring-strike',name:'Ensnaring Strike ◆', level:1, castTime:'Acción bonus', range:'Uno mismo', duration:'Conc. 1 min', concentration:true, combat:true, domain:true, desc:'Tu próximo ataque puede enredar al objetivo (save FUE). Siempre preparado.' },
        { id:'oa-speak-animals', name:'Speak with Animals ◆', level:1, castTime:'Acción',       range:'Uno mismo', duration:'10 min', concentration:false, combat:false, domain:true, desc:'Comunicación verbal con bestias. Siempre preparado.' },
        ...(nivel >= 5 ? [{ id:'oa-misty-step',  name:'Misty Step ◆',         level:2, castTime:'Acción bonus', range:'Uno mismo', duration:'Inst.',  concentration:false, combat:true, domain:true, desc:'Teleportación 9m a lugar visible. Siempre preparado.' }] : []),
        ...(nivel >= 5 ? [{ id:'oa-moonbeam',    name:'Moonbeam ◆',            level:2, castTime:'Acción',       range:'45 m',  duration:'Conc. 1 min', concentration:true, combat:true, domain:true, desc:'Rayo lunar 1,5m radio: 2d10 radiante/turno (save CON mitad). Siempre preparado.' }] : []),
        ...(nivel >= 9 ? [{ id:'oa-plant-growth',name:'Plant Growth ◆',        level:3, castTime:'Acción',       range:'45 m',  duration:'Inst.',       concentration:false, combat:true, domain:true, desc:'Vegetación: terreno 4× difícil en 30m. Siempre preparado.' }] : []),
        ...(nivel >= 9 ? [{ id:'oa-protection-energy',name:'Protection from Energy ◆', level:3, castTime:'Acción', range:'Toque', duration:'Conc. 1 h', concentration:true, combat:true, domain:true, desc:'Resistencia a 1 tipo de daño elemental. Siempre preparado.' }] : []),
        ...(nivel >= 13 ? [{ id:'oa-ice-storm',  name:'Ice Storm ◆',           level:4, castTime:'Acción',       range:'90 m',  duration:'Inst.',       concentration:false, combat:true, domain:true, desc:'2d8 contundente + 4d6 frío en cilindro. Siempre preparado.' }] : []),
        ...(nivel >= 13 ? [{ id:'oa-stoneskin',  name:'Stoneskin ◆',           level:4, castTime:'Acción',       range:'Toque', duration:'Conc. 1 h',   concentration:true, combat:true, domain:true, desc:'Resistencia a daño no mágico B/P/S. Siempre preparado.' }] : []),
        ...(nivel >= 17 ? [{ id:'oa-commune-nature',name:'Commune with Nature ◆', level:5, castTime:'1 min',     range:'Uno mismo', duration:'Inst.',   concentration:false, combat:false, domain:true, desc:'Ritual. Información del terreno en 4,5 km. Siempre preparado.' }] : []),
        ...(nivel >= 17 ? [{ id:'oa-tree-stride',name:'Tree Stride ◆',         level:5, castTime:'Acción',       range:'Uno mismo', duration:'Conc. 1 min', concentration:true, combat:false, domain:true, desc:'Teleportación entre árboles del mismo tipo. Siempre preparado.' }] : []),
      ],
      resources: (nivel) => [
        { id:'channel-divinity-anc', name:'Channel Divinity',
          current: 1, max: 1, recharge:'short',
          note:'Nature\'s Wrath · Turn the Faithless' },
      ],
      features: (nivel) => [
        { id:'anc-natures-wrath', name:"Nature's Wrath",
          source:'Oath of the Ancients · Nv3', type:'active', action:'Acción', range:'3 m', recharge:'Short/Long Rest',
          desc:'Canal: enredás a una criatura con plantas (save FUE o DES para liberarse, velocidad 0 mientras esté atrapada).',
          fullDesc:'Puedes usar tu Channel Divinity para envolver a una criatura en vides mágicas. Como acción, eliges una criatura a 3 metros. El objetivo debe superar un save de FUE o DES (a su elección) o quedará Restrained. Puede repetir el save al final de cada uno de sus turnos.' },
        { id:'anc-turn-faithless', name:'Turn the Faithless',
          source:'Oath of the Ancients · Nv3', type:'active', action:'Acción', range:'9 m', recharge:'Short/Long Rest',
          desc:'Canal: fiends y fey en 9 m deben superar save de SAB o huir 1 minuto.',
          fullDesc:'Puedes usar tu Channel Divinity para ahuyentar a los enemigos de la naturaleza. Como acción, presentas tu símbolo sagrado y fiends y fey que puedan verte a 9 metros deben superar un save de SAB o quedar Asustados durante 1 minuto.' },
        ...(nivel >= 7 ? [{ id:'anc-aura-of-warding', name:'Aura of Warding',
          source:'Oath of the Ancients · Nv7', type:'passive', action:'Pasiva', range:`${nivel >= 18 ? 9 : 3} m`, recharge:null,
          desc:`Vos y aliados a ${nivel >= 18 ? 9 : 3} m tienen resistencia al daño de conjuros.`,
          fullDesc:'A nivel 7, la magia antigua que juraste preservar rodea a tus aliados. Tú y las criaturas amistosas a 3 metros (9 m a nv18) tenéis resistencia al daño causado por conjuros.' }] : []),
        ...(nivel >= 15 ? [{ id:'anc-undying-sentinel', name:'Undying Sentinel',
          source:'Oath of the Ancients · Nv15', type:'passive', action:'Pasiva', range:'Personal', recharge:'Long Rest',
          desc:'Cuando caés a 0 HP podés quedar en 1 HP en su lugar (1/Long Rest). No envejecés.',
          fullDesc:'A nivel 15, cuando caerías a 0 puntos de golpe y no morirías instantáneamente, puedes optar por quedar en 1 HP en su lugar. No puedes volver a usar esta feature hasta completar un Long Rest. Además, ya no envejecés.' }] : []),
        ...(nivel >= 20 ? [{ id:'anc-elder-champion', name:'Elder Champion',
          source:'Oath of the Ancients · Nv20', type:'active', action:'Acción bonus', range:'Personal', recharge:'Long Rest',
          desc:'Te transformás en un avatar de la naturaleza (1 min): curación 10 HP/turno, conjuros como acción bonus, aura afecta fiends/fey automáticamente.',
          fullDesc:'A nivel 20, puedes asumir la forma de una antigua fuerza de la naturaleza. Como acción adicional, te transformas durante 1 minuto: recuperas 10 HP al inicio de cada turno; puedes lanzar conjuros de paladín como acción adicional (además de tu acción normal); los fiends y las fey tienen desventaja en sus saves contra tus conjuros y Channel Divinity.' }] : []),
      ],
    },

    'Oath of Vengeance': {
      clase: 'Paladín',
      subclassSpells: (nivel) => [
        { id:'ov-bane',          name:'Bane ◆',               level:1, castTime:'Acción',       range:'9 m',   duration:'Conc. 1 min', concentration:true, combat:true, domain:true, desc:'Hasta 3 criaturas: save CAR o -1d4 en ataques y saves. Siempre preparado.' },
        { id:'ov-hunters-mark',  name:"Hunter's Mark ◆",       level:1, castTime:'Acción bonus', range:'27 m',  duration:'Conc. 1 h',   concentration:true, combat:true, domain:true, desc:'+1d6 daño vs objetivo marcado + ventaja en Perception/Survival contra él. Siempre preparado.' },
        ...(nivel >= 5 ? [{ id:'ov-hold-person',name:'Hold Person ◆',          level:2, castTime:'Acción',       range:'18 m',  duration:'Conc. 1 min', concentration:true, combat:true, domain:true, desc:'Save SAB o paralizado. Siempre preparado.' }] : []),
        ...(nivel >= 5 ? [{ id:'ov-misty-step', name:'Misty Step ◆',           level:2, castTime:'Acción bonus', range:'Uno mismo', duration:'Inst.',  concentration:false, combat:true, domain:true, desc:'Teleportación 9m a lugar visible. Siempre preparado.' }] : []),
        ...(nivel >= 9 ? [{ id:'ov-haste',      name:'Haste ◆',                level:3, castTime:'Acción',       range:'9 m',   duration:'Conc. 1 min', concentration:true, combat:true, domain:true, desc:'+2 CA, vel ×2, acción extra (ataque/Dash). Siempre preparado.' }] : []),
        ...(nivel >= 9 ? [{ id:'ov-protection-energy',name:'Protection from Energy ◆', level:3, castTime:'Acción', range:'Toque', duration:'Conc. 1 h', concentration:true, combat:true, domain:true, desc:'Resistencia a 1 tipo daño elemental. Siempre preparado.' }] : []),
        ...(nivel >= 13 ? [{ id:'ov-banishment',name:'Banishment ◆',           level:4, castTime:'Acción',       range:'18 m',  duration:'Conc. 1 min', concentration:true, combat:true, domain:true, desc:'Save CAR o desterrado al plano de origen. Siempre preparado.' }] : []),
        ...(nivel >= 13 ? [{ id:'ov-dim-door',  name:'Dimension Door ◆',        level:4, castTime:'Acción',       range:'150 m', duration:'Inst.',       concentration:false, combat:true, domain:true, desc:'Teleportación vos + 1 aliado. Siempre preparado.' }] : []),
        ...(nivel >= 17 ? [{ id:'ov-hold-monster',name:'Hold Monster ◆',        level:5, castTime:'Acción',       range:'18 m',  duration:'Conc. 1 min', concentration:true, combat:true, domain:true, desc:'Save SAB o paralizado (cualquier criatura). Siempre preparado.' }] : []),
        ...(nivel >= 17 ? [{ id:'ov-scrying',   name:'Scrying ◆',               level:5, castTime:'10 min',       range:'Uno mismo', duration:'Conc. 10 min', concentration:true, combat:false, domain:true, desc:'Ves/oyes a criatura conocida (save SAB negación). Siempre preparado.' }] : []),
      ],
      resources: (nivel) => [
        { id:'channel-divinity-ven', name:'Channel Divinity',
          current: 1, max: 1, recharge:'short',
          note:'Abjure Enemy · Vow of Enmity' },
      ],
      features: (nivel) => [
        { id:'ven-abjure-enemy', name:'Abjure Enemy',
          source:'Oath of Vengeance · Nv3', type:'active', action:'Acción', range:'18 m', recharge:'Short/Long Rest',
          desc:'Canal: una criatura en 18 m debe superar save de SAB o queda Asustada y con velocidad 0 durante 1 min.',
          fullDesc:'Puedes usar tu Channel Divinity para abrumar a un enemigo con terror divino. Como acción, eliges una criatura a 18 metros que puedas ver. Debe superar un save de SAB o quedará Asustada y su velocidad se reduce a 0 durante 1 minuto. Puede repetir el save al final de cada uno de sus turnos.' },
        { id:'ven-vow-of-enmity', name:'Vow of Enmity',
          source:'Oath of Vengeance · Nv3', type:'active', action:'Acción bonus', range:'3 m', recharge:'Short/Long Rest',
          desc:'Canal: tenés ventaja en todas las tiradas de ataque contra esa criatura durante 1 min.',
          fullDesc:'Puedes usar tu Channel Divinity para pronunciar un voto de enmidad contra un enemigo. Como acción adicional, obtienes ventaja en todas las tiradas de ataque contra la criatura durante 1 minuto, o hasta que caiga a 0 HP o quede incapacitada.' },
        ...(nivel >= 7 ? [{ id:'ven-relentless-avenger', name:'Relentless Avenger',
          source:'Oath of Vengeance · Nv7', type:'passive', action:'Pasiva', range:'Personal', recharge:null,
          desc:'Cuando golpeás con un ataque de oportunidad, podés mover la mitad de tu velocidad sin provocar ataques de oportunidad.',
          fullDesc:'A nivel 7, tu determinación sobrenatural te hace prácticamente imposible de escapar. Cuando golpeas con un ataque de oportunidad, puedes mover hasta la mitad de tu velocidad inmediatamente después del ataque como parte de la misma reacción. Este movimiento no provoca ataques de oportunidad.' }] : []),
        ...(nivel >= 15 ? [{ id:'ven-soul-of-vengeance', name:'Soul of Vengeance',
          source:'Oath of Vengeance · Nv15', type:'passive', action:'Reacción', range:'Melee', recharge:null,
          desc:'Cuando la criatura bajo tu Vow of Enmity ataca, podés usar tu reacción para hacerle un ataque cuerpo a cuerpo.',
          fullDesc:'A nivel 15, la autoridad de tu voto de enmidad se vuelve más poderosa. Cuando una criatura bajo tu Vow of Enmity hace un ataque, puedes usar tu reacción para hacer un ataque cuerpo a cuerpo contra esa criatura si está a tu alcance.' }] : []),
        ...(nivel >= 20 ? [{ id:'ven-avenging-angel', name:'Avenging Angel',
          source:'Oath of Vengeance · Nv20', type:'active', action:'Acción bonus', range:'Personal', recharge:'Long Rest',
          desc:'Alas durante 1 hora: vuelo 18 m. Aura de Menace 9 m — enemigos Asustados (save SAB negación).',
          fullDesc:'A nivel 20, puedes asumir la forma de un ángel vengador. Como acción adicional, obtienes alas con velocidad de vuelo de 18 metros durante 1 hora. Al mismo tiempo, un aura de 9 metros emana de vos: cada criatura hostil a 9 metros que pueda verte debe superar un save de SAB o quedará Asustada de vos durante 1 minuto o hasta que reciba daño.' }] : []),
      ],
    },

    'Oath of Glory': {
      clase: 'Paladín',
      subclassSpells: (nivel) => [
        { id:'og-guiding-bolt',  name:'Guiding Bolt ◆',       level:1, castTime:'Acción',       range:'36 m',  duration:'1 turno',     concentration:false, combat:true, domain:true, desc:'Ataque conjuro · 4d6 radiante · ventaja al siguiente atacante. Siempre preparado.' },
        { id:'og-heroism',       name:'Heroism ◆',            level:1, castTime:'Acción',       range:'Toque', duration:'Conc. 1 min', concentration:true, combat:true, domain:true, desc:'Inmune asustado + HP temp = SAB mod/turno. Siempre preparado.' },
        ...(nivel >= 5 ? [{ id:'og-enhance-ability',name:'Enhance Ability ◆',   level:2, castTime:'Acción',       range:'Toque', duration:'Conc. 1 h',   concentration:true, combat:false, domain:true, desc:'Vantaja en checks de stat elegido + bonus. Siempre preparado.' }] : []),
        ...(nivel >= 5 ? [{ id:'og-magic-weapon', name:'Magic Weapon ◆',        level:2, castTime:'Acción bonus', range:'Toque', duration:'1 h',         concentration:true, combat:true, domain:true, desc:'Arma +1 o más. Siempre preparado.' }] : []),
        ...(nivel >= 9 ? [{ id:'og-haste',         name:'Haste ◆',              level:3, castTime:'Acción',       range:'9 m',   duration:'Conc. 1 min', concentration:true, combat:true, domain:true, desc:'+2 CA, vel ×2, acción extra. Siempre preparado.' }] : []),
        ...(nivel >= 9 ? [{ id:'og-protection-energy',name:'Protection from Energy ◆', level:3, castTime:'Acción', range:'Toque', duration:'Conc. 1 h', concentration:true, combat:true, domain:true, desc:'Resistencia a 1 tipo daño elemental. Siempre preparado.' }] : []),
        ...(nivel >= 13 ? [{ id:'og-compulsion',   name:'Compulsion ◆',          level:4, castTime:'Acción',       range:'9 m',   duration:'Conc. 1 min', concentration:true, combat:false, domain:true, desc:'Criaturas deben moverse hacia dirección que designés. Siempre preparado.' }] : []),
        ...(nivel >= 13 ? [{ id:'og-freedom-mov2', name:'Freedom of Movement ◆', level:4, castTime:'Acción',       range:'Toque', duration:'1 h',         concentration:false, combat:true, domain:true, desc:'Inmune terreno difícil mágico y parálisis. Siempre preparado.' }] : []),
        ...(nivel >= 17 ? [{ id:'og-legend-lore',  name:'Legend Lore ◆',         level:5, castTime:'10 min',       range:'Uno mismo', duration:'Inst.',   concentration:false, combat:false, domain:true, desc:'Información legendaria sobre persona, lugar u objeto. Siempre preparado.' }] : []),
        ...(nivel >= 17 ? [{ id:'og-yolandes-regal-presence',name:'Yolande\'s Regal Presence ◆', level:5, castTime:'Acción', range:'9 m', duration:'Conc. 1 min', concentration:true, combat:true, domain:true, desc:'Criaturas hostiles en 9m: save SAB o reducida velocidad + 4d6 psíquico/turno. Siempre preparado.' }] : []),
      ],
      resources: (nivel) => [
        { id:'channel-divinity-glo', name:'Channel Divinity',
          current: 1, max: 1, recharge:'short',
          note:'Inspiring Smite · Peerless Athlete' },
      ],
      features: (nivel) => [
        { id:'glo-inspiring-smite', name:'Inspiring Smite',
          source:'Oath of Glory · Nv3', type:'active', action:'Acción bonus (tras Divine Smite)', range:'9 m', recharge:'Short/Long Rest',
          desc:'Canal: tras usar Divine Smite, distribuís temp HP iguales a 2d8 + nivel entre criaturas a 9 m (incluyéndote).',
          fullDesc:'Puedes usar tu Channel Divinity inmediatamente después de infligir daño con Divine Smite. Como acción adicional, distribuyes puntos de golpe temporales entre vos y aliados que elijas a 9 metros. El total es 2d8 + tu nivel de paladín, repartido como quieras.' },
        { id:'glo-peerless-athlete', name:'Peerless Athlete',
          source:'Oath of Glory · Nv3', type:'active', action:'Acción bonus', range:'Personal', recharge:'Short/Long Rest',
          desc:'Canal: durante 10 min tenés ventaja en Athletics y Acrobatics, cargas el doble, y tu salto aumenta 3 m horizontal y 1,5 m vertical.',
          fullDesc:'Como acción adicional, Channel Divinity: durante 10 minutos tienes ventaja en checks de Atletismo y Acrobacia; puedes cargar, empujar o arrastrar el doble de lo normal; la distancia de salto largo aumenta 3 metros y el salto alto 1,5 metros.' },
        ...(nivel >= 7 ? [{ id:'glo-aura-of-alacrity', name:'Aura of Alacrity',
          source:'Oath of Glory · Nv7', type:'passive', action:'Pasiva', range:`${nivel >= 18 ? 9 : 3} m`, recharge:null,
          desc:`Tu velocidad aumenta 3 m. Los aliados a ${nivel >= 18 ? 9 : 3} m también ganan +3 m de velocidad en su primer turno de combate.`,
          fullDesc:'A nivel 7, tu velocidad aumenta en 3 metros. Además, cuando iniciás un combate y no estás incapacitado, las criaturas amistosas que estén a 3 metros (9 m a nv18) tienen su velocidad aumentada en 3 metros hasta el final de su primer turno.' }] : []),
        ...(nivel >= 15 ? [{ id:'glo-glorious-defense', name:'Glorious Defense',
          source:'Oath of Glory · Nv15', type:'active', action:'Reacción', range:'3 m', recharge:null,
          desc:'Cuando vos o un aliado a 3 m son atacados, podés agregar tu mod de CAR a la CA hasta el final del turno. Si el ataque falla, atacás al atacante.',
          fullDesc:'A nivel 15, puedes transformar la derrota de un aliado en un momento de gloria. Cuando vos o una criatura amistosa a 3 metros es atacada, podés usar tu reacción para agregar tu modificador de Carisma a la CA del objetivo contra ese ataque. Si el ataque falla como resultado, puedes hacer un ataque cuerpo a cuerpo contra el atacante como parte de la misma reacción si está a tu alcance.' }] : []),
        ...(nivel >= 20 ? [{ id:'glo-living-legend', name:'Living Legend',
          source:'Oath of Glory · Nv20', type:'active', action:'Acción bonus', range:'Personal', recharge:'Long Rest',
          desc:'Durante 1 min: CAR en ataques en lugar de FUE/DES, retirás saves fallados (1/turno), y aliados que salven contra Asustados/Encantados pueden retirar.',
          fullDesc:'A nivel 20 puedes invocar el poder de tu propia leyenda. Como acción adicional (durante 1 minuto): podés usar CAR en lugar de FUE o DES en tiradas de ataque y daño; cuando fallás un save podés retirar la tirada (1 vez por turno); cuando una criatura amistosa falla un save contra ser Asustada o Encantada, puede retirar.' }] : []),
      ],
    },

    // ── HECHICERO ─────────────────────────────────────────────────────────────
    'Draconic Bloodline': {
      clase: 'Hechicero',
      resources: () => [],
      features: (nivel) => [
        { id:'db-dragon-ancestor', name:'Dragon Ancestor',
          source:'Draconic Bloodline · Nv1', type:'passive', action:'Pasiva', range:'Personal', recharge:null,
          desc:'Elegís un tipo de dragón. Obtenés ventaja en checks de Persuasión con dragones de ese tipo.',
          fullDesc:'A nivel 1 elige un tipo de dragón (fuego, frío, ácido, rayo, veneno, etc.). Hablas Dracónico. Tienes ventaja en checks de Carisma al interactuar con dragones de ese tipo.' },
        { id:'db-draconic-resilience', name:'Draconic Resilience',
          source:'Draconic Bloodline · Nv1', type:'passive', action:'Pasiva', range:'Personal', recharge:null,
          desc:'HP máximo +1 por nivel. CA base 13 + DES mod cuando no llevás armadura.',
          fullDesc:'La magia dracónica fluye por tu cuerpo. Tu HP máximo aumenta en 1 y sigue aumentando en 1 cada vez que subes un nivel. Además cuando no llevas armadura, tu CA es 13 + tu modificador de Destreza.' },
        ...(nivel >= 6 ? [{ id:'db-elemental-affinity', name:'Elemental Affinity',
          source:'Draconic Bloodline · Nv6', type:'passive', action:'Pasiva', range:'Personal', recharge:null,
          desc:'Conjuros del tipo dracónico: +CAR mod al daño. Gasta 1 SP: resistencia a ese tipo 1 hora.',
          fullDesc:'A nivel 6, cuando lanzas un conjuro que hace daño del tipo asociado a tu dragón ancestral, añades tu modificador de Carisma al daño. Además, puedes gastar 1 Sorcery Point para ganar resistencia a ese tipo de daño durante 1 hora.' }] : []),
        ...(nivel >= 14 ? [{ id:'db-dragon-wings', name:'Dragon Wings',
          source:'Draconic Bloodline · Nv14', type:'active', action:'Acción bonus', range:'Personal', recharge:null,
          desc:'Acción bonus: sacás alas dracónicas. Velocidad de vuelo igual a tu velocidad normal.',
          fullDesc:'A nivel 14, ganas la capacidad de hacer brotar alas de dragón de tu espalda. Como acción adicional, puedes hacer brotar las alas y ganar velocidad de vuelo igual a tu velocidad actual. Puedes retraerlas con otra acción adicional.' }] : []),
        ...(nivel >= 18 ? [{ id:'db-draconic-presence', name:'Draconic Presence',
          source:'Draconic Bloodline · Nv18', type:'active', action:'Acción', range:'18 m', recharge:'Long Rest',
          desc:'6 SP: aura 18 m durante 1 min — criaturas Asustadas o Encantadas (save SAB negación).',
          fullDesc:'A nivel 18, puedes canalizar la presencia aterradora de tu dragón ancestral. Como acción, gastas 5 Sorcery Points para envolver un aura de 18 metros. Durante 1 minuto, cada criatura hostil que inicie su turno en el aura debe superar un save de SAB o quedar Asustada (o Encantada, tú eliges) durante el turno.' }] : []),
      ],
    },

    'Wild Magic': {
      clase: 'Hechicero',
      resources: () => [],
      features: (nivel) => [
        { id:'wm-wild-magic-surge', name:'Wild Magic Surge',
          source:'Wild Magic · Nv1', type:'passive', action:'Pasiva', range:'Personal', recharge:null,
          desc:'Cuando lanzás un conjuro de nv1+, el DM puede pedir tirar d20. Con 1: tirás en la tabla de Wild Magic.',
          fullDesc:'Tus conjuros pueden desencadenar oleadas de magia salvaje. Cuando lanzas un conjuro de nivel 1 o superior, el DM puede pedirte que tires un d20. Con un 1, ocurre un efecto aleatorio de la tabla de Oleada de Magia Salvaje.' },
        { id:'wm-tides-of-chaos', name:'Tides of Chaos',
          source:'Wild Magic · Nv1', type:'active', action:'Ninguna', range:'Personal', recharge:'Long Rest',
          desc:'1/Long Rest: ganás ventaja en 1 tirada de ataque, check o save. El DM puede gatillar una Surge.',
          fullDesc:'Puedes manipular las fuerzas del azar para ganar ventaja en una tirada de ataque, prueba de característica o tirada de salvación. Una vez que lo hagas, debes terminar un descanso largo para volver a hacerlo. Si lanzas un conjuro de nivel 1 o superior antes de recuperar Tides of Chaos, el DM puede pedirte tirar en la tabla de Oleada de Magia Salvaje.' },
        ...(nivel >= 6 ? [{ id:'wm-bend-luck', name:'Bend Luck',
          source:'Wild Magic · Nv6', type:'active', action:'Reacción (2 SP)', range:'18 m', recharge:null,
          desc:'2 SP: como reacción, sumás o restás 1d4 a la tirada de ataque, check o save de otra criatura.',
          fullDesc:'A nivel 6, tienes la capacidad de retorcer el destino usando tu magia salvaje. Cuando otra criatura visible hace una tirada de ataque, prueba de característica o tirada de salvación, puedes usar tu reacción y gastar 2 puntos de hechicería para tirar 1d4 y aplicar el número como bonificación o penalización a esa tirada.' }] : []),
        ...(nivel >= 14 ? [{ id:'wm-controlled-chaos', name:'Controlled Chaos',
          source:'Wild Magic · Nv14', type:'passive', action:'Pasiva', range:'Personal', recharge:null,
          desc:'Cuando tirás en la tabla de Wild Magic Surge, podés tirar dos veces y elegir el resultado.',
          fullDesc:'A nivel 14, ganas un poco de control sobre las oleadas de magia salvaje. Cuando tiras en la tabla de Oleada de Magia Salvaje, puedes tirar el d100 dos veces y usar cualquiera de los dos resultados.' }] : []),
        ...(nivel >= 18 ? [{ id:'wm-spell-bombardment', name:'Spell Bombardment',
          source:'Wild Magic · Nv18', type:'passive', action:'Pasiva', range:'Personal', recharge:null,
          desc:'1 vez por turno: cuando un dado de daño de conjuro saca el máximo, tirás un dado adicional.',
          fullDesc:'A nivel 18 la energía de tus conjuros aumenta. Cuando tiras daño de un conjuro y obtienes el resultado más alto posible en un dado, elige uno de esos dados, tíralo de nuevo y suma el resultado al daño total del conjuro. Puedes usar esta habilidad una vez por turno.' }] : []),
      ],
    },

    'Storm Sorcery': {
      clase: 'Hechicero',
      resources: () => [],
      features: (nivel) => [
        { id:'ss-wind-speaker', name:'Wind Speaker',
          source:'Storm Sorcery · Nv1', type:'passive', action:'Pasiva', range:'Personal', recharge:null,
          desc:'Hablás Primordial (y sus dialectos: Aquan, Auran, Ignan, Terran).',
          fullDesc:'El poder de la tormenta que fluye por ti te permite hablar el lenguaje de los vientos y las olas. Tienes habla del Primordial, incluidos sus dialectos Aquan, Auran, Ignan y Terran.' },
        { id:'ss-tempestuous-magic', name:'Tempestuous Magic',
          source:'Storm Sorcery · Nv1', type:'active', action:'Acción bonus', range:'Personal', recharge:null,
          desc:'Antes/después de lanzar un conjuro de nv1+: podés volar 3 m sin provocar ataques de oportunidad.',
          fullDesc:'A nivel 1, puedes usar una acción adicional justo antes o después de lanzar un conjuro de nivel 1 o superior para volar hasta 3 metros sin provocar ataques de oportunidad.' },
        ...(nivel >= 6 ? [{ id:'ss-heart-of-storm', name:'Heart of the Storm',
          source:'Storm Sorcery · Nv6', type:'passive', action:'Pasiva', range:'Personal', recharge:null,
          desc:'Resistencia a relámpago y trueno. Al lanzar conjuro de relámpago/trueno: 1d6 daño a criaturas en 3 m.',
          fullDesc:'A nivel 6 ganas resistencia a daño de relámpago y de trueno. Además, cuando empiezas a lanzar un conjuro de nivel 1 o superior que cause daño de relámpago o trueno, puedes elegir criaturas visibles a 3 metros para que reciban 1d6 de daño de relámpago o trueno (tu elección).' }] : []),
        ...(nivel >= 14 ? [{ id:'ss-storm-guide', name:'Storm Guide',
          source:'Storm Sorcery · Nv14', type:'active', action:'Ninguna', range:'Varía', recharge:null,
          desc:'Controlás el clima: detener lluvia en 6 m radio (bonus action) o cambiar viento en 30 m (acción).',
          fullDesc:'A nivel 14, ganas la habilidad de controlar sutilmente el clima a tu alrededor. Si llueve, puedes usar una acción adicional para hacer cesar la lluvia en un área de 6 metros centrada en ti. Con una acción, puedes elegir la dirección del viento en un radio de 30 metros centrado en ti. Estos efectos duran hasta el inicio de tu siguiente turno.' }] : []),
        ...(nivel >= 18 ? [{ id:'ss-wind-soul', name:'Wind Soul',
          source:'Storm Sorcery · Nv18', type:'active', action:'Acción bonus', range:'Personal', recharge:'Short/Long Rest',
          desc:'Vuelo permanente 18 m. Gasta 3 SP: 10 min, vos y hasta 3 aliados en 9 m vuelan también.',
          fullDesc:'A nivel 18 ganas inmunidad a daño de relámpago y trueno, y velocidad de vuelo permanente de 18 metros. Como acción adicional, puedes gastar 3 puntos de hechicería para otorgar vuelo de 9 metros a hasta 3 criaturas consentidoras a 9 metros durante 1 hora. Debes hacer este gasto desde un descanso corto o largo.' }] : []),
      ],
    },

    // ── HECHICERO: subclases con spells de subclase siempre preparados ────────
    'Aberrant Mind': {
      clase: 'Hechicero',
      resources: () => [],
      // subclassSpells: se añaden al personaje con subclass:true (siempre preparados, no ocupan cupo de conocidos)
      subclassSpells: (nivel) => [
        // Cantrips psiónicos (nivel 1+): minor illusion telepática + mind sliver
        { id:'ab-mind-sliver',       name:'Mind Sliver ✦',       level:0, castTime:'Acción',       range:'18 m',     duration:'1 ronda', concentration:false, combat:true,  cantrip_subclass:true, desc:'Save INT · 1d6 psíquico · -1d4 en próx. save del objetivo. Cantrip psiónco gratis. (Tasha\'s)' },
        { id:'ab-minor-illusion',    name:'Minor Illusion ✦',    level:0, castTime:'Acción',       range:'9 m',      duration:'1 min',   concentration:false, combat:false, cantrip_subclass:true, desc:'Sonido o imagen pequeña ilusoria. Cantrip psiónco gratis. (Tasha\'s)' },
        // Psionic Spells siempre preparados por nivel (domain:true = nunca ocupan cupo de conocidos)
        { id:'ab-arms-of-hadar',     name:'Arms of Hadar ✦',     level:1, castTime:'Acción',       range:'Uno mismo (3m)', duration:'Inst.', concentration:false, combat:true,  domain:true, desc:'Tentáculos en 3m radio · save FUE · 2d6 necrótico · niega reacciones hasta próx. turno. Siempre preparado.' },
        { id:'ab-dissonant-whisp',   name:'Dissonant Whispers ✦',level:1, castTime:'Acción',       range:'18 m',     duration:'Inst.',   concentration:false, combat:true,  domain:true, desc:'Save SAB · 3d6 psíquico · huye con reacción. Siempre preparado.' },
        ...(nivel >= 3 ? [
        { id:'ab-calm-emotions',     name:'Calm Emotions ✦',     level:2, castTime:'Acción',       range:'18 m',     duration:'1 min',   concentration:true,  combat:false, domain:true, desc:'Esfera 4,5m · neutraliza Charmed/Frightened o suprime hostilidad (save CAR). Siempre preparado.' },
        { id:'ab-detect-thoughts',   name:'Detect Thoughts ✦',   level:2, castTime:'Acción',       range:'Uno mismo',duration:'1 min',   concentration:true,  combat:false, domain:true, desc:'Lees pensamientos superficiales; profundos con save INT. Siempre preparado.' },
        ] : []),
        ...(nivel >= 5 ? [
        { id:'ab-hunger-of-hadar',   name:'Hunger of Hadar ✦',   level:3, castTime:'Acción',       range:'45 m',     duration:'1 min',   concentration:true,  combat:true,  domain:true, desc:'Esfera 4,5m oscuridad · comienzo de turno 2d6 frío · fin de turno save DES o 2d6 ácido. Siempre preparado.' },
        { id:'ab-sending',           name:'Sending ✦',            level:3, castTime:'Acción',       range:'Ilimitado',duration:'1 ronda', concentration:false, combat:false, domain:true, desc:'Envías mensaje de 25 palabras a cualquier criatura en cualquier plano. Siempre preparado.' },
        ] : []),
        ...(nivel >= 7 ? [
        { id:'ab-evards-tentacles',  name:"Evard's Black Tentacles ✦", level:4, castTime:'Acción', range:'27 m',     duration:'1 min',   concentration:true,  combat:true,  domain:true, desc:'Área 6m cubo · save DES o atrapado + 3d6 contundente/turno. Siempre preparado.' },
        { id:'ab-summon-aberration', name:'Summon Aberration ✦',  level:4, castTime:'Acción',       range:'27 m',     duration:'1 h',     concentration:true,  combat:true,  domain:true, desc:'Invoca criatura aberración (beholderkin, slaad, star spawn) para luchar por vos. Siempre preparado.' },
        ] : []),
        ...(nivel >= 9 ? [
        { id:'ab-telekinesis',       name:'Telekinesis ✦',        level:5, castTime:'Acción',       range:'18 m',     duration:'10 min',  concentration:true,  combat:true,  domain:true, desc:'Mueve objetos/criaturas con la mente · criatura: save FUE o movida 9m. Siempre preparado.' },
        { id:'ab-rarys-bond',        name:"Rary's Telepathic Bond ✦", level:5, castTime:'Acción',   range:'9 m',      duration:'1 h',     concentration:false, combat:false, domain:true, desc:'Hasta 8 criaturas se comunican telepáticamente sin importar idioma. SIN concentración. Siempre preparado.' },
        ] : []),
      ],
      features: (nivel) => [
        { id:'am-psionic-spells', name:'Psionic Spells',
          source:'Aberrant Mind · Nv1', type:'passive', action:'Pasiva', range:'Personal', recharge:null,
          desc:'Ganás 2 cantrips psiónicos (Mind Sliver, Minor Illusion) y una lista de conjuros siempre preparados que escalan con tu nivel. No cuentan contra tu límite de conjuros conocidos.',
          fullDesc:'A nivel 1 recibes los cantrips Mind Sliver y Minor Illusion de forma gratuita. Además, aprendés conjuros adicionales (Arms of Hadar, Dissonant Whispers a nv1; Calm Emotions, Detect Thoughts a nv3; Hunger of Hadar, Sending a nv5; Evard\'s Black Tentacles, Summon Aberration a nv7; Telekinesis, Rary\'s Telepathic Bond a nv9). Estos conjuros siempre están preparados y no cuentan contra tu número de conjuros conocidos. Si no son de Hechicero, igualmente puedes usarlos.' },
        { id:'am-telepathic-speech', name:'Telepathic Speech',
          source:'Aberrant Mind · Nv1', type:'active', action:'Bonus Action', range:'18 m', recharge:null,
          desc:'Acción bonus: establecés comunicación telepática con una criatura visible (INT ≥ 1). Dura min(INT mod, 1) minutos. No requiere idioma compartido.',
          fullDesc:'A nivel 1 puedes comunicarte telepáticamente con cualquier criatura que puedas ver a 18m con Inteligencia de al menos 1. La comunicación dura un número de minutos igual a tu modificador de Inteligencia (mínimo 1 minuto). No necesitas compartir idioma, pero la criatura debe ser capaz de entender al menos un idioma para que la comunicación sea significativa.' },
        ...(nivel >= 6 ? [{ id:'am-revelation-in-flesh', name:'Revelation in the Flesh',
          source:'Aberrant Mind · Nv6', type:'active', action:'Acción bonus (1 SP)', range:'Personal', recharge:null,
          desc:'Gasta 1+ Sorcery Point: transformación aberrante 10 min. 1SP: acuático o terrestre sin daño por movimiento. 2SP: vuelo 9m. 3SP: transparente (invisible a magos). 4SP: tentáculos (alcance extra).',
          fullDesc:'A nivel 6, puedes transformar tu cuerpo de formas aberrantes. Gastas 1 o más puntos de hechicería como acción adicional para ganar efectos durante 10 minutos: 1SP: adaptación acuática o movimiento sin restricciones. 2SP: vuelo 9m. 3SP: volverse transparente. 4SP: tentáculos con alcance extra.' }] : []),
        ...(nivel >= 10 ? [{ id:'am-warping-implosion', name:'Warping Implosion',
          source:'Aberrant Mind · Nv10', type:'active', action:'Acción (5 SP)', range:'27 m', recharge:'Long Rest',
          desc:'5 SP: teleportás a espacio visible en 27m · todas las criaturas en 9m del origen: save FUE o 3d10 fuerza + atraídas 9m. 1/LR gratis, luego cuesta 5 SP.',
          fullDesc:'A nivel 10 puedes usar tu acción para teleportarte a un espacio desocupado que puedas ver dentro de 27m. Inmediatamente, cada criatura dentro de 9m del espacio que dejaste debe hacer un save de FUE (CD = tu CD de conjuros) o recibir 3d10 de daño de fuerza y ser jalada hasta 9m hacia el espacio que acabas de dejar. Puedes usar esta capacidad una vez sin gastar puntos de hechicería. Luego debes gastar 5 puntos de hechicería para usarla.' }] : []),
        ...(nivel >= 14 ? [{ id:'am-create-thrall', name:'Create Thrall',
          source:'Aberrant Mind · Nv14', type:'active', action:'Acción', range:'Toque', recharge:null,
          desc:'Toque en criatura incapacitada: queda bajo tu control telepático. Detectás su ubicación siempre, y podés comunicarte con ella.',
          fullDesc:'A nivel 14, cuando tocas a un humanoide incapacitado, puedes lanzar un hechizo psiónico sobre él. La criatura no está encantada, pero queda bajo tu influencia psiónica. Siempre sabes la localización del thrall y puedes comunicarte telepáticamente con él sin importar la distancia (incluso en otros planos). El efecto termina si usas esta habilidad en otra criatura.' }] : []),
      ],
    },

    'Clockwork Soul': {
      clase: 'Hechicero',
      resources: () => [],
      subclassSpells: (nivel) => [
        { id:'cs-alarm',             name:'Alarm ✦',               level:1, castTime:'1 min',        range:'27 m',     duration:'8 h',     concentration:false, combat:false, domain:true, desc:'Alerta cuando una criatura entra en el área protegida. Siempre preparado.' },
        { id:'cs-protection-evil',   name:'Protection from Evil ✦', level:1, castTime:'Acción',      range:'Toque',    duration:'10 min',  concentration:true,  combat:true,  domain:true, desc:'Desventaja en ataques de seres supernaturales + inmunidad a encantamiento/miedo. Siempre preparado.' },
        ...(nivel >= 3 ? [
        { id:'cs-aid',               name:'Aid ✦',                  level:2, castTime:'Acción',      range:'9 m',      duration:'8 h',     concentration:false, combat:false, domain:true, desc:'Hasta 3 criaturas +5 HP máximos y actuales durante 8 h. Siempre preparado.' },
        { id:'cs-lesser-restoration',name:'Lesser Restoration ✦',   level:2, castTime:'Acción',      range:'Toque',    duration:'Inst.',   concentration:false, combat:false, domain:true, desc:'Elimina una enfermedad o condición (cegado, ensordecido, paralizado, envenenado). Siempre preparado.' },
        ] : []),
        ...(nivel >= 5 ? [
        { id:'cs-dispel-magic',      name:'Dispel Magic ✦',         level:3, castTime:'Acción',      range:'36 m',     duration:'Inst.',   concentration:false, combat:true,  domain:true, desc:'Termina conjuros en objetivo automáticamente si nv3 o menos. Siempre preparado.' },
        { id:'cs-protection-energy', name:'Protection from Energy ✦', level:3, castTime:'Acción',    range:'Toque',    duration:'1 h',     concentration:true,  combat:true,  domain:true, desc:'Resistencia a 1 tipo de daño energético elemental durante 1h. Siempre preparado.' },
        ] : []),
        ...(nivel >= 7 ? [
        { id:'cs-freedom-movement',  name:'Freedom of Movement ✦',  level:4, castTime:'Acción',      range:'Toque',    duration:'1 h',     concentration:false, combat:true,  domain:true, desc:'Inmune a terreno difícil mágico, parálisis, reducción de velocidad. Siempre preparado.' },
        { id:'cs-summon-construct',  name:'Summon Construct ✦',      level:4, castTime:'Acción',      range:'27 m',     duration:'1 h',     concentration:true,  combat:true,  domain:true, desc:'Invoca espíritu constructo para luchar por vos. Siempre preparado.' },
        ] : []),
        ...(nivel >= 9 ? [
        { id:'cs-greater-restoration',name:'Greater Restoration ✦', level:5, castTime:'Acción',      range:'Toque',    duration:'Inst.',   concentration:false, combat:false, domain:true, desc:'Reduce agotamiento, elimina encantamiento/maldición/petrificación, restaura HP max. Siempre preparado.' },
        { id:'cs-wall-of-force',     name:'Wall of Force ✦',         level:5, castTime:'Acción',      range:'36 m',     duration:'10 min',  concentration:true,  combat:true,  domain:true, desc:'Pared invisible impenetrable de fuerza. Siempre preparado.' },
        ] : []),
      ],
      features: (nivel) => [
        { id:'cs-clockwork-magic', name:'Clockwork Magic',
          source:'Clockwork Soul · Nv1', type:'passive', action:'Pasiva', range:'Personal', recharge:null,
          desc:'Ganás una lista de conjuros siempre preparados que no cuentan contra tu límite de conocidos.',
          fullDesc:'A nivel 1 aprendés conjuros adicionales siempre preparados según tu nivel (Alarm, Protection from Evil nv1; Aid, Lesser Restoration nv3; Dispel Magic, Protection from Energy nv5; Freedom of Movement, Summon Construct nv7; Greater Restoration, Wall of Force nv9).' },
        { id:'cs-restore-balance', name:'Restore Balance',
          source:'Clockwork Soul · Nv1', type:'active', action:'Reacción', range:'18 m', recharge:'Long Rest',
          desc:'Reacción cuando una criatura visible recibe ventaja o desventaja: cancela ese efecto. Usos = CAR mod (mín 1).',
          fullDesc:'A nivel 1, cuando una criatura que puedes ver a 18m va a tirar con ventaja o desventaja, puedes usar tu reacción para cancelar la ventaja o desventaja. Puedes usar esta característica un número de veces igual a tu modificador de Carisma (mínimo una). Recuperas todos los usos al final de un descanso largo.' },
        ...(nivel >= 6 ? [{ id:'cs-bastion-of-law', name:'Bastion of Law',
          source:'Clockwork Soul · Nv6', type:'active', action:'Acción (1-5 SP)', range:'9 m', recharge:null,
          desc:'Gasta 1-5 SP: criatura visible almacena 1d8/SP como escudo. Absorbe ese daño antes que sus HP reales.',
          fullDesc:'A nivel 6 puedes atraer el poder del plano mecánico para protegerte a ti o a un aliado. Como acción, puedes gastar de 1 a 5 puntos de hechicería para crear un escudo mágico en torno a ti mismo o una criatura consentidora visible a 9m. El escudo absorbe un total de 1d8 de daño por punto de hechicería gastado. El escudo dura hasta que sea reducido a 0 o hasta que termines un descanso largo.' }] : []),
        ...(nivel >= 10 ? [{ id:'cs-trance-of-order', name:'Trance of Order',
          source:'Clockwork Soul · Nv10', type:'active', action:'Acción bonus', range:'Personal', recharge:'Long Rest',
          desc:'1/LR: durante 1 min, tiradas de ataque contra vos no tienen ventaja + tiras cualquier d20 y podés reemplazarlo por 10.',
          fullDesc:'A nivel 10 puedes alinear tu mente con el orden de los planos. Como acción adicional, puedes entrar en un estado de enfoque ordenado por 1 minuto. Mientras dure: los ataques contra ti no pueden tener ventaja, y cada vez que hagas una tirada de ataque, una prueba de habilidad o una tirada de salvación, puedes tratar un d20 como si hubiera sacado un 10.' }] : []),
        ...(nivel >= 14 ? [{ id:'cs-clockwork-cavalcade', name:'Clockwork Cavalcade',
          source:'Clockwork Soul · Nv14', type:'active', action:'Acción (7 SP)', range:'Uno mismo (9m)', recharge:'Long Rest',
          desc:'7 SP: invocás autómatas en 9m radio — curan 4d10 HP a criaturas de tu elección, terminan conjuros de nv6 o menos, y reparan objetos.',
          fullDesc:'A nivel 14, convocas una avalancha de autómatas del plano mecánico. Como acción, gastas 7 puntos de hechicería y un destello de autómatas mecánicos aparece en un cubo de 9m centrado en ti. Los autómatas realizan tres efectos en el área: restauran hasta 4d10 HP a criaturas de tu elección; terminan todos los conjuros activos de nivel 6 o inferior; reparan todos los objetos no mágicos dañados.' }] : []),
      ],
    },

    // ── MAGO ──────────────────────────────────────────────────────────────────
    'School of Evocation': {
      clase: 'Mago',
      resources: () => [],
      features: (nivel) => [
        { id:'evo-sculpt-spells', name:'Sculpt Spells',
          source:'School of Evocation · Nv2', type:'passive', action:'Pasiva', range:'Personal', recharge:null,
          desc:'Al lanzar un conjuro de evocación, podés excluir a aliados del área — automáticamente pasan el save.',
          fullDesc:'A nivel 2, puedes crear bolsas de seguridad dentro de los efectos de tus conjuros de evocación. Cuando lanzas un conjuro de evocación que afecta a otras criaturas que puedes ver, puedes elegir un número de ellas igual a 1 + el nivel del conjuro. Las criaturas elegidas superan automáticamente sus tiradas de salvación contra el conjuro y no reciben daño si normalmente recibirían la mitad.' },
        ...(nivel >= 6 ? [{ id:'evo-potent-cantrip', name:'Potent Cantrip',
          source:'School of Evocation · Nv6', type:'passive', action:'Pasiva', range:'Personal', recharge:null,
          desc:'Tus cantrips dañinos hacen daño parcial incluso si el objetivo pasa el save.',
          fullDesc:'A nivel 6, tus cantrips dañinos afectan incluso a las criaturas que evitan sus efectos. Cuando una criatura supera una tirada de salvación contra un cantrip tuyo, recibe la mitad del daño del cantrip (si causa daño) pero no sufre ningún efecto adicional del cantrip.' }] : []),
        ...(nivel >= 10 ? [{ id:'evo-empowered-evocation', name:'Empowered Evocation',
          source:'School of Evocation · Nv10', type:'passive', action:'Pasiva', range:'Personal', recharge:null,
          desc:'Sumás tu modificador de INT al daño de cualquier conjuro de evocación de Mago.',
          fullDesc:'A nivel 10, puedes añadir tu modificador de Inteligencia a las tiradas de daño de los conjuros del mago de la escuela de Evocación que lancas.' }] : []),
        ...(nivel >= 14 ? [{ id:'evo-overchannel', name:'Overchannel',
          source:'School of Evocation · Nv14', type:'active', action:'Ninguna', range:'Personal', recharge:null,
          desc:'Al lanzar un conjuro de nv1-5, podés maximizar el daño. Usarlo de nuevo antes de LR: 2d12 daño necrótico por nivel del conjuro.',
          fullDesc:'A nivel 14, puedes aumentar el poder de tus conjuros más simples. Cuando lanzas un conjuro de mago de nivel 1-5 que causa daño, puedes tratar todos los dados de daño del conjuro como si hubieran sacado el resultado máximo posible. La primera vez que lo usas no sufres efectos adversos. Si lo usas de nuevo antes de un descanso largo, sufres 2d12 daño necrótico por nivel del conjuro, y no puedes mitigar ese daño.' }] : []),
      ],
    },

    'School of Abjuration': {
      clase: 'Mago',
      resources: (nivel) => [
        { id:'arcane-ward', name:'Arcane Ward',
          current: nivel * 2, max: nivel * 2, recharge:'long',
          note:`Escudo mágico · ${nivel * 2} HP · absorbe daño antes que tus HP` },
      ],
      features: (nivel) => [
        { id:'abj-abjuration-savant', name:'Abjuration Savant',
          source:'School of Abjuration · Nv2', type:'passive', action:'Pasiva', range:'Personal', recharge:null,
          desc:'Copiar conjuros de abjuración al libro de hechizos cuesta la mitad de tiempo y oro.',
          fullDesc:'A nivel 2, el oro y el tiempo que debes invertir para copiar un conjuro de abjuración en tu libro de hechizos se reduce a la mitad.' },
        { id:'abj-arcane-ward', name:'Arcane Ward',
          source:'School of Abjuration · Nv2', type:'passive', action:'Pasiva', range:'Personal', recharge:null,
          desc:`Ward mágico con ${nivel * 2} HP. Absorbe daño antes que tus HP. Se recarga lanzando conjuros de abjuración.`,
          fullDesc:'A nivel 2, puedes tejer la magia alrededor de ti como escudo protector. Cuando lanzas un conjuro de abjuración de nivel 1 o superior, puedes simultáneamente usar una parte de la magia para crear un escudo mágico que dura hasta que termines un descanso largo. El escudo tiene PG máximos iguales a dos veces tu nivel de mago + tu modificador de INT.' },
        ...(nivel >= 6 ? [{ id:'abj-projected-ward', name:'Projected Ward',
          source:'School of Abjuration · Nv6', type:'active', action:'Reacción', range:'9 m', recharge:null,
          desc:'Cuando un aliado en 9 m recibe daño, tu Arcane Ward absorbe el daño en su lugar.',
          fullDesc:'A nivel 6, cuando una criatura que puedes ver a 9 metros de ti recibe daño, puedes usar tu reacción para que tu Arcane Ward absorba ese daño. Si este daño reduce el ward a 0 PG, la criatura recibe el daño restante.' }] : []),
        ...(nivel >= 10 ? [{ id:'abj-improved-abjuration', name:'Improved Abjuration',
          source:'School of Abjuration · Nv10', type:'passive', action:'Pasiva', range:'Personal', recharge:null,
          desc:'Cuando hacés un check de habilidad como parte de un conjuro de abjuración, sumás tu Prof Bonus.',
          fullDesc:'A nivel 10, cuando haces una prueba de característica como parte de un conjuro de abjuración (como Counterspell o Dispel Magic), añades tu bonificador de competencia a esa prueba si no está ya incluido.' }] : []),
        ...(nivel >= 14 ? [{ id:'abj-spell-resistance', name:'Spell Resistance',
          source:'School of Abjuration · Nv14', type:'passive', action:'Pasiva', range:'Personal', recharge:null,
          desc:'Ventaja en saves contra conjuros. Resistencia al daño de conjuros.',
          fullDesc:'A nivel 14, has adquirido una resistencia notable a los efectos mágicos. Tienes ventaja en las tiradas de salvación contra conjuros. Además, tienes resistencia al daño de los conjuros.' }] : []),
      ],
    },

    'School of Divination': {
      clase: 'Mago',
      resources: (nivel) => [
        { id:'portent', name:'Portent',
          current: nivel >= 14 ? 3 : 2, max: nivel >= 14 ? 3 : 2, recharge:'long',
          note:'Dados de presagio · reemplazá cualquier tirada antes de que ocurra' },
      ],
      features: (nivel) => [
        { id:'div-divination-savant', name:'Divination Savant',
          source:'School of Divination · Nv2', type:'passive', action:'Pasiva', range:'Personal', recharge:null,
          desc:'Copiar conjuros de adivinación cuesta la mitad de tiempo y oro.',
          fullDesc:'A nivel 2, el oro y el tiempo para copiar conjuros de adivinación en tu libro de hechizos se reduce a la mitad.' },
        { id:'div-portent', name:'Portent',
          source:'School of Divination · Nv2', type:'active', action:'Ninguna (antes de la tirada)', range:'18 m', recharge:'Long Rest',
          desc:`Al despertar tirás ${nivel >= 14 ? 3 : 2} d20. Podés reemplazar cualquier tirada con uno de esos resultados (antes de que se tire).`,
          fullDesc:'A nivel 2, los destellos del futuro comienzan a surgir en tu conciencia. Cuando terminas un descanso largo, tiras dos veces d20 y anota los resultados. Puedes reemplazar cualquier tirada de ataque, prueba de característica o tirada de salvación hecha por ti o cualquier criatura visible con uno de estos resultados. A nivel 14 tiras tres dados.' },
        ...(nivel >= 6 ? [{ id:'div-expert-divination', name:'Expert Divination',
          source:'School of Divination · Nv6', type:'passive', action:'Pasiva', range:'Personal', recharge:null,
          desc:'Cuando lanzás un conjuro de adivinación de nv2+, recuperás un slot gastado de nivel inferior.',
          fullDesc:'A nivel 6, lanzar conjuros de adivinación resulta tan fácil que recuperas algunos de tus recursos mágicos. Cuando lanzas un conjuro de adivinación de nivel 2 o superior usando un espacio de conjuro, recuperas un espacio de conjuro usado. El espacio recuperado debe ser de un nivel inferior al conjuro que acabas de lanzar, y no puede ser de nivel 6 o superior.' }] : []),
        ...(nivel >= 10 ? [{ id:'div-the-third-eye', name:'The Third Eye',
          source:'School of Divination · Nv10', type:'active', action:'Acción', range:'Personal', recharge:'Short/Long Rest',
          desc:'Elegís 1 beneficio: Darkvision 18m, leer cualquier idioma, ver al plano Etéreo 18m, o visión etérea.',
          fullDesc:'A nivel 10, puedes usar tu acción para aumentar tus poderes de percepción. Hasta el final de tu siguiente descanso largo, obtienes uno de estos beneficios: visión en la oscuridad hasta 18m; leer cualquier idioma; ver criaturas y objetos invisibles hasta 18m; visión etérea hasta 18m.' }] : []),
      ],
    },

    // ── BRUJO ─────────────────────────────────────────────────────────────────
    'The Fiend': {
      clase: 'Brujo',
      subclassSpells: (nivel) => [
        { id:'tf-burning-hands', name:'Burning Hands ◆',       level:1, castTime:'Acción',       range:'Cono 4,5m',duration:'Inst.',       concentration:false, combat:true, domain:true, desc:'Save DES · 3d6 fuego. Siempre preparado.' },
        { id:'tf-command',       name:'Command ◆',             level:1, castTime:'Acción',       range:'18 m',  duration:'1 turno',        concentration:false, combat:true, domain:true, desc:'Save SAB · 1 palabra de comando. Siempre preparado.' },
        ...(nivel >= 3 ? [{ id:'tf-blindness',   name:'Blindness/Deafness ◆',   level:2, castTime:'Acción',       range:'9 m',   duration:'1 min',       concentration:false, combat:true, domain:true, desc:'Save CON o cegado/ensordecido. Siempre preparado.' }] : []),
        ...(nivel >= 3 ? [{ id:'tf-scorching-ray',name:'Scorching Ray ◆',       level:2, castTime:'Acción',       range:'36 m',  duration:'Inst.',        concentration:false, combat:true, domain:true, desc:'3 ataques · 2d6 fuego c/u. Siempre preparado.' }] : []),
        ...(nivel >= 5 ? [{ id:'tf-fireball',    name:'Fireball ◆',             level:3, castTime:'Acción',       range:'45 m',  duration:'Inst.',        concentration:false, combat:true, domain:true, desc:'Esfera 20ft · save DES · 8d6 fuego. Siempre preparado.' }] : []),
        ...(nivel >= 5 ? [{ id:'tf-stinking-cloud',name:'Stinking Cloud ◆',     level:3, castTime:'Acción',       range:'27 m',  duration:'Conc. 1 min',  concentration:true, combat:true, domain:true, desc:'Esfera nauseabunda · save CON o pierde acción. Siempre preparado.' }] : []),
        ...(nivel >= 7 ? [{ id:'tf-fire-shield', name:'Fire Shield ◆',          level:4, castTime:'Acción',       range:'Uno mismo', duration:'10 min',   concentration:false, combat:true, domain:true, desc:'Escudo de fuego/frío: 2d8 al atacante melee. Siempre preparado.' }] : []),
        ...(nivel >= 7 ? [{ id:'tf-wall-of-fire',name:'Wall of Fire ◆',          level:4, castTime:'Acción',       range:'36 m',  duration:'Conc. 1 min', concentration:true, combat:true, domain:true, desc:'Muro 18m · 5d8 fuego. Siempre preparado.' }] : []),
        ...(nivel >= 9 ? [{ id:'tf-flame-strike',name:'Flame Strike ◆',          level:5, castTime:'Acción',       range:'18 m',  duration:'Inst.',        concentration:false, combat:true, domain:true, desc:'4d6 fuego + 4d6 radiante (save DES). Siempre preparado.' }] : []),
        ...(nivel >= 9 ? [{ id:'tf-hallow',      name:'Hallow ◆',                level:5, castTime:'24 h',         range:'Toque', duration:'Hasta dispel', concentration:false, combat:false, domain:true, desc:'Santifica un área 18m radio con efectos a elegir. Siempre preparado.' }] : []),
      ],
      resources: () => [],
      features: (nivel) => [
        { id:'fiend-dark-ones-blessing', name:"Dark One's Blessing",
          source:'The Fiend · Nv1', type:'passive', action:'Pasiva', range:'Personal', recharge:null,
          desc:'Cuando matás a un enemigo, ganás CAR mod + nivel de Brujo HP temporales.',
          fullDesc:'A nivel 1, cuando reduces a una criatura hostil a 0 puntos de golpe, ganas puntos de golpe temporales iguales a tu modificador de Carisma + tu nivel de brujo (mínimo 1).' },
        ...(nivel >= 6 ? [{ id:'fiend-dark-ones-own-luck', name:"Dark One's Own Luck",
          source:'The Fiend · Nv6', type:'active', action:'Ninguna (en tirada)', range:'Personal', recharge:'Short/Long Rest',
          desc:'1/Short Rest: cuando hacés un check o save, podés sumar 1d10 al resultado.',
          fullDesc:'A nivel 6, puedes invocar la suerte de tu patrón. Cuando haces una prueba de característica o tirada de salvación, puedes usar esta habilidad para sumar un d10 al resultado. Puedes hacerlo después de tirar pero antes de saber si el resultado es exitoso. Una vez que uses esta habilidad, debes terminar un descanso corto o largo para volver a usarla.' }] : []),
        ...(nivel >= 10 ? [{ id:'fiend-fiendish-resilience', name:'Fiendish Resilience',
          source:'The Fiend · Nv10', type:'active', action:'Descanso corto/largo', range:'Personal', recharge:'Short/Long Rest',
          desc:'Elegís un tipo de daño después de cada descanso → resistencia a ese tipo.',
          fullDesc:'A nivel 10, puedes elegir un tipo de daño cuando terminas un descanso corto o largo y ganar resistencia a ese tipo de daño hasta que elijas uno diferente. El daño de armas mágicas o de plata supera esta resistencia.' }] : []),
        ...(nivel >= 14 ? [{ id:'fiend-hurl-through-hell', name:'Hurl Through Hell',
          source:'The Fiend · Nv14', type:'active', action:'Acción (ataque)', range:'Melee/Ranged', recharge:'Long Rest',
          desc:'1/Long Rest: al golpear, mandás al objetivo a los Infiernos hasta tu próximo turno — 10d10 psíquico al regresar.',
          fullDesc:'A nivel 14, cuando golpeas a una criatura con un ataque, puedes usar esta habilidad para transportarla momentáneamente a los Nueve Infiernos. Desaparece y sufre un terrible tormento. Al final de tu próximo turno regresa donde estaba (o el espacio desocupado más cercano) y recibe 10d10 de daño psíquico por el horror vivido. Los fiends son inmunes a este daño.' }] : []),
      ],
    },

    'The Great Old One': {
      clase: 'Brujo',
      subclassSpells: (nivel) => [
        { id:'goo-dissonant-whispers',name:'Dissonant Whispers ◆', level:1, castTime:'Acción',  range:'18 m',  duration:'Inst.',        concentration:false, combat:true, domain:true, desc:'Save SAB · 3d6 psíquico + huye. Siempre preparado.' },
        { id:'goo-tasha-hideous',name:"Tasha's Hideous Laughter ◆",level:1, castTime:'Acción',  range:'9 m',   duration:'Conc. 1 min',  concentration:true, combat:true, domain:true, desc:'Save SAB o incapacitado: se ríe sin control. Siempre preparado.' },
        ...(nivel >= 3 ? [{ id:'goo-detect-thoughts',name:'Detect Thoughts ◆',  level:2, castTime:'Acción',       range:'Uno mismo', duration:'Conc. 1 min', concentration:true, combat:false, domain:true, desc:'Lee pensamientos superficiales. Siempre preparado.' }] : []),
        ...(nivel >= 3 ? [{ id:'goo-phantasmal-force',name:'Phantasmal Force ◆',level:2, castTime:'Acción',       range:'18 m',  duration:'Conc. 1 min', concentration:true, combat:true, domain:true, desc:'Save INT o la criatura cree ilusión y recibe 1d6 psíquico/turno. Siempre preparado.' }] : []),
        ...(nivel >= 5 ? [{ id:'goo-clairvoyance', name:'Clairvoyance ◆',       level:3, castTime:'10 min',       range:'1,5 km',duration:'Conc. 10 min', concentration:true, combat:false, domain:true, desc:'Sensor invisible en lugar conocido: ves/oyes. Siempre preparado.' }] : []),
        ...(nivel >= 5 ? [{ id:'goo-sending',      name:'Sending ◆',            level:3, castTime:'Acción',       range:'Ilimitado', duration:'1 ronda',  concentration:false, combat:false, domain:true, desc:'Mensaje 25 palabras a cualquier plano. Siempre preparado.' }] : []),
        ...(nivel >= 7 ? [{ id:'goo-dom-beast',    name:'Dominate Beast ◆',     level:4, castTime:'Acción',       range:'18 m',  duration:'Conc. 1 min', concentration:true, combat:true, domain:true, desc:'Save SAB o bestia bajo control. Siempre preparado.' }] : []),
        ...(nivel >= 7 ? [{ id:'goo-evards-tentacles',name:"Evard's Black Tentacles ◆", level:4, castTime:'Acción', range:'27 m', duration:'Conc. 1 min', concentration:true, combat:true, domain:true, desc:'Área 6m: atrapado + 3d6 contundente/turno. Siempre preparado.' }] : []),
        ...(nivel >= 9 ? [{ id:'goo-dom-person',   name:'Dominate Person ◆',    level:5, castTime:'Acción',       range:'18 m',  duration:'Conc. 1 min', concentration:true, combat:true, domain:true, desc:'Save SAB o humanoide bajo control. Siempre preparado.' }] : []),
        ...(nivel >= 9 ? [{ id:'goo-telekinesis',  name:'Telekinesis ◆',         level:5, castTime:'Acción',       range:'18 m',  duration:'Conc. 10 min',concentration:true, combat:true, domain:true, desc:'Mueve objetos/criaturas con la mente. Siempre preparado.' }] : []),
      ],
      resources: () => [],
      features: (nivel) => [
        { id:'goo-awakened-mind', name:'Awakened Mind',
          source:'The Great Old One · Nv1', type:'passive', action:'Pasiva', range:'9 m', recharge:null,
          desc:'Podés comunicarte telepáticamente con cualquier criatura en 9 m que entienda un idioma.',
          fullDesc:'A nivel 1, tu conocimiento extraño te da la capacidad de tocar las mentes de otras criaturas. Puedes comunicarte telepáticamente con cualquier criatura que puedas ver a 9 metros de ti. No necesitas compartir un idioma con la criatura, pero debe ser capaz de entender al menos un idioma.' },
        ...(nivel >= 6 ? [{ id:'goo-entropic-ward', name:'Entropic Ward',
          source:'The Great Old One · Nv6', type:'active', action:'Reacción', range:'Personal', recharge:'Short/Long Rest',
          desc:'Imponés desventaja en un ataque contra vos. Si falla, ganás ventaja en tu próximo ataque contra esa criatura.',
          fullDesc:'A nivel 6, aprendes a asustar místicamente a tu enemigo y convertir sus fallas en tu ventaja. Cuando una criatura hace una tirada de ataque contra ti, puedes usar tu reacción para imponerle desventaja. Si el ataque falla, tu próxima tirada de ataque contra esa criatura tiene ventaja si la haces antes del final de tu siguiente turno.' }] : []),
        ...(nivel >= 10 ? [{ id:'goo-thought-shield', name:'Thought Shield',
          source:'The Great Old One · Nv10', type:'passive', action:'Pasiva', range:'Personal', recharge:null,
          desc:'Nadie puede leer tu mente sin tu permiso. Resistencia al daño psíquico. Daño psíquico recibido también lo recibe el atacante.',
          fullDesc:'A nivel 10, tus pensamientos no pueden ser leídos por telepatía u otros medios, a menos que lo permitas. Tienes resistencia al daño psíquico. Siempre que una criatura te cause daño psíquico, esa criatura recibe el mismo daño.' }] : []),
        ...(nivel >= 14 ? [{ id:'goo-create-thrall', name:'Create Thrall',
          source:'The Great Old One · Nv14', type:'active', action:'Acción', range:'Toque', recharge:null,
          desc:'Tocás a un humanoide inconsciente → queda encantado por vos (sin save). Se rompe con Remove Curse.',
          fullDesc:'A nivel 14, ganas la capacidad de infectar la mente de un humanoide con la magia extraplanar de tu patrón. Puedes usar tu acción para tocar a un humanoide incapacitado. Esa criatura queda encantada por ti hasta que se lance Remove Curse en ella, se cure su condición de incapacitada, o uses esta habilidad de nuevo. Puedes comunicarte telepáticamente con la criatura encantada siempre que estén en el mismo plano.' }] : []),
      ],
    },

    'The Archfey': {
      clase: 'Brujo',
      subclassSpells: (nivel) => [
        { id:'af-faerie-fire',   name:'Faerie Fire ◆',          level:1, castTime:'Acción',       range:'18 m',  duration:'Conc. 1 min', concentration:true, combat:true, domain:true, desc:'Objetos/criaturas brillan · ventaja en ataques vs ellos. Siempre preparado.' },
        { id:'af-sleep',         name:'Sleep ◆',                level:1, castTime:'Acción',       range:'27 m',  duration:'1 min',       concentration:false, combat:true, domain:true, desc:'5d8 HP de criaturas se duermen (menos HP primero). Siempre preparado.' },
        ...(nivel >= 3 ? [{ id:'af-calm-emotions',name:'Calm Emotions ◆',        level:2, castTime:'Acción',       range:'18 m',  duration:'Conc. 1 min', concentration:true, combat:false, domain:true, desc:'Neutraliza Charmed/Frightened o suprime hostilidad. Siempre preparado.' }] : []),
        ...(nivel >= 3 ? [{ id:'af-phantasmal-force2',name:'Phantasmal Force ◆', level:2, castTime:'Acción',       range:'18 m',  duration:'Conc. 1 min', concentration:true, combat:true, domain:true, desc:'Save INT o criatura cree ilusión + 1d6 psíquico/turno. Siempre preparado.' }] : []),
        ...(nivel >= 5 ? [{ id:'af-blink',         name:'Blink ◆',               level:3, castTime:'Acción',       range:'Uno mismo', duration:'1 min',   concentration:false, combat:true, domain:true, desc:'50% prob de ir al plano etéreo por turno. Siempre preparado.' }] : []),
        ...(nivel >= 5 ? [{ id:'af-plant-growth',  name:'Plant Growth ◆',         level:3, castTime:'Acción',       range:'45 m',  duration:'Inst.',       concentration:false, combat:true, domain:true, desc:'Vegetación 4× difícil en 30m. Siempre preparado.' }] : []),
        ...(nivel >= 7 ? [{ id:'af-dom-beast2',    name:'Dominate Beast ◆',        level:4, castTime:'Acción',       range:'18 m',  duration:'Conc. 1 min', concentration:true, combat:true, domain:true, desc:'Save SAB o bestia bajo control. Siempre preparado.' }] : []),
        ...(nivel >= 7 ? [{ id:'af-greater-invis2',name:'Greater Invisibility ◆', level:4, castTime:'Acción',       range:'Toque', duration:'Conc. 1 min', concentration:true, combat:true, domain:true, desc:'Invisible incluso al atacar. Siempre preparado.' }] : []),
        ...(nivel >= 9 ? [{ id:'af-dom-person2',   name:'Dominate Person ◆',       level:5, castTime:'Acción',       range:'18 m',  duration:'Conc. 1 min', concentration:true, combat:true, domain:true, desc:'Save SAB o humanoide bajo control. Siempre preparado.' }] : []),
        ...(nivel >= 9 ? [{ id:'af-seeming',       name:'Seeming ◆',               level:5, castTime:'Acción',       range:'9 m',   duration:'8 h',         concentration:false, combat:false, domain:true, desc:'Hasta 6 criaturas cambian apariencia visual y auditiva. Siempre preparado.' }] : []),
      ],
      resources: () => [],
      features: (nivel) => [
        { id:'af-fey-presence', name:'Fey Presence',
          source:'The Archfey · Nv1', type:'active', action:'Acción', range:'3 m (cubo)', recharge:'Short/Long Rest',
          desc:'Cubo 3 m: todas las criaturas deben superar un save de SAB o quedan Encantadas o Asustadas (tu elección) hasta fin de tu próximo turno.',
          fullDesc:'A nivel 1 puedes canalizas la presencia encantadora o aterradora de tu patrón Archfey. Como acción, fuerzas a cada criatura en un cubo de 3 metros originado en ti a hacer un save de SAB contra tu DC de conjuro. Las criaturas que fallen quedan Encantadas o Asustadas por ti (tu elección) hasta el final de tu próximo turno.' },
        ...(nivel >= 6 ? [{ id:'af-misty-escape', name:'Misty Escape',
          source:'The Archfey · Nv6', type:'active', action:'Reacción', range:'Personal', recharge:'Short/Long Rest',
          desc:'Cuando recibís daño: teleportación hasta 18 m y te volvés invisible hasta inicio de tu próximo turno o hasta que ataques/lances.',
          fullDesc:'A nivel 6, puedes desvanecerte en la niebla cuando estás en peligro. Cuando recibes daño, puedes usar tu reacción para volverte invisible y teleportarte hasta 18 metros a un espacio desocupado que puedas ver. Permaneces invisible hasta el comienzo de tu próximo turno o hasta que ataques o lances un conjuro.' }] : []),
        ...(nivel >= 10 ? [{ id:'af-beguiling-defenses', name:'Beguiling Defenses',
          source:'The Archfey · Nv10', type:'passive', action:'Pasiva', range:'Personal', recharge:null,
          desc:'Sos inmune a ser Encantado. Cuando alguien intenta encantarte, podés usar reacción para reflejar el efecto sobre él (save SAB negación).',
          fullDesc:'A nivel 10, tu patrón te enseña a redirigir los encantos hacia tus enemigos. Eres inmune a ser encantado. Cuando una criatura intenta encantarte, puedes usar tu reacción para intentar volver el encantamiento contra ella. La criatura debe tener éxito en un save de SAB contra tu DC de conjuro o quedará encantada por ti por 1 minuto o hasta que reciba daño.' }] : []),
        ...(nivel >= 14 ? [{ id:'af-dark-delirium', name:'Dark Delirium',
          source:'The Archfey · Nv14', type:'active', action:'Acción', range:'18 m', recharge:'Short/Long Rest',
          desc:'Save SAB o la criatura está sumida en ilusiones 1 min: Encantada o Asustada, incapaz de ver o escuchar más allá de 3 m.',
          fullDesc:'A nivel 14, puedes hundir a una criatura en un mundo ilusorio. Como acción, elige una criatura que puedas ver a 18 metros. Debe hacer un save de SAB contra tu DC. Si falla, queda Encantada o Asustada (tu elección) durante 1 minuto o hasta que recibas daño. Este efecto termina si la criatura recibe daño. Mientras dura, la criatura está perdida en una ilusión y no puede ver ni escuchar más allá de 3 metros.' }] : []),
      ],
    },
  };

  // ── CLASE_SPELLS: hechizos base por clase ─────────────────────────────────
  // Catálogo representativo para empezar. El usuario puede agregar más después.
  const CLASE_SPELLS = {

    'Clérigo': [
      // Cantrips
      { id:'sacred-flame',   name:'Sacred Flame',    level:0, castTime:'Acción',       range:'18 m',  duration:'Inst.', concentration:false, combat:true,  desc:'Save DES (no cubre ventaja por cobertura) · 1d8 radiante. Escala nv5/11/17.' },
      { id:'toll-the-dead',  name:'Toll the Dead',   level:0, castTime:'Acción',       range:'18 m',  duration:'Inst.', concentration:false, combat:true,  desc:'Save SAB · 1d8 necrótico (1d12 si herido). Escala nv5/11/17.' },
      { id:'guidance-c',     name:'Guidance',        level:0, castTime:'Acción',       range:'Toque', duration:'1 min', concentration:true,  combat:false, desc:'Concentración · +1d4 a una tirada de habilidad.' },
      { id:'word-of-radiance', name:'Word of Radiance', level:0, castTime:'Acción',   range:'1,5 m', duration:'Inst.', concentration:false, combat:true,  desc:'Cada criatura en 5ft · save CON · 1d6 radiante. Escala nv5/11/17.' },
      { id:'thaumaturgy',    name:'Thaumaturgy',     level:0, castTime:'Acción',       range:'9 m',   duration:'1 min', concentration:false, combat:false, desc:'Efecto menor: voz potente, ojos brillantes, temblor de suelo, etc. (3 opciones).' },
      { id:'mending-c',      name:'Mending',         level:0, castTime:'1 min',        range:'Toque', duration:'Inst.', concentration:false, combat:false, desc:'Repara un objeto partido o roto en dos (hasta 30 cm).' },
      { id:'light-c',        name:'Light',           level:0, castTime:'Acción',       range:'Toque', duration:'1 h',   concentration:false, combat:false, desc:'Objeto toca: emite luz brillante 6 m y tenue 6 m más. Save DES si está en manos de alguien.' },
      { id:'resistance-c',   name:'Resistance',      level:0, castTime:'Acción',       range:'Toque', duration:'1 min', concentration:true,  combat:false, desc:'Concentración · +1d4 a una tirada de salvación.' },
    ],

    'Druida': [
      // Cantrips
      { id:'shillelagh',    name:'Shillelagh',      level:0, castTime:'Acción bonus', range:'Toque',     duration:'1 min',  concentration:false, combat:true,  desc:'Arma de madera usa SAB en vez de FUE, daño 1d8.' },
      { id:'guidance',      name:'Guidance',         level:0, castTime:'Acción',       range:'Toque',     duration:'1 min',  concentration:true,  combat:false, desc:'Concentración · +1d4 a una tirada de habilidad.' },
      { id:'produce-flame', name:'Produce Flame',    level:0, castTime:'Acción',       range:'Uno mismo', duration:'10 min', concentration:false, combat:true,  desc:'Llama en la mano: ilumina 10ft o 1d8 fuego al lanzar.' },
      { id:'druidcraft',    name:'Druidcraft',       level:0, castTime:'Acción',       range:'4,5 m',     duration:'Inst.', concentration:false, combat:false, desc:'Predicción del clima, hacer florecer plantas, crear efecto sensorial menor.' },
      { id:'thorn-whip',    name:'Thorn Whip',       level:0, castTime:'Acción',       range:'9 m',       duration:'Inst.', concentration:false, combat:true,  desc:'Ataque de toque a distancia · 1d6 perforante · jala 3m si es Grande o menos. Escala nv5/11/17.' },
      { id:'poison-spray-d',name:'Poison Spray',     level:0, castTime:'Acción',       range:'3 m',       duration:'Inst.', concentration:false, combat:true,  desc:'Save CON · 1d12 veneno. Escala nv5/11/17.' },
      { id:'mending-d',     name:'Mending',          level:0, castTime:'1 min',        range:'Toque',     duration:'Inst.', concentration:false, combat:false, desc:'Repara una rotura u orificio en un objeto (hasta 30 cm).' },
      { id:'resistance-d',  name:'Resistance',       level:0, castTime:'Acción',       range:'Toque',     duration:'1 min', concentration:true,  combat:false, desc:'Concentración · +1d4 a una tirada de salvación.' },
      { id:'entangle',    name:'Entangle',          level:1, castTime:'Acción',       range:'27 m', duration:'1 min',    concentration:true,  combat:true,  desc:'Save FUE o restringido en área de plantas (18ft²).' },
      { id:'healing-word-d', name:'Healing Word',  level:1, castTime:'Acción bonus', range:'18 m', duration:'Inst.',    concentration:false, combat:false, desc:'1d4+SAB HP. Escala +1d4 por nivel superior.' },
      { id:'faerie-fire', name:'Faerie Fire',       level:1, castTime:'Acción',       range:'18 m', duration:'1 min',    concentration:true,  combat:true,  desc:'Save DES o brillan → ventaja en ataques contra ellos.' },
      { id:'thunderwave-d', name:'Thunderwave',    level:1, castTime:'Acción',       range:'Uno mismo (15ft)', duration:'Inst.', concentration:false, combat:true, desc:'Cubo 15ft · save CON · 2d8 trueno y empuja 10ft.' },
      { id:'spike-growth',name:'Spike Growth',     level:2, castTime:'Acción',       range:'45 m', duration:'10 min',   concentration:true,  combat:true,  desc:'Área difícil 20ft radio · 2d4 perforante por 5ft caminados.' },
      { id:'moonbeam',    name:'Moonbeam',          level:2, castTime:'Acción',       range:'36 m', duration:'1 min',    concentration:true,  combat:true,  desc:'Cilindro 5ft · save CON · 2d10 radiante por turno.' },
      { id:'flaming-sphere', name:'Flaming Sphere', level:2, castTime:'Acción',      range:'18 m', duration:'1 min',    concentration:true,  combat:true,  desc:'Esfera 5ft · 2d6 fuego save DES · movible bonus action.' },
      { id:'heat-metal-d',  name:'Heat Metal',      level:2, castTime:'Acción',       range:'18 m', duration:'1 min',    concentration:true,  combat:true,  desc:'Metal se calienta: 2d8 fuego c/turno · soltar objeto o desventaja en attacks/ability checks.' },
      { id:'lesser-restoration-d', name:'Lesser Restoration', level:2, castTime:'Acción', range:'Toque', duration:'Inst.', concentration:false, combat:false, desc:'Elimina una enfermedad o condición: cegado, sordo, paralizado o envenenado.' },
      // ── Nivel 3 ──
      { id:'call-lightning-d', name:'Call Lightning', level:3, castTime:'Acción',    range:'27 m', duration:'10 min',   concentration:true,  combat:true,  desc:'Nube de tormenta: acción bonus para 3d10 rayos a cualquier punto debajo.' },
      { id:'conjure-animals-d', name:'Conjure Animals', level:3, castTime:'Acción',  range:'18 m', duration:'1 h',      concentration:true,  combat:true,  desc:'Invoca bestias de CR ≤ 2 que obedecen órdenes.' },
      { id:'daylight-d',    name:'Daylight',          level:3, castTime:'Acción',       range:'18 m', duration:'1 h',      concentration:false, combat:false, desc:'Esfera de luz brillante 18m de radio.' },
      { id:'dispel-magic-d', name:'Dispel Magic',     level:3, castTime:'Acción',       range:'36 m', duration:'Inst.',    concentration:false, combat:true,  desc:'Termina conjuros en objetivo. +alto: check SAB.' },
      { id:'wind-wall-d',   name:'Wind Wall',          level:3, castTime:'Acción',       range:'36 m', duration:'1 min',    concentration:true,  combat:true,  desc:'Muro de viento: impide proyectiles, 3d8 trueno a criaturas en zona.' },
      { id:'sleet-storm-d', name:'Sleet Storm',        level:3, castTime:'Acción',       range:'45 m', duration:'1 min',    concentration:true,  combat:true,  desc:'Cilindro de aguanieve: terreno difícil, visibilidad nula, save DES o caído.' },
      // ── Nivel 4 ──
      { id:'blight-d',      name:'Blight',             level:4, castTime:'Acción',       range:'9 m',  duration:'Inst.',    concentration:false, combat:true,  desc:'Save CON · 8d8 necrótico. Doble vs plantas.' },
      { id:'confusion-d',   name:'Confusion',          level:4, castTime:'Acción',       range:'27 m', duration:'1 min',    concentration:true,  combat:true,  desc:'Esfera 3m · save SAB o acción aleatoria c/turno.' },
      { id:'freedom-movement-d', name:'Freedom of Movement', level:4, castTime:'Acción', range:'Toque', duration:'1 h',    concentration:false, combat:true,  desc:'Ignora terreno difícil y efectos de inmovilización.' },
      { id:'stone-shape-d', name:'Stone Shape',        level:4, castTime:'Acción',       range:'Toque',duration:'Inst.',    concentration:false, combat:false, desc:'Da forma a hasta 1,5ft³ de piedra como quieras.' },
      { id:'stoneskin-d',   name:'Stoneskin',          level:4, castTime:'Acción',       range:'Toque',duration:'1 h',      concentration:true,  combat:true,  desc:'Resistencia a daño no mágico de arma (B/P/S).' },
      // ── Nivel 5 ──
      { id:'commune-nature-d', name:'Commune with Nature', level:5, castTime:'1 min',   range:'Uno mismo', duration:'Inst.', concentration:false, combat:false, ritual:true, desc:'Info del terreno en radio 5km. Ritual.' },
      { id:'conjure-elem-d', name:'Conjure Elemental', level:5, castTime:'1 min',        range:'27 m', duration:'1 h',      concentration:true,  combat:true,  desc:'Invoca un elemental CR ≤ tu nivel de conjurador.' },
      { id:'mass-cure-d',   name:'Mass Cure Wounds',   level:5, castTime:'Acción',       range:'18 m', duration:'Inst.',    concentration:false, combat:false, desc:'Hasta 6 criaturas: 3d8+SAB HP c/u. +1d8 por nivel.' },
      { id:'reincarnate-d', name:'Reincarnate',        level:5, castTime:'1 h',           range:'Toque',duration:'Inst.',    concentration:false, combat:false, desc:'Revive criatura muerta hace ≤10 días en un cuerpo nuevo (raza aleatoria).' },
      { id:'wall-of-stone-d', name:'Wall of Stone',    level:5, castTime:'Acción',        range:'36 m', duration:'10 min',   concentration:true,  combat:true,  desc:'Muro de piedra sólida de hasta 10 paneles (3×1m c/u).' },
      // ── Nivel 6 ──
      { id:'conjure-fey-d', name:'Conjure Fey',        level:6, castTime:'1 min',         range:'27 m', duration:'1 h',     concentration:true,  combat:true,  desc:'Invoca criatura feérica CR ≤ 6 o hasta 3 CR ≤ 3.' },
      { id:'heal-d',        name:'Heal',                level:6, castTime:'Acción',        range:'18 m', duration:'Inst.',   concentration:false, combat:false, desc:'Una criatura recupera 70 HP y se eliminan condiciones. +10 HP por nivel.' },
      { id:'sunbeam-d',     name:'Sunbeam',             level:6, castTime:'Acción',        range:'Línea 18m', duration:'1 min', concentration:true, combat:true, desc:'Rayo de luz · save CON · 6d8 radiante + cegado. Acción bonus para repetir.' },
      { id:'transport-tree-d', name:'Transport via Plants', level:6, castTime:'Acción',   range:'3 m',  duration:'1 ronda', concentration:false, combat:false, desc:'Portal entre dos plantas de la misma especie.' },
      { id:'wall-thorns-d', name:'Wall of Thorns',      level:6, castTime:'Acción',        range:'36 m', duration:'10 min',  concentration:true,  combat:true,  desc:'Muro de espinas 18m: terreno difícil, 7d8 perforante al cruzar.' },
    ],

    'Bardo': [
      // Cantrips
      { id:'vicious-mockery',  name:'Vicious Mockery',  level:0, castTime:'Acción', range:'18 m', duration:'Inst.',     concentration:false, combat:true,  desc:'Save SAB o 1d4 psíquico + desventaja en próximo ataque. Escala nv5/11/17.' },
      { id:'minor-illusion',   name:'Minor Illusion',   level:0, castTime:'Acción', range:'9 m',  duration:'1 min',     concentration:false, combat:false, desc:'Sonido o imagen inanimada de cubo 5ft.' },
      { id:'prestidigitation-b',name:'Prestidigitation',level:0, castTime:'Acción', range:'3 m',  duration:'Hasta 1h',  concentration:false, combat:false, desc:'Truco menor: limpiar, encender, sabor, etc.' },
      { id:'mage-hand-b',      name:'Mage Hand',        level:0, castTime:'Acción', range:'9 m',  duration:'1 min',     concentration:false, combat:false, desc:'Mano espectral manipula objetos hasta 5 kg.' },
      { id:'friends-b',        name:'Friends',          level:0, castTime:'Acción', range:'Uno mismo', duration:'1 min', concentration:true, combat:false, desc:'Concentración · ventaja en checks de CAR vs criatura no hostil. Puede notar el hechizo al terminar.' },
      { id:'thunderclap-b',    name:'Thunderclap',      level:0, castTime:'Acción', range:'Uno mismo (5ft)', duration:'Inst.', concentration:false, combat:true, desc:'Todas las criaturas en 1,5m · save CON · 1d6 trueno. Escala nv5/11/17.' },
      { id:'light-b',          name:'Light',            level:0, castTime:'Acción', range:'Toque', duration:'1 h',      concentration:false, combat:false, desc:'Objeto emite luz brillante 6m y tenue 6m más.' },
      { id:'healing-word-b',  name:'Healing Word',    level:1, castTime:'Acción bonus', range:'18 m', duration:'Inst.', concentration:false, combat:false, desc:'1d4+CAR HP · como bonus action.' },
      { id:'thunderwave-b',   name:'Thunderwave',     level:1, castTime:'Acción', range:'Uno mismo (15ft)', duration:'Inst.', concentration:false, combat:true, desc:'Cubo 15ft · save CON · 2d8 trueno y empuja 10ft.' },
      { id:'dissonant-whispers', name:'Dissonant Whispers', level:1, castTime:'Acción', range:'18 m', duration:'Inst.', concentration:false, combat:true, desc:'Save SAB o 3d6 psíquico y huye. Escala +1d6 por nivel.' },
      { id:'hold-person-b',   name:'Hold Person',     level:2, castTime:'Acción', range:'18 m', duration:'1 min', concentration:true,  combat:true,  desc:'Save SAB o paralizado. Repite save c/turno.' },
      { id:'suggestion',      name:'Suggestion',      level:2, castTime:'Acción', range:'9 m',  duration:'8 h',   concentration:true,  combat:false, desc:'Save SAB o sigue sugerencia razonable.' },
      { id:'shatter',         name:'Shatter',         level:2, castTime:'Acción', range:'18 m', duration:'Inst.', concentration:false, combat:true,  desc:'Esfera 10ft · save CON · 3d8 trueno. +1d8 por nivel.' },
      { id:'enhance-ability-b',name:'Enhance Ability',level:2, castTime:'Acción', range:'Toque',duration:'1 h',   concentration:true,  combat:false, desc:'Ventaja en checks de una stat a un aliado. +1 criatura/nivel.' },
      { id:'invisibility-b',  name:'Invisibility',    level:2, castTime:'Acción', range:'Toque',duration:'1 h',   concentration:true,  combat:true,  desc:'Invisible hasta que ataque o lance un conjuro.' },
      { id:'silence-b',       name:'Silence',         level:2, castTime:'Acción', range:'27 m', duration:'10 min',concentration:true,  combat:true,  desc:'Esfera 6m: sin sonido · sin conjuros verbales. Ritual.' },
      // ── Nivel 3 ──
      { id:'fear-b',          name:'Fear',            level:3, castTime:'Acción', range:'Uno mismo (cono 9m)', duration:'1 min', concentration:true, combat:true, desc:'Save SAB o asustado y huye; descarta objetos.' },
      { id:'hypnotic-pattern-b', name:'Hypnotic Pattern', level:3, castTime:'Acción', range:'36 m', duration:'1 min', concentration:true, combat:true, desc:'Cubo 9m · save SAB o Charmed+Incapacitado+vel 0. Se rompe si recibe daño o alguien usa acción para sacarla.' },
      { id:'speak-dead-b',    name:'Speak with Dead', level:3, castTime:'Acción', range:'3 m',  duration:'10 min',concentration:false, combat:false, desc:'Hasta 5 preguntas a un cadáver.' },
      { id:'tongues-b',       name:'Tongues',         level:3, castTime:'Acción', range:'Toque',duration:'1 h',   concentration:false, combat:false, desc:'Entiende y habla cualquier idioma.' },
      { id:'dispel-magic-b',  name:'Dispel Magic',    level:3, castTime:'Acción', range:'36 m', duration:'Inst.', concentration:false, combat:true, desc:'Termina conjuros en objetivo. +alto: check CAR.' },
      { id:'sending',         name:'Sending',         level:3, castTime:'Acción', range:'Ilimitado', duration:'1 ronda', concentration:false, combat:false, desc:'Mensaje de 25 palabras a cualquier criatura conocida.' },
      // ── Nivel 4 ──
      { id:'compulsion-b',    name:'Compulsion',      level:4, castTime:'Acción', range:'9 m',  duration:'1 min', concentration:true,  combat:true,  desc:'Save SAB o se mueve cada turno en una dirección sin atacar.' },
      { id:'confusion-b',     name:'Confusion',       level:4, castTime:'Acción', range:'27 m', duration:'1 min', concentration:true,  combat:true,  desc:'Esfera 3m · save SAB o acción aleatoria c/turno.' },
      { id:'dimension-door-b',name:'Dimension Door',  level:4, castTime:'Acción', range:'150 m',duration:'Inst.', concentration:false, combat:true,  desc:'Teleportación vos +1 aliado a 150m.' },
      { id:'freedom-movement-b',name:"Freedom of Movement", level:4, castTime:'Acción', range:'Toque', duration:'1 h', concentration:false, combat:true, desc:'Ignora terreno difícil y efectos de reducción de velocidad.' },
      { id:'greater-invis-b', name:'Greater Invisibility', level:4, castTime:'Acción', range:'Toque', duration:'1 min', concentration:true, combat:true, desc:'Invisible incluso atacando o lanzando conjuros.' },
      // ── Nivel 5 ──
      { id:'animate-objects-b',name:'Animate Objects', level:5, castTime:'Acción', range:'36 m',duration:'1 min', concentration:true,  combat:true,  desc:'Hasta 10 objetos pequeños animados atacan.' },
      { id:'dominate-person-b',name:'Dominate Person', level:5, castTime:'Acción', range:'18 m',duration:'1 min', concentration:true,  combat:true,  desc:'Save SAB o humanoide bajo tu control.' },
      { id:'mass-cure-wounds-b',name:'Mass Cure Wounds', level:5, castTime:'Acción', range:'18 m', duration:'Inst.', concentration:false, combat:false, desc:'Hasta 6 criaturas: 3d8+CAR HP c/u. +1d8 por nivel.' },
      { id:'hold-monster-b',  name:'Hold Monster',    level:5, castTime:'Acción', range:'18 m', duration:'1 min', concentration:true,  combat:true,  desc:'Save SAB o paralizado (cualquier criatura).' },
      { id:'mass-suggestion-b',name:'Mass Suggestion', level:5, castTime:'Acción', range:'18 m', duration:'24 h', concentration:false, combat:false, desc:'Hasta 12 criaturas siguen sugerencia razonable. (Escala a nivel 6.)' },
      // ── Nivel 6 ──
      { id:'eyebite-b',       name:'Eyebite',         level:6, castTime:'Acción', range:'Uno mismo', duration:'1 min', concentration:true, combat:true, desc:'Mirada mágica c/turno: dormido, asustado o mareado (save SAB).' },
      { id:'otto-dance-b',    name:"Otto's Irresistible Dance", level:6, castTime:'Acción', range:'9 m', duration:'1 min', concentration:true, combat:true, desc:'Save SAB o baila: vel 0, -2CA, desventaja DES, no concentración.' },
      { id:'guards-wards-b',  name:'Guards and Wards', level:6, castTime:'10 min', range:'Toque', duration:'24 h', concentration:false, combat:false, desc:'Protege un edificio de hasta 2500ft²: niebla, laberintos, alarmas y guardianes.' },
    ],

    'Hechicero': [
      // ── Cantrips (6 a nivel 12 según tabla) ──
      { id:'sorcerous-burst-s', name:'Sorcerous Burst',   level:0, castTime:'Acción',       range:'27 m',       duration:'Inst.',       concentration:false, combat:true,  desc:'Ataque a distancia · 1d8 del tipo elegido (ácido, frío, fuego, rayo, veneno, psíquico, trueno). Si tirás el máximo en cualquier dado, tirás 1d8 extra del mismo tipo. (PHB 2024)' },
      { id:'fire-bolt-s',       name:'Fire Bolt',         level:0, castTime:'Acción',       range:'36 m',       duration:'Inst.',       concentration:false, combat:true,  desc:'Ataque a distancia · 1d10 fuego. (2d10 nv5, 3d10 nv11, 4d10 nv17).' },
      { id:'ray-of-frost-s',    name:'Ray of Frost',      level:0, castTime:'Acción',       range:'18 m',       duration:'Inst.',       concentration:false, combat:true,  desc:'Ataque a distancia · 1d8 frío · vel -10ft hasta tu turno. Escala nv5/11/17.' },
      { id:'shocking-grasp-s',  name:'Shocking Grasp',    level:0, castTime:'Acción',       range:'Toque',      duration:'Inst.',       concentration:false, combat:true,  desc:'Ataque de toque · 1d8 relámpago · objetivo no puede reaccionar hasta su turno. Ventaja si lleva metal.' },
      { id:'minor-illusion-s',  name:'Minor Illusion',    level:0, castTime:'Acción',       range:'9 m',        duration:'1 min',       concentration:false, combat:false, desc:'Sonido o imagen pequeña (cubo 5ft). Investigación para descubrir.' },
      { id:'prestidigitation-s',name:'Prestidigitation',  level:0, castTime:'Acción',       range:'3 m',        duration:'1 h',         concentration:false, combat:false, desc:'Trucos menores mágicos: limpiar, encender, crear símbolo, sabor, olor…' },
      { id:'mage-hand-s',       name:'Mage Hand',         level:0, castTime:'Acción',       range:'9 m',        duration:'1 min',       concentration:false, combat:false, desc:'Mano espectral puede manipular objetos hasta 5 kg.' },
      { id:'chill-touch-s',     name:'Chill Touch',       level:0, castTime:'Acción',       range:'18 m',       duration:'1 ronda',     concentration:false, combat:true,  desc:'Ataque a distancia · 1d8 necrótico · muertos vivientes con desventaja en ataques vs vos.' },
      { id:'poison-spray-s',    name:'Poison Spray',      level:0, castTime:'Acción',       range:'3 m',        duration:'Inst.',       concentration:false, combat:true,  desc:'Save CON · 1d12 veneno. Escala nv5/11/17.' },
      { id:'true-strike-s',     name:'True Strike',       level:0, castTime:'Acción bonus', range:'9 m',        duration:'Conc. 1 ronda', concentration:true, combat:true, desc:'Concentración en objetivo; ventaja en tu primer ataque vs él el próximo turno.' },
      { id:'acid-splash-s',      name:'Acid Splash',       level:0, castTime:'Acción',       range:'18 m',             duration:'Inst.',         concentration:false, combat:true,  desc:'Save DES · 1d6 ácido. Puede afectar 2 criaturas adyacentes. Escala nv5/11/17.' },
      { id:'blade-ward-s',       name:'Blade Ward',        level:0, castTime:'Acción',       range:'Uno mismo',        duration:'Conc. 1 ronda', concentration:true,  combat:true,  desc:'Resistencia a daño contundente, perforante y cortante de armas hasta inicio de tu próx. turno.' },
      { id:'dancing-lights-s',   name:'Dancing Lights',    level:0, castTime:'Acción',       range:'36 m',             duration:'1 min',         concentration:true,  combat:false, desc:'Hasta 4 luces flotantes en 9m · iluminan 3m brillante cada una.' },
      { id:'friends-s',          name:'Friends',           level:0, castTime:'Acción',       range:'Uno mismo',        duration:'1 min',         concentration:true,  combat:false, desc:'Ventaja en checks CAR vs criatura no hostil. Puede notar el hechizo al terminar.' },
      { id:'light-s',            name:'Light',             level:0, castTime:'Acción',       range:'Toque',            duration:'1 h',           concentration:false, combat:false, desc:'Objeto emite luz brillante 6m y tenue 6m más. Save DES si alguien lo lleva.' },
      { id:'mending-s',          name:'Mending',           level:0, castTime:'1 min',        range:'Toque',            duration:'Inst.',         concentration:false, combat:false, desc:'Repara una rotura u orificio en un objeto.' },
      { id:'message-s',          name:'Message',           level:0, castTime:'Acción',       range:'36 m',             duration:'1 ronda',       concentration:false, combat:false, desc:'Susurro mágico a una criatura. Solo ella oye y puede responder.' },
      { id:'mind-sliver-s',      name:'Mind Sliver',       level:0, castTime:'Acción',       range:'18 m',             duration:'1 ronda',       concentration:false, combat:true,  desc:'Save INT o 1d6 psíquico · -1d4 en próximo save antes de tu próximo turno. Escala nv5/11/17.' },
      { id:'thunderclap-s',      name:'Thunderclap',       level:0, castTime:'Acción',       range:'Uno mismo (1,5m)', duration:'Inst.',         concentration:false, combat:true,  desc:'Todas las criaturas en 1,5m · save CON · 1d6 trueno. Escala nv5/11/17.' },
      { id:'elementalism-s',     name:'Elementalism',      level:0, castTime:'Acción',       range:'9 m',              duration:'Inst.',         concentration:false, combat:false, desc:'Efecto elemental menor: soplo de aire, llamita, agua, tierra. (2024)' },
      // Cantrips extendidos (Tasha's / Xanathar's / SCAG)
      { id:'booming-blade-s',    name:'Booming Blade',     level:0, castTime:'Acción',       range:'Uno mismo (1,5m)', duration:'1 ronda',       concentration:false, combat:true,  desc:'Ataque cuerpo a cuerpo + 0/1d8 trueno extra si se mueve. Escala nv5/11/17. (SCAG/Tasha\'s)' },
      { id:'green-flame-s',      name:'Green-Flame Blade', level:0, castTime:'Acción',       range:'Uno mismo (1,5m)', duration:'Inst.',         concentration:false, combat:true,  desc:'Ataque cuerpo a cuerpo + llama verde salta a criatura adyacente (0/1d8 fuego). (SCAG/Tasha\'s)' },
      { id:'sword-burst-s',      name:'Sword Burst',       level:0, castTime:'Acción',       range:'Uno mismo (1,5m)', duration:'Inst.',         concentration:false, combat:true,  desc:'Save DES · 1d6 fuerza a todas las criaturas en 1,5m. Escala nv5/11/17. (SCAG/Tasha\'s)' },
      { id:'infestation-s',      name:'Infestation',       level:0, castTime:'Acción',       range:'9 m',              duration:'Inst.',         concentration:false, combat:true,  desc:'Save CON · 1d6 veneno · la criatura se mueve 1,5m en dirección aleatoria. (Xanathar\'s)' },
      { id:'create-bonfire-s',   name:'Create Bonfire',    level:0, castTime:'Acción',       range:'18 m',             duration:'1 min',         concentration:true,  combat:true,  desc:'Hoguera en cuadrado 1,5m · save DES al entrar o pasar · 1d8 fuego. Escala. (Xanathar\'s)' },
      { id:'frostbite-s',        name:'Frostbite',         level:0, castTime:'Acción',       range:'18 m',             duration:'Inst.',         concentration:false, combat:true,  desc:'Save CON · 1d6 frío · desventaja en próximo ataque de arma. Escala nv5/11/17. (Xanathar\'s)' },
      { id:'shape-water-s',      name:'Shape Water',       level:0, castTime:'Acción',       range:'9 m',              duration:'Hasta 1 h',     concentration:false, combat:false, desc:'Mueve, congela, colorea o genera corrientes en 1,5m³ de agua. (Xanathar\'s)' },
      { id:'control-flames-s',   name:'Control Flames',    level:0, castTime:'Acción',       range:'18 m',             duration:'Hasta 1 h',     concentration:false, combat:false, desc:'Expande, extingue, mueve o cambia color/forma de una llama no mágica. (Xanathar\'s)' },
      { id:'gust-s',             name:'Gust',              level:0, castTime:'Acción',       range:'9 m',              duration:'Inst.',         concentration:false, combat:true,  desc:'Empuja criatura 1,5m (save FUE) o pequeño objeto 10 pies. Apaga llamas. (Xanathar\'s)' },
      // ── Nivel 1 ──
      { id:'burning-hands-s',   name:'Burning Hands',       level:1, castTime:'Acción',       range:'Cono 15ft',        duration:'Inst.',   concentration:false, combat:true,  desc:'Save DES · 3d6 fuego. +1d6 por nivel superior.' },
      { id:'chromatic-orb-s',   name:'Chromatic Orb',       level:1, castTime:'Acción',       range:'27 m',             duration:'Inst.',   concentration:false, combat:true,  desc:'Ataque a distancia · 3d8 de tipo elegido. +1d8 por nivel.' },
      { id:'magic-missile-s',   name:'Magic Missile',       level:1, castTime:'Acción',       range:'36 m',             duration:'Inst.',   concentration:false, combat:true,  desc:'3 dardos infalibles · 1d4+1 fuerza c/u. +1 dardo por nivel.' },
      { id:'shield-s',          name:'Shield',              level:1, castTime:'Reacción',     range:'Uno mismo',        duration:'1 ronda', concentration:false, combat:true,  desc:'Reacción al ser atacado · +5 CA hasta inicio de tu próximo turno · bloquea Magic Missile.' },
      { id:'thunderwave-s',     name:'Thunderwave',         level:1, castTime:'Acción',       range:'Uno mismo (4,5m)', duration:'Inst.',   concentration:false, combat:true,  desc:'Cubo 15ft · save CON · 2d8 trueno y empuja 3m. +1d8 por nivel.' },
      { id:'detect-magic-s',    name:'Detect Magic',        level:1, castTime:'Acción',       range:'Uno mismo',        duration:'10 min',  concentration:true,  combat:false, ritual:true, desc:'Detecta magia en 9 m · ves auras · ritual.' },
      { id:'sleep-s',           name:'Sleep',               level:1, castTime:'Acción',       range:'27 m',             duration:'1 min',   concentration:false, combat:true,  desc:'5d8 HP de criaturas se duermen (las de menos HP primero). Despierta al recibir daño.' },
      { id:'absorb-elements-s', name:'Absorb Elements',     level:1, castTime:'Reacción',     range:'Uno mismo',        duration:'1 ronda', concentration:false, combat:true,  desc:'Reacción al recibir daño elemental: resistencia + +1d6 del mismo tipo en próximo ataque.' },
      { id:'charm-person-s',    name:'Charm Person',        level:1, castTime:'Acción',       range:'9 m',              duration:'1 h',     concentration:false, combat:false, desc:'Save SAB o encantado. Considera amigo. +1 objetivo por nivel.' },
      { id:'color-spray-s',     name:'Color Spray',         level:1, castTime:'Acción',       range:'Uno mismo',        duration:'1 ronda', concentration:false, combat:true,  desc:'6d10 HP de criaturas cercanas quedan cegadas (menos HP primero).' },
      { id:'comprehend-lang-s', name:'Comprehend Languages',level:1, castTime:'Acción',       range:'Uno mismo',        duration:'1 h',     concentration:false, combat:false, ritual:true, desc:'Entendés cualquier idioma hablado o escrito. Ritual.' },
      { id:'disguise-self-s',   name:'Disguise Self',       level:1, castTime:'Acción',       range:'Uno mismo',        duration:'1 h',     concentration:false, combat:false, desc:'Cambia apariencia visual (no táctil).' },
      { id:'exp-retreat-s',     name:'Expeditious Retreat', level:1, castTime:'Acción bonus', range:'Uno mismo',        duration:'10 min',  concentration:true,  combat:true,  desc:'Acción bonus: Dash cada turno.' },
      { id:'false-life-s',      name:'False Life',          level:1, castTime:'Acción',       range:'Uno mismo',        duration:'1 h',     concentration:false, combat:false, desc:'Ganás 1d4+4 HP temporales. +5 HP por nivel.' },
      { id:'fog-cloud-s',       name:'Fog Cloud',           level:1, castTime:'Acción',       range:'27 m',             duration:'1 h',     concentration:true,  combat:true,  desc:'Esfera de niebla 6m · visibilidad nula.' },
      { id:'ice-knife-s',       name:'Ice Knife',           level:1, castTime:'Acción',       range:'18 m',             duration:'Inst.',   concentration:false, combat:true,  desc:'Ataque a distancia · 1d10 perforante · explota: save DES o 2d6 frío a criaturas en 1,5m.' },
      { id:'mage-armor-s',      name:'Mage Armor',          level:1, castTime:'Acción',       range:'Toque',            duration:'8 h',     concentration:false, combat:false, desc:'CA = 13 + mod DES si no lleva armadura.' },
      { id:'ray-of-sickness-s', name:'Ray of Sickness',     level:1, castTime:'Acción',       range:'9 m',              duration:'Inst.',   concentration:false, combat:true,  desc:'Ataque a distancia · 2d8 veneno · save CON o envenenado hasta tu próximo turno. +1d8/nivel.' },
      { id:'witch-bolt-s',      name:'Witch Bolt',          level:1, castTime:'Acción',       range:'9 m',              duration:'1 min',   concentration:true,  combat:true,  desc:'Ataque a distancia · 1d12 relámpago · acción bonus turno sig para repetir.' },
      { id:'feather-fall-s',    name:'Feather Fall',        level:1, castTime:'Reacción',     range:'18 m',             duration:'1 min',   concentration:false, combat:false, desc:'Reacción al caer: hasta 5 criaturas caen a 18m/ronda y no sufren daño por caída.' },
      { id:'grease-s',          name:'Grease',              level:1, castTime:'Acción',       range:'18 m',             duration:'1 min',   concentration:false, combat:true,  desc:'Cuadrado 3m · terreno difícil · save DES o cae al suelo al entrar o empezar turno.' },
      { id:'silent-image-s',    name:'Silent Image',        level:1, castTime:'Acción',       range:'18 m',             duration:'10 min',  concentration:true,  combat:false, desc:'Ilusión visual (sin sonido) de hasta 5m³ · no resiste inspección física.' },
      { id:'jump-s',            name:'Jump',                level:1, castTime:'Acción bonus', range:'Toque',            duration:'1 min',   concentration:false, combat:false, desc:'Triplica la distancia de salto de una criatura por 1 minuto.' },
      { id:'silvery-barbs-s',   name:'Silvery Barbs',       level:1, castTime:'Reacción',     range:'18 m',             duration:'Inst.',   concentration:false, combat:true,  desc:'Reacción tras tirada con éxito enemiga: fuerza a relanzar y tomar el peor. Un aliado gana ventaja en próxima tirada. (Strixhaven)' },
      // Nivel 1 extendido (Tasha's / Xanathar's)
      { id:'cause-fear-s',      name:'Cause Fear',          level:1, castTime:'Acción',       range:'18 m',             duration:'1 min',   concentration:true,  combat:true,  desc:'Save SAB o asustado. Repite save c/turno. No funciona en muertos vivientes/construcciones. (Xanathar\'s)' },
      { id:'caustic-brew-s',    name:"Tasha's Caustic Brew", level:1, castTime:'Acción',      range:'Línea 9m',         duration:'1 min',   concentration:false, combat:true,  desc:'Línea 1m ancho · save DES o cubierto de ácido: 2d4 ácido/turno hasta usar acción para limpiarse. +2d4 por nivel. (Tasha\'s)' },
      { id:'catapult-s',        name:'Catapult',            level:1, castTime:'Acción',       range:'18 m',             duration:'Inst.',   concentration:false, combat:true,  desc:'Lanza objeto 0,5-5 kg hasta 27m · ataque a distancia vs criatura · 3d8 contundente. +1d8 por nivel. (Xanathar\'s)' },
      { id:'earth-tremor-s',    name:'Earth Tremor',        level:1, castTime:'Acción',       range:'Uno mismo (3m)',   duration:'Inst.',   concentration:false, combat:true,  desc:'Save DES en 3m radio o 1d6 contundente y cae al suelo (terreno dificultoso si hay tierra suelta). +1d6 por nivel. (Xanathar\'s)' },
      // ── Nivel 2 ──
      { id:'scorching-ray-s',   name:'Scorching Ray',       level:2, castTime:'Acción',       range:'36 m',             duration:'Inst.',   concentration:false, combat:true,  desc:'3 ataques a distancia · 2d6 fuego c/u. +1 rayo por nivel.' },
      { id:'mirror-image-s',    name:'Mirror Image',        level:2, castTime:'Acción',       range:'Uno mismo',        duration:'1 min',   concentration:false, combat:true,  desc:'3 duplicados ilusorios. Ataques pueden golpear duplicado.' },
      { id:'misty-step-s',      name:'Misty Step',          level:2, castTime:'Acción bonus', range:'Uno mismo',        duration:'Inst.',   concentration:false, combat:true,  desc:'Teleportación 9 m a lugar visible.' },
      { id:'invisibility-s',    name:'Invisibility',        level:2, castTime:'Acción',       range:'Toque',            duration:'1 h',     concentration:true,  combat:true,  desc:'Criatura invisible · termina si ataca o lanza conjuro. +1 criatura por nivel superior.' },
      { id:'shatter-s',         name:'Shatter',             level:2, castTime:'Acción',       range:'18 m',             duration:'Inst.',   concentration:false, combat:true,  desc:'Esfera 3m · save CON · 3d8 trueno. +1d8 por nivel. Desventaja para criaturas inorgánicas.' },
      { id:'blindness-s',       name:'Blindness/Deafness',  level:2, castTime:'Acción',       range:'9 m',              duration:'1 min',   concentration:false, combat:true,  desc:'Save CON o cegado/ensordecido. Repite save al fin de turno. +1 objetivo/nivel.' },
      { id:'blur-s',            name:'Blur',                level:2, castTime:'Acción',       range:'Uno mismo',        duration:'1 min',   concentration:true,  combat:true,  desc:'Ataques contra ti con desventaja (excepto ciegos o truevision).' },
      { id:'cloud-daggers-s',   name:'Cloud of Daggers',    level:2, castTime:'Acción',       range:'18 m',             duration:'1 min',   concentration:true,  combat:true,  desc:'Cubo 1,5m · 4d4 cortante al entrar o pasar. +2d4 por nivel.' },
      { id:'crown-madness-s',   name:'Crown of Madness',    level:2, castTime:'Acción',       range:'36 m',             duration:'1 min',   concentration:true,  combat:true,  desc:'Save SAB o hechizado · ataca a criatura cercana aleatoria cada turno.' },
      { id:'darkness-s',        name:'Darkness',            level:2, castTime:'Acción',       range:'18 m',             duration:'10 min',  concentration:true,  combat:true,  desc:'Esfera 4,5m de oscuridad total. Bloquea darkvision.' },
      { id:'detect-thoughts-s', name:'Detect Thoughts',     level:2, castTime:'Acción',       range:'Uno mismo',        duration:'1 min',   concentration:true,  combat:false, desc:'Lees pensamientos superficiales. Profundos con save INT.' },
      { id:'enhance-ability-s', name:'Enhance Ability',     level:2, castTime:'Acción',       range:'Toque',            duration:'1 h',     concentration:true,  combat:false, desc:'Ventaja en checks de una stat elegida. +1 criatura/nivel.' },
      { id:'gust-of-wind-s',    name:'Gust of Wind',        level:2, castTime:'Acción',       range:'Uno mismo',        duration:'1 min',   concentration:true,  combat:true,  desc:'Línea 18m × 3m: save FUE o empujado 4,5m. Terreno difícil.' },
      { id:'hold-person-s',     name:'Hold Person',         level:2, castTime:'Acción',       range:'18 m',             duration:'1 min',   concentration:true,  combat:true,  desc:'Save SAB o paralizado (humanoide). Repite save c/turno. +1 obj/nivel.' },
      { id:'knock-s',           name:'Knock',               level:2, castTime:'Acción',       range:'18 m',             duration:'Inst.',   concentration:false, combat:false, desc:'Abre cerradura, traba, tapa o encadenado. Hace ruido al 90m.' },
      { id:'levitate-s',        name:'Levitate',            level:2, castTime:'Acción',       range:'18 m',             duration:'10 min',  concentration:true,  combat:true,  desc:'Criatura/objeto levita hasta 6m. Save CON para resistir.' },
      { id:'see-invisibility-s',name:'See Invisibility',    level:2, castTime:'Acción',       range:'Uno mismo',        duration:'1 h',     concentration:false, combat:false, desc:'Ves criaturas/objetos invisibles y en el plano etéreo.' },
      { id:'spider-climb-s',    name:'Spider Climb',        level:2, castTime:'Acción',       range:'Toque',            duration:'1 h',     concentration:true,  combat:false, desc:'Escala paredes y techos a velocidad normal.' },
      { id:'suggestion-s',      name:'Suggestion',          level:2, castTime:'Acción',       range:'9 m',              duration:'8 h',     concentration:true,  combat:false, desc:'Save SAB o sigue sugerencia razonable.' },
      { id:'web-s',             name:'Web',                 level:2, castTime:'Acción',       range:'18 m',             duration:'1 h',     concentration:true,  combat:true,  desc:'Cubo 4,5m · save DES o atrapado. Inflamable.' },
      { id:'alter-self-s',      name:'Alter Self',          level:2, castTime:'Acción',       range:'Uno mismo',        duration:'1 h',     concentration:true,  combat:false, desc:'Adaptación acuática, garras naturales (1d6+FUE) o cambio de apariencia.' },
      { id:'arcane-vigor-s',    name:'Arcane Vigor',        level:2, castTime:'Acción bonus', range:'Uno mismo',        duration:'Inst.',   concentration:false, combat:false, desc:'Gastas un slot: recuperás 2d6 HP por nivel del slot (máx 5d6). (2024)' },
      { id:'darkvision-s',      name:'Darkvision',          level:2, castTime:'Acción',       range:'Toque',            duration:'8 h',     concentration:false, combat:false, desc:'Una criatura gana visión en oscuridad hasta 18m.' },
      { id:'dragons-breath-s',  name:"Dragon's Breath",     level:2, castTime:'Acción bonus', range:'Toque',            duration:'1 min',   concentration:true,  combat:true,  desc:'Una criatura puede usar acción para exhalar 4,5m de daño elemental (2d6). Save DES mitad.' },
      { id:'enlarge-reduce-s',  name:'Enlarge/Reduce',      level:2, castTime:'Acción',       range:'9 m',              duration:'1 min',   concentration:true,  combat:true,  desc:'Criatura/objeto se agranda (ventaja FUE, +1d4 daño) o reduce (desventaja FUE, -1d4 daño).' },
      { id:'flaming-sphere-s',  name:'Flaming Sphere',      level:2, castTime:'Acción',       range:'18 m',             duration:'1 min',   concentration:true,  combat:true,  desc:'Esfera de fuego 1,5m · 2d6 fuego save DES · movible con bonus action.' },
      { id:'magic-weapon-s',    name:'Magic Weapon',        level:2, castTime:'Acción bonus', range:'Toque',            duration:'1 h',     concentration:true,  combat:true,  desc:'Arma no mágica se convierte en +1 (o más con slots altos).' },
      { id:'mind-spike-s',      name:'Mind Spike',          level:2, castTime:'Acción',       range:'36 m',             duration:'1 h',     concentration:true,  combat:true,  desc:'Save INT o 3d8 psíquico. Sabes la ubicación de la criatura mientras dura.' },
      { id:'phantasmal-force-s', name:'Phantasmal Force',    level:2, castTime:'Acción',       range:'18 m',             duration:'1 min',   concentration:true,  combat:true,  desc:'Save INT o la criatura cree en una ilusión y recibe 1d6 psíquico/turno.' },
      // Nivel 2 extendido (Xanathar's / Tasha's)
      { id:'aganazzar-scorch-s', name:"Aganazzar's Scorcher", level:2, castTime:'Acción',     range:'Línea 9m',         duration:'Inst.',   concentration:false, combat:true,  desc:'Línea de llamas 9m · save DES · 3d8 fuego. +1d8 por nivel. (Xanathar\'s)' },
      { id:'earthen-grasp-s',    name:"Maximilian's Earthen Grasp", level:2, castTime:'Acción', range:'9 m',            duration:'1 min',   concentration:true,  combat:true,  desc:'Mano de tierra: 2d6 contundente + atrapado. Save FUE cada turno para escapar. (Xanathar\'s)' },
      { id:'pyrotechnics-s',     name:'Pyrotechnics',        level:2, castTime:'Acción',       range:'18 m',             duration:'Inst.',   concentration:false, combat:true,  desc:'Llama no mágica: cegamiento en 3m (save CON) o cortina de humo 9m. (Xanathar\'s)' },
      { id:'shadow-blade-s',     name:'Shadow Blade',        level:2, castTime:'Acción bonus', range:'Uno mismo',        duration:'1 min',   concentration:true,  combat:true,  desc:'Crea espada de sombra sólida: 2d8 psíquico, propiedades finesse/light/thrown. Ventaja en oscuridad. +1d8/2 niv extra. (Xanathar\'s)' },
      { id:'snowball-swarm-s',   name:"Snilloc's Snowball Swarm", level:2, castTime:'Acción',  range:'27 m',             duration:'Inst.',   concentration:false, combat:true,  desc:'Esfera 1,5m · save DES · 3d6 frío. +1d6 por nivel. (Xanathar\'s)' },
      { id:'warding-wind-s',     name:'Warding Wind',        level:2, castTime:'Acción',       range:'Uno mismo',        duration:'10 min',  concentration:true,  combat:false, desc:'Viento protector 3m: dif terreno, apaga llamas pequeñas, desventaja ataques a distancia vs vos, inmune a gas. (Xanathar\'s)' },
      { id:'fortune-teller-s',   name:"Rime's Binding Ice",  level:2, castTime:'Acción',       range:'Cono 9m',          duration:'Inst.',   concentration:false, combat:true,  desc:'Save CON · 2d8 frío · vel 0 hasta fin de su próx turno. +1d8 por nivel. (Tasha\'s)' },
      // ── Nivel 3 ──
      { id:'fireball-s',        name:'Fireball',          level:3, castTime:'Acción',       range:'45 m',       duration:'Inst.',   concentration:false, combat:true,  desc:'Esfera 20ft · save DES · 8d6 fuego. +1d6 por nivel.' },
      { id:'lightning-bolt-s',  name:'Lightning Bolt',    level:3, castTime:'Acción',       range:'Línea 30m',  duration:'Inst.',   concentration:false, combat:true,  desc:'Línea 30m · save DES · 8d6 relámpago. +1d6 por nivel.' },
      { id:'counterspell-s',    name:'Counterspell',      level:3, castTime:'Reacción',     range:'18 m',       duration:'Inst.',   concentration:false, combat:true,  desc:'Cancela un hechizo nv3 o menos. Superior: check con CAR.' },
      { id:'fly-s',             name:'Fly',               level:3, castTime:'Acción',       range:'Toque',      duration:'10 min',  concentration:true,  combat:false, desc:'Velocidad vuelo 18 m · conc 10 min. +1 criatura por nivel.' },
      { id:'haste-s',           name:'Haste',             level:3, castTime:'Acción',       range:'9 m',        duration:'1 min',   concentration:true,  combat:true,  desc:'+2 CA, ventaja en saves DES, vel ×2, Acción extra (ataque/Dash/Disengage/Hide/Use Object).' },
      { id:'blink-s',           name:'Blink',             level:3, castTime:'Acción',       range:'Uno mismo',  duration:'1 min',   concentration:false, combat:true,  desc:'50% de prob al fin de cada turno de ir al plano etéreo (indetectable).' },
      { id:'clairvoyance-s',    name:'Clairvoyance',      level:3, castTime:'10 min',       range:'1,5 km',     duration:'10 min',  concentration:true,  combat:false, desc:'Creas un sensor invisible en un lugar conocido · ves/oís a través de él.' },
      { id:'daylight-s',        name:'Daylight',          level:3, castTime:'Acción',       range:'18 m',       duration:'1 h',     concentration:false, combat:false, desc:'Esfera de luz brillante 18m de radio · disipa oscuridad mágica nv2 o menos.' },
      { id:'dispel-magic-s',    name:'Dispel Magic',      level:3, castTime:'Acción',       range:'36 m',       duration:'Inst.',   concentration:false, combat:true,  desc:'Termina conjuros en objetivo automáticamente si nv3 o menos. Superior: check CAR.' },
      { id:'fear-s',            name:'Fear',              level:3, castTime:'Acción',       range:'Cono 9m',    duration:'1 min',   concentration:true,  combat:true,  desc:'Save SAB o asustado · huye · descarta objetos. Repite save al final de turno.' },
      { id:'gaseous-form-s',    name:'Gaseous Form',      level:3, castTime:'Acción',       range:'Toque',      duration:'1 h',     concentration:true,  combat:false, desc:'Criatura se convierte en gas · puede volar 3m · resistencia a no mágico.' },
      { id:'major-image-s',     name:'Major Image',       level:3, castTime:'Acción',       range:'36 m',       duration:'10 min',  concentration:true,  combat:false, desc:'Ilusión con sonido, olor y temperatura en cubo 4,5m. Si se lanza a nv6: permanente sin conc.' },
      { id:'slow-s',            name:'Slow',              level:3, castTime:'Acción',       range:'36 m',       duration:'1 min',   concentration:true,  combat:true,  desc:'Hasta 6 criaturas · save SAB o vel÷2, -2CA/DES saves, 1 conjuro/turno.' },
      { id:'hypnotic-pattern-s',name:'Hypnotic Pattern',  level:3, castTime:'Acción',       range:'36 m',       duration:'1 min',   concentration:true,  combat:true,  desc:'Cubo 9m · save SAB o Charmed+Incapacitado+vel 0. Se rompe si recibe daño o alguien usa acción para sacarla.' },
      { id:'stinking-cloud-s',  name:'Stinking Cloud',    level:3, castTime:'Acción',       range:'27 m',       duration:'1 min',   concentration:true,  combat:true,  desc:'Esfera 6m de niebla nauseabunda · save CON o pierde acción.' },
      { id:'tongues-s',         name:'Tongues',           level:3, castTime:'Acción',       range:'Toque',      duration:'1 h',     concentration:false, combat:false, desc:'Entiende y habla cualquier idioma.' },
      { id:'water-walk-s',      name:'Water Walk',        level:3, castTime:'Acción',       range:'9 m',        duration:'1 h',     concentration:false, combat:false, ritual:true, desc:'Hasta 10 criaturas caminan sobre líquidos. Ritual.' },
      // Nivel 3 extendido (Xanathar's / Tasha's)
      { id:'catnap-s',          name:'Catnap',            level:3, castTime:'Acción',       range:'9 m',        duration:'10 min',  concentration:false, combat:false, desc:'Hasta 3 criaturas conscientes duermen 10 min y ganan beneficios de descanso corto. (Xanathar\'s)' },
      { id:'erupting-earth-s',  name:'Erupting Earth',    level:3, castTime:'Acción',       range:'36 m',       duration:'Inst.',   concentration:false, combat:true,  desc:'Área 6m cubo · save DES · 3d12 contundente. Terreno difícil. +1d12 por nivel. (Xanathar\'s)' },
      { id:'flame-arrows-s',    name:'Flame Arrows',      level:3, castTime:'Acción',       range:'Toque',      duration:'1 h',     concentration:true,  combat:true,  desc:'Hasta 12 piezas de munición hacen +1d6 fuego al impactar. (Xanathar\'s)' },
      { id:'thunder-step-s',    name:'Thunder Step',      level:3, castTime:'Acción',       range:'27 m',       duration:'Inst.',   concentration:false, combat:true,  desc:'Teleportación · trueno 3m en origen · save CON o 3d10 trueno. +1d10 por nivel. (Xanathar\'s)' },
      { id:'tidal-wave-s',      name:'Tidal Wave',        level:3, castTime:'Acción',       range:'36 m',       duration:'Inst.',   concentration:false, combat:true,  desc:'Área 9x3m · save DES · 4d8 contundente + caído. (Xanathar\'s)' },
      { id:'wall-of-water-s',   name:'Wall of Water',     level:3, castTime:'Acción',       range:'18 m',       duration:'10 min',  concentration:true,  combat:true,  desc:'Muro de agua 9m largo 3m alto 1m grueso · dificulta proyectiles y fuego. (Xanathar\'s)' },
      { id:'pulse-wave-s',      name:'Pulse Wave',        level:3, castTime:'Acción',       range:'Cono 9m',    duration:'Inst.',   concentration:false, combat:true,  desc:'Save CON · 6d6 fuerza + empujado 9m o atraído 9m (a elección). +2d6 por nivel. (Tasha\'s)' },
      // ── Nivel 4 ──
      // ── Nivel 4 ──
      { id:'dimension-door-s',    name:'Dimension Door',       level:4, castTime:'Acción',    range:'150 m',     duration:'Inst.',   concentration:false, combat:true,  desc:'Teleportación tú + 1 aliado a cualquier punto a 150 m.' },
      { id:'greater-invis-s',     name:'Greater Invisibility', level:4, castTime:'Acción',    range:'Toque',     duration:'1 min',   concentration:true,  combat:true,  desc:'Invisible incluso al atacar o lanzar conjuros. Ventaja en ataques, desventaja recibidos.' },
      { id:'confusion-s',         name:'Confusion',            level:4, castTime:'Acción',    range:'27 m',      duration:'1 min',   concentration:true,  combat:true,  desc:'Save SAB en área 3m radio o acción aleatoria cada turno.' },
      { id:'banishment-s',        name:'Banishment',           level:4, castTime:'Acción',    range:'18 m',      duration:'1 min',   concentration:true,  combat:true,  desc:'Save CAR o desterrado al plano de origen. Permanente si conc dura 1 min.' },
      { id:'dominate-beast-s',    name:'Dominate Beast',       level:4, castTime:'Acción',    range:'18 m',      duration:'1 min',   concentration:true,  combat:true,  desc:'Save SAB o bajo tu control. Repite save al recibir daño.' },
      { id:'fire-shield-s',       name:'Fire Shield',          level:4, castTime:'Acción',    range:'Uno mismo', duration:'10 min',  concentration:false, combat:true,  desc:'Escudo cálido o frío: 2d8 daño al atacante en melee. Resistencia fuego/frío.' },
      { id:'vitriolic-sphere-s',  name:'Vitriolic Sphere',     level:4, castTime:'Acción',    range:'45 m',      duration:'Inst.',   concentration:false, combat:true,  desc:'Esfera 4,5m · save DES · 10d4 ácido + 5d4 al inicio del turno siguiente.' },
      { id:'charm-monster-s',     name:'Charm Monster',        level:4, castTime:'Acción',    range:'9 m',       duration:'1 h',     concentration:false, combat:false, desc:'Save SAB o encantado. No requiere ser humanoide.' },
      { id:'stone-skin-s',        name:'Stoneskin',            level:4, castTime:'Acción',    range:'Toque',     duration:'1 h',     concentration:true,  combat:true,  desc:'Resistencia a daño no mágico de arma (B/P/S).' },
      { id:'polymorph-s',         name:'Polymorph',            level:4, castTime:'Acción',    range:'18 m',      duration:'1 h',     concentration:true,  combat:true,  desc:'Save SAB o transformado en bestia. HP propio de la bestia.' },
      { id:'sickening-radiance-s',name:'Sickening Radiance',   level:4, castTime:'Acción',    range:'27 m',      duration:'10 min',  concentration:true,  combat:true,  desc:'Esfera 9m · save CON o 4d10 radiante + agotamiento.' },
      { id:'wall-of-fire-s',      name:'Wall of Fire',         level:4, castTime:'Acción',    range:'36 m',      duration:'1 min',   concentration:true,  combat:true,  desc:'Muro 18m largo · 5d8 fuego a criaturas al otro lado o al cruzar.' },
      // Nivel 4 extendido (Xanathar's / Tasha's)
      { id:'storm-sphere-s',      name:'Storm Sphere',         level:4, castTime:'Acción',    range:'36 m',      duration:'1 min',   concentration:true,  combat:true,  desc:'Esfera tormenta 4,5m: 2d6 trueno en radio 18m c/turno (bonus action). +1d6 por nivel. (Xanathar\'s)' },
      { id:'watery-sphere-s',     name:'Watery Sphere',        level:4, castTime:'Acción',    range:'27 m',      duration:'1 min',   concentration:true,  combat:true,  desc:'Esfera de agua 3m · salvo FUE o STR o DES o atrapad o · móvil. +1 criatura por nivel. (Xanathar\'s)' },
      { id:'elemental-bane-s',    name:'Elemental Bane',       level:4, castTime:'Acción',    range:'27 m',      duration:'1 min',   concentration:true,  combat:true,  desc:'Criatura pierde resistencia al tipo elegido y recibe +2d6 de ese tipo en cada impacto. (Xanathar\'s)' },
      { id:'gravity-sinkhole-s',  name:'Gravity Sinkhole',     level:4, castTime:'Acción',    range:'36 m',      duration:'Inst.',   concentration:false, combat:true,  desc:'Esfera 4,5m radio · save CON · 5d10 fuerza + atraído 9m al punto de impacto. +2d10 por nivel. (Tasha\'s)' },
      // ── Nivel 5 ──
      { id:'cone-of-cold-s',      name:'Cone of Cold',         level:5, castTime:'Acción',    range:'Cono 18m',  duration:'Inst.',   concentration:false, combat:true,  desc:'Cono 18m · save CON · 8d8 frío. +1d8 por nivel.' },
      { id:'telekinesis-s',       name:'Telekinesis',          level:5, castTime:'Acción',     range:'18 m',      duration:'10 min',  concentration:true,  combat:true,  desc:'Mueve objetos/criaturas con la mente · criatura: save FUE o movida 9m.' },
      { id:'animate-objects-s',   name:'Animate Objects',      level:5, castTime:'Acción',    range:'36 m',      duration:'1 min',   concentration:true,  combat:true,  desc:'Hasta 10 objetos pequeños animados atacan. Escala con nivel.' },
      { id:'creation-s',          name:'Creation',             level:5, castTime:'1 min',      range:'9 m',       duration:'Varía',   concentration:false, combat:false, desc:'Crea objeto de materia inerte de hasta 5ft cúbicos. Duración según material.' },
      { id:'dominate-person-s',   name:'Dominate Person',      level:5, castTime:'Acción',    range:'18 m',      duration:'1 min',   concentration:true,  combat:true,  desc:'Save SAB o humanoide bajo tu control. Repite save al recibir daño.' },
      { id:'hold-monster-s',      name:'Hold Monster',         level:5, castTime:'Acción',    range:'18 m',      duration:'1 min',   concentration:true,  combat:true,  desc:'Save SAB o paralizado (cualquier criatura). Repite save c/turno.' },
      { id:'synaptic-static-s',   name:'Synaptic Static',      level:5, castTime:'Acción',    range:'36 m',      duration:'Inst.',   concentration:false, combat:true,  desc:'Esfera 6m · save INT · 8d6 psíquico + desventaja en ataques y concentración 1d6 penalización.' },
      { id:'mislead-s',           name:'Mislead',              level:5, castTime:'Acción',    range:'Uno mismo', duration:'1 h',     concentration:true,  combat:false, desc:'Invisible + creas doble ilusorio controlable desde tu perspectiva.' },
      { id:'wall-of-stone-s',     name:'Wall of Stone',        level:5, castTime:'Acción',    range:'36 m',      duration:'10 min',  concentration:true,  combat:true,  desc:'Muro de piedra sólida de hasta 10 paneles (3x1m c/u).' },
      { id:'bigbys-hand-s',       name:"Bigby's Hand",         level:5, castTime:'Acción',    range:'36 m',      duration:'1 min',   concentration:true,  combat:true,  desc:'Mano gigante de fuerza: golpe, empuje, agarre, bloqueo. 4d8 fuerza.' },
      // Nivel 5 extendido (Xanathar's / Tasha's)
      { id:'immolation-s',        name:'Immolation',           level:5, castTime:'Acción',    range:'27 m',      duration:'1 min',   concentration:true,  combat:true,  desc:'Save DES · 8d6 fuego + 4d6 fuego c/turno (save DES mitad). (Xanathar\'s)' },
      { id:'skill-empower-s',     name:'Skill Empowerment',    level:5, castTime:'Acción',    range:'Toque',     duration:'1 h',     concentration:true,  combat:false, desc:'Criatura voluntaria gana expertise en una habilidad en que ya tiene competencia. (Xanathar\'s)' },
      { id:'steel-wind-s',        name:'Steel Wind Strike',    level:5, castTime:'Acción',    range:'9 m',       duration:'Inst.',   concentration:false, combat:true,  desc:'Hasta 5 objetivos · ataque de conjuro · 6d10 fuerza c/u · luego teleportás a espacio libre cerca de uno de ellos. (Tasha\'s)' },
      { id:'mental-prison-s',     name:'Mental Prison',        level:6, castTime:'Acción',    range:'18 m',      duration:'1 min',   concentration:true,  combat:true,  desc:'Save INT o atrapado en ilusión aterradora: 5d10 psíquico al entrar/salir; queda incapacitado si lo intenta. (Xanathar\'s)' },
      // ── Nivel 6 ──
      { id:'disintegrate-s',      name:'Disintegrate',         level:6, castTime:'Acción',    range:'18 m',      duration:'Inst.',   concentration:false, combat:true,  desc:'Ataque a distancia · save DES · 10d6+40 fuerza. +3d6 por nivel. Reduce a polvo si mata.' },
      { id:'chain-lightning-s',   name:'Chain Lightning',      level:6, castTime:'Acción',    range:'30 m',      duration:'Inst.',   concentration:false, combat:true,  desc:'10d8 relámpago al objetivo principal + 3 secundarios (save DES mitad).' },
      { id:'globe-invuln-s',      name:'Globe of Invulnerability', level:6, castTime:'Acción',range:'Uno mismo', duration:'1 min',   concentration:true,  combat:true,  desc:'Esfera 3m bloquea conjuros de nivel 5 o inferior.' },
      { id:'mass-suggestion-s',   name:'Mass Suggestion',      level:6, castTime:'Acción',    range:'18 m',      duration:'24 h',    concentration:false, combat:false, desc:'Save SAB o hasta 12 criaturas siguen sugerencia razonable.' },
      { id:'eyebite-s',           name:'Eyebite',              level:6, castTime:'Acción',    range:'Uno mismo', duration:'1 min',   concentration:true,  combat:true,  desc:'Mirada mágica: dormido, asustado o mareado c/turno (save SAB).' },
      { id:'flesh-stone-s',       name:'Flesh to Stone',       level:6, castTime:'Acción',    range:'18 m',      duration:'1 min',   concentration:true,  combat:true,  desc:'Save CON ×3 o petrificado permanente.' },
      { id:'scatter-s',           name:'Scatter',              level:6, castTime:'Acción',    range:'27 m',      duration:'Inst.',   concentration:false, combat:true,  desc:'Hasta 5 criaturas · save SAB o teleportadas hasta 7,5m en dirección elegida.' },
      { id:'true-seeing-s',       name:'True Seeing',          level:6, castTime:'Acción',    range:'Toque',     duration:'1 h',     concentration:false, combat:false, desc:'Ve invisibles, ilusiones reales, en oscuridad, planos etéreos. Visión 36m.' },
      // Nivel 6 extendido (Tasha's / Fizban's)
      { id:'otherworldly-guise-s',name:"Tasha's Otherworldly Guise", level:6, castTime:'Acción bonus', range:'Uno mismo', duration:'1 min', concentration:true, combat:true, desc:'Forma celestial o infernal: vuelo 15m, inmunidad fuego/veneno, +2 CA, 2 ataques extra con arma mágica (1d6 rad/necrótico). (Tasha\'s)' },
      { id:'fizban-platinum-s',   name:"Fizban's Platinum Shield", level:6, castTime:'Acción bonus', range:'9 m',     duration:'1 min',   concentration:true,  combat:true,  desc:'+2 CA + resistencia a 1 tipo daño por turno · semi-incorpóreo: desventaja en ataques vs objetivo. (Fizban\'s)' },
    ],

    'Mago': [
      // Cantrips
      { id:'fire-bolt',        name:'Fire Bolt',        level:0, castTime:'Acción',       range:'36 m',  duration:'Inst.',     concentration:false, combat:true,  desc:'Ataque a distancia · 1d10 fuego. Escala nv5/11/17.' },
      { id:'mage-hand',        name:'Mage Hand',        level:0, castTime:'Acción',       range:'9 m',   duration:'1 min',     concentration:false, combat:false, desc:'Mano espectral manipula objetos hasta 5 kg.' },
      { id:'prestidigitation', name:'Prestidigitation', level:0, castTime:'Acción',       range:'3 m',   duration:'Hasta 1h',  concentration:false, combat:false, desc:'Trucos menores: limpiar, encender, sabor...' },
      { id:'minor-illusion-m', name:'Minor Illusion',   level:0, castTime:'Acción',       range:'9 m',   duration:'1 min',     concentration:false, combat:false, desc:'Imagen o sonido pequeño (cubo 5ft).' },
      { id:'ray-of-frost-m',   name:'Ray of Frost',     level:0, castTime:'Acción',       range:'18 m',  duration:'Inst.',     concentration:false, combat:true,  desc:'Ataque a distancia · 1d8 frío · vel -3m hasta tu turno. Escala nv5/11/17.' },
      { id:'shocking-grasp-m', name:'Shocking Grasp',   level:0, castTime:'Acción',       range:'Toque', duration:'Inst.',     concentration:false, combat:true,  desc:'Ataque de toque · 1d8 relámpago · no puede reaccionar hasta su turno. Ventaja con metal.' },
      { id:'chill-touch-m',    name:'Chill Touch',      level:0, castTime:'Acción',       range:'18 m',  duration:'1 ronda',   concentration:false, combat:true,  desc:'Ataque a distancia · 1d8 necrótico · muertos vivientes con desventaja.' },
      { id:'acid-splash',      name:'Acid Splash',      level:0, castTime:'Acción',       range:'18 m',  duration:'Inst.',     concentration:false, combat:true,  desc:'Save DES · 1d6 ácido. Puede afectar 2 criaturas adyacentes. Escala nv5/11/17.' },
      { id:'poison-spray-m',   name:'Poison Spray',     level:0, castTime:'Acción',       range:'3 m',   duration:'Inst.',     concentration:false, combat:true,  desc:'Save CON · 1d12 veneno. Escala nv5/11/17.' },
      { id:'true-strike-m',    name:'True Strike',      level:0, castTime:'Acción bonus', range:'9 m',   duration:'Conc 1r',   concentration:true,  combat:true,  desc:'Conc · ventaja en tu primer ataque vs el objetivo el próximo turno.' },
      { id:'message-m',        name:'Message',          level:0, castTime:'Acción',       range:'36 m',  duration:'1 ronda',   concentration:false, combat:false, desc:'Susurro mágico a una criatura. Solo ella oye y puede responder.' },
      { id:'light-m',          name:'Light',            level:0, castTime:'Acción',       range:'Toque', duration:'1 h',       concentration:false, combat:false, desc:'Objeto emite luz brillante 6m y tenue 6m más. Save DES si alguien lo lleva.' },
      // Nivel 1
      { id:'magic-missile',      name:'Magic Missile',       level:1, castTime:'Acción',    range:'36 m',      duration:'Inst.',   concentration:false, combat:true,  desc:'3 dardos infalibles · 1d4+1 fuerza c/u. +1 dardo por nivel.' },
      { id:'shield',             name:'Shield',              level:1, castTime:'Reacción',  range:'Uno mismo', duration:'1 ronda', concentration:false, combat:true,  desc:'Reacción · +5 CA hasta inicio de tu próximo turno · bloquea Magic Missile.' },
      { id:'thunderwave-m',      name:'Thunderwave',         level:1, castTime:'Acción',    range:'Uno mismo', duration:'Inst.',   concentration:false, combat:true,  desc:'Cubo 15ft · save CON · 2d8 trueno y empuja 3m. +1d8 por nivel.' },
      { id:'detect-magic',       name:'Detect Magic',        level:1, castTime:'Acción',    range:'Uno mismo', duration:'10 min',  concentration:true,  combat:false, ritual:true, desc:'Detecta magia en 9m · ritual.' },
      { id:'burning-hands-m',    name:'Burning Hands',       level:1, castTime:'Acción',    range:'Cono 15ft', duration:'Inst.',   concentration:false, combat:true,  desc:'Save DES · 3d6 fuego. +1d6 por nivel.' },
      { id:'charm-person-m',     name:'Charm Person',        level:1, castTime:'Acción',    range:'9 m',       duration:'1 h',     concentration:false, combat:false, desc:'Save SAB o encantado. Considera amigo. +1 objetivo por nivel.' },
      { id:'color-spray-m',      name:'Color Spray',         level:1, castTime:'Acción',    range:'Uno mismo', duration:'1 ronda', concentration:false, combat:true,  desc:'6d10 HP de criaturas cercanas cegadas (las de menos HP primero).' },
      { id:'disguise-self-m',    name:'Disguise Self',       level:1, castTime:'Acción',    range:'Uno mismo', duration:'1 h',     concentration:false, combat:false, desc:'Cambia apariencia visual (no táctil). Ilusión.' },
      { id:'fog-cloud-m',        name:'Fog Cloud',           level:1, castTime:'Acción',    range:'27 m',      duration:'1 h',     concentration:true,  combat:true,  desc:'Esfera de niebla 6m radio · visibilidad nula.' },
      { id:'grease-m',           name:'Grease',              level:1, castTime:'Acción',    range:'18 m',      duration:'1 min',   concentration:false, combat:true,  desc:'Área 3m · save DES o caído. Terreno difícil.' },
      { id:'mage-armor-m',       name:'Mage Armor',          level:1, castTime:'Acción',    range:'Toque',     duration:'8 h',     concentration:false, combat:false, desc:'CA = 13 + mod DES si no lleva armadura.' },
      { id:'sleep-m',            name:'Sleep',               level:1, castTime:'Acción',    range:'27 m',      duration:'1 min',   concentration:false, combat:true,  desc:'5d8 HP de criaturas se duermen (menos HP primero). Despierta al dañarse.' },
      { id:'witch-bolt-m',       name:'Witch Bolt',          level:1, castTime:'Acción',    range:'9 m',       duration:'1 min',   concentration:true,  combat:true,  desc:'Ataque a distancia · 1d12 relámpago · bonus action turno siguiente para repetir.' },
      // Nivel 2
      { id:'misty-step',         name:'Misty Step',          level:2, castTime:'Acción bonus', range:'Uno mismo', duration:'Inst.', concentration:false, combat:true,  desc:'Teleportación 9m a lugar visible.' },
      { id:'mirror-image-m',     name:'Mirror Image',        level:2, castTime:'Acción',    range:'Uno mismo', duration:'1 min',   concentration:false, combat:true,  desc:'3 duplicados ilusorios desvían ataques.' },
      { id:'web',                name:'Web',                 level:2, castTime:'Acción',    range:'18 m',      duration:'1 h',     concentration:true,  combat:true,  desc:'Cubo 4,5m · save DES o atrapado. Terreno difícil.' },
      { id:'acid-arrow-m',       name:'Melf\'s Acid Arrow',  level:2, castTime:'Acción',    range:'27 m',      duration:'Inst.',   concentration:false, combat:true,  desc:'Ataque a distancia · 4d4 ácido + 2d4 al fin del siguiente turno.' },
      { id:'alter-self-m',       name:'Alter Self',          level:2, castTime:'Acción',    range:'Uno mismo', duration:'1 h',     concentration:true,  combat:false, desc:'Adaptación acuática, garras (1d6+FUE) o cambio de apariencia.' },
      { id:'blur-m',             name:'Blur',                level:2, castTime:'Acción',    range:'Uno mismo', duration:'1 min',   concentration:true,  combat:true,  desc:'Ataques contra ti con desventaja (excepto ciegos).' },
      { id:'cloud-of-daggers-m', name:'Cloud of Daggers',    level:2, castTime:'Acción',    range:'18 m',      duration:'1 min',   concentration:true,  combat:true,  desc:'Cubo 1,5m · 4d4 cortante al entrar/pasar. +2d4 por nivel.' },
      { id:'detect-thoughts-m',  name:'Detect Thoughts',     level:2, castTime:'Acción',    range:'Uno mismo', duration:'1 min',   concentration:true,  combat:false, desc:'Lees pensamientos superficiales; profundos con save INT.' },
      { id:'hold-person-m',      name:'Hold Person',         level:2, castTime:'Acción',    range:'18 m',      duration:'1 min',   concentration:true,  combat:true,  desc:'Save SAB o paralizado. Repite save c/turno. +1 objetivo por nivel.' },
      { id:'invisibility-m',     name:'Invisibility',        level:2, castTime:'Acción',    range:'Toque',     duration:'1 h',     concentration:true,  combat:true,  desc:'Invisible hasta que ataque o lance conjuro. +1 criatura por nivel.' },
      { id:'levitate-m',         name:'Levitate',            level:2, castTime:'Acción',    range:'18 m',      duration:'10 min',  concentration:true,  combat:true,  desc:'Criatura o objeto levita hasta 6m. Save CON si no es voluntario.' },
      { id:'scorching-ray-m',    name:'Scorching Ray',       level:2, castTime:'Acción',    range:'36 m',      duration:'Inst.',   concentration:false, combat:true,  desc:'3 ataques · 2d6 fuego c/u. +1 rayo por nivel.' },
      { id:'shatter-m',          name:'Shatter',             level:2, castTime:'Acción',    range:'18 m',      duration:'Inst.',   concentration:false, combat:true,  desc:'Esfera 3m · save CON · 3d8 trueno. +1d8 por nivel.' },
      { id:'suggestion-m',       name:'Suggestion',          level:2, castTime:'Acción',    range:'9 m',       duration:'8 h',     concentration:true,  combat:false, desc:'Save SAB o sigue sugerencia razonable.' },
      // Nivel 3
      { id:'fireball',           name:'Fireball',            level:3, castTime:'Acción',    range:'45 m',      duration:'Inst.',   concentration:false, combat:true,  desc:'Esfera 6m · save DES · 8d6 fuego. +1d6 por nivel.' },
      { id:'counterspell',       name:'Counterspell',        level:3, castTime:'Reacción',  range:'18 m',      duration:'Inst.',   concentration:false, combat:true,  desc:'Cancela hechizo nv3 o menos automáticamente. Superior: check INT.' },
      { id:'fly',                name:'Fly',                 level:3, castTime:'Acción',    range:'Toque',     duration:'10 min',  concentration:true,  combat:false, desc:'Vel. vuelo 18m. +1 criatura por nivel.' },
      { id:'lightning-bolt-m',   name:'Lightning Bolt',      level:3, castTime:'Acción',    range:'Línea 30m', duration:'Inst.',   concentration:false, combat:true,  desc:'Línea 30m · save DES · 8d6 relámpago. +1d6 por nivel.' },
      { id:'blink-m',            name:'Blink',               level:3, castTime:'Acción',    range:'Uno mismo', duration:'1 min',   concentration:false, combat:true,  desc:'50% de probabilidad al fin de cada turno de ir al plano etéreo.' },
      { id:'dispel-magic-m',     name:'Dispel Magic',        level:3, castTime:'Acción',    range:'36 m',      duration:'Inst.',   concentration:false, combat:true,  desc:'Termina conjuros en objetivo. Superior a nv3: check INT para los más altos.' },
      { id:'fear-m',             name:'Fear',                level:3, castTime:'Acción',    range:'Uno mismo (cono 9m)', duration:'1 min', concentration:true, combat:true, desc:'Save SAB o asustado · huye · descarta objeto.' },
      { id:'haste-m',            name:'Haste',               level:3, castTime:'Acción',    range:'9 m',       duration:'1 min',   concentration:true,  combat:true,  desc:'+2CA, vent DES, vel×2, acción extra (ataque/Dash/Disengage/Hide/Use).' },
      { id:'hypnotic-pattern-m', name:'Hypnotic Pattern',    level:3, castTime:'Acción',    range:'36 m',      duration:'1 min',   concentration:true,  combat:true,  desc:'Cubo 9m · save SAB o Charmed+Incapacitado+vel 0. Se rompe si recibe daño o alguien usa acción para sacarla.' },
      { id:'slow-m',             name:'Slow',                level:3, castTime:'Acción',    range:'36 m',      duration:'1 min',   concentration:true,  combat:true,  desc:'Hasta 6 criaturas · save SAB o vel/2, -2CA/DES, 1 conjuro/turno.' },
      { id:'stinking-cloud-m',   name:'Stinking Cloud',      level:3, castTime:'Acción',    range:'27 m',      duration:'1 min',   concentration:true,  combat:true,  desc:'Esfera 6m · save CON o náuseas · pierde acción.' },
      { id:'tongues-m',          name:'Tongues',             level:3, castTime:'Acción',    range:'Toque',     duration:'1 h',     concentration:false, combat:false, desc:'Entiende y habla cualquier idioma.' },
      // Nivel 4
      { id:'arcane-eye-m',       name:'Arcane Eye',          level:4, castTime:'Acción',    range:'9 m',       duration:'1 h',     concentration:true,  combat:false, desc:'Ojo invisible de 1 pulgada · visión darkvision 12m · vel 9m.' },
      { id:'banishment-m',       name:'Banishment',          level:4, castTime:'Acción',    range:'18 m',      duration:'1 min',   concentration:true,  combat:true,  desc:'Save CAR o desterrado al plano de origen.' },
      { id:'blight-m',           name:'Blight',              level:4, castTime:'Acción',    range:'9 m',       duration:'Inst.',   concentration:false, combat:true,  desc:'Save CON · 8d8 necrótico. +1d8 por nivel. Doble vs plantas.' },
      { id:'confusion-m',        name:'Confusion',           level:4, castTime:'Acción',    range:'27 m',      duration:'1 min',   concentration:true,  combat:true,  desc:'Esfera 3m · save SAB o acción aleatoria c/turno.' },
      { id:'dimension-door-m',   name:'Dimension Door',      level:4, castTime:'Acción',    range:'150 m',     duration:'Inst.',   concentration:false, combat:true,  desc:'Teleportación vos +1 aliado a cualquier punto a 150m.' },
      { id:'greater-invis-m',    name:'Greater Invisibility',level:4, castTime:'Acción',    range:'Toque',     duration:'1 min',   concentration:true,  combat:true,  desc:'Invisible incluso atacando. Ventaja en ataques, desventaja en recibidos.' },
      { id:'ice-storm-m',        name:'Ice Storm',           level:4, castTime:'Acción',    range:'90 m',      duration:'Inst.',   concentration:false, combat:true,  desc:'Cilindro 6m radio · 2d8 B + 4d6 frío · terreno difícil.' },
      { id:'phantasmal-killer-m',name:'Phantasmal Killer',   level:4, castTime:'Acción',    range:'36 m',      duration:'1 min',   concentration:true,  combat:true,  desc:'Save SAB o asustado · 4d10 psíquico por turno.' },
      { id:'polymorph-m',        name:'Polymorph',           level:4, castTime:'Acción',    range:'18 m',      duration:'1 h',     concentration:true,  combat:true,  desc:'Save SAB o transformado en bestia. HP propio de la bestia.' },
      { id:'stoneskin-m',        name:'Stoneskin',           level:4, castTime:'Acción',    range:'Toque',     duration:'1 h',     concentration:true,  combat:true,  desc:'Resistencia a daño no mágico de arma.' },
      { id:'wall-of-fire-m',     name:'Wall of Fire',        level:4, castTime:'Acción',    range:'36 m',      duration:'1 min',   concentration:true,  combat:true,  desc:'Muro 18m largo · 5d8 fuego al otro lado o al cruzar.' },
      // Nivel 5
      { id:'animate-objects-m',  name:'Animate Objects',     level:5, castTime:'Acción',    range:'36 m',      duration:'1 min',   concentration:true,  combat:true,  desc:'Hasta 10 objetos pequeños animados atacan.' },
      { id:'bigbys-hand-m',      name:"Bigby's Hand",        level:5, castTime:'Acción',    range:'36 m',      duration:'1 min',   concentration:true,  combat:true,  desc:'Mano de fuerza: 4d8 fuerza, empuje, agarre, bloqueo.' },
      { id:'cloudkill-m',        name:'Cloudkill',           level:5, castTime:'Acción',    range:'27 m',      duration:'10 min',  concentration:true,  combat:true,  desc:'Esfera 6m verde · save CON · 5d8 veneno (mitad si pasa). Se mueve 3m/turno.' },
      { id:'cone-of-cold-m',     name:'Cone of Cold',        level:5, castTime:'Acción',    range:'Cono 18m',  duration:'Inst.',   concentration:false, combat:true,  desc:'Cono 18m · save CON · 8d8 frío. +1d8 por nivel.' },
      { id:'dominate-person-m',  name:'Dominate Person',     level:5, castTime:'Acción',    range:'18 m',      duration:'1 min',   concentration:true,  combat:true,  desc:'Save SAB o humanoide bajo tu control.' },
      { id:'hold-monster-m',     name:'Hold Monster',        level:5, castTime:'Acción',    range:'18 m',      duration:'1 min',   concentration:true,  combat:true,  desc:'Save SAB o paralizado (cualquier criatura). Repite save c/turno.' },
      { id:'seeming-m',          name:'Seeming',             level:5, castTime:'Acción',    range:'9 m',       duration:'8 h',     concentration:false, combat:false, desc:'Cambia apariencia de criaturas en rango. Save CAR para resistir.' },
      { id:'synaptic-static-m',  name:'Synaptic Static',     level:5, castTime:'Acción',    range:'36 m',      duration:'Inst.',   concentration:false, combat:true,  desc:'Esfera 6m · save INT · 8d6 psíquico + 1d6 penalización en checks/ataques.' },
      { id:'telekinesis-m',      name:'Telekinesis',         level:5, castTime:'Acción',    range:'18 m',      duration:'10 min',  concentration:true,  combat:true,  desc:'Mueve objetos o criaturas con la mente. Criatura: save FUE.' },
      { id:'teleportation-circle-m',name:'Teleportation Circle',level:5, castTime:'1 min', range:'3 m',       duration:'1 ronda', concentration:false, combat:false, desc:'Portal a círculo conocido en el mismo plano.' },
      // Nivel 6
      { id:'chain-lightning-m',  name:'Chain Lightning',     level:6, castTime:'Acción',    range:'30 m',      duration:'Inst.',   concentration:false, combat:true,  desc:'10d8 relámpago objetivo principal + 3 secundarios (save DES mitad).' },
      { id:'disintegrate-m',     name:'Disintegrate',        level:6, castTime:'Acción',    range:'18 m',      duration:'Inst.',   concentration:false, combat:true,  desc:'Save DES · 10d6+40 fuerza. +3d6 por nivel. Reduce a polvo si mata.' },
      { id:'eyebite-m',          name:'Eyebite',             level:6, castTime:'Acción',    range:'Uno mismo', duration:'1 min',   concentration:true,  combat:true,  desc:'Mirada mágica c/turno: dormido, asustado o mareado (save SAB).' },
      { id:'flesh-to-stone-m',   name:'Flesh to Stone',      level:6, castTime:'Acción',    range:'18 m',      duration:'1 min',   concentration:true,  combat:true,  desc:'Save CON ×3 fallos consecutivos o petrificado.' },
      { id:'globe-invuln-m',     name:'Globe of Invulnerability',level:6, castTime:'Acción',range:'Uno mismo', duration:'1 min',   concentration:true,  combat:true,  desc:'Esfera 3m · bloquea conjuros de nivel 5 o inferior.' },
      { id:'mass-suggestion-m',  name:'Mass Suggestion',     level:6, castTime:'Acción',    range:'18 m',      duration:'24 h',    concentration:false, combat:false, desc:'Save SAB o hasta 12 criaturas siguen sugerencia razonable.' },
      { id:'ottos-dance-m',      name:"Otto's Irresistible Dance",level:6, castTime:'Acción',range:'9 m',     duration:'1 min',   concentration:true,  combat:true,  desc:'Save SAB o baila: vel 0, -2CA, desventaja DES saves, no puede usar acción de concentración.' },
      { id:'true-seeing-m',      name:'True Seeing',         level:6, castTime:'Acción',    range:'Toque',     duration:'1 h',     concentration:false, combat:false, desc:'Ve invisibles, ilusiones reales, oscuridad total, plano etéreo. Visión 36m.' },
    ],

    'Brujo': [
      // Cantrips
      { id:'eldritch-blast',   name:'Eldritch Blast',  level:0, castTime:'Acción', range:'36 m',  duration:'Inst.',  concentration:false, combat:true,  desc:'Rayo de fuerza · 1d10 · +1 rayo a nv5/11/17.' },
      { id:'toll-dead-w',      name:'Toll the Dead',   level:0, castTime:'Acción', range:'18 m',  duration:'Inst.',  concentration:false, combat:true,  desc:'Save SAB · 1d8 necrótico (1d12 si ya herido). Escala nv5/11/17.' },
      { id:'minor-illusion-w', name:'Minor Illusion',  level:0, castTime:'Acción', range:'9 m',   duration:'1 min',  concentration:false, combat:false, desc:'Sonido o imagen estática cubo 5ft.' },
      { id:'chill-touch-w',    name:'Chill Touch',     level:0, castTime:'Acción', range:'18 m',  duration:'1 ronda',concentration:false, combat:true,  desc:'Ataque a distancia · 1d8 necrótico · muertos vivientes con desventaja.' },
      { id:'poison-spray-w',   name:'Poison Spray',    level:0, castTime:'Acción', range:'3 m',   duration:'Inst.',  concentration:false, combat:true,  desc:'Save CON · 1d12 veneno. Escala nv5/11/17.' },
      { id:'mage-hand-w',      name:'Mage Hand',       level:0, castTime:'Acción', range:'9 m',   duration:'1 min',  concentration:false, combat:false, desc:'Mano espectral manipula objetos hasta 5 kg.' },
      { id:'true-strike-w',    name:'True Strike',     level:0, castTime:'Acción bonus', range:'9 m', duration:'Conc 1r', concentration:true, combat:true, desc:'Conc · ventaja en tu primer ataque vs el objetivo el próximo turno.' },
      { id:'hex',            name:'Hex',             level:1, castTime:'Acción bonus', range:'27 m', duration:'1 h', concentration:true, combat:true, desc:'Maldición: +1d6 necrótico en ataques · desventaja en check elegido.' },
      { id:'arms-of-hadar',  name:'Arms of Hadar',   level:1, castTime:'Acción', range:'Uno mismo (10ft)', duration:'Inst.', concentration:false, combat:true, desc:'Save FUE · 2d6 necrótico · no puede tomar reacciones hasta su turno.' },
      { id:'hellish-rebuke', name:'Hellish Rebuke',  level:1, castTime:'Reacción', range:'18 m', duration:'Inst.', concentration:false, combat:true, desc:'Reacción al ser golpeado · save DES · 2d10 fuego. +1d10 por nivel.' },
      { id:'misty-step-w',   name:'Misty Step',      level:2, castTime:'Acción bonus', range:'Uno mismo', duration:'Inst.', concentration:false, combat:true, desc:'Teleportación 9 m.' },
      { id:'hold-person-w',  name:'Hold Person',     level:2, castTime:'Acción', range:'18 m', duration:'1 min', concentration:true, combat:true, desc:'Save SAB o paralizado (humanoides). Repite save c/turno.' },
      { id:'spider-climb-w', name:'Spider Climb',    level:2, castTime:'Acción', range:'Toque', duration:'1 h', concentration:true, combat:false, desc:'Escala paredes y techos a velocidad normal.' },
      { id:'suggestion-w',   name:'Suggestion',      level:2, castTime:'Acción', range:'9 m',  duration:'8 h',   concentration:true, combat:false, desc:'Save SAB o sigue sugerencia razonable.' },
      // ── Nivel 3 ──
      { id:'hunger-hadar-w', name:'Hunger of Hadar', level:3, castTime:'Acción', range:'45 m', duration:'1 min', concentration:true, combat:true, desc:'Esfera de oscuridad 6m · 2d6 frío al inicio y 2d6 ácido al final si en zona. Ciega.' },
      { id:'hypnotic-pattern-w', name:'Hypnotic Pattern', level:3, castTime:'Acción', range:'36 m', duration:'1 min', concentration:true, combat:true, desc:'Cubo 9m · save SAB o Charmed+Incapacitado+vel 0. Se rompe si recibe daño o alguien usa acción para sacarla.' },
      { id:'fear-w',         name:'Fear',            level:3, castTime:'Acción', range:'Cono 9m', duration:'1 min', concentration:true, combat:true, desc:'Save SAB o asustado y huye; descarta objetos.' },
      { id:'counterspell-w', name:'Counterspell',    level:3, castTime:'Reacción', range:'18 m', duration:'Inst.', concentration:false, combat:true, desc:'Cancela hechizo nv3 o menos. Superior: check CAR.' },
      { id:'dispel-magic-w', name:'Dispel Magic',    level:3, castTime:'Acción', range:'36 m', duration:'Inst.', concentration:false, combat:true, desc:'Termina conjuros en objetivo. +alto: check CAR.' },
      // ── Nivel 4 ──
      { id:'banishment-w',   name:'Banishment',      level:4, castTime:'Acción', range:'18 m', duration:'1 min', concentration:true, combat:true, desc:'Save CAR o desterrado al plano de origen.' },
      { id:'shadow-moil-w',  name:'Shadow of Moil',  level:4, castTime:'Acción', range:'Uno mismo', duration:'1 min', concentration:true, combat:true, desc:'Rodeado de sombras: oscurecido · ataques te dan 2d8 necrótico al atacante.' },
      { id:'dimension-door-w',name:'Dimension Door', level:4, castTime:'Acción', range:'150 m',duration:'Inst.', concentration:false, combat:true, desc:'Teleportación vos +1 aliado a 150m.' },
      { id:'hallucinatory-terrain-w', name:'Hallucinatory Terrain', level:4, castTime:'10 min', range:'90 m', duration:'24 h', concentration:false, combat:false, desc:'Ilusión de terreno natural en área 45m cúbica.' },
      // ── Nivel 5 ──
      { id:'synaptic-static-w', name:'Synaptic Static', level:5, castTime:'Acción', range:'36 m', duration:'Inst.', concentration:false, combat:true, desc:'Esfera 6m · save INT · 8d6 psíquico + penalización en rolls.' },
      { id:'hold-monster-w', name:'Hold Monster',    level:5, castTime:'Acción', range:'18 m', duration:'1 min', concentration:true, combat:true, desc:'Save SAB o paralizado (cualquier criatura).' },
      { id:'dream-w',        name:'Dream',           level:5, castTime:'1 min',  range:'Especial', duration:'8 h', concentration:false, combat:false, desc:'Envía mensajes a través de los sueños de una criatura conocida.' },
      { id:'scrying-w',      name:'Scrying',         level:5, castTime:'10 min', range:'Uno mismo', duration:'10 min', concentration:true, combat:false, desc:'Observás a una criatura en otro lugar (save SAB).' },
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
      { id:'aura-vitality-p',name:'Aura of Vitality', level:3, castTime:'Acción', range:'Uno mismo (9m)', duration:'1 min', concentration:true, combat:false, desc:'Acción bonus: cura 2d6 HP a una criatura en aura.' },
      { id:'crusader-mantle-p', name:"Crusader's Mantle", level:3, castTime:'Acción', range:'Uno mismo (9m)', duration:'1 min', concentration:true, combat:true, desc:'Aliados en aura: +1d4 radiante en cada golpe de arma.' },
      { id:'dispel-magic-p', name:'Dispel Magic',     level:3, castTime:'Acción', range:'36 m', duration:'Inst.', concentration:false, combat:true, desc:'Termina conjuros en objetivo. +alto: check CAR.' },
      { id:'protection-energy-p', name:'Protection from Energy', level:3, castTime:'Acción', range:'Toque', duration:'1 h', concentration:true, combat:true, desc:'Resistencia a tipo de daño elemental elegido.' },
      // ── Nivel 4 ──
      { id:'aura-purity-p',  name:'Aura of Purity',  level:4, castTime:'Acción', range:'Uno mismo (9m)', duration:'10 min', concentration:true, combat:false, desc:'Aliados en aura: inmunes a enfermedades, ventaja en saves de veneno/condiciones.' },
      { id:'banishment-p',   name:'Banishment',       level:4, castTime:'Acción', range:'18 m', duration:'1 min', concentration:true, combat:true, desc:'Save CAR o desterrado al plano de origen.' },
      { id:'death-ward-p',   name:'Death Ward',       level:4, castTime:'Acción', range:'Toque', duration:'8 h', concentration:false, combat:false, desc:'Una vez: si caés a 0 HP, quedás a 1 HP. Termina el conjuro.' },
      { id:'freedom-movement-p', name:'Freedom of Movement', level:4, castTime:'Acción', range:'Toque', duration:'1 h', concentration:false, combat:true, desc:'Ignora terreno difícil y efectos de inmovilización.' },
      // ── Nivel 5 ──
      { id:'destructive-wave-p', name:'Destructive Wave', level:5, castTime:'Acción', range:'Uno mismo (9m)', duration:'Inst.', concentration:false, combat:true, desc:'Onda divina 9m: save CON o 5d6 trueno + 5d6 radiante/necrótico, derribado.' },
      { id:'dispel-evil-p',  name:'Dispel Evil and Good', level:5, castTime:'Acción', range:'Uno mismo', duration:'1 min', concentration:true, combat:true, desc:'Aura vs criaturas de otros planos: desventaja en ataques, o exorcizás o destierras.' },
      { id:'geas-p',         name:'Geas',             level:5, castTime:'1 min',  range:'18 m', duration:'30 días', concentration:false, combat:false, desc:'Save SAB o misión encomendada. 5d10 psíquico por acción contra la misión.' },
      { id:'holy-weapon-p',  name:'Holy Weapon',      level:5, castTime:'Acción bonus', range:'Toque', duration:'1 h', concentration:true, combat:true, desc:'Arma sagrada: +2d8 radiante al golpear. Destellar: save CON o cegado.' },
      { id:'raise-dead-p',   name:'Raise Dead',       level:5, castTime:'1 h',    range:'Toque', duration:'Inst.', concentration:false, combat:false, desc:'Revive criatura muerta hace <10 días con 1 HP. -4 a rolls por 4 días.' },
      { id:'smite-evil-p',   name:'Banishing Smite',  level:5, castTime:'Acción bonus', range:'Uno mismo', duration:'1 min', concentration:true, combat:true, desc:'Próximo golpe: +5d10 fuerza. Si queda en ≤ 50HP, es desterrado.' },
    ],

    'Explorador': [
      // Nivel 1
      { id:'hunters-mark',    name:"Hunter's Mark",    level:1, castTime:'Acción bonus', range:'27 m',       duration:'1 h',    concentration:true,  combat:true,  desc:'Presa: +1d6 daño en ataques · ventaja en Percepción/Sigilo vs ella. Transferible.' },
      { id:'ensnaring-strike',name:'Ensnaring Strike',  level:1, castTime:'Acción bonus', range:'Uno mismo',  duration:'1 min',  concentration:true,  combat:true,  desc:'Golpe: save FUE o atrapado. 1d6 perforante por turno atrapado.' },
      { id:'hail-of-thorns',  name:'Hail of Thorns',   level:1, castTime:'Acción bonus', range:'Uno mismo',  duration:'Inst.',  concentration:true,  combat:true,  desc:'Golpe a distancia: +1d10 perforante al objetivo y adyacentes (save DES mitad).' },
      { id:'fog-cloud-r',     name:'Fog Cloud',         level:1, castTime:'Acción',       range:'27 m',       duration:'1 h',    concentration:true,  combat:true,  desc:'Esfera 6m radio de niebla espesa · visibilidad nula.' },
      { id:'goodberry',       name:'Goodberry',         level:1, castTime:'Acción',       range:'Toque',      duration:'Inst.',  concentration:false, combat:false, desc:'10 bayas mágicas · cada una restaura 1 HP · nutritiva por 1 día.' },
      { id:'cure-wounds-r',   name:'Cure Wounds',       level:1, castTime:'Acción',       range:'Toque',      duration:'Inst.',  concentration:false, combat:false, desc:'1d8+SAB HP a una criatura.' },
      // Nivel 2
      { id:'pass-without-trace', name:'Pass Without Trace', level:2, castTime:'Acción',  range:'Uno mismo',  duration:'1 h',    concentration:true,  combat:false, desc:'+10 sigilo a tus compañeros en 9 m · no dejan rastro.' },
      { id:'spike-growth-r',  name:'Spike Growth',      level:2, castTime:'Acción',       range:'45 m',       duration:'10 min', concentration:true,  combat:true,  desc:'Área difícil 20ft · 2d4 perforante por cada 5ft de movimiento.' },
      { id:'misty-step-r',    name:'Misty Step',        level:2, castTime:'Acción bonus', range:'Uno mismo',  duration:'Inst.',  concentration:false, combat:true,  desc:'Teleportación 9 m a lugar visible.' },
      { id:'silence',         name:'Silence',           level:2, castTime:'Acción',       range:'27 m',       duration:'10 min', concentration:true,  combat:true,  desc:'Esfera 6m: sin sonido · sin conjuros verbales.' },
      { id:'cordon-of-arrows', name:'Cordon of Arrows', level:2, castTime:'Acción',       range:'1,5 m',      duration:'8 h',    concentration:false, combat:true,  desc:'4 flechas mágicas alrededor tuyo; atacan a quien pase (1d6 perforante, save DES).' },
      // Nivel 3
      { id:'lightning-arrow',  name:'Lightning Arrow',  level:3, castTime:'Acción bonus', range:'Uno mismo',  duration:'Inst.',  concentration:true,  combat:true,  desc:'Reemplaza un ataque a distancia: 4d8 relámpago al objetivo, 2d8 a adyacentes (save DES mitad).' },
      { id:'conjure-animals',  name:'Conjure Animals',  level:3, castTime:'Acción',       range:'18 m',       duration:'1 h',    concentration:true,  combat:true,  desc:'Invoca bestias CR ≤ 2 que obedecen tus órdenes.' },
      { id:'nondetection',     name:'Nondetection',     level:3, castTime:'Acción',       range:'Toque',      duration:'8 h',    concentration:false, combat:false, desc:'Criatura/objeto no puede ser detectado por magia de adivinación.' },
      { id:'water-breathing-r',name:'Water Breathing',  level:3, castTime:'Acción',       range:'9 m',        duration:'24 h',   concentration:false, combat:false, ritual:true, desc:'Hasta 10 criaturas respiran bajo el agua. Ritual.' },
      { id:'plant-growth-r',   name:'Plant Growth',     level:3, castTime:'Varía',        range:'45 m',       duration:'Inst./8 h', concentration:false, combat:true, desc:'Enreda terreno 50ft radio (movimiento ÷ 4) o enriquece cultivos.' },
      { id:'wind-wall-r',      name:'Wind Wall',        level:3, castTime:'Acción',       range:'36 m',       duration:'1 min',  concentration:true,  combat:true,  desc:'Muro de viento 15m × 5m: impide proyectiles y empuja criaturas pequeñas.' },
      // ── Nivel 4 ──
      { id:'conjure-woodland-r',name:'Conjure Woodland Beings', level:4, castTime:'Acción', range:'18 m',    duration:'1 h',    concentration:true,  combat:true,  desc:'Invoca hadas de CR ≤ 2 o una criatura de CR ≤ 4.' },
      { id:'freedom-movement-r',name:'Freedom of Movement', level:4, castTime:'Acción',   range:'Toque',     duration:'1 h',    concentration:false, combat:true,  desc:'Ignora terreno difícil y efectos de inmovilización.' },
      { id:'locate-creature-r',name:'Locate Creature',  level:4, castTime:'Acción',       range:'Uno mismo', duration:'1 h',    concentration:true,  combat:false, desc:'Sientes la dirección de la criatura conocida a ≤ 300ft.' },
      { id:'stoneskin-r',      name:'Stoneskin',        level:4, castTime:'Acción',       range:'Toque',     duration:'1 h',    concentration:true,  combat:true,  desc:'Resistencia a daño no mágico de arma (B/P/S).' },
      // ── Nivel 5 ──
      { id:'commune-nature-r', name:'Commune with Nature', level:5, castTime:'1 min',    range:'Uno mismo',  duration:'Inst.',  concentration:false, combat:false, ritual:true, desc:'Obtenés información sobre el terreno en un radio de 5 km. Ritual.' },
      { id:'conjure-volley-r', name:'Conjure Volley',   level:5, castTime:'Acción',       range:'45 m',       duration:'Inst.',  concentration:false, combat:true,  desc:'Lluvia de proyectiles en cilindro 12m × 12m: save DES o 8d8 daño.' },
      { id:'greater-restoration-r', name:'Greater Restoration', level:5, castTime:'Acción', range:'Toque',  duration:'Inst.',  concentration:false, combat:false, desc:'Elimina una condición debilitante: hechizado, petrificado, maldito, nivel agotamiento, reducción de stat max.' },
      { id:'steel-wind-strike-r',name:'Steel Wind Strike', level:5, castTime:'Acción',    range:'9 m',        duration:'Inst.',  concentration:false, combat:true,  desc:'5 ataques a distinta criatura (pueden ser todas distintas): 6d10 fuerza c/u · teleportás junto a una.' },
      { id:'swift-quiver-r',   name:'Swift Quiver',     level:5, castTime:'Acción bonus', range:'Toque',      duration:'1 min',  concentration:true,  combat:true,  desc:'Acción bonus c/turno: 2 ataques con arma a distancia.' },
      { id:'tree-stride-r',    name:'Tree Stride',      level:5, castTime:'Acción',       range:'Uno mismo',  duration:'1 min',  concentration:true,  combat:false, desc:'Entras y salís de árboles del mismo tipo a 90m de distancia.' },
    ],

    'Eldritch Knight': [
      // Cantrips
      { id:'ek-fire-bolt',     name:'Fire Bolt',          level:0, castTime:'Acción',       range:'36 m',  duration:'Inst.', concentration:false, combat:true,  desc:'Ataque a distancia · 1d10 fuego. Escala con nivel (2d10 nv5).' },
      { id:'ek-booming-blade', name:'Booming Blade',      level:0, castTime:'Acción',       range:'1,5 m', duration:'1 ronda', concentration:false, combat:true, desc:'Ataque melee + daño de trueno si el objetivo se mueve (1d8, luego 1d8 en cada turno).' },
      { id:'ek-green-flame',   name:"Green-Flame Blade",  level:0, castTime:'Acción',       range:'1,5 m', duration:'Inst.', concentration:false, combat:true,  desc:'Ataque melee + daño de fuego a un objetivo adyacente (SAB/INT mod).' },
      { id:'ek-mage-hand',     name:'Mage Hand',          level:0, castTime:'Acción',       range:'9 m',   duration:'1 min', concentration:false, combat:false, desc:'Mano espectral manipula objetos hasta 5 kg.' },
      // Nivel 1 (escuelas Abjuración/Evocación principalmente)
      { id:'ek-shield',        name:'Shield',             level:1, castTime:'Reacción',     range:'Personal', duration:'1 ronda', concentration:false, combat:true, desc:'Reacción · +5 CA hasta inicio de tu próximo turno.' },
      { id:'ek-absorb-elements', name:'Absorb Elements',  level:1, castTime:'Reacción',     range:'Personal', duration:'1 ronda', concentration:false, combat:true, desc:'Reacción al recibir daño elemental: resistencia + +1d6 del mismo tipo en próximo ataque.' },
      { id:'ek-magic-missile', name:'Magic Missile',      level:1, castTime:'Acción',       range:'36 m',  duration:'Inst.', concentration:false, combat:true,  desc:'3 dardos infalibles · 1d4+1 fuerza c/u. +1 dardo por slot.' },
      { id:'ek-thunderwave',   name:'Thunderwave',        level:1, castTime:'Acción',       range:'Personal (15ft)', duration:'Inst.', concentration:false, combat:true, desc:'Cubo 15ft · save CON · 2d8 trueno y empuja 10ft.' },
      // Nivel 2
      { id:'ek-mirror-image',  name:'Mirror Image',       level:2, castTime:'Acción',       range:'Personal', duration:'1 min', concentration:false, combat:true, desc:'3 duplicados ilusorios desvían ataques.' },
      { id:'ek-misty-step',    name:'Misty Step',         level:2, castTime:'Acción bonus', range:'Personal', duration:'Inst.', concentration:false, combat:true, desc:'Teleportación 9 m a lugar visible.' },
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

  // ── Descripciones de feats de trasfondo (2024 PHB) ──────────────────────────
  const BACKGROUND_FEATS_DESC = {
    'Lucky':                     { desc:'Tenés 3 puntos de suerte. Gastás uno para tirar un d20 adicional en cualquier ataque, check o save (antes de saber el resultado) y elegís cuál resultado usar. Los puntos se recuperan en Long Rest.', fullDesc:'' },
    'Magic Initiate (Clérigo)':  { desc:'Aprendés 2 cantrips y 1 hechizo de nivel 1 de la lista de Clérigo. Podés lanzar el hechizo de nivel 1 una vez por Long Rest sin gastar un slot (o con un slot si tenés).', fullDesc:'' },
    'Magic Initiate (Mago)':     { desc:'Aprendés 2 cantrips y 1 hechizo de nivel 1 de la lista de Mago. Podés lanzar el hechizo de nivel 1 una vez por Long Rest sin gastar un slot (o con un slot si tenés).', fullDesc:'' },
    'Magic Initiate (Druida)':   { desc:'Aprendés 2 cantrips y 1 hechizo de nivel 1 de la lista de Druida. Podés lanzar el hechizo de nivel 1 una vez por Long Rest sin gastar un slot (o con un slot si tenés).', fullDesc:'' },
    'Crafter':                   { desc:'Proficiencia con 3 herramientas de artesano a elección. Al comprar equipo no mágico reducís el costo en 20%. También podés crear objetos durante los descansos.', fullDesc:'' },
    'Skilled':                   { desc:'Ganás proficiencia en 3 habilidades o herramientas a elección.', fullDesc:'' },
    'Alert':                     { desc:'+5 a iniciativa. No podés ser sorprendido mientras estés consciente. Otros personajes no ganan ventaja en ataques contra vos por estar ocultos.', fullDesc:'' },
    'Tough':                     { desc:'HP máximo aumenta en 2 por nivel (actual y futuros). Retroactivo: ya incluye todos los niveles pasados.', fullDesc:'' },
    'Savage Attacker':           { desc:'Una vez por turno, cuando hacés un ataque con arma, podés tirar los dados de daño dos veces y quedarte con el resultado más alto.', fullDesc:'' },
    'Musician':                  { desc:'Proficiencia con 3 instrumentos musicales. Tras un Short o Long Rest, podés tocar para tus aliados: cada uno que te escuche gana Inspiración.', fullDesc:'' },
    'Tavern Brawler':            { desc:'Ataques sin armas usan d4. Proficiencia con armas improvisadas. Podés usar tu Bonus Action para agarrar a alguien tras golpearlo. Bonus: +1 FUE o CON.', fullDesc:'' },
    'Healer':                    { desc:'Usás un Healer\'s Kit para estabilizar a un personaje caído y además restaurarle 1d6+4+nivel HP. Podés usarlo una vez por criatura entre descansos cortos/largos.', fullDesc:'' },
  };

  // ── Catálogo de feats generales (PHB 2014 + 2024 + Tasha's más usados) ────────
  const GENERAL_FEATS = [
    // Combate
    { id:'feat-grappler',         name:'Grappler',              category:'Combate', prereq:'FUE 13+', desc:'Ventaja en ataques contra criaturas que tenés agarradas. Podés restringirlas (ambos quedan restringidos).', fullDesc:'' },
    { id:'feat-great-weapon-master', name:'Great Weapon Master', category:'Combate', prereq:'FUE 13+', desc:'Con arma de dos manos: -5 al golpe para +10 al daño. Si hacés un crítico o matás con ella, hacés un ataque de Bonus Action.', fullDesc:'' },
    { id:'feat-polearm-master',   name:'Polearm Master',        category:'Combate', prereq:'FUE o DES 13+', desc:'Con alabarda/lanza: Bonus Action para golpear con el extremo (d4 contundente). Reacción para atacar cuando alguien entra a tu alcance.', fullDesc:'' },
    { id:'feat-sentinel',         name:'Sentinel',              category:'Combate', prereq:null, desc:'Opp attacks reducen velocidad a 0. Podés hacer opp attack aunque el enemigo use Disengage. Reacción para atacar a quien ataque a un aliado adyacente.', fullDesc:'' },
    { id:'feat-sharpshooter',     name:'Sharpshooter',          category:'Combate', prereq:'DES 13+', desc:'-5 al golpe para +10 al daño con armas a distancia. Ignorás cobertura media y tres cuartos. Sin penalización de largo alcance.', fullDesc:'' },
    { id:'feat-crossbow-expert',  name:'Crossbow Expert',       category:'Combate', prereq:null, desc:'Sin desventaja en ataque a distancia de cerca. Bonus Action con ballesta de mano. Ignorás la propiedad Loading.', fullDesc:'' },
    { id:'feat-dual-wielder',     name:'Dual Wielder',          category:'Combate', prereq:null, desc:'+1 CA con dos armas. Podés two-weapon fight con armas no ligeras. Desenfundás/enfundás dos armas a la vez.', fullDesc:'' },
    { id:'feat-shield-master',    name:'Shield Master',         category:'Combate', prereq:null, desc:'Bonus Action para empujar a criatura adyacente. +2 a saves de DES que afectan solo a vos. Si fallás un save DES, podés gastar Reacción para no tomar daño.', fullDesc:'' },
    { id:'feat-mobile',           name:'Mobile',                category:'Combate', prereq:null, desc:'+10 ft de velocidad. Al Dash en terreno difícil no gastas extra. Si atacás a alguien (golpee o no), no provoca opp attack en tu turno.', fullDesc:'' },
    { id:'feat-war-caster',       name:'War Caster',            category:'Combate', prereq:'Capacidad de lanzar conjuros', desc:'Ventaja en CON saves de concentración. Podés lanzar conjuros con las manos ocupadas (escudo/arma). Podés lanzar un conjuro como opp attack.', fullDesc:'' },
    { id:'feat-resilient',        name:'Resilient',             category:'Combate', prereq:null, desc:'+1 a un stat a elección + proficiencia en saves de ese stat.', fullDesc:'' },
    // Magia
    { id:'feat-elemental-adept',  name:'Elemental Adept',       category:'Magia', prereq:'Capacidad de lanzar conjuros', desc:'Elegís un tipo de daño (ácido/frío/fuego/rayo/trueno). Tus conjuros de ese tipo ignoran resistencia. Los 1 en dados de ese daño se tratan como 2.', fullDesc:'' },
    { id:'feat-spell-sniper',     name:'Spell Sniper',          category:'Magia', prereq:'Capacidad de lanzar conjuros', desc:'El alcance de conjuros de ataque se duplica. Ignorás cobertura media y tres cuartos con conjuros de ataque. Aprendés 1 cantrip de ataque de cualquier lista.', fullDesc:'' },
    { id:'feat-metamagic-adept',  name:'Metamagic Adept',       category:'Magia', prereq:'Capacidad de lanzar conjuros', desc:'Aprendés 2 opciones de Metamagic y ganás 2 Sorcery Points para usarlas (se recuperan en Long Rest). (Tasha\'s)', fullDesc:'' },
    { id:'feat-artificer-init',   name:'Artificer Initiate',    category:'Magia', prereq:null, desc:'Aprendés 1 cantrip de Artificer + 1 conjuro de nivel 1 (lanzable 1/día). Proficiencia en herramientas de artesano a elección.', fullDesc:'' },
    { id:'feat-ritual-caster',    name:'Ritual Caster',         category:'Magia', prereq:'INT o SAB 13+', desc:'Adquirís un libro de rituales con 2 conjuros de nivel 1 que tengan la etiqueta ritual. Podés agregar más rituales al libro. Podés lanzarlos como ritual sin gastar slot.', fullDesc:'' },
    // Utilidad
    { id:'feat-athlete',          name:'Athlete',               category:'Utilidad', prereq:null, desc:'+1 FUE o DES. Levantarte solo cuesta 5 ft. Escalar no reduce tu velocidad. Salto con carrera con solo 5 ft de movimiento.', fullDesc:'' },
    { id:'feat-actor',            name:'Actor',                 category:'Utilidad', prereq:null, desc:'+1 CAR. Ventaja en Performance/Engaño cuando te hacés pasar por alguien. Podés imitar voz/sonidos de criaturas que hayas escuchado (Perspicacia CD 14 para detectarte).', fullDesc:'' },
    { id:'feat-charger',          name:'Charger',               category:'Utilidad', prereq:null, desc:'Al Dash como Action: Bonus Action para atacar (+5 daño) o empujar (10 ft). Bonus: +1 FUE o CON.', fullDesc:'' },
    { id:'feat-dungeon-delver',   name:'Dungeon Delver',        category:'Utilidad', prereq:null, desc:'Ventaja en Percepción/Investigación para puertas secretas. Ventaja en saves vs trampas. Resistencia al daño de trampas. Normal pace para buscar trampas.', fullDesc:'' },
    { id:'feat-durable',          name:'Durable',               category:'Utilidad', prereq:null, desc:'+1 CON. Mínimo de HP recuperado en un Hit Die = 2×mod CON (mínimo 2).', fullDesc:'' },
    { id:'feat-linguist',         name:'Linguist',              category:'Utilidad', prereq:null, desc:'+1 INT. Aprendés 3 idiomas. Podés crear cifrados escritos; solo vos y quienes enseñés pueden leerlos (Investigación para romperlo, CD = 8+INT mod+PB).', fullDesc:'' },
    { id:'feat-observant',        name:'Observant',             category:'Utilidad', prereq:null, desc:'+1 INT o SAB. Podés leer labios. +5 a Percepción pasiva e Investigación pasiva.', fullDesc:'' },
    { id:'feat-prodigy',          name:'Prodigy',               category:'Utilidad', prereq:'Half-human o humano', desc:'Proficiencia en 1 skill, 1 herramienta y 1 idioma. Ganás Expertise en 1 skill de las que ya tenés proficiencia. (Xanathar\'s)', fullDesc:'' },
    { id:'feat-skulker',          name:'Skulker',               category:'Utilidad', prereq:'DES 13+', desc:'Podés ocultarte cuando estés ligeramente cubierto. Si fallás un ataque oculto, no te revelás. Estar en luz tenue no es desventaja en Sigilo.', fullDesc:'' },
    { id:'feat-inspiring-leader', name:'Inspiring Leader',      category:'Utilidad', prereq:'CAR 13+', desc:'10 min de inspiración a hasta 6 aliados que te puedan escuchar. Cada uno gana Temp HP = tu nivel + mod CAR. 1 uso por Short/Long Rest.', fullDesc:'' },
    { id:'feat-lucky',            name:'Lucky',                 category:'Utilidad', prereq:null, desc:'3 puntos de suerte (se recuperan en Long Rest). Gastás uno para tirar un d20 adicional en ataque/check/save y elegís cuál resultado usar. También podés forzar a que el atacante tire de vuelta y te quedás con el resultado más bajo.', fullDesc:'' },
    { id:'feat-alert',            name:'Alert',                 category:'Utilidad', prereq:null, desc:'+5 a iniciativa. No podés ser sorprendido mientras estés consciente. Los enemigos ocultos no ganan ventaja en ataques contra vos.', fullDesc:'' },
    { id:'feat-tough',            name:'Tough',                 category:'Utilidad', prereq:null, desc:'HP máximo aumenta en 2 × tu nivel (retroactivo). En cada nivel futuro HP máximo aumenta 2 puntos extra adicionales.', fullDesc:'' },
    { id:'feat-skilled',          name:'Skilled',               category:'Utilidad', prereq:null, desc:'Ganás proficiencia en 3 skills o herramientas a elección (cualquier combinación).', fullDesc:'' },
    { id:'feat-telekinetic',      name:'Telekinetic',           category:'Utilidad', prereq:null, desc:'+1 INT/SAB/CAR. Aprendés Mage Hand (invisible). Bonus Action: empujás/atraés a criatura a 5 ft (STR save CD 8+PB+stat mod). (Tasha\'s)', fullDesc:'' },
    { id:'feat-telepathic',       name:'Telepathic',            category:'Utilidad', prereq:null, desc:'+1 INT/SAB/CAR. Podés hablar telepáticamente con alguien a 60 ft (no necesita compartir idioma). 1/día: Detect Thoughts sin slot. (Tasha\'s)', fullDesc:'' },
    { id:'feat-fey-touched',      name:'Fey Touched',           category:'Magia', prereq:null, desc:'+1 INT/SAB/CAR. Aprendés Misty Step + 1 conjuro de nivel 1 de las escuelas de Adivinación o Encantamiento. Cada uno lanzable 1/día gratis. (Tasha\'s)', fullDesc:'' },
    { id:'feat-shadow-touched',   name:'Shadow Touched',        category:'Magia', prereq:null, desc:'+1 INT/SAB/CAR. Aprendés Invisibility + 1 conjuro de nivel 1 de las escuelas de Ilusión o Necromancia. Cada uno lanzable 1/día gratis. (Tasha\'s)', fullDesc:'' },
    { id:'feat-custom',           name:'Feat personalizado',    category:'Otro', prereq:null, desc:'Agregá una descripción manual del feat en tus features después de crearlo.', fullDesc:'' },
  ];

  // ── applyTrasfondo: aplica skills, feat y rasgos de trasfondo al personaje ───
  function applyTrasfondo(char, trasfondoNombre) {
    if (!trasfondoNombre) return char;
    const cfg = TRASFONDOS_CONFIG[trasfondoNombre];
    if (!cfg) return char;

    char.trasfondo = trasfondoNombre;

    // Aplicar proficiencias de habilidad (sin duplicar)
    if (cfg.skillProfs && cfg.skillProfs.length) {
      char.skillProfs = [...new Set([...(char.skillProfs || []), ...cfg.skillProfs])];
    }

    // Aplicar feat de trasfondo como feature visible
    if (cfg.feat && cfg.feat !== '') {
      const featDef = BACKGROUND_FEATS_DESC[cfg.feat] || { desc: cfg.feat, fullDesc: '' };
      const featFeature = {
        id:       'bg-feat-' + trasfondoNombre.toLowerCase().replace(/[^a-z0-9]/g, '-'),
        name:     cfg.feat,
        source:   `Trasfondo · ${trasfondoNombre}`,
        type:     'passive',
        action:   'Pasiva',
        range:    'Personal',
        recharge: null,
        desc:     featDef.desc,
        fullDesc: featDef.fullDesc || '',
      };
      if (!char.features) char.features = [];
      // Solo agregar si no existe ya (evitar duplicados al editar)
      if (!char.features.find(f => f.id === featFeature.id)) {
        char.features.push(featFeature);
      }
    }

    // Aplicar feature de trasfondo (el rasgo narrativo, siempre)
    if (cfg.feature && cfg.feature !== '') {
      const featId = 'bg-trait-' + trasfondoNombre.toLowerCase().replace(/[^a-z0-9]/g, '-');
      const traitFeature = {
        id:       featId,
        name:     cfg.feature,
        source:   `Trasfondo · ${trasfondoNombre}`,
        type:     'passive',
        action:   'Pasiva',
        range:    'Personal',
        recharge: null,
        desc:     cfg.featureDesc || '',
        fullDesc: '',
      };
      if (!char.features) char.features = [];
      if (!char.features.find(f => f.id === traitFeature.id)) {
        char.features.push(traitFeature);
      }
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

    // Aplicar subclassSpells (hechizos siempre preparados de subclase, ej. Aberrant Mind / Clockwork Soul)
    if (typeof sub.subclassSpells === 'function') {
      const subclSpells = sub.subclassSpells(nivel);
      if (!char.spells) char.spells = [];
      subclSpells.forEach(s => {
        // Si ya existe una versión sin domain:true (del catálogo base), actualizar a domain:true
        const existing = char.spells.find(e => e.id === s.id);
        if (existing) {
          if (s.domain) existing.domain = true;
          if (s.cantrip_subclass) existing.cantrip_subclass = true;
        } else {
          char.spells.push({ ...s });
        }
      });
    }

    // Para subclases conjuradoras (Eldritch Knight, Arcane Trickster):
    // si existen spells en CLASE_SPELLS[subclaseName], añadirlos al personaje
    const subSpells = CLASE_SPELLS[subclaseName] || [];
    if (subSpells.length > 0) {
      if (!char.spells) char.spells = [];
      subSpells.forEach(s => {
        if (!char.spells.find(e => e.id === s.id)) {
          char.spells.push({ ...s });
        }
      });
      // Si la clase base no es lanzadora, darle slots de tercio-caster
      const claseCfg = CLASES_CONFIG[char.clase];
      if (claseCfg && !claseCfg.spellcastingStat) {
        // Eldritch Knight / Arcane Trickster — INT
        char.spellcastingStat = 'int';
        const thirdLevel = Math.floor((char.nivel || 1) / 3);
        if (thirdLevel >= 1 && (!char.spellSlots || !char.spellSlots[1]?.max)) {
          char.spellSlots = calcMulticlassSlots([
            { name: subclaseName === 'Arcane Trickster' ? 'Arcane Trickster' : 'Eldritch Knight', level: char.nivel || 1 }
          ]);
          // Fallback manual para tercio-caster si CLASES_CONFIG no lo tiene
          if (!char.spellSlots[1]?.max) {
            const THIRD_CASTER = {
              3:[2,0,0,0,0,0,0,0,0], 4:[3,0,0,0,0,0,0,0,0],
              7:[4,2,0,0,0,0,0,0,0], 8:[4,2,0,0,0,0,0,0,0],
              10:[4,3,0,0,0,0,0,0,0], 11:[4,3,0,0,0,0,0,0,0],
              13:[4,3,2,0,0,0,0,0,0], 14:[4,3,2,0,0,0,0,0,0],
              16:[4,3,3,0,0,0,0,0,0], 17:[4,3,3,0,0,0,0,0,0],
              19:[4,3,3,1,0,0,0,0,0], 20:[4,3,3,1,0,0,0,0,0],
            };
            const row = THIRD_CASTER[char.nivel || 1] || THIRD_CASTER[Math.max(...Object.keys(THIRD_CASTER).map(Number).filter(k => k <= (char.nivel||1)))] || [0,0,0,0,0,0,0,0,0];
            const slots = {};
            for (let i = 1; i <= 9; i++) slots[i] = { current: row[i-1]||0, max: row[i-1]||0 };
            char.spellSlots = slots;
          }
        }
      }
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
    // Para la lista inicial de hechizos: incluir todos los de nivel 1+,
    // pero para cantrips solo hasta el máximo de la tabla (los primeros N del catálogo)
    const allCatalogSpells = (CLASE_SPELLS[claseNombre] || []);
    const maxCantrips = (() => {
      const c = CLASES_CONFIG[claseNombre];
      if (c && c.cantripsKnown) return c.cantripsKnown[Math.min(nivel - 1, 19)];
      return null; // sin límite (clases preparadoras)
    })();
    const catalogCantrips = allCatalogSpells.filter(s => s.level === 0);
    const initialCantrips = maxCantrips !== null
      ? catalogCantrips.slice(0, maxCantrips)   // limitar al máximo de la tabla
      : catalogCantrips;                          // sin límite: incluir todos
    const spells = [
      ...initialCantrips.map(s => ({ ...s })),
      ...allCatalogSpells.filter(s => s.level > 0).map(s => ({ ...s })),
    ];

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
      choices:          {},

      _dataVersion: 12,
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

    // Actualizar subclassSpells al subir de nivel (ej. Aberrant Mind desbloquea por nivel)
    if (char.subclase) {
      const sub = SUBCLASES_CONFIG[char.subclase];
      if (sub && typeof sub.subclassSpells === 'function') {
        const subclSpells = sub.subclassSpells(newLevel);
        if (!char.spells) char.spells = [];
        subclSpells.forEach(s => {
          const existing = char.spells.find(e => e.id === s.id);
          if (existing) {
            if (s.domain) existing.domain = true;
            if (s.cantrip_subclass) existing.cantrip_subclass = true;
          } else {
            char.spells.push({ ...s });
          }
        });
      }
    }

    return char;
  }

  /* ══════════════════════════════════════════════════════
     CHOICES_CONFIG — elecciones que el jugador debe hacer
     Tipos:
       pick1   → elige 1 opción de una lista
       pickN   → elige N opciones de una lista (como maneuvers)
       asi     → Ability Score Improvement: +2 a 1 stat, o +1/+1, o feat
       pickSkills → elige N skills para proficiencia/expertise
  ══════════════════════════════════════════════════════ */

  const FIGHTING_STYLES_FIGHTER = [
    { id:'fs-archery',         name:'Archery',              desc:'+2 a tiradas de ataque con armas a distancia.' },
    { id:'fs-blind-fighting',  name:'Blind Fighting',       desc:'Visión ciega 3 m. Podés ver criaturas invisibles no ocultas.' },
    { id:'fs-defense',         name:'Defense',              desc:'+1 CA mientras llevás armadura.' },
    { id:'fs-dueling',         name:'Dueling',              desc:'+2 al daño con arma de una mano (sin otra arma).' },
    { id:'fs-great-weapon',    name:'Great Weapon Fighting',desc:'Tirás de nuevo 1s y 2s en dados de daño con armas de dos manos.' },
    { id:'fs-interception',    name:'Interception',         desc:'Reacción: reducís daño a aliado cercano en 1d10+Prof Bonus.' },
    { id:'fs-protection',      name:'Protection',           desc:'Reacción: desventaja al atacante de un aliado a 1,5 m. Requiere escudo.' },
    { id:'fs-superior-technique', name:'Superior Technique',desc:'Aprendés 1 maniobra de BM (1 Superiority Die d6).' },
    { id:'fs-thrown-weapon',   name:'Thrown Weapon Fighting',desc:'+2 al daño con armas arrojadizas.' },
    { id:'fs-two-weapon',      name:'Two-Weapon Fighting',  desc:'Sumás mod de stat al daño del ataque con mano secundaria.' },
    { id:'fs-unarmed',         name:'Unarmed Fighting',     desc:'Ataques sin arma hacen 1d6 (1d8 manos libres). Agarre: 1d4/turno.' },
  ];

  const FIGHTING_STYLES_RANGER = [
    { id:'fs-archery',         name:'Archery',              desc:'+2 a tiradas de ataque con armas a distancia.' },
    { id:'fs-blind-fighting',  name:'Blind Fighting',       desc:'Visión ciega 3 m. Podés ver criaturas invisibles no ocultas.' },
    { id:'fs-defense',         name:'Defense',              desc:'+1 CA mientras llevás armadura.' },
    { id:'fs-druidic-warrior', name:'Druidic Warrior',      desc:'Aprendés 2 cantrips de Druida (SAB). Cuentan como conjuros de Ranger.' },
    { id:'fs-dueling',         name:'Dueling',              desc:'+2 al daño con arma de una mano (sin otra arma).' },
    { id:'fs-thrown-weapon',   name:'Thrown Weapon Fighting',desc:'+2 al daño con armas arrojadizas.' },
    { id:'fs-two-weapon',      name:'Two-Weapon Fighting',  desc:'Sumás mod de stat al daño del ataque con mano secundaria.' },
  ];

  const FAVORED_ENEMIES = [
    'Aberraciones','Bestias','Celestiales','Constructos','Dragones',
    'Elementales','Feéricos','Fiends','Gigantes','Humanoides',
    'Muertos Vivientes','Monstruosidades','Limos','Plantas',
  ];

  const TERRENOS = [
    'Ártico','Costa','Desierto','Bosque','Pradera',
    'Montaña','Pantano','Underdark',
  ];

  const ASI_STATS = ['for','des','con','int','sab','car'];

  const GUERRERO_SUBCLASES = [
    // PHB
    { id:'sub-battle-master',    name:'Battle Master',         desc:'Maniobras de combate con Superiority Dice. Máximo control táctico.' },
    { id:'sub-champion',         name:'Champion',              desc:'Críticos con 19-20, atletismo superior. Simple y poderoso.' },
    { id:'sub-eldritch-knight',  name:'Eldritch Knight',       desc:'Conjuros de Mago (INT) + combate. Slots de tercio-caster.' },
    // Xanathar's
    { id:'sub-arcane-archer',    name:'Arcane Archer',         desc:'Flechas mágicas (Banishing, Grasping, Seeking, Shadow). 2 usos/Short Rest.' },
    { id:'sub-cavalier',         name:'Cavalier',              desc:'Montura y protección de aliados. Unwavering Mark, Born to the Saddle.' },
    { id:'sub-samurai',          name:'Samurai',               desc:'Fighting Spirit 3/día + ventaja en ataques. Elegante y ofensivo.' },
    // Tasha's
    { id:'sub-psi-warrior',      name:'Psi Warrior',           desc:'Psionic Energy Dice (d6→d12), telekinesis, escudo psiónico.' },
    { id:'sub-rune-knight',      name:'Rune Knight',           desc:'Runas mágicas + crecer a tamaño Large. Fuerza bruta mágica.' },
    // 2024 PHB
    { id:'sub-brawler',          name:'Brawler',               desc:'Combate sin armas potenciado: Unarmed Strike d6+, Grapple-and-strike, improvisación.' },
  ];

  const EXPLORADOR_SUBCLASES = [
    // PHB
    { id:'sub-hunter',           name:'Hunter',                desc:'Especialista en matar: presa elegida, multiataques en área.' },
    { id:'sub-beast-master',     name:'Beast Master',          desc:'Compañero bestial (Primal Companion) que combate junto a vos.' },
    // Xanathar's
    { id:'sub-gloom-stalker',    name:'Gloom Stalker',         desc:'Oscuridad y emboscadas. Extra ataque en primera ronda, invisibilidad en oscuridad.' },
    { id:'sub-horizon-walker',   name:'Horizon Walker',        desc:'Detección de portales, daño de fuerza extra, Ethereal Step, teletransporte.' },
    { id:'sub-monster-slayer',   name:'Monster Slayer',        desc:'Hunter\'s Sense, Slayer\'s Prey, Supernatural Defense. Anti-monstruos.' },
    // Tasha's
    { id:'sub-fey-wanderer',     name:'Fey Wanderer',          desc:'Dreadful Strikes (psíquico), Beguiling Twist, Misty Wanderer nv14.' },
    { id:'sub-swarmkeeper',      name:'Swarmkeeper',           desc:'Enjambre de criaturas: daño + empujar + mover. Scattered Form nv11.' },
    // 2024 PHB
    { id:'sub-ranger-2024',      name:'Ranger (2024 genérico)', desc:'Sin subclase específica aún; usa Hunter o Beast Master.' },
  ];

  const PICARO_SUBCLASES = [
    // PHB
    { id:'sub-arcane-trickster', name:'Arcane Trickster',      desc:'Conjuros de Mago (INT). Ilusiones y trucos mágicos.' },
    { id:'sub-thief',            name:'Thief',                 desc:'Escalada, Fast Hands, Use Magic Device. Ladrón clásico.' },
    // Xanathar's
    { id:'sub-inquisitive',      name:'Inquisitive',           desc:'Insightful Fighting (Sneak sin aliados), Steady Eye, Unerring Eye.' },
    { id:'sub-mastermind',       name:'Mastermind',            desc:'Master of Tactics (Help como Bonus Action desde 30 ft), Misdirection.' },
    { id:'sub-scout',            name:'Scout',                 desc:'Skirmisher (mover al ser atacado gratis), Survivalist (Naturaleza+Sigilo).' },
    { id:'sub-swashbuckler',     name:'Swashbuckler',          desc:'Carisma en combate, Sneak Attack sin aliados, Panache, Elegant Maneuver.' },
    // Tasha's
    { id:'sub-phantom',          name:'Phantom',               desc:'Tokens de almas muertas, daño necrótico, forma incorpórea nv17.' },
    { id:'sub-soulknife',        name:'Soulknife',             desc:'Psychic Blades (d6 psíquico sin costo), Psychic Whispers, Soul Blades.' },
  ];

  const BARDO_SUBCLASES = [
    // PHB
    { id:'sub-college-lore',       name:'College of Lore',         desc:'Cutting Words, 2 conjuros extra de cualquier clase, Peerless Skill.' },
    { id:'sub-college-valor',      name:'College of Valor',         desc:'Armadura mediana, Combat Inspiration, Extra Attack nv6, Battle Magic nv14.' },
    // Xanathar's
    { id:'sub-college-glamour',    name:'College of Glamour',       desc:'Mantle of Inspiration, Enthralling Performance, Unbreakable Majesty.' },
    { id:'sub-college-swords',     name:'College of Swords',        desc:'Blade Flourish (Defensive/Slashing/Mobile), Extra Attack, Master\'s Flourish.' },
    { id:'sub-college-whispers',   name:'College of Whispers',      desc:'Psychic Blades, Words of Terror, Mantle of Whispers, Shadow Lore.' },
    // Tasha's
    { id:'sub-college-creation',   name:'College of Creation',      desc:'Mote of Potential, Performance of Creation, Animating Performance.' },
    { id:'sub-college-eloquence',  name:'College of Eloquence',     desc:'Silver Tongue, Unsettling Words, Infectious Inspiration nv14.' },
    // 2024 PHB
    { id:'sub-college-dance',      name:'College of Dance',         desc:'Dazzling Footwork (AC + Bardic Die unarmed), Enthralling Performance mejorado.' },
  ];

  const CLERIGO_SUBCLASES = [
    // PHB
    { id:'sub-life-domain',       name:'Life Domain',          desc:'Curación potenciada, Preserve Life, Divine Strike +1d8, Supreme Healing.' },
    { id:'sub-light-domain',      name:'Light Domain',         desc:'Warding Flare, Radiance of the Dawn, Potent Cantrip nv8, Corona of Light.' },
    { id:'sub-trickery-domain',   name:'Trickery Domain',      desc:'Invoke Duplicity (ilusión), Cloak of Shadows nv6, Divine Strike veneno.' },
    { id:'sub-knowledge-domain',  name:'Knowledge Domain',     desc:'Blessings of Knowledge, Knowledge of the Ages, Read Thoughts, Visions of the Past.' },
    { id:'sub-nature-domain',     name:'Nature Domain',        desc:'Acolyte of Nature, Charm Animals & Plants, Dampen Elements, armadura pesada.' },
    { id:'sub-tempest-domain',    name:'Tempest Domain',       desc:'Wrath of the Storm, Destructive Wrath, Thunderbolt Strike, Stormborn nv17.' },
    { id:'sub-war-domain',        name:'War Domain',           desc:'Armadura pesada, War Priest (ataques bonus), Guided Strike +10, Avatar of Battle.' },
    // Xanathar's
    { id:'sub-arcana-domain',     name:'Arcana Domain',        desc:'Arcane Mastery, Arcane Abjuration, Spell Breaker (desmagia gratis).' },
    { id:'sub-forge-domain',      name:'Forge Domain',         desc:'Artífico de equipo, Blessing of the Forge, Soul of the Forge, Divine Strike fuego.' },
    { id:'sub-grave-domain',      name:'Grave Domain',         desc:'Sentinel at Death\'s Door, Keeper of Souls. Protege a los moribundos.' },
    // Tasha's
    { id:'sub-order-domain',      name:'Order Domain',         desc:'Voice of Authority (aliado ataca gratis), Order\'s Demand, Divine Strike psíquico.' },
    { id:'sub-paz-domain',        name:'Dominio de la Paz',    desc:'Emboldening Bond, Balm of Peace, Protective Bond. El dominio de Lursey.' },
    { id:'sub-twilight-domain',   name:'Twilight Domain',      desc:'Twilight Sanctuary (Temp HP en aura nv2), Steps of Night, vuelo oscuro.' },
    // 2024 PHB
    { id:'sub-death-domain',      name:'Death Domain',         desc:'Reaper cantrip a dos criaturas, Touch of Death, Divine Strike necrótico.' },
  ];

  const DRUIDA_SUBCLASES = [
    // PHB
    { id:'sub-circle-land',      name:'Circle of the Land',    desc:'Natural Recovery, Circle Spells por terreno, Land\'s Stride.' },
    { id:'sub-circle-moon',      name:'Circle of the Moon',    desc:'Wild Shape en combate, cura con slots, elementales nv10.' },
    // Xanathar's
    { id:'sub-circle-dreams',    name:'Circle of Dreams',      desc:'Balm of the Summer Court (curación), Hearth of Moonlight, Hidden Paths.' },
    { id:'sub-circle-shepherd',  name:'Circle of the Shepherd',desc:'Spirit Totem (bonus acción), Mighty Summoner, Guardian Soul.' },
    // Tasha's
    { id:'sub-circle-spores',    name:'Circle of Spores',      desc:'Halo of Spores necrótico, Symbiotic Entity, animar muertos nv6.' },
    { id:'sub-circle-stars',     name:'Circle of Stars',       desc:'Starry Form (Archer/Chalice/Dragon), Cosmic Omen, vuelo nv10.' },
    { id:'sub-circle-wildfire',  name:'Circle of Wildfire',    desc:'Wildfire Spirit convocado, Enhanced Bond, Blazing Revival nv10.' },
    // 2024 PHB
    { id:'sub-circle-sea',       name:'Circle of the Sea',     desc:'Wrath of the Sea (aura de olas), Aquatic Affinity, Stormborn.' },
  ];

  const PALADIN_SUBCLASES = [
    // PHB
    { id:'sub-oath-devotion',    name:'Oath of Devotion',       desc:'Sacred Weapon, Aura of Devotion, Holy Nimbus. El paladín clásico.' },
    { id:'sub-oath-ancients',    name:'Oath of the Ancients',   desc:'Naturaleza y luz: Aura de resistencia a conjuros, Undying Sentinel.' },
    { id:'sub-oath-vengeance',   name:'Oath of Vengeance',      desc:'Caza implacable: Vow of Enmity, ventaja en ataques, Avenging Angel.' },
    // Xanathar's
    { id:'sub-oath-conquest',    name:'Oath of Conquest',       desc:'Conquering Presence (miedo en área), Aura of Conquest, Invincible Conqueror.' },
    { id:'sub-oath-redemption',  name:'Oath of Redemption',     desc:'Emissary of Peace (+5 Persuasión), Soul of Decency, Emissary of Redemption.' },
    // Tasha's
    { id:'sub-oath-glory',       name:'Oath of Glory',          desc:'Heroísmo épico: Inspiring Smite, Aura of Alacrity, Living Legend.' },
    { id:'sub-oath-watchers',    name:'Oath of the Watchers',   desc:'Watcher\'s Will (+CHA a saves), Aura of the Sentinel, Mortal Bulwark.' },
    // 2024 PHB
    { id:'sub-oath-oathbreaker', name:'Oathbreaker',            desc:'Paladín caído: Channel Undead, Aura of Hate, Supernatural Resistance.' },
  ];

  const MONJE_SUBCLASES = [
    // PHB
    { id:'sub-way-open-hand',      name:'Way of the Open Hand',      desc:'Open Hand Technique, Wholeness of Body, Quivering Palm. El Monje clásico.' },
    { id:'sub-way-shadow',         name:'Way of Shadow',             desc:'Teletransporte entre sombras, invisibilidad, ki para hechizos oscuros.' },
    { id:'sub-way-four-elements',  name:'Way of the Four Elements',  desc:'Lanzar hechizos elementales (fuego, agua, tierra, aire) gastando Ki.' },
    // Xanathar's
    { id:'sub-way-drunken-master', name:'Way of the Drunken Master', desc:'Flurry of Blows mejora, Drunkard\'s Luck, Tipsy Sway (evita ataques).' },
    { id:'sub-way-kensei',         name:'Way of the Kensei',         desc:'Armas de Kensei (a distancia o CaC), Sharpen the Blade, Unerring Accuracy.' },
    { id:'sub-way-sun-soul',       name:'Way of the Sun Soul',       desc:'Radiant Sun Bolt (distancia), Searing Arc Strike, Searing Sunburst.' },
    // Tasha's
    { id:'sub-way-astral-self',    name:'Way of the Astral Self',    desc:'Brazos astrales a 3m, rostro astral, forma astral completa nv17.' },
    { id:'sub-way-mercy',          name:'Way of Mercy',              desc:'Máscara, Implements of Mercy (curar/envenenar gratis), Hand of Harm/Healing.' },
    // 2024 PHB
    { id:'sub-way-elements-2024',  name:'Way of the Elements (2024)', desc:'Elemental Attunement: descarga elementos en ataques sin gastar Ki.' },
  ];

  const BARBARO_SUBCLASES = [
    // PHB
    { id:'sub-path-berserker',       name:'Path of the Berserker',       desc:'Frenzy en Rage, Mindless Rage, Intimidating Presence. Destrucción pura.' },
    { id:'sub-path-totem-warrior',   name:'Path of the Totem Warrior',   desc:'Espíritu animal (Oso/Águila/Lobo): resistencia, vuelo o tumbar enemigos.' },
    // Xanathar's
    { id:'sub-path-ancestral',       name:'Path of the Ancestral Guardian', desc:'Ancestral Protectors (desventaja en aliados), Spirit Shield, Vengeful Ancestors.' },
    { id:'sub-path-storm-herald',    name:'Path of the Storm Herald',    desc:'Aura elemental (Desierto/Mar/Tundra), tormenta de energía en Rage.' },
    { id:'sub-path-zealot',          name:'Path of the Zealot',          desc:'Daño divino extra, no morís en Rage, Zealous Presence para aliados.' },
    // Tasha's
    { id:'sub-path-beast',           name:'Path of the Beast',           desc:'Transformación: garras/mordisco/cola. Bestial Soul, Call the Hunt.' },
    { id:'sub-path-wild-magic',      name:'Path of Wild Magic',          desc:'Wild Surge al ragear, efectos mágicos aleatorios, Bolstering Magic.' },
    // 2024 PHB
    { id:'sub-path-world-tree',      name:'Path of the World Tree',      desc:'Vitality of the Tree (Temp HP), Branches of the Tree, Travel Along the Tree.' },
  ];

  const HECHICERO_SUBCLASES = [
    // PHB
    { id:'sub-draconic-bloodline',   name:'Draconic Bloodline',          desc:'Origen dracónico: AC natural, resistencia elemental, alas nv14.' },
    { id:'sub-wild-magic',           name:'Wild Magic',                  desc:'Magia impredecible: Wild Surge, Tides of Chaos, Bend Luck.' },
    // Xanathar's
    { id:'sub-divine-soul',          name:'Divine Soul',                 desc:'Conjuros de Clérigo, Favored by the Gods (+2d4 a tiradas), Otherworldly Wings.' },
    { id:'sub-shadow-magic',         name:'Shadow Magic',                desc:'Eyes of the Dark (Darkness gratis), Strength of the Grave, Hound of Ill Omen.' },
    { id:'sub-storm-sorcery',        name:'Storm Sorcery',               desc:'Viento y trueno: movimiento volador, daño de rayo extra, Heart of the Storm.' },
    // Tasha's
    { id:'sub-aberrant-mind',        name:'Aberrant Mind',               desc:'Psionic Spells (telepathic), Telepathic Speech, Warping Implosion. Mente aberrante.' },
    { id:'sub-clockwork-soul',       name:'Clockwork Soul',              desc:'Clockwork Spells, Restore Balance, Bulwark of Law, Trance of Order.' },
    // 2024 PHB
    { id:'sub-lunar-sorcery',        name:'Lunar Sorcery',               desc:'Lunar Embodiment (conjuros lunares), Moon Fire, Waxing and Waning.' },
  ];

  const MAGO_SUBCLASES = [
    // PHB
    { id:'sub-school-abjuration',    name:'School of Abjuration',        desc:'Arcane Ward absorbe daño. El mago más resistente.' },
    { id:'sub-school-conjuration',   name:'School of Conjuration',       desc:'Minor Conjuration (objeto), Benign Transposition, Focused Conjuration.' },
    { id:'sub-school-divination',    name:'School of Divination',        desc:'Portent: tira 2d20 al reposar y usa los resultados cuando quieras.' },
    { id:'sub-school-enchantment',   name:'School of Enchantment',       desc:'Hypnotic Gaze, Instinctive Charm, Split Enchantment, Alter Memories.' },
    { id:'sub-school-evocation',     name:'School of Evocation',         desc:'Sculpt Spells, Potent Cantrip, Overchannel. Rey del daño.' },
    { id:'sub-school-illusion',      name:'School of Illusion',          desc:'Improved Minor Illusion, Malleable Illusions, Illusory Self, Illusory Reality.' },
    { id:'sub-school-necromancy',    name:'School of Necromancy',        desc:'Undead Thralls, Inured to Undeath, Command Undead nv14.' },
    { id:'sub-school-transmutation', name:'School of Transmutation',     desc:'Minor Alchemy, Transmuter\'s Stone, Shapechanger, Master Transmuter.' },
    // Xanathar's
    { id:'sub-bladesinging',         name:'Bladesinging',                desc:'Bladesong (INT a AC+concentración, vel+10), Extra Attack nv6, Song of Defense.' },
    { id:'sub-war-magic',            name:'War Magic',                   desc:'Arcane Deflection, Tactical Wit (+INT a iniciativa), Durable Magic nv14.' },
    // Tasha's
    { id:'sub-order-of-scribes',     name:'Order of Scribes',            desc:'Wizardly Quill, Awakened Spellbook (swap damage type), Manifest Mind, Master Scrivener.' },
    // 2024 PHB
    { id:'sub-school-evoker-2024',   name:'Evoker (2024)',               desc:'Potent Cantrip mejorado, Sculpt Spells en área, Overchannel sin coste nv14.' },
  ];

  const BRUJO_SUBCLASES = [
    // PHB
    { id:'sub-the-fiend',            name:'The Fiend',                   desc:'Temp HP al matar, resistencias del averno, Hurl Through Hell.' },
    { id:'sub-the-great-old-one',    name:'The Great Old One',           desc:'Telepatía, Entropic Ward, Thought Shield, Create Thrall.' },
    { id:'sub-the-archfey',          name:'The Archfey',                 desc:'Fey Presence, teletransporte de niebla, Beguiling Defenses.' },
    // Xanathar's
    { id:'sub-the-hexblade',         name:'The Hexblade',                desc:'Hexblade\'s Curse (+PB a golpes), Hex Warrior (CAR en armas), Accursed Specter.' },
    { id:'sub-the-celestial',        name:'The Celestial',               desc:'Healing Light (pool de d6), Radiant Soul, Celestial Resilience, Searing Vengeance.' },
    // Tasha's
    { id:'sub-the-fathomless',       name:'The Fathomless',              desc:'Tentacle of the Deeps (3m, 1d8 frío), Gift of the Sea, Fathomless Plunge.' },
    { id:'sub-the-genie',            name:'The Genie',                   desc:'Genie\'s Vessel (Bottle Respite), Elemental Gift, Sanctuary Vessel, Limited Wish.' },
    // 2024 PHB
    { id:'sub-the-undead',           name:'The Undead',                  desc:'Form of Dread (Temp HP + miedo), Grave Touched, Necrotic Husk, Spirit Projection.' },
  ];

  // ── PRIMAL COMPANION BEASTS (Beast Master Ranger · D&D 2024) ─────────────────
  // Estadísticas base; AC y HP escalan con nivel del Explorador (nivel = nivel de clase Ranger)
  // AC = 13 + PB(nivel)
  // HP Land/Sea = 5 + 5*nivel
  // HP Sky = 4 + 4*nivel
  // Ataque: modificador(stat)+PB como bonus, daño incluye PB
  const PRIMAL_COMPANION_BEASTS = {
    land: {
      id: 'land',
      name: 'Beast of the Land',
      emoji: '🐾',
      description: 'Feroz depredador terrestre (lobo, oso, jaguar…) diseñado para combate cuerpo a cuerpo.',
      size: 'Mediana',
      type: 'Bestia',
      speed: '40 ft · Trepa 40 ft',
      stats: { for:14, des:14, con:15, int:8, sab:14, car:11 },
      calcAC: (nivel) => 13 + calcProfBonus(nivel),
      calcHP: (nivel) => 5 + 5 * nivel,
      calcMaxHP: (nivel) => 5 + 5 * nivel,
      senses: 'Percepción pasiva 14',
      languages: 'Entiende los idiomas de su Ranger pero no habla',
      attacks: [
        {
          name: 'Maul',
          type: 'melee',
          // bonus to hit = WIS mod + PB (se calcula dinámicamente)
          damageDie: '1d8',
          damageBonus: 2,  // +2 fijo, más PB se suma dinámicamente
          damageType: 'perforante o cortante',
          desc: 'Ataque de arma cuerpo a cuerpo: bono de golpe = SABmod + PB. Daño: 1d8 + 2 + PB.',
        }
      ],
      traits: [
        {
          name: 'Charge',
          desc: 'Si se mueve al menos 6 m en línea recta hacia un objetivo y lo golpea, el objetivo debe superar un save de FUE (CD = 8+PB+SAB mod) o quedar tumbado. Si cae, la bestia puede hacer un ataque adicional de bonificación.',
        },
        {
          name: 'Primal Bond',
          desc: 'Agrega el Bono de Competencia del Ranger a tiradas de ataque, daño, checks de habilidad y tiradas de salvación. Actúa en la iniciativa del Ranger.',
        },
      ],
      cr: '—',
    },
    sea: {
      id: 'sea',
      name: 'Beast of the Sea',
      emoji: '🦑',
      description: 'Criatura acuática (tiburón, calamar, serpiente marina…) ideal en ríos, mares y pantanos.',
      size: 'Mediana',
      type: 'Bestia',
      speed: '5 ft · Nada 60 ft',
      stats: { for:14, des:14, con:15, int:8, sab:14, car:11 },
      calcAC: (nivel) => 13 + calcProfBonus(nivel),
      calcHP: (nivel) => 5 + 5 * nivel,
      calcMaxHP: (nivel) => 5 + 5 * nivel,
      senses: 'Percepción pasiva 14',
      languages: 'Entiende los idiomas de su Ranger pero no habla',
      attacks: [
        {
          name: 'Binding Strike',
          type: 'melee',
          damageDie: '1d6',
          damageBonus: 2,
          damageType: 'contundente o perforante',
          desc: 'Ataque de arma cuerpo a cuerpo: bono de golpe = SABmod + PB. Daño: 1d6 + 2 + PB. El objetivo queda agarrado (Escape CD = 8+PB+SABmod). Mientras esté agarrado puede repetir el ataque automáticamente.',
        }
      ],
      traits: [
        {
          name: 'Amphibious',
          desc: 'Puede respirar tanto aire como agua.',
        },
        {
          name: 'Primal Bond',
          desc: 'Agrega el Bono de Competencia del Ranger a tiradas de ataque, daño, checks de habilidad y tiradas de salvación. Actúa en la iniciativa del Ranger.',
        },
      ],
      cr: '—',
    },
    sky: {
      id: 'sky',
      name: 'Beast of the Sky',
      emoji: '🦅',
      description: 'Criatura aérea (águila, búho, halcón gigante…) de reconocimiento y ataques en picado.',
      size: 'Pequeña',
      type: 'Bestia',
      speed: '10 ft · Vuela 60 ft',
      stats: { for:6, des:16, con:13, int:8, sab:14, car:11 },
      calcAC: (nivel) => 13 + calcProfBonus(nivel),
      calcHP: (nivel) => 4 + 4 * nivel,
      calcMaxHP: (nivel) => 4 + 4 * nivel,
      senses: 'Percepción pasiva 14',
      languages: 'Entiende los idiomas de su Ranger pero no habla',
      attacks: [
        {
          name: 'Shred',
          type: 'melee',
          damageDie: '1d4',
          damageBonus: 3,  // DEX mod base (+3 DES=16)
          damageType: 'cortante',
          desc: 'Ataque de arma cuerpo a cuerpo: bono de golpe = SABmod + PB. Daño: 1d4 + 3 + PB.',
        }
      ],
      traits: [
        {
          name: 'Flyby',
          desc: 'No provoca ataques de oportunidad cuando vuela fuera del alcance de cuerpo a cuerpo de un enemigo.',
        },
        {
          name: 'Primal Bond',
          desc: 'Agrega el Bono de Competencia del Ranger a tiradas de ataque, daño, checks de habilidad y tiradas de salvación. Actúa en la iniciativa del Ranger.',
        },
      ],
      cr: '—',
    },
  };

  // ── METAMAGIC_OPTIONS: opciones de Metamagia para el Hechicero ───────────
  const METAMAGIC_OPTIONS = [
    { id:'mm-careful',     name:'Careful Spell',     desc:'Gastas 1 Sorcery Point. Criaturas elegidas automáticamente superan el save del hechizo.' },
    { id:'mm-distant',     name:'Distant Spell',      desc:'Gastas 1 SP. Duplica el alcance del hechizo (de toque → 9 m).' },
    { id:'mm-empowered',   name:'Empowered Spell',   desc:'Gastas 1 SP. Puedes relanzar hasta CHA dados de daño del hechizo; debés usar los nuevos resultados.' },
    { id:'mm-extended',    name:'Extended Spell',     desc:'Gastas 1 SP. Duplica la duración del hechizo (máximo 24 h).' },
    { id:'mm-heightened',  name:'Heightened Spell',  desc:'Gastas 3 SP. Un objetivo del hechizo tiene desventaja en su primera tirada de salvación.' },
    { id:'mm-quickened',   name:'Quickened Spell',   desc:'Gastas 2 SP. Cambia el tiempo de lanzamiento de Acción a Acción Bonus.' },
    { id:'mm-seeking',     name:'Seeking Spell',      desc:'Gastas 2 SP. Si fallás un ataque de hechizo, podés relanzar el dado de ataque una vez.' },
    { id:'mm-subtle',      name:'Subtle Spell',       desc:'Gastas 1 SP. El hechizo no requiere componentes verbales ni somáticos.' },
    { id:'mm-transmuted',  name:'Transmuted Spell',  desc:'Gastas 1 SP. Cambia el tipo de daño del hechizo (ácido, frío, fuego, relámpago, veneno, trueno).' },
    { id:'mm-twinned',     name:'Twinned Spell',      desc:'Gastas SP igual al nivel del hechizo (mín 1). Afecta a un segundo objetivo que no estaba en el rango original.' },
  ];

  const CHOICES_CONFIG = {
    'Guerrero': [
      { id:'fighting-style',  level:1,  type:'pick1',     label:'Fighting Style',
        prompt:'Elegí tu estilo de combate:',
        options: FIGHTING_STYLES_FIGHTER },
      { id:'subclase-3',      level:3,  type:'pick1',     label:'Martial Archetype (Subclase)',
        prompt:'Elegí tu arquetipo marcial:',
        options: GUERRERO_SUBCLASES,
        appliesSubclass: true },
      { id:'asi-4',           level:4,  type:'asi',       label:'Ability Score Improvement' },
      { id:'asi-6',           level:6,  type:'asi',       label:'Ability Score Improvement' },
      { id:'asi-8',           level:8,  type:'asi',       label:'Ability Score Improvement' },
      { id:'asi-12',          level:12, type:'asi',       label:'Ability Score Improvement' },
      { id:'asi-14',          level:14, type:'asi',       label:'Ability Score Improvement' },
      { id:'asi-16',          level:16, type:'asi',       label:'Ability Score Improvement' },
      { id:'asi-19',          level:19, type:'asi',       label:'Ability Score Improvement' },
      { id:'fighting-style-2',level:10, type:'pick1',     label:'Fighting Style adicional',
        prompt:'Elegí un segundo estilo de combate:',
        options: FIGHTING_STYLES_FIGHTER },
    ],
    'Explorador': [
      // D&D 2024: sin Favored Enemy ni Natural Explorer como elecciones.
      // El Explorador tiene Expertise en nivel 2 y Fighting Style en nivel 2.
      { id:'expertise-1',     level:2,  type:'pickSkills', count:2, label:'Expertise (×2)',
        prompt:'Elegí 2 habilidades para tener Expertise (doble Prof Bonus):' },
      { id:'fighting-style-r', level:2, type:'pick1',     label:'Fighting Style',
        prompt:'Elegí tu estilo de combate:',
        options: FIGHTING_STYLES_RANGER },
      { id:'subclase-3',      level:3,  type:'pick1',     label:'Ranger Conclave (Subclase)',
        prompt:'Elegí tu conclave de Explorador:',
        options: EXPLORADOR_SUBCLASES,
        appliesSubclass: true },
      { id:'asi-4',           level:4,  type:'asi',       label:'Ability Score Improvement' },
      { id:'asi-8',           level:8,  type:'asi',       label:'Ability Score Improvement' },
      { id:'asi-12',          level:12, type:'asi',       label:'Ability Score Improvement' },
      { id:'asi-16',          level:16, type:'asi',       label:'Ability Score Improvement' },
      { id:'asi-19',          level:19, type:'asi',       label:'Ability Score Improvement' },
    ],
    'Bárbaro': [
      { id:'subclase-3', level:3, type:'pick1', label:'Primal Path (Subclase)',
        prompt:'Elegí tu camino primordial:',
        options: BARBARO_SUBCLASES,
        appliesSubclass: true },
      { id:'asi-4',  level:4,  type:'asi', label:'Ability Score Improvement' },
      { id:'asi-8',  level:8,  type:'asi', label:'Ability Score Improvement' },
      { id:'asi-12', level:12, type:'asi', label:'Ability Score Improvement' },
      { id:'asi-16', level:16, type:'asi', label:'Ability Score Improvement' },
      { id:'asi-19', level:19, type:'asi', label:'Ability Score Improvement' },
    ],
    'Bardo': [
      { id:'subclase-3', level:3, type:'pick1', label:'Bard College (Subclase)',
        prompt:'Elegí tu colegio de bardo:',
        options: BARDO_SUBCLASES,
        appliesSubclass: true },
      { id:'expertise-3', level:3, type:'pickSkills', count:2, label:'Expertise (×2)',
        prompt:'Elegí 2 skills para tener Expertise (doble Prof Bonus):' },
      { id:'asi-4',  level:4,  type:'asi', label:'Ability Score Improvement' },
      { id:'asi-8',  level:8,  type:'asi', label:'Ability Score Improvement' },
      { id:'asi-12', level:12, type:'asi', label:'Ability Score Improvement' },
      { id:'asi-16', level:16, type:'asi', label:'Ability Score Improvement' },
      { id:'asi-19', level:19, type:'asi', label:'Ability Score Improvement' },
    ],
    'Clérigo': [
      { id:'subclase-1', level:1, type:'pick1', label:'Divine Domain (Subclase)',
        prompt:'Elegí tu dominio divino:',
        options: CLERIGO_SUBCLASES,
        appliesSubclass: true },
      { id:'asi-4',  level:4,  type:'asi', label:'Ability Score Improvement' },
      { id:'asi-8',  level:8,  type:'asi', label:'Ability Score Improvement' },
      { id:'asi-12', level:12, type:'asi', label:'Ability Score Improvement' },
      { id:'asi-16', level:16, type:'asi', label:'Ability Score Improvement' },
      { id:'asi-19', level:19, type:'asi', label:'Ability Score Improvement' },
    ],
    'Druida': [
      { id:'subclase-2', level:2, type:'pick1', label:'Druid Circle (Subclase)',
        prompt:'Elegí tu círculo druídico:',
        options: DRUIDA_SUBCLASES,
        appliesSubclass: true },
      { id:'asi-4',  level:4,  type:'asi', label:'Ability Score Improvement' },
      { id:'asi-8',  level:8,  type:'asi', label:'Ability Score Improvement' },
      { id:'asi-12', level:12, type:'asi', label:'Ability Score Improvement' },
      { id:'asi-16', level:16, type:'asi', label:'Ability Score Improvement' },
      { id:'asi-19', level:19, type:'asi', label:'Ability Score Improvement' },
    ],
    'Hechicero': [
      { id:'subclase-1', level:1, type:'pick1', label:'Sorcerous Origin (Subclase)',
        prompt:'Elegí tu origen arcano:',
        options: HECHICERO_SUBCLASES,
        appliesSubclass: true },
      { id:'metamagic-3',  level:3,  type:'pickMultiple', count:2, label:'Metamagic (elegí 2)',
        prompt:'Elegí 2 opciones de Metamagia. Aparecerán en tus Habilidades:',
        options: METAMAGIC_OPTIONS },
      { id:'asi-4',  level:4,  type:'asi', label:'Ability Score Improvement' },
      { id:'asi-8',  level:8,  type:'asi', label:'Ability Score Improvement' },
      { id:'metamagic-10', level:10, type:'pickMultiple', count:2, label:'Metamagic (+2 opciones)',
        prompt:'Elegí 2 opciones adicionales de Metamagia:',
        options: METAMAGIC_OPTIONS },
      { id:'asi-12', level:12, type:'asi', label:'Ability Score Improvement' },
      { id:'asi-16', level:16, type:'asi', label:'Ability Score Improvement' },
      { id:'metamagic-17', level:17, type:'pickMultiple', count:2, label:'Metamagic (+2 opciones)',
        prompt:'Elegí 2 opciones adicionales de Metamagia:',
        options: METAMAGIC_OPTIONS },
      { id:'asi-19', level:19, type:'asi', label:'Ability Score Improvement' },
    ],
    'Mago': [
      { id:'subclase-2', level:2, type:'pick1', label:'Arcane Tradition (Subclase)',
        prompt:'Elegí tu tradición arcana:',
        options: MAGO_SUBCLASES,
        appliesSubclass: true },
      { id:'asi-4',  level:4,  type:'asi', label:'Ability Score Improvement' },
      { id:'asi-8',  level:8,  type:'asi', label:'Ability Score Improvement' },
      { id:'asi-12', level:12, type:'asi', label:'Ability Score Improvement' },
      { id:'asi-16', level:16, type:'asi', label:'Ability Score Improvement' },
      { id:'asi-19', level:19, type:'asi', label:'Ability Score Improvement' },
    ],
    'Monje': [
      { id:'subclase-3', level:3, type:'pick1', label:'Monastic Tradition (Subclase)',
        prompt:'Elegí tu tradición monástica:',
        options: MONJE_SUBCLASES,
        appliesSubclass: true },
      { id:'asi-4',  level:4,  type:'asi', label:'Ability Score Improvement' },
      { id:'asi-8',  level:8,  type:'asi', label:'Ability Score Improvement' },
      { id:'asi-12', level:12, type:'asi', label:'Ability Score Improvement' },
      { id:'asi-16', level:16, type:'asi', label:'Ability Score Improvement' },
      { id:'asi-19', level:19, type:'asi', label:'Ability Score Improvement' },
    ],
    'Paladín': [
      { id:'fighting-style', level:2, type:'pick1', label:'Fighting Style',
        prompt:'Elegí tu estilo de combate:',
        options: FIGHTING_STYLES_FIGHTER.filter(f =>
          ['fs-defense','fs-dueling','fs-great-weapon','fs-protection','fs-blind-fighting','fs-interception'].includes(f.id)
        )},
      { id:'subclase-3', level:3, type:'pick1', label:'Sacred Oath (Subclase)',
        prompt:'Elegí tu juramento sagrado:',
        options: PALADIN_SUBCLASES,
        appliesSubclass: true },
      { id:'asi-4',  level:4,  type:'asi', label:'Ability Score Improvement' },
      { id:'asi-8',  level:8,  type:'asi', label:'Ability Score Improvement' },
      { id:'asi-12', level:12, type:'asi', label:'Ability Score Improvement' },
      { id:'asi-16', level:16, type:'asi', label:'Ability Score Improvement' },
      { id:'asi-19', level:19, type:'asi', label:'Ability Score Improvement' },
    ],
    'Pícaro': [
      { id:'expertise-1', level:1, type:'pickSkills', count:2, label:'Expertise inicial (×2)',
        prompt:'Elegí 2 skills para tener Expertise:' },
      { id:'subclase-3',  level:3, type:'pick1',       label:'Roguish Archetype (Subclase)',
        prompt:'Elegí tu arquetipo de Pícaro:',
        options: PICARO_SUBCLASES,
        appliesSubclass: true },
      { id:'expertise-6', level:6, type:'pickSkills', count:2, label:'Expertise adicional (×2)',
        prompt:'Elegí 2 skills más para Expertise:' },
      { id:'asi-4',  level:4,  type:'asi', label:'Ability Score Improvement' },
      { id:'asi-8',  level:8,  type:'asi', label:'Ability Score Improvement' },
      { id:'asi-10', level:10, type:'asi', label:'Ability Score Improvement' },
      { id:'asi-12', level:12, type:'asi', label:'Ability Score Improvement' },
      { id:'asi-16', level:16, type:'asi', label:'Ability Score Improvement' },
      { id:'asi-19', level:19, type:'asi', label:'Ability Score Improvement' },
    ],
    'Brujo': [
      { id:'subclase-1', level:1, type:'pick1', label:'Otherworldly Patron (Subclase)',
        prompt:'Elegí tu patrón sobrenatural:',
        options: BRUJO_SUBCLASES,
        appliesSubclass: true },
      { id:'asi-4',  level:4,  type:'asi', label:'Ability Score Improvement' },
      { id:'asi-8',  level:8,  type:'asi', label:'Ability Score Improvement' },
      { id:'asi-12', level:12, type:'asi', label:'Ability Score Improvement' },
      { id:'asi-16', level:16, type:'asi', label:'Ability Score Improvement' },
      { id:'asi-19', level:19, type:'asi', label:'Ability Score Improvement' },
    ],
  };

  // Devuelve las elecciones pendientes para un char dado un nivel objetivo
  function getPendingChoices(char, targetLevel) {
    const claseCfg = CHOICES_CONFIG[char.clase] || [];
    const existing = char.choices || {};
    return claseCfg.filter(c => c.level <= targetLevel && !existing[c.id]);
  }

  // Aplica una elección al char object
  function applyChoice(char, choiceId, value) {
    if (!char.choices) char.choices = {};
    char.choices[choiceId] = value;

    // Si es ASI, aplicar al stat directamente (máximo 20) o agregar feat
    if (choiceId.startsWith('asi-')) {
      if (value.mode === 'single' && value.stat) {
        char.stats[value.stat] = Math.min(20, (char.stats[value.stat] || 10) + 2);
      } else if (value.mode === 'split' && value.stat1 && value.stat2) {
        char.stats[value.stat1] = Math.min(20, (char.stats[value.stat1] || 10) + 1);
        char.stats[value.stat2] = Math.min(20, (char.stats[value.stat2] || 10) + 1);
      } else if (value.mode === 'feat' && value.featId) {
        // Buscar el feat en el catálogo general
        const featDef = GENERAL_FEATS.find(f => f.id === value.featId);
        if (featDef) {
          const source = `Feat · Nivel ${choiceId.replace('asi-', '')}`;
          const feature = {
            id:       value.featId + '-' + choiceId,
            name:     featDef.name,
            source,
            type:     'passive',
            action:   'Pasiva',
            range:    'Personal',
            recharge: null,
            desc:     featDef.desc,
            fullDesc: featDef.fullDesc || '',
          };
          if (!char.features) char.features = [];
          // Evitar duplicados
          if (!char.features.find(f => f.id === feature.id)) {
            char.features.push(feature);
          }
        }
      }
    }

    // Si es expertise, aplicar a skillExpertise
    if (choiceId.startsWith('expertise-') && Array.isArray(value)) {
      if (!char.skillExpertise) char.skillExpertise = [];
      value.forEach(s => {
        if (!char.skillExpertise.includes(s)) char.skillExpertise.push(s);
      });
    }

    // Si es metamagia (pickMultiple con ids de METAMAGIC_OPTIONS), agregar features
    if (choiceId.startsWith('metamagic-') && Array.isArray(value)) {
      const levelNum = choiceId.replace('metamagic-', '');
      if (!char.features) char.features = [];
      value.forEach(mmId => {
        const mmDef = METAMAGIC_OPTIONS.find(m => m.id === mmId);
        if (!mmDef) return;
        const fId = mmId + '-' + choiceId;
        if (!char.features.find(f => f.id === fId)) {
          char.features.push({
            id:       fId,
            name:     mmDef.name,
            source:   `Metamagia · Nivel ${levelNum}`,
            type:     'passive',
            action:   'Pasiva',
            range:    'Personal',
            recharge: null,
            desc:     mmDef.desc,
            fullDesc: mmDef.desc,
          });
        }
      });
    }

    // Si aplica subclase (choice de tipo pick1 con appliesSubclass:true)
    // value es el id del option elegido (ej: 'sub-battle-master')
    // Buscamos el nombre real en las listas de subclases
    const claseCfg = CHOICES_CONFIG[char.clase] || [];
    const choiceDef = claseCfg.find(c => c.id === choiceId);
    if (choiceDef && choiceDef.appliesSubclass && typeof value === 'string') {
      const allSubclaseLists = [GUERRERO_SUBCLASES, EXPLORADOR_SUBCLASES, PICARO_SUBCLASES, HECHICERO_SUBCLASES, MAGO_SUBCLASES, BRUJO_SUBCLASES, BARBARO_SUBCLASES, MONJE_SUBCLASES, PALADIN_SUBCLASES, BARDO_SUBCLASES, CLERIGO_SUBCLASES, DRUIDA_SUBCLASES];
      let subclaseName = null;
      for (const list of allSubclaseLists) {
        const found = list.find(s => s.id === value || s.name === value);
        if (found) { subclaseName = found.name; break; }
      }
      if (!subclaseName) subclaseName = value; // fallback: usar el valor directo
      applySubclase(char, subclaseName);
    }

    return char;
  }

  /* ── CATÁLOGO DE ARMADURAS D&D 5e / 2024 ── */

  const ARMOR_CATALOG = [
    // Ligera
    { id:'padded',     name:'Acolchada',       type:'light',  base_ca:11, add_dex:true,  max_dex:null, stealth_dis:true,  emoji:'🧥' },
    { id:'leather',    name:'Cuero',            type:'light',  base_ca:11, add_dex:true,  max_dex:null, stealth_dis:false, emoji:'🧥' },
    { id:'studded',    name:'Cuero Tachonado',  type:'light',  base_ca:12, add_dex:true,  max_dex:null, stealth_dis:false, emoji:'🧥' },
    // Media
    { id:'hide',       name:'Pieles',           type:'medium', base_ca:12, add_dex:true,  max_dex:2,    stealth_dis:false, emoji:'🛡' },
    { id:'chainshirt', name:'Cota de Malla',    type:'medium', base_ca:13, add_dex:true,  max_dex:2,    stealth_dis:false, emoji:'🛡' },
    { id:'scalemail',  name:'Armadura de Escamas', type:'medium', base_ca:14, add_dex:true, max_dex:2,  stealth_dis:true,  emoji:'🛡' },
    { id:'breastplate',name:'Coraza',           type:'medium', base_ca:14, add_dex:true,  max_dex:2,    stealth_dis:false, emoji:'🛡' },
    { id:'halfplate',  name:'Media Armadura de Placas', type:'medium', base_ca:15, add_dex:true, max_dex:2, stealth_dis:true, emoji:'🛡' },
    // Pesada
    { id:'ringmail',   name:'Cota de Anillas',  type:'heavy',  base_ca:14, add_dex:false, max_dex:0,    stealth_dis:true,  emoji:'⚔️' },
    { id:'chainmail',  name:'Cota de Cota',     type:'heavy',  base_ca:16, add_dex:false, max_dex:0,    stealth_dis:true,  emoji:'⚔️' },
    { id:'splint',     name:'Armadura de Láminas', type:'heavy', base_ca:17, add_dex:false, max_dex:0,  stealth_dis:true,  emoji:'⚔️' },
    { id:'platemail',  name:'Armadura de Placas', type:'heavy', base_ca:18, add_dex:false, max_dex:0,   stealth_dis:true,  emoji:'⚔️' },
    // Sin armadura / especial
    { id:'none',       name:'Sin Armadura',     type:'none',   base_ca:10, add_dex:true,  max_dex:null, stealth_dis:false, emoji:'👕' },
    { id:'custom',     name:'Personalizada',    type:'custom', base_ca:10, add_dex:true,  max_dex:null, stealth_dis:false, emoji:'✏️' },
  ];

  /* ── EXPORTS PÚBLICOS ── */

  return {
    PROF_BONUS,
    XP_THRESHOLDS,
    CLASES_CONFIG,
    CLASE_FEATURES,
    CLASE_SPELLS,
    SUBCLASES_CONFIG,
    CHOICES_CONFIG,
    RAZAS_CONFIG,
    TRASFONDOS_CONFIG,
    SKILLS_DEF,
    STAT_NAMES,
    LURSEY_IFTTT,
    PRIMAL_COMPANION_BEASTS,
    ARMOR_CATALOG,
    GENERAL_FEATS,
    METAMAGIC_OPTIONS,
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
    getCantripsKnown,
    isKnownCaster,
    getXPForLevel,
    getNextLevelXP,
    getLevelFromXP,
    createNew,
    buildDefaultChar,
    getPendingChoices,
    applyChoice,
    applyRaza,
    applyTrasfondo,
    applySubraza,
    applySubclase,
    buildLursey,
    applyLevelUp,
  };
})();
