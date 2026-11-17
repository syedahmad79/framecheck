import { useStore } from 'zustand';
import { createStore } from 'zustand/vanilla';
import type { ImageRole, Point } from '@/domain/types';

/** The canvas pixel under the pointer, shared so every pane can mark it and the readout can report it. */
export const probeStore = createStore<{ point: Point | null }>()(() => ({ point: null }));

/** A held key that temporarily shows one image on its own, for quick flicker comparison. */
export const peekStore = createStore<{ peek: ImageRole | null }>()(() => ({ peek: null }));

export function usePeek(): ImageRole | null {
  return useStore(peekStore, (state) => state.peek);
}

export function useProbe(): Point | null {
  return useStore(probeStore, (state) => state.point);
}
