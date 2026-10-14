/**
 * Общая физика вываживания. Один и тот же код используют:
 *  - сервер (авторитетная симуляция, знает секретное расписание рывков);
 *  - клиент (локальное предсказание между серверными подтверждениями, получает только
 *    ближайший отрезок рывка — полное расписание и seed ему не передаются).
 * Файл не должен импортировать ничего из Node: он попадает и в браузерный бандл.
 */

export type PullKind = 'calm' | 'pull' | 'surge' | 'run';

export interface PullEvent {
  /** абсолютное время начала (мс от старта попытки) */
  start: number;
  duration: number;
  /** сила рывка 0..1 */
  power: number;
  kind: PullKind;
}

export interface PhysParams {
  strength: number;   // эффективная сила добычи (кг)
  maxLoad: number;    // предел снасти (кг) = min(удочка, леска)
  control: number;    // контроль натяжения (катушка/подсачек)
  speed: number;      // скорость подтягивания
  depth: number;
  giant: boolean;
}

export interface PhysicsCore {
  t: number;          // мс с начала вываживания
  tension: number;    // 0..1 (может превысить 1 при перегрузе)
  progress: number;   // 0..1
  integrity: number;  // 1..0 — прочность лески
  stamina: number;    // 1..0 — выносливость добычи
  slack: number;      // накопленное время провисания, сек
}

export type Outcome = 'land' | 'break' | 'slip' | 'timeout' | null;

export const PHYS = {
  TICK: 100,
  IDEAL_MIN: 0.35,
  IDEAL_MAX: 0.85,
  TENSION_MIN: 0,
  TENSION_MAX: 1.4,
  REEL_TENSION: 0.4,
  RELEASE_TENSION: -0.78,
  REEL_PROGRESS: 0.115,
  RELEASE_PROGRESS: -0.016,
  SLACK_LIMIT: 3.2,
  MAX_MS: 150_000,
  INTEGRITY_SOFT: 0.9,
  SLIP_TENSION: 0.06,
};

export function activeEvent(events: PullEvent[], t: number): PullEvent | null {
  for (const e of events) {
    if (t >= e.start && t < e.start + e.duration) return e;
  }
  return null;
}

export function nextEvent(events: PullEvent[], t: number): PullEvent | null {
  for (const e of events) if (e.start + e.duration > t) return e;
  return null;
}

/**
 * Один шаг симуляции. Чистая функция: одинаковый вход → одинаковый выход.
 * power — сила активного рывка (0 если рывка нет).
 */
export function applyPhysics(
  core: PhysicsCore,
  p: PhysParams,
  dtMs: number,
  reeling: boolean,
  power: number,
): { core: PhysicsCore; outcome: Outcome } {
  const dt = Math.min(0.25, dtMs / 1000);
  const c: PhysicsCore = { ...core, t: core.t + dtMs };
  const load = p.strength / Math.max(0.5, p.maxLoad);
  const overload = Math.max(0, load - 1);

  // Выносливость добычи: тратится, пока игрок держит натяжение в рабочей зоне.
  const effectivePower = power * (0.35 + 0.65 * c.stamina);
  if (reeling && c.tension >= PHYS.IDEAL_MIN && c.tension <= PHYS.IDEAL_MAX) {
    c.stamina = Math.max(0, c.stamina - dt * (0.07 + effectivePower * 0.06));
  } else if (!reeling) {
    c.stamina = Math.min(1, c.stamina + dt * 0.012);
  }

  // Слишком слабая снасть: отпускание почти не помогает — добыча продолжает тянуть.
  const releaseEase = Math.max(0.3, 1 - overload * 0.2);

  // Натяжение
  if (reeling) {
    c.tension += dt * (PHYS.REEL_TENSION + effectivePower * (0.95 + p.depth * 0.05) - p.control * 0.09 + overload * 0.34);
  } else {
    c.tension += dt * (PHYS.RELEASE_TENSION * releaseEase - p.control * 0.03 + effectivePower * 0.2);
  }
  c.tension = Math.max(PHYS.TENSION_MIN, Math.min(PHYS.TENSION_MAX, c.tension));

  // Прогресс подтягивания (глубина слегка сопротивляется)
  if (reeling) {
    c.progress += dt * PHYS.REEL_PROGRESS * p.speed * (1 - 0.42 * effectivePower) * (1 - 0.025 * Math.max(0, p.depth - 1)) * (c.stamina < 0.25 ? 1.35 : 1);
  } else {
    c.progress += dt * (PHYS.RELEASE_PROGRESS + effectivePower * 0.01);
  }
  c.progress = Math.max(0, Math.min(1, c.progress));

  // Прочность лески
  if (c.tension > PHYS.INTEGRITY_SOFT) {
    const k = (c.tension - PHYS.INTEGRITY_SOFT) / (PHYS.TENSION_MAX - PHYS.INTEGRITY_SOFT);
    c.integrity -= dt * (0.22 * k * (1 + overload * 2.2));
  }
  if (c.tension >= 1) c.integrity -= dt * 0.75 * (1 + overload * 1.6);
  // Перегруженная снасть рвётся постепенно, пока игрок вытягивает добычу
  if (reeling && overload > 0.15) c.integrity -= dt * 0.09 * overload;

  // Провисание: долго без натяжения — добыча сходит с крючка
  if (!reeling && c.tension < PHYS.SLIP_TENSION) c.slack += dt;
  else c.slack = Math.max(0, c.slack - dt * 0.6);

  if (c.tension < PHYS.IDEAL_MIN && reeling && power > 0.5) c.progress = Math.max(0, c.progress - dt * 0.01);

  c.integrity = Math.max(0, c.integrity);

  if (c.integrity <= 0) return { core: c, outcome: 'break' };
  if (c.slack >= PHYS.SLACK_LIMIT) return { core: c, outcome: 'slip' };
  if (c.progress >= 1) return { core: c, outcome: 'land' };
  if (c.t >= PHYS.MAX_MS) return { core: c, outcome: 'timeout' };
  return { core: c, outcome: null };
}

/** Оценка сложности 1..5 для карточки подсказки (используется и клиентом). */
export function difficultyStars(p: PhysParams): number {
  const load = p.strength / Math.max(0.5, p.maxLoad);
  return Math.max(1, Math.min(5, Math.ceil(load * 2.2)));
}

export function weightBand(weightG: number): string {
  if (weightG < 500) return 'очень легкое';
  if (weightG < 5_000) return 'легкое';
  if (weightG < 50_000) return 'увесистое';
  if (weightG < 300_000) return 'тяжелое';
  return 'чрезвычайно тяжелое';
}
