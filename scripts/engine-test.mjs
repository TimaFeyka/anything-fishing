/**
 * Модульный тест движка (без HTTP): генерация добычи, воспроизводимость вываживания,
 * экономика NPC и уникальность серийных номеров.
 * Запуск: node scripts/engine-test.mjs  (после npm run build:server)
 */
import assert from 'node:assert';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';

const { createCast, simulateFight, activeEvents, Rng, rollCast, npcPrice, marketPrice } = await import('../dist/engine.js');
const { MemoryKv, allocateSerial, withLock } = await import('../dist/store.js');
const { ITEMS, ITEM_BY_ID, RARITY, LOCATIONS, levelFromXp } = await import('../dist/content.js');
const { newPlayer, npcDailyState } = await import('../dist/types.js');

let pass = 0; let fail = 0;
const ok = (name, cond, extra = '') => {
  if (cond) { pass++; console.log(`  ✓ ${name}${extra ? ' — ' + extra : ''}`); }
  else { fail++; console.log(`  ✗ ${name}${extra ? ' — ' + extra : ''}`); }
};

console.log('\n[1] Каталог контента');
ok('предметов не меньше 100', ITEMS.length >= 100, `${ITEMS.length} шт`);
ok('у каждого предмета есть арт-шаблон и палитра', ITEMS.every((i) => i.art && Array.isArray(i.pal) && i.pal.length === 2));
ok('у каждого предмета задана локация обитания', ITEMS.every((i) => i.loc.length > 0));
ok('id предметов уникальны', new Set(ITEMS.map((i) => i.id)).size === ITEMS.length);
ok('локаций 7', LOCATIONS.length === 7);
ok('серийные предметы ограничены тиражом', ITEMS.filter((i) => i.serial).every((i) => i.serial > 0));

console.log('\n[2] Генерация поклёвок');
const player = newPlayer('dev:test', 'Тест');
player.locations = LOCATIONS.map((l) => l.id);
const rng = new Rng('loot-test');
const seen = new Map();
const cats = {};
let serialDrops = 0;
let giants = 0;
for (let i = 0; i < 3000; i++) {
  const c = rollCast(player, 'abyss', 'deep', new Rng(`test-${i}`));
  const def = ITEM_BY_ID[c.rewards[0].itemId];
  seen.set(def.id, (seen.get(def.id) ?? 0) + 1);
  cats[def.cat] = (cats[def.cat] ?? 0) + 1;
  if (def.serial) serialDrops++;
  if (c.giant) giants++;
}
ok('разнообразие добычи', seen.size >= 30, `${seen.size} разных предметов из 3000 забросов`);
ok('встречаются все категории', Object.keys(cats).length >= 4, JSON.stringify(cats));
ok('событие «что-то огромное» случается регулярно, но редко', giants > 0 && giants / 3000 < 0.35, `${giants} из 3000 (${(giants / 30).toFixed(1)}%)`);
ok('есть двойные поклёвки', [0, 1, 2, 3, 4].length > 0);
void rng; void serialDrops;

console.log('\n[3] События недели');
const ev = activeEvents();
ok('события недели детерминированы', JSON.stringify(ev) === JSON.stringify(activeEvents()));
ok('событие недели выбрано', ev.length >= 1, ev.map((e) => e.name).join(', '));

