import React, { useEffect, useMemo, useState } from 'react';
import { Glyph, ItemArt } from '../art';
import { Bar, ItemTile, Modal, MutationTag, RarityTag, Section, Stars, fmtLen, fmtNum, fmtTime, fmtW } from '../components';
import { get, useApp } from '../state';
import { haptic, showConfirm } from '../telegram';
import { ItemActions } from './ItemActions';

// ─────────────────────────────── КАРТА ───────────────────────────────
export function MapScreen() {
  const { player, content, location, setLocation, act, toast, refresh } = useApp();
  const [busy, setBusy] = useState('');
  const [smuggler, setSmuggler] = useState<any>(null);
  const [tab, setTab] = useState<'locs' | 'events' | 'season'>('locs');

  useEffect(() => { get('/smuggler').then(setSmuggler).catch(() => {}); }, []);

  const open = async (id: string, cost: number, level: number) => {
    if (!(await showConfirm(`Открыть локацию за ${fmtNum(cost)} ¢?`))) return;
    setBusy(id);
    try { await act('/location/open', { id }); setLocation(id); toast('Локация открыта!'); } catch { /* toast */ } finally { setBusy(''); }
  };

  const trade = async (offerId: string) => {
    setBusy(offerId);
    try { await act('/smuggler/trade', { offerId }); toast('Обмен со Скупщиком совершён'); setSmuggler(await get('/smuggler')); } catch { /* toast */ } finally { setBusy(''); }
  };

  const claim = async (goalId: string) => {
    setBusy(goalId);
    try { await act('/season/claim', { goalId }); toast('Сезонная награда получена'); } catch { /* toast */ } finally { setBusy(''); }
  };

  return (
    <div className="screen">
      <h1>Карта мира</h1>
      <div className="chips">
        {[['locs', 'Локации'], ['events', 'События'], ['season', 'Экспедиция']].map(([id, label]) => (
          <button key={id} className={`chip ${tab === id ? 'on' : ''}`} onClick={() => { haptic.select(); setTab(id as any); }}>{label}</button>
        ))}
      </div>

      {tab === 'locs' && (
        <div className="mt">
          {content?.locations?.map((l: any) => {
            const unlocked = player.locations.includes(l.id);
            const canOpen = !unlocked && player.level >= l.level && player.coins >= l.cost;
            return (
              <div key={l.id} className={`card ${location === l.id && unlocked ? 'glow' : ''}`}>
                <div className="row between">
                  <div className="grow">
                    <div className="row" style={{ gap: 6 }}>
                      <h3 style={{ margin: 0 }}>{l.name}</h3>
                      {unlocked ? <span className="pill">открыта</span> : <span className="pill">нужен ур. {l.level}</span>}
                      {location === l.id && <span className="pill" style={{ color: '#57d0ff' }}>текущая</span>}
                    </div>
                    <div className="dim" style={{ fontSize: 12 }}>{l.desc}</div>
                    <div className="dim" style={{ fontSize: 11 }}>Глубина: {l.depth} · Множитель цен торговца: ×{l.npcMult}</div>
                  </div>
                </div>
                <div className="row wrap mt" style={{ gap: 5 }}>
                  {(Object.keys(l.rarity) as string[]).slice(0, 7).map((r) => (
                    <span key={r} className="pill" style={{ color: content?.rarity?.[r]?.color, borderColor: content?.rarity?.[r]?.color + '66' }}>{content?.rarity?.[r]?.name} {l.rarity[r]}%</span>
                  ))}
                </div>
                <div className="row mt" style={{ gap: 8 }}>
                  {unlocked
                    ? <button className="btn primary grow" disabled={location === l.id} onClick={() => { setLocation(l.id); haptic.medium(); }}>{location === l.id ? 'Рыбачим здесь' : 'Перейти'}</button>
                    : <button className="btn gold grow" disabled={!canOpen || busy === l.id} onClick={() => open(l.id, l.cost, l.level)}>Открыть · {fmtNum(l.cost)} ¢</button>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {tab === 'events' && (
        <div className="mt">
          <Section title="Активные события недели">
            {(content?.activeEvents ?? []).map((e: any) => (
              <div key={e.id} className="card tight" style={{ marginBottom: 6 }}>
                <div className="row between"><b>{e.name}</b>{e.loc && <span className="pill">{content?.locations?.find((l: any) => l.id === e.loc)?.name}</span>}</div>
                <div className="dim" style={{ fontSize: 12 }}>{e.desc}</div>
                <div className="row wrap mt" style={{ gap: 5 }}>
                  {e.rarityBias && <span className="pill" style={{ color: '#ffb038' }}>шанс редкого +{Math.round((e.rarityBias - 1) * 100)}%</span>}
                  {e.catBias && Object.entries(e.catBias).map(([k, v]: any) => <span key={k} className="pill">{content?.categories?.[k] ?? k} ×{v}</span>)}
                </div>
              </div>
            ))}
            {!content?.activeEvents?.length && <div className="dim">На этой неделе тихо. События появляются каждую неделю.</div>}
          </Section>
          <Section title="Скупщик" right={<span className="pill">до обновления {fmtTime(smuggler?.resetIn ?? 0)}</span>}>
            <div className="dim" style={{ fontSize: 12 }}>
              Скрытый NPC недели. Подсказка: искать в локации «{content?.locations?.find((l: any) => l.id === smuggler?.hint)?.name ?? '—'}».
              Принимает лишние предметы и материалы по обменным рецептам. Ассортимент меняется каждую неделю.
            </div>
            <div className="col mt">
              {smuggler?.offers?.map((o: any) => (
                <div key={o.id} className="card tight">
                  <div className="row between">
                    <div className="grow">
                      <div style={{ fontSize: 13 }}>{o.desc}</div>
                      <div className="dim" style={{ fontSize: 12 }}>
                        Отдать: {o.give.map(([id, q]: any) => `${content?.materials?.find((m: any) => m.id === id)?.name ?? content?.gear?.find((g: any) => g.id === id)?.name ?? id} ×${q}`).join(', ')}
                      </div>
                      <div className="dim" style={{ fontSize: 12 }}>
                        Получить: {o.get.map(([id, q]: any) => `${content?.materials?.find((m: any) => m.id === id)?.name ?? content?.gear?.find((g: any) => g.id === id)?.name ?? id} ×${q}`).join(', ')}
                      </div>
                    </div>
                    <button className="btn sm" disabled={!o.left || busy === o.id} onClick={() => trade(o.id)}>{o.left ? `Обмен (${o.left})` : 'исчерпано'}</button>
                  </div>
                </div>
              ))}
              {!smuggler && <div className="dim">Скупщик не найден на этой неделе.</div>}
            </div>
          </Section>
        </div>
      )}

      {tab === 'season' && (
        <div className="mt">
          <Section title={content?.season?.name ?? 'Сезон'}>
            <div className="dim" style={{ fontSize: 12 }}>{content?.season?.desc}</div>
            <div className="pill mt">Прогресс набирается в глубинных зонах: «Морская бездна» и «Инопланетное озеро», а также на глубоководных забросах.</div>
            <div className="mt">
              {content?.season?.goals?.map((g: any) => {
                const cur = player.season?.stats?.[g.stat] ?? 0;
                const done = cur >= g.target;
                const claimed = player.season?.claimed?.includes(g.id);
                return (
                  <div key={g.id} className="card tight">
                    <div className="row between"><span style={{ fontSize: 13 }}>{g.name}</span><span className="pill">{Math.min(cur, g.target)}/{g.target}</span></div>
                    <Bar value={Math.min(cur, g.target)} max={g.target} color={done ? '#5fd68a' : '#57d0ff'} height={7} />
                    <button className="btn tiny mt" disabled={!done || claimed || busy === g.id} onClick={() => claim(g.id)}>
                      {claimed ? 'Получено' : `Забрать ${g.reward} ¢`}
                    </button>
                  </div>
                );
              })}
            </div>
            <div className="warnbox mt">
              Прогресс экспедиции временный, но основная прокачка, коллекция, монеты, база и постоянное снаряжение не сбрасываются.
            </div>
          </Section>
        </div>
      )}
      <div className="row mt" style={{ gap: 8 }}>
        <button className="btn ghost grow" onClick={() => refresh()}>Обновить данные</button>
      </div>
    </div>
  );
}

// ─────────────────────────────── КОЛЛЕКЦИЯ / МУЗЕЙ ───────────────────────────────
export function CollectionScreen() {
  const { player, content, museum, act } = useApp();
  const [cat, setCat] = useState<string>('all');
  const [view, setView] = useState<'museum' | 'inventory' | 'achievements' | 'records'>('museum');
  const [openUid, setOpenUid] = useState<string | null>(null);
  const [detail, setDetail] = useState<any>(null);

  const discovered = player?.collection ?? {};
  const items: any[] = museum?.items ?? [];
  const list = useMemo(() => (cat === 'all' ? items : items.filter((i) => i.cat === cat)), [items, cat]);

  const stats = useMemo(() => {
    const total = items.length;
    const found = Object.keys(discovered).length;
    const byCat: Record<string, { f: number; t: number }> = {};
    for (const i of items) {
      byCat[i.cat] = byCat[i.cat] ?? { f: 0, t: 0 };
      byCat[i.cat].t++;
      if (discovered[i.id]) byCat[i.cat].f++;
    }
    return { total, found, byCat, percent: total ? Math.round((found / total) * 1000) / 10 : 0 };
  }, [items, discovered]);

  return (
    <div className="screen">
      <h1>Коллекция и музей</h1>
      <div className="card">
        <div className="row between"><b>Заполнено каталога: {stats.percent}%</b><span className="pill">{stats.found} / {stats.total}</span></div>
        <Bar value={stats.found} max={stats.total} color="#b46bff" />
        <div className="row wrap mt" style={{ gap: 5 }}>
          {Object.entries(stats.byCat).map(([k, v]) => (
            <span key={k} className="pill">{content?.categories?.[k] ?? k}: {v.f}/{v.t}</span>
          ))}
        </div>
      </div>

      <div className="chips">
        {[['museum', 'Каталог'], ['inventory', `Инвентарь (${player?.items?.length ?? 0})`], ['achievements', 'Достижения'], ['records', 'Рекорды']].map(([id, label]) => (
          <button key={id} className={`chip ${view === id ? 'on' : ''}`} onClick={() => { haptic.select(); setView(id as any); }}>{label}</button>
        ))}
      </div>

      {view === 'museum' && (
        <>
          <div className="chips mt">
            {[['all', 'Все'], ...Object.entries(content?.categories ?? {})].map(([id, label]: any) => (
              <button key={id} className={`chip ${cat === id ? 'on' : ''}`} onClick={() => setCat(id)}>{label}</button>
            ))}
          </div>
          <div className="grid mt">
            {list.map((i) => {
              const have = discovered[i.id];
              return (
                <div key={i.id} className={`tile ${have ? '' : 'lock'}`} onClick={() => { haptic.select(); setDetail(i); }}>
                  {have
                    ? <ItemArt kind={i.art} pal={i.pal} pat={i.pat} rarityColor={content?.rarity?.[i.rarity]?.color} size={58} />
                    : <div style={{ width: 58, height: 58, borderRadius: 12, background: '#0a1c27', border: '1px dashed #1b4055', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, color: '#3a5a6d' }}>?</div>}
                  <div className="nm">{have ? i.name : 'Неизвестно'}</div>
                  <div className="dim" style={{ fontSize: 10, color: content?.rarity?.[i.rarity]?.color }}>{content?.rarity?.[i.rarity]?.name}</div>
                  {have && <div className="dim" style={{ fontSize: 10 }}>{discovered[i.id].count} шт · макс {fmtW(discovered[i.id].maxW)}</div>}
                </div>
              );
            })}
          </div>
        </>
      )}

      {view === 'inventory' && (
        <>
          {(player?.items ?? []).length === 0 && <div className="card dim">Инвентарь пуст. Забросьте удочку и поймайте что-нибудь неожиданное.</div>}
          <div className="grid mt">
            {player.items.map((i: any) => <ItemTile key={i.uid} item={i} content={content} onClick={() => setOpenUid(i.uid)} showValue />)}
          </div>
        </>
      )}

      {view === 'achievements' && (
        <div className="mt">
          {content?.achievements?.map((a: any) => {
            const got = player.achievements?.includes(a.id);
            return (
              <div key={a.id} className="card tight" style={{ opacity: got ? 1 : 0.6 }}>
                <div className="row between"><b style={{ color: got ? '#5fd68a' : undefined }}>{a.name}</b><span className="pill">+{a.reward} ¢</span></div>
                <div className="dim" style={{ fontSize: 12 }}>{a.desc}</div>
              </div>
            );
          })}
        </div>
      )}

      {view === 'records' && (
        <div className="mt">
          <Section title="Личные рекорды">
            <div className="kv"><span>Самый тяжёлый</span><span>{player.records?.heaviest ? `${player.records.heaviest.name} · ${fmtW(player.records.heaviest.w)}` : '—'}</span></div>
            <div className="kv"><span>Самый длинный</span><span>{player.records?.longest ? `${player.records.longest.name} · ${fmtLen(player.records.longest.len)}` : '—'}</span></div>
            <div className="kv"><span>Самая ценная находка</span><span>{player.records?.mostValuable ? `${player.records.mostValuable.name} · ${fmtNum(player.records.mostValuable.value)} ¢` : '—'}</span></div>
            <div className="kv"><span>Обрывы лески</span><span>{player.stats.breaks}</span></div>
            <div className="kv"><span>Гигантских находок</span><span>{player.stats.giants}</span></div>
            <div className="kv"><span>Двойных поклёвок</span><span>{player.stats.doubles}</span></div>
          </Section>
          <Section title="Цепочки находок">
            {content?.chains?.map((c: any) => {
              const st = player.chains?.[c.id];
              const step = st?.step ?? 0;
              const next = c.steps[step];
              const need = next ? content?.items?.find((i: any) => i.id === next.need) : null;
              return (
                <div key={c.id} className="card tight">
                  <div className="row between"><b>{c.name}</b><span className="pill">{step}/{c.steps.length}</span></div>
                  <Bar value={step} max={c.steps.length} color="#ffb038" height={7} />
                  <div className="dim mt" style={{ fontSize: 12 }}>
                    {next ? <>Следующая цель: <b>{need?.name ?? next.need}</b> — {next.hint}</> : 'Цепочка завершена.'}
                  </div>
                </div>
              );
            })}
          </Section>
        </div>
      )}

      {detail && (
        <Modal open onClose={() => setDetail(null)} title={discovered[detail.id] ? detail.name : 'Неизвестная запись'}>
          <div className="row" style={{ gap: 12 }}>
            <ItemArt kind={detail.art} pal={detail.pal} pat={detail.pat} rarityColor={content?.rarity?.[detail.rarity]?.color} size={92} />
            <div className="grow">
              <RarityTag rarity={detail.rarity} content={content} />
              <div className="dim mt" style={{ fontSize: 13 }}>{discovered[detail.id] ? detail.desc : 'Эта запись ещё не открыта. Поймайте предмет или исследуйте его в лаборатории.'}</div>
            </div>
          </div>
          <div className="mt">
            <div className="kv"><span>Категория</span><span>{content?.categories?.[detail.cat]}</span></div>
            <div className="kv"><span>Вес</span><span>{fmtW(detail.w[0])} — {fmtW(detail.w[1])}</span></div>
            <div className="kv"><span>Длина</span><span>{fmtLen(detail.len[0])} — {fmtLen(detail.len[1])}</span></div>
            <div className="kv"><span>Локации</span><span>{detail.loc.map((l: string) => content?.locations?.find((x: any) => x.id === l)?.name ?? l).join(', ')}</span></div>
            {detail.serial && <div className="kv"><span>Тираж на сервере</span><span className="mono">{detail.serial} экз.</span></div>}
            {detail.ability && <div className="warnbox mt">Свойство: {detail.ability}</div>}
            {discovered[detail.id] && (
              <>
                <hr className="hr" />
                <div className="kv"><span>Поймано</span><span>{discovered[detail.id].count} шт</span></div>
                <div className="kv"><span>Максимальный вес</span><span>{fmtW(discovered[detail.id].maxW)}</span></div>
                <div className="kv"><span>Первое открытие</span><span>{new Date(discovered[detail.id].firstAt).toLocaleDateString('ru-RU')}</span></div>
              </>
            )}
            {!discovered[detail.id] && <div className="warnbox mt">Подсказка: ищите в локациях {detail.loc.map((l: string) => content?.locations?.find((x: any) => x.id === l)?.name ?? l).join(', ')}.</div>}
          </div>
        </Modal>
      )}

      {openUid && <ItemActions uid={openUid} onClose={() => setOpenUid(null)} />}
      <div className="row mt" style={{ gap: 8 }}>
        <button className="btn ghost grow" onClick={async () => { await act('/museum', {}); }}>Обновить каталог</button>
      </div>
    </div>
  );
}

export { MutationTag, Stars, Section };
