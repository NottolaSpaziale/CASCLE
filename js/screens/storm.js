// Tempesta solare SEP (Flusso 2): schermata di scelta con timer reale di 30 s,
// EVACUATE (bunker + salto di 1 Sol + badge Solar), ACTIVATE SHIELDS, timer scaduto (crollo salute -> MISSION FAILED)
import { CONFIG } from '../config.js';
import { state } from '../state.js';
import { on, emit, pause, resume, advanceSols } from '../loop.js';
import { assignAction, layoutRoom } from '../crew.js';
import { getMapEl, getRoomEl } from '../map.js';
import { failMission } from './endgame.js';
import { showBadge } from '../badges.js';
import { setGreenhouseFrozen } from './greenhouse.js';

const E = CONFIG.events;
const S = E.solarStorm;
const T = CONFIG.eventTexts.storm;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// Azione "vai" per riportare ogni astronauta nella stanza precedente
const GO_ACTION = {
  lifeSupport: 'goLifeSupport', cabin1: 'goCabin', cabin2: 'goCabin', cabin3: 'goCabin', cabin4: 'goCabin',
  galley: 'goGalley', medical: 'goMedical', labs: 'goLabs', restroom: 'goRestroom', gym: 'goGym',
  comms: 'goComms', airlock: 'goAirlock',
};

let sceneEl, screen, fillEl, toastEl, bannerEl, pausedEl, exposedEl;
let stage = 'idle';              // idle | choice | evacuating | bunker | badge | exposed
let onDone = () => {};
let timerStart = 0, timerRaf = null;
let animRaf = null;
let walkStart = 0;
let saved = [];                  // stanze/azioni della crew prima dell'evacuazione
let internalAssign = false;      // evita di rientrare in action:evacuate mentre spostiamo la crew
let toastTimer = null;

export function initStorm(scene, opts = {}) {
  sceneEl = scene;
  onDone = opts.onDone || onDone;

  screen = document.createElement('div');
  screen.className = 'modal-layer storm-screen hidden';
  screen.innerHTML = `
    <div class="modal storm-modal theme-red" role="dialog" aria-modal="true">
      <div class="modal-frame"><div class="modal-box storm-box">
        <div class="storm-timer">
          <span>${T.timerLabel}</span>
          <div class="storm-track"><div class="storm-fill"></div></div>
        </div>
        <div class="storm-cols">
          <div class="storm-col">
            <h2>EVACUATE TO BUNKER</h2>
            <p>Directs all crew members to stop work and take shelter in the <b>underground bunker</b> immediately.</p>
            <p class="good">Keeps crew shielding and <b>safety at 100%</b> with <b>zero health risk.</b></p>
            <p class="bad"><b>Pauses</b> all scientific research and greenhouse food production <b>for 24 hours</b></p>
            <button type="button" class="modal-btn" data-storm="evacuate">EVACUATE</button>
          </div>
          <div class="storm-col">
            <h2>ACTIVATE MAGNETIC SHIELDS</h2>
            <p>Keeps astronauts inside the lab modules to <b>continue working</b> while powering high-intensity electronic <b>magnetic shielding.</b></p>
            <p class="good">Keeps work going without interruption; science research finishes on time with zero lost hours.</p>
            <p class="bad">Consumes heavy <b>battery power -${S.shieldsPowerCost} kW</b> and increases <b>crew radiation exposure risk +${S.shieldsRadiation}%</b></p>
            <button type="button" class="modal-btn" data-storm="shields">ACTIVATE SHIELDS</button>
          </div>
        </div>
      </div></div>
    </div>`;
  sceneEl.appendChild(screen);
  fillEl = screen.querySelector('.storm-fill');
  screen.addEventListener('click', e => {
    const b = e.target.closest('[data-storm]');
    if (!b || stage !== 'choice' || state.phase !== 'playing') return;
    if (b.dataset.storm === 'evacuate') evacuate();
    else activateShields();
  });

  toastEl = document.createElement('div');
  toastEl.className = 'game-toast hidden';
  sceneEl.appendChild(toastEl);

  exposedEl = document.createElement('div');
  exposedEl.className = 'storm-exposed hidden';
  exposedEl.innerHTML = `<p>${T.exposed}</p>`;
  sceneEl.appendChild(exposedEl);

  on('update', checkArrival);
  on('fail', () => stopAll());
  on('win', () => stopAll());
  on('reset', () => stopAll());
}

