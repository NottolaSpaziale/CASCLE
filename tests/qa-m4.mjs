import http from 'http'; import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url';
import { chromium } from 'playwright';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const mime = { '.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.svg':'image/svg+xml' };
const server = http.createServer((q, r) => { let p = decodeURIComponent(q.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html'; const f = path.join(root, p);
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end('nf'); }
  r.writeHead(200, { 'content-type': mime[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r); }).listen(8084);
const res = { checks: {}, errors: [], failed: [] };
const ck = (n, ok, d) => { res.checks[n] = { ok: !!ok, d }; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const br = await chromium.launch();
const shot = (pg, n) => pg.screenshot({ path: path.join(root, `tests/shot-m4-${n}.png`) });
async function open(q) {
  const pg = await (await br.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
  pg.on('console', m => { if (['error', 'warning'].includes(m.type())) res.errors.push(m.type() + ': ' + m.text()); });
  pg.on('pageerror', e => res.errors.push('pageerror: ' + e.message));
  pg.on('response', r => { if (r.status() >= 400) res.failed.push(r.status() + ' ' + r.url()); });
  await pg.goto('http://localhost:8084/' + q); await sleep(700); return pg;
}
const modalText = pg => pg.locator('.modal-layer:not(.hidden) .modal').first().innerText().catch(() => '');
const G = (pg, f, a) => pg.evaluate(f, a);
try {
  // ---- Notte: alert, modale, pannello ----
  let pg = await open('?sol=14');
  ck('icon', await pg.locator('.event-alert').count() === 1);
  ck('paused1x', await G(pg, () => game.state.speed === 1 && game.state.paused), await G(pg, () => JSON.stringify([game.state.speed, game.state.paused, game.state.pauseReasons])));
  await shot(pg, 'alert');
  await pg.locator('.event-alert').click();
  const mt = await modalText(pg);
  ck('nightModal', /14-Day Lunar Night begins/.test(mt) && /MANAGE ENERGY/.test(mt) && /Battery Backup/.test(mt), mt.slice(0, 120));
  await shot(pg, 'night-modal');
  await pg.locator('[data-modal-btn]').click(); await sleep(300);
  ck('panelOpens', await G(pg, () => game.power.isOpen));
  ck('pausedPanel', await G(pg, () => game.state.paused));
  const pageText = async () => (await pg.locator('.pp-page:not(.hidden)').innerText()).replace(/\n+/g, ' | ');
  let t1 = await pageText();
  ck('p1Title', /Crew Safety and basics/.test(t1) && /at least 50%/.test(t1), t1.slice(0, 100));
  ck('p1Systems', ['Life Support', 'Warmth', 'Water Recycling', 'Communications', 'Radiation Shield'].every(s => t1.includes(s)), t1);
  const rowsVis = await pg.locator('.pp-page:not(.hidden) .pp-row').count(); ck('p1_5rows', rowsVis === 5, rowsVis);
  const cards = (await pg.locator('.pp-card').allInnerTexts()).map(x => x.replace(/\n+/g, ' ')); ck('cards', cards.length === 5, JSON.stringify(cards));
  await shot(pg, 'page1');
  await pg.locator('[data-pp=next]').click(); await sleep(150);
  t1 = await pageText();
  ck('p2Title', /Lunar base rooms/.test(t1), t1.slice(0, 80));
  ck('p2_8rows', await pg.locator('.pp-page:not(.hidden) .pp-row').count() === 8);
  ck('p2Globals', await pg.locator('[data-all]').count() === 3 && await pg.locator('[data-all=MAX]').isVisible());
  await shot(pg, 'page2');
  await pg.locator('[data-pp=back]').click(); await sleep(150);
  ck('backToP1', /Crew Safety/.test(await pageText()) && await G(pg, () => game.power.isOpen));
  await pg.locator('[data-pp=back]').click(); await sleep(150);
  ck('backClosesP1', !(await G(pg, () => game.power.isOpen)) && !(await G(pg, () => game.state.paused)), await G(pg, () => JSON.stringify(game.state.pauseReasons)));
  await pg.locator('.event-alert').click(); await sleep(200);
  ck('reopenIcon', await G(pg, () => game.power.isOpen));
  await pg.keyboard.press('Escape'); await sleep(150);
  ck('escCloses', !(await G(pg, () => game.power.isOpen)));
  await G(pg, () => game.power.open()); const a = await G(pg, () => game.state.sol + game.state.solProgress); await sleep(1000);
  ck('frozenOpen', a === await G(pg, () => game.state.sol + game.state.solProgress));
  await G(pg, () => game.power.close());
  await pg.context().close();

  // ---- EASY ----
  pg = await open('?sol=15');
  await G(pg, () => game.power.setDifficulty('easy')); await G(pg, () => game.power.open());
  const before = await G(pg, () => JSON.stringify(game.power.levels));
  await pg.locator('[data-sys=lifeSupport] [data-tick=MAX]').click({ force: true, timeout: 2000 }).catch(() => {});
  ck('easySliderDisabled', await pg.locator('[data-sys=lifeSupport] .pp-slider').isDisabled());
  ck('easyNoChange', before === await G(pg, () => JSON.stringify(game.power.levels)));
  await pg.locator('[data-pp=next]').click();
  ck('easyP2Disabled', await pg.locator('[data-sys=gym] .pp-slider').isDisabled());
  await pg.locator('[data-all=MAX]').click(); ck('easyMax', await G(pg, () => game.power.nominal()) === 112, await G(pg, () => game.power.nominal()));
  await shot(pg, 'easy-max');
  await pg.locator('[data-all=ECO]').click(); ck('easyEco', await G(pg, () => game.power.nominal()) === 56, await G(pg, () => game.power.nominal()));
  const cardTxt = (await pg.locator('.pp-card').allInnerTexts()).join('|').replace(/\n+/g, ' ');
  ck('cardNominal56', /56 units\/day/.test(cardTxt), cardTxt);
  await shot(pg, 'easy-eco');
  await pg.context().close();

  // ---- HARD ----
  pg = await open('?sol=15');
  await G(pg, () => { game.power.setDifficulty('hard'); game.power.setAll('eco'); game.power.open(); game.power.setPage(2); });
  ck('hardSlidersEnabled', !(await pg.locator('[data-sys=gym] .pp-slider').isDisabled()));
  await pg.locator('[data-sys=gym] .pp-slider').fill('2');
  ck('hardGymMax', await G(pg, () => game.power.get('gym')) === 'MAX', await G(pg, () => game.power.get('gym')));
  ck('hardNominalGym', await G(pg, () => game.power.nominal()) === 58, await G(pg, () => game.power.nominal()));
  await pg.locator('[data-sys=gym] .pp-slider').fill('0');
  ck('hardGymOff', await G(pg, () => game.power.get('gym')) === 'OFF' && await G(pg, () => game.power.nominal()) === 55, await G(pg, () => game.power.nominal()));
  const lvls = {};
  for (const id of ['greenhouse', 'labs', 'medical', 'galley', 'cabins', 'restroom']) {
    const nb = await G(pg, () => game.power.nominal());
    await pg.locator(`[data-sys=${id}] .pp-slider`).fill('2');
    lvls[id] = (await G(pg, () => game.power.nominal())) > nb;
  }
  ck('hardEachSliderChanges', Object.values(lvls).every(Boolean), JSON.stringify(lvls));
  await shot(pg, 'hard-p2');
  ck('bunkerDisabled', await pg.locator('[data-sys=bunker] .pp-slider').isDisabled());
  await pg.locator('[data-sys=bunker] [data-tick=MAX]').click({ force: true, timeout: 2000 }).catch(() => {});
  ck('bunkerEco', await G(pg, () => game.power.get('bunker')) === 'ECO');
  await G(pg, () => game.power.set('bunker', 'OFF')); ck('bunkerApiFixed', await G(pg, () => game.power.get('bunker')) === 'ECO');
  await G(pg, () => game.power.setPage(1));
  const cs = {};
  for (const id of ['lifeSupport', 'warmth', 'waterRecycling', 'communications']) {
    await pg.locator(`[data-sys=${id}] .pp-slider`).fill('0');
    cs[id] = await G(pg, i => game.power.get(i), id);
    await pg.locator(`[data-sys=${id}] .pp-slider`).fill('2');
    cs[id + '_max'] = await G(pg, i => game.power.get(i), id);
  }
  ck('crewSafetyMinEco', ['lifeSupport', 'warmth', 'waterRecycling', 'communications'].every(i => cs[i] === 'ECO' && cs[i + '_max'] === 'MAX'), JSON.stringify(cs));
  await pg.locator('[data-sys=radiationShield] .pp-slider').fill('0');
  ck('shieldCanOff', await G(pg, () => game.power.get('radiationShield')) === 'OFF');
  ck('stillPlaying', await G(pg, () => game.state.phase) === 'playing');
  await shot(pg, 'hard-p1');
  await pg.context().close();

  // ---- Tutto OFF ----
  pg = await open('?sol=15');
  await G(pg, () => game.power.open()); await pg.locator('[data-pp=next]').click();
  await pg.locator('[data-all=OFF]').click(); await sleep(500);
  const ov = await pg.locator('#endgame').innerText();
  ck('allOffFail', /MISSION FAILED/.test(ov) && /entire base has been shut down/.test(ov) && await G(pg, () => game.state.phase) === 'failed', ov.replace(/\n+/g, ' | '));
  await shot(pg, 'failed-off');
  await pg.locator('.endgame-btn').click(); await sleep(400);
  ck('restartAfterOff', await G(pg, () => game.state.sol === 1 && game.state.phase === 'playing') && !(await G(pg, () => game.power.isOpen)));
  await pg.context().close();

  // ---- Vittoria Sol 27 -> 28 ----
  pg = await open('?sol=27');
  await G(pg, () => game.power.setAll('eco')); await G(pg, () => game.setSpeed(10));
  const seq = []; const t0 = Date.now();
  while (Date.now() - t0 < 60000) {
    if (await G(pg, () => game.state.phase) !== 'playing') break;
    if (await pg.locator('.modal-layer:not(.hidden)').count()) {
      const tx = await modalText(pg); seq.push(tx.replace(/\n+/g, ' ').slice(0, 90));
      if (/Koch|Whitson/.test(tx)) await shot(pg, /Koch/.test(tx) ? 'badge-power' : 'badge-sol28');
      await pg.locator('[data-modal-btn]').first().click({ timeout: 2000 }).catch(() => {});
    }
    await sleep(250);
  }
  ck('winPhase', await G(pg, () => game.state.phase) === 'won' && await G(pg, () => game.state.sol) === 28, JSON.stringify(seq));
  const iK = seq.findIndex(x => /Koch/.test(x)), iW = seq.findIndex(x => /Whitson/.test(x));
  ck('badgeOrder', seq.length >= 2 && /mastered the base energy grid/.test(seq[0]) && /survived the 14-day lunar night/.test(seq[1]), JSON.stringify(seq));
  const wt = await pg.locator('#endgame').innerText(); ck('completeText', /MISSION COMPLETE/i.test(wt), wt.replace(/\n+/g, ' | '));
  ck('winBadges', await pg.locator('.endgame-badge').count() >= 2, await pg.locator('.endgame-badge').count());
  await shot(pg, 'win');
  await pg.context().close();

  // ---- Solare 0 in notte ----
  pg = await open('?sol=16');
  const sol0 = await G(pg, () => ({ s: game.state.solarOutput, p: game.state.power }));
  await G(pg, () => game.setSpeed(4)); await sleep(3000);
  const sol1 = await G(pg, () => ({ s: game.state.solarOutput, p: game.state.power }));
  ck('solarZeroNight', sol1.s === 0 && sol1.p < sol0.p, JSON.stringify([sol0, sol1]));
  await pg.context().close();

  // ---- Serra luce verde ----
  const gh = async light => {
    const p = await open('?sol=4');
    await p.locator('.event-alert').click(); await p.locator('[data-modal-btn]').click(); await sleep(300);
    await p.evaluate(() => { for (const x of game.state.greenhouse.plants) { x.health = 20; x.water = 95; } game.state.plantHealth = 20; game.state.greenhouse.eventActive = false; });
    await p.locator(`[data-light=${light}]`).click();
    const h0 = await p.evaluate(() => game.state.greenhouse.plants.map(x => x.health));
    await p.evaluate(() => game.setSpeed(4)); await sleep(1200);
    const h1 = await p.evaluate(() => game.state.greenhouse.plants.map(x => x.health));
    await p.context().close();
    const avg = x => x.reduce((u, v) => u + v, 0) / x.length;
    return avg(h1) - avg(h0);
  };
  const gG = await gh('green'), gR = await gh('red');
  ck('greenFasterThanRed', gG > gR * 1.2, `green +${gG.toFixed(2)} vs red +${gR.toFixed(2)}`);

  // ---- Scudi con Radiation Shield OFF ----
  pg = await open('?sol=8');
  await G(pg, () => { game.power.setDifficulty('hard'); game.power.set('radiationShield', 'OFF'); });
  await pg.locator('.event-alert').click(); await pg.locator('[data-modal-btn]').click(); await sleep(300);
  const sb = pg.locator('[data-storm=shields]');
  ck('shieldsDisabled', await sb.isDisabled());
  const note = await pg.locator('.storm-shield-off').innerText(); ck('shieldsNote', /Radiation Shield is OFF in the power panel/.test(note) && await pg.locator('.storm-shield-off').isVisible(), note);
  const pb = await G(pg, () => game.state.power);
  await sb.click({ force: true, timeout: 2000 }).catch(() => {}); await sleep(200);
  ck('noCostWhenOff', Math.abs(pb - await G(pg, () => game.state.power)) < 3 && await pg.locator('.storm-screen:not(.hidden)').count() === 1);
  await shot(pg, 'storm-shields-off');
  await pg.context().close();
  pg = await open('?sol=8');
  await G(pg, () => { game.power.setDifficulty('hard'); game.power.set('radiationShield', 'MAX'); });
  await pg.locator('.event-alert').click(); await pg.locator('[data-modal-btn]').click(); await sleep(300);
  ck('shieldsEnabledOn', !(await pg.locator('[data-storm=shields]').isDisabled()) && !(await pg.locator('.storm-shield-off').isVisible()));
  const p0 = await G(pg, () => game.state.power); await pg.locator('[data-storm=shields]').click(); await sleep(100);
  const p1 = await G(pg, () => game.state.power); ck('shields30', Math.abs((p0 - p1) - 30) < 3, p0 + '->' + p1);
  await pg.context().close();

  // ---- Check Power Panel in qualsiasi Sol (via evento azione) ----
  pg = await open('?sol=3');
  ck('noNightIconSol3', await pg.locator('.event-alert[data-event=lunarNight]').count() === 0);
  await pg.click('.crew-icon[data-id=astrid]'); await sleep(200);
  await pg.locator('.room-area[data-room=lifeSupport]').dispatchEvent('click'); await sleep(300);
  const body = await pg.locator('.crew-menu').innerText().catch(() => '');
  ck('menuHasCheck', /Check Power Panel/.test(body), body.replace(/\n+/g, '|').slice(0, 200));
  await shot(pg, 'check-menu');
  await pg.locator('.pill-action[data-action=powerPanel]').click({ timeout: 2000 }).catch(() => {});
  await G(pg, () => game.setSpeed(10));
  for (let i = 0; i < 40 && !(await G(pg, () => game.power.isOpen)); i++) {
    if (await pg.locator('.modal-layer:not(.hidden)').count()) await pg.locator('[data-modal-btn]').first().click({ timeout: 1000 }).catch(() => {});
    await sleep(250);
  }
  ck('checkPanelOpens', await G(pg, () => game.power.isOpen), await G(pg, () => JSON.stringify(game.state.pauseReasons)));
  await pg.context().close();

  // ---- FPS ----
  pg = await open('?sol=15');
  const fpsOf = (ms) => pg.evaluate(ms => new Promise(r => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 < ms) requestAnimationFrame(f); else r(n * 1000 / ms); }; requestAnimationFrame(f); }), ms);
  res.fps = await fpsOf(3000);
  await G(pg, () => game.power.open()); await sleep(300);
  res.fpsPanel = await fpsOf(2000);
  await pg.screenshot({ path: path.join(root, 'tests/screenshot.png') });
} catch (e) { ck('exception', false, e.stack.split('\n').slice(0, 3).join(' ')); }
await br.close(); server.close();
const bad = Object.entries(res.checks).filter(([, v]) => !v.ok);
res.bad = bad; res.n = Object.keys(res.checks).length;
res.ok = !bad.length && !res.errors.length && !res.failed.length && res.fps >= 30;
delete res.checks;
console.log(JSON.stringify(res, null, 1)); process.exit(res.ok ? 0 : 1);
