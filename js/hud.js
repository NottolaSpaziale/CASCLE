// Top bar (HUD): barre risorse + pillola SOL con menu velocità/pausa
import { CONFIG } from './config.js';
import { state } from './state.js';
import { on, setSpeed, togglePause } from './loop.js';

// Formatta una percentuale come nel Figma: "84,5 %" / "89 %"
export function fmtPct(v) {
  const r = Math.round(v * 10) / 10;
  return `${Number.isInteger(r) ? r : r.toFixed(1).replace('.', ',')} %`;
}

// Definizione degli slot visualizzabili
const SLOTS = {
  power:       { label: 'POWER',        cls: 'bar-power',  value: s => s.power / CONFIG.resources.powerMax * 100, text: s => `${Math.round(s.power)} / ${CONFIG.resources.powerMax} kW` },
  oxygen:      { label: 'OXYGEN',       cls: 'bar-oxygen', value: s => s.oxygen, text: s => fmtPct(s.oxygen) },
  water:       { label: 'WATER',        cls: 'bar-water',  value: s => s.water, text: s => fmtPct(s.water) },
  shield:      { label: 'SHIELD',       cls: 'bar-shield', value: s => s.shield, text: s => fmtPct(s.shield) },
  plantHealth: { label: 'PLANT HEALTH', cls: 'bar-plant',  value: s => s.plantHealth, text: s => fmtPct(s.plantHealth) },
};
const MODES = {
  base: ['power', 'oxygen', 'water', 'shield'],
  greenhouse: ['power', 'water', 'plantHealth'],
};

let root, slotsEl, pill, pillSol, pillSpeed, menu, pauseBtn;
let mode = 'base';
let slotEls = [];
let lastKey = '';

export function initHud(container) {
  root = container;
  root.innerHTML = `
    <div class="hud-slots"></div>
    <div class="sol-wrap">
      <button type="button" class="sol-pill" aria-haspopup="true" aria-expanded="false">
        <span class="sol-text">SOL 1</span><span class="sol-speed">1x</span>
      </button>
      <div class="speed-menu hidden" role="menu">
        ${CONFIG.time.speeds.map(v => `<button type="button" class="speed-btn" data-speed="${v}">${v}x</button>`).join('')}
        <button type="button" class="speed-btn pause-btn" data-pause>PAUSE</button>
      </div>
    </div>`;
  slotsEl = root.querySelector('.hud-slots');
  pill = root.querySelector('.sol-pill');
  pillSol = root.querySelector('.sol-text');
  pillSpeed = root.querySelector('.sol-speed');
  menu = root.querySelector('.speed-menu');
  pauseBtn = root.querySelector('[data-pause]');

  pill.addEventListener('click', e => { e.stopPropagation(); toggleMenu(); });
  menu.addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b || state.phase !== 'playing') return;
    if (b.dataset.speed) setSpeed(Number(b.dataset.speed));
    else if (b.hasAttribute('data-pause')) togglePause();
    toggleMenu(false);
  });
  // Chiusura menu cliccando fuori
  document.addEventListener('pointerdown', e => {
    if (!root.querySelector('.sol-wrap').contains(e.target)) toggleMenu(false);
  });
  // Tastiera: Spazio = pausa, 1-4 = velocità, Esc = chiudi menu
  document.addEventListener('keydown', e => {
    if (state.phase !== 'playing') return;
    if (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
    if (e.code === 'Space') { e.preventDefault(); togglePause(); }
    else if (e.key === 'Escape') toggleMenu(false);
    else if (['1', '2', '3', '4'].includes(e.key)) setSpeed(CONFIG.time.speeds[Number(e.key) - 1]);
  });

  setHudMode('base');
  on('update', renderHud);
  on('fail', () => toggleMenu(false));
  on('win', () => toggleMenu(false));
}

// Cambia gli slot mostrati ('base' | 'greenhouse')
export function setHudMode(m) {
  mode = MODES[m] ? m : 'base';
  slotsEl.innerHTML = '';
  slotEls = MODES[mode].map(id => {
    const def = SLOTS[id];
    const el = document.createElement('div');
    el.className = 'hud-slot';
    el.dataset.slot = id;
    el.innerHTML = `
      <div class="hud-label">${def.label}</div>
      <div class="hud-value"></div>
      <div class="hud-track"><div class="hud-fill ${def.cls}"></div></div>`;
    slotsEl.appendChild(el);
    return { def, value: el.querySelector('.hud-value'), fill: el.querySelector('.hud-fill') };
  });
  lastKey = '';
  renderHud();
}

function toggleMenu(force) {
  const open = force === undefined ? menu.classList.contains('hidden') : force;
  if (open && state.phase !== 'playing') return;
  menu.classList.toggle('hidden', !open);
  pill.setAttribute('aria-expanded', String(open));
}

// Aggiorna il DOM solo se i valori mostrati cambiano
export function renderHud() {
  if (!root) return;
  const texts = slotEls.map(s => s.def.text(state));
  const paused = state.paused;
  const key = texts.join('|') + `|${state.sol}|${state.speed}|${paused}|` +
    slotEls.map(s => s.def.value(state).toFixed(1)).join(',');
  if (key === lastKey) return;
  lastKey = key;

  slotEls.forEach((s, i) => {
    s.value.textContent = texts[i];
    const v = Math.max(0, Math.min(100, s.def.value(state)));
    s.fill.style.width = `${v}%`;
  });
  pillSol.textContent = `SOL ${state.sol}`;
  pillSpeed.textContent = paused ? 'II' : `${state.speed}x`;
  pill.classList.toggle('is-paused', paused);
  pauseBtn.textContent = state.pauseReasons.includes('user') ? 'RESUME' : 'PAUSE';
  menu.querySelectorAll('[data-speed]').forEach(b =>
    b.classList.toggle('active', Number(b.dataset.speed) === state.speed));
}
