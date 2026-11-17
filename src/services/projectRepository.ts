import Dexie, { type Table } from 'dexie';
import { IMAGE_ROLES, type DiffSettings, type ImageRole, type ViewSettings } from '@/domain/types';
import type { ImageMeta } from './images';

export interface ProjectRecord {
  readonly id: string;
  readonly name: string;
  readonly createdAt: number;
  readonly updatedAt: number;
  readonly settings: DiffSettings;
  readonly view: ViewSettings;
  readonly images: Readonly<Record<ImageRole, ImageMeta>>;
}

/**
 * Encoded image bytes are stored as ArrayBuffers rather than Blobs: it behaves the
 * same in every IndexedDB implementation, including ones that cannot clone Blobs.
 */
interface ImageRecord {
  readonly projectId: string;
  readonly role: ImageRole;
  readonly type: string;
  readonly data: ArrayBuffer;
}

export interface StoredProject {
  readonly record: ProjectRecord;
  readonly blobs: Readonly<Record<ImageRole, Blob>>;
}

export type ProjectPatch = Partial<Pick<ProjectRecord, 'name' | 'settings' | 'view'>>;

export class StorageError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'StorageError';
  }
}

export interface ProjectRepository {
  list(): Promise<ProjectRecord[]>;
  get(id: string): Promise<StoredProject | undefined>;
  create(
    record: Omit<ProjectRecord, 'createdAt' | 'updatedAt'>,
    blobs: Readonly<Record<ImageRole, Blob>>,
  ): Promise<ProjectRecord>;
  update(id: string, patch: ProjectPatch): Promise<void>;
  remove(id: string): Promise<void>;
}

class FramecheckDatabase extends Dexie {
  projects!: Table<ProjectRecord, string>;
  images!: Table<ImageRecord, [string, ImageRole]>;

  constructor(name: string) {
    super(name);
    this.version(1).stores({
      projects: 'id, updatedAt',
      images: '[projectId+role], projectId',
    });
  }
}

function describeFailure(action: string, error: unknown): StorageError {
  const name = error instanceof Error ? error.name : '';
  const inner =
    error instanceof Dexie.DexieError && error.inner instanceof Error ? error.inner.name : '';
  if (name === 'QuotaExceededError' || inner === 'QuotaExceededError') {
    return new StorageError(
      `Could not ${action}: the browser’s storage quota is full. Delete some saved comparisons and try again.`,
      { cause: error },
    );
  }
  return new StorageError(
    `Could not ${action}. Local storage may be unavailable, for example in a private window.`,
    { cause: error },
  );
}

export function createProjectRepository(
  databaseName = 'framecheck',
  now: () => number = Date.now,
): ProjectRepository {
  const db = new FramecheckDatabase(databaseName);

  return {
    async list() {
      try {
        return await db.projects.orderBy('updatedAt').reverse().toArray();
      } catch (error) {
        throw describeFailure('load saved comparisons', error);
      }
    },

    async get(id) {
      try {
        const [record, images] = await Promise.all([
          db.projects.get(id),
          db.images.where('projectId').equals(id).toArray(),
        ]);
        if (!record) return undefined;
        const byRole = new Map(images.map((image) => [image.role, image]));
        const reference = byRole.get('reference');
        const implementation = byRole.get('implementation');
        if (!reference || !implementation) return undefined;
        return {
          record,
          blobs: {
            reference: new Blob([reference.data], { type: reference.type }),
            implementation: new Blob([implementation.data], { type: implementation.type }),
          },
        };
      } catch (error) {
        throw describeFailure('open the comparison', error);
      }
    },

    async create(input, blobs) {
      try {
        // Read the bytes before opening the transaction: IndexedDB transactions
        // auto-commit as soon as control returns to the event loop with no pending requests.
        const data = await Promise.all(
          IMAGE_ROLES.map(async (role) => ({
            projectId: input.id,
            role,
            type: blobs[role].type,
            data: await blobs[role].arrayBuffer(),
          })),
        );
        const timestamp = now();
        const record: ProjectRecord = { ...input, createdAt: timestamp, updatedAt: timestamp };
        await db.transaction('rw', db.projects, db.images, async () => {
          await db.projects.put(record);
          await db.images.bulkPut(data);
        });
        return record;
      } catch (error) {
        throw describeFailure('save the comparison', error);
      }
    },

    async update(id, patch) {
      try {
        await db.projects.update(id, { ...patch, updatedAt: now() });
      } catch (error) {
        throw describeFailure('save changes', error);
      }
    },

    async remove(id) {
      try {
        await db.transaction('rw', db.projects, db.images, async () => {
          await db.projects.delete(id);
          await db.images.where('projectId').equals(id).delete();
        });
      } catch (error) {
        throw describeFailure('delete the comparison', error);
      }
    },
  };
}
