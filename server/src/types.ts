import type { Category, Rarity } from './content.js';

export type Mutation = 'none' | 'golden' | 'giant' | 'mutant' | 'pristine' | 'ghostly';

export interface ItemInstance {
  uid: string;
  itemId: string;
  rarity: Rarity;
  cat: Category;
  weightG: number;
  lengthCm: number;
  condition: number;       // 0..1 — состояние (у мусора/техники ниже)
  mutation: Mutation;
  serial?: { no: number; total: number };
  history: HistoryEntry[];
  caughtAt: number;
  caughtIn: string;
  /** защищено от разбора/продажи (серийные, экспонаты, locked) */
  protectedFlag?: boolean;
  placed?: string;         // слот на базе
  researched?: boolean;
  chain?: string;
  value: number;           // рассчитанная сервером базовая стоимость
}

export interface HistoryEntry { type: string; at: number; from?: string; to?: string; note?: string }

export interface CastDoc {
  id: string;
  playerId: string;
  locationId: string;
  castType: string;
  loadout: Record<string, string>;
  createdAt: number;
  expiresAt: number;
  seed: string;
  commitment: string;
  /** серверные секреты — клиенту не отправляются */
  reward: CastReward[];
  params: FightParams;
  giant: boolean;
  tells: string[];
  width: number;
  status: 'pending' | 'active' | 'landed' | 'broken' | 'expired' | 'lost';
  result?: CastResult;
  actions: FightAction[];
  attempts: number;
}

export interface CastReward {
  itemId: string;
  rarity: Rarity;
  cat: Category;
  weightG: number;
  lengthCm: number;
  condition: number;
  mutation: Mutation;
  serialNo?: number;
  value: number;
}

export interface FightParams {
  strength: number;      // эффективная сила (кг)
  maxLoad: number;       // предел снасти
  stamina: number;       // выносливость добычи, сек
  erratic: number;       // хаотичность рывков (0..1)
  segments: number;      // число рывков
  control: number;       // контроль снасти
  speed: number;         // скорость подтягивания
  depth: number;
  giant: boolean;
}

export interface FightAction { a: 'REEL' | 'RELEASE'; t: number; dt: number }

export interface CastResult {
  ok: boolean;
  reason?: 'break' | 'slip' | 'lost' | 'timeout';
  durationMs: number;
  rewards: ItemInstance[];
  coinsBonus: number;
  xp: number;
  details?: string;
}

export interface MarketListing {
  id: string;
  sellerId: string;
  sellerName: string;
  item: ItemInstance;
  price: number;
  kind: 'market' | 'auction';
  createdAt: number;
  endsAt?: number;
  topBid?: { bidderId: string; bidderName: string; amount: number; at: number };
  status: 'active' | 'sold' | 'cancelled';
}

export interface BaseSlot { slot: string; label: string; itemUid: string | null; size: 'small' | 'medium' | 'large' | 'huge' }

export interface PlayerDoc {
  id: string;
  name: string;
  username?: string;
  photoUrl?: string;
  coins: number;
  xp: number;
  level: number;
  loadout: Record<string, string>;
  ownedGear: string[];
  supplies: Record<string, number>;    // наживки и материалы
  items: ItemInstance[];
  collection: Record<string, { count: number; maxW: number; maxLen: number; firstAt: number; lastAt: number }>;
  chains: Record<string, { step: number; items: string[]; done: boolean; startedAt: number }>;
  achievements: string[];
  records: { heaviest: { name: string; w: number } | null; longest: { name: string; len: number } | null; mostValuable: { name: string; value: number } | null };
  stats: { casts: number; lands: number; breaks: number; slips: number; giants: number; doubles: number; coinsEarned: number; coinsSpent: number; sold: number; byCat: Record<string, number>; byRarity: Record<string, number> };
  base: {
    name: string;
    level: number;
    theme: string;
    slots: BaseSlot[];
    visitors: number;
    ratingSum: number;
    ratingCount: number;
    rated: string[];       // кого уже оценивал (анти-накрутка)
  };
  daily: { day: string; npcSold: number; npcFull: number; npcHalf: number };
  smugglers: Record<string, number>;   // id обмена -> сколько раз использован на этой неделе
  smugglerWeek: number;
  cosmetics: string[];
  season: { id: string; stats: Record<string, number>; claimed: string[]; passOwned: boolean };
  locations: string[];
  circOptOut: string[];
  serialHistory: Record<string, HistoryEntry[]>;
  settings: { haptics: boolean; share: boolean; confirmRare: boolean };
  createdAt: number;
  lastSeen: number;
  totalPlayMs: number;
  warnings: { serialUid: string; at: number }[];
}

