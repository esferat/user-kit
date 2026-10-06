import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ICONS } from './icons';

const ICON_ENTRIES = Object.entries(ICONS);

/**
 * Иконка Ant Design отображается в виде единственного `<svg>`, у которого `<path>`
 * содержит геометрию. Если компонент разрешится в что-то другое, в shell bar
 * появится пустой прямоугольник, поэтому каждая иконка отрисовывается здесь
 * вместо проверки во время выполнения.
 */
describe('application icons', () => {
  it.each(ICON_ENTRIES)('renders the "%s" icon with path data', (_name, Icon) => {
    const { container } = render(<Icon />);
    const paths = container.querySelectorAll('svg path');

    expect(paths.length).toBeGreaterThan(0);
    expect(paths[0].getAttribute('d')).toBeTruthy();
  });

  it('names every icon of the shell only once per purpose', () => {
    // Переключатель темы отображает противоположную текущей схеме, поэтому
    // обе записи должны существовать и быть разными компонентами.
    expect(ICONS.lightTheme).not.toBe(ICONS.darkTheme);
  });
});
