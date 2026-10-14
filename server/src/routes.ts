/**
 * HTTP API. Ключевые принципы:
 *  - клиент никогда не назначает себе редкость, серийный номер или цену;
 *  - фаза 1 (создание попытки) хранит seed и полное расписание рывков только на сервере;
 *  - фаза 2 (мини-игра) авторитетна на сервере, клиент получает лишь ближайший отрезок;
 *  - выдача награды идемпотентна по castId/opId — повторный запрос не создаёт второй предмет.
 */
import crypto from 'node:crypto';
import type { Request, Response, Router } from 'express';
import express from 'express';
import {
  ACHIEVEMENTS, CAST_TYPES, CATEGORY_NAMES, CHAINS, COSMETICS, GEAR, GEAR_BY_ID, ITEMS, ITEM_BY_ID,
  LOCATIONS, MAT_BY_ID, MATERIALS, RARITY, RECIPES, RESEARCH, SEASON, SMUGGLER_POOL, DAY_MS, levelXp, weekIndex,
  type CastType, type Category, type ItemDef, type Rarity,
} from './content.js';
import {
  FightSession, MUTATION_INFO, Rng, activeEvents, checkAchievements, commitmentOf, computeValue, createCast, levelUp,
  marketPrice, museumStats, newSeed, npcPrice, researchById, rollDailyReset, simulateFight, smugglerOffers,
  toInstance, xpFor,
} from './engine.js';
import {
  allocateSerial, createStore, withLock, type KvStore, type SerialRecord,
} from './store.js';
import {
  APP_SHORT_NAME, BOT_TOKEN, BOT_USERNAME, DEV_AUTH, answerPreCheckout, createStarsInvoice, sendPhotoToChat,
  signSession, userFromInitData, validateInitData, verifySession,
} from './tg.js';
import { PHYS, difficultyStars, weightBand } from './physics.js';
import { EMPTY_SLOTS, newPlayer, npcDailyState, publicPlayer, type ItemInstance, type MarketListing, type PlayerDoc } from './types.js';

export const fightSessions = new Map<string, FightSession>();

const NPC_FULL = () => Number(process.env.NPC_FULL_LIMIT ?? 100);
const NPC_HALF = () => Number(process.env.NPC_HALF_LIMIT ?? 100);
const NPC_HALF_MULT = () => Number(process.env.NPC_HALF_MULT ?? 0.5);
const MARKET_FEE = () => Number(process.env.MARKET_FEE ?? 0.05);
const RETURN_DAYS = () => Number(process.env.SERIAL_RETURN_DAYS ?? 60);

interface Ctx { store: KvStore }
type Handler = (req: Request, res: Response) => Promise<unknown> | unknown;

// ─────────────────────────────── утилиты ───────────────────────────────
const rate = new Map<string, { n: number; t: number }>();
function limited(key: string, max: number, winMs: number): boolean {
  const now = Date.now();
  const cur = rate.get(key);
  if (!cur || now - cur.t > winMs) { rate.set(key, { n: 1, t: now }); return false; }
  cur.n++;
  return cur.n > max;
}

function h(fn: Handler): Handler {
  return async (req, res) => {
    try { await fn(req, res); }
    catch (e) {
      const err = e as Error;
      console.error('[api]', req.method, req.path, err.message, err.stack?.split('\n')[1] ?? '');
      if (!res.headersSent) res.status(500).json({ error: 'server_error', message: err.message });
    }
  };
}

function analyzeActions(actions: { a: string; t: number }[]): { suspicious: boolean; reason?: string; actionsPerSec: number } {
  if (actions.length === 0) return { suspicious: true, reason: 'empty_log', actionsPerSec: 0 };
  const span = (actions[actions.length - 1].t - actions[0].t) / 1000;
  const aps = span > 0 ? actions.length / span : actions.length;
  // Человек не может менять состояние 40 раз в секунду на протяжении боя
  if (aps > 12) return { suspicious: true, reason: 'inhuman_rate', actionsPerSec: aps };
  const gaps: number[] = [];
  for (let i = 1; i < actions.length; i++) gaps.push(actions[i].t - actions[i - 1].t);
  if (gaps.length > 6) {
    const mean = gaps.reduce((a, b) => a + b, 0) / gaps.length;
    const dev = Math.sqrt(gaps.reduce((a, b) => a + (b - mean) ** 2, 0) / gaps.length) / Math.max(1, mean);
    if (dev < 0.006) return { suspicious: true, reason: 'machine_uniform', actionsPerSec: aps };
  }
  return { suspicious: false, actionsPerSec: aps };
}

// ─────────────────────────────── серийные предметы ───────────────────────────────
async function serialFor(ctx: Ctx, def: ItemDef): Promise<{ record: SerialRecord } | null> {
  if (!def.serial) return null;
  const all = await ctx.store.list<SerialRecord>('serials', 5000);
  const mine = all.filter((s) => s.itemId === def.id);
  const free = mine.find((s) => s.ownerId === null);
  if (free) return { record: free };
  const alloc = await allocateSerial(ctx.store, def.id, def.serial);
  return alloc ? { record: alloc.record } : mine[0] ? { record: mine[0] } : null;
}

async function sweepSerials(ctx: Ctx): Promise<{ returned: number; warned: number }> {
  const players = await ctx.store.list<PlayerDoc>('players', 5000);
  const byId = new Map(players.map((p) => [p.id, p]));
  const serials = await ctx.store.list<SerialRecord>('serials', 5000);
  const listings = await ctx.store.list<MarketListing>('market', 2000);
  const listed = new Set(listings.filter((l) => l.status === 'active').map((l) => l.item.uid));
  let returned = 0; let warned = 0;
  const now = Date.now();
  for (const s of serials) {
    if (!s.ownerId || !s.circulates) continue;
    const owner = byId.get(s.ownerId);
    if (!owner) continue;
    const idleDays = (now - owner.lastSeen) / DAY_MS;
    if (idleDays < RETURN_DAYS() - 7) continue;
    const item = owner.items.find((i) => i.serial && i.serial.no === s.no && i.itemId === s.itemId);
    if (!item) continue;
    // Предметы на аукционе, в сделке, на базе или защищённые — не изымаются
    if (listed.has(item.uid) || item.placed || owner.circOptOut.includes(item.uid)) continue;
    if (idleDays < RETURN_DAYS()) {
      if (!owner.warnings.some((w) => w.serialUid === item.uid)) {
        owner.warnings.push({ serialUid: item.uid, at: now });
        await ctx.store.put('players', owner.id, owner);
        warned++;
      }
      continue;
    }
    owner.items = owner.items.filter((i) => i.uid !== item.uid);
    owner.warnings = owner.warnings.filter((w) => w.serialUid !== item.uid);
    await ctx.store.put('players', owner.id, owner);
    s.ownerId = null;
    s.lostAt = now;
    s.history.push({ type: 'returned_to_deep', at: now, note: 'Возвращён в пучину: владелец не заходил 60+ дней' });
    await ctx.store.put('serials', `${s.itemId}#${s.no}`, s as any);
    returned++;
  }
  return { returned, warned };
}

