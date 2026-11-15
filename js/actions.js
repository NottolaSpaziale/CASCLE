// Azioni delle stanze (§5.1) ed effetti sui bisogni dell'equipaggio (§4.4)
import { CONFIG } from './config.js';
import { state } from './state.js';
import { emit } from './loop.js';

const HOURS_PER_SOL = 24;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// Cabina personale di ogni astronauta (azione "Cabin")
export const CABIN_OF = { astrid: 'cabin1', hannah: 'cabin2', maya: 'cabin3', luana: 'cabin4' };

// Bonus di ruolo: lo specialista è più veloce e ottiene più beneficio
export const ROLE_BONUS = { durationMult: 0.7, effectMult: 1.25 };
// Bonus "social time" con 2+ astronauti in Galley
export const SOCIAL_BONUS = 1.5;
// Fatica/stress al massimo: la salute cala (per Sol)
const HEALTH_LOSS_EXHAUSTED = -5;

// Definizione azioni.
// room: stanza di destinazione ('cabin' = cabina personale); hours: durata in ore di gioco;
// effects: variazioni totali sull'astronauta; base: variazioni totali sulle risorse della base;
// perHour: effetti continui (azioni senza fine); specialist: id astronauta con bonus;
// emit: evento sul bus all'arrivo ('click' = subito al click)
export const ACTIONS = {
  goCabin:     { label: 'Go to Cabin', room: 'cabin' },
  sleep:       { label: 'Sleep 8h', room: 'cabin', hours: 8, effects: { sleep: 75, fatigue: -50, stress: -5 } },
  relax:       { label: 'Relax / Read', room: 'cabin', hours: 2, effects: { mood: 12, stress: -15, fatigue: -10 } },

  goGalley:    { label: 'Go to Galley', room: 'galley' },
  eat:         { label: 'Eat Meal', room: 'galley', hours: 1, effects: { hunger: 50, mood: 3 } },
  drink:       { label: 'Drink Water', room: 'galley', hours: 0.25, effects: { hydration: 40 }, base: { water: -0.2 } },
  socialize:   { label: 'Socialize with Crew', room: 'galley', hours: 2, effects: { mood: 15, stress: -12 }, social: true },

  goGym:       { label: 'Go to Gym', room: 'gym' },
  ared:        { label: 'Lift Weights (ARED)', room: 'gym', hours: 1.5, effects: { boneMass: 0.6, muscleMass: 2, fatigue: 15, hydration: -6 } },
  treadmill:   { label: 'Run on Treadmill (T2)', room: 'gym', hours: 1, effects: { boneMass: 0.4, muscleMass: 1, fatigue: 12, mood: 5, hydration: -8 } },
  cevis:       { label: 'Ride Exercise Bike (CEVIS)', room: 'gym', hours: 1, effects: { boneMass: 0.1, muscleMass: 1.2, fatigue: 10, stress: -5, hydration: -6 } },

  goMedical:   { label: 'Go to Medical Bay', room: 'medical' },
  checkup:     { label: 'Get Medical Check-up', room: 'medical', hours: 1, effects: { health: 10, radiation: -10, stress: -3 }, specialist: 'hannah' },
  treat:       { label: 'Treat Injury / Illness', room: 'medical', hours: 3, effects: { health: 30, radiation: -20, fatigue: -5 }, specialist: 'hannah' },

  goLabs:      { label: 'Go to Labs', room: 'labs' },
  manageGreenhouse: { label: 'Manage greenhouse', room: 'labs', continuous: true, perHour: { fatigue: 1.5, stress: 0.3 }, specialist: 'maya', greenhouse: true },
  samples:     { label: 'Analyze Lunar Samples', room: 'labs', hours: 3, effects: { fatigue: 10, mood: 6 }, specialist: 'luana' },

  goGreenhouse: { label: 'Go to Greenhouse', room: 'labs' },
  managePlants: { label: 'Manage the plants', room: 'labs', hours: 0.5, effects: { mood: 2 }, specialist: 'maya', emit: 'action:greenhouse' },

  goLifeSupport: { label: 'Go to Life Support Room', room: 'lifeSupport' },
  powerPanel:  { label: 'Check Power Panel', room: 'lifeSupport', hours: 0.5, effects: {}, specialist: 'astrid', emit: 'action:powerPanel' },
  airFilters:  { label: 'Clean Air Filters (CDRA)', room: 'lifeSupport', hours: 2, effects: { fatigue: 8 }, base: { co2: -0.03 }, specialist: 'astrid' },
  waterRecycler: { label: 'Inspect Water Recycler (UPA)', room: 'lifeSupport', hours: 2, effects: { fatigue: 6 }, base: { water: 1.5 }, specialist: 'astrid' },

  goComms:     { label: 'Go to Comms Center', room: 'comms' },
  callEarth:   { label: 'Call Earth', room: 'comms', hours: 1, effects: { mood: 20, stress: -15 } },
  donki:       { label: 'Check DONKI Space Weather', room: 'comms', hours: 0.5, effects: {}, emit: 'action:donki' },

  goAirlock:   { label: 'Go to Airlock', room: 'airlock' },
  eva:         { label: 'Put on EVA Spacesuit & Exit Base', room: 'airlock', hours: 4, effects: { fatigue: 25, radiation: 3, mood: 10 }, specialist: 'luana' },
  dust:        { label: 'Clean Lunar Dust', room: 'airlock', hours: 1.5, effects: { fatigue: 8, stress: -3 }, specialist: 'luana' },
  evacuate:    { label: 'Evacuate to Bunker', room: 'bunker', emit: 'action:evacuate', emitOn: 'click' },

  goRestroom:  { label: 'Go to Restroom', room: 'restroom' },
  sanitation:  { label: 'Restroom and Sanitation', room: 'restroom', hours: 0.5, effects: { mood: 3, stress: -3 }, base: { water: -0.1 } },
};

