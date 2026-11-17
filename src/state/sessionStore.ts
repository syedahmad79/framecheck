import { createStore, type StoreApi } from 'zustand/vanilla';
import { stripExtension } from '@/domain/files';
import {
  DEFAULT_DIFF_SETTINGS,
  DEFAULT_VIEW_SETTINGS,
  IMAGE_ROLES,
  type DiffSettings,
  type ViewSettings,
} from '@/domain/types';
import type { DiffClient } from '@/services/diffClient';
import type { DiffResult } from '@/services/diffProtocol';
import { releaseImage, toImageMeta, type ImagePair, type LoadedImage } from '@/services/images';
import type { ProjectRepository } from '@/services/projectRepository';

export interface SessionProject {
  readonly id: string;
  readonly name: string;
  /** False for the sample and when saving to IndexedDB failed. */
  readonly persisted: boolean;
  readonly isSample: boolean;
}

export interface DiffState {
  readonly status: 'idle' | 'computing' | 'ready' | 'error';
  /** The latest completed result. Kept while a newer comparison is computing. */
  readonly result: DiffResult | null;
  readonly error: string | null;
}

export type SessionStatus = 'idle' | 'opening' | 'ready' | 'error';

export interface SessionState {
  readonly status: SessionStatus;
  readonly error: string | null;
  readonly project: SessionProject | null;
  readonly images: ImagePair | null;
  readonly settings: DiffSettings;
  readonly view: ViewSettings;
  readonly diff: DiffState;
  /** Set when the project could not be written to local storage. */
  readonly saveError: string | null;

  /**
   * Start a new comparison from two decoded images. The comparison is usable immediately;
   * `saved` settles once the attempt to write it to local storage has finished.
   */
  openImages(images: ImagePair): { readonly id: string; readonly saved: Promise<void> };
  readonly openProject: (id: string) => Promise<void>;
  readonly openSample: () => Promise<void>;
  readonly close: () => void;
  readonly updateSettings: (patch: Partial<DiffSettings>) => void;
  readonly updateView: (patch: Partial<ViewSettings>) => void;
  readonly rename: (name: string) => void;
  readonly retryDiff: () => void;
}

export interface SampleSource {
  readonly name: string;
  readonly reference: { readonly url: string; readonly name: string };
  readonly implementation: { readonly url: string; readonly name: string };
}

export interface SessionDependencies {
  readonly repository: ProjectRepository;
  readonly diffClient: Pick<DiffClient, 'run'>;
  readonly loadBlob: (blob: Blob, meta: { name: string; type?: string }) => Promise<LoadedImage>;
  readonly fetchBlob: (url: string) => Promise<Blob>;
  readonly sample: SampleSource;
  readonly createId?: () => string;
  /** Delay before a settings change triggers a comparison, so slider drags are coalesced. */
  readonly diffDebounceMs?: number;
  readonly saveDebounceMs?: number;
}

export const SAMPLE_PROJECT_ID = 'sample';

const IDLE_DIFF: DiffState = { status: 'idle', result: null, error: null };

const INITIAL = {
  status: 'idle',
  error: null,
  project: null,
  images: null,
  settings: DEFAULT_DIFF_SETTINGS,
  view: DEFAULT_VIEW_SETTINGS,
  diff: IDLE_DIFF,
  saveError: null,
} satisfies Partial<SessionState>;

