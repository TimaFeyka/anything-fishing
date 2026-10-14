import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Glyph, ItemArt, WaterScene } from '../art';
import { Bar, ItemTile, Modal, MutationTag, RarityTag, Section, Stars, fmtNum, fmtW } from '../components';
import { get, post, useApp, wsUrl } from '../state';
import { haptic, showAlert } from '../telegram';
import { ItemActions, MassSell } from './ItemActions';
import { applyPhysics, PHYS, type PhysicsCore } from '@shared/physics';

type Phase = 'idle' | 'hints' | 'fight' | 'result';

export function FishingScreen() {
  const { player, content, location, setLocation, act, toast, setBaseView } = useApp();
  const [castType, setCastType] = useState('normal');
  const [cast, setCast] = useState<any>(null);
  const [phase, setPhase] = useState<Phase>('idle');
  const [result, setResult] = useState<any>(null);
  const [shore, setShore] = useState(false);
  const [showSell, setShowSell] = useState(false);
  const [showInv, setShowInv] = useState(false);
  const [openUid, setOpenUid] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const touchY = useRef<number | null>(null);

  const loc = content?.locations?.find((l: any) => l.id === location);
  const baitDef = content?.gear?.find((g: any) => g.id === player.loadout?.bait);
  const baitLeft = baitDef?.consumable ? (player.supplies?.[baitDef.id] ?? 0) : '∞';

  const doCast = async () => {
    setBusy(true);
    try {
      const r = await act<any>('/cast', { locationId: location, castType });
      setCast(r);
      setPhase('hints');
      haptic.light();
      if (r.hints?.giant) haptic.colossal();
    } catch { /* тост показан */ } finally { setBusy(false); }
  };

  const onSwipe = (dy: number) => {
    if (Math.abs(dy) < 45) return;
    setShore(dy < 0);
    haptic.select();
  };

  return (
    <div className="screen" onTouchStart={(e) => { touchY.current = e.touches[0].clientY; }} onTouchEnd={(e) => { if (touchY.current != null) onSwipe(e.changedTouches[0].clientY - touchY.current); touchY.current = null; }}>
      <div className="row between" style={{ marginBottom: 8 }}>
        <div>
          <h1 style={{ margin: 0 }}>{loc?.name ?? 'Локация'}</h1>
          <div className="dim" style={{ fontSize: 12 }}>{loc?.desc}</div>
        </div>
        <div className="col" style={{ alignItems: 'flex-end', gap: 2 }}>
          <span className="pill"><Glyph name="coin" size={13} /> {fmtNum(player.coins)}</span>
          <span className="pill">ур. {player.level}</span>
        </div>
      </div>

      {!shore ? (
        <>
          <div className="scene water">
            <WaterScene
              location={location}
              floatX={50}
              floatY={phase === 'fight' ? 58 : 62}
              shadow={phase === 'hints' ? cast?.hints?.silhouetteWidth ?? 0 : phase === 'fight' ? (cast?.hints?.silhouetteWidth ?? 0) * 0.6 : 0}
              glow={(cast?.hints?.tells?.length ?? 0) > 2 ? 0.4 : 0}
              ripples={phase === 'hints' ? 1 : 0}
              reel={phase === 'fight'}
            />
            <div style={{ position: 'absolute', left: 10, right: 10, bottom: 8 }}>
              {phase === 'idle' && (
                <div className="row" style={{ gap: 6 }}>
                  {(content?.castTypes ? Object.entries(content.castTypes) : []).map(([id, c]: any) => (
                    <button key={id} className={`chip ${castType === id ? 'on' : ''}`} onClick={() => { haptic.select(); setCastType(id); }} title={c.desc}>
                      {c.icon} {c.name}
                    </button>
                  ))}
                </div>
              )}
              {phase === 'hints' && <div className="pill" style={{ background: '#0b1e2bee' }}>Поклёвка! Подсекайте, пока не ушло.</div>}
              {phase === 'fight' && <div className="pill" style={{ background: '#0b1e2bee' }}>Борьба идёт — управляйте натяжением ниже</div>}
            </div>
          </div>

          <div className="row between mt" style={{ gap: 8 }}>
            <span className="pill">Наживка: {baitDef?.name ?? '—'} · {baitLeft}</span>
            <span className="pill">Снасть: {Math.min(content?.gear?.find((g: any) => g.id === player.loadout?.rod)?.maxLoad ?? 4, content?.gear?.find((g: any) => g.id === player.loadout?.line)?.maxLoad ?? 2)} кг</span>
            <button className="btn tiny ghost" onClick={() => { setShore(true); haptic.select(); }}>На берег <Glyph name="back" size={14} /></button>
          </div>
        </>
      ) : (
        <ShoreView onBack={() => setShore(false)} />
      )}

      {!shore && (
        <div className="card mt">
          {phase === 'idle' && (
            <>
              <div className="row between">
                <div>
                  <h3 style={{ margin: 0 }}>Заброс</h3>
                  <div className="dim" style={{ fontSize: 12 }}>{castTypeDesc(content, castType)}</div>
                </div>
                <button className="btn primary" disabled={busy} onClick={doCast}>Забросить</button>
              </div>
              <div className="row wrap mt" style={{ gap: 6 }}>
                <button className="btn sm ghost" onClick={() => setShowSell(true)}><Glyph name="coin" size={15} /> Торговец</button>
                <button className="btn sm ghost" onClick={() => setShowInv(true)}><Glyph name="book" size={15} /> Инвентарь ({player.items.length})</button>
                <button className="btn sm ghost" onClick={() => setBaseView('base')}><Glyph name="home" size={15} /> База</button>
              </div>
            </>
          )}

          {phase === 'hints' && cast && (
            <>
              <h3>Неизвестный силуэт</h3>
              <div className="col" style={{ gap: 6 }}>
                <div className="kv"><span>Сложность вываживания</span><span><Stars n={cast.hints.difficulty} /></span></div>
                <div className="kv"><span>Приблизительный вес</span><span>{cast.hints.weightBand}</span></div>
                <div className="kv"><span>Нагрузка на снасть</span><span className="mono">{Math.round((cast.hints.load ?? 0) * 100)}% от предела</span></div>
                {(cast.hints.load ?? 0) > 1 && <div className="warnbox">Снасть слабовата: леска может не выдержать. Есть шанс, но нужен идеальный контроль натяжения.</div>}
                <div className="mt">
                  <div className="dim" style={{ fontSize: 12 }}>Следы на воде:</div>
                  {cast.hints.tells.map((t: string, i: number) => <div key={i}>· {t}</div>)}
                </div>
                {cast.hints.rewardCount > 1 && <div className="pill">Похоже, на крючке что-то ещё — двойная поклёвка!</div>}
                {cast.hints.giant && <div className="warnbox">Это событие «Что-то огромное на крючке». Готовьтесь к многоэтапной борьбе.</div>}
              </div>
              <div className="row mt" style={{ gap: 8 }}>
                <button className="btn primary grow" onClick={() => { setPhase('fight'); haptic.medium(); }}>Подсечь!</button>
                <button className="btn ghost" onClick={() => { setCast(null); setPhase('idle'); toast('Отпустили. Поклёвка ушла.', 'warn'); }}>Отпустить</button>
              </div>
            </>
          )}

          {phase === 'fight' && cast && (
            <FightOverlay cast={cast} onResolved={(r) => { setResult(r); setPhase('result'); }} />
          )}

          {phase === 'result' && result && (
            <ResultPanel result={result} cast={cast} onClose={() => { setPhase('idle'); setCast(null); setResult(null); }} onOpenItem={setOpenUid} />
          )}
        </div>
      )}

      {showSell && <MassSell onClose={() => setShowSell(false)} />}
      {showInv && (
        <Modal open onClose={() => setShowInv(false)} title={`Инвентарь · ${player.items.length}`}>
          {player.items.length === 0 && <div className="dim">Пока пусто. Забросьте удочку!</div>}
          <div className="grid">
            {player.items.map((i: any) => <ItemTile key={i.uid} item={i} content={content} onClick={() => setOpenUid(i.uid)} />)}
          </div>
        </Modal>
      )}
      {openUid && <ItemActions uid={openUid} onClose={() => setOpenUid(null)} />}
    </div>
  );
}

