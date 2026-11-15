// Modale riusabile: 'warning' (cornice lilla + box colorato), 'info' (avvisi FLR/CME) e 'badge'
// Una sola modale alla volta (le altre vanno in coda); il gioco resta in pausa ('modal') finché è aperta.
import { state } from '../state.js';
import { on, pause, resume } from '../loop.js';

let layer = null;
let current = null;              // { el, opts }
const queue = [];

export const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function initModal(sceneEl) {
  layer = document.createElement('div');
  layer.className = 'modal-layer hidden';
  sceneEl.appendChild(layer);
  // Fine partita o restart: chiude tutto senza callback
  const wipe = () => closeAll();
  on('fail', wipe);
  on('win', wipe);
  on('reset', wipe);
  // Invio/Spazio non devono attivare la pausa mentre una modale è aperta: Enter = bottone principale
  document.addEventListener('keydown', e => {
    if (!current) return;
    if (e.key === 'Enter') {
      e.preventDefault();
      current.el.querySelector('[data-modal-btn]')?.click();
    }
  });
}

// Corpo HTML per 'warning'/'info'
function textBody(o) {
  return `
    <div class="modal-text">
      <p class="modal-title">${esc(o.title)}</p>
      ${o.message ? `<p class="modal-message">${esc(o.message)}</p>` : ''}
      ${o.term || o.text ? `<p class="modal-expl">${o.term ? `<b>${esc(o.term)}</b> ` : ''}${esc(o.text || '')}</p>` : ''}
      ${o.fact ? `<p class="modal-fact">${esc(o.fact)}</p>` : ''}
    </div>`;
}

// Corpo HTML per 'badge': titolo, testo sblocco, immagine + bonus + ispirazione
function badgeBody(o) {
  const b = o.badge;
  // Grassetto sulla parte numerica del bonus ("+10% Crop Growth Efficiency" added …)
  let bonus = '';
  if (b.bonus) {
    const m = b.bonus.match(/^(.*?)( added .*| across .*)$/);
    bonus = m ? `<b>${esc(m[1])}</b>${esc(m[2])}` : `<b>${esc(b.bonus)}</b>`;
  }
  // Nome del modello di riferimento evidenziato
  let insp = esc(b.inspiration);
  if (b.roleModel) insp = insp.replace(esc(b.roleModel), `<b class="role-model">${esc(b.roleModel)}</b>`);
  return `
    <p class="badge-title">${esc(b.title)}</p>
    <p class="badge-unlock">${esc(b.unlock)}</p>
    <div class="badge-row">
      <img class="badge-img" src="${esc(o.image)}" alt="${esc(b.name)} badge" draggable="false">
      <div class="badge-col">
        ${bonus ? `<p class="badge-bonus">${bonus}</p>` : ''}
        <p class="badge-insp">${insp}</p>
      </div>
    </div>`;
}

// Mostra una modale. opts: { type, theme, title, message, term, text, fact, button, onClose, badge, image }
export function showModal(opts) {
  if (!layer) return null;
  if (current) { queue.push(opts); return opts; }
  open(opts);
  return opts;
}

function open(opts) {
  const type = opts.type || 'warning';
  const theme = opts.theme || (type === 'badge' ? 'green' : 'green');
  const el = document.createElement('div');
  el.className = `modal modal-${type} theme-${theme}`;
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-modal', 'true');
  const btn = `<button type="button" class="modal-btn" data-modal-btn>${esc(opts.button || 'OK')}</button>`;
  if (type === 'badge') {
    el.innerHTML = `<div class="badge-panel">${badgeBody(opts)}${btn}</div>`;
  } else {
    el.innerHTML = `<div class="modal-frame"><div class="modal-box">${textBody(opts)}${btn}</div></div>`;
  }
  el.querySelector('[data-modal-btn]').addEventListener('click', e => {
    e.stopPropagation();
    if (state.phase !== 'playing') return;
    closeModal(opts, true);
  });
  layer.innerHTML = '';
  layer.appendChild(el);
  layer.classList.remove('hidden');
  current = { el, opts };
  pause('modal');
  el.querySelector('[data-modal-btn]').focus({ preventScroll: true });
}

// Chiude la modale indicata (o quella corrente); runCallback = esegue onClose
export function closeModal(opts, runCallback = false) {
  if (!current) return;
  if (opts && current.opts !== opts) {
    const i = queue.indexOf(opts);
    if (i >= 0) queue.splice(i, 1);
    return;
  }
  const done = current.opts;
  current = null;
  layer.innerHTML = '';
  if (queue.length) open(queue.shift());
  else { layer.classList.add('hidden'); resume('modal'); }
  if (runCallback && typeof done.onClose === 'function') {
    try { done.onClose(); } catch (err) { console.error('[modal] onClose', err); }
  }
}

export function closeAll() {
  queue.length = 0;
  current = null;
  if (layer) { layer.innerHTML = ''; layer.classList.add('hidden'); }
  resume('modal');
}

export function isModalOpen() { return !!current; }