// Voci del menu radiale (ui-spec) con la pillola stanza e le azioni (tabella §5.1)
export const ROOM_GROUPS = [
  { id: 'restroom',    label: 'Restroom',               pill: 'Restroom & Sanitation',    actions: ['goRestroom', 'sanitation'] },
  { id: 'cabin',       label: 'Cabin',                  pill: 'Cabin',                    actions: ['goCabin', 'sleep', 'relax'] },
  { id: 'lifeSupport', label: 'Life Support System',    pill: 'Life Support System',      actions: ['goLifeSupport', 'powerPanel', 'airFilters', 'waterRecycler'] },
  { id: 'galley',      label: 'Galley & Kitchen',       pill: 'Galley & Kitchen',         actions: ['goGalley', 'eat', 'drink', 'socialize'] },
  { id: 'comms',       label: 'Communications Center',  pill: 'Communications Center',    actions: ['goComms', 'callEarth', 'donki'] },
  { id: 'greenhouse',  label: 'Greenhouse',             pill: 'Greenhouse',               actions: ['goGreenhouse', 'manageGreenhouse', 'managePlants'] },
  { id: 'medical',     label: 'Medical Bay',            pill: 'Medical Bay',              actions: ['goMedical', 'checkup', 'treat'] },
  { id: 'labs',        label: 'Labs',                   pill: 'Labs',                     actions: ['goLabs', 'manageGreenhouse', 'samples'] },
  { id: 'bunker',      label: 'Bunker & Airlock',       pill: 'Bunker, Airlock & EVA Suits', actions: ['goAirlock', 'eva', 'dust', 'evacuate'] },
  { id: 'gym',         label: 'Gym',                    pill: 'Gym',                      actions: ['goGym', 'ared', 'treadmill', 'cevis'] },
];

// Gruppo del menu associato a una stanza della mappa (click su stanza con astronauta selezionato)
export function groupForRoom(roomId) {
  if (/^cabin\d$/.test(roomId)) return 'cabin';
  if (roomId === 'airlock') return 'bunker';
  return ROOM_GROUPS.some(g => g.id === roomId) ? roomId : null;
}

// Stanza effettiva di destinazione per un astronauta
export function targetRoom(astronaut, actionId) {
  const act = ACTIONS[actionId];
  if (!act) return null;
  return act.room === 'cabin' ? (CABIN_OF[astronaut.id] || 'cabin1') : act.room;
}

export function isSpecialist(astronaut, act) {
  return !!act.specialist && act.specialist === astronaut.id;
}

// Durata in Sol (0 = solo spostamento; Infinity = azione continua)
export function actionDurationSol(astronaut, actionId) {
  const act = ACTIONS[actionId];
  if (!act) return 0;
  if (act.continuous) return Infinity;
  if (!act.hours) return 0;
  const mult = isSpecialist(astronaut, act) ? ROLE_BONUS.durationMult : 1;
  return act.hours * mult / HOURS_PER_SOL;
}

// Crea l'oggetto task salvato in astronaut.task
export function makeTask(astronaut, actionId) {
  const act = ACTIONS[actionId];
  const duration = actionDurationSol(astronaut, actionId);
  return {
    id: actionId,
    label: act.label,
    room: targetRoom(astronaut, actionId),
    duration,
    remaining: duration,
    started: false,
  };
}

