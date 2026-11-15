// Notte lunare (Flusso 3) e Base Power Control Panel a 2 pagine (f3-02, f3-03, f3-04)
// "!" su Life Support al Sol 14 -> modale notte -> MANAGE ENERGY -> pannello; badge Power + 28 Sol a fine notte.
import { CONFIG } from '../config.js';
import { state, isNight } from '../state.js';
import { on, emit, onAlert, pause, resume } from '../loop.js';
import { getMapEl, roomCenter, MAP_W, MAP_H } from '../map.js';
import { closeMenu, getSelected } from '../crew.js';
import { showModal } from './modal.js';
import { showBadge } from '../badges.js';
import { setWinSequence } from './endgame.js';
import { fmtPct } from '../hud.js';
import {
  LEVELS, levelOf, nominalOf, actualOf, isOccupied, dailyConsumption, nominalConsumption,
  minLevelOf, isAdjustable, setSystem, setAll, commonLevel, setDifficulty, badgeFactor,
} from '../power.js';

const TX = CONFIG.eventTexts.lunarNight;
const M = CONFIG.mission;
const R = CONFIG.rates;

// Etichette come nel Figma (nome + descrizione)
const LABELS = {
  lifeSupport:     ['Life Support (Air)', 'O2 Making & Air Cleaning'],
  warmth:          ['Warmth (Heating)', 'Base temperature'],
  waterRecycling:  ['Water Recycling', `${R.waterRecycledPct}% Water recycled`],
  communications:  ['Communications', 'Earth-Moon radio Online'],
  radiationShield: ['Radiation Shield', 'Standby - Raise it during Solar Storms'],
};
const PAGE_GROUP = { 1: 'crewSafety', 2: 'baseRooms' };

// Numero con virgola decimale (stile Figma "2,5")
function fmt(v, dec = 1) {
  const r = Math.round(v * 10 ** dec) / 10 ** dec;
  return Number.isInteger(r) ? String(r) : r.toFixed(dec).replace('.', ',');
}
const levelIndex = l => Math.max(0, LEVELS.indexOf(l));

// ---------- Stato modulo ----------
let screen = null, rowsEls = {}, cardEls = {}, globalBtns = [], modeBtns = [], hintEl, nextBtn, miniEl;
let openFlag = false;
let page = 1;
let nightStage = 'idle';         // idle | alert | ack
let icon = null;
let hintTimer = null;
const textCache = new WeakMap(); // evita riscritture DOM inutili

function setText(el, txt) {
  if (el && textCache.get(el) !== txt) { el.textContent = txt; textCache.set(el, txt); }
}

// ---------- DOM ----------
function rowHtml(sys, compact) {
  const [name, desc] = LABELS[sys.id] || [sys.name, ''];
  return `
    <div class="pp-row${compact ? ' compact' : ''}" data-sys="${sys.id}">
      <div class="pp-row-head">
        <div><p class="pp-name">${name}</p>${!compact && desc ? `<p class="pp-desc">${desc}</p>` : ''}</div>
        <p class="pp-cost"><span class="pp-cost-val"></span><span class="pp-idle"></span></p>
      </div>
      <div class="pp-ticks">
        <button type="button" data-tick="OFF">0% OFF</button>
        <button type="button" data-tick="ECO">50% ECO</button>
        <button type="button" data-tick="MAX">100% MAX</button>
      </div>
      <input type="range" class="pp-slider" min="0" max="2" step="1" value="1" aria-label="${name} power level">
    </div>`;
}

function cardHtml(id, label) {
  return `<div class="pp-card" data-card="${id}"><p class="pp-card-label">${label}</p><p class="pp-card-value"></p><p class="pp-card-sub"></p></div>`;
}

