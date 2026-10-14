/**
 * Игровой движок сервера: генерация поклёвки, расписание рывков (секретное),
 * авторитетная симуляция вываживания, экономика, серийные предметы, достижения.
 */
import crypto from 'node:crypto';
import {
  ACHIEVEMENTS, CAST_TYPES, CATEGORY_NAMES, GEAR_BY_ID, GLOBAL_EVENTS, ITEM_BY_ID, ITEMS, LOC_BY_ID, RARITY,
  SMUGGLER_POOL, RESEARCH, RECIPES, levelFromXp, weekIndex, dayKey,
  type Category, type CastType, type GlobalEventDef, type ItemDef, type Rarity,
} from './content.js';
import { PHYS, activeEvent, applyPhysics, nextEvent, type Outcome, type PhysParams, type PhysicsCore, type PullEvent, type PullKind } from './physics.js';
import type { CastDoc, CastReward, FightAction, FightParams, ItemInstance, Mutation, PlayerDoc } from './types.js';

// ─────────────────────────────── Детерминированный RNG ───────────────────────────────
export class Rng {
  private a: number; private b: number; private c: number; private d: number;
  constructor(seed: string | number) {
    const h = crypto.createHash('sha256').update(String(seed)).digest();
    this.a = h.readUInt32LE(0) || 1;
    this.b = h.readUInt32LE(4) || 2;
    this.c = h.readUInt32LE(8) || 3;
    this.d = h.readUInt32LE(12) || 4;
  }
  next(): number {
    // xorshift128
    let t = this.d;
    const s = this.a;
    this.d = this.c; this.c = this.b; this.b = s;
    t ^= t << 11; t >>>= 0;
    t ^= t >>> 8;
    this.a = (t ^ s ^ (s >>> 19)) >>> 0;
    return this.a / 4294967296;
  }
  range(min: number, max: number): number { return min + this.next() * (max - min); }
  int(min: number, max: number): number { return Math.floor(this.range(min, max + 1)); }
  pick<T>(arr: T[]): T { return arr[Math.floor(this.next() * arr.length) % arr.length]; }
  weighted<T>(entries: [T, number][]): T {
    const total = entries.reduce((n, [, w]) => n + Math.max(0, w), 0);
    if (total <= 0) return entries[0][0];
    let r = this.next() * total;
    for (const [v, w] of entries) { r -= Math.max(0, w); if (r <= 0) return v; }
    return entries[entries.length - 1][0];
  }
}

export function newSeed(): string {
  return crypto.randomBytes(16).toString('hex');
}
export function commitmentOf(seed: string, castId: string): string {
  return crypto.createHash('sha256').update(`af:v1:${seed}:${castId}`).digest('hex');
}

// ─────────────────────────────── Генерация поклёвки ───────────────────────────────
function loadoutBias(loadout: Record<string, string>): { cat: Partial<Record<Category, number>>; rarity: number } {
  const cat: Partial<Record<Category, number>> = {};
  let rarity = 1;
  for (const [slot, id] of Object.entries(loadout || {})) {
    const g = GEAR_BY_ID[id];
    if (!g) continue;
    if (slot === 'rod' && g.specialty) cat[g.specialty] = (cat[g.specialty] ?? 1) * (1 + (g.specialtyBonus ?? 0));
    if (g.bias) for (const [k, v] of Object.entries(g.bias)) cat[k as Category] = (cat[k as Category] ?? 1) * (v as number);
    if (g.rarityBias) rarity *= g.rarityBias;
    if (g.luck) rarity *= 1 + g.luck;
  }
  return { cat, rarity };
}

/** События недели: выбираются детерминированно и реально меняют таблицы добычи. */
export function activeEvents(week = weekIndex()): GlobalEventDef[] {
  const rng = new Rng(`event:${week}`);
  const pool = [...GLOBAL_EVENTS];
  const count = rng.next() < 0.5 ? 1 : 2;
  const out: GlobalEventDef[] = [];
  for (let i = 0; i < count && pool.length; i++) {
    out.push(pool.splice(Math.floor(rng.next() * pool.length) % pool.length, 1)[0]);
  }
  return out;
}

