// Serra (Flusso 1): simulazione graduale di 6 piante + schermata a tutto stage
import { CONFIG } from '../config.js';
import { state } from '../state.js';
import { on, emit, onTick } from '../loop.js';
import { setHudMode } from '../hud.js';
import { cropGrowthMultiplier } from '../badges.js';
import { closeMenu } from '../crew.js';

const G = CONFIG.greenhouse;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const rand = (a, b) => a + Math.random() * (b - a);
const nowSol = () => state.sol + state.solProgress;

// ---------- Stato serra ----------
let lastAvg = 100;               // plant health medio al tick precedente (per recepire variazioni esterne)

function makePlants(health) {
  return Array.from({ length: G.plants }, () => ({ water: G.waterTarget, health, drain: rand(0.8, 1.2) }));
}

// Completa state.greenhouse (creato da state.js / Modulo 2) con i campi della serra
export function ensureGreenhouse() {
  if (!state.greenhouse) state.greenhouse = { autoWater: false, caretaker: null };
  const g = state.greenhouse;
  if (!Array.isArray(g.plants) || g.plants.length !== G.plants) {
    g.plants = makePlants(state.plantHealth);
    lastAvg = state.plantHealth;
  }
  if (!G.lights[g.light]) g.light = G.defaultLight;
  if (typeof g.cooldownUntil !== 'number') g.cooldownUntil = 0;
  if (typeof g.eventActive !== 'boolean') g.eventActive = false;
  if (typeof g.frozen !== 'boolean') g.frozen = false;
  return g;
}

const average = g => g.plants.reduce((s, p) => s + p.health, 0) / g.plants.length;

// Avvicina v a target con velocità rate (per Sol)
function toward(v, target, rate, dSol) {
  return v < target ? Math.min(target, v + rate * dSol) : v;
}

// Simulazione continua (chiamata a ogni tick, anche durante advanceSols)
function simulate(dSol) {
  if (state.phase !== 'playing') return;
  const g = ensureGreenhouse();
  // Serra ferma (bunker): annulla anche le variazioni esterne
  if (g.frozen) { state.plantHealth = lastAvg; return; }

  // Variazioni applicate da altri moduli (es. greenhouse OFF nel loop) distribuite sulle piante
  const ext = state.plantHealth - lastAvg;
  const powered = (state.roomPower?.greenhouse || 'ECO') !== 'OFF';
  const light = G.lights[g.light] || G.lights[G.defaultLight];
  const growth = G.growth * light.growth * cropGrowthMultiplier();

  for (const p of g.plants) {
    p.health = clamp(p.health + ext, 0, 100);
    // Acqua: durante l'evento il sistema Veggie perde acqua, altrimenti la mantiene da solo
    if (g.eventActive) p.water -= G.eventDrain * p.drain * dSol;
    else if (powered) p.water = toward(p.water, G.waterTarget, G.systemRefill, dSol);
    if (g.autoWater) p.water = toward(p.water, G.waterTarget, G.autoWaterRefill, dSol);
    p.water = clamp(p.water, 0, 100);
    // Salute: sale lentamente con acqua nel range giusto, scende se l'acqua è bassa
    if (p.water >= G.waterThreshold) {
      if (powered) p.health += growth * dSol;
    } else {
      p.health -= G.decay * (1 - p.water / G.waterThreshold) * dSol;
    }
    p.health = clamp(p.health, 0, 100);
  }
  const avg = average(g);
  state.plantHealth = avg;
  lastAvg = avg;

  // Luce rossa: bonus cibo (la fame cala più lentamente), proporzionale alla salute delle piante
  if (light.foodBonus && avg > 0) {
    for (const a of state.crew) a.hunger = clamp(a.hunger + light.foodBonus * (avg / 100) * dSol, 0, 100);
  }

  // Evento risolto: plant health >= 50 % e tutte le barre acqua sopra soglia
  if (g.eventActive && avg >= G.resolveHealth && g.plants.every(p => p.water > G.waterThreshold)) {
    g.eventActive = false;
    emit('greenhouse:resolved');
  }
}

