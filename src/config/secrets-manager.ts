import {
  GetSecretValueCommand,
  SecretsManagerClient,
} from '@aws-sdk/client-secrets-manager';

export async function hydrateSecretsFromAws(
  client?: SecretsManagerClient,
): Promise<void> {
  const secretId = process.env.AWS_SECRETS_MANAGER_SECRET_ID;
  if (!secretId) {
    return;
  }

  const region = process.env.AWS_REGION ?? 'us-east-1';
  const sm = client ?? new SecretsManagerClient({ region });
  const response = await sm.send(
    new GetSecretValueCommand({ SecretId: secretId }),
  );

  if (!response.SecretString) {
    throw new Error(`Secrets Manager secret ${secretId} has no SecretString`);
  }

  const parsed: unknown = JSON.parse(response.SecretString);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`Secrets Manager secret ${secretId} must be a JSON object`);
  }

  for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
    if (typeof value === 'string') {
      process.env[key] = value;
    }
  }
}
