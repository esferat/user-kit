import '@ui5/webcomponents-icons/dist/AllIcons.js';
import '@ui5/webcomponents/dist/Table.js';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Testing Library only auto-cleans when it finds a global `afterEach`; the tests
// of this project import the hooks from `vitest` explicitly.
afterEach(() => {
  cleanup();
});

// UI5 Table scrolls a focused cell into view by reading its rendered header row.
// happy-dom never renders one, so the internal lookup would throw inside the
// focusin listener and happy-dom would report it as an unhandled rejection.
interface TableInternals {
  headerRow: unknown[];
  _scrollElementIntoView: (element: Element) => void;
}

const tablePrototype = customElements.get('ui5-table')?.prototype as TableInternals | undefined;

if (tablePrototype?._scrollElementIntoView !== undefined) {
  const scrollElementIntoView = tablePrototype._scrollElementIntoView;

  tablePrototype._scrollElementIntoView = function scrollWithoutLayout(this: TableInternals, element) {
    if (this.headerRow.length === 0) {
      return;
    }
    scrollElementIntoView.call(this, element);
  };
}
