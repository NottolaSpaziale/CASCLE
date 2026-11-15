// Modulo 6 – Effetti sonori sintetici (Web Audio, nessun file).
// L'AudioContext nasce al primo gesto dell'utente; mute ricordato in localStorage.
import { on } from './loop.js';
import { getStormStage, stormTimeLeft } from './screens/storm.js';

const STORE_KEY = 'cascle.muted';
const VOLUME = 0.22;             // volume generale moderato

let ctx = null;
let master = null;
let muted = loadMuted();
let btn = null;
let stormAlarmAt = 0;            // evita il doppio allarme (event:start storm + alert)
let lastTickSec = -1;            // ultimo secondo "tick" suonato nel timer tempesta

function loadMuted() {
  try { return localStorage.getItem(STORE_KEY) === '1'; } catch (e) { return false; }
}
function saveMuted() {
  try { localStorage.setItem(STORE_KEY, muted ? '1' : '0'); } catch (e) { /* storage non disponibile */ }
}

// Crea (o riattiva) il contesto audio: solo dentro un gesto utente
function ensureCtx() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    try {
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : VOLUME;
      master.connect(ctx.destination);
    } catch (e) { ctx = null; return null; }
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

// Nota singola con inviluppo: freq (Hz o [da, a] per glissando), durata e ritardo in secondi
function tone(freq, dur, { type = 'sine', vol = 0.5, delay = 0, attack = 0.01 } = {}) {
  if (!ctx || muted || ctx.state !== 'running') return;
  const t = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  if (Array.isArray(freq)) {
    osc.frequency.setValueAtTime(freq[0], t);
    osc.frequency.exponentialRampToValueAtTime(freq[1], t + dur);
  } else osc.frequency.setValueAtTime(freq, t);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g);
  g.connect(master);
  osc.start(t);
  osc.stop(t + dur + 0.02);
  // Scollega i nodi a fine suono (niente accumulo nel grafo audio)
  osc.onended = () => { osc.disconnect(); g.disconnect(); };
}

// Breve rumore filtrato (acqua)
function noise(dur, { delay = 0, vol = 0.3, from = 1800, to = 500 } = {}) {
  if (!ctx || muted || ctx.state !== 'running') return;
  const t = ctx.currentTime + delay;
  const len = Math.floor(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const f = ctx.createBiquadFilter();
  f.type = 'bandpass';
  f.Q.value = 3;
  f.frequency.setValueAtTime(from, t);
  f.frequency.exponentialRampToValueAtTime(to, t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.03);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f); f.connect(g); g.connect(master);
  src.start(t);
  src.stop(t + dur + 0.02);
  src.onended = () => { src.disconnect(); f.disconnect(); g.disconnect(); };
}

// ---------- Catalogo effetti ----------
export const sfx = {
  click: () => tone(880, 0.06, { type: 'triangle', vol: 0.25, attack: 0.003 }),
  alert: () => { tone(660, 0.18, { type: 'square', vol: 0.18 }); tone(880, 0.22, { type: 'square', vol: 0.18, delay: 0.2 }); },
  storm: () => {
    // Sirena più urgente: tre salite rapide
    for (let i = 0; i < 3; i++) tone([520, 1040], 0.28, { type: 'sawtooth', vol: 0.16, delay: i * 0.32 });
  },
  success: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.22, { type: 'triangle', vol: 0.3, delay: i * 0.09 })),
  water: () => { noise(0.5, { vol: 0.35 }); tone([900, 400], 0.25, { vol: 0.15, delay: 0.05 }); },
  fail: () => [392, 330, 262, 196].forEach((f, i) => tone(f, 0.35, { type: 'sawtooth', vol: 0.15, delay: i * 0.22 })),
  win: () => {
    [523, 659, 784, 659, 784, 1047].forEach((f, i) => tone(f, 0.25, { type: 'triangle', vol: 0.3, delay: i * 0.13 }));
    tone(1047, 0.8, { type: 'sine', vol: 0.2, delay: 0.8 });
  },
  tick: () => tone(1500, 0.04, { type: 'square', vol: 0.12, attack: 0.002 }),
};

export function isMuted() { return muted; }

export function setMuted(v) {
  muted = !!v;
  saveMuted();
  if (master && ctx) master.gain.setValueAtTime(muted ? 0 : VOLUME, ctx.currentTime);
  renderBtn();
}
export function toggleMute() { setMuted(!muted); }

// Icona altoparlante (con onde o barrata)
function renderBtn() {
  if (!btn) return;
  btn.classList.toggle('is-muted', muted);
  btn.setAttribute('aria-pressed', muted ? 'true' : 'false');
  btn.title = muted ? 'Sound off (M)' : 'Sound on (M)';
  btn.setAttribute('aria-label', muted ? 'Unmute sound' : 'Mute sound');
  btn.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor"/>${muted
    ? '<path d="M16 9l5 6M21 9l-5 6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>'
    : '<path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>'}</svg>`;
}

// Tick del timer tempesta negli ultimi 10 s (letto a ogni frame dal bus 'update')
function stormTick() {
  if (getStormStage() !== 'choice') { lastTickSec = -1; return; }
  const left = stormTimeLeft();
  const sec = Math.ceil(left);
  if (sec > 10 || sec <= 0 || sec === lastTickSec) return;
  lastTickSec = sec;
  sfx.tick();
}

export function initAudio(topbar) {
  // Primo gesto utente: crea/riattiva il contesto (regola autoplay dei browser)
  const unlock = () => ensureCtx();
  window.addEventListener('pointerdown', unlock, true);
  window.addEventListener('keydown', unlock, true);

  // Click UI: qualunque bottone (escluso il mute stesso, che suona dopo il toggle)
  document.addEventListener('click', e => {
    const b = e.target.closest?.('button');
    if (!b || b.disabled || b === btn) return;
    sfx.click();
  });

  // Pulsante mute in top bar (prima della pillola SOL)
  btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'mute-btn';
  btn.addEventListener('click', e => {
    e.stopPropagation();
    ensureCtx();
    toggleMute();
    sfx.click();
  });
  topbar.insertBefore(btn, topbar.querySelector('.sol-wrap'));
  renderBtn();
  // Tasto M = mute (ignorato nei campi di testo)
  document.addEventListener('keydown', e => {
    if (e.repeat || (e.key !== 'm' && e.key !== 'M')) return;
    if (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
    toggleMute();
  });

  // Effetti collegati al bus di gioco
  on('event:start', id => { if (id === 'storm') { stormAlarmAt = performance.now(); sfx.storm(); } });
  on('alert', () => { if (performance.now() - stormAlarmAt > 200) sfx.alert(); });
  on('badge:unlock', () => sfx.success());
  on('greenhouse:water', () => sfx.water());
  on('fail', () => sfx.fail());
  on('win', () => sfx.win());
  on('update', stormTick);
  on('reset', () => { lastTickSec = -1; });
}

// API debug/test (window.game.audio)
export const audioApi = {
  get muted() { return muted; },
  setMuted, toggleMute,
  get state() { return ctx ? ctx.state : 'none'; },
  play: name => sfx[name]?.(),
};
