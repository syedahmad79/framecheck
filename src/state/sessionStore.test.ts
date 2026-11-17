import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_DIFF_SETTINGS, DEFAULT_VIEW_SETTINGS } from '@/domain/types';
import type { DiffJob } from '@/services/diffClient';
import type { DiffResult } from '@/services/diffProtocol';
import type { ImagePair, LoadedImage } from '@/services/images';
import type { ProjectRecord, ProjectRepository } from '@/services/projectRepository';
import { createSessionStore, defaultProjectName, type SessionDependencies } from './sessionStore';

const closeBitmap = vi.fn();

function fakeImage(name: string, width = 10, height = 10): LoadedImage {
  return {
    name,
    type: 'image/png',
    bytes: 4,
    width,
    height,
    blob: new Blob([name]),
    bitmap: { width, height, close: closeBitmap },
  };
}

const pair = (): ImagePair => ({
  reference: fakeImage('home.png'),
  implementation: fakeImage('home-build.png'),
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const resultFor = (job: DiffJob) => ({ settings: job.settings }) as DiffResult;

function setup(overrides: Partial<SessionDependencies> = {}) {
  const repository = {
    list: vi.fn(() => Promise.resolve([])),
    get: vi.fn(() => Promise.resolve(undefined)),
    create: vi.fn((record: Omit<ProjectRecord, 'createdAt' | 'updatedAt'>) =>
      Promise.resolve<ProjectRecord>({ ...record, createdAt: 1, updatedAt: 1 }),
    ),
    update: vi.fn(() => Promise.resolve()),
    remove: vi.fn(() => Promise.resolve()),
  } satisfies ProjectRepository;
  const run = vi.fn((job: DiffJob) => Promise.resolve<DiffResult | null>(resultFor(job)));
  const store = createSessionStore({
    repository,
    diffClient: { run },
    loadBlob: vi.fn((_blob: Blob, meta: { name: string }) => Promise.resolve(fakeImage(meta.name))),
    fetchBlob: vi.fn(() => Promise.resolve(new Blob(['x']))),
    sample: {
      name: 'Sample',
      reference: { url: '/r.png', name: 'r.png' },
      implementation: { url: '/i.png', name: 'i.png' },
    },
    createId: () => 'new-id',
    ...overrides,
  });
  return { store, repository, run };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('defaultProjectName', () => {
  it('joins distinct file names and collapses identical ones', () => {
    expect(defaultProjectName(pair())).toBe('home vs home-build');
    expect(
      defaultProjectName({ reference: fakeImage('a.png'), implementation: fakeImage('a.jpg') }),
    ).toBe('a');
  });
});

describe('session store', () => {
  it('opens images, runs the first comparison immediately and saves the project', async () => {
    const { store, repository, run } = setup();
    const { id, saved } = store.getState().openImages(pair());
    await saved;
    await vi.runAllTimersAsync();

    const state = store.getState();
    expect(id).toBe('new-id');
    expect(state.status).toBe('ready');
    expect(state.project).toEqual({
      id: 'new-id',
      name: 'home vs home-build',
      persisted: true,
      isSample: false,
    });
    expect(state.diff.status).toBe('ready');
    expect(run).toHaveBeenCalledTimes(1);
    expect(run.mock.calls[0]?.[0].sourceKey).toBe('new-id');
    expect(repository.create).toHaveBeenCalledTimes(1);
    expect(repository.create.mock.calls[0]?.[0].images.reference).toEqual({
      name: 'home.png',
      type: 'image/png',
      bytes: 4,
      width: 10,
      height: 10,
    });
  });

  it('keeps working and reports the failure when the project cannot be saved', async () => {
    const { store, repository } = setup();
    repository.create.mockRejectedValueOnce(new Error('Quota is full'));
    await store.getState().openImages(pair()).saved;

    const state = store.getState();
    expect(state.status).toBe('ready');
    expect(state.project?.persisted).toBe(false);
    expect(state.saveError).toBe('Quota is full');
  });

  it('coalesces rapid settings changes into one comparison with the final value', async () => {
    const { store, run } = setup();
    await store.getState().openImages(pair()).saved;
    await vi.runAllTimersAsync();
    run.mockClear();

    store.getState().updateSettings({ threshold: 0.2 });
    store.getState().updateSettings({ threshold: 0.3 });
    store.getState().updateSettings({ threshold: 0.4 });
    expect(run).not.toHaveBeenCalled();
    await vi.runAllTimersAsync();

    expect(run).toHaveBeenCalledTimes(1);
    expect(run.mock.calls[0]?.[0].settings.threshold).toBe(0.4);
    expect(store.getState().diff.result?.settings.threshold).toBe(0.4);
  });

  it('keeps the previous result visible while a new comparison is computing', async () => {
    const { store, run } = setup();
    await store.getState().openImages(pair()).saved;
    await vi.runAllTimersAsync();
    const first = store.getState().diff.result;

    const next = deferred<DiffResult | null>();
    run.mockReturnValueOnce(next.promise);
    store.getState().updateSettings({ includeAA: true });
    await vi.advanceTimersByTimeAsync(100);

    expect(store.getState().diff).toMatchObject({ status: 'computing', result: first });
    next.resolve({ settings: store.getState().settings } as DiffResult);
    await vi.runAllTimersAsync();
    expect(store.getState().diff.status).toBe('ready');
    expect(store.getState().diff.result?.settings.includeAA).toBe(true);
  });

  it('ignores a superseded (null) result and surfaces comparison errors', async () => {
    const { store, run } = setup();
    await store.getState().openImages(pair()).saved;
    await vi.runAllTimersAsync();

    run.mockResolvedValueOnce(null);
    store.getState().retryDiff();
    await vi.runAllTimersAsync();
    expect(store.getState().diff.status).toBe('computing');

    run.mockRejectedValueOnce(new Error('Out of memory'));
    store.getState().retryDiff();
    await vi.runAllTimersAsync();
    expect(store.getState().diff).toEqual({
      status: 'error',
      result: null,
      error: 'Out of memory',
    });
  });

  it('debounces saving of settings, view and name changes', async () => {
    const { store, repository } = setup();
    await store.getState().openImages(pair()).saved;
    await vi.runAllTimersAsync();
    repository.update.mockClear();

    store.getState().updateView({ mode: 'overlay' });
    store.getState().updateView({ overlayOpacity: 0.8 });
    store.getState().rename('  Checkout  ');
    expect(repository.update).not.toHaveBeenCalled();
    await vi.runAllTimersAsync();

    expect(repository.update).toHaveBeenCalledTimes(1);
    expect(repository.update).toHaveBeenCalledWith('new-id', {
      name: 'Checkout',
      settings: DEFAULT_DIFF_SETTINGS,
      view: { ...DEFAULT_VIEW_SETTINGS, mode: 'overlay', overlayOpacity: 0.8 },
    });
  });

  it('flushes a pending save and releases bitmaps when closing', async () => {
    const { store, repository } = setup();
    const images = pair();
    await store.getState().openImages(images).saved;
    await vi.runAllTimersAsync();
    repository.update.mockClear();
    closeBitmap.mockClear();

    store.getState().updateView({ mode: 'diff' });
    store.getState().close();

    expect(repository.update).toHaveBeenCalledTimes(1);
    expect(closeBitmap).toHaveBeenCalledTimes(2);
    expect(store.getState()).toMatchObject({ status: 'idle', project: null, images: null });
  });

  it('restores a saved project with its settings and view', async () => {
    const { store, repository, run } = setup();
    const record: ProjectRecord = {
      id: 'p1',
      name: 'Saved',
      createdAt: 1,
      updatedAt: 2,
      settings: { ...DEFAULT_DIFF_SETTINGS, threshold: 0.3, strategy: 'crop' },
      view: { ...DEFAULT_VIEW_SETTINGS, mode: 'slider' },
      images: {
        reference: { name: 'a.png', type: 'image/png', bytes: 1, width: 10, height: 10 },
        implementation: { name: 'b.png', type: 'image/png', bytes: 1, width: 10, height: 10 },
      },
    };
    repository.get.mockResolvedValueOnce({
      record,
      blobs: { reference: new Blob(['a']), implementation: new Blob(['b']) },
    } as never);

    await store.getState().openProject('p1');
    await vi.runAllTimersAsync();

    const state = store.getState();
    expect(state.project).toMatchObject({ id: 'p1', name: 'Saved', persisted: true });
    expect(state.settings.threshold).toBe(0.3);
    expect(state.view.mode).toBe('slider');
    expect(state.images?.reference.name).toBe('a.png');
    expect(run.mock.calls[0]?.[0].settings.strategy).toBe('crop');
  });

  it('reports a missing project as an error state', async () => {
    const { store } = setup();
    await store.getState().openProject('nope');
    expect(store.getState().status).toBe('error');
    expect(store.getState().error).toMatch(/not found/);
  });

  it('opens the sample without persisting it', async () => {
    const { store, repository } = setup();
    await store.getState().openSample();
    await vi.runAllTimersAsync();

    expect(store.getState().project).toMatchObject({ isSample: true, persisted: false });
    store.getState().updateView({ mode: 'diff' });
    await vi.runAllTimersAsync();
    expect(repository.create).not.toHaveBeenCalled();
    expect(repository.update).not.toHaveBeenCalled();
  });

  it('discards a slow open when the user has moved on', async () => {
    const slow = deferred<undefined>();
    const { store, repository } = setup();
    repository.get.mockReturnValueOnce(slow.promise);

    const opening = store.getState().openProject('p1');
    store.getState().close();
    slow.resolve(undefined);
    await opening;

    expect(store.getState().status).toBe('idle');
    expect(store.getState().error).toBeNull();
  });
});
