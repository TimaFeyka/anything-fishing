import React, { useEffect, useMemo, useState } from 'react';
import { Glyph, ItemArt } from '../art';
import { Bar, ItemTile, Modal, MutationTag, RarityTag, Section, Stars, fmtNum, fmtW } from '../components';
import { get, referalLink, useApp } from '../state';
import { copyText, haptic, showAlert, showConfirm } from '../telegram';
import { ItemActions, fitsSlot, itemSize } from './ItemActions';

const BUILDINGS: Record<string, { name: string; icon: string; desc: string }> = {
  base: { name: 'Моя база', icon: 'home', desc: 'Обзор, название, тема оформления, посещаемость' },
  workshop: { name: 'Мастерская', icon: 'hammer', desc: 'Крафт, ремонт и улучшение снастей' },
  lab: { name: 'Лаборатория', icon: 'flask', desc: 'Исследование неизвестных предметов и восстановление артефактов' },
  pavilion: { name: 'Выставочный павильон', icon: 'home', desc: 'Экспонаты, аквариумы, витрины и площадки' },
  terminal: { name: 'Терминал', icon: 'shop', desc: 'Рынок игроков, аукцион, рейтинг баз и записи' },
};

export function BaseScreen() {
  const { baseView, setBaseView, player, content } = useApp();
  const view = baseView ?? 'base';
  const b = BUILDINGS[view] ?? BUILDINGS.base;

  return (
    <div className="screen">
      <div className="row between">
        <div className="row" style={{ gap: 8 }}>
          <button className="btn sm ghost" onClick={() => { haptic.select(); setBaseView(null); }}><Glyph name="back" size={16} /> К воде</button>
          <h1 style={{ margin: 0 }}>{b.name}</h1>
        </div>
        <span className="pill">ур. базы {player.base.level}</span>
      </div>
      <div className="chips mt">
        {Object.entries(BUILDINGS).map(([id, x]) => (
          <button key={id} className={`chip ${view === id ? 'on' : ''}`} onClick={() => { haptic.select(); setBaseView(id); }}>
            <Glyph name={x.icon} size={13} /> {x.name}
          </button>
        ))}
      </div>
      <div className="dim mt" style={{ fontSize: 12 }}>{b.desc}</div>
      <div className="mt2">
        {view === 'base' && <BaseOverview />}
        {view === 'workshop' && <Workshop />}
        {view === 'lab' && <Lab />}
        {view === 'pavilion' && <Pavilion />}
        {view === 'terminal' && <Terminal />}
      </div>
    </div>
  );
}

// ─────────────────────────────── ОБЗОР БАЗЫ ───────────────────────────────
function BaseOverview() {
  const { player, content, act, toast } = useApp();
  const [name, setName] = useState(player.base.name);
  const exhibits = player.base.slots.filter((s: any) => s.itemUid);
  const rating = player.base.ratingCount ? player.base.ratingSum / player.base.ratingCount : 0;
  const themes = (content?.cosmetics ?? []).filter((c: any) => c.kind === 'base_theme');
  const [board, setBoard] = useState<any>(null);
  useEffect(() => { get('/leaderboard').then(setBoard).catch(() => {}); }, []);

  return (
    <>
      <Section title="Оформление" right={<span className="pill">{fmtNum(player.base.visitors)} посещений</span>}>
        <div className="row" style={{ gap: 8 }}>
          <input className="btn grow" style={{ textAlign: 'left' }} value={name} maxLength={32} onChange={(e) => setName(e.target.value)} />
          <button className="btn sm" onClick={async () => { await act('/base', { name }); toast('Название обновлено'); }}>Сохранить</button>
        </div>
        <div className="row wrap mt" style={{ gap: 6 }}>
          <button className={`chip ${player.base.theme === 'default' ? 'on' : ''}`} onClick={() => act('/base', { theme: 'default' })}>По умолчанию</button>
          {themes.map((t: any) => {
            const owned = player.cosmetics.includes(t.id);
            return (
              <button key={t.id} className={`chip ${player.base.theme === t.id ? 'on' : ''} ${owned ? '' : 'lock'}`} title={owned ? t.desc : 'Купите в магазине за Stars'}
                onClick={() => owned ? act('/base', { theme: t.id }) : toast('Тема не куплена. Оформление продаётся за Telegram Stars в магазине.', 'warn')}>
                {t.name}
              </button>
            );
          })}
        </div>
      </Section>

      <Section title="Экспозиция" right={<span className="pill">{exhibits.length} / {player.base.slots.length}</span>}>
        <Bar value={exhibits.length} max={player.base.slots.length} color="#b46bff" />
        <div className="kv mt"><span>Средняя оценка посетителей</span><span><Stars n={Math.round(rating)} /> {rating ? rating.toFixed(1) : '—'} ({player.base.ratingCount})</span></div>
        <div className="kv"><span>Редчайший экспонат</span><span>{weirdest(player, content)}</span></div>
      </Section>

      <Section title="Глобальный рейтинг баз" right={<button className="btn tiny ghost" onClick={() => get('/leaderboard').then(setBoard)}>Обновить</button>}>
        {(board?.bases ?? []).slice(0, 8).map((p: any, i: number) => (
          <div key={p.id} className="row between" style={{ padding: '4px 0' }}>
            <span className="grow nowrap">{i + 1}. {p.base.name} <span className="dim">({p.name})</span></span>
            <span className="pill">{p.exhibits} эксп. · ★{p.rating || 0}</span>
            <button className="btn tiny" disabled={p.id === player.id} onClick={() => openBase(p.id)}>Посетить</button>
          </div>
        ))}
        {!board && <div className="dim">Загрузка рейтинга…</div>}
      </Section>
    </>
  );
}

