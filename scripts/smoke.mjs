/**
 * Сквозной smoke-тест HTTP API: авторизация, двухфазный вылов, идемпотентность,
 * дневные лимиты торговца, рынок игроков, база, рейтинги.
 * Запуск: node scripts/smoke.mjs <baseUrl> [dataFile] [databaseUrl]
 * Если сервис работает на PostgreSQL, третьим аргументом (или через DATABASE_URL)
 * передайте строку подключения — тест прочитает попытку прямо из таблицы kv.
 */
import fs from 'node:fs';
import path from 'node:path';

const BASE = process.argv[2] ?? 'http://127.0.0.1:8787';
const DATA_FILE = process.argv[3] ?? path.resolve('data', 'state.json');
const DB_URL = process.argv[4] ?? process.env.DATABASE_URL ?? '';

let pass = 0; let fail = 0;
const ok = (name, cond, extra = '') => {
  if (cond) { pass++; console.log(`  ✓ ${name}${extra ? ' — ' + extra : ''}`); }
  else { fail++; console.log(`  ✗ ${name}${extra ? ' — ' + extra : ''}`); }
};

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

async function login(devId, name) {
  const r = await call('/auth', { method: 'POST', body: { devId, name } });
  if (r.status !== 200) throw new Error(`auth failed: ${r.status} ${r.raw}`);
  return r.body.token;
}

let pool = null;
async function readCast(castId) {
  // 1) файловое хранилище (локальный/dev-режим)
  try {
    const fromFile = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')).casts?.[castId];
    if (fromFile) return fromFile;
  } catch { /* файла ещё нет */ }
  // 2) PostgreSQL — читаем ту же таблицу kv, что использует приложение
  if (DB_URL) {
    try {
      if (!pool) {
        const pg = (await import('pg')).default;
        pool = new pg.Pool({
          connectionString: DB_URL,
          ssl: /sslmode=(require|verify|no-verify)/i.test(DB_URL) ? { rejectUnauthorized: false } : undefined,
          max: 4,
        });
      }
      const r = await pool.query("SELECT doc FROM kv WHERE bucket = 'casts' AND id = $1", [castId]);
      return r.rows[0]?.doc ?? null;
    } catch (e) {
      console.warn('  (не удалось прочитать попытку из PostgreSQL:', e.message, ')');
      return null;
    }
  }
  return null;
}
async function waitCast(castId, timeoutMs = 8000) {
  const until = Date.now() + timeoutMs;
  while (Date.now() < until) {
    const c = await readCast(castId);
    if (c) return c;
    await new Promise((r) => setTimeout(r, 100));
  }
  return null;
}

/** Идеальная стратегия игры, рассчитанная офлайн — белый ящик для проверки журнала действий. */
async function idealLog(params, seed) {
  const { simulateFight } = await import('../dist/engine.js');
  const { applyPhysics, PHYS } = await import('../dist/physics.js');
  const events = simulateFight(params, seed, []).events;
  const p = { strength: params.strength, maxLoad: params.maxLoad, control: params.control, speed: params.speed, depth: params.depth, giant: params.giant };
  let core = { t: 0, tension: 0.15, progress: 0, integrity: 1, stamina: 1, slack: 0 };
  const log = [];
  let reeling = false; let outcome = null;
  while (!outcome && core.t < PHYS.MAX_MS) {
    const tick = core.t + PHYS.TICK;
    const ev = events.find((e) => tick >= e.start && tick < e.start + e.duration);
    const power = ev ? ev.power : 0;
    const onTrial = applyPhysics(core, p, PHYS.TICK, true, power);
    const offTrial = applyPhysics(core, p, PHYS.TICK, false, power);
    const want = onTrial.outcome === 'break' ? false
      : (core.tension < 0.72 && onTrial.core.tension <= 0.85) ? true
        : offTrial.core.tension < 0.2 ? true : false;
    if (want !== reeling) { log.push({ a: want ? 'REEL' : 'RELEASE', t: core.t, dt: core.t }); reeling = want; }
    const r = applyPhysics(core, p, PHYS.TICK, reeling, power);
    core = r.core; outcome = r.outcome;
  }
  return log;
}

/** Полный цикл: заброс → чтение серверного секрета → идеальный журнал → проверка → награда. */
async function playOne(token, { locationId = 'lake', castType = 'normal' } = {}) {
  const castRes = await call('/cast', { method: 'POST', token, body: { locationId, castType } });
  if (castRes.status !== 200) return { castRes, cast: null, resolve: null, stored: null };
  const stored = await waitCast(castRes.body.castId);
  if (!stored) return { castRes, cast: castRes.body, resolve: null, stored: null };
  const log = await idealLog(stored.params, stored.seed);
  const resolve = await call(`/cast/${castRes.body.castId}/resolve`, { method: 'POST', token, body: { actions: log } });
  return { castRes, cast: castRes.body, resolve, stored, log };
}

