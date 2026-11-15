// Punto d'ingresso: collega stato, loop, HUD e schermate di fine partita
import { CONFIG } from './config.js';
import { state, resetState, isNight } from './state.js';
import * as loop from './loop.js';
import { initHud, setHudMode } from './hud.js';
import { initMap, getRoomEl, roomCenter } from './map.js';
import * as crew from './crew.js';
import { ACTIONS, ROOM_GROUPS } from './actions.js';
import { initEndgame, failMission, winMission, restartMission, checkWin } from './screens/endgame.js';
import { initModal, showModal, closeModal } from './screens/modal.js';
import { initEvents, eventsApi } from './events.js';
import { showBadge, unlockBadge, hasBadge, badgeImage, cropGrowthMultiplier } from './badges.js';
import { initPowerPanel, powerApi } from './screens/powerpanel.js';
import { initTablet, tabletApi } from './screens/tablet.js';
import { initAudio, audioApi } from './audio.js';
import { initTitle, startMission, showTitle, isTitleVisible } from './screens/title.js';

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
// Mappa ed equipaggio (Modulo 2)
crew.initCrew(initMap(document.getElementById('map')));

// Parametro ?sol=N presente: salta la schermata titolo (test/giudici)
function hasSolParam() {
  try { return Number.isFinite(parseInt(new URLSearchParams(window.location.search).get('sol'), 10)); }
  catch (e) { return false; }
}

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

// Modulo 3: modali, serra, tempesta e coda eventi (dopo ?sol=N per allineare gli eventi)
initModal(scene);
initEvents(scene);
// Modulo 4: notte lunare e pannello energia
initPowerPanel(scene);
// Modulo 5: tablet (STATS, TASKS, BADGES, CREW HEALTH)
initTablet(scene);
// Modulo 6: audio (mute in top bar) e schermata titolo (saltata con ?sol=N)
initAudio(document.getElementById('topbar'));
initTitle(stage, scene, { skip: hasSolParam() });

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
  // Modulo 2: equipaggio e mappa
  crew: {
    assign: crew.assignAction,
    cancel: crew.cancelTask,
    select: crew.openRadial,
    closeMenu: crew.closeMenu,
    get selected() { return crew.getSelected(); },
    actions: ACTIONS,
    groups: ROOM_GROUPS,
  },
  map: { getRoomEl, roomCenter },
  // Modulo 3: eventi (debug: game.events.trigger('greenhouse'|'storm'|'flr'|'cme')), badge, modali
  events: eventsApi,
  badges: { show: showBadge, unlock: unlockBadge, has: hasBadge, image: badgeImage, cropGrowthMultiplier },
  modal: { show: showModal, close: closeModal },
  // Modulo 4: pannello energia (debug: game.power.setAll('eco'), game.power.set('gym', 'max'), game.power.open())
  power: powerApi,
  // Modulo 5: tablet (debug: game.tablet.open('health'), game.tablet.close(), game.tablet.isOpen, game.tablet.tab)
  tablet: tabletApi,
  // Modulo 6: audio (debug: game.audio.setMuted(true), game.audio.play('win')) e schermata titolo
  audio: audioApi,
  start: startMission,
  showTitle,
  get titleVisible() { return isTitleVisible(); },
};

// Stato sintetico per i test automatici
window.__game = {
  get state() {
    if (state.phase === 'failed') return 'gameover';
    if (state.phase === 'won') return 'won';
    if (state.phase === 'menu') return 'menu';
    return state.paused ? 'paused' : 'playing';
  },
  get score() { return state.sol; },
};

loop.startLoop();
