param(
  [string]$Region = "us-east-1"
)

$ErrorActionPreference = "Continue"

Write-Host "Checking AWS identity (class uses root)..."
aws sts get-caller-identity

function Ensure-Ecr([string]$Name) {
  aws ecr create-repository --repository-name $Name --region $Region | Out-Null
  if ($LASTEXITCODE -eq 0) {
    Write-Host "Created ECR $Name"
  } else {
    Write-Host "ECR $Name already exists or could not be created (check the sts output above)"
  }
}

Ensure-Ecr "pokenetes-api"
Ensure-Ecr "pokenetes-orchestrator"

aws sqs create-queue --queue-name pokenetes-flujo-dlq --region $Region | Out-Null
aws sqs create-queue --queue-name pokenetes-flujo --region $Region | Out-Null
aws logs create-log-group --log-group-name /pokenetes/api --region $Region 2>$null | Out-Null
aws logs create-log-group --log-group-name /pokenetes/orchestrator --region $Region 2>$null | Out-Null

Write-Host "Secrets Manager is created/updated with scripts/put-secrets-manager-test.mjs (needs .env.test)."

Write-Host ""
Write-Host "Verify:"
Write-Host "  aws ecr describe-repositories --region $Region"
Write-Host "  aws sqs list-queues --region $Region"
Write-Host "  aws secretsmanager describe-secret --secret-id pokenetes/test --region $Region"