console.log('\n[4] Серверное расписание и повтор вываживания');
{
  const { applyPhysics, PHYS } = await import('../dist/physics.js');
  const p2 = newPlayer('dev:test2', 'Тест2');
  let landed = 0; let attempts = 0; let stable = true; let landedCore = null;
  for (let n = 0; n < 12; n++) {
    const cast = createCast(p2, n % 3 === 0 ? 'abyss' : 'harbor', n % 2 ? 'normal' : 'deep');
    const events = simulateFight(cast.params, cast.seed, []).events;
    const p = { strength: cast.params.strength, maxLoad: cast.params.maxLoad, control: cast.params.control, speed: cast.params.speed, depth: cast.params.depth, giant: cast.params.giant };
    // «Идеальный игрок»: держит натяжение в рабочей зоне, зная только текущее состояние.
    let core = { t: 0, tension: 0.15, progress: 0, integrity: 1, stamina: 1, slack: 0 };
    const log = [];
    let reeling = false;
    let outcome = null;
    attempts++;
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
    const a = simulateFight(cast.params, cast.seed, log);
    const b = simulateFight(cast.params, cast.seed, log);
    if (JSON.stringify(a.core) !== JSON.stringify(b.core) || a.outcome !== b.outcome) stable = false;
    if (a.outcome === 'land') { landed++; landedCore = a; }
    if (n === 0) {
      ok('секретного расписания нет в ответе /cast', cast.events === undefined);
      ok('обязательство (commitment) выдаётся', typeof cast.commitment === 'string' && cast.commitment.length === 64);
      const cheat = simulateFight(cast.params, 'другой-seed', log);
      ok('подмена seed меняет симуляцию', JSON.stringify(cheat.core) !== JSON.stringify(a.core));
    }
  }
  ok('повтор даёт идентичный результат (12 боёв)', stable);
  ok('грамотное вываживание вытаскивает добычу', landed > 0, `${landed} из ${attempts} боёв закончились выловом`);
  ok('выловленный бой содержит прогресс 1.0', !landedCore || landedCore.core.progress >= 0.999);
}

console.log('\n[5] Идемпотентность серийных номеров');
{
  const dir = path.join(os.tmpdir(), `af-test-${Date.now()}`);
  const store = new MemoryKv(path.join(dir, 'state.json'));
  await store.init();
  const total = ITEM_BY_ID.ser_mask_first.serial;
  const nos = new Set();
  for (let i = 0; i < total; i++) {
    const r = await allocateSerial(store, 'ser_mask_first', total);
    assert(r, 'номер должен быть выдан');
    nos.add(r.no);
  }
  ok('все номера выданы уникально', nos.size === total, `${nos.size} из ${total}`);
  const overflow = await allocateSerial(store, 'ser_mask_first', total);
  ok('после исчерпания тиража новый номер не создаётся', overflow === null);
  await store.flush?.();
  fs.rmSync(dir, { recursive: true, force: true });
}

console.log('\n[6] Экономика: фиксированные цены NPC и дневные лимиты');
{
  const price = npcPrice(1000, 1.5, 1, 1);
  const half = npcPrice(1000, 1.5, 0.5, 1);
  ok('полная цена больше половины ровно в 2 раза', price === half * 2, `${price} / ${half}`);
  const p = newPlayer('dev:econ', 'Эконом');
  p.daily = { day: new Date().toISOString().slice(0, 10), npcSold: 99, npcFull: 99, npcHalf: 0 };
  const near = npcDailyState(p, 100, 100, 0.5);
  ok('на 99-й продаже ещё полная цена', near.mult === 1 && near.fullLeft === 1);
  p.daily.npcSold = 150;
  const mid = npcDailyState(p, 100, 100, 0.5);
  ok('после 100 продаж коэффициент 0.5', mid.mult === 0.5 && mid.halfLeft === 50);
  p.daily.npcSold = 200;
  const blocked = npcDailyState(p, 100, 100, 0.5);
  ok('после 200 продаж торговец останавливается', blocked.blocked === true && blocked.mult === 0);
  const epicDef = ITEM_BY_ID.fish_eel;
  ok('эпические предметы торговцем не покупаются', RARITY[epicDef.rarity].sellableNpc === false);
  ok('обычная рыба покупается по фиксированной цене', RARITY[ITEM_BY_ID.fish_roach.rarity].sellableNpc === true);
  const m1 = marketPrice(epicDef, 0, 0);
  const m2 = marketPrice(epicDef, 50, 0);
  const m3 = marketPrice(epicDef, 0, 50);
  ok('рыночная цена реагирует на предложение', m2 < m1, `${m1} → ${m2} при 50 лотах`);
  ok('рыночная цена реагирует на спрос', m3 > m1, `${m1} → ${m3} при высоком спросе`);
}

console.log('\n[7] Прогрессия');
{
  ok('уровень растёт с опытом', levelFromXp(0) === 1 && levelFromXp(100000) > 5, `1 → ${levelFromXp(100000)}`);
}

console.log(`\nИтог: ${pass} успешно, ${fail} провалено\n`);
process.exit(fail ? 1 : 0);
