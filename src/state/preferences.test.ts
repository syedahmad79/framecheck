import { beforeEach, describe, expect, it, vi } from 'vitest';

beforeEach(() => {
  localStorage.clear();
  vi.resetModules();
});

describe('preferences store', () => {
  it('has no saved inspector choice by default, so the viewport decides', async () => {
    const { preferencesStore } = await import('./preferences');
    expect(preferencesStore.getState()).toMatchObject({
      inspectorOpen: null,
      hintDismissed: false,
    });
  });

  it('persists choices across sessions', async () => {
    const first = await import('./preferences');
    first.preferencesStore.getState().setInspectorOpen(false);
    first.preferencesStore.getState().dismissHint();
    vi.resetModules();
    const second = await import('./preferences');
    expect(second.preferencesStore.getState()).toMatchObject({
      inspectorOpen: false,
      hintDismissed: true,
    });
  });

  it('survives corrupt stored data', async () => {
    localStorage.setItem('framecheck:preferences', '{not json');
    const { preferencesStore } = await import('./preferences');
    expect(preferencesStore.getState().inspectorOpen).toBeNull();
  });
});
