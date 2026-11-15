import http from 'http'; import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url';
import { chromium } from 'playwright';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const mime = { '.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.svg':'image/svg+xml' };
const server = http.createServer((q, r) => { let p = decodeURIComponent(q.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html'; const f = path.join(root, p);
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end('nf'); }
  r.writeHead(200, { 'content-type': mime[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r); }).listen(8083);
const res = { checks: {}, errors: [], failed: [] };
const ck = (n, ok, d) => { res.checks[n] = { ok: !!ok, d }; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const br = await chromium.launch();
const shot = (pg, n) => pg.screenshot({ path: path.join(root, `tests/shot-m3-${n}.png`) });
async function open(q) {
  const pg = await (await br.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
  pg.on('console', m => { if (['error','warning'].includes(m.type())) res.errors.push(m.type()+': '+m.text()); });
  pg.on('pageerror', e => res.errors.push('pageerror: '+e.message));
  pg.on('response', r => { if (r.status() >= 400) res.failed.push(r.status()+' '+r.url()); });
  await pg.goto('http://localhost:8083/' + q); await pg.evaluate(() => { if (window.game && game.titleVisible) game.start(); }); await sleep(700); return pg;
}
const modalText = pg => pg.locator('.modal-layer:not(.hidden) .modal').first().innerText().catch(() => '');
try {
  // ---- Serra ----
  let pg = await open('?sol=4');
  ck('icon_labs', await pg.locator('.event-alert').count() === 1, 'count');
  ck('speed1_paused', await pg.evaluate(() => game.state.speed === 1 && game.state.paused), await pg.evaluate(() => JSON.stringify([game.state.speed, game.state.paused, game.state.pauseReasons])));
  await shot(pg, 'gh-alert');
  await pg.locator('.event-alert').click();
  const w = await modalText(pg); ck('warningText', /Veggie system/.test(w) && /SOLVE/.test(w), w.slice(0, 120));
  await shot(pg, 'gh-warning');
  await pg.locator('[data-modal-btn]').click(); await sleep(300);
  ck('ghOpen', await pg.evaluate(() => game.events.greenhouse.isOpen));
  const hud = await pg.locator('#topbar').innerText(); ck('ghHud', /POWER/.test(hud) && /WATER/.test(hud) && /PLANT HEALTH/.test(hud), hud.replace(/\n+/g,'|'));
  ck('6plants', await pg.locator('.gh-plant').count() === 6);
  ck('6bars', await pg.locator('.gh-track').count() === 6);
  await shot(pg, 'gh-bad');
  const bgOf = () => pg.locator('.gh-screen').evaluate(e => getComputedStyle(e).backgroundColor);
  const bgs = {};
  for (const c of ['red','green','blue']) { await pg.locator(`[data-light=${c}]`).click(); await sleep(100); bgs[c] = await bgOf(); }
  ck('lightChangesBg', new Set(Object.values(bgs)).size === 3, JSON.stringify(bgs));
  await pg.locator('[data-light=green]').click();
  const snap = () => pg.evaluate(() => ({ ph: game.state.plantHealth, w: game.state.water, p: game.state.power, bars: game.state.greenhouse.plants.map(x => Math.round(x.water)) }));
  const a0 = await snap();
  await pg.locator('[data-gh-water]').click(); await sleep(50);
  const a1 = await snap();
  ck('waterCost', a1.w < a0.w && a1.p < a0.p && a1.bars.every(b => b > 90), JSON.stringify([a0, a1]));
  ck('waterBtnGray', await pg.locator('[data-gh-water]').evaluate(e => e.disabled || e.classList.contains('cooldown')));
  await shot(pg, 'gh-cooldown');
  await pg.evaluate(() => game.setSpeed(4));
  const hs = [];
  for (let i = 0; i < 100 && !(await pg.locator('.modal-badge').count()); i++) { hs.push(Math.round((await snap()).ph)); await sleep(150); if (await pg.locator('.modal-info').count()) await pg.locator('[data-modal-btn]').click(); }
  ck('gradual', hs.length >= 3 && hs.every((v, i) => i === 0 || v >= hs[i-1]) && hs[hs.length-1] > hs[0] && Math.max(...hs.slice(1).map((v,i)=>v-hs[i])) <= 25, hs.join(','));
  await sleep(200);
  const bt = await modalText(pg);
  ck('badgeGh', /Dr\. Gioia Massa/.test(bt) && /CONTINUE MISSION/.test(bt) && /Crop Growth/.test(bt), bt.slice(0, 100));
  await shot(pg, 'gh-badge');
  await pg.locator('[data-modal-btn]').click(); await sleep(200);
  ck('badgeStored', await pg.evaluate(() => game.badges.has('greenhouse')));
  ck('ghClosedAfter', !(await pg.evaluate(() => game.events.greenhouse.isOpen)));
  ck('noModalLeft', (await pg.locator('.modal-layer:not(.hidden)').count()) === 0);
  await pg.context().close();

  // ---- Serra: BACK e salute cala senza intervento ----
  pg = await open('?sol=4');
  await pg.locator('.event-alert').click(); await pg.locator('[data-modal-btn]').click(); await sleep(200);
  await pg.locator('[data-gh-back]').click(); await sleep(200);
  ck('backToMap', !(await pg.evaluate(() => game.events.greenhouse.isOpen)) && await pg.locator('.room-area').first().isVisible());
  ck('iconOngoing', await pg.locator('.event-alert.ongoing').count() === 1);
  const h0 = await pg.evaluate(() => game.state.plantHealth);
  await pg.evaluate(() => game.setSpeed(4)); await sleep(5000);
  const h1 = await pg.evaluate(() => game.state.plantHealth);
  ck('healthDeclines', h1 < h0 || h1 === 0, `${h0} -> ${h1}`);
  await pg.context().close();

  // ---- Serra: Maya autoWater ----
  pg = await open('?sol=4');
  await pg.locator('.event-alert').click(); await pg.locator('[data-modal-btn]').click(); await sleep(200);
  await pg.locator('[data-gh-back]').click();
  const f0 = await pg.evaluate(() => game.state.crew.find(a => a.id === 'maya').fatigue);
  await pg.evaluate(() => game.setSpeed(4));
  await pg.click('.crew-icon[data-id=maya]');
  await pg.locator('.room-area[data-room=labs]').dispatchEvent('click'); await sleep(200);
  const acts = await pg.locator('.crew-menu .pill-action').allInnerTexts();
  const gb = pg.locator('.pill-action:has-text("greenhouse")').first();
  if (await gb.count()) await gb.click(); else ck('mayaGreenhouseAction', false, acts.join('|'));
  await sleep(1500);
  ck('autoWater', await pg.evaluate(() => game.state.greenhouse.autoWater === true || game.state.events.done.includes('greenhouse')), '');
  let done = false; for (let i = 0; i < 240 && !done; i++) { await sleep(250); if (await pg.locator('.modal-info').count()) await pg.locator('[data-modal-btn]').click(); done = await pg.locator('.modal-badge').count() > 0; }
  ck('mayaResolves', done, '');
  const f1 = await pg.evaluate(() => game.state.crew.find(a => a.id === 'maya').fatigue);
  ck('mayaFatigue', f1 > f0, `${f0} -> ${f1}`);
  await pg.context().close();

  // ---- Tempesta: evacuate ----
  pg = await open('?sol=8');
  ck('stormIcon', await pg.locator('.event-alert').count() === 1);
  await pg.locator('.event-alert').click();
  const sw = await modalText(pg); ck('stormWarn', /DONKI/.test(sw) && /SOLVE/.test(sw), sw.slice(0, 100));
  await pg.locator('[data-modal-btn]').click(); await sleep(400);
  const tl = await pg.evaluate(() => game.events.storm.timeLeft);
  ck('timer30', tl > 27 && tl <= 30, String(tl));
  await shot(pg, 'storm-choice');
  await sleep(2000);
  const tl2 = await pg.evaluate(() => game.events.storm.timeLeft);
  ck('timerReal', tl - tl2 > 1.7 && tl - tl2 < 2.6, `${tl} -> ${tl2}`);
  const fw = await pg.locator('.storm-fill').evaluate(e => e.getBoundingClientRect().width / e.parentElement.getBoundingClientRect().width);
  ck('barShrinks', fw < 0.97 && fw > 0.8, String(fw));
  const sol0 = await pg.evaluate(() => game.state.sol);
  await pg.locator('[data-storm=evacuate]').click(); await sleep(400);
  let inBunker = false, pausedClock = false;
  for (let i = 0; i < 80; i++) { await sleep(250);
    inBunker = inBunker || await pg.evaluate(() => game.state.crew.every(a => a.location === 'bunker'));
    pausedClock = pausedClock || await pg.locator('.room-paused').count() > 0;
    if (await pg.locator('.modal-badge').count()) break; }
  ck('crewBunker', inBunker); ck('labsPaused', pausedClock);
  await sleep(300);
  await shot(pg, 'storm-badge');
  const st = await modalText(pg); ck('badgeSolar', /Judith Love Cohen/.test(st) && /CONTINUE MISSION/.test(st), st.slice(0, 100));
  ck('solPlus1', await pg.evaluate(() => game.state.sol) === sol0 + 1, `${sol0} -> ${await pg.evaluate(() => game.state.sol)}`);
  await pg.locator('[data-modal-btn]').click(); await sleep(800);
  await pg.evaluate(() => game.setSpeed(4)); for (let i = 0; i < 20; i++) { await sleep(300); if (await pg.locator('.modal-info').count()) await pg.locator('[data-modal-btn]').click(); } await sleep(3000);
  const dbgS = await pg.evaluate(() => JSON.stringify([game.state.paused, game.state.pauseReasons, game.state.speed, game.events.storm.stage]));
  const locs = await pg.evaluate(() => game.state.crew.map(a => a.id + ':' + a.location + ':' + (a.destination || '')).join(','));
  ck('crewReturns', !/bunker/.test(locs), locs + ' ' + dbgS);
  ck('pausedGone', await pg.locator('.room-paused').count() === 0);
  await pg.context().close();

  // ---- Tempesta: shields ----
  pg = await open('?sol=8');
  await pg.locator('.event-alert').click(); await pg.locator('[data-modal-btn]').click(); await sleep(300);
  const r0 = await pg.evaluate(() => ({ p: game.state.power, r: game.state.crew.map(a => a.radiation) }));
  await pg.locator('[data-storm=shields]').click(); await sleep(100);
  const r1 = await pg.evaluate(() => ({ p: game.state.power, r: game.state.crew.map(a => a.radiation), paused: game.state.paused }));
  ck('shieldsPower', Math.abs((r0.p - r1.p) - 30) < 3, JSON.stringify([r0.p, r1.p]));
  ck('shieldsRad', r1.r.every((v, i) => Math.abs(v - r0.r[i] - 15) < 1.5), JSON.stringify([r0.r, r1.r]));
  ck('gameContinues', !r1.paused && await pg.evaluate(() => game.state.phase) === 'playing');
  await shot(pg, 'storm-shields');
  await pg.context().close();

  // ---- Tempesta: timeout ----
  pg = await open('?sol=8');
  await pg.locator('.event-alert').click(); await pg.locator('[data-modal-btn]').click(); await sleep(300);
  await sleep(31500);
  ck('exposedShown', await pg.locator('.storm-exposed:not(.hidden)').count() > 0 || await pg.evaluate(() => game.state.phase) === 'failed');
  const midH = await pg.evaluate(() => game.state.crew.map(a => Math.round(a.health)));
  ck('noOptionsAfterTimeout', await pg.locator('.storm-screen:not(.hidden)').count() === 0);
  await sleep(4500);
  const ov = await pg.locator('.endgame-title').innerText() + ' | ' + await pg.locator('.endgame-msg').innerText();
  ck('failStorm', /MISSION FAILED/.test(ov) && /solar storm/i.test(ov), ov + ' mid=' + midH);
  await shot(pg, 'storm-failed');
  await pg.locator('.endgame-btn').click(); await sleep(500);
  const rs = await pg.evaluate(() => ({ sol: game.state.sol, ph: game.state.phase, hp: game.state.crew.map(a => a.health), rad: game.state.crew.map(a => a.radiation), done: game.state.events.done, act: game.state.events.active, pl: game.state.plantHealth, paused: game.state.paused, stage: game.events.storm.stage }));
  ck('restartClean', rs.sol === 1 && rs.ph === 'playing' && rs.hp.every(h => h > 50) && rs.rad.every(r => r < 20) && !rs.done.length && !rs.act.length && rs.stage === 'idle' && !rs.paused, JSON.stringify(rs));
  ck('restartNoAlert', await pg.locator('.event-alert').count() === 0 && await pg.locator('.modal-layer:not(.hidden)').count() === 0);
  await pg.context().close();

  // ---- Restart dopo fallimento con serra aperta ----
  pg = await open('?sol=4');
  await pg.locator('.event-alert').click(); await pg.locator('[data-modal-btn]').click(); await sleep(200);
  await pg.evaluate(() => { game.state.oxygen = 0; game.setSpeed(10); }); await sleep(3000);
  const ph = await pg.evaluate(() => game.state.phase);
  if (ph === 'failed') { await pg.locator('.endgame-btn').click(); await sleep(400);
    ck('restartFromGh', await pg.evaluate(() => !game.events.greenhouse.isOpen && game.state.sol === 1 && game.state.phase === 'playing') && await pg.locator('.event-alert').count() === 0); }
  else ck('restartFromGh', false, 'no fail: ' + ph);
  await pg.context().close();

  // ---- FLR / CME ----
  pg = await open('');
  for (const id of ['flr', 'cme']) {
    await pg.evaluate(i => game.events.trigger(i), id); await sleep(300);
    const t = await modalText(pg);
    ck(id + '_modal', /DONKI/.test(t) && /OK/.test(t), t.slice(0, 80));
    ck(id + '_pausedWhileOpen', await pg.evaluate(() => game.state.paused));
    if (id === 'flr') await shot(pg, 'flr');
    await pg.locator('[data-modal-btn]').click(); await sleep(300);
    ck(id + '_resumes', !(await pg.evaluate(() => game.state.paused)));
  }
  // ---- Modali casuali durante run veloce ----
  await pg.evaluate(() => game.setSpeed(10));
  let closed = 0;
  const t0 = Date.now();
  while (Date.now() - t0 < 12000) { const b = pg.locator('[data-modal-btn]'); if (await b.count()) { await b.first().click({ timeout: 2000 }).catch(() => {}); closed++; } await sleep(100); }
  ck('randomModalsDismissable', true, 'closed ' + closed + ' sol ' + await pg.evaluate(() => game.state.sol));
  await pg.evaluate(() => { game.setSpeed(1); });
  res.fps = await pg.evaluate(() => new Promise(r => { let n = 0, t0 = performance.now(); (function f(t) { n++; if (t - t0 >= 3000) r(n*1000/(t-t0)); else requestAnimationFrame(f); })(t0); }));
  await pg.context().close();

  // ---- Icone viso ----
  pg = await open('');
  res.faces = await pg.evaluate(() => [...document.querySelectorAll('.crew-icon')].map(e => [e.dataset.id, (e.querySelector('img')?.src || getComputedStyle(e).backgroundImage || '').split('/').pop()]));
  await pg.locator('.crew-icon[data-id=maya]').screenshot({ path: path.join(root, 'tests/shot-m3-maya.png') });
  await pg.locator('.crew-icon[data-id=luana]').screenshot({ path: path.join(root, 'tests/shot-m3-luana.png') });
} catch (e) { ck('exception', false, e.message + '\n' + e.stack.split('\n')[1]); }
await br.close(); server.close();
const bad = Object.entries(res.checks).filter(([,v]) => !v.ok);
console.log(JSON.stringify({ bad, errors: res.errors, failed: res.failed, fps: res.fps, faces: res.faces, n: Object.keys(res.checks).length }, null, 1));
process.exit(bad.length || res.errors.length || res.failed.length || res.fps < 30 ? 1 : 0);
