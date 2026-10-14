/**
 * Telegram Mini Apps: проверка initData, подписанные сессии, платежи в Stars.
 * Если TELEGRAM_BOT_TOKEN не задан, работает dev-режим (только при ALLOW_DEV_AUTH=1).
 */
import crypto from 'node:crypto';

export interface TgUser { id: string; name: string; username?: string; photoUrl?: string; language?: string }

export function parseQuery(initData: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of initData.split('&')) {
    if (!part) continue;
    const i = part.indexOf('=');
    if (i < 0) continue;
    out[part.slice(0, i)] = decodeURIComponent(part.slice(i + 1));
  }
  return out;
}

/** Проверка подписи initData по алгоритму Telegram (HMAC-SHA256 с ключом "WebAppData"). */
export function validateInitData(initData: string, botToken: string, maxAgeSec = 86400): { ok: boolean; reason?: string; fields?: Record<string, string> } {
  if (!initData) return { ok: false, reason: 'empty' };
  const fields = parseQuery(initData);
  const hash = fields.hash;
  if (!hash) return { ok: false, reason: 'no hash' };
  const dataCheckString = Object.keys(fields).filter((k) => k !== 'hash' && k !== 'signature').sort()
    .map((k) => `${k}=${fields[k]}`).join('\n');
  const secret = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
  const calc = crypto.createHmac('sha256', secret).update(dataCheckString).digest('hex');
  const a = Buffer.from(calc, 'hex');
  const b = Buffer.from(hash, 'hex');
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return { ok: false, reason: 'bad signature' };
  const authDate = Number(fields.auth_date ?? 0);
  if (!authDate) return { ok: false, reason: 'no auth_date' };
  if (maxAgeSec > 0 && Date.now() / 1000 - authDate > maxAgeSec) return { ok: false, reason: 'expired' };
  return { ok: true, fields };
}

export function userFromInitData(initData: string): TgUser | null {
  const fields = parseQuery(initData);
  if (!fields.user) return null;
  try {
    const u = JSON.parse(fields.user);
    return { id: String(u.id), name: [u.first_name, u.last_name].filter(Boolean).join(' ') || u.username || 'Рыбак', username: u.username, photoUrl: u.photo_url, language: u.language_code };
  } catch { return null; }
}

export function signSession(playerId: string, secret: string, ttlMs = 30 * 24 * 3600 * 1000): string {
  const payload = Buffer.from(JSON.stringify({ id: playerId, exp: Date.now() + ttlMs })).toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

export function verifySession(token: string, secret: string): string | null {
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return null;
  const expect = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
  if (expect.length !== sig.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(expect), Buffer.from(sig))) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!data.exp || data.exp < Date.now()) return null;
    return String(data.id);
  } catch { return null; }
}

// ─────────────────────────────── Telegram Bot API ───────────────────────────────
const API = (method: string, token: string) => `https://api.telegram.org/bot${token}/${method}`;

export async function tgCall<T = any>(method: string, token: string, body?: unknown): Promise<T | null> {
  if (!token) return null;
  try {
    const res = await fetch(API(method, token), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body ?? {}),
    });
    const json = await res.json() as any;
    if (!json.ok) { console.warn('[tg]', method, json.description); return null; }
    return json.result as T;
  } catch (e) {
    console.warn('[tg] call failed', method, (e as Error).message);
    return null;
  }
}

/** Счёт в Telegram Stars для косметики. Награда выдаётся только после подтверждения сервером. */
export async function createStarsInvoice(token: string, title: string, description: string, payload: string, stars: number): Promise<string | null> {
  return tgCall<string>('createInvoiceLink', token, {
    title, description, payload,
    currency: 'XTR',
    prices: [{ label: title, amount: stars }],
  });
}

export async function answerPreCheckout(token: string, id: string, ok = true, error?: string): Promise<void> {
  await tgCall('answerPreCheckoutQuery', token, { pre_checkout_query_id: id, ok, error_message: error });
}

/** Карточка находки, отправленная в чат как фото (генерируется на клиенте, без реальных фотографий). */
export async function sendPhotoToChat(token: string, chatId: string | number, dataUrl: string, caption: string): Promise<boolean> {
  if (!token) return false;
  try {
    const base64 = dataUrl.split(',')[1] ?? '';
    const buf = Buffer.from(base64, 'base64');
    const form = new FormData();
    form.append('chat_id', String(chatId));
    form.append('caption', caption.slice(0, 1000));
    form.append('photo', new Blob([buf], { type: 'image/png' }), 'find.png');
    const res = await fetch(API('sendPhoto', token), { method: 'POST', body: form });
    const json = await res.json() as any;
    return !!json.ok;
  } catch { return false; }
}

export const BOT_TOKEN = () => process.env.TELEGRAM_BOT_TOKEN?.trim() ?? '';
export const BOT_USERNAME = () => process.env.TELEGRAM_BOT_USERNAME?.trim() ?? '';
export const APP_SHORT_NAME = () => process.env.TELEGRAM_APP_SHORT_NAME?.trim() ?? '';
export const SESSION_SECRET = () => process.env.SESSION_SECRET?.trim() || 'anything-fishing-dev-secret';
export const DEV_AUTH = () => process.env.ALLOW_DEV_AUTH === '1' || process.env.NODE_ENV !== 'production';
