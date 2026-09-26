import { SpanStatusCode, trace } from '@opentelemetry/api';
import { OrchestratorEnv } from './config/env';
import { fetchStep } from './http';
import { getFlujo, saveFlujo } from './store';
import { FetchLike, FlujoMessage } from './types';

const tracer = trace.getTracer('pokenetes-orchestrator');

export async function runSaga(
  message: FlujoMessage,
  env: OrchestratorEnv,
  fetchImpl: FetchLike,
): Promise<FlujoMessage> {
  const current = getFlujo(message.trace_id) ?? message;
  current.status = 'running';
  current.updated_at = new Date().toISOString();
  saveFlujo(current);

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
      cloud: 'oci',
      baseUrl: env.BIBLIO_API_URL,
      lastPath: env.BIBLIO_LAST_PATH,
      listPath: env.BIBLIO_LIST_PATH,
    },
    {
      name: 'hospitaline',
      cloud: 'azure',
      baseUrl: env.HOSPITALINE_API_URL,
      lastPath: env.HOSPITALINE_LAST_PATH,
      listPath: env.HOSPITALINE_LIST_PATH,
    },
  ];

  current.steps = [];

  for (const step of plan) {
    const result = await tracer.startActiveSpan(
      `flujo.${step.name}`,
      { attributes: { cloud: step.cloud, peer: step.name, entity: current.entity } },
      async (child) => {
        const stepResult = await fetchStep({
          baseUrl: step.baseUrl,
          lastPath: step.lastPath,
          listPath: step.listPath,
          traceId: current.trace_id,
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
    saveFlujo(current);
  }

  current.status = current.steps.some((step) => step.status === 'failed') ? 'failed' : 'completed';
  current.updated_at = new Date().toISOString();
  return saveFlujo(current);
}
