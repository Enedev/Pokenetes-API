export interface PeerRecord {
  api: string;
  source: string;
  entity: string;
  live: boolean;
  data: unknown;
  error?: string;
}

export type FetchLike = (input: string, init?: { headers?: Record<string, string>; signal?: AbortSignal }) => Promise<{
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
}>;

function joinUrl(base: string, path: string): string {
  return `${base.replace(/\/$/, '')}${path.startsWith('/') ? path : `/${path}`}`;
}

function pickLastRecord(payload: unknown): unknown {
  if (Array.isArray(payload)) {
    return payload.at(-1) ?? null;
  }

  if (payload && typeof payload === 'object') {
    const body = payload as Record<string, unknown>;

    if (body.local !== undefined) {
      return body.local;
    }

    for (const key of ['data', 'books', 'users', 'loans', 'hospitals', 'doctors', 'pacientes']) {
      const value = body[key];
      if (Array.isArray(value)) {
        return value.at(-1) ?? null;
      }
    }
  }

  return payload;
}

async function fetchJson(url: string, traceId: string, fetchImpl: FetchLike): Promise<unknown> {
  const response = await fetchImpl(url, {
    headers: {
      Accept: 'application/json',
      'x-trace-id': traceId,
    },
    signal: AbortSignal.timeout(5000),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return response.json();
}

export async function fetchPeerLast(options: {
  api: string;
  entity: string;
  baseUrl?: string;
  lastPath: string;
  listPath: string;
  traceId: string;
  fetchImpl?: FetchLike;
}): Promise<PeerRecord> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const baseUrl = options.baseUrl?.trim();

  if (!baseUrl) {
    return {
      api: options.api,
      source: '',
      entity: options.entity,
      live: false,
      data: null,
      error: `${options.api} URL is not configured`,
    };
  }

  const lastUrl = joinUrl(baseUrl, options.lastPath);
  const listUrl = joinUrl(baseUrl, options.listPath);

  try {
    const payload = await fetchJson(lastUrl, options.traceId, fetchImpl);
    return {
      api: options.api,
      source: lastUrl,
      entity: options.entity,
      live: true,
      data: pickLastRecord(payload),
    };
  } catch {
    try {
      const payload = await fetchJson(listUrl, options.traceId, fetchImpl);
      return {
        api: options.api,
        source: listUrl,
        entity: options.entity,
        live: true,
        data: pickLastRecord(payload),
      };
    } catch (error) {
      return {
        api: options.api,
        source: lastUrl,
        entity: options.entity,
        live: false,
        data: null,
        error: error instanceof Error ? error.message : 'peer request failed',
      };
    }
  }
}
