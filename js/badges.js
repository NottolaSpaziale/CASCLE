// Badge (§9.3): sblocco in state.badges, bonus applicati, modale di sblocco riusabile (Moduli 3-5)
import { CONFIG } from './config.js';
import { state } from './state.js';
import { emit } from './loop.js';
import { showModal } from './screens/modal.js';

export const BADGE_IDS = Object.keys(CONFIG.badges);

export function hasBadge(id) {
  return Array.isArray(state.badges) && state.badges.includes(id);
}

// Sblocca un badge; restituisce true se è nuovo. Il bonus Power è letto da loop.computeDailyConsumption,
// quello Greenhouse da cropGrowthMultiplier().
export function unlockBadge(id) {
  if (!CONFIG.badges[id]) return false;
  if (!Array.isArray(state.badges)) state.badges = [];
  if (state.badges.includes(id)) return false;
  state.badges.push(id);
  emit('badge:unlock', id);
  emit('update');
  return true;
}

// Moltiplicatore di crescita della serra (+10 % con il badge Greenhouse)
export function cropGrowthMultiplier() {
  const eff = CONFIG.badges.greenhouse.effect;
  return 1 + (hasBadge('greenhouse') && eff ? eff.cropGrowth : 0);
}

// Percorso immagine del badge (sbloccato / bloccato) + se va mostrato in grigio via CSS
export function badgeImage(id, unlocked = hasBadge(id)) {
  const im = CONFIG.badgeImages[id];
  if (!im) return { src: '', gray: false };
  return unlocked ? { src: im.on, gray: false } : { src: im.off, gray: !!im.offGray };
}

// Sblocca (se serve) e mostra la modale badge con CONTINUE MISSION. opts: { onClose, unlock=true, button }
export function showBadge(id, opts = {}) {
  const b = CONFIG.badges[id];
  if (!b) return null;
  if (opts.unlock !== false) unlockBadge(id);
  return showModal({
    type: 'badge',
    theme: b.theme || 'green',
    badge: b,
    image: badgeImage(id, true).src,
    button: opts.button || 'CONTINUE MISSION',
    onClose: opts.onClose,
  });
}