// Avvio dell'evento: acqua bassa e piante appassite
export function startGreenhouseEvent() {
  const g = ensureGreenhouse();
  g.eventActive = true;
  for (const p of g.plants) {
    p.water = rand(...G.eventStartWater);
    p.health = Math.min(p.health, rand(...G.eventStartHealth));
    p.drain = rand(0.8, 1.2);
  }
  state.plantHealth = average(g);
  lastAvg = state.plantHealth;
  emit('update');
}

export function setGreenhouseFrozen(v) {
  ensureGreenhouse().frozen = !!v;
  lastAvg = state.plantHealth;
}

// Annaffiatura manuale: riempie le barre (−2 % acqua base, −5 power), cooldown 1/4 Sol
export function cooldownLeft() {
  return Math.max(0, ensureGreenhouse().cooldownUntil - nowSol());
}
export function waterPlants() {
  if (state.phase !== 'playing') return false;
  const g = ensureGreenhouse();
  if (cooldownLeft() > 0 || g.frozen) return false;
  for (const p of g.plants) p.water = 100;
  state.water = clamp(state.water - G.waterCostPct, 0, 100);
  state.power = clamp(state.power - G.powerCost, 0, CONFIG.resources.powerMax);
  g.cooldownUntil = nowSol() + G.cooldownSol;
  emit('greenhouse:water');
  emit('update');
  return true;
}

export function setLight(color) {
  if (!G.lights[color]) return;
  ensureGreenhouse().light = color;
  emit('greenhouse:light', color);
  emit('update');
}

// ---------- Disegno piante (SVG inline, forme organiche) ----------
// Ogni pianta: fusto (punti) e foglie [x, y, angolo, lunghezza, mezza larghezza, forma, davanti]
const PLANTS = [
  { stem: [[100, 340], [104, 240], [94, 140], [100, 40]], sw: 15, leaves: [
    [100, 45, 0, 100, 36, 'round'], [96, 135, -55, 100, 44, 'round'], [100, 180, 62, 92, 40, 'round'],
    [100, 262, -68, 62, 25, 'round', 1], [103, 300, 55, 52, 21, 'round', 1]] },
  { stem: [[100, 340], [100, 250], [106, 165]], sw: 17, leaves: [
    [104, 170, -38, 95, 48, 'round'], [104, 170, 42, 90, 45, 'round'], [100, 230, -78, 85, 40, 'round'],
    [102, 240, 72, 80, 38, 'round'], [106, 165, 4, 75, 36, 'round', 1]] },
  { stem: [[100, 340], [101, 210], [99, 85]], sw: 10, leaves: [
    [99, 90, -24, 92, 30, 'lobed'], [99, 90, 26, 92, 30, 'lobed'], [100, 170, -62, 95, 30, 'lobed'],
    [100, 170, 60, 95, 30, 'lobed'], [100, 255, -74, 90, 28, 'lobed'], [100, 255, 72, 90, 28, 'lobed'],
    [100, 305, -18, 55, 22, 'lobed', 1]] },
  { stem: [[100, 340], [98, 220], [102, 100]], sw: 14, leaves: [
    [102, 100, -24, 96, 38, 'round'], [102, 100, 22, 104, 40, 'round'], [100, 175, -12, 92, 30, 'round', 1],
    [99, 222, -58, 72, 30, 'round'], [99, 222, 58, 76, 30, 'round']] },
  { stem: [[100, 340], [100, 265], [101, 175]], sw: 10, leaves: [
    [101, 178, -42, 82, 30, 'lobed'], [101, 178, 38, 92, 32, 'lobed'], [100, 245, -82, 88, 28, 'lobed'],
    [100, 245, 78, 88, 28, 'lobed'], [101, 178, 2, 62, 24, 'lobed', 1]] },
  { stem: [[100, 340], [106, 250], [95, 150], [101, 75]], sw: 14, leaves: [
    [101, 80, -32, 82, 36, 'round'], [101, 80, 30, 88, 38, 'round'], [96, 195, -72, 76, 32, 'round'],
    [104, 282, 58, 52, 22, 'round', 1]] },
];
const SICK = [211, 207, 149];    // #D3CF95 beige
const HEALTHY = [161, 228, 122]; // #A1E47A verde
const STROKE = '#3B3A1C';
const DROOP = 38;                // gradi di afflosciamento con pianta malata

