import http from 'http'; import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url';
import { chromium } from 'playwright';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const mime = { '.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.svg':'image/svg+xml' };
const server = http.createServer((q, r) => { let p = decodeURIComponent(q.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html'; const f = path.join(root, p);
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end('nf'); }
  r.writeHead(200, { 'content-type': mime[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r); }).listen(8081);
const res = { checks: {}, errors: [], failed: [] };
const ck = (n, ok, d) => { res.checks[n] = { ok: !!ok, d }; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const br = await chromium.launch();
const pg = await (await br.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
pg.on('console', m => { if (['error','warning'].includes(m.type())) res.errors.push(m.type()+': '+m.text()); });
pg.on('pageerror', e => res.errors.push('pageerror: '+e.message));
pg.on('response', r => { if (r.status() >= 400) res.failed.push(r.status()+' '+r.url()); });
const crewProp = (id, s) => pg.evaluate(([id, s]) => game.state.crew.find(a => a.id === id)[s], [id, s]);
try {
  await pg.goto('http://localhost:8081/'); await sleep(800);
  ck('mapImg', await pg.evaluate(() => { const i = document.querySelector('.map-img'); return i.complete && i.naturalWidth > 0; }));
  const labs = await pg.locator('.room-label').allInnerTexts(); ck('labels', labs.length >= 12, labs.length + ': ' + labs.join('|'));
  ck('rooms13', (await pg.locator('.room-area').count()) === 13);
  const note = await pg.locator('.crew-note').boundingBox(); ck('note', note && note.x < 200 && note.y > 650, JSON.stringify(note));
  const loc = await pg.evaluate(() => game.state.crew.map(a => a.id + ':' + a.location).join(','));
  ck('startRooms', loc === 'astrid:lifeSupport,hannah:medical,maya:labs,luana:labs', loc);
  const boxes = await pg.locator('.crew-icon').evaluateAll(els => els.map(e => { const r = e.getBoundingClientRect(); return [r.x, r.y, r.width, r.height]; }));
  let ov = false; for (let i = 0; i < 4; i++) for (let j = i+1; j < 4; j++) { const a = boxes[i], b = boxes[j]; if (a[0] < b[0]+b[2] && b[0] < a[0]+a[2] && a[1] < b[1]+b[3] && b[1] < a[1]+a[3]) ov = true; }
  ck('icons4noOverlap', boxes.length === 4 && !ov, JSON.stringify(boxes));
  await pg.screenshot({ path: path.join(root, 'tests/screenshot-m2.png') });
  await pg.evaluate(() => game.setSpeed(4));
  const plan = [
    ['astrid','lifeSupport','waterRecycler','lifeSupport','fatigue'],
    ['hannah','medical','checkup','medical','health'],
    ['maya','galley','eat','galley','hunger'],
    ['luana','gym','ared','gym','fatigue'],
  ];
  for (const [id, grp, act, room, stat] of plan) {
    await pg.evaluate(() => { game.state.crew.forEach(a => { a.hunger = 40; a.fatigue = 10; a.health = 80; }); });
    const before = await crewProp(id, stat);
    const p0 = await pg.locator(`.crew-icon[data-id=${id}]`).boundingBox();
    await pg.click(`.crew-icon[data-id=${id}]`);
    ck(id+'_radial', await pg.locator('.crew-menu.radial:not(.hidden)').count());
    await pg.locator(`.room-area[data-room=${room}]`).dispatchEvent('click');
    await sleep(150);
    ck(id+'_actionsList', await pg.locator('.crew-menu.actions .pill-action').count() > 0, await pg.locator('.crew-menu').innerText().catch(() => ''));
    await pg.locator(`.pill-action[data-action=${act}]`).click();
    ck(id+'_menuClosed', (await pg.locator('.crew-menu.hidden').count()) === 1);
    await sleep(400);
    const mid = await pg.locator(`.crew-icon[data-id=${id}]`).boundingBox();
    const dest = await crewProp(id, 'destination');
    const same = (await crewProp(id, 'location')) === room && !dest;
    ck(id+'_moving', same || (dest === room && (Math.abs(mid.x-p0.x)+Math.abs(mid.y-p0.y) > 3)), JSON.stringify({dest,p0,mid}));
    const t0 = Date.now();
    while (Date.now()-t0 < 25000 && await crewProp(id, 'destination')) await sleep(250);
    const rc = await pg.evaluate(([id, room]) => { const c = game.map.roomCenter(room); const a = game.state.crew.find(a => a.id === id); return { loc: a.location, dx: Math.abs(a.pos.x-c.x), dy: Math.abs(a.pos.y-c.y) }; }, [id, room]);
    ck(id+'_arrived', rc.loc === room && rc.dx < 0.08 && rc.dy < 0.1, JSON.stringify(rc));
    const t1 = Date.now();
    while (Date.now()-t1 < 20000 && await crewProp(id, 'task')) await sleep(250);
    const after = await crewProp(id, stat);
    ck(id+'_stat_'+stat, after > before, `${before} -> ${after}`);
  }
  await pg.click('.crew-icon[data-id=astrid]'); await pg.keyboard.press('Escape'); ck('escCloses', (await pg.locator('.crew-menu.hidden').count()) === 1);
  await pg.click('.crew-icon[data-id=astrid]'); await pg.mouse.click(640, 700); await sleep(100); ck('outsideCloses', (await pg.locator('.crew-menu.hidden').count()) === 1);
  await pg.click('.crew-icon[data-id=hannah]'); await pg.click('.pill-room[data-group=gym]'); ck('radialToActions', await pg.locator('.pill-action').count() > 0);
  await pg.keyboard.press('Escape');
  await pg.evaluate(() => { game.setSpeed(1); game.crew.assign('maya', 'goCabin'); });
  await sleep(500); await pg.evaluate(() => game.pause());
  await sleep(800); const q0 = await pg.locator('.crew-icon[data-id=maya]').boundingBox(); await sleep(1200);
  const q1 = await pg.locator('.crew-icon[data-id=maya]').boundingBox();
  ck('pauseFreezesIcon', q0.x === q1.x && q0.y === q1.y, JSON.stringify([q0,q1]));
  await pg.evaluate(() => game.resume()); await sleep(1200);
  const q2 = await pg.locator('.crew-icon[data-id=maya]').boundingBox(); ck('resumeMoves', q2.x !== q1.x || q2.y !== q1.y);
  await pg.evaluate(() => { game.setSpeed(10); ['astrid','hannah','maya','luana'].forEach((id,i) => game.crew.assign(id, ['goGym','goGalley','goComms','goRestroom'][i])); });
  res.fps = await pg.evaluate(() => new Promise(r => { let n = 0, t0 = performance.now(); (function f(t) { n++; if (t - t0 >= 3000) r(n*1000/(t-t0)); else requestAnimationFrame(f); })(t0); }));
  await pg.screenshot({ path: path.join(root, 'tests/screenshot-m2b.png') });
} catch (e) { ck('exception', false, e.message); }
await br.close(); server.close();
const bad = Object.entries(res.checks).filter(([,v]) => !v.ok);
res.bad = bad; res.checks = undefined;
console.log(JSON.stringify(res, null, 1)); process.exit(bad.length || res.errors.length || res.failed.length || res.fps < 30 ? 1 : 0);
