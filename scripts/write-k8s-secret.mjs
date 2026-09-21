import fs from "node:fs";
import dotenv from "dotenv";

const env = dotenv.parse(fs.readFileSync(".env.test"));
const sqs =
  env.AWS_SQS_QUEUE_URL ||
  "https://sqs.us-east-1.amazonaws.com/722500516562/pokenetes-flujo";

const yaml = `apiVersion: v1
kind: Secret
metadata:
  name: pokenetes-secrets
  namespace: pokenetes
type: Opaque
stringData:
  SUPABASE_URL: "${env.SUPABASE_URL || ""}"
  SUPABASE_PUBLISHABLE_KEY: "${env.SUPABASE_PUBLISHABLE_KEY || ""}"
  SUPABASE_SECRET_KEY: "${env.SUPABASE_SECRET_KEY || ""}"
  SUPABASE_JWKS_URL: "${env.SUPABASE_JWKS_URL || ""}"
  POKENETES_API_URL: "http://pokenetes-api"
  BIBLIO_API_URL: "${env.BIBLIO_API_URL || ""}"
  HOSPITALINE_API_URL: "${env.HOSPITALINE_API_URL || ""}"
  AWS_SQS_QUEUE_URL: "${sqs}"
`;

fs.writeFileSync("k8s/secret.yaml", yaml);
console.log("secret.yaml written (gitignored)");
