import { useStore } from 'zustand';
import { createStore } from 'zustand/vanilla';
import { readStored, writeStored } from './storage';

export const THEME_PREFERENCES = ['system', 'light', 'dark'] as const;
export type ThemePreference = (typeof THEME_PREFERENCES)[number];
export type ResolvedTheme = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'framecheck:theme';

export interface ThemeState {
  readonly preference: ThemePreference;
  readonly resolved: ResolvedTheme;
  readonly setPreference: (preference: ThemePreference) => void;
}

const DARK_QUERY = '(prefers-color-scheme: dark)';

function isPreference(value: string | null): value is ThemePreference {
  return (THEME_PREFERENCES as readonly (string | null)[]).includes(value);
}

function systemTheme(): ResolvedTheme {
  return typeof window.matchMedia === 'function' && window.matchMedia(DARK_QUERY).matches
    ? 'dark'
    : 'light';
}

export function resolveTheme(preference: ThemePreference): ResolvedTheme {
  return preference === 'system' ? systemTheme() : preference;
}

function apply(resolved: ResolvedTheme): void {
  document.documentElement.dataset.theme = resolved;
}

/**
 * Theme preference with system support. The stored choice is restored before first paint by the
 * inline script in index.html; this store takes over from there and keeps the two in step.
 */
export function createThemeStore() {
  const stored = readStored(THEME_STORAGE_KEY);
  const preference = isPreference(stored) ? stored : 'system';
  const store = createStore<ThemeState>()((set) => ({
    preference,
    resolved: resolveTheme(preference),
    setPreference: (next) => {
      writeStored(THEME_STORAGE_KEY, next);
      const resolved = resolveTheme(next);
      apply(resolved);
      set({ preference: next, resolved });
    },
  }));
  apply(store.getState().resolved);

  if (typeof window.matchMedia === 'function') {
    window.matchMedia(DARK_QUERY).addEventListener('change', () => {
      if (store.getState().preference !== 'system') return;
      const resolved = systemTheme();
      apply(resolved);
      store.setState({ resolved });
    });
  }
  return store;
}

export const themeStore = createThemeStore();

export function useTheme<T>(selector: (state: ThemeState) => T): T {
  return useStore(themeStore, selector);
}
