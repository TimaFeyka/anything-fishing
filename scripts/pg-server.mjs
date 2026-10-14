/**
 * Локальный сервер протокола PostgreSQL (PGLite в режиме сокет-сервера).
 * Нужен, чтобы проверить боевой путь с настоящей базой без Docker и без установки Postgres.
 *
 * Запуск: node scripts/pg-server.mjs [dataDir] [port]
 * Строка подключения: postgresql://postgres:postgres@127.0.0.1:<port>/postgres
 */
import os from 'node:os';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';

const dir = process.argv[2] ?? path.join(os.tmpdir(), 'af-pg-server');
const port = Number(process.argv[3] ?? 55434);

const db = new PGlite(dir);
const server = new PGLiteSocketServer({ db, host: '127.0.0.1', port, maxConnections: 20 });
await server.start();
console.log(`PGLite (Postgres wire protocol) слушает 127.0.0.1:${port}, данные: ${dir}`);
console.log(`DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:${port}/postgres`);

const stop = async () => { try { await server.stop(); } catch { /* noop */ } try { await db.close(); } catch { /* noop */ } process.exit(0); };
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