export function initPowerPanel(sceneEl) {
  const group = g => CONFIG.powerSystems.filter(s => s.group === g);
  screen = document.createElement('div');
  screen.className = 'pp-screen hidden';
  screen.setAttribute('role', 'dialog');
  screen.setAttribute('aria-modal', 'true');
  screen.setAttribute('aria-label', 'Base Power Control Panel');
  screen.innerHTML = `
    <div class="pp-inner">
      <section class="pp-page" data-page="1">
        <h1 class="pp-title">Crew Safety and basics</h1>
        <p class="pp-sub">These stay on at least 50% to keep the crew safe</p>
        <div class="pp-rows">${group('crewSafety').map(s => rowHtml(s, false)).join('')}</div>
        <div class="pp-cards">
          ${cardHtml('battery', 'Battery reserve')}
          ${cardHtml('solar', 'Solar Panel Efficiency')}
          ${cardHtml('daily', 'Daily Energy Consumption')}
          ${cardHtml('o2', 'O2 Level')}
          ${cardHtml('water', 'Water Reserve Level H2O')}
        </div>
      </section>
      <section class="pp-page hidden" data-page="2">
        <h1 class="pp-title">Lunar base rooms</h1>
        <p class="pp-sub">Slide each room to choose how much power it gets</p>
        <div class="pp-rows">${group('baseRooms').map(s => rowHtml(s, true)).join('')}</div>
        <div class="pp-global" role="group" aria-label="Set all rooms">
          <p class="pp-global-label">ALL SYSTEMS</p>
          <button type="button" data-all="MAX">MAX</button>
          <button type="button" data-all="ECO">ECO</button>
          <button type="button" data-all="OFF">OFF</button>
        </div>
        <div class="pp-mini"></div>
      </section>
      <div class="pp-mode" role="group" aria-label="Difficulty">
        <span>MODE</span>
        <button type="button" data-mode="easy">EASY</button>
        <button type="button" data-mode="hard">HARD</button>
      </div>
      <p class="pp-hint"></p>
      <button type="button" class="pp-nav pp-back" data-pp="back"><span aria-hidden="true">&larr;</span> BACK</button>
      <button type="button" class="pp-nav pp-next" data-pp="next">NEXT<br>PAGE <span aria-hidden="true">&rarr;</span></button>
    </div>`;
  sceneEl.appendChild(screen);

  for (const row of screen.querySelectorAll('.pp-row')) {
    rowsEls[row.dataset.sys] = {
      row,
      slider: row.querySelector('.pp-slider'),
      cost: row.querySelector('.pp-cost-val'),
      idle: row.querySelector('.pp-idle'),
      ticks: [...row.querySelectorAll('[data-tick]')],
    };
  }
  for (const c of screen.querySelectorAll('[data-card]')) {
    cardEls[c.dataset.card] = { el: c, value: c.querySelector('.pp-card-value'), sub: c.querySelector('.pp-card-sub') };
  }
  globalBtns = [...screen.querySelectorAll('[data-all]')];
  modeBtns = [...screen.querySelectorAll('[data-mode]')];
  hintEl = screen.querySelector('.pp-hint');
  nextBtn = screen.querySelector('[data-pp="next"]');
  miniEl = screen.querySelector('.pp-mini');

  // Slider: cambio livello del singolo sistema (solo HARD)
  screen.addEventListener('input', e => {
    const sl = e.target.closest('.pp-slider');
    if (!sl || !openFlag || state.phase !== 'playing') return;
    trySet(sl.closest('.pp-row').dataset.sys, LEVELS[Number(sl.value)]);
  });
  screen.addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b || !openFlag || state.phase !== 'playing') return;
    if (b.dataset.tick) trySet(b.closest('.pp-row').dataset.sys, b.dataset.tick);
    else if (b.dataset.all) setAll(b.dataset.all);
    else if (b.dataset.mode) setDifficulty(b.dataset.mode);
    else if (b.dataset.pp === 'next') showPage(2);
    else if (b.dataset.pp === 'back') { if (page === 2) showPage(1); else closePowerPanel(); }
    render();
  });
  document.addEventListener('keydown', e => {
    if (openFlag && e.key === 'Escape') closePowerPanel();
  });

  on('update', render);
  on('newSol', onNewSol);
  on('action:powerPanel', () => { if (state.phase === 'playing') openFromMap(); });
  on('room:click', roomId => {
    if (state.phase !== 'playing' || getSelected() || roomId !== 'lifeSupport') return;
    if (nightStage !== 'idle') openFromMap();
  });
  on('fail', () => { closePowerPanel(); hideIcon(); });
  on('win', () => { closePowerPanel(); hideIcon(); });
  on('reset', () => { closePowerPanel(); hideIcon(); nightStage = 'idle'; page = 1; });

  setWinSequence(endOfNight);

  // Partenza con ?sol=N: al Sol 14 parte l'alert, più avanti l'icona resta come scorciatoia al pannello
  if (state.sol === M.nightStartSol) startNight();
  else if (isNight()) { nightStage = 'ack'; markActive(); showIcon(true); }
}

// ---------- Regole slider ----------
function trySet(id, level) {
  if (!rowsEls[id]) return;
  if (!isAdjustable(id)) {
    const fixed = CONFIG.powerSystems.find(s => s.id === id)?.fixed;
    flashHint(fixed ? `${LABELS[id]?.[0] || 'Bunker and Airlock'} always stays on ECO.` : 'EASY mode: use the ALL MAX / ALL ECO / ALL OFF switch. Switch to HARD to set each system.');
    render(true);
    return;
  }
  const applied = setSystem(id, level);
  if (applied && applied !== level) flashHint('Crew safety systems must stay at least at 50% (ECO).');
  render(true);
}