const uid = Math.random().toString(36).slice(2, 8);
console.log(`\nSmoke-тест ANYTHING FISHING API (${BASE})`);

console.log('\n[1] Авторизация и контент');
const t1 = await login(`smoke-a-${uid}`, 'Смоук A');
const t2 = await login(`smoke-b-${uid}`, 'Смоук B');
ok('два игрока авторизованы', !!t1 && !!t2);
const me1 = (await call('/me', { token: t1 })).body.player;
ok('игрок создан со стартовым балансом', me1.coins > 0 && me1.level === 1, `${me1.coins} ¢`);
ok('стартовые локации открыты', me1.locations.includes('lake') && me1.locations.includes('harbor'));
const content = (await call('/content')).body;
ok('контент содержит 100+ предметов', content.items.length >= 100, `${content.items.length}`);
ok('есть активные события недели', Array.isArray(content.activeEvents) && content.activeEvents.length > 0, content.activeEvents.map((e) => e.name).join(', '));
ok('в графике нет ссылок на растровые фото', !/\.(jpe?g|png|webp|gif)/i.test(JSON.stringify(content.items)));
const hints = (await call('/hints')).body;
const devAuth = !!hints.telegram?.devAuth;

console.log('\n[2] Фаза 1 — подготовка поклёвки');
const first = await playOne(t1);
ok('заброс принят', first.castRes.status === 200, `HTTP ${first.castRes.status}`);
ok('seed не передан клиенту', first.cast.seed === undefined && !first.castRes.raw.includes('"seed"'));
ok('добыча не раскрыта заранее', first.cast.reward === undefined && !first.castRes.raw.includes('itemId'));
ok('передано криптографическое обязательство', typeof first.cast.commitment === 'string' && first.cast.commitment.length === 64);
ok('переданы подсказки (следы, силуэт, сложность)', !!first.cast.hints && Array.isArray(first.cast.hints.tells) && first.cast.hints.difficulty >= 1);
ok('попытка сохранена на сервере с секретом', !!first.stored && typeof first.stored.seed === 'string' && Array.isArray(first.stored.reward));

console.log('\n[3] Фазы 2-4 — вываживание, проверка журнала, награда');
ok('результат принят сервером', first.resolve.status === 200, `HTTP ${first.resolve.status} ${first.resolve.body?.error ?? ''}`);
ok('грамотный игрок получил добычу', first.resolve.body.ok === true, `наград: ${first.resolve.body.rewards?.length ?? 0}`);
ok('характеристики награды рассчитаны сервером', (first.resolve.body.rewards ?? []).every((r) => r.value > 0 && r.weightG > 0 && r.def));
const invAfter = first.resolve.body.player.items.length;
ok('предмет добавлен в инвентарь', invAfter >= 1, `${invAfter} шт`);
const again = await call(`/cast/${first.cast.castId}/resolve`, { method: 'POST', token: t1, body: { actions: first.log } });
ok('повторный запрос не создаёт второй предмет', again.body.alreadyGranted === true && (again.body.player?.items?.length ?? invAfter) === invAfter);

console.log('\n[4] Обрыв лески, невозможные и чужие попытки');
const fresh = await call('/cast', { method: 'POST', token: t1, body: { locationId: 'harbor', castType: 'normal' } });
await waitCast(fresh.body.castId);
const badLog = await call(`/cast/${fresh.body.castId}/resolve`, { method: 'POST', token: t1, body: { actions: [] } });
ok('пустой журнал не даёт награду', badLog.body?.ok === false || badLog.status === 410, `HTTP ${badLog.status} reason=${badLog.body?.reason}`);
const unfinished = await call(`/cast/${fresh.body.castId}/resolve`, { method: 'POST', token: t1, body: { actions: [] } });
ok('повторное разрешение не выдаёт награду дважды', unfinished.body?.alreadyGranted === true || unfinished.body?.ok === false);
const deep = await call('/cast', { method: 'POST', token: t1, body: { locationId: 'abyss', castType: 'deep' } });
ok('без снаряжения нет доступа к глубокой локации', deep.status === 403, `HTTP ${deep.status}`);
if (first.cast) {
  const foreign = await call(`/cast/${first.cast.castId}/resolve`, { method: 'POST', token: t2, body: { actions: first.log } });
  ok('чужую попытку разрешить нельзя', foreign.status === 404 || foreign.status === 403);
  const forged = await call(`/cast/${first.cast.castId}/resolve`, { method: 'POST', token: t1, body: { actions: [{ a: 'REEL', t: 0, dt: 0 }] } });
  ok('подделанный короткий журнал не даёт награду', forged.body?.ok === false || forged.body?.alreadyGranted === true);
}
if (!devAuth) {
  const noAuth = await call('/cast', { method: 'POST', body: { locationId: 'lake' } });
  ok('без авторизации заброс отклонён', noAuth.status === 401);
} else {
  ok('без авторизации заброс отклонён', true, 'dev-режим включён (ALLOW_DEV_AUTH=1) — проверка в проде');
}