export const EMPTY_SLOTS: BaseSlot[] = [
  { slot: 'aquarium_1', label: 'Аквариум 1', itemUid: null, size: 'medium' },
  { slot: 'aquarium_2', label: 'Аквариум 2', itemUid: null, size: 'medium' },
  { slot: 'aquarium_3', label: 'Аквариум 3', itemUid: null, size: 'medium' },
  { slot: 'stand_1', label: 'Стенд 1', itemUid: null, size: 'small' },
  { slot: 'stand_2', label: 'Стенд 2', itemUid: null, size: 'small' },
  { slot: 'stand_3', label: 'Стенд 3', itemUid: null, size: 'small' },
  { slot: 'stand_4', label: 'Стенд 4', itemUid: null, size: 'small' },
  { slot: 'vault_1', label: 'Витрина 1', itemUid: null, size: 'large' },
  { slot: 'vault_2', label: 'Витрина 2', itemUid: null, size: 'large' },
  { slot: 'yard_1', label: 'Площадка для огромного', itemUid: null, size: 'huge' },
  { slot: 'yard_2', label: 'Площадка для огромного', itemUid: null, size: 'huge' },
  { slot: 'lab_1', label: 'Стол лаборатории', itemUid: null, size: 'small' },
];

export function newPlayer(id: string, name: string, username?: string): PlayerDoc {
  const now = Date.now();
  return {
    id, name, username,
    coins: 250, xp: 0, level: 1,
    loadout: { rod: 'rod_bamboo', reel: 'reel_simple', line: 'line_2', hook: 'hook_small', bait: 'bait_worm', net: 'net_basic', boat: 'boat_none', device: 'device_none' },
    ownedGear: ['rod_bamboo', 'reel_simple', 'line_2', 'hook_small', 'bait_worm', 'net_basic', 'boat_none', 'device_none'],
    supplies: { bait_worm: 25, bait_bread: 10 },
    items: [],
    collection: {},
    chains: {},
    achievements: [],
    records: { heaviest: null, longest: null, mostValuable: null },
    stats: { casts: 0, lands: 0, breaks: 0, slips: 0, giants: 0, doubles: 0, coinsEarned: 0, coinsSpent: 0, sold: 0, byCat: {}, byRarity: {} },
    base: {
      name: `База ${name}`.slice(0, 32), level: 1, theme: 'default',
      slots: JSON.parse(JSON.stringify(EMPTY_SLOTS)),
      visitors: 0, ratingSum: 0, ratingCount: 0, rated: [],
    },
    daily: { day: '', npcSold: 0, npcFull: 0, npcHalf: 0 },
    smugglers: {},
    smugglerWeek: 0,
    cosmetics: [],
    season: { id: 's1_abyss_expedition', stats: {}, claimed: [], passOwned: false },
    locations: ['lake', 'harbor'],
    circOptOut: [],
    serialHistory: {},
    settings: { haptics: true, share: true, confirmRare: true },
    createdAt: now, lastSeen: now, totalPlayMs: 0,
    warnings: [],
  };
}

export function publicPlayer(p: PlayerDoc) {
  return {
    id: p.id, name: p.name, username: p.username, photoUrl: p.photoUrl,
    coins: p.coins, xp: p.xp, level: p.level,
    loadout: p.loadout, ownedGear: p.ownedGear, supplies: p.supplies,
    items: p.items, collection: p.collection, chains: p.chains,
    achievements: p.achievements, records: p.records, stats: p.stats, base: p.base,
    daily: npcDailyState(p), cosmetics: p.cosmetics, season: p.season,
    circOptOut: p.circOptOut, settings: p.settings, warnings: p.warnings,
    locations: p.locations,
    itemCount: p.items.length,
  };
}

export function npcDailyState(p: PlayerDoc, fullLimit = 100, halfLimit = 100, halfMult = 0.5) {
  const today = new Date().toISOString().slice(0, 10);
  const sold = p.daily.day === today ? p.daily.npcSold : 0;
  const fullLeft = Math.max(0, fullLimit - Math.min(sold, fullLimit));
  const halfLeft = sold < fullLimit ? halfLimit : Math.max(0, fullLimit + halfLimit - sold);
  const mult = fullLeft > 0 ? 1 : halfLeft > 0 ? halfMult : 0;
  const nextReset = new Date(new Date().setUTCHours(24, 0, 0, 0)).getTime();
  return { sold, fullLimit, halfLimit, fullLeft, halfLeft, mult, blocked: mult === 0, resetAt: nextReset, halfMult };
}
