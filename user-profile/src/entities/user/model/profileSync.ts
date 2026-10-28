const CHANNEL_NAME = 'user-kit:profile';

/**
 * Весточка «профиль изменился» между вкладками.
 *
 * Внутри одной вкладки кешем рулит синглтон QueryClient (см. `AppProviders`):
 * `invalidateQueries` после сохранения доходит до всех exposes сам. А вот
 * BroadcastChannel не доставляет сообщение вкладке-отправителю — его задача
 * другая: страница профиля, открытая во второй вкладке, тоже должна увидеть
 * новый аватар, а не показывать старую картинку до перезагрузки.
 */

/** Публикует событие «профиль сохранён» во все вкладки, кроме текущей. */
export function publishProfileUpdated(): void {
  if (typeof BroadcastChannel === 'undefined') {
    return;
  }
  const channel = new BroadcastChannel(CHANNEL_NAME);
  channel.postMessage('profile-updated');
  // Канал закрывается сразу после отправки: слушатели — на принимающей стороне.
  channel.close();
}

/**
 * Подписывается на «профиль изменился» из других вкладок. Возвращает функцию
 * отписки; в окружении без BroadcastChannel (SSR, старый браузер) подписка —
 * пустышка, обновляет в таком случае нечего.
 */
export function subscribeProfileUpdated(listener: () => void): () => void {
  if (typeof BroadcastChannel === 'undefined') {
    return () => {};
  }
  const channel = new BroadcastChannel(CHANNEL_NAME);
  channel.onmessage = listener;
  return () => channel.close();
}
