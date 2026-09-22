import {
  DeleteMessageCommand,
  ReceiveMessageCommand,
  SQSClient,
  SendMessageCommand,
} from '@aws-sdk/client-sqs';
import { OrchestratorEnv } from './config/env';
import { runSaga } from './saga';
import { FetchLike, FlujoMessage } from './types';

export interface FlujoQueue {
  enqueue(message: FlujoMessage): Promise<void>;
}

export type SqsSendLike = {
  send(command: unknown): Promise<unknown>;
};

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
    private readonly client: SqsSendLike = new SQSClient({
      region: process.env.AWS_REGION ?? 'us-east-1',
    }),
  ) {}

  async enqueue(message: FlujoMessage): Promise<void> {
    if (!this.queueUrl) {
      await this.fallback.enqueue(message);
      return;
    }

    await this.client.send(
      new SendMessageCommand({
        QueueUrl: this.queueUrl,
        MessageBody: JSON.stringify(message),
      }),
    );
  }
}

export function startSqsWorker(options: {
  queueUrl: string;
  env: OrchestratorEnv;
  fetchImpl: FetchLike;
  client?: SqsSendLike;
}): () => void {
  const client =
    options.client ??
    new SQSClient({ region: process.env.AWS_REGION ?? 'us-east-1' });
  let running = true;

  const loop = async () => {
    while (running) {
      try {
        const received = (await client.send(
          new ReceiveMessageCommand({
            QueueUrl: options.queueUrl,
            MaxNumberOfMessages: 1,
            WaitTimeSeconds: 20,
            VisibilityTimeout: 60,
          }),
        )) as { Messages?: Array<{ Body?: string; ReceiptHandle?: string }> };

        for (const message of received.Messages ?? []) {
          if (!message.Body || !message.ReceiptHandle) {
            continue;
          }

          const payload = JSON.parse(message.Body) as FlujoMessage;
          await runSaga(payload, options.env, options.fetchImpl);
          await client.send(
            new DeleteMessageCommand({
              QueueUrl: options.queueUrl,
              ReceiptHandle: message.ReceiptHandle,
            }),
          );
        }
      } catch (error) {
        if (!running) {
          return;
        }
        console.error('SQS worker error:', error);
        await new Promise((resolve) => setTimeout(resolve, 3000));
      }
    }
  };

  void loop();
  return () => {
    running = false;
  };
}
