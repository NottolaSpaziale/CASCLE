// Motore: event bus, tick fisso da 100 ms (guidato da requestAnimationFrame), velocità e pausa
import { CONFIG } from './config.js';
import { state, isNight } from './state.js';
import { dailyConsumption } from './power.js';

// ---------- Event bus ----------
const listeners = new Map();

export function on(name, fn) {
  if (!listeners.has(name)) listeners.set(name, new Set());
  listeners.get(name).add(fn);
  return () => off(name, fn);
}
export function off(name, fn) {
  listeners.get(name)?.delete(fn);
}
export function emit(name, ...args) {
  const set = listeners.get(name);
  if (!set) return;
  for (const fn of [...set]) {
    try { fn(...args); } catch (err) { console.error(`[bus] errore in "${name}":`, err); }
  }
}
// Scorciatoie per i moduli futuri
export const onTick = fn => on('tick', fn);       // fn(dSol)
export const onNewSol = fn => on('newSol', fn);   // fn(sol)

// ---------- Consumi ----------
// Consumo giornaliero reale (units/Sol): calcolato da power.js (ECO a presenza, badge Power -10 %)
export function computeDailyConsumption(s = state) {
  return dailyConsumption(s);
}

// Produzione solare (units/Sol) per il Sol corrente
export function currentSolarOutput(s = state) {
  return isNight(s.sol) ? CONFIG.resources.solarOutputNight : CONFIG.resources.solarOutputDay;
}

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// ---------- Simulazione continua (proporzionale a dSol) ----------
function simulate(dSol, { crew = true } = {}) {
  const s = state;
  const lvl = id => s.roomPower[id] || 'OFF';
  const R = CONFIG.rates;

  // Energia: ricarica solare - consumi
  s.solarOutput = currentSolarOutput(s);
  s.power = clamp(s.power + (s.solarOutput - computeDailyConsumption(s)) * dSol, 0, CONFIG.resources.powerMax);

  // Risorse vitali dai rate dei sistemi
  s.oxygen = clamp(s.oxygen + R.oxygenPerSol[lvl('lifeSupport')] * dSol, 0, 100);
  s.co2 = Math.max(R.co2Min, s.co2 + R.co2PerSol[lvl('lifeSupport')] * dSol);
  s.water = clamp(s.water + R.waterPerSol[lvl('waterRecycling')] * dSol, 0, 100);
  s.shield = clamp(s.shield + R.shieldPerSol[lvl('radiationShield')] * dSol, 0, 100);
  s.plantHealth = clamp(s.plantHealth + R.plantPerSol[lvl('greenhouse')] * dSol, 0, 100);

  // Bisogni dell'equipaggio: decadimento lento
  if (crew) {
    const D = CONFIG.crewDecay;
    const night = isNight(s.sol);
    for (const a of s.crew) {
      a.sleep = clamp(a.sleep + D.sleep * dSol, 0, 100);
      a.fatigue = clamp(a.fatigue + D.fatigue * dSol, 0, 100);
      a.hunger = clamp(a.hunger + D.hunger * dSol, 0, 100);
      a.hydration = clamp(a.hydration + D.hydration * dSol, 0, 100);
      a.mood = clamp(a.mood + (D.mood + (night ? D.nightMood : 0)) * dSol, 0, 100);
      a.stress = clamp(a.stress + (D.stress + (night ? D.nightStress : 0)) * dSol, 0, 100);
      a.boneMass = clamp(a.boneMass + D.boneMass * dSol, 0, 100);
      a.muscleMass = clamp(a.muscleMass + D.muscleMass * dSol, 0, 100);
      // Salute: cala solo se un bisogno vitale è a zero o la radiazione è alta
      if (a.hunger <= 0 || a.hydration <= 0 || a.sleep <= 0) a.health += D.healthLossWhenCritical * dSol;
      if (a.radiation >= D.radiationDanger) a.health += D.healthLossRadiation * dSol;
      a.health = clamp(a.health, 0, 100);
    }
  }
}