export function getStormStage() { return stage; }
export function stormTimeLeft() {
  if (stage !== 'choice') return 0;
  return Math.max(0, S.timerSeconds - (performance.now() - timerStart) / 1000);
}

// ---------- Schermata di scelta con timer reale ----------
export function openStormChoice() {
  if (state.phase !== 'playing' || stage !== 'idle') return;
  stage = 'choice';
  screen.classList.remove('hidden');
  timerStart = performance.now();
  fillEl.style.width = '100%';
  const step = () => {
    if (stage !== 'choice') return;
    const left = stormTimeLeft();
    fillEl.style.width = `${(left / S.timerSeconds * 100).toFixed(2)}%`;
    if (left <= 0) { timeExpired(); return; }
    timerRaf = requestAnimationFrame(step);
  };
  timerRaf = requestAnimationFrame(step);
  emit('storm:choice');
  screen.querySelector('[data-storm="evacuate"]').focus({ preventScroll: true });
}

function closeChoice() {
  if (timerRaf) cancelAnimationFrame(timerRaf);
  timerRaf = null;
  screen.classList.add('hidden');
}

// ---------- EVACUATE ----------
// Valida anche da alert/warning (azione "Evacuate to Bunker" durante la tempesta)
export function evacuate() {
  if (state.phase !== 'playing' || !['idle', 'choice'].includes(stage)) return false;
  closeChoice();
  stage = 'evacuating';
  emit('storm:evacuate');
  saved = state.crew.map(a => ({
    id: a.id,
    room: a.destination || a.location,
    task: a.task && a.task.id !== 'evacuate' ? a.task.id : null,
  }));
  // Labs in pausa con orologio, serra ferma
  showPaused(true);
  setGreenhouseFrozen(true);
  showBanner(T.bunkerBanner);
  // La crew cammina verso il bunker (il gioco riprende per permettere lo spostamento)
  internalAssign = true;
  try { for (const a of state.crew) assignAction(a.id, 'evacuate'); } finally { internalAssign = false; }
  resume('alert');
  walkStart = performance.now();
  checkArrival();
  return true;
}
export function isInternalAssign() { return internalAssign; }

function checkArrival() {
  if (stage !== 'evacuating' || state.phase !== 'playing') return;
  const all = state.crew.every(a => a.location === 'bunker' && !a.destination);
  if (!all && (performance.now() - walkStart) / 1000 < E.bunkerWalkTimeoutSeconds) return;
  if (!all) {
    // Fallback: la crew non riesce a muoversi (es. pausa utente) -> spostamento diretto
    for (const a of state.crew) { a.location = 'bunker'; a.destination = null; a.task = null; }
    layoutRoom('bunker');
  }
  startBunkerJump();
}

// Salto di 1 Sol animato (bunker): il loop è in pausa e il tempo avanza con advanceSols
function startBunkerJump() {
  stage = 'bunker';
  pause('bunker');
  let done = 0;
  let last = performance.now();
  const total = S.bunkerSkipSols;
  const step = now => {
    if (stage !== 'bunker' || state.phase !== 'playing') return;
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    const d = Math.min(total - done, total * dt / E.bunkerJumpSeconds);
    if (d > 0) { advanceSols(d); done += d; }
    if (state.phase !== 'playing') return;
    if (done >= total - 1e-9) { endBunker(); return; }
    animRaf = requestAnimationFrame(step);
  };
  animRaf = requestAnimationFrame(step);
}

function endBunker() {
  animRaf = null;
  // Arrotonda all'inizio del Sol (piccoli residui numerici)
  if (state.solProgress > 0.999) { state.solProgress = 0; }
  stage = 'badge';
  resume('bunker');
  showBanner('');
  showBadge('solar', { onClose: returnCrew });
}

