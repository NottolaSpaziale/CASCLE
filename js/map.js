// Mappa della base: immagine di sfondo, 13 aree stanza cliccabili, etichette
import { CONFIG } from './config.js';
import { emit } from './loop.js';

// Dimensioni della mappa nello stage 1280x720 (raster 3840x2160 posizionato come nel Figma)
export const MAP_W = 1092;
export const MAP_H = 614;

// Geometria calibrata sull'immagine (coordinate di riferimento 1280x720 del raster)
// rect = area cliccabile [x, y, w, h]; c = centro dove si radunano gli astronauti; label = [x, y]
const GEOMETRY = {
  lifeSupport: { rect: [35, 45, 195, 255],  c: [130, 200], label: [138, 22] },
  cabin1:      { rect: [235, 45, 160, 255], c: [315, 205], label: [316, 22] },
  cabin2:      { rect: [400, 45, 162, 255], c: [478, 205], label: [473, 22] },
  galley:      { rect: [570, 45, 228, 255], c: [685, 205], label: [688, 22] },
  medical:     { rect: [802, 45, 198, 255], c: [905, 205], label: [901, 22] },
  labs:        { rect: [1003, 45, 250, 255], c: [1120, 205], label: [1122, 22] },
  restroom:    { rect: [28, 385, 190, 240], c: [120, 505],  label: [120, 648] },
  cabin3:      { rect: [220, 385, 168, 240], c: [305, 510], label: [305, 648] },
  cabin4:      { rect: [390, 385, 168, 240], c: [470, 510], label: [473, 648] },
  gym:         { rect: [568, 385, 230, 240], c: [680, 510], label: [668, 648] },
  bunker:      { rect: [802, 385, 200, 200], c: [905, 445], label: null },
  airlock:     { rect: [838, 585, 125, 132], c: [900, 650], label: [897, 727] },
  comms:       { rect: [1005, 355, 255, 260], c: [1130, 505], label: [1122, 648] },
};
// Quota del corridoio centrale (percorso degli spostamenti)
const CORRIDOR_Y = 345;

// Coordinate di riferimento -> frazione 0..1 della mappa
const fx = x => x / 1280;
const fy = y => y / 720;

let mapEl = null;
const roomEls = {};

// Crea la mappa dentro il contenitore #map
export function initMap(container) {
  mapEl = container;
  mapEl.classList.remove('map-placeholder');
  mapEl.innerHTML = '';

  const img = document.createElement('img');
  img.className = 'map-img';
  img.src = 'assets/img/map.png';
  img.alt = 'Lunar base map';
  img.draggable = false;
  mapEl.appendChild(img);

  // Cartello "Bunker" (nel Figma è vettoriale, non incluso nel raster)
  const sign = document.createElement('div');
  sign.className = 'bunker-sign';
  sign.innerHTML = '<span class="bunker-dot"></span>Bunker';
  sign.style.left = `${fx(900) * 100}%`;
  sign.style.top = `${fy(472) * 100}%`;
  mapEl.appendChild(sign);

  // Aree stanza + etichette
  for (const room of CONFIG.rooms) {
    const g = GEOMETRY[room.id];
    if (!g) continue;
    const el = document.createElement('div');
    el.className = 'room-area';
    el.dataset.room = room.id;
    el.title = room.name;
    const [x, y, w, h] = g.rect;
    Object.assign(el.style, {
      left: `${fx(x) * 100}%`, top: `${fy(y) * 100}%`,
      width: `${fx(w) * 100}%`, height: `${fy(h) * 100}%`,
    });
    el.addEventListener('click', e => {
      e.stopPropagation();
      emit('room:click', room.id);
    });
    mapEl.appendChild(el);
    roomEls[room.id] = el;

    if (g.label) {
      const lab = document.createElement('div');
      lab.className = 'room-label';
      lab.textContent = room.name;
      lab.style.left = `${fx(g.label[0]) * 100}%`;
      lab.style.top = `${fy(g.label[1]) * 100}%`;
      mapEl.appendChild(lab);
    }
  }
  return mapEl;
}

export function getMapEl() { return mapEl; }
export function getRoomEl(id) { return roomEls[id] || null; }

// Centro della stanza in frazione 0..1 della mappa
export function roomCenter(id) {
  const g = GEOMETRY[id] || GEOMETRY.labs;
  return { x: fx(g.c[0]), y: fy(g.c[1]) };
}

// Percorso stanza A -> stanza B passando dal corridoio (lista di punti 0..1)
export function roomPath(from, to) {
  const a = from;
  const b = to;
  const cy = fy(CORRIDOR_Y);
  // Airlock: si passa prima dal bunker
  const bunker = roomCenter('bunker');
  const pts = [];
  const exitVia = p => (p.id === 'airlock' ? [{ x: bunker.x, y: bunker.y }] : []);
  pts.push(...exitVia(a));
  pts.push({ x: a.x, y: cy });
  pts.push({ x: b.x, y: cy });
  if (b.id === 'airlock') pts.push({ x: bunker.x, y: bunker.y });
  return pts;
}