function effectiveMaxLoad(loadout: Record<string, string>): number {
  const rod = GEAR_BY_ID[loadout.rod];
  const line = GEAR_BY_ID[loadout.line];
  const rodLoad = rod?.maxLoad ?? 4;
  const lineLoad = line?.maxLoad ?? 2;
  return Math.min(rodLoad, lineLoad);
}

export function rollCast(player: PlayerDoc, locationId: string, castType: CastType, rng: Rng): {
  rewards: CastReward[]; params: FightParams; giant: boolean; tells: string[]; width: number;
} {
  const loc = LOC_BY_ID[locationId] ?? LOC_BY_ID.lake;
  const cast = CAST_TYPES[castType] ?? CAST_TYPES.normal;
  const bias = loadoutBias(player.loadout || {});
  const maxLoad = effectiveMaxLoad(player.loadout || {});

  // Глобальное событие недели (если оно действует в этой локации)
  const events = activeEvents().filter((e) => !e.loc || e.loc === loc.id);
  const evCat: Partial<Record<Category, number>> = {};
  let evRarity = 1;
  for (const e of events) {
    if (e.rarityBias) evRarity *= e.rarityBias;
    for (const [k, v] of Object.entries(e.catBias ?? {})) evCat[k as Category] = (evCat[k as Category] ?? 1) * (v as number);
  }

  const catWeights: [Category, number][] = (Object.keys(loc.cat) as Category[]).map((c) => {
    let w = loc.cat[c] * (cast.catBias[c] ?? 1) * (bias.cat[c] ?? 1) * (evCat[c] ?? 1);
    if (c === 'giant' && !player.loadout?.rod) w *= 0.5;
    return [c, w];
  });

  const rollOne = (rarityCap = 7, allowGiant = true): CastReward => {
    let cat = rng.weighted(catWeights);
    if (!allowGiant && cat === 'giant') cat = 'fish';
    const rarityWeights: [Rarity, number][] = (Object.keys(loc.rarity) as Rarity[]).map((r) => {
      const order = RARITY[r].order;
      let w = loc.rarity[r] * cast.rarityBias * bias.rarity * evRarity;
      if (order > rarityCap) w = 0;
      return [r, w];
    });
    let rarity = rng.weighted(rarityWeights);
    let def = pickDef(cat, rarity, loc.id, rng);
    if (!def) { // фолбэк: ищем что-то в категории ниже
      for (const alt of ['common', 'uncommon', 'rare'] as Rarity[]) {
        def = pickDef(cat, alt, loc.id, rng);
        if (def) { rarity = alt; break; }
      }
    }
    if (!def) { def = ITEM_BY_ID['fish_roach']; rarity = 'common'; }
    const mutation = rollMutation(rng, def.rarity);
    const ratio = rng.next();
    let weightG = Math.round(def.w[0] + (def.w[1] - def.w[0]) * Math.pow(ratio, 1.6));
    if (mutation === 'giant') weightG = Math.round(weightG * rng.range(1.6, 3.2));
    if (def.cat === 'giant') weightG = Math.round(weightG * rng.range(0.85, 1.25));
    const lenRatio = Math.min(1.25, Math.max(0.5, Math.pow(weightG / Math.max(1, def.w[1]), 1 / 3) + 0.35));
    const lengthCm = Math.round((def.len[0] + (def.len[1] - def.len[0]) * ratio) * lenRatio * 10) / 10;
    const condition = def.cat === 'fish' ? rng.range(0.82, 1) : def.cat === 'junk' ? rng.range(0.25, 0.65) : rng.range(0.45, 0.95);
    const value = computeValue(def, weightG, mutation, condition);
    return { itemId: def.id, rarity: def.rarity, cat: def.cat, weightG, lengthCm, condition: Math.round(condition * 100) / 100, mutation, value };
  };

  const rewards: CastReward[] = [rollOne()];
  // Двойная поклёвка: два предмета за один заброс
  const doubleChance = 0.07 * (1 + (bias.rarity - 1) * 0.5) + (castType === 'precise' ? 0.03 : 0);
  if (rng.next() < doubleChance) rewards.push(rollOne(4, false));

  const main = rewards[0];
  const mainDef = ITEM_BY_ID[main.itemId];
  const weightRatio = (main.weightG - mainDef.w[0]) / Math.max(1, mainDef.w[1] - mainDef.w[0]);
  const giant = mainDef.cat === 'giant' || main.cat === 'giant' || (main.weightG > 50_000 && mainDef.w[1] > 20_000);
  const strengthBase = mainDef.pull * (0.6 + weightRatio * 1.1) * (1 + loc.depth * 0.05) * (giant ? 1.3 : 1);
  const strength = Math.round(strengthBase * 100) / 100;
  const rod = GEAR_BY_ID[player.loadout?.rod ?? ''] ?? GEAR_BY_ID['rod_bamboo'];
  const reel = GEAR_BY_ID[player.loadout?.reel ?? ''] ?? GEAR_BY_ID['reel_simple'];
  const net = GEAR_BY_ID[player.loadout?.net ?? ''] ?? GEAR_BY_ID['net_basic'];
  const params: FightParams = {
    strength,
    maxLoad,
    stamina: Math.round(18 + strength * 6 + (giant ? 25 : 0)),
    erratic: Math.min(0.95, 0.25 + mainDef.pull * 0.12 + (giant ? 0.2 : 0)),
    segments: Math.max(4, Math.min(14, Math.round(5 + mainDef.pull * 1.6 + (giant ? 4 : 0)))),
    control: (rod.control ?? 1) * (reel.control ?? 1) * 0.5 + (net.control ?? 1) * 0.5,
    speed: (reel.speed ?? 1) * (rod.speed ?? 1),
    depth: loc.depth,
    giant,
  };
  const tellCount = main.rarity === 'common' ? 1 : main.rarity === 'uncommon' ? 1 : main.rarity === 'rare' ? 2 : 3;
  const tells = [...loc.tells].sort(() => rng.next() - 0.5).slice(0, tellCount);
  if (giant) tells.unshift('Что-то очень большое движется под водой');
  return { rewards, params, giant, tells, width: Math.min(1, 0.25 + weightRatio * 0.9 + (giant ? 0.4 : 0)) };
}