// Variazione "positiva" per il giocatore (riceve il bonus di ruolo / social)
const LOWER_IS_BETTER = new Set(['fatigue', 'stress', 'radiation', 'co2']);
function isBenefit(key, delta) {
  return LOWER_IS_BETTER.has(key) ? delta < 0 : delta > 0;
}

// Numero di astronauti arrivati in una stanza
export function occupantsIn(roomId) {
  return state.crew.filter(a => a.location === roomId && !a.destination).length;
}

// Applica una variazione a un bisogno dell'astronauta
function applyCrew(a, key, delta) {
  if (typeof a[key] !== 'number') return;
  a[key] = clamp(a[key] + delta, 0, 100);
}
// Applica una variazione alle risorse della base
function applyBase(key, delta) {
  if (key === 'co2') state.co2 = Math.max(CONFIG.rates.co2Min, state.co2 + delta);
  else if (typeof state[key] === 'number') state[key] = clamp(state[key] + delta, 0, 100);
}

// Avvia il task all'arrivo nella stanza
export function startTask(a) {
  const t = a.task;
  if (!t || t.started) return;
  t.started = true;
  const act = ACTIONS[t.id];
  emit('crew:taskStart', a.id, t.id);
  if (act.emit && act.emitOn !== 'click') emit(act.emit, a.id);
  if (t.duration === 0) finishTask(a);
}

export function finishTask(a) {
  const t = a.task;
  a.task = null;
  if (t) emit('crew:taskDone', a.id, t.id);
}

// Avanza i task in corso di dSol (chiamata a ogni tick)
export function tickActions(dSol) {
  for (const a of state.crew) {
    // Fatica o stress al massimo: la salute cala (si somma al calo già gestito dal loop)
    if (a.fatigue >= 100 || a.stress >= 100) a.health = clamp(a.health + HEALTH_LOSS_EXHAUSTED * dSol, 0, 100);

    const t = a.task;
    if (!t || !t.started || a.destination) continue;
    const act = ACTIONS[t.id];
    if (!act) { a.task = null; continue; }
    const spec = isSpecialist(a, act);

    if (act.continuous) {
      // Effetti continui all'ora (es. Manage greenhouse: fatica crescente)
      const mult = spec ? ROLE_BONUS.durationMult : 1; // lo specialista si stanca meno
      for (const [k, v] of Object.entries(act.perHour || {})) applyCrew(a, k, v * HOURS_PER_SOL * dSol * mult);
      continue;
    }

    const step = Math.min(dSol, t.remaining);
    const frac = t.duration > 0 ? step / t.duration : 1;
    let bonus = spec ? ROLE_BONUS.effectMult : 1;
    if (act.social && occupantsIn('galley') >= 2) bonus *= SOCIAL_BONUS;
    for (const [k, v] of Object.entries(act.effects || {})) {
      applyCrew(a, k, v * frac * (isBenefit(k, v) ? bonus : 1));
    }
    for (const [k, v] of Object.entries(act.base || {})) {
      applyBase(k, v * frac * (isBenefit(k, v) ? (spec ? ROLE_BONUS.effectMult : 1) : 1));
    }
    t.remaining -= step;
    if (t.remaining <= 1e-9) finishTask(a);
  }
  updateGreenhouseFlag();
}

// Irrigazione automatica della serra: attiva finché un astronauta esegue "Manage greenhouse" nei labs
export function updateGreenhouseFlag() {
  if (!state.greenhouse) state.greenhouse = { autoWater: false, caretaker: null };
  const keeper = state.crew.find(a => a.task && ACTIONS[a.task.id]?.greenhouse && a.task.started && !a.destination && a.location === 'labs');
  const id = keeper ? keeper.id : null;
  if (state.greenhouse.caretaker !== id) {
    state.greenhouse.caretaker = id;
    state.greenhouse.autoWater = !!keeper;
    emit('greenhouse:autoWater', state.greenhouse.autoWater, id);
  }
}

// Bisogni sotto soglia (per l'indicatore sull'icona): 'ok' | 'warn' | 'critical'
export function needsStatus(a) {
  const low = ['health', 'sleep', 'hunger', 'hydration', 'mood', 'boneMass', 'muscleMass'];
  const high = ['fatigue', 'stress', 'radiation'];
  const crit = a.health < 25 || low.some(k => a[k] <= 5) || high.some(k => a[k] >= 95);
  if (crit) return 'critical';
  const warn = low.some(k => a[k] < 25) || high.some(k => a[k] > 75);
  return warn ? 'warn' : 'ok';
}