function weirdest(player: any, content: any): string {
  const items = player.base.slots.filter((s: any) => s.itemUid).map((s: any) => player.items.find((i: any) => i.uid === s.itemUid)).filter(Boolean);
  if (!items.length) return '—';
  items.sort((a: any, b: any) => (content?.rarity?.[b.rarity]?.order ?? 0) - (content?.rarity?.[a.rarity]?.order ?? 0));
  return `${content?.items?.find((i: any) => i.id === items[0].itemId)?.name} (${content?.rarity?.[items[0].rarity]?.name})`;
}

async function openBase(id: string) {
  try {
    const r = await get<any>(`/base/${id}`);
    showAlert(`${r.base.name}\nВладелец: ${r.base.ownerName} (ур. ${r.base.ownerLevel})\nЭкспонатов: ${r.exhibits.length}\nПосещений: ${r.base.visitors}\nОценка: ${r.rating || '—'}\nКаталог: ${r.museum.discovered}/${r.museum.total}\n\nЭкспонаты:\n${r.exhibits.slice(0, 8).map((e: any) => `· ${e.item.def?.name ?? e.item.itemId} — ${fmtW(e.item.weightG)}`).join('\n')}`);
  } catch { showAlert('Не удалось открыть базу'); }
}

// ─────────────────────────────── МАСТЕРСКАЯ ───────────────────────────────
function Workshop() {
  const { player, content, act, toast } = useApp();
  const [busy, setBusy] = useState('');
  const recipes = content?.recipes ?? [];
  const groups = useMemo(() => {
    const g: Record<string, any[]> = {};
    for (const r of recipes) {
      const out = content?.gear?.find((x: any) => x.id === r.out) ?? content?.materials?.find((x: any) => x.id === r.out);
      const slot = r.kind === 'material' ? 'Материалы и приманки' : (out?.slot ? `Снаряжение · ${slotName(out.slot)}` : 'Снаряжение');
      g[slot] = g[slot] ?? [];
      g[slot].push({ ...r, outName: out?.name ?? r.out });
    }
    return g;
  }, [recipes, content]);

  const craft = async (r: any) => {
    setBusy(r.id);
    try {
      await act('/craft', { recipeId: r.id });
      toast(`Изготовлено: ${r.outName}`);
    } catch { /* toast */ } finally { setBusy(''); }
  };

  return (
    <>
      {Object.entries(groups).map(([name, list]) => (
        <Section key={name} title={name}>
          {list.map((r: any) => {
            const canLevel = player.level >= r.level;
            const canCoins = player.coins >= r.cost;
            const mats = r.need.every(([m, q]: any) => (player.supplies[m] ?? 0) >= q);
            const owned = r.kind === 'gear' && player.ownedGear.includes(r.out);
            return (
              <div key={r.id} className="card tight">
                <div className="row between">
                  <div className="grow">
                    <b style={{ fontSize: 13 }}>{r.outName}</b>
                    <div className="dim" style={{ fontSize: 11 }}>{r.desc}</div>
                  </div>
                  <button className="btn sm" disabled={!canLevel || !canCoins || !mats || busy === r.id || owned} onClick={() => craft(r)}>
                    {owned ? 'есть' : `Собрать · ${fmtNum(r.cost)} ¢`}
                  </button>
                </div>
                <div className="row wrap mt" style={{ gap: 5 }}>
                  <span className="pill" style={{ color: canLevel ? undefined : '#ff5f6d' }}>ур. {r.level}</span>
                  {r.need.map(([m, q]: any) => {
                    const have = player.supplies[m] ?? 0;
                    return <span key={m} className="pill" style={{ color: have >= q ? '#5fd68a' : '#ff5f6d' }}>{content?.materials?.find((x: any) => x.id === m)?.name ?? m} {have}/{q}</span>;
                  })}
                </div>
              </div>
            );
          })}
        </Section>
      ))}
    </>
  );
}

