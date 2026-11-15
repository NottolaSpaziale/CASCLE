// Configurazione centrale: tutti i numeri e i testi del gioco in un unico posto
// Fonte: docs/CASCLE_Full_Game_Documentation.md + docs/piano-tecnico.md

export const CONFIG = {
  // --- Tempo (§3) ---
  time: {
    tickMs: 100,                 // passo fisso della simulazione
    secondsPerSolAt1x: 300,      // 1 Sol = 5 minuti reali a 1x
    speeds: [1, 2, 4, 10],       // 300 / 150 / 75 / 30 s per Sol
    maxFrameSeconds: 0.5,        // limite di recupero se il frame arriva in ritardo
  },

  // --- Missione (§7.1, §9.1) ---
  mission: {
    startSol: 1,
    nightStartSol: 14,           // primo Sol di notte lunare
    nightEndSol: 28,             // i pannelli tornano al Sol 28
    winSol: 28,                  // vittoria all'inizio del Sol 28 con power > 0
  },

  // --- Risorse iniziali (§4.1) ---
  resources: {
    power: 1000,
    powerMax: 1000,
    oxygen: 100,
    co2: 0.08,
    water: 100,
    shield: 100,
    plantHealth: 100,
    solarOutputDay: 100,         // units per Sol durante il giorno
    solarOutputNight: 0,
  },

  // --- Variazioni giornaliere (units o % per Sol), dipendono dal livello del sistema ---
  // Valori calibrati sugli screenshot Figma (O2 84,5 % e H2O 79,7 % al Sol 14 in ECO)
  rates: {
    oxygenPerSol:   { OFF: -10,  ECO: -1.2, MAX: -0.6 },   // da Life Support
    co2PerSol:      { OFF: 0.3,  ECO: 0,    MAX: -0.01 },  // da Life Support
    co2Min: 0.04,
    waterPerSol:    { OFF: -8,   ECO: -1.5, MAX: -0.8 },   // da Water Recycling
    shieldPerSol:   { OFF: -5,   ECO: 0,    MAX: 0 },      // da Radiation Shield
    plantPerSol:    { OFF: -10,  ECO: 0,    MAX: 0 },      // da Hydroponic Greenhouse
    // Dati informativi (§4.2)
    oxygenPerHourPct: 0.14,
    waterLitresPerDay: 15.2,
    crewOxygenKgPerDay: 3.32,
    waterRecycledPct: 98,
  },

  // --- Tabella power (§8.2): units per Sol ---
  powerLevels: ['OFF', 'ECO', 'MAX'],
  powerSystems: [
    { id: 'lifeSupport',     name: 'Life Support System',        group: 'crewSafety', ECO: 15, MAX: 30, minLevel: 'ECO' },
    { id: 'warmth',          name: 'Warmth',                     group: 'crewSafety', ECO: 7,  MAX: 15, minLevel: 'ECO' },
    { id: 'waterRecycling',  name: 'Water Recycling',            group: 'crewSafety', ECO: 5,  MAX: 10, minLevel: 'ECO' },
    { id: 'communications',  name: 'Communications',             group: 'crewSafety', ECO: 2,  MAX: 4,  minLevel: 'ECO' },
    { id: 'radiationShield', name: 'Radiation Shield',           group: 'crewSafety', ECO: 5,  MAX: 10, minLevel: 'ECO' },
    { id: 'greenhouse',      name: 'Hydroponic greenhouse',      group: 'baseRooms',  ECO: 10, MAX: 20 },
    { id: 'labs',            name: 'Labs',                       group: 'baseRooms',  ECO: 3,  MAX: 5 },
    { id: 'medical',         name: 'Medical bay',                group: 'baseRooms',  ECO: 2,  MAX: 4 },
    { id: 'gym',             name: 'Gym',                        group: 'baseRooms',  ECO: 1,  MAX: 3 },
    { id: 'galley',          name: 'Galley and kitchen',         group: 'baseRooms',  ECO: 2,  MAX: 4 },
    { id: 'cabins',          name: 'Crew cabins',                group: 'baseRooms',  ECO: 2,  MAX: 4 },
    { id: 'bunker',          name: 'Bunker and Airlock',         group: 'baseRooms',  ECO: 1,  MAX: 1,  fixed: 'ECO' },
    { id: 'restroom',        name: 'Restroom and cleaning',      group: 'baseRooms',  ECO: 1,  MAX: 2 },
  ],
  powerTotals: { ECO: 56, MAX: 112 },
  defaultPowerLevel: 'ECO',

  // --- Stanze della mappa (ui-spec "Mappa base") ---
  rooms: [
    { id: 'lifeSupport', name: 'Life Support System' },
    { id: 'cabin1',      name: 'Cabin 1' },
    { id: 'cabin2',      name: 'Cabin 2' },
    { id: 'galley',      name: 'Galley and kitchen' },
    { id: 'medical',     name: 'Medical bay' },
    { id: 'labs',        name: 'Geology and biology labs' },
    { id: 'restroom',    name: 'Restroom' },
    { id: 'cabin3',      name: 'Cabin 3' },
    { id: 'cabin4',      name: 'Cabin 4' },
    { id: 'gym',         name: 'Gym' },
    { id: 'bunker',      name: 'Bunker' },
    { id: 'airlock',     name: 'Airlock' },
    { id: 'comms',       name: 'Communications Center' },
  ],

  // --- Equipaggio (§6, ui-spec "Sol 1") ---
  crew: [
    { id: 'astrid', name: 'Astrid Lindqvist', role: 'Systems and Power Engineer', startRoom: 'lifeSupport' },
    { id: 'hannah', name: 'Hannah Becker',    role: 'Flight Surgeon',             startRoom: 'medical' },
    { id: 'maya',   name: 'Maya Brooks',      role: 'Space Biologist',            startRoom: 'labs' },
    { id: 'luana',  name: 'Luana Santos',     role: 'Lunar Geologist',            startRoom: 'labs' },
  ],

  // Valori iniziali di ogni astronauta (§4.4)
  crewStart: {
    health: 100, radiation: 0, boneMass: 100, muscleMass: 100,
    sleep: 100, fatigue: 0, hunger: 100, hydration: 100, mood: 100, stress: 0,
  },
  // Valori "plausibili" usati quando si parte con ?sol=N
  crewMidMission: {
    health: 95, radiation: 5, sleep: 75, fatigue: 25, hunger: 75, hydration: 75, mood: 80, stress: 20,
  },

  // Decadimento lento dei bisogni (per Sol); le azioni del Modulo 2 li ripristinano
  crewDecay: {
    sleep: -6, fatigue: +5, hunger: -8, hydration: -8, mood: -2, stress: +2,
    boneMass: -0.05,             // ~1,5 % al mese
    muscleMass: -0.3,
    nightMood: -1, nightStress: +1, // extra durante la notte lunare
    healthLossWhenCritical: -10, // per Sol se hunger o hydration o sleep a 0
    radiationDanger: 80,         // sopra questa soglia la salute cala
    healthLossRadiation: -10,
  },

  // --- Eventi (§7, piano "Decisioni" 4 e 7) ---
  events: {
    greenhouse: { baseSol: 4, minSol: 3, maxSol: 5 },
    solarStorm: { baseSol: 8, minSol: 7, maxSol: 9, timerSeconds: 30, shieldsPowerCost: 30, shieldsRadiation: 15, bunkerSkipSols: 1 },
    lunarNight: { startSol: 14, endSol: 28 },
    minorFlareChancePerSol: 0.2, // FLR/CME casuali a basso rischio (solo avviso)
  },

  // --- Serra (piano "Decisioni" 5) ---
  greenhouse: { waterCostPct: 2, powerCost: 5, cooldownSol: 0.25, plants: 6 },

  // --- Messaggi di sconfitta (§9.2) ---
  failMessages: {
    power: 'The base lost power and the crew could not survive.',
    oxygen: 'The base ran out of oxygen and the crew could not breathe.',
    water: 'The base ran out of water and the crew could not survive.',
    shield: 'The radiation shield failed and the crew was exposed to deadly radiation.',
    plantHealth: 'All the crops in the greenhouse have died.',
    crewHealth: '{name} did not survive. Take better care of your crew!',
    allOff: 'The entire base has been shut down',
    storm: 'The crew was exposed to the solar storm without protection.',
    default: 'The mission could not continue.',
  },

  winText: {
    title: 'MISSION COMPLETE',
    message: 'You survived the 14-day lunar night! The solar panels are back online.',
  },

  // --- Badge (§9.3, testi verbatim da ui-spec e screenshot Figma) ---
  badges: {
    greenhouse: {
      id: 'greenhouse',
      name: 'Greenhouse',
      title: 'Amazing job! You saved the lunar greenhouse from disaster!',
      unlock: 'Unlocked by completing space farming tasks, adjusting LED grow lights, and successfully solving crop hydration issues',
      bonus: '+10% Crop Growth Efficiency added to your greenhouse!',
      inspiration: 'Meet your inspiration: Dr. Gioia Massa, Lead NASA Scientist! Just like you managed water levels and LED lights to keep our lunar plants alive, Dr. Massa tackled real agricultural challenges like the Veg-05 experiment and crop nutrition on the International Space Station!',
      roleModel: 'Dr. Gioia Massa',
      effect: { cropGrowth: 0.10 },
      theme: 'green',
    },
    solar: {
      id: 'solar',
      name: 'Sun Radiation',
      title: 'Amazing job! You kept the crew safe from solar radiation!',
      unlock: 'Unlocked by successfully protecting the astronaut crew during dangerous solar storm alerts (DONKI data) and executing emergency protocols',
      bonus: '',
      inspiration: 'Meet your inspiration: Judith Love Cohen, Aerospace Engineer! Just like you made critical decisions under pressure to protect the base from solar radiation, Judith Love Cohen helped design the backup Abort Guidance System that safely navigated the Apollo 13 crew back to Earth during a major space emergency!',
      roleModel: 'Judith Love Cohen',
      effect: null,
      theme: 'orange',
    },
    power: {
      id: 'power',
      name: 'Power',
      title: 'Amazing job! You mastered the base energy grid!',
      unlock: 'Unlocked by solving energy warnings, managing power reserves, and turning off non-essential room equipment to prevent dangerous power drains',
      bonus: '-10% Energy Consumption across the base!',
      inspiration: 'Meet your inspiration: Christina Koch, NASA Astronaut, Physicist, and Electrical Engineer! Just like you optimized power and balanced electrical systems during crunches, Christina Koch initiated the Veg-PONDS-02 experiment to save station power and spent 328 continuous days in space!',
      roleModel: 'Christina Koch',
      effect: { energyConsumption: -0.10 },
      theme: 'green',
    },
    sol28: {
      id: 'sol28',
      name: '28 Sol',
      title: 'Amazing job! You survived the 14-day lunar night!',
      unlock: 'Unlocked by budgeting battery power through the brutal 14-day lunar night darkness and maintaining life support for the 4-member crew',
      bonus: '',
      inspiration: 'Meet your inspiration: Peggy Whitson, record-breaking NASA astronaut and Space Station Commander! Just as you kept equipment and life support running through tough lunar cycles, she spent months commanding the ISS, managing complex operations, upkeep, and research in extreme space conditions.',
      roleModel: 'Peggy Whitson',
      effect: null,
      theme: 'green',
    },
  },

  difficulties: ['easy', 'hard'],
  defaultDifficulty: 'easy',
};
