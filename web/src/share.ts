/**
 * Карточка находки для Telegram Stories: генерируется кодом на canvas.
 * Фотографии не используются вообще — фон, лучи, рамка и эмблема рисуются процедурно.
 */
import { post } from './state';
import { shareToStory } from './telegram';

const W = 1080, H = 1920;

function emblemFamily(kind: string): 'fish' | 'junk' | 'treasure' | 'tech' | 'fantasy' | 'giant' {
  if (['fish', 'fishlong', 'fishflat', 'fishround', 'jelly', 'serpent', 'ghost', 'turtle'].includes(kind)) return 'fish';
  if (['bottle', 'can', 'boot', 'tire', 'phone', 'headphones', 'watch', 'gamepad', 'console', 'tv', 'pc', 'bike', 'suitcase', 'vending', 'washer', 'microwave', 'toaster', 'vacuum', 'guitar', 'umbrella', 'pot', 'shovel', 'canister', 'plate'].includes(kind)) return 'junk';
  if (['coin', 'ingot', 'gem', 'pearl', 'crown', 'mask', 'chest', 'map', 'relic', 'chain', 'cup', 'casket', 'key', 'voidkey'].includes(kind)) return 'treasure';
  if (['drone', 'robot', 'camera', 'engine', 'propeller', 'sonar', 'device', 'battery', 'satellite', 'blackbox', 'container', 'part'].includes(kind)) return 'tech';
  if (['kraken', 'serpent', 'statue', 'ark', 'safe', 'anchor', 'shipwreck', 'wreckpart', 'heart'].includes(kind)) return 'giant';
  return 'fantasy';
}

function drawEmblem(ctx: CanvasRenderingContext2D, kind: string, pal: [string, string], r: number) {
  const fam = emblemFamily(kind);
  ctx.save();
  ctx.strokeStyle = pal[1]; ctx.lineWidth = 10; ctx.fillStyle = pal[0];
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  switch (fam) {
    case 'fish': {
      ctx.beginPath();
      ctx.moveTo(-1.5 * r, 0);
      ctx.bezierCurveTo(-0.6 * r, -1.1 * r, 1.2 * r, -0.9 * r, 1.7 * r, -0.1 * r);
      ctx.bezierCurveTo(1.2 * r, 0.8 * r, -0.4 * r, 1.1 * r, -1.5 * r, 0);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(1.7 * r, -0.1 * r); ctx.lineTo(2.4 * r, -0.8 * r); ctx.lineTo(2.3 * r, 0.7 * r); ctx.closePath(); ctx.fillStyle = pal[1]; ctx.fill();
      ctx.beginPath(); ctx.arc(-0.75 * r, -0.15 * r, 0.14 * r, 0, 7); ctx.fillStyle = '#0b1016'; ctx.fill();
      break;
    }
    case 'junk': {
      ctx.beginPath(); ctx.roundRect(-1.1 * r, -1.2 * r, 2.2 * r, 2.4 * r, 0.3 * r); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-0.3 * r, -1.2 * r); ctx.lineTo(-0.3 * r, -1.9 * r); ctx.lineTo(0.5 * r, -1.9 * r); ctx.stroke();
      ctx.fillStyle = pal[1]; ctx.beginPath(); ctx.roundRect(-0.7 * r, -0.2 * r, 1.4 * r, 0.8 * r, 0.15 * r); ctx.fill();
      break;
    }
    case 'treasure': {
      ctx.beginPath();
      ctx.moveTo(0, -1.5 * r); ctx.lineTo(1.2 * r, -0.4 * r); ctx.lineTo(0.7 * r, 1.4 * r); ctx.lineTo(-0.7 * r, 1.4 * r); ctx.lineTo(-1.2 * r, -0.4 * r);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = '#ffffff88'; ctx.lineWidth = 6;
      ctx.beginPath(); ctx.moveTo(-1.2 * r, -0.4 * r); ctx.lineTo(1.2 * r, -0.4 * r); ctx.moveTo(0, -1.5 * r); ctx.lineTo(0, 1.4 * r); ctx.stroke();
      break;
    }
    case 'tech': {
      ctx.beginPath();
      for (let i = 0; i < 12; i++) {
        const a1 = (i / 12) * Math.PI * 2, a2 = ((i + 1) / 12) * Math.PI * 2;
        const r1 = i % 2 ? r * 0.95 : r * 1.35, r2 = i % 2 ? r * 1.35 : r * 0.95;
        ctx.lineTo(Math.cos(a1) * r1, Math.sin(a1) * r1);
        ctx.lineTo(Math.cos(a2) * r2, Math.sin(a2) * r2);
      }
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.arc(0, 0, r * 0.4, 0, 7); ctx.fillStyle = pal[1]; ctx.fill();
      break;
    }
    case 'giant': {
      ctx.beginPath(); ctx.arc(0, 0, r * 1.3, 0, 7); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = '#ffffff55'; ctx.lineWidth = 8;
      ctx.beginPath(); ctx.arc(0, 0, r * 1.6, -0.6, 1.2); ctx.stroke();
      ctx.beginPath(); ctx.arc(0, 0, r * 1.8, 2.4, 3.6); ctx.stroke();
      break;
    }
    default: {
      ctx.beginPath();
      const spikes = 8;
      for (let i = 0; i < spikes * 2; i++) {
        const ang = (i / (spikes * 2)) * Math.PI * 2 - Math.PI / 2;
        const rad = i % 2 ? r * 0.6 : r * 1.45;
        ctx.lineTo(Math.cos(ang) * rad, Math.sin(ang) * rad);
      }
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.arc(0, 0, r * 0.45, 0, 7); ctx.fillStyle = '#ffffffcc'; ctx.fill();
    }
  }
  ctx.restore();
}

