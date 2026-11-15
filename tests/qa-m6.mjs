import http from 'http'; import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url';
import { chromium } from 'playwright';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const mime = { '.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.svg':'image/svg+xml' };
const server = http.createServer((q, r) => { let p = decodeURIComponent(q.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html'; const f = path.join(root, p);
  if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end('nf'); }
  r.writeHead(200, { 'content-type': mime[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r); }).listen(8088);
const only = process.argv[2];
const res = { checks: {}, errors: [], failed: [], notes: {} };
const ck = (n, ok, d) => { res.checks[n] = { ok: !!ok, d }; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const br = await chromium.launch();
const shot = (pg, n) => pg.screenshot({ path: path.join(root, `tests/shot-m6-${n}.png`) });
async function open(q = '', vp = { width: 1280, height: 720 }) {
  const ctx = await br.newContext({ viewport: vp });
  const pg = await ctx.newPage();
  pg.on('console', m => { if (['error', 'warning'].includes(m.type())) res.errors.push(m.type() + ': ' + m.text()); });
  pg.on('pageerror', e => res.errors.push('pageerror: ' + e.message));
  pg.on('requestfailed', r => res.failed.push('reqfail ' + r.url()));
  pg.on('response', r => { if (r.status() >= 400) res.failed.push(r.status() + ' ' + r.url()); });
  await pg.goto('http://localhost:8088/' + q); await sleep(700); return pg;
}
const G = (pg, f, a) => pg.evaluate(f, a);
const nodes = pg => G(pg, () => document.getElementsByTagName('*').length);
// Driver: gestisce modali, alert, serra, tempesta, pannello energia.
async function drive(pg, { storm = 'shields', stopSol = 99, maxMs = 240000, seen = [] } = {}) {
  const t0 = Date.now();
  while (Date.now() - t0 < maxMs) {
    const s = await G(pg, () => ({ ph: game.state.phase, sol: game.state.sol }));
    if (s.ph !== 'playing' || s.sol >= stopSol) return s;
    const mb = pg.locator('.modal-layer:not(.hidden) [data-modal-btn]');
    if (await mb.count()) { const t = await pg.locator('.modal-layer:not(.hidden) .modal').first().innerText().catch(() => ''); seen.push(t.slice(0, 60).replace(/\n+/g, ' ')); await mb.first().click({ timeout: 1500 }).catch(() => {}); await sleep(150); continue; }
    if (await pg.locator('[data-storm]').first().isVisible().catch(() => false)) { await pg.locator(`[data-storm=${storm}]`).click({ timeout: 1500 }).catch(() => {}); await sleep(300); continue; }
    if (await G(pg, () => game.events.greenhouse.isOpen)) { await pg.locator('[data-light=green]').click({ timeout: 800 }).catch(() => {}); await pg.locator('[data-gh-water]').click({ timeout: 800 }).catch(() => {}); await sleep(300); continue; }
    if (await G(pg, () => game.power.isOpen)) {
      const eco = pg.locator('[data-all=ECO]');
      if (await eco.isVisible().catch(() => false)) await eco.click({ timeout: 800 }).catch(() => {}); else await G(pg, () => game.power.setAll('eco'));
      seen.push('ECO set'); await G(pg, () => game.power.close()); await sleep(200); continue;
    }
    const al = pg.locator('.event-alert:not(.ongoing)');
    if (await al.count()) { await al.first().click({ timeout: 1000 }).catch(() => {}); await sleep(200); continue; }
    await G(pg, () => { if (game.state.speed !== 10 && !game.state.paused) game.setSpeed(10); });
    await sleep(250);
  }
  return { ph: 'timeout', sol: await G(pg, () => game.state.sol) };
}
try {
 if (!only || only === 'a') {
  let pg = await open();
  ck('titleVisible', await G(pg, () => game.titleVisible === true && __game.state === 'menu'), await G(pg, () => __game.state));
  const tt = (await pg.locator('.title-screen').innerText()).replace(/\n+/g, ' | ');
  ck('titleText', /C\.A\.S\.C\.L\.E\./.test(tt) && /Junior Astronaut Mission Trainer/.test(tt) && /YOUR MISSION/.test(tt) && /HOW TO PLAY/.test(tt) && /EASY/.test(tt) && /HARD/.test(tt) && /START MISSION/.test(tt), tt.slice(0, 200));
  await shot(pg, 'title');
  const a = await G(pg, () => game.state.sol + game.state.solProgress); await sleep(1500);
  ck('titleTimeFrozen', a === await G(pg, () => game.state.sol + game.state.solProgress));
  ck('defaultEasy', await G(pg, () => game.state.difficulty) === 'easy', await G(pg, () => game.state.difficulty));
  await pg.click('[data-title-mode=hard]');
  ck('hardSwitch', await G(pg, () => game.state.difficulty) === 'hard' && (await pg.locator('[data-title-mode=hard]').getAttribute('aria-pressed')) === 'true');
  await pg.click('[data-start]'); await sleep(500);
  ck('started', await G(pg, () => !game.titleVisible && game.state.phase === 'playing' && __game.state !== 'menu'), await G(pg, () => __game.state));
  ck('hardKept', await G(pg, () => game.state.difficulty) === 'hard');
  await G(pg, () => game.power.open()); await sleep(200);
  ck('panelHard', !(await pg.locator('[data-sys=lifeSupport] .pp-slider').isDisabled()));
  await G(pg, () => game.power.close());
  await sleep(1500);
  ck('timeRuns', await G(pg, () => game.state.sol + game.state.solProgress) > a);
  await G(pg, () => { game.state.oxygen = 0; }); await sleep(400);
  ck('failed', await G(pg, () => game.state.phase) === 'failed');
  await pg.click('.endgame-btn'); await sleep(500);
  const r = await G(pg, () => ({ sol: game.state.sol, ph: game.state.phase, t: game.titleVisible, d: game.state.difficulty }));
  ck('startAgainSol1', r.sol === 1 && (r.ph === 'playing' || r.ph === 'menu'), JSON.stringify(r));
  res.notes.afterRestart = r;
  await pg.context().close();

  pg = await open(); const ctx = pg.context();
  await pg.click('[data-start]'); await sleep(300);
  const mb = pg.locator('.mute-btn');
  ck('muteBtn', await mb.isVisible() && await pg.locator('#topbar .mute-btn').count() === 1);
  const m0 = await G(pg, () => game.audio.muted);
  await mb.click(); const m1 = await G(pg, () => game.audio.muted);
  ck('muteClick', m0 !== m1 && (await mb.getAttribute('aria-pressed')) === String(m1), `${m0}->${m1}`);
  await pg.keyboard.press('m'); const m2 = await G(pg, () => game.audio.muted);
  ck('muteKeyM', m2 === m0 && (await mb.getAttribute('aria-pressed')) === String(m2), `${m2}`);
  await pg.keyboard.press('m'); await pg.reload(); await sleep(700);
  ck('mutePersists', await G(pg, () => game.audio.muted) === m1 && (await pg.locator('.mute-btn').getAttribute('aria-pressed')) === String(m1), String(await G(pg, () => game.audio.muted)));
  await ctx.close();

  for (const vp of [[1920,1080],[1366,768],[1280,720],[900,900]]) for (const q of ['', '?sol=1']) {
    pg = await open(q, { width: vp[0], height: vp[1] });
    const g = await G(pg, () => { const r = document.getElementById('stage').getBoundingClientRect(); return { l: r.left, t: r.top, w: r.width, h: r.height, iw: innerWidth, ih: innerHeight, sw: document.documentElement.scrollWidth, sh: document.documentElement.scrollHeight }; });
    const ov = await G(pg, () => { const o = document.querySelector('.title-screen'); if (!o || o.classList.contains('hidden')) return null; return { sw: o.scrollWidth, cw: o.clientWidth, sh: o.scrollHeight, ch: o.clientHeight }; });
    ck(`scale${vp[0]}x${vp[1]}${q ? 'game' : 'title'}`, Math.abs(g.w / g.h - 16 / 9) < 0.02 && g.l >= -1 && g.t >= -1 && g.l + g.w <= g.iw + 1 && g.t + g.h <= g.ih + 1 && g.sw <= g.iw && g.sh <= g.ih && (!ov || (ov.sw <= ov.cw + 1 && ov.sh <= ov.ch + 1)), JSON.stringify({ g, ov }));
    if (vp[0] === 900 || vp[0] === 1920) await shot(pg, `${vp[0]}${q ? 'game' : 'title'}`);
    await pg.context().close();
  }
 }
 if (!only || only === 'b') {
  const pg = await open(); await pg.click('[data-start]'); await sleep(300);
  res.notes.nodesStart = await nodes(pg);
  await G(pg, () => game.setSpeed(10));
  const seen = [];
  let s = await drive(pg, { stopSol: 14, seen, maxMs: 540000 });
  ck('reachSol14', s.sol >= 14 && s.ph === 'playing', JSON.stringify(s));
  for (let i = 0; i < 2; i++) {
    await G(pg, () => { game.state.oxygen = 0; }); await sleep(400);
    await pg.click('.endgame-btn'); await sleep(500);
    if (await G(pg, () => game.titleVisible)) await pg.click('[data-start]');
    await sleep(300); await G(pg, () => game.setSpeed(10));
    s = await drive(pg, { stopSol: 4, seen, maxMs: 90000 });
    ck('restart' + i, s.sol >= 4 && s.ph === 'playing', JSON.stringify(s));
  }
  res.notes.nodesEnd = await nodes(pg); res.notes.seenStab = seen.length;
  await pg.context().close();
 }
 if (!only || only === 'c') {
  const seen = [];
  let pg = await open();
  await pg.click('[data-start]'); await sleep(300);
  ck('sol1', await G(pg, () => game.state.sol) === 1);
  await G(pg, () => game.setSpeed(2));
  await pg.click('.crew-icon >> nth=0'); await sleep(200);
  const crewId = await pg.locator('.crew-icon >> nth=0').getAttribute('data-id');
  await pg.locator('.room-area[data-room=gym]').dispatchEvent('click'); await sleep(200);
  const act = pg.locator('.crew-menu .pill-action').first();
  const hasAct = await act.count(); if (hasAct) await act.click();
  const c0 = await G(pg, id => game.state.crew.find(x => x.id === id).location, crewId);
  await sleep(4000);
  const c1 = await G(pg, id => { const a = game.state.crew.find(x => x.id === id); return a.location + ' ' + (a.destination || '') + ' ' + (a.action || ''); }, crewId);
  ck('moveAction', hasAct && !c1.startsWith(c0 + ' '), `${c0} -> ${c1} hasAct=${hasAct}`);
  await pg.context().close();
  pg = await open('?sol=3'); await G(pg, () => game.setSpeed(10));
  let s = await drive(pg, { stopSol: 6, seen, maxMs: 120000 });
  ck('greenhouseBadge', await G(pg, () => game.badges.has('greenhouse')) && s.ph === 'playing', JSON.stringify([s, seen]));
  await pg.context().close();
  for (const storm of ['evacuate', 'shields']) {
    pg = await open('?sol=7'); await G(pg, () => game.setSpeed(10));
    s = await drive(pg, { storm, stopSol: 10, seen, maxMs: 150000 });
    ck('storm:' + storm, await G(pg, () => game.badges.has('solar')) && s.ph === 'playing', JSON.stringify(s));
    await pg.context().close();
  }
  pg = await open('?sol=14'); await G(pg, () => game.setSpeed(10));
  const seen2 = [];
  s = await drive(pg, { stopSol: 16, seen: seen2, maxMs: 120000 });
  ck('nightEco', seen2.includes('ECO set') && await G(pg, () => game.badges.has('power')) && s.ph === 'playing', JSON.stringify([s, seen2]));
  await pg.context().close();
  pg = await open('?sol=27'); await G(pg, () => game.setSpeed(10));
  const seen3 = [];
  s = await drive(pg, { stopSol: 99, seen: seen3, maxMs: 200000 });
  const dbg = await G(pg, () => ({ ph: game.state.phase, sol: game.state.sol, b: [...game.state.badges] }));
  ck('won', s.ph === 'won' && dbg.sol === 28 && dbg.b.includes('sol28'), JSON.stringify([dbg, seen3]));
  const et = await pg.locator('#endgame').innerText().catch(() => '');
  ck('complete', /MISSION COMPLETE/.test(et), et.replace(/\n+/g, ' | '));
  await shot(pg, 'win');
  await pg.context().close();
 }
} catch (e) { ck('exception', false, e.stack.split('\n').slice(0, 3).join(' ')); }
await br.close(); server.close();
const bad = Object.entries(res.checks).filter(([, v]) => !v.ok);
res.ok = !bad.length && !res.errors.length && !res.failed.length;
console.log(JSON.stringify(res, null, 1)); process.exit(res.ok ? 0 : 1);
