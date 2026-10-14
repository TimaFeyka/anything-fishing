/**
 * Проверка Mini App в настоящем браузере (Chrome DevTools Protocol, без зависимостей).
 * Запускает headless Chrome, эмулирует телефон, измеряет горизонтальное переполнение,
 * проходит сценарии «все вкладки» и «полный цикл рыбалки» и сохраняет скриншоты.
 *
 * Запуск:
 *   node scripts/render-check.mjs <url> <outDir> [width] [height] [mode]
 *   mode: overflow (по умолчанию) | tabs | fight
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const URL_TO_OPEN = process.argv[2] ?? 'http://127.0.0.1:8787/';
const OUT = process.argv[3] ?? path.join(os.tmpdir(), 'af-render');
const WIDTH = Number(process.argv[4] ?? 390);
const HEIGHT = Number(process.argv[5] ?? 844);
const MODE = process.argv[6] ?? 'overflow';
const PORT = 9333;

const CANDIDATES = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
];
const chromePath = CANDIDATES.find((p) => fs.existsSync(p));
if (!chromePath) { console.error('Chrome/Chromium не найден — проверка вёрстки пропущена'); process.exit(2); }

fs.mkdirSync(OUT, { recursive: true });
const chrome = spawn(chromePath, [
  '--headless=new', '--disable-gpu', '--no-sandbox', '--no-first-run', '--hide-scrollbars',
  `--remote-debugging-port=${PORT}`, `--user-data-dir=${path.join(OUT, 'profile')}`, 'about:blank',
], { stdio: 'ignore' });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let pass = 0; let fail = 0;
const ok = (n, c, e = '') => { if (c) { pass++; console.log(`  ✓ ${n}${e ? ' — ' + e : ''}`); } else { fail++; console.log(`  ✗ ${n}${e ? ' — ' + e : ''}`); } };

let ws;
try {
  let version = null;
  for (let i = 0; i < 40 && !version; i++) {
    try { version = await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json(); } catch { await sleep(250); }
  }
  if (!version) throw new Error('CDP не отвечает');
  const targets = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
  const page = targets.find((t) => t.type === 'page');
  ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });

  let seq = 0; const pending = new Map();
  const consoleErrors = [];
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
    if (m.method === 'Runtime.exceptionThrown') consoleErrors.push(m.params?.exceptionDetails?.text ?? 'exception');
    if (m.method === 'Runtime.consoleAPICalled' && m.params?.type === 'error') {
      consoleErrors.push((m.params.args ?? []).map((a) => a.value ?? a.description ?? '').join(' '));
    }
  };
  const send = (method, params = {}) => new Promise((res) => { const id = ++seq; pending.set(id, res); ws.send(JSON.stringify({ id, method, params })); });
  const evalJs = async (expression) => {
    const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    return r.result?.result?.value;
  };
  const shot = async (name) => {
    const s = await send('Page.captureScreenshot', { format: 'png' });
    const f = path.join(OUT, `${name}.png`);
    fs.writeFileSync(f, Buffer.from(s.result.data, 'base64'));
    return f;
  };
  const measure = async () => JSON.parse(await evalJs(`(() => {
    const iw = innerWidth;
    const bad = [...document.querySelectorAll('body *')]
      .map((e) => ({ e, r: e.getBoundingClientRect() }))
      .filter((x) => x.r.width > 0 && (x.r.right > iw + 1 || x.r.left < -1))
      .filter((x) => !x.e.closest('.chips'))
      .slice(0, 10)
      .map((x) => x.e.tagName.toLowerCase() + (typeof x.e.className === 'string' && x.e.className ? '.' + x.e.className.split(' ').filter(Boolean).join('.') : '') + ' right=' + Math.round(x.r.right));
    return JSON.stringify({ overflow: document.documentElement.scrollWidth - iw, offenders: bad, text: (document.body.innerText || '').slice(0, 160).replace(/\\n+/g, ' | ') });
  })()`));
  const clickText = async (text) => evalJs(`(() => { const el = [...document.querySelectorAll('button')].find((b) => (b.innerText || '').includes(${JSON.stringify(text)})); if (!el) return 'not-found'; el.click(); return 'clicked'; })()`);
  const bodyHas = async (s) => !!(await evalJs(`document.body.innerText.includes(${JSON.stringify(s)})`));
  const modalText = async () => (await evalJs(`(() => { const m = document.querySelector('.modal .sheet'); return m ? (m.innerText || '').slice(0, 80).replace(/\\n+/g, ' · ') : ''; })()`)) ?? '';
  const setHold = async (on) => evalJs(`(() => { const b = document.querySelector('.hold'); if (!b) return 'no-button'; b.dispatchEvent(new PointerEvent('${on ? 'pointerdown' : 'pointerup'}', { bubbles: true })); return 'ok'; })()`);
  const tension = async () => Number(await evalJs(`(() => { const k = [...document.querySelectorAll('.kv')].find((x) => x.textContent.includes('Натяжение')); const m = k && k.textContent.match(/(\\d+)%/); return m ? m[1] : -1; })()`));

  await send('Page.enable');
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: WIDTH, height: HEIGHT, deviceScaleFactor: 2, mobile: true });
  await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  await send('Page.navigate', { url: URL_TO_OPEN });
  await sleep(4500);

  console.log(`\nПроверка браузера ${WIDTH}×${HEIGHT} · режим ${MODE} · ${URL_TO_OPEN}`);

  const first = await measure();
  ok('страница загрузилась без переполнения по горизонтали', first.overflow <= 2, `переполнение ${first.overflow}px`);
  ok('на экране отрисовался игровой интерфейс', first.text.includes('Лесное озеро') || first.text.includes('Заброс'), first.text.slice(0, 90));

  if (MODE === 'overflow') {
    await shot('home');
  }

  if (MODE === 'tabs' || MODE === 'fight') {
    for (const tab of ['Карта', 'Коллекция', 'Магазин', 'Профиль']) {
      const r = await clickText(tab);
      await sleep(1600);
      const m = await measure();
      ok(`вкладка «${tab}» открывается без переполнения`, r === 'clicked' && m.overflow <= 2, `переполнение ${m.overflow}px · ${m.text.slice(0, 70)}`);
      await shot('tab-' + tab);
    }
    await clickText('Рыбалка');
    await sleep(900);
    await clickText('Инвентарь');
    await sleep(800);
    const invText = await modalText();
    ok('инвентарь открывается', invText.includes('Инвентарь'), invText);
    await shot('inventory');
    await evalJs(`(() => { const b = document.querySelector('.modal .sheet button'); b && b.click(); })()`);
    await sleep(500);
  }

  if (MODE === 'fight') {
    console.log('\n  Полный цикл: заброс → поклёвка → вываживание → награда');
    const cast = await clickText('Забросить');
    await sleep(2500);
    const hints = await measure();
    const hintsShown = (await bodyHas('Неизвестный силуэт')) || (await bodyHas('Подсечь'));
    ok('после заброса показываются подсказки о силуэте', cast === 'clicked' && hintsShown, hints.text.slice(0, 110));
    await shot('hints');

    const hook = await clickText('Подсечь');
    await sleep(1200);
    const fightStarted = await bodyHas('Натяжение лески');
    const inFight = await measure();
    ok('мини-игра вываживания запустилась', hook === 'clicked' && fightStarted, inFight.text.slice(0, 110));
    ok('в бою видны показатели натяжения, подтягивания и лески', (await evalJs(`document.querySelectorAll('.bar').length`)) >= 3);
    await shot('fight');

    let reeling = false;
    const deadline = Date.now() + 75000;
    let finished = false;
    while (Date.now() < deadline) {
      const t = await tension();
      if (t < 0) { finished = true; break; }
      // Шкала натяжения нормирована на максимум 1.4: 40% ≈ 0.56, 55% ≈ 0.77 — рабочая зона.
      const want = t > 55 ? false : t < 40 ? true : reeling;
      if (want !== reeling) { await setHold(want); reeling = want; }
      await sleep(140);
    }
    await sleep(1500);
    const won = await bodyHas('Добыча на берегу');
    const lost = (await bodyHas('Леска не выдержала')) || (await bodyHas('сошла с крючка')) || (await bodyHas('Добыча ушла'));
    const result = await measure();
    ok('бой завершился и показан результат', finished && (won || lost), `${won ? 'вылов' : lost ? 'срыв' : 'нет результата'} · ${result.text.slice(0, 90)}`);
    await shot('result');
    const take = await clickText(won ? 'Забрать' : 'Ещё заброс');
    await sleep(900);
    const backToCast = await bodyHas('Забросить');
    ok('после награды возвращаемся к рыбалке', take === 'clicked' && backToCast, take === 'clicked' ? 'панель результата закрыта' : 'кнопка продолжения не найдена');
    await shot('after');
    if (won) ok('выловленный предмет попал в инвентарь', Number((await evalJs(`(() => { const b = [...document.querySelectorAll('button')].find((x) => x.innerText.includes('Инвентарь')); return b ? b.innerText : ''; })()`)).match(/\((\d+)\)/)?.[1] ?? 0) > 0);
  }

  ok('в консоли браузера нет ошибок', consoleErrors.length === 0, consoleErrors.slice(0, 3).join(' | ') || 'чисто');
  console.log(`  скриншоты: ${OUT}`);
  console.log(`\nИтог браузера: ${pass} успешно, ${fail} провалено\n`);
  process.exitCode = fail ? 1 : 0;
} finally {
  try { ws?.close(); } catch { /* noop */ }
  chrome.kill();
}
