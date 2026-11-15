import http from 'http'; import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url';
import { chromium } from 'playwright';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const mime = { '.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.json':'application/json','.svg':'image/svg+xml' };
const server = http.createServer((q, r) => {
  let p = decodeURIComponent(q.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html';
  const f = path.join(root, p);
  if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end('nf'); }
  r.writeHead(200, { 'content-type': mime[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r);
}).listen(8080);
const res = { checks: {}, errors: [], failedReqs: [], fps: null };
const ck = (n, ok, d) => { res.checks[n] = { ok: !!ok, d }; };
const br = await chromium.launch();
const sleep = ms => new Promise(r => setTimeout(r, ms));
const J = () => JSON.stringify({ sol: game.state.sol, o: game.state.oxygen, w: game.state.water, p: game.state.power, ph: game.state.phase });
async function open(q = '', vp = { width: 1280, height: 720 }) {
  const pg = await (await br.newContext({ viewport: vp })).newPage();
  pg.on('console', m => { if (['error','warning'].includes(m.type())) res.errors.push(m.type() + ': ' + m.text()); });
  pg.on('pageerror', e => res.errors.push('pageerror: ' + e.message));
  pg.on('requestfailed', r => res.failedReqs.push(r.url()));
  pg.on('response', r => { if (r.status() >= 400) res.failedReqs.push(r.status() + ' ' + r.url()); });
  await pg.goto('http://localhost:8080/' + q); await sleep(500); return pg;
}
try {
  let pg = await open();
  const hud = await pg.locator('#topbar').innerText();
  ck('hud', /POWER/.test(hud) && /1000 kW/.test(hud) && /OXYGEN/.test(hud) && /WATER/.test(hud) && /SHIELD/.test(hud) && /SOL 1/.test(hud), hud.replace(/\n+/g, ' | '));
  res.fps = await pg.evaluate(() => new Promise(r => { let n = 0, t0 = performance.now(); (function f(t) { n++; if (t - t0 >= 3000) r(n * 1000 / (t - t0)); else requestAnimationFrame(f); })(t0); }));
  await pg.click('.sol-pill');
  ck('menuOpen', await pg.locator('.speed-menu').isVisible(), '');
  const btns = await pg.locator('.speed-btn').allInnerTexts(); ck('menuBtns', ['1x','2x','4x','10x'].every(b => btns.includes(b)), btns.join(','));
  await pg.click('[data-speed="10"]');
  ck('speed10', await pg.evaluate(() => game.state.speed) === 10, '');
  ck('menuClosed', !(await pg.locator('.speed-menu').isVisible()), '');
  await pg.click('.sol-pill'); await pg.click('[data-speed="4"]'); ck('speed4', await pg.evaluate(() => game.state.speed) === 4, '');
  await pg.evaluate(() => game.setSpeed(10));
  const s0 = await pg.evaluate(() => ({ sol: game.state.sol, p: game.state.solProgress, o: game.state.oxygen, w: game.state.water }));
  await sleep(4000);
  const s1 = await pg.evaluate(() => ({ sol: game.state.sol, p: game.state.solProgress, o: game.state.oxygen, w: game.state.water }));
  ck('timeAdvances', (s1.sol + s1.p) > (s0.sol + s0.p) + 0.05, JSON.stringify([s0, s1]));
  ck('resDecay', s1.o < s0.o && s1.w < s0.w, JSON.stringify([s0, s1]));
  ck('hudSolText', /SOL \d+/.test(await pg.locator('.sol-text').innerText()), '');
  await pg.click('.sol-pill'); await pg.click('[data-pause]');
  ck('paused', (await pg.evaluate(() => game.state.paused)) === true && (await pg.evaluate(() => __game.state)) === 'paused', '');
  const a = await pg.evaluate(() => game.state.solProgress + game.state.sol); await sleep(1000);
  const b = await pg.evaluate(() => game.state.solProgress + game.state.sol); ck('pauseFreezes', a === b, a + ' ' + b);
  await pg.click('.sol-pill'); await pg.click('[data-pause]'); ck('resumed', !(await pg.evaluate(() => game.state.paused)), '');
  await pg.evaluate(() => { game.state.oxygen = 0; }); await sleep(400);
  ck('failPhase', (await pg.evaluate(() => game.state.phase)) === 'failed' && (await pg.evaluate(() => __game.state)) === 'gameover', '');
  const txt = await pg.locator('#endgame').innerText(); ck('failText', /MISSION FAILED/.test(txt) && /START AGAIN/.test(txt), txt.replace(/\n+/g, ' | '));
  const gs = await pg.evaluate(() => { const s = document.getElementById('scene'); const cs = getComputedStyle(s); return { f: cs.filter, pe: cs.pointerEvents, cls: s.className }; });
  ck('grayscale', /grayscale/.test(gs.f), JSON.stringify(gs)); ck('locked', gs.pe === 'none', JSON.stringify(gs));
  await pg.screenshot({ path: path.join(root, 'tests/screenshot.png') });
  await pg.click('.endgame-btn'); await sleep(300);
  const rs = await pg.evaluate(() => ({ sol: game.state.sol, ph: game.state.phase, o: game.state.oxygen, sp: game.state.speed }));
  ck('restart', rs.sol === 1 && rs.ph === 'playing' && rs.o > 0, JSON.stringify(rs));
  ck('restartHud', !(await pg.locator('#endgame').isVisible()) && /SOL 1\b/.test(await pg.locator('.sol-text').innerText()), '');
  pg = await open('?sol=13'); ck('sol13', (await pg.evaluate(() => game.state.sol)) === 13 && /SOL 13/.test(await pg.locator('.sol-text').innerText()), await pg.evaluate(J));
  await pg.evaluate(() => { game.state.oxygen = 0; }); await sleep(300); await pg.click('.endgame-btn'); await sleep(300);
  ck('restartFrom13', (await pg.evaluate(() => game.state.sol)) === 1, '');
  pg = await open('?sol=27'); await pg.evaluate(() => game.setSpeed(10));
  const st27 = await pg.evaluate(J);
  const t0 = Date.now(); let ph;
  while (Date.now() - t0 < 45000) { ph = await pg.evaluate(() => game.state.phase); if (ph !== 'playing') break; await sleep(500); }
  const t = await pg.locator('#endgame').innerText().catch(() => '');
  ck('win27', ph === 'won' && (await pg.evaluate(() => game.state.sol)) === 28, st27 + ' -> ' + ph + ' ' + t.replace(/\n+/g, ' | ') + ' (' + (Date.now() - t0) + 'ms)');
  for (const vp of [{ width: 1280, height: 720 }, { width: 900, height: 900 }]) {
    pg = await open('', vp);
    const g = await pg.evaluate(() => { const r = document.getElementById('stage').getBoundingClientRect(); return { l: r.left, t: r.top, w: r.width, h: r.height, iw: innerWidth, ih: innerHeight, sw: document.documentElement.scrollWidth, sh: document.documentElement.scrollHeight }; });
    const ok = Math.abs(g.w / g.h - 16 / 9) < 0.02 && g.l >= -1 && g.t >= -1 && g.l + g.w <= g.iw + 1 && g.t + g.h <= g.ih + 1 && g.sw <= g.iw && g.sh <= g.ih;
    ck('layout' + vp.width + 'x' + vp.height, ok, JSON.stringify(g));
    if (vp.width === 900) await pg.screenshot({ path: path.join(root, 'tests/screenshot-900.png') });
  }
} catch (e) { ck('exception', false, e.message); }
await br.close(); server.close();
res.fpsOk = res.fps >= 30;
const bad = Object.entries(res.checks).filter(([, v]) => !v.ok);
res.ok = !bad.length && res.fpsOk && !res.errors.length;
console.log(JSON.stringify(res, null, 1)); process.exit(res.ok ? 0 : 1);