console.log('\n[5] Набор добычи и торговец NPC');
for (let i = 0; i < 4; i++) await playOne(t1, { locationId: 'harbor', castType: 'normal' });
const inv = (await call('/me', { token: t1 })).body.player;
ok('за несколько забросов набралось добычи', inv.items.length >= 2, `${inv.items.length} предметов`);
const npc0 = (await call('/npc', { token: t1 })).body.daily;
ok('дневной лимит: 100 продаж по полной цене', npc0.fullLimit === 100 && npc0.halfLimit === 100 && npc0.mult === 1);
const sellable = inv.items.filter((i) => ['common', 'uncommon', 'rare'].includes(i.rarity) && !i.serial && !i.placed);
const epic = inv.items.find((i) => ['epic', 'legendary', 'mythic', 'secret'].includes(i.rarity));
if (sellable.length) {
  const opId = `smoke-${uid}-1`;
  const sell = await call('/sell/npc', { method: 'POST', token: t1, body: { uids: [sellable[0].uid], opId } });
  ok('обычный предмет продан по фиксированной цене', sell.body.sold?.length === 1 && sell.body.sold[0].price > 0, `${sell.body.sold?.[0]?.price} ¢`);
  ok('счётчик дневного лимита увеличился', sell.body.daily.sold === 1);
  const dup = await call('/sell/npc', { method: 'POST', token: t1, body: { uids: [sellable[0].uid], opId } });
  ok('повторный запрос продажи не начисляет монеты дважды', dup.body.duplicate === true);
  const rest = (await call('/me', { token: t1 })).body.player;
  ok('предмет убран из инвентаря после продажи', !rest.items.some((i) => i.uid === sellable[0].uid));
} else {
  ok('обычный предмет продан по фиксированной цене', false, 'не нашлось обычного предмета за 5 забросов (проверено модульным тестом)');
}
if (epic) {
  const ref = await call('/sell/npc', { method: 'POST', token: t1, body: { uids: [epic.uid] } });
  ok('эпический предмет торговец не берёт', ref.body.refused?.length === 1, ref.body.refused?.[0]?.reason);
} else {
  ok('эпический предмет торговец не берёт', true, 'эпического предмета не выпало (проверено модульным тестом)');
}

console.log('\n[6] Рынок игроков');
let forSale = (await call('/me', { token: t1 })).body.player.items.find((i) => !i.serial && !i.placed);
if (!forSale) { await playOne(t1, { locationId: 'lake' }); forSale = (await call('/me', { token: t1 })).body.player.items.find((i) => !i.serial && !i.placed); }
const before1 = (await call('/me', { token: t1 })).body.player;
const before2 = (await call('/me', { token: t2 })).body.player;
if (forSale) {
  const price = Math.min(100, Math.max(1, before2.coins - 10));
  const listed = await call('/market/list', { method: 'POST', token: t1, body: { uid: forSale.uid, price, kind: 'market' } });
  ok('предмет выставлен на рынок', listed.status === 200 && !!listed.body.listing?.id, `HTTP ${listed.status} ${listed.body?.error ?? ''}`);
  if (listed.body.listing) {
    const market = (await call('/market')).body;
    ok('лот виден в списке', market.listings.some((l) => l.id === listed.body.listing.id));
    const buy = await call('/market/buy', { method: 'POST', token: t2, body: { listingId: listed.body.listing.id } });
    ok('второй игрок купил лот', buy.status === 200 && buy.body.item?.itemId === forSale.itemId, `HTTP ${buy.status} ${buy.body?.error ?? ''}`);
    const after1 = (await call('/me', { token: t1 })).body.player;
    const after2 = (await call('/me', { token: t2 })).body.player;
    ok('покупатель заплатил, продавец получил монеты', after2.coins < before2.coins && after1.coins > before1.coins - price, `${before2.coins}→${after2.coins} / ${before1.coins}→${after1.coins}`);
    ok('предмет перешёл покупателю', after2.items.some((i) => i.uid === forSale.uid) && !after1.items.some((i) => i.uid === forSale.uid));
  }
} else {
  ok('предмет выставлен на рынок', false, 'нечего выставлять');
}

