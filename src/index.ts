import { loadEnv } from './config/env';
import { hydrateSecretsFromAws } from './config/secrets-manager';
import { startServer } from './app';
import { startTelemetry } from './telemetry';

async function main() {
  await hydrateSecretsFromAws();
  startTelemetry(process.env.OTEL_SERVICE_NAME ?? 'pokenetes-api');
  const env = loadEnv();
  await startServer(env);
}

main().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
