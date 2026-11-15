// Coda eventi (§12.4): serra (Sol ~4), tempesta SEP (Sol ~8), avvisi FLR/CME casuali a basso rischio.
// Ogni evento: icona "!" sulla stanza (o modale diretta per FLR/CME), velocità 1x + pausa finché il giocatore risponde.
import { CONFIG } from './config.js';
import { state } from './state.js';
import { on, emit, onAlert, resume } from './loop.js';
import { getMapEl, roomCenter, MAP_W, MAP_H } from './map.js';
import { getSelected } from './crew.js';
import { showModal, closeModal } from './screens/modal.js';
import { showBadge, hasBadge } from './badges.js';
import {
  initGreenhouse, openGreenhouse, closeGreenhouse, isGreenhouseOpen, startGreenhouseEvent,
  waterPlants, setLight, ensureGreenhouse,
} from './screens/greenhouse.js';
import {
  initStorm, openStormChoice, evacuate, activateShields, getStormStage, stormTimeLeft, showToast,
} from './screens/storm.js';

const EV = CONFIG.events;
const TX = CONFIG.eventTexts;
export const EVENT_IDS = ['greenhouse', 'storm', 'flr', 'cme'];
// Stanza dell'icona "!" per evento
const ALERT_ROOM = { greenhouse: 'labs', storm: 'comms' };

const pending = [];              // eventi in coda
let current = null;              // { id, stage: 'alert' | 'warning' | 'info' | 'running', modal }
const icons = {};                // id -> elemento "!"

const isActive = id => state.events.active.includes(id);
const isDone = id => state.events.done.includes(id);
function markActive(id) { if (!isActive(id)) state.events.active.push(id); }
function markDone(id) {
  state.events.active = state.events.active.filter(x => x !== id);
  if (!isDone(id)) state.events.done.push(id);
}

// ---------- Icona "!" sulla mappa ----------
function showIcon(id, ongoing = false) {
  hideIcon(id);
  const map = getMapEl();
  const room = ALERT_ROOM[id];
  if (!map || !room) return;
  const c = roomCenter(room);
  const el = document.createElement('button');
  el.type = 'button';
  el.className = `event-alert${ongoing ? ' ongoing' : ''}`;
  el.dataset.event = id;
  el.setAttribute('aria-label', ongoing ? 'Open greenhouse' : 'Alert: click to see the warning');
  el.textContent = '!';
  el.style.left = `${c.x * MAP_W + 84}px`;
  el.style.top = `${c.y * MAP_H - 62}px`;
  el.addEventListener('click', e => {
    e.stopPropagation();
    if (state.phase !== 'playing') return;
    respond(id);
  });
  map.appendChild(el);
  icons[id] = el;
}
function hideIcon(id) {
  icons[id]?.remove();
  delete icons[id];
}
function hideAllIcons() { Object.keys(icons).forEach(hideIcon); }

// ---------- Coda ----------
export function trigger(id) {
  if (!EVENT_IDS.includes(id) || state.phase !== 'playing') return false;
  if (pending.includes(id) || current?.id === id) return false;
  if (id === 'greenhouse' && state.greenhouse?.eventActive) return false;
  if (id === 'storm' && isActive('storm')) return false;
  pending.push(id);
  process();
  return true;
}

function process() {
  if (current || !pending.length || state.phase !== 'playing') return;
  if (getStormStage() !== 'idle') return;
  start(pending.shift());
}

function start(id) {
  emit('event:start', id);
  if (id === 'flr' || id === 'cme') {
    // Avviso informativo a basso rischio: solo modale + OK
    current = { id, stage: 'info' };
    onAlert();
    const t = TX[id];
    current.modal = showModal({
      type: 'info', theme: id === 'flr' ? 'info' : 'caution', ...t,
      onClose: () => { resume('alert'); finish(id); },
    });
    markActive(id);
    return;
  }
  if (isGreenhouseOpen()) closeGreenhouse();
  markActive(id);
  if (id === 'greenhouse') startGreenhouseEvent();
  current = { id, stage: 'alert' };
  showIcon(id);
  onAlert();
}

function finish(id) {
  markDone(id);
  emit('event:end', id);
  if (current?.id === id) current = null;
  process();
}

// Il giocatore risponde all'alert ("!", click sulla stanza, azione collegata)
function respond(id) {
  if (current?.id === id && current.stage === 'alert') {
    hideIcon(id);
    current.stage = 'warning';
    const t = TX[id];
    current.modal = showModal({
      type: 'warning', theme: id === 'storm' ? 'red' : 'green', ...t,
      onClose: () => solve(id),
    });
    return;
  }
  // Evento serra già avviato: l'icona apre la schermata serra
  if (id === 'greenhouse' && state.greenhouse?.eventActive && !current) openGreenhouse();
}

// SOLVE
function solve(id) {
  if (state.phase !== 'playing') return;
  if (id === 'greenhouse') {
    resume('alert');
    current = null;
    showIcon('greenhouse', true);    // resta cliccabile finché l'evento è attivo
    openGreenhouse();
    process();
  } else if (id === 'storm') {
    current.stage = 'running';
    openStormChoice();
  }
}