function messageOf(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

export function defaultProjectName(images: ImagePair): string {
  const reference = stripExtension(images.reference.name);
  const implementation = stripExtension(images.implementation.name);
  return reference === implementation ? reference : `${reference} vs ${implementation}`;
}

export type SessionStore = StoreApi<SessionState>;

export function createSessionStore(deps: SessionDependencies): SessionStore {
  const createId = deps.createId ?? (() => crypto.randomUUID());
  const diffDebounceMs = deps.diffDebounceMs ?? 80;
  const saveDebounceMs = deps.saveDebounceMs ?? 400;

  // Incremented whenever the open comparison changes, so async work started for a
  // previous comparison can detect that it is no longer wanted.
  let generation = 0;
  let diffTimer: ReturnType<typeof setTimeout> | undefined;
  let saveTimer: ReturnType<typeof setTimeout> | undefined;

  return createStore<SessionState>()((set, get) => {
    function releaseCurrent(): void {
      const { images } = get();
      if (images) IMAGE_ROLES.forEach((role) => releaseImage(images[role]));
    }

    function reset(next: Partial<SessionState>): number {
      clearTimeout(diffTimer);
      flushSave();
      releaseCurrent();
      generation += 1;
      set({ ...INITIAL, ...next });
      return generation;
    }

    async function runDiff(): Promise<void> {
      const { images, project, settings, diff } = get();
      if (!images || !project) return;
      const startedFor = generation;
      set({ diff: { status: 'computing', result: diff.result, error: null } });
      try {
        const result = await deps.diffClient.run({
          sourceKey: project.id,
          reference: images.reference.blob,
          implementation: images.implementation.blob,
          settings,
        });
        // `null` means a newer request superseded this one.
        if (!result || startedFor !== generation) return;
        set({ diff: { status: 'ready', result, error: null } });
      } catch (error) {
        if (startedFor !== generation) return;
        set({
          diff: {
            status: 'error',
            result: null,
            error: messageOf(error, 'The comparison failed.'),
          },
        });
      }
    }

    function scheduleDiff(): void {
      clearTimeout(diffTimer);
      diffTimer = setTimeout(() => void runDiff(), diffDebounceMs);
    }

    function save(): void {
      const { project, settings, view } = get();
      if (!project?.persisted) return;
      deps.repository
        .update(project.id, { name: project.name, settings, view })
        .catch((error: unknown) => {
          if (get().project?.id === project.id) {
            set({ saveError: messageOf(error, 'Could not save changes.') });
          }
        });
    }

    function scheduleSave(): void {
      clearTimeout(saveTimer);
      saveTimer = setTimeout(() => {
        saveTimer = undefined;
        save();
      }, saveDebounceMs);
    }

    function flushSave(): void {
      if (saveTimer === undefined) return;
      clearTimeout(saveTimer);
      saveTimer = undefined;
      save();
    }

    async function decodePair(
      reference: { blob: Blob; name: string; type?: string },
      implementation: { blob: Blob; name: string; type?: string },
    ): Promise<ImagePair> {
      const results = await Promise.allSettled([
        deps.loadBlob(reference.blob, reference),
        deps.loadBlob(implementation.blob, implementation),
      ]);
      const [a, b] = results;
      if (a.status === 'fulfilled' && b.status === 'fulfilled') {
        return { reference: a.value, implementation: b.value };
      }
      // Do not leak the bitmap of the half that did decode.
      for (const result of results) if (result.status === 'fulfilled') releaseImage(result.value);
      throw a.status === 'rejected' ? a.reason : (b as PromiseRejectedResult).reason;
    }

    return {
      ...INITIAL,

      openImages(images) {
        const id = createId();
        const name = defaultProjectName(images);
        const mine = reset({
          status: 'ready',
          images,
          project: { id, name, persisted: false, isSample: false },
        });
        void runDiff();

        const { settings, view } = get();
        const saved = deps.repository
          .create(
            {
              id,
              name,
              settings,
              view,
              images: {
                reference: toImageMeta(images.reference),
                implementation: toImageMeta(images.implementation),
              },
            },
            { reference: images.reference.blob, implementation: images.implementation.blob },
          )
          .then(() => {
            const project = get().project;
            if (mine !== generation || !project) return;
            set({ project: { ...project, persisted: true } });
            // Anything changed while the first write was in flight still needs saving.
            scheduleSave();
          })
          .catch((error: unknown) => {
            if (mine === generation) {
              set({ saveError: messageOf(error, 'Could not save the comparison.') });
            }
          });
        return { id, saved };
      },

      async openProject(id) {
        const mine = reset({ status: 'opening' });
        try {
          const stored = await deps.repository.get(id);
          if (mine !== generation) return;
          if (!stored) {
            set({
              status: 'error',
              error: 'This comparison was not found in this browser. It may have been deleted.',
            });
            return;
          }
          const { record, blobs } = stored;
          const images = await decodePair(
            { blob: blobs.reference, ...record.images.reference },
            { blob: blobs.implementation, ...record.images.implementation },
          );
          if (mine !== generation) {
            IMAGE_ROLES.forEach((role) => releaseImage(images[role]));
            return;
          }
          set({
            status: 'ready',
            images,
            project: { id, name: record.name, persisted: true, isSample: false },
            settings: { ...DEFAULT_DIFF_SETTINGS, ...record.settings },
            view: { ...DEFAULT_VIEW_SETTINGS, ...record.view },
          });
          void runDiff();
        } catch (error) {
          if (mine !== generation) return;
          set({ status: 'error', error: messageOf(error, 'Could not open the comparison.') });
        }
      },

      async openSample() {
        const mine = reset({ status: 'opening' });
        const { sample } = deps;
        try {
          const [reference, implementation] = await Promise.all([
            deps.fetchBlob(sample.reference.url),
            deps.fetchBlob(sample.implementation.url),
          ]);
          if (mine !== generation) return;
          const images = await decodePair(
            { blob: reference, name: sample.reference.name },
            { blob: implementation, name: sample.implementation.name },
          );
          if (mine !== generation) {
            IMAGE_ROLES.forEach((role) => releaseImage(images[role]));
            return;
          }
          set({
            status: 'ready',
            images,
            project: { id: SAMPLE_PROJECT_ID, name: sample.name, persisted: false, isSample: true },
          });
          void runDiff();
        } catch (error) {
          if (mine !== generation) return;
          set({ status: 'error', error: messageOf(error, 'Could not load the sample.') });
        }
      },

      close() {
        reset({});
      },

      updateSettings(patch) {
        set({ settings: { ...get().settings, ...patch } });
        scheduleDiff();
        scheduleSave();
      },

      updateView(patch) {
        set({ view: { ...get().view, ...patch } });
        scheduleSave();
      },

      rename(name) {
        const { project } = get();
        const trimmed = name.trim();
        if (!project || !trimmed || trimmed === project.name) return;
        set({ project: { ...project, name: trimmed } });
        scheduleSave();
      },

      retryDiff() {
        void runDiff();
      },
    };
  });
}
