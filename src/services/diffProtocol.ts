import type { DiffComputation } from '@/domain/diff';
import type { DiffSettings } from '@/domain/types';

export interface DiffRequest {
  readonly jobId: number;
  /** Identifies the image pair so the worker can reuse decoded pixels between requests. */
  readonly sourceKey: string;
  readonly reference: Blob;
  readonly implementation: Blob;
  readonly settings: DiffSettings;
}

export interface DiffResult extends DiffComputation {
  /** The settings this result was computed with. */
  readonly settings: DiffSettings;
  /** Time spent in the comparison itself, excluding image decoding. */
  readonly compareMs: number;
  /** Time spent decoding both images to raw pixels; 0 when served from the worker cache. */
  readonly decodeMs: number;
}

export type DiffResponse =
  | { readonly type: 'result'; readonly jobId: number; readonly result: DiffResult }
  | { readonly type: 'error'; readonly jobId: number; readonly message: string };