export interface FindCardData {
  item: any;
  def: any;
  playerName: string;
  rarityColor: string;
  rarityName: string;
  mutationName?: string;
  refLink: string;
  record?: string;
}

export function renderFindCard(d: FindCardData): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d')!;
  const pal: [string, string] = [d.def?.pal?.[0] ?? '#8fa3b0', d.def?.pal?.[1] ?? '#33414d'];

  // фон
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, '#07131c'); bg.addColorStop(0.5, '#0d2c3d'); bg.addColorStop(1, '#04101a');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
  // лучи
  ctx.save(); ctx.translate(W / 2, H * 0.42);
  for (let i = 0; i < 24; i++) {
    ctx.rotate((Math.PI * 2) / 24);
    const g = ctx.createLinearGradient(0, 0, 0, -900);
    g.addColorStop(0, `${d.rarityColor}44`); g.addColorStop(1, 'transparent');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(-18, 0); ctx.lineTo(18, 0); ctx.lineTo(70, -900); ctx.lineTo(-70, -900); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
  // виньетка
  const vg = ctx.createRadialGradient(W / 2, H * 0.42, 200, W / 2, H * 0.42, 900);
  vg.addColorStop(0, 'transparent'); vg.addColorStop(1, '#020a10ee');
  ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);

  // рамка
  ctx.strokeStyle = d.rarityColor; ctx.lineWidth = 8;
  ctx.beginPath(); ctx.roundRect(46, 46, W - 92, H - 92, 46); ctx.stroke();
  ctx.globalAlpha = 0.35;
  ctx.beginPath(); ctx.roundRect(66, 66, W - 132, H - 132, 36); ctx.stroke();
  ctx.globalAlpha = 1;

  // эмблема
  ctx.save();
  ctx.translate(W / 2, H * 0.4);
  ctx.shadowColor = d.rarityColor; ctx.shadowBlur = 90;
  drawEmblem(ctx, d.def?.art ?? 'fish', pal, 190);
  ctx.restore();

  // тексты
  ctx.textAlign = 'center';
  ctx.fillStyle = '#8fb0c2'; ctx.font = '600 34px system-ui, sans-serif';
  ctx.fillText('ANYTHING FISHING · НАХОДКА', W / 2, 150);

  ctx.fillStyle = d.rarityColor; ctx.font = '700 42px system-ui, sans-serif';
  ctx.fillText(d.rarityName.toUpperCase(), W / 2, H * 0.62);

  ctx.fillStyle = '#ffffff'; ctx.font = '800 76px system-ui, sans-serif';
  wrapText(ctx, d.def?.name ?? d.item.itemId, W / 2, H * 0.68, W - 200, 84);

  ctx.fillStyle = '#e8f4fb'; ctx.font = '600 40px system-ui, sans-serif';
  const w = d.item.weightG >= 1000 ? `${(d.item.weightG / 1000).toFixed(2)} кг` : `${Math.round(d.item.weightG)} г`;
  const l = d.item.lengthCm >= 100 ? `${(d.item.lengthCm / 100).toFixed(2)} м` : `${d.item.lengthCm.toFixed(1)} см`;
  ctx.fillText(`${w} · ${l}`, W / 2, H * 0.78);
  if (d.mutationName) { ctx.fillStyle = '#ffb038'; ctx.fillText(d.mutationName, W / 2, H * 0.815); }

  if (d.item.serial) {
    ctx.fillStyle = '#0b1e2b'; ctx.strokeStyle = d.rarityColor; ctx.lineWidth = 4;
    const txt = `#${String(d.item.serial.no).padStart(3, '0')} из ${d.item.serial.total}`;
    ctx.font = '700 46px ui-monospace, monospace';
    const tw = ctx.measureText(txt).width + 70;
    ctx.beginPath(); ctx.roundRect(W / 2 - tw / 2, H * 0.845, tw, 86, 24); ctx.fill(); ctx.stroke();
    ctx.fillStyle = d.rarityColor; ctx.fillText(txt, W / 2, H * 0.845 + 60);
  }

  if (d.record) { ctx.fillStyle = '#5fd68a'; ctx.font = '600 36px system-ui, sans-serif'; ctx.fillText(d.record, W / 2, H * 0.895); }

  ctx.fillStyle = '#8fb0c2'; ctx.font = '500 34px system-ui, sans-serif';
  ctx.fillText(`Владелец: ${d.playerName}`, W / 2, H * 0.925);
  ctx.font = '500 28px ui-monospace, monospace';
  ctx.fillText(d.refLink.replace(/^https?:\/\//, '').slice(0, 46), W / 2, H * 0.95);
  ctx.fillStyle = '#57d0ff'; ctx.font = '700 30px system-ui, sans-serif';
  ctx.fillText('Каждый заброс может принести что угодно', W / 2, H * 0.975);
  return c;
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, lh: number) {
  const words = text.split(' ');
  let line = ''; let yy = y;
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxW && line) { ctx.fillText(line, x, yy); line = word; yy += lh; }
    else line = test;
  }
  ctx.fillText(line, x, yy);
}