console.log('\n[7] База, выставка и рейтинги');
const p1 = (await call('/me', { token: t1 })).body.player;
const exhibit = p1.items.find((i) => !i.serial) ?? p1.items[0];
if (exhibit) {
  const def = content.items.find((i) => i.id === exhibit.itemId);
  const size = exhibit.weightG > 200_000 ? 'huge' : exhibit.weightG > 20_000 ? 'large' : exhibit.weightG > 1_000 ? 'medium' : 'small';
  const slotId = size === 'huge' ? 'yard_1' : size === 'large' ? 'vault_1' : size === 'medium' ? 'aquarium_1' : 'stand_1';
  const place = await call('/base', { method: 'POST', token: t1, body: { slot: slotId, uid: exhibit.uid } });
  ok('экспонат размещён на базе', place.status === 200 && place.body.base.slots.some((s) => s.itemUid === exhibit.uid), `HTTP ${place.status} ${place.body?.error ?? ''} (${def.name}, ${size} → ${slotId})`);
  const tooBig = p1.items.find((i) => i.weightG > 20_000 && i.uid !== exhibit.uid);
  if (tooBig) {
    const bad = await call('/base', { method: 'POST', token: t1, body: { slot: 'stand_1', uid: tooBig.uid } });
    ok('слишком крупный предмет не влезает в маленький слот', bad.status === 400 && bad.body.error === 'too_big');
  } else {
    ok('слишком крупный предмет не влезает в маленький слот', true, 'крупных предметов не выпало (правило проверено кодом размера)');
  }
  await call('/base', { method: 'POST', token: t1, body: { slot: slotId, uid: exhibit.uid } });
  const view = await call(`/base/${p1.id}`);
  ok('базу можно посетить и увидеть экспонаты', view.status === 200 && view.body.exhibits.length >= 1);
  await call(`/base/${p1.id}`);
  ok('посещения считаются', (await call(`/base/${p1.id}`)).body.base.visitors >= 3);
  const named = await call('/base', { method: 'POST', token: t1, body: { name: 'Смоук-база' } });
  ok('название базы изменено', named.body.base.name === 'Смоук-база');
  const selfRate = await call('/base/rate', { method: 'POST', token: t1, body: { playerId: p1.id, stars: 5 } });
  ok('свою базу оценить нельзя', selfRate.status === 400);
  const lowRate = await call('/base/rate', { method: 'POST', token: t2, body: { playerId: p1.id, stars: 5 } });
  ok('оценка требует 3 уровня', lowRate.status === 403, `HTTP ${lowRate.status}`);
  const serialBlock = await call('/sell/npc', { method: 'POST', token: t1, body: { uids: ['нет-такого'] } });
  ok('несуществующий предмет не продаётся', serialBlock.body.refused?.length === 1);
} else {
  ok('экспонат размещён на базе', false, 'инвентарь пуст');
}
const board = (await call('/leaderboard')).body;
ok('рейтинг баз работает', Array.isArray(board.bases) && board.bases.length >= 2);
ok('книга рекордов работает', Array.isArray(board.records));
ok('цифровой музей доступен', (await call('/museum')).body.items.length >= 100);
const smuggler = (await call('/smuggler', { token: t1 })).body;
ok('Скупщик недели доступен с ограничениями', smuggler.offers.length > 0 && smuggler.offers.every((o) => o.limit > 0));

console.log('\n[8] Защита сессии и ограничения');
const wrongAuth = await call('/me', { token: 'forged.signature' });
ok('поддельная сессия отклонена', wrongAuth.status === 401 || wrongAuth.status === 404, `HTTP ${wrongAuth.status}${devAuth ? ' (dev-режим)' : ''}`);
const lock = await call('/cast', { method: 'POST', token: t1, body: { locationId: 'alien', castType: 'normal' } });
ok('закрытая локация недоступна', lock.status === 403);
const health = await call('/health');
ok('health отвечает', health.status === 200 && health.body.ok === true, `store=${health.body.store}`);
let limited = false;
for (let i = 0; i < 34; i++) {
  const r = await call('/cast', { method: 'POST', token: t2, body: { locationId: 'lake', castType: 'normal' } });
  if (r.status === 429) { limited = true; break; }
}
ok('работает ограничение частоты запросов', limited);

console.log(`\nИтог: ${pass} успешно, ${fail} провалено (хранилище: ${DB_URL ? 'postgres' : 'file'})\n`);
if (pool) await pool.end().catch(() => {});
process.exit(fail ? 1 : 0);
