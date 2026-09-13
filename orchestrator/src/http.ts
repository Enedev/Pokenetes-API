import { FetchLike } from './types';

function joinUrl(base: string, path: string): string {
  return `${base.replace(/\/$/, '')}${path.startsWith('/') ? path : `/${path}`}`;
}

function pickLast(payload: unknown): unknown {
  if (Array.isArray(payload)) {
    return payload.at(-1) ?? null;
  }

  if (payload && typeof payload === 'object') {
    const body = payload as Record<string, unknown>;
    if (body.local !== undefined) {
      return body.local;
    }

    for (const key of ['data', 'books', 'users', 'loans', 'hospitals', 'doctors', 'pacientes', 'pokemon']) {
      if (Array.isArray(body[key])) {
        return (body[key] as unknown[]).at(-1) ?? null;
      }
    }
  }

  return payload;
}

export async function fetchStep(options: {
  baseUrl?: string;
  lastPath: string;
  listPath: string;
  traceId: string;
  fetchImpl: FetchLike;
}): Promise<{ status: 'ok' | 'skipped' | 'failed'; source?: string; data?: unknown; error?: string }> {
  const baseUrl = options.baseUrl?.trim();

  if (!baseUrl) {
    return { status: 'skipped', error: 'URL not configured yet' };
  }

  const lastUrl = joinUrl(baseUrl, options.lastPath);
  const listUrl = joinUrl(baseUrl, options.listPath);

  try {
    const response = await options.fetchImpl(lastUrl, {
      headers: { Accept: 'application/json', 'x-trace-id': options.traceId },
      signal: AbortSignal.timeout(5000),
    });

    if (response.ok) {
      return { status: 'ok', source: lastUrl, data: pickLast(await response.json()) };
    }
  } catch {
    // try list fallback
  }

  try {
    const response = await options.fetchImpl(listUrl, {
      headers: { Accept: 'application/json', 'x-trace-id': options.traceId },
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      return { status: 'failed', source: listUrl, error: `HTTP ${response.status}` };
    }

    return { status: 'ok', source: listUrl, data: pickLast(await response.json()) };
  } catch (error) {
    return {
      status: 'failed',
      source: lastUrl,
      error: error instanceof Error ? error.message : 'request failed',
    };
  }
}
