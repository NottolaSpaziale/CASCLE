// Modulo 5 – Tablet (Flusso 4, §5.5): STATS, TASKS, BADGES, CREW HEALTH.
// Si apre dal pulsante in top bar; con il tablet aperto il gioco è in pausa (motivo 'tablet').
import { CONFIG } from '../config.js';
import { state, isNight } from '../state.js';
import { on, emit, pause, resume } from '../loop.js';
import { dailyConsumption, levelOf } from '../power.js';
import { ACTIONS } from '../actions.js';
import { assignAction, closeMenu as closeCrewMenu } from '../crew.js';
import { hasBadge, badgeImage } from '../badges.js';
import { showModal, closeModal, isModalOpen, esc } from './modal.js';
import { fmtPct, fmtNum } from '../hud.js';

export const TABS = ['stats', 'tasks', 'badges', 'health'];
// Ordine degli astronauti come nel Figma (Geologist, Biologist, Engineer, Surgeon)
const CREW_ORDER = ['luana', 'maya', 'astrid', 'hannah'];
const ROLE_TITLE = {
  luana: 'Lunar Geologist', maya: 'Space Biologist',
  astrid: 'Systems & Power Engineer', hannah: 'Flight Surgeon',
};
const HOURS = 24;

// ---------- Routine giornaliera (testi dal Figma TASKS) ----------
const ROW_SCIENCE = {
  luana:  ['Geology & Regolith Analysis', 'Geology Lab, analysis of lunar soil samples, regolith composition, and extracted ice'],
  maya:   ['Morning science & lab work', 'Labs, hydroponic greenhouse (Veggie / APH), water checks, LED lights'],
  astrid: ['ECLSS & Power Diagnostics', 'Life Support System room, O2/CO2 scrubbers (CDRA), water recycling, power control'],
  hannah: ['Crew Health & Biomedical Check', 'Medical Bay, crew vital signs, radiation exposure monitoring, physical fitness tracking'],
};
function routineFor(id) {
  const sci = ROW_SCIENCE[id];
  return [
    ['06:00 - 07:00', 'Wake up & breakfast', 'Galley & Kitchen · 2 h total daily meal time'],
    ['07:00 - 09:00', 'Mandatory physical exercise', 'Gym: ARED weights, T2 treadmill, CEVIS cycle · prevents bone and muscle loss'],
    ['09:00 - 13:00', sci[0], sci[1]],
    ['13:00 - 14:00', 'Lunch & social time', 'Galley · crew psychological well-being'],
    ['14:00 - 20:00', 'Afternoon duties & maintenance', 'Base maintenance, air filter cleaning, ground control conferences from Comms Center'],
    ['20:00 - 21:00', 'Dinner', 'Evening meal for the crew'],
    ['21:00 - 06:00', 'Rest & sleep', '8 h protected sleep in private cabins 1-4 · lowers fatigue'],
  ];
}
// Stanza "di lavoro" di ogni ruolo (Go to … conta come attività scientifica)
const ROLE_ROOM_ACTION = { luana: 'goLabs', maya: 'goLabs', astrid: 'goLifeSupport', hannah: 'goMedical' };
const EXERCISE = new Set(['goGym', 'ared', 'treadmill', 'cevis']);
const MEAL = new Set(['goGalley', 'eat', 'drink']);
const REST = new Set(['goCabin', 'sleep', 'relax']);
const DUTIES = new Set(['airFilters', 'waterRecycler', 'powerPanel', 'dust', 'callEarth', 'donki', 'goComms',
  'goAirlock', 'goRestroom', 'sanitation', 'evacuate', 'goLifeSupport']);