// ─────────────────────────────── награда за попытку ───────────────────────────────
async function grantCast(ctx: Ctx, player: PlayerDoc, cast: any, opaqueLog: boolean) {
  const landed = cast.status === 'landed';
  const base = { ok: landed, durationMs: cast.result?.durationMs ?? 0, reason: cast.result?.reason };
  if (cast.granted) return { ...base, rewards: [], alreadyGranted: true, xp: 0 };
  const rewards: ItemInstance[] = [];
  let xp = 0;
  let coinsBonus = 0;
  if (landed) {
    for (const r of cast.reward) {
      const def = ITEM_BY_ID[r.itemId];
      let serialInfo: { no: number; total: number } | undefined;
      if (def.serial) {
        const s = await serialFor(ctx, def);
        if (s) {
          const rec = s.record;
          const prevOwner = rec.ownerId;
          rec.ownerId = player.id;
          rec.lostAt = undefined;
          rec.history.push({
            type: prevOwner ? 'recaught' : 'discovered',
            at: Date.now(),
            from: prevOwner ?? undefined,
            to: player.id,
            note: prevOwner ? 'Утерян прошлым владельцем и выловлен повторно' : 'Первый владелец',
          });
          await ctx.store.put('serials', `${rec.itemId}#${rec.no}`, rec as any);
          serialInfo = { no: rec.no, total: def.serial };
          player.serialHistory[`${def.id}#${rec.no}`] = rec.history;
        }
      }
      const inst = toInstance(cast, r, serialInfo);
      player.items.push(inst);
      rewards.push(inst);
      const col = player.collection[def.id];
      if (!col) player.collection[def.id] = { count: 1, maxW: r.weightG, maxLen: r.lengthCm, firstAt: Date.now(), lastAt: Date.now() };
      else { col.count++; col.maxW = Math.max(col.maxW, r.weightG); col.maxLen = Math.max(col.maxLen, r.lengthCm); col.lastAt = Date.now(); }
      player.stats.byCat[def.cat] = (player.stats.byCat[def.cat] ?? 0) + 1;
      player.stats.byRarity[def.rarity] = (player.stats.byRarity[def.rarity] ?? 0) + 1;
      // Прогресс экспедиционного сезона (временный, не влияет на основную прокачку)
      if (cast.locationId === 'abyss' || cast.locationId === 'alien') {
        if (def.cat === 'fish' || def.cat === 'fantasy') player.season.stats.expCreatures = (player.season.stats.expCreatures ?? 0) + 1;
        if (def.cat === 'tech' || def.cat === 'treasure') player.season.stats.expWrecks = (player.season.stats.expWrecks ?? 0) + 1;
      }
      if (cast.giant) player.season.stats.expGiants = (player.season.stats.expGiants ?? 0) + 1;
      player.stats.coinsEarned += 0;
      xp += xpFor(r.value);
      coinsBonus += Math.max(0, Math.round(r.value * 0.02));
      if (!player.records.heaviest || r.weightG > player.records.heaviest.w) player.records.heaviest = { name: def.name, w: r.weightG };
      const lenTotal = r.lengthCm;
      if (!player.records.longest || lenTotal > player.records.longest.len) player.records.longest = { name: def.name, len: lenTotal };
      if (!player.records.mostValuable || r.value > player.records.mostValuable.value) player.records.mostValuable = { name: def.name, value: r.value };
      advanceChain(player, def.id);
    }
    player.stats.lands++;
    if (cast.giant) player.stats.giants++;
    if (cast.reward.length > 1) player.stats.doubles++;
  } else {
    if (cast.result?.reason === 'break') player.stats.breaks++;
    if (cast.result?.reason === 'slip') player.stats.slips++;
    xp += 1;
  }
  player.xp += xp;
  player.coins += coinsBonus;
  player.stats.casts = player.stats.casts;
  levelUp(player);
  const unlocked = checkAchievements(player);
  cast.granted = true;
  cast.grantedAt = Date.now();
  await ctx.store.put('casts', cast.id, cast);
  await ctx.store.put('players', player.id, player);
  return { ...base, rewards: rewards.map(serializeItem), xp, coinsBonus, unlocked, failedValidation: opaqueLog, player: publicPlayer(player) };
}

function advanceChain(p: PlayerDoc, itemId: string) {
  for (const chain of CHAINS) {
    const step = chain.steps[p.chains[chain.id]?.step ?? 0];
    if (!step || step.need !== itemId) continue;
    const st = p.chains[chain.id] ?? { step: 0, items: [], done: false, startedAt: Date.now() };
    st.items.push(itemId);
    st.step++;
    st.done = st.step >= chain.steps.length;
    p.chains[chain.id] = st;
    for (const [mat, qty] of step.reward) {
      const def = ITEM_BY_ID[mat];
      if (def) {
        // Награда цепочки — предмет в инвентарь с минимальным весом
        p.items.push({
          uid: crypto.randomUUID(), itemId: mat, rarity: def.rarity, cat: def.cat,
          weightG: def.w[0], lengthCm: def.len[0], condition: 1, mutation: 'pristine',
          history: [{ type: 'chain', at: Date.now(), note: `Награда цепочки «${chain.name}»` }],
          caughtAt: Date.now(), caughtIn: 'chain', value: def.price,
        } as ItemInstance);
      } else if (MAT_BY_ID[mat]) {
        p.supplies[mat] = (p.supplies[mat] ?? 0) + qty;
      }
    }
  }
}

function serializeItem(i: ItemInstance) {
  return { ...i, def: ITEM_BY_ID[i.itemId], mutationInfo: MUTATION_INFO[i.mutation] };
}

/** Класс размера экспоната определяется фактическим весом экземпляра. */
export function itemSize(weightG: number): 'small' | 'medium' | 'large' | 'huge' {
  if (weightG > 200_000) return 'huge';
  if (weightG > 20_000) return 'large';
  if (weightG > 1_000) return 'medium';
  return 'small';
}

