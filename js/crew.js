// Equipaggio sulla mappa: icone-viso, spostamenti, selezione, menu radiale e lista azioni
import { CONFIG } from './config.js';
import { state } from './state.js';
import { on, emit } from './loop.js';
import { MAP_W, MAP_H, roomCenter, roomPath } from './map.js';
import {
  ACTIONS, ROOM_GROUPS, groupForRoom, targetRoom, makeTask, startTask,
  tickActions, updateGreenhouseFlag, needsStatus, isSpecialist,
} from './actions.js';

const ICON = 60;                 // diametro icona (px nello stage)
const SLOT = 33;                 // distanza dal centro stanza per più occupanti
const WALK_SOL_PER_WIDTH = 0.025; // tempo di gioco (Sol) per attraversare tutta la mappa (~7,5 s a 1x)
const ASPECT = MAP_H / MAP_W;

// Disposizione degli occupanti di una stanza (offset in px) per evitare sovrapposizioni
const LAYOUTS = {
  1: [[0, 0]],
  2: [[-SLOT, 0], [SLOT, 0]],
  3: [[-SLOT, -28], [SLOT, -28], [0, 30]],
  4: [[-SLOT, -SLOT], [SLOT, -SLOT], [-SLOT, SLOT], [SLOT, SLOT]],
};

// Posizione delle voci del menu radiale attorno all'icona: [dx, dy, allineamento]
const RADIAL_POS = {
  restroom:    [0, -80, 'center'],
  cabin:       [-40, -50, 'left'],
  lifeSupport: [40, -50, 'right'],
  galley:      [-48, -18, 'left'],
  comms:       [48, -18, 'right'],
  greenhouse:  [-48, 14, 'left'],
  medical:     [48, 14, 'right'],
  labs:        [-40, 46, 'left'],
  bunker:      [40, 46, 'right'],
  gym:         [0, 80, 'center'],
};

const roomName = id => CONFIG.rooms.find(r => r.id === id)?.name || id;
const byId = id => state.crew.find(a => a.id === id);

let mapEl, layer, menuEl, tipEl;
const icons = {};                // id -> { el, dot, lastTf, lastStatus }
let selectedId = null;
let menuMode = null;             // null | 'radial' | 'actions'
let hoverId = null;

// ---------- Posizioni e movimento ----------

// Slot dell'astronauta nella stanza (frazione 0..1), in base agli altri occupanti
function slotFor(a, roomId) {
  const members = state.crew.filter(m => (m.destination || m.location) === roomId);
  const idx = Math.max(0, members.indexOf(a));
  const lay = LAYOUTS[Math.min(4, Math.max(1, members.length))];
  const [ox, oy] = lay[Math.min(idx, lay.length - 1)];
  const c = roomCenter(roomId);
  return { x: c.x + ox / MAP_W, y: c.y + oy / MAP_H };
}

// Ricalcola gli slot di una stanza: chi è fermo scivola nel nuovo posto, chi arriva aggiorna la meta
function layoutRoom(roomId) {
  if (!roomId) return;
  for (const m of state.crew) {
    const r = m.destination || m.location;
    if (r !== roomId) continue;
    const s = slotFor(m, roomId);
    if (m.destination) {
      if (m.path && m.path.length) m.path[m.path.length - 1] = s;
      else m.path = [s];
    } else if (!m.pos || Math.abs(m.pos.x - s.x) > 1e-4 || Math.abs(m.pos.y - s.y) > 1e-4) {
      m.path = [s];
    }
  }
}

// Posiziona subito tutti gli astronauti nella loro stanza (avvio / reset)
function placeAll() {
  for (const a of state.crew) {
    a.destination = null;
    a.path = [];
  }
  for (const a of state.crew) a.pos = slotFor(a, a.location);
  if (!state.greenhouse) state.greenhouse = { autoWater: false, caretaker: null };
  updateGreenhouseFlag();
}

// Avanza lungo il percorso di dSol (velocità costante in tempo di gioco)
function moveCrew(dSol) {
  const speed = 1 / WALK_SOL_PER_WIDTH; // larghezze mappa per Sol
  for (const a of state.crew) {
    if (!a.path || !a.path.length) {
      if (a.destination) arrive(a);
      continue;
    }
    let left = speed * dSol;
    while (left > 0 && a.path.length) {
      const p = a.path[0];
      const dx = p.x - a.pos.x;
      const dy = (p.y - a.pos.y) * ASPECT;
      const dist = Math.hypot(dx, dy);
      if (dist <= left) {
        a.pos = { x: p.x, y: p.y };
        a.path.shift();
        left -= dist;
      } else {
        a.pos = { x: a.pos.x + dx / dist * left, y: a.pos.y + dy / ASPECT / dist * left };
        left = 0;
      }
    }
    if (!a.path.length && a.destination) arrive(a);
  }
}

