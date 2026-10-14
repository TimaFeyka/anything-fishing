/**
 * Хранилище. Два взаимозаменяемых бэкенда за одним узким интерфейсом:
 *  - PgStore   — PostgreSQL (прод на Render), таблица kv(bucket,id,doc jsonb)
 *  - MemoryKv  — файловое хранилище data/state.json (локальная разработка без Postgres)
 * Все операции точечные (по ключу), поэтому переход на SQL не требует менять бизнес-логику.
 */
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';

export type Doc = Record<string, any>;

export interface KvStore {
  readonly kind: string;
  init(): Promise<void>;
  get<T = Doc>(bucket: string, id: string): Promise<T | null>;
  put(bucket: string, id: string, doc: Doc): Promise<void>;
  del(bucket: string, id: string): Promise<void>;
  list<T = Doc>(bucket: string, limit?: number): Promise<T[]>;
  count(bucket: string): Promise<number>;
  health(): Promise<string>;
}

export class MemoryKv implements KvStore {
  readonly kind = 'file';
  private data = new Map<string, Map<string, Doc>>();
  private dirty = false;
  private timer: NodeJS.Timeout | null = null;
  constructor(private file: string) {}

  async init(): Promise<void> {
    try {
      const raw = await fsp.readFile(this.file, 'utf8');
      const parsed = JSON.parse(raw) as Record<string, Record<string, Doc>>;
      for (const [b, rows] of Object.entries(parsed)) this.data.set(b, new Map(Object.entries(rows)));
    } catch { /* первый запуск */ }
  }
  private bucket(b: string): Map<string, Doc> {
    let m = this.data.get(b);
    if (!m) { m = new Map(); this.data.set(b, m); }
    return m;
  }
  private touch() {
    this.dirty = true;
    if (this.timer) return;
    this.timer = setTimeout(() => { void this.flush(); }, 400);
    this.timer.unref?.();
  }
  async flush(): Promise<void> {
    this.timer = null;
    if (!this.dirty) return;
    this.dirty = false;
    const out: Record<string, Record<string, Doc>> = {};
    for (const [b, m] of this.data) out[b] = Object.fromEntries(m);
    await fsp.mkdir(path.dirname(this.file), { recursive: true });
    await fsp.writeFile(this.file + '.tmp', JSON.stringify(out));
    await fsp.rename(this.file + '.tmp', this.file);
  }
  async get<T = Doc>(b: string, id: string): Promise<T | null> {
    const d = this.bucket(b).get(id);
    return d ? (JSON.parse(JSON.stringify(d)) as T) : null;
  }
  async put(b: string, id: string, doc: Doc): Promise<void> {
    this.bucket(b).set(id, JSON.parse(JSON.stringify(doc)));
    this.touch();
  }
  async del(b: string, id: string): Promise<void> {
    this.bucket(b).delete(id);
    this.touch();
  }
  async list<T = Doc>(b: string, limit = 500): Promise<T[]> {
    return [...this.bucket(b).values()].slice(0, limit).map((d) => JSON.parse(JSON.stringify(d)) as T);
  }
  async count(b: string): Promise<number> { return this.bucket(b).size; }
  async health(): Promise<string> { return `file store ok (${[...this.data.values()].reduce((n, m) => n + m.size, 0)} documents)`; }
}

export class PgStore implements KvStore {
  readonly kind = 'postgres';
  private pool: any;
  constructor(private url: string, private ssl: boolean) {}