function slotName(s: string): string {
  return ({ rod: 'Удочки', reel: 'Катушки', line: 'Лески', hook: 'Крючки', bait: 'Наживки', net: 'Подсаки', boat: 'Лодки', device: 'Приборы' } as any)[s] ?? s;
}

// ─────────────────────────────── ЛАБОРАТОРИЯ ───────────────────────────────
function Lab() {
  const { player, content, act, toast } = useApp();
  const [busy, setBusy] = useState('');
  const research = content?.research ?? [];
  const run = async (r: any) => {
    setBusy(r.id);
    try {
      const res = await act<any>('/research', { researchId: r.id });
      toast(`Исследование завершено: ${r.name}${res.unlockedGear?.length ? ` · открыто: ${res.unlockedGear.map((g: string) => content?.gear?.find((x: any) => x.id === g)?.name ?? g).join(', ')}` : ''}`);
    } catch { /* toast */ } finally { setBusy(''); }
  };
  return (
    <Section title="Доступные исследования">
      <div className="dim" style={{ fontSize: 12 }}>Лаборатория изучает неизвестные объекты, восстанавливает повреждённые находки и открывает рецепты. Предмет расходуется — но запись в музее остаётся.</div>
      <div className="col mt">
        {research.map((r: any) => {
          const have = r.need.every((id: string) => player.items.some((i: any) => i.itemId === id && !i.placed));
          return (
            <div key={r.id} className="card tight">
              <div className="row between">
                <div className="grow">
                  <b style={{ fontSize: 13 }}>{r.name}</b>
                  <div className="dim" style={{ fontSize: 11 }}>{r.desc}</div>
                </div>
                <button className="btn sm" disabled={!have || busy === r.id} onClick={() => run(r)}>Изучить</button>
              </div>
              <div className="row wrap mt" style={{ gap: 5 }}>
                {r.need.map((id: string, i: number) => {
                  const def = content?.items?.find((x: any) => x.id === id);
                  const owned = player.items.some((x: any) => x.itemId === id && !x.placed);
                  return <span key={i} className="pill" style={{ color: owned ? '#5fd68a' : '#ff5f6d' }}>{def?.name ?? id}</span>;
                })}
                <span className="pill">награда: {r.out.map(([m, q]: any) => `${content?.materials?.find((x: any) => x.id === m)?.name ?? m} ×${q}`).join(', ')}</span>
              </div>
              {r.unlock && <div className="dim" style={{ fontSize: 11 }}>Открывает: {String(r.unlock).startsWith('chain:') ? `цепочку «${content?.chains?.find((c: any) => c.id === r.unlock.slice(6))?.name ?? r.unlock.slice(6)}»` : content?.gear?.find((g: any) => g.id === r.unlock)?.name ?? r.unlock}</div>}
            </div>
          );
        })}
      </div>
    </Section>
  );
}

