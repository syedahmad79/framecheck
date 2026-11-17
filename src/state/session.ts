import { useStore } from 'zustand';
import { createBrowserDiffClient } from '@/services/diffClient';
import { loadImageBlob } from '@/services/images';
import { createProjectRepository } from '@/services/projectRepository';
import { createSessionStore, type SessionState } from './sessionStore';

/** Application singletons. Tests build their own store with `createSessionStore`. */
export const projectRepository = createProjectRepository();

const sampleUrl = (file: string) => `${import.meta.env.BASE_URL}sample/${file}`;

export const sessionStore = createSessionStore({
  repository: projectRepository,
  diffClient: createBrowserDiffClient(),
  loadBlob: loadImageBlob,
  fetchBlob: async (url) => {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Could not load the sample (HTTP ${response.status}).`);
    return response.blob();
  },
  sample: {
    name: 'Sample: billing settings',
    reference: { url: sampleUrl('reference.png'), name: 'reference.png' },
    implementation: { url: sampleUrl('implementation.png'), name: 'implementation.png' },
  },
});

export function useSession<T>(selector: (state: SessionState) => T): T {
  return useStore(sessionStore, selector);
}
