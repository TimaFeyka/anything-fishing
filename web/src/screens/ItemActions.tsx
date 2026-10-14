import React, { useEffect, useState } from 'react';
import { Glyph, ItemArt } from '../art';
import { fmtLen, fmtNum, fmtW, Modal, MutationTag, RarityTag } from '../components';
import { get, referalLink, useApp } from '../state';
import { copyText, haptic, showAlert, showConfirm } from '../telegram';
import { findCardData, shareFind } from '../share';

/** Действия над предметом: продать, разобрать, исследовать, выставить, поделиться. */
export function ItemActions({ uid, onClose }: { uid: string | null; onClose: () => void }) {
  const { player, content, act, toast, refresh, setBaseView } = useApp();
  const [price, setPrice] = useState('');
  const [busy, setBusy] = useState(false);
  const [serial, setSerial] = useState<any>(null);
  const [showMarket, setShowMarket] = useState(false);

  const item = player?.items?.find((i: any) => i.uid === uid);
  const def = content?.items?.find((i: any) => i.id === item?.itemId);
  const stored = player?.collection?.[item?.itemId];

  useEffect(() => {
    setSerial(null);
    if (item?.serial) get(`/serial/${item.uid}`).then(setSerial).catch(() => {});
  }, [item?.uid, item?.serial]);

  if (!uid || !item) return null;
  const daily = player.daily;
  const researches = (content?.research ?? []).filter((r: any) => r.need.includes(item.itemId));
  const canNpcSell = def && !item.serial && !item.placed && ['common', 'uncommon', 'rare'].includes(item.rarity) && !daily.blocked;

  const run = async (fn: () => Promise<any>) => {
    setBusy(true);
    try { await fn(); } catch { /* тосты уже показаны */ } finally { setBusy(false); }
  };

  const sell = () => run(async () => {
    const r = await act<any>('/sell/npc', { uids: [item.uid] });
    const sold = r.sold?.[0];
    const refused = r.refused?.[0];
    if (sold) { toast(`Продано: ${sold.name} за ${fmtNum(sold.price)} ¢`); }
    if (refused) { toast(refused.reason, 'warn'); }
    onClose();
  });

  const salvage = () => run(async () => {
    const r = await act<any>('/salvage', { uids: [item.uid] });
    if (r.refused?.[0]) return toast(r.refused[0].reason, 'warn');
    const got = Object.entries(r.got ?? {}).map(([k, v]) => `${content?.materials?.find((m: any) => m.id === k)?.name ?? k} ×${v}`).join(', ');
    toast(`Переработано: ${got || 'ничего'}`);
    onClose();
  });

  const research = (researchId: string) => run(async () => {
    const r = await act<any>('/research', { researchId });
    toast(`Исследование завершено${r.chainOpened ? `, открыта цепочка: ${content?.chains?.find((c: any) => c.id === r.chainOpened)?.name ?? r.chainOpened}` : ''}`);
    onClose();
  });

  const placeOnBase = () => run(async () => {
    const size = itemSize(item.weightG);
    const slots = player.base.slots.filter((s: any) => !s.itemUid);
    const slot = slots.find((s: any) => fitsSlot(s.size, size));
    if (!slot) return toast('Нет свободных мест подходящего размера на базе', 'warn');
    await act('/base', { slot: slot.slot, uid: item.uid });
    toast(`Размещено: ${slot.label}`);
    onClose();
    setBaseView('pavilion');
  });

  const list = () => run(async () => {
    const p = Math.max(1, Math.round(Number(price) || 0));
    await act('/market/list', { uid: item.uid, price: p, kind: 'market', confirm: true });
    toast(`Выставлено на рынок за ${fmtNum(p)} ¢`);
    setShowMarket(false);
    onClose();
  });

  const share = () => run(async () => {
    const res = await shareFind(findCardData(item, def, player, content, referalLink()));
    toast(res === 'story' ? 'Карточка отправлена в Stories' : res === 'share' ? 'Карточка отправлена' : 'Карточка сохранена', res === 'failed' ? 'warn' : 'ok');
  });

  const toggleCirc = (out: boolean) => run(async () => {
    await act(out ? '/serial/opt-out' : '/serial/opt-in', { uid: item.uid });
    toast(out ? 'Экземпляр отключён от «Возврата в пучину»' : 'Экземпляр снова участвует в циркуляции');
    setSerial(await get(`/serial/${item.uid}`).catch(() => null));
  });

  const r = content?.rarity?.[item.rarity];

  return (
    <Modal open onClose={onClose} title="Находка">
      <div className="row" style={{ gap: 12 }}>
        <ItemArt kind={def?.art} pal={def?.pal} pat={def?.pat} mutation={item.mutation} rarityColor={r?.color} size={92} />
        <div className="grow">
          <h2 style={{ marginBottom: 4 }}>{def?.name}</h2>
          <div className="row wrap" style={{ gap: 5 }}>
            <RarityTag rarity={item.rarity} content={content} />
            <MutationTag mutation={item.mutation} content={content} />
            {item.serial && <span className="badge-s mono" style={{ color: r?.color }}>#{String(item.serial.no).padStart(3, '0')}/{item.serial.total}</span>}
          </div>
          <div className="dim mt" style={{ fontSize: 13 }}>{def?.desc}</div>
        </div>
      </div>

      <div className="mt">
        <div className="kv"><span>Вес</span><span>{fmtW(item.weightG)}{stored && stored.maxW > item.weightG ? ` (рекорд вида: ${fmtW(stored.maxW)})` : ''}</span></div>
        <div className="kv"><span>Размер</span><span>{fmtLen(item.lengthCm)}</span></div>
        <div className="kv"><span>Состояние</span><span>{Math.round(item.condition * 100)}%</span></div>
        <div className="kv"><span>Базовая стоимость</span><span>{fmtNum(item.value)} ¢</span></div>
        <div className="kv"><span>Выловлен в</span><span>{content?.locations?.find((l: any) => l.id === item.caughtIn)?.name ?? item.caughtIn}</span></div>
        {def?.ability && <div className="warnbox mt">Свойство: {def.ability}</div>}
      </div>

      <hr className="hr" />

      <div className="col">
        <button className="btn primary block" disabled={busy || !canNpcSell} onClick={sell}>
          <Glyph name="coin" size={18} /> Продать торговцу {canNpcSell ? `· полная цена (осталось ${daily.fullLeft})` : daily.blocked ? '· лимит исчерпан' : '· недоступно'}
        </button>
        <div className="row" style={{ gap: 8 }}>
          <button className="btn grow" disabled={busy || item.serial === undefined && false} onClick={salvage}><Glyph name="hammer" size={18} /> Разобрать</button>
          <button className="btn grow" disabled={busy} onClick={() => setShowMarket(true)}><Glyph name="cart" size={18} /> На рынок</button>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <button className="btn grow" disabled={busy} onClick={placeOnBase}><Glyph name="home" size={18} /> На базу</button>
          <button className="btn grow" disabled={busy} onClick={share}><Glyph name="share" size={18} /> Поделиться</button>
        </div>
        {researches.length > 0 && (
          <div className="card tight">
            <h3>Лаборатория</h3>
            {researches.map((res: any) => (
              <div key={res.id} className="row between mt" style={{ gap: 8 }}>
                <div className="grow">
                  <div style={{ fontSize: 13 }}>{res.name}</div>
                  <div className="dim" style={{ fontSize: 12 }}>{res.desc}</div>
                </div>
                <button className="btn sm" disabled={busy} onClick={() => research(res.id)}>Изучить</button>
              </div>
            ))}
          </div>
        )}
        {item.serial && (
          <div className="card tight">
            <h3>Серийный экземпляр</h3>
            <div className="dim" style={{ fontSize: 12 }}>
              Экземпляр из ограниченного тиража. Его нельзя разобрать на материалы, сдать торговцу или Скупщику.
              Перед продажей требуется подтверждение. {serial?.circulates ? `Если не заходить в игру ${serial?.returnDays ?? 60} дней, экземпляр может вернуться в пучину.` : 'Экземпляр отключён от циркуляции и не может быть изъят.'}
            </div>
            <div className="mt">
              <div className="kv"><span>История</span><span>{(serial?.history ?? item.history)?.length ?? 0} записей</span></div>
              {(serial?.history ?? []).slice(-4).map((h: any, i: number) => (
                <div key={i} className="dim" style={{ fontSize: 12 }}>· {h.note ?? h.type} — {new Date(h.at).toLocaleDateString('ru-RU')}</div>
              ))}
            </div>
            <button className="btn sm block mt" disabled={busy} onClick={() => toggleCirc(!serial?.optOut)}>
              {serial?.optOut ? 'Вернуть в циркуляцию' : 'Отключить «Возврат в пучину»'}
            </button>
          </div>
        )}
      </div>

      {showMarket && (
        <Modal open onClose={() => setShowMarket(false)} title="Рынок игроков">
          <div className="dim" style={{ fontSize: 13 }}>
            Эпические находки и выше продаются только на рынке: цена зависит от спроса и предложения.
            Комиссия рынка — {Math.round((content?.config?.marketFee ?? 0.05) * 100)}%.
          </div>
          <div className="row mt" style={{ gap: 8 }}>
            <input className="btn grow" style={{ textAlign: 'left' }} inputMode="numeric" placeholder="Цена" value={price} onChange={(e) => setPrice(e.target.value.replace(/\D/g, ''))} />
            <button className="btn sm" onClick={() => setPrice(String(Math.round((item.value * 1.4) / 10) * 10))}>Авто</button>
          </div>
          <div className="dim mt" style={{ fontSize: 12 }}>Рекомендуемая цена: {fmtNum(Math.round(item.value * 1.4))} ¢</div>
          <button className="btn primary block mt" disabled={busy || !price} onClick={list}>Выставить</button>
        </Modal>
      )}
    </Modal>
  );
}

/** Общие правила размещения — те же, что проверяет сервер. */
export function itemSize(weightG: number): 'small' | 'medium' | 'large' | 'huge' {
  if (weightG > 200_000) return 'huge';
  if (weightG > 20_000) return 'large';
  if (weightG > 1_000) return 'medium';
  return 'small';
}
export function fitsSlot(slotSize: string, size: string): boolean {
  if (slotSize === 'huge') return true;
  if (slotSize === 'large') return size !== 'huge';
  if (slotSize === 'medium') return size === 'small' || size === 'medium';
  return size === 'small';
}

/** Быстрая продажа пачки обычных предметов. */
export function MassSell({ onClose }: { onClose: () => void }) {
  const { player, content, act, toast } = useApp();
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const daily = player.daily;
  const sellable = (player.items as any[]).filter((i) => !i.serial && !i.placed && ['common', 'uncommon', 'rare'].includes(i.rarity));
  const toggle = (uid: string) => setSelected((s) => (s.includes(uid) ? s.filter((x) => x !== uid) : [...s, uid]));

  const doSell = async () => {
    setBusy(true);
    try {
      const r = await act<any>('/sell/npc', { uids: selected });
      toast(`Продано ${r.sold.length} предметов за ${fmtNum(r.total)} ¢`);
      if (r.refused?.length) toast(`Отказано: ${r.refused.length}`, 'warn');
      onClose();
    } catch { /* ignore */ } finally { setBusy(false); }
  };

  return (
    <Modal open onClose={onClose} title="Торговец">
      <div className="warnbox">
        Дневной лимит: {daily.fullLeft} продаж по полной цене, затем {daily.halfLeft} по {Math.round(daily.halfMult * 100)}%, после — пауза.
        Обновление: {new Date(daily.resetAt).toLocaleString('ru-RU')}.
      </div>
      <div className="grid mt">
        {sellable.map((i) => {
          const def = content?.items?.find((x: any) => x.id === i.itemId);
          return <div key={i.uid} className={`tile ${selected.includes(i.uid) ? 'on' : ''}`} onClick={() => { haptic.select(); toggle(i.uid); }}>
            <ItemArt kind={def?.art} pal={def?.pal} pat={def?.pat} mutation={i.mutation} size={54} />
            <div className="nm">{def?.name}</div>
            <div className="pill">{fmtNum(i.value)} ¢</div>
          </div>;
        })}
        {sellable.length === 0 && <div className="dim">Нет предметов, которые берёт торговец.</div>}
      </div>
      <div className="row mt" style={{ gap: 8 }}>
        <button className="btn ghost" onClick={() => setSelected(sellable.map((i) => i.uid))}>Выбрать всё</button>
        <button className="btn primary grow" disabled={busy || !selected.length} onClick={doSell}>Продать ({selected.length})</button>
      </div>
    </Modal>
  );
}

export function copyRef() {
  copyText(referalLink());
  showAlert('Реферальная ссылка скопирована');
}

export const _confirm = showConfirm;