function pickDef(cat: Category, rarity: Rarity, locId: string, rng: Rng): ItemDef | null {
  const pool = ITEMS.filter((i) => i.cat === cat && i.rarity === rarity && i.loc.includes(locId));
  if (pool.length) return pool[Math.floor(rng.next() * pool.length) % pool.length];
  const anyLoc = ITEMS.filter((i) => i.cat === cat && i.rarity === rarity);
  if (anyLoc.length) return anyLoc[Math.floor(rng.next() * anyLoc.length) % anyLoc.length];
  return null;
}

function rollMutation(rng: Rng, rarity: Rarity): Mutation {
  const r = rng.next();
  const rareBoost = RARITY[rarity].order >= 4 ? 0.6 : 1;
  if (r < 0.005 * rareBoost) return 'ghostly';
  if (r < 0.025) return 'golden';
  if (r < 0.055) return 'giant';
  if (r < 0.08) return 'mutant';
  if (r < 0.14) return 'pristine';
  return 'none';
}

export const MUTATION_INFO: Record<Mutation, { name: string; mult: number; color: string }> = {
  none: { name: 'Обычный', mult: 1, color: '#9aa7b4' },
  pristine: { name: 'Отличное состояние', mult: 1.25, color: '#5fd68a' },
  giant: { name: 'Гигантский экземпляр', mult: 1.6, color: '#57a8ff' },
  mutant: { name: 'Мутация', mult: 1.9, color: '#b46bff' },
  golden: { name: 'Золотой окрас', mult: 2.5, color: '#ffb038' },
  ghostly: { name: 'Призрачный', mult: 3, color: '#00ffd5' },
};