// CONTINUE MISSION: la crew torna alle stanze precedenti e riprende le attività
function returnCrew() {
  showPaused(false);
  setGreenhouseFrozen(false);
  for (const s of saved) {
    const a = state.crew.find(c => c.id === s.id);
    if (!a) continue;
    a.task = null;
    const act = s.task || GO_ACTION[s.room];
    if (act) {
      internalAssign = true;
      try { assignAction(a.id, act); } finally { internalAssign = false; }
    }
  }
  saved = [];
  finish('evacuate');
}

// ---------- ACTIVATE SHIELDS ----------
export function activateShields() {
  if (state.phase !== 'playing' || !['idle', 'choice'].includes(stage)) return false;
  closeChoice();
  state.power = clamp(state.power - S.shieldsPowerCost, 0, CONFIG.resources.powerMax);
  state.shield = clamp(state.shield - E.stormShieldsShieldCost, 0, 100);
  for (const a of state.crew) a.radiation = clamp(a.radiation + S.shieldsRadiation, 0, 100);
  emit('storm:shields');
  showToast(T.shieldsToast);
  resume('alert');
  finish('shields');
  return true;
}

// ---------- Timer scaduto: crollo della salute e MISSION FAILED ----------
function timeExpired() {
  closeChoice();
  stage = 'exposed';
  emit('storm:timeout');
  exposedEl.classList.remove('hidden');
  const start = performance.now();
  const h0 = state.crew.map(a => a.health);
  const r0 = state.crew.map(a => a.radiation);
  const dur = E.stormCollapseSeconds * 1000;
  const step = now => {
    if (stage !== 'exposed' || state.phase !== 'playing') return;
    const k = clamp((now - start) / dur, 0, 1);
    const ease = k * k;
    if (k >= 1) {
      state.crew.forEach(a => { a.health = 0; a.radiation = 100; });
      exposedEl.classList.add('hidden');
      stage = 'idle';
      failMission('storm');
      return;
    }
    // Resta sopra zero fino alla fine per mostrare il messaggio corretto
    state.crew.forEach((a, i) => {
      a.health = Math.max(0.5, h0[i] * (1 - ease));
      a.radiation = clamp(r0[i] + (100 - r0[i]) * ease, 0, 100);
    });
    emit('update');
    animRaf = requestAnimationFrame(step);
  };
  animRaf = requestAnimationFrame(step);
}

function finish(result) {
  stage = 'idle';
  onDone(result);
}

// ---------- UI di supporto ----------
function showPaused(v) {
  pausedEl?.remove();
  pausedEl = null;
  if (!v) return;
  const map = getMapEl();
  const room = getRoomEl('labs');
  if (!map || !room) return;
  pausedEl = document.createElement('div');
  pausedEl.className = 'room-paused';
  ['left', 'top', 'width', 'height'].forEach(k => { pausedEl.style[k] = room.style[k]; });
  pausedEl.innerHTML = `<svg viewBox="0 0 100 100" aria-label="Paused"><circle cx="50" cy="50" r="44" fill="#FFFFFF" stroke="#1A1B33" stroke-width="4"/><path d="M50 18 V50 L70 64" fill="none" stroke="#1A1B33" stroke-width="4" stroke-linecap="round"/></svg>`;
  map.appendChild(pausedEl);
}

function showBanner(text) {
  if (!bannerEl) {
    bannerEl = document.createElement('div');
    bannerEl.className = 'storm-banner hidden';
    sceneEl.appendChild(bannerEl);
  }
  bannerEl.textContent = text;
  bannerEl.classList.toggle('hidden', !text);
}

export function showToast(text, ms = 4500) {
  if (!toastEl) return;
  toastEl.textContent = text;
  toastEl.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.add('hidden'), ms);
}

function stopAll() {
  closeChoice();
  if (animRaf) cancelAnimationFrame(animRaf);
  animRaf = null;
  stage = 'idle';
  saved = [];
  showPaused(false);
  showBanner('');
  exposedEl?.classList.add('hidden');
  toastEl?.classList.add('hidden');
  if (state.greenhouse) state.greenhouse.frozen = false;
  resume('bunker');
}