// ─────────────────────────────── ПАВИЛЬОН ───────────────────────────────
function Pavilion() {
  const { player, content, act, toast } = useApp();
  const [pick, setPick] = useState<string | null>(null);
  const [openUid, setOpenUid] = useState<string | null>(null);

  const place = async (slot: string, uid: string | null) => {
    try {
      const r = await act<any>('/base', { slot, uid });
      toast(uid ? `Размещено в «${slot}»` : 'Экспонат снят');
      if (r.unlocked?.length) toast('Достижение получено!', 'ok');
    } catch { /* тост показан */ }
  };

  const pickSlot = pick ? player.base.slots.find((s: any) => s.slot === pick) : null;
  const candidates = player.items.filter((i: any) => !i.placed && (!pickSlot || fitsSlot(pickSlot.size, itemSize(i.weightG))));

  return (
    <>
      <Section title="Выставочные места" right={<span className="pill">{player.base.slots.filter((s: any) => s.itemUid).length} занято</span>}>
        <div className="grid">
          {player.base.slots.map((s: any) => {
            const item = s.itemUid ? player.items.find((i: any) => i.uid === s.itemUid) : null;
            const def = item ? content?.items?.find((d: any) => d.id === item.itemId) : null;
            return (
              <div key={s.slot} className={`tile ${item ? '' : 'lock'}`} onClick={() => { haptic.select(); item ? setOpenUid(item.uid) : setPick(s.slot); }}>
                {item ? <ItemArt kind={def?.art} pal={def?.pal} pat={def?.pat} mutation={item.mutation} rarityColor={content?.rarity?.[item.rarity]?.color} size={56} />
                  : <div style={{ width: 56, height: 56, borderRadius: 12, background: '#0a1c27', border: '1px dashed #1b4055', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3a5a6d', fontSize: 20 }}>+</div>}
                <div className="nm">{item ? def?.name : s.label}</div>
                <div className="dim" style={{ fontSize: 10 }}>{s.label}</div>
              </div>
            );
          })}
        </div>
      </Section>
      {pick && (
        <Modal open onClose={() => setPick(null)} title="Выберите экспонат">
          {candidates.length === 0 && <div className="dim">Нечего выставлять — инвентарь пуст.</div>}
          <div className="grid">
            {candidates.map((i: any) => <ItemTile key={i.uid} item={i} content={content} onClick={() => { place(pick, i.uid); setPick(null); }} />)}
          </div>
        </Modal>
      )}
      {openUid && <ItemActions uid={openUid} onClose={() => setOpenUid(null)} />}
    </>
  );
}

// ─────────────────────────────── ТЕРМИНАЛ ───────────────────────────────
function Terminal() {
  const { player, content, act, toast } = useApp();
  const [tab, setTab] = useState<'market' | 'auction' | 'bases'>('market');
  const [market, setMarket] = useState<any>(null);
  const [board, setBoard] = useState<any>(null);
  const [busy, setBusy] = useState('');

  const load = async () => {
    setMarket(await get('/market').catch(() => null));
    setBoard(await get('/leaderboard').catch(() => null));
  };
  useEffect(() => { void load(); }, []);

  const buy = async (l: any) => {
    if (!(await showConfirm(`Купить «${l.item.def?.name}» за ${fmtNum(l.price)} ¢?`))) return;
    setBusy(l.id);
    try { await act('/market/buy', { listingId: l.id }); toast('Куплено'); await load(); } catch { /* toast */ } finally { setBusy(''); }
  };

  const listings = (market?.listings ?? []).filter((l: any) => (tab === 'auction' ? l.kind === 'auction' : l.kind === 'market'));

  return (
    <>
      <div className="chips">
        {[['market', 'Рынок'], ['auction', 'Аукцион'], ['bases', 'Рейтинг баз']].map(([id, label]) => (
          <button key={id} className={`chip ${tab === id ? 'on' : ''}`} onClick={() => setTab(id as any)}>{label}</button>
        ))}
      </div>

      {tab !== 'bases' && (
        <>
          <Section title={tab === 'market' ? 'Предложения игроков' : 'Аукционы'} right={<button className="btn tiny ghost" onClick={load}>Обновить</button>}>
            <div className="dim" style={{ fontSize: 12 }}>Комиссия рынка: {Math.round((market?.fee ?? 0.05) * 100)}%. Динамические цены применяются к предметам эпической редкости и выше.</div>
            {listings.length === 0 && <div className="dim mt">Пока нет предложений. Выставьте что-нибудь из инвентаря через «Действия» на предмете.</div>}
            <div className="col mt">
              {listings.map((l: any) => (
                <div key={l.id} className="card tight">
                  <div className="row" style={{ gap: 10 }}>
                    <ItemArt kind={l.item.def?.art} pal={l.item.def?.pal} pat={l.item.def?.pat} mutation={l.item.mutation} rarityColor={content?.rarity?.[l.item.rarity]?.color} size={56} />
                    <div className="grow">
                      <div className="row wrap" style={{ gap: 4 }}>
                        <RarityTag rarity={l.item.rarity} content={content} />
                        <MutationTag mutation={l.item.mutation} content={content} />
                        {l.item.serial && <span className="badge-s mono">#{String(l.item.serial.no).padStart(3, '0')}/{l.item.serial.total}</span>}
                      </div>
                      <b style={{ fontSize: 13 }}>{l.item.def?.name}</b>
                      <div className="dim" style={{ fontSize: 11 }}>{fmtW(l.item.weightG)} · продавец {l.sellerName}</div>
                    </div>
                    <div className="col" style={{ alignItems: 'flex-end', gap: 4 }}>
                      <span className="pill">{fmtNum(l.price)} ¢</span>
                      {l.topBid && <span className="pill" style={{ color: '#ffb038' }}>ставка {fmtNum(l.topBid.amount)}</span>}
                      {l.kind === 'market'
                        ? <button className="btn tiny" disabled={busy === l.id || l.sellerId === player.id} onClick={() => buy(l)}>Купить</button>
                        : <button className="btn tiny" disabled={l.sellerId === player.id} onClick={async () => {
                          const amount = Math.round(Number(prompt('Ваша ставка, ¢', String(Math.round((l.topBid?.amount ?? l.price) * 1.05))) || 0));
                          if (!amount) return;
                          try { await act('/market/bid', { listingId: l.id, amount }); toast('Ставка принята'); await load(); } catch { /* toast */ }
                        }}>Ставка</button>}
                      {l.sellerId === player.id && <button className="btn tiny ghost" onClick={async () => { await act('/market/cancel', { listingId: l.id }); await load(); }}>Снять</button>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Section>
          <Section title="Рыночные цены">
            <div className="grid">
              {(market?.prices ?? []).slice(0, 24).map((p: any) => (
                <div key={p.itemId} className="tile">
                  <div className="nm">{p.name}</div>
                  <div className="pill" style={{ color: content?.rarity?.[p.rarity]?.color }}>{fmtNum(p.market)} ¢</div>
                  <div className="dim" style={{ fontSize: 10 }}>в продаже: {p.supply}</div>
                </div>
              ))}
            </div>
          </Section>
        </>
      )}

      {tab === 'bases' && (
        <>
          <Section title="Лучшие базы сервера" right={<button className="btn tiny ghost" onClick={load}>Обновить</button>}>
            {(board?.bases ?? []).map((p: any, i: number) => (
              <div key={p.id} className="row between" style={{ padding: '5px 0' }}>
                <span className="grow nowrap">{i + 1}. {p.base.name} <span className="dim">· {p.name}</span></span>
                <span className="pill">{p.exhibits} эксп.</span>
                <span className="pill"><Stars n={Math.round(p.rating || 0)} /></span>
                {p.id !== player.id && <button className="btn tiny" onClick={async () => { await act('/base/rate', { playerId: p.id, stars: 5 }); toast('Оценка поставлена'); await load(); }}>★5</button>}
              </div>
            ))}
            <div className="dim mt" style={{ fontSize: 11 }}>Оценки ограничены: не более 20 в день, только с 3 уровня, один раз на базу, свою базу оценить нельзя.</div>
          </Section>
          <Section title="Самые редкие коллекции">
            {(board?.rarest ?? []).map((p: any, i: number) => (
              <div key={p.id} className="row between" style={{ padding: '3px 0' }}>
                <span className="grow nowrap">{i + 1}. {p.name}</span>
                <span className="pill">очки редкости {p.score}</span>
              </div>
            ))}
          </Section>
          <Section title="Самые ценные уникальные находки">
            {(board?.records ?? []).slice(0, 10).map((r: any, i: number) => (
              <div key={i} className="row between" style={{ padding: '3px 0' }}>
                <span className="grow nowrap">{r.item.def?.name} <span className="dim">· {r.name}</span></span>
                <span className="pill">{fmtW(r.item.weightG)}</span>
                {r.item.serial && <span className="badge-s mono">#{String(r.item.serial.no).padStart(3, '0')}</span>}
              </div>
            ))}
          </Section>
          <Section title="Приглашение игроков">
            <div className="dim" style={{ fontSize: 12 }}>Реферальная ссылка для карточек находок и Stories:</div>
            <div className="row mt" style={{ gap: 8 }}>
              <input className="btn grow" style={{ textAlign: 'left' }} readOnly value={referalLink()} />
              <button className="btn sm" onClick={() => { copyText(referalLink()); toast('Ссылка скопирована'); }}>Копировать</button>
            </div>
          </Section>
        </>
      )}
    </>
  );
}
