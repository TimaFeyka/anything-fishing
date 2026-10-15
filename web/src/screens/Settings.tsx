import React, { useState } from 'react';
import { Glyph } from '../art';
import { Bar, fmtNum, Modal, Section } from '../components';
import { get, useApp } from '../state';
import { haptic, showAlert } from '../telegram';

export function SettingsModal({ onClose }: { onClose: () => void }) {
  const { player, content, location, act, toast, refresh, clientSettings, updateClientSettings } = useApp();
  const [aiAnswer, setAiAnswer] = useState<string | null>(null);
  const [aiTopic, setAiTopic] = useState<string | null>(null);
  const [healthInfo, setHealthInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const loc = content?.locations?.find((l: any) => l.id === location);
  const rod = content?.gear?.find((g: any) => g.id === player.loadout?.rod);
  const line = content?.gear?.find((g: any) => g.id === player.loadout?.line);
  const reel = content?.gear?.find((g: any) => g.id === player.loadout?.reel);
  const maxLoad = Math.min(rod?.maxLoad ?? 4, line?.maxLoad ?? 2);

  const toggleServerSetting = async (key: string) => {
    const next = !player.settings?.[key];
    try {
      await act('/settings', { [key]: next });
      toast(next ? 'Включено' : 'Отключено');
    } catch { /* toast */ }
  };

  const testHaptic = (type: 'light' | 'medium' | 'heavy') => {
    updateClientSettings({ hapticsIntensity: type });
    if (type === 'light') haptic.light();
    else if (type === 'medium') haptic.medium();
    else haptic.heavy();
    toast(`Тест вибрации: ${type === 'light' ? 'Мягкая' : type === 'medium' ? 'Стандартная' : 'Мощная'}`);
  };

  const askAi = (topic: 'gear' | 'location' | 'tactic' | 'serials') => {
    haptic.medium();
    setAiTopic(topic);
    if (topic === 'gear') {
      const isWeak = maxLoad <= 3 && (loc?.depth ?? 0) >= 1;
      setAiAnswer(
        `Твоя текущая снасть: «${rod?.name ?? 'Удочка'}» + «${line?.name ?? 'Леска'}» с пределом нагрузки ${maxLoad} кг.\n\n` +
        (isWeak
          ? `⚠️ Внимание: для локации «${loc?.name}» эта леска слабовата! При дальних забросах могут клюнуть экземпляры от 5 до 15 кг (например, Сом или Затонувший сейф), которые моментально порвут снасть. Рекомендую купить в Магазине более прочную леску и катушку с высоким контролем.`
          : `✅ Отличный баланс! Твоя снасть уверенно держит обычную и необычную рыбу в этой зоне. Для ловли гигантов удерживай натяжение строго в зеленой полосе 35-85% и не форсируй подтягивание во время рывков.`)
      );
    } else if (topic === 'location') {
      const activeEv = (content?.activeEvents ?? []).filter((e: any) => !e.loc || e.loc === loc?.id);
      const evDesc = activeEv.length ? ` Действует событие: «${activeEv[0].name}» (${activeEv[0].desc}).` : '';
      setAiAnswer(
        `Локация: «${loc?.name ?? 'Неизвестно'}» (глубина: ${loc?.depth ?? 0}).${evDesc}\n\n` +
        `• Предпочтительный заброс: ${loc?.depth > 1 ? '«Глубоководный» или «Дальний»' : '«Точный» для поиска сокровищ'}.\n` +
        `• Торговец здесь дает множитель цен ×${loc?.npcMult ?? 1}.\n` +
        `• Совет: если хочешь выловить мусор и технику для разбора на металл и электронику, делай дальние забросы!`
      );
    } else if (topic === 'tactic') {
      setAiAnswer(
        `Тактика идеального вываживания от Antigravity:\n\n` +
        `1. Зеленая зона (35-85%): выносливость рыбы падает быстрее всего, пока ты удерживаешь натяжение в этих границах.\n` +
        `2. Рывок («РЫВОК!» или «УХОДИТ НА ГЛУБИНУ!»): НЕМЕДЛЕННО отпускай кнопку «ДЕРЖАТЬ». Натяжение подскочит в красную зону, и слабая леска лопнет за долю секунды!\n` +
        `3. Провисание: если не натягивать леску более 3.2 секунд, крючок выпадет и добыча сойдет.\n` +
        `4. Плавность: чередуй короткие зажатия (по 0.3-0.6 сек), регулируя шкалу как дроссель!`
      );
    } else if (topic === 'serials') {
      setAiAnswer(
        `Серийные экземпляры с серверными номерами (#001 из 100):\n\n` +
        `• Тираж строго ограничен на весь сервер (от 1 до 100 шт.).\n` +
        `• Их невозможно случайно продать обычному торговцу или разобрать на материалы.\n` +
        `• Механика «Возврат в пучину»: если владелец не заходит в игру 60 дней, экземпляр возвращается в мировой пул, и его снова может выловить любой игрок с прежней историей!\n` +
        `• Чтобы навсегда защитить экземпляр от изъятия, выставь его на стенд в своей Базе или отключи циркуляцию в карточке предмета.`
      );
    }
  };

  const checkHealth = async () => {
    setBusy(true);
    try {
      const start = Date.now();
      const r = await get('/health');
      const ping = Date.now() - start;
      setHealthInfo(`Сервер: ${r.status === 'ok' ? 'работает стабильно' : r.status} · Хранилище: ${r.storage ?? 'активно'} · Пинг: ${ping} мс`);
    } catch (e) {
      setHealthInfo(`Ошибка связи: ${(e as Error).message}`);
    } finally { setBusy(false); }
  };

  return (
    <Modal open onClose={onClose} title="Настройки и ИИ-Ассистент">
      <div className="col" style={{ gap: 12 }}>
        {/* Карточка игрока */}
        <div className="card tight" style={{ background: 'linear-gradient(135deg, rgba(14,36,50,0.8), rgba(18,48,63,0.8))', borderColor: 'rgba(87,208,255,0.25)' }}>
          <div className="row" style={{ gap: 12 }}>
            <div style={{
              width: 50, height: 50, borderRadius: 14,
              background: 'linear-gradient(135deg, #0284c7, #0369a1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 20, fontWeight: 800, color: '#fff',
              boxShadow: '0 0 16px rgba(14,165,233,0.3)',
            }}>
              {player.name.slice(0, 1).toUpperCase()}
            </div>
            <div className="grow">
              <div className="row" style={{ gap: 6 }}>
                <b style={{ fontSize: 15 }}>{player.name}</b>
                <span className="pill" style={{ color: '#38bdf8' }}>ур. {player.level}</span>
              </div>
              <div className="dim" style={{ fontSize: 12 }}>
                {player.username ? '@' + player.username : 'Рыбак'} · База «{player.base?.name ?? 'База'}»
              </div>
            </div>
            <span className="pill" style={{ color: '#fbbf24', borderColor: 'rgba(251,191,36,0.3)' }}>
              <Glyph name="coin" size={13} /> {fmtNum(player.coins)}
            </span>
          </div>
        </div>

        {/* ─── БЛОК: ИИ-НАПАРНИК ANTIGRAVITY (DEEPMIND) ─── */}
        <Section
          title="ИИ-Инструктор Antigravity"
          right={<span className="pill" style={{ color: '#38bdf8', borderColor: '#38bdf8' }}><Glyph name="bot" size={12} /> Google DeepMind</span>}
        >
          <div className="card tight" style={{ background: 'linear-gradient(135deg, rgba(8,26,38,0.95), rgba(15,40,58,0.95))', borderColor: '#38bdf8', boxShadow: '0 0 20px -8px #38bdf8' }}>
            <div className="row" style={{ gap: 10, alignItems: 'flex-start' }}>
              <div style={{
                width: 44, height: 44, borderRadius: 12,
                background: 'linear-gradient(135deg, #06b6d4, #6366f1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 0 14px rgba(6,182,212,0.4)', flexShrink: 0,
              }}>
                <Glyph name="bot" size={24} color="#ffffff" />
              </div>
              <div className="grow">
                <div className="row between">
                  <b style={{ color: '#38bdf8', fontSize: 14 }}>Antigravity AI Fishing Core</b>
                  <span className="badge-s" style={{ color: '#4ade80', borderColor: 'rgba(74,222,128,0.3)', background: 'rgba(74,222,128,0.1)' }}>● В СЕТИ</span>
                </div>
                <div className="dim mt" style={{ fontSize: 12, lineHeight: 1.35 }}>
                  Персональный бортовой ИИ-аналитик. Анализирует нагрузку лески, прогнозирует поведение рыбы и подсказывает лучшие тактики вываживания.
                </div>
              </div>
            </div>

            {/* Быстрые вопросы к ИИ */}
            <div className="mt" style={{ paddingTop: 8, borderTop: '1px solid rgba(87,208,255,0.15)' }}>
              <div className="dim" style={{ fontSize: 11, marginBottom: 6 }}>Спросить совет у Antigravity:</div>
              <div className="row wrap" style={{ gap: 6 }}>
                <button
                  className={`chip ${aiTopic === 'gear' ? 'on' : ''}`}
                  onClick={() => askAi('gear')}
                  style={{ fontSize: 12, padding: '5px 10px' }}
                >
                  🎣 Оценка снасти
                </button>
                <button
                  className={`chip ${aiTopic === 'location' ? 'on' : ''}`}
                  onClick={() => askAi('location')}
                  style={{ fontSize: 12, padding: '5px 10px' }}
                >
                  🌊 Секреты локации
                </button>
                <button
                  className={`chip ${aiTopic === 'tactic' ? 'on' : ''}`}
                  onClick={() => askAi('tactic')}
                  style={{ fontSize: 12, padding: '5px 10px' }}
                >
                  ⚡ Тактика вываживания
                </button>
                <button
                  className={`chip ${aiTopic === 'serials' ? 'on' : ''}`}
                  onClick={() => askAi('serials')}
                  style={{ fontSize: 12, padding: '5px 10px' }}
                >
                  📜 Серийные предметы
                </button>
              </div>
            </div>

            {/* Ответ ИИ */}
            {aiAnswer && (
              <div className="mt" style={{
                background: 'rgba(3,15,24,0.7)',
                border: '1px solid rgba(56,189,248,0.3)',
                borderRadius: 12,
                padding: '10px 12px',
                fontSize: 12.5,
                lineHeight: 1.45,
                color: '#e0f2fe',
                animation: 'fade 0.2s ease',
              }}>
                <div className="row between" style={{ marginBottom: 6 }}>
                  <span className="row" style={{ gap: 4, color: '#38bdf8', fontWeight: 600, fontSize: 11 }}>
                    <Glyph name="sparkle" size={13} color="#38bdf8" /> Ответ Antigravity
                  </span>
                  <button className="btn tiny ghost" onClick={() => setAiAnswer(null)} style={{ padding: '2px 6px' }}>✕</button>
                </div>
                <div style={{ whiteSpace: 'pre-line' }}>{aiAnswer}</div>
              </div>
            )}

            {/* Настройки подсказок ИИ */}
            <div className="col mt" style={{ gap: 6, paddingTop: 8, borderTop: '1px solid rgba(87,208,255,0.1)' }}>
              <div className="row between" style={{ padding: '3px 0' }}>
                <span style={{ fontSize: 13 }}>Умные подсказки при поклёвке</span>
                <button
                  className={`btn sm ${clientSettings.aiTips ? 'primary' : ''}`}
                  onClick={() => {
                    const next = !clientSettings.aiTips;
                    updateClientSettings({ aiTips: next });
                    toast(next ? 'Подсказки ИИ включены' : 'Подсказки ИИ выключены');
                  }}
                >
                  {clientSettings.aiTips ? 'Вкл' : 'Выкл'}
                </button>
              </div>
              <div className="row between" style={{ padding: '3px 0' }}>
                <span style={{ fontSize: 13 }}>Предупреждение о перегрузе лески</span>
                <button
                  className={`btn sm ${clientSettings.aiGearWarning ? 'primary' : ''}`}
                  onClick={() => {
                    const next = !clientSettings.aiGearWarning;
                    updateClientSettings({ aiGearWarning: next });
                    toast(next ? 'Предупреждения включены' : 'Предупреждения выключены');
                  }}
                >
                  {clientSettings.aiGearWarning ? 'Вкл' : 'Выкл'}
                </button>
              </div>
            </div>
          </div>
        </Section>

        {/* ─── БЛОК: ГРАФИКА И АНИМАЦИИ ─── */}
        <Section title="Графика и анимация">
          <div className="col" style={{ gap: 6 }}>
            <div className="row between" style={{ padding: '4px 0' }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>Движение рыбы к берегу</div>
                <div className="dim" style={{ fontSize: 11 }}>Анимация приближения, кильватера и виляния хвоста</div>
              </div>
              <button
                className={`btn sm ${clientSettings.fishApproachAnim ? 'primary' : ''}`}
                onClick={() => {
                  const next = !clientSettings.fishApproachAnim;
                  updateClientSettings({ fishApproachAnim: next });
                  toast(next ? 'Анимация рыбы включена' : 'Анимация рыбы выключена');
                }}
              >
                {clientSettings.fishApproachAnim ? 'Вкл' : 'Выкл'}
              </button>
            </div>
            <div className="row between" style={{ padding: '4px 0' }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>Качество водных эффектов</div>
                <div className="dim" style={{ fontSize: 11 }}>Брызги, пена, волны и световые блики</div>
              </div>
              <button
                className={`btn sm ${clientSettings.waterEffects === 'high' ? 'primary' : ''}`}
                onClick={() => {
                  const next = clientSettings.waterEffects === 'high' ? 'eco' : 'high';
                  updateClientSettings({ waterEffects: next });
                  toast(`Эффекты: ${next === 'high' ? 'Высокие' : 'Энергосбережение'}`);
                }}
              >
                {clientSettings.waterEffects === 'high' ? 'Высокое' : 'Эко'}
              </button>
            </div>
          </div>
        </Section>

        {/* ─── БЛОК: ТАКТИЛЬНЫЙ ОТКЛИК (ХАПТИКА) ─── */}
        <Section title="Управление и тактильный отклик">
          <div className="col" style={{ gap: 6 }}>
            <div className="row between" style={{ padding: '4px 0' }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>Тактильная отдача (вибрация)</div>
                <div className="dim" style={{ fontSize: 11 }}>Сигнал поклёвки, натяжения и обрыва лески</div>
              </div>
              <button
                className={`btn sm ${player.settings?.haptics ? 'primary' : ''}`}
                onClick={() => toggleServerSetting('haptics')}
              >
                {player.settings?.haptics ? 'Вкл' : 'Выкл'}
              </button>
            </div>
            {player.settings?.haptics && (
              <div className="row between mt" style={{ padding: '4px 0' }}>
                <span style={{ fontSize: 12 }}>Интенсивность:</span>
                <div className="row" style={{ gap: 4 }}>
                  <button
                    className={`chip ${clientSettings.hapticsIntensity === 'light' ? 'on' : ''}`}
                    onClick={() => testHaptic('light')}
                    style={{ fontSize: 11, padding: '4px 8px' }}
                  >
                    Мягкая
                  </button>
                  <button
                    className={`chip ${clientSettings.hapticsIntensity === 'medium' ? 'on' : ''}`}
                    onClick={() => testHaptic('medium')}
                    style={{ fontSize: 11, padding: '4px 8px' }}
                  >
                    Стандарт
                  </button>
                  <button
                    className={`chip ${clientSettings.hapticsIntensity === 'heavy' ? 'on' : ''}`}
                    onClick={() => testHaptic('heavy')}
                    style={{ fontSize: 11, padding: '4px 8px' }}
                  >
                    Мощная
                  </button>
                </div>
              </div>
            )}
            <div className="row between" style={{ padding: '4px 0' }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>Подтверждение редких находок</div>
                <div className="dim" style={{ fontSize: 11 }}>Защита от случайной продажи эпических и легендарных предметов</div>
              </div>
              <button
                className={`btn sm ${player.settings?.confirmRare ? 'primary' : ''}`}
                onClick={() => toggleServerSetting('confirmRare')}
              >
                {player.settings?.confirmRare ? 'Вкл' : 'Выкл'}
              </button>
            </div>
            <div className="row between" style={{ padding: '4px 0' }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>Карточки находок для Stories</div>
                <div className="dim" style={{ fontSize: 11 }}>Генерация красивых картинок для публикации в Telegram</div>
              </div>
              <button
                className={`btn sm ${player.settings?.share ? 'primary' : ''}`}
                onClick={() => toggleServerSetting('share')}
              >
                {player.settings?.share ? 'Вкл' : 'Выкл'}
              </button>
            </div>
          </div>
        </Section>

        {/* ─── БЛОК: СИСТЕМА И СЕРВЕР ─── */}
        <Section title="Система и диагностика">
          <div className="col" style={{ gap: 6 }}>
            <div className="kv"><span>Версия игры</span><span className="mono">v1.2.0 (Antigravity AI Edition)</span></div>
            <div className="kv"><span>Движок рендера</span><span>Процедурный векторный SVG/Canvas</span></div>
            <div className="kv"><span>ID рыбака</span><span className="mono" style={{ fontSize: 11 }}>{player.id}</span></div>
            {healthInfo && <div className="pill mt" style={{ color: '#38bdf8', fontSize: 11 }}>{healthInfo}</div>}
            <div className="row mt" style={{ gap: 8 }}>
              <button className="btn ghost sm grow" disabled={busy} onClick={checkHealth}>
                Проверить связь с сервером
              </button>
              <button className="btn ghost sm grow" onClick={() => refresh().then(() => toast('Данные обновлены'))}>
                Обновить данные
              </button>
            </div>
          </div>
        </Section>

        <div className="row mt" style={{ gap: 8 }}>
          <button className="btn primary block" onClick={onClose}>
            Закрыть настройки
          </button>
        </div>
      </div>
    </Modal>
  );
}
