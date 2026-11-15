// Fine partita: MISSION FAILED (scala di grigi) e MISSION COMPLETE
import { CONFIG } from '../config.js';
import { state, resetState } from '../state.js';
import { on, emit, resume } from '../loop.js';

let scene, overlay, titleEl, msgEl, btnEl, badgesEl;
// Sequenza prima della vittoria (Modulo 4: badge Power e 28 Sol); riceve la callback finale
let winSequence = null;
let winPending = false;
export function setWinSequence(fn) { winSequence = typeof fn === 'function' ? fn : null; }

// Crea l'overlay e registra i controlli sul bus
export function initEndgame(sceneEl, stageEl) {
  scene = sceneEl;
  overlay = document.createElement('div');
  overlay.id = 'endgame';
  overlay.className = 'endgame hidden';
  overlay.innerHTML = `
    <div class="endgame-modal" role="dialog" aria-modal="true">
      <h1 class="endgame-title"></h1>
      <p class="endgame-msg"></p>
      <div class="endgame-badges"></div>
      <button type="button" class="btn-primary endgame-btn">START AGAIN</button>
    </div>`;
  stageEl.appendChild(overlay);
  titleEl = overlay.querySelector('.endgame-title');
  msgEl = overlay.querySelector('.endgame-msg');
  btnEl = overlay.querySelector('.endgame-btn');
  badgesEl = overlay.querySelector('.endgame-badges');
  btnEl.addEventListener('click', restartMission);

  on('tick', checkFail);
  on('update', checkFail);
  on('newSol', checkWin);
}

// Restituisce la causa di sconfitta attuale, o null
export function getFailCause() {
  const s = state;
  if (s.power <= 0) return { cause: 'power' };
  if (s.oxygen <= 0) return { cause: 'oxygen' };
  if (s.water <= 0) return { cause: 'water' };
  if (s.shield <= 0) return { cause: 'shield' };
  if (s.plantHealth <= 0) return { cause: 'plantHealth' };
  const dead = s.crew.find(a => a.health <= 0);
  if (dead) return { cause: 'crewHealth', name: dead.name };
  // Tutti i sistemi spenti (il bunker è fisso ECO e non conta)
  const switchable = CONFIG.powerSystems.filter(p => !p.fixed);
  if (switchable.every(p => s.roomPower[p.id] === 'OFF')) return { cause: 'allOff' };
  return null;
}

export function checkFail() {
  if (state.phase !== 'playing') return;
  const f = getFailCause();
  if (f) failMission(f.cause, f);
}

// Vittoria all'inizio del Sol 28 con power > 0
export function checkWin() {
  if (state.phase !== 'playing') return;
  if (state.sol >= CONFIG.mission.winSol) {
    if (state.power <= 0) { failMission('power'); return; }
    if (winPending) return;
    if (winSequence) {
      winPending = true;
      winSequence(() => { winPending = false; winMission(); });
    } else winMission();
  }
}

// Sconfitta: scena in grigio e non cliccabile, modale con messaggio per causa
export function failMission(cause = 'default', extra = {}) {
  if (state.phase !== 'playing') return;
  const tpl = CONFIG.failMessages[cause] || CONFIG.failMessages.default;
  const name = extra.name || state.crew.find(a => a.health <= 0)?.name || 'An astronaut';
  state.phase = 'failed';
  state.failCause = cause;
  state.failMessage = tpl.replace('{name}', name);
  showOverlay('failed', 'MISSION FAILED', state.failMessage, 'START AGAIN');
  emit('fail', cause);
  emit('update');
}

// Vittoria: messaggio + badge ottenuti
export function winMission() {
  if (state.phase !== 'playing') return;
  state.phase = 'won';
  const msg = `${CONFIG.winText.message} Power left: ${Math.round(state.power)} / ${CONFIG.resources.powerMax}.`;
  showOverlay('won', CONFIG.winText.title, msg, 'START AGAIN');
  // Badge ottenuti nella partita
  badgesEl.innerHTML = (state.badges || []).filter(id => CONFIG.badgeImages[id]).map(id =>
    `<figure class="endgame-badge"><img src="${CONFIG.badgeImages[id].on}" alt="${CONFIG.badges[id].name} badge" draggable="false"><figcaption>${CONFIG.badges[id].name}</figcaption></figure>`).join('');
  emit('win');
  emit('update');
}

function showOverlay(kind, title, msg, btn) {
  titleEl.textContent = title;
  badgesEl.innerHTML = '';
  msgEl.textContent = msg;
  btnEl.textContent = btn;
  overlay.classList.remove('hidden', 'is-failed', 'is-won');
  overlay.classList.add(kind === 'failed' ? 'is-failed' : 'is-won');
  scene.classList.toggle('grayscale', kind === 'failed');
  scene.classList.add('locked');
  btnEl.focus();
}

// START AGAIN: torna al Sol 1 (rimuove ?sol dall'URL)
export function restartMission() {
  overlay.classList.add('hidden');
  winPending = false;
  scene.classList.remove('grayscale', 'locked');
  try {
    const url = new URL(window.location.href);
    if (url.searchParams.has('sol')) {
      url.searchParams.delete('sol');
      history.replaceState(null, '', url.pathname + url.search + url.hash);
    }
  } catch (e) { /* URL non modificabile: si ignora */ }
  resetState();
  resume();
  emit('reset');
  emit('update');
}
