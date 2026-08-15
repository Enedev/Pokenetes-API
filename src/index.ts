import { loadEnv } from './config/env';
import { startServer } from './app';

async function main() {
  const env = loadEnv();
  await startServer(env);
}

main().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
