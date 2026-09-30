import { SpanStatusCode, trace } from '@opentelemetry/api';
import { OrchestratorEnv } from './config/env';
import { contextFromTraceparent, fetchDocument, fetchStep, readRecordId } from './http';
import { getFlujo, saveFlujo } from './store';
import { FetchLike, FlujoEntry, FlujoMessage, FlujoStep } from './types';

const tracer = trace.getTracer('pokenetes-orchestrator');

function peerData(value: unknown): unknown {
  if (value && typeof value === 'object' && 'data' in value) {
    return (value as { data: unknown }).data;
  }
  return value;
}

function stepsFromDocument(entry: FlujoEntry, source: string, body: unknown): FlujoStep[] {
  const doc = body && typeof body === 'object' ? body as Record<string, unknown> : {};
  const peers = doc.peers && typeof doc.peers === 'object' ? doc.peers as Record<string, unknown> : {};
  const step = (name: string, cloud: string, value: unknown): FlujoStep => ({
    name,
    cloud,
    status: value === undefined ? 'failed' : 'ok',
    source,
    data: value,
    error: value === undefined ? 'missing from the entry getById' : undefined,
  });

  if (entry === 'aws') {
    return [
      step('pokenetes', 'aws', doc.local ?? doc),
      step('biblio-express', 'azure', peerData(peers['biblio-express'])),
      step('hospitaline', 'gcp', peerData(peers.hospitaline)),
    ];
  }

  if (entry === 'azure') {
    return [
      step('biblio-express', 'azure', doc.book ?? doc),
      step('pokenetes', 'aws', peerData(doc.pokemon)),
      step('hospitaline', 'gcp', peerData(doc.doctor ?? doc.hospital ?? peers.hospitaline)),
    ];
  }

  return [
    step('hospitaline', 'gcp', doc.local ?? doc),
    step('pokenetes', 'aws', peerData(peers.pokenetes ?? doc.pokemon)),
    step('biblio-express', 'azure', peerData(peers['biblio-express'] ?? doc.book)),
  ];
}

export async function runSaga(
  message: FlujoMessage,
  env: OrchestratorEnv,
  fetchImpl: FetchLike,
): Promise<FlujoMessage> {
  const current = (await getFlujo(message.trace_id)) ?? message;
  current.status = 'running';
  current.updated_at = new Date().toISOString();
  await saveFlujo(current);

  const plan = [
    {
      name: 'pokenetes',
      cloud: 'aws',
      baseUrl: env.POKENETES_API_URL,
      lastPath: `/api/v2/${current.entity === 'book' || current.entity === 'hospital' ? 'pokemon' : current.entity}/last`,
      listPath: `/api/v2/${current.entity === 'book' || current.entity === 'hospital' ? 'pokemon' : current.entity}`,
    },
    {
      name: 'biblio-express',
      cloud: 'azure',
      baseUrl: env.BIBLIO_API_URL,
      lastPath: env.BIBLIO_LAST_PATH,
      listPath: env.BIBLIO_LIST_PATH,
    },
    {
      name: 'hospitaline',
      cloud: 'gcp',
      baseUrl: env.HOSPITALINE_API_URL,
      lastPath: env.HOSPITALINE_LAST_PATH,
      listPath: env.HOSPITALINE_LIST_PATH,
    },
  ];

  current.steps = [];
  const parent = contextFromTraceparent(message.traceparent);

  if (current.entry) {
    const step = plan.find((item) => item.cloud === current.entry);
    if (!step) {
      current.status = 'failed';
      return saveFlujo(current);
    }

    const outcome = await tracer.startActiveSpan(
      `flujo.${step.name}`,
      { attributes: { cloud: step.cloud, peer: step.name, entity: current.entity } },
      parent,
      async (child) => {
        const spanContext = trace.setSpan(parent, child);
        const last = await fetchStep({
          baseUrl: step.baseUrl,
          lastPath: step.lastPath,
          listPath: step.listPath,
          traceId: current.trace_id,
          parentContext: spanContext,
          fetchImpl,
        });
        if (last.status !== 'ok' || !step.baseUrl) {
          child.setAttribute('flujo.status', last.status);
          child.end();
          return [last];
        }

        const id = readRecordId(last.data);
        const getPath = step.cloud === 'aws'
          ? `/api/v2/${current.entity === 'book' || current.entity === 'hospital' ? 'pokemon' : current.entity}`
          : step.cloud === 'azure'
            ? '/api/v2/books'
            : '/api/v2/hospitals';
        if (!id) {
          child.end();
          return [{ ...last, status: 'failed' as const, error: 'last record has no id' }];
        }

        const byIdUrl = `${step.baseUrl.replace(/\/$/, '')}${getPath}/${encodeURIComponent(id)}`;
        const document = await fetchDocument({
          url: byIdUrl,
          traceId: current.trace_id,
          parentContext: spanContext,
          fetchImpl,
        });
        child.setAttribute('flujo.status', document.status);
        if (document.status === 'failed') {
          child.setStatus({ code: SpanStatusCode.ERROR, message: document.error });
          child.end();
          return [{ name: step.name, cloud: step.cloud, status: 'failed' as const, source: byIdUrl, error: document.error }];
        }

        child.end();
        return stepsFromDocument(current.entry as FlujoEntry, byIdUrl, document.data);
      },
    );

    current.steps = outcome.map((item) => ({
      name: 'name' in item ? item.name : step.name,
      cloud: 'cloud' in item ? item.cloud : step.cloud,
      status: item.status,
      source: item.source,
      data: item.data,
      error: item.error,
    }));
    current.status = current.steps.some((item) => item.status === 'failed') ? 'failed' : 'completed';
    current.updated_at = new Date().toISOString();
    return saveFlujo(current);
  }

  for (const step of plan) {
    const result = await tracer.startActiveSpan(
      `flujo.${step.name}`,
      { attributes: { cloud: step.cloud, peer: step.name, entity: current.entity } },
      parent,
      async (child) => {
        const stepResult = await fetchStep({
          baseUrl: step.baseUrl,
          lastPath: step.lastPath,
          listPath: step.listPath,
          traceId: current.trace_id,
          parentContext: trace.setSpan(parent, child),
          fetchImpl,
        });
        child.setAttribute('flujo.status', stepResult.status);
        if (stepResult.status === 'failed') {
          child.setStatus({ code: SpanStatusCode.ERROR, message: stepResult.error });
        }
        child.end();
        return stepResult;
      },
    );

    current.steps.push({
      name: step.name,
      cloud: step.cloud,
      status: result.status,
      source: result.source,
      data: result.data,
      error: result.error,
    });
    current.updated_at = new Date().toISOString();
    await saveFlujo(current);
  }

  current.status = current.steps.some((step) => step.status === 'failed') ? 'failed' : 'completed';
  current.updated_at = new Date().toISOString();
  return saveFlujo(current);
}