function castTypeDesc(content: any, id: string): string {
  const c = content?.castTypes?.[id];
  return c?.desc ?? '';
}

// ─────────────────────────────── Берег: вход в базу ───────────────────────────────
function ShoreView({ onBack }: { onBack: () => void }) {
  const { setBaseView, player, content } = useApp();
  const buildings = [
    { id: 'workshop', name: 'Мастерская', desc: 'Крафт, ремонт и улучшение снастей', icon: 'hammer' },
    { id: 'lab', name: 'Лаборатория', desc: 'Исследование неизвестных предметов', icon: 'flask' },
    { id: 'pavilion', name: 'Выставочный павильон', desc: 'Экспонаты, аквариумы и витрины', icon: 'home' },
    { id: 'terminal', name: 'Терминал', desc: 'Рынок, аукцион, Скупщик, рейтинг баз', icon: 'shop' },
  ];
  return (
    <div className="scene shore" style={{ background: 'linear-gradient(180deg,#0a1c27,#07131c)' }}>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
        <rect width="100" height="100" fill="#07131c" />
        <path d="M0 62 C20 54 40 64 60 58 C78 52 90 60 100 56 L100 100 L0 100 Z" fill="#0d2a1e" />
        <path d="M0 70 C26 64 40 74 66 68 C82 64 92 70 100 66 L100 100 L0 100 Z" fill="#123a2b" />
        {[10, 30, 50, 70, 90].map((x, i) => (
          <g key={x} transform={`translate(${x} ${58 - (i % 2) * 2})`}>
            <rect x="-6" y="-8" width="12" height="10" fill="#173447" stroke="#2b6b8c" strokeWidth="0.4" />
            <path d="M-8 -8 L0 -15 L8 -8 Z" fill="#2b6b8c" />
            <rect x="-1.5" y="-4" width="3" height="3" fill="#ffb038" opacity="0.8" />
          </g>
        ))}
      </svg>
      <div style={{ position: 'absolute', inset: 0, padding: 10, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
        <div className="row between" style={{ marginBottom: 6 }}>
          <span className="pill">{player.base.name} · уровень {player.base.level}</span>
          <button className="btn tiny ghost" onClick={onBack}>К воде <Glyph name="back" size={13} style={{ transform: 'rotate(180deg)' }} /></button>
        </div>
        <div className="row wrap" style={{ gap: 6 }}>
          {buildings.map((b) => (
            <button key={b.id} className="btn sm" style={{ background: '#0b1e2bee' }} onClick={() => { haptic.medium(); setBaseView(b.id); }}>
              <Glyph name={b.icon} size={15} /> {b.name}
            </button>
          ))}
        </div>
        <div className="dim mt" style={{ fontSize: 11 }}>
          {content ? 'Свайп вниз — вернуться к воде. Экспонатов: ' + player.base.slots.filter((s: any) => s.itemUid).length : ''}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────── Мини-игра вываживания ───────────────────────────────
function FightOverlay({ cast, onResolved }: { cast: any; onResolved: (r: any) => void }) {
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

  const applyServerState = useCallback((s: any) => {
    if (!s) return;
    coreRef.current = {
      t: s.t, tension: s.tension, progress: s.progress, integrity: s.integrity, stamina: s.stamina, slack: s.slack ?? 0,
    };
    serverT.current = s.t;
    nextRef.current = s.next ? { startAt: s.t + s.next.startsInMs, durationMs: s.next.durationMs, power: s.next.power, kind: s.next.kind } : null;
    if (s.next?.kind) setKind(s.next.kind);
  }, []);

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

  // WebSocket: авторитетная симуляция на сервере
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

  // Локальный цикл: предсказание анимации между серверными подтверждениями
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
    }, 55);
    return () => clearInterval(id);
  }, [params, finish]);

  // HTTP-резерв, когда WebSocket недоступен
  useEffect(() => {
    if (mode !== 'http' || endedRef.current) return;
    const id = setInterval(async () => {
      try {
        const r = await get<any>(`/cast/${cast.castId}/state`);
        applyServerState(r.state);
        if (r.done && r.outcome) finish(r.outcome);
      } catch { /* сеть моргнула — не критично */ }
    }, 350);
    return () => clearInterval(id);
  }, [mode, cast.castId, applyServerState, finish]);

  const setReel = async (on: boolean) => {
    if (endedRef.current) return;
    reelRef.current = on;
    haptic.select();
    const t = Math.round(serverT.current);
    actionsRef.current.push({ a: on ? 'REEL' : 'RELEASE', t });
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

  // Пробел/тап для десктопа
  useEffect(() => {
    const down = (e: KeyboardEvent) => { if (e.code === 'Space' && !e.repeat) { e.preventDefault(); void setReel(true); } };
    const up = (e: KeyboardEvent) => { if (e.code === 'Space') { e.preventDefault(); void setReel(false); } };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const tensionPct = Math.round(view.tension * 100);
  const danger = view.tension > PHYS.IDEAL_MAX;

  return (
    <div className="fight-bars" style={{ background: 'rgba(7,19,28,.86)', borderRadius: 14, padding: 10, border: '1px solid #1b4055' }}>
      <div className="row between" style={{ fontSize: 12 }}>
        <span className="pill">{mode === 'ws' ? 'авторитетный режим' : 'резервный режим (HTTP)'}</span>
        <span className="pill">{kindLabel(kind)}</span>
        {outcome && <span className="pill">{outcome === 'land' ? 'вытащено!' : 'сорвалось'}</span>}
      </div>
      <Bar label="Натяжение лески" value={view.tension} max={PHYS.TENSION_MAX} color={danger ? '#ff5f6d' : view.tension < PHYS.IDEAL_MIN ? '#57a8ff' : '#5fd68a'} band={[PHYS.IDEAL_MIN, PHYS.IDEAL_MAX]} />
      <Bar label="Подтягивание" value={view.progress} color="#57d0ff" />
      <Bar label="Прочность лески" value={view.integrity} color={view.integrity < 0.35 ? '#ff5f6d' : '#ffb038'} height={8} />
      <Bar label="Силы добычи" value={view.stamina} color="#b46bff" height={8} />
      <button
        className={`hold ${reelRef.current ? 'on' : ''} ${tensionPct > 85 ? 'release' : ''}`}
        onPointerDown={(e) => { e.preventDefault(); void setReel(true); }}
        onPointerUp={() => void setReel(false)}
        onPointerLeave={() => void setReel(false)}
        onPointerCancel={() => void setReel(false)}
        onContextMenu={(e) => e.preventDefault()}
      >
        {view.tension < 0.15 ? 'ДЕРЖАТЬ — ПОДТЯГИВАТЬ' : tensionPct > 85 ? 'ОТПУСТИТЕ ЛЕСКУ!' : 'ДЕРЖАТЬ'}
      </button>
      <div className="dim" style={{ fontSize: 11, textAlign: 'center' }}>Держите натяжение в зелёной зоне. Прочность лески не восстанавливается.</div>
    </div>
  );
}

function kindLabel(k: string): string {
  switch (k) {
    case 'calm': return 'затишье';
    case 'pull': return 'тянет';
    case 'surge': return 'рывок!';
    case 'run': return 'уходит на глубину!';
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
          <h3 style={{ color: '#ff5f6d' }}>{local.reason === 'break' ? 'Леска не выдержала' : local.reason === 'slip' ? 'Добыча сошла с крючка' : 'Добыча ушла'}</h3>
          <div className="dim">
            {local.reason === 'break'
              ? 'Что-то очень тяжёлое сорвалось. Известно лишь приблизительно: ' + (cast?.hints?.weightBand ?? 'тяжёлое') + '. Улучшите удочку, леску и катушку, чтобы удержать такое.'
              : local.reason === 'slip'
                ? 'Слишком долго держали леску без натяжения — крючок вышел. Держите натяжение в рабочей зоне.'
                : 'Борьба затянулась, добыча ушла на глубину. Старайтесь подтягивать активнее.'}
          </div>
          <div className="row mt" style={{ gap: 8 }}>
            <button className="btn primary grow" onClick={onClose}>Ещё заброс</button>
          </div>
        </>
      ) : (
        <>
          <div className="row between">
            <h3 style={{ margin: 0 }}>{rewards.length > 1 ? 'Двойная поклёвка!' : 'Добыча на берегу'}</h3>
            <span className="pill">+{local.xp} опыта</span>
          </div>
          <div className="col mt" style={{ gap: 8 }}>
            {rewards.map((item: any) => {
              const def = item.def ?? content?.items?.find((x: any) => x.id === item.itemId);
              const r = content?.rarity?.[item.rarity];
              return (
                <div key={item.uid} className="card tight" style={{ borderColor: r?.color, boxShadow: `0 0 18px -8px ${r?.color}` }}>
                  <div className="row" style={{ gap: 10 }}>
                    <ItemArt kind={def?.art} pal={def?.pal} pat={def?.pat} mutation={item.mutation} rarityColor={r?.color} size={78} />
                    <div className="grow">
                      <div className="row wrap" style={{ gap: 5 }}>
                        <RarityTag rarity={item.rarity} content={content} />
                        <MutationTag mutation={item.mutation} content={content} />
                      </div>
                      <h3 style={{ margin: '4px 0 2px' }}>{def?.name}</h3>
                      <div className="dim" style={{ fontSize: 12 }}>{fmtW(item.weightG)} · {item.lengthCm} см · {fmtNum(item.value)} ¢</div>
                      {item.serial && <div className="badge-s mono mt" style={{ color: r?.color }}>Серверный номер #{String(item.serial.no).padStart(3, '0')} из {item.serial.total}</div>}
                    </div>
                  </div>
                  <div className="row mt" style={{ gap: 6 }}>
                    <button className="btn tiny grow" onClick={() => onOpenItem(item.uid)}>Действия</button>
                    <button className="btn tiny grow" onClick={() => onOpenItem(item.uid)}>Продать / рынок</button>
                  </div>
                </div>
              );
            })}
          </div>
          {local.unlocked?.length > 0 && (
            <div className="warnbox mt">
              Достижения: {local.unlocked.map((id: string) => content?.achievements?.find((a: any) => a.id === id)?.name ?? id).join(', ')}
            </div>
          )}
          <div className="row mt" style={{ gap: 8 }}>
            <button className="btn primary grow" onClick={onClose}>Забрать и продолжить</button>
          </div>
          <div className="dim mt" style={{ fontSize: 12 }}>
            Инвентарь: {player.items.length} предметов · рекорд веса: {player.records?.heaviest ? `${player.records.heaviest.name} (${fmtW(player.records.heaviest.w)})` : '—'}
          </div>
        </>
      )}
    </div>
  );
}

export { Section };
