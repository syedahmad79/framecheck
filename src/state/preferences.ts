import { useStore } from 'zustand';
import { createStore } from 'zustand/vanilla';
import { readStored, writeStored } from './storage';

const KEY = 'framecheck:preferences';

export interface PreferencesState {
  /** Whether the inspector is open; `null` means "never chosen", so the viewport decides. */
  readonly inspectorOpen: boolean | null;
  readonly hintDismissed: boolean;
  readonly setInspectorOpen: (open: boolean) => void;
  readonly dismissHint: () => void;
}

interface Persisted {
  inspectorOpen?: boolean;
  hintDismissed?: boolean;
}

function load(): Persisted {
  try {
    const parsed: unknown = JSON.parse(readStored(KEY) ?? '{}');
    return typeof parsed === 'object' && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

export const preferencesStore = createStore<PreferencesState>()((set, get) => {
  const saved = load();
  const persist = () => {
    const { inspectorOpen, hintDismissed } = get();
    writeStored(KEY, JSON.stringify({ inspectorOpen, hintDismissed }));
  };
  return {
    inspectorOpen: typeof saved.inspectorOpen === 'boolean' ? saved.inspectorOpen : null,
    hintDismissed: saved.hintDismissed === true,
    setInspectorOpen: (open) => {
      set({ inspectorOpen: open });
      persist();
    },
    dismissHint: () => {
      set({ hintDismissed: true });
      persist();
    },
  };
});

export function usePreferences<T>(selector: (state: PreferencesState) => T): T {
  return useStore(preferencesStore, selector);
}