function arrive(a) {
  a.location = a.destination;
  a.destination = null;
  emit('crew:arrive', a.id, a.location);
  if (a.task && a.task.room === a.location) startTask(a);
}

// ---------- Assegnazione azioni (API pubblica) ----------

export function assignAction(id, actionId) {
  const a = byId(id);
  const act = ACTIONS[actionId];
  if (!a || !act || state.phase !== 'playing') return false;
  const room = targetRoom(a, actionId);

  a.task = makeTask(a, actionId);
  updateGreenhouseFlag();
  emit('crew:assign', a.id, actionId, room);
  if (act.emitOn === 'click') emit(act.emit, a.id);

  if (a.destination === room) return true;              // già in cammino verso quella stanza
  if (!a.destination && a.location === room) {          // già lì: parte subito
    startTask(a);
    return true;
  }
  const origin = a.destination || a.location;
  a.destination = room;
  const c = roomCenter(room);
  a.path = roomPath({ id: a.location, x: a.pos.x, y: a.pos.y }, { id: room, x: c.x, y: c.y });
  a.path.push(slotFor(a, room));
  layoutRoom(origin);
  layoutRoom(room);
  return true;
}

// Interrompe il task corrente (l'astronauta resta dov'è)
export function cancelTask(id) {
  const a = byId(id);
  if (!a) return;
  a.task = null;
  updateGreenhouseFlag();
}

// ---------- DOM: icone ----------

function buildIcons() {
  layer.innerHTML = '';
  for (const def of CONFIG.crew) {
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'crew-icon';
    el.dataset.id = def.id;
    el.setAttribute('aria-label', `${def.name}, ${def.role}`);
    el.innerHTML = `<img src="assets/img/crew-${def.id}.png" alt="" draggable="false"><span class="status-dot"></span>`;
    el.addEventListener('click', e => {
      e.stopPropagation();
      if (state.phase !== 'playing') return;
      if (selectedId === def.id) closeMenu(); else openRadial(def.id);
    });
    el.addEventListener('pointerenter', () => { hoverId = def.id; renderTooltip(); });
    el.addEventListener('pointerleave', () => { if (hoverId === def.id) hoverId = null; renderTooltip(); });
    layer.appendChild(el);
    icons[def.id] = { el, dot: el.querySelector('.status-dot'), lastTf: '', lastStatus: '' };
  }
}

const toPx = p => ({ x: p.x * MAP_W, y: p.y * MAP_H });

function renderCrew() {
  if (!layer) return;
  for (const a of state.crew) {
    const ic = icons[a.id];
    if (!ic || !a.pos) continue;
    const p = toPx(a.pos);
    const tf = `translate(${(p.x - ICON / 2).toFixed(1)}px, ${(p.y - ICON / 2).toFixed(1)}px)`;
    if (tf !== ic.lastTf) { ic.el.style.transform = tf; ic.lastTf = tf; }
    const st = needsStatus(a);
    if (st !== ic.lastStatus) {
      ic.dot.className = `status-dot ${st}`;
      ic.lastStatus = st;
    }
    ic.el.classList.toggle('moving', !!a.destination);
    ic.el.classList.toggle('selected', a.id === selectedId);
    ic.el.classList.toggle('in-radial', a.id === selectedId && menuMode === 'radial');
  }
  if (hoverId) renderTooltip();
}

// Disattiva la transizione per un frame (salti istantanei: reset)
function snapIcons() {
  layer.classList.add('no-anim');
  for (const ic of Object.values(icons)) ic.lastTf = '';
  renderCrew();
  void layer.offsetWidth;
  requestAnimationFrame(() => layer.classList.remove('no-anim'));
}

// ---------- Tooltip ----------

function taskText(a) {
  if (a.destination) return `Walking to ${roomName(a.destination)}`;
  if (!a.task) return `Idle – ${roomName(a.location)}`;
  if (a.task.duration === Infinity) return `${a.task.label} (ongoing)`;
  const h = Math.max(0, a.task.remaining * 24);
  return `${a.task.label} – ${h >= 1 ? `${h.toFixed(1)} h` : `${Math.ceil(h * 60)} min`} left`;
}

let lastTip = '';
function renderTooltip() {
  const a = hoverId && byId(hoverId);
  if (!a || menuMode) { tipEl.classList.add('hidden'); lastTip = ''; return; }
  const def = CONFIG.crew.find(c => c.id === a.id);
  const html = `<b>${def.name}</b><span>${def.role}</span><em>${taskText(a)}</em>`;
  if (html !== lastTip) { tipEl.innerHTML = html; lastTip = html; }
  const p = toPx(a.pos);
  tipEl.style.left = `${p.x}px`;
  tipEl.style.top = `${p.y - ICON / 2 - 8}px`;
  tipEl.classList.remove('hidden');
}

// ---------- Menu radiale e lista azioni ----------

