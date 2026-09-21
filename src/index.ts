import { loadEnv } from './config/env';
import { hydrateSecretsFromAws } from './config/secrets-manager';
import { startServer } from './app';

async function main() {
  await hydrateSecretsFromAws();
  const env = loadEnv();
  await startServer(env);
}

main().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
