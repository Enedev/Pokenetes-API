export type FlujoStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface FlujoStep {
  name: string;
  cloud: string;
  status: 'pending' | 'ok' | 'skipped' | 'failed';
  source?: string;
  data?: unknown;
  error?: string;
}

export interface FlujoMessage {
  trace_id: string;
  entity: 'pokemon' | 'entrenador' | 'batalla';
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
