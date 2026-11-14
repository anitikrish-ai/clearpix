export type JobStatus = 'queued' | 'processing' | 'done' | 'error' | 'canceled';

export interface BatchJob<TResult> {
  id: string;
  status: JobStatus;
  progress: number;
  result?: TResult;
  error?: string;
}

type Runner<TResult> = (signal: { canceled: boolean }) => Promise<TResult>;

/**
 * Concurrency-limited job runner. Each job is isolated: a thrown error marks that job
 * 'error' and never stops the rest of the batch. Cancellation is cooperative — a job
 * already mid-flight finishes its current step, then its result is discarded.
 */
export class BatchRunner<TResult> {
  private jobs = new Map<string, BatchJob<TResult>>();
  private cancelFlags = new Map<string, { canceled: boolean }>();
  private runners = new Map<string, Runner<TResult>>();
  private queueOrder: string[] = [];
  private active = 0;
  private concurrency: number;
  private onChange: (jobs: BatchJob<TResult>[]) => void;

  constructor(concurrency = Math.max(1, Math.min(4, (navigator as any).hardwareConcurrency ?? 2)), onChange: (jobs: BatchJob<TResult>[]) => void = () => {}) {
    this.concurrency = concurrency;
    this.onChange = onChange;
  }

  add(id: string, runner: Runner<TResult>) {
    this.jobs.set(id, { id, status: 'queued', progress: 0 });
    this.runners.set(id, runner);
    this.cancelFlags.set(id, { canceled: false });
    this.queueOrder.push(id);
    this.emit();
    this.pump();
  }

  retry(id: string) {
    const job = this.jobs.get(id);
    if (!job || job.status === 'processing') return;
    job.status = 'queued';
    job.error = undefined;
    job.progress = 0;
    this.cancelFlags.set(id, { canceled: false });
    if (!this.queueOrder.includes(id)) this.queueOrder.push(id);
    this.emit();
    this.pump();
  }

  cancel(id: string) {
    const flag = this.cancelFlags.get(id);
    if (flag) flag.canceled = true;
    const job = this.jobs.get(id);
    if (job && job.status === 'queued') {
      job.status = 'canceled';
      this.queueOrder = this.queueOrder.filter((qid) => qid !== id);
      this.emit();
    }
  }

  remove(id: string) {
    this.cancel(id);
    this.jobs.delete(id);
    this.runners.delete(id);
    this.cancelFlags.delete(id);
    this.queueOrder = this.queueOrder.filter((qid) => qid !== id);
    this.emit();
  }

  list(): BatchJob<TResult>[] {
    return Array.from(this.jobs.values());
  }

  private emit() {
    this.onChange(this.list());
  }

  private pump() {
    while (this.active < this.concurrency && this.queueOrder.length > 0) {
      const id = this.queueOrder.shift();
      if (!id) break;
      const job = this.jobs.get(id);
      const runner = this.runners.get(id);
      const flag = this.cancelFlags.get(id);
      if (!job || !runner || !flag || flag.canceled) continue;
      this.active++;
      job.status = 'processing';
      this.emit();
      runner(flag)
        .then((result) => {
          if (flag.canceled) {
            job.status = 'canceled';
          } else {
            job.status = 'done';
            job.result = result;
            job.progress = 100;
          }
        })
        .catch((err: unknown) => {
          if (flag.canceled) {
            job.status = 'canceled';
          } else {
            job.status = 'error';
            job.error = err instanceof Error ? err.message : String(err);
          }
        })
        .finally(() => {
          this.active--;
          this.emit();
          this.pump();
        });
    }
  }
}