// Avanza il tempo di dSol (simulazione + passaggio di Sol + eventi bus)
function step(dSol, opts = {}) {
  simulate(dSol, opts);
  if (opts.emit !== false) emit('tick', dSol);
  if (state.phase !== 'playing') return;

  state.solProgress += dSol;
  while (state.solProgress >= 1) {
    state.solProgress -= 1;
    state.sol += 1;
    if (opts.emit !== false) emit('newSol', state.sol);
    if (state.phase !== 'playing') return;
  }
}

// Avanza di n Sol interi (es. salto bunker). Emette tick/newSol, quindi i controlli restano attivi.
export function advanceSols(n, opts = {}) {
  const chunk = 0.05;
  let left = n;
  while (left > 1e-9 && state.phase === 'playing') {
    const d = Math.min(chunk, left);
    step(d, opts);
    left -= d;
  }
  emit('update');
}

// ---------- Velocità e pausa ----------
export function setSpeed(speed) {
  if (!CONFIG.time.speeds.includes(speed)) return;
  state.speed = speed;
  emit('speedChange', speed);
  emit('update');
}

function syncPaused() {
  const was = state.paused;
  state.paused = state.pauseReasons.length > 0;
  if (was !== state.paused) emit('pauseChange', state.paused);
  emit('update');
}
// Mette in pausa per un motivo (più moduli possono mettere in pausa insieme)
export function pause(reason = 'user') {
  if (!state.pauseReasons.includes(reason)) state.pauseReasons.push(reason);
  syncPaused();
}
// Rimuove un motivo di pausa; senza argomento li rimuove tutti
export function resume(reason) {
  state.pauseReasons = reason === undefined ? [] : state.pauseReasons.filter(r => r !== reason);
  syncPaused();
}
export function togglePause() {
  if (state.pauseReasons.includes('user')) resume('user'); else pause('user');
}
// Alert/emergenza: velocità 1x e pausa finché il modulo chiamante non fa resume('alert')
export function onAlert() {
  setSpeed(1);
  pause('alert');
  emit('alert');
}

// ---------- Loop rAF con tick fisso ----------
let rafId = null;
let lastTime = null;
let acc = 0;

function frame(now) {
  rafId = requestAnimationFrame(frame);
  if (lastTime === null) lastTime = now;
  const dt = Math.min((now - lastTime) / 1000, CONFIG.time.maxFrameSeconds);
  lastTime = now;

  if (state.phase === 'playing' && !state.paused) {
    const tick = CONFIG.time.tickMs / 1000;
    acc += dt;
    while (acc >= tick) {
      acc -= tick;
      step(tick * state.speed / CONFIG.time.secondsPerSolAt1x);
      if (state.phase !== 'playing') break;
    }
  } else {
    acc = 0;
  }
  // Ogni frame: HUD e controlli leggono lo stato (anche modifiche da console in pausa)
  emit('update');
}

export function startLoop() {
  if (rafId !== null) return;
  lastTime = null;
  acc = 0;
  rafId = requestAnimationFrame(frame);
}
export function stopLoop() {
  if (rafId !== null) cancelAnimationFrame(rafId);
  rafId = null;
}

// ---------- Partenza da un Sol N (?sol=N) ----------
// Simula le risorse base dei Sol precedenti in ECO (niente eventi), poi crew a valori plausibili
export function fastForwardTo(targetSol) {
  const n = Math.max(CONFIG.mission.startSol, Math.min(CONFIG.mission.winSol, Math.floor(targetSol)));
  for (let i = CONFIG.mission.startSol; i < n; i++) {
    for (let k = 0; k < 20; k++) simulate(0.05, { crew: false });
    state.sol += 1;
  }
  state.solProgress = 0;
  if (n > CONFIG.mission.startSol) {
    for (const a of state.crew) Object.assign(a, CONFIG.crewMidMission);
  }
  state.solarOutput = currentSolarOutput(state);
  emit('update');
}