function menuCenter(a) {
  const p = toPx(a.pos);
  return {
    // la mappa ha ~94 px di margine nello stage: il menu può uscirne un poco ai lati
    x: Math.max(72, Math.min(MAP_W - 216, p.x)),
    y: Math.max(98, Math.min(MAP_H - 98, p.y)),
  };
}

export function openRadial(id) {
  const a = byId(id);
  if (!a || state.phase !== 'playing') return;
  selectedId = id;
  menuMode = 'radial';
  const c = menuCenter(a);
  menuEl.className = 'crew-menu radial';
  menuEl.style.left = `${c.x}px`;
  menuEl.style.top = `${c.y}px`;
  menuEl.innerHTML = `<img class="menu-avatar" src="assets/img/crew-${id}.png" alt="" draggable="false">` +
    ROOM_GROUPS.map(g => {
      const [dx, dy, al] = RADIAL_POS[g.id];
      return `<button type="button" class="pill pill-room ${al}" data-group="${g.id}" style="left:${dx}px;top:${dy}px">${g.label}</button>`;
    }).join('');
  menuEl.classList.remove('hidden');
  renderTooltip();
  emit('crew:select', id);
  renderCrew();
}

function openActions(groupId) {
  const a = byId(selectedId);
  const g = ROOM_GROUPS.find(x => x.id === groupId);
  if (!a || !g) return;
  menuMode = 'actions';
  const c = toPx(a.pos);
  menuEl.className = 'crew-menu actions';
  menuEl.innerHTML = `
    <button type="button" class="pill pill-group" data-back title="Back to rooms">${g.pill}</button>
    <div class="action-col">
      ${g.actions.map(id => {
        const act = ACTIONS[id];
        const spec = isSpecialist(a, act);
        const active = a.task && a.task.id === id;
        return `<button type="button" class="pill pill-action${spec ? ' spec' : ''}${active ? ' active' : ''}" data-action="${id}"${spec ? ' title="Specialist: faster and more effective"' : ''}>${act.label}</button>`;
      }).join('')}
    </div>`;
  menuEl.style.left = '0px';
  menuEl.style.top = '0px';
  menuEl.classList.remove('hidden');
  // Posiziona accanto all'icona restando dentro la mappa
  const w = menuEl.offsetWidth;
  const h = menuEl.offsetHeight;
  let left = c.x + ICON / 2 + 10;
  if (left + w > MAP_W - 8) left = c.x - ICON / 2 - 10 - w;
  left = Math.max(8, Math.min(MAP_W - w - 8, left));
  const top = Math.max(8, Math.min(MAP_H - h - 8, c.y - h / 2));
  menuEl.style.left = `${left}px`;
  menuEl.style.top = `${top}px`;
}

export function closeMenu() {
  if (!menuEl) return;
  menuEl.classList.add('hidden');
  menuEl.innerHTML = '';
  menuMode = null;
  const was = selectedId;
  selectedId = null;
  if (was) emit('crew:deselect', was);
  renderCrew();
}

function onMenuClick(e) {
  e.stopPropagation();
  const b = e.target.closest('button');
  if (!b || state.phase !== 'playing') return;
  if (b.dataset.group) openActions(b.dataset.group);
  else if (b.hasAttribute('data-back')) openRadial(selectedId);
  else if (b.dataset.action) {
    assignAction(selectedId, b.dataset.action);
    closeMenu();
  }
}

// ---------- Inizializzazione ----------

export function initCrew(mapContainer) {
  mapEl = mapContainer;
  layer = document.createElement('div');
  layer.className = 'crew-layer';
  mapEl.appendChild(layer);
  menuEl = document.createElement('div');
  menuEl.className = 'crew-menu hidden';
  mapEl.appendChild(menuEl);
  tipEl = document.createElement('div');
  tipEl.className = 'crew-tooltip hidden';
  mapEl.appendChild(tipEl);

  buildIcons();
  placeAll();
  snapIcons();

  menuEl.addEventListener('click', onMenuClick);
  // Click fuori dal menu: chiude (le stanze sono gestite da room:click)
  document.addEventListener('pointerdown', e => {
    if (!menuMode) return;
    const t = e.target;
    if (menuEl.contains(t) || t.closest?.('.crew-icon') || t.closest?.('.room-area')) return;
    closeMenu();
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && menuMode) closeMenu();
  });

  // Click su una stanza con astronauta selezionato: apre le azioni di quella stanza
  on('room:click', roomId => {
    if (!selectedId || state.phase !== 'playing') return;
    const g = groupForRoom(roomId);
    if (g) openActions(g); else closeMenu();
  });

  on('tick', dSol => {
    if (state.phase !== 'playing') return;
    moveCrew(dSol);
    tickActions(dSol);
  });
  on('update', renderCrew);
  on('fail', closeMenu);
  on('win', closeMenu);
  on('reset', () => { closeMenu(); hoverId = null; placeAll(); snapIcons(); });
}

export function getSelected() { return selectedId; }
export { layoutRoom };
