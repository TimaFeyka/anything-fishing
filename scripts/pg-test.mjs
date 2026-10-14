/**
 * Проверка боевого пути с PostgreSQL без Docker: поднимаем настоящий сервер протокола
 * Postgres (PGLite + сокет-сервер), подключаем к нему PgStore и прогоняем те же операции,
 * что и приложение (документы, реестр серийников, журнал идемпотентности, перезапуск).
 *
 * Запуск: node scripts/pg-test.mjs   (после npm run build:server)
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const PORT = 55433;
let pass = 0; let fail = 0;
const ok = (n, c, e = '') => { if (c) { pass++; console.log(`  ✓ ${n}${e ? ' — ' + e : ''}`); } else { fail++; console.log(`  ✗ ${n}${e ? ' — ' + e : ''}`); } };

const { PGlite } = await import('@electric-sql/pglite');
const { PGLiteSocketServer } = await import('@electric-sql/pglite-socket');
const { PgStore, validateDbUrl, describeDbUrl } = await import('../dist/store.js');

const dataDir = path.join(os.tmpdir(), `af-pg-${Date.now()}`);
const db = new PGlite(dataDir);
const server = new PGLiteSocketServer({ db, host: '127.0.0.1', port: PORT, maxConnections: 10 });
await server.start();
console.log(`\nТест PostgreSQL (PGLite socket на 127.0.0.1:${PORT})\n`);

const url = `postgresql://postgres:postgres@127.0.0.1:${PORT}/postgres`;
process.env.DATABASE_URL = url;

console.log('[1] Разбор строки подключения');
ok('корректный URL принимается', validateDbUrl(url).ok);
ok('строка без схемы отклоняется с подсказкой', !validateDbUrl('base').ok && !!validateDbUrl('base').hint, validateDbUrl('base').reason);
ok('обрезанный URL без базы отклоняется', !validateDbUrl('postgresql://user:pass@host/').ok);
ok('пароль не попадает в лог', !describeDbUrl(url).includes('postgres:postgres'));

let store;
console.log('\n[2] Инициализация схемы');
try {
  store = new PgStore(url, false);
  await store.init();
  ok('PgStore подключился и создал таблицы', true, await store.health());
} catch (e) {
  ok('PgStore подключился и создал таблицы', false, e.message);
}

if (store) {
  console.log('\n[3] Операции приложения');
  await store.put('players', 'tg:1', { id: 'tg:1', name: 'Рыбак', coins: 250 });
  const got = await store.get('players', 'tg:1');
  ok('документ сохраняется и читается (jsonb)', got?.name === 'Рыбак' && got.coins === 250);
  await store.put('players', 'tg:1', { id: 'tg:1', name: 'Рыбак', coins: 999 });
  ok('повторная запись обновляет документ (upsert)', (await store.get('players', 'tg:1')).coins === 999);
  await store.put('players', 'tg:2', { id: 'tg:2', name: 'Второй', coins: 10 });
  const list = await store.list('players', 10);
  ok('список документов работает', list.length === 2, `${list.length} игрока`);
  ok('счётчик документов работает', (await store.count('players')) === 2);
  await store.del('players', 'tg:2');
  ok('удаление работает', (await store.get('players', 'tg:2')) === null);

  console.log('\n[4] Серийные экземпляры (атомарная выдача номеров)');
  const a = await store.claimSerial('ser_mask_first', 3);
  const b = await store.claimSerial('ser_mask_first', 3);
  const c = await store.claimSerial('ser_mask_first', 3);
  const d = await store.claimSerial('ser_mask_first', 3);
  ok('выданы уникальные номера 1,2,3', [a?.no, b?.no, c?.no].sort().join(',') === '1,2,3', `${a?.no},${b?.no},${c?.no}`);
  ok('после исчерпания тиража номер не выдаётся', d === null);
  await store.setSerialOwner('ser_mask_first', 2, 'tg:1', [{ type: 'discovered', at: Date.now(), to: 'tg:1' }]);
  const rows = await db.query('SELECT serial_no, owner_id, history FROM serial_registry WHERE item_id = $1 ORDER BY serial_no', ['ser_mask_first']);
  ok('история владения сохранена в БД', rows.rows.length === 3 && rows.rows[1].owner_id === 'tg:1' && rows.rows[1].history.length === 1);

  console.log('\n[5] Идемпотентность операций (ledger)');
  await store.putLedger('op-1', 'tg:1', 'sell', { total: 500 });
  await store.putLedger('op-1', 'tg:1', 'sell', { total: 500 });
  const led = await store.getLedger('op-1');
  ok('повторная запись операции не дублируется', led?.total === 500);
  const count = await db.query('SELECT count(*)::int AS n FROM ledger');
  ok('в журнале ровно одна запись', count.rows[0].n === 1);

  console.log('\n[6] Перезапуск сервиса: данные на месте');
  const store2 = new PgStore(url, false);
  await store2.init();
  ok('после повторного подключения документы на месте', (await store2.get('players', 'tg:1')).coins === 999);
  ok('реестр серийников сохранился', (await store2.claimSerial('ser_mask_first', 3)) === null);
}

await server.stop();
try { await db.close(); } catch { /* noop */ }
fs.rmSync(dataDir, { recursive: true, force: true });

console.log(`\nИтог PostgreSQL: ${pass} успешно, ${fail} провалено\n`);
process.exit(fail ? 1 : 0);
