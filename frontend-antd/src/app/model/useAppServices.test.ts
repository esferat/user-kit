import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { useAppServices, type AppServices } from './useAppServices';

import { readConfig, type AppConfig } from '@/shared/config';

function configOf(overrides: Record<string, string>): AppConfig {
  return readConfig(overrides);
}

describe('useAppServices', () => {
  it('creates the services of the configured application', () => {
    const { result } = renderHook(() => useAppServices(configOf({})));

    expect(result.current.auth).toBeDefined();
    expect(result.current.router).toBeDefined();
    expect(result.current.session).toBeDefined();
    expect(result.current.themeStore.theme).toBe('light');
  });

  it('keeps the services while the configuration stays the same', () => {
    const config = configOf({});
    const seen: AppServices[] = [];
    const { rerender } = renderHook(
      ({ current }) => {
        seen.push(useAppServices(current));
        return seen.length;
      },
      { initialProps: { current: config } },
    );

    rerender({ current: config });

    expect(seen).toHaveLength(2);
    expect(seen[1]).toBe(seen[0]);
  });

  it('rebuilds the services for a different configuration', () => {
    const { result, rerender } = renderHook(({ current }) => useAppServices(current), {
      initialProps: { current: configOf({ VITE_ANTD_THEME: 'light' }) },
    });
    const first = result.current;

    rerender({ current: configOf({ VITE_ANTD_THEME: 'dark' }) });

    expect(result.current).not.toBe(first);
    expect(result.current.themeStore.theme).toBe('dark');
  });
});