// ─────────────────────────────── сборка роутера ───────────────────────────────
export function createApi(ctx: Ctx): Router {
  const api = express.Router();

  // ── health ──
  api.get('/health', h(async (_req, res) => {
    const dbConfigured = !!process.env.DATABASE_URL?.trim();
    const postgres = ctx.store.kind === 'postgres';
    res.json({
      ok: true,
      store: ctx.store.kind,
      db: await ctx.store.health(),
      dbConfigured,
      storage: postgres ? 'postgres' : dbConfigured ? 'file-fallback (DATABASE_URL не сработал)' : 'file (DATABASE_URL не задан)',
      warning: !postgres && dbConfigured
        ? 'PostgreSQL недоступен: игра работает, но прогресс не сохранится между деплоями. Смотрите логи сервиса.'
        : undefined,
      uptime: Math.round(process.uptime()),
      version: '1.0.0',
    });
  }));

  // ── авторизация ──
  api.post('/auth', h(async (req, res) => {
    const initData: string = req.body?.initData ?? req.get('x-af-initdata') ?? '';
    const devId: string | undefined = req.body?.devId;
    let playerId: string | null = null;
    let user: { id: string; name: string; username?: string; photoUrl?: string } | null = null;

    if (initData && BOT_TOKEN()) {
      const v = validateInitData(initData, BOT_TOKEN());
      if (!v.ok) return res.status(401).json({ error: 'invalid_init_data', reason: v.reason });
      user = userFromInitData(initData);
      if (!user) return res.status(401).json({ error: 'no_user' });
      playerId = `tg:${user.id}`;
    } else if (DEV_AUTH()) {
      const id = String(devId || req.body?.userId || 'local-dev');
      playerId = `dev:${id}`;
      user = { id, name: req.body?.name || 'Тестовый рыбак', username: 'dev' };
    } else {
      return res.status(401).json({ error: 'unauthorized', hint: 'Откройте приложение внутри Telegram' });
    }

    const player = await withLock(`player:${playerId}`, async () => {
      let p = await ctx.store.get<PlayerDoc>('players', playerId!);
      const now = Date.now();
      if (!p) {
        p = newPlayer(playerId!, user!.name, user!.username);
        await ctx.store.put('players', playerId!, p);
      }
      p.lastSeen = now;
      if (user?.name) p.name = user.name;
      if (user?.username) p.username = user.username;
      if (user?.photoUrl) p.photoUrl = user.photoUrl;
      rollDailyReset(p);
      await ctx.store.put('players', playerId!, p);
      return p;
    });
    res.json({ token: signSession(player.id, SESSION_SECRET_ENV()), player: publicPlayer(player), botUsername: BOT_USERNAME(), appShortName: APP_SHORT_NAME() });
  }));

  // ── middleware авторизации ──
  const auth: any = async (req: any, res: any, next: any) => {
    const token = (req.get('authorization')?.replace(/^Bearer\s+/i, '') || req.get('x-af-session') || req.query.t as string || '').trim();
    let playerId: string | null = token ? verifySession(token, SESSION_SECRET_ENV()) : null;
    if (!playerId) {
      const initData = req.get('x-af-initdata') ?? '';
      if (initData && BOT_TOKEN()) {
        const v = validateInitData(initData, BOT_TOKEN());
        if (v.ok) { const u = userFromInitData(initData); if (u) playerId = `tg:${u.id}`; }
      }
    }
    if (!playerId && DEV_AUTH()) playerId = `dev:${(req.get('x-af-dev') || 'local-dev')}`;
    if (!playerId) return res.status(401).json({ error: 'unauthorized' });
    const player = await ctx.store.get<PlayerDoc>('players', playerId);
    if (!player) return res.status(404).json({ error: 'player_not_found' });
    (req as any).player = player;
    next();
  };

  const P = (req: Request): PlayerDoc => (req as any).player;

  // ── контент ──
  api.get('/content', h(async (_req, res) => {
    res.json({
      items: ITEMS, locations: LOCATIONS, gear: GEAR, materials: MATERIALS, recipes: RECIPES, research: RESEARCH,
      cosmetics: COSMETICS, season: SEASON, smuggler: smugglerOffers(), rarity: RARITY, castTypes: CAST_TYPES,
      categories: CATEGORY_NAMES, mutations: MUTATION_INFO, achievements: ACHIEVEMENTS, chains: CHAINS,
      activeEvents: activeEvents(),
      physics: { idealMin: PHYS.IDEAL_MIN, idealMax: PHYS.IDEAL_MAX, slackLimit: PHYS.SLACK_LIMIT, tick: PHYS.TICK },
      config: { npcFull: NPC_FULL(), npcHalf: NPC_HALF(), npcHalfMult: NPC_HALF_MULT(), marketFee: MARKET_FEE(), serialReturnDays: RETURN_DAYS(), starsEnabled: process.env.STARS_ENABLED !== '0' },
    });
  }));

  api.get('/me', auth, h(async (req, res) => {
    const p = P(req);
    rollDailyReset(p);
    await ctx.store.put('players', p.id, p);
    res.json({ player: publicPlayer(p) });
  }));

  // ── ФАЗА 1: подготовка поклёвки ──
  api.post('/cast', auth, h(async (req, res) => {
    const p = P(req);
    if (limited(`cast:${p.id}`, 30, 60_000)) return res.status(429).json({ error: 'rate_limited', message: 'Слишком много забросов. Подождите немного.' });
    const locationId = String(req.body?.locationId ?? 'lake');
    const castType = String(req.body?.castType ?? 'normal') as CastType;
    const loc = LOCATIONS.find((l) => l.id === locationId);
    if (!loc) return res.status(400).json({ error: 'no_location' });
    if (!p.locations.includes(loc.id)) return res.status(403).json({ error: 'location_locked' });
    const boat = GEAR_BY_ID[p.loadout.boat];
    const device = GEAR_BY_ID[p.loadout.device];
    const maxDepth = Math.max(boat?.access?.depth ?? 2, device?.access?.depth ?? 2);
    const castDepth = CAST_TYPES[castType]?.depth ?? 0;
    if (castDepth > maxDepth) return res.status(403).json({ error: 'depth_locked', message: 'Для такого заброса нужно лучшее снаряжение (лодка или прибор).' });
    const baitDef = GEAR_BY_ID[p.loadout.bait];
    if (baitDef?.consumable) {
      const have = p.supplies[baitDef.id] ?? 0;
      if (have <= 0) return res.status(400).json({ error: 'no_bait', message: `Наживка «${baitDef.name}» закончилась.` });
      p.supplies[baitDef.id] = have - 1;
    }
    const cast = createCast(p, locationId, castType);
    p.stats.casts++;
    // Прогресс экспедиционного сезона: забросы в глубинных зонах
    if (locationId === 'abyss' || locationId === 'alien' || castType === 'deep') {
      p.season.stats.expCasts = (p.season.stats.expCasts ?? 0) + 1;
    }
    p.lastSeen = Date.now();
    await ctx.store.put('casts', cast.id, cast as any);
    await ctx.store.put('players', p.id, p);
    const main = cast.reward[0];
    const def = ITEM_BY_ID[main.itemId];
    res.json({
      castId: cast.id,
      commitment: cast.commitment,
      expiresAt: cast.expiresAt,
      // Секрет (seed, полное расписание) не уходит. Только то, что видно на воде.
      hints: {
        tells: cast.tells,
        silhouetteWidth: Math.round(cast.width * 100) / 100,
        difficulty: difficultyStars(cast.params),
        weightBand: weightBand(main.weightG),
        giant: cast.giant,
        category: cast.giant ? 'giant' : undefined,
        depth: cast.params.depth,
        maxLoad: cast.params.maxLoad,
        load: Math.round((cast.params.strength / Math.max(0.5, cast.params.maxLoad)) * 100) / 100,
        segments: undefined,
        rewardCount: cast.reward.length,
      },
      params: {
        idealMin: PHYS.IDEAL_MIN, idealMax: PHYS.IDEAL_MAX, tick: PHYS.TICK, maxMs: PHYS.MAX_MS,
        control: Math.round(cast.params.control * 100) / 100, speed: Math.round(cast.params.speed * 100) / 100,
      },
      bait: baitDef && !baitDef.consumable ? undefined : { id: baitDef?.id, left: p.supplies[baitDef?.id ?? ''] ?? 0 },
      rarityTease: def.rarity === 'secret' ? 'secret' : undefined,
    });
  }));

  // ── ФАЗА 2 (HTTP-режим): действия и состояние ──
  api.post('/cast/:id/action', auth, h(async (req, res) => {
    const p = P(req);
    const cast = await ctx.store.get<any>('casts', req.params.id);
    if (!cast || cast.playerId !== p.id) return res.status(404).json({ error: 'no_cast' });
    if (cast.status === 'landed' || cast.status === 'broken' || cast.status === 'lost') return res.json({ state: cast.lastState ?? null, done: true });
    const key = `fight:${cast.id}`;
    let session = fightSessions.get(key);
    if (!session) { session = new FightSession(cast.params, cast.seed, cast.id); fightSessions.set(key, session); cast.status = 'active'; await ctx.store.put('casts', cast.id, cast); }
    const a = String(req.body?.a ?? 'REEL') === 'RELEASE' ? 'RELEASE' : 'REEL';
    session.action(a as 'REEL' | 'RELEASE');
    const elapsed = Date.now() - session.startedAt;
    session.advance(elapsed);
    const state = session.state();
    cast.actions = session.actions;
    cast.lastState = state;
    if (session.outcome) {
      cast.status = session.outcome === 'land' ? 'landed' : session.outcome === 'break' ? 'broken' : session.outcome === 'slip' ? 'lost' : 'expired';
      cast.result = { ok: session.outcome === 'land', reason: session.outcome as any, durationMs: session.core.t, rewards: [], coinsBonus: 0, xp: 0, details: undefined };
      cast.coreFinal = session.core;
      await ctx.store.put('casts', cast.id, cast);
    } else {
      await ctx.store.put('casts', cast.id, cast);
    }
    res.json({ state, done: !!session.outcome, outcome: session.outcome });
  }));

  api.get('/cast/:id/state', auth, h(async (req, res) => {
    const p = P(req);
    const cast = await ctx.store.get<any>('casts', req.params.id);
    if (!cast || cast.playerId !== p.id) return res.status(404).json({ error: 'no_cast' });
    const session = fightSessions.get(`fight:${cast.id}`);
    if (session) {
      session.advance(Date.now() - session.startedAt);
      const st = session.state();
      return res.json({ state: st, done: !!session.outcome, outcome: session.outcome });
    }
    res.json({ state: cast.lastState ?? null, done: cast.status !== 'active' && cast.status !== 'pending', outcome: cast.result?.reason ?? (cast.status === 'landed' ? 'land' : null) });
  }));

  // ── ФАЗА 3-4: проверка журнала действий и выдача награды (идемпотентно) ──
  api.post('/cast/:id/resolve', auth, h(async (req, res) => {
    const p = P(req);
    const result = await withLock(`resolve:${req.params.id}`, async () => {
      const cast = await ctx.store.get<any>('casts', req.params.id);
      if (!cast || cast.playerId !== p.id) return { code: 404, body: { error: 'no_cast' } };
      if (cast.granted) return { code: 200, body: { ok: cast.status === 'landed', rewards: [], alreadyGranted: true, player: publicPlayer(p) } };
      if (cast.expiresAt && Date.now() > cast.expiresAt && cast.status !== 'landed') {
        cast.status = 'expired';
        await ctx.store.put('casts', cast.id, cast);
        return { code: 410, body: { error: 'expired' } };
      }
      const session = fightSessions.get(`fight:${cast.id}`);
      const clientLog: { a: 'REEL' | 'RELEASE'; t: number }[] = Array.isArray(req.body?.actions) ? req.body.actions.slice(0, 400) : [];
      let outcome: string | null = null;
      let durationMs = 0;
      let coreFinal: any = null;
      let flagged = false;

      if (session) {
        // Авторитетный режим: сервер сам решал исход. Журнал клиента нужен только для аудита.
        outcome = session.outcome;
        durationMs = session.core.t;
        coreFinal = session.core;
        if (clientLog.length > 3) {
          const sim = simulateFight(cast.params, cast.seed, clientLog.map((a) => ({ a: a.a, t: Number(a.t) || 0, dt: 0 })));
          if (sim.outcome !== session.outcome) { flagged = true; console.warn('[anti-cheat] log mismatch', cast.id, sim.outcome, session.outcome); }
        }
      } else {
        // Резервный режим (WebSocket недоступен): повторяем бой по журналу действий.
        const sorted = clientLog.map((a) => ({ a: a.a === 'RELEASE' ? 'RELEASE' as const : 'REEL' as const, t: Number(a.t) || 0, dt: 0 })).sort((a, b) => a.t - b.t);
        const sim = simulateFight(cast.params, cast.seed, sorted);
        outcome = sim.outcome;
        durationMs = sim.core.t;
        coreFinal = sim.core;
        const an = analyzeActions(sorted);
        flagged = an.suspicious;
      }
      if (!outcome) return { code: 409, body: { error: 'fight_not_finished' } };
      cast.status = outcome === 'land' ? 'landed' : outcome === 'break' ? 'broken' : outcome === 'slip' ? 'lost' : 'expired';
      cast.result = { ok: outcome === 'land', reason: outcome, durationMs, rewards: [], coinsBonus: 0, xp: 0 };
      cast.coreFinal = coreFinal;
      cast.flagged = flagged;
      fightSessions.delete(`fight:${cast.id}`);
      const granted = await grantCast(ctx, p, cast, flagged);
      return { code: 200, body: granted };
    });
    res.status(result.code).json(result.body);
  }));

  // ── торговля с NPC + дневной лимит ──
  api.get('/npc', auth, h(async (req, res) => {
    const p = P(req);
    rollDailyReset(p);
    await ctx.store.put('players', p.id, p);
    res.json({ daily: npcDailyState(p, NPC_FULL(), NPC_HALF(), NPC_HALF_MULT()) });
  }));

  api.post('/sell/npc', auth, h(async (req, res) => {
    const p = P(req);
    const opId = String(req.body?.opId ?? '');
    if (opId) { const prev = await ctx.store.get<any>('idem', `sell:${p.id}:${opId}`); if (prev) return res.json({ ...prev, duplicate: true }); }
    const uids: string[] = Array.isArray(req.body?.uids) ? req.body.uids.slice(0, 200) : [];
    rollDailyReset(p);
    const out: { uid: string; name: string; price: number; rarity: string }[] = [];
    const refused: { uid: string; reason: string }[] = [];
    let soldCount = p.daily.npcSold;
    for (const uid of uids) {
      const item = p.items.find((i) => i.uid === uid);
      if (!item) { refused.push({ uid, reason: 'not_found' }); continue; }
      const def = ITEM_BY_ID[item.itemId];
      if (item.serial) { refused.push({ uid, reason: 'Серийный экземпляр нельзя сдать торговцу' }); continue; }
      if (item.protectedFlag) { refused.push({ uid, reason: 'Экземпляр защищён' }); continue; }
      if (item.placed) { refused.push({ uid, reason: 'Экспонат выставлен на базе' }); continue; }
      if (def.rarity === 'epic' || def.rarity === 'legendary' || def.rarity === 'mythic' || def.rarity === 'secret') {
        refused.push({ uid, reason: 'Торговец не берёт предметы такой редкости — используйте рынок игроков' });
        continue;
      }
      const fullLeft = Math.max(0, NPC_FULL() - soldCount);
      const halfLeft = soldCount < NPC_FULL() ? NPC_HALF() : Math.max(0, NPC_FULL() + NPC_HALF() - soldCount);
      if (fullLeft <= 0 && halfLeft <= 0) { refused.push({ uid, reason: 'Дневной лимит торговца исчерпан' }); continue; }
      const mult = fullLeft > 0 ? 1 : NPC_HALF_MULT();
      const loc = LOCATIONS.find((l) => l.id === item.caughtIn);
      const price = npcPrice(item.value, loc?.npcMult ?? 1, mult, item.condition);
      p.items = p.items.filter((i) => i.uid !== uid);
      p.coins += price;
      p.stats.coinsEarned += price;
      p.stats.sold++;
      soldCount++;
      if (mult === 1) p.daily.npcFull++; else p.daily.npcHalf++;
      out.push({ uid, name: def.name, price, rarity: def.rarity });
    }
    p.daily.npcSold = soldCount;
    p.daily.day = p.daily.day || new Date().toISOString().slice(0, 10);
    levelUp(p);
    const unlocked = checkAchievements(p);
    await ctx.store.put('players', p.id, p);
    const body = { sold: out, refused, total: out.reduce((n, x) => n + x.price, 0), daily: npcDailyState(p, NPC_FULL(), NPC_HALF(), NPC_HALF_MULT()), unlocked, player: publicPlayer(p) };
    if (opId) await ctx.store.put('idem', `sell:${p.id}:${opId}`, body as any);
    res.json(body);
  }));

  // ── переработка, ремонт, крафт, исследование ──
  api.post('/salvage', auth, h(async (req, res) => {
    const p = P(req);
    const uids: string[] = Array.isArray(req.body?.uids) ? req.body.uids.slice(0, 100) : [];
    const got: Record<string, number> = {};
    const refused: { uid: string; reason: string }[] = [];
    const all = ITEMS;
    for (const uid of uids) {
      const item = p.items.find((i) => i.uid === uid);
      if (!item) { refused.push({ uid, reason: 'not_found' }); continue; }
      if (item.serial) { refused.push({ uid, reason: 'Серийные экземпляры нельзя разбирать' }); continue; }
      if (item.protectedFlag || item.placed) { refused.push({ uid, reason: 'Экземпляр защищён или выставлен на базе' }); continue; }
      const def = ITEM_BY_ID[item.itemId];
      if (def.cat === 'fish') { refused.push({ uid, reason: 'Рыбу не разбирают — её продают или выставляют' }); continue; }
      const salvage = def.salvage ?? [['mat_metal', 1] as [string, number]];
      // Ремонт/разбор увеличивает выход материалов в зависимости от состояния
      for (const [mat, qty] of salvage) {
        const n = Math.max(1, Math.round(qty * (0.6 + 0.8 * item.condition)));
        p.supplies[mat] = (p.supplies[mat] ?? 0) + n;
        got[mat] = (got[mat] ?? 0) + n;
      }
      p.items = p.items.filter((i) => i.uid !== uid);
    }
    await ctx.store.put('players', p.id, p);
    res.json({ got, refused, player: publicPlayer(p) });
  }));

  api.post('/research', auth, h(async (req, res) => {
    const p = P(req);
    const researchId = String(req.body?.researchId ?? '');
    const r = researchById(researchId);
    if (!r) return res.status(400).json({ error: 'no_research' });
    const used: string[] = [];
    for (const itemId of r.need) {
      const idx = p.items.findIndex((i) => i.itemId === itemId && !i.placed);
      if (idx < 0) return res.status(400).json({ error: 'missing_item', itemId, message: 'Не хватает предмета для исследования' });
      used.push(p.items[idx].uid);
      p.items.splice(idx, 1);
    }
    for (const [mat, qty] of r.out) p.supplies[mat] = (p.supplies[mat] ?? 0) + qty;
    const body: any = { out: r.out, unlock: r.unlock, unlockedGear: [] as string[] };
    if (r.unlock?.startsWith('device_') || GEAR_BY_ID[r.unlock!]) {
      if (!p.ownedGear.includes(r.unlock!)) { p.ownedGear.push(r.unlock!); body.unlockedGear.push(r.unlock!); }
    }
    if (r.unlock?.startsWith('chain:')) {
      const chain = r.unlock.slice(6);
      p.chains[chain] = p.chains[chain] ?? { step: 0, items: [], done: false, startedAt: Date.now() };
      body.chainOpened = chain;
    }
    const unlocked = checkAchievements(p);
    await ctx.store.put('players', p.id, p);
    res.json({ ...body, unlocked, player: publicPlayer(p) });
  }));

  api.post('/craft', auth, h(async (req, res) => {
    const p = P(req);
    const opId = String(req.body?.opId ?? '');
    if (opId) { const prev = await ctx.store.get<any>('idem', `craft:${p.id}:${opId}`); if (prev) return res.json({ ...prev, duplicate: true }); }
    const recipe = RECIPES.find((x) => x.id === String(req.body?.recipeId ?? ''));
    if (!recipe) return res.status(400).json({ error: 'no_recipe' });
    if (p.level < recipe.level) return res.status(403).json({ error: 'level', message: `Нужен ${recipe.level} уровень` });
    if (p.coins < recipe.cost) return res.status(400).json({ error: 'coins', message: 'Недостаточно монет' });
    for (const [mat, qty] of recipe.need) if ((p.supplies[mat] ?? 0) < qty) return res.status(400).json({ error: 'materials', mat, message: `Не хватает материала: ${MAT_BY_ID[mat]?.name ?? mat}` });
    for (const [mat, qty] of recipe.need) p.supplies[mat] -= qty;
    p.coins -= recipe.cost;
    p.stats.coinsSpent += recipe.cost;
    if (recipe.kind === 'gear') { if (!p.ownedGear.includes(recipe.out)) p.ownedGear.push(recipe.out); }
    else p.supplies[recipe.out] = (p.supplies[recipe.out] ?? 0) + recipe.qty;
    levelUp(p);
    const unlocked = checkAchievements(p);
    await ctx.store.put('players', p.id, p);
    const body = { ok: true, crafted: recipe.out, qty: recipe.qty, unlocked, player: publicPlayer(p) };
    if (opId) await ctx.store.put('idem', `craft:${p.id}:${opId}`, body as any);
    res.json(body);
  }));

  api.post('/equip', auth, h(async (req, res) => {
    const p = P(req);
    const slot = String(req.body?.slot ?? '');
    const id = String(req.body?.id ?? '');
    const g = GEAR_BY_ID[id];
    if (!g || g.slot !== slot) return res.status(400).json({ error: 'bad_gear' });
    if (!p.ownedGear.includes(id)) return res.status(403).json({ error: 'not_owned' });
    p.loadout[slot] = id;
    await ctx.store.put('players', p.id, p);
    res.json({ ok: true, loadout: p.loadout });
  }));

  api.post('/shop/buy', auth, h(async (req, res) => {
    const p = P(req);
    const opId = String(req.body?.opId ?? '');
    if (opId) { const prev = await ctx.store.get<any>('idem', `buy:${p.id}:${opId}`); if (prev) return res.json({ ...prev, duplicate: true }); }
    const id = String(req.body?.gearId ?? req.body?.id ?? '');
    const qty = Math.max(1, Math.min(99, Number(req.body?.qty ?? 1)));
    const g = GEAR_BY_ID[id];
    if (!g) return res.status(400).json({ error: 'no_gear' });
    if (p.level < g.level) return res.status(403).json({ error: 'level', message: `Нужен ${g.level} уровень` });
    if (g.starsOnly) return res.status(403).json({ error: 'stars_only' });
    const cost = g.price * (g.consumable ? qty : 1);
    if (p.coins < cost) return res.status(400).json({ error: 'coins', message: 'Недостаточно монет' });
    p.coins -= cost;
    p.stats.coinsSpent += cost;
    if (g.consumable) p.supplies[id] = (p.supplies[id] ?? 0) + qty;
    else if (!p.ownedGear.includes(id)) p.ownedGear.push(id);
    await ctx.store.put('players', p.id, p);
    const body = { ok: true, bought: id, qty: g.consumable ? qty : 1, player: publicPlayer(p) };
    if (opId) await ctx.store.put('idem', `buy:${p.id}:${opId}`, body as any);
    res.json(body);
  }));

  api.post('/shop/sell-materials', auth, h(async (req, res) => {
    const p = P(req);
    const matId = String(req.body?.matId ?? '');
    const qty = Math.max(1, Number(req.body?.qty ?? 1));
    const m = MAT_BY_ID[matId];
    if (!m) return res.status(400).json({ error: 'no_material' });
    if ((p.supplies[matId] ?? 0) < qty) return res.status(400).json({ error: 'not_enough' });
    p.supplies[matId] -= qty;
    const gained = Math.round(m.price * qty * 0.8);
    p.coins += gained;
    p.stats.coinsEarned += gained;
    await ctx.store.put('players', p.id, p);
    res.json({ ok: true, gained, player: publicPlayer(p) });
  }));

  // ── локации ──
  api.post('/location/open', auth, h(async (req, res) => {
    const p = P(req);
    const id = String(req.body?.id ?? '');
    const loc = LOCATIONS.find((l) => l.id === id);
    if (!loc) return res.status(400).json({ error: 'no_location' });
    if (p.locations.includes(id)) return res.json({ ok: true, already: true });
    if (p.level < loc.level) return res.status(403).json({ error: 'level', message: `Нужен ${loc.level} уровень` });
    if (p.coins < loc.cost) return res.status(400).json({ error: 'coins', message: `Нужно ${loc.cost} монет` });
    p.coins -= loc.cost;
    p.stats.coinsSpent += loc.cost;
    p.locations.push(id);
    const unlocked = checkAchievements(p);
    await ctx.store.put('players', p.id, p);
    res.json({ ok: true, location: id, unlocked, player: publicPlayer(p) });
  }));

  // ── рынок игроков / аукцион ──
  api.get('/market', h(async (_req, res) => {
    const listings = await ctx.store.list<MarketListing>('market', 300);
    const active = listings.filter((l) => l.status === 'active');
    // Ленивое закрытие аукционов
    const now = Date.now();
    for (const l of active.filter((x) => x.kind === 'auction' && (x.endsAt ?? 0) < now)) {
      if (l.topBid) {
        const buyer = await ctx.store.get<PlayerDoc>('players', l.topBid.bidderId);
        const seller = await ctx.store.get<PlayerDoc>('players', l.sellerId);
        if (buyer && seller && buyer.coins >= l.topBid.amount) {
          buyer.coins -= l.topBid.amount;
          seller.coins += Math.round(l.topBid.amount * (1 - MARKET_FEE()));
          const item = { ...l.item, history: [...l.item.history, { type: 'auction_sold', at: now, to: buyer.id, note: `Продано на аукционе за ${l.topBid.amount}` }] };
          buyer.items.push(item);
          l.status = 'sold';
          await ctx.store.put('players', buyer.id, buyer);
          await ctx.store.put('players', seller.id, seller);
          await ctx.store.put('market', l.id, l as any);
        }
      } else { l.status = 'cancelled'; await ctx.store.put('market', l.id, l as any); }
    }
    const supply = new Map<string, number>();
    for (const l of active) supply.set(l.item.itemId, (supply.get(l.item.itemId) ?? 0) + 1);
    const prices = ITEMS.filter((i) => RARITY[i.rarity].order >= 4).slice(0, 200).map((i) => ({
      itemId: i.id, name: i.name, rarity: i.rarity, base: i.price,
      market: marketPrice(i, supply.get(i.id) ?? 0, 0), supply: supply.get(i.id) ?? 0,
    }));
    res.json({ listings: active.map((l) => ({ ...l, item: serializeItem(l.item) })), prices, fee: MARKET_FEE() });
  }));

  api.post('/market/list', auth, h(async (req, res) => {
    const p = P(req);
    const uid = String(req.body?.uid ?? '');
    const price = Math.max(1, Math.min(50_000_000, Math.round(Number(req.body?.price ?? 0))));
    const kind = req.body?.kind === 'auction' ? 'auction' : 'market';
    const hours = Math.max(1, Math.min(72, Number(req.body?.hours ?? 12)));
    const item = p.items.find((i) => i.uid === uid);
    if (!item) return res.status(404).json({ error: 'no_item' });
    if (item.placed) return res.status(400).json({ error: 'placed' });
    if (item.serial && !req.body?.confirm) return res.status(409).json({ error: 'confirm_serial', message: 'Это серийный экземпляр. Требуется отдельное подтверждение продажи.' });
    if (!price) return res.status(400).json({ error: 'no_price' });
    const fee = Math.max(1, Math.round(price * MARKET_FEE()));
    if (p.coins < fee) return res.status(400).json({ error: 'coins', message: 'Не хватает монет на комиссию рынка' });
    p.coins -= fee;
    p.stats.coinsSpent += fee;
    p.items = p.items.filter((i) => i.uid !== uid);
    const listing: MarketListing = {
      id: crypto.randomUUID(), sellerId: p.id, sellerName: p.name, item: { ...item, history: [...item.history, { type: 'listed', at: Date.now(), note: `Выставлено за ${price}` }] },
      price, kind, createdAt: Date.now(), endsAt: kind === 'auction' ? Date.now() + hours * 3600_000 : undefined, status: 'active',
    };
    await ctx.store.put('market', listing.id, listing as any);
    await ctx.store.put('players', p.id, p);
    res.json({ ok: true, listing: { ...listing, item: serializeItem(listing.item) }, fee, player: publicPlayer(p) });
  }));

  api.post('/market/buy', auth, h(async (req, res) => {
    const p = P(req);
    const listingId = String(req.body?.listingId ?? '');
    const out = await withLock(`market:${listingId}`, async () => {
      const l = await ctx.store.get<MarketListing>('market', listingId);
      if (!l || l.status !== 'active') return { code: 404, body: { error: 'no_listing' } };
      if (l.sellerId === p.id) return { code: 400, body: { error: 'own_listing' } };
      if (l.kind === 'auction') return { code: 400, body: { error: 'auction_bid_only' } };
      if (p.coins < l.price) return { code: 400, body: { error: 'coins', message: 'Недостаточно монет' } };
      const seller = await ctx.store.get<PlayerDoc>('players', l.sellerId);
      p.coins -= l.price;
      p.stats.coinsSpent += l.price;
      p.items.push({ ...l.item, history: [...l.item.history, { type: 'bought', at: Date.now(), from: l.sellerId, note: `Куплено за ${l.price}` }] });
      if (seller) { const net = Math.round(l.price * (1 - MARKET_FEE())); seller.coins += net; seller.stats.coinsEarned += net; await ctx.store.put('players', seller.id, seller); }
      l.status = 'sold';
      await ctx.store.put('market', l.id, l as any);
      await ctx.store.put('players', p.id, p);
      return { code: 200, body: { ok: true, item: serializeItem(l.item), player: publicPlayer(p) } };
    });
    res.status(out.code).json(out.body);
  }));

  api.post('/market/bid', auth, h(async (req, res) => {
    const p = P(req);
    const listingId = String(req.body?.listingId ?? '');
    const amount = Math.round(Number(req.body?.amount ?? 0));
    const l = await ctx.store.get<MarketListing>('market', listingId);
    if (!l || l.status !== 'active') return res.status(404).json({ error: 'no_listing' });
    if (l.kind !== 'auction') return res.status(400).json({ error: 'not_auction' });
    if (l.sellerId === p.id) return res.status(400).json({ error: 'own_listing' });
    if ((l.endsAt ?? 0) < Date.now()) return res.status(410).json({ error: 'ended' });
    const min = Math.max(l.price, Math.round((l.topBid?.amount ?? l.price * 0.9) * 1.05));
    if (amount < min) return res.status(400).json({ error: 'low_bid', min });
    if (p.coins < amount) return res.status(400).json({ error: 'coins' });
    // Возврат предыдущей ставки
    if (l.topBid) {
      const prev = await ctx.store.get<PlayerDoc>('players', l.topBid.bidderId);
      if (prev) { prev.coins += l.topBid.amount; await ctx.store.put('players', prev.id, prev); }
    }
    p.coins -= amount;
    l.topBid = { bidderId: p.id, bidderName: p.name, amount, at: Date.now() };
    await ctx.store.put('market', l.id, l as any);
    await ctx.store.put('players', p.id, p);
    res.json({ ok: true, listing: { ...l, item: serializeItem(l.item) }, player: publicPlayer(p) });
  }));

  api.post('/market/cancel', auth, h(async (req, res) => {
    const p = P(req);
    const l = await ctx.store.get<MarketListing>('market', String(req.body?.listingId ?? ''));
    if (!l || l.status !== 'active') return res.status(404).json({ error: 'no_listing' });
    if (l.sellerId !== p.id) return res.status(403).json({ error: 'not_owner' });
    if (l.topBid) return res.status(400).json({ error: 'has_bid', message: 'На лот уже сделана ставка' });
    l.status = 'cancelled';
    p.items.push(l.item);
    await ctx.store.put('market', l.id, l as any);
    await ctx.store.put('players', p.id, p);
    res.json({ ok: true, player: publicPlayer(p) });
  }));

  // ── база, выставка, рейтинг ──
  api.post('/base', auth, h(async (req, res) => {
    const p = P(req);
    if (typeof req.body?.name === 'string' && req.body.name.trim()) p.base.name = req.body.name.trim().slice(0, 32);
    if (typeof req.body?.theme === 'string') {
      const cos = COSMETICS.find((c) => c.id === req.body.theme && c.kind === 'base_theme');
      if (cos && !p.cosmetics.includes(cos.id)) return res.status(403).json({ error: 'theme_not_owned' });
      p.base.theme = req.body.theme;
    }
    if (req.body?.slot !== undefined) {
      const slotId = String(req.body.slot);
      const uid = req.body.uid ? String(req.body.uid) : null;
      const slot = p.base.slots.find((s) => s.slot === slotId);
      if (!slot) return res.status(400).json({ error: 'no_slot' });
      if (uid) {
        const item = p.items.find((i) => i.uid === uid);
        if (!item) return res.status(404).json({ error: 'no_item' });
        const def = ITEM_BY_ID[item.itemId];
        const size = itemSize(item.weightG);
        const fits = slot.size === 'huge' ? true
          : slot.size === 'large' ? size !== 'huge'
            : slot.size === 'medium' ? (size === 'small' || size === 'medium')
              : size === 'small';
        if (!fits) return res.status(400).json({ error: 'too_big', message: `«${slot.label}» не подходит для экспоната такого размера (${def.name}, ${Math.round(item.weightG / 1000)} кг). Нужна площадка для крупных находок.` });
        for (const s of p.base.slots) if (s.itemUid === uid) s.itemUid = null;
        slot.itemUid = uid;
        item.placed = slotId;
        item.protectedFlag = true;
      } else {
        if (slot.itemUid) {
          const item = p.items.find((i) => i.uid === slot.itemUid);
          if (item) { item.placed = undefined; if (!item.serial) item.protectedFlag = false; }
        }
        slot.itemUid = null;
      }
      // Уровень базы = количество экспонатов
      p.base.level = Math.max(1, p.base.slots.filter((s) => s.itemUid).length);
    }
    const unlocked = checkAchievements(p);
    await ctx.store.put('players', p.id, p);
    res.json({ ok: true, base: p.base, unlocked, player: publicPlayer(p) });
  }));

  api.get('/base/:id', h(async (req, res) => {
    const target = await ctx.store.get<PlayerDoc>('players', req.params.id);
    if (!target) return res.status(404).json({ error: 'not_found' });
    target.base.visitors++;
    await ctx.store.put('players', target.id, target);
    const exhibits = target.base.slots.filter((s) => s.itemUid).map((s) => {
      const item = target.items.find((i) => i.uid === s.itemUid);
      return item ? { slot: s.slot, label: s.label, item: serializeItem(item) } : null;
    }).filter(Boolean);
    res.json({
      base: { ...target.base, ownerName: target.name, ownerLevel: target.level },
      exhibits,
      museum: museumStats(target),
      rating: target.base.ratingCount ? Math.round((target.base.ratingSum / target.base.ratingCount) * 10) / 10 : 0,
    });
  }));

  api.post('/base/rate', auth, h(async (req, res) => {
    const p = P(req);
    const targetId = String(req.body?.playerId ?? '');
    const stars = Math.max(1, Math.min(5, Math.round(Number(req.body?.stars ?? 5))));
    if (targetId === p.id) return res.status(400).json({ error: 'self_rate' });
    if (p.level < 3) return res.status(403).json({ error: 'level', message: 'Оценки доступны с 3 уровня' });
    const day = new Date().toISOString().slice(0, 10);
    const key = `rate:${p.id}:${day}`;
    const meta = await ctx.store.get<{ n: number }>('meta', key) ?? { n: 0 };
    if (meta.n >= 20) return res.status(429).json({ error: 'daily_limit', message: '20 оценок в день — этого достаточно' });
    if (p.base.rated.includes(targetId)) return res.status(409).json({ error: 'already_rated' });
    const target = await ctx.store.get<PlayerDoc>('players', targetId);
    if (!target) return res.status(404).json({ error: 'not_found' });
    p.base.rated.push(targetId);
    target.base.ratingSum += stars;
    target.base.ratingCount++;
    meta.n++;
    await ctx.store.put('meta', key, meta as any);
    await ctx.store.put('players', p.id, p);
    await ctx.store.put('players', target.id, target);
    res.json({ ok: true, rating: Math.round((target.base.ratingSum / target.base.ratingCount) * 10) / 10, votesLeft: 20 - meta.n });
  }));

  api.get('/leaderboard', h(async (_req, res) => {
    const players = await ctx.store.list<PlayerDoc>('players', 500);
    const findOf = (p: PlayerDoc) => {
      let best: ItemInstance | null = null;
      for (const i of p.items) if (!best || i.weightG > best.weightG) best = i;
      return best;
    };
    const baseScore = (p: PlayerDoc) => p.base.slots.filter((s) => s.itemUid).length * 10 + (p.base.ratingCount ? (p.base.ratingSum / p.base.ratingCount) * 6 : 0);
    const rareScore = (p: PlayerDoc) => p.items.reduce((n, i) => n + RARITY[i.rarity].order * 2 + (i.serial ? 12 : 0), 0);
    const valueScore = (p: PlayerDoc) => p.items.reduce((n, i) => n + i.value, 0);
    const brief = (p: PlayerDoc) => ({ id: p.id, name: p.name, level: p.level, base: { name: p.base.name, level: p.base.level, visitors: p.base.visitors, ratingCount: p.base.ratingCount }, rating: p.base.ratingCount ? Math.round((p.base.ratingSum / p.base.ratingCount) * 10) / 10 : 0, exhibits: p.base.slots.filter((s) => s.itemUid).length });
    const top = <T,>(arr: T[], score: (x: T) => number, n = 20) => [...arr].sort((a, b) => score(b) - score(a)).slice(0, n);
    res.json({
      richest: top(players, (p) => p.coins).map((p) => ({ ...brief(p), coins: p.coins })),
      bases: top(players, baseScore).map(brief),
      rarest: top(players, rareScore).map((p) => ({ ...brief(p), score: rareScore(p) })),
      valuable: top(players, valueScore).map((p) => ({ ...brief(p), value: valueScore(p) })),
      visited: top(players, (p) => p.base.visitors + p.base.ratingCount).map(brief),
      records: top(players.map((p) => ({ p, item: findOf(p) })).filter((x) => x.item), (x) => x.item!.weightG, 20).map((x) => ({
        playerId: x.p.id, name: x.p.name, item: serializeItem(x.item!),
      })),
    });
  }));

  // ── серийные предметы ──
  api.post('/serial/opt-out', auth, h(async (req, res) => {
    const p = P(req);
    const uid = String(req.body?.uid ?? '');
    const item = p.items.find((i) => i.uid === uid);
    if (!item || !item.serial) return res.status(404).json({ error: 'no_serial' });
    if (!p.circOptOut.includes(uid)) p.circOptOut.push(uid);
    item.history.push({ type: 'opt_out', at: Date.now(), note: 'Игрок отключил участие в циркуляции' });
    const rec = await ctx.store.get<SerialRecord>('serials', `${item.itemId}#${item.serial.no}`);
    if (rec) { rec.circulates = false; rec.history.push({ type: 'opt_out', at: Date.now(), to: p.id, note: 'Отключено участие в «Возврате в пучину»' }); await ctx.store.put('serials', `${rec.itemId}#${rec.no}`, rec as any); }
    await ctx.store.put('players', p.id, p);
    res.json({ ok: true, player: publicPlayer(p) });
  }));

  api.post('/serial/opt-in', auth, h(async (req, res) => {
    const p = P(req);
    const uid = String(req.body?.uid ?? '');
    const item = p.items.find((i) => i.uid === uid);
    if (!item || !item.serial) return res.status(404).json({ error: 'no_serial' });
    p.circOptOut = p.circOptOut.filter((x) => x !== uid);
    const rec = await ctx.store.get<SerialRecord>('serials', `${item.itemId}#${item.serial.no}`);
    if (rec) { rec.circulates = true; await ctx.store.put('serials', `${rec.itemId}#${rec.no}`, rec as any); }
    await ctx.store.put('players', p.id, p);
    res.json({ ok: true, player: publicPlayer(p) });
  }));

  api.get('/serial/:uid', auth, h(async (req, res) => {
    const p = P(req);
    const item = p.items.find((i) => i.uid === req.params.uid);
    if (!item || !item.serial) return res.status(404).json({ error: 'no_serial' });
    const rec = await ctx.store.get<SerialRecord>('serials', `${item.itemId}#${item.serial.no}`);
    res.json({ serial: item.serial, history: rec?.history ?? item.history, circulates: rec?.circulates ?? false, optOut: p.circOptOut.includes(item.uid), returnDays: RETURN_DAYS() });
  }));

  // ── музей ──
  api.get('/museum', h(async (_req, res) => {
    res.json({ stats: { total: ITEMS.length }, items: ITEMS.map((i) => ({ id: i.id, name: i.name, cat: i.cat, rarity: i.rarity, desc: i.desc, loc: i.loc, art: i.art, pal: i.pal, pat: i.pat ?? 'none', w: i.w, len: i.len, serial: i.serial, chain: i.chain, ability: i.ability, researchable: !!i.researchable })) });
  }));

  // ── скупщик ──
  api.get('/smuggler', auth, h(async (req, res) => {
    const p = P(req);
    const week = weekIndex();
    if (p.smugglerWeek !== week) { p.smugglerWeek = week; p.smugglers = {}; await ctx.store.put('players', p.id, p); }
    const offers = smugglerOffers(week).map((o) => ({ ...o, used: p.smugglers[o.id] ?? 0, left: Math.max(0, o.limit - (p.smugglers[o.id] ?? 0)) }));
    res.json({ offers, week, resetIn: (week + 1) * 7 * DAY_MS - Date.now(), hint: LOCATIONS[new Rng(`hint:${week}`).int(0, LOCATIONS.length - 1)].id });
  }));

  api.post('/smuggler/trade', auth, h(async (req, res) => {
    const p = P(req);
    const offerId = String(req.body?.offerId ?? '');
    const offer = smugglerOffers(weekIndex()).find((o) => o.id === offerId);
    if (!offer) return res.status(404).json({ error: 'no_offer' });
    const used = p.smugglers[offer.id] ?? 0;
    if (used >= offer.limit) return res.status(429).json({ error: 'limit', message: 'Этот обмен уже исчерпан на этой неделе' });
    // Проверяем, что отдаются не серийные предметы
    for (const [id] of offer.give) {
      if (ITEM_BY_ID[id]?.serial) return res.status(400).json({ error: 'serial_forbidden' });
    }
    const consumed: Record<string, number> = {};
    for (const [id, qty] of offer.give) {
      const g = GEAR_BY_ID[id];
      const need = qty;
      if (g) {
        const owned = p.items.filter((i) => i.itemId === id && !i.serial && !i.placed).slice(0, need);
        if (owned.length < need) return res.status(400).json({ error: 'missing', need: `${g.name} x${need}` });
        for (const it of owned) p.items = p.items.filter((i) => i.uid !== it.uid);
      } else {
        if ((p.supplies[id] ?? 0) < need) return res.status(400).json({ error: 'missing', need: `${MAT_BY_ID[id]?.name ?? id} x${need}` });
        p.supplies[id] -= need;
      }
      consumed[id] = need;
    }
    for (const [id, qty] of offer.get) {
      const g = GEAR_BY_ID[id];
      if (g) { if (!p.ownedGear.includes(id)) p.ownedGear.push(id); p.supplies[id] = (p.supplies[id] ?? 0) + (g.consumable ? qty : 1); }
      else p.supplies[id] = (p.supplies[id] ?? 0) + qty;
    }
    p.smugglers[offer.id] = used + 1;
    await ctx.store.put('players', p.id, p);
    res.json({ ok: true, got: offer.get, used: p.smugglers[offer.id], left: offer.limit - p.smugglers[offer.id], player: publicPlayer(p) });
  }));

  // ── настройки ──
  api.post('/settings', auth, h(async (req, res) => {
    const p = P(req);
    if (typeof req.body?.haptics === 'boolean') p.settings.haptics = req.body.haptics;
    if (typeof req.body?.share === 'boolean') p.settings.share = req.body.share;
    if (typeof req.body?.confirmRare === 'boolean') p.settings.confirmRare = req.body.confirmRare;
    p.lastSeen = Date.now();
    await ctx.store.put('players', p.id, p);
    res.json({ ok: true, settings: p.settings });
  }));

  // ── сезонные цели (без сброса основного прогресса) ──
  api.post('/season/claim', auth, h(async (req, res) => {
    const p = P(req);
    const goal = SEASON.goals.find((g) => g.id === String(req.body?.goalId ?? ''));
    if (!goal) return res.status(404).json({ error: 'no_goal' });
    if (p.season.claimed.includes(goal.id)) return res.status(409).json({ error: 'claimed' });
    const cur = p.season.stats[goal.stat] ?? 0;
    if (cur < goal.target) return res.status(400).json({ error: 'not_done', cur, target: goal.target });
    p.season.claimed.push(goal.id);
    p.coins += goal.reward;
    p.stats.coinsEarned += goal.reward;
    await ctx.store.put('players', p.id, p);
    res.json({ ok: true, reward: goal.reward, player: publicPlayer(p) });
  }));

  // ── Telegram Stars: только косметика ──
  api.post('/stars/invoice', auth, h(async (req, res) => {
    const p = P(req);
    const cos = COSMETICS.find((c) => c.id === String(req.body?.cosmeticId ?? ''));
    if (!cos) return res.status(404).json({ error: 'no_cosmetic' });
    if (p.cosmetics.includes(cos.id)) return res.status(409).json({ error: 'owned' });
    if (process.env.STARS_ENABLED === '0') return res.status(503).json({ error: 'stars_disabled' });
    if (!BOT_TOKEN()) return res.status(503).json({ error: 'no_bot_token', message: 'Платежи доступны только с настроенным TELEGRAM_BOT_TOKEN' });
    const payload = `cos:${cos.id}:${p.id}`;
    const link = await createStarsInvoice(BOT_TOKEN(), cos.name, cos.desc, payload, cos.stars);
    if (!link) return res.status(502).json({ error: 'invoice_failed' });
    res.json({ ok: true, link, stars: cos.stars, cosmetic: cos });
  }));

  // ── Telegram webhook: подтверждение платежей ──
  api.post('/telegram/webhook', h(async (req, res) => {
    const secret = req.get('x-telegram-bot-api-secret-token');
    const expected = process.env.TELEGRAM_WEBHOOK_SECRET;
    if (expected && secret !== expected) return res.status(401).json({ error: 'bad_secret' });
    const update = req.body ?? {};
    if (update.pre_checkout_query) {
      await answerPreCheckout(BOT_TOKEN(), update.pre_checkout_query.id, true);
      return res.json({ ok: true });
    }
    const payment = update.message?.successful_payment;
    if (payment?.invoice_payload) {
      const [kind, cosmeticId, playerId] = String(payment.invoice_payload).split(':');
      if (kind === 'cos' && playerId) {
        const p = await ctx.store.get<PlayerDoc>('players', playerId);
        if (p && !p.cosmetics.includes(cosmeticId)) {
          p.cosmetics.push(cosmeticId);
          await ctx.store.put('players', playerId, p);
          await sendPhotoToChat(BOT_TOKEN(), update.message.chat.id, '', `Покупка подтверждена: ${cosmeticId}`);
        }
      }
      return res.json({ ok: true });
    }
    res.json({ ok: true });
  }));

  api.post('/admin/sweep-serials', h(async (req, res) => {
    const key = req.get('x-admin-key');
    if (!process.env.ADMIN_KEY || key !== process.env.ADMIN_KEY) return res.status(403).json({ error: 'forbidden' });
    res.json(await sweepSerials(ctx));
  }));

  // ── карточки находок для Telegram Stories ──
  // Картинка генерируется на клиенте (вектор + canvas, без фотографий), сервер лишь
  // хранит её, чтобы у Stories был публичный https-URL.
  api.post('/share/card', auth, h(async (req, res) => {
    const d = String(req.body?.dataUrl ?? '');
    if (!d.startsWith('data:image/png;base64,') || d.length > 4_000_000) return res.status(400).json({ error: 'bad_image' });
    const id = crypto.randomUUID();
    await ctx.store.put('cards', id, { owner: P(req).id, png: d, at: Date.now() } as any);
    const pub = process.env.PUBLIC_URL?.replace(/\/$/, '') ?? '';
    res.json({ ok: true, url: `${pub}/api/share/card/${id}.png`, id });
  }));

  api.get('/share/card/:id', h(async (req, res) => {
    const id = String(req.params.id).replace(/\.png$/, '');
    const card = await ctx.store.get<any>('cards', id);
    if (!card) return res.status(404).send('not found');
    const buf = Buffer.from(String(card.png).split(',')[1], 'base64');
    res.setHeader('content-type', 'image/png');
    res.setHeader('cache-control', 'public, max-age=86400');
    res.send(buf);
  }));

  return api;
}

function SESSION_SECRET_ENV(): string {
  return process.env.SESSION_SECRET?.trim() || 'anything-fishing-dev-secret';
}

export async function runSerialSweep(store: KvStore): Promise<void> {
  try {
    const r = await sweepSerials({ store });
    if (r.returned || r.warned) console.log(`[serials] warned=${r.warned} returned=${r.returned}`);
  } catch (e) { console.warn('[serials] sweep failed', (e as Error).message); }
}

export { createStore };
