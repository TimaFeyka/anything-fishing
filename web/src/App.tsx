import React from 'react';
import { Glyph } from './art';
import { Toasts } from './components';
import { useApp } from './state';
import { haptic } from './telegram';
import { FishingScreen } from './screens/Fishing';
import { MapScreen, CollectionScreen } from './screens/World';
import { ShopScreen, ProfileScreen } from './screens/ShopProfile';
import { BaseScreen } from './screens/Base';

const TABS = [
  { id: 'fish', label: 'Рыбалка', icon: 'fish' },
  { id: 'map', label: 'Карта', icon: 'map' },
  { id: 'collection', label: 'Коллекция', icon: 'book' },
  { id: 'shop', label: 'Магазин', icon: 'cart' },
  { id: 'profile', label: 'Профиль', icon: 'user' },
];

export function App() {
  const { loading, fatal, player, tab, setTab, baseView } = useApp();

  if (loading) {
    return (
      <div className="splash">
        <div className="spin" />
        <h1>ANYTHING FISHING</h1>
        <div className="dim">Забрасываем снасти…</div>
      </div>
    );
  }

  if (fatal || !player) {
    return (
      <div className="splash">
        <h1>ANYTHING FISHING</h1>
        <div className="card" style={{ maxWidth: 420 }}>
          <div className="warnbox">{fatal ?? 'Нет данных игрока'}</div>
          <div className="col mt">
            <div className="dim" style={{ fontSize: 13 }}>
              Что проверить: backend запущен и доступен по /api/health; для Telegram заданы TELEGRAM_BOT_TOKEN;
              для локального теста включён ALLOW_DEV_AUTH=1.
            </div>
            <a className="btn primary block" href="./api/health" target="_blank" rel="noreferrer">Проверить /api/health</a>
            <button className="btn ghost block" onClick={() => location.reload()}>Перезагрузить</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      {baseView ? <BaseScreen /> : (
        <>
          {tab === 'fish' && <FishingScreen />}
          {tab === 'map' && <MapScreen />}
          {tab === 'collection' && <CollectionScreen />}
          {tab === 'shop' && <ShopScreen />}
          {tab === 'profile' && <ProfileScreen />}
        </>
      )}
      {!baseView && (
        <nav className="nav">
          {TABS.map((t) => (
            <button key={t.id} className={tab === t.id ? 'on' : ''} onClick={() => { haptic.select(); setTab(t.id); }}>
              <Glyph name={t.icon} size={22} />
              {t.label}
            </button>
          ))}
        </nav>
      )}
      <Toasts />
    </div>
  );
}
