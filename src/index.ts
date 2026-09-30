async function main() {
  const { hydrateSecretsFromAws } = await import('./config/secrets-manager');
  await hydrateSecretsFromAws();

  const { startTelemetry } = await import('./telemetry');
  startTelemetry(process.env.OTEL_SERVICE_NAME ?? 'pokenetes-api');

  const { loadEnv } = await import('./config/env');
  const { startServer } = await import('./app');
  const env = loadEnv();
  await startServer(env);
}

main().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