// Foglia che punta verso l'alto dall'origine
function leafPath(l, w, shape) {
  if (shape === 'round') {
    return `M0 0 C ${w * 1.35} ${-l * 0.12} ${w * 1.25} ${-l * 0.98} 0 ${-l} C ${-w * 1.25} ${-l * 0.98} ${-w * 1.35} ${-l * 0.12} 0 0 Z`;
  }
  // Foglia lobata: contorno ondulato
  const n = 14, right = [], left = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const r = w * Math.pow(Math.sin(Math.PI * t), 0.75) * (1 + 0.22 * Math.sin(t * Math.PI * 7));
    right.push([r, -l * t]);
    left.push([-r * 0.95, -l * t]);
  }
  const pts = [...right, ...left.reverse()];
  let d = `M0 0`;
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
    d += ` Q ${x0.toFixed(1)} ${y0.toFixed(1)} ${((x0 + x1) / 2).toFixed(1)} ${((y0 + y1) / 2).toFixed(1)}`;
  }
  return d + ' Z';
}

// Fusto morbido (Catmull-Rom -> Bézier)
function stemPath(pts) {
  let d = `M${pts[0][0]} ${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C ${c1[0]} ${c1[1]} ${c2[0]} ${c2[1]} ${p2[0]} ${p2[1]}`;
  }
  return d;
}

function plantSvg(def, i) {
  const leaf = (L, k) => `<g class="leaf" data-k="${k}" transform="translate(${L[0]} ${L[1]}) rotate(${L[2]})"><path d="${leafPath(L[3], L[4], L[5])}" stroke="${STROKE}" stroke-width="3" stroke-linejoin="round"/></g>`;
  const back = def.leaves.map((L, k) => (L[6] ? '' : leaf(L, k))).join('');
  const front = def.leaves.map((L, k) => (L[6] ? leaf(L, k) : '')).join('');
  const sp = stemPath(def.stem);
  return `<svg class="gh-plant" data-i="${i}" viewBox="0 0 200 340" aria-hidden="true">
    ${back}
    <path class="stem-out" d="${sp}" fill="none" stroke="${STROKE}" stroke-width="${def.sw + 6}" stroke-linecap="round"/>
    <path class="stem-in" d="${sp}" fill="none" stroke-width="${def.sw}" stroke-linecap="round"/>
    ${front}
  </svg>`;
}

// ---------- Schermata ----------
let screen = null, topbar = null, plantEls = [], barEls = [], waterBtn, statusEl, lightBtns;
let openFlag = false;
const lastDrawn = [];            // salute disegnata per pianta (aggiorna solo se cambia)

export function initGreenhouse(sceneEl) {
  topbar = document.getElementById('topbar');
  screen = document.createElement('div');
  screen.className = 'gh-screen hidden';
  screen.innerHTML = `
    <div class="gh-plants">${PLANTS.map((p, i) => `<div class="gh-plant-wrap">${plantSvg(p, i)}</div>`).join('')}</div>
    <div class="gh-lights" role="group" aria-label="Grow lights">
      ${Object.keys(G.lights).map(c => `<button type="button" class="gh-light gh-light-${c}" data-light="${c}" aria-label="${c} light" title="${c[0].toUpperCase() + c.slice(1)} light"></button>`).join('')}
    </div>
    <div class="gh-panel"><div class="gh-inner">
      <div class="gh-bars">
        ${PLANTS.map((_, i) => `<div class="gh-bar">${i === 0 ? '<span class="gh-bar-label">WATER H2O</span>' : '<span class="gh-bar-label">&nbsp;</span>'}<div class="gh-track"><div class="gh-fill"></div></div></div>`).join('')}
      </div>
      <button type="button" class="gh-back" data-gh-back><span aria-hidden="true">&larr;</span> BACK</button>
      <button type="button" class="gh-water" data-gh-water>WATER THE PLANTS</button>
      <p class="gh-status"></p>
    </div></div>`;
  sceneEl.appendChild(screen);

  plantEls = [...screen.querySelectorAll('.gh-plant')].map((svg, i) => ({
    svg,
    leaves: [...svg.querySelectorAll('.leaf')].map(g => ({ g, L: PLANTS[i].leaves[Number(g.dataset.k)] })),
    paths: [...svg.querySelectorAll('.leaf path, .stem-in')],
  }));
  barEls = [...screen.querySelectorAll('.gh-fill')];
  waterBtn = screen.querySelector('[data-gh-water]');
  statusEl = screen.querySelector('.gh-status');
  lightBtns = [...screen.querySelectorAll('[data-light]')];

  screen.addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b || state.phase !== 'playing' || !openFlag) return;
    if (b.dataset.light) setLight(b.dataset.light);
    else if (b.hasAttribute('data-gh-back')) closeGreenhouse();
    else if (b.hasAttribute('data-gh-water')) waterPlants();
  });
  document.addEventListener('keydown', e => {
    if (openFlag && e.key === 'Escape') closeGreenhouse();
  });

  ensureGreenhouse();
  onTick(simulate);
  on('update', render);
  on('fail', () => closeGreenhouse());
  on('win', () => closeGreenhouse());
  on('reset', () => {
    closeGreenhouse();
    ensureGreenhouse();
    lastAvg = state.plantHealth;
  });
}

