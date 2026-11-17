import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_DIFF_SETTINGS, DEFAULT_VIEW_SETTINGS } from '@/domain/types';
import { createProjectRepository, type ProjectRepository } from './projectRepository';

let counter = 0;
let clock = 1000;
let repository: ProjectRepository;

const input = (id: string, name = 'Checkout') => ({
  id,
  name,
  settings: DEFAULT_DIFF_SETTINGS,
  view: DEFAULT_VIEW_SETTINGS,
  images: {
    reference: { name: 'ref.png', type: 'image/png', bytes: 3, width: 10, height: 10 },
    implementation: { name: 'impl.png', type: 'image/png', bytes: 4, width: 10, height: 12 },
  },
});

const blobs = () => ({
  reference: new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' }),
  implementation: new Blob([new Uint8Array([4, 5, 6, 7])], { type: 'image/png' }),
});

beforeEach(() => {
  clock = 1000;
  repository = createProjectRepository(`framecheck-test-${counter++}`, () => clock++);
});

describe('project repository', () => {
  it('round-trips a project with its image bytes and MIME types', async () => {
    const created = await repository.create(input('p1'), blobs());
    expect(created.createdAt).toBe(1000);

    const stored = await repository.get('p1');
    expect(stored?.record).toEqual(created);
    expect(stored?.blobs.reference.type).toBe('image/png');
    expect(new Uint8Array(await (stored?.blobs.reference.arrayBuffer() ?? []))).toEqual(
      new Uint8Array([1, 2, 3]),
    );
    expect(new Uint8Array(await (stored?.blobs.implementation.arrayBuffer() ?? []))).toEqual(
      new Uint8Array([4, 5, 6, 7]),
    );
  });

  it('lists projects most recently updated first', async () => {
    await repository.create(input('old', 'Old'), blobs());
    await repository.create(input('new', 'New'), blobs());
    expect((await repository.list()).map((p) => p.id)).toEqual(['new', 'old']);

    await repository.update('old', { name: 'Old, renamed' });
    const listed = await repository.list();
    expect(listed.map((p) => p.id)).toEqual(['old', 'new']);
    expect(listed[0]?.name).toBe('Old, renamed');
  });

  it('updates settings and view without touching other fields', async () => {
    const created = await repository.create(input('p1'), blobs());
    await repository.update('p1', {
      settings: { ...DEFAULT_DIFF_SETTINGS, threshold: 0.25 },
      view: { ...DEFAULT_VIEW_SETTINGS, mode: 'diff' },
    });
    const stored = await repository.get('p1');
    expect(stored?.record.settings.threshold).toBe(0.25);
    expect(stored?.record.view.mode).toBe('diff');
    expect(stored?.record.name).toBe('Checkout');
    expect(stored?.record.createdAt).toBe(created.createdAt);
    expect(stored?.record.updatedAt).toBeGreaterThan(created.updatedAt);
  });

  it('removes a project together with its images', async () => {
    await repository.create(input('p1'), blobs());
    await repository.create(input('p2'), blobs());
    await repository.remove('p1');
    expect(await repository.get('p1')).toBeUndefined();
    expect((await repository.list()).map((p) => p.id)).toEqual(['p2']);
    expect(await repository.get('p2')).toBeDefined();
  });

  it('returns undefined for an unknown id', async () => {
    expect(await repository.get('missing')).toBeUndefined();
  });
});
