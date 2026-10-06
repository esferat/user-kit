import '@ui5/webcomponents-icons/dist/AllIcons.js';
import '@ui5/webcomponents/dist/Table.js';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Testing Library автоматически очищается только при наличии глобального `afterEach`;
// тесты этого проекта импортируют хуки из `vitest` явно.
afterEach(() => {
  cleanup();
});

// UI5 Table прокручивает ячейку в поле видимости, читая отрендеренную строку заголовка.
// happy-dom никогда её не рендерит, поэтому внутренний поиск выбросил бы ошибку
// внутри слушателя focusin, и happy-dom сообщил бы о ней как об unhandled rejection.
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
