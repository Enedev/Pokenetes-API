export type FlujoStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface FlujoStep {
  name: string;
  cloud: string;
  status: 'pending' | 'ok' | 'skipped' | 'failed';
  source?: string;
  data?: unknown;
  error?: string;
}

export type FlujoEntry = 'aws' | 'azure' | 'gcp';

export interface FlujoMessage {
  trace_id: string;
  otel_trace_id?: string;
  traceparent?: string;
  entry?: FlujoEntry;
  entity: 'pokemon' | 'entrenador' | 'batalla' | 'book' | 'hospital';
  status: FlujoStatus;
  steps: FlujoStep[];
  created_at: string;
  updated_at: string;
}

export type FetchLike = (
  input: string,
  init?: { headers?: Record<string, string>; signal?: AbortSignal },
) => Promise<{
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
}>;