// Evento serra risolto (dalla simulazione)
function onGreenhouseResolved() {
  hideIcon('greenhouse');
  if (current?.id === 'greenhouse') { current = null; resume('alert'); }
  markDone('greenhouse');
  emit('event:end', 'greenhouse');
  if (isGreenhouseOpen()) closeGreenhouse();
  if (!hasBadge('greenhouse')) showBadge('greenhouse');
  else showToast('The greenhouse is healthy again!');
  process();
}

// Tempesta conclusa (evacuate / shields)
function onStormDone() {
  hideIcon('storm');
  if (current?.id === 'storm') current = null;
  markDone('storm');
  emit('event:end', 'storm');
  process();
}

// "Evacuate to Bunker" durante una tempesta attiva vale come EVACUATE
function onEvacuateAction() {
  if (current?.id !== 'storm' || !['alert', 'warning', 'running'].includes(current.stage)) return;
  if (getStormStage() !== 'idle' && getStormStage() !== 'choice') return;
  // Fuori dal giro di assignAction in corso
  setTimeout(() => {
    if (current?.id !== 'storm' || state.phase !== 'playing') return;
    if (current.stage === 'warning' && current.modal) closeModal(current.modal, false);
    hideIcon('storm');
    current.stage = 'running';
    evacuate();
  }, 0);
}

// ---------- Trigger per Sol ----------
function checkSol(sol, { minor = true } = {}) {
  if (state.phase !== 'playing') return;
  const sch = state.events.schedule;
  if (sol === sch.greenhouse && !isDone('greenhouse') && !isActive('greenhouse')) trigger('greenhouse');
  else if (sol === sch.solarStorm && !isDone('storm') && !isActive('storm')) trigger('storm');
  else if (minor && sol !== sch.lunarNight && sol < CONFIG.mission.winSol && Math.random() < EV.minorFlareChancePerSol) {
    trigger(Math.random() < 0.5 ? 'flr' : 'cme');
  }
}

// Partenza con ?sol=N: l'evento casuale nel suo intervallo viene spostato a N; quelli passati sono saltati
function alignToStartSol() {
  const sol = state.sol;
  if (sol <= CONFIG.mission.startSol) return;
  const sch = state.events.schedule;
  if (sol >= EV.greenhouse.minSol && sol <= EV.greenhouse.maxSol) sch.greenhouse = sol;
  if (sol >= EV.solarStorm.minSol && sol <= EV.solarStorm.maxSol) sch.solarStorm = sol;
  if (sch.greenhouse < sol) markDone('greenhouse');
  if (sch.solarStorm < sol) markDone('storm');
  checkSol(sol, { minor: false });
}

function resetEvents() {
  pending.length = 0;
  current = null;
  hideAllIcons();
  ensureGreenhouse();
}

// ---------- Inizializzazione ----------
export function initEvents(sceneEl) {
  initGreenhouse(sceneEl);
  initStorm(sceneEl, { onDone: onStormDone });

  on('newSol', sol => checkSol(sol));
  on('greenhouse:resolved', onGreenhouseResolved);
  on('action:evacuate', onEvacuateAction);
  // "Manage the plants": apre la serra (o risponde all'alert serra)
  on('action:greenhouse', () => {
    if (state.phase !== 'playing') return;
    if (current?.id === 'greenhouse' && current.stage === 'alert') respond('greenhouse');
    else if (!current || current.id === 'greenhouse') openGreenhouse();
  });
  // "Check DONKI": risponde all'alert tempesta, altrimenti bollettino tranquillo
  on('action:donki', () => {
    if (state.phase !== 'playing') return;
    if (current?.id === 'storm' && current.stage === 'alert') respond('storm');
    else if (!current) showModal({ type: 'info', theme: 'info', ...TX.donkiQuiet });
  });
  // Click sulla stanza (senza astronauta selezionato) = click sull'icona "!"
  on('room:click', roomId => {
    if (state.phase !== 'playing' || getSelected()) return;
    if (roomId === 'labs' && (current?.id === 'greenhouse' || state.greenhouse?.eventActive)) respond('greenhouse');
    else if (roomId === 'comms' && current?.id === 'storm') respond('storm');
  });
  on('fail', () => { hideAllIcons(); });
  on('win', () => { hideAllIcons(); });
  on('reset', resetEvents);

  alignToStartSol();
}

// API di debug/test (window.game.events)
export const eventsApi = {
  trigger,
  get current() { return current ? { id: current.id, stage: current.stage } : null; },
  get pending() { return [...pending]; },
  respond,
  storm: {
    evacuate: () => { if (current?.id === 'storm') { current.stage = 'running'; hideIcon('storm'); } return evacuate(); },
    shields: activateShields,
    get stage() { return getStormStage(); },
    get timeLeft() { return stormTimeLeft(); },
  },
  greenhouse: {
    open: openGreenhouse, close: closeGreenhouse, water: waterPlants, setLight,
    get isOpen() { return isGreenhouseOpen(); },
  },
};