  async init(): Promise<void> {
    const { default: pg } = await import('pg');
    this.pool = new pg.Pool({
      connectionString: this.url,
      ssl: this.ssl ? { rejectUnauthorized: false } : undefined,
      max: 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
      // Не даём сервису «висеть» на недоступной базе
      keepAlive: true,
    });
    this.pool.on('error', (e: Error) => console.warn('[db] ошибка пула PostgreSQL:', e.message));
    // Явная проверка соединения: понятная ошибка вместо падения при первом запросе
    const client = await this.pool.connect();
    try { await client.query('SELECT 1'); } finally { client.release(); }
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS kv (
        bucket text NOT NULL,
        id text NOT NULL,
        doc jsonb NOT NULL,
        updated_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (bucket, id)
      );
      CREATE INDEX IF NOT EXISTS kv_bucket_updated_idx ON kv (bucket, updated_at DESC);
    `);
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS serial_registry (
        item_id text NOT NULL,
        serial_no integer NOT NULL,
        owner_id text,
        total integer NOT NULL,
        history jsonb NOT NULL DEFAULT '[]'::jsonb,
        updated_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (item_id, serial_no)
      );
    `);
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS ledger (
        op_id text PRIMARY KEY,
        player_id text NOT NULL,
        kind text NOT NULL,
        result jsonb NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      );
    `);
  }
  async get<T = Doc>(b: string, id: string): Promise<T | null> {
    const r = await this.pool.query('SELECT doc FROM kv WHERE bucket=$1 AND id=$2', [b, id]);
    return r.rows[0] ? (r.rows[0].doc as T) : null;
  }
  async put(b: string, id: string, doc: Doc): Promise<void> {
    await this.pool.query(
      `INSERT INTO kv (bucket, id, doc, updated_at) VALUES ($1,$2,$3,now())
       ON CONFLICT (bucket, id) DO UPDATE SET doc=EXCLUDED.doc, updated_at=now()`,
      [b, id, JSON.stringify(doc)],
    );
  }
  async del(b: string, id: string): Promise<void> {
    await this.pool.query('DELETE FROM kv WHERE bucket=$1 AND id=$2', [b, id]);
  }
  async list<T = Doc>(b: string, limit = 500): Promise<T[]> {
    const r = await this.pool.query('SELECT doc FROM kv WHERE bucket=$1 ORDER BY updated_at DESC LIMIT $2', [b, limit]);
    return r.rows.map((x: any) => x.doc as T);
  }
  async count(b: string): Promise<number> {
    const r = await this.pool.query('SELECT count(*)::int AS n FROM kv WHERE bucket=$1', [b]);
    return r.rows[0]?.n ?? 0;
  }
  async health(): Promise<string> {
    const r = await this.pool.query('SELECT count(*)::int AS n FROM kv');
    return `postgres ok (${r.rows[0].n} documents)`;
  }
  /** Атомарная регистрация серийного номера: гарантирует отсутствие дублей на всём сервере. */
  async claimSerial(itemId: string, total: number): Promise<{ no: number; history: any[] } | null> {
    const r = await this.pool.query('SELECT serial_no FROM serial_registry WHERE item_id=$1', [itemId]);
    const taken = new Set<number>(r.rows.map((x: any) => x.serial_no));
    for (let no = 1; no <= total; no++) {
      if (taken.has(no)) continue;
      const ins = await this.pool.query(
        `INSERT INTO serial_registry (item_id, serial_no, total, history) VALUES ($1,$2,$3,'[]'::jsonb)
         ON CONFLICT (item_id, serial_no) DO NOTHING RETURNING serial_no`,
        [itemId, no, total],
      );
      if (ins.rowCount) return { no, history: [] };
    }
    return null;
  }
  async setSerialOwner(itemId: string, no: number, ownerId: string | null, history: any[]): Promise<void> {
    await this.pool.query(
      'UPDATE serial_registry SET owner_id=$3, history=$4::jsonb, updated_at=now() WHERE item_id=$1 AND serial_no=$2',
      [itemId, no, ownerId, JSON.stringify(history)],
    );
  }
  async getLedger(opId: string): Promise<any | null> {
    const r = await this.pool.query('SELECT result FROM ledger WHERE op_id=$1', [opId]);
    return r.rows[0]?.result ?? null;
  }
  async putLedger(opId: string, playerId: string, kind: string, result: any): Promise<void> {
    await this.pool.query(
      `INSERT INTO ledger (op_id, player_id, kind, result) VALUES ($1,$2,$3,$4::jsonb)
       ON CONFLICT (op_id) DO NOTHING`,
      [opId, playerId, kind, JSON.stringify(result)],
    );
  }
}

/** Проверка строки подключения: отличает настоящий URL от имени базы и опечаток. */
export function validateDbUrl(raw: string): { ok: boolean; reason?: string; hint?: string; url: string } {
  const url = raw.trim().replace(/^["']|["']$/g, '');
  if (!/^postgres(ql)?:\/\//i.test(url)) {
    return {
      ok: false, url,
      reason: `значение не похоже на строку подключения: ${url.length > 40 ? url.slice(0, 40) + '…' : url}`,
      hint: 'В DATABASE_URL нужна полная строка вида postgresql://user:password@host/dbname. '
        + 'Частая ошибка — вписать туда только имя базы (например «base») или имя переменной.',
    };
  }
  try {
    const u = new URL(url);
    if (!u.hostname) return { ok: false, url, reason: 'в строке подключения нет хоста', hint: 'Скопируйте строку целиком: база → Connect → Internal Database URL.' };
    if (!u.username) return { ok: false, url, reason: 'в строке подключения нет пользователя', hint: 'Похоже, строка обрезана. Скопируйте Internal Database URL целиком.' };
    if (!u.pathname || u.pathname === '/') {
      return { ok: false, url, reason: 'в строке подключения нет имени базы данных', hint: 'Ожидается .../имя_базы в конце строки.' };
    }
    return { ok: true, url };
  } catch {
    return { ok: false, url, reason: 'не удалось разобрать строку подключения как URL', hint: 'Скопируйте Internal Database URL из Render без изменений.' };
  }
}

/** Печатает строку подключения без пароля — чтобы её можно было безопасно показать в логах. */
export function describeDbUrl(url: string): string {
  try {
    const u = new URL(url);
    return `postgresql://${u.username}:****@${u.host}${u.pathname}`;
  } catch { return '<некорректный URL>'; }
}

function sslFromEnv(url: string): boolean {
  if (/sslmode=(require|verify-ca|verify-full|no-verify)/i.test(url)) return true;
  if (/sslmode=disable/i.test(url)) return false;
  return process.env.PGSSL === '1';
}