export function computeValue(def: ItemDef, weightG: number, mutation: Mutation, condition: number): number {
  const ratio = Math.max(0, Math.min(1, (weightG - def.w[0]) / Math.max(1, def.w[1] - def.w[0])));
  const condFactor = 0.55 + 0.45 * Math.max(0, Math.min(1, condition));
  const v = def.price * (1 + 0.6 * ratio) * condFactor * MUTATION_INFO[mutation].mult;
  return Math.max(1, Math.round(v));
}

// ─────────────────────────────── Расписание рывков (секрет) ───────────────────────────────
export function buildFightSchedule(params: FightParams, rng: Rng): PullEvent[] {
  const events: PullEvent[] = [];
  let t = 900 + rng.range(0, 1400);
  for (let i = 0; i < params.segments; i++) {
    const r = rng.next();
    const kind: PullKind = r < 0.42 ? 'pull' : r < 0.7 ? 'surge' : r < 0.88 ? 'calm' : 'run';
    const basePower = kind === 'calm' ? rng.range(0.04, 0.18)
      : kind === 'pull' ? rng.range(0.33, 0.58)
        : kind === 'surge' ? rng.range(0.5, 0.78)
          : rng.range(0.78, 1);
    const duration = (kind === 'calm' ? rng.range(700, 1500) : kind === 'pull' ? rng.range(900, 1900) : rng.range(1100, 2600)) * (params.giant ? 1.2 : 1);
    const gap = Math.max(250, rng.range(600, 2300) * (1 - params.erratic * 0.45));
    events.push({ start: Math.round(t), duration: Math.round(duration), power: Math.round(basePower * 1000) / 1000, kind });
    t += duration + gap;
  }
  return events;
}

function reelingAt(actions: FightAction[], t: number): boolean {
  let reeling = false;
  for (const a of actions) { if (a.t <= t) reeling = a.a === 'REEL'; else break; }
  return reeling;
}

export interface SimResult { core: PhysicsCore; outcome: Outcome; ticks: number; events: PullEvent[] }

/**
 * Авторитетная симуляция. И живой бой, и повторная проверка журнала действий
 * используют одну и ту же тиковую логику → результат воспроизводим бит-в-бит.
 */
export function stepOnce(
  core: PhysicsCore, params: FightParams, events: PullEvent[], tickTime: number, actions: FightAction[],
): { core: PhysicsCore; outcome: Outcome } {
  const ev = activeEvent(events, tickTime);
  const power = ev ? ev.power : 0;
  const reeling = reelingAt(actions, tickTime);
  const p: PhysParams = { strength: params.strength, maxLoad: params.maxLoad, control: params.control, speed: params.speed, depth: params.depth, giant: params.giant };
  return applyPhysics(core, p, PHYS.TICK, reeling, power);
}

export function simulateFight(params: FightParams, seed: string, actions: FightAction[], maxMs = PHYS.MAX_MS): SimResult {
  const rng = new Rng(`${seed}:schedule`);
  const events = buildFightSchedule(params, rng);
  let core: PhysicsCore = { t: 0, tension: 0.15, progress: 0, integrity: 1, stamina: 1, slack: 0 };
  let outcome: Outcome = null;
  let ticks = 0;
  const sorted = [...actions].sort((a, b) => a.t - b.t);
  while (!outcome && core.t < maxMs) {
    const r = stepOnce(core, params, events, core.t + PHYS.TICK, sorted);
    core = r.core; outcome = r.outcome; ticks++;
  }
  return { core, outcome, ticks, events };
}