// Ora lunare: il Sol inizia alle 06:00 (sveglia)
function lunarHour() {
  return (6 + (state.solProgress || 0) * HOURS) % HOURS;
}
function fmtClock(h) {
  const hh = Math.floor(h), mm = Math.floor((h - hh) * 60);
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

// Riga della routine corrispondente al task attuale dell'astronauta (o -1)
function routineRow(a) {
  const t = a.task;
  if (!t) return -1;
  const id = t.id;
  const act = ACTIONS[id];
  if (EXERCISE.has(id)) return 1;
  if (REST.has(id)) return 6;
  if (id === 'socialize') return 3;
  if (MEAL.has(id)) {
    const h = lunarHour();
    return h >= 6 && h < 10 ? 0 : (h >= 10 && h < 17 ? 3 : 5);
  }
  if ((act && act.specialist === a.id) || ROLE_ROOM_ACTION[a.id] === id) return 2;
  if (DUTIES.has(id)) return 4;
  return -1;
}

const roomName = id => CONFIG.rooms.find(r => r.id === id)?.name || id;
function nowText(a) {
  if (a.destination) return a.task ? `${a.task.label} (walking to ${roomName(a.destination)})` : `Walking to ${roomName(a.destination)}`;
  if (!a.task) return `Idle – ${roomName(a.location)}`;
  return a.task.label;
}

// ---------- CREW HEALTH: metriche ----------
// value: valore mostrato (0-100); good: 0-100 (100 = ottimo) per il colore; fix: azione suggerita
const METRICS = {
  radiation:  { label: 'Radiation', note: 'Tissue build-up after SEP / CME solar storms (critical threat)', value: a => a.radiation, good: a => 100 - a.radiation, fix: 'checkup' },
  boneMass:   { label: 'Bone mass', note: 'Loses ~1-1,5 % per month without exercise', value: a => a.boneMass, good: a => a.boneMass, fix: 'ared' },
  muscleMass: { label: 'Muscle mass', note: 'Drops 10-15 % on long missions; linked to gym work', value: a => a.muscleMass, good: a => a.muscleMass, fix: 'ared' },
  sleep:      { label: 'Sleep', note: 'Protected cabin sleep restores performance', value: a => a.sleep, good: a => a.sleep, fix: 'sleep' },
  fatigue:    { label: 'Fatigue', note: 'Rises on heavy shifts; falls with rest', value: a => a.fatigue, good: a => 100 - a.fatigue, fix: 'sleep' },
  hunger:     { label: 'Hunger', note: 'Warning before zero; eat in the Galley', value: a => a.hunger, good: a => a.hunger, fix: 'eat' },
  hydration:  { label: 'Hydration', note: 'Linked to base water reserves and recycling', value: a => a.hydration, good: a => a.hydration, fix: 'drink' },
  mood:       { label: 'Mood / stress', note: 'Rises with isolation and the lunar night; eases with social time in the kitchen',
    value: a => (a.mood + (100 - a.stress)) / 2, good: a => (a.mood + (100 - a.stress)) / 2, fix: 'socialize',
    text: a => `Mood ${Math.round(a.mood)} · Stress ${Math.round(a.stress)}` },
};
const BLOCKS = [
  { title: 'Physical status', keys: ['radiation', 'boneMass', 'muscleMass'] },
  { title: 'Energy & fatigue', keys: ['sleep', 'fatigue', 'hunger', 'hydration'] },
  { title: 'Mental state', keys: ['mood'] },
];
// Stato colore: ok (verde) / warn (giallo) / bad (rosso)
function level(good) {
  if (good >= 60) return 'ok';
  if (good >= 30) return 'warn';
  return 'bad';
}

// ---------- Icone (SVG inline) ----------
const ICONS = {
  stats: `<svg viewBox="0 0 64 64"><rect x="3" y="3" width="58" height="58" rx="2" class="ic-bg"/>
    <rect x="15" y="26" width="8" height="28" rx="1" class="ic-c1"/><rect x="28" y="12" width="8" height="42" rx="1" class="ic-c2"/><rect x="41" y="32" width="8" height="22" rx="1" class="ic-c3"/></svg>`,
  tasks: `<svg viewBox="0 0 64 64"><rect x="3" y="3" width="58" height="58" rx="2" class="ic-bg"/>
    <path d="M11 18l4 4 7-8M11 32l4 4 7-8M11 46l4 4 7-8" class="ic-line"/><path d="M27 19h26M27 33h26M27 47h26" class="ic-line"/></svg>`,
  badges: `<svg viewBox="0 0 64 64"><path d="M20 8h24v14a12 12 0 0 1-24 0z" class="ic-cup"/><path d="M20 12h-8c0 9 4 13 9 14M44 12h8c0 9-4 13-9 14" class="ic-line"/>
    <path d="M32 13l2.2 4.6 5 .6-3.7 3.4 1 5-4.5-2.5-4.5 2.5 1-5-3.7-3.4 5-.6z" class="ic-star"/><rect x="29" y="34" width="6" height="10" class="ic-cup"/><rect x="24" y="44" width="16" height="5" class="ic-cup"/><path d="M18 57l4-8h20l4 8z" class="ic-cup"/></svg>`,
  health: `<svg viewBox="0 0 64 64"><path d="M24 4h16v20h20v16H40v20H24V40H4V24h20z" class="ic-cross"/></svg>`,
};
const TAB_LABEL = { stats: 'Stats', tasks: 'Tasks', badges: 'Badges', health: 'Crew Health' };
const TABLET_ICON = `<svg viewBox="0 0 32 32" aria-hidden="true"><rect x="5" y="2.5" width="22" height="27" rx="3.5" fill="none" stroke="currentColor" stroke-width="2.4"/>
  <rect x="9" y="7" width="14" height="15" rx="1" fill="currentColor" opacity="0.35"/><circle cx="16" cy="25.6" r="1.5" fill="currentColor"/></svg>`;

// ---------- Stato del modulo ----------
let layer, body, tabBtns = {}, btn;
let isOpen = false;
let tab = 'stats';
let crewIdx = 0;                 // astronauta mostrato in TASKS e CREW HEALTH
let lastHtml = '';
let badgeModal = null;           // modale dettaglio badge aperta dal tablet
const ignored = {};              // `${id}:${metrica}` -> Sol in cui è stato ignorato

const crewId = () => CREW_ORDER[crewIdx];
const astronaut = id => state.crew.find(a => a.id === id);
const isIgnored = (id, key) => ignored[`${id}:${key}`] === state.sol;

// ---------- Render delle pagine ----------
const signed = (v, d = 2) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${fmtNum(Math.abs(v), d)}`;

function statsRows() {
  const R = CONFIG.rates;
  const lsLvl = levelOf('lifeSupport');
  const o2h = R.oxygenPerSol[lsLvl] / HOURS;
  const co2h = R.co2PerSol[lsLvl] / HOURS;
  const h2oh = R.waterPerSol[levelOf('waterRecycling')] / HOURS;
  const litres = fmtNum(R.waterLitresPerDay / HOURS, 2);
  const shLvl = levelOf('radiationShield');
  const shh = R.shieldPerSol[shLvl] / HOURS;
  const night = isNight();
  const cons = dailyConsumption();
  const net = (state.solarOutput - cons) / HOURS;
  const max = CONFIG.resources.powerMax;
  const fmtInt = n => String(Math.round(n));

  const co2Note = state.co2 > 0.1 || co2h > 0
    ? `${co2h > 0 ? signed(co2h, 3) + ' % per hour: ' : ''}CDRA filters under load; crew performance drops`
    : 'Rises if CDRA filters are under load; crew performance drops';
  return [
    ['O2 (Oxygen)', fmtPct(state.oxygen), `${signed(o2h)} % per hour (4 crew, electrolysis + CO2 scrubbers)`, state.oxygen < 30 ? 'bad' : ''],
    ['CO2 (Carbon dioxide)', fmtPct(state.co2, 2), co2Note, state.co2 > 0.5 ? 'bad' : ''],
    ['H2O (Water)', fmtPct(state.water), `${signed(h2oh)} % per hour (−${litres} L used); ${R.waterRecycledPct} % recycled via urine processor`, state.water < 30 ? 'bad' : ''],
    ['Solar panels', night ? '0 %' : '100 %',
      night ? 'Lunar night: no sunlight until Sol 28' : `+${fmtInt(state.solarOutput)} units per Sol in full sunlight`, ''],
    ['Battery', `${fmtInt(state.power)} / ${fmtInt(max)}`,
      `${signed(net)} units per hour (uses ${fmtNum(cons)} units/day) · reserves for the lunar night`, state.power < 200 ? 'bad' : ''],
    ['Shield (radiation)', fmtPct(state.shield),
      `${shh !== 0 ? signed(shh) + ' % per hour · ' : ''}Drops during solar storms (CME / SEP) if unpowered (system ${shLvl})`, state.shield < 30 ? 'bad' : ''],
  ];
}

function renderStats() {
  return `<h2 class="tb-title">STATS</h2>
    <div class="tb-stats">${statsRows().map(([n, v, note, cls]) => `
      <div class="tb-stat ${cls}"><span class="st-name">${esc(n)}</span><span class="st-val">${esc(v)}</span><span class="st-note">${esc(note)}</span></div>`).join('')}
    </div>`;
}

// Avatar a figura intera con frecce < > tra i 4 astronauti
function avatarBlock(id) {
  const def = CONFIG.crew.find(c => c.id === id);
  return `<div class="tb-avatar">
      <button type="button" class="tb-arrow" data-nav="-1" aria-label="Previous astronaut">&#10094;</button>
      <figure><img src="assets/img/avatar-${id}.png" alt="${esc(def.name)}" draggable="false"><figcaption>${esc(def.name)}</figcaption></figure>
      <button type="button" class="tb-arrow" data-nav="1" aria-label="Next astronaut">&#10095;</button>
    </div>`;
}

function renderTasks() {
  const id = crewId();
  const a = astronaut(id);
  const cur = a ? routineRow(a) : -1;
  return `<h2 class="tb-title">TASKS - ${esc(ROLE_TITLE[id])}</h2>
    <p class="tb-sub">Lunar time ${fmtClock(lunarHour())} · Daily routine · <b>Now:</b> ${esc(a ? nowText(a) : '')}</p>
    <div class="tb-split">
      <div class="tb-tasks">${routineFor(id).map(([time, title, desc], i) => `
        <div class="tb-task${i === cur ? ' current' : ''}"><span class="tk-time">${time}</span>
          <span class="tk-text"><b>${esc(title)}</b><small>${esc(desc)}</small></span>${i === cur ? '<span class="tk-now">NOW</span>' : ''}</div>`).join('')}
      </div>
      ${avatarBlock(id)}
    </div>`;
}

function renderBadges() {
  return `<h2 class="tb-title">BADGES</h2>
    <div class="tb-badges">${Object.values(CONFIG.badges).map(b => {
      const un = hasBadge(b.id);
      const im = badgeImage(b.id, un);
      return `<button type="button" class="tb-badge ${un ? 'on' : 'off'}" data-badge="${b.id}">
          <img src="${esc(im.src)}" alt="" class="${im.gray ? 'badge-off-gray' : ''}" draggable="false">
          <b class="bd-name">${esc(b.name)}</b>
          <span class="bd-state">${un ? 'ACHIEVED' : 'NOT ACHIEVED'}</span>
          <small class="bd-unlock">${esc(b.unlock)}</small>
          ${b.bonus ? `<small class="bd-bonus">${esc(b.bonus)}</small>` : ''}
          <small class="bd-role">Role model: ${esc(b.roleModel)}</small>
          <span class="bd-more">Details</span>
        </button>`;
    }).join('')}</div>`;
}

function metricHtml(a, key) {
  const m = METRICS[key];
  const v = Math.max(0, Math.min(100, m.value(a)));
  const lv = level(m.good(a));
  const txt = m.text ? m.text(a) : `${Math.round(v)} %`;
  const ign = isIgnored(a.id, key);
  const actions = ign
    ? `<span class="mt-ignored">Ignored until Sol ${state.sol + 1}</span>`
    : `<button type="button" class="mt-fix" data-fix="${key}" title="${esc(ACTIONS[m.fix].label)}">Fix</button><button type="button" class="mt-ign" data-ignore="${key}">Ignore</button>`;
  return `<div class="tb-metric ${lv}">
      <div class="mt-head"><b>${esc(m.label)}</b><span>${esc(txt)}</span></div>
      <small>${esc(m.note)}</small>
      <div class="mt-row"><div class="mt-bar"><i style="width:${v.toFixed(1)}%"></i></div>${actions}</div>
    </div>`;
}

function renderHealth() {
  const id = crewId();
  const a = astronaut(id);
  if (!a) return '';
  const hv = Math.max(0, Math.min(100, a.health));
  return `<h2 class="tb-title">CREW HEALTH</h2>
    <div class="tb-split">
      <div class="tb-health">
        <div class="tb-card tb-overall ${level(hv)}">
          <div><b>Overall health – ${esc(a.name)}</b> <span class="ov-val">${Math.round(hv)} %</span>
            <small>Must stay above 0. At 0 the astronaut dies and the game ends (tied to oxygen, food and severe trauma).</small></div>
          <div class="mt-bar big"><i style="width:${hv.toFixed(1)}%"></i></div>
        </div>
        <div class="tb-blocks">${BLOCKS.map(bl => `
          <div class="tb-card tb-block"><h3>${bl.title}</h3>${bl.keys.map(k => metricHtml(a, k)).join('')}</div>`).join('')}
        </div>
      </div>
      ${avatarBlock(id)}
    </div>`;
}

const RENDER = { stats: renderStats, tasks: renderTasks, badges: renderBadges, health: renderHealth };

// Aggiorna il DOM solo se l'HTML cambia (evita di perdere click/hover a ogni frame)
function render(force = false) {
  if (!isOpen || !body) return;
  const html = RENDER[tab]();
  if (!force && html === lastHtml) return;
  lastHtml = html;
  body.innerHTML = html;
  body.dataset.tab = tab;
  for (const t of TABS) tabBtns[t].classList.toggle('active', t === tab);
}

// ---------- Apertura / chiusura ----------
export function openTablet(t) {
  if (!layer || state.phase !== 'playing') return false;
  if (t !== undefined) setTab(t, false);
  if (!isOpen) {
    isOpen = true;
    closeCrewMenu();
    layer.classList.remove('hidden');
    btn.classList.add('active');
    pause('tablet');
    emit('tablet:open', tab);
  }
  render(true);
  return true;
}

export function closeTablet() {
  if (!isOpen) return;
  isOpen = false;
  if (badgeModal) { closeModal(badgeModal); badgeModal = null; }
  layer.classList.add('hidden');
  btn.classList.remove('active');
  body.innerHTML = '';
  lastHtml = '';
  resume('tablet');
  emit('tablet:close');
}

function setTab(t, doRender = true) {
  if (!TABS.includes(t)) return false;
  tab = t;
  if (doRender) render(true);
  return true;
}

function setCrew(idOrIdx) {
  const i = typeof idOrIdx === 'number' ? idOrIdx : CREW_ORDER.indexOf(idOrIdx);
  // Id sconosciuto: scarta; indice numerico: wrap-around in entrambe le direzioni
  if (typeof idOrIdx !== 'number' && i < 0) return false;
  crewIdx = ((i % CREW_ORDER.length) + CREW_ORDER.length) % CREW_ORDER.length;
  render(true);
  return true;
}

// Dettaglio badge (sola lettura): riusa la modale badge sopra il tablet
function showBadgeDetail(id) {
  const b = CONFIG.badges[id];
  if (!b || isModalOpen()) return;
  const un = hasBadge(id);
  const im = badgeImage(id, un);
  const badge = un ? b : { ...b, title: `${b.name} badge – not achieved yet` };
  const opts = {
    type: 'badge', theme: b.theme || 'green', badge, image: im.src, button: 'BACK',
    onClose: () => { badgeModal = null; },
  };
  badgeModal = showModal(opts);
  if (im.gray) document.querySelector('.modal-layer .modal-badge .badge-img')?.classList.add('badge-off-gray');
}

// Fix: chiude il tablet e manda l'astronauta a fare l'azione giusta
function fixMetric(key) {
  const m = METRICS[key];
  const id = crewId();
  if (!m) return false;
  closeTablet();
  const ok = assignAction(id, m.fix);
  emit('tablet:fix', id, key, m.fix);
  return ok;
}

function ignoreMetric(key) {
  ignored[`${crewId()}:${key}`] = state.sol;
  render(true);
}

// ---------- Inizializzazione ----------
export function initTablet(sceneEl) {
  // Pulsante sempre visibile in top bar, accanto alla pillola SOL
  const topbar = sceneEl.querySelector('#topbar');
  btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'tablet-btn';
  btn.title = 'Tablet';
  btn.setAttribute('aria-label', 'Open tablet');
  btn.innerHTML = TABLET_ICON;
  topbar.insertBefore(btn, topbar.querySelector('.sol-wrap'));
  btn.addEventListener('click', e => {
    e.stopPropagation();
    if (isOpen) closeTablet(); else openTablet();
  });

  layer = document.createElement('div');
  layer.className = 'tablet-layer hidden';
  layer.innerHTML = `
    <div class="tablet-frame" role="dialog" aria-label="Tablet">
      <button type="button" class="tablet-close" aria-label="Close tablet">&times;</button>
      <div class="tablet-inner">
        <nav class="tablet-tabs">${TABS.map(t => `<button type="button" class="tablet-tab tab-${t}" data-tab="${t}" title="${TAB_LABEL[t]}" aria-label="${TAB_LABEL[t]}">${ICONS[t]}</button>`).join('')}</nav>
        <section class="tablet-body"></section>
      </div>
    </div>
    <p class="tablet-note">Crew avatars, and character designs are fictional</p>`;
  sceneEl.appendChild(layer);
  body = layer.querySelector('.tablet-body');
  layer.querySelectorAll('.tablet-tab').forEach(b => { tabBtns[b.dataset.tab] = b; });

  layer.addEventListener('click', e => {
    e.stopPropagation();
    if (!isOpen || state.phase !== 'playing') return;
    const b = e.target.closest('button');
    if (!b) return;
    if (b.classList.contains('tablet-close')) closeTablet();
    else if (b.dataset.tab) setTab(b.dataset.tab);
    else if (b.dataset.nav) setCrew(crewIdx + Number(b.dataset.nav));
    else if (b.dataset.badge) showBadgeDetail(b.dataset.badge);
    else if (b.dataset.fix) fixMetric(b.dataset.fix);
    else if (b.dataset.ignore) ignoreMetric(b.dataset.ignore);
  });
  // Esc: chiude prima il dettaglio badge, poi il tablet; frecce sinistra/destra tra gli astronauti
  document.addEventListener('keydown', e => {
    if (!isOpen) return;
    if (e.key === 'Escape') {
      if (badgeModal) { const m = badgeModal; badgeModal = null; closeModal(m); }
      else if (!isModalOpen()) closeTablet();
    } else if (!isModalOpen() && (tab === 'tasks' || tab === 'health')) {
      if (e.key === 'ArrowLeft') setCrew(crewIdx - 1);
      else if (e.key === 'ArrowRight') setCrew(crewIdx + 1);
    }
  });

  on('update', () => render());
  // Gli "Ignore" valgono solo per il Sol corrente
  on('newSol', sol => { for (const k of Object.keys(ignored)) if (ignored[k] !== sol) delete ignored[k]; });
  on('fail', closeTablet);
  on('win', closeTablet);
  on('reset', () => {
    closeTablet();
    for (const k of Object.keys(ignored)) delete ignored[k];
    tab = 'stats';
    crewIdx = 0;
  });
}

// API debug: game.tablet.open('health'), game.tablet.close(), game.tablet.isOpen, game.tablet.tab
export const tabletApi = {
  open: openTablet,
  close: closeTablet,
  toggle: () => (isOpen ? (closeTablet(), false) : openTablet()),
  setTab: t => setTab(t),
  setCrew,
  fix: fixMetric,
  ignore: ignoreMetric,
  get isOpen() { return isOpen; },
  get tab() { return tab; },
  get crew() { return crewId(); },
  tabs: TABS,
};
