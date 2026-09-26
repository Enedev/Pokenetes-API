import { loadOrchestratorEnv } from './config/env';
import { hydrateSecretsFromAws } from './config/secrets-manager';
import { buildOrchestratorApp } from './app';
import { startSqsWorker } from './queue';
import { startTelemetry } from './telemetry';

async function main() {
  await hydrateSecretsFromAws();
  startTelemetry(process.env.OTEL_SERVICE_NAME ?? 'pokenetes-orchestrator');
  const env = loadOrchestratorEnv();
  const app = await buildOrchestratorApp(env);
  if (env.AWS_SQS_QUEUE_URL) {
    startSqsWorker({
      queueUrl: env.AWS_SQS_QUEUE_URL,
      env,
      fetchImpl: fetch,
    });
  }
  await app.listen({ port: env.PORT, host: '0.0.0.0' });
}

main().catch((error) => {
  console.error('Failed to start orchestrator:', error);
  process.exit(1);
});
