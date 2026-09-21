import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import dotenv from "dotenv";

const region = process.env.AWS_REGION || "us-east-1";
const secretId = "pokenetes/test";
const env = dotenv.parse(fs.readFileSync(".env.test"));
const sqs =
  env.AWS_SQS_QUEUE_URL ||
  "https://sqs.us-east-1.amazonaws.com/722500516562/pokenetes-flujo";

const payload = {
  SUPABASE_URL: env.SUPABASE_URL || "",
  SUPABASE_PUBLISHABLE_KEY: env.SUPABASE_PUBLISHABLE_KEY || "",
  SUPABASE_SECRET_KEY: env.SUPABASE_SECRET_KEY || "",
  SUPABASE_JWKS_URL: env.SUPABASE_JWKS_URL || "",
  POKENETES_API_URL: "http://pokenetes-api",
  BIBLIO_API_URL: env.BIBLIO_API_URL || "",
  HOSPITALINE_API_URL: env.HOSPITALINE_API_URL || "",
  AWS_SQS_QUEUE_URL: sqs,
};

const tmp = path.join(os.tmpdir(), "pokenetes-sm-payload.json");
fs.writeFileSync(tmp, JSON.stringify(payload));
const fileUri = `file://${tmp}`;
const awsBin =
  process.platform === "win32"
    ? "C:\\Program Files\\Amazon\\AWSCLIV2\\aws.exe"
    : "aws";
const opts = { encoding: "utf8" };

function runAws(args) {
  return spawnSync(awsBin, args, opts);
}

const created = runAws([
  "secretsmanager",
  "create-secret",
  "--name",
  secretId,
  "--region",
  region,
  "--secret-string",
  fileUri,
]);

if (created.status !== 0) {
  const updated = runAws([
    "secretsmanager",
    "put-secret-value",
    "--secret-id",
    secretId,
    "--region",
    region,
    "--secret-string",
    fileUri,
  ]);
  fs.unlinkSync(tmp);
  if (updated.status !== 0) {
    console.error(created.stderr || created.stdout);
    console.error(updated.stderr || updated.stdout);
    process.exit(updated.status ?? 1);
  }
} else {
  fs.unlinkSync(tmp);
}

console.log(`Secrets Manager secret ${secretId} is current (values not printed)`);
