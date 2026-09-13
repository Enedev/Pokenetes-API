import { FlujoMessage } from './types';

export interface FlujoQueue {
  enqueue(message: FlujoMessage): Promise<void>;
}

export class MemoryQueue implements FlujoQueue {
  constructor(private readonly worker: (message: FlujoMessage) => Promise<void>) {}

  async enqueue(message: FlujoMessage): Promise<void> {
    await this.worker(message);
  }
}

export class ConfiguredSqsQueue implements FlujoQueue {
  constructor(
    private readonly queueUrl: string,
    private readonly fallback: FlujoQueue,
  ) {}

  async enqueue(message: FlujoMessage): Promise<void> {
    if (!this.queueUrl) {
      await this.fallback.enqueue(message);
      return;
    }

    // SQS se cablea cuando exista la cola en AWS. Mientras tanto el saga corre en proceso.
    await this.fallback.enqueue(message);
  }
}
