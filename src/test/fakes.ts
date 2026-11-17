import { vi } from 'vitest';
import { validateFile } from '@/domain/files';
import type { LoadedImage } from '@/services/images';
import type { ProjectRecord, ProjectRepository } from '@/services/projectRepository';
import type { DiffComputation } from '@/domain/diff';
import { DEFAULT_DIFF_SETTINGS, DEFAULT_VIEW_SETTINGS, type DiffSettings } from '@/domain/types';
import type { DiffResult } from '@/services/diffProtocol';

export function fakeLoadedImage(name: string, width = 100, height = 80): LoadedImage {
  return {
    name,
    type: 'image/png',
    bytes: 2048,
    width,
    height,
    blob: new Blob([name], { type: 'image/png' }),
    bitmap: { width, height, close: vi.fn() },
  };
}

/** Applies the real pre-decode validation, then pretends to decode. */
export function fakeLoadFile(file: File): Promise<LoadedImage> {
  const error = validateFile(file);
  return error ? Promise.reject(error) : Promise.resolve(fakeLoadedImage(file.name));
}

export function pngFile(name: string): File {
  return new File([new Uint8Array([137, 80, 78, 71])], name, { type: 'image/png' });
}

export function fakeProject(id: string, name: string): ProjectRecord {
  return {
    id,
    name,
    createdAt: 1,
    updatedAt: 1_700_000_000_000,
    settings: DEFAULT_DIFF_SETTINGS,
    view: DEFAULT_VIEW_SETTINGS,
    images: {
      reference: { name: 'a.png', type: 'image/png', bytes: 1, width: 1280, height: 800 },
      implementation: { name: 'b.png', type: 'image/png', bytes: 1, width: 1280, height: 800 },
    },
  };
}

export function fakeRepository(initial: ProjectRecord[] = []) {
  let projects = [...initial];
  return {
    list: vi.fn(() => Promise.resolve([...projects])),
    get: vi.fn(() => Promise.resolve(undefined)),
    create: vi.fn((record: Omit<ProjectRecord, 'createdAt' | 'updatedAt'>) =>
      Promise.resolve<ProjectRecord>({ ...record, createdAt: 1, updatedAt: 1 }),
    ),
    update: vi.fn(() => Promise.resolve()),
    remove: vi.fn((id: string) => {
      projects = projects.filter((project) => project.id !== id);
      return Promise.resolve();
    }),
  } satisfies ProjectRepository;
}

/** Wrap a real computation as the worker would return it, without the raw mask. */
export function fakeResult(computation: DiffComputation, settings: DiffSettings): DiffResult {
  return {
    layout: computation.layout,
    stats: computation.stats,
    density: computation.density,
    maskBitmap: null,
    settings,
    compareMs: 4.2,
    decodeMs: 0,
  };
}
