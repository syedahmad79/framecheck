import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createThemeStore, resolveTheme, THEME_STORAGE_KEY } from './theme';

function mockSystemTheme(dark: boolean) {
  const listeners = new Set<() => void>();
  const query = {
    matches: dark,
    addEventListener: (_: string, listener: () => void) => listeners.add(listener),
    removeEventListener: (_: string, listener: () => void) => listeners.delete(listener),
  };
  vi.stubGlobal('matchMedia', () => query);
  return {
    set(next: boolean) {
      query.matches = next;
      listeners.forEach((listener) => listener());
    },
  };
}

beforeEach(() => {
  localStorage.clear();
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('theme store', () => {
  it('follows the system theme by default and applies it to the document', () => {
    mockSystemTheme(true);
    const store = createThemeStore();
    expect(store.getState()).toMatchObject({ preference: 'system', resolved: 'dark' });
    expect(document.documentElement.dataset.theme).toBe('dark');
  });

  it('persists an explicit choice and restores it in a new session', () => {
    mockSystemTheme(true);
    createThemeStore().getState().setPreference('light');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');
    expect(document.documentElement.dataset.theme).toBe('light');

    const next = createThemeStore();
    expect(next.getState()).toMatchObject({ preference: 'light', resolved: 'light' });
  });

  it('tracks system changes only while the preference is "system"', () => {
    const system = mockSystemTheme(false);
    const store = createThemeStore();
    system.set(true);
    expect(store.getState().resolved).toBe('dark');
    store.getState().setPreference('light');
    system.set(false);
    system.set(true);
    expect(store.getState().resolved).toBe('light');
    expect(document.documentElement.dataset.theme).toBe('light');
  });

  it('ignores an invalid stored value', () => {
    mockSystemTheme(false);
    localStorage.setItem(THEME_STORAGE_KEY, 'purple');
    expect(createThemeStore().getState().preference).toBe('system');
  });

  it('keeps working when storage throws', () => {
    mockSystemTheme(false);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const store = createThemeStore();
    expect(() => store.getState().setPreference('dark')).not.toThrow();
    expect(store.getState().resolved).toBe('dark');
  });

  it('resolves explicit preferences without consulting the system', () => {
    mockSystemTheme(true);
    expect(resolveTheme('light')).toBe('light');
    expect(resolveTheme('dark')).toBe('dark');
  });
});
