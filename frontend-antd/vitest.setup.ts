import { cleanup } from '@testing-library/react';
import { afterEach, beforeAll } from 'vitest';

// Testing Library only auto-cleans when it finds a global `afterEach`; the tests
// of this project import the hooks from `vitest` explicitly.
afterEach(() => {
  cleanup();
});

beforeAll(() => {
  // The responsive helpers of rc-util and the wave effect of the buttons read
  // `matchMedia`, which happy-dom does not implement. A stub that reports a
  // desktop viewport keeps every breakpoint on the wide side.
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

  // rc-util observes the element size to decide whether a table scrolls. Resize
  // Observer is missing in happy-dom as well and every layout aware component
  // would throw while subscribing.
  if (typeof globalThis.ResizeObserver === 'undefined') {
    class StubResizeObserver implements ResizeObserver {
      observe(): void {
        // No layout happens in happy-dom, so nothing can be resized.
      }

      unobserve(): void {
        // Nothing was observed.
      }

      disconnect(): void {
        // Nothing was observed.
      }
    }

    globalThis.ResizeObserver = StubResizeObserver;
  }
});
