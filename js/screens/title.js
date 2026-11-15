// Modulo 6 – Schermata titolo: intro, switch difficoltà, START MISSION.
// Finché è visibile la fase è 'menu' (il loop non avanza, gli input di gioco sono ignorati).
import { CONFIG } from '../config.js';
import { state } from '../state.js';
import { emit } from '../loop.js';
import { setDifficulty } from '../power.js';

let overlay = null, sceneEl = null, modeBtns = [];
let visible = false;

// Piccole icone dei tre pericoli (SVG inline)
const ICONS = {
  greenhouse: '<svg viewBox="0 0 40 40" aria-hidden="true"><path d="M20 36V16" stroke="#2E5E0E" stroke-width="3" stroke-linecap="round"/><path d="M20 20C10 20 7 12 8 6c8 0 13 5 12 14z" fill="#3DDC6B" stroke="#2E5E0E" stroke-width="2"/><path d="M20 24c9 0 13-6 12-12-8 0-12 5-12 12z" fill="#A1E47A" stroke="#2E5E0E" stroke-width="2"/></svg>',
  storm: '<svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="9" fill="#F2A65A" stroke="#B81F24" stroke-width="2"/><g stroke="#B81F24" stroke-width="3" stroke-linecap="round"><path d="M20 3v5M20 32v5M3 20h5M32 20h5M8 8l3.5 3.5M28.5 28.5L32 32M8 32l3.5-3.5M28.5 11.5L32 8"/></g></svg>',
  night: '<svg viewBox="0 0 40 40" aria-hidden="true"><rect x="1" y="1" width="38" height="38" rx="10" fill="#1A1B33"/><path d="M24 6a15 15 0 1 0 10 24A12 12 0 0 1 24 6z" fill="#CFC3F0" stroke="#4B3C9E" stroke-width="1.5"/><circle cx="31" cy="9" r="1.6" fill="#FFFFFF"/><circle cx="34" cy="17" r="1.2" fill="#FFFFFF"/></svg>',
};

export function initTitle(stageEl, scene, { skip = false } = {}) {
  sceneEl = scene;
  overlay = document.createElement('div');
  overlay.className = 'title-screen hidden';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', 'C.A.S.C.L.E. title screen');
  overlay.innerHTML = `
    <header class="title-head">
      <h1 class="title-logo">C.A.S.C.L.E.</h1>
      <p class="title-sub">Cosmics And Space Capacities Learning Experience – <b>Junior Astronaut Mission Trainer</b></p>
    </header>
    <div class="title-body">
      <section class="title-card title-intro">
        <h2>YOUR MISSION</h2>
        <p>You are the new commander of a <b>lunar base</b>! Keep your crew of four astronauts safe, healthy and busy for <b>28 Sol</b> (Moon days).</p>
        <p class="title-small">Watch Power, Oxygen, Water and Shield in the top bar: if one reaches zero, the mission fails.</p>
        <h3>THREE DANGERS</h3>
        <ul class="title-hazards">
          <li>${ICONS.greenhouse}<span><b>Greenhouse</b> – the plants get thirsty. Water them or send Maya to help!</span></li>
          <li>${ICONS.storm}<span><b>Solar storms</b> – you have 30 seconds to protect the crew.</span></li>
          <li>${ICONS.night}<span><b>Lunar night</b> – no sunlight for days: save energy!</span></li>
        </ul>
        <p class="title-goal"><b>GOAL:</b> reach the start of <b>Sol 28</b> with energy left in the battery and earn all the badges!</p>
      </section>
      <section class="title-card title-how">
        <h2>HOW TO PLAY</h2>
        <ol>
          <li>Click an <b>astronaut's face</b> on the map.</li>
          <li>Choose a <b>room</b>, then an <b>action</b>: the astronaut walks there and does it.</li>
          <li>Click the <b>SOL</b> pill to change speed (1x–10x) or pause.</li>
          <li>Open the <b>tablet</b> for stats, tasks, badges and crew health.</li>
        </ol>
        <p class="title-small">Keys: Space = pause · 1–4 = speed · M = sound on/off · Esc = close</p>
        <p class="title-tip"><b>TIP:</b> when an alert <span class="title-bang">!</span> appears the game slows to 1x and waits for you: click it to read what to do.</p>
        <div class="title-mode">
          <span class="title-mode-label">DIFFICULTY</span>
          <div class="title-switch" role="group" aria-label="Difficulty">
            ${CONFIG.difficulties.map(d => `<button type="button" class="title-mode-btn" data-title-mode="${d}" aria-pressed="false">${d.toUpperCase()}</button>`).join('')}
          </div>
          <p class="title-mode-hint"></p>
        </div>
        <button type="button" class="btn-primary title-start" data-start>START MISSION</button>
      </section>
    </div>
    <p class="title-credits">Team: Elena, Camila, Carlota, Sara, Ludovica, Aurora – NASA Space Apps Challenge 2026</p>`;
  stageEl.appendChild(overlay);
  modeBtns = [...overlay.querySelectorAll('[data-title-mode]')];

  overlay.addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b || !visible) return;
    if (b.dataset.titleMode) { setDifficulty(b.dataset.titleMode); renderMode(); }
    else if (b.hasAttribute('data-start')) startMission();
  });
  // Invio = START MISSION (solo con la schermata titolo visibile)
  document.addEventListener('keydown', e => {
    if (!visible || e.key !== 'Enter') return;
    e.preventDefault();
    startMission();
  });

  if (!skip) showTitle();
}

function renderMode() {
  const d = state.difficulty;
  modeBtns.forEach(b => {
    const on = b.dataset.titleMode === d;
    b.classList.toggle('active', on);
    b.setAttribute('aria-pressed', on ? 'true' : 'false');
  });
  overlay.querySelector('.title-mode-hint').textContent = d === 'hard'
    ? 'HARD: set the power of every room by yourself.'
    : 'EASY: one switch for all the base power (MAX / ECO / OFF).';
}

// Mostra la schermata titolo: fase 'menu', scena bloccata
export function showTitle() {
  if (!overlay) return;
  visible = true;
  state.phase = 'menu';
  sceneEl.classList.add('locked');
  overlay.classList.remove('hidden');
  renderMode();
  overlay.querySelector('[data-start]').focus({ preventScroll: true });
  emit('update');
}

// START MISSION: la partita parte dal Sol corrente (Sol 1)
export function startMission() {
  if (!visible) return;
  visible = false;
  overlay.classList.add('hidden');
  sceneEl.classList.remove('locked');
  if (state.phase === 'menu') state.phase = 'playing';
  emit('title:start', state.difficulty);
  emit('update');
}

export function isTitleVisible() { return visible; }
