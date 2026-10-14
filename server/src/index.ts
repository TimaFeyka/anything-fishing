/**
 * ANYTHING FISHING — Node.js сервер: REST API + WebSocket для авторитетного
 * вываживания + раздача собранного фронтенда.
 *
 * Запуск: npm start   (node dist/index.js)
 * Порт:   PORT (по умолчанию 8787)
 */
import path from 'node:path';
import fs from 'node:fs';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { WebSocketServer } from 'ws';
import 'dotenv/config';

import { createApi, fightSessions, runSerialSweep } from './routes.js';
import { createStore } from './store.js';
import { FightSession } from './engine.js';
import { SESSION_SECRET, userFromInitData, validateInitData, verifySession, BOT_TOKEN } from './tg.js';
import type { PlayerDoc } from './types.js';
import { PHYS } from './physics.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT ?? 8787);

async function main() {
  const store = await createStore();
  const app = express();
  app.set('trust proxy', 1);
  app.use(express.json({ limit: '1mb' }));
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    next();
  });

  app.use('/api', createApi({ store }));
  app.get('/api/hints', (_req, res) => {
    res.json({
      telegram: { botConfigured: !!BOT_TOKEN(), devAuth: process.env.ALLOW_DEV_AUTH === '1' || process.env.NODE_ENV !== 'production' },
      publicUrl: process.env.PUBLIC_URL ?? '',
    });
  });

  // Статика собранного фронтенда (dist/public) + SPA-фолбэк
  const publicDir = path.resolve(__dirname, 'public');
  if (fs.existsSync(publicDir)) {
    app.use(express.static(publicDir, { maxAge: '1h', index: false }));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api') || req.path.startsWith('/ws')) return next();
      res.sendFile(path.join(publicDir, 'index.html'));
    });
  } else {
    app.get('/', (_req, res) => res.type('html').send('<h1>ANYTHING FISHING API</h1><p>Фронтенд не собран: npm run build</p>'));
  }

  const server = http.createServer(app);

  // ─────────────── WebSocket: фаза 2, авторитетная мини-игра ───────────────
  const wss = new WebSocketServer({ server, path: '/ws' });
  wss.on('connection', async (ws, req) => {
    const url = new URL(req.url ?? '/ws', 'http://localhost');
    const token = url.searchParams.get('token') ?? '';
    const castId = url.searchParams.get('castId') ?? '';
    let playerId = verifySession(token, SESSION_SECRET());
    if (!playerId) {
      const initData = url.searchParams.get('initData') ?? '';
      if (initData && BOT_TOKEN()) {
        const v = validateInitData(initData, BOT_TOKEN());
        if (v.ok) { const u = userFromInitData(initData); if (u) playerId = `tg:${u.id}`; }
      }
    }
    if (!playerId && (process.env.ALLOW_DEV_AUTH === '1' || process.env.NODE_ENV !== 'production')) {
      playerId = `dev:${url.searchParams.get('dev') ?? 'local-dev'}`;
    }
    const send = (o: unknown) => { try { ws.send(JSON.stringify(o)); } catch { /* closed */ } };
    if (!playerId) return ws.close(4401, 'unauthorized');
    const player = await store.get<PlayerDoc>('players', playerId);
    if (!player) return ws.close(4404, 'no player');
    const cast = await store.get<any>('casts', castId);
    if (!cast || cast.playerId !== playerId) return ws.close(4404, 'no cast');
    if (cast.granted || cast.status === 'landed') return ws.close(4410, 'already resolved');

    let session = fightSessions.get(`fight:${castId}`);
    if (!session) {
      session = new FightSession(cast.params, cast.seed, castId);
      fightSessions.set(`fight:${castId}`, session);
      cast.status = 'active';
      await store.put('casts', castId, cast);
    }
    session.startedAt = session.startedAt || Date.now();
    const theSession = session;

    send({
      t: 'init',
      state: theSession.state(),
      hints: cast.tells,
      giant: cast.giant,
      width: cast.width,
      idealMin: PHYS.IDEAL_MIN,
      idealMax: PHYS.IDEAL_MAX,
      tick: PHYS.TICK,
      difficulty: cast.params.strength / Math.max(0.5, cast.params.maxLoad),
      startedAt: Date.now(),
    });

    const started = Date.now();
    const timer = setInterval(async () => {
      if (ws.readyState !== ws.OPEN) return;
      theSession.advance(Date.now() - started);
      send({ t: 'state', state: theSession.state(), done: !!theSession.outcome, outcome: theSession.outcome });
      if (theSession.outcome) {
        clearInterval(timer);
        const status = theSession.outcome === 'land' ? 'landed' : theSession.outcome === 'break' ? 'broken' : theSession.outcome === 'slip' ? 'lost' : 'expired';
        cast.status = status;
        cast.actions = theSession.actions;
        cast.coreFinal = theSession.core;
        cast.result = { ok: theSession.outcome === 'land', reason: theSession.outcome, durationMs: theSession.core.t, rewards: [], coinsBonus: 0, xp: 0 };
        cast.lastState = theSession.state();
        await store.put('casts', castId, cast);
        send({ t: 'end', outcome: theSession.outcome, state: theSession.state() });
        setTimeout(() => ws.close(1000, 'done'), 400);
      }
    }, PHYS.TICK * 2);

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(String(raw));
        if (msg.t === 'action') {
          const a = msg.a === 'RELEASE' ? 'RELEASE' : 'REEL';
          theSession.action(a);
          send({ t: 'ack', a, at: Date.now() });
        }
        if (msg.t === 'ping') send({ t: 'pong', at: Date.now() });
      } catch { /* ignore malformed */ }
    });
    ws.on('close', () => clearInterval(timer));
  });

  // ─────────────── Обслуживание: «Возврат в пучину» ───────────────
  await runSerialSweep(store);
  setInterval(() => { void runSerialSweep(store); }, 6 * 3600_000).unref?.();

  // Чистим зависшие бои раз в минуту
  setInterval(() => {
    const now = Date.now();
    for (const [k, s] of fightSessions) if (now - s.startedAt > 20 * 60_000) fightSessions.delete(k);
  }, 60_000).unref?.();

  server.listen(PORT, () => {
    console.log(`ANYTHING FISHING server on :${PORT}  store=${store.kind}  static=${fs.existsSync(publicDir) ? 'yes' : 'no'}`);
    console.log(`  API:  http://127.0.0.1:${PORT}/api/health`);
    console.log(`  Dev auth: ${process.env.ALLOW_DEV_AUTH === '1' || process.env.NODE_ENV !== 'production' ? 'ENABLED' : 'disabled'}`);
  });
}

main().catch((e) => { console.error('fatal', e); process.exit(1); });