function flashHint(text) {
  hintEl.textContent = text;
  hintEl.classList.add('warn');
  clearTimeout(hintTimer);
  hintTimer = setTimeout(() => { hintEl.classList.remove('warn'); textCache.delete(hintEl); render(true); }, 3000);
  textCache.set(hintEl, text);
}

// ---------- Apertura / chiusura ----------
export function openPowerPanel(p = 1) {
  if (!screen || state.phase !== 'playing') return false;
  if (!openFlag) {
    openFlag = true;
    closeMenu();
    screen.classList.remove('hidden');
    pause('powerpanel');
    emit('power:open');
  }
  showPage(p);
  render(true);
  return true;
}

export function closePowerPanel() {
  if (!openFlag) return;
  openFlag = false;
  screen.classList.add('hidden');
  resume('powerpanel');
  emit('power:close');
}

export function isPowerPanelOpen() { return openFlag; }

function showPage(p) {
  page = p === 2 ? 2 : 1;
  for (const sec of screen.querySelectorAll('.pp-page')) sec.classList.toggle('hidden', Number(sec.dataset.page) !== page);
  nextBtn.classList.toggle('hidden', page !== 1);
  render(true);
}

// Da mappa (azione Check Power Panel, "!" o click su Life Support di notte)
function openFromMap() {
  if (nightStage === 'alert') respondNight();
  else openPowerPanel(1);
}

// ---------- Notte lunare ----------
function markActive() {
  if (!state.events.active.includes('lunarNight')) state.events.active.push('lunarNight');
}

function startNight() {
  if (state.phase !== 'playing' || nightStage !== 'idle') return;
  nightStage = 'alert';
  markActive();
  emit('event:start', 'lunarNight');
  showIcon(false);
  onAlert();
}

function respondNight() {
  if (nightStage !== 'alert' || state.phase !== 'playing') return;
  hideIcon();
  nightStage = 'ack';
  showModal({
    type: 'warning', theme: 'night', ...TX,
    onClose: () => {
      resume('alert');
      showIcon(true);
      openPowerPanel(1);
    },
  });
}

function onNewSol(sol) {
  if (state.phase !== 'playing') return;
  if (sol === M.nightStartSol) startNight();
}

// Fine notte (Sol 28 con power > 0): badge Power e 28 Sol in sequenza, poi vittoria
function endOfNight(done) {
  closePowerPanel();
  hideIcon();
  state.events.active = state.events.active.filter(x => x !== 'lunarNight');
  if (!state.events.done.includes('lunarNight')) state.events.done.push('lunarNight');
  emit('event:end', 'lunarNight');
  const first = showBadge('power', { onClose: () => {
    const second = showBadge('sol28', { onClose: done });
    if (!second) done();
  } });
  if (!first) done();
}

// ---------- Icona "!" su Life Support ----------
function showIcon(ongoing) {
  hideIcon();
  const map = getMapEl();
  if (!map) return;
  const c = roomCenter('lifeSupport');
  icon = document.createElement('button');
  icon.type = 'button';
  icon.className = `event-alert${ongoing ? ' ongoing' : ''}`;
  icon.dataset.event = 'lunarNight';
  icon.setAttribute('aria-label', ongoing ? 'Open the power panel' : 'Alert: the lunar night begins');
  icon.textContent = '!';
  icon.style.left = `${c.x * MAP_W + 84}px`;
  icon.style.top = `${c.y * MAP_H - 62}px`;
  icon.addEventListener('click', e => {
    e.stopPropagation();
    if (state.phase !== 'playing') return;
    openFromMap();
  });
  map.appendChild(icon);
}
function hideIcon() {
  icon?.remove();
  icon = null;
}

// ---------- Rendering ----------
function colorClass(v, good, warn) {
  return v >= good ? 'c-green' : v >= warn ? 'c-yellow' : 'c-red';
}
function setColor(el, cls) {
  if (el.dataset.c === cls) return;
  el.classList.remove('c-green', 'c-yellow', 'c-red');
  el.classList.add(cls);
  el.dataset.c = cls;
}

