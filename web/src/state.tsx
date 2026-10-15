/** API-клиент + глобальное состояние приложения. */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { haptic, setHaptics, tgData, tgInit, tgUser } from './telegram';

const TOKEN_KEY = 'af.session';
const DEV_KEY = 'af.devId';

export function sessionToken(): string { return localStorage.getItem(TOKEN_KEY) ?? ''; }
export function setSessionToken(t: string) { localStorage.setItem(TOKEN_KEY, t); }
export function devId(): string {
  let id = localStorage.getItem(DEV_KEY);
  if (!id) { id = 'dev-' + Math.random().toString(36).slice(2, 8); localStorage.setItem(DEV_KEY, id); }
  return id;
}

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string, public payload?: any) { super(message); }
}

export async function api<T = any>(path: string, init: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = { 'content-type': 'application/json', ...(init.headers as any) };
  const t = sessionToken();
  if (t) headers['authorization'] = `Bearer ${t}`;
  const id = tgData();
  if (id) headers['x-af-initdata'] = id;
  headers['x-af-dev'] = devId();
  const res = await fetch(`./api${path}`, { ...init, headers });
  const text = await res.text();
  let json: any = null;
  try { json = text ? JSON.parse(text) : null; } catch { json = { raw: text }; }
  if (!res.ok) throw new ApiError(res.status, json?.error ?? 'error', json?.message ?? json?.error ?? `HTTP ${res.status}`, json);
  return json as T;
}

export const get = <T = any,>(p: string) => api<T>(p);
export const post = <T = any,>(p: string, body?: unknown) => api<T>(p, { method: 'POST', body: JSON.stringify(body ?? {}) });

export async function authenticate(): Promise<any> {
  const initData = tgData();
  const body: any = { initData };
  if (!initData) { body.devId = devId(); body.name = 'Тестовый рыбак'; }
  const r = await post<any>('/auth', body);
  setSessionToken(r.token);
  return r;
}

export function wsUrl(castId: string): string {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  const base = import.meta.env.DEV ? `${location.hostname}:8787` : location.host;
  const t = encodeURIComponent(sessionToken());
  const dev = encodeURIComponent(devId());
  return `${proto}://${base}/ws?token=${t}&castId=${encodeURIComponent(castId)}&dev=${dev}`;
}

// ─────────────────────────────── состояние ───────────────────────────────
interface Toast { id: number; text: string; kind: 'ok' | 'warn' | 'err' }

export interface ClientSettings {
  fishApproachAnim: boolean;
  waterEffects: 'high' | 'eco';
  aiTips: boolean;
  aiGearWarning: boolean;
  hapticsIntensity: 'light' | 'medium' | 'heavy';
}

const DEFAULT_SETTINGS: ClientSettings = {
  fishApproachAnim: true,
  waterEffects: 'high',
  aiTips: true,
  aiGearWarning: true,
  hapticsIntensity: 'medium',
};

const CLIENT_SETTINGS_KEY = 'af.client_settings';

interface AppCtx {
  player: any;
  content: any;
  museum: any;
  loading: boolean;
  fatal: string | null;
  tab: string;
  setTab: (t: string) => void;
  location: string;
  setLocation: (l: string) => void;
  toasts: Toast[];
  toast: (text: string, kind?: Toast['kind']) => void;
  refresh: () => Promise<void>;
  /** выполняет запрос, обновляет игрока из ответа и возвращает результат */
  act: <T = any>(path: string, body?: unknown) => Promise<T>;
  applyPlayer: (p: any) => void;
  baseView: string | null;
  setBaseView: (v: string | null) => void;
  showSettings: boolean;
  setShowSettings: (v: boolean) => void;
  clientSettings: ClientSettings;
  updateClientSettings: (part: Partial<ClientSettings>) => void;
}

