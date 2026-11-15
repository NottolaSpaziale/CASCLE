// Punto d'ingresso: collega stato, loop, HUD e schermate di fine partita
import { CONFIG } from './config.js';
import { state, resetState, isNight } from './state.js';
import * as loop from './loop.js';
import { initHud, setHudMode } from './hud.js';
import { initEndgame, failMission, winMission, restartMission, checkWin } from './screens/endgame.js';

const stage = document.getElementById('stage');
const scene = document.getElementById('scene');

// Scala lo stage 1280x720 alla finestra mantenendo il 16:9 (letterbox)
function fitStage() {
  const s = Math.min(window.innerWidth / 1280, window.innerHeight / 720);
  stage.style.transform = `translate(-50%, -50%) scale(${s})`;
}
window.addEventListener('resize', fitStage);
fitStage();

initHud(document.getElementById('topbar'));
initEndgame(scene, stage);

// Parametro debug ?sol=N: parte dal Sol N con risorse coerenti
function applySolParam() {
  try {
    const n = parseInt(new URLSearchParams(window.location.search).get('sol'), 10);
    if (Number.isFinite(n) && n > CONFIG.mission.startSol) {
      loop.fastForwardTo(n);
      checkWin();
    }
  } catch (e) { console.warn('Parametro sol non valido', e); }
}
applySolParam();

// API pubblica per test/debug e per i moduli futuri
window.game = {
  state,
  config: CONFIG,
  on: loop.on, off: loop.off, emit: loop.emit,
  onTick: loop.onTick, onNewSol: loop.onNewSol,
  setSpeed: loop.setSpeed,
  pause: loop.pause, resume: loop.resume, togglePause: loop.togglePause,
  onAlert: loop.onAlert,
  advanceSols: loop.advanceSols,
  computeDailyConsumption: loop.computeDailyConsumption,
  isNight,
  setHudMode,
  failMission, winMission, restartMission,
  reset: restartMission,
  resetState,
};

// Stato sintetico per i test automatici
window.__game = {
  get state() {
    if (state.phase === 'failed') return 'gameover';
    if (state.phase === 'won') return 'won';
    return state.paused ? 'paused' : 'playing';
  },
  get score() { return state.sol; },
};

loop.startLoop();
