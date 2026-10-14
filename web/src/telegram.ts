/** Обёртка над Telegram Mini Apps SDK: initData, хаптика, ссылки, Stories. */

const wa = (): any => (window as any).Telegram?.WebApp;

export function tgInit() {
  const t = wa();
  if (!t) return;
  try {
    t.ready();
    t.expand?.();
    t.disableVerticalSwipes?.();
    t.setHeaderColor?.('#07131c');
    t.setBackgroundColor?.('#07131c');
    t.enableClosingConfirmation?.();
  } catch { /* вне Telegram */ }
}

export const tgData = () => wa()?.initData ?? '';
export const isTelegram = () => !!tgData();
export const tgUser = () => wa()?.initDataUnsafe?.user ?? null;

let hapticsAllowed = true;
export function setHaptics(on: boolean) { hapticsAllowed = on; }

function safe(fn: () => void) { if (!hapticsAllowed) return; try { fn(); } catch { /* нет поддержки */ } }

export const haptic = {
  select: () => safe(() => wa()?.HapticFeedback?.selectionChanged()),
  light: () => safe(() => wa()?.HapticFeedback?.impactOccurred('light')),
  medium: () => safe(() => wa()?.HapticFeedback?.impactOccurred('medium')),
  heavy: () => safe(() => wa()?.HapticFeedback?.impactOccurred('heavy')),
  success: () => safe(() => wa()?.HapticFeedback?.notificationOccurred('success')),
  warning: () => safe(() => wa()?.HapticFeedback?.notificationOccurred('warning')),
  error: () => safe(() => wa()?.HapticFeedback?.notificationOccurred('error')),
  /** выраженный отклик при появлении огромного силуэта или обрыве */
  colossal: () => { safe(() => wa()?.HapticFeedback?.impactOccurred('rigid')); setTimeout(() => safe(() => wa()?.HapticFeedback?.impactOccurred('heavy')), 120); },
};

export function openLink(url: string) {
  const t = wa();
  if (t?.openTelegramLink && /^https?:\/\/t\.me\//.test(url)) return t.openTelegramLink(url);
  if (t?.openLink) return t.openLink(url);
  window.open(url, '_blank');
}

export function shareToStory(mediaUrl: string, params?: Record<string, unknown>) {
  const t = wa();
  if (t?.shareToStory) { try { t.shareToStory(mediaUrl, params); return true; } catch { return false; } }
  return false;
}

export function showAlert(message: string) {
  const t = wa();
  if (t?.showAlert) return t.showAlert(message);
  window.alert(message);
}

export function showConfirm(message: string): Promise<boolean> {
  const t = wa();
  if (t?.showConfirm) return new Promise((r) => t.showConfirm(message, (ok: boolean) => r(ok)));
  return Promise.resolve(window.confirm(message));
}

export function copyText(text: string) {
  try { navigator.clipboard?.writeText(text); } catch { /* ignore */ }
}

export const platform = () => wa()?.platform ?? 'web';
export const viewportHeight = () => wa()?.viewportHeight ?? window.innerHeight;
