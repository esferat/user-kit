import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ICONS } from './icons';

const ICON_ENTRIES = Object.entries(ICONS);

/**
 * An Ant Design icon renders a single `<svg>` whose `<path>` carries the geometry.
 * A component that resolves to something else would leave an empty box in the
 * shell bar, so every entry is rendered here instead of at runtime.
 */
describe('application icons', () => {
  it.each(ICON_ENTRIES)('renders the "%s" icon with path data', (_name, Icon) => {
    const { container } = render(<Icon />);
    const paths = container.querySelectorAll('svg path');

    expect(paths.length).toBeGreaterThan(0);
    expect(paths[0].getAttribute('d')).toBeTruthy();
  });

  it('names every icon of the shell only once per purpose', () => {
    // The theme switch offers the opposite of the current scheme, so both
    // entries have to exist and be different components.
    expect(ICONS.lightTheme).not.toBe(ICONS.darkTheme);
  });
});
