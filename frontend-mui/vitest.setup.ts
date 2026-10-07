import { cleanup } from '@testing-library/react';
import { afterEach, beforeAll } from 'vitest';

// Testing Library автоматически очищается только при наличии глобального `afterEach`;
// тесты этого проекта импортируют хуки из `vitest` явно.
afterEach(() => {
  cleanup();
});

beforeAll(() => {
  // Адаптивные хелперы rc-util и волновой эффект кнопок читают `matchMedia`,
  // который happy-dom не реализует. Заглушка, сообщающая о десктопном вьюпорте,
  // оставляет все breakpoint'ы на широкой стороне.
  if (typeof window.matchMedia !== 'function') {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: (query: string): MediaQueryList =>
        ({
          matches: false,
          media: query,
          onchange: null,
          addListener: () => undefined,
          removeListener: () => undefined,
          addEventListener: () => undefined,
          removeEventListener: () => undefined,
          dispatchEvent: () => false,
        }) as MediaQueryList,
    });
  }

  // rc-util отслеживает размер элемента, чтобы решить, нужен ли таблице скролл.
  // ResizeObserver отсутствует и в happy-dom, и любой компонент, учитывающий
  // layout, выбросил бы ошибку при подписке.
  if (typeof globalThis.ResizeObserver === 'undefined') {
    class StubResizeObserver implements ResizeObserver {
      observe(): void {
        // В happy-dom layout не выполняется, поэтому ничего не может изменить размер.
      }

      unobserve(): void {
        // Ничего не отслеживалось.
      }

      disconnect(): void {
        // Ничего не отслеживалось.
      }
    }

    globalThis.ResizeObserver = StubResizeObserver;
  }
});