export async function createStore(): Promise<KvStore> {
  const raw = process.env.DATABASE_URL ?? '';
  const fileStore = async (): Promise<KvStore> => {
    const dir = process.env.DATA_DIR || path.resolve(process.cwd(), 'data');
    const mem = new MemoryKv(path.join(dir, 'state.json'));
    await mem.init();
    return mem;
  };

  if (!raw.trim()) {
    console.warn('[db] DATABASE_URL не задан — работаем на файловом хранилище (данные исчезнут при следующем деплое).');
    return fileStore();
  }

  const check = validateDbUrl(raw);
  if (!check.ok) {
    console.warn(
      '\n╔══════════════════════════════════════════════════════════════════════════════╗\n'
      + '║ НЕКОРРЕКТНЫЙ DATABASE_URL — PostgreSQL отключён, работаем на файлах          ║\n'
      + '╚══════════════════════════════════════════════════════════════════════════════╝\n'
      + `  Причина: ${check.reason}\n`
      + `  Как исправить: ${check.hint}\n`
      + '  Где взять: Render → ваша база Postgres → кнопка Connect (справа сверху) → Internal Database URL.\n'
      + '  Это должна быть строка вида postgresql://user:пароль@dpg-xxxx-a/имя_базы\n'
      + '  После правки: сервис → Environment → Save and deploy.\n'
      + '  Пока база не подключена, игроки играют, но прогресс потеряется при следующем деплое.\n',
    );
    return fileStore();
  }

  const ssl = sslFromEnv(check.url);
  const pg = new PgStore(check.url, ssl);
  try {
    await pg.init();
    console.log(`[db] PostgreSQL подключён: ${describeDbUrl(check.url)} (ssl: ${ssl ? 'вкл' : 'выкл'})`);
    return pg;
  } catch (e) {
    const err = e as NodeJS.ErrnoException;
    const extra = err.code === 'ENOTFOUND'
      ? 'Хост из DATABASE_URL не найден. Обычно это значит, что в переменной лежит не строка подключения, '
      + 'либо база и сервис находятся в разных регионах Render.'
      : err.code === 'ECONNREFUSED'
        ? 'Соединение отклонено: проверьте, что база запущена и что вы используете Internal URL из того же региона.'
        : 'Проверьте строку подключения и доступность базы.';
    console.warn(
      '\n╔══════════════════════════════════════════════════════════════════════════════╗\n'
      + '║ PostgreSQL НЕДОСТУПЕН — сервис продолжит работу на файловом хранилище       ║\n'
      + '╚══════════════════════════════════════════════════════════════════════════════╝\n'
      + `  Строка:  ${describeDbUrl(check.url)}\n`
      + `  Ошибка:  ${err.code ?? ''} ${err.message}\n`
      + `  Что делать: ${extra}\n`
      + '  1) Render → ваша база Postgres → Connect → Internal Database URL → скопировать целиком.\n'
      + '  2) Сервис → Environment → DATABASE_URL → вставить строку → Save and deploy.\n'
      + '     Внутренний URL требует PGSSL=0, внешний (External Database URL) — PGSSL=1.\n'
      + '  3) База и сервис должны быть в одном регионе.\n'
      + '  4) Если сервис создан через Blueprint, DATABASE_URL подставляется автоматически\n'
      + '     (fromDatabase в render.yaml) — удалите ручное значение этой переменной.\n'
      + '  Пока база не подключена, игроки играют, но прогресс потеряется при следующем деплое.\n',
    );
    return fileStore();
  }
}

// ── Серийные предметы: журнал на сервере (в KV, чтобы работало и без Postgres) ──
export interface SerialRecord {
  itemId: string;
  no: number;
  total: number;
  ownerId: string | null;
  history: { type: string; at: number; from?: string; to?: string; note?: string }[];
  circulates: boolean;
  lostAt?: number;
}

export async function allocateSerial(store: KvStore, itemId: string, total: number): Promise<{ no: number; record: SerialRecord } | null> {
  const all = await store.list<SerialRecord>('serials', 5000);
  const taken = new Set(all.filter((s) => s.itemId === itemId).map((s) => s.no));
  for (let no = 1; no <= total; no++) {
    if (!taken.has(no)) {
      const record: SerialRecord = { itemId, no, total, ownerId: null, history: [], circulates: true };
      await store.put('serials', `${itemId}#${no}`, record as any);
      return { no, record };
    }
  }
  return null;
}

// ── Блокировки по ключу: защищают от гонок при параллельных запросах одного игрока ──
const locks = new Map<string, Promise<void>>();
export async function withLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const prev = locks.get(key) ?? Promise.resolve();
  let release!: () => void;
  const gate = new Promise<void>((r) => { release = r; });
  const chained = prev.then(() => gate);
  locks.set(key, chained);
  await prev.catch(() => {});
  try {
    return await fn();
  } finally {
    release();
    if (locks.get(key) === chained) locks.delete(key);
  }
}
