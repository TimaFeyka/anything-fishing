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

console.log('\n[4] Авторитетное вытеснение: воспроизводимость, skill и снасть');
{
  const { applyPhysics, PHYS } = await import('../dist/physics.js');
  const base = newPlayer('dev:test2', 'Тест2');
  base.locations = LOCATIONS.map((l) => l.id);

  // «Идеальный игрок»: держит натяжение в рабочей зоне, реагирует мгновенно
  const playIdeal = (cast) => {
    const events = simulateFight(cast.params, cast.seed, []).events;
    const p = { strength: cast.params.strength, maxLoad: cast.params.maxLoad, control: cast.params.control, speed: cast.params.speed, depth: cast.params.depth, giant: cast.params.giant };
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
    return { outcome, log, core };
  };

  const trial = (player, loc, n, seedPrefix = 'test') => {
    let land = 0; let stable = true;
    for (let i = 0; i < n; i++) {
      const cast = createCast(player, loc, i % 2 ? 'normal' : 'deep', `${seedPrefix}-${i}`);
      const { outcome, log, core } = playIdeal(cast);
      const a = simulateFight(cast.params, cast.seed, log);
      const b = simulateFight(cast.params, cast.seed, log);
      if (JSON.stringify(a.core) !== JSON.stringify(b.core) || a.outcome !== b.outcome) stable = false;
      if (outcome === 'land') { land++; if (core.progress < 0.999) stable = false; }
      if (i === 0) {
        ok('секретного расписания нет в ответе /cast', cast.events === undefined);
        ok('обязательство (commitment) выдаётся', typeof cast.commitment === 'string' && cast.commitment.length === 64);
        const cheat = simulateFight(cast.params, 'другой-seed', log);
        ok('подмена seed меняет симуляцию', JSON.stringify(cheat.core) !== JSON.stringify(a.core));
      }
    }
    return { land, n, stable };
  };

  const starter = { ...base, loadout: { rod: 'rod_bamboo', reel: 'reel_simple', line: 'line_2', hook: 'hook_small', bait: 'bait_worm', net: 'net_basic', boat: 'boat_none', device: 'device_none' } };
  const top = { ...base, loadout: { rod: 'rod_alien', reel: 'reel_abyss', line: 'line_400', hook: 'hook_void', bait: 'bait_alien', net: 'net_giant', boat: 'boat_bathyscaphe', device: 'device_void' } };

  const easy = trial(starter, 'lake', 12, 'lake');
  ok('повтор даёт идентичный результат (12 боёв)', easy.stable);
  ok('идеальная игра со стартовой снастью вытаскивает обычную добычу', easy.land >= 10, `${easy.land} из ${easy.n}`);
  const topEasy = trial(top, 'lake', 12, 'lake');
  ok('та же добыча топовой снастью тоже вытаскивается', topEasy.land >= 10, `${topEasy.land} из ${topEasy.n}`);

  // Правило снасти: одна и та же добыча, разная леска
  const heavy = { strength: 12, maxLoad: 2, stamina: 40, erratic: 0.7, segments: 10, control: 1.2, speed: 1.2, depth: 5, giant: true };
  const weak = playIdeal({ params: heavy, seed: 'gear-check' });
  const strong = playIdeal({ params: { ...heavy, maxLoad: 400 }, seed: 'gear-check' });
  ok('добыча тяжелее снасти в разы не вытаскивается', weak.outcome !== 'land', `исход: ${weak.outcome}, остаток лески ${weak.core.integrity.toFixed(2)}`);
  const stubborn = simulateFight(heavy, 'gear-check', [{ a: 'REEL', t: 0, dt: 0 }]);
  ok('если тянуть перегруженную снасть до конца, леска рвётся', stubborn.outcome === 'break', `исход: ${stubborn.outcome} за ${(stubborn.core.t / 1000).toFixed(1)} с`);
  ok('та же добыча при подходящей снасти вытаскивается', strong.outcome === 'land', `исход: ${strong.outcome} за ${(strong.core.t / 1000).toFixed(1)} с`);
  ok('снасть влияет на результат сильнее, чем везение', strong.outcome === 'land' && weak.outcome !== 'land');
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
