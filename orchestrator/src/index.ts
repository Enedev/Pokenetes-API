async function main() {
  const { hydrateSecretsFromAws } = await import('./config/secrets-manager');
  await hydrateSecretsFromAws();

  const { startTelemetry } = await import('./telemetry');
  startTelemetry(process.env.OTEL_SERVICE_NAME ?? 'pokenetes-orchestrator');

  const { loadOrchestratorEnv } = await import('./config/env');
  const { buildOrchestratorApp } = await import('./app');
  const { startSqsWorker } = await import('./queue');
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