export class FightSession {
  core: PhysicsCore = { t: 0, tension: 0.15, progress: 0, integrity: 1, stamina: 1, slack: 0 };
  events: PullEvent[];
  actions: FightAction[] = [];
  outcome: Outcome = null;
  startedAt = Date.now();
  protectedAcc = 0;
  constructor(public params: FightParams, seed: string, public castId: string) {
    this.events = buildFightSchedule(params, new Rng(`${seed}:schedule`));
  }
  /** Записывает действие игрока. Время выравнивается по тику — так повтор воспроизводим. */
  action(a: 'REEL' | 'RELEASE'): FightAction {
    const t = Math.ceil(this.core.t / PHYS.TICK) * PHYS.TICK;
    this.actions.push({ a, t, dt: Date.now() - this.startedAt });
    return { a, t, dt: Date.now() - this.startedAt };
  }
  /** Продвигает авторитетную симуляцию по фиксированным тикам до прошедшего времени. */
  advance(elapsedMs: number): Outcome {
    const target = Math.floor(elapsedMs / PHYS.TICK) * PHYS.TICK;
    while (!this.outcome && this.core.t + PHYS.TICK <= target && this.core.t < PHYS.MAX_MS) {
      const tick = this.core.t + PHYS.TICK;
      const r = stepOnce(this.core, this.params, this.events, tick, this.actions);
      this.core = r.core;
      this.outcome = r.outcome;
    }
    return this.outcome;
  }
  /** Ближайший рывок — единственное, что уходит клиенту (без полного расписания и seed). */
  lookahead(): { kind: PullKind; power: number; startsInMs: number; durationMs: number } | null {
    const ev = nextEvent(this.events, this.core.t);
    if (!ev) return null;
    return { kind: ev.kind, power: ev.power, startsInMs: Math.max(0, ev.start - this.core.t), durationMs: ev.duration };
  }
  state() {
    return {
      t: this.core.t,
      tension: Math.round(this.core.tension * 1000) / 1000,
      progress: Math.round(this.core.progress * 1000) / 1000,
      integrity: Math.round(this.core.integrity * 1000) / 1000,
      stamina: Math.round(this.core.stamina * 1000) / 1000,
      slack: Math.round(this.core.slack * 100) / 100,
      outcome: this.outcome,
      next: this.lookahead(),
      idealMin: PHYS.IDEAL_MIN,
      idealMax: PHYS.IDEAL_MAX,
    };
  }
}

// ─────────────────────────────── Создание / разрешение попытки ───────────────────────────────
export function createCast(player: PlayerDoc, locationId: string, castType: CastType, seedOverride?: string): CastDoc {
  const id = crypto.randomUUID();
  const seed = seedOverride ?? newSeed();
  const rng = new Rng(`${seed}:loot`);
  const rolled = rollCast(player, locationId, castType, rng);
  const doc: CastDoc = {
    id, playerId: player.id, locationId, castType,
    loadout: { ...player.loadout },
    createdAt: Date.now(), expiresAt: Date.now() + 10 * 60 * 1000,
    seed, commitment: commitmentOf(seed, id),
    reward: rolled.rewards, params: rolled.params, giant: rolled.giant, tells: rolled.tells, width: rolled.width,
    status: 'pending', actions: [], attempts: 0,
  };
  return doc;
}

export function toInstance(cast: CastDoc, r: CastReward, serial?: { no: number; total: number }): ItemInstance {
  const def = ITEM_BY_ID[r.itemId];
  return {
    uid: crypto.randomUUID(),
    itemId: r.itemId,
    rarity: def.rarity,
    cat: def.cat,
    weightG: r.weightG,
    lengthCm: r.lengthCm,
    condition: r.condition,
    mutation: r.mutation,
    serial,
    history: [{ type: 'caught', at: Date.now(), note: `Выловлен в локации «${LOC_BY_ID[cast.locationId]?.name ?? cast.locationId}»` }],
    caughtAt: Date.now(),
    caughtIn: cast.locationId,
    chain: def.chain,
    value: r.value,
    protectedFlag: !!serial,
  };
}

export function xpFor(value: number): number {
  return Math.max(1, Math.round(4 + Math.sqrt(value) * 1.4));
}

