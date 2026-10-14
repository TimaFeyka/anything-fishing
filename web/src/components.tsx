import React from 'react';
import { ItemArt, Glyph } from './art';
import { haptic } from './telegram';
import { useApp } from './state';

export function fmtW(g: number): string {
  if (g >= 1_000_000) return `${(g / 1_000_000).toFixed(2)} т`;
  if (g >= 1000) return `${(g / 1000).toFixed(g >= 10_000 ? 1 : 2)} кг`;
  return `${Math.round(g)} г`;
}
export function fmtLen(cm: number): string {
  return cm >= 100 ? `${(cm / 100).toFixed(2)} м` : `${cm.toFixed(cm < 10 ? 1 : 0)} см`;
}
export function fmtNum(n: number): string {
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}
export function fmtTime(ms: number): string {
  const d = Math.floor(ms / 86400000), h = Math.floor((ms % 86400000) / 3600000), m = Math.floor((ms % 3600000) / 60000);
  if (d > 0) return `${d} д ${h} ч`;
  if (h > 0) return `${h} ч ${m} мин`;
  return `${m} мин`;
}

export function Bar({ value, max = 1, color = '#57d0ff', band, height = 10, label }: { value: number; max?: number; color?: string; band?: [number, number]; height?: number; label?: string }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div>
      {label && <div className="kv"><span>{label}</span><span className="mono">{Math.round(pct)}%</span></div>}
      <div className="bar" style={{ height }}>
        {band && <div className="band" style={{ left: `${band[0] * 100}%`, width: `${(band[1] - band[0]) * 100}%` }} />}
        <i style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

export function RarityTag({ rarity, content }: { rarity: string; content: any }) {
  const r = content?.rarity?.[rarity];
  return <span className="tag" style={{ color: r?.color ?? '#9aa7b4', background: `${r?.color ?? '#9aa7b4'}18` }}>{r?.name ?? rarity}</span>;
}

export function MutationTag({ mutation, content }: { mutation: string; content: any }) {
  if (!mutation || mutation === 'none') return null;
  const m = content?.mutations?.[mutation];
  if (!m) return null;
  return <span className="tag" style={{ color: m.color, background: `${m.color}18` }}>{m.name}</span>;
}

export function ItemTile({ item, onClick, selected, showValue, content, size = 62 }: { item: any; onClick?: () => void; selected?: boolean; showValue?: boolean; content: any; size?: number }) {
  const def = item.def ?? content?.items?.find((i: any) => i.id === item.itemId);
  const r = content?.rarity?.[item.rarity];
  return (
    <div className={`tile ${selected ? 'on' : ''}`} onClick={() => { if (onClick) { haptic.select(); onClick(); } }}>
      <ItemArt kind={def?.art ?? 'fish'} pal={def?.pal} pat={def?.pat} mutation={item.mutation} rarityColor={r?.color} size={size} title={def?.name} />
      <div className="nm">{def?.name ?? item.itemId}</div>
      <div className="dim" style={{ fontSize: 11 }}>{fmtW(item.weightG)}</div>
      {item.serial && <div className="badge-s mono" style={{ color: r?.color }}>#{String(item.serial.no).padStart(3, '0')}/{item.serial.total}</div>}
      {showValue && <div className="pill">{fmtNum(item.value)} ¢</div>}
    </div>
  );
}

export function Modal({ open, onClose, title, children, footer }: { open: boolean; onClose: () => void; title?: string; children: React.ReactNode; footer?: React.ReactNode }) {
  if (!open) return null;
  return (
    <div className="modal" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="row between" style={{ marginBottom: 10 }}>
          <h2 style={{ margin: 0 }}>{title}</h2>
          <button className="btn sm ghost" onClick={onClose}><Glyph name="close" size={18} /></button>
        </div>
        {children}
        {footer && <div className="mt2">{footer}</div>}
      </div>
    </div>
  );
}

export function Toasts() {
  const { toasts } = useApp();
  return (
    <div className="toasts">
      {toasts.map((t) => <div key={t.id} className={`toast ${t.kind}`}>{t.text}</div>)}
    </div>
  );
}

export function Section({ title, right, children }: { title: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="card">
      <div className="row between">
        <h3 style={{ margin: 0 }}>{title}</h3>
        {right}
      </div>
      <div className="mt">{children}</div>
    </div>
  );
}

export function Stars({ n, max = 5 }: { n: number; max?: number }) {
  return <span style={{ color: '#ffb038', letterSpacing: 1 }}>{'★'.repeat(Math.max(0, n))}{'☆'.repeat(Math.max(0, max - n))}</span>;
}