export function openGreenhouse() {
  if (!screen || state.phase !== 'playing') return;
  ensureGreenhouse();
  if (!openFlag) {
    openFlag = true;
    closeMenu();
    screen.classList.remove('hidden');
    topbar.classList.add('gh-mode');
    setHudMode('greenhouse');
    lastDrawn.length = 0;
    emit('greenhouse:open');
  }
  render();
}

export function closeGreenhouse() {
  if (!openFlag) return;
  openFlag = false;
  screen.classList.add('hidden');
  topbar.classList.remove('gh-mode');
  setHudMode('base');
  emit('greenhouse:close');
}

export function isGreenhouseOpen() { return openFlag; }

// Colore tra beige (malata) e verde (sana) in base alla salute della singola pianta
function leafColor(h) {
  const t = clamp((h - 20) / 30, 0, 1);
  const c = SICK.map((v, i) => Math.round(v + (HEALTHY[i] - v) * t));
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
}

function render() {
  if (!openFlag) return;
  const g = ensureGreenhouse();
  screen.style.backgroundColor = G.lights[g.light].color;
  lightBtns.forEach(b => b.classList.toggle('active', b.dataset.light === g.light));

  g.plants.forEach((p, i) => {
    const pe = plantEls[i];
    barEls[i].style.width = `${clamp(p.water, 0, 100).toFixed(1)}%`;
    barEls[i].classList.toggle('low', p.water < G.waterThreshold);
    const h = Math.round(p.health);
    if (!pe || lastDrawn[i] === h) return;
    lastDrawn[i] = h;
    const col = leafColor(h);
    pe.paths.forEach(el => (el.classList.contains('stem-in') ? el.setAttribute('stroke', col) : el.setAttribute('fill', col)));
    // Foglie afflosciate verso il basso quando la pianta sta male
    const t = clamp((h - 20) / 30, 0, 1);
    pe.leaves.forEach(({ g: el, L }) => {
      const dir = L[2] === 0 ? (L[0] < 100 ? -1 : 1) : Math.sign(L[2]);
      const ang = L[2] + dir * (1 - t) * DROOP;
      const sc = 0.88 + 0.12 * t;
      el.setAttribute('transform', `translate(${L[0]} ${L[1]}) rotate(${ang.toFixed(1)}) scale(${sc.toFixed(3)})`);
    });
  });

  const cd = cooldownLeft();
  const disabled = cd > 0 || g.frozen;
  waterBtn.disabled = disabled;
  waterBtn.classList.toggle('cooldown', disabled);
  let msg = '';
  if (g.frozen) msg = 'Greenhouse paused: the crew is in the bunker.';
  else if (cd > 0) msg = `Water system recharging: ready in ${Math.ceil(cd * 24 * 60)} min (game time)`;
  if (g.autoWater) {
    const who = state.crew.find(a => a.id === g.caretaker);
    msg = `${who ? who.name.split(' ')[0] : 'A crew member'} is watering the plants automatically.` + (msg ? ` ${msg}` : '');
  }
  if (statusEl.textContent !== msg) statusEl.textContent = msg;
}
