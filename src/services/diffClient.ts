import type { DiffRequest, DiffResponse, DiffResult } from './diffProtocol';

/** The subset of `Worker` the client relies on, so tests can substitute a fake. */
export interface DiffWorker {
  onmessage: ((event: MessageEvent<DiffResponse>) => void) | null;
  onerror: ((event: ErrorEvent) => void) | null;
  postMessage(message: DiffRequest): void;
  terminate(): void;
}

export type DiffJob = Omit<DiffRequest, 'jobId'>;

interface PendingJob {
  readonly jobId: number;
  readonly resolve: (result: DiffResult | null) => void;
  readonly reject: (error: Error) => void;
}

/**
 * Runs comparisons on a worker with latest-wins semantics: starting a new job
 * resolves the previous, still-running one with `null` so callers can ignore it.
 */
export class DiffClient {
  private worker: DiffWorker | null = null;
  private current: PendingJob | null = null;
  private nextJobId = 1;
  private readonly createWorker: () => DiffWorker;

  constructor(createWorker: () => DiffWorker) {
    this.createWorker = createWorker;
  }

  run(job: DiffJob): Promise<DiffResult | null> {
    this.current?.resolve(null);
    const jobId = this.nextJobId++;
    return new Promise<DiffResult | null>((resolve, reject) => {
      this.current = { jobId, resolve, reject };
      try {
        this.ensureWorker().postMessage({ ...job, jobId });
      } catch (error) {
        this.current = null;
        reject(error instanceof Error ? error : new Error('Could not start the comparison.'));
      }
    });
  }

  /** Abandon any running job and release the worker and its cached pixels. */
  dispose(): void {
    this.current?.resolve(null);
    this.current = null;
    this.worker?.terminate();
    this.worker = null;
  }

  private ensureWorker(): DiffWorker {
    if (this.worker) return this.worker;
    const worker = this.createWorker();
    worker.onmessage = (event) => {
      const response = event.data;
      const job = this.current;
      if (job?.jobId !== response.jobId) return;
      this.current = null;
      if (response.type === 'result') job.resolve(response.result);
      else job.reject(new Error(response.message));
    };
    worker.onerror = (event) => {
      // The worker is unusable after an uncaught error (commonly out-of-memory); start fresh.
      event.preventDefault();
      const job = this.current;
      this.current = null;
      this.worker?.terminate();
      this.worker = null;
      job?.reject(
        new Error(
          'The comparison worker stopped unexpectedly. The images may be too large for available memory.',
        ),
      );
    };
    this.worker = worker;
    return worker;
  }
}

export function createBrowserDiffClient(): DiffClient {
  return new DiffClient(
    () => new Worker(new URL('./diff.worker.ts', import.meta.url), { type: 'module' }),
  );
}