function render(force = false) {
  if (!openFlag || !screen) return;
  const s = state;
  const hard = s.difficulty === 'hard';
  const bf = badgeFactor();

  // Righe
  for (const [id, r] of Object.entries(rowsEls)) {
    const lvl = levelOf(id);
    const idx = levelIndex(lvl);
    if (force || document.activeElement !== r.slider || Number(r.slider.value) !== idx) {
      if (Number(r.slider.value) !== idx) r.slider.value = String(idx);
    }
    r.slider.style.setProperty('--p', `${idx * 50}%`);
    const adj = isAdjustable(id);
    r.slider.disabled = !adj;
    r.row.classList.toggle('locked', !adj);
    r.row.classList.toggle('is-off', lvl === 'OFF');
    const min = levelIndex(minLevelOf(id));
    r.ticks.forEach((t, i) => {
      t.classList.toggle('active', i === idx);
      t.classList.toggle('blocked', adj && i < min);
      t.disabled = !adj;
    });
    const nom = nominalOf(id) * bf;
    setText(r.cost, nom > 0 ? `-${fmt(nom)} units/day` : '0 units/day');
    const idle = lvl === 'ECO' && !isOccupied(id) && actualOf(id) === 0 && CONFIG.powerOccupancy[id];
    setText(r.idle, idle ? 'empty room: 0 now' : '');
  }

  // Pulsanti globali e switch difficoltà
  const common = commonLevel();
  globalBtns.forEach(b => b.classList.toggle('active', b.dataset.all === common));
  modeBtns.forEach(b => {
    const on = b.dataset.mode === s.difficulty;
    b.classList.toggle('active', on);
    b.setAttribute('aria-pressed', on ? 'true' : 'false');
  });

  // Card live
  const nightLeft = isNight() ? Math.max(0, M.nightEndSol - (s.sol + s.solProgress)) : 0;
  const actual = dailyConsumption();
  const nominal = nominalConsumption();
  const powerPct = s.power / CONFIG.resources.powerMax * 100;

  const bat = cardEls.battery;
  setText(bat.value, `${Math.round(s.power)}/${CONFIG.resources.powerMax} units`);
  setColor(bat.value, colorClass(powerPct, 50, 20));
  setText(bat.sub, actual > 0 ? `Reserve for about ${fmt(s.power / actual)} days at current use` : 'No energy being used');

  const sol = cardEls.solar;
  const eff = isNight() ? 0 : 100;
  setText(sol.value, `${eff} %`);
  setColor(sol.value, eff > 0 ? 'c-green' : 'c-red');
  setText(sol.sub, `Solar Production: +${fmt(s.solarOutput / 24)} kW/h`);

  const dl = cardEls.daily;
  setText(dl.value, `${fmt(nominal)} units/day`);
  setText(dl.sub, Math.abs(actual - nominal) < 0.01
    ? `Hourly Energy Consumption: ${fmt(actual / 24)} units/h`
    : `Now: ${fmt(actual)} units/day, ${fmt(actual / 24)} units/h (empty ECO rooms off)`);
  let dcls;
  if (nightLeft > 0) {
    const need = actual * nightLeft;
    dcls = s.power > need * 1.2 ? 'c-green' : s.power > need ? 'c-yellow' : 'c-red';
  } else dcls = actual <= s.solarOutput ? 'c-green' : 'c-yellow';
  setColor(dl.value, dcls);

  const o2 = cardEls.o2;
  setText(o2.value, fmtPct(s.oxygen));
  setColor(o2.value, colorClass(s.oxygen, 80, 50));
  setText(o2.sub, `Crew O2 Consumption: ${fmt(R.crewOxygenKgPerDay, 2)} kg/day`);

  const wt = cardEls.water;
  setText(wt.value, fmtPct(s.water));
  setColor(wt.value, colorClass(s.water, 80, 50));
  setText(wt.sub, `Crew Water Consumption: ${fmt(R.waterLitresPerDay)} L/day`);

  // Riepilogo pagina 2
  const mini = `Daily: ${fmt(nominal)} units/day (now ${fmt(actual)}) · Battery ${Math.round(s.power)}/${CONFIG.resources.powerMax}`
    + (nightLeft > 0 ? ` · Night: ${Math.ceil(nightLeft)} Sol left` : '');
  setText(miniEl, mini);

  // Suggerimento (se non c'è un avviso temporaneo)
  if (!hintEl.classList.contains('warn')) {
    const txt = hard
      ? 'HARD mode: slide each system. Radiation Shield OFF = no magnetic shields in storms.'
      : (page === 1 ? 'EASY mode: use the ALL MAX / ALL ECO / ALL OFF switch on the next page.' : 'EASY mode: use the ALL MAX / ALL ECO / ALL OFF switch.');
    setText(hintEl, txt);
  }
}

// API debug (window.game.power)
export const powerApi = {
  open: openPowerPanel,
  close: closePowerPanel,
  get isOpen() { return openFlag; },
  get page() { return page; },
  setPage: showPage,
  setAll,
  set: (id, level) => setSystem(id, level),
  get: id => levelOf(id),
  setDifficulty,
  daily: () => dailyConsumption(),
  nominal: () => nominalConsumption(),
  get levels() { return { ...state.roomPower }; },
  get nightStage() { return nightStage; },
  startNight,
};