const Ctx = createContext<AppCtx>(null as any);
export const useApp = () => useContext(Ctx);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [player, setPlayer] = useState<any>(null);
  const [content, setContent] = useState<any>(null);
  const [museum, setMuseum] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [fatal, setFatal] = useState<string | null>(null);
  const [tab, setTab] = useState('fish');
  const [location, setLocation] = useState('lake');
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [baseView, setBaseView] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [clientSettings, setClientSettings] = useState<ClientSettings>(() => {
    try {
      const saved = localStorage.getItem(CLIENT_SETTINGS_KEY);
      return saved ? { ...DEFAULT_SETTINGS, ...JSON.parse(saved) } : DEFAULT_SETTINGS;
    } catch { return DEFAULT_SETTINGS; }
  });
  const seq = useRef(0);

  const updateClientSettings = useCallback((part: Partial<ClientSettings>) => {
    setClientSettings((prev) => {
      const next = { ...prev, ...part };
      try { localStorage.setItem(CLIENT_SETTINGS_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }, []);

  const toast = useCallback((text: string, kind: Toast['kind'] = 'ok') => {
    const id = ++seq.current;
    setToasts((t) => [...t, { id, text, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3600);
  }, []);

  const applyPlayer = useCallback((p: any) => {
    if (!p) return;
    setPlayer(p);
    setHaptics(p.settings?.haptics !== false);
    try { (window as any).Telegram?.WebApp?.setHeaderColor?.(p.base?.theme === 'cos_night_neon' ? '#1a0f2e' : '#07131c'); } catch { /* noop */ }
  }, []);

  const refresh = useCallback(async () => {
    const [me, c] = await Promise.all([get('/me'), get('/content')]);
    applyPlayer(me.player);
    setContent(c);
    if (!museum) { try { setMuseum(await get('/museum')); } catch { /* ignore */ } }
  }, [applyPlayer, museum]);

  useEffect(() => {
    let alive = true;
    (async () => {
      tgInit();
      try {
        const r = await authenticate();
        if (!alive) return;
        applyPlayer(r.player);
        setContent(await get('/content'));
        setMuseum(await get('/museum'));
        if (r.player?.locations?.length) setLocation((prev) => (r.player.locations.includes(prev) ? prev : r.player.locations[r.player.locations.length - 1]));
      } catch (e) {
        if (!alive) return;
        const err = e as ApiError;
        setFatal(err.status === 401
          ? 'Не удалось авторизоваться. Откройте приложение через Telegram-бота или включите ALLOW_DEV_AUTH=1 для локального теста.'
          : `Сервер недоступен: ${err.message}. Проверьте, что backend запущен (npm start) и переменные окружения заданы.`);
      } finally { if (alive) setLoading(false); }
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const act = useCallback(async <T,>(path: string, body?: unknown): Promise<T> => {
    try {
      const r = await post<T>(path, body);
      const p = (r as any)?.player;
      if (p) applyPlayer(p);
      return r;
    } catch (e) {
      const err = e as ApiError;
      haptic.error();
      toast(err.message || 'Ошибка', 'err');
      throw err;
    }
  }, [applyPlayer, toast]);

  const value = useMemo<AppCtx>(() => ({
    player, content, museum, loading, fatal, tab, setTab, location, setLocation, toasts, toast, refresh, act, applyPlayer, baseView, setBaseView,
    showSettings, setShowSettings, clientSettings, updateClientSettings,
  }), [player, content, museum, loading, fatal, tab, location, toasts, toast, refresh, act, applyPlayer, baseView, showSettings, clientSettings, updateClientSettings]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function referalLink(): string {
  const u = tgUser();
  const bot = (window as any).__AF_BOT__ || '';
  const app = (window as any).__AF_APP__ || '';
  const ref = u?.id ? `?startapp=ref_${u.id}` : '';
  if (bot && app) return `https://t.me/${bot}/${app}${ref}`;
  if (bot) return `https://t.me/${bot}${ref}`;
  return location.origin;
}
