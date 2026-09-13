import { loadOrchestratorEnv } from './config/env';
import { buildOrchestratorApp } from './app';

async function main() {
  const env = loadOrchestratorEnv();
  const app = await buildOrchestratorApp(env);
  await app.listen({ port: env.PORT, host: '0.0.0.0' });
}

main().catch((error) => {
  console.error('Failed to start orchestrator:', error);
  process.exit(1);
});
