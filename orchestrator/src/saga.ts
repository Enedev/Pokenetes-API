import { SpanStatusCode, trace } from '@opentelemetry/api';
import { OrchestratorEnv } from './config/env';
import { contextFromTraceparent, fetchDocument, fetchStep, readRecordId } from './http';
import { getFlujo, saveFlujo } from './store';
import { FetchLike, FlujoMessage } from './types';

const tracer = trace.getTracer('pokenetes-orchestrator');

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
      lastPath: `/api/v2/${current.entity}/last`,
      listPath: `/api/v2/${current.entity}`,
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
  const selected = current.entry ? plan.filter((step) => step.cloud === current.entry) : plan;

  for (const step of selected) {
    const result = await tracer.startActiveSpan(
      `flujo.${step.name}`,
      { attributes: { cloud: step.cloud, peer: step.name, entity: current.entity } },
      parent,
      async (child) => {
        const spanContext = trace.setSpan(parent, child);
        const stepResult = await fetchStep({
          baseUrl: step.baseUrl,
          lastPath: step.lastPath,
          listPath: step.listPath,
          traceId: current.trace_id,
          parentContext: spanContext,
          fetchImpl,
        });

        if (current.entry && stepResult.status === 'ok') {
          const id = readRecordId(stepResult.data);
          const getPath = step.cloud === 'aws'
            ? `/api/v2/${current.entity}`
            : step.cloud === 'azure'
              ? '/api/v2/books'
              : '/api/v2/hospitals';
          if (!id || !step.baseUrl) {
            stepResult.status = 'failed';
            stepResult.error = 'getById id was not in the last record';
          } else {
            const byIdUrl = `${step.baseUrl.replace(/\/$/, '')}${getPath}/${encodeURIComponent(id)}`;
            const document = await fetchDocument({
              url: byIdUrl,
              traceId: current.trace_id,
              parentContext: spanContext,
              fetchImpl,
            });
            stepResult.source = byIdUrl;
            stepResult.status = document.status;
            stepResult.data = document.data ?? stepResult.data;
            stepResult.error = document.error;
          }
        }
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
