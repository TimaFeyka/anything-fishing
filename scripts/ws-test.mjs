/**
 * Проверка авторитетного WebSocket-режима вываживания:
 * сервер сам ведёт симуляцию, клиент получает только состояние и ближайший отрезок рывка.
 * Запуск: node scripts/ws-test.mjs [httpBaseUrl]
 */
const BASE = process.argv[2] ?? 'http://127.0.0.1:8791';
const WS_BASE = BASE.replace(/^http/, 'ws');

let pass = 0; let fail = 0;
const ok = (n, c, e = '') => { if (c) { pass++; console.log(`  ✓ ${n}${e ? ' — ' + e : ''}`); } else { fail++; console.log(`  ✗ ${n}${e ? ' — ' + e : ''}`); } };

async function call(pathname, { method = 'GET', body, token } = {}) {
  const res = await fetch(`${BASE}/api${pathname}`, {
    method,
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null; try { json = text ? JSON.parse(text) : null; } catch { json = { raw: text }; }
  return { status: res.status, body: json, raw: text };
}

const auth = await call('/auth', { method: 'POST', body: { devId: `ws-${Math.random().toString(36).slice(2, 7)}`, name: 'WS-тест' } });
const token = auth.body.token;
ok('авторизация для WS-теста', !!token);

const cast = (await call('/cast', { method: 'POST', token, body: { locationId: 'lake', castType: 'normal' } })).body;
ok('попытка создана', !!cast.castId);

const url = `${WS_BASE}/ws?token=${encodeURIComponent(token)}&castId=${encodeURIComponent(cast.castId)}`;
const ws = new WebSocket(url);
let pushes = 0; let ended = null; let sawLookahead = false; let sawFullSchedule = false; let initHints = null;
let reeling = false; let lastDecision = 0;

const done = new Promise((resolve) => {
  const timer = setTimeout(() => { try { ws.close(); } catch { /* noop */ } resolve('timeout'); }, 90000);
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.t === 'init') { initHints = m; sawFullSchedule = Array.isArray(m.events) || JSON.stringify(m).includes('"seed"'); }
    if (m.t === 'state') {
      pushes++;
      if (m.state?.next) sawLookahead = true;
      const t = m.state.tension;
      const now = Date.now();
      if (now - lastDecision > 120) {
        lastDecision = now;
        const want = t > 0.72 ? false : t < 0.5 ? true : reeling;
        if (want !== reeling) { reeling = want; ws.send(JSON.stringify({ t: 'action', a: want ? 'REEL' : 'RELEASE' })); }
      }
      if (m.done) { ended = m.outcome; clearTimeout(timer); resolve(m.outcome); }
    }
    if (m.t === 'end') { ended = m.outcome; clearTimeout(timer); resolve(m.outcome); }
  };
  ws.onerror = () => { clearTimeout(timer); resolve('error'); };
  ws.onclose = () => { clearTimeout(timer); resolve(ended ?? 'closed'); };
});

const outcome = await done;
ok('WebSocket подключился и получал состояние', pushes > 3, `${pushes} обновлений состояния`);
ok('клиент получил только ближайший отрезок, а не всё расписание', sawLookahead && !sawFullSchedule);
ok('бой завершился на сервере', !!outcome && outcome !== 'timeout' && outcome !== 'error', `исход: ${outcome}`);
ok('подсказки пришли в режиме борьбы', !!initHints && typeof initHints.idealMin === 'number');

if (outcome && outcome !== 'timeout' && outcome !== 'error') {
  const resolve = await call(`/cast/${cast.castId}/resolve`, { method: 'POST', token, body: { actions: [] } });
  ok('награда подтверждена сервером после WS-боя', resolve.status === 200, `HTTP ${resolve.status}`);
  if (outcome === 'land') ok('успешный вылов дал предмет', (resolve.body.rewards ?? []).length >= 1);
  else ok('проигранный бой не дал предмет', (resolve.body.rewards ?? []).length === 0 && resolve.body.ok === false, `причина: ${resolve.body.reason}`);
}

console.log(`\nИтог WS: ${pass} успешно, ${fail} провалено\n`);
process.exit(fail ? 1 : 0);
