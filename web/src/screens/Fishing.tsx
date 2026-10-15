import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Glyph, ItemArt, WaterScene } from '../art';
import { Bar, ItemTile, Modal, MutationTag, RarityTag, Section, Stars, fmtNum, fmtW } from '../components';
import { get, post, useApp, wsUrl } from '../state';
import { haptic, showAlert } from '../telegram';
import { ItemActions } from './ItemActions';
import { applyPhysics, PHYS, type PhysicsCore } from '@shared/physics';

type Phase = 'idle' | 'hints' | 'fight' | 'result';

export function FishingScreen() {
  const { player, content, location, act, toast, setShowSettings, clientSettings } = useApp();
  const [castType, setCastType] = useState('normal');
  const [cast, setCast] = useState<any>(null);
  const [phase, setPhase] = useState<Phase>('idle');
  const [result, setResult] = useState<any>(null);
  const [openUid, setOpenUid] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [fightTick, setFightTick] = useState<any>(null);

  const loc = content?.locations?.find((l: any) => l.id === location);
  const baitDef = content?.gear?.find((g: any) => g.id === player.loadout?.bait);
  const baitLeft = baitDef?.consumable ? (player.supplies?.[baitDef.id] ?? 0) : '∞';
  const rodDef = content?.gear?.find((g: any) => g.id === player.loadout?.rod);
  const lineDef = content?.gear?.find((g: any) => g.id === player.loadout?.line);
  const maxLoad = Math.min(rodDef?.maxLoad ?? 4, lineDef?.maxLoad ?? 2);

  const doCast = async () => {
    setBusy(true);
    setFightTick(null);
    try {
      const r = await act<any>('/cast', { locationId: location, castType });
      setCast(r);
      setPhase('hints');
      haptic.light();
      if (r.hints?.giant) haptic.colossal();
    } catch { /* toast */ } finally { setBusy(false); }
  };

  const cancelCast = () => {
    setCast(null);
    setPhase('idle');
    setFightTick(null);
    haptic.select();
    toast('Отпустили. Поклёвка ушла.', 'warn');
  };

  return (
    <div className="screen">
      {/* ─── ВЕРХНЯЯ ШАПКА ─── */}
      <div className="row between" style={{ marginBottom: 12 }}>
        <div>
          <div className="row" style={{ gap: 6, alignItems: 'center' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#38bdf8', boxShadow: '0 0 10px #38bdf8' }} />
            <h1 style={{ margin: 0, fontSize: 19, letterSpacing: '-0.3px', fontWeight: 800 }}>{loc?.name ?? 'Локация'}</h1>
            <span className="badge-s" style={{ fontSize: 10, padding: '2px 6px', color: '#38bdf8', borderColor: 'rgba(56,189,248,0.3)' }}>
              гл. {loc?.depth ?? 0}
            </span>
          </div>
          <div className="dim" style={{ fontSize: 12, marginTop: 2 }}>{loc?.desc}</div>
        </div>
        <div className="row" style={{ gap: 6, alignItems: 'center' }}>
          <span className="pill" style={{ color: '#fbbf24', borderColor: 'rgba(251,191,36,0.35)', fontWeight: 600 }}>
            <Glyph name="coin" size={13} color="#fbbf24" /> {fmtNum(player.coins)}
          </span>
          <span className="pill" style={{ color: '#e0f2fe' }}>ур. {player.level}</span>
          <button
            className="btn tiny ghost"
            onClick={() => { haptic.select(); setShowSettings(true); }}
            title="Настройки и ИИ-Ассистент"
            style={{
              padding: '6px 9px',
              borderRadius: 11,
              background: 'rgba(14,36,50,0.7)',
              borderColor: 'rgba(56,189,248,0.3)',
              boxShadow: '0 0 10px rgba(56,189,248,0.15)',
            }}
          >
            <Glyph name="settings" size={17} color="#38bdf8" />
          </button>
        </div>
      </div>

      {/* ─── СЦЕНА ВОДЫ С ЖИВОЙ АНИМАЦИЕЙ ДВИЖЕНИЯ РЫБЫ ─── */}
      <div
        className={`scene water ${phase === 'fight' ? 'short' : ''}`}
        style={{
          boxShadow: '0 12px 36px -12px rgba(0,0,0,0.75), inset 0 0 0 1px rgba(56,189,248,0.2)',
          borderRadius: 20,
        }}
      >
        <WaterScene
          location={location}
          phase={phase}
          progress={phase === 'fight' ? (fightTick?.progress ?? 0) : phase === 'result' && result?.ok ? 1 : 0}
          tension={fightTick?.tension ?? 0.15}
          isReeling={fightTick?.isReeling ?? false}
          kind={fightTick?.kind ?? 'calm'}
          shadow={cast?.hints?.silhouetteWidth ?? 0.35}
          glow={(cast?.hints?.tells?.length ?? 0) > 2 ? 0.45 : 0}
          ripples={phase === 'hints' ? 1.5 : 0}
          time={fightTick?.t ?? 0}
          giant={!!cast?.hints?.giant}
          landed={phase === 'result' && result?.ok}
        />

        {/* HUD на воде */}
        <div style={{ position: 'absolute', left: 10, right: 10, bottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          {phase === 'idle' && (
            <div className="chips" style={{ width: '100%' }}>
              {(content?.castTypes ? Object.entries(content.castTypes) : []).map(([id, c]: any) => (
                <button
                  key={id}
                  className={`chip ${castType === id ? 'on' : ''}`}
                  onClick={() => { haptic.select(); setCastType(id); }}
                  title={c.desc}
                  style={{ backdropFilter: 'blur(8px)', background: castType === id ? undefined : 'rgba(11,30,43,0.85)' }}
                >
                  {c.icon} {c.name}
                </button>
              ))}
            </div>
          )}
          {phase === 'hints' && (
            <div className="pill" style={{ background: 'rgba(7,22,32,0.92)', backdropFilter: 'blur(8px)', borderColor: '#38bdf8', color: '#e0f2fe' }}>
              🎣 Поклёвка! Подсекайте, пока не сорвалось!
            </div>
          )}
          {phase === 'fight' && fightTick && (
            <div className="row between grow" style={{ width: '100%' }}>
              <span className="pill" style={{ background: 'rgba(7,22,32,0.92)', backdropFilter: 'blur(8px)', color: '#38bdf8' }}>
                Поведение: {kindLabel(fightTick.kind)}
              </span>
              <span className="pill" style={{ background: 'rgba(7,22,32,0.92)', backdropFilter: 'blur(8px)', color: '#4ade80', fontWeight: 600 }}>
                До берега: {Math.max(0, Math.round((1 - (fightTick.progress ?? 0)) * 28))} м
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ─── СТАТУС СНАСТЕЙ (БЕЗ КНОПКИ "НА БЕРЕГ") ─── */}
      <div className="row wrap between mt" style={{ gap: 8 }}>
        <span className="pill" style={{ background: 'rgba(11,30,43,0.7)', borderColor: 'rgba(56,189,248,0.2)' }}>
          🪱 Наживка: <b style={{ color: '#e0f2fe' }}>{baitDef?.name ?? '—'}</b> · {baitLeft}
        </span>
        <span className="pill" style={{ background: 'rgba(11,30,43,0.7)', borderColor: 'rgba(56,189,248,0.2)' }}>
          🎣 Предел снасти: <b style={{ color: '#e0f2fe' }}>{maxLoad} кг</b>
        </span>
      </div>

      {/* ─── ОСНОВНОЙ КАРТОЧНЫЙ БЛОК ─── */}
      <div
        className="card mt"
        style={{
          background: 'linear-gradient(180deg, rgba(18,48,63,0.95), rgba(14,36,50,0.95))',
          borderColor: 'rgba(56,189,248,0.2)',
          boxShadow: '0 8px 30px -12px rgba(0,0,0,0.6)',
          borderRadius: 18,
        }}
      >
        {/* ФАЗА IDLE: ЗАБРОС */}
        {phase === 'idle' && (
          <div className="col" style={{ gap: 10 }}>
            <div className="row between">
              <div>
                <h3 style={{ margin: 0, fontSize: 16, color: '#e0f2fe' }}>Заброс снасти</h3>
                <div className="dim" style={{ fontSize: 12, marginTop: 2 }}>{castTypeDesc(content, castType)}</div>
              </div>
              <button
                className="btn primary"
                disabled={busy}
                onClick={doCast}
                style={{
                  minWidth: 126,
                  padding: '11px 18px',
                  boxShadow: '0 0 18px rgba(14,165,233,0.35)',
                  fontSize: 15,
                }}
              >
                <Glyph name="fish" size={17} /> Забросить
              </button>
            </div>
          </div>
        )}

        {/* ФАЗА HINTS: ПОКЛЁВКА И НЕИЗВЕСТНЫЙ СИЛУЭТ */}
        {phase === 'hints' && cast && (
          <div className="col" style={{ gap: 10 }}>
            <div className="row between">
              <div className="row" style={{ gap: 6, alignItems: 'center' }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#ffb038', boxShadow: '0 0 10px #ffb038' }} />
                <h3 style={{ margin: 0, fontSize: 16, color: '#e0f2fe' }}>Неизвестный силуэт</h3>
              </div>
              <span className="badge-s" style={{ color: '#38bdf8', borderColor: 'rgba(56,189,248,0.3)' }}>Сонар активен</span>
            </div>

            <div className="col" style={{ gap: 6, background: 'rgba(7,22,32,0.6)', padding: 10, borderRadius: 12, border: '1px solid rgba(56,189,248,0.15)' }}>
              <div className="kv"><span>Сложность вываживания</span><span><Stars n={cast.hints.difficulty} /></span></div>
              <div className="kv"><span>Приблизительный вес</span><span style={{ fontWeight: 600, color: '#e0f2fe' }}>{cast.hints.weightBand}</span></div>
              <div className="kv">
                <span>Нагрузка на снасть</span>
                <span className="mono" style={{ color: (cast.hints.load ?? 0) > 1 ? '#ff5f6d' : '#4ade80', fontWeight: 700 }}>
                  {Math.round((cast.hints.load ?? 0) * 100)}% от предела
                </span>
              </div>

              {(cast.hints.load ?? 0) > 1 && (
                <div className="warnbox" style={{ marginTop: 4 }}>
                  ⚠️ Снасть слабовата: нагрузка превышает предел лески ({maxLoad} кг). Вытащить возможно только при безупречном контроле зеленой зоны!
                </div>
              )}

              {clientSettings.aiTips && (cast.hints.load ?? 0) > 0.85 && (
                <div className="pill" style={{ color: '#38bdf8', borderColor: 'rgba(56,189,248,0.3)', background: 'rgba(8,26,38,0.85)', padding: '6px 10px', fontSize: 11.5 }}>
                  🤖 <b>Antigravity AI:</b> «Рыба сильная! При первом же рывке сразу отпускай кнопку, иначе леска лопнет за 0.3 секунды.»
                </div>
              )}

              <div className="mt" style={{ paddingTop: 6, borderTop: '1px solid rgba(56,189,248,0.1)' }}>
                <div className="dim" style={{ fontSize: 11, marginBottom: 3 }}>Следы на воде:</div>
                {cast.hints.tells.map((t: string, i: number) => (
                  <div key={i} style={{ fontSize: 12, color: '#93c5fd' }}>• {t}</div>
                ))}
              </div>

              {cast.hints.rewardCount > 1 && (
                <div className="badge-s" style={{ color: '#fbbf24', borderColor: 'rgba(251,191,36,0.3)', background: 'rgba(251,191,36,0.1)' }}>
                  ✨ Двойная поклёвка: на крючке два объекта!
                </div>
              )}
              {cast.hints.giant && (
                <div className="warnbox" style={{ borderColor: '#ec4899', color: '#fbcfe8', background: 'rgba(236,72,153,0.1)' }}>
                  ⚡ Событие «Что-то огромное на крючке»! Готовьтесь к многоэтапной борьбе.
                </div>
              )}
            </div>

            <div className="row mt" style={{ gap: 8 }}>
              <button
                className="btn primary grow"
                onClick={() => { setPhase('fight'); haptic.medium(); }}
                style={{ padding: '13px 18px', fontSize: 16, fontWeight: 800, boxShadow: '0 0 20px rgba(14,165,233,0.4)' }}
              >
                Подсечь!
              </button>
              <button className="btn ghost" onClick={cancelCast}>
                Отпустить
              </button>
            </div>
          </div>
        )}

        {/* ФАЗА FIGHT: АВТОРИТЕТНЫЙ БОЙ */}
        {phase === 'fight' && cast && (
          <FightOverlay
            cast={cast}
            onTick={(tick) => setFightTick(tick)}
            onResolved={(r) => { setResult(r); setPhase('result'); }}
          />
        )}

        {/* ФАЗА RESULT: НАГРАДА */}
        {phase === 'result' && result && (
          <ResultPanel
            result={result}
            cast={cast}
            onClose={() => { setPhase('idle'); setCast(null); setResult(null); setFightTick(null); }}
            onOpenItem={setOpenUid}
          />
        )}
      </div>

      {openUid && <ItemActions uid={openUid} onClose={() => setOpenUid(null)} />}
    </div>
  );
}

function castTypeDesc(content: any, id: string): string {
  const c = content?.castTypes?.[id];
  return c?.desc ?? '';
}

// ─────────────────────────────── Мини-игра вываживания ───────────────────────────────
function FightOverlay({
  cast,
  onTick,
  onResolved,
}: {
  cast: any;
  onTick?: (tick: any) => void;
  onResolved: (r: any) => void;
}) {
  const { toast, refresh } = useApp();
  const [view, setView] = useState({ tension: 0.15, progress: 0, integrity: 1, stamina: 1, slack: 0, t: 0 });
  const [kind, setKind] = useState<string>('calm');
  const [outcome, setOutcome] = useState<string | null>(null);
  const [mode, setMode] = useState<'ws' | 'http'>('ws');

  const coreRef = useRef<PhysicsCore>({ t: 0, tension: 0.15, progress: 0, integrity: 1, stamina: 1, slack: 0 });
  const nextRef = useRef<{ startAt: number; durationMs: number; power: number; kind: string } | null>(null);
  const reelRef = useRef(false);
  const actionsRef = useRef<{ a: string; t: number }[]>([]);
  const endedRef = useRef(false);
  const lastKind = useRef('calm');
  const dangerRef = useRef(false);
  const wsRef = useRef<WebSocket | null>(null);
  const modeRef = useRef<'ws' | 'http'>('ws');
  const serverT = useRef(0);

  const params = useMemo(() => ({
    strength: (cast.hints?.load ?? 1) * (cast.hints?.maxLoad ?? 4),
    maxLoad: cast.hints?.maxLoad ?? 4,
    control: cast.params?.control ?? 1,
    speed: cast.params?.speed ?? 1,
    depth: cast.hints?.depth ?? 1,
    giant: !!cast.hints?.giant,
  }), [cast]);

  const notifyTick = useCallback((c: PhysicsCore, reeling: boolean, currentKind: string) => {
    onTick?.({
      progress: c.progress,
      tension: c.tension,
      isReeling: reeling,
      kind: currentKind,
      t: c.t,
      integrity: c.integrity,
      stamina: c.stamina,
    });
  }, [onTick]);

  const applyServerState = useCallback((s: any) => {
    if (!s) return;
    coreRef.current = {
      t: s.t, tension: s.tension, progress: s.progress, integrity: s.integrity, stamina: s.stamina, slack: s.slack ?? 0,
    };
    serverT.current = s.t;
    nextRef.current = s.next ? { startAt: s.t + s.next.startsInMs, durationMs: s.next.durationMs, power: s.next.power, kind: s.next.kind } : null;
    if (s.next?.kind) {
      setKind(s.next.kind);
      lastKind.current = s.next.kind;
    }
    notifyTick(coreRef.current, reelRef.current, lastKind.current);
  }, [notifyTick]);

  const finish = useCallback(async (out: string) => {
    if (endedRef.current) return;
    endedRef.current = true;
    setOutcome(out);
    haptic[out === 'land' ? 'success' : 'error']();
    try {
      const r = await post<any>(`/cast/${cast.castId}/resolve`, { actions: actionsRef.current });
      onResolved(r);
      refresh().catch(() => {});
    } catch (e) {
      toast((e as Error).message, 'err');
      onResolved({ ok: false, reason: 'timeout', rewards: [], xp: 0, error: (e as Error).message });
    }
  }, [cast.castId, refresh, toast, onResolved]);

  // WebSocket: авторитетная сессия
  useEffect(() => {
    let ws: WebSocket | null = null;
    let disposed = false;
    let opened = false;
    const fallbackTimer = setTimeout(() => { if (!opened && !disposed) { modeRef.current = 'http'; setMode('http'); } }, 2000);
    try {
      ws = new WebSocket(wsUrl(cast.castId));
      wsRef.current = ws;
      ws.onopen = () => { opened = true; modeRef.current = 'ws'; setMode('ws'); };
      ws.onmessage = (ev) => {
        try {
          const m = JSON.parse(ev.data);
          if (m.t === 'init') applyServerState(m.state);
          if (m.t === 'state') {
            applyServerState(m.state);
            if (m.done && m.outcome) { finish(m.outcome); ws?.close(); }
          }
          if (m.t === 'end') finish(m.outcome);
        } catch { /* ignore */ }
      };
      ws.onerror = () => { if (!opened && !disposed) { modeRef.current = 'http'; setMode('http'); } };
      ws.onclose = () => { if (!disposed && !endedRef.current) { modeRef.current = 'http'; setMode('http'); } };
    } catch {
      modeRef.current = 'http';
      setMode('http');
    }
    return () => { disposed = true; clearTimeout(fallbackTimer); try { ws?.close(); } catch { /* noop */ } };
  }, [cast.castId, applyServerState, finish]);

  // Локальный цикл предсказания физики
  useEffect(() => {
    let last = performance.now();
    const id = setInterval(() => {
      const now = performance.now();
      const dt = Math.min(250, now - last);
      last = now;
      if (endedRef.current) return;
      const nx = nextRef.current;
      const t = coreRef.current.t + dt;
      const inEvent = nx && t >= nx.startAt && t < nx.startAt + nx.durationMs;
      const power = inEvent ? nx!.power : 0;
      const r = applyPhysics(coreRef.current, params, dt, reelRef.current, power);
      coreRef.current = r.core;

      notifyTick(r.core, reelRef.current, lastKind.current);

      if (r.outcome) { finish(r.outcome); return; }
      setView({ ...r.core });
      if (inEvent && nx!.kind !== lastKind.current) {
        lastKind.current = nx!.kind;
        setKind(nx!.kind);
        if (nx!.kind === 'run') { haptic.heavy(); haptic.warning(); }
        else if (nx!.kind === 'surge') haptic.medium();
        else if (nx!.kind === 'pull') haptic.light();
      }
      const danger = coreRef.current.tension > 0.9;
      if (danger && !dangerRef.current) { dangerRef.current = true; haptic.warning(); }
      if (!danger) dangerRef.current = false;
    }, 50);
    return () => clearInterval(id);
  }, [params, finish, notifyTick]);

  // HTTP-фолбэк
  useEffect(() => {
    if (mode !== 'http' || endedRef.current) return;
    const id = setInterval(async () => {
      try {
        const r = await get<any>(`/cast/${cast.castId}/state`);
        applyServerState(r.state);
        if (r.done && r.outcome) finish(r.outcome);
      } catch { /* network glitch */ }
    }, 350);
    return () => clearInterval(id);
  }, [mode, cast.castId, applyServerState, finish]);

  const setReel = async (on: boolean) => {
    if (endedRef.current) return;
    reelRef.current = on;
    haptic.select();
    const t = Math.round(serverT.current);
    actionsRef.current.push({ a: on ? 'REEL' : 'RELEASE', t });
    notifyTick(coreRef.current, on, lastKind.current);
    if (modeRef.current === 'ws' && wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ t: 'action', a: on ? 'REEL' : 'RELEASE' }));
    } else {
      try {
        const r = await post<any>(`/cast/${cast.castId}/action`, { a: on ? 'REEL' : 'RELEASE' });
        applyServerState(r.state);
        if (r.done && r.outcome) finish(r.outcome);
      } catch { /* ignore */ }
    }
  };

  useEffect(() => {
    const down = (e: KeyboardEvent) => { if (e.code === 'Space' && !e.repeat) { e.preventDefault(); void setReel(true); } };
    const up = (e: KeyboardEvent) => { if (e.code === 'Space') { e.preventDefault(); void setReel(false); } };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const tensionPct = Math.round(view.tension * 100);
  const isDanger = view.tension > PHYS.IDEAL_MAX;
  const isOptimal = view.tension >= PHYS.IDEAL_MIN && view.tension <= PHYS.IDEAL_MAX;

  return (
    <div className="fight-bars" style={{ background: 'rgba(7,19,28,.92)', borderRadius: 16, padding: 12, border: '1px solid rgba(56,189,248,0.25)', boxShadow: '0 0 24px -10px rgba(56,189,248,0.2)' }}>
      <div className="row between" style={{ fontSize: 12 }}>
        <span className="pill" style={{ color: mode === 'ws' ? '#4ade80' : '#fbbf24' }}>
          {mode === 'ws' ? '● Авторитетный WebSocket' : '● Резервный HTTP'}
        </span>
        <span className="pill" style={{ color: kind === 'surge' || kind === 'run' ? '#f43f5e' : '#38bdf8', fontWeight: 600 }}>
          {kindLabel(kind)}
        </span>
        {outcome && <span className="pill" style={{ color: outcome === 'land' ? '#4ade80' : '#f43f5e', fontWeight: 700 }}>{outcome === 'land' ? 'Вытащено!' : 'Сорвалось'}</span>}
      </div>

      <Bar
        label={`Натяжение лески · ${tensionPct}%`}
        value={view.tension}
        max={PHYS.TENSION_MAX}
        color={isDanger ? '#f43f5e' : view.tension < PHYS.IDEAL_MIN ? '#38bdf8' : '#22c55e'}
        band={[PHYS.IDEAL_MIN, PHYS.IDEAL_MAX]}
      />
      <Bar label={`Подтягивание к берегу · ${Math.round(view.progress * 100)}%`} value={view.progress} color="#38bdf8" />
      <Bar label="Прочность лески" value={view.integrity} color={view.integrity < 0.35 ? '#f43f5e' : '#fbbf24'} height={7} />
      <Bar label="Выносливость рыбы" value={view.stamina} color="#c084fc" height={7} />

      <button
        className={`hold ${reelRef.current ? 'on' : ''} ${isDanger ? 'release' : ''}`}
        onPointerDown={(e) => { e.preventDefault(); void setReel(true); }}
        onPointerUp={() => void setReel(false)}
        onPointerLeave={() => void setReel(false)}
        onPointerCancel={() => void setReel(false)}
        onContextMenu={(e) => e.preventDefault()}
        style={{
          marginTop: 6,
          background: isDanger
            ? 'linear-gradient(180deg, #e11d48, #9f1239)'
            : isOptimal
              ? 'linear-gradient(180deg, #0284c7, #0369a1)'
              : 'linear-gradient(180deg, #0ea5e9, #0284c7)',
          boxShadow: isDanger ? '0 0 24px rgba(225,29,72,0.5)' : isOptimal ? '0 0 20px rgba(14,165,233,0.4)' : undefined,
        }}
      >
        {isDanger ? '⚠️ ОТПУСТИТЕ ЛЕСКУ!' : view.tension < 0.15 ? '⚡ ПОДТЯГИВАЙТЕ — ПРОСАДКА!' : 'ДЕРЖАТЬ В ЗЕЛЕНОЙ ЗОНЕ'}
      </button>
      <div className="dim" style={{ fontSize: 11, textAlign: 'center', marginTop: 2 }}>
        Удерживайте натяжение в зеленой зоне (35–85%). При рывках рыбы немедленно отпускайте!
      </div>
    </div>
  );
}

function kindLabel(k: string): string {
  switch (k) {
    case 'calm': return 'Затишье';
    case 'pull': return 'Тянет';
    case 'surge': return '💥 Рывок!';
    case 'run': return '🌊 Уходит на глубину!';
    default: return k;
  }
}

// ─────────────────────────────── Итог вылова ───────────────────────────────
function ResultPanel({ result, cast, onClose, onOpenItem }: { result: any; cast: any; onClose: () => void; onOpenItem: (uid: string) => void }) {
  const { content, player } = useApp();
  const local = result;

  if (!local) {
    return <div className="col"><div className="spin" style={{ margin: '0 auto' }} /><div className="center dim">Сервер проверяет результат…</div></div>;
  }

  const rewards: any[] = local.rewards ?? [];
  const failed = !local.ok;

  return (
    <div>
      {failed ? (
        <>
          <h3 style={{ color: '#ff5f6d', fontSize: 18 }}>{local.reason === 'break' ? '💥 Леска не выдержала' : local.reason === 'slip' ? 'Срыв с крючка' : 'Добыча ушла'}</h3>
          <div className="dim" style={{ fontSize: 13, lineHeight: 1.4 }}>
            {local.reason === 'break'
              ? 'Что-то очень тяжёлое сорвалось. Известно лишь приблизительно: ' + (cast?.hints?.weightBand ?? 'тяжёлое') + '. Улучшите удочку, леску и катушку в магазине, чтобы удержать такое.'
              : local.reason === 'slip'
                ? 'Слишком долго держали леску без натяжения (более 3.2 сек) — крючок выскочил. Держите леску в натяжении.'
                : 'Борьба затянулась, добыча ушла на глубину. Подтягивайте активнее в зеленой зоне.'}
          </div>
          <div className="row mt" style={{ gap: 8 }}>
            <button className="btn primary grow" onClick={onClose} style={{ padding: '12px' }}>
              Ещё заброс
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="row between">
            <h3 style={{ margin: 0, fontSize: 18, color: '#4ade80' }}>{rewards.length > 1 ? '🎉 Двойная поклёвка!' : '✨ Добыча на берегу!'}</h3>
            <span className="pill" style={{ color: '#38bdf8' }}>+{local.xp} опыта</span>
          </div>
          <div className="col mt" style={{ gap: 8 }}>
            {rewards.map((item: any) => {
              const def = item.def ?? content?.items?.find((x: any) => x.id === item.itemId);
              const r = content?.rarity?.[item.rarity];
              return (
                <div key={item.uid} className="card tight" style={{ borderColor: r?.color, boxShadow: `0 0 20px -8px ${r?.color}`, background: 'rgba(8,26,38,0.9)' }}>
                  <div className="row" style={{ gap: 12 }}>
                    <ItemArt kind={def?.art} pal={def?.pal} pat={def?.pat} mutation={item.mutation} rarityColor={r?.color} size={78} />
                    <div className="grow">
                      <div className="row wrap" style={{ gap: 5 }}>
                        <RarityTag rarity={item.rarity} content={content} />
                        <MutationTag mutation={item.mutation} content={content} />
                      </div>
                      <h3 style={{ margin: '4px 0 2px', fontSize: 16 }}>{def?.name}</h3>
                      <div className="dim" style={{ fontSize: 12 }}>{fmtW(item.weightG)} · {item.lengthCm} см · <b style={{ color: '#fbbf24' }}>{fmtNum(item.value)} ¢</b></div>
                      {item.serial && (
                        <div className="badge-s mono mt" style={{ color: r?.color, borderColor: r?.color }}>
                          Серверный номер #{String(item.serial.no).padStart(3, '0')} из {item.serial.total}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="row mt" style={{ gap: 6 }}>
                    <button className="btn tiny grow" onClick={() => onOpenItem(item.uid)}>Подробнее</button>
                    <button className="btn tiny grow" onClick={() => onOpenItem(item.uid)}>Действия / Продать</button>
                  </div>
                </div>
              );
            })}
          </div>
          {local.unlocked?.length > 0 && (
            <div className="warnbox mt">
              🏆 Открыты достижения: {local.unlocked.map((id: string) => content?.achievements?.find((a: any) => a.id === id)?.name ?? id).join(', ')}
            </div>
          )}
          <div className="row mt" style={{ gap: 8 }}>
            <button className="btn primary grow" onClick={onClose} style={{ padding: '12px' }}>
              Забрать и продолжить
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export { Section };
