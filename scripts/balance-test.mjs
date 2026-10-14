/**
 * Балансный тест мини-игры: имитирует живого игрока (решение раз в 150 мс, задержка реакции)
 * и проверяет, что бой интересен, но не безнадёжен.
 * Запуск: node scripts/balance-test.mjs
 */
import { createCast, simulateFight, Rng } from '../dist/engine.js';
import { applyPhysics, PHYS } from '../dist/physics.js';
import { newPlayer } from '../dist/types.js';
import { ITEM_BY_ID, LOCATIONS } from '../dist/content.js';

const LOADOUTS = {
  'старт (бамбук, 2 кг)': {},
  'средний (карбон, 30 кг)': { rod: 'rod_carbon', reel: 'reel_baitcaster', line: 'line_30', hook: 'hook_large', bait: 'bait_live', net: 'net_pro', boat: 'boat_motor', device: 'device_depth' },
  'топ (резонансная, 400 кг)': { rod: 'rod_alien', reel: 'reel_abyss', line: 'line_400', hook: 'hook_void', bait: 'bait_alien', net: 'net_giant', boat: 'boat_bathyscaphe', device: 'device_void' },
};

/** Живой игрок: видит состояние, но реагирует с задержкой и решает не каждый тик. */
function playHuman(params, seed, { reactMs = 150, low = 0.5, high = 0.78 } = {}) {
  const events = simulateFight(params, seed, []).events;
  const p = { strength: params.strength, maxLoad: params.maxLoad, control: params.control, speed: params.speed, depth: params.depth, giant: params.giant };
  let core = { t: 0, tension: 0.15, progress: 0, integrity: 1, stamina: 1, slack: 0 };
  let reeling = false; let outcome = null; let nextDecision = 0; let decisions = 0;
  while (!outcome && core.t < PHYS.MAX_MS) {
    const tick = core.t + PHYS.TICK;
    if (core.t >= nextDecision) {
      decisions++;
      nextDecision = core.t + reactMs;
      const onTrial = applyPhysics(core, p, PHYS.TICK, true, 0);
      reeling = core.tension > high ? false : core.tension < low ? true : onTrial.outcome === 'break' ? false : reeling;
    }
    const ev = events.find((e) => tick >= e.start && tick < e.start + e.duration);
    const r = applyPhysics(core, p, PHYS.TICK, reeling, ev ? ev.power : 0);
    core = r.core; outcome = r.outcome;
  }
  return { outcome, seconds: core.t / 1000, progress: core.progress, integrity: core.integrity, decisions, core };
}

function makePlayer(loadout) {
  const p = newPlayer('dev:balance', 'Баланс');
  p.locations = LOCATIONS.map((l) => l.id);
  for (const [slot, id] of Object.entries(loadout)) p.loadout[slot] = id;
  return p;
}

console.log('\nБаланс мини-игры: живой игрок (реакция 150 мс, рабочая зона 0.5–0.78)\n');
let problems = 0;
for (const [name, loadout] of Object.entries(LOADOUTS)) {
  const player = makePlayer(loadout);
  for (const loc of ['lake', 'harbor', 'abyss']) {
    const stats = { land: 0, break: 0, slip: 0, timeout: 0, seconds: [], byRarity: {}, byCat: {} };
    const N = 160;
    for (let i = 0; i < N; i++) {
      const cast = createCast(player, loc, 'normal', `balance-${name}-${loc}-${i}`);
      const def = ITEM_BY_ID[cast.reward[0].itemId];
      const r = playHuman(cast.params, cast.seed);
      stats[r.outcome ?? 'timeout']++;
      stats.seconds.push(r.seconds);
      stats.byRarity[def.rarity] = stats.byRarity[def.rarity] ?? { n: 0, land: 0 };
      stats.byRarity[def.rarity].n++;
      stats.byCat[def.cat] = stats.byCat[def.cat] ?? { n: 0, land: 0 };
      stats.byCat[def.cat].n++;
      if (r.outcome === 'land') { stats.byRarity[def.rarity].land++; stats.byCat[def.cat].land++; }
    }
    const avg = stats.seconds.reduce((a, b) => a + b, 0) / stats.seconds.length;
    const sorted = [...stats.seconds].sort((a, b) => a - b);
    const rate = (stats.land / N) * 100;
    console.log(`${name} · ${loc}`);
    console.log(`  вылов ${rate.toFixed(0)}% · обрыв ${((stats.break / N) * 100).toFixed(0)}% · сход ${((stats.slip / N) * 100).toFixed(0)}% · ушла ${((stats.timeout / N) * 100).toFixed(0)}%`);
    console.log(`  длительность: медиана ${sorted[Math.floor(N / 2)].toFixed(1)} с · макс ${sorted[N - 1].toFixed(1)} с`);
    const rare = Object.entries(stats.byRarity).map(([k, v]) => `${k} ${Math.round((v.land / v.n) * 100)}%`).join(', ');
    console.log(`  вылов по редкостям: ${rare}`);

    // Критерии играбельности
    const bigLand = Object.entries(stats.byRarity)
      .filter(([k]) => k === 'legendary' || k === 'mythic' || k === 'secret')
      .reduce((acc, [, v]) => ({ n: acc.n + v.n, land: acc.land + v.land }), { n: 0, land: 0 });
    const bigRate = bigLand.n ? (bigLand.land / bigLand.n) * 100 : 100;
    const giant = stats.byCat.giant ?? { n: 0, land: 0 };
    const giantRate = giant.n ? (giant.land / giant.n) * 100 : 100;
    if (giant.n) console.log(`  огромные находки: вылов ${giantRate.toFixed(0)}% из ${giant.n}`);
    if (name.startsWith('старт') && loc === 'lake') {
      if (rate < 80) { problems++; console.log('  ⚠ новичок слишком часто теряет обычную добычу на старте'); }
      if (rate > 99.5) { problems++; console.log('  ⚠ на старте вообще нет риска — забросы не интригуют'); }
      if (sorted[Math.floor(N / 2)] < 4) { problems++; console.log('  ⚠ бой слишком короткий, нет интриги'); }
      if (sorted[Math.floor(N / 2)] > 40) { problems++; console.log('  ⚠ бой слишком долгий для обычной рыбалки'); }
      if (giant.n >= 3 && giantRate > 60) { problems++; console.log('  ⚠ огромные находки даются стартовой снастью слишком легко'); }
    }
    if (loc === 'abyss' && name.startsWith('старт') && bigRate > 65) { problems++; console.log('  ⚠ бездна отдаёт крупные находки слабой снасти'); }
    if (loc === 'abyss' && !name.startsWith('старт') && rate < 90) { problems++; console.log('  ⚠ даже хорошая снасть не справляется с бездной'); }
  }
}
console.log(problems ? `\nПроблем баланса: ${problems}\n` : '\nКритерии играбельности выполнены\n');
process.exit(problems ? 1 : 0);