/** Публикует карточку: сначала пробуем Telegram Stories, затем Web Share, затем скачивание. */
export async function shareFind(d: FindCardData): Promise<'story' | 'share' | 'saved' | 'failed'> {
  const canvas = renderFindCard(d);
  const dataUrl = canvas.toDataURL('image/png');
  // Пробуем загрузить карточку на сервер, чтобы получить публичный URL для Stories
  try {
    const up = await post<{ url: string }>('/share/card', { dataUrl });
    if (up?.url) {
      const abs = up.url.startsWith('http') ? up.url : `${location.origin}${up.url}`;
      if (shareToStory(abs)) return 'story';
    }
  } catch { /* нет сервера — используем локальные способы */ }

  const blob: Blob | null = await new Promise((r) => canvas.toBlob((b) => r(b), 'image/png'));
  const file = blob ? new File([blob], 'anything-fishing.png', { type: 'image/png' }) : null;
  const nav = navigator as any;
  if (file && nav.canShare?.({ files: [file] })) {
    try { await nav.share({ files: [file], text: 'Моя находка в ANYTHING FISHING' }); return 'share'; } catch { /* отменил */ }
  }
  const a = document.createElement('a');
  a.href = dataUrl; a.download = 'anything-fishing-find.png';
  a.click();
  return 'saved';
}

export function findCardData(item: any, def: any, player: any, content: any, refLink: string): FindCardData {
  const r = content?.rarity?.[item.rarity];
  const m = content?.mutations?.[item.mutation];
  let record: string | undefined;
  if (player?.records?.heaviest && player.records.heaviest.name === def?.name && player.records.heaviest.w === item.weightG) record = 'Личный рекорд по весу';
  return {
    item, def, playerName: player?.name ?? 'Рыбак',
    rarityColor: r?.color ?? '#9aa7b4', rarityName: r?.name ?? item.rarity,
    mutationName: m && item.mutation !== 'none' ? m.name : undefined,
    refLink, record,
  };
}