// ─────────────────────────────── Экономика ───────────────────────────────
export function npcPrice(value: number, npcMult: number, dailyMult: number, condition: number): number {
  const raw = value * npcMult * dailyMult * (0.75 + 0.25 * condition);
  return Math.max(1, Math.round(raw));
}

export function marketPrice(def: ItemDef, supply: number, demandIndex: number): number {
  const balance = 1 + (demandIndex - supply) / Math.max(12, supply + demandIndex);
  const clamped = Math.max(0.55, Math.min(2.6, balance));
  return Math.max(1, Math.round(def.price * 1.35 * clamped));
}

export function smugglerOffers(week = weekIndex()) {
  const rng = new Rng(`smuggler:${week}`);
  const pool = [...SMUGGLER_POOL];
  const out: typeof SMUGGLER_POOL = [];
  for (let i = 0; i < 5 && pool.length; i++) {
    const idx = Math.floor(rng.next() * pool.length) % pool.length;
    out.push(pool.splice(idx, 1)[0]);
  }
  return out.map((o) => ({ ...o, week }));
}

// ─────────────────────────────── Достижения / музей ───────────────────────────────
export function museumStats(p: PlayerDoc) {
  const discovered = Object.keys(p.collection);
  const byCat: Record<string, { found: number; total: number }> = {};
  for (const cat of Object.keys(CATEGORY_NAMES) as Category[]) {
    const total = ITEMS.filter((i) => i.cat === cat).length;
    const found = discovered.filter((id) => ITEM_BY_ID[id]?.cat === cat).length;
    byCat[cat] = { found, total };
  }
  const serials = p.items.filter((i) => i.serial).length;
  return {
    discovered: discovered.length,
    total: ITEMS.length,
    byCat,
    serials,
    percent: Math.round((discovered.length / ITEMS.length) * 1000) / 10,
  };
}

export function checkAchievements(p: PlayerDoc): string[] {
  const unlocked: string[] = [];
  const cat = (c: string) => p.stats.byCat[c] ?? 0;
  const rar = (r: string) => p.stats.byRarity[r] ?? 0;
  const exhibits = p.base.slots.filter((s) => s.itemUid).length;
  const locs = p.locations?.length ?? 1;
  for (const a of ACHIEVEMENTS) {
    if (p.achievements.includes(a.id)) continue;
    const [key, valStr] = a.check.split(/(>=|<=)/);
    const target = Number(a.check.replace(/^[^0-9]*/, ''));
    let value = 0;
    if (key.startsWith('cat:')) value = cat(key.slice(4));
    else if (key.startsWith('rarity:')) value = rar(key.slice(7));
    else if (key === 'lands') value = p.stats.lands;
    else if (key === 'breaks') value = p.stats.breaks;
    else if (key === 'giants') value = p.stats.giants;
    else if (key === 'doubles') value = p.stats.doubles;
    else if (key === 'serials') value = p.items.filter((i) => i.serial).length;
    else if (key === 'museum') value = Object.keys(p.collection).length;
    else if (key === 'exhibits') value = exhibits;
    else if (key === 'level') value = p.level;
    else if (key === 'locs') value = locs;
    const op = valStr ?? '>=';
    const ok = op === '<=' ? value <= target : value >= target;
    if (ok) { p.achievements.push(a.id); p.coins += a.reward; p.stats.coinsEarned += a.reward; unlocked.push(a.id); }
  }
  return unlocked;
}

export function levelUp(p: PlayerDoc): number {
  const lvl = levelFromXp(p.xp);
  if (lvl > p.level) { const diff = lvl - p.level; p.level = lvl; return diff; }
  return 0;
}

export function rollDailyReset(p: PlayerDoc): boolean {
  const today = dayKey();
  if (p.daily.day !== today) { p.daily = { day: today, npcSold: 0, npcFull: 0, npcHalf: 0 }; return true; }
  return false;
}

export function recipeById(id: string) { return RECIPES.find((r) => r.id === id) ?? null; }
export function researchById(id: string) { return RESEARCH.find((r) => r.id === id) ?? null; }
