// Sistema energia (§8): consumo reale per sistema/stanza, regole OFF/ECO/MAX e difficoltà EASY/HARD
import { CONFIG } from './config.js';
import { state } from './state.js';
import { emit } from './loop.js';

export const LEVELS = ['OFF', 'ECO', 'MAX'];
const SYS = Object.fromEntries(CONFIG.powerSystems.map(s => [s.id, s]));
const norm = l => String(l || '').toUpperCase();

// Moltiplicatore del badge Power (-10 % consumi)
export function badgeFactor(s = state) {
  const eff = CONFIG.badges.power.effect.energyConsumption;
  return Array.isArray(s.badges) && s.badges.includes('power') ? 1 + eff : 1;
}

export function levelOf(id, s = state) {
  const sys = SYS[id];
  if (!sys) return 'OFF';
  return sys.fixed || s.roomPower?.[id] || 'OFF';
}

// Stanza occupata: almeno un astronauta fermo dentro (chi cammina non conta)
export function isOccupied(id, s = state) {
  const rooms = CONFIG.powerOccupancy[id];
  if (!rooms) return true;
  return s.crew.some(a => !a.destination && rooms.includes(a.location));
}

// Consumo nominale (units/Sol) del sistema al livello impostato, senza badge
export function nominalOf(id, s = state) {
  const lvl = levelOf(id, s);
  return lvl === 'OFF' ? 0 : SYS[id][lvl];
}

// Consumo reale (units/Sol): in ECO le stanze "a presenza" consumano solo se occupate
export function actualOf(id, s = state) {
  const lvl = levelOf(id, s);
  if (lvl === 'OFF') return 0;
  if (lvl === 'ECO' && !isOccupied(id, s)) return 0;
  return SYS[id][lvl];
}

// Totali giornalieri (con bonus badge)
export function dailyConsumption(s = state) {
  let t = 0;
  for (const sys of CONFIG.powerSystems) t += actualOf(sys.id, s);
  return t * badgeFactor(s);
}
export function nominalConsumption(s = state) {
  let t = 0;
  for (const sys of CONFIG.powerSystems) t += nominalOf(sys.id, s);
  return t * badgeFactor(s);
}

// Livello minimo ammesso dal sistema nella difficoltà corrente (6b: Radiation Shield OFF solo in HARD)
export function minLevelOf(id, s = state) {
  const sys = SYS[id];
  if (!sys) return 'OFF';
  if (sys.fixed) return sys.fixed;
  if (id === 'radiationShield' && s.difficulty === 'hard') return 'OFF';
  return sys.minLevel || 'OFF';
}

// Il sistema è regolabile singolarmente (solo HARD, non fisso)
export function isAdjustable(id, s = state) {
  return s.difficulty === 'hard' && !!SYS[id] && !SYS[id].fixed;
}

function changed() {
  emit('power:change', { ...state.roomPower });
  emit('update');
}

// Imposta un singolo sistema rispettando il minimo; restituisce il livello applicato (o null)
export function setSystem(id, level) {
  const sys = SYS[id];
  const lvl = norm(level);
  if (!sys || !LEVELS.includes(lvl) || state.phase !== 'playing') return null;
  if (sys.fixed) return sys.fixed;
  const min = minLevelOf(id);
  const applied = LEVELS.indexOf(lvl) < LEVELS.indexOf(min) ? min : lvl;
  if (state.roomPower[id] !== applied) {
    state.roomPower[id] = applied;
    changed();
  }
  return applied;
}

// Pulsanti globali TUTTO MAX / ECO / OFF. "Tutto OFF" spegne anche la Crew safety -> MISSION FAILED (endgame)
export function setAll(level) {
  const lvl = norm(level);
  if (!LEVELS.includes(lvl) || state.phase !== 'playing') return false;
  for (const sys of CONFIG.powerSystems) {
    if (!sys.fixed) state.roomPower[sys.id] = lvl;
  }
  changed();
  return true;
}

// Livello comune a tutti i sistemi regolabili, o null se misti
export function commonLevel(s = state) {
  const ids = CONFIG.powerSystems.filter(p => !p.fixed).map(p => p.id);
  const first = s.roomPower[ids[0]];
  return ids.every(id => s.roomPower[id] === first) ? first : null;
}

export function setDifficulty(d) {
  if (!CONFIG.difficulties.includes(d)) return false;
  state.difficulty = d;
  // Tornando in EASY lo scudo non può restare OFF da solo (salvo "tutto OFF")
  if (d === 'easy' && state.roomPower.radiationShield === 'OFF' && commonLevel() !== 'OFF') {
    state.roomPower.radiationShield = 'ECO';
  }
  emit('difficulty:change', d);
  changed();
  return true;
}

// Scudi magnetici disponibili durante le tempeste (6b)
export function shieldsAvailable(s = state) {
  return levelOf('radiationShield', s) !== 'OFF';
}
