import { loadOrchestratorEnv } from './config/env';
import { hydrateSecretsFromAws } from './config/secrets-manager';
import { buildOrchestratorApp } from './app';

async function main() {
  await hydrateSecretsFromAws();
  const env = loadOrchestratorEnv();
  const app = await buildOrchestratorApp(env);
  await app.listen({ port: env.PORT, host: '0.0.0.0' });
}

main().catch((error) => {
  console.error('Failed to start orchestrator:', error);
  process.exit(1);
});
