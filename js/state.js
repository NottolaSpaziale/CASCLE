// Stato di gioco unico e mutabile (§4). I moduli leggono/scrivono questo oggetto.
import { CONFIG } from './config.js';

export const state = {};

// Intero casuale in [min, max]
function randInt(min, max) {
  return min + Math.floor(Math.random() * (max - min + 1));
}

// Crea un astronauta con le variabili §4.4
function makeAstronaut(def) {
  return {
    id: def.id,
    name: def.name,
    role: def.role,
    ...CONFIG.crewStart,
    location: def.startRoom,
    destination: null,
    task: null,
  };
}

// Riporta lo stato ai valori iniziali (Sol 1). Mantiene la difficoltà se non indicata.
export function resetState(opts = {}) {
  const r = CONFIG.resources;
  const difficulty = opts.difficulty || state.difficulty || CONFIG.defaultDifficulty;

  // Svuota l'oggetto mantenendo lo stesso riferimento
  for (const k of Object.keys(state)) delete state[k];

  Object.assign(state, {
    phase: 'playing',            // 'playing' | 'failed' | 'won'
    sol: CONFIG.mission.startSol, // Sol intero corrente
    solProgress: 0,              // frazione 0..1 del Sol corrente
    speed: 1,
    paused: false,
    pauseReasons: [],            // motivi di pausa attivi (es. 'user', 'alert', 'tablet')
    difficulty,

    // Risorse base (§4.1)
    power: r.power,
    oxygen: r.oxygen,
    co2: r.co2,
    water: r.water,
    shield: r.shield,
    plantHealth: r.plantHealth,
    solarOutput: r.solarOutputDay,

    // Equipaggio
    crew: CONFIG.crew.map(makeAstronaut),

    // Livello energetico per sistema/stanza (OFF/ECO/MAX)
    roomPower: Object.fromEntries(
      CONFIG.powerSystems.map(s => [s.id, s.fixed || CONFIG.defaultPowerLevel])
    ),

    // Serra: irrigazione automatica attiva mentre un astronauta fa 'Manage greenhouse' (Modulo 2)
    greenhouse: { autoWater: false, caretaker: null },

    badges: [],                  // id dei badge sbloccati
    events: {
      schedule: {
        greenhouse: randInt(CONFIG.events.greenhouse.minSol, CONFIG.events.greenhouse.maxSol),
        solarStorm: randInt(CONFIG.events.solarStorm.minSol, CONFIG.events.solarStorm.maxSol),
        lunarNight: CONFIG.events.lunarNight.startSol,
      },
      active: [],                // eventi in corso
      done: [],                  // id eventi conclusi
    },

    failCause: null,
    failMessage: null,
  });
  return state;
}

// Notte lunare attiva per il Sol indicato
export function isNight(sol = state.sol) {
  return sol >= CONFIG.mission.nightStartSol && sol < CONFIG.mission.nightEndSol;
}

resetState();
