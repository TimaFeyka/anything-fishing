import React, { useEffect, useState } from 'react';
import { Glyph, ItemArt } from '../art';
import { Bar, Modal, Section, Stars, fmtNum, fmtTime, fmtW } from '../components';
import { get, referalLink, useApp } from '../state';
import { copyText, haptic, openLink, showAlert, showConfirm } from '../telegram';

const SLOTS: [string, string][] = [['rod', 'Удочки'], ['reel', 'Катушки'], ['line', 'Лески'], ['hook', 'Крючки'], ['bait', 'Наживки'], ['net', 'Подсаки'], ['boat', 'Лодки'], ['device', 'Приборы']];

// ─────────────────────────────── МАГАЗИН ───────────────────────────────
export function ShopScreen() {
  const { player, content, act, toast, refresh } = useApp();
  const [tab, setTab] = useState('rod');
  const [busy, setBusy] = useState('');

  const buy = async (g: any, qty = 1) => {
    if (!(await showConfirm(`Купить «${g.name}»${g.consumable ? ` ×${qty}` : ''} за ${fmtNum(g.price * qty)} ¢?`))) return;
    setBusy(g.id);
    try { await act('/shop/buy', { gearId: g.id, qty }); toast(`Куплено: ${g.name}`); } catch { /* toast */ } finally { setBusy(''); }
  };
  const equip = async (slot: string, id: string) => {
    try { await act('/equip', { slot, id }); haptic.medium(); toast('Снаряжение надето'); } catch { /* toast */ }
  };

  const starsBuy = async (c: any) => {
    try {
      const r = await act<any>('/stars/invoice', { cosmeticId: c.id });
      const tg = (window as any).Telegram?.WebApp;
      if (tg?.openInvoice && r.link) {
        tg.openInvoice(r.link, (status: string) => {
          if (status === 'paid') { toast('Оплата прошла. Награда выдаётся после подтверждения сервером.'); setTimeout(() => refresh(), 1500); }
          else if (status === 'failed') toast('Платёж не прошёл', 'err');
        });
      } else if (r.link) { openLink(r.link); toast('Открываем счёт Telegram Stars…'); }
    } catch { /* toast */ }
  };

  return (
    <div className="screen">
      <h1>Магазин</h1>
      <div className="chips">
        {SLOTS.map(([id, label]) => (
          <button key={id} className={`chip ${tab === id ? 'on' : ''}`} onClick={() => { haptic.select(); setTab(id); }}>{label}</button>
        ))}
        <button className={`chip ${tab === 'mat' ? 'on' : ''}`} onClick={() => setTab('mat')}>Материалы</button>
        <button className={`chip ${tab === 'cos' ? 'on' : ''}`} onClick={() => setTab('cos')}>Оформление</button>
      </div>

      {tab !== 'mat' && tab !== 'cos' && (
        <div className="mt">
          {(content?.gear ?? []).filter((g: any) => g.slot === tab).map((g: any) => {
            const owned = player.ownedGear.includes(g.id) || (player.supplies[g.id] ?? 0) > 0;
            const equipped = player.loadout[g.slot] === g.id;
            const canLevel = player.level >= g.level;
            return (
              <div key={g.id} className={`card tight ${equipped ? 'glow' : ''}`}>
                <div className="row between">
                  <div className="grow">
                    <div className="row" style={{ gap: 6 }}>
                      <b style={{ fontSize: 14 }}>{g.name}</b>
                      {equipped && <span className="pill" style={{ color: '#57d0ff' }}>надето</span>}
                      {g.starsOnly && <span className="pill" style={{ color: '#ffb038' }}>Stars</span>}
                    </div>
                    <div className="dim" style={{ fontSize: 12 }}>{g.desc}</div>
                    <div className="row wrap mt" style={{ gap: 5 }}>
                      {g.maxLoad ? <span className="pill">нагрузка {g.maxLoad} кг</span> : null}
                      {g.control ? <span className="pill">контроль ×{g.control}</span> : null}
                      {g.speed ? <span className="pill">скорость ×{g.speed}</span> : null}
                      {g.luck ? <span className="pill">удача +{Math.round(g.luck * 100)}%</span> : null}
                      {g.specialty ? <span className="pill" style={{ color: '#b46bff' }}>специализация: {content?.categories?.[g.specialty]}</span> : null}
                      {g.access?.depth ? <span className="pill">глубина до {g.access.depth}</span> : null}
                      {g.consumable ? <span className="pill">осталось: {player.supplies[g.id] ?? 0}</span> : null}
                      <span className="pill" style={{ color: canLevel ? undefined : '#ff5f6d' }}>ур. {g.level}</span>
                    </div>
                  </div>
                  <div className="col" style={{ gap: 6 }}>
                    {g.consumable
                      ? <button className="btn sm" disabled={busy === g.id} onClick={() => buy(g, 10)}>Купить ×10 · {fmtNum(g.price * 10)} ¢</button>
                      : owned
                        ? <button className="btn sm primary" disabled={equipped} onClick={() => equip(g.slot, g.id)}>{equipped ? 'Надето' : 'Надеть'}</button>
                        : <button className="btn sm gold" disabled={!canLevel || busy === g.id} onClick={() => buy(g)}>{fmtNum(g.price)} ¢</button>}
                    {g.consumable && <button className="btn sm primary" disabled={equipped || !owned} onClick={() => equip(g.slot, g.id)}>Надеть</button>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {tab === 'mat' && (
        <div className="mt">
          {(content?.materials ?? []).map((m: any) => (
            <div key={m.id} className="card tight">
              <div className="row between">
                <div className="grow">
                  <b style={{ fontSize: 13 }}>{m.name}</b>
                  <div className="dim" style={{ fontSize: 11 }}>{m.desc}</div>
                </div>
                <span className="pill">у вас: {player.supplies[m.id] ?? 0}</span>
                <button className="btn tiny" onClick={async () => {
                  const qty = Number(prompt(`Сколько «${m.name}» продать?`, '1') || 0);
                  if (!qty) return;
                  try { const r = await act<any>('/shop/sell-materials', { matId: m.id, qty }); toast(`Продано за ${fmtNum(r.gained)} ¢`); } catch { /* toast */ }
                }}>Сдать</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'cos' && (
        <div className="mt">
          <Section title="Оформление за Telegram Stars">
            <div className="warnbox">
              За реальные деньги продаётся только внешний вид и удобство. Никаких преимуществ в вылове,
              шансов на редкость, игровой валюты и обхода дневных лимитов. Награда выдаётся только после
              серверного подтверждения платежа.
            </div>
            <div className="grid mt">
              {(content?.cosmetics ?? []).map((c: any) => {
                const owned = player.cosmetics.includes(c.id);
                return (
                  <div key={c.id} className="card tight">
                    <div className="row between">
                      <b style={{ fontSize: 13 }}>{c.name}</b>
                      <span className="pill" style={{ color: '#ffb038' }}>★ {c.stars}</span>
                    </div>
                    <div className="dim" style={{ fontSize: 11 }}>{c.desc}</div>
                    <div className="row mt" style={{ gap: 6 }}>
                      <span className="pill" style={{ color: c.preview?.[1] }}>{c.kind}</span>
                      {owned
                        ? <span className="pill" style={{ color: '#5fd68a' }}>куплено</span>
                        : <button className="btn tiny gold" disabled={!content?.config?.starsEnabled} onClick={() => starsBuy(c)}>Купить</button>}
                    </div>
                  </div>
                );
              })}
            </div>
          </Section>
          <Section title="Что нельзя купить">
            <div className="dim" style={{ fontSize: 12 }}>
              Мощные удочки с игровым преимуществом · игровая валюта · повышение шанса редкой добычи ·
              гарантированные мифические и серийные находки · дополнительные попытки в рейтинговых событиях ·
              обход дневных лимитов торговли. Игрок, который ничего не платит, может собрать коллекцию,
              развить базу и занять высокие позиции.
            </div>
          </Section>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────── ПРОФИЛЬ ───────────────────────────────
export function ProfileScreen() {
  const { player, content, act, toast, refresh, setShowSettings, clientSettings, updateClientSettings } = useApp();
  const [board, setBoard] = useState<any>(null);
  const [tab, setTab] = useState<'stats' | 'bases' | 'serials' | 'about'>('stats');

  useEffect(() => { get('/leaderboard').then(setBoard).catch(() => {}); }, []);
  const xpNeed = Math.round(120 * Math.pow(player.level, 1.85));

  const toggle = async (key: string) => {
    const next = !player.settings[key];
    await act('/settings', { [key]: next });
    toast(next ? 'Включено' : 'Отключено');
  };

  return (
    <div className="screen">
      <div className="card">
        <div className="row" style={{ gap: 12 }}>
          <div style={{ width: 64, height: 64, borderRadius: 18, background: 'linear-gradient(135deg,#2b9ad6,#123a4d)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, fontWeight: 800 }}>
            {player.name.slice(0, 1).toUpperCase()}
          </div>
          <div className="grow">
            <h2 style={{ margin: 0 }}>{player.name}</h2>
            <div className="dim" style={{ fontSize: 12 }}>{player.username ? '@' + player.username : 'Telegram Mini App'} · уровень {player.level}</div>
            <div className="mt"><Bar value={player.xp % Math.max(1, xpNeed)} max={xpNeed} color="#57d0ff" height={8} /></div>
            <div className="dim" style={{ fontSize: 11 }}>{player.xp % Math.max(1, xpNeed)} / {xpNeed} опыта до следующего уровня</div>
          </div>
          <span className="pill"><Glyph name="coin" size={13} /> {fmtNum(player.coins)}</span>
        </div>
      </div>

      <div className="chips">
        {[['stats', 'Статистика'], ['bases', 'Рейтинги'], ['serials', 'Серийные'], ['about', 'Настройки']].map(([id, label]) => (
          <button key={id} className={`chip ${tab === id ? 'on' : ''}`} onClick={() => setTab(id as any)}>{label}</button>
        ))}
      </div>

      {tab === 'stats' && (
        <>
          <Section title="Игровая статистика">
            <div className="kv"><span>Забросов</span><span>{player.stats.casts}</span></div>
            <div className="kv"><span>Успешных выловов</span><span>{player.stats.lands}</span></div>
            <div className="kv"><span>Обрывов лески</span><span>{player.stats.breaks}</span></div>
            <div className="kv"><span>Добыча сошла с крючка</span><span>{player.stats.slips}</span></div>
            <div className="kv"><span>Огромных находок</span><span>{player.stats.giants}</span></div>
            <div className="kv"><span>Двойных поклёвок</span><span>{player.stats.doubles}</span></div>
            <div className="kv"><span>Заработано монет</span><span>{fmtNum(player.stats.coinsEarned)}</span></div>
            <div className="kv"><span>Потрачено монет</span><span>{fmtNum(player.stats.coinsSpent)}</span></div>
            <div className="kv"><span>Предметов продано</span><span>{player.stats.sold}</span></div>
            <div className="kv"><span>Записей в музее</span><span>{Object.keys(player.collection).length} / {content?.items?.length ?? 0}</span></div>
            <div className="kv"><span>Достижений</span><span>{player.achievements.length} / {content?.achievements?.length ?? 0}</span></div>
          </Section>
          <Section title="По категориям">
            {Object.entries(player.stats.byCat ?? {}).map(([k, v]: any) => (
              <div key={k} className="kv"><span>{content?.categories?.[k] ?? k}</span><span>{v}</span></div>
            ))}
            <hr className="hr" />
            {Object.entries(player.stats.byRarity ?? {}).map(([k, v]: any) => (
              <div key={k} className="kv"><span style={{ color: content?.rarity?.[k]?.color }}>{content?.rarity?.[k]?.name ?? k}</span><span>{v}</span></div>
            ))}
          </Section>
          <Section title="Ежедневный лимит торговца">
            <div className="kv"><span>Продано сегодня</span><span>{player.daily.sold}</span></div>
            <div className="kv"><span>Осталось по полной цене</span><span>{player.daily.fullLeft}</span></div>
            <div className="kv"><span>Затем по {Math.round(player.daily.halfMult * 100)}%</span><span>{player.daily.halfLeft}</span></div>
            <div className="kv"><span>Обновление</span><span>{new Date(player.daily.resetAt).toLocaleString('ru-RU')}</span></div>
            <div className="dim" style={{ fontSize: 11 }}>Лимит считается по проданным предметам, а не по забросам: запасать инвентарь заранее бесполезно. Рыбачить, собирать коллекцию, исследовать и перерабатывать можно без ограничений.</div>
          </Section>
        </>
      )}

      {tab === 'bases' && (
        <>
          <Section title="Самые богатые игроки">
            {(board?.richest ?? []).map((p: any, i: number) => (
              <div key={p.id} className="row between" style={{ padding: '3px 0' }}>
                <span className="grow nowrap">{i + 1}. {p.name} {p.id === player.id && <span className="pill">вы</span>}</span>
                <span className="pill">{fmtNum(p.coins)} ¢</span>
              </div>
            ))}
          </Section>
          <Section title="Книга рекордов сервера">
            {(board?.records ?? []).slice(0, 12).map((r: any, i: number) => (
              <div key={i} className="row between" style={{ padding: '3px 0' }}>
                <span className="grow nowrap">{content?.rarity?.[r.item.rarity]?.name} · {r.item.def?.name} <span className="dim">· {r.name}</span></span>
                <span className="pill">{fmtW(r.item.weightG)}</span>
              </div>
            ))}
          </Section>
          <Section title="Самые посещаемые базы">
            {(board?.visited ?? []).map((p: any, i: number) => (
              <div key={p.id} className="row between" style={{ padding: '3px 0' }}>
                <span className="grow nowrap">{i + 1}. {p.base.name}</span>
                <span className="pill">{p.base.visitors} посещений</span>
              </div>
            ))}
          </Section>
          <div className="card">
            <h3>Пригласить друзей</h3>
            <div className="row" style={{ gap: 8 }}>
              <input className="btn grow" style={{ textAlign: 'left' }} readOnly value={referalLink()} />
              <button className="btn sm" onClick={() => { copyText(referalLink()); toast('Ссылка скопирована'); }}>Копировать</button>
            </div>
            <div className="dim mt" style={{ fontSize: 11 }}>Реферальная ссылка добавляется в карточки находок. Публикация не даёт преимуществ в рыбалке.</div>
          </div>
        </>
      )}

      {tab === 'serials' && (
        <>
          {player.warnings?.length > 0 && (
            <div className="warnbox">
              У вас есть предупреждения о «Возврате в пучину». Экземпляры, отмеченные ниже, могут вернуться в мир,
              если вы не заходите в игру 60+ дней. Откройте предмет и отключите циркуляцию, чтобы этого не произошло.
            </div>
          )}
          <Section title="Серийные экземпляры">
            {player.items.filter((i: any) => i.serial).length === 0 && <div className="dim">Пока нет серийных находок. Они появляются редко и нумеруются сервером.</div>}
            <div className="col">
              {player.items.filter((i: any) => i.serial).map((i: any) => {
                const def = content?.items?.find((d: any) => d.id === i.itemId);
                const warned = player.warnings?.some((w: any) => w.serialUid === i.uid);
                return (
                  <div key={i.uid} className="card tight" style={{ borderColor: warned ? '#ffb038' : undefined }}>
                    <div className="row" style={{ gap: 10 }}>
                      <ItemArt kind={def?.art} pal={def?.pal} pat={def?.pat} mutation={i.mutation} rarityColor={content?.rarity?.[i.rarity]?.color} size={52} />
                      <div className="grow">
                        <b style={{ fontSize: 13 }}>{def?.name}</b>
                        <div className="mono dim" style={{ fontSize: 11 }}>#{String(i.serial.no).padStart(3, '0')} из {i.serial.total}</div>
                        <div className="dim" style={{ fontSize: 11 }}>{i.history.slice(-1)[0]?.note ?? ''}</div>
                      </div>
                      <span className="pill">{content?.config?.serialReturnDays ?? 60} дн.</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </Section>
          <Section title="Правила циркуляции">
            <div className="dim" style={{ fontSize: 12 }}>
              Серийные экземпляры нельзя разобрать на материалы, сдать торговцу или Скупщику. Продажа и передача
              требуют отдельного подтверждения. Номер и история владения сохраняются навсегда: повторный вылов
              возвращает тот же самый экземпляр, а не создаёт копию. Обычные коллекционные предметы никогда не
              исчезают из-за неактивности.
            </div>
          </Section>
        </>
      )}

      {tab === 'about' && (
        <>
          <Section
            title="ИИ-Инструктор Antigravity"
            right={<span className="pill" style={{ color: '#38bdf8', borderColor: '#38bdf8' }}><Glyph name="bot" size={12} /> Google DeepMind</span>}
          >
            <div className="card tight" style={{ background: 'linear-gradient(135deg, rgba(8,26,38,0.95), rgba(15,40,58,0.95))', borderColor: '#38bdf8', boxShadow: '0 0 16px -8px #38bdf8' }}>
              <div className="row" style={{ gap: 10 }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 12,
                  background: 'linear-gradient(135deg, #06b6d4, #6366f1)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: '0 0 12px rgba(6,182,212,0.4)', flexShrink: 0,
                }}>
                  <Glyph name="bot" size={22} color="#ffffff" />
                </div>
                <div className="grow">
                  <div className="row between">
                    <b style={{ color: '#38bdf8', fontSize: 13 }}>Antigravity AI Fishing Core</b>
                    <span className="badge-s" style={{ color: '#4ade80', fontSize: 10 }}>В СЕТИ</span>
                  </div>
                  <div className="dim" style={{ fontSize: 11, marginTop: 2 }}>
                    Персональный бортовой ИИ-напарник: анализ глубин, подсказки по снастям и тактика вываживания.
                  </div>
                </div>
              </div>
              <div className="mt" style={{ paddingTop: 8, borderTop: '1px solid rgba(87,208,255,0.15)' }}>
                <button
                  className="btn primary block sm"
                  onClick={() => { haptic.select(); setShowSettings(true); }}
                  style={{ background: 'linear-gradient(135deg, #0284c7, #0369a1)', boxShadow: '0 0 14px rgba(14,165,233,0.3)' }}
                >
                  <Glyph name="settings" size={15} /> Открыть Настройки и ИИ-Консультант
                </button>
              </div>
            </div>
          </Section>

          <Section title="Быстрые настройки">
            <div className="row between" style={{ padding: '6px 0' }}>
              <span>Тактильная отдача (вибрация)</span>
              <button className={`btn sm ${player.settings?.haptics ? 'primary' : ''}`} onClick={() => toggle('haptics')}>{player.settings?.haptics ? 'Вкл' : 'Выкл'}</button>
            </div>
            <div className="row between" style={{ padding: '6px 0' }}>
              <span>Анимация движения рыбы к берегу</span>
              <button className={`btn sm ${clientSettings?.fishApproachAnim ? 'primary' : ''}`} onClick={() => updateClientSettings?.({ fishApproachAnim: !clientSettings?.fishApproachAnim })}>
                {clientSettings?.fishApproachAnim ? 'Вкл' : 'Выкл'}
              </button>
            </div>
            <div className="row between" style={{ padding: '6px 0' }}>
              <span>Подсказки о редких находках</span>
              <button className={`btn sm ${player.settings?.confirmRare ? 'primary' : ''}`} onClick={() => toggle('confirmRare')}>{player.settings?.confirmRare ? 'Вкл' : 'Выкл'}</button>
            </div>
            <div className="row between" style={{ padding: '6px 0' }}>
              <span>Разрешить карточки находок</span>
              <button className={`btn sm ${player.settings?.share ? 'primary' : ''}`} onClick={() => toggle('share')}>{player.settings?.share ? 'Вкл' : 'Выкл'}</button>
            </div>
          </Section>

          <Section title="О игре">
            <div className="kv"><span>Версия</span><span>1.2.0 (Antigravity AI Edition)</span></div>
            <div className="kv"><span>ИИ-помощник</span><span>Antigravity by Google DeepMind</span></div>
            <div className="kv"><span>Предметов в каталоге</span><span>{content?.items?.length ?? 0}</span></div>
            <div className="kv"><span>Локаций</span><span>{content?.locations?.length ?? 0}</span></div>
            <div className="kv"><span>Графика</span><span>векторная, без фотографий</span></div>
            <div className="dim mt" style={{ fontSize: 12 }}>
              ANYTHING FISHING — игра о рыбалке и исследовании неизвестного. Каждый заброс может принести
              что угодно: от плотвы до затонувшего сейфа, древнего механизма или инопланетного артефакта.
            </div>
          </Section>
          <div className="row" style={{ gap: 8 }}>
            <button className="btn ghost grow" onClick={() => refresh().then(() => toast('Данные обновлены'))}>Обновить профиль</button>
            <button className="btn ghost grow" onClick={() => showAlert(`Здоровье сервера: ${location.origin}/api/health`)}>Статус сервера</button>
          </div>
        </>
      )}
    </div>
  );
}

export { Modal, Stars, fmtTime };
